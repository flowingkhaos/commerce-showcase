import { type NextRequest, NextResponse } from 'next/server'

// Per-IP limits per minute (architecture § Security checks): cheap 429s keep a flood inside
// Cloud Run's free tier. ponytail: in-memory counters, correct while max-instances is 1;
// a shared store if the CMS ever runs more than one instance.
const WINDOW_MS = 60_000
const LIMITS = { auth: 10, write: 60, read: 300 } as const
const AUTH = /^\/api\/users\/(login|forgot-password|reset-password|first-register|unlock)\b/
const hits = new Map<string, { count: number; reset: number }>()

export function proxy(req: NextRequest) {
  if (Number(req.headers.get('content-length') ?? 0) > 10 * 1024 * 1024) {
    return new NextResponse('Payload too large', { status: 413 })
  }
  const kind = AUTH.test(req.nextUrl.pathname) ? 'auth' : req.method === 'GET' || req.method === 'HEAD' ? 'read' : 'write'
  // Cloud Run's front end appends the real client IP last; earlier entries are client-supplied.
  const ip = req.headers.get('x-forwarded-for')?.split(',').pop()?.trim() || 'local'
  const now = Date.now()
  if (hits.size > 50_000) hits.clear()
  const key = `${kind}:${ip}`
  const hit = hits.get(key)
  if (!hit || hit.reset < now) {
    hits.set(key, { count: 1, reset: now + WINDOW_MS })
  } else if (++hit.count > LIMITS[kind]) {
    return new NextResponse('Too many requests', {
      status: 429,
      headers: { 'retry-after': String(Math.ceil((hit.reset - now) / 1000)) },
    })
  }
  return NextResponse.next()
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] }
