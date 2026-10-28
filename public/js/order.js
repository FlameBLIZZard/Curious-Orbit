// The buyer's order page (/order?id=…&k=…): waiting, paid with downloads, or a problem.
(() => {
  const { $, h, rupees, IG } = window.CO;
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
      if (o.status === 'pending' || o.status === 'awaiting') timer = setTimeout(load, o.via === 'gateway' ? 6000 : 20000);
    } catch (err) { title.textContent = 'Something went wrong.'; body.replaceChildren(h('p', { text: err.message })); }
  }

  const downloads = (files) => {
    const link = (f) => h('li', {}, h('a', { class: 'dl', href: f.url, download: f.name },
      h('span', { class: 'dl-name', text: f.label || f.name }), h('span', { class: 'dl-size', text: f.size ? kb(f.size) : '' }), h('i', { 'aria-hidden': 'true', text: '↓' })));
    if (!files.some((f) => f.group)) return h('ul', { class: 'downloads' }, files.map(link));
    const groups = [...new Set(files.map((f) => f.group))];   // a bundle: one heading per product it contains
    return h('div', { class: 'dl-groups' }, groups.map((g) => h('details', { class: 'dl-group', open: groups.length < 4 },
      h('summary', {}, g, h('small', { text: ` ${files.filter((f) => f.group === g).length} file${files.filter((f) => f.group === g).length === 1 ? '' : 's'}` })),
      h('ul', { class: 'downloads' }, files.filter((f) => f.group === g).map(link)))));
  };
  const copyLink = () => h('button', { class: 'btn btn-ghost btn-small', type: 'button', text: 'Copy this page\'s link', onclick: async (e) => {
    try { await navigator.clipboard.writeText(location.origin + `/order?id=${id}&k=${k}`); e.target.textContent = 'Copied'; } catch (err) { e.target.textContent = 'Copy it from the address bar'; }
  } });
  const spin = (text) => h('p', { class: 'waiting' }, h('span', { class: 'orbit-spin', 'aria-hidden': 'true' }), text);

  function render(o) {
    const meta = h('p', { class: 'meta', text: `${o.id} · ${o.product} · ${rupees(o.amount)} · ${new Date(o.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}` });
    if (o.status === 'approved' && o.kind === 'tip') {
      title.replaceChildren('Thank you for the ', h('span', { class: 'ember', text: 'tip.' }));
      body.replaceChildren(meta, h('p', { text: 'It really does keep the facts coming.' }));
    } else if (o.status === 'approved') {
      title.replaceChildren('Paid. Your files are ', h('span', { class: 'ember', text: 'ready.' }));
      body.replaceChildren(meta,
        h('p', { text: 'Tap each file to download it. This link keeps working, so bookmark it.' }),
        downloads(o.files), h('p', {}, copyLink()));
    } else if (o.status === 'rejected') {
      title.replaceChildren('We couldn\'t match this ', h('span', { class: 'ember', text: 'payment.' }));
      body.replaceChildren(meta, h('p', {}, 'The UPI reference didn\'t match a payment we received. If you did pay, message us on Instagram at ', igLink(), ' with a screenshot of the payment and we\'ll sort it out.'));
    } else if (o.status === 'failed') {
      title.replaceChildren('The payment didn\'t ', h('span', { class: 'ember', text: 'go through.' }));
      body.replaceChildren(meta,
        h('p', { text: 'Nothing was taken for this order, or the checkout expired. You can try again from the product page.' }),
        h('p', {}, h('a', { class: 'btn btn-small', href: `shop/${o.sku}`, text: 'Back to the product' })),
        h('p', {}, 'Money left your account? Message ', igLink(), ' with your order number and a screenshot.'));
    } else if (o.status === 'awaiting') {
      title.replaceChildren('Waiting for your ', h('span', { class: 'ember', text: 'payment.' }));
      body.replaceChildren(meta, spin('Waiting for the UPI payment'),
        h('p', { text: 'Finish paying on the checkout page. Come back here afterwards: this page refreshes by itself and your downloads appear as soon as the bank confirms.' }),
        o.checkoutUrl ? h('p', {}, h('a', { class: 'btn btn-small', href: o.checkoutUrl, text: 'Open the checkout again' })) : null, h('p', {}, copyLink()));
    } else {
      const seen = o.via === 'gateway' && o.gateway === 'observed';
      title.replaceChildren(seen ? 'Payment spotted, confirming with the ' : 'Checking your ', h('span', { class: 'ember', text: seen ? 'bank.' : 'payment.' }));
      body.replaceChildren(meta, spin(seen ? 'Waiting for the bank to confirm' : 'Waiting for the payment check'),
        h('p', { text: o.via === 'gateway' ? 'This usually takes a minute or two. This page refreshes by itself and your downloads appear here as soon as it\'s confirmed.'
          : 'We match every UPI reference by hand, usually within a few hours. This page refreshes by itself and your downloads appear here as soon as it\'s confirmed.' }),
        h('p', {}, 'Bookmark this page or copy its link. Questions? Message ', igLink(), ' with your order number.'), h('p', {}, copyLink()));
    }
  }
  load();
})();
