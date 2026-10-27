// Request-scoped Shopify access for the Worker: the Shopify routes (src/worker.ts) and the /cart page.
import { createCartServerHandlers, createShopifyRequestContext, createStorefrontClient, gql } from '@shopify/hydrogen'
import { localeOfPath, marketFor } from './market'

// The cart drawer flags lines Shopify can no longer sell (Rack Drawer board, "unavailable").
export const cartHandlers = createCartServerHandlers({
  fragment: gql(`
    fragment CartFragment on Cart {
      lines(first: 250) { nodes { merchandise { ... on ProductVariant { availableForSale } } } }
    }
  `),
})

type ShopifyEnv = { PUBLIC_STORE_DOMAIN: string; PRIVATE_STOREFRONT_API_TOKEN: string }

// /api/cart has no locale in its path; a same-origin Referer under /fr means a French page asked,
// so cart lines come back with French titles.
function localeOf(request: Request) {
  const url = new URL(request.url)
  if (localeOfPath(url.pathname) === 'fr') return 'fr'
  const referer = request.headers.get('referer')
  if (!referer) return 'en'
  const from = new URL(referer)
  return from.origin === url.origin ? localeOfPath(from.pathname) : 'en'
}

export function requestShopify(request: Request, env: ShopifyEnv) {
  // On Workers the buyer IP is Cloudflare's trusted header; Shopify uses it for bot protection.
  const buyerIp = request.headers.get('CF-Connecting-IP')
  if (!buyerIp) throw new Error('CF-Connecting-IP is missing')
  const requestContext = createShopifyRequestContext({ request, i18n: marketFor(localeOf(request)), buyerIp })
  const storefrontClient = createStorefrontClient({
    type: 'private',
    requestContext,
    config: { storeDomain: env.PUBLIC_STORE_DOMAIN, privateStorefrontToken: env.PRIVATE_STOREFRONT_API_TOKEN },
  })
  return { requestContext, storefrontClient }
}
