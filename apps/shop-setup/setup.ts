// Load the OVRLD catalogue into a Shopify development store, through the Admin GraphQL API.
//   bun --env-file=<your env file> apps/shop-setup/setup.ts [--prune]
// Needs SHOPIFY_STORE_DOMAIN, SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET: a Dev Dashboard app
// installed on a dev store in the same organization (client credentials grant, 24 h token).
// Safe to re-run: products and collections are matched by handle and updated in place.
// --prune deletes every product and collection that is not in catalog.ts (the sample data).
import { collections, fr, products, STOCK, type Product } from './catalog'

const API = '2026-10'
const PUBLICATION = 'OVRLD storefront' // the Headless channel's storefront
const { SHOPIFY_STORE_DOMAIN: shop, SHOPIFY_CLIENT_ID: id, SHOPIFY_CLIENT_SECRET: secret } = process.env
if (!shop || !id || !secret) throw new Error('Set SHOPIFY_STORE_DOMAIN, SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET.')
const prune = process.argv.includes('--prune')

const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ grant_type: 'client_credentials', client_id: id, client_secret: secret }),
})
if (!tokenRes.ok) throw new Error(`Token request failed: ${tokenRes.status} (is the app installed on ${shop}?)`)
const { access_token: token } = (await tokenRes.json()) as { access_token: string }

// One GraphQL call; waits and retries when Shopify throttles, throws on any user error.
async function gql<T = any>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`https://${shop}/admin/api/${API}/graphql.json`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-shopify-access-token': token },
      body: JSON.stringify({ query, variables }),
    })
    const body = (await res.json()) as { data?: any; errors?: { message: string; extensions?: { code?: string } }[] }
    if (body.errors?.some((e) => e.extensions?.code === 'THROTTLED') && attempt < 5) {
      await Bun.sleep(2000 * (attempt + 1))
      continue
    }
    if (body.errors) throw new Error(JSON.stringify(body.errors))
    for (const result of Object.values(body.data ?? {}) as any[]) {
      if (result?.userErrors?.length) throw new Error(JSON.stringify(result.userErrors))
    }
    return body.data
  }
}

const all = async (field: 'products' | 'collections') =>
  (await gql(`{ ${field}(first: 250) { nodes { id handle } } }`))[field].nodes as { id: string; handle: string }[]

// Store setup: the location for stock, the storefront to publish to, French, the spec fields.
const setup = await gql(`{
  locations(first: 10) { nodes { id name isActive } }
  publications(first: 20) { nodes { id name } }
  shopLocales { locale published }
  metafieldDefinitions(first: 50, ownerType: PRODUCT, namespace: "specs") { nodes { key } }
}`)
const location = (setup.locations.nodes.find((l: any) => l.name === 'Shop location') ?? setup.locations.nodes.find((l: any) => l.isActive)).id
const publication = setup.publications.nodes.find((p: any) => p.name === PUBLICATION)?.id
if (!publication) throw new Error(`No sales channel named "${PUBLICATION}": create it in the Headless channel first.`)

const french = setup.shopLocales.find((l: any) => l.locale === 'fr')
if (!french) await gql(`mutation { shopLocaleEnable(locale: "fr") { userErrors { field message } } }`)
if (!french?.published) await gql(`mutation { shopLocaleUpdate(locale: "fr", shopLocale: { published: true }) { userErrors { field message } } }`)

const specKeys = [...new Set(products.flatMap((p) => Object.keys(p.specs)))]
const defined = new Set(setup.metafieldDefinitions.nodes.map((d: any) => d.key))
for (const key of specKeys.filter((k) => !defined.has(k))) {
  await gql(
    `mutation ($d: MetafieldDefinitionInput!) { metafieldDefinitionCreate(definition: $d) { userErrors { field message code } } }`,
    { d: { name: key[0].toUpperCase() + key.slice(1), namespace: 'specs', key, type: 'single_line_text_field', ownerType: 'PRODUCT', access: { storefront: 'PUBLIC_READ' } } },
  )
}

if (prune) {
  const keepP = new Set(products.map((p) => p.handle))
  for (const p of (await all('products')).filter((p) => !keepP.has(p.handle))) {
    await gql(`mutation ($id: ID!) { productDelete(input: { id: $id }) { userErrors { field message } } }`, { id: p.id })
    console.log(`deleted product ${p.handle}`)
  }
  const keepC = new Set<string>(collections.map((c) => c.handle))
  for (const c of (await all('collections')).filter((c) => !keepC.has(c.handle))) {
    await gql(`mutation ($id: ID!) { collectionDelete(input: { id: $id }) { userErrors { field message } } }`, { id: c.id })
    console.log(`deleted collection ${c.handle}`)
  }
}

// French for one or more resources: fetch each field's digest, then register the translation.
async function translate(resourceId: string, values: Record<string, string>) {
  const res = await gql(`query ($ids: [ID!]!) { translatableResourcesByIds(first: 1, resourceIds: $ids) { nodes { translatableContent { key digest } } } }`, { ids: [resourceId] })
  const content = res.translatableResourcesByIds.nodes[0]?.translatableContent ?? []
  const translations = content
    .filter((c: any) => values[c.key])
    .map((c: any) => ({ locale: 'fr', key: c.key, value: values[c.key], translatableContentDigest: c.digest }))
  if (translations.length) {
    await gql(`mutation ($id: ID!, $t: [TranslationInput!]!) { translationsRegister(resourceId: $id, translations: $t) { userErrors { field message } } }`, { id: resourceId, t: translations })
  }
}

const publish = (resourceId: string) =>
  gql(`mutation ($id: ID!, $p: ID!) { publishablePublish(id: $id, input: [{ publicationId: $p }]) { userErrors { field message } } }`, { id: resourceId, p: publication })

const existing = new Map((await gql(`{ products(first: 250) { nodes { handle mediaCount { count } } } }`)).products.nodes.map((p: any) => [p.handle, p.mediaCount.count]))

for (const p of products) {
  // Photos go up once: a re-run with media already in place leaves them alone.
  const withImages = !existing.get(p.handle) && p.images?.length
  const imageFor = (options: Record<string, string>) =>
    withImages ? p.images!.find((i) => i.forOption && options[i.forOption[0]] === i.forOption[1]) : undefined
  const input = {
    title: p.title.en,
    handle: p.handle,
    descriptionHtml: `<p>${p.description.en}</p>`,
    productType: p.type,
    vendor: 'OVRLD',
    tags: [p.tag],
    status: 'ACTIVE',
    productOptions: p.options.map((name, i) => ({ name, position: i + 1, values: [...new Set(p.variants.map((v) => v.options[name]))].map((v) => ({ name: v })) })),
    variants: p.variants.map((v) => {
      const image = imageFor(v.options)
      return {
        optionValues: p.options.map((name) => ({ optionName: name, name: v.options[name] })),
        price: v.price,
        inventoryItem: { tracked: true, sku: sku(p, v.options) },
        inventoryQuantities: [{ locationId: location, name: 'available', quantity: v.stock ?? STOCK }],
        ...(image ? { file: { originalSource: image.url, alt: image.alt, contentType: 'IMAGE' } } : {}),
      }
    }),
    metafields: Object.entries(p.specs).map(([key, value]) => ({ namespace: 'specs', key, type: 'single_line_text_field', value: value.en })),
    ...(withImages ? { files: p.images!.map((i) => ({ originalSource: i.url, alt: i.alt, contentType: 'IMAGE' })) } : {}),
  }
  const { productSet } = await gql(
    `mutation ($input: ProductSetInput!, $handle: String!) {
      productSet(synchronous: true, input: $input, identifier: { handle: $handle }) {
        product { id options { id name optionValues { id name } } metafields(namespace: "specs", first: 20) { nodes { id key } } }
        userErrors { field message code }
      }
    }`,
    { input, handle: p.handle },
  )
  const product = productSet.product
  await publish(product.id)
  await translate(product.id, { title: p.title.fr, body_html: `<p>${p.description.fr}</p>` })
  for (const option of product.options) {
    if (fr[option.name]) await translate(option.id, { name: fr[option.name] })
    for (const value of option.optionValues) if (fr[value.name]) await translate(value.id, { name: fr[value.name] })
  }
  for (const m of product.metafields.nodes) await translate(m.id, { value: p.specs[m.key].fr })
  console.log(`product ${p.handle}: ${p.variants.length} variants${withImages ? `, ${p.images!.length} photos` : ''}`)
}

const existingC = new Map((await all('collections')).map((c) => [c.handle, c.id]))
for (const c of collections) {
  const input = {
    title: c.title.en,
    handle: c.handle,
    ruleSet: { appliedDisjunctively: false, rules: [{ column: c.rule[0], relation: 'EQUALS', condition: c.rule[1] }] },
    ...('image' in c && !existingC.has(c.handle) ? { image: { src: c.image, altText: c.title.en } } : {}),
  }
  const id = existingC.get(c.handle)
  const data = id
    ? await gql(`mutation ($i: CollectionInput!) { collectionUpdate(input: $i) { collection { id } userErrors { field message } } }`, { i: { id, ...input } })
    : await gql(`mutation ($i: CollectionInput!) { collectionCreate(input: $i) { collection { id } userErrors { field message } } }`, { i: input })
  const collectionId = (data.collectionUpdate ?? data.collectionCreate).collection.id
  await publish(collectionId)
  await translate(collectionId, { title: c.title.fr })
  console.log(`collection ${c.handle}`)
}

function sku(p: Product, options: Record<string, string>) {
  const parts = p.options.filter((o) => o !== 'Title').map((o) => options[o].replace(/[^A-Za-z0-9]+/g, '').toUpperCase().slice(0, 8))
  return ['OVRLD', p.sku, ...parts].join('-')
}

console.log(`done: ${products.length} products, ${collections.length} collections on ${shop}`)
