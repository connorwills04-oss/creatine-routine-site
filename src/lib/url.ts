/**
 * u(path): the ONLY way to build internal links and asset URLs.
 * Prefixes import.meta.env.BASE_URL and normalises slashes.
 * On Vercel, BASE_URL is "/". On GitHub Pages it is "/creatine-routine-site/".
 *   u('/')         -> {base}/
 *   u('/product/') -> {base}/product/
 * External URLs (http:, https:, mailto:, tel:, #hash, //) are returned untouched.
 */
export function u(path: string = '/'): string {
  if (/^([a-z][a-z0-9+.-]*:|\/\/|#)/i.test(path)) return path;
  const base = (import.meta.env.BASE_URL ?? '/').replace(/\/+$/, '');
  if (base && (path === base || path.startsWith(base + '/'))) return path; // already prefixed
  const rest = path.replace(/^\/+/, '');
  return `${base}/${rest}`;
}
