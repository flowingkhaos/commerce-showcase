# Shop setup

Loads the OVRLD catalogue into a Shopify development store through the Admin GraphQL API:
12 products with their variants, CAD prices, stock, French translations and spec fields,
10 smart collections, the photos, and publication to the headless storefront.

The catalogue is plain data in [`catalog.ts`](catalog.ts); [`setup.ts`](setup.ts) sends it.
Re-running updates in place (products and collections are matched by handle).

## Run it

You need a free development store (Shopify Partner account → Dev Dashboard → **Stores → Create
store → Dev**) and, in the same organization, a Dev Dashboard app installed on it with the scopes
`write_products, write_inventory, read_locations, write_translations, write_locales,
write_publications`. Install the **Headless** channel and create a storefront named
`OVRLD storefront`. In **Settings → Languages**, add French to the store's market.

```sh
# an env file outside the repo with SHOPIFY_STORE_DOMAIN, SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET
bun --env-file=/path/to/shopify.env apps/shop-setup/setup.ts           # load or update
bun --env-file=/path/to/shopify.env apps/shop-setup/setup.ts --prune   # also delete every product
                                                                        # and collection not in catalog.ts
```

The app's client ID and secret buy a 24-hour Admin token (client credentials grant); no permanent
admin token exists. Photos are Unsplash stock under the Unsplash License, chosen so each product's
data matches its photo; products without a matching photo have none.
