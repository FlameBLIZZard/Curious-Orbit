# Curious Orbit website

Static site, no build step. Vercel serves `public/` (see `vercel.json`).

- `public/index.html`, `home.css`, `js/home.js`, `js/space.js`: the home page. `styles.css` + `js/common.js` are shared by every page. Motion uses the Motion Reel Kit spring engine (`js/motion.js`, copied from motion-reel-kit/shared/engine-lib).
- `public/js/days.js`: generated from the fact-checked playbook + day folders by `python3 tools/make-data.py`. Re-run after each new day is made, after copying its web media into `public/media/` (reels: 720p H.264 `dayNN.mp4` + `dayNN-cover.webp`; slides/posts: 864 px webp `dayNN-slide-NN.webp` / `dayNN-post.webp`), and add the day's title in `make-data.py`.
- Days appear only after their post time in the visitor's local time (reels 7 pm, others 1 pm). Add `#preview` to the URL to see every made day.
- `tools/artifact-build.py OUT.html` makes the claude.ai preview copy.

## Making money (all in `public/js/config.js`)
Everything marked DUMMY is a placeholder. `demo: true` shows an orange "Demo mode" banner and makes buy/tip buttons and signup forms show a notice instead of doing anything. To go live: fill in the real values, set `demo: false`, then rebuild (below).
- Email list "The Daily Orbit": forms post to `api/subscribe.js` (beehiiv). Set `BEEHIIV_API_KEY` and `BEEHIIV_PUBLICATION_ID` in Vercel, then `newsletterLive: true`.
- Orbit Shop: each product's Gumroad / Lemon Squeezy link in `shop`. Empty = waitlist signup instead of a buy button. The products themselves still need making.
- `upi.id` (tip jar: UPI ID, shown with a QR code; Indian payments only), `sponsorEmail`, `siteUrl` (real domain, used in sitemap and share links).
- Media kit (`tools/build-pages.py`, MEDIA_KIT): audience numbers and rates are SAMPLE figures. Replace them with real ones before pitching brands.

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
