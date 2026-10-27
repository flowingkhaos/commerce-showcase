# commerce-showcase

A public, working example of a headless store: an Astro storefront, a Payload 4 CMS and Shopify
(through Hydrogen's framework-agnostic core), run on free plans. It shows one CMS serving several
websites while Shopify keeps prices, stock and checkout.

Status: the CMS is live. The storefront, OVRLD (an invented fitness store), is being designed.

## What is where

| Path | What it is |
|---|---|
| [`apps/cms`](apps/cms/README.md) | The CMS: Payload 4 on Google Cloud Run, Postgres on Neon. One admin serves four sites through a `domain` field. Start with its README. |
| `apps/web` | The storefront: Astro on Cloudflare Workers. Not in the repo yet. |

## Who owns which data

- **Shopify**: product titles, variants, prices, stock, product photos, collections, the cart and checkout.
- **Payload**: pages, each product's story and SEO, collection descriptions, docs, articles, menus.
- **The storefront's code**: routing, caching and rate limits.

Live CMS (admin only): https://showcase-cms-1065657380974.us-east5.run.app

MIT licensed.
