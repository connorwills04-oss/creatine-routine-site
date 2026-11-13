import { defineConfig } from 'astro/config';

// Vercel (VERCEL=1) serves this site at the domain root.
// GitHub Pages, including scripts/deploy.sh, keeps the project subpath unless BASE_PATH is set.
function deployBase() {
  if (process.env.BASE_PATH !== undefined) {
    const raw = process.env.BASE_PATH.trim();
    if (raw === '' || raw === '/') return '/';
    const prefixed = raw.startsWith('/') ? raw : `/${raw}`;
    return prefixed.replace(/\/+$/, '') || '/';
  }
  return process.env.VERCEL ? '/' : '/creatine-routine-site';
}

// SITE_URL wins. On Vercel, use the production vercel.app host, then the deployment host.
function deploySite() {
  const explicit = process.env.SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, '');
  const host = (process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || '').trim();
  if (host) return `https://${host.replace(/^https?:\/\//, '').replace(/\/+$/, '')}`;
  return 'https://connorwills04-oss.github.io';
}

export default defineConfig({
  site: deploySite(),
  base: deployBase(),
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' },
});
