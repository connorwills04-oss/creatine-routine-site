/**
 * CART CONTRACT (stub). The real cart implementation (drawer, Shopify) lives elsewhere and must:
 *  - listen for CART_OPEN on `document` and open the drawer into #cart-root (or the "after" slot)
 *  - dispatch CART_CHANGE on `document` whenever the line count changes, detail { count }
 * Any element with `data-cart-open` opens the cart (delegated listener registered once in Base.astro).
 * The Nav count pill (`[data-cart-count]`) already listens to CART_CHANGE.
 * Document-level listeners survive ClientRouter navigations: register them ONCE (guard with a flag).
 */
export const CART_OPEN = 'cart:open';
export const CART_CHANGE = 'cart:change';

export interface CartChangeDetail {
  count: number;
}

export function emitCartOpen(): void {
  document.dispatchEvent(new CustomEvent(CART_OPEN));
}

export function emitCartChange(count: number): void {
  document.dispatchEvent(new CustomEvent<CartChangeDetail>(CART_CHANGE, { detail: { count } }));
}

/** Subscribe to count changes. Returns an unsubscribe function. */
export function onCartChange(cb: (count: number) => void): () => void {
  const handler = (e: Event) => cb((e as CustomEvent<CartChangeDetail>).detail?.count ?? 0);
  document.addEventListener(CART_CHANGE, handler);
  return () => document.removeEventListener(CART_CHANGE, handler);
}

/** Subscribe to open requests. Returns an unsubscribe function. */
export function onCartOpen(cb: () => void): () => void {
  document.addEventListener(CART_OPEN, cb);
  return () => document.removeEventListener(CART_OPEN, cb);
}
