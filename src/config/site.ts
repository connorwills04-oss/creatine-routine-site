/**
 * SINGLE SOURCE OF TRUTH for brand, nav, formulas and unknown facts.
 * - The brand name lives ONLY in `brand.name`. Never hardcode it elsewhere.
 * - Every "[bracketed]" string is an unknown. Do not invent values; render with <Tbd>.
 */
export const site = {
  brand: {
    name: 'Bookend',
    descriptor: 'the creatine routine',
  },
  /** Pre-launch: emits <meta name="robots" content="noindex, nofollow">. Set false at launch. */
  noindex: true,
  /** Home is the wordmark, so it is not listed here. */
  nav: [
    { label: 'Starter kit', href: '/product/' },
    { label: 'Science', href: '/science/' },
    { label: 'About', href: '/about/' },
    { label: 'FAQ', href: '/faq/' },
  ],
  tagline: 'Sharper days. Deeper nights.',
  fdaDisclaimer:
    'These statements have not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure, or prevent any disease.',
  formulas: {
    am: {
      name: 'AM',
      label: 'Morning stick',
      ingredients: [
        { name: 'Creatine monohydrate', dose: '3 g' },
        { name: 'L-theanine', dose: '200 mg' },
      ],
      flavor: '[AM flavor]',
    },
    pm: {
      name: 'PM',
      label: 'Evening stick',
      ingredients: [
        { name: 'Creatine monohydrate', dose: '3 g' },
        { name: 'Magnesium bisglycinate', dose: '200 mg elemental magnesium' },
      ],
      flavor: '[PM flavor]',
    },
  },
  legal: {
    name: 'Prooformance LLC (Idaho)',
    email: 'connor@prooformance.com',
  },
  unknowns: {
    shipDate: '[ship date]',
    labPartner: '[lab partner]',
    shippingRegions: '[shipping regions]',
    returnPolicy: '[return policy]',
    sticksPerPack: '[sticks per pack]',
    packagingColors: '[packaging colors]',
    chargeTiming: '[charge timing]',
    skipCancel: '[skip and cancel terms]',
    tested: '[what is tested]',
  },
  shopify: {
    storeDomain: import.meta.env.PUBLIC_SHOPIFY_STORE_DOMAIN ?? '',
    storefrontToken: import.meta.env.PUBLIC_SHOPIFY_STOREFRONT_TOKEN ?? '',
    apiVersion: '2025-01',
    handles: { kit: 'starter-kit', refill: 'refill' },
  },
} as const;

/** Public sales switch. False until preorders open. The site does not take payment while this is false. */
export const preordersOpen: boolean = false;

export type Formula = (typeof site.formulas)['am' | 'pm'];

/** True once both PUBLIC_SHOPIFY_* env vars are set. The cart agent should check this. */
export const shopifyConfigured: boolean = Boolean(
  site.shopify.storeDomain && site.shopify.storefrontToken,
);
