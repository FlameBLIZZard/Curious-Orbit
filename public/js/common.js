// Shared by every page: helpers, the Motion Reel Kit spring runner, star field, media players,
// email signup, shop cards, sponsor/tip wiring and demo mode. Exposes window.CO.
(() => {
  const M = window.Motion;
  const CFG = window.CO_CONFIG || { shop: {} };
  const IG = CFG.instagram || 'https://www.instagram.com/curiousorbit.daily/';
  const base = document.documentElement.dataset.base || '';   // '../' on pages one folder down
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, el = document) => el.querySelector(s);
  const h = (tag, attrs = {}, ...kids) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v; else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v); else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid);
    return el;
  };
  const pad = (n) => String(n).padStart(2, '0');
  const asset = (p) => base + p;

  // ---------- tiny spring runner ----------
  // run(fn, seconds): calls fn(t) every frame for `seconds`, then once more at the end state.
  function run(fn, seconds) {
    if (reduce) { fn(1e3); return; }
    const t0 = performance.now();
    const frame = (now) => {
      const t = (now - t0) / 1000;
      fn(t);
      if (t < seconds) requestAnimationFrame(frame); else fn(1e3);
    };
    requestAnimationFrame(frame);
  }
  const onceVisible = (el, fn) => {
    if (!el || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting)) { io.disconnect(); fn(); }
    }, { threshold: 0.35 });
    io.observe(el);
  };

  // ---------- star scatter ----------
  const stars = $('#stars');
  function drawStars() {
    if (!stars) return;
    const dpr = Math.min(devicePixelRatio || 1, 2), w = innerWidth, hgt = innerHeight;
    stars.width = w * dpr; stars.height = hgt * dpr;
    const c = stars.getContext('2d'); c.scale(dpr, dpr);
    let s = 7; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const n = Math.round((w * hgt) / 9000);
    for (let i = 0; i < n; i++) {
      c.globalAlpha = 0.12 + rnd() * 0.35;
      c.fillStyle = '#F3EEE4';
      c.beginPath(); c.arc(rnd() * w, rnd() * hgt, rnd() < 0.9 ? 0.7 : 1.3, 0, Math.PI * 2); c.fill();
    }
  }
  drawStars();
  let rs; addEventListener('resize', () => { clearTimeout(rs); rs = setTimeout(drawStars, 150); });

  // ---------- toast (demo notices, copy confirmations) ----------
  let toastEl, toastTimer;
  function toast(text) {
    if (!toastEl) { toastEl = h('div', { class: 'toast', role: 'status', 'aria-live': 'polite' }); document.body.append(toastEl); }
    toastEl.textContent = text; toastEl.classList.add('on');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toastEl.classList.remove('on'), 3200);
  }
  const DEMO_NOTE = 'Demo: payments switch on once the shop is connected.';

  // ---------- media ----------
  function reel(d, { autoplay = true, withSound = false } = {}) {
    const v = h('video', { src: asset(d.video), poster: asset(d.poster), playsinline: true, loop: true, preload: autoplay ? 'auto' : 'metadata',
      'aria-label': `Fact ${d.n} reel: ${d.title}` });
    v.muted = !withSound;
    if (withSound) v.controls = true;
    const frame = h('div', { class: 'frame reel' }, v);
    if (!withSound) {
      const b = h('button', { class: 'sound', type: 'button', 'aria-pressed': 'false', text: 'Tap for sound' });
      b.addEventListener('click', () => {
        v.muted = !v.muted; b.setAttribute('aria-pressed', String(!v.muted)); b.textContent = v.muted ? 'Tap for sound' : 'Sound on';
        if (!v.muted) { v.currentTime = 0; v.play().catch(() => {}); }
      });
      frame.append(b);
    }
    if (autoplay && 'IntersectionObserver' in window && !reduce) {
      new IntersectionObserver((es) => es.forEach((e) => (e.isIntersecting ? v.play().catch(() => {}) : v.pause())), { threshold: 0.3 }).observe(frame);
    }
    return frame;
  }
  function carousel(d) {
    const imgs = d.images.map((src, i) => h('img', { src: asset(src), alt: `Fact ${d.n}, slide ${i + 1} of ${d.images.length}`, loading: i ? 'lazy' : 'eager', draggable: 'false' }));
    const track = h('div', { class: 'track', tabindex: '0', 'aria-label': `Fact ${d.n} carousel, swipe for more` }, imgs);
    const dots = h('div', { class: 'dots', 'aria-hidden': 'true' }, imgs.map(() => h('i')));
    const prev = h('button', { class: 'arrow prev', type: 'button', 'aria-label': 'Previous slide', text: '←' });
    const nxt = h('button', { class: 'arrow next', type: 'button', 'aria-label': 'Next slide', text: '→' });
    const idx = () => (track.clientWidth ? Math.round(track.scrollLeft / track.clientWidth) : 0);
    const sync = () => {
      const i = Math.max(0, Math.min(imgs.length - 1, idx() || 0));
      [...dots.children].forEach((el, j) => el.classList.toggle('on', j === i));
      prev.disabled = i === 0; nxt.disabled = i === imgs.length - 1;
    };
    const go = (dir) => track.scrollTo({ left: (idx() + dir) * track.clientWidth, behavior: reduce ? 'auto' : 'smooth' });
    prev.addEventListener('click', () => go(-1)); nxt.addEventListener('click', () => go(1));
    track.addEventListener('scroll', () => requestAnimationFrame(sync), { passive: true });
    track.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') go(1); if (e.key === 'ArrowLeft') go(-1); });
    sync();
    return h('div', { class: 'frame carousel' }, track, prev, nxt, dots);
  }
  const post = (d) => h('div', { class: 'frame post' }, h('img', { src: asset(d.images[0]), alt: `Fact ${d.n} post: ${d.title}` }));
  const media = (d, opts) => (d.format === 'reel' ? reel(d, opts) : d.format === 'carousel' ? carousel(d) : post(d));

  // ---------- email list ----------
  // Posts to /api/subscribe (Vercel function -> beehiiv) once CFG.newsletterLive is true.
  function wireForm(form) {
    const input = form.querySelector('input'), btn = form.querySelector('button'), msg = form.querySelector('.form-msg');
    const say = (text, kind) => { msg.textContent = text; msg.className = 'form-msg' + (kind ? ' ' + kind : ''); };
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = input.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { say('That email address does not look right. Check it and try again.', 'err'); input.focus(); return; }
      if (!CFG.newsletterLive) {
        say(CFG.demo ? 'Demo: signups switch on once the newsletter is connected. Nothing was sent.'
                     : 'Email signups open in a few days. Follow on Instagram so you hear first.', 'err');
        return;
      }
      btn.disabled = true; say('Adding you...');
      try {
        const r = await fetch('/api/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, source: form.dataset.source }) });
        const j = await r.json().catch(() => ({}));
        if (r.ok) { say(form.dataset.done || "You're in. Check your inbox to confirm.", 'ok'); input.value = ''; }
        else say(j.error || 'That did not go through. Try again in a minute.', 'err');
      } catch (err) { say('No connection. Try again in a minute.', 'err'); }
      btn.disabled = false;
    });
  }
  const signupForm = (source, { label = 'Get the daily fact', note = 'Free. One fact in your inbox every morning. Unsubscribe any time.' } = {}) => {
    const id = `email-${source}`;
    const f = h('form', { class: 'signup', 'data-source': source, novalidate: true },
      h('label', { class: 'sr', for: id, text: 'Email address' }),
      h('input', { id, name: 'email', type: 'email', autocomplete: 'email', placeholder: 'you@email.com', required: true }),
      h('button', { class: 'btn', type: 'submit', text: label }),
      h('p', { class: 'form-msg', 'aria-live': 'polite', text: note }));
    wireForm(f); return f;
  };

  // A link that may still be a dummy: in demo mode it shows a notice instead of leaving the page.
  function moneyLink(el, url) {
    if (url) el.href = url;
    if (CFG.demo || !url) el.addEventListener('click', (e) => { e.preventDefault(); toast(DEMO_NOTE); });
    return el;
  }

  // ---------- shop (catalog from js/catalog.js, generated from lib/catalog.json) ----------
  const CAT = window.CO_CATALOG || { products: [] };
  const UPI_ID = CAT.upiId || (CFG.upi && CFG.upi.id) || '';
  const rupees = (n) => `₹${Number(n).toLocaleString('en-IN')}`;
  const PRODUCTS = CAT.products;
  const ready = (p) => !!UPI_ID && p.fileCount > 0;
  function productCard(p) {
    const buy = h('button', { class: 'btn', type: 'button', text: ready(p) ? `Buy for ${rupees(p.price)}` : 'Coming soon', 'data-cursor': 'Buy' });
    if (ready(p)) buy.addEventListener('click', () => checkout(p)); else buy.disabled = true;
    const shots = (p.shots || []).slice(0, 2);
    const shot = shots.length
      ? h('div', { class: 'shot' }, shots.map((src) => h('img', { src: asset(src), alt: '', loading: 'lazy' })))
      : h('div', { class: 'shot shot-type' }, h('span', { class: 'label', text: p.unit }), h('strong', { text: p.name }));
    return h('li', { class: 'product', id: p.sku },
      shot,
      h('div', { class: 'body' },
        h('h3', { text: p.name }), h('p', { text: p.text }),
        h('div', { class: 'row' }, h('span', { class: 'price' }, rupees(p.price), h('small', { text: p.unit })), buy)));
  }
  function renderShop(listEl) {
    if (!listEl) return;
    const all = listEl.hasAttribute('data-all');
    const list = all ? PRODUCTS : PRODUCTS.filter((p) => p.featured);
    list.forEach((p) => listEl.append(productCard(p)));
    if (!all && PRODUCTS.length > list.length) listEl.after(h('p', { class: 'shop-more' },
      h('a', { class: 'cta', href: asset('shop.html'), 'data-cursor': 'Shop' }, h('span', { text: `See all ${PRODUCTS.length} products` }), h('i', { 'aria-hidden': 'true', text: '→' }))));
  }

  // ---------- checkout: pay by UPI, then send the reference ----------
  let coEl;
  function checkout(p) {
    if (coEl) coEl.remove();
    const link = upiLink(p.price, `Curious Orbit ${p.name}`.slice(0, 50));
    const qr = h('div', { class: 'tip-qr' });
    loadQr().then(() => { qr.innerHTML = qrSvg(link); }).catch(() => qr.remove());
    const copy = h('button', { class: 'btn btn-ghost btn-small', type: 'button', text: 'Copy UPI ID', onclick: async () => {
      try { await navigator.clipboard.writeText(UPI_ID); copy.textContent = 'Copied'; } catch (err) { copy.textContent = 'Select and copy it'; }
      setTimeout(() => { copy.textContent = 'Copy UPI ID'; }, 2000);
    } });
    coEl = h('dialog', { class: 'viewer tipjar checkout', 'aria-labelledby': 'co-title' },
      h('div', { class: 'tip-inner' },
        h('div', { class: 'tip-text' },
          h('p', { class: 'label', text: `Checkout · ${p.unit}` }),
          h('h3', { id: 'co-title', text: p.name }),
          h('p', { class: 'co-price' }, h('b', { text: rupees(p.price) }), h('span', { text: ' by UPI' })),
          h('p', { class: 'co-step', text: '1. Pay the exact amount' }),
          h('a', { class: 'btn', href: link, text: `Pay ${rupees(p.price)} with a UPI app` }),
          h('p', { class: 'tip-id' }, h('span', { text: 'UPI ID ' }), h('code', { text: UPI_ID }), copy),
          h('p', { class: 'tip-note', text: 'On a computer? Scan the code with your phone. Any UPI app works: GPay, PhonePe, Paytm, BHIM.' }),
          h('p', { class: 'co-step', text: '2. Tell us you paid' }),
          h('p', { class: 'tip-note', text: 'Find the 12-digit UPI reference (UTR or UPI Ref No.) in your app under this payment.' }),
          paidForm({ kind: 'order', sku: p.sku, amount: p.price, button: 'I have paid, unlock my order',
            done: (r) => `Saved as ${r.id}. Taking you to your order page…` })),
        qr),
      h('button', { class: 'close', type: 'button', 'aria-label': 'Close', text: '×', onclick: () => coEl.close() }));
    coEl.addEventListener('click', (e) => { if (e.target === coEl) coEl.close(); });
    document.body.append(coEl); coEl.showModal();
  }

  // ---------- "I've paid" form: name, email, UPI reference -> /api/order ----------
  function paidForm({ kind, sku, amount, button, done }) {
    const uid = `${kind}-${sku || 'tip'}`;
    const field = (name, label, attrs) => h('label', { class: 'pf-field' }, h('span', { text: label }), h('input', { name, id: `${uid}-${name}`, required: true, ...attrs }));
    const msg = h('p', { class: 'form-msg', 'aria-live': 'polite' });
    const f = h('form', { class: 'paid-form', novalidate: true },
      field('name', 'Your name', { autocomplete: 'name', maxlength: 80 }),
      field('email', 'Email', { type: 'email', autocomplete: 'email', maxlength: 120 }),
      field('utr', 'UPI reference (12 digits)', { inputmode: 'numeric', pattern: '[0-9 ]{12,14}', maxlength: 14, placeholder: 'e.g. 428915736201' }),
      h('button', { class: 'btn', type: 'submit', text: button }), msg);
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(f));
      data.utr = String(data.utr || '').replace(/\s/g, '');
      if (!data.name.trim()) { msg.textContent = 'Add your name so we can match your payment.'; return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) { msg.textContent = 'That email address does not look right.'; return; }
      if (!/^\d{12}$/.test(data.utr)) { msg.textContent = 'The UPI reference is the 12-digit number (UTR) in your payment app, under the payment details.'; return; }
      const btn = f.querySelector('button'); btn.disabled = true; btn.classList.add('busy'); msg.textContent = 'Saving…';
      try {
        const r = await fetch('/api/order', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...data, kind, sku, amount: typeof amount === 'function' ? amount() : amount }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || 'Something went wrong. Try again in a minute.');
        msg.textContent = done(j); f.querySelectorAll('input').forEach((i) => { i.disabled = true; });
        if (j.url && kind === 'order') { try { localStorage.setItem('co-last-order', j.url); } catch (err) {} setTimeout(() => { location.href = j.url; }, 900); }
      } catch (err) { msg.textContent = err.message; btn.disabled = false; btn.classList.remove('busy'); }
    });
    return f;
  }

  // ---------- tip jar (UPI, India only) ----------
  // A UPI link opens GPay / PhonePe / Paytm / BHIM on a phone; the QR is for paying from another phone.
  let tipEl;
  // pa stays unencoded: some UPI apps reject %40 in the ID
  const upiLink = (amount, note) => `upi://pay?pa=${UPI_ID}&pn=${encodeURIComponent(CAT.payee || 'Curious Orbit')}`
    + `${amount ? `&am=${amount}` : ''}&cu=INR&tn=${encodeURIComponent(note || 'Tip for Curious Orbit')}`;
  function qrSvg(text) {
    const q = window.qrcode(0, 'M'); q.addData(text); q.make();
    const n = q.getModuleCount(); let d = '';
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (q.isDark(y, x)) d += `M${x} ${y}h1v1h-1z`;
    return `<svg viewBox="-3 -3 ${n + 6} ${n + 6}" role="img" aria-label="UPI QR code" shape-rendering="crispEdges"><rect x="-3" y="-3" width="${n + 6}" height="${n + 6}" fill="#F3EEE4"/><path d="${d}" fill="#0B0E17"/></svg>`;
  }
  const loadQr = () => window.qrcode ? Promise.resolve() : new Promise((ok, no) => {
    document.head.append(h('script', { src: asset('vendor/qrcode.js'), onload: ok, onerror: no }));
  });
  async function tipJar() {
    try { await loadQr(); } catch (err) { /* QR is a bonus: the link and ID still work */ }
    if (!tipEl) {
      const amounts = (CFG.upi && CFG.upi.amounts) || [29, 49, 99, 199];
      let amount = amounts[1] || amounts[0];
      const qr = h('div', { class: 'tip-qr' });
      const pay = h('a', { class: 'btn', text: '' });
      const chips = h('div', { class: 'tip-amounts', role: 'radiogroup', 'aria-label': 'Tip amount' });
      const draw = () => {
        const link = upiLink(amount);
        if (window.qrcode) qr.innerHTML = qrSvg(link);
        pay.href = link; pay.textContent = `Pay ₹${amount} with a UPI app`;
        chips.querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(+b.dataset.amt === amount)));
      };
      amounts.forEach((a) => chips.append(h('button', { type: 'button', role: 'radio', 'data-amt': a, text: `₹${a}`, onclick: () => { amount = a; draw(); } })));
      const idText = h('code', { id: 'tip-upi-id', text: UPI_ID });
      const copy = h('button', { class: 'btn btn-ghost btn-small', type: 'button', text: 'Copy UPI ID', onclick: async () => {
        try { await navigator.clipboard.writeText(UPI_ID); copy.textContent = 'Copied'; } catch (err) { copy.textContent = 'Select and copy it'; }
        setTimeout(() => { copy.textContent = 'Copy UPI ID'; }, 2000);
      } });
      // Optional: the tipper logs their payment so it shows in the admin records.
      const thanks = h('details', { class: 'tip-log' }, h('summary', { text: 'Paid? Tell us so we can say thanks' }),
        paidForm({ kind: 'tip', amount: () => amount, button: 'Send', done: (r) => `Thank you! Logged as ${r.id}.` }));
      tipEl = h('dialog', { class: 'viewer tipjar', 'aria-labelledby': 'tip-title' },
        h('div', { class: 'tip-inner' },
          h('div', { class: 'tip-text' },
            h('p', { class: 'label', text: 'Tip jar · UPI' }),
            h('h3', { id: 'tip-title', text: 'Buy us a chai.' }),
            h('p', { text: 'Each fact takes about an hour to research, check and animate. Tips keep it free for everyone.' }),
            chips, pay,
            h('p', { class: 'tip-id' }, h('span', { text: 'UPI ID ' }), idText, copy),
            h('p', { class: 'tip-note', text: 'Scan the code from another phone, or tap the button on this one. Works with GPay, PhonePe, Paytm, BHIM and any UPI app. Indian bank accounts only.' }),
            thanks),
          qr),
        h('button', { class: 'close', type: 'button', 'aria-label': 'Close', text: '×', onclick: () => tipEl.close() }));
      tipEl.addEventListener('click', (e) => { if (e.target === tipEl) tipEl.close(); });
      document.body.append(tipEl); draw();
    }
    tipEl.showModal();
  }

  // ---------- sponsors + tips ----------
  function wireMoney() {
    document.querySelectorAll('form.signup').forEach((f) => { if (!f.closest('.product') && !f.dataset.wired) { f.dataset.wired = '1'; wireForm(f); } });
    document.querySelectorAll('[data-sponsor-email]').forEach((el) => { if (CFG.sponsorEmail) el.textContent = CFG.sponsorEmail; });
    document.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
      const target = document.getElementById(b.dataset.copy);
      try { await navigator.clipboard.writeText(target.textContent); b.textContent = 'Copied'; }
      catch (err) { const r = document.createRange(); r.selectNodeContents(target); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); b.textContent = 'Selected, copy it'; }
      setTimeout(() => { b.textContent = 'Copy email'; }, 2000);
    }));
    document.querySelectorAll('[data-tip]').forEach((a) => {
      a.removeAttribute('target'); a.href = '#tip';
      a.addEventListener('click', (e) => { e.preventDefault(); if (UPI_ID) tipJar(); else toast('Tips switch on soon.'); });
    });
    document.querySelectorAll('[data-ig]').forEach((a) => { a.href = IG; });
    if (CFG.demo) document.querySelectorAll('[data-demo-banner]').forEach((el) => { el.hidden = false; });
  }

  window.CO = { M, CFG, IG, reduce, $, h, pad, asset, run, onceVisible, toast, reel, carousel, post, media, wireForm, signupForm, moneyLink, renderShop, wireMoney, PRODUCTS, paidForm, upiLink, qrSvg, loadQr, rupees, checkout, CAT };
})();
