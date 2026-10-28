import type { CollectionConfig, Field } from 'payload'

import {
  adminOrOwnDraft,
  adminOrVisitor,
  anyone,
  blocks,
  contentFields,
  contentIndexes,
  isAdmin,
  meta,
  publishedOrAdmin,
  visitorSandbox,
} from '../fields'
import { rebuildOnChange, rebuildOnDelete } from '../rebuild'

const access = { read: publishedOrAdmin, create: adminOrVisitor, update: adminOrOwnDraft, delete: adminOrOwnDraft }
const hooks = { beforeChange: [visitorSandbox], afterChange: [rebuildOnChange], afterDelete: [rebuildOnDelete] }
const columns = ['title', 'domain', 'locale', 'slug', '_status', 'updatedAt']
// Autosave every 3 s (architecture § Backend shape): each save reloads the live preview.
const versions = { drafts: { autosave: { interval: 3000 } } }

// Builder pages: blocks.
export const Pages: CollectionConfig = {
  slug: 'pages',
  admin: { useAsTitle: 'title', group: 'Content', defaultColumns: columns },
  access,
  hooks,
  versions,
  indexes: contentIndexes,
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'layout', type: 'blocks', blocks, maxRows: 20 },
    meta,
    ...contentFields('pages'),
  ],
}

// Blog posts: markdown bodies, rendered by each site.
export const Articles: CollectionConfig = {
  slug: 'articles',
  admin: { useAsTitle: 'title', group: 'Content', defaultColumns: columns },
  access,
  hooks,
  versions,
  indexes: contentIndexes,
  defaultSort: '-publishedAt',
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'excerpt', type: 'textarea' },
    { name: 'hero', type: 'upload', relationTo: 'media' },
    { name: 'category', type: 'text' },
    { name: 'publishedAt', type: 'date', admin: { position: 'sidebar' } },
    { name: 'body', type: 'code', admin: { language: 'markdown' }, required: true },
    meta,
    ...contentFields('articles'),
  ],
}

// Documentation: markdown, ordered within a category.
export const Docs: CollectionConfig = {
  slug: 'docs',
  admin: { useAsTitle: 'title', group: 'Content', defaultColumns: columns },
  access,
  hooks,
  versions,
  indexes: contentIndexes,
  defaultSort: 'order',
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'category', type: 'text' },
    { name: 'order', type: 'number', defaultValue: 0 },
    { name: 'keyword', type: 'text', admin: { description: 'The search term this page should rank for.' } },
    { name: 'body', type: 'code', admin: { language: 'markdown' }, required: true },
    meta,
    ...contentFields('docs'),
  ],
}

// A product's words. Shopify owns its title, price, stock and images; the slug joins the two.
const storyBlocks = blocks.filter((b) => ['mediaText', 'featureList', 'richText'].includes(b.slug))
export const Products: CollectionConfig = {
  slug: 'products',
  admin: { useAsTitle: 'slug', group: 'Content', defaultColumns: ['slug', 'domain', 'locale', '_status', 'updatedAt'] },
  access,
  hooks,
  versions,
  indexes: contentIndexes,
  fields: [
    { name: 'story', type: 'blocks', blocks: storyBlocks, maxRows: 8 },
    { name: 'badges', type: 'array', maxRows: 3, fields: [{ name: 'label', type: 'text', required: true }] },
    meta,
    ...contentFields('products', 'The Shopify product handle, exactly as in Shopify.'),
  ],
}

const linkList = (name: string): Field => ({
  name,
  type: 'array',
  maxRows: 8,
  fields: [
    { name: 'label', type: 'text', required: true },
    { name: 'url', type: 'text', required: true },
  ],
})

// One doc per domain and locale: the menu and footer that site renders. Operator-only.
export const Site: CollectionConfig = {
  slug: 'site',
  versions: false,
  hooks: { afterChange: [rebuildOnChange], afterDelete: [rebuildOnDelete] },
  admin: { group: 'Content', defaultColumns: ['domain', 'locale', 'updatedAt'] },
  access: { read: anyone, create: isAdmin, update: isAdmin, delete: isAdmin },
  indexes: [{ fields: ['domain', 'locale'], unique: true }],
  fields: [
    { name: 'domain', type: 'relationship', relationTo: 'domains', required: true, admin: { position: 'sidebar' } },
    { name: 'locale', type: 'select', options: ['fr', 'en'], defaultValue: 'fr', required: true, admin: { position: 'sidebar' } },
    linkList('nav'),
    {
      name: 'footer',
      type: 'array',
      maxRows: 6,
      fields: [{ name: 'heading', type: 'text', required: true }, linkList('links')],
    },
    { name: 'footerNote', type: 'text' },
  ],
}
