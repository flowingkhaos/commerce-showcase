# Showcase CMS

One Payload 4 (4.0.0-beta.4) CMS that serves every showcase and demo site: the OVRLD store,
the blog demo, and the renovation and plumbing demos. Every document carries a `domain`, so one
admin shows what a CMS serving many websites looks like.

Runs on **Node + Postgres 18**, never on Cloudflare Workers: in a test deploy the admin pages used
far more CPU than Workers allows, and workerd caps PBKDF2 below the iterations Payload's login uses.
Production: **Google Cloud Run**
(us-east5, scales to zero, free tier) + **Neon** Postgres (AWS us-east-2) + a **GCS bucket** for
media. A request to a sleeping CMS waits for a cold start (≈ 6 s measured locally), so sites read it
with a short timeout and keep their last good copy.

## Run it locally

```sh
podman start showcase-cms-db             # Postgres 18 on 127.0.0.1:55433 (first time: see below)
bun install && bun run build             # after any code change
NODE_ENV=production bun run start       # http://localhost:4620
bun run seed                             # idempotent seed
PAYLOAD_SECRET=$(grep -m1 '^PAYLOAD_SECRET=' .env | cut -d= -f2-) bun run smoke   # 54 checks
```

Without `PAYLOAD_SECRET` in its env the smoke skips the signed preview links. It walks the
whole visitor door only on `localhost`, where `.env` holds Cloudflare's always-pass Turnstile
test keys (see `.env.example`); against production it checks the door's refusals.

`next start` prints a warning that it "does not work with output: standalone"; it still serves
the app (checked). The Docker image runs `node server.js` from the standalone build instead.


- Admin: http://localhost:4620/admin (French or English UI). The seed writes the admin login and
  API key to a file outside the repo, mode 600: `$SHOWCASE_CMS_CREDS`, by default
  `~/.config/kos/showcase-cms.local.env`. The smoke reads the same file.
- To keep it running in the background on Linux: `systemd-run --user --unit=showcase-cms
  --working-directory="$PWD" --setenv=NODE_ENV=production "$PWD/node_modules/.bin/next" start --port 4620`
  (stop: `systemctl --user stop showcase-cms`, logs: `journalctl --user -u showcase-cms -f`).
- First-time database: `podman run -d --name showcase-cms-db -p 127.0.0.1:55433:5432 -e POSTGRES_USER=showcase -e POSTGRES_PASSWORD=showcase -e POSTGRES_DB=showcase -v showcase-cms-pg:/var/lib/postgresql docker.io/library/postgres:18`, then `cp .env.example .env` and set `PAYLOAD_SECRET`.
- Schema change: edit a collection → `bun run payload migrate:create <name>` → rebuild →
  restart (the server applies pending migrations on boot). `push` is off everywhere.
- Rate limits per IP and minute (`src/proxy.ts`): 10 sign-in attempts (the visitor door counts
  as one), 60 writes, 300 reads → 429.

## Deploy (Cloud Run)

```sh
bash deploy/cloudrun.sh <gcp-project-id> --seed   # first time; later runs without --seed
```

Needs `gcloud auth login`, podman, and `~/.config/kos/showcase-cms.prod.env` (mode 600) with
`DATABASE_URL` (Neon), `PAYLOAD_SECRET`, `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` (the
"Showcase CMS visitor door" Turnstile widget, hosts: the Cloud Run host and localhost). The script migrates Neon from here, builds and pushes
the image, deploys (max 1 instance, 512 MiB, zero when idle) and runs the smoke against the live
URL. The prod admin login and API key go to `~/.config/kos/showcase-cms.prod-admin.env`.
Live: https://showcase-cms-1065657380974.us-east5.run.app (a $1 CAD budget alert guards the project).
One-time step if your Google Cloud organization refuses public (`allUsers`) access:
`gcloud run services update showcase-cms --region=us-east5 --no-invoker-iam-check`; it persists.
`deploy/compose.yml` + `Caddyfile` run the same image with its own Postgres on any one VM.

## Read contract (for the sites)

Anonymous `GET`, no credentials. Anonymous reads return **published documents only**; drafts
never leak, even with `draft=true`. Max `depth` is 2.

| Collection | Read |
|---|---|
| `pages` | `/api/pages?where[domain.slug][equals]=<domain>&where[locale][equals]=<fr\|en>&depth=1&limit=100` |
| `articles` | `/api/articles?where[domain.slug][equals]=<domain>&where[locale][equals]=<fr\|en>&sort=-publishedAt` |
| `docs` | `/api/docs?where[domain.slug][equals]=<domain>&where[locale][equals]=<fr\|en>&sort=order` |
| `domains` | `/api/domains?depth=0` |

Every content doc: `id`, `title`, `slug`, `locale` (`fr` \| `en`), `domain` (object at depth ≥ 1),
`translationOf` (the other-language doc, or null), `meta { title, description, image }`,
`updatedAt` (UTC ISO). `(domain, locale, slug)` is unique. A French URL with no French doc is a
404, never English.

**Domains seeded:** `store` (OVRLD, kind store), `blog-demo` (blog), `renovation-demo` (Linteau,
site), `plumbing-demo` (Clapet, site). All `planned` until their site is live.

### Page blocks (`layout[]`, each has `blockType`)

| blockType | Fields |
|---|---|
| `hero` | `heading`, `subheading?`, `image?` (media), `links[]` |
| `richText` | `richText` (Lexical JSON), **`html`** (server-made HTML — print this) |
| `mediaText` | `heading?`, `richText?`, `html?`, `image` (media), `imagePosition` (`right` \| `left`) |
| `featureList` | `heading?`, `intro?`, `items[] { title, text? }` |
| `cta` | `heading`, `text?`, `links[]` |
| `faq` | `heading?`, `items[] { question, answer }` (plain text) |
| `banner` | `style` (`info` \| `success` \| `warning`), `text`, `link { label?, url? }` |
| `productGrid` | `heading?`, `collectionHandle` (Shopify), `limit` |

`links[]`: `{ label, url, style: 'primary' | 'secondary' }`, at most 2. Media: `{ url, alt,
credit?, width, height, mimeType }`; `url` is absolute on the CMS host (`SERVER_URL`), so add
that host to your CSP `img-src`.

Articles and docs bodies are **markdown** in `body`; render them with your own markdown
renderer. Articles also have `excerpt`, `hero` (media), `category`, `publishedAt`. Docs have
`category`, `order`, `keyword`.

## Write contract (for each site's seed script)

Seed or change your own domain's content with the admin API key:

```sh
set -a; . ~/.config/kos/showcase-cms.local.env; set +a
curl -X POST localhost:4620/api/pages -H "Authorization: users API-Key $SHOWCASE_CMS_API_KEY" \
  -H 'content-type: application/json' \
  -d '{"title":"…","domain":<domain id>,"locale":"fr","slug":"…","_status":"published","layout":[…]}'
```

`richText` fields take Lexical JSON; the easy path is the admin editor, or add your content to
`scripts/seed.ts` (one `pair(...)` call per FR + EN document). Images: `POST /api/media` as
multipart (`file` + `_payload={"alt":"…","credit":"…"}`).

## Live preview (for the sites)

Pages, articles and docs autosave every 3 s, and the admin shows the draft on the real site
beside the form. Each domain opts in by holding its site's address in `domains.url`; without
one the preview tab does not appear.

1. The admin's iframe opens `<domains.url>/preview?collection=<pages|articles|docs>&id=<id>&exp=<unix s>&sig=<hex>`.
   The link is signed by this CMS and lives 1–2 h (it changes once an hour, so the frame does
   not reload twice per save).
2. The site's `GET /preview` copies those four values to
   `GET <CMS>/api/preview?collection=…&id=…&exp=…&sig=…`, server side. 200 = the latest draft,
   the same JSON as `/api/<collection>/<id>?depth=1&draft=true`; 403 = a bad or expired link;
   404 = the document is gone. The site holds no secret: this CMS checks the signature
   (`src/preview.ts`).
3. On `/preview` only: `content-security-policy: frame-ancestors <CMS origin>`,
   `cache-control: no-store`, `x-robots-tag: noindex`.
4. One inline script on that page. On load:
   `parent.postMessage({ type: 'payload-live-preview', ready: true }, CMS_ORIGIN)` — required,
   the admin sends nothing before it. Then reload on each save:
   `addEventListener('message', (e) => { if (e.origin === CMS_ORIGIN && e.data?.type === 'payload-document-event') location.reload() })`.

Working examples: the renovation and plumbing demos (`pages/Preview.tsx` in each).

## Visitor door

« Enter as visitor » under the sign-in form lets a stranger try the admin without an account
(`src/visitor.ts`, `src/components/VisitorDoor.tsx`). Sites link to `<CMS>/admin/login`.

- A Turnstile check, then a generated user (`visitor-<hex>@showcase.invalid`, random password
  thrown away) with role `visitor`, signed in by cookie. No personal data.
- Visitors read every published document plus their own drafts. They create drafts in the
  `store` and `blog-demo` domains only, and edit or delete only their own (Payload 4's built-in
  `createdBy`, stamped by the server). Publishing is refused, as are uploads and any change to a user row.
- Caps: 300 visitors a day, 20 drafts each, title ≤ 120 characters, markdown ≤ 20,000.
- Visitors older than 24 h are deleted with everything they made: on each door entry and at
  each server boot (Cloud Run boots after every idle spell).
- No `TURNSTILE_SECRET_KEY` → no button, and `POST /api/visitor/enter` answers 503.

## Not built yet

The products and webhook-events collections, the `site` global, a `collectionList` block and
rebuild dispatch.
