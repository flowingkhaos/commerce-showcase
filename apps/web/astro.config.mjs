// @ts-check
import cloudflare from '@astrojs/cloudflare'
import preact from '@astrojs/preact'
import { defineConfig, envField } from 'astro/config'
import { readFile, writeFile } from 'node:fs/promises'
import { assetHeaders } from './src/lib/headers.ts'

const CMS_URL = 'https://showcase-cms-1065657380974.us-east5.run.app'

// Prebuilt pages never reach the Worker, so their security headers go in Cloudflare's
// `_headers` file. The adapter adds its own rules to the same file; keep both.
/** @type {URL} */
let clientDir
/** @type {import('astro').AstroIntegration} */
const securityHeaders = {
  name: 'security-headers',
  hooks: {
    'astro:config:done': ({ config }) => {
      clientDir = config.build.client
    },
    'astro:build:done': async () => {
      const file = new URL('_headers', clientDir)
      const theirs = await readFile(file, 'utf8').catch(() => '')
      const origin = new URL(process.env.CMS_URL ?? CMS_URL).origin
      await writeFile(file, `${assetHeaders(origin)}\n${theirs}`)
    },
  },
}

export default defineConfig({
  // Every page is prerendered at build, where the Shopify and CMS reads happen. Only the
  // Shopify routes (/api/cart, /checkout, cart permalinks, the SFAPI proxy) and /cart run in
  // the Worker, through src/worker.ts.
  output: 'static',
  // /fr and /products/x as fr.html and x.html: Workers assets serve them without a slash redirect.
  build: { format: 'file' },
  trailingSlash: 'never',
  adapter: cloudflare({
    // Build reads run in Node: a slow CMS cold start or a big catalogue can't hit a Worker limit.
    prerenderEnvironment: 'node',
    // No astro:assets in phase 1; Shopify's CDN sizes product photos.
    imageService: 'passthrough',
  }),
  integrations: [preact(), securityHeaders],
  // No sessions: the cart lives in Shopify (its id in the `cart` cookie), so no KV binding.
  session: false,
  env: {
    schema: {
      PUBLIC_STORE_DOMAIN: envField.string({ context: 'server', access: 'public' }),
      PRIVATE_STOREFRONT_API_TOKEN: envField.string({ context: 'server', access: 'secret' }),
      CMS_URL: envField.string({ context: 'server', access: 'public', default: CMS_URL }),
    },
  },
})
