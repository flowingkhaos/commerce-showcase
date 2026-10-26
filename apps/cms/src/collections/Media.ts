import type { CollectionConfig } from 'payload'

import { anyone, isAdmin } from '../fields'

export const Media: CollectionConfig = {
  slug: 'media',
  versions: false,
  admin: { group: 'Library' },
  access: { read: anyone, create: isAdmin, update: isAdmin, delete: isAdmin },
  fields: [
    { name: 'alt', type: 'text', required: true },
    { name: 'credit', type: 'text', admin: { description: 'Photographer and source, e.g. "Jane Doe / Unsplash".' } },
  ],
  // ponytail: originals only (no sharp, no sizes); the sites size images at build or with CSS.
  upload: { staticDir: 'media', mimeTypes: ['image/*'] },
}
