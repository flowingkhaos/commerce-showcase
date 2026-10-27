// The Worker entry: the guard, then Hydrogen's Shopify routes before Astro's router
// (hydrogen-request-handlers, single-hook shape). Prerendered pages never get here: Workers
// assets serve them first, with their headers from `_headers`.
import { handle } from '@astrojs/cloudflare/handler'
import { handleShopifyRedirects, handleShopifyRoutes } from '@shopify/hydrogen'
import { CMS_URL } from 'astro:env/server'
import { BASE_HEADERS, csp, NOINDEX } from './lib/headers'
import { localeOfPath, routeTemplates } from './lib/market'
import { cartHandlers, requestShopify } from './lib/storefront'

const CMS_ORIGIN = new URL(CMS_URL).origin
const MAX_BODY = 64 * 1024

const refuse = (status: number, error: string, route: string) =>
  Response.json({ error, route }, { status, headers: { 'cache-control': 'no-store' } })

// Architecture "Security checks": method allow-list; a POST comes from our own pages, with a
// small body; cart writes and previews are rate limited per IP.
async function guard(request: Request, env: Env, url: URL) {
  const route = url.pathname
  if (!['GET', 'HEAD', 'POST', 'OPTIONS'].includes(request.method)) return refuse(405, 'method not allowed', route)
  if (request.method === 'POST') {
    if (request.headers.get('origin') !== url.origin || request.headers.get('sec-fetch-site') === 'cross-site')
      return refuse(403, 'cross-site request refused', route)
    if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY) return refuse(413, 'body too large', route)
  }
  if (request.method === 'POST' || route === '/preview') {
    const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown'
    const { success } = await env.LIMITER.limit({ key: `${route}:${ip}` })
    if (!success) return refuse(429, 'too many requests, try again in a minute', route)
  }
  return null
}

function secure(response: Response, url: URL) {
  const out = new Response(response.body, response)
  const preview = url.pathname === '/preview'
  // /preview alone may sit in a frame, and only in the CMS admin's.
  out.headers.set('content-security-policy', csp(CMS_ORIGIN, preview ? CMS_ORIGIN : "'none'"))
  for (const [k, v] of Object.entries(BASE_HEADERS)) out.headers.set(k, v)
  if (preview || NOINDEX.some((p) => url.pathname.startsWith(p))) out.headers.set('x-robots-tag', 'noindex')
  if (preview) out.headers.set('cache-control', 'no-store')
  return out
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    const refused = await guard(request, env, url)
    if (refused) return secure(refused, url)

    const { requestContext, storefrontClient } = requestShopify(request, env)
    const shopifyRoute = handleShopifyRoutes({
      request,
      requestContext,
      storefrontClient,
      routeTemplates,
      handlers: [cartHandlers],
    })
    if (shopifyRoute) return secure(await shopifyRoute, url)

    const response = await handle(request, env, ctx)
    if (response.status === 404) {
      const redirect = await handleShopifyRedirects({ request, routeTemplates, storefrontClient })
      if (redirect) return secure(redirect, url)
      // Astro serves the English 404 for every miss; a French path gets the French one.
      if (localeOfPath(url.pathname) === 'fr') {
        const fr = await env.ASSETS.fetch(new URL('/fr/404', request.url))
        if (fr.ok) return secure(new Response(fr.body, { status: 404, headers: fr.headers }), url)
      }
    }
    const out = secure(response, url)
    requestContext.applyResponseHeaders(out.headers)
    return out
  },
} satisfies ExportedHandler<Env>
