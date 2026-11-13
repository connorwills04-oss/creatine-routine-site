/**
 * Shopify Storefront API client (browser-side, static site, no server).
 * The Storefront access token is PUBLIC by design. Never put a private/Admin token here.
 */
import { site, shopifyConfigured } from '../config/site';

export { shopifyConfigured };

export type ShopifyErrorKind = 'network' | 'http' | 'graphql' | 'user';

export class ShopifyError extends Error {
  kind: ShopifyErrorKind;
  details?: unknown;
  constructor(kind: ShopifyErrorKind, message: string, details?: unknown) {
    super(message);
    this.name = 'ShopifyError';
    this.kind = kind;
    this.details = details;
  }
}

export interface Money { amount: string; currencyCode: string }

export type PriceAdjustment =
  | { type: 'percentage'; percent: number }
  | { type: 'amount'; amount: Money }
  | { type: 'price'; price: Money };

export interface SellingPlan { id: string; name: string; groupName: string; adjustment: PriceAdjustment | null }

export interface ProductVariant { id: string; price: Money; availableForSale: boolean; currentlyNotInStock: boolean }

export interface Product {
  handle: string;
  title: string;
  availableForSale: boolean;
  variant: ProductVariant | null;
  sellingPlans: SellingPlan[];
}

export interface RawCartLine {
  id: string;
  quantity: number;
  sellingPlanAllocation: { sellingPlan: { id: string; name: string } } | null;
  cost: { totalAmount: Money };
  attributes: Array<{ key: string; value: string }>;
  merchandise: { id: string; title: string; price: Money; product: { title: string; handle: string } };
}

export interface RawCart {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  cost: { subtotalAmount: Money };
  lines: { nodes: RawCartLine[] };
}

export interface LineInput { merchandiseId: string; quantity: number; sellingPlanId?: string; attributes?: Array<{ key: string; value: string }> }

/* ---------- transport ---------- */

export async function storefront<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  if (!shopifyConfigured) throw new ShopifyError('network', 'Shopify is not connected.');
  const { storeDomain, storefrontToken, apiVersion } = site.shopify;
  let res: Response;
  try {
    res = await fetch(`https://${storeDomain}/api/${apiVersion}/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Shopify-Storefront-Access-Token': storefrontToken,
      },
      body: JSON.stringify({ query, variables }),
    });
  } catch (err) {
    throw new ShopifyError('network', "Couldn't reach the store. Check your connection and try again.", err);
  }
  if (!res.ok) throw new ShopifyError('http', `The store returned an error (${res.status}).`, res.status);
  let json: { data?: T; errors?: Array<{ message: string }> };
  try {
    json = await res.json();
  } catch (err) {
    throw new ShopifyError('http', 'The store sent a response we could not read.', err);
  }
  if (json.errors?.length) throw new ShopifyError('graphql', json.errors.map((e) => e.message).join('; '), json.errors);
  if (!json.data) throw new ShopifyError('graphql', 'The store sent an empty response.');
  return json.data;
}

function assertNoUserErrors(errs: Array<{ field?: string[] | null; message: string }> | null | undefined): void {
  if (errs && errs.length) throw new ShopifyError('user', errs.map((e) => e.message).join(' '), errs);
}

/* ---------- money ---------- */

export function formatMoney(amount: string | number, currencyCode: string): string {
  const n = typeof amount === 'number' ? amount : parseFloat(amount);
  if (!Number.isFinite(n)) return '';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${n} ${currencyCode}`;
  }
}

/* ---------- products ---------- */

const PRODUCT_FIELDS = `
  title
  handle
  availableForSale
  variants(first: 1) { nodes { id price { amount currencyCode } availableForSale currentlyNotInStock } }
`;
const SELLING_PLAN_FIELDS = `
  sellingPlanGroups(first: 5) {
    nodes {
      name
      sellingPlans(first: 5) {
        nodes {
          id
          name
          priceAdjustments {
            adjustmentValue {
              __typename
              ... on SellingPlanPercentagePriceAdjustment { adjustmentPercentage }
              ... on SellingPlanFixedAmountPriceAdjustment { adjustmentAmount { amount currencyCode } }
              ... on SellingPlanFixedPriceAdjustment { price { amount currencyCode } }
            }
          }
        }
      }
    }
  }
`;
export const PRODUCT_QUERY = `query Product($handle: String!) { product(handle: $handle) { ${PRODUCT_FIELDS} ${SELLING_PLAN_FIELDS} } }`;
export const PRODUCT_QUERY_NO_PLANS = `query ProductNoPlans($handle: String!) { product(handle: $handle) { ${PRODUCT_FIELDS} } }`;

interface RawProduct {
  title: string;
  handle: string;
  availableForSale: boolean;
  variants: { nodes: ProductVariant[] };
  sellingPlanGroups?: {
    nodes: Array<{
      name: string;
      sellingPlans: {
        nodes: Array<{
          id: string;
          name: string;
          priceAdjustments?: Array<{
            adjustmentValue: {
              __typename: string;
              adjustmentPercentage?: number;
              adjustmentAmount?: Money;
              price?: Money;
            };
          }>;
        }>;
      };
    }>;
  };
}

function mapProduct(p: RawProduct): Product {
  const sellingPlans: SellingPlan[] = [];
  for (const g of p.sellingPlanGroups?.nodes ?? []) {
    for (const sp of g.sellingPlans.nodes) {
      const v = sp.priceAdjustments?.[0]?.adjustmentValue;
      let adjustment: PriceAdjustment | null = null;
      if (v?.__typename === 'SellingPlanPercentagePriceAdjustment' && typeof v.adjustmentPercentage === 'number') {
        adjustment = { type: 'percentage', percent: v.adjustmentPercentage };
      } else if (v?.__typename === 'SellingPlanFixedAmountPriceAdjustment' && v.adjustmentAmount) {
        adjustment = { type: 'amount', amount: v.adjustmentAmount };
      } else if (v?.__typename === 'SellingPlanFixedPriceAdjustment' && v.price) {
        adjustment = { type: 'price', price: v.price };
      }
      sellingPlans.push({ id: sp.id, name: sp.name, groupName: g.name, adjustment });
    }
  }
  return {
    handle: p.handle,
    title: p.title,
    availableForSale: p.availableForSale,
    variant: p.variants.nodes[0] ?? null,
    sellingPlans,
  };
}

const TTL_MS = 5 * 60 * 1000;
const memory = new Map<string, { t: number; v: Product | null }>();
const inflight = new Map<string, Promise<Product | null>>();

function readSession(handle: string): { t: number; v: Product | null } | null {
  try {
    const raw = sessionStorage.getItem(`shopify:product:${handle}`);
    return raw ? (JSON.parse(raw) as { t: number; v: Product | null }) : null;
  } catch { return null; }
}
function writeSession(handle: string, entry: { t: number; v: Product | null }): void {
  try { sessionStorage.setItem(`shopify:product:${handle}`, JSON.stringify(entry)); } catch { /* ignore */ }
}

/** Resolves null when the handle does not exist. Throws ShopifyError on transport problems. */
export function getProduct(handle: string): Promise<Product | null> {
  const now = Date.now();
  const hit = memory.get(handle) ?? readSession(handle);
  if (hit && now - hit.t < TTL_MS) {
    memory.set(handle, hit);
    return Promise.resolve(hit.v);
  }
  const pending = inflight.get(handle);
  if (pending) return pending;
  const p = (async () => {
    let data: { product: RawProduct | null };
    try {
      data = await storefront<{ product: RawProduct | null }>(PRODUCT_QUERY, { handle });
    } catch (err) {
      // Token without the selling-plans scope: still show the product, just without plans.
      if (err instanceof ShopifyError && err.kind === 'graphql') {
        data = await storefront<{ product: RawProduct | null }>(PRODUCT_QUERY_NO_PLANS, { handle });
      } else throw err;
    }
    const v = data.product ? mapProduct(data.product) : null;
    const entry = { t: Date.now(), v };
    memory.set(handle, entry);
    writeSession(handle, entry);
    return v;
  })().finally(() => inflight.delete(handle));
  inflight.set(handle, p);
  return p;
}

export const firstSellingPlan = (p: Product): SellingPlan | null => p.sellingPlans[0] ?? null;

/** "Save 10%" style text, only when Shopify returned an adjustment. Otherwise null. */
export function describeSaving(plan: SellingPlan | null, variantPrice: Money | null): string | null {
  const adj = plan?.adjustment;
  if (!adj) return null;
  if (adj.type === 'percentage') return adj.percent > 0 ? `Save ${Math.round(adj.percent * 100) / 100}%` : null;
  if (adj.type === 'amount') return parseFloat(adj.amount.amount) > 0 ? `Save ${formatMoney(adj.amount.amount, adj.amount.currencyCode)}` : null;
  if (variantPrice) {
    const diff = parseFloat(variantPrice.amount) - parseFloat(adj.price.amount);
    return diff > 0 ? `Save ${formatMoney(diff, adj.price.currencyCode)}` : null;
  }
  return null;
}

/* ---------- cart ---------- */

export const CART_FRAGMENT = `
  fragment CartFields on Cart {
    id
    checkoutUrl
    totalQuantity
    cost { subtotalAmount { amount currencyCode } }
    lines(first: 20) {
      nodes {
        id
        quantity
        sellingPlanAllocation { sellingPlan { id name } }
        cost { totalAmount { amount currencyCode } }
        attributes { key value }
        merchandise {
          ... on ProductVariant {
            id
            title
            price { amount currencyCode }
            product { title handle }
          }
        }
      }
    }
  }
`;

export const CART_QUERY = `query Cart($id: ID!) { cart(id: $id) { ...CartFields } } ${CART_FRAGMENT}`;
export const CART_CREATE = `mutation CartCreate($input: CartInput!) { cartCreate(input: $input) { cart { ...CartFields } userErrors { field message } } } ${CART_FRAGMENT}`;
export const CART_LINES_ADD = `mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) { cartLinesAdd(cartId: $cartId, lines: $lines) { cart { ...CartFields } userErrors { field message } } } ${CART_FRAGMENT}`;
export const CART_LINES_UPDATE = `mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) { cartLinesUpdate(cartId: $cartId, lines: $lines) { cart { ...CartFields } userErrors { field message } } } ${CART_FRAGMENT}`;
export const CART_LINES_REMOVE = `mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) { cartLinesRemove(cartId: $cartId, lineIds: $lineIds) { cart { ...CartFields } userErrors { field message } } } ${CART_FRAGMENT}`;

type UserErrors = Array<{ field?: string[] | null; message: string }>;

/** Attribute attached to every preorder line. */
export function preorderLineAttributes(): Array<{ key: string; value: string }> {
  const ship = site.unknowns.shipDate;
  return [{ key: 'Preorder', value: ship.startsWith('[') ? 'Yes' : `Ships ${ship}` }];
}

export async function getCart(id: string): Promise<RawCart | null> {
  const d = await storefront<{ cart: RawCart | null }>(CART_QUERY, { id });
  return d.cart;
}

export async function cartCreate(lines: LineInput[]): Promise<RawCart> {
  const d = await storefront<{ cartCreate: { cart: RawCart | null; userErrors: UserErrors } }>(CART_CREATE, {
    input: { lines, attributes: [{ key: 'Order type', value: 'Preorder' }] },
  });
  assertNoUserErrors(d.cartCreate.userErrors);
  if (!d.cartCreate.cart) throw new ShopifyError('graphql', "The cart couldn't be created.");
  return d.cartCreate.cart;
}

/** Returns null when the cart no longer exists (caller should create a new one). */
export async function cartLinesAdd(cartId: string, lines: LineInput[]): Promise<RawCart | null> {
  const d = await storefront<{ cartLinesAdd: { cart: RawCart | null; userErrors: UserErrors } | null }>(CART_LINES_ADD, { cartId, lines });
  const r = d.cartLinesAdd;
  if (!r || !r.cart) return null;
  assertNoUserErrors(r.userErrors);
  return r.cart;
}

export async function cartLinesUpdate(cartId: string, lines: Array<{ id: string; quantity: number }>): Promise<RawCart> {
  const d = await storefront<{ cartLinesUpdate: { cart: RawCart | null; userErrors: UserErrors } }>(CART_LINES_UPDATE, { cartId, lines });
  assertNoUserErrors(d.cartLinesUpdate.userErrors);
  if (!d.cartLinesUpdate.cart) throw new ShopifyError('graphql', "The cart couldn't be updated.");
  return d.cartLinesUpdate.cart;
}

export async function cartLinesRemove(cartId: string, lineIds: string[]): Promise<RawCart> {
  const d = await storefront<{ cartLinesRemove: { cart: RawCart | null; userErrors: UserErrors } }>(CART_LINES_REMOVE, { cartId, lineIds });
  assertNoUserErrors(d.cartLinesRemove.userErrors);
  if (!d.cartLinesRemove.cart) throw new ShopifyError('graphql', "The cart couldn't be updated.");
  return d.cartLinesRemove.cart;
}
