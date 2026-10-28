// Write the store's own content into the showcase CMS over its REST API: the FR + EN home page
// (blocks), the menus and footer, and the photos those blocks use.
//   bun --env-file=<file with SHOWCASE_CMS_API_KEY> apps/web/content/seed-cms.ts [cms-url]
// Safe to re-run: documents are matched by (domain, locale, slug) and replaced in place.
// Headlines here were approved by the store's owner; change them in the CMS, not here.
const CMS = (process.argv[2] ?? 'https://showcase-cms-1065657380974.us-east5.run.app').replace(/\/$/, '')
const KEY = process.env.SHOWCASE_CMS_API_KEY
if (!KEY) throw new Error('Set SHOWCASE_CMS_API_KEY (the CMS admin API key).')
const auth = { Authorization: `users API-Key ${KEY}` }
const CMS_ADMIN = `${CMS}/admin/login`

async function api(path: string, init: RequestInit = {}) {
  const res = await fetch(`${CMS}/api/${path}`, { ...init, headers: { ...auth, ...(init.body instanceof FormData ? {} : { 'content-type': 'application/json' }), ...init.headers } })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path}: ${res.status} ${JSON.stringify(body).slice(0, 400)}`)
  return body as any
}

// Lexical JSON for plain paragraphs (the CMS makes the HTML from it).
const lexical = (...paragraphs: string[]) => ({
  root: {
    type: 'root', format: '', indent: 0, version: 1, direction: 'ltr',
    children: paragraphs.map((text) => ({
      type: 'paragraph', format: '', indent: 0, version: 1, direction: 'ltr', textFormat: 0, textStyle: '',
      children: [{ type: 'text', text, format: 0, style: '', mode: 'normal', detail: 0, version: 1 }],
    })),
  },
})

// Unsplash stock (free licence). Fetched once and uploaded; reused on re-runs by its alt text.
const photos = {
  rack: { id: 'photo-1784798228092-659924b1a15b', alt: 'A power rack with a barbell and weight plates in an empty gym', credit: 'Mirko Meister, Unsplash' },
  homeGym: { id: 'photo-1786204413545-cc7f6d87a112', alt: 'A home gym with a wooden bench and large windows', credit: 'Aalo Lens, Unsplash' },
  hood: { id: 'photo-1578470507807-3fc541d5f544', alt: 'A woman in a heather grey hoodie holding her hood at night', credit: 'Kartabya Aryal, Unsplash' },
  gearWall: { id: 'photo-1771270786606-f5a0e57db762', alt: 'Training gear hung on a wooden wall', credit: 'Caroline Badran, Unsplash' },
}

async function media(p: { id: string; alt: string; credit: string }) {
  const found = await api(`media?where[alt][equals]=${encodeURIComponent(p.alt)}&limit=1&depth=0`)
  if (found.docs[0]) return found.docs[0].id as number
  const img = await fetch(`https://images.unsplash.com/${p.id}?fm=jpg&q=85&w=2000`)
  if (!img.ok) throw new Error(`photo ${p.id}: ${img.status}`)
  const form = new FormData()
  form.append('file', new Blob([await img.arrayBuffer()], { type: 'image/jpeg' }), `${p.id}.jpg`)
  form.append('_payload', JSON.stringify({ alt: p.alt, credit: p.credit }))
  return (await api('media', { method: 'POST', body: form })).doc.id as number
}

const domain = (await api('domains?where[slug][equals]=store&limit=1&depth=0')).docs[0]?.id
if (!domain) throw new Error('No "store" domain in the CMS.')

// Create or replace one content doc; returns its id.
async function upsert(collection: string, locale: 'en' | 'fr', slug: string, data: Record<string, unknown>) {
  const q = `where[domain][equals]=${domain}&where[locale][equals]=${locale}&where[slug][equals]=${slug}&limit=1&depth=0&draft=true`
  const existing = (await api(`${collection}?${q}`)).docs[0]
  const doc = { ...data, domain, locale, slug, _status: 'published' }
  const res = existing
    ? await api(`${collection}/${existing.id}`, { method: 'PATCH', body: JSON.stringify(doc) })
    : await api(collection, { method: 'POST', body: JSON.stringify(doc) })
  return (res.doc ?? res).id as number
}

const rack = await media(photos.rack)
const homeGym = await media(photos.homeGym)
const hood = await media(photos.hood)
const gearWall = await media(photos.gearWall)

const home = (l: 'en' | 'fr') => {
  const en = l === 'en'
  const p = en ? '' : '/fr'
  return {
    title: en ? 'Home' : 'Accueil',
    meta: {
      title: en ? 'OVRLD: training apparel and home-gym equipment' : 'OVRLD : vêtements d’entraînement et équipement de gym maison',
      description: en
        ? 'A showcase store on Astro, Payload 4 and Shopify. Open the CMS to see how it is built.'
        : 'Une boutique vitrine sur Astro, Payload 4 et Shopify. Ouvrez le CMS pour voir comment elle est faite.',
    },
    layout: [
      {
        blockType: 'hero',
        heading: en ? 'One more rep.' : 'Une rep de plus.',
        subheading: en
          ? 'Training apparel and home-gym equipment, from a 6 mm yoga mat to a 90 in squat rack.'
          : 'Vêtements d’entraînement et équipement de gym maison, du tapis de yoga de 6 mm à la cage à squat de 90 po.',
        image: rack,
        links: [
          { label: en ? 'Open the CMS' : 'Ouvrir le CMS', url: CMS_ADMIN, style: 'primary' },
          { label: en ? 'Shop equipment' : 'Voir l’équipement', url: `${p}/collections/equipment`, style: 'secondary' },
        ],
      },
      { blockType: 'productGrid', collectionHandle: 'featured', limit: 2 },
      {
        blockType: 'collectionList',
        heading: en ? 'Collections' : 'Collections',
        items: [
          ['tops', 'Quick-dry tees and the heavyweight hoodie.', 'T-shirts séchage rapide et le kangourou épais.'],
          ['bottoms', 'Fleece training sweatpants.', 'Pantalons d’entraînement en molleton.'],
          ['outerwear', 'A full-zip training jacket.', 'Une veste d’entraînement à glissière.'],
          ['footwear', 'Flat, stable training shoes.', 'Des chaussures d’entraînement plates et stables.'],
          ['racks-benches', 'A power rack and an adjustable bench.', 'Une cage de puissance et un banc ajustable.'],
          ['free-weights', 'Hex dumbbells and kettlebells.', 'Haltères hexagonaux et kettlebells.'],
          ['conditioning', 'A suspension trainer with door and rack anchors.', 'Des sangles de suspension avec ancrages.'],
          ['floor-mobility', 'Rubber floor tiles and a yoga mat.', 'Dalles de caoutchouc et tapis de yoga.'],
        ].map(([handle, d, f]) => ({ handle, description: en ? d : f })),
      },
      {
        blockType: 'cta',
        heading: en ? 'Payload writes it. Shopify prices it.' : 'Payload l’écrit. Shopify fixe le prix.',
        text: en
          ? 'One Payload CMS serves four sites: this store, a blog demo and two website demos. Shopify owns price, stock and checkout; Payload owns the words and pictures. Turn on X-ray to see who owns each field.'
          : 'Un seul CMS Payload sert quatre sites : cette boutique, une démo de blogue et deux démos de site web. Shopify gère les prix, les stocks et le paiement; Payload gère les mots et les images. Activez la radiographie pour voir qui possède chaque champ.',
        links: [
          { label: en ? 'Open the CMS' : 'Ouvrir le CMS', url: CMS_ADMIN, style: 'primary' },
          { label: en ? 'How it works' : 'Comment ça marche', url: `${p}/how-it-works`, style: 'secondary' },
        ],
      },
      {
        blockType: 'mediaText',
        heading: en ? 'Build the gym the way you like to train.' : 'Aménagez votre gym comme vous aimez vous entraîner.',
        richText: lexical(
          en
            ? 'OVRLD is named for progressive overload: add a little at a time, a plate, a rep, a set. A home gym can grow the same way: the floor first, then a rack, then a bench.'
            : 'OVRLD vient de la surcharge progressive : on ajoute un peu à la fois, un disque, une rep, une série. Un gym maison peut grandir de la même façon : le sol d’abord, puis une cage, puis un banc.',
        ),
        image: homeGym,
        imagePosition: 'left',
      },
    ],
  }
}

const site = (l: 'en' | 'fr') => {
  const en = l === 'en'
  const p = en ? '' : '/fr'
  const link = (label: string, url: string) => ({ label, url })
  return {
    nav: [
      link(en ? 'Apparel' : 'Vêtements', `${p}/collections/apparel`),
      link(en ? 'Equipment' : 'Équipement', `${p}/collections/equipment`),
      link(en ? 'Docs' : 'Documentation', `${p}/docs`),
      link(en ? 'How it works' : 'Comment ça marche', `${p}/how-it-works`),
    ],
    footer: [
      { heading: en ? 'Shop' : 'Boutique', links: [link(en ? 'Apparel' : 'Vêtements', `${p}/collections/apparel`), link(en ? 'Equipment' : 'Équipement', `${p}/collections/equipment`)] },
      { heading: en ? 'Showcase' : 'Vitrine', links: [link(en ? 'Open the CMS' : 'Ouvrir le CMS', CMS_ADMIN), link(en ? 'How it works' : 'Comment ça marche', `${p}/how-it-works`), link(en ? 'Docs' : 'Documentation', `${p}/docs`)] },
      { heading: en ? 'Runs on' : 'Fonctionne avec', links: [link('Astro', 'https://astro.build'), link('Payload', 'https://payloadcms.com'), link('Shopify', 'https://shopify.dev')] },
    ],
    footerNote: en
      ? 'Demo data from a Shopify development store in test mode. Prices in CAD.'
      : 'Données de démonstration d’une boutique de développement Shopify en mode test. Prix en CAD.',
  }
}

// Pages: both languages, then point each at the other.
const enHome = await upsert('pages', 'en', 'home', home('en'))
const frHome = await upsert('pages', 'fr', 'home', home('fr'))
await api(`pages/${enHome}`, { method: 'PATCH', body: JSON.stringify({ translationOf: frHome }) })
await api(`pages/${frHome}`, { method: 'PATCH', body: JSON.stringify({ translationOf: enHome }) })
console.log(`home pages: en ${enHome}, fr ${frHome}`)

// Menus and footer: one site doc per language (no slug, no drafts).
for (const l of ['en', 'fr'] as const) {
  const existing = (await api(`site?where[domain][equals]=${domain}&where[locale][equals]=${l}&limit=1&depth=0`)).docs[0]
  const doc = { ...site(l), domain, locale: l }
  existing
    ? await api(`site/${existing.id}`, { method: 'PATCH', body: JSON.stringify(doc) })
    : await api('site', { method: 'POST', body: JSON.stringify(doc) })
  console.log(`site ${l}`)
}

// Product stories: the words around a Shopify product (the slug is the Shopify handle).
const hoodie = (l: 'en' | 'fr') => {
  const en = l === 'en'
  return {
    badges: [],
    story: [
      {
        blockType: 'mediaText',
        heading: en ? 'For the cold start.' : 'Pour le démarrage à froid.',
        richText: lexical(
          en
            ? 'The rack is cold first thing in the morning. Pull the hoodie on for the warm-up sets, take it off once you are moving, and put it back on for the walk inside.'
            : 'La cage est froide au petit matin. Enfilez le kangourou pour les séries d’échauffement, retirez-le une fois lancé, et remettez-le pour rentrer.',
        ),
        image: hood,
        imagePosition: 'right',
      },
      {
        blockType: 'featureList',
        heading: en ? 'One hoodie, three moments.' : 'Un kangourou, trois moments.',
        intro: en ? 'Where it goes between the first set and the last.' : 'Où il va entre la première série et la dernière.',
        items: en
          ? [
              { title: 'Before the first set', text: 'Hood up, hands in the kangaroo pocket, while the garage warms up.' },
              { title: 'Between sets', text: 'Off and over the bench, back on when you rest.' },
              { title: 'After the last set', text: 'Back on for the cool-down and the walk out of the garage.' },
            ]
          : [
              { title: 'Avant la première série', text: 'Capuchon sur la tête, mains dans la poche kangourou, pendant que le garage se réchauffe.' },
              { title: 'Entre les séries', text: 'Retiré et posé sur le banc, remis pendant le repos.' },
              { title: 'Après la dernière série', text: 'Remis pour le retour au calme et la sortie du garage.' },
            ],
      },
      {
        blockType: 'mediaText',
        heading: en ? 'It hangs with the gear.' : 'Rangé avec l’équipement.',
        richText: lexical(
          en
            ? 'Keep it on the hook by the bands and the rings, next to the rack. Two colours, five sizes, one price.'
            : 'Gardez-le au crochet près des élastiques et des anneaux, à côté de la cage. Deux couleurs, cinq tailles, un prix.',
        ),
        image: gearWall,
        imagePosition: 'left',
      },
    ],
    meta: {
      title: en ? 'Heavyweight Hoodie · OVRLD' : 'Kangourou épais · OVRLD',
      description: en
        ? 'A heavyweight fleece hoodie for the cold start: on for the warm-up, off once you are moving.'
        : 'Un kangourou en molleton épais pour le démarrage à froid : mis pour l’échauffement, retiré une fois lancé.',
    },
  }
}
const enHoodie = await upsert('products', 'en', 'heavyweight-hoodie', hoodie('en'))
const frHoodie = await upsert('products', 'fr', 'heavyweight-hoodie', hoodie('fr'))
await api(`products/${enHoodie}`, { method: 'PATCH', body: JSON.stringify({ translationOf: frHoodie }) })
await api(`products/${frHoodie}`, { method: 'PATCH', body: JSON.stringify({ translationOf: enHoodie }) })
console.log(`hoodie story: en ${enHoodie}, fr ${frHoodie}`)

