// Product page: the Buy button opens the checkout, and the small previews swap the big one.
(() => {
  const { $, PRODUCTS, checkout, toast } = window.CO;
  const btn = $('[data-buy]');
  if (btn) btn.addEventListener('click', () => {
    const p = PRODUCTS.find((x) => x.sku === btn.dataset.buy);
    if (p && p.fileCount) checkout(p); else toast('This one is not ready yet.');
  });
  const stage = $('#stage-img');
  document.querySelectorAll('.thumbs button').forEach((b) => b.addEventListener('click', () => {
    stage.src = b.dataset.src;
    document.querySelectorAll('.thumbs button').forEach((o) => o.setAttribute('aria-pressed', String(o === b)));
  }));
})();
