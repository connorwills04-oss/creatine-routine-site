import { defineConfig } from 'astro/config';

// Hosted on GitHub Pages under a sub-path. Override with SITE_URL / BASE_PATH env vars.
export default defineConfig({
  site: process.env.SITE_URL ?? 'https://connorwills04-oss.github.io',
  base: process.env.BASE_PATH ?? '/creatine-routine-site',
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' },
});
