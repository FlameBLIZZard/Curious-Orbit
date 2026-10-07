// Shop page (all products) and the buyer's order page (/order?id=…&k=…).
(() => {
  const { $, h, renderShop, rupees, IG } = window.CO;
  renderShop($('#products'));

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
            h('span', { class: 'dl-name', text: f.label || f.name }), h('span', { class: 'dl-size', text: f.size ? kb(f.size) : '' }), h('i', { 'aria-hidden': 'true', text: '↓' }))))));
    } else if (o.status === 'rejected') {
      title.replaceChildren('We couldn\'t match this ', h('span', { class: 'ember', text: 'payment.' }));
      body.replaceChildren(meta, h('p', {}, 'The UPI reference didn\'t match a payment we received. If you did pay, message us on Instagram at ', igLink(), ' with a screenshot of the payment and we\'ll sort it out.'));
    } else {
      title.replaceChildren('Checking your ', h('span', { class: 'ember', text: 'payment.' }));
      body.replaceChildren(meta,
        h('p', { text: 'We match every UPI reference by hand, usually within a few hours. This page refreshes by itself and your downloads appear here as soon as it\'s confirmed.' }),
        h('p', {}, 'Bookmark this page or copy its link. Questions? Message ', igLink(), ' with your order number.'),
        h('button', { class: 'btn btn-ghost btn-small', type: 'button', text: 'Copy this page\'s link', onclick: async (e) => {
          try { await navigator.clipboard.writeText(location.origin + `/order?id=${id}&k=${k}`); e.target.textContent = 'Copied'; } catch (err) { e.target.textContent = 'Copy it from the address bar'; }
        } }));
    }
  }
  load();
})();
