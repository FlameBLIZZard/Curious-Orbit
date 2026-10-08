// Works out what a cart costs. The browser runs the same rules (public/js/common.js quote()) so the buyer sees the
// exact amount to pay; the server recomputes and refuses the order if the two disagree.
//  - a bundle in the cart swallows any items it already includes
//  - tier discount on single items only (bundles are discounted already): highest tier whose `min` is reached
//  - one code per order, applied to what's left after the tier discount
export function quote(catalog, skus, code) {
  const bySku = new Map(catalog.products.map((p) => [p.sku, p]));
  let items = [...new Set((skus || []).map(String))].filter((s) => bySku.has(s)).map((s) => bySku.get(s));
  const covered = new Set(items.filter((p) => p.includes).flatMap((p) => p.includes));
  items = items.filter((p) => !covered.has(p.sku));
  const subtotal = items.reduce((t, p) => t + p.price, 0);
  const singles = items.filter((p) => !p.includes);
  const offers = catalog.offers || {};
  const tier = (offers.tiers || []).filter((t) => singles.length >= t.min).sort((a, b) => b.off - a.off)[0] || null;
  const tierOff = tier ? Math.round((singles.reduce((t, p) => t + p.price, 0) * tier.off) / 100) : 0;
  const c = code ? (offers.codes || {})[String(code).trim().toUpperCase()] : null;
  const codeOk = !!c && (!c.until || new Date() <= new Date(c.until + 'T23:59:59+05:30')) && subtotal - tierOff >= (c.min || 0);
  const codeOff = codeOk ? Math.round(((subtotal - tierOff) * c.off) / 100) : 0;
  const total = Math.max(items.length ? 1 : 0, subtotal - tierOff - codeOff);
  return { items: items.map((p) => p.sku), subtotal, tier, tierOff, code: codeOk ? String(code).trim().toUpperCase() : '', codeOff, total };
}
