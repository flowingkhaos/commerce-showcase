// Smoke: the REST contract the demo sites read, plus the access rules. Needs a seeded CMS.
// Run: bun run smoke [base-url]   (default http://localhost:4620)
// Writes (API key) clean up after themselves. Credentials come from the seed's creds file.
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
const richBlock = storeFr.body.docs?.find((d) => d.slug === 'home')?.layout.find((b) => b.blockType === 'richText')
check('rich text ships server-made html', /<h2[^>]*>Une page, un CMS/.test(richBlock?.html ?? ''), richBlock?.html?.slice(0, 80))
check('anonymous read hides the draft', Array.isArray(storeFr.body.docs) && !storeFr.body.docs.some((d) => d.slug === 'brouillon-prive'))
const draftAsk = await get(`/api/pages?where[slug][equals]=brouillon-prive&draft=true`)
check('anonymous draft=true still hides the draft', draftAsk.body.docs?.length === 0, JSON.stringify(draftAsk.body).slice(0, 120))

// Blog and docs.
const articles = await get('/api/articles?where[domain.slug][equals]=blog-demo&limit=10')
check('blog-demo: 2 articles (fr + en) with markdown bodies', articles.body.docs?.length === 2 && articles.body.docs.every((a) => a.body.includes('##')))
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
const made = await send('POST', '/api/pages', { title: 'Smoke', domain: storeId, locale: 'fr', slug: 'smoke-temp', _status: 'published', layout: [{ blockType: 'banner', text: 'smoke' }] })
check('API key creates a published page', made.status === 201, `${made.status} ${JSON.stringify(made.body).slice(0, 160)}`)
check('…and anonymous sees it at once', (await get(pagesOf('store', 'fr'))).body.docs.some((d) => d.slug === 'smoke-temp'))
if (made.body?.doc?.id) check('…and it deletes', (await send('DELETE', `/api/pages/${made.body.doc.id}`)).status === 200)

// Admin surface.
const login = await send('POST', '/api/users/login', { email: creds.SHOWCASE_CMS_ADMIN_EMAIL, password: creds.SHOWCASE_CMS_ADMIN_PASSWORD }, {})
check('admin login works (PBKDF2 on Node)', login.status === 200 && Boolean(login.body?.token), String(login.status))
const admin = await get('/admin/login')
check('/admin/login serves the admin', admin.status === 200 && admin.body.includes('</html>'), String(admin.status))
check('noindex header on the admin', admin.headers.get('x-robots-tag')?.includes('noindex'))

// Rate limit, last: it blocks this IP's sign-ins for a minute. An unknown email never locks
// the real admin account.
const codes = []
for (let i = 0; i < 12; i++) {
  codes.push((await send('POST', '/api/users/login', { email: 'nobody@example.invalid', password: 'x' }, {})).status)
}
check('sign-in attempts are rate limited (429 by the 12th)', codes.at(-1) === 429, codes.join(' '))

console.log(`\n${pass}/${pass + fail} passed`)
process.exit(fail ? 1 : 0)
