/** Product page behaviour: plan, quantity, add to cart, availability. Rebinds on each astro:page-load. */
import { site, shopifyConfigured } from '../../config/site';
import { add, getState, NOT_OPEN_MESSAGE } from '../../lib/cart';
import { emitCartOpen } from '../../lib/cart-events';
import { getProduct, firstSellingPlan, describeSaving } from '../../lib/shopify';

function init(): void {
  const root = document.querySelector<HTMLElement>('[data-pdp]');
  if (!root) return;
  const addBtn = root.querySelector<HTMLButtonElement>('[data-add-kit]');
  const refillBtn = document.querySelector<HTMLButtonElement>('[data-add-refill]');
  const status = root.querySelector<HTMLElement>('[data-pdp-status]');
  const out = root.querySelector<HTMLOutputElement>('[data-qty-out]');
  let qty = 1;

  const setQty = (n: number) => {
    qty = Math.max(1, Math.min(9, n));
    if (out) out.textContent = String(qty);
    root.querySelector<HTMLButtonElement>('[data-qty-dec]')!.disabled = qty <= 1;
    root.querySelector<HTMLButtonElement>('[data-qty-inc]')!.disabled = qty >= 9;
  };
  setQty(1);
  root.querySelector('[data-qty-dec]')?.addEventListener('click', () => setQty(qty - 1));
  root.querySelector('[data-qty-inc]')?.addEventListener('click', () => setQty(qty + 1));

  const say = (msg: string) => { if (status) status.textContent = msg; };

  const run = async (btn: HTMLButtonElement, opts: { product: 'kit' | 'refill'; plan: 'subscribe' | 'once'; quantity: number }) => {
    const label = btn.textContent;
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');
    btn.textContent = 'Adding…';
    say('');
    const started = performance.now();
    const ok = await add(opts);
    const wait = Math.max(0, 150 - (performance.now() - started));
    await new Promise((r) => setTimeout(r, wait));
    btn.textContent = label;
    btn.removeAttribute('aria-busy');
    btn.disabled = btn.dataset.locked === 'true';
    if (ok) emitCartOpen();
    else say(getState().error || 'Something went wrong. Please try again.');
  };

  addBtn?.addEventListener('click', () => {
    const plan = (root.querySelector<HTMLInputElement>('input[name="plan"]:checked')?.value ?? 'subscribe') as 'subscribe' | 'once';
    void run(addBtn, { product: 'kit', plan, quantity: qty });
  });
  refillBtn?.addEventListener('click', () => {
    void run(refillBtn, { product: 'refill', plan: 'subscribe', quantity: 1 });
  });

  if (!shopifyConfigured) return;
  const lock = (btn: HTMLButtonElement | null) => { if (btn) { btn.disabled = true; btn.dataset.locked = 'true'; } };

  getProduct(site.shopify.handles.kit).then((p) => {
    if (!root.isConnected) return;
    if (!p || !p.variant || !p.availableForSale || !p.variant.availableForSale) {
      lock(addBtn);
      say(NOT_OPEN_MESSAGE);
      return;
    }
    const saving = describeSaving(firstSellingPlan(p), p.variant.price);
    const el = root.querySelector<HTMLElement>('[data-plan-saving]');
    if (el && saving) { el.textContent = saving; el.hidden = false; }
  }).catch(() => { /* leave the page usable; add() surfaces errors */ });

  getProduct(site.shopify.handles.refill).then((p) => {
    if (!refillBtn?.isConnected) return;
    if (!p || !p.variant || !p.availableForSale || !p.variant.availableForSale) lock(refillBtn);
  }).catch(() => { /* ignore */ });
}

document.addEventListener('astro:page-load', init);
