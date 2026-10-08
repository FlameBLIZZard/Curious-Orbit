// Shop page (every product, with search, topics, types, sort and paging) and the buyer's order page (/order?id=…&k=…).
(() => {
  const { $, h, renderShop, rupees, IG, productCard, PRODUCTS, THEMES, OFFERS, reduce } = window.CO;
  renderShop($('#products'));

  const grid = $('#products[data-all]');
  if (grid) {
    const TYPES = ['All', 'Bundle', 'Games', 'Printables', 'Posters', 'Wallpapers'];
    const LABEL = { Bundle: 'Bundles' };
    const PAGE = 24;
    const q0 = new URLSearchParams(location.search);
    const st = { q: q0.get('q') || '', type: TYPES.includes(q0.get('type')) ? q0.get('type') : 'All', topic: q0.get('topic') || '', sort: q0.get('sort') || 'top', shown: PAGE };
    const order = new Map(PRODUCTS.map((p, i) => [p.sku, i]));

    // offers strip
    const tiers = (OFFERS.tiers || []).slice().sort((a, b) => a.min - b.min);
    const best = Math.max(0, ...PRODUCTS.filter((p) => p.compareAt).map((p) => Math.round((1 - p.price / p.compareAt) * 100)));
    const offers = h('ul', { class: 'offers' },
      tiers.map((t) => h('li', {}, h('b', { text: `${t.off}% off` }), h('span', { text: `any ${t.min}+ items` }))),
      best ? h('li', {}, h('b', { text: `Up to ${best}% off` }), h('span', { text: 'with bundles' })) : null,
      h('li', {}, h('b', { text: 'Instant' }), h('span', { text: 'download after UPI check' })));

    // toolbar: search, type tabs, topic chips, sort
    const search = h('input', { type: 'search', class: 'shop-search', placeholder: `Search ${PRODUCTS.length} products`, value: st.q, 'aria-label': 'Search products', autocomplete: 'off' });
    const count = h('p', { class: 'shop-count', 'aria-live': 'polite' });
    const sort = h('select', { class: 'shop-sort', 'aria-label': 'Sort' },
      [['top', 'Best picks'], ['low', 'Price: low to high'], ['high', 'Price: high to low'], ['save', 'Biggest saving']].map(([v, t]) => h('option', { value: v, text: t, selected: st.sort === v })));
    const types = TYPES.filter((t) => t === 'All' || PRODUCTS.some((p) => (p.includes ? 'Bundle' : p.category) === t));
    const tabs = h('div', { class: 'tabs shop-tabs', role: 'tablist', 'aria-label': 'Product types' },
      types.map((t) => h('button', { type: 'button', role: 'tab', 'data-t': t, 'aria-selected': String(t === st.type), text: LABEL[t] || t, onclick: () => set({ type: t }) })));
    const themeCount = (slug) => PRODUCTS.filter((p) => p.theme === slug).length;
    const topics = h('div', { class: 'topics', role: 'group', 'aria-label': 'Topics' },
      h('button', { type: 'button', class: 'chip', 'aria-pressed': String(!st.topic), 'data-topic': '', text: 'All topics', onclick: () => set({ topic: '' }) }),
      Object.entries(THEMES).filter(([slug]) => themeCount(slug)).map(([slug, name]) =>
        h('button', { type: 'button', class: 'chip', 'aria-pressed': String(st.topic === slug), 'data-topic': slug, text: name, onclick: () => set({ topic: st.topic === slug ? '' : slug }) })));
    const more = h('button', { type: 'button', class: 'btn btn-ghost shop-load', text: 'Show more', onclick: () => { st.shown += PAGE; draw(true); } });
    const empty = h('p', { class: 'empty', hidden: true, text: 'Nothing matches that. Try another word or topic.' });
    grid.before(offers, h('div', { class: 'shop-bar' }, search, sort), tabs, topics, count);
    grid.after(empty, more);
    const ink = () => window.CO.ink && window.CO.ink(tabs, '[role=tab]', '[aria-selected=true]');
    ink(); document.fonts && document.fonts.ready.then(ink);

    let t;
    search.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => set({ q: search.value }), 160); });
    sort.addEventListener('change', () => set({ sort: sort.value }));

    function set(patch) {
      Object.assign(st, patch, { shown: PAGE });
      tabs.querySelectorAll('[role=tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.t === st.type)));
      topics.querySelectorAll('.chip').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.topic === st.topic)));
      ink();
      const u = new URLSearchParams();
      if (st.q) u.set('q', st.q); if (st.type !== 'All') u.set('type', st.type); if (st.topic) u.set('topic', st.topic); if (st.sort !== 'top') u.set('sort', st.sort);
      history.replaceState(null, '', `${location.pathname}${u.toString() ? `?${u}` : ''}`);
      draw();
    }
    const words = (p) => `${p.name} ${p.text} ${p.unit} ${THEMES[p.theme] || ''} ${p.category}`.toLowerCase();
    function list() {
      const q = st.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
      const out = PRODUCTS.filter((p) => (st.type === 'All' || (p.includes ? 'Bundle' : p.category) === st.type)
        && (!st.topic || p.theme === st.topic)
        && q.every((w) => words(p).includes(w)));
      const save = (p) => (p.compareAt ? p.compareAt - p.price : 0);
      if (st.sort === 'low') out.sort((a, b) => a.price - b.price);
      else if (st.sort === 'high') out.sort((a, b) => b.price - a.price);
      else if (st.sort === 'save') out.sort((a, b) => save(b) - save(a));
      else out.sort((a, b) => order.get(a.sku) - order.get(b.sku));
      return out;
    }
    function draw(append) {
      const all = list(), page = all.slice(0, st.shown);
      const have = append ? grid.children.length : 0;
      if (!append) grid.replaceChildren();
      const fresh = page.slice(have).map(productCard);
      grid.append(...fresh);
      if (!reduce) fresh.forEach((li, i) => li.animate([{ opacity: 0, transform: 'translateY(18px) scale(.98)' }, { opacity: 1, transform: 'none' }],
        { duration: 520, delay: Math.min(i, 12) * 40, easing: 'cubic-bezier(.2,.9,.2,1)', fill: 'backwards' }));
      count.textContent = `${all.length} product${all.length === 1 ? '' : 's'}${st.topic ? ` in ${THEMES[st.topic]}` : ''}`;
      empty.hidden = all.length > 0;
      more.hidden = all.length <= st.shown;
      if (!more.hidden) more.textContent = `Show more (${all.length - st.shown} left)`;
    }
    draw();
  }

  const box = $('#order');
  if (!box) return;
  const q = new URLSearchParams(location.search);
  let id = q.get('id'), k = q.get('k');
  if (!id) {   // came back without the link: use the last order saved on this device
    try { const u = new URL(localStorage.getItem('co-last-order') || '', location.origin); id = u.searchParams.get('id'); k = u.searchParams.get('k'); } catch (err) {}
  }
  const title = $('#order-title'), body = $('#order-body');
  const igLink = () => h('a', { href: IG, target: '_blank', rel: 'noopener', text: '@curiousorbit.daily' });
  const kb = (n) => n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`;
  let timer;

  async function load() {
    if (!id || !k) { title.textContent = 'No order link found.'; body.replaceChildren(h('p', { text: 'Open the order link from when you paid. Lost it? Message us on Instagram with your UPI reference.' })); return; }
    try {
      const r = await fetch(`/api/order?id=${encodeURIComponent(id)}&k=${encodeURIComponent(k)}`, { cache: 'no-store' });
      const o = await r.json();
      if (!r.ok) throw new Error(o.error || 'Could not load the order.');
      try { localStorage.setItem('co-last-order', `/order?id=${id}&k=${k}`); } catch (err) {}
      render(o);
      clearTimeout(timer);
      if (o.status === 'pending') timer = setTimeout(load, 20000);
    } catch (err) { title.textContent = 'Something went wrong.'; body.replaceChildren(h('p', { text: err.message })); }
  }

  function render(o) {
    const meta = h('p', { class: 'meta', text: `${o.id} · ${o.product} · ${rupees(o.amount)} · ${new Date(o.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}` });
    if (o.status === 'approved' && o.kind === 'tip') {
      title.replaceChildren('Thank you for the ', h('span', { class: 'ember', text: 'tip.' }));
      body.replaceChildren(meta, h('p', { text: 'It really does keep the facts coming.' }));
    } else if (o.status === 'approved') {
      title.replaceChildren('Paid. Your files are ', h('span', { class: 'ember', text: 'ready.' }));
      body.replaceChildren(meta,
        h('p', { text: 'Tap each file to download it. This link keeps working, so bookmark it.' }),
        h('ul', { class: 'downloads' }, o.files.map((f) => h('li', {},
          h('a', { class: 'dl', href: f.url, download: f.name },
            h('span', { class: 'dl-name' }, f.label || f.name, o.files.some((x) => x.product !== f.product) && f.product ? h('small', { text: f.product }) : null), h('span', { class: 'dl-size', text: f.size ? kb(f.size) : '' }), h('i', { 'aria-hidden': 'true', text: '↓' }))))));
    } else if (o.status === 'rejected') {
      title.replaceChildren('We couldn\'t match this ', h('span', { class: 'ember', text: 'payment.' }));
      body.replaceChildren(meta, h('p', {}, 'The UPI reference didn\'t match a payment we received. If you did pay, message us on Instagram at ', igLink(), ' with a screenshot of the payment and we\'ll sort it out.'));
    } else {
      title.replaceChildren('Checking your ', h('span', { class: 'ember', text: 'payment.' }));
      body.replaceChildren(meta,
        h('p', { class: 'waiting' }, h('span', { class: 'orbit-spin', 'aria-hidden': 'true' }), 'Waiting for the payment check'),
        h('p', { text: 'We match every UPI reference by hand, usually within a few hours. This page refreshes by itself and your downloads appear here as soon as it\'s confirmed.' }),
        h('p', {}, 'Bookmark this page or copy its link. Questions? Message ', igLink(), ' with your order number.'),
        h('button', { class: 'btn btn-ghost btn-small', type: 'button', text: 'Copy this page\'s link', onclick: async (e) => {
          try { await navigator.clipboard.writeText(location.origin + `/order?id=${id}&k=${k}`); e.target.textContent = 'Copied'; } catch (err) { e.target.textContent = 'Copy it from the address bar'; }
        } }));
    }
  }
  load();
})();
