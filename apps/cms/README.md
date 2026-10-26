# Showcase CMS

One Payload 4 (4.0.0-beta.4) CMS that serves every showcase and demo site: the OVRLD store,
the blog demo, and the renovation and plumbing demos. Every document carries a `domain`, so one
admin shows what a CMS serving many websites looks like. Shape: OSDocs
`projects/commerce-showcase/architecture.md` § Backend shape.

Runs on **Node + Postgres 18**, never on Workers (the 10-25 spike: admin CPU and PBKDF2 both fail
on workerd; `raw/research/commerce-showcase-spike-2026-10-25`).

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
  restart (`next start` applies pending migrations on boot). `push` is off everywhere.

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

The visitor door (Turnstile, ephemeral visitor users, sandbox drafts), the request guard and
rate limits, the products and webhook-events collections, the `site` global, live preview,
rebuild dispatch, R2 storage, and the production host. Each lands before the CMS is public.
