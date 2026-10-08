// The shop's cart on every page: product cards, the HUD cart button, the cart drawer (review → pay by UPI),
// tiered offers, codes and bundle swaps. Prices follow the same rules as lib/pricing.js (the server re-checks).
(() => {
  const { $, h, asset, rupees, toast, reduce, paidForm, upiLink, qrSvg, loadQr, CAT } = window.CO;
  const PRODUCTS = CAT.products || [];
  const BY = new Map(PRODUCTS.map((p) => [p.sku, p]));
  const OFFERS = CAT.offers || {};
  const THEMES = CAT.themes || {};
  const UPI_ID = CAT.upiId || '';

  // ---------- pricing (mirror of lib/pricing.js) ----------
  function quote(skus, code) {
    let items = [...new Set(skus)].filter((s) => BY.has(s)).map((s) => BY.get(s));
    const covered = new Set(items.filter((p) => p.includes).flatMap((p) => p.includes));
    const dropped = items.filter((p) => covered.has(p.sku));
    items = items.filter((p) => !covered.has(p.sku));
    const subtotal = items.reduce((t, p) => t + p.price, 0);
    const singles = items.filter((p) => !p.includes);
    const tiers = (OFFERS.tiers || []).slice().sort((a, b) => a.min - b.min);
    const tier = tiers.filter((t) => singles.length >= t.min).sort((a, b) => b.off - a.off)[0] || null;
    const next = tiers.find((t) => singles.length < t.min) || null;
    const tierOff = tier ? Math.round((singles.reduce((t, p) => t + p.price, 0) * tier.off) / 100) : 0;
    const key = String(code || '').trim().toUpperCase(), c = key ? (OFFERS.codes || {})[key] : null;
    const codeOk = !!c && (!c.until || new Date() <= new Date(c.until + 'T23:59:59+05:30')) && subtotal - tierOff >= (c.min || 0);
    const codeOff = codeOk ? Math.round(((subtotal - tierOff) * c.off) / 100) : 0;
    const total = Math.max(items.length ? 1 : 0, subtotal - tierOff - codeOff);
    return { items, dropped, singles, subtotal, tier, next, tierOff, code: codeOk ? key : '', codeTried: key, codeInfo: c, codeOff, total };
  }

  // ---------- cart store (this device only) ----------
  const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (err) { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (err) {} };
  let cart = load('co-cart', []).filter((s) => BY.has(s));
  let code = load('co-code', '');
  const has = (sku) => cart.includes(sku);
  function setCart(next) {
    cart = [...new Set(next)].filter((s) => BY.has(s)); save('co-cart', cart);
    document.dispatchEvent(new CustomEvent('co-cart', { detail: cart }));
  }
  const add = (sku) => { if (!has(sku)) setCart([...cart, sku]); };
  const remove = (sku) => setCart(cart.filter((s) => s !== sku));
  const ready = (p) => !!UPI_ID && p.fileCount > 0;
  const pct = (p) => (p.compareAt ? Math.round((1 - p.price / p.compareAt) * 100) : 0);

  // ---------- product card ----------
  function productCard(p) {
    const btn = h('button', { class: 'btn add-btn', type: 'button', 'data-cursor': 'Add' });
    const sync = () => {
      const inCart = has(p.sku);
      btn.className = `btn add-btn${inCart ? ' btn-ghost in' : ''}`;
      btn.textContent = !ready(p) ? 'Coming soon' : inCart ? 'In cart · view' : 'Add to cart';
      btn.disabled = !ready(p);
    };
    sync();
    btn.addEventListener('click', () => { if (has(p.sku)) openCart(); else { add(p.sku); fly(btn); } });
    document.addEventListener('co-cart', sync);
    const shots = (p.shots || []).slice(0, 2);
    const shot = shots.length
      ? h('div', { class: 'shot' }, shots.map((src) => h('img', { src: asset(src), alt: '', loading: 'lazy', decoding: 'async' })))
      : h('div', { class: 'shot shot-type' }, h('span', { class: 'label', text: p.includes ? 'Bundle' : p.category }), h('strong', { text: p.name }));
    if (p.compareAt) shot.append(h('span', { class: 'save-badge', text: `Save ${pct(p)}%` }));
    const meta = [p.includes ? 'Bundle' : THEMES[p.theme], p.unit].filter(Boolean).join(' · ');
    return h('li', { class: `product${p.includes ? ' is-bundle' : ''}`, id: p.sku, 'data-sku': p.sku },
      shot,
      h('div', { class: 'body' },
        h('p', { class: 'p-meta', text: meta }),
        h('h3', { text: p.name }), h('p', { text: p.text }),
        h('div', { class: 'row' },
          h('span', { class: 'price' }, rupees(p.price), p.compareAt ? h('s', { text: rupees(p.compareAt) }) : null),
          btn)));
  }
  // Home: featured only. Shop page builds its own filtered grid (shop.js).
  function renderShop(listEl) {
    if (!listEl || listEl.hasAttribute('data-all')) return;
    const list = PRODUCTS.filter((p) => p.featured).slice(0, 6);
    (list.length ? list : PRODUCTS.slice(0, 6)).forEach((p) => listEl.append(productCard(p)));
    if (PRODUCTS.length > list.length) listEl.after(h('p', { class: 'shop-more' },
      h('a', { class: 'cta', href: asset('shop.html'), 'data-cursor': 'Shop' }, h('span', { text: `See all ${PRODUCTS.length} products` }), h('i', { 'aria-hidden': 'true', text: '→' }))));
  }

  // ---------- an ember dot flies from the button into the cart ----------
  function fly(from) {
    const to = cartBtn && !cartBtn.hidden ? cartBtn : null;
    bumpCount();
    if (!to || reduce || !from.animate) { toast('Added to your cart.'); return; }
    const a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
    const x0 = a.left + a.width / 2, y0 = a.top + a.height / 2, x1 = b.left + b.width / 2, y1 = b.top + b.height / 2;
    const dot = h('i', { class: 'fly-dot', 'aria-hidden': 'true' }); document.body.append(dot);
    const lift = Math.min(y0, y1) - 120;
    dot.animate([
      { transform: `translate(${x0}px, ${y0}px) scale(.4)` },
      { transform: `translate(${(x0 + x1) / 2}px, ${lift}px) scale(1.2)`, offset: 0.45 },
      { transform: `translate(${x1}px, ${y1}px) scale(.5)` },
    ], { duration: 720, easing: 'cubic-bezier(.5,0,.3,1)' }).onfinish = () => { dot.remove(); to.classList.remove('got'); to.offsetWidth; to.classList.add('got'); };
  }

  // ---------- HUD cart button ----------
  let cartBtn = $('#cart-btn');
  const countEl = () => cartBtn && cartBtn.querySelector('b');
  function bumpCount() {
    if (!cartBtn) return;
    cartBtn.hidden = cart.length === 0;
    const c = countEl(); if (c) c.textContent = String(cart.length);
  }
  if (cartBtn) { bumpCount(); cartBtn.addEventListener('click', () => openCart()); document.addEventListener('co-cart', bumpCount); }

  // ---------- cart drawer: review, then pay ----------
  let dlg, step = 'cart';
  function openCart(atPay) {
    step = atPay ? 'pay' : 'cart';
    if (!dlg) {
      dlg = h('dialog', { class: 'viewer tipjar cart-dlg', 'aria-labelledby': 'cart-title' });
      dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
      document.addEventListener('co-cart', () => { if (dlg.open && step === 'cart') render(); });
      document.body.append(dlg);
    }
    render();
    if (!dlg.open) dlg.showModal();
    if (window.CO.lenis) window.CO.lenis.stop();
    dlg.addEventListener('close', () => window.CO.lenis && window.CO.lenis.start(), { once: true });
  }
  const close = () => h('button', { class: 'close', type: 'button', 'aria-label': 'Close', text: '×', onclick: () => dlg.close() });

  function render() {
    const q = quote(cart, code);
    if (step === 'pay' && q.items.length) return renderPay(q);
    step = 'cart';
    if (!q.items.length) {
      dlg.replaceChildren(h('div', { class: 'tip-inner cart-inner' }, h('div', { class: 'tip-text' },
        h('p', { class: 'label', text: 'Your cart' }), h('h3', { id: 'cart-title', text: 'Nothing here yet.' }),
        h('p', { text: 'Pick a quiz pack, a poster or a bundle. Mix any 3 single items and you save straight away.' }),
        h('a', { class: 'btn', href: asset('shop.html'), text: 'Browse the shop' }))), close());
      return;
    }
    const lines = h('ul', { class: 'cart-lines' }, q.items.map((p) => h('li', { class: 'cart-line' },
      p.shots && p.shots[0] ? h('img', { src: asset(p.shots[0]), alt: '', class: 'cart-thumb' }) : h('span', { class: 'cart-thumb cart-thumb-type', 'aria-hidden': 'true' }),
      h('span', { class: 'cart-name' }, h('b', { text: p.name }), h('small', { text: p.includes ? `Bundle · ${p.includes.length} products` : [THEMES[p.theme], p.unit].filter(Boolean).join(' · ') })),
      h('span', { class: 'cart-price', text: rupees(p.price) }),
      h('button', { class: 'cart-x', type: 'button', 'aria-label': `Remove ${p.name}`, text: '×', onclick: (e) => {
        const li = e.currentTarget.closest('li');
        const go = () => remove(p.sku);
        if (reduce || !li.animate) go(); else li.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(24px)' }], { duration: 240, easing: 'ease-in' }).onfinish = go;
      } }))));
    const notes = [];
    if (q.dropped.length) notes.push(h('p', { class: 'cart-note', text: `${q.dropped.map((p) => p.name).join(', ')} ${q.dropped.length > 1 ? 'are' : 'is'} already in your bundle, so we left ${q.dropped.length > 1 ? 'them' : 'it'} out.` }));
    // tier progress
    const tiers = (OFFERS.tiers || []).slice().sort((a, b) => a.min - b.min);
    if (tiers.length) {
      const top = tiers[tiers.length - 1], n = q.singles.length;
      const msg = q.next ? `Add ${q.next.min - n} more single item${q.next.min - n > 1 ? 's' : ''} for ${q.next.off}% off${q.tier ? ` (now ${q.tier.off}%)` : ''}.`
        : `${q.tier.off}% off unlocked. Nice.`;
      notes.push(h('div', { class: 'tier' }, h('p', { class: 'tier-msg', text: msg }),
        h('div', { class: 'tier-bar', style: `--p:${Math.min(1, n / top.min)}` }, h('i'), tiers.map((t) => h('span', { class: `tier-stop${n >= t.min ? ' on' : ''}`, style: `--at:${t.min / top.min}`, text: `${t.off}%` })))));
    }
    // a bundle that beats what's in the cart
    const swap = bestSwap(q);
    if (swap) notes.push(h('div', { class: 'swap-deal' },
      h('p', {}, h('b', { text: `Swap ${swap.overlap.length} items for the ${swap.b.name}` }), ` and get ${swap.b.includes.length} products for ${rupees(swap.b.price)}.`),
      h('button', { class: 'btn btn-small', type: 'button', text: 'Swap', onclick: () => setCart([...cart.filter((s) => !swap.overlap.includes(s)), swap.b.sku]) })));
    // code
    const codeIn = h('input', { name: 'code', value: code, placeholder: 'Offer code', autocomplete: 'off', autocapitalize: 'characters', maxlength: 20, 'aria-label': 'Offer code' });
    const codeMsg = q.code ? `${q.code} applied: ${q.codeInfo.off}% off.` : q.codeTried ? (q.codeInfo && q.codeInfo.min ? `${q.codeTried} needs an order of ${rupees(q.codeInfo.min)} or more.` : `${q.codeTried} isn't a valid code.`) : '';
    const codeForm = h('form', { class: 'code-form', onsubmit: (e) => { e.preventDefault(); code = codeIn.value.trim().toUpperCase(); save('co-code', code); render(); } },
      codeIn, h('button', { class: 'btn btn-ghost btn-small', type: 'submit', text: 'Apply' }),
      codeMsg && h('p', { class: `code-msg${q.code ? ' good' : ''}`, text: codeMsg }));
    const row = (k, v, cls) => h('div', { class: cls || '' }, h('dt', { text: k }), h('dd', { text: v }));
    const totals = h('dl', { class: 'totals' }, row('Subtotal', rupees(q.subtotal)),
      q.tierOff > 0 ? row(`${q.tier.off}% off ${q.singles.length} items`, `−${rupees(q.tierOff)}`, 'off') : null,
      q.codeOff > 0 ? row(`Code ${q.code}`, `−${rupees(q.codeOff)}`, 'off') : null,
      row('Total', rupees(q.total), 'grand'));
    dlg.replaceChildren(h('div', { class: 'tip-inner cart-inner' }, h('div', { class: 'tip-text' },
      h('p', { class: 'label', text: `Your cart · ${q.items.length} item${q.items.length > 1 ? 's' : ''}` }),
      h('h3', { id: 'cart-title' }, 'Your ', h('span', { class: 'ember', text: 'cart.' })),
      lines, ...notes, codeForm, totals,
      h('button', { class: 'btn pay-btn', type: 'button', text: `Pay ${rupees(q.total)} by UPI`, onclick: () => { step = 'pay'; render(); } }),
      h('p', { class: 'tip-note', text: 'Instant download link once we confirm your UPI payment. Every fact checked against a source.' }))), close());
  }

  function bestSwap(q) {
    const singles = q.singles.map((p) => p.sku);
    let best = null;
    PRODUCTS.filter((b) => b.includes && !cart.includes(b.sku)).forEach((b) => {
      const overlap = singles.filter((s) => b.includes.includes(s));
      const worth = overlap.reduce((t, s) => t + BY.get(s).price, 0);
      // worth it when the bundle costs no more than ~130% of what they already picked from it
      if (overlap.length >= 2 && b.price <= worth * 1.3 && (!best || b.includes.length - overlap.length > best.b.includes.length - best.overlap.length)) best = { b, overlap };
    });
    return best;
  }

  function renderPay(q) {
    const names = q.items.map((p) => p.name);
    const note = `Curious Orbit ${names.length === 1 ? names[0] : `${names.length} items`}`.slice(0, 50);
    const link = upiLink(q.total, note);
    const qr = h('div', { class: 'tip-qr' });
    loadQr().then(() => { qr.innerHTML = qrSvg(link); }).catch(() => qr.remove());
    const copy = h('button', { class: 'btn btn-ghost btn-small', type: 'button', text: 'Copy UPI ID', onclick: async () => {
      try { await navigator.clipboard.writeText(UPI_ID); copy.textContent = 'Copied'; } catch (err) { copy.textContent = 'Select and copy it'; }
      setTimeout(() => { copy.textContent = 'Copy UPI ID'; }, 2000);
    } });
    dlg.replaceChildren(h('div', { class: 'tip-inner' },
      h('div', { class: 'tip-text' },
        h('button', { class: 'back-link', type: 'button', text: '← Back to cart', onclick: () => { step = 'cart'; render(); } }),
        h('p', { class: 'label', text: `Checkout · ${q.items.length} item${q.items.length > 1 ? 's' : ''}` }),
        h('h3', { id: 'cart-title', text: names.length === 1 ? names[0] : `${names.length} products` }),
        h('p', { class: 'co-price' }, h('b', { text: rupees(q.total) }), h('span', { text: q.subtotal > q.total ? ` instead of ${rupees(q.subtotal)}, by UPI` : ' by UPI' })),
        h('p', { class: 'co-step', text: '1. Pay the exact amount' }),
        h('a', { class: 'btn', href: link, text: `Pay ${rupees(q.total)} with a UPI app` }),
        h('p', { class: 'tip-id' }, h('span', { text: 'UPI ID ' }), h('code', { text: UPI_ID }), copy),
        h('p', { class: 'tip-note', text: 'On a computer? Scan the code with your phone. Any UPI app works: GPay, PhonePe, Paytm, BHIM.' }),
        h('p', { class: 'co-step', text: '2. Tell us you paid' }),
        h('p', { class: 'tip-note', text: 'Find the 12-digit UPI reference (UTR or UPI Ref No.) in your app under this payment.' }),
        paidForm({ kind: 'order', items: q.items.map((p) => p.sku), code: q.code, amount: q.total, button: 'I have paid, unlock my order',
          done: (r) => { setCart([]); return `Saved as ${r.id}. Taking you to your order page…`; } })),
      qr), close());
  }

  // Buy one thing straight away (used by old links and "Buy" buttons)
  function checkout(p) { add(p.sku); openCart(true); }

  Object.assign(window.CO, { quote, productCard, renderShop, openCart, checkout, cart: { get: () => cart.slice(), add, remove, set: setCart, has }, THEMES, OFFERS, PRODUCTS });
})();
