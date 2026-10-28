# Curious Orbit website

Static site, no build step. Vercel serves `public/` (see `vercel.json`).

- `public/index.html`, `home.css`, `js/home.js`, `js/space.js`: the home page. `styles.css` + `js/common.js` are shared by every page. Motion uses the Motion Reel Kit spring engine (`js/motion.js`, copied from motion-reel-kit/shared/engine-lib).
- `public/js/days.js`: generated from the fact-checked playbook + day folders by `python3 tools/make-data.py`. Re-run after each new day is made, after copying its web media into `public/media/` (reels: 720p H.264 `dayNN.mp4` + `dayNN-cover.webp`; slides/posts: 864 px webp `dayNN-slide-NN.webp` / `dayNN-post.webp`), and add the day's title in `make-data.py`.
- Days appear only after their post time in the visitor's local time (reels 7 pm, others 1 pm). Add `#preview` to the URL to see every made day.
- `tools/artifact-build.py OUT.html` makes the claude.ai preview copy.

## Making money (all in `public/js/config.js`)
Everything marked DUMMY is a placeholder. `demo: true` shows an orange "Demo mode" banner and makes buy/tip buttons and signup forms show a notice instead of doing anything. To go live: fill in the real values, set `demo: false`, then rebuild (below).
- Email list "The Daily Orbit": forms post to `api/subscribe.js` (beehiiv). Set `BEEHIIV_API_KEY` and `BEEHIIV_PUBLICATION_ID` in Vercel, then `newsletterLive: true`.
- Orbit Shop: see **The shop** below. (The old Gumroad links in `shop` are unused.)
- `upi.id` (tip jar: UPI ID, shown with a QR code; Indian payments only), `sponsorEmail`, `siteUrl` (real domain, used in sitemap and share links).
- Media kit (`tools/build-pages.py`, MEDIA_KIT): audience numbers and rates are SAMPLE figures. Replace them with real ones before pitching brands.

## The shop (marketplace)
About 130 listings: 107 products (quiz packs, fact cards, posters, wallpapers, true-or-false, bingo, kids packs across 15 topics) and 25 bundles. Files are made by the generator in the project's shop folder (`build/gen/gen.js`), then:

    PRODUCT_KEY=<64 hex> node tools/shop-build.mjs   # merges lib/catalog-base.json + catalog-gen.json, adds bundles, encrypts files into products/, copies previews
    python3 tools/build-pages.py                       # shop.html, shop/<sku>.html (one page per listing), catalog.js, sitemap

- `PRODUCT_KEY` must equal the `PRODUCT_KEY` env var on Vercel (api/download.js decrypts with it). Encryption is deterministic, so re-running with the same key changes nothing in git. To rotate: new key, re-run, set the same value on Vercel, redeploy.
- Bundle prices come from the `BUNDLE_RATE` table at the top of `tools/shop-build.mjs`.
- `public/shop.css`, `js/shop.js` (search, filters, sort, URL state), `js/shop-orbit.js` (three.js product orbit), `js/product.js`, `js/order.js`.
- Payments: UPI. Manual mode (pay the UPI ID, send the UTR, approve on /admin) always works; an optional self-hosted gateway auto-approves paid orders. See `docs/UPI-GATEWAY.md`.
- Local preview with the API: `node tools/dev-server.mjs`; checks: `node tools/test-shop.mjs`.

## Rebuild after changes (adding a day, new siteUrl)
    python3 tools/make-data.py      # days.js from the playbook, day folders and fact-check sources
    python3 tools/build-pages.py    # facts/day-NN.html, media-kit, privacy, terms, 404, sitemap, robots
    NODE_PATH=$(npm root -g) node tools/make-og.js   # share images (needs Playwright)

## Pages
- `/` home (index.html + home.css + js/home.js + js/space.js): preloader, 3D orbit hero you fly through (three.js), manifesto that lights up word by word, today's fact in a tilting frame, fact marquee, horizontal scrolling log, fact-check counter, newsletter, shop, link rows, giant wordmark footer. Scroll by GSAP ScrollTrigger + Lenis; libraries are vendored in `public/vendor/` (no CDN needed).
- `/facts/day-NN` one page per fact with the story, sources, signup and shop (no spoilers before post time)
- `/media-kit`, `/privacy`, `/terms`, `404`

## Putting it online (no git needed)
1. On github.com: New repository, e.g. `curious-orbit-site`, then "uploading an existing file" and drag in the contents of this folder (unzipped).
2. On vercel.com: Add New > Project > import that repo > Deploy. No settings needed (`vercel.json` points it at `public/`).
