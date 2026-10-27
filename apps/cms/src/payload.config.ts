import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { gcsStorage } from '@payloadcms/storage-gcs'
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
import { livePreview, previewEndpoint } from './preview'
import { sweepVisitors, visitorEnter } from './visitor'

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
    components: {
      afterLogin: [
        { path: '/components/VisitorDoor#VisitorDoor', clientProps: { siteKey: process.env.TURNSTILE_SITE_KEY } },
      ],
    },
    livePreview: { collections: ['pages', 'articles', 'docs'], ...livePreview },
  },
  collections: [Domains, Pages, Articles, Docs, Media, Users],
  endpoints: [visitorEnter, previewEndpoint],
  // Cloud Run boots after every idle spell, so this sweep runs about daily on top of the door's.
  onInit: (payload) => {
    sweepVisitors(payload).catch((e) => payload.logger.error(`visitor sweep: ${e}`))
  },
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET,
  i18n: { supportedLanguages: { en, fr }, fallbackLanguage: 'en' },
  graphQL: { disable: true },
  maxDepth: 2,
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
  // Migrations, never push: local and Cloud Run run the same schema path. The server applies
  // pending migrations on boot; `payload migrate` does it by hand.
  db: postgresAdapter({
    pool: { connectionString: process.env.DATABASE_URL },
    push: false,
    migrationDir: path.resolve(dirname, 'migrations'),
    prodMigrations: migrations,
  }),
  // On Cloud Run the disk is wiped on every restart, so media go to a bucket (same region,
  // credentials from the service account). Locally GCS_BUCKET is unset and media stay on disk.
  // Payload 4: storage adapters live under `storage`, not `plugins`.
  storage: [
    gcsStorage({
      enabled: Boolean(process.env.GCS_BUCKET),
      bucket: process.env.GCS_BUCKET || 'unset',
      collections: { media: true },
      options: {},
    }),
  ],
  telemetry: false,
})
