// Fact pages (facts/day-NN.html): swipeable carousel, shop cards, and no spoilers before the post time.
(() => {
  const { $, renderShop } = window.CO;
  const art = $('.fact');
  const n = +art.dataset.day;
  const day = (window.CO_DAYS || []).find((d) => d.n === n);
  const holder = $('[data-carousel]');
  if (day && holder) holder.replaceWith(window.CO.carousel(day));
  const preview = /preview/.test(location.hash);
  if (!preview && Date.now() < new Date(art.dataset.post)) {
    $('.fact-grid').hidden = true;
    $('.fact-locked').hidden = false;
  }
  renderShop($('#products'));
})();
