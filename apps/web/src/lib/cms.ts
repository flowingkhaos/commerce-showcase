// Build-time reads from the showcase CMS (Payload 4 REST, anonymous: published docs only).
import { CMS_URL } from 'astro:env/server'
import type { Locale } from '../i18n'

const DOMAIN = 'store'
// The CMS scales to zero on Cloud Run; a cold start takes about 6 s.
const TIMEOUT_MS = 30_000

export type Link = { label: string; url: string; style: 'primary' | 'secondary' }
export type Media = { url: string; alt: string; credit?: string | null; width?: number | null; height?: number | null }
export type Block =
  | { blockType: 'hero'; id: string; heading: string; subheading?: string | null; image?: Media | null; links?: Link[] }
  | { blockType: 'richText'; id: string; html?: string | null }
  | { blockType: 'mediaText'; id: string; heading?: string | null; html?: string | null; image?: Media | null; imagePosition?: 'left' | 'right' }
  | { blockType: 'featureList'; id: string; heading?: string | null; intro?: string | null; items?: { title: string; text?: string | null }[] }
  | { blockType: 'cta'; id: string; heading: string; text?: string | null; links?: Link[] }
  | { blockType: 'faq'; id: string; heading?: string | null; items?: { question: string; answer: string }[] }
  | { blockType: 'banner'; id: string; style: 'info' | 'success' | 'warning'; text: string; link?: { label?: string | null; url?: string | null } | null }
  | { blockType: 'productGrid'; id: string; heading?: string | null; collectionHandle: string; limit: number }
  | { blockType: 'collectionList'; id: string; heading?: string | null; items?: { handle: string; description?: string | null }[] }

export type Page = {
  title: string
  layout: Block[]
  meta?: { title?: string | null; description?: string | null } | null
}

export type Doc = {
  id: number
  title: string
  slug: string
  locale: Locale
  category?: string | null
  order?: number | null
  body?: string | null
  meta?: { title?: string | null; description?: string | null; image?: Media | null } | null
  translationOf?: { id: number; slug: string; locale: Locale } | null
  updatedAt: string
}
export type SiteLink = { label: string; url: string }
/** One per (domain, locale): the nav, the footer columns and the note under them. */
export type Site = { nav?: SiteLink[] | null; footer?: { heading: string; links?: SiteLink[] | null }[] | null; footerNote?: string | null }
/** A product's words; Shopify owns everything else. `slug` is the Shopify handle. */
export type ProductStory = {
  id: number
  slug: string
  locale: Locale
  story?: Block[] | null
  badges?: { label: string }[] | null
  meta?: { title?: string | null; description?: string | null } | null
}
export type Domain = { slug: string; name: string; url?: string | null; kind: string; status: 'live' | 'planned' }

// One read per document per build, however many pages ask for it. A failed read is not kept.
const memo = new Map<string, Promise<unknown>>()
async function get<T>(path: string, params: Record<string, string>, timeoutMs = TIMEOUT_MS): Promise<T> {
  const key = `${path}?${new URLSearchParams(params)}`
  if (!memo.has(key)) {
    const load = (async () => {
      const res = await fetch(`${CMS_URL}${key}`, { signal: AbortSignal.timeout(timeoutMs) })
      // A failed read fails the build: an outage never ships as an empty page.
      if (!res.ok) throw new Error(`CMS: GET ${path} → ${res.status}`)
      return res.json()
    })()
    memo.set(key, load.catch((e) => (memo.delete(key), Promise.reject(e))))
  }
  return memo.get(key) as Promise<T>
}
const inStore = (locale: Locale) => ({ 'where[domain.slug][equals]': DOMAIN, 'where[locale][equals]': locale, depth: '1' })

/** The page doc for one locale, or null. A French URL with no French doc is a 404, never English. */
export const getPage = async (locale: Locale, slug: string) =>
  (await get<{ docs: Page[] }>('/api/pages', { ...inStore(locale), 'where[slug][equals]': slug, limit: '1' })).docs[0] ?? null

/** The store's docs in one language, in the manual's order. */
export const getDocs = async (locale: Locale) =>
  (await get<{ docs: Doc[] }>('/api/docs', { ...inStore(locale), sort: 'order', limit: '100' })).docs

/**
 * The same doc in the other language, or null. Payload links one side (`translationOf`), so
 * look both ways.
 */
export function counterpart(doc: Pick<Doc, 'id' | 'translationOf'>, others: Doc[]) {
  return others.find((d) => d.id === doc.translationOf?.id || d.translationOf?.id === doc.id) ?? null
}

/** The site doc for one language, or null. */
export const getSite = async (locale: Locale, timeoutMs?: number) =>
  (await get<{ docs: Site[] }>('/api/site', { 'where[domain.slug][equals]': DOMAIN, 'where[locale][equals]': locale, depth: '0' }, timeoutMs))
    .docs[0] ?? null

/** Every product story in one language (one read per build, then found by handle). */
export const getProductStories = async (locale: Locale) =>
  (await get<{ docs: ProductStory[] }>('/api/products', { ...inStore(locale), limit: '100' })).docs

export const getDomains = async () => (await get<{ docs: Domain[] }>('/api/domains', { depth: '0', limit: '50' })).docs

// Every "Open the CMS" link lands on the sign-in view, which has « Enter as visitor ».
export const CMS_ADMIN = `${CMS_URL}/admin/login`
export const CMS_ORIGIN = new URL(CMS_URL).origin
export { CMS_URL }
