# Creatine routine site

Static marketing site for Bookend (Astro 5, TypeScript, plain CSS, GSAP + Lenis). Preorders are not open, and the site does not take payment.

## Hosting

Vercel serves the site at the domain root. Hobby plan only: no custom domain and no paid add-ons. Project settings, also pinned in `vercel.json`:

- Framework preset: Astro
- Build command: `npm run build`
- Output directory: `dist`
- Install command: `npm install` (the default)

On Vercel the base path is `/`. The canonical origin is `SITE_URL` when that env var is set. Otherwise it is `https://$VERCEL_PROJECT_PRODUCTION_URL` (the project's `vercel.app` host when no custom domain is attached), then `https://$VERCEL_URL`. Do not add Shopify env vars.

GitHub Pages still builds. `scripts/deploy.sh` does not set `VERCEL`, so the default base stays `/creatine-routine-site` and the default origin stays `https://connorwills04-oss.github.io`. Set `BASE_PATH` or `SITE_URL` to override either build. An empty `BASE_PATH` means `/`.

## Commands

    npm install
    npm run dev       # local dev server
    npm run build     # static build to dist/
    npm run preview   # serve dist/ locally

`BASE_PATH` and `SITE_URL` override the deploy path and origin (see `astro.config.mjs`).

## Where things live

- Brand, formulas, legal lines, and every remaining bracketed unknown (price, ship date, flavors, lab partner, sticks per pack, packaging colors, and the rest): `src/config/site.ts`. Render unknowns with `<Tbd>`.
- Shopify: copy `.env.example` to `.env` and set `PUBLIC_SHOPIFY_STORE_DOMAIN` and `PUBLIC_SHOPIFY_STOREFRONT_TOKEN`. Handles and API version are in `site.ts`.
- Design tokens: `src/styles/tokens.css`; global utilities: `src/styles/global.css`.
- Motion: `src/scripts/motion.ts`; page transition: `src/components/PageTransition.astro`.
- Every internal link and asset URL goes through `u()` in `src/lib/url.ts`.
