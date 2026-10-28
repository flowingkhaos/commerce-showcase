# OVRLD storefront

The public showcase store: an invented fitness shop built with **Astro 7** and **Preact** islands,
**Shopify** through Hydrogen's framework-free core (`@shopify/hydrogen` 2026.10.2), and the
showcase **Payload 4** CMS in `apps/cms`. It runs as one Cloudflare Worker, `commerce-showcase`.

Every page is built ahead of time: the build reads Shopify and the CMS, and Cloudflare serves the
result as files. Only these routes run in the Worker, on each request:

| Route | What it does |
|---|---|
| `/api/cart`, `/checkout`, `/cart/<variant>:<qty>` | Shopify cart, through Hydrogen's handlers |
| `/cart`, `/fr/cart` | The full bag page, rendered from the real cart (works without JavaScript) |
| `/preview` | Live preview of a CMS draft, for the CMS admin's frame only |

English lives at `/`, French under `/fr`. Pages: home (the CMS `home` page), collections,
products, docs (the CMS `docs` collection), how it works, 404. The nav and footer come from the
CMS `site` doc, and a product's story from the CMS `products` collection when one is written;
Shopify owns titles, prices, stock, photos and the cart.

## Run it locally

You need Bun and Node 24.

```sh
bun install
node scripts/dev-vars.mjs <your env file>   # writes .dev.vars (see .env.example)
bun run build                               # reads Shopify and the CMS
bun run preview                             # wrangler dev on the build: http://localhost:8787
```

`.dev.vars` holds two values, used by the build and by `wrangler dev`:

- `PUBLIC_STORE_DOMAIN` — the shop's `*.myshopify.com` domain.
- `PRIVATE_STOREFRONT_API_TOKEN` — a Storefront API private token (server only).

`CMS_URL` is optional; it defaults to the live CMS. A sleeping CMS takes about 6 s to wake, and
a build that cannot read it fails instead of shipping empty pages.

Checks: `bun run typecheck` (Astro's checker, then `hydrogen gql check` on every Storefront query).

## Deploy

Deploys go to Cloudflare Workers with wrangler. Nothing in this repository names an account:
wrangler reads it from the environment.

```sh
export CLOUDFLARE_ACCOUNT_ID=…  CLOUDFLARE_API_TOKEN=…   # a token scoped to the one account
bun run deploy --secrets-file /path/outside/the/repo/secrets.json   # build, then wrangler deploy
```

The secrets file is JSON with the Worker's two secrets, and it ships them with the deploy:
`{ "PUBLIC_STORE_DOMAIN": "…", "PRIVATE_STOREFRONT_API_TOKEN": "…" }`. Keep it out of the
repository. Deploy with them every time: the Worker checks its variables when it starts, and a
deploy without them fails (`10021 EnvInvalidVariables`).

The build needs the same two values (in `.dev.vars` or the environment). For live preview, the
CMS's `store` domain must hold the Worker's address in `domains.url`.

## Guards

- Security headers on every response: a content security policy (our origin, Google Fonts,
  Shopify's CDN, and the CMS for images), HSTS, a referrer policy, `nosniff`, and
  `frame-ancestors 'none'` everywhere except `/preview`. Prebuilt pages get them from the
  `_headers` file the build writes; Worker responses from `src/worker.ts`.
- Collection and product pages are `noindex`; docs and how it works are indexed.
- A `POST` must come from this site (`Origin`), with a body under 64 KiB.
- Cart writes and previews: 30 requests a minute per IP, then `429` with a JSON body naming the
  route (Workers rate-limit binding `LIMITER`).
