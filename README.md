# Creatine routine site

Static marketing and preorder site (Astro 5, TypeScript, plain CSS, GSAP + Lenis). Built for GitHub Pages under a sub-path.

## Commands

    npm install
    npm run dev       # local dev server
    npm run build     # static build to dist/
    npm run preview   # serve dist/ locally

`BASE_PATH` and `SITE_URL` env vars override the deploy path and origin (see `astro.config.mjs`).

## Where things live

- Brand name, nav, formulas, and every bracketed placeholder (doses, prices, ship date, support email, legal entity, lab partner, flavors): `src/config/site.ts`. Render unknowns with `<Tbd>`.
- Shopify: copy `.env.example` to `.env` and set `PUBLIC_SHOPIFY_STORE_DOMAIN` and `PUBLIC_SHOPIFY_STOREFRONT_TOKEN`. Handles and API version are in `site.ts`.
- Design tokens: `src/styles/tokens.css`; global utilities: `src/styles/global.css`.
- Motion: `src/scripts/motion.ts`; page transition: `src/components/PageTransition.astro`.
- Every internal link and asset URL goes through `u()` in `src/lib/url.ts`.
