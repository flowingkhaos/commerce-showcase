// Security headers (architecture "Security checks"). One source for both paths a response can
// take: Worker responses get them in src/worker.ts, prebuilt pages through Cloudflare's
// `_headers` file, which astro.config.mjs writes at build. No astro:env here: the config imports it.

/** Only our origin, Google Fonts, Shopify's CDN (runtime script, photos) and the CMS (images). */
export function csp(cmsOrigin: string, frameAncestors = "'none'") {
  return [
    "default-src 'self'",
    // Inline: Astro's island bootstrap, the mode and X-ray scripts, Shopify's runtime bootstrap.
    "script-src 'self' 'unsafe-inline' https://cdn.shopify.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    'font-src https://fonts.gstatic.com',
    `img-src 'self' data: https://cdn.shopify.com ${cmsOrigin}`,
    "connect-src 'self'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    `frame-ancestors ${frameAncestors}`,
  ].join('; ')
}

export const BASE_HEADERS = {
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-content-type-options': 'nosniff',
}

// The routes table: collections and products are noindex; docs and how-it-works are indexed.
export const NOINDEX = ['/collections/', '/products/', '/fr/collections/', '/fr/products/']

/** Cloudflare's `_headers` file for the prebuilt pages. */
export function assetHeaders(cmsOrigin: string) {
  const all = Object.entries({ 'content-security-policy': csp(cmsOrigin), ...BASE_HEADERS })
  return [
    '/*',
    ...all.map(([k, v]) => `  ${k}: ${v}`),
    ...NOINDEX.flatMap((p) => [`${p}*`, '  x-robots-tag: noindex']),
    '',
  ].join('\n')
}
