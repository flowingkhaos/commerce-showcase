// Writes .dev.vars (read by wrangler dev and, through the Cloudflare adapter, by the build)
// from an env file that uses the SHOPIFY_* names. Values are never printed.
// Usage: node scripts/dev-vars.mjs <path to env file>
import { readFileSync, writeFileSync } from 'node:fs'

const source = process.argv[2]
if (!source) throw new Error('usage: node scripts/dev-vars.mjs <env file>')

const vars = {}
for (const line of readFileSync(source, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  // Strip one pair of matching quotes; never evaluate the value (it may hold `&` or `$`).
  vars[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2')
}

const map = {
  PUBLIC_STORE_DOMAIN: 'SHOPIFY_STORE_DOMAIN',
  PUBLIC_STOREFRONT_API_TOKEN: 'SHOPIFY_STOREFRONT_PUBLIC_TOKEN',
  PRIVATE_STOREFRONT_API_TOKEN: 'SHOPIFY_STOREFRONT_PRIVATE_TOKEN',
}
const out = Object.entries(map).map(([to, from]) => {
  if (!vars[from]) throw new Error(`${from} is missing in ${source}`)
  return `${to}=${JSON.stringify(vars[from])}`
})
writeFileSync(new URL('../.dev.vars', import.meta.url), out.join('\n') + '\n', { mode: 0o600 })
console.log(`wrote .dev.vars (${out.length} variables)`)
