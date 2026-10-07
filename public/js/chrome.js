// Shared chrome for every page: grain, spring cursor, sliding tab ink, mobile menu, smooth scroll on sub pages.
(() => {
  const { M, reduce, $ } = window.CO;
  const doc = document.documentElement;

  // ---------- grain texture (generated, no image file) ----------
  const grain = $('.grain');
  if (grain) {
    const c = document.createElement('canvas'); c.width = c.height = 180;
    const x = c.getContext('2d'), img = x.createImageData(180, 180);
    for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
    x.putImageData(img, 0, 0);
    grain.style.backgroundImage = `url(${c.toDataURL()})`;
  }

  // ---------- custom cursor: a ring that springs after an ember dot ----------
  const cur = $('#cursor');
  if (cur && matchMedia('(hover: hover) and (pointer: fine)').matches && !reduce) {
    doc.classList.add('has-cursor');
    const ringEl = cur.querySelector('.cursor-ring'), dot = cur.querySelector('.cursor-dot'), label = $('#cursor-label');
    let mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my, vx = 0, vy = 0;
    addEventListener('pointermove', (e) => { cur.classList.add('live'); mx = e.clientX; my = e.clientY; dot.style.transform = `translate(${mx}px,${my}px)`; label.style.left = `${mx}px`; label.style.top = `${my}px`; }, { passive: true });
    const { omega: w, zeta: z } = M.PRESETS.default;   // the kit's critically damped 'default' spring
    let last = performance.now();
    (function loop(now) {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      vx += (-2 * z * w * vx - w * w * (rx - mx)) * dt; vy += (-2 * z * w * vy - w * w * (ry - my)) * dt;
      rx += vx * dt; ry += vy * dt;
      ringEl.style.transform = `translate(${rx}px,${ry}px)`;
      requestAnimationFrame(loop);
    })(last);
    document.addEventListener('pointerover', (e) => {
      const t = e.target.closest('a, button, [data-cursor], summary');
      if (t) { cur.classList.add('is-hover'); label.textContent = t.dataset.cursor || (t.tagName === 'A' ? 'Open' : 'Click'); }
    });
    document.addEventListener('pointerout', (e) => { if (e.target.closest('a, button, [data-cursor], summary')) cur.classList.remove('is-hover'); });
  }

  // ---------- current page in the nav ----------
  const here = location.pathname.replace(/\.html$/, '').replace(/\/$/, '') || '/';
  document.querySelectorAll('.hud-nav a, .menu a').forEach((a) => {
    const p = new URL(a.href, location.href).pathname.replace(/\.html$/, '').replace(/\/(index)?$/, '') || '/';
    if (p === here && p !== '/' && !a.hash) a.setAttribute('aria-current', 'page');
  });

  // ---------- sliding ink: one line glides to the hovered item and rests on the active one ----------
  // ink(container, itemSelector, activeSelector). Re-call after re-rendering the items.
  function ink(box, items, active) {
    if (!box) return;
    let bar = box.querySelector(':scope > .ink');
    if (!bar) { bar = document.createElement('span'); bar.className = 'ink'; bar.setAttribute('aria-hidden', 'true'); box.append(bar); }
    const to = (el, instant) => {
      if (!el) { bar.classList.remove('on'); return; }
      const b = box.getBoundingClientRect(), r = el.getBoundingClientRect();
      if (instant) bar.style.transition = 'none';
      bar.style.width = `${r.width}px`; bar.style.transform = `translateX(${r.left - b.left}px)`;
      if (box.matches('.tabs')) { bar.style.height = `${r.height}px`; bar.style.top = `${r.top - b.top}px`; }
      bar.classList.add('on');
      if (instant) { bar.offsetWidth; bar.style.transition = ''; }
    };
    const rest = () => to(box.querySelector(active));
    if (!box.dataset.inkWired) {
      box.dataset.inkWired = '1';
      box.addEventListener('pointerover', (e) => { const t = e.target.closest(items); if (t && box.contains(t)) to(t); });
      box.addEventListener('focusin', (e) => { const t = e.target.closest(items); if (t) to(t); });
      box.addEventListener('pointerleave', rest);
      box.addEventListener('focusout', () => setTimeout(() => { if (!box.contains(document.activeElement)) rest(); }, 0));
      addEventListener('resize', () => { const a = box.querySelector(active); a ? to(a, true) : bar.classList.remove('on'); });
    }
    const a = box.querySelector(active);
    a ? to(a, !box.dataset.inkShown) : bar.classList.remove('on');
    box.dataset.inkShown = '1';
  }
  ink($('.hud-nav'), 'a', 'a[aria-current]');
  document.fonts && document.fonts.ready.then(() => ink($('.hud-nav'), 'a', 'a[aria-current]'));

  // ---------- mobile menu ----------
  const btn = $('#menu-btn'), menu = $('#menu');
  if (btn && menu) {
    const set = (open) => { doc.classList.toggle('menu-open', open); btn.setAttribute('aria-expanded', String(open)); btn.textContent = open ? 'Close' : 'Menu'; menu.inert = !open; };
    set(false);
    btn.addEventListener('click', () => set(!doc.classList.contains('menu-open')));
    menu.addEventListener('click', (e) => { if (e.target.closest('a')) set(false); });
    addEventListener('keydown', (e) => { if (e.key === 'Escape') set(false); });
  }

  // ---------- smooth scroll on sub pages (home runs its own Lenis with ScrollTrigger) ----------
  if (!doc.classList.contains('home-doc') && window.Lenis && !reduce) {
    const lenis = new window.Lenis({ lerp: 0.1, prevent: (node) => !!node.closest && !!node.closest('dialog, .menu') });
    (function raf(t) { lenis.raf(t); requestAnimationFrame(raf); })(performance.now());
    window.CO.lenis = lenis;
  }

  window.CO.ink = ink;
})();
