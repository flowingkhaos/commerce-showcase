import type { CollectionConfig, Endpoint } from 'payload'

import { createHmac, timingSafeEqual } from 'node:crypto'

import { anyone, isAdmin } from './fields'
import { requestRebuild } from './rebuild'

// Shopify → CMS (architecture § F7): the store's prices, stock and collections are baked in when
// it is built, so Shopify calls POST /api/shopify/webhooks when one changes (apps/shop-setup
// subscribes the topics). The CMS checks the signature, asks GitHub to rebuild the store, and
// writes one row to webhook-events. The store's how-it-works page shows the latest rows.

const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const MAX_BODY = 1_000_000

export const WebhookEvents: CollectionConfig = {
  slug: 'webhook-events',
  versions: false,
  admin: {
    useAsTitle: 'summary',
    group: 'Sites',
    defaultColumns: ['topic', 'summary', 'rebuild', 'createdAt'],
    description: 'Calls from Shopify, newest first, kept for a week. Only the CMS writes here.',
  },
  // Public like the store itself: a topic, a title or a stock count, never the raw call.
  access: { read: anyone, create: () => false, update: () => false, delete: isAdmin },
  defaultSort: '-createdAt',
  fields: [
    { name: 'topic', type: 'text', required: true },
    { name: 'summary', type: 'text' },
    { name: 'rebuild', type: 'select', options: ['requested', 'failed', 'skipped'], required: true },
    // X-Shopify-Webhook-Id is the same on every retry of one call, so a retry never makes a second row.
    { name: 'webhookId', type: 'text', required: true, unique: true, admin: { readOnly: true } },
  ],
}

const text = (status: number, body: string) =>
  new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } })

// Products and collections carry a title and a handle; stock levels an item id and a count;
// deletes only an id.
const summarize = (b: Record<string, unknown>): string =>
  String(
    b.title ? `${b.title}${b.handle ? ` (${b.handle})` : ''}`
    : b.inventory_item_id ? `inventory item ${b.inventory_item_id}: ${b.available ?? '?'} available`
    : b.id ? `id ${b.id}` : '',
  ).slice(0, 200)

export const shopifyWebhook: Endpoint = {
  path: '/shopify/webhooks',
  method: 'post',
  handler: async (req) => {
    // The HMAC key is the Shopify app's client secret. Fails closed: no secret, no webhooks.
    const secret = process.env.SHOPIFY_CLIENT_SECRET
    if (!secret) return text(503, 'Shopify webhooks are off on this server.')
    if (Number(req.headers.get('content-length')) > MAX_BODY) return text(413, 'Too large.')
    const raw = Buffer.from(await req.arrayBuffer!())
    const sig = Buffer.from(req.headers.get('x-shopify-hmac-sha256') ?? '', 'base64')
    const want = createHmac('sha256', secret).update(raw).digest()
    if (raw.length > MAX_BODY || sig.length !== want.length || !timingSafeEqual(sig, want)) return text(401, 'Bad signature.')

    const topic = req.headers.get('x-shopify-topic') || 'unknown'
    const webhookId = req.headers.get('x-shopify-webhook-id')
    if (!webhookId) return text(400, 'No X-Shopify-Webhook-Id.')
    const { payload } = req
    const seen = await payload.count({ collection: 'webhook-events', where: { webhookId: { equals: webhookId } }, overrideAccess: true })
    if (seen.totalDocs) return text(200, 'Already logged.')

    let body: Record<string, unknown> = {}
    try {
      body = JSON.parse(raw.toString('utf8'))
    } catch {}
    // ponytail: a dispatch that fails is not retried here; the next change or the nightly build covers it.
    const rebuild = await requestRebuild(payload, 'store', `shopify ${topic}`)
    await payload.create({ collection: 'webhook-events', data: { topic, summary: summarize(body), rebuild, webhookId }, overrideAccess: true })
    await payload.delete({
      collection: 'webhook-events',
      where: { createdAt: { less_than: new Date(Date.now() - WEEK_MS).toISOString() } },
      overrideAccess: true,
    })
    return text(200, 'Logged.')
  },
}
