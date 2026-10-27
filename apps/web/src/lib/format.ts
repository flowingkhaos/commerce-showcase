// Client-safe formatting helpers (no env, no gql): pages and islands share them.
import { formatMoney, type MoneyV2 } from '@shopify/hydrogen'

/** Shopify's Money, formatted for the locale. Tiles drop ".00" ($85); the bag keeps cents. */
export function price(money: MoneyV2, locale: string, short = false): string {
  const f = formatMoney(money, { locale })
  return short ? f.withoutTrailingZeros : f.toString()
}

type Priced = { priceRange: { minVariantPrice: MoneyV2; maxVariantPrice: MoneyV2 } }
/**
 * The lowest of Shopify's prices for a set of products, and whether to say "from".
 * Comparing amounts picks one of Shopify's numbers; nothing is computed.
 */
export function lowestPrice(products: Priced[]) {
  const mins = products.map((p) => p.priceRange.minVariantPrice)
  const lowest = mins.reduce((a, b) => (Number(b.amount) < Number(a.amount) ? b : a))
  const from =
    new Set(mins.map((m) => Number(m.amount))).size > 1 ||
    products.some((p) => Number(p.priceRange.minVariantPrice.amount) !== Number(p.priceRange.maxVariantPrice.amount))
  return { lowest, from }
}

/** The readout's unlit segments behind the number: every digit becomes an 8 (board detail). */
export const ghost = (text: string) => text.replace(/\d/g, '8')

const SHOPIFY_CDN_HOSTS = ['cdn.shopify.com', 'mock.shop']

/** Sizes a Shopify CDN image (hydrogen-image skill); any other host passes through unchanged. */
export function shopifyImageUrl(url: string, width: number): string {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return url
  }
  if (!SHOPIFY_CDN_HOSTS.some((h) => parsed.hostname === h || parsed.hostname.endsWith(`.${h}`))) return url
  parsed.searchParams.set('width', String(width))
  return parsed.toString()
}

export const srcSet = (url: string, width: number) =>
  `${shopifyImageUrl(url, width)} 1x, ${shopifyImageUrl(url, width * 2)} 2x`

/** Swatch colour per option value. Shopify's swatch field is empty in this store, so store code maps names. */
const SWATCH: Record<string, string> = {
  Black: 'var(--sw-black)', Noir: 'var(--sw-black)',
  'Heather Grey': 'var(--sw-heather)', 'Gris chiné': 'var(--sw-heather)',
  Slate: 'var(--sw-slate)', Ardoise: 'var(--sw-slate)',
  White: 'var(--sw-white)', Blanc: 'var(--sw-white)',
  Volt: 'var(--sw-volt)',
}
export const swatch = (value: string, shopifyColor?: string | null) => shopifyColor ?? SWATCH[value]
