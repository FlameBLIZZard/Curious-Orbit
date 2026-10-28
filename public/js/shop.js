// The shop: search, category tabs, topic / type / price filters, sort, "show more", and a link to every product page.
// State lives in the URL (?cat=Games&topic=space&type=quiz&price=u100&sort=price-asc&q=ocean) so any view can be shared.
// Every filter change also tells the 3D orbit (js/shop-orbit.js) which products match, as a 'co:filter' event.
(() => {
  const { $, h, rupees, asset, reduce, PRODUCTS: ALL } = window.CO;
  const grid = $('#products[data-all]');
  if (!grid) return;

  const PAGE = 24;
  const PRICES = [
    ['u60', 'Under ₹60', (p) => p < 60], ['u100', '₹60 to ₹99', (p) => p >= 60 && p < 100],
    ['u200', '₹100 to ₹199', (p) => p >= 100 && p < 200], ['o200', '₹200 and up', (p) => p >= 200],
  ];
  const SORTS = {
    featured: ['Featured', null],
    'price-asc': ['Price: low to high', (a, b) => a.price - b.price],
    'price-desc': ['Price: high to low', (a, b) => b.price - a.price],
    name: ['Name: A to Z', (a, b) => a.name.localeCompare(b.name)],
    value: ['Biggest saving', (a, b) => ((b.worth || 0) - b.price) - ((a.worth || 0) - a.price)],
  };
  const CATS = ['Games', 'Printables', 'Kids', 'Posters', 'Wallpapers', 'Bundles'].filter((c) => ALL.some((p) => p.category === c));
  const bySku = Object.fromEntries(ALL.map((p) => [p.sku, p]));
  const topics = [...new Map(ALL.filter((p) => p.theme && p.family !== 'bundle').map((p) => [p.theme, p.themeName])).entries()];
  const types = [...new Map(ALL.filter((p) => p.family !== 'bundle').map((p) => [p.family, p.type])).entries()];

  // ---------- state <-> URL ----------
  const read = () => {
    const q = new URLSearchParams(location.search), get = (k, ok) => (ok(q.get(k)) ? q.get(k) : '');
    return { cat: get('cat', (v) => CATS.includes(v)), topic: get('topic', (v) => topics.some(([t]) => t === v)), type: get('type', (v) => types.some(([t]) => t === v)),
      price: get('price', (v) => PRICES.some(([k]) => k === v)), sort: get('sort', (v) => v in SORTS) || 'featured', q: (q.get('q') || '').slice(0, 60), shown: PAGE };
  };
  let S = read();
  const write = () => {
    const q = new URLSearchParams();
    for (const k of ['cat', 'topic', 'type', 'price', 'q']) if (S[k]) q.set(k, S[k]);
    if (S.sort !== 'featured') q.set('sort', S.sort);
    history.replaceState(null, '', location.pathname + (q.size ? `?${q}` : ''));
  };

  // ---------- filtering ----------
  const words = (s) => s.toLowerCase().split(/[^a-z0-9₹]+/).filter(Boolean);
  const hay = Object.fromEntries(ALL.map((p) => [p.sku, `${p.name} ${p.themeName || ''} ${p.type} ${p.category} ${p.text} ${p.age ? 'kids children age' : ''}`.toLowerCase()]));
  const priceOk = (p) => !S.price || PRICES.find(([k]) => k === S.price)[2](p.price);
  const matches = (p, skip) => (skip === 'cat' || !S.cat || p.category === S.cat)
    && (skip === 'topic' || !S.topic || p.theme === S.topic)
    && (skip === 'type' || !S.type || p.family === S.type)
    && (skip === 'price' || priceOk(p))
    && words(S.q).every((w) => hay[p.sku].includes(w));
  const featuredRank = (p) => (p.featured ? 0 : p.family === 'bundle' ? 1 : 2);
  function results() {
    const list = ALL.filter((p) => matches(p));
    const cmp = SORTS[S.sort][1];
    return cmp ? list.sort(cmp) : list.sort((a, b) => featuredRank(a) - featuredRank(b));   // stable: catalogue order inside each group
  }

  // ---------- cards ----------
  const img = (src, cls) => h('img', { src: asset(src), alt: '', loading: 'lazy', decoding: 'async', class: cls });
  const save = (p) => (p.worth ? p.worth - p.price : 0);
  function cover(p) {
    const href = asset(`shop/${p.sku}`);
    if (p.family === 'bundle') {
      const inc = p.includes.map((s) => bySku[s]).filter((x) => x && x.shots && x.shots[0]);
      const picks = [inc[0], inc[Math.floor(inc.length / 2)], inc[inc.length - 1]].filter(Boolean);
      return h('a', { class: 'shot shot-bundle', href, tabindex: '-1', 'aria-hidden': 'true' },
        h('div', { class: 'fan' }, picks.map((x) => img(x.shots[0]))), h('span', { class: 'n', text: `${p.includes.length} products` }));
    }
    return h('a', { class: 'shot', href, tabindex: '-1', 'aria-hidden': 'true' },
      p.shots[0] ? img(p.shots[0]) : null, p.shots[1] ? img(p.shots[1], 'alt') : null);
  }
  function card(p) {
    const buy = h('button', { class: 'btn btn-small', type: 'button', text: 'Buy', 'data-cursor': 'Buy', 'aria-label': `Buy ${p.name} for ${rupees(p.price)}`, onclick: () => window.CO.checkout(p) });
    return h('li', { class: 'product', id: p.sku, 'data-sku': p.sku },
      cover(p),
      p.family === 'bundle' ? h('span', { class: 'badge', text: `Save ${rupees(save(p))}` }) : p.featured ? h('span', { class: 'badge quiet', text: 'Featured' }) : null,
      h('div', { class: 'body' },
        h('p', { class: 'p-meta', text: p.family === 'bundle' ? 'Bundle' : `${p.themeName} · ${p.type}` }),
        h('h3', {}, h('a', { href: asset(`shop/${p.sku}`), text: p.name })),
        h('p', { class: 'p-unit', text: p.unit }),
        h('div', { class: 'row' }, h('span', { class: 'price' }, rupees(p.price), p.worth ? h('s', { text: rupees(p.worth) }) : null), buy)));
  }

  // ---------- chrome ----------
  const bar = h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Categories' });
  const sortSel = h('select', { class: 'sel', id: 'sort', 'aria-label': 'Sort products', onchange: (e) => { S.sort = e.target.value; S.shown = PAGE; update(); } },
    Object.entries(SORTS).map(([k, [label]]) => h('option', { value: k, text: label })));
  const toggle = h('button', { class: 'btn btn-ghost btn-small filter-toggle', type: 'button', 'aria-expanded': 'false', 'aria-controls': 'filters', text: 'Filters',
    onclick: () => { const open = filtersEl.classList.toggle('open'); toggle.setAttribute('aria-expanded', String(open)); } });
  $('#shop-bar').append(bar, toggle, h('label', { class: 'sort' }, h('span', { text: 'Sort' }), sortSel));

  const filtersEl = $('#filters');
  const group = (title, key, opts) => h('section', { class: 'f-group', 'data-key': key }, h('h2', { text: title }), h('ul', { class: 'f-list' }, opts.map(([value, label]) =>
    h('li', {}, h('button', { class: 'f-opt', type: 'button', 'data-v': value, onclick: () => { S[key] = S[key] === value ? '' : value; S.shown = PAGE; update(); } }, h('span', { text: label }), h('small'))))));
  filtersEl.append(
    group('Topic', 'topic', topics),
    group('Type', 'type', types),
    group('Price', 'price', PRICES.map(([k, l]) => [k, l])),
    h('button', { class: 'btn btn-ghost btn-small f-clear', type: 'button', text: 'Clear all filters', onclick: () => { S = { ...read(), cat: '', topic: '', type: '', price: '', q: '', sort: 'featured', shown: PAGE }; search.value = ''; update(); } }));

  const search = $('#shop-q'), clearQ = $('#shop-q-clear');
  search.addEventListener('input', () => { S.q = search.value.trim().slice(0, 60); S.shown = PAGE; clearQ.hidden = !search.value; update(true); });
  clearQ.addEventListener('click', () => { search.value = ''; S.q = ''; clearQ.hidden = true; S.shown = PAGE; update(); search.focus(); });
  $('#shop-search').addEventListener('submit', (e) => { e.preventDefault(); grid.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }); });

  const count = $('#shop-count'), chips = $('#shop-chips'), more = $('#shop-more'), none = $('#shop-none');
  function counts() {
    // each facet shows how many products it would give with every other filter kept
    for (const g of filtersEl.querySelectorAll('.f-group')) {
      const key = g.dataset.key;
      for (const b of g.querySelectorAll('.f-opt')) {
        const was = S[key]; S[key] = b.dataset.v;
        const n = ALL.filter((p) => matches(p)).length;
        S[key] = was;
        b.querySelector('small').textContent = n; b.disabled = !n && was !== b.dataset.v;
        b.setAttribute('aria-pressed', String(was === b.dataset.v));
      }
    }
    bar.querySelectorAll('[role=tab]').forEach((t) => {
      const was = S.cat; S.cat = t.dataset.cat;
      t.querySelector('small').textContent = ALL.filter((p) => matches(p)).length; S.cat = was;
      t.setAttribute('aria-selected', String(t.dataset.cat === (S.cat || '')));
    });
  }
  CATS.length && [['', 'All'], ...CATS.map((c) => [c, c])].forEach(([c, label]) => bar.append(h('button', { type: 'button', role: 'tab', 'data-cat': c, onclick: () => { S.cat = c; S.shown = PAGE; update(); } }, label, h('small'))));

  let renderedKey = '';
  function update(typing) {
    const list = results();
    write(); counts();
    sortSel.value = S.sort;
    window.CO.ink && window.CO.ink(bar, '[role=tab]', '[aria-selected=true]');
    const total = ALL.length;
    count.innerHTML = '';
    count.append(h('b', { text: String(list.length) }), ` of ${total} products`);
    const active = [['cat', S.cat], ['topic', S.topic && topics.find(([t]) => t === S.topic)[1]], ['type', S.type && types.find(([t]) => t === S.type)[1]],
      ['price', S.price && PRICES.find(([k]) => k === S.price)[1]], ['q', S.q && `“${S.q}”`]].filter(([, v]) => v);
    chips.replaceChildren(...active.map(([k, v]) => h('button', { class: 'chip-x', type: 'button', text: v, 'aria-label': `Remove filter ${v}`, onclick: () => { S[k] = ''; if (k === 'q') { search.value = ''; clearQ.hidden = true; } S.shown = PAGE; update(); } })));
    none.hidden = list.length > 0;

    const key = JSON.stringify([S.cat, S.topic, S.type, S.price, S.q, S.sort]);
    const fresh = key !== renderedKey; renderedKey = key;
    const shown = list.slice(0, S.shown);
    const have = fresh ? 0 : grid.children.length;
    if (fresh) grid.replaceChildren();
    const nodes = shown.slice(have).map(card);
    grid.append(...nodes);
    more.hidden = list.length <= S.shown;
    more.querySelector('button').textContent = `Show ${Math.min(PAGE, list.length - S.shown)} more`;
    if (nodes.length && !reduce && !typing) {
      if (window.gsap) window.gsap.fromTo(nodes.slice(0, 18), { y: 26, opacity: 0 }, { y: 0, opacity: 1, duration: .6, ease: 'power3.out', stagger: .035, clearProps: 'transform,opacity' });
      else nodes.slice(0, 18).forEach((li, i) => li.animate([{ opacity: 0, transform: 'translateY(18px)' }, { opacity: 1, transform: 'none' }], { duration: 520, delay: i * 35, easing: 'cubic-bezier(.2,.9,.2,1)', fill: 'backwards' }));
    }
    window.__coFilter = { skus: list.map((p) => p.sku), active: active.length > 0 };
    window.dispatchEvent(new CustomEvent('co:filter', { detail: window.__coFilter }));
  }
  more.querySelector('button').addEventListener('click', () => { S.shown += PAGE; update(); });
  grid.addEventListener('pointerover', (e) => { const li = e.target.closest('.product'); window.dispatchEvent(new CustomEvent('co:hover', { detail: li ? li.dataset.sku : null })); });
  grid.addEventListener('pointerleave', () => window.dispatchEvent(new CustomEvent('co:hover', { detail: null })));

  search.value = S.q; clearQ.hidden = !S.q;
  update();
})();
