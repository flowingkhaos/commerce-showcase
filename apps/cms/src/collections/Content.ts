import type { CollectionConfig } from 'payload'

import {
  adminOrOwnDraft,
  adminOrVisitor,
  blocks,
  contentFields,
  contentIndexes,
  meta,
  publishedOrAdmin,
  visitorSandbox,
} from '../fields'

const access = { read: publishedOrAdmin, create: adminOrVisitor, update: adminOrOwnDraft, delete: adminOrOwnDraft }
const hooks = { beforeChange: [visitorSandbox] }
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
