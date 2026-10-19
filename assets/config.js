// Goat Bar smoke test: fill these in, then redeploy.
window.GB_CONFIG = {
  // Meta Pixel ID (Events Manager > Data sources). Leave "" to disable.
  META_PIXEL_ID: "",
  // Klaviyo PUBLIC site key (6 characters, Settings > API keys) of the Goat Bar Klaviyo account.
  KLAVIYO_PUBLIC_KEY: "S8uhri",
  // Klaviyo list ID for the waitlist (Lists & segments > list > settings).
  KLAVIYO_LIST_ID: "VhmwAY",
  // Optional Google Analytics 4 measurement ID (G-XXXXXXX). Leave "" to disable.
  GA4_ID: "",
  CURRENCY: "USD",
  FREE_SHIPPING_AT: 99,
  // Prices (copied from Lineage as placeholders). Subscribe & Save takes 10% off.
  PRICES: { 12: 49, 24: 94, 48: 184 },
  WAS: { 12: null, 24: 98, 48: 196 },
  SUB_DISCOUNT: 0.10,
  // Checkout shipping methods (PLACEHOLDER rates: set your real ones). Standard is free at FREE_SHIPPING_AT.
  SHIPPING: [
    { id: "standard", name: "Standard", eta: "3 to 5 business days", price: 6.95, freeOver: true },
    { id: "express", name: "Express", eta: "1 to 2 business days", price: 14.95 }
  ]
};
