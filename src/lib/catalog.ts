// Demo shop items. Prices are picked to exercise different rules:
// the lamp is pricey enough that a severe grade crosses the auto-approve limit.

export interface Product {
  sku: string;
  name: string;
  blurb: string;
  priceCents: number;
  currency: string;
}

export const PRODUCTS: Product[] = [
  { sku: "mug-set", name: "Stoneware mug set (4)", blurb: "Hand-glazed, 350 ml each.", priceCents: 4000, currency: "USD" },
  { sku: "pour-over", name: "Glass pour-over kettle", blurb: "Borosilicate, 1 L, gooseneck spout.", priceCents: 6500, currency: "USD" },
  { sku: "table-lamp", name: "Ceramic table lamp", blurb: "Matte white base, linen shade.", priceCents: 18000, currency: "USD" },
];

export const findProduct = (sku: string) => PRODUCTS.find((p) => p.sku === sku);

export function formatCents(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}
