// The Worker entry: Hydrogen's Shopify routes run before Astro's router (hydrogen-request-handlers,
// single-hook shape). Prerendered pages never get here: Workers assets serve them first.
import { handle } from '@astrojs/cloudflare/handler'
import { handleShopifyRedirects, handleShopifyRoutes } from '@shopify/hydrogen'
import { localeOfPath, routeTemplates } from './lib/market'
import { cartHandlers, requestShopify } from './lib/storefront'

export default {
  async fetch(request, env, ctx) {
    const { requestContext, storefrontClient } = requestShopify(request, env)

    const shopifyRoute = handleShopifyRoutes({
      request,
      requestContext,
      storefrontClient,
      routeTemplates,
      handlers: [cartHandlers],
    })
    if (shopifyRoute) return shopifyRoute

    const response = await handle(request, env, ctx)
    if (response.status === 404) {
      const redirect = await handleShopifyRedirects({ request, routeTemplates, storefrontClient })
      if (redirect) return redirect
      // Astro serves the English 404 for every miss; a French path gets the French one.
      if (localeOfPath(new URL(request.url).pathname) === 'fr') {
        const fr = await env.ASSETS.fetch(new URL('/fr/404', request.url))
        if (fr.ok) return new Response(fr.body, { status: 404, headers: fr.headers })
      }
    }
    // Asset responses have immutable headers; copy before Hydrogen adds its cookies.
    const out = new Response(response.body, response)
    requestContext.applyResponseHeaders(out.headers)
    return out
  },
} satisfies ExportedHandler<Env>
