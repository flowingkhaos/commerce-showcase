import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { en } from '@payloadcms/translations/languages/en'
import { fr } from '@payloadcms/translations/languages/fr'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'

import { Articles, Docs, Pages } from './collections/Content'
import { Domains } from './collections/Domains'
import { Media } from './collections/Media'
import { Users } from './collections/Users'
import { migrations } from './migrations'

const dirname = path.dirname(fileURLToPath(import.meta.url))

if (!process.env.PAYLOAD_SECRET || !process.env.DATABASE_URL) {
  throw new Error('PAYLOAD_SECRET and DATABASE_URL must be set (see .env.example).')
}

export default buildConfig({
  serverURL: process.env.SERVER_URL || 'http://localhost:4620',
  admin: {
    user: Users.slug,
    importMap: { baseDir: path.resolve(dirname) },
    meta: { titleSuffix: ' · Showcase CMS', robots: 'noindex, nofollow' },
  },
  collections: [Domains, Pages, Articles, Docs, Media, Users],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET,
  i18n: { supportedLanguages: { en, fr }, fallbackLanguage: 'en' },
  graphQL: { disable: true },
  maxDepth: 2,
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
  // Migrations, never push: local and the VM run the same schema path. `next start` applies
  // pending migrations on boot; `payload migrate` does it by hand.
  db: postgresAdapter({
    pool: { connectionString: process.env.DATABASE_URL },
    push: false,
    migrationDir: path.resolve(dirname, 'migrations'),
    prodMigrations: migrations,
  }),
  telemetry: false,
})
