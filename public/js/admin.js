// Private orders log. The password is checked by /api/admin (ADMIN_KEY on Vercel) and kept on this device only.
(() => {
  const { $, h, toast } = window.CO;
  const rupees = window.CO.rupees || ((n) => `₹${Number(n).toLocaleString('en-IN')}`);
  const form = $('#admin-login'), app = $('#admin-app');
  let key = ''; try { key = localStorage.getItem('co-admin') || ''; } catch (err) {}
  let data = null, tab = 'pending', timer;
  const api = (method, body) => fetch('/api/admin', { method, cache: 'no-store',
    headers: { 'x-admin-key': key, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body && JSON.stringify(body) })
    .then(async (r) => { const j = await r.json().catch(() => ({})); if (!r.ok) throw Object.assign(new Error(j.error || 'Error'), { status: r.status }); return j; });

  async function load(quiet) {
    try {
      data = await api('GET'); form.hidden = true; app.hidden = false; render();
      try { localStorage.setItem('co-admin', key); } catch (err) {}
    } catch (err) {
      if (err.status === 401) { form.hidden = false; app.hidden = true; form.querySelector('.form-msg').textContent = key ? 'Wrong password.' : ''; }
      else if (!quiet) toast(err.message);
    }
    clearTimeout(timer); timer = setTimeout(() => load(true), 30000);
  }
  form.addEventListener('submit', (e) => { e.preventDefault(); key = new FormData(form).get('key'); load(); });

  const when = (s) => new Date(s).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  async function setStatus(o, status) {
    if (status === 'rejected' && !confirm(`Mark ${o.id} as not paid? The buyer will see a "couldn't match" message.`)) return;
    try { await api('POST', { id: o.id, status }); toast(`${o.id}: ${status}`); load(); } catch (err) { toast(err.message); }
  }
  function csv() {
    const cols = ['id', 'createdAt', 'kind', 'product', 'amount', 'status', 'name', 'email', 'utr', 'downloads', 'note'];
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const text = [cols.join(','), ...data.orders.map((o) => cols.map((c) => esc(o[c])).join(','))].join('\n');
    const a = h('a', { href: URL.createObjectURL(new Blob([text], { type: 'text/csv' })), download: `curious-orbit-orders-${new Date().toISOString().slice(0, 10)}.csv` });
    document.body.append(a); a.click(); a.remove();
  }

  function render() {
    const { orders, totals } = data;
    const count = (s) => orders.filter((o) => s === 'all' || o.status === s).length;
    const shown = orders.filter((o) => tab === 'all' || o.status === tab);
    const stat = (k, v, sub) => h('div', { class: 'stat' }, h('span', { class: 'label', text: k }), h('b', { text: v }), h('small', { text: sub }));
    app.replaceChildren(
      h('div', { class: 'stats' },
        stat('Earned', rupees(totals.earned), `${totals.approvedCount} approved`),
        stat('To check', rupees(totals.pending), `${totals.pendingCount} waiting`),
        stat('All records', String(orders.length), 'orders and tips')),
      h('div', { class: 'tabs', role: 'tablist' }, ['pending', 'approved', 'rejected', 'all'].map((t) =>
        h('button', { type: 'button', role: 'tab', 'aria-selected': String(t === tab), text: `${t} (${count(t)})`, onclick: () => { tab = t; render(); } })),
        h('button', { type: 'button', class: 'btn btn-ghost btn-small', text: 'Download CSV', onclick: csv }),
        h('button', { type: 'button', class: 'btn btn-ghost btn-small', text: 'Refresh', onclick: () => load() })),
      shown.length ? h('ul', { class: 'orders' }, shown.map((o) => h('li', { class: `ord ord-${o.status}` },
        h('div', { class: 'ord-main' },
          h('p', { class: 'label', text: `${o.id} · ${o.kind} · ${when(o.createdAt)}` }),
          h('h3', {}, `${o.product} `, h('span', { class: 'ember', text: rupees(o.amount) })),
          h('p', { class: 'ord-who' }, h('b', { text: o.name }), ' · ', h('a', { href: `mailto:${o.email}`, text: o.email })),
          h('p', { class: 'ord-utr' }, 'UTR ', h('code', { text: o.utr }),
            h('button', { type: 'button', class: 'linkish', text: 'copy', onclick: () => navigator.clipboard.writeText(o.utr).then(() => toast('UTR copied')) })),
          o.status === 'approved' && o.kind === 'order' ? h('p', { class: 'ord-dl', text: `Downloaded ${o.downloads || 0} time${o.downloads === 1 ? '' : 's'}` }) : null),
        h('div', { class: 'ord-act' },
          o.status !== 'approved' && h('button', { class: 'btn btn-small', type: 'button', text: 'Approve', onclick: () => setStatus(o, 'approved') }),
          o.status !== 'rejected' && h('button', { class: 'btn btn-ghost btn-small', type: 'button', text: 'Not paid', onclick: () => setStatus(o, 'rejected') }),
          o.status !== 'pending' && h('button', { class: 'btn btn-ghost btn-small', type: 'button', text: 'Back to pending', onclick: () => setStatus(o, 'pending') })))))
        : h('p', { class: 'empty', text: tab === 'pending' ? 'Nothing waiting. New payments show up here.' : 'No records here yet.' }),
      h('p', { class: 'tip-note', text: 'Before approving: open your UPI app, find a payment with this UTR and the same amount. Then tap Approve and the buyer\'s download unlocks straight away.' }));
  }
  if (key) load(); else form.hidden = false;
})();
