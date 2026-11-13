/** Replaces [data-shopify-price="kit"|"refill"] placeholders with the Shopify first-variant price. Failure leaves the placeholder. */
import { site, shopifyConfigured } from '../../config/site';
import { getProduct, formatMoney } from '../../lib/shopify';

async function hydratePrices(): Promise<void> {
  if (!shopifyConfigured) return;
  const els = document.querySelectorAll<HTMLElement>('[data-shopify-price]');
  const byKey = new Map<'kit' | 'refill', HTMLElement[]>();
  els.forEach((el) => {
    const k = el.dataset.shopifyPrice;
    if (k === 'kit' || k === 'refill') byKey.set(k, [...(byKey.get(k) ?? []), el]);
  });
  await Promise.all([...byKey].map(async ([key, list]) => {
    try {
      const p = await getProduct(site.shopify.handles[key]);
      const price = p?.variant?.price;
      if (!price) return;
      const text = formatMoney(price.amount, price.currencyCode);
      list.forEach((el) => { if (el.isConnected) el.textContent = text; });
    } catch { /* keep the placeholder */ }
  }));
}

const w = window as unknown as { __pricesBound?: boolean };
if (!w.__pricesBound) {
  w.__pricesBound = true;
  document.addEventListener('astro:page-load', () => { void hydratePrices(); });
}
