# Showcase CMS

One Payload 4 (4.0.0-beta.4) CMS that serves every showcase and demo site: the OVRLD store,
the blog demo, and the renovation and plumbing demos. Every document carries a `domain`, so one
admin shows what a CMS serving many websites looks like. Shape: OSDocs
`projects/commerce-showcase/architecture.md` § Backend shape.

Runs on **Node + Postgres 18**, never on Workers (the 10-25 spike: admin CPU and PBKDF2 both fail
on workerd; `raw/research/commerce-showcase-spike-2026-10-25`). Production: **Google Cloud Run**
(us-east5, scales to zero, free tier) + **Neon** Postgres (AWS us-east-2) + a **GCS bucket** for
media. A request to a sleeping CMS waits for a cold start (≈ 6 s measured locally), so sites read it
with a short timeout and keep their last good copy.

## Run it locally

```sh
podman start showcase-cms-db             # Postgres 18 on 127.0.0.1:55433 (first time: see below)
bun install && bun run build             # after any code change
systemd-run --user --unit=showcase-cms --working-directory="$PWD" \
  --setenv=NODE_ENV=production "$PWD/node_modules/.bin/next" start --port 4620
bun run seed && bun run smoke            # idempotent seed; 38 checks
```

- Admin: http://localhost:4620/admin (French or English UI). Login and API key:
  `~/.config/kos/showcase-cms.local.env` (written by the seed, mode 600).
- Stop / logs: `systemctl --user stop showcase-cms` · `journalctl --user -u showcase-cms -f`.
- First-time database: `podman run -d --name showcase-cms-db -p 127.0.0.1:55433:5432 -e POSTGRES_USER=showcase -e POSTGRES_PASSWORD=showcase -e POSTGRES_DB=showcase -v showcase-cms-pg:/var/lib/postgresql docker.io/library/postgres:18`, then `cp .env.example .env` and set `PAYLOAD_SECRET`.
- Schema change: edit a collection → `bun run payload migrate:create <name>` → rebuild →
  restart (the server applies pending migrations on boot). `push` is off everywhere.
- Rate limits per IP and minute (`src/proxy.ts`): 10 sign-in attempts, 60 writes, 300 reads → 429.

## Deploy (Cloud Run)

```sh
bash deploy/cloudrun.sh <gcp-project-id> --seed   # first time; later runs without --seed
```

Needs `gcloud auth login`, podman, and `~/.config/kos/showcase-cms.prod.env` (mode 600) with
`DATABASE_URL` (Neon) and `PAYLOAD_SECRET`. The script migrates Neon from here, builds and pushes
the image, deploys (max 1 instance, 512 MiB, zero when idle) and runs the smoke against the live
URL. Prod admin login + API key: `~/.config/kos/showcase-cms.prod-admin.env`.
Live: https://showcase-cms-1065657380974.us-east5.run.app (project `showcase-cms`, 1 CAD budget alert).
One-time, by the operator: the workspace org refuses `allUsers`, so public access is
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

## Write contract (for the sessions building the sites)

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

## Not built yet

The visitor door (Turnstile, ephemeral visitor users, sandbox drafts), the products and
webhook-events collections, the `site` global, a `collectionList` block, live preview and
rebuild dispatch.
