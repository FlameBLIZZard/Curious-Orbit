"""Builds the extra pages from public/js/days.js and public/js/config.js:
facts/day-NN.html (one page per made day, with sources), media-kit.html, privacy.html, terms.html,
404.html, sitemap.xml and robots.txt.
Run from the curious-orbit-site folder: python3 tools/make-data.py && python3 tools/build-pages.py"""
import json, re, html, pathlib, datetime

ROOT = pathlib.Path(__file__).resolve().parent.parent
PUB = ROOT / 'public'
days = json.loads(re.search(r'window\.CO_DAYS = (\[.*\]);', (PUB / 'js/days.js').read_text(), re.S).group(1))
cfg_js = (PUB / 'js/config.js').read_text()
SITE = re.search(r"siteUrl:\s*'([^']+)'", cfg_js).group(1).rstrip('/')
made = [d for d in days if d.get('title')]
e = html.escape
pad = lambda n: f'{n:02d}'
TODAY = datetime.date.today().isoformat()
import hashlib
# Cache-buster: changes whenever any local CSS/JS changes, so browsers never mix old and new files.
V = hashlib.sha1(b''.join(f.read_bytes() for f in sorted([*PUB.glob('*.css'), *PUB.glob('js/*.js')]) if f.name != 'catalog.js')
                 + (ROOT / 'lib/catalog.json').read_bytes()).hexdigest()[:8]

FONTS = ('<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
         '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Space+Grotesk:wght@400;500;700&display=swap">')


def page(title, desc, body, *, base='', path='', og=None, extra_head='', scripts=()):
    og = og or 'media/og/home.jpg'
    scripts = ['vendor/lenis.min.js', 'js/config.js', 'js/catalog.js', 'js/motion.js', 'js/common.js', 'js/chrome.js', 'js/micro.js', *scripts]
    return f'''<!doctype html>
<html lang="en" data-base="{base}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{e(title)}</title>
<meta name="description" content="{e(desc)}">
<meta name="theme-color" content="#0B0E17">
<link rel="canonical" href="{SITE}/{path}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Curious Orbit">
<meta property="og:title" content="{e(title)}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:image" content="{SITE}/{og}">
<meta property="og:url" content="{SITE}/{path}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="{base}media/profile.png">
<link rel="apple-touch-icon" href="{base}apple-touch-icon.png">
{FONTS}
<link rel="stylesheet" href="{base}styles.css?v={V}">
<link rel="stylesheet" href="{base}chrome.css?v={V}">
<link rel="stylesheet" href="{base}micro.css?v={V}">
{extra_head}</head>
<body class="sub">
<canvas class="stars" id="stars" aria-hidden="true"></canvas>
<div class="grain" aria-hidden="true"></div>
<div class="cursor" id="cursor" aria-hidden="true"><span class="cursor-ring"></span><span class="cursor-dot"></span><span class="cursor-label" id="cursor-label"></span></div>
<div class="demo-banner" data-demo-banner hidden>Demo mode: email signups are placeholders</div>
{hud(base)}
<main>
{body}
</main>
{footer(base)}
{''.join(f'<script src="{base}{s}?v={V}"></script>' + chr(10) for s in scripts)}<script>CO.wireMoney();</script>
</body>
</html>
'''


def hud(base=''):
    # Same header as the home page (index.html), plus the mobile menu
    links = [('index.html#log', 'The log'), ('shop.html', 'Shop'), ('media-kit.html', 'Advertise')]
    nav = ''.join(f'<a href="{base}{h}" data-cursor="Go">{t}</a>' for h, t in links)
    menu = ''.join(f'<a href="{base}{h}">{t}</a>' for h, t in [('index.html', 'Home'), *links])
    return f'''<header class="hud" id="hud">
  <a class="brand" href="{base}index.html" aria-label="Curious Orbit home">
    <svg class="mark" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="13" fill="none" stroke="currentColor" stroke-width="3.2"/><circle cx="31.3" cy="13.5" r="4.4" class="ember-fill"/></svg>
    <span>Curious Orbit</span>
  </a>
  <nav class="hud-nav" aria-label="Sections">{nav}</nav>
  <a class="pill" data-ig href="https://www.instagram.com/curiousorbit.daily/" target="_blank" rel="noopener" data-cursor="Follow">Follow</a>
  <button class="menu-btn" id="menu-btn" type="button" aria-controls="menu" aria-expanded="false">Menu</button>
</header>
<nav class="menu" id="menu" aria-label="Menu">{menu}<a data-ig href="https://www.instagram.com/curiousorbit.daily/" target="_blank" rel="noopener">Instagram</a><p class="menu-foot">@curiousorbit.daily · one true fact at a time</p></nav>'''


def footer(base=''):
    return f'''<footer class="big-foot">
  <div class="wrap foot-top">
    <p class="foot-line">Follow for <span class="ember">a fact a day.</span></p>
    <nav class="foot-links" aria-label="Site">
      <a href="{base}facts/index.html">All facts</a>
      <a href="{base}shop.html">Shop</a>
      <a href="{base}media-kit.html">Media kit</a>
      <a href="{base}privacy.html">Privacy</a>
      <a href="{base}terms.html">Terms</a>
      <a data-ig href="https://www.instagram.com/curiousorbit.daily/" target="_blank" rel="noopener">Instagram</a>
    </nav>
  </div>
  <p class="wordmark" aria-hidden="true">Curious<span class="o"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="38" fill="none" stroke="currentColor" stroke-width="9"/><circle cx="83" cy="31" r="9" class="ember-fill"/></svg></span>rbit</p>
  <div class="wrap foot-bottom"><span>© 2026 Curious Orbit</span><span>Made on Earth. Checked against space.</span></div>
</footer>'''


def signup_band(source):
    return f'''<section class="daily wrap" aria-labelledby="daily-{source}">
  <div class="daily-card">
    <div class="daily-copy">
      <p class="label">The Daily Orbit · free newsletter</p>
      <h2 id="daily-{source}">Get tomorrow's fact <span class="ember">first.</span></h2>
      <p>One fact every morning with the full story and the source we checked. Two minutes with your coffee.</p>
    </div>
    <form class="signup signup-stack" data-source="{source}" novalidate>
      <label class="sr" for="email-{source}">Email address</label>
      <input id="email-{source}" name="email" type="email" autocomplete="email" placeholder="you@email.com" required>
      <button class="btn" type="submit">Subscribe free</button>
      <p class="form-msg" aria-live="polite">No spam. Unsubscribe in one click.</p>
    </form>
  </div>
</section>'''


def media_html(d, base):
    if d['format'] == 'reel':
        return (f'<div class="frame reel"><video controls playsinline preload="metadata" poster="{base}{d["poster"]}" '
                f'src="{base}{d["video"]}" aria-label="Fact {d["n"]} reel: {e(d["title"])}"></video></div>')
    if d['format'] == 'post':
        return f'<div class="frame post"><img src="{base}{d["images"][0]}" alt="Fact {d["n"]} post: {e(d["title"])}"></div>'
    imgs = ''.join(f'<img src="{base}{src}" alt="Slide {i + 1} of {len(d["images"])}" loading="{"eager" if i == 0 else "lazy"}">'
                   for i, src in enumerate(d['images']))
    return f'<div class="frame carousel" data-carousel="{d["n"]}"><div class="track" tabindex="0">{imgs}</div></div>'


def fact_page(d, i):
    base = '../'
    n = d['n']
    when = datetime.date.fromisoformat(d['date']).strftime('%A %-d %B %Y')
    prev_d = made[i - 1] if i > 0 else None
    next_d = made[i + 1] if i + 1 < len(made) else None
    check = d.get('check', {'claims': 0, 'sources': []})
    sources = ''.join(f'<li><a href="{e(s["url"])}" target="_blank" rel="noopener">{e(s["name"])}</a></li>' for s in check['sources'])
    caption = ''.join(f'<p>{e(p)}</p>' for p in d['caption'])
    tags = ' '.join(d['tags'])
    ld = {'@context': 'https://schema.org', '@type': 'Article', 'headline': d['title'], 'description': d['summary'],
          'datePublished': d['date'], 'image': f'{SITE}/media/og/day{pad(n)}.jpg', 'url': f'{SITE}/facts/day-{pad(n)}',
          'author': {'@type': 'Organization', 'name': 'Curious Orbit'},
          'citation': [s['url'] for s in check['sources']]}
    nav = '<nav class="pager" aria-label="More facts">'
    nav += (f'<a href="day-{pad(prev_d["n"])}.html"><small>← Fact {pad(prev_d["n"])}</small>{e(prev_d["title"])}</a>' if prev_d else '<span></span>')
    nav += (f'<a class="next" href="day-{pad(next_d["n"])}.html"><small>Fact {pad(next_d["n"])} →</small>{e(next_d["title"])}</a>' if next_d else '<span></span>')
    nav += '</nav>'
    body = f'''<article class="fact wrap" data-day="{n}" data-post="{d['date']}T{'00' if d.get('posted') or d.get('made') else '19' if d['time'].startswith('7') else '13'}:00:00">
  <div class="fact-grid">
    <div class="fact-media">{media_html(d, base)}</div>
    <div class="fact-text">
      <p class="label">{e(d['topic'])} · Fact {pad(n)} · {d['format']}</p>
      <h1>{e(d['title'])}</h1>
      <p class="meta">{'On Instagram now' if d.get('posted') else 'New · coming to Instagram soon' if d.get('made') else 'Posted ' + when}</p>
      <div class="story">{caption}</div>
      <aside class="sources" aria-labelledby="src-{n}">
        <h2 id="src-{n}">How we checked this</h2>
        <p>{check['claims']} claim{'s' if check['claims'] != 1 else ''} in this post, checked against:</p>
        <ul>{sources}</ul>
      </aside>
      <p class="tags">{e(tags)}</p>
      <div class="actions">
        <a class="btn" data-ig href="https://www.instagram.com/curiousorbit.daily/" target="_blank" rel="noopener">See it on Instagram</a>
        <a class="btn btn-ghost" href="index.html">All facts</a>
      </div>
    </div>
  </div>
  <div class="fact-locked" hidden>
    <p class="label">Fact {pad(n)} · {d['format']}</p>
    <h1>This fact drops <span class="ember">{datetime.date.fromisoformat(d['date']).strftime('%a %-d %b')}, {d['time']}.</span></h1>
    <p>No spoilers. Get it in your inbox the morning after, or follow along on Instagram.</p>
  </div>
  {nav}
</article>
{signup_band(f'fact{pad(n)}')}
<section class="shop wrap" aria-labelledby="shop-{n}">
  <div class="section-head"><div><p class="label">The Orbit Shop</p><h2 id="shop-{n}">Liked this one? <span class="ember">Take 50 more offline.</span></h2></div></div>
  <ul class="products" id="products"></ul>
</section>'''
    head = f'<script type="application/ld+json">{json.dumps(ld)}</script>\n'
    return page(f'{d["title"]} | Curious Orbit', d['summary'], body, base=base, path=f'facts/day-{pad(n)}',
                og=f'media/og/day{pad(n)}.jpg', extra_head=head, scripts=['js/days.js', 'js/fact.js'])


GOAL = 1000  # the plan runs to Fact 1,000 (Post 989)


def all_facts_page():
    base = '../'
    n = len(made)
    cards = ''.join(
        f'<li><a href="day-{pad(d["n"])}.html" data-cursor="Open"><span class="pic"><img src="{base}{d["poster"] if d["format"] == "reel" else d["images"][0]}" alt="" loading="lazy"></span>'
        f'<span class="k">Fact {pad(d["n"])} · {e(d["topic"])} · {d["format"]}</span><span class="t">{e(d["title"])}</span></a></li>'
        for d in reversed(made))
    body = f'''<section class="all wrap" aria-labelledby="all-title">
  <p class="label">The log · every fact so far</p>
  <h1 id="all-title">{n} facts down. <span class="ember">{GOAL:,} is the goal.</span></h1>
  <div class="goal" role="progressbar" aria-label="Facts posted out of {GOAL:,}" aria-valuemin="0" aria-valuemax="{GOAL}" aria-valuenow="{n}"><i style="--p:{n / GOAL:.4f}"></i></div>
  <p class="goal-k">{n} of {GOAL:,} · {n / GOAL:.1%}</p>
  <p class="lede">One true science fact at a time, each one checked against its source before it goes out. Newest first.</p>
  <ul class="all-grid">{cards}</ul>
</section>
{signup_band('all')}'''
    return page(f'All {n} facts | Curious Orbit', f'Every Curious Orbit fact so far: {n} of {GOAL:,}, each checked against its source.', body,
                base=base, path='facts')


MEDIA_KIT = '''<section class="mk wrap">
  <div class="mk-hero">
    <p class="label">Media kit · 2026</p>
    <h1>Reach people who <span class="ember">love learning.</span></h1>
    <p class="lede">Curious Orbit posts one surprising, fact-checked science fact every day on Instagram and in The Daily Orbit newsletter. Our audience is curious 16 to 35 year olds who save facts and send them to friends.</p>
    <div class="actions"><a class="btn" href="#book">Book a slot</a></div>
  </div>
  <div class="mk-stats" aria-label="Audience numbers">
    <p class="sample">Sample figures until launch numbers are in</p>
    <dl>
      <div><dt>Instagram followers</dt><dd>12,400</dd></div>
      <div><dt>Avg. reel views</dt><dd>38,000</dd></div>
      <div><dt>Newsletter subscribers</dt><dd>3,100</dd></div>
      <div><dt>Newsletter open rate</dt><dd>52%</dd></div>
    </dl>
  </div>
</section>
<section class="mk wrap" aria-labelledby="mk-audience">
  <div class="section-head"><div><p class="label">Who reads us</p><h2 id="mk-audience">Students, young professionals, teachers.</h2></div></div>
  <div class="mk-cols">
    <div class="panel"><h3>Age</h3><p>Mostly 18 to 34, with a strong student group.</p></div>
    <div class="panel"><h3>Interests</h3><p>Space, the human body, animals, everyday physics, trivia and quizzes.</p></div>
    <div class="panel"><h3>Behaviour</h3><p>High saves and shares: people send our facts to friends and use them in class.</p></div>
  </div>
</section>
<section class="mk wrap" aria-labelledby="mk-formats">
  <div class="section-head"><div><p class="label">Formats and rates</p><h2 id="mk-formats">Three ways to work with us.</h2></div><p class="section-note">Sample rates. Bundles and multi-week deals on request.</p></div>
  <ul class="rates">
    <li class="panel"><h3>Sponsored reel</h3><p>A 20-second fact reel in our look about a fact linked to your product, with your brand on the follow card and in the caption.</p><p class="price">₹2,500<small>per reel</small></p></li>
    <li class="panel"><h3>Newsletter slot</h3><p>One short line and a link at the top of The Daily Orbit, written in our voice.</p><p class="price">₹800<small>per issue</small></p></li>
    <li class="panel"><h3>Story mention</h3><p>A story with your link sticker, shared the same day as a post.</p><p class="price">₹600<small>per story</small></p></li>
  </ul>
</section>
<section class="mk wrap" aria-labelledby="mk-rules">
  <div class="checked">
    <div class="checked-copy">
      <p class="label">Our rules</p>
      <h2 id="mk-rules">Trust is the product.</h2>
      <p>We only work with brands that fit a science page: edtech, books, museums, science kits, apps and outdoor gear. Every sponsored post is labelled as a paid partnership, and every fact in it goes through the same check as everything else we post.</p>
    </div>
    <div class="panel" id="book">
      <p class="label">Book a slot</p>
      <h3>Email us with your dates and goal.</h3>
      <div class="contact"><code id="mk-email" data-sponsor-email>hello@curiousorbit.com</code><button class="btn btn-small btn-ghost" type="button" data-copy="mk-email">Copy email</button></div>
      <p>We reply within two working days.</p>
    </div>
  </div>
</section>'''

PRIVACY = '''<section class="legal wrap">
  <p class="label">Privacy</p>
  <h1>Privacy policy</h1>
  <p class="meta">Last updated 28 October 2026</p>
  <h2>What we collect</h2>
  <p>If you subscribe to The Daily Orbit or join a waitlist, we store your email address and which form you used.</p>
  <p>If you buy something or log a tip, we store your name, email, the amount, the product and the UPI reference number (UTR) you give us, so we can match your payment and send your download. We never see your bank details or UPI PIN: you pay in your own UPI app. If you use our checkout page, the payment is confirmed by a payment gateway we run ourselves, which reads the bank's payment alert for our account to match the amount and the UPI reference; it does not receive your UPI PIN or bank login.</p>
  <h2>How we use it</h2>
  <p>We use your email only to send the newsletter, the launch emails you asked for, or help with your order. We never sell or rent it. Every newsletter has a one-click unsubscribe link. Order records are kept for our accounts.</p>
  <h2>Who handles it</h2>
  <p>Our newsletter is sent by beehiiv. Orders are stored privately on Vercel, which hosts this site. Payments go directly between your UPI app and ours.</p>
  <h2>Cookies and analytics</h2>
  <p>The site may use privacy-friendly, cookie-free page-view counts. We don't run advertising trackers.</p>
  <h2>Your rights</h2>
  <p>You can ask us to show, correct or delete what we hold about you. Message us on Instagram at <a data-ig href="https://www.instagram.com/curiousorbit.daily/">@curiousorbit.daily</a>.</p>
</section>'''

TERMS = '''<section class="legal wrap">
  <p class="label">Terms</p>
  <h1>Terms of use</h1>
  <p class="meta">Last updated 28 October 2026</p>
  <h2>Our content</h2>
  <p>The reels, carousels, posts and text on this site are made by Curious Orbit. You're welcome to share links to them. Please don't re-upload them as your own.</p>
  <h2>Accuracy</h2>
  <p>We check every fact against reliable sources and link them. Science moves on, though: if you spot something out of date, tell us and we'll fix it.</p>
  <h2>Digital products</h2>
  <p>Shop items are digital downloads for personal and classroom use. Teachers may print and share them with their own students; please don't resell or re-upload them.</p>
  <p>You pay by UPI. On our checkout page the payment is confirmed against our bank's alert and your download unlocks by itself, usually within a minute. Or you can pay our UPI ID directly and send us the payment's UPI reference number: we check it against our account and unlock your download, usually within a few hours. If we can't find the payment, we'll tell you on your order page. Because downloads can't be returned, we refund within 14 days only if a file doesn't work and we can't fix it, or if you paid and never got access.</p>
  <h2>Sponsored content</h2>
  <p>Paid partnerships are always labelled. A sponsor never changes whether a fact is true.</p>
  <h2>Contact</h2>
  <p>Message us on Instagram at <a data-ig href="https://www.instagram.com/curiousorbit.daily/">@curiousorbit.daily</a>, and include your order number if it's about a purchase.</p>
</section>'''

NOT_FOUND = '''<section class="legal wrap lost">
  <svg class="follow-logo" viewBox="0 0 200 200" aria-hidden="true"><circle cx="100" cy="100" r="62" fill="none" stroke="#F3EEE4" stroke-width="7"/><circle cx="153.7" cy="69" r="14" class="ember-fill"/></svg>
  <p class="label">Error 404</p>
  <h1>This page drifted <span class="ember">out of orbit.</span></h1>
  <p>Fun fact while you're here: Voyager 1 is more than 25 billion km from Earth and still sending data home.</p>
  <div class="actions"><a class="btn" href="/">Back to today's fact</a></div>
</section>'''


CATALOG = json.loads((ROOT / 'lib/catalog.json').read_text())

def write_catalog_js():
    # Browser copy of lib/catalog.json without the private file paths
    def shots(sku):
        found = []
        for i in (1, 2):
            for ext in ('webp', 'jpg', 'png'):
                if (PUB / f'media/shop/{sku}-{i}.{ext}').exists(): found.append(f'media/shop/{sku}-{i}.{ext}'); break
        return found
    files = {q['sku']: len(q.get('files', [])) for q in CATALOG['products']}
    pub = {'upiId': CATALOG['upiId'], 'payee': CATALOG['payee'], 'products': [
        {k: v for k, v in p.items() if k != 'files'} | {'shots': shots(p['sku']), 'fileCount': files[p['sku']] if 'includes' not in p else sum(files.get(s, 0) for s in p['includes'])}
        for p in CATALOG['products']]}
    (PUB / 'js/catalog.js').write_text('// Generated by tools/build-pages.py from lib/catalog.json. Edit that file, not this one.\n'
                                      f'window.CO_CATALOG = {json.dumps(pub, ensure_ascii=False, separators=(",", ":"))};\n')

SHOP = '''<section class="shop-hero wrap">
  <div class="hero-copy">
    <p class="label">Orbit Shop · pay by UPI</p>
    <h1>Take the facts <span class="ember">offline.</span></h1>
    <p class="lede">Quiz nights, fact cards, posters, wallpapers and kids' activity packs. Every fact checked against a real source. Pay with any UPI app and download straight away.</p>
    <form class="shop-search" id="shop-search" role="search">
      <label class="sr" for="shop-q">Search the shop</label>
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5"/><path d="m13 13 4 4"/></svg>
      <input id="shop-q" type="search" placeholder="Search dinosaurs, quiz, kids, ocean…" autocomplete="off" maxlength="60">
      <button type="button" id="shop-q-clear" aria-label="Clear search" hidden>×</button>
    </form>
    <ul class="shop-stats"><li><b>{n_products}</b>products</li><li><b>{n_topics}</b>topics</li><li><b>{n_bundles}</b>bundles</li><li><b>100%</b>sourced facts</li></ul>
  </div>
  <div class="orbit-wrap" aria-hidden="true">
    <div class="orbit-box" id="orbit-box"><canvas id="orbit-field"></canvas></div>
    <p class="orbit-cap"><span>Every dot is a product</span><b id="orbit-n"></b></p>
  </div>
</section>
<div class="wrap shop-bar" id="shop-bar"></div>
<div class="wrap shop-layout">
  <aside class="filters" id="filters" aria-label="Filters"></aside>
  <div class="shop-results">
    <div class="results-top"><p class="count" id="shop-count" aria-live="polite"></p><div class="chips" id="shop-chips"></div></div>
    <ul class="products shop-grid" id="products" data-all></ul>
    <div class="none" id="shop-none" hidden><h3>Nothing in orbit here.</h3><p>Try fewer filters or a different word.</p></div>
    <div class="more" id="shop-more" hidden><button class="btn btn-ghost" type="button">Show more</button></div>
  </div>
</div>
<section class="wrap how-wrap">
  <ol class="how">
    <li><b>Pick</b> a product and tap Buy.</li>
    <li><b>Pay</b> by UPI: scan, tap, or use the checkout page.</li>
    <li><b>Wait</b> a minute while the bank confirms.</li>
    <li><b>Download</b> from your order page. The link keeps working.</li>
  </ol>
</section>'''

FAMILY_INSIDE = {
    'quiz': ['Multiple-choice questions in rounds, four options each', 'A printable team answer sheet', 'A host answer key with a named source for every answer', 'A one-page guide to running the quiz'],
    'tf': ['Statement cards to cut out and read aloud, about half true and half popular mix-ups', 'An answer sheet with a one-line explanation and a source for each', 'Plays solo, in pairs, in class or on a long drive'],
    'bingo': ['Unique 5 × 5 bingo cards with a free centre square', 'A caller sheet with every question and answer', 'Works for 2 to 30 players'],
    'cards': ['Playing-card-size cards (63 × 88 mm) with crop marks', 'The fact on the front; the how, the why and a source on the back', 'A double-sided print guide, with a single-sided option'],
    'kids': ['A mix of printable activities: match-ups, true or false, fill the gap, word search and more', 'Big, clear type for ages 6 to 12', 'An answer key for the grown-up'],
    'poster': ['A3 and A4 PDFs, sharp enough for the wall', 'Big numbers first, sources in small print', 'Navy and cream, in the Curious Orbit look'],
    'walls': ['Phone wallpapers at 1290 × 2796, a calm top for your clock', 'One sourced fact on each', 'JPG files you can set straight from your phone'],
    'book': ['24 myths and what is actually true', 'The science and a source for each', 'Read it on a phone or print it as a mini book'],
    'bundle': ['Everything below in one payment', 'One order page with every download', 'Each file is the same one you would get buying it alone'],
}
BUY_NOTES = ['Pay by UPI: GPay, PhonePe, Paytm, BHIM or any UPI app', 'Download unlocks as soon as the payment is confirmed', 'PDF and image files, personal-use licence: print for home, class or club']


def kb(n): return f'{n / 1e6:.1f} MB' if n > 1e6 else f'{max(1, round(n / 1e3))} KB'
def rupees(n): return '₹' + f'{int(n):,}'


def _catalog():
    return CATALOG['products']


def _shots(sku):
    found = []
    for i in (1, 2):
        for ext in ('webp', 'jpg', 'png'):
            if (PUB / f'media/shop/{sku}-{i}.{ext}').exists(): found.append(f'media/shop/{sku}-{i}.{ext}'); break
    return found


def _related(p, n=8):
    allp = _catalog()
    if p.get('includes'):
        pool = [q for q in allp if q.get('includes') and q['sku'] != p['sku']]
        pool.sort(key=lambda q: (q.get('theme') != p.get('theme'), q['price']))
    else:
        same_theme = [q for q in allp if q.get('theme') == p.get('theme') and q['sku'] != p['sku'] and not q.get('includes')]
        same_type = [q for q in allp if q.get('family') == p.get('family') and q['sku'] != p['sku'] and not q.get('includes')]
        theme_bundle = [q for q in allp if q.get('includes') and q.get('theme') == p.get('theme')]
        pool = theme_bundle + same_theme[:4] + same_type[:4]
    seen, out = set(), []
    for q in pool:
        if q['sku'] not in seen: seen.add(q['sku']); out.append(q)
    return out[:n]


def _card(q, base):
    shots = _shots(q['sku'])
    if q.get('includes'):
        inc = [x for x in _catalog() if x['sku'] in q['includes']]
        picks = [inc[0], inc[len(inc) // 2], inc[-1]]
        imgs = ''.join(f'<img src="{base}{_shots(x["sku"])[0]}" alt="" loading="lazy">' for x in picks if _shots(x['sku']))
        cover = f'<a class="shot shot-bundle" href="{base}shop/{q["sku"]}" tabindex="-1" aria-hidden="true"><div class="fan">{imgs}</div><span class="n">{len(q["includes"])} products</span></a>'
    else:
        cover = (f'<a class="shot" href="{base}shop/{q["sku"]}" tabindex="-1" aria-hidden="true"><img src="{base}{shots[0]}" alt="" loading="lazy"></a>' if shots else '<a class="shot"></a>')
    worth = f'<s>{rupees(q["worth"])}</s>' if q.get('worth') else ''
    meta = 'Bundle' if q.get('includes') else f'{q["themeName"]} · {q["type"]}'
    return (f'<li class="product" id="r-{q["sku"]}">{cover}<div class="body"><p class="p-meta">{e(meta)}</p>'
            f'<h3><a href="{base}shop/{q["sku"]}">{e(q["name"])}</a></h3><div class="row"><span class="price">{rupees(q["price"])}{worth}</span></div></div></li>')


def product_page(p):
    base = '../'
    sku = p['sku']
    shots = _shots(sku)
    bundle = bool(p.get('includes'))
    inc = [q for q in _catalog() if q['sku'] in p.get('includes', [])]
    desc = f'{p["text"]} {rupees(p["price"])}, pay by UPI, instant download.'
    # gallery
    if bundle:
        pics = ''.join(f'<img src="{base}{_shots(q["sku"])[0]}" alt="{e(q["name"])}" loading="lazy">' for q in inc[:6] if _shots(q['sku']))
        gallery = f'<div class="gallery"><div class="stage bundle">{pics}</div></div>'
    else:
        thumbs = ''.join(f'<button type="button" aria-pressed="{"true" if i == 0 else "false"}" aria-label="Preview {i + 1}" data-src="{base}{s}"><img src="{base}{s}" alt="" loading="lazy"></button>' for i, s in enumerate(shots)) if len(shots) > 1 else ''
        gallery = (f'<div class="gallery"><div class="stage"><img id="stage-img" src="{base}{shots[0]}" alt="{e(p["name"])} preview" width="1200" height="1500" fetchpriority="high"></div>'
                   f'<div class="thumbs">{thumbs}</div></div>') if shots else ''
    # facts strip
    kinds = {'quiz': 'PDF', 'tf': 'PDF', 'bingo': 'PDF', 'cards': 'PDF', 'kids': 'PDF', 'poster': 'PDF', 'walls': 'JPG', 'book': 'PDF', 'bundle': 'PDF + JPG'}
    cells = [('Format', kinds.get(p['family'], 'PDF')), ('You get', p['unit'])]
    if p.get('factCount') and not bundle: cells.append(('Facts', f'{p["factCount"]} checked'))
    if p.get('age'): cells.append(('Ages', p['age']))
    if bundle: cells.append(('Saves you', rupees(p['worth'] - p['price'])))
    facts = '<dl class="facts">' + ''.join(f'<div><dt>{e(k)}</dt><dd>{e(str(v))}</dd></div>' for k, v in cells) + '</dl>'
    was = (f'<p class="was"><s>{rupees(p["worth"])}</s> bought one by one · <span class="save">save {rupees(p["worth"] - p["price"])}</span></p>' if bundle else '')
    inside = ''.join(f'<li><span>{e(x)}</span></li>' for x in FAMILY_INSIDE[p['family']])
    if bundle:
        contents = '<h2>What\'s in the bundle</h2><ul class="contents">' + ''.join(f'<li><a href="{q["sku"]}">{e(q["name"])}</a></li>' for q in inc) + '</ul>'
    else:
        contents = '<h2>Files you get</h2><ul class="contents">' + ''.join(f'<li>{e(f["label"])} · {kb(f["size"])}</li>' for f in p.get('files', [])) + '</ul>'
    cat_href = f'{base}shop?cat={p["category"]}'
    topic = '' if bundle and not p.get('theme') else f'{e(p.get("themeName", ""))} · '
    crumbs = (f'<ul class="crumbs"><li><a href="{base}shop">Shop</a></li><li><a href="{cat_href}">{e(p["category"])}</a></li><li aria-current="page">{e(p["name"])}</li></ul>')
    rel = _related(p)
    related = (f'<section class="related wrap"><p class="label">{"More bundles" if bundle else "You might also like"}</p><h2>{"Other ways to save" if bundle else "Keep exploring."}</h2>'
               f'<ul class="products">{"".join(_card(q, base) for q in rel)}</ul></section>') if rel else ''
    ld = {'@context': 'https://schema.org', '@type': 'Product', 'name': p['name'], 'description': p['text'], 'sku': sku,
          'image': [f'{SITE}/{s}' for s in shots] or None, 'brand': {'@type': 'Brand', 'name': 'Curious Orbit'}, 'category': p['category'],
          'offers': {'@type': 'Offer', 'url': f'{SITE}/shop/{sku}', 'priceCurrency': 'INR', 'price': str(p['price']), 'availability': 'https://schema.org/InStock'}}
    ld = {k: v for k, v in ld.items() if v}
    body = (f'<section class="wrap" aria-labelledby="pp-title">{crumbs}<div class="pp">{gallery}'
            f'<div class="info"><p class="label">{topic}{e(p["type"])}</p><h1 id="pp-title">{e(p["name"])}</h1><p class="lede">{e(p["text"])}</p>'
            f'<div class="buybox"><div class="price-row"><span class="big">{rupees(p["price"])}</span>{was}</div>'
            f'<button class="btn" type="button" data-buy="{sku}" data-cursor="Buy">Buy now</button>'
            f'<ul>{"".join(f"<li>{e(x)}</li>" for x in BUY_NOTES)}</ul></div>'
            f'{facts}<h2>What\'s inside</h2><ul class="inside">{inside}</ul>{contents}</div></div></section>{related}')
    head = (f'<link rel="stylesheet" href="{base}shop.css?v={V}">\n'
            f'<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>\n')
    og = shots[0] if shots else None
    return page(f'{p["name"]} | Curious Orbit Shop', desc, body, base=base, path=f'shop/{sku}', og=og, extra_head=head, scripts=['js/product.js'])




ORDER = '''<section class="legal wrap order-page" id="order">
  <p class="label">Your order</p>
  <h1 id="order-title">Loading your order…</h1>
  <div id="order-body"></div>
</section>'''

ADMIN = '''<section class="wrap admin" id="admin">
  <p class="label">Orders · private</p>
  <h1>Payments <span class="ember">log.</span></h1>
  <form class="admin-login" id="admin-login">
    <label class="pf-field"><span>Password</span><input type="password" name="key" autocomplete="current-password" required></label>
    <button class="btn" type="submit">Open</button>
    <p class="form-msg" aria-live="polite"></p>
  </form>
  <div id="admin-app" hidden></div>
</section>'''

def stamp_home():
    # index.html is hand-written: refresh the ?v= on its local CSS/JS links
    f = PUB / 'index.html'; t = f.read_text()
    t = re.sub(r'((?:href|src)="(?:styles|home|chrome|micro)\.css)(?:\?v=\w+)?"', rf'\1?v={V}"', t)
    t = re.sub(r'(src="js/[\w-]+\.js)(?:\?v=\w+)?"', rf'\1?v={V}"', t)
    f.write_text(t)

def main():
    write_catalog_js()
    stamp_home()
    (PUB / 'facts').mkdir(exist_ok=True)
    for old in (PUB / 'facts').glob('day-*.html'): old.unlink()
    for i, d in enumerate(made):
        (PUB / 'facts' / f'day-{pad(d["n"])}.html').write_text(fact_page(d, i))
    (PUB / 'facts' / 'index.html').write_text(all_facts_page())
    (PUB / 'media-kit.html').write_text(page('Advertise with Curious Orbit', 'Sponsored reels, newsletter slots and story mentions on a fact-checked science page for curious 16 to 35 year olds.', MEDIA_KIT, path='media-kit', og='media/og/media-kit.jpg'))
    (PUB / 'privacy.html').write_text(page('Privacy | Curious Orbit', 'How Curious Orbit handles your email address and data.', PRIVACY, path='privacy'))
    (PUB / 'terms.html').write_text(page('Terms | Curious Orbit', 'Terms of use for the Curious Orbit site and shop.', TERMS, path='terms'))
    prods = CATALOG['products']
    singles = [q for q in prods if not q.get('includes')]
    shop_body = (SHOP.replace('{n_products}', str(len(singles))).replace('{n_topics}', str(len({q['theme'] for q in singles if q['theme'] != 'mixed'})))
                 .replace('{n_bundles}', str(len(prods) - len(singles))))
    shop_head = (f'<link rel="stylesheet" href="shop.css?v={V}">\n<script type="module" src="js/shop-orbit.js?v={V}"></script>\n')
    (PUB / 'shop.html').write_text(page('Orbit Shop | Curious Orbit', f'{len(prods)} fact-checked quiz packs, fact cards, posters, wallpapers and kids activity packs. Pay by UPI, download instantly.',
                                         shop_body, path='shop', scripts=['vendor/gsap.min.js', 'js/shop.js'], extra_head=shop_head))
    (PUB / 'shop').mkdir(exist_ok=True)
    for old in (PUB / 'shop').glob('*.html'): old.unlink()
    for q in prods:
        (PUB / 'shop' / f'{q["sku"]}.html').write_text(product_page(q))
    (PUB / 'order.html').write_text(page('Your order | Curious Orbit', 'Check your Curious Orbit order and download your files.', ORDER, path='order', scripts=['js/order.js'], extra_head=f'<meta name="robots" content="noindex">\n<link rel="stylesheet" href="shop.css?v={V}">\n'))
    (PUB / 'admin.html').write_text(page('Orders | Curious Orbit', 'Private.', ADMIN, path='admin', scripts=['js/admin.js'], extra_head='<meta name="robots" content="noindex">\n'))
    (PUB / '404.html').write_text(page('Lost in space | Curious Orbit', 'This page does not exist.', NOT_FOUND, path='404'))
    urls = ['', 'facts', 'shop', 'media-kit', 'privacy', 'terms'] + [f'facts/day-{pad(d["n"])}' for d in made] + [f'shop/{q["sku"]}' for q in prods]
    (PUB / 'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + ''.join(f'  <url><loc>{SITE}/{u}</loc><lastmod>{TODAY}</lastmod></url>\n' for u in urls) + '</urlset>\n')
    (PUB / 'robots.txt').write_text(f'User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /order\nSitemap: {SITE}/sitemap.xml\n')
    print(f'{len(prods)} product pages, {len(made)} fact pages + media kit, privacy, terms, 404, sitemap ({len(urls)} urls), robots')


main()
