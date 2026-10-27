import type { Endpoint, Payload } from 'payload'

import { randomBytes } from 'node:crypto'
import { generatePayloadCookie } from 'payload/shared'

// The visitor door (architecture § Structure and routes): « Enter as visitor » on the login view
// posts here. Turnstile check → sweep → daily cap → a fresh visitor user → its session cookie.
// Fails closed: no TURNSTILE_SECRET_KEY, no door.

const DAY_MS = 24 * 60 * 60 * 1000
const DAILY_CAP = 300
const CONTENT = ['pages', 'articles', 'docs', 'products'] as const

const text = (status: number, body: string) =>
  new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } })

/** Deletes visitors older than a day, and every draft they made first (Payload's createdBy). */
export async function sweepVisitors(payload: Payload): Promise<void> {
  const { docs } = await payload.find({
    collection: 'users',
    where: { role: { equals: 'visitor' }, createdAt: { less_than: new Date(Date.now() - DAY_MS).toISOString() } },
    depth: 0,
    pagination: false,
    overrideAccess: true,
  })
  if (!docs.length) return
  const ids = docs.map((u) => u.id)
  for (const collection of CONTENT) {
    await payload.delete({ collection, where: { 'createdBy.value': { in: ids } }, overrideAccess: true })
  }
  await payload.delete({ collection: 'users', where: { id: { in: ids } }, overrideAccess: true })
  payload.logger.info(`visitor door: swept ${ids.length} visitor(s)`)
}

export const visitorEnter: Endpoint = {
  path: '/visitor/enter',
  method: 'post',
  handler: async (req) => {
    const secret = process.env.TURNSTILE_SECRET_KEY
    if (!secret) return text(503, 'The visitor door is closed on this server.')
    if (req.headers.get('sec-fetch-site') === 'cross-site') return text(403, 'Cross-site request refused.')

    const form = await req.formData!()
    const ip = req.headers.get('x-forwarded-for')?.split(',').pop()?.trim()
    const check = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: new URLSearchParams({ secret, response: String(form.get('cf-turnstile-response') ?? ''), ...(ip && { remoteip: ip }) }),
    })
      .then((r) => r.json() as Promise<{ success?: boolean }>)
      .catch(() => ({ success: false }))
    if (!check.success) return text(403, 'The bot check did not pass. Go back to the sign-in page and try again.')

    const { payload } = req
    await sweepVisitors(payload)
    const { totalDocs } = await payload.count({ collection: 'users', where: { role: { equals: 'visitor' } }, overrideAccess: true })
    if (totalDocs >= DAILY_CAP) return text(429, 'The visitor door is full for today. Come back tomorrow.')

    // A generated identity, never personal data; the password is thrown away after sign-in.
    const email = `visitor-${randomBytes(6).toString('hex')}@showcase.invalid`
    const password = randomBytes(24).toString('hex')
    await payload.create({ collection: 'users', data: { email, password, role: 'visitor' }, overrideAccess: true })
    const { token } = await payload.login({ collection: 'users', data: { email, password } })
    const cookie = generatePayloadCookie({
      collectionAuthConfig: payload.collections.users.config.auth,
      cookiePrefix: payload.config.cookiePrefix,
      token: token!,
    })
    return new Response(null, { status: 303, headers: { location: '/admin', 'set-cookie': cookie, 'cache-control': 'no-store' } })
  },
}
