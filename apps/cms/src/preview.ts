import type { Endpoint, LivePreviewConfig } from 'payload'

import { createHmac, timingSafeEqual } from 'node:crypto'

// Live preview (architecture § F6, amended 2026-10-27): the admin's iframe opens
// `<domains.url>/preview?collection&id&exp&sig`; the site passes those four values to
// GET /api/preview here, which checks the signature and answers the latest draft. The secret
// never leaves the CMS, so no site holds a key. The site reloads on Payload's
// `payload-document-event` message (sent after every save and autosave).

const HOUR_S = 3600
const COLLECTIONS = new Set(['pages', 'articles', 'docs', 'products'])

// Keyed on PAYLOAD_SECRET itself (not Payload's derived key), so the smoke can sign a link too.
const sign = (collection: string, id: string, exp: number) =>
  createHmac('sha256', process.env.PAYLOAD_SECRET!).update(`preview:${collection}:${id}:${exp}`).digest('hex')

export const livePreview: LivePreviewConfig = {
  breakpoints: [
    { name: 'phone', label: 'Phone', width: 390, height: 844 },
    { name: 'laptop', label: 'Laptop', width: 1366, height: 768 },
  ],
  // No site URL on the domain → no preview tab. exp = the top of the hour after next, so the
  // URL stays the same between saves (the iframe does not reload twice) and lives 1–2 h.
  url: async ({ collectionConfig, data, req }) => {
    const domainId = data?.domain && typeof data.domain === 'object' ? data.domain.id : data?.domain
    if (!collectionConfig || !data?.id || !domainId) return null
    const domain = await req.payload.findByID({ collection: 'domains', id: domainId, depth: 0, req, disableErrors: true })
    if (!domain?.url) return null
    const exp = (Math.floor(Date.now() / 1000 / HOUR_S) + 2) * HOUR_S
    const id = String(data.id)
    const q = new URLSearchParams({ collection: collectionConfig.slug, id, exp: String(exp) })
    q.set('sig', sign(collectionConfig.slug, id, exp))
    return `${domain.url.replace(/\/$/, '')}/preview?${q}`
  },
}

const json = (status: number, body: unknown) =>
  Response.json(body, { status, headers: { 'cache-control': 'no-store', 'x-robots-tag': 'noindex' } })

export const previewEndpoint: Endpoint = {
  path: '/preview',
  method: 'get',
  handler: async (req) => {
    const p = req.searchParams
    const collection = p.get('collection') ?? ''
    const id = p.get('id') ?? ''
    const exp = Number(p.get('exp'))
    const sig = Buffer.from(p.get('sig') ?? '', 'hex')
    const want = Buffer.from(sign(collection, id, exp), 'hex')
    const valid = COLLECTIONS.has(collection) && /^\d+$/.test(id) && exp > Date.now() / 1000
      && sig.length === want.length && timingSafeEqual(sig, want)
    if (!valid) return json(403, { error: 'Invalid or expired preview link. Reopen the preview from the admin.' })
    const doc = await req.payload.findByID({
      collection: collection as 'pages',
      id,
      draft: true,
      depth: 1,
      overrideAccess: true,
      disableErrors: true,
    })
    if (!doc) return json(404, { error: 'This document no longer exists.' })
    // overrideAccess populates the authorship users: never hand an email to a site.
    const { createdBy: _c, updatedBy: _u, ...page } = doc
    return json(200, page)
  },
}
