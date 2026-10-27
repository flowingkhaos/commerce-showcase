// Seed the showcase CMS: four sites, a FR + EN document on each, one private draft.
// Idempotent: rows are matched by their natural key and updated in place, so re-running
// restores the seed after visitors or tests change it. Run: bun run seed
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

async function upsert(collection: CollectionSlug, where: Where, data: Record<string, unknown>, draft = false) {
  const { docs } = await payload.find({ collection, where, limit: 1, draft: true, ...sys })
  const status = { _status: draft ? 'draft' : 'published' }
  const body = collection === 'domains' || collection === 'users' ? data : { ...data, ...status }
  return docs[0]
    ? payload.update({ collection, id: docs[0].id, data: body, draft, ...sys })
    : payload.create({ collection, data: body as never, draft, ...sys })
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
await upsert('users', { email: { equals: email } }, { email, password, role: 'admin', enableAPIKey: true, apiKey })
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
  (await upsert('domains', { slug: { equals: slug } }, { slug, name, kind, status: 'planned', languages: ['fr', 'en'], defaultLocale: 'fr' })).id

const store = await domain('store', 'OVRLD — commerce showcase', 'store')
const blog = await domain('blog-demo', 'Blog demo', 'blog')
const renovation = await domain('renovation-demo', 'Linteau — rénovation', 'site')
const plumbing = await domain('plumbing-demo', 'Clapet — plomberie et chauffage', 'site')

// A FR doc and its EN twin, linked by translationOf.
async function pair(collection: CollectionSlug, domainId: number | string, fr: Record<string, unknown>, en: Record<string, unknown>) {
  const key = (locale: string, slug: unknown): Where => ({
    and: [{ domain: { equals: domainId } }, { locale: { equals: locale } }, { slug: { equals: slug } }],
  })
  const frDoc = await upsert(collection, key('fr', fr.slug), { ...fr, domain: domainId, locale: 'fr' })
  await upsert(collection, key('en', en.slug), { ...en, domain: domainId, locale: 'en', translationOf: frDoc.id })
}

// --- renovation-demo: /garanties, /en/warranties ---------------------------------------
await pair(
  'pages',
  renovation,
  {
    slug: 'garanties',
    title: 'Nos garanties',
    meta: { description: 'Ce que Linteau garantit sur chaque chantier, et pour combien de temps.' },
    layout: [
      { blockType: 'hero', heading: 'Nos garanties', subheading: 'Ce que nous promettons sur chaque chantier, par écrit, avant de commencer.' },
      {
        blockType: 'richText',
        richText: rich(
          '## Main-d’œuvre : 5 ans\n\nSi un travail que nous avons fait se défait, nous revenons le refaire. **Sans frais**, pendant cinq ans après la fin du chantier.\n\n## Matériaux\n\nLes matériaux suivent la garantie de leur fabricant. Nous gardons les factures et nous faisons la réclamation pour vous.\n\n- Armoires et comptoirs : selon le fabricant\n- Céramique et pose : couvertes par notre main-d’œuvre\n- Plomberie et électricité : faites par nos sous-traitants licenciés',
        ),
      },
      {
        blockType: 'faq',
        heading: 'Questions fréquentes',
        items: [
          { question: 'Comment faire une demande de garantie ?', answer: 'Écrivez-nous avec une photo et l’adresse du chantier. Nous passons voir dans la semaine.' },
          { question: 'La garantie suit-elle la maison si je vends ?', answer: 'Oui. Elle est liée à l’adresse, pas au propriétaire.' },
        ],
      },
      { blockType: 'cta', heading: 'Un projet en tête ?', text: 'Décrivez-le en deux minutes. Nous vous rappelons.', links: [{ label: 'Demander une soumission', url: '/soumission', style: 'primary' }] },
    ],
  },
  {
    slug: 'warranties',
    title: 'Our warranties',
    meta: { description: 'What Linteau guarantees on every job, and for how long.' },
    layout: [
      { blockType: 'hero', heading: 'Our warranties', subheading: 'What we promise on every job, in writing, before we start.' },
      {
        blockType: 'richText',
        richText: rich(
          '## Workmanship: 5 years\n\nIf work we did comes apart, we come back and redo it. **At no cost**, for five years after the job ends.\n\n## Materials\n\nMaterials carry their maker’s warranty. We keep the invoices and file the claim for you.\n\n- Cabinets and counters: per the maker\n- Tile and setting: covered by our workmanship\n- Plumbing and electrical: done by our licensed subcontractors',
        ),
      },
      {
        blockType: 'faq',
        heading: 'Common questions',
        items: [
          { question: 'How do I make a warranty claim?', answer: 'Write to us with a photo and the job address. We come by within the week.' },
          { question: 'Does the warranty follow the house if I sell?', answer: 'Yes. It is tied to the address, not the owner.' },
        ],
      },
      { blockType: 'cta', heading: 'Have a project in mind?', text: 'Describe it in two minutes. We call you back.', links: [{ label: 'Request a quote', url: '/en/quote', style: 'primary' }] },
    ],
  },
)

// --- plumbing-demo: /entretien-annuel, /en/annual-service ------------------------------
await pair(
  'pages',
  plumbing,
  {
    slug: 'entretien-annuel',
    title: 'Entretien annuel',
    meta: { description: 'Une visite par an pour votre chauffe-eau, vos valves et votre chauffage.' },
    layout: [
      { blockType: 'hero', heading: 'Entretien annuel', subheading: 'Une visite par année. Moins de surprises en plein hiver.' },
      {
        blockType: 'featureList',
        heading: 'Ce que la visite comprend',
        items: [
          { title: 'Chauffe-eau', text: 'Vidange partielle, anode et soupape de sûreté vérifiées.' },
          { title: 'Valves et entrée d’eau', text: 'Chaque valve fermée puis rouverte, pour qu’elle marche le jour où vous en avez besoin.' },
          { title: 'Chauffage', text: 'Pression, purge des radiateurs et inspection des raccords.' },
        ],
      },
      { blockType: 'banner', style: 'info', text: 'Les visites d’automne se réservent dès septembre.' },
      { blockType: 'cta', heading: 'Réserver une visite', links: [{ label: 'Choisir une date', url: '/rendez-vous', style: 'primary' }] },
    ],
  },
  {
    slug: 'annual-service',
    title: 'Annual service',
    meta: { description: 'One visit a year for your water heater, valves and heating.' },
    layout: [
      { blockType: 'hero', heading: 'Annual service', subheading: 'One visit a year. Fewer surprises in the middle of winter.' },
      {
        blockType: 'featureList',
        heading: 'What the visit covers',
        items: [
          { title: 'Water heater', text: 'Partial flush, anode and relief valve checked.' },
          { title: 'Valves and water inlet', text: 'Every valve closed and reopened, so it works the day you need it.' },
          { title: 'Heating', text: 'Pressure, radiator bleeding and fittings inspected.' },
        ],
      },
      { blockType: 'banner', style: 'info', text: 'Fall visits open for booking in September.' },
      { blockType: 'cta', heading: 'Book a visit', links: [{ label: 'Pick a date', url: '/en/book', style: 'primary' }] },
    ],
  },
)

// --- store: home + one doc --------------------------------------------------------------
await pair(
  'pages',
  store,
  {
    slug: 'home',
    title: 'Accueil',
    layout: [
      { blockType: 'hero', heading: 'Entraînez-vous partout.', subheading: 'Vêtements et équipement pour le gym maison.' },
      { blockType: 'productGrid', heading: 'Nouveautés', collectionHandle: 'new', limit: 8 },
    ],
  },
  {
    slug: 'home',
    title: 'Home',
    layout: [
      { blockType: 'hero', heading: 'Train anywhere.', subheading: 'Apparel and equipment for the home gym.' },
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
await upsert(
  'pages',
  { and: [{ domain: { equals: renovation } }, { locale: { equals: 'fr' } }, { slug: { equals: 'brouillon-prive' } }] },
  { domain: renovation, locale: 'fr', slug: 'brouillon-prive', title: 'Brouillon privé', layout: [{ blockType: 'banner', text: 'Jamais publié.' }] },
  true,
)

payload.logger.info(fromEnv ? 'Seeded. Admin and API key from the environment.' : `Seeded. Admin and API key in ${credsFile}`)
process.exit(0)
