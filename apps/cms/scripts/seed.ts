// Seed the showcase CMS: the four site rows, FR + EN samples for the store and the blog, one
// private draft. Create-only: a row that exists (matched by its natural key) is never touched,
// so re-running never reverts what a person or a site's session wrote. Run: bun run seed
// The renovation and plumbing sites write their own pages (their sessions, via the API).
//
// Admin + API key: written to $SHOWCASE_CMS_CREDS (default ~/.config/kos/showcase-cms.local.env),
// mode 600, never printed.
import type { CollectionSlug, Payload, Where } from 'payload'

import { convertMarkdownToLexical, editorConfigFactory } from '@payloadcms/richtext-lexical'
import { randomBytes, randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import { getPayload } from 'payload'

import config from '../src/payload.config'

const payload: Payload = await getPayload({ config })
const editorConfig = editorConfigFactory.default({ config: payload.config })
const rich = (markdown: string) => convertMarkdownToLexical({ editorConfig, markdown })

// Payload 4's Local API checks access by default; the seed acts as the system.
const sys = { overrideAccess: true } as const

async function ensure(collection: CollectionSlug, where: Where, data: Record<string, unknown>, draft = false) {
  const { docs } = await payload.find({ collection, where, limit: 1, draft: true, ...sys })
  if (docs[0]) return docs[0]
  const body = collection === 'domains' ? data : { ...data, _status: draft ? 'draft' : 'published' }
  return payload.create({ collection, data: body as never, draft, ...sys })
}

// --- admin user + API key -------------------------------------------------------------
// On the server the three values come from the environment (the VM's .env) and no file is
// written; locally they live in the creds file, generated on the first run.
const fromEnv = Boolean(process.env.SHOWCASE_CMS_ADMIN_PASSWORD && process.env.SHOWCASE_CMS_API_KEY)
const credsFile = process.env.SHOWCASE_CMS_CREDS || path.join(homedir(), '.config/kos/showcase-cms.local.env')
const creds: Record<string, string | undefined> = fromEnv
  ? process.env
  : Object.fromEntries(
      existsSync(credsFile)
        ? readFileSync(credsFile, 'utf8')
            .split('\n')
            .filter((l) => l.includes('='))
            .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)])
        : [],
    )
const email = creds.SHOWCASE_CMS_ADMIN_EMAIL || 'admin@showcase.local'
const password = creds.SHOWCASE_CMS_ADMIN_PASSWORD || randomBytes(18).toString('base64url')
const apiKey = creds.SHOWCASE_CMS_API_KEY || randomUUID()
// The admin is the one row the seed keeps in step with the creds (password, API key).
const admin = { email, password, role: 'admin', enableAPIKey: true, apiKey }
const { docs: found } = await payload.find({ collection: 'users', where: { email: { equals: email } }, limit: 1, ...sys })
await (found[0]
  ? payload.update({ collection: 'users', id: found[0].id, data: admin as never, ...sys })
  : payload.create({ collection: 'users', data: admin as never, ...sys }))
if (!fromEnv) {
  mkdirSync(path.dirname(credsFile), { recursive: true })
  writeFileSync(
    credsFile,
    `# Showcase CMS (local). Written by apps/cms/scripts/seed.ts.\nSHOWCASE_CMS_ADMIN_EMAIL=${email}\nSHOWCASE_CMS_ADMIN_PASSWORD=${password}\nSHOWCASE_CMS_API_KEY=${apiKey}\n`,
    { mode: 0o600 },
  )
}

// --- domains ---------------------------------------------------------------------------
const domain = async (slug: string, name: string, kind: 'blog' | 'site' | 'store') =>
  (await ensure('domains', { slug: { equals: slug } }, { slug, name, kind, status: 'planned', languages: ['fr', 'en'], defaultLocale: 'fr' })).id

const store = await domain('store', 'OVRLD — commerce showcase', 'store')
const blog = await domain('blog-demo', 'Blog demo', 'blog')
await domain('renovation-demo', 'Linteau — rénovation', 'site')
await domain('plumbing-demo', 'Clapet — plomberie et chauffage', 'site')

// A FR doc and its EN twin, linked by translationOf.
async function pair(collection: CollectionSlug, domainId: number | string, fr: Record<string, unknown>, en: Record<string, unknown>) {
  const key = (locale: string, slug: unknown): Where => ({
    and: [{ domain: { equals: domainId } }, { locale: { equals: locale } }, { slug: { equals: slug } }],
  })
  const frDoc = await ensure(collection, key('fr', fr.slug), { ...fr, domain: domainId, locale: 'fr' })
  await ensure(collection, key('en', en.slug), { ...en, domain: domainId, locale: 'en', translationOf: frDoc.id })
}

// --- store: home + one doc --------------------------------------------------------------
await pair(
  'pages',
  store,
  {
    slug: 'home',
    title: 'Accueil',
    layout: [
      { blockType: 'hero', heading: 'Entraînez-vous partout.', subheading: 'Vêtements et équipement pour le gym maison.' },
      { blockType: 'richText', richText: rich('## Une page, un CMS\n\nCette page vient du **CMS de démonstration**. Le magasin, le blogue et les sites de démonstration le lisent tous.') },
      { blockType: 'productGrid', heading: 'Nouveautés', collectionHandle: 'new', limit: 8 },
    ],
  },
  {
    slug: 'home',
    title: 'Home',
    layout: [
      { blockType: 'hero', heading: 'Train anywhere.', subheading: 'Apparel and equipment for the home gym.' },
      { blockType: 'richText', richText: rich('## One page, one CMS\n\nThis page comes from the **showcase CMS**. The store, the blog and the demo sites all read it.') },
      { blockType: 'productGrid', heading: 'New arrivals', collectionHandle: 'new', limit: 8 },
    ],
  },
)
await pair(
  'docs',
  store,
  { slug: 'une-page-plusieurs-sites', title: 'Un CMS, plusieurs sites', category: 'Architecture', order: 1, body: '# Un CMS, plusieurs sites\n\nChaque document porte un champ `domain`. Le magasin, le blogue et les sites de démonstration lisent tous la même base.\n' },
  { slug: 'one-cms-many-sites', title: 'One CMS, many sites', category: 'Architecture', order: 1, body: '# One CMS, many sites\n\nEvery document carries a `domain` field. The store, the blog and the demo sites all read the same database.\n' },
)

// --- blog-demo: one article ------------------------------------------------------------
await pair(
  'articles',
  blog,
  {
    slug: 'un-seul-endroit-pour-vos-contenus',
    title: 'Un seul endroit pour tous vos contenus',
    excerpt: 'Votre site, votre boutique et votre blogue peuvent lire le même CMS.',
    category: 'Méthode',
    publishedAt: '2026-10-26T12:00:00.000Z',
    body: 'Vous modifiez une page une fois. Elle change partout où elle paraît.\n\n## Comment\n\nChaque page, article et document porte le nom du site qui l’affiche. Un seul CMS sert donc plusieurs sites.\n',
  },
  {
    slug: 'one-place-for-all-your-content',
    title: 'One place for all your content',
    excerpt: 'Your site, your store and your blog can read the same CMS.',
    category: 'Method',
    publishedAt: '2026-10-26T12:00:00.000Z',
    body: 'You edit a page once. It changes everywhere it appears.\n\n## How\n\nEvery page, article and doc carries the name of the site that shows it. One CMS serves many sites.\n',
  },
)

// --- one private draft: anonymous reads must never see it (smoke checks this) -----------
await ensure(
  'pages',
  { and: [{ domain: { equals: store } }, { locale: { equals: 'fr' } }, { slug: { equals: 'brouillon-prive' } }] },
  { domain: store, locale: 'fr', slug: 'brouillon-prive', title: 'Brouillon privé', layout: [{ blockType: 'banner', text: 'Jamais publié.' }] },
  true,
)

payload.logger.info(fromEnv ? 'Seeded. Admin and API key from the environment.' : `Seeded. Admin and API key in ${credsFile}`)
process.exit(0)
