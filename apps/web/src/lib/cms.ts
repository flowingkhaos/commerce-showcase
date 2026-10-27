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

export type Page = {
  title: string
  layout: Block[]
  meta?: { title?: string | null; description?: string | null } | null
}

const pages = new Map<string, Promise<Page | null>>()

async function fetchPage(locale: Locale, slug: string): Promise<Page | null> {
  const q = new URLSearchParams({
    'where[domain.slug][equals]': DOMAIN,
    'where[locale][equals]': locale,
    'where[slug][equals]': slug,
    depth: '1',
    limit: '1',
  })
  const res = await fetch(`${CMS_URL}/api/pages?${q}`, { signal: AbortSignal.timeout(TIMEOUT_MS) })
  // A failed read fails the build: an outage never ships as an empty page.
  if (!res.ok) throw new Error(`CMS: GET /api/pages → ${res.status}`)
  const body = (await res.json()) as { docs: Page[] }
  return body.docs[0] ?? null
}

/** The page doc for one locale, or null. A French URL with no French doc is a 404, never English. */
export function getPage(locale: Locale, slug: string) {
  const key = `${locale}:${slug}`
  if (!pages.has(key)) pages.set(key, fetchPage(locale, slug))
  return pages.get(key)!
}

export const CMS_ADMIN = `${CMS_URL}/admin`
