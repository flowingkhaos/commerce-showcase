// Build-time Shopify reads (prerendering, in Node). Server only: islands never import this file,
// so no gql document or token reaches the browser bundle.
import {
  createShopifyRequestContext,
  createStorefrontClient,
  gql,
  type StorefrontApi,
  type StorefrontClient,
} from '@shopify/hydrogen'
import { PRIVATE_STOREFRONT_API_TOKEN, PUBLIC_STORE_DOMAIN } from 'astro:env/server'
import type { Locale } from '../i18n'
import { marketFor } from './market'

const clients: Partial<Record<Locale, StorefrontClient>> = {}

// One client per locale: the request context carries the market, and Hydrogen injects
// $country/$language into every query that declares them (hydrogen-markets).
function client(locale: Locale) {
  return (clients[locale] ??= createStorefrontClient({
    type: 'private_no_buyer_context',
    requestContext: createShopifyRequestContext({ request: { headers: new Headers() }, i18n: marketFor(locale) }),
    config: { storeDomain: PUBLIC_STORE_DOMAIN, privateStorefrontToken: PRIVATE_STOREFRONT_API_TOKEN },
  }))
}

// Builds fail loud (architecture convention 5): a GraphQL error never ships as an empty page.
function ok<T>(result: { data?: T | null; errors?: readonly { message: string }[] }): T {
  if (result.errors?.length) throw new Error(`Shopify: ${result.errors.map((e) => e.message).join('; ')}`)
  if (!result.data) throw new Error('Shopify: empty response')
  return result.data
}

const CARD = gql(`
  fragment Card on Product {
    id
    handle
    title
    productType
    availableForSale
    featuredImage { url altText width height }
    priceRange { minVariantPrice { amount currencyCode } maxVariantPrice { amount currencyCode } }
    summary: metafield(namespace: "specs", key: "summary") { value }
  }
`)

const VARIANT = gql(`
  fragment VariantFields on ProductVariant {
    id
    title
    availableForSale
    selectedOptions { name value }
    price { amount currencyCode }
    compareAtPrice { amount currencyCode }
    image { url altText width height }
    product { title handle }
    sku
  }
`)

const PRODUCT_QUERY = gql(
  `
  query Product($handle: String!, $selectedOptions: [SelectedOptionInput!]!, $country: CountryCode, $language: LanguageCode)
  @inContext(country: $country, language: $language) {
    product(handle: $handle) {
      ...Card
      vendor
      requiresSellingPlan
      options {
        name
        optionValues {
          name
          firstSelectableVariant { ...VariantFields }
          swatch { color }
        }
      }
      encodedVariantExistence
      encodedVariantAvailability
      selectedOrFirstAvailableVariant(selectedOptions: $selectedOptions, ignoreUnknownOptions: true, caseInsensitiveMatch: true) {
        ...VariantFields
      }
      adjacentVariants(selectedOptions: $selectedOptions, ignoreUnknownOptions: true, caseInsensitiveMatch: true) {
        ...VariantFields
      }
      variants(first: 100) { nodes { ...VariantFields } }
      images(first: 8) { nodes { url altText width height } }
      specs: metafields(identifiers: [
        { namespace: "specs", key: "fabric" }, { namespace: "specs", key: "weight" }, { namespace: "specs", key: "fit" },
        { namespace: "specs", key: "details" }, { namespace: "specs", key: "care" }
      ]) { key value }
    }
    productRecommendations(productHandle: $handle) { ...Card }
  }
`,
  [CARD, VARIANT],
)

const COLLECTION_QUERY = gql(
  `
  query Collection($handle: String!, $first: Int!, $country: CountryCode, $language: LanguageCode)
  @inContext(country: $country, language: $language) {
    collection(handle: $handle) {
      handle
      title
      image { url altText width height }
      products(first: $first, sortKey: CREATED) { nodes { ...Card } }
    }
  }
`,
  [CARD],
)

const COLLECTIONS_QUERY = gql(
  `
  query Collections($country: CountryCode, $language: LanguageCode) @inContext(country: $country, language: $language) {
    collections(first: 50) {
      nodes {
        handle
        title
        image { url altText width height }
        products(first: 50, sortKey: CREATED) { nodes { handle title priceRange { minVariantPrice { amount currencyCode } maxVariantPrice { amount currencyCode } } } }
      }
    }
  }
`,
)

const HANDLES_QUERY = gql(`query Handles { products(first: 250) { nodes { handle } } }`)
const SHOP_QUERY = gql(`query Shop { shop { id } }`)

export type ProductData = NonNullable<StorefrontApi.ResultOf<typeof PRODUCT_QUERY>['product']>
export type CollectionData = NonNullable<StorefrontApi.ResultOf<typeof COLLECTION_QUERY>['collection']>
// The island gets every variant as its local cache: any pick resolves without a network call,
// so a sold-out combination shows as sold out instead of "select options".
export type FormProduct = Omit<ProductData, 'variants' | 'images' | 'specs' | 'summary' | 'featuredImage'>
export function formProduct(p: ProductData): FormProduct {
  const { variants, images: _i, specs: _s, summary: _m, featuredImage: _f, ...rest } = p
  return { ...rest, adjacentVariants: variants.nodes }
}

export type Card = CollectionData['products']['nodes'][number]
export type CollectionSummary = StorefrontApi.ResultOf<typeof COLLECTIONS_QUERY>['collections']['nodes'][number]

// One build reads each document once per locale, however many pages ask for it.
const memo = new Map<string, Promise<unknown>>()
const once = <T>(key: string, load: () => Promise<T>) => {
  // A failed read is not kept: the /cart page reuses these loaders in a long-lived Worker isolate.
  if (!memo.has(key)) memo.set(key, load().catch((e) => (memo.delete(key), Promise.reject(e))))
  return memo.get(key) as Promise<T>
}

export const getProduct = (locale: Locale, handle: string) =>
  once(`p:${locale}:${handle}`, async () =>
    ok(await client(locale).graphql(PRODUCT_QUERY, { variables: { handle, selectedOptions: [] } })),
  )

/** null when Shopify has no collection by that handle (a CMS productGrid may name one). */
export const getCollection = (locale: Locale, handle: string, first = 50) =>
  once(`c:${locale}:${handle}:${first}`, async () =>
    ok(await client(locale).graphql(COLLECTION_QUERY, { variables: { handle, first } })).collection,
  )

export const getCollections = (locale: Locale) =>
  once(`cs:${locale}`, async () => {
    const nodes = ok(await client(locale).graphql(COLLECTIONS_QUERY)).collections.nodes
    if (!nodes.length) throw new Error('Shopify: the store has no collections')
    return nodes
  })

export const getHandles = () =>
  once('handles', async () => ok(await client('en').graphql(HANDLES_QUERY)).products.nodes.map((p) => p.handle))
export const getShopId = () => once('shop', async () => ok(await client('en').graphql(SHOP_QUERY)).shop.id)

// Store code: the two top collections are the strip's banks (Bank A, Bank B). Their
// sub-collections are the ones whose products all sit in that bank, so `featured` (mixed) drops out.
const BANKS = ['apparel', 'equipment']
export async function getBanks(locale: Locale) {
  const all = await getCollections(locale)
  return BANKS.map((handle) => {
    const top = all.find((c) => c.handle === handle)
    if (!top) throw new Error(`Shopify: no "${handle}" collection`)
    const inBank = new Set(top.products.nodes.map((p) => p.handle))
    const subs = all.filter(
      (c) => !BANKS.includes(c.handle) && c.products.nodes.length > 0 && c.products.nodes.every((p) => inBank.has(p.handle)),
    )
    return { top, subs }
  })
}
