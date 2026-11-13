/** Cart drawer behaviour. Runs once per document (guarded); the <dialog> persists across ClientRouter navigations. */
import { getState, subscribe, setQuantity, remove, checkout, clearError, type CartLineView, type CartState } from '../../lib/cart';
import { onCartOpen } from '../../lib/cart-events';
import { formatMoney } from '../../lib/shopify';
import { site } from '../../config/site';
import { getLenis, prefersReducedMotion } from '../motion';

const w = window as unknown as { __cartDrawerBound?: boolean };

const $ = <T extends HTMLElement>(sel: string): T | null => document.querySelector<T>(sel);
const dlg = (): HTMLDialogElement | null => $<HTMLDialogElement>('#cart-drawer');

let opener: HTMLElement | null = null;
let closing = false;

function tbd(text: string): HTMLElement {
  const s = document.createElement('span');
  s.className = 'tbd';
  s.textContent = text;
  return s;
}

function fillMoney(el: Element, m: { amount: string; currencyCode: string } | null): void {
  el.textContent = '';
  if (m) el.textContent = formatMoney(m.amount, m.currencyCode);
  else el.appendChild(tbd('[price]'));
}

function preorderNote(): Node {
  const f = document.createDocumentFragment();
  f.append('Preorder · ships ');
  const d = site.unknowns.shipDate;
  f.append(d.startsWith('[') ? tbd(d) : d);
  return f;
}

function makeLine(): HTMLLIElement {
  const li = document.createElement('li');
  li.className = 'cart-line';
  const top = document.createElement('div'); top.className = 'cart-line__top';
  const title = document.createElement('span'); title.className = 'cart-line__title';
  const price = document.createElement('span'); price.className = 'cart-line__price';
  top.append(title, price);
  const plan = document.createElement('div'); plan.className = 'cart-line__meta cart-line__plan';
  const pre = document.createElement('div'); pre.className = 'cart-line__meta'; pre.append(preorderNote());
  const row = document.createElement('div'); row.className = 'cart-line__row';
  const stepper = document.createElement('div'); stepper.className = 'cart-stepper';
  const dec = document.createElement('button'); dec.type = 'button'; dec.textContent = '−'; dec.dataset.act = 'dec';
  const out = document.createElement('output'); out.setAttribute('aria-live', 'polite');
  const inc = document.createElement('button'); inc.type = 'button'; inc.textContent = '+'; inc.dataset.act = 'inc';
  stepper.append(dec, out, inc);
  const rm = document.createElement('button'); rm.type = 'button'; rm.className = 'cart-remove'; rm.textContent = 'Remove'; rm.dataset.act = 'rm';
  row.append(stepper, rm);
  li.append(top, plan, pre, row);
  return li;
}

function updateLine(li: HTMLLIElement, l: CartLineView): void {
  li.dataset.id = l.id;
  li.querySelector('.cart-line__title')!.textContent = l.title;
  fillMoney(li.querySelector('.cart-line__price')!, l.total);
  li.querySelector('.cart-line__plan')!.textContent = l.planLabel;
  li.querySelector('output')!.textContent = String(l.quantity);
  const dec = li.querySelector<HTMLButtonElement>('[data-act="dec"]')!;
  const inc = li.querySelector<HTMLButtonElement>('[data-act="inc"]')!;
  dec.setAttribute('aria-label', `Decrease quantity of ${l.title}`);
  inc.setAttribute('aria-label', `Increase quantity of ${l.title}`);
  dec.disabled = l.quantity <= 1;
  inc.disabled = l.quantity >= 9;
  li.querySelector('[data-act="rm"]')!.setAttribute('aria-label', `Remove ${l.title} from cart`);
}

function render(s: CartState): void {
  const d = dlg();
  if (!d) return;
  const list = d.querySelector<HTMLUListElement>('[data-cart-lines]')!;
  const existing = new Map<string, HTMLLIElement>();
  list.querySelectorAll<HTMLLIElement>('li').forEach((li) => existing.set(li.dataset.id ?? '', li));
  const active = document.activeElement as HTMLElement | null;
  const refocus = active && list.contains(active) ? { id: active.closest<HTMLElement>('li')?.dataset.id, act: active.dataset.act } : null;

  const seen = new Set<string>();
  s.lines.forEach((l, i) => {
    let li = existing.get(l.id);
    if (!li) li = makeLine();
    updateLine(li, l);
    seen.add(l.id);
    if (list.children[i] !== li) list.insertBefore(li, list.children[i] ?? null);
  });
  existing.forEach((li, id) => { if (!seen.has(id)) li.remove(); });

  const empty = s.lines.length === 0;
  d.querySelector<HTMLElement>('[data-cart-empty]')!.hidden = !empty || !s.ready;
  d.querySelector<HTMLElement>('[data-cart-foot]')!.hidden = empty;
  d.querySelector<HTMLElement>('[data-cart-fallback]')!.hidden = !s.planFallback;
  fillMoney(d.querySelector('[data-cart-subtotal]')!, s.subtotal);
  d.querySelector<HTMLElement>('[data-cart-notice]')!.hidden = s.connected;
  const btn = d.querySelector<HTMLButtonElement>('[data-cart-checkout]')!;
  btn.disabled = !s.connected || empty || s.busy || !s.checkoutUrl;
  list.setAttribute('aria-busy', String(s.busy));
  d.querySelector('[data-cart-error]')!.textContent = s.error ?? '';

  if (refocus?.id) {
    const target = list.querySelector<HTMLElement>(`li[data-id="${CSS.escape(refocus.id)}"] [data-act="${refocus.act}"]`)
      ?? list.querySelector<HTMLElement>(`li[data-id="${CSS.escape(refocus.id)}"] button:not(:disabled)`);
    if (target && document.activeElement !== target) target.focus();
    else if (!target) d.querySelector<HTMLElement>('[data-cart-close]')?.focus();
  }
}

function finishClose(): void {
  const d = dlg();
  closing = false;
  if (d) { d.removeAttribute('data-closing'); if (d.open) d.close(); }
}

function afterClosed(): void {
  document.documentElement.classList.remove('cart-open');
  getLenis()?.start();
  const o = opener;
  opener = null;
  if (o && o.isConnected) o.focus();
}

function open(): void {
  const d = dlg();
  if (!d || d.open) return;
  opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  render(getState());
  d.showModal();
  document.documentElement.classList.add('cart-open');
  getLenis()?.stop();
  d.querySelector<HTMLElement>('[data-cart-body]')!.scrollTop = 0;
}

function close(): void {
  const d = dlg();
  if (!d || !d.open || closing) return;
  if (prefersReducedMotion()) { finishClose(); return; }
  closing = true;
  d.setAttribute('data-closing', '');
  window.setTimeout(finishClose, 245);
}

function bind(): void {
  const d = dlg();
  if (!d) return;
  d.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  d.addEventListener('close', afterClosed);
  d.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t === d) { // backdrop (dialog has no padding)
      const r = d.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) { close(); return; }
    }
    if (t.closest('[data-cart-close]')) { close(); return; }
    if (t.closest('[data-cart-checkout]')) { checkout(); return; }
    const act = t.closest<HTMLElement>('[data-act]');
    const li = act?.closest<HTMLElement>('li[data-id]');
    if (!act || !li?.dataset.id) return;
    const line = getState().lines.find((l) => l.id === li.dataset.id);
    if (!line) return;
    clearError();
    if (act.dataset.act === 'inc') void setQuantity(line.id, line.quantity + 1);
    else if (act.dataset.act === 'dec') void setQuantity(line.id, line.quantity - 1);
    else if (act.dataset.act === 'rm') void remove(line.id);
  });
}

if (!w.__cartDrawerBound) {
  w.__cartDrawerBound = true;
  subscribe(render);
  onCartOpen(open);
  // The persisted <dialog> would lose its top-layer status if moved while open: close instantly first.
  document.addEventListener('astro:before-swap', () => { if (dlg()?.open) finishClose(); });
  document.addEventListener('astro:page-load', () => { render(getState()); });
  bind();
  render(getState());
}
