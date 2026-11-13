# Shopify setup

The site is static (GitHub Pages). It talks to Shopify's Storefront API from the browser and hands off to Shopify's hosted checkout. Prices always come from Shopify; nothing is hardcoded on the site.

## Steps

1. **Store.** Create a Shopify store, or sign in to yours.
2. **Storefront token.** Install the **Headless** sales channel (or create a custom app) and create a Storefront API access token. Copy the **public** Storefront access token (not the private one, not an Admin token). Enable these Storefront scopes:
   - `unauthenticated_read_product_listings`
   - `unauthenticated_write_checkouts`
   - `unauthenticated_read_checkouts`
   - `unauthenticated_read_selling_plans`
3. **Products.** Create two products with handles exactly `starter-kit` and `refill` (the handle is the URL slug). Publish both to the Headless (or custom app) sales channel and set a price on each.
4. **Preorder settings.**
   - On each variant, turn on **Continue selling when out of stock** (or turn off inventory tracking), so the products stay purchasable before stock exists.
   - Add preorder wording to the product description.
   - Decide when cards are charged: at order time, or later. If you want a deferred charge, use Shopify's pre-order purchase options or a preorder app. The site shows "[charge timing]" until you decide. Preorders are not open, so the live site does not charge anyone.
5. **Refills.** Install a subscriptions app (for example Shopify Subscriptions), create a monthly plan, and attach it to **both** products. The site uses the first selling plan it finds. Until a plan exists, "Kit now, refills monthly" is added as a one-time purchase and the cart says so.
6. **Connect the site.** Put these in `.env` (never commit a private token):
   ```
   PUBLIC_SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
   PUBLIC_SHOPIFY_STOREFRONT_TOKEN=your-public-storefront-token
   ```
   Then rebuild and redeploy: `npm run deploy`.
7. **Test.** Open the product page, add to cart, then Check out. You should land on Shopify's hosted checkout. Orders carry the cart attribute `Order type: Preorder`, and each line carries a `Preorder` attribute (`Ships <date>` once the ship date is set in the site config, otherwise `Yes`).

## When it is not connected

`preordersOpen` in `src/config/site.ts` is false. Add to cart stays disabled, and the page says preorders are not open. No order is created and nothing is charged. Prices keep the `[price]` placeholder while Shopify is disconnected. Checkout stays off until both env vars exist.

If `preordersOpen` is later set to true while either `.env` value is still missing, the cart is kept in the browser only, prices still show `[price]`, and Check out stays disabled. No order is created.

If it is connected but a product handle is missing or not available for sale, the product page disables Add to cart and says "Preorders aren't open yet."
