/**
 * Cart store. One module-level singleton (guarded on window so it survives ClientRouter + duplicate bundles).
 *  CONNECTED (shopifyConfigured): real Shopify cart, id in localStorage, hosted checkout.
 *  NOT CONNECTED: local cart in localStorage, no prices, checkout disabled. Never fakes an order.
 */
import { site, shopifyConfigured } from '../config/site';
import { emitCartChange } from './cart-events';
import * as shop from './shopify';
import type { Money, RawCart, LineInput } from './shopify';

export type ProductKey = 'kit' | 'refill';
export type PlanKind = 'subscribe' | 'once';

export interface CartLineView {
  id: string;
  quantity: number;
  productKey: ProductKey | null;
  title: string;
  planKind: PlanKind;
  planLabel: string;
  /** Line total, or null when unpriced (not connected). */
  total: Money | null;
}

export interface CartState {
  connected: boolean;
  ready: boolean;
  busy: boolean;
  lines: CartLineView[];
  count: number;
  subtotal: Money | null;
  checkoutUrl: string | null;
  error: string | null;
  /** Last add asked for a plan but none exists yet, so it went in as one-time. */
  planFallback: boolean;
}

export const NOT_CONNECTED_NOTICE =
  "Checkout isn't connected yet. Add the Shopify store domain and Storefront token to switch it on.";
export const NOT_OPEN_MESSAGE = "Preorders aren't open yet.";

const KEY_ID = 'cart:shopify-id';
const KEY_LOCAL = 'cart:local';
const MAX_QTY = 9;

type Listener = (s: CartState) => void;

interface LocalLine { id: string; productKey: ProductKey; planKind: PlanKind; quantity: number }

const planLabel = (key: ProductKey | null, kind: PlanKind): string =>
  kind === 'once' ? 'One-time' : key === 'refill' ? 'Refill, monthly' : 'Kit now, refills monthly';
const titleFor = (key: ProductKey): string => (key === 'kit' ? 'Starter kit' : 'Refill');

let state: CartState = {
  connected: shopifyConfigured, ready: false, busy: false, lines: [], count: 0, subtotal: null,
  checkoutUrl: null, error: null, planFallback: false,
};
const listeners = new Set<Listener>();
let queue: Promise<unknown> = Promise.resolve();

function lsGet(k: string): string | null { try { return localStorage.getItem(k); } catch { return null; } }
function lsSet(k: string, v: string | null): void {
  try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* ignore */ }
}

function set(patch: Partial<CartState>): void {
  state = { ...state, ...patch };
  listeners.forEach((cb) => { try { cb(state); } catch { /* ignore */ } });
  if (typeof document !== 'undefined') emitCartChange(state.count);
}

/** Run mutations one at a time. */
function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const next = queue.then(fn, fn);
  queue = next.catch(() => undefined);
  return next;
}

const errMsg = (e: unknown): string =>
  e instanceof Error && e.message ? e.message : 'Something went wrong. Please try again.';

/* ---------- mapping ---------- */

function fromShopify(cart: RawCart): Partial<CartState> {
  const lines: CartLineView[] = cart.lines.nodes.map((l) => {
    const handle = l.merchandise.product.handle;
    const key: ProductKey | null = handle === site.shopify.handles.kit ? 'kit' : handle === site.shopify.handles.refill ? 'refill' : null;
    const kind: PlanKind = l.sellingPlanAllocation ? 'subscribe' : 'once';
    return {
      id: l.id, quantity: l.quantity, productKey: key, title: l.merchandise.product.title,
      planKind: kind, planLabel: planLabel(key, kind), total: l.cost.totalAmount,
    };
  });
  return { lines, count: cart.totalQuantity, subtotal: cart.cost.subtotalAmount, checkoutUrl: cart.checkoutUrl };
}

function readLocal(): LocalLine[] {
  try {
    const arr = JSON.parse(lsGet(KEY_LOCAL) ?? '[]');
    if (!Array.isArray(arr)) return [];
    return arr.filter((l) => l && typeof l.id === 'string' && (l.productKey === 'kit' || l.productKey === 'refill') && Number.isInteger(l.quantity));
  } catch { return []; }
}

function applyLocal(lines: LocalLine[]): void {
  lsSet(KEY_LOCAL, JSON.stringify(lines));
  set({
    lines: lines.map((l) => ({
      id: l.id, quantity: l.quantity, productKey: l.productKey, title: titleFor(l.productKey),
      planKind: l.planKind, planLabel: planLabel(l.productKey, l.planKind), total: null,
    })),
    count: lines.reduce((n, l) => n + l.quantity, 0),
    subtotal: null, checkoutUrl: null,
  });
}

const uid = (): string => (crypto.randomUUID ? crypto.randomUUID() : `l${Date.now()}${Math.random().toString(16).slice(2)}`);

/* ---------- public API ---------- */

export const getState = (): CartState => state;

export function subscribe(cb: Listener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function clearError(): void { if (state.error) set({ error: null }); }

export function hydrate(): Promise<void> {
  return enqueue(async () => {
    if (!shopifyConfigured) {
      applyLocal(readLocal());
      set({ ready: true, error: null });
      return;
    }
    const id = lsGet(KEY_ID);
    if (!id) { set({ ready: true, count: 0, lines: [], subtotal: null, checkoutUrl: null }); return; }
    try {
      const cart = await shop.getCart(id);
      if (!cart) {
        lsSet(KEY_ID, null);
        set({ ready: true, lines: [], count: 0, subtotal: null, checkoutUrl: null, error: null });
      } else {
        set({ ...fromShopify(cart), ready: true, error: null });
      }
    } catch (e) {
      set({ ready: true, error: errMsg(e) });
    }
  });
}

export async function add(opts: { product: ProductKey; plan: PlanKind; quantity: number }): Promise<boolean> {
  const quantity = Math.max(1, Math.min(MAX_QTY, Math.floor(opts.quantity) || 1));
  return enqueue(async () => {
    set({ busy: true, error: null, planFallback: false });
    try {
      if (!shopifyConfigured) {
        const lines = readLocal();
        const hit = lines.find((l) => l.productKey === opts.product && l.planKind === opts.plan);
        if (hit) hit.quantity = Math.min(MAX_QTY, hit.quantity + quantity);
        else lines.push({ id: uid(), productKey: opts.product, planKind: opts.plan, quantity });
        applyLocal(lines);
        set({ busy: false });
        return true;
      }
      const handle = site.shopify.handles[opts.product];
      const product = await shop.getProduct(handle);
      if (!product || !product.variant || !product.availableForSale || !product.variant.availableForSale) {
        set({ busy: false, error: NOT_OPEN_MESSAGE });
        return false;
      }
      const plan = opts.plan === 'subscribe' ? shop.firstSellingPlan(product) : null;
      const line: LineInput = {
        merchandiseId: product.variant.id,
        quantity,
        attributes: shop.preorderLineAttributes(),
        ...(plan ? { sellingPlanId: plan.id } : {}),
      };
      const id = lsGet(KEY_ID);
      let cart: RawCart | null = id ? await shop.cartLinesAdd(id, [line]) : null;
      if (!cart) cart = await shop.cartCreate([line]);
      lsSet(KEY_ID, cart.id);
      set({ ...fromShopify(cart), busy: false, planFallback: opts.plan === 'subscribe' && !plan });
      return true;
    } catch (e) {
      set({ busy: false, error: errMsg(e) });
      return false;
    }
  });
}

async function mutateLine(lineId: string, qty: number): Promise<void> {
  const snapshot = state;
  const clamped = Math.max(0, Math.min(MAX_QTY, qty));
  const nextLines = clamped === 0
    ? snapshot.lines.filter((l) => l.id !== lineId)
    : snapshot.lines.map((l) => (l.id === lineId ? { ...l, quantity: clamped } : l));
  const count = nextLines.reduce((n, l) => n + l.quantity, 0);

  if (!shopifyConfigured) {
    applyLocal(readLocal().map((l) => (l.id === lineId ? { ...l, quantity: clamped } : l)).filter((l) => l.quantity > 0));
    return;
  }
  const cartId = lsGet(KEY_ID);
  if (!cartId) return;
  // optimistic: totals stay as they were until Shopify answers
  set({ lines: nextLines, count, busy: true, error: null });
  try {
    const cart = clamped === 0 ? await shop.cartLinesRemove(cartId, [lineId]) : await shop.cartLinesUpdate(cartId, [{ id: lineId, quantity: clamped }]);
    set({ ...fromShopify(cart), busy: false });
  } catch (e) {
    set({ lines: snapshot.lines, count: snapshot.count, subtotal: snapshot.subtotal, busy: false, error: errMsg(e) });
  }
}

export function setQuantity(lineId: string, qty: number): Promise<void> {
  return enqueue(() => mutateLine(lineId, qty));
}

export function remove(lineId: string): Promise<void> {
  return enqueue(() => mutateLine(lineId, 0));
}

/** Hands off to Shopify's hosted checkout. Does nothing when not connected. */
export function checkout(): void {
  if (!shopifyConfigured || !state.checkoutUrl || !state.count) return;
  location.assign(state.checkoutUrl);
}

/* ---------- init (once) ---------- */

const w = window as unknown as { __cartInit?: boolean };
if (typeof window !== 'undefined' && !w.__cartInit) {
  w.__cartInit = true;
  void hydrate();
  window.addEventListener('storage', (e) => {
    if (e.key === KEY_ID || e.key === KEY_LOCAL) void hydrate();
  });
}
