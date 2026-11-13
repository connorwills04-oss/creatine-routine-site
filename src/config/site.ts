/**
 * SINGLE SOURCE OF TRUTH for brand, nav, formulas and unknown facts.
 * - The brand name lives ONLY in `brand.name`. Never hardcode it elsewhere.
 * - Every "[bracketed]" string is an unknown. Do not invent values; render with <Tbd>.
 */
export const site = {
  brand: {
    name: '[brand]',
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
  formulas: {
    am: {
      name: 'AM',
      label: 'Morning stick',
      ingredients: [
        { name: 'Creatine', dose: '[creatine dose]' },
        { name: 'Caffeine', dose: '[caffeine dose]' },
        { name: 'L-theanine', dose: '[L-theanine dose]' },
      ],
      flavor: '[AM flavor]',
    },
    pm: {
      name: 'PM',
      label: 'Evening stick',
      ingredients: [
        { name: 'Creatine', dose: '[creatine dose]' },
        { name: 'Magnesium', dose: '[magnesium form and dose]' },
      ],
      flavor: '[PM flavor]',
    },
  },
  unknowns: {
    shipDate: '[ship date]',
    supportEmail: '[support email]',
    legalEntity: '[legal entity]',
    labPartner: '[lab partner]',
    shippingRegions: '[shipping regions]',
    returnPolicy: '[return policy]',
  },
  shopify: {
    storeDomain: import.meta.env.PUBLIC_SHOPIFY_STORE_DOMAIN ?? '',
    storefrontToken: import.meta.env.PUBLIC_SHOPIFY_STOREFRONT_TOKEN ?? '',
    apiVersion: '2025-01',
    handles: { kit: 'starter-kit', refill: 'refill' },
  },
} as const;

export type Formula = (typeof site.formulas)['am' | 'pm'];

/** True once both PUBLIC_SHOPIFY_* env vars are set. The cart agent should check this. */
export const shopifyConfigured: boolean = Boolean(
  site.shopify.storeDomain && site.shopify.storefrontToken,
);
