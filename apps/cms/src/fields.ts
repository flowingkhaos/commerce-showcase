import type { Access, Block, CollectionSlug, Field, FieldAccess } from 'payload'

import { lexicalHTMLField } from '@payloadcms/richtext-lexical'

// Access: every collection declares every operation with one of these.
const role = (user: unknown) => (user as { role?: string } | null)?.role
export const isAdmin: Access = ({ req: { user } }) => role(user) === 'admin'
export const isAdminField: FieldAccess = ({ req: { user } }) => role(user) === 'admin'
export const anyone: Access = () => true
// Anonymous REST (the demo sites) sees published documents only; drafts stay in the admin.
export const publishedOrAdmin: Access = ({ req: { user } }) =>
  role(user) === 'admin' || { _status: { equals: 'published' } }

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

// The three fields every content doc carries, plus its slug.
// Unique on (domain, locale, slug); a French URL with no French doc is a 404, never English.
export const contentFields = (collection: CollectionSlug): Field[] => [
  {
    name: 'domain',
    type: 'relationship',
    relationTo: 'domains',
    required: true,
    index: true,
    admin: { position: 'sidebar' },
  },
  {
    name: 'locale',
    type: 'select',
    options: ['fr', 'en'],
    defaultValue: 'fr',
    required: true,
    admin: { position: 'sidebar' },
  },
  {
    name: 'slug',
    type: 'text',
    required: true,
    index: true,
    validate: (value: null | string | undefined) =>
      slugPattern.test(value ?? '') || 'Lowercase letters, digits and single dashes only.',
    admin: { position: 'sidebar' },
  },
  {
    name: 'translationOf',
    type: 'relationship',
    relationTo: collection,
    admin: { position: 'sidebar', description: 'The same document in the other language.' },
  },
]

export const contentIndexes = [{ fields: ['domain', 'locale', 'slug'], unique: true }]

export const meta: Field = {
  name: 'meta',
  type: 'group',
  label: 'SEO',
  fields: [
    { name: 'title', type: 'text' },
    { name: 'description', type: 'textarea' },
    { name: 'image', type: 'upload', relationTo: 'media' },
  ],
}

const links: Field = {
  name: 'links',
  type: 'array',
  maxRows: 2,
  fields: [
    { name: 'label', type: 'text', required: true },
    { name: 'url', type: 'text', required: true },
    { name: 'style', type: 'select', options: ['primary', 'secondary'], defaultValue: 'primary' },
  ],
}

// Rich text ships twice: Lexical JSON (`richText`) and server-made HTML (`html`), so a
// Fresh or Astro site can print HTML without its own Lexical renderer.
const richText = (required = false): Field[] => [
  { name: 'richText', type: 'richText', required },
  lexicalHTMLField({ htmlFieldName: 'html', lexicalFieldName: 'richText' }),
]

// Eight general-purpose page blocks, with no decoration knobs.
export const blocks: Block[] = [
  {
    slug: 'hero',
    fields: [
      { name: 'heading', type: 'text', required: true },
      { name: 'subheading', type: 'textarea' },
      { name: 'image', type: 'upload', relationTo: 'media' },
      links,
    ],
  },
  { slug: 'richText', fields: richText(true) },
  {
    slug: 'mediaText',
    fields: [
      { name: 'heading', type: 'text' },
      ...richText(),
      { name: 'image', type: 'upload', relationTo: 'media', required: true },
      { name: 'imagePosition', type: 'select', options: ['right', 'left'], defaultValue: 'right' },
    ],
  },
  {
    slug: 'featureList',
    fields: [
      { name: 'heading', type: 'text' },
      { name: 'intro', type: 'textarea' },
      {
        name: 'items',
        type: 'array',
        minRows: 1,
        fields: [
          { name: 'title', type: 'text', required: true },
          { name: 'text', type: 'textarea' },
        ],
      },
    ],
  },
  {
    slug: 'cta',
    fields: [
      { name: 'heading', type: 'text', required: true },
      { name: 'text', type: 'textarea' },
      links,
    ],
  },
  {
    slug: 'faq',
    fields: [
      { name: 'heading', type: 'text' },
      {
        name: 'items',
        type: 'array',
        minRows: 1,
        fields: [
          { name: 'question', type: 'text', required: true },
          { name: 'answer', type: 'textarea', required: true },
        ],
      },
    ],
  },
  {
    slug: 'banner',
    fields: [
      { name: 'style', type: 'select', options: ['info', 'success', 'warning'], defaultValue: 'info' },
      { name: 'text', type: 'text', required: true },
      { name: 'link', type: 'group', fields: [{ name: 'label', type: 'text' }, { name: 'url', type: 'text' }] },
    ],
  },
  {
    // Shopify owns the products; the block only names which collection to show.
    slug: 'productGrid',
    fields: [
      { name: 'heading', type: 'text' },
      { name: 'collectionHandle', type: 'text', required: true },
      { name: 'limit', type: 'number', defaultValue: 8, min: 1, max: 24 },
    ],
  },
]
