import { createShopifyRouteTemplates, type I18nConfig } from '@shopify/hydrogen'
import type { Locale } from '../i18n'

// One country, two languages: the market lives in the path (/ English, /fr French).
export const marketFor = (locale: Locale): I18nConfig =>
  locale === 'fr'
    ? { country: 'CA', language: 'FR', pathPrefix: '/fr' }
    : { country: 'CA', language: 'EN', pathPrefix: '' }

export const localeOfPath = (pathname: string): Locale =>
  pathname === '/fr' || pathname.startsWith('/fr/') ? 'fr' : 'en'

// Shopify's standard paths (/products/:handle, /collections/:handle, /cart) are the app's paths,
// so the manifest is empty; Hydrogen still wants the one object passed everywhere (hydrogen-routing).
export const routeTemplates = createShopifyRouteTemplates({})
