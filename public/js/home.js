// Curious Orbit home. Scroll choreography with GSAP + ScrollTrigger + Lenis; the cursor, magnetic button and
// card tilts ride the Motion Reel Kit's springs (window.Motion) so the site moves like the reels.
(() => {
  const { M, IG, reduce, $, h, pad, media, renderShop, wireMoney } = window.CO;
  const DAYS = window.CO_DAYS || [];
  const preview = /preview/.test(location.hash);
  const gsap = window.gsap, ST = window.ScrollTrigger;
  const motion = !reduce && !!gsap;
  if (!motion) document.documentElement.classList.add('no-motion');
  if (gsap && ST) gsap.registerPlugin(ST);

  // ---------- schedule ----------
  const postTime = (d) => new Date(`${d.date}T${d.time.startsWith('7') ? '19' : '13'}:00:00`);
  const isLive = (d) => !!d.title && (preview || d.posted || Date.now() >= postTime(d));
  const live = DAYS.filter(isLive);
  const current = live[live.length - 1] || null;
  const next = DAYS.find((d) => !isLive(d)) || null;
  const fmtDate = (d) => postTime(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const until = (date) => {
    const ms = date - Date.now();
    if (ms <= 0) return 'any moment';
    const m = Math.floor(ms / 60000), dd = Math.floor(m / 1440), hh = Math.floor((m % 1440) / 60), mm = m % 60;
    return dd ? `${dd}d ${hh}h` : hh ? `${hh}h ${mm}m` : `${mm}m`;
  };
  const kicker = (d) => `Day ${pad(d.n)} · ${d.topic}`;
  window.CO_STATE = { day: current ? current.n : 0 };

  // ---------- grain texture (generated, no image file) ----------
  (() => {
    const c = document.createElement('canvas'); c.width = c.height = 180;
    const x = c.getContext('2d'), img = x.createImageData(180, 180);
    for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
    x.putImageData(img, 0, 0);
    $('.grain').style.backgroundImage = `url(${c.toDataURL()})`;
  })();

  // ---------- split text into characters ----------
  document.querySelectorAll('.split').forEach((el) => {
    const words = el.textContent.split(' ');
    el.textContent = '';
    words.forEach((w, i) => {
      const word = h('span', { style: 'display:inline-block;white-space:nowrap' });
      [...w].forEach((c) => word.append(h('span', { class: 'ch', text: c })));
      el.append(word);
      if (i < words.length - 1) el.append(h('span', { class: 'sp', text: ' ' }));
    });
  });
  const heroChars = [...document.querySelectorAll('.hero .ch')];

  // ---------- smooth scroll ----------
  let lenis = null;
  if (motion && window.Lenis && ST) {
    lenis = new window.Lenis({ duration: 1.15, smoothWheel: true });
    lenis.on('scroll', ST.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    document.querySelectorAll('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
      const id = a.getAttribute('href'); if (id.length < 2) return;
      const target = document.querySelector(id); if (!target) return;
      e.preventDefault(); lenis.scrollTo(target, { offset: -20 });
    }));
  }

  // ---------- preloader, then the hero lands ----------
  const loader = $('#loader');
  function heroIn() {
    if (!motion) return;
    gsap.from(heroChars, { yPercent: 115, rotate: 6, duration: 1.3, ease: 'expo.out', stagger: 0.022 });
    gsap.from('.hero .eyebrow, .hero-foot > *, .scroll-hint, .hud', { y: 24, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.08, delay: 0.35 });
  }
  let seen = false; try { seen = !!sessionStorage.getItem('co-seen'); sessionStorage.setItem('co-seen', '1'); } catch (e) {}
  if (!motion || seen) { loader.remove(); heroIn(); }
  else {
    if (lenis) lenis.stop();
    const num = $('#loader-num'), o = { v: 0 };
    gsap.timeline({ onComplete: () => { loader.remove(); if (lenis) lenis.start(); } })
      .to('.loader-ring', { strokeDashoffset: 0, duration: 1.3, ease: 'power3.inOut' }, 0)
      .to(o, { v: 100, duration: 1.3, ease: 'power3.inOut', onUpdate: () => { num.textContent = pad(Math.round(o.v)); } }, 0)
      .to('.loader-dot', { scale: 1, duration: 0.5, ease: 'back.out(1.6)' }, 1.05)
      .to('.loader svg', { scale: 18, duration: 1.1, ease: 'expo.in' }, 1.6)
      .to('.loader-count', { opacity: 0, y: 10, duration: 0.3 }, 1.6)
      .to(loader, { opacity: 0, duration: 0.4 }, 2.35)
      .add(heroIn, 2.2);
  }

  // ---------- hero scroll: type drifts apart as you fly through the ring ----------
  if (motion && ST) {
    ST.create({ trigger: '#hero', start: 'top top', end: 'bottom top', scrub: true,
      onUpdate: (s) => { window.CO_STATE.hero = s.progress; } });
    gsap.to('.mega .row:nth-child(1)', { xPercent: -14, ease: 'none', scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: true } });
    gsap.to('.mega .row:nth-child(2)', { xPercent: 10, ease: 'none', scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: true } });
    gsap.to('.mega .row:nth-child(3)', { xPercent: -6, ease: 'none', scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: true } });
    gsap.to('.hero-inner', { opacity: 0, y: -60, ease: 'none', scrollTrigger: { trigger: '#hero', start: '40% top', end: 'bottom top', scrub: true } });
  }
  addEventListener('scroll', () => { window.CO_STATE.scroll = scrollY; }, { passive: true });

  // ---------- manifesto: each word lights up as it passes ----------
  const man = $('#manifesto');
  (function wrapWords(node) {
    [...node.childNodes].forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((part) => frag.append(/\s+/.test(part) || !part ? part : h('span', { class: 'w', text: part })));
        n.replaceWith(frag);
      } else wrapWords(n);
    });
  })(man);
  const words = [...man.querySelectorAll('.w')];
  if (motion && ST) {
    ST.create({ trigger: man, start: 'top 80%', end: 'bottom 45%', scrub: true,
      onUpdate: (s) => { const k = Math.round(s.progress * words.length); words.forEach((w, i) => w.classList.toggle('on', i < k)); } });
  } else words.forEach((w) => w.classList.add('on'));

  // ---------- today ----------
  const todayMedia = $('#today-media'), cap = $('#today-caption'), acts = $('#today-actions');
  const btn = (text, href, ghost, label) => h('a', { class: `cta${ghost ? ' cta-ghost' : ''}`, href, 'data-cursor': label, ...(href.startsWith('http') ? { target: '_blank', rel: 'noopener' } : {}) }, h('span', { text }), h('i', { 'aria-hidden': 'true', text: '→' }));
  if (current) {
    $('#today-kicker').textContent = `Today · ${kicker(current)} · ${current.format}`;
    $('#today-title').textContent = current.title;
    todayMedia.append(media(current));
    current.caption.forEach((p) => cap.append(h('p', { text: p })));
    acts.append(btn('Full story and sources', `facts/day-${pad(current.n)}.html`, false, 'Read'), btn('On Instagram', IG, true, 'Open'));
    $('#orbit-text-path').textContent = `DAY ${pad(current.n)} · ${current.topic.toUpperCase()} · ONE TRUE THING · DAY ${pad(current.n)} · ${current.topic.toUpperCase()} · ONE TRUE THING · `;
  } else {
    $('#today-kicker').textContent = 'Launching Thursday 8 October';
    $('#today-title').innerHTML = '';
    $('#today-title').append('The first fact ', h('span', { class: 'ember', text: 'drops Thursday.' }));
    todayMedia.append(window.CO.reel({ n: 0, format: 'reel', title: 'Welcome to Curious Orbit', video: 'media/welcome.mp4', poster: 'media/welcome-cover.webp' }));
    cap.append(h('p', { text: 'For 20 days there is a new fact every day: reels at 7 pm, carousels and posts at 1 pm. Space, the human body, animals, everyday physics and a few myths school got wrong.' }));
    if (next) cap.append(h('p', { text: `Day ${next.n} lands ${fmtDate(next)} at ${next.time}, in ${until(postTime(next))}.` }));
    acts.append(btn('Get it by email', '#daily', false, 'Join'), btn('Follow on Instagram', IG, true, 'Follow'));
  }
  // tilt the floating frame toward the pointer with a kit spring
  const tilt = todayMedia;
  let tx = 0, ty = 0, tkeysX = [[0, 0]], tkeysY = [[0, 0]], tT0 = performance.now(), tLast = 0, tRun = false;
  const tNow = () => (performance.now() - tT0) / 1000;
  function tiltLoop() {
    const t = tNow();
    tx = M.track(t, tkeysX, 'heavy'); ty = M.track(t, tkeysY, 'heavy');
    tilt.style.transform = `rotateY(${tx}deg) rotateX(${ty}deg)`;
    if (t - tLast < 1.2) requestAnimationFrame(tiltLoop); else tRun = false;
  }
  if (!reduce) $('.today-orbit').addEventListener('pointermove', (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width - 0.5, ny = (e.clientY - r.top) / r.height - 0.5;
    const t = tNow(); tkeysX.push([t, nx * 18]); tkeysY.push([t, -ny * 14]); tLast = t;
    if (tkeysX.length > 40) { tkeysX = [[t, tx]]; tkeysY = [[t, ty]]; tkeysX.push([t, nx * 18]); tkeysY.push([t, -ny * 14]); }
    if (!tRun) { tRun = true; requestAnimationFrame(tiltLoop); }
  });
  if (motion && ST) gsap.from('.today-orbit', { scale: 0.7, opacity: 0, rotate: -12, ease: 'expo.out', duration: 1.6, scrollTrigger: { trigger: '#today', start: 'top 70%' } });

  // ---------- marquee ----------
  const lines = live.length ? live.map((d) => d.title)
    : ['A day on Venus outlasts its year.', 'Wombats poop cubes.', 'Saturn could float.', "Lightning is hotter than the Sun's surface."];
  const track = $('#marquee');
  for (let k = 0; k < 2; k++) lines.forEach((l) => track.append(h('span', { text: l })));
  if (motion) {
    let x = 0, v = 1, lastY = scrollY;
    gsap.ticker.add(() => {
      const dy = scrollY - lastY; lastY = scrollY;
      v += ((1 + Math.min(Math.abs(dy) * 0.25, 14)) * (dy < 0 ? -1 : 1) - v) * 0.08;
      x -= v; const w = track.scrollWidth / 2;
      if (x < -w) x += w; if (x > 0) x -= w;
      track.style.transform = `translate3d(${x}px,0,0)`;
    });
  }

  // ---------- the log: stations along the 20-day orbit ----------
  const ring = () => {
    const NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('aria-hidden', 'true');
    const c1 = document.createElementNS(NS, 'circle'); [['cx', 50], ['cy', 50], ['r', 34], ['fill', 'none'], ['stroke', '#F3EEE4'], ['stroke-width', 3]].forEach(([k, v]) => c1.setAttribute(k, v));
    const c2 = document.createElementNS(NS, 'circle'); [['cx', 79.4], ['cy', 33], ['r', 7], ['fill', '#FF6B3D']].forEach(([k, v]) => c2.setAttribute(k, v));
    svg.append(c1, c2); return svg;
  };
  const logTrack = $('#log-track');
  DAYS.forEach((d) => {
    const on = isLive(d), isNext = next && d.n === next.n;
    const thumb = on ? (d.format === 'reel' ? d.poster : d.images[0]) : null;
    const li = h('li', { class: `station${on ? '' : ' locked'}${isNext ? ' next' : ''}` },
      h('span', { class: 'num', 'aria-hidden': 'true', text: pad(d.n) }),
      h('button', on ? { type: 'button', 'aria-label': `Open day ${d.n}: ${d.title}`, 'data-cursor': d.format === 'reel' ? 'Play' : 'Open', onclick: () => openViewer(d) }
                     : { type: 'button', 'aria-disabled': 'true', tabindex: '-1' },
        h('span', { class: 'pic' }, on ? h('img', { src: thumb, alt: '', loading: 'lazy' }) : ring()),
        h('span', { class: 'meta-k' }, h('span', { text: `${d.topic} · ${d.format}` }), h('span', { text: on ? (d.posted ? 'On Instagram' : fmtDate(d)) : isNext ? `in ${until(postTime(d))}` : fmtDate(d) })),
        h('span', { class: 't', text: on ? d.title : isNext ? 'Next drop' : 'Coming soon' })));
    logTrack.append(li);
  });
  if (motion && ST) {
    ST.matchMedia({
      '(min-width: 900px)': () => {
        const dist = () => logTrack.scrollWidth - innerWidth;
        const tw = gsap.to(logTrack, { x: () => -dist(), ease: 'none',
          scrollTrigger: { trigger: '.log-x', pin: '.log-pin', start: 'top top', end: () => `+=${dist()}`, scrub: 0.6, invalidateOnRefresh: true,
            onUpdate: (s) => { $('#log-progress').style.transform = `scaleX(${s.progress})`; } } });
        logTrack.querySelectorAll('.station').forEach((st) => gsap.from(st.querySelector('.pic'), { yPercent: 18, opacity: 0, ease: 'power2.out',
          scrollTrigger: { trigger: st, containerAnimation: tw, start: 'left 95%', end: 'left 60%', scrub: true } }));
        return () => tw.kill();
      },
    });
  }

  // ---------- numbers ----------
  const counts = [...document.querySelectorAll('.numbers .count')];
  if (motion && ST) {
    ST.create({ trigger: '.numbers', start: 'top 75%', once: true, onEnter: () => {
      counts.forEach((el, i) => { const o = { v: 0 }; gsap.to(o, { v: +el.dataset.to, duration: 1.8, delay: i * 0.1, ease: 'expo.out', onUpdate: () => { el.textContent = Math.round(o.v); } }); });
      gsap.from('.numbers .seg', { scaleX: 0, duration: 1.4, ease: 'expo.out', stagger: 0.15, delay: 0.3 });
    } });
    gsap.from('.numbers-big', { yPercent: 30, ease: 'none', scrollTrigger: { trigger: '.numbers', start: 'top bottom', end: 'bottom top', scrub: true } });
  }

  // ---------- section headlines rise when they arrive ----------
  if (motion && ST) {
    document.querySelectorAll('.daily-x .split').forEach((el) => gsap.from(el.querySelectorAll('.ch'), { yPercent: 115, duration: 1.1, ease: 'expo.out', stagger: 0.018, scrollTrigger: { trigger: el, start: 'top 85%' } }));
    document.querySelectorAll('.big').forEach((el) => { if (!el.closest('.hero')) gsap.from(el, { y: 60, opacity: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 88%' } }); });
    gsap.from('.rowlink', { y: 40, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.08, scrollTrigger: { trigger: '.rows', start: 'top 80%' } });
    gsap.from('.wordmark', { yPercent: 40, ease: 'none', scrollTrigger: { trigger: '.big-foot', start: 'top bottom', end: 'bottom bottom', scrub: true } });
  }

  // ---------- shop + money wiring ----------
  renderShop($('#products'));
  wireMoney();
  if (motion) {
    document.querySelectorAll('.home .product').forEach((card) => {
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect(), nx = (e.clientX - r.left) / r.width - 0.5, ny = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform = `rotateY(${nx * 8}deg) rotateX(${-ny * 8}deg) translateZ(0)`;
      });
      card.addEventListener('pointerleave', () => { card.style.transform = ''; });
    });
    if (ST) gsap.from('.home .product', { y: 80, opacity: 0, duration: 1.2, ease: 'expo.out', stagger: 0.12, scrollTrigger: { trigger: '#products', start: 'top 85%' } });
  }

  // ---------- magnetic join button ----------
  const orb = $('.orb');
  if (orb && motion) {
    const area = orb.closest('form');
    area.addEventListener('pointermove', (e) => {
      const r = orb.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      const d = Math.hypot(dx, dy);
      gsap.to(orb, { x: d < 160 ? dx * 0.35 : 0, y: d < 160 ? dy * 0.35 : 0, duration: 0.6, ease: 'power3.out' });
    });
    area.addEventListener('pointerleave', () => gsap.to(orb, { x: 0, y: 0, duration: 0.8, ease: 'elastic.out(1, 0.5)' }));
  }

  // ---------- custom cursor: a ring that springs after an ember dot ----------
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (fine && !reduce) {
    document.documentElement.classList.add('has-cursor');
    const cur = $('#cursor'), ringEl = cur.querySelector('.cursor-ring'), dot = cur.querySelector('.cursor-dot'), label = $('#cursor-label');
    let mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my, vx = 0, vy = 0;
    addEventListener('pointermove', (e) => { mx = e.clientX; my = e.clientY; dot.style.transform = `translate(${mx}px,${my}px)`; label.style.left = `${mx}px`; label.style.top = `${my}px`; }, { passive: true });
    // critically damped spring (kit 'default' feel), integrated per frame
    const { omega: w, zeta: z } = M.PRESETS.default;
    let last = performance.now();
    (function loop(now) {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      vx += (-2 * z * w * vx - w * w * (rx - mx)) * dt; vy += (-2 * z * w * vy - w * w * (ry - my)) * dt;
      rx += vx * dt; ry += vy * dt;
      ringEl.style.transform = `translate(${rx}px,${ry}px)`;
      requestAnimationFrame(loop);
    })(last);
    document.addEventListener('pointerover', (e) => {
      const t = e.target.closest('a, button, [data-cursor]');
      if (t) { cur.classList.add('is-hover'); label.textContent = t.dataset.cursor || (t.tagName === 'A' ? 'Open' : 'Click'); }
    });
    document.addEventListener('pointerout', (e) => { if (e.target.closest('a, button, [data-cursor]')) cur.classList.remove('is-hover'); });
  }

  // ---------- HUD clock ----------
  function clock() {
    $('#hud-clock').textContent = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    $('#hud-next').textContent = next ? `Day ${pad(next.n)} in ${until(postTime(next))}` : 'All 20 days are out';
  }
  clock(); setInterval(clock, 1000);

  // ---------- viewer ----------
  const dlg = $('#viewer');
  function openViewer(d) {
    const m = $('#viewer-media'); m.innerHTML = '';
    m.append(media(d, { autoplay: false, withSound: true }));
    $('#viewer-label').textContent = `${kicker(d)} · ${d.format}`;
    $('#viewer-title').textContent = d.title;
    const c = $('#viewer-caption'); c.innerHTML = ''; d.caption.forEach((p) => c.append(h('p', { text: p })));
    $('#viewer-tags').textContent = d.tags.join(' ');
    $('#viewer-more').href = `facts/day-${pad(d.n)}.html`;
    document.querySelectorAll('.today-x video').forEach((v) => v.pause());
    if (lenis) lenis.stop();
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
    const v = m.querySelector('video'); if (v) v.play().catch(() => {});
  }
  function closeViewer() { const v = $('#viewer-media video'); if (v) v.pause(); $('#viewer-media').innerHTML = ''; if (dlg.open) dlg.close(); }
  $('#viewer-close').addEventListener('click', closeViewer);
  dlg.addEventListener('click', (e) => { if (e.target === dlg) closeViewer(); });
  dlg.addEventListener('close', () => { const v = $('#viewer-media video'); if (v) v.pause(); if (lenis) lenis.start(); });

  addEventListener('hashchange', () => { if (/preview/.test(location.hash) !== preview) location.reload(); });
  addEventListener('load', () => ST && ST.refresh());
})();
