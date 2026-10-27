import type { CollectionConfig } from 'payload'

import { APIError } from 'payload'

import { anyone, isAdmin } from '../fields'

const contentCollections = ['pages', 'articles', 'docs', 'products', 'site'] as const

// The root of all content: one row per website this CMS serves.
export const Domains: CollectionConfig = {
  slug: 'domains',
  versions: false,
  admin: { useAsTitle: 'name', group: 'Sites', defaultColumns: ['name', 'slug', 'kind', 'status', 'url'] },
  access: { read: anyone, create: isAdmin, update: isAdmin, delete: isAdmin },
  hooks: {
    // Deleting a domain that still has content is blocked (architecture § Parent-child topology).
    beforeDelete: [
      async ({ id, req }) => {
        for (const collection of contentCollections) {
          const { totalDocs } = await req.payload.count({
            collection,
            where: { domain: { equals: id } },
            overrideAccess: true,
            req,
          })
          if (totalDocs > 0) {
            throw new APIError(`This domain still has ${totalDocs} ${collection}. Move or delete them first.`, 409)
          }
        }
      },
    ],
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true },
    { name: 'url', type: 'text', admin: { description: 'The live site, once it exists.' } },
    { name: 'kind', type: 'select', options: ['store', 'blog', 'site'], required: true },
    { name: 'languages', type: 'select', hasMany: true, options: ['fr', 'en'], defaultValue: ['fr', 'en'], required: true },
    { name: 'defaultLocale', type: 'select', options: ['fr', 'en'], defaultValue: 'fr', required: true },
    { name: 'status', type: 'select', options: ['live', 'planned'], defaultValue: 'planned', required: true },
    // What this one CMS serves to this one site — the point of the showcase, on the edit screen.
    { name: 'pages', type: 'join', collection: 'pages', on: 'domain' },
    { name: 'articles', type: 'join', collection: 'articles', on: 'domain' },
    { name: 'docs', type: 'join', collection: 'docs', on: 'domain' },
  ],
}
