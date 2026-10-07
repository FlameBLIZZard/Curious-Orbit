// Micro-interactions for every page: rolling button labels, magnetic buttons, dialogs that ease out,
// headline word rises, scroll reveals, count-ups, a reading-progress line, field feedback and tiny haptics.
(() => {
  const { reduce, $ } = window.CO;
  const doc = document.documentElement;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const sub = document.body.classList.contains('sub');

  // ---------- rolling labels ----------
  // Text-only buttons get each letter in its own span; CSS rolls them up on hover. When code later changes the
  // label (Copied, Saving…, Close) the observer re-splits it and the new letters roll in from below.
  const ROLL = '.btn, .pill, .chip, .tabs [role=tab], .tip-amounts button, .menu-btn, .hud-nav a, .big-foot .foot-links a, .cta > span, .cart-btn';
  function roll(el, swap) {
    if (reduce || el.closest('.roll')) return;
    const first = el.firstElementChild;
    if (first && first.classList.contains('sr') && el.children.length === 2) return;   // already split
    if (el.children.length || !el.textContent.trim()) return;                               // has markup: leave alone
    const text = el.textContent;
    const sr = document.createElement('span'); sr.className = 'sr'; sr.textContent = text;
    const r = document.createElement('span'); r.className = `roll${swap ? ' swap' : ''}`; r.setAttribute('aria-hidden', 'true');
    [...text].forEach((ch, i) => { const s = document.createElement('span'); s.className = 'rl'; s.style.setProperty('--i', i); s.textContent = ch; r.append(s); });
    el.replaceChildren(sr, r);
  }
  const rollAll = (root) => root.querySelectorAll && root.querySelectorAll(ROLL).forEach((el) => roll(el));

  // ---------- magnetic buttons: they lean towards the pointer and spring back ----------
  const MAG = '.btn, .pill, .close, .cta, .menu-btn, .cart-btn';
  const springs = new Map();
  let ticking = false;
  function tick() {
    const dt = 1 / 60; let alive = false;
    springs.forEach((s, el) => {
      const w = s.free ? 15 : 26, z = s.free ? 0.42 : 0.9;   // released: a visible wobble; held: tight
      s.vx += (-2 * z * w * s.vx - w * w * (s.x - s.tx)) * dt; s.vy += (-2 * z * w * s.vy - w * w * (s.y - s.ty)) * dt;
      s.x += s.vx * dt; s.y += s.vy * dt;
      el.style.translate = `${s.x.toFixed(2)}px ${s.y.toFixed(2)}px`;
      if (s.free && Math.abs(s.x) + Math.abs(s.y) + Math.abs(s.vx) + Math.abs(s.vy) < 0.05) { el.style.translate = ''; springs.delete(el); } else alive = true;
    });
    ticking = alive; if (alive) requestAnimationFrame(tick);
  }
  const kick = () => { if (!ticking) { ticking = true; requestAnimationFrame(tick); } };
  let held = null;
  if (fine && !reduce) {
    document.addEventListener('pointermove', (e) => {
      const el = e.target.closest && e.target.closest(MAG);
      if (held && held !== el) { const s = springs.get(held); if (s) { s.tx = 0; s.ty = 0; s.free = true; } held = null; kick(); }
      if (!el || el.disabled || el.closest('.menu')) return;
      const r = el.getBoundingClientRect(), cl = (v) => Math.max(-10, Math.min(10, v));
      const s = springs.get(el) || { x: 0, y: 0, vx: 0, vy: 0 };
      s.tx = cl((e.clientX - (r.left + r.width / 2)) * 0.22); s.ty = cl((e.clientY - (r.top + r.height / 2)) * 0.35); s.free = false;
      springs.set(el, s); held = el; kick();
    }, { passive: true });
    doc.addEventListener('pointerleave', () => { if (held) { const s = springs.get(held); if (s) { s.tx = 0; s.ty = 0; s.free = true; } held = null; kick(); } });
  }

  // ---------- haptics on phones: a tiny tick when you press a real action ----------
  if (coarse && navigator.vibrate) {
    document.addEventListener('pointerdown', (e) => { if (e.target.closest && e.target.closest('.btn:not(:disabled), .tip-amounts button, .chip, .cart-btn')) navigator.vibrate(8); }, { passive: true });
  }

  // ---------- dialogs ease out instead of vanishing ----------
  if (!reduce && window.HTMLDialogElement) {
    const proto = HTMLDialogElement.prototype, close0 = proto.close;
    proto.close = function (v) {
      if (!this.open || !this.matches('.viewer') || this.classList.contains('closing')) return close0.call(this, v);
      this.classList.add('closing');
      setTimeout(() => { this.classList.remove('closing'); close0.call(this, v); }, 230);
    };
    document.addEventListener('cancel', (e) => { const d = e.target; if (d.matches && d.matches('dialog.viewer')) { e.preventDefault(); d.close(); } }, true);
  }

  // ---------- count-up numbers ----------
  function countUp(el, to, from = 0) {
    const m = String(to).match(/^(\D*)([\d,]+(?:\.\d+)?)(.*)$/);
    if (!m || reduce) { el.textContent = to; return; }
    const [, pre, num, post] = m, end = parseFloat(num.replace(/,/g, '')), dec = (num.split('.')[1] || '').length;
    const loc = pre.includes('₹') ? 'en-IN' : 'en-US', t0 = performance.now(), dur = 1100;
    el._counting = true;
    (function f(now) {
      const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 4);
      el.textContent = pre + (from + (end - from) * e).toLocaleString(loc, { minimumFractionDigits: dec, maximumFractionDigits: dec }) + post;
      if (p < 1) requestAnimationFrame(f); else { el.textContent = to; el._counting = false; }
    })(t0);
  }
  const numberOf = (t) => parseFloat(String(t).replace(/[^\d.]/g, '')) || 0;

  // ---------- headline words rise out of a mask ----------
  function splitHeadline(h1) {
    if (reduce || h1.querySelector('.hw')) return;
    const walk = (node) => [...node.childNodes].forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.append(part); return; }
          const w = document.createElement('span'); w.className = 'hw'; const i = document.createElement('span'); i.textContent = part; w.append(i); frag.append(w);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1 && !n.matches('br')) walk(n);
    });
    walk(h1);
    h1.querySelectorAll('.hw > span').forEach((s, i) => s.style.setProperty('--i', i));
    h1.classList.remove('hw-in'); h1.offsetWidth;
    requestAnimationFrame(() => h1.classList.add('hw-in'));
  }

  // ---------- scroll reveals on sub pages ----------
  const REVEAL = '.how li, .product, .stat, .mk-stats dl > div, .rates > li, .sources, .pager a, .dl, .panel, .legal h2, .legal p:not(.label), .story p, .fact-media, .formats > div, main .label, .foot-top, .wordmark, .cart-line';
  let io;
  if (sub && !reduce && 'IntersectionObserver' in window) {
    io = new IntersectionObserver((entries) => {
      let n = 0;
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        const el = en.target; el.style.setProperty('--d', `${Math.min(n++, 8) * 0.07}s`);
        el.classList.add('mi-in'); io.unobserve(el);
        setTimeout(() => { el.classList.remove('mi'); el.style.removeProperty('--d'); }, 1400 + n * 70);
        const num = el.matches('.mk-stats dl > div') && el.querySelector('dd');
        if (num) countUp(num, num.textContent);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
  }
  const watch = (root) => {
    if (!io || !root.querySelectorAll) return;
    const list = root.matches && root.matches(REVEAL) ? [root] : [];
    root.querySelectorAll(REVEAL).forEach((el) => list.push(el));
    list.forEach((el) => { if (el.dataset.mi) return; el.dataset.mi = '1'; el.classList.add('mi'); io.observe(el); });
  };
  // the footer O orbits as it scrolls into view on every page, home included
  const wm = $('.wordmark');
  if (wm && !io && 'IntersectionObserver' in window && !reduce) {
    const o = new IntersectionObserver(([en]) => { if (en.isIntersecting) { wm.classList.add('mi-in'); o.disconnect(); } }, { threshold: 0.4 });
    o.observe(wm);
  }

  // ---------- reading progress on sub pages ----------
  if (sub && !reduce) {
    const bar = document.createElement('div'); bar.className = 'mi-progress'; bar.setAttribute('aria-hidden', 'true'); document.body.append(bar);
    let raf = 0;
    const upd = () => { raf = 0; const max = doc.scrollHeight - innerHeight; bar.style.transform = `scaleX(${max > 40 ? Math.min(1, scrollY / max) : 0})`; };
    addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(upd); }, { passive: true });
    upd();
  }

  // ---------- fields: tick when valid, live meter for the 12-digit UPI reference, shake on errors ----------
  const VALID = { name: (v) => v.trim().length > 1, email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), utr: (v) => /^\d{12}$/.test(v.replace(/\s/g, '')) };
  function enhanceField(label) {
    if (label.dataset.fx) return; label.dataset.fx = '1';
    const input = label.querySelector('input'); if (!input) return;
    const test = VALID[input.name]; if (!test) return;
    const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg'), p = document.createElementNS(ns, 'path');
    svg.setAttribute('class', 'pf-tick'); svg.setAttribute('viewBox', '0 0 18 18'); svg.setAttribute('aria-hidden', 'true');
    p.setAttribute('d', 'M3.5 9.5l3.5 3.5 7.5-8'); svg.append(p); label.append(svg);
    let meter, count;
    if (input.name === 'utr') {
      meter = document.createElement('span'); meter.className = 'pf-meter'; meter.append(document.createElement('i'));
      count = document.createElement('span'); count.className = 'pf-count'; count.setAttribute('aria-hidden', 'true'); count.textContent = '0 / 12';
      label.append(meter, count);
    }
    const upd = () => {
      label.classList.toggle('is-ok', test(input.value));
      if (meter) { const n = Math.min(12, input.value.replace(/\D/g, '').length); meter.style.setProperty('--p', n / 12); count.textContent = `${n} / 12`; }
    };
    input.addEventListener('input', upd); upd();
  }
  function shake(el) { el.classList.remove('shake'); el.offsetWidth; el.classList.add('shake'); el.addEventListener('animationend', () => el.classList.remove('shake'), { once: true }); }
  // form messages fade up whenever they change; a bad field shakes
  function sayFx(msg) {
    msg.classList.remove('say'); msg.offsetWidth; msg.classList.add('say');
    const form = msg.closest('form'); if (!form || !msg.textContent || /…$/.test(msg.textContent)) return;
    const bad = [...form.querySelectorAll('.pf-field')].find((f) => { const i = f.querySelector('input'); return i && VALID[i.name] && !VALID[i.name](i.value); });
    if (bad) { shake(bad); bad.querySelector('input').focus({ preventScroll: true }); }
  }

  // ---------- one observer wires everything that appears later (checkout, orders, admin rows) ----------
  const lastStat = {};
  function wire(root) {
    if (root.nodeType !== 1) return;
    rollAll(root); if (root.matches(ROLL)) roll(root);
    watch(root);
    (root.matches('.pf-field') ? [root] : root.querySelectorAll('.pf-field')).forEach(enhanceField);
    (root.matches('.stat') ? [root] : root.querySelectorAll('.stat')).forEach((st) => {
      const b = st.querySelector('b'), key = (st.querySelector('.label') || st).textContent;
      if (!b || b._counting) return;
      const prev = lastStat[key], now = b.textContent; lastStat[key] = now;
      if (prev !== now) countUp(b, now, prev === undefined ? 0 : numberOf(prev));
    });
  }
  wire(document.body);
  document.querySelectorAll('.sub main h1').forEach(splitHeadline);

  const mo = new MutationObserver((muts) => {
    muts.forEach((m) => {
      const t = m.target;
      if (t.nodeType !== 1) return;
      if (t.matches(ROLL) && !t.querySelector('.sr')) roll(t, true);       // a label changed: roll the new one in
      if (t.matches('.form-msg')) sayFx(t);
      if (t.matches('main h1') && sub && !t.querySelector('.hw')) splitHeadline(t);
      m.addedNodes.forEach((n) => wire(n));
    });
  });
  mo.observe(document.body, { childList: true, subtree: true });

  window.CO.countUp = countUp;
  window.CO.shake = shake;
  window.CO.bump = (el) => { el.classList.remove('bump'); el.offsetWidth; el.classList.add('bump'); };
})();
