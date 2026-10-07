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
    for (const kid of kids.flat()) if (kid != null) el.append(kid);
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
      'aria-label': `Day ${d.n} reel: ${d.title}` });
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
    const imgs = d.images.map((src, i) => h('img', { src: asset(src), alt: `Day ${d.n}, slide ${i + 1} of ${d.images.length}`, loading: i ? 'lazy' : 'eager', draggable: 'false' }));
    const track = h('div', { class: 'track', tabindex: '0', 'aria-label': `Day ${d.n} carousel, swipe for more` }, imgs);
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
  const post = (d) => h('div', { class: 'frame post' }, h('img', { src: asset(d.images[0]), alt: `Day ${d.n} post: ${d.title}` }));
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

  // ---------- shop ----------
  const PRODUCTS = [
    { id: 'quiz-pack', name: 'Quiz Night Pack', price: '$7', unit: 'PDF + slides',
      text: '50 fact-checked trivia questions in five rounds: space, body, animals, physics and myths. Answers, sources and ready-to-show slides for a pub night, classroom or family game.',
      shots: ['media/day10-post.webp', 'media/day06-post.webp'] },
    { id: 'wallpapers', name: 'Orbit Wallpapers', price: '$3', unit: '12 images',
      text: 'Twelve phone wallpapers in the Curious Orbit look, each carrying one fact. A new mind-bender every time you unlock your phone.',
      shots: ['media/day09-cover.webp', 'media/day04-cover.webp'] },
    { id: 'fact-cards', name: 'Classroom Fact Cards', price: '$9', unit: '60 printable cards',
      text: 'A question on the front, the answer and its source on the back. Made for teachers, parents and anyone who likes a "wait, what?" at the dinner table.',
      shots: ['media/day05-slide-03.webp', 'media/day08-slide-04.webp'] },
  ];
  function renderShop(listEl) {
    if (!listEl) return;
    PRODUCTS.forEach((p) => {
      const link = CFG.shop && CFG.shop[p.id];
      const buy = link
        ? moneyLink(h('a', { class: 'btn', target: '_blank', rel: 'noopener', text: `Get it for ${p.price}` }), link)
        : h('button', { class: 'btn btn-ghost', type: 'button', text: 'Join the waitlist' });
      const body = h('div', { class: 'body' },
        h('h3', { text: p.name }), h('p', { text: p.text }),
        h('div', { class: 'row' }, h('span', { class: 'price' }, p.price, h('small', { text: p.unit })), buy));
      if (!link) {
        const form = signupForm(`waitlist-${p.id}`, { label: 'Notify me', note: 'One email when it launches. Nothing else.' });
        form.dataset.done = `You're on the list. We'll email you when the ${p.name} is out.`;
        form.hidden = true;
        buy.addEventListener('click', () => { form.hidden = false; buy.hidden = true; form.querySelector('input').focus(); });
        body.append(form);
      }
      listEl.append(h('li', { class: 'product' },
        h('div', { class: 'shot' }, !link && h('span', { class: 'soon', text: 'Coming soon' }), p.shots.map((src) => h('img', { src: asset(src), alt: '', loading: 'lazy' }))),
        body));
    });
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
    document.querySelectorAll('[data-tip]').forEach((a) => moneyLink(a, CFG.tipUrl));
    document.querySelectorAll('[data-ig]').forEach((a) => { a.href = IG; });
    if (CFG.demo) document.querySelectorAll('[data-demo-banner]').forEach((el) => { el.hidden = false; });
  }

  window.CO = { M, CFG, IG, reduce, $, h, pad, asset, run, onceVisible, toast, reel, carousel, post, media, wireForm, signupForm, moneyLink, renderShop, wireMoney, PRODUCTS };
})();
