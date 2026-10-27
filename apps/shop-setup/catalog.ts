// The OVRLD catalogue: demo data for a Shopify development store (prices in CAD, test mode).
// Shopify owns everything here: titles, variants, prices, stock, photos, collections, specs.
// The product story, SEO and collection descriptions live in Payload, not here.
//
// Photos are Unsplash stock (free licence), picked so the data matches what each photo shows.
// Products without a matching photo have none: the storefront shows an honest empty frame.

export type Variant = { options: Record<string, string>; price: string; stock?: number }
export type Product = {
  handle: string
  title: { en: string; fr: string }
  description: { en: string; fr: string }
  type: string // a sub-collection rule matches on this
  tag: 'apparel' | 'equipment' // a top collection rule matches on this
  options: string[] // English option names, in order
  variants: Variant[]
  specs: Record<string, { en: string; fr: string }> // product metafields, namespace "specs"
  images?: { url: string; alt: string; forOption?: [string, string] }[]
  sku: string
}

const unsplash = (id: string) => `https://images.unsplash.com/${id}?fm=jpg&q=85&w=2000`
const sizes = (list: string[], price: string, extra: Record<string, string> = {}) =>
  list.map((s) => ({ options: { Size: s, ...extra }, price }))
const grid = (colours: string[], list: string[], price: string) =>
  colours.flatMap((c) => list.map((s) => ({ options: { Colour: c, Size: s }, price })))

const APPAREL = ['S', 'M', 'L', 'XL', 'XXL']
const STOCK = 20

export const products: Product[] = [
  {
    handle: 'heavyweight-hoodie',
    sku: 'HOOD',
    title: { en: 'Heavyweight Hoodie', fr: 'Kangourou épais' },
    description: {
      en: 'A heavyweight fleece hoodie with a lined hood and a kangaroo pocket.',
      fr: 'Un kangourou en molleton épais, capuchon doublé et poche kangourou.',
    },
    type: 'Tops',
    tag: 'apparel',
    options: ['Colour', 'Size'],
    // Two colours, because the photos show black and heather grey. XXL Heather Grey is sold
    // out on purpose: the cart and the product page show Shopify's real "unavailable" state.
    variants: grid(['Black', 'Heather Grey'], APPAREL, '85.00').map((v) =>
      v.options.Colour === 'Heather Grey' && v.options.Size === 'XXL' ? { ...v, stock: 0 } : v,
    ),
    specs: {
      summary: { en: 'S–XXL · Black, Heather Grey', fr: 'S–XXL · Noir, Gris chiné' },
      fabric: { en: 'Cotton-polyester fleece, brushed inside', fr: 'Molleton coton-polyester, gratté à l’intérieur' },
      weight: { en: '420 gsm', fr: '420 g/m²' },
      fit: { en: 'Relaxed, dropped shoulder', fr: 'Ample, épaule tombante' },
      details: { en: 'Kangaroo pocket, lined hood, ribbed cuffs and hem', fr: 'Poche kangourou, capuchon doublé, poignets et bas côtelés' },
      care: { en: 'Machine wash cold', fr: 'Lavage à la machine à l’eau froide' },
    },
    images: [
      { url: unsplash('photo-1581655353466-d5ad6765dd37'), alt: 'Black and heather grey hoodies, folded', forOption: ['Colour', 'Black'] },
      { url: unsplash('photo-1578470507807-3fc541d5f544'), alt: 'A woman in a heather grey hoodie holding her hood', forOption: ['Colour', 'Heather Grey'] },
    ],
  },
  {
    handle: 'training-sweatpants',
    sku: 'SWEAT',
    title: { en: 'Training Sweatpants', fr: 'Pantalon d’entraînement' },
    description: { en: 'Fleece training sweatpants with a drawstring waist.', fr: 'Pantalon d’entraînement en molleton, taille à cordon.' },
    type: 'Bottoms',
    tag: 'apparel',
    options: ['Colour', 'Size'],
    variants: grid(['Black', 'Slate'], APPAREL, '70.00'),
    specs: { summary: { en: 'S–XXL · Black, Slate', fr: 'S–XXL · Noir, Ardoise' } },
  },
  {
    handle: 'quick-dry-training-tee',
    sku: 'TEE',
    title: { en: 'Quick-Dry Training Tee', fr: 'T-shirt séchage rapide' },
    description: { en: 'A light training tee in a quick-dry knit.', fr: 'Un t-shirt d’entraînement léger en maille séchage rapide.' },
    type: 'Tops',
    tag: 'apparel',
    options: ['Colour', 'Size'],
    variants: grid(['Black', 'White', 'Volt'], ['XS', ...APPAREL], '38.00'),
    specs: { summary: { en: 'XS–XXL · Black, White, Volt', fr: 'XS–XXL · Noir, Blanc, Volt' } },
  },
  {
    handle: 'training-jacket',
    sku: 'JKT',
    title: { en: 'Training Jacket', fr: 'Veste d’entraînement' },
    description: { en: 'A full-zip training jacket in black.', fr: 'Une veste d’entraînement à glissière pleine longueur, noire.' },
    type: 'Outerwear',
    tag: 'apparel',
    options: ['Size'],
    variants: sizes(APPAREL, '120.00'),
    specs: { summary: { en: 'S–XXL · Black', fr: 'S–XXL · Noir' } },
  },
  {
    handle: 'training-shoes',
    sku: 'SHOE',
    title: { en: 'Training Shoes', fr: 'Chaussures d’entraînement' },
    description: { en: 'Flat, stable training shoes in black and white.', fr: 'Chaussures d’entraînement plates et stables, noir et blanc.' },
    type: 'Footwear',
    tag: 'apparel',
    options: ['Size'],
    variants: sizes(['6', '7', '8', '9', '10', '11', '12', '13'].map((s) => `US ${s}`), '140.00'),
    specs: { summary: { en: 'US 6–13 · Black/White', fr: 'US 6–13 · Noir/Blanc' } },
  },
  {
    handle: 'squat-rack',
    sku: 'RACK',
    title: { en: 'Squat Rack', fr: 'Support à squat' },
    description: {
      en: 'A power rack, 90 in tall. Shown with a barbell and plates, which are not included.',
      fr: 'Une cage de puissance de 90 po. Montrée avec une barre et des disques, non inclus.',
    },
    type: 'Racks & Benches',
    tag: 'equipment',
    options: ['Title'],
    variants: [{ options: { Title: 'Default Title' }, price: '890.00' }],
    specs: { summary: { en: 'Power rack, 90 in tall', fr: 'Cage de puissance, 90 po' } },
    images: [{ url: unsplash('photo-1784798228092-659924b1a15b'), alt: 'A power rack with a barbell and weight plates in an empty gym' }],
  },
  {
    handle: 'adjustable-bench',
    sku: 'BENCH',
    title: { en: 'Adjustable Bench', fr: 'Banc ajustable' },
    description: {
      en: 'A bench that adjusts from flat to 85°. Shown with a barbell, which is not included.',
      fr: 'Un banc réglable de la position plate à 85°. Montré avec une barre, non incluse.',
    },
    type: 'Racks & Benches',
    tag: 'equipment',
    options: ['Title'],
    variants: [{ options: { Title: 'Default Title' }, price: '320.00' }],
    specs: { summary: { en: 'Flat to 85°', fr: 'De plat à 85°' } },
    images: [{ url: unsplash('photo-1765728617086-5d16a7bac916'), alt: 'An adjustable weight bench and a barbell in a gym' }],
  },
  {
    handle: 'hex-dumbbells',
    sku: 'HEX',
    title: { en: 'Hex Dumbbells', fr: 'Haltères hexagonaux' },
    description: { en: 'Hex dumbbells, sold in pairs.', fr: 'Haltères hexagonaux, vendus par paires.' },
    type: 'Free Weights',
    tag: 'equipment',
    options: ['Weight'],
    variants: (
      [[5, '40'], [10, '50'], [15, '60'], [20, '70'], [25, '85'], [30, '95'], [35, '110'], [40, '125'], [45, '140'], [50, '155']] as const
    ).map(([lb, p]) => ({ options: { Weight: `${lb} lb pair` }, price: `${p}.00` })),
    specs: { summary: { en: 'Pairs, 5–50 lb', fr: 'Paires, 5 à 50 lb' } },
  },
  {
    handle: 'kettlebells',
    sku: 'KB',
    title: { en: 'Kettlebells', fr: 'Kettlebells' },
    description: { en: 'Black cast-iron kettlebells, 8 to 32 kg.', fr: 'Kettlebells en fonte noire, de 8 à 32 kg.' },
    type: 'Free Weights',
    tag: 'equipment',
    options: ['Weight'],
    // 15 kg is in the ladder because the photo shows a 15 kg kettlebell.
    variants: (
      [[8, '45'], [12, '55'], [15, '65'], [20, '85'], [24, '100'], [28, '115'], [32, '130']] as const
    ).map(([kg, p]) => ({ options: { Weight: `${kg} kg` }, price: `${p}.00` })),
    specs: { summary: { en: '8–32 kg', fr: '8 à 32 kg' } },
    images: [{ url: unsplash('photo-1725289572584-5afe9d45119f'), alt: 'A black 15 kg kettlebell on a grey background', forOption: ['Weight', '15 kg'] }],
  },
  {
    handle: 'suspension-trainer',
    sku: 'SUSP',
    title: { en: 'Suspension Trainer', fr: 'Sangles de suspension' },
    description: { en: 'Suspension straps with door and rack anchors.', fr: 'Sangles de suspension avec ancrages de porte et de cage.' },
    type: 'Conditioning',
    tag: 'equipment',
    options: ['Title'],
    variants: [{ options: { Title: 'Default Title' }, price: '95.00' }],
    specs: { summary: { en: 'Door and rack anchors', fr: 'Ancrages de porte et de cage' } },
  },
  {
    handle: 'rubber-floor-tiles',
    sku: 'TILE',
    title: { en: 'Rubber Floor Tiles', fr: 'Dalles de sol en caoutchouc' },
    description: { en: 'Rubber floor tiles, 2 × 2 ft and 3/4 in thick, sold each.', fr: 'Dalles de sol en caoutchouc de 2 × 2 pi et 3/4 po d’épaisseur, vendues à l’unité.' },
    type: 'Floor & Mobility',
    tag: 'equipment',
    options: ['Title'],
    variants: [{ options: { Title: 'Default Title' }, price: '18.00', stock: 200 }],
    specs: { summary: { en: '2 × 2 ft, 3/4 in, each', fr: '2 × 2 pi, 3/4 po, l’unité' } },
  },
  {
    handle: 'yoga-mat',
    sku: 'MAT',
    title: { en: 'Yoga Mat', fr: 'Tapis de yoga' },
    description: { en: 'A 6 mm yoga mat.', fr: 'Un tapis de yoga de 6 mm.' },
    type: 'Floor & Mobility',
    tag: 'equipment',
    options: ['Title'],
    variants: [{ options: { Title: 'Default Title' }, price: '60.00' }],
    specs: { summary: { en: '6 mm', fr: '6 mm' } },
  },
]

// Smart collections: the two top collections match the tag, the sub-collections the type.
// Shopify owns the titles and photos; the short descriptions are Payload's.
export const collections = [
  { handle: 'apparel', title: { en: 'Apparel', fr: 'Vêtements' }, rule: ['TAG', 'apparel'], image: unsplash('photo-1581655353466-d5ad6765dd37') },
  { handle: 'equipment', title: { en: 'Equipment', fr: 'Équipement' }, rule: ['TAG', 'equipment'], image: unsplash('photo-1627257058769-0a99529e4312') },
  { handle: 'tops', title: { en: 'Tops', fr: 'Hauts' }, rule: ['TYPE', 'Tops'] },
  { handle: 'bottoms', title: { en: 'Bottoms', fr: 'Bas' }, rule: ['TYPE', 'Bottoms'] },
  { handle: 'outerwear', title: { en: 'Outerwear', fr: 'Vestes' }, rule: ['TYPE', 'Outerwear'] },
  { handle: 'footwear', title: { en: 'Footwear', fr: 'Chaussures' }, rule: ['TYPE', 'Footwear'] },
  { handle: 'racks-benches', title: { en: 'Racks & Benches', fr: 'Cages et bancs' }, rule: ['TYPE', 'Racks & Benches'], image: unsplash('photo-1784798228092-659924b1a15b') },
  { handle: 'free-weights', title: { en: 'Free Weights', fr: 'Poids libres' }, rule: ['TYPE', 'Free Weights'], image: unsplash('photo-1725289572584-5afe9d45119f') },
  { handle: 'conditioning', title: { en: 'Conditioning', fr: 'Conditionnement' }, rule: ['TYPE', 'Conditioning'], image: unsplash('photo-1771270786606-f5a0e57db762') },
  { handle: 'floor-mobility', title: { en: 'Floor & Mobility', fr: 'Sol et mobilité' }, rule: ['TYPE', 'Floor & Mobility'] },
] as const

// French for option names and values (sizes and weights stay as they are).
export const fr: Record<string, string> = {
  Colour: 'Couleur', Size: 'Taille', Weight: 'Poids',
  Black: 'Noir', 'Heather Grey': 'Gris chiné', Slate: 'Ardoise', White: 'Blanc', Volt: 'Volt',
}

export { STOCK }
