// Smoke: the REST contract the demo sites read, plus the access rules. Needs a seeded CMS.
// Run: bun run smoke [base-url]   (default http://localhost:4620)
// Writes (API key) clean up after themselves. Credentials come from the seed's creds file.
// With PAYLOAD_SECRET in the env, it also signs live preview links and opens them.
import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'

const base = (process.argv[2] || 'http://localhost:4620').replace(/\/$/, '')
const credsFile = process.env.SHOWCASE_CMS_CREDS || `${homedir()}/.config/kos/showcase-cms.local.env`
const creds = Object.fromEntries(
  readFileSync(credsFile, 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
)
const key = { Authorization: `users API-Key ${creds.SHOWCASE_CMS_API_KEY}` }

let pass = 0
let fail = 0
const check = (name, ok, detail = '') => {
  ok ? pass++ : fail++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok || !detail ? '' : ` — ${detail}`}`)
}
const get = async (path, headers = {}) => {
  const res = await fetch(base + path, { headers })
  return { status: res.status, headers: res.headers, body: res.headers.get('content-type')?.includes('json') ? await res.json() : await res.text() }
}
const send = async (method, path, data, headers = key) => {
  const res = await fetch(base + path, { method, headers: { ...headers, 'content-type': 'application/json' }, body: data && JSON.stringify(data) })
  return { status: res.status, body: await res.json().catch(() => null) }
}
const pagesOf = (domain, locale) =>
  `/api/pages?where[domain.slug][equals]=${domain}&where[locale][equals]=${locale}&depth=1&limit=100`

// The read the demo sites make. Their pages are written by the sites themselves, so only the
// shape is checked there; content checks run on the seeded store pages.
for (const domain of ['renovation-demo', 'plumbing-demo', 'store']) {
  for (const locale of ['fr', 'en']) {
    const { status, body } = await get(pagesOf(domain, locale))
    check(`${domain} ${locale}: 200`, status === 200 && Array.isArray(body.docs), String(status))
    check(`${domain} ${locale}: only this domain and locale`, body.docs?.every((d) => d.locale === locale && d.domain?.slug === domain))
    check(`${domain} ${locale}: every block has a blockType, every doc an updatedAt`, body.docs?.every((d) => d.updatedAt && d.layout?.every((b) => typeof b.blockType === 'string')))
  }
}
const storeFr = await get(pagesOf('store', 'fr'))
const storeEn = await get(pagesOf('store', 'en'))
check('store: fr home published', storeFr.body.docs?.some((d) => d.slug === 'home'))
check('store en: translationOf points at the fr doc', storeEn.body.docs?.some((d) => d.slug === 'home' && d.translationOf?.slug === 'home' && d.translationOf?.locale === 'fr'))
check('anonymous read hides the draft', Array.isArray(storeFr.body.docs) && !storeFr.body.docs.some((d) => d.slug === 'brouillon-prive'))
const draftAsk = await get(`/api/pages?where[slug][equals]=brouillon-prive&draft=true`)
check('anonymous draft=true still hides the draft', draftAsk.body.docs?.length === 0, JSON.stringify(draftAsk.body).slice(0, 120))

// Blog and docs.
const articles = await get('/api/articles?where[domain.slug][equals]=blog-demo&limit=50')
check('blog-demo: the seed pair, every article with a markdown body', articles.body.docs?.some((a) => a.slug === 'un-seul-endroit-pour-vos-contenus') && articles.body.docs.every((a) => typeof a.body === 'string' && a.body.length > 0))
const docs = await get('/api/docs?where[domain.slug][equals]=store&where[locale][equals]=en')
check('store docs: en doc present', docs.body.docs?.[0]?.slug === 'one-cms-many-sites')
const domains = await get('/api/domains?limit=20&depth=0')
check('4 domains, public', domains.status === 200 && domains.body.totalDocs >= 4)

// Access rules.
check('anonymous cannot list users', (await get('/api/users')).status === 403)
const anonCreate = await send('POST', '/api/pages', { title: 'x' }, {})
check('anonymous cannot create a page', anonCreate.status === 403, String(anonCreate.status))
check('API key reads the draft', (await get('/api/pages?where[slug][equals]=brouillon-prive&draft=true', key)).body.docs?.length === 1)
const storeId = storeFr.body.docs?.[0]?.domain?.id
if (!storeId) {
  console.log(`\nFAIL the store read did not answer (${storeFr.status}); stopping`)
  process.exit(1)
}
const dupe = await send('POST', '/api/pages', { title: 'dupe', domain: storeId, locale: 'fr', slug: 'home', _status: 'published' })
check('duplicate (domain, locale, slug) is refused', dupe.status === 400, String(dupe.status))
const delDomain = await send('DELETE', `/api/domains/${storeId}`)
check('deleting a domain with content is blocked', delDomain.status === 409, `${delDomain.status} ${JSON.stringify(delDomain.body).slice(0, 120)}`)
// The page brings its own rich text, so the html check never depends on what a site seeded.
const node = { version: 1, direction: null, format: '', indent: 0 }
const text = { type: 'text', text: 'Une page, un CMS', version: 1, detail: 0, format: 0, mode: 'normal', style: '' }
const richText = { root: { ...node, type: 'root', children: [{ ...node, type: 'heading', tag: 'h2', children: [text] }] } }
const made = await send('POST', '/api/pages', { title: 'Smoke', domain: storeId, locale: 'fr', slug: 'smoke-temp', _status: 'published', layout: [{ blockType: 'banner', text: 'smoke' }, { blockType: 'richText', richText }] })
check('API key creates a published page', made.status === 201, `${made.status} ${JSON.stringify(made.body).slice(0, 160)}`)
const madeBack = (await get(pagesOf('store', 'fr'))).body.docs.find((d) => d.slug === 'smoke-temp')
check('…and anonymous sees it at once', !!madeBack)
const richBlock = madeBack?.layout.find((b) => b.blockType === 'richText')
check('rich text ships server-made html', /<h2[^>]*>Une page, un CMS/.test(richBlock?.html ?? ''), richBlock?.html?.slice(0, 80))
if (made.body?.doc?.id) check('…and it deletes', (await send('DELETE', `/api/pages/${made.body.doc.id}`)).status === 200)
const list = { blockType: 'collectionList', heading: 'Shop by collection', items: [{ handle: 'hoodies', description: 'Heavy fleece.' }] }
const listed = await send('POST', '/api/pages', { title: 'Smoke list', domain: storeId, locale: 'fr', slug: 'smoke-list', _status: 'published', layout: [list] })
const listBack = listed.body?.doc && (await get(`/api/pages/${listed.body.doc.id}`)).body.layout?.[0]
check('collectionList block round-trips', listBack?.heading === list.heading && listBack.items?.[0]?.handle === 'hoodies' && listBack.items[0].description === 'Heavy fleece.', `${listed.status} ${JSON.stringify(listBack ?? listed.body).slice(0, 160)}`)
if (listed.body?.doc?.id) await send('DELETE', `/api/pages/${listed.body.doc.id}`)

// Store content: product words and each site's menus.
const storeSite = []
for (const c of ['products', 'site']) {
  const { status, body } = await get(`/api/${c}?where[domain.slug][equals]=store&depth=1`)
  check(`${c}: anonymous read 200 with docs`, status === 200 && Array.isArray(body.docs), String(status))
  check(`${c}: anonymous cannot create`, (await send('POST', `/api/${c}`, { domain: storeId, locale: 'fr', slug: 'x' }, {})).status === 403)
  if (c === 'site') storeSite.push(...(body.docs ?? []))
}
// Until the store's own en menu is seeded, the smoke writes a throwaway one first.
const siteDoc = { domain: storeId, locale: 'en', nav: [{ label: 'Shop', url: '/en/shop' }], footerNote: 'smoke' }
const site1 = storeSite.some((d) => d.locale === 'en') ? { status: 201 } : await send('POST', '/api/site', siteDoc)
const site2 = await send('POST', '/api/site', siteDoc)
check('site: duplicate (domain, locale) is refused', site1.status === 201 && site2.status === 400, `${site1.status} ${site2.status}`)
for (const s of [site1, site2]) if (s.body?.doc?.id) await send('DELETE', `/api/site/${s.body.doc.id}`)

// Admin surface.
const login = await send('POST', '/api/users/login', { email: creds.SHOWCASE_CMS_ADMIN_EMAIL, password: creds.SHOWCASE_CMS_ADMIN_PASSWORD }, {})
check('admin login works (PBKDF2 on Node)', login.status === 200 && Boolean(login.body?.token), String(login.status))
const admin = await get('/admin/login')
check('/admin/login serves the admin', admin.status === 200 && admin.body.includes('</html>'), String(admin.status))
check('noindex header on the admin', admin.headers.get('x-robots-tag')?.includes('noindex'))

// Live preview: the CMS answers a draft only to a link it signed (src/preview.ts).
const secret = process.env.PAYLOAD_SECRET
const now = Math.floor(Date.now() / 1000)
const signed = (collection, id, exp = now + 3600) => {
  const sig = createHmac('sha256', secret).update(`preview:${collection}:${id}:${exp}`).digest('hex')
  return `/api/preview?${new URLSearchParams({ collection, id: String(id), exp: String(exp), sig })}`
}
const homeId = storeFr.body.docs.find((d) => d.slug === 'home')?.id
const forged = await get(`/api/preview?collection=pages&id=${homeId}&exp=${now + 3600}&sig=${'0'.repeat(64)}`)
check('preview: a forged link is refused', forged.status === 403, String(forged.status))
if (secret) {
  const opened = await get(signed('pages', homeId))
  check('preview: a signed link opens the page, no-store', opened.status === 200 && opened.body.id === homeId && opened.headers.get('cache-control') === 'no-store', String(opened.status))
  check('preview: no authorship users in the answer', !('createdBy' in opened.body) && !('updatedBy' in opened.body))
  check('preview: an expired link is refused', (await get(signed('pages', homeId, now - 1))).status === 403)
} else console.log('skip preview: signed links need PAYLOAD_SECRET in the env')

// Shopify webhooks (src/shopify.ts): only a call signed with the app's client secret is logged,
// and a retry of the same call is not logged twice. The signed call asks for a real rebuild.
const hook = (body, headers) => fetch(base + '/api/shopify/webhooks', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body })
check('webhook: an unsigned call is refused', [401, 503].includes((await hook('{}', { 'x-shopify-webhook-id': 'smoke' })).status))
check('webhook-events: anonymous cannot create', (await send('POST', '/api/webhook-events', { topic: 'x', rebuild: 'skipped', webhookId: 'x' }, {})).status === 403)
const shopSecret = process.env.SHOPIFY_CLIENT_SECRET
if (shopSecret) {
  const body = JSON.stringify({ id: 1, title: 'Smoke', handle: 'smoke-test' })
  const webhookId = `smoke-${Date.now()}`
  const headers = { 'x-shopify-hmac-sha256': createHmac('sha256', shopSecret).update(body).digest('base64'), 'x-shopify-topic': 'products/update', 'x-shopify-webhook-id': webhookId }
  const first = await hook(body, headers)
  const again = await hook(body, headers)
  const rows = (await get(`/api/webhook-events?where[webhookId][equals]=${webhookId}`)).body.docs ?? []
  check('webhook: a signed call is logged once, retry included', first.status === 200 && again.status === 200 && rows.length === 1 && rows[0].summary === 'Smoke (smoke-test)', `${first.status} ${again.status} ${rows.length}`)
  check('webhook: a changed body is refused', (await hook(body.replace('Smoke', 'Smoky'), headers)).status === 401)
  for (const r of rows) await send('DELETE', `/api/webhook-events/${r.id}`)
} else console.log('skip webhook: a signed call needs SHOPIFY_CLIENT_SECRET in the env')

// Visitor door. Production holds the real Turnstile secret, which no script can pass, so only
// the refusals run there. Locally Cloudflare's always-pass test keys open the whole door.
const door = (headers = {}) =>
  fetch(base + '/api/visitor/enter', {
    method: 'POST',
    redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded', ...headers },
    body: new URLSearchParams({ 'cf-turnstile-response': 'XXXX.DUMMY.TOKEN.XXXX' }),
  })
check('door: a cross-site post is refused', (await door({ 'sec-fetch-site': 'cross-site' })).status === 403)
const entered = await door()
if (!base.startsWith('http://localhost')) {
  check('door: a script without a real Turnstile pass is refused', entered.status === 403, String(entered.status))
} else {
  const cookie = entered.headers.get('set-cookie')?.split(';')[0] ?? ''
  check('door: 303 to /admin with a session cookie', entered.status === 303 && entered.headers.get('location') === '/admin' && cookie.startsWith('payload-token='), String(entered.status))
  const v = { Cookie: cookie, Origin: base } // Payload reads the cookie only with an Origin (CSRF)
  const me = (await get('/api/users/me', v)).body.user
  check('door: the session is a generated visitor', me?.role === 'visitor' && me.email.endsWith('@showcase.invalid'))
  const dom = Object.fromEntries(domains.body.docs.map((d) => [d.slug, d.id]))
  const draft = { title: 'Visitor smoke', locale: 'fr', slug: 'visitor-smoke', layout: [{ blockType: 'banner', text: 'visitor' }] }
  check('visitor: cannot write in renovation-demo', (await send('POST', '/api/pages', { ...draft, domain: dom['renovation-demo'] }, v)).status === 403)
  check('visitor: cannot publish', (await send('POST', '/api/pages', { ...draft, domain: dom['blog-demo'], _status: 'published' }, v)).status === 403)
  const mine = await send('POST', '/api/pages?draft=true', { ...draft, domain: dom['blog-demo'] }, v)
  const doc = mine.body?.doc
  check('visitor: makes a draft in blog-demo, owned by itself', mine.status === 201 && doc?._status === 'draft' && (doc.createdBy?.value?.id ?? doc.createdBy?.value) === me.id, `${mine.status} ${JSON.stringify(mine.body).slice(0, 160)}`)
  check('visitor: cannot edit the store home', [403, 404].includes((await send('PATCH', `/api/pages/${homeId}`, { title: 'x' }, v)).status))
  check('visitor: sees only itself in users', (await get('/api/users', v)).body.totalDocs === 1)
  check('visitor: cannot make itself admin', (await send('PATCH', `/api/users/${me.id}`, { role: 'admin' }, v)).status === 403)
  check('anonymous: never sees the visitor draft', !(await get(pagesOf('blog-demo', 'fr'))).body.docs.some((d) => d.slug === 'visitor-smoke'))
  if (secret && doc) check('preview: shows the visitor draft', (await get(signed('pages', doc.id))).body.title === 'Visitor smoke')
  if (doc) check('visitor: deletes its own draft', (await send('DELETE', `/api/pages/${doc.id}`, null, v)).status === 200)
  const product = await send('POST', '/api/products?draft=true', { domain: dom.store, locale: 'fr', slug: 'visitor-smoke', badges: [{ label: 'Nouveau' }] }, v)
  check('visitor: drafts a product story in the store', product.status === 201 && product.body?.doc?._status === 'draft', `${product.status} ${JSON.stringify(product.body).slice(0, 160)}`)
  if (product.body?.doc) await send('DELETE', `/api/products/${product.body.doc.id}`, null, v)
  if (me) check('visitor row deletes (admin key)', (await send('DELETE', `/api/users/${me.id}`)).status === 200)
}

// Rate limit, last: it blocks this IP's sign-ins for a minute. An unknown email never locks
// the real admin account.
const codes = []
for (let i = 0; i < 12; i++) {
  codes.push((await send('POST', '/api/users/login', { email: 'nobody@example.invalid', password: 'x' }, {})).status)
}
check('sign-in attempts are rate limited (429 by the 12th)', codes.at(-1) === 429, codes.join(' '))

console.log(`\n${pass}/${pass + fail} passed`)
process.exit(fail ? 1 : 0)
