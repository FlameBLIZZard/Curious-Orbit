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
                f'src="{base}{d["video"]}" aria-label="Day {d["n"]} reel: {e(d["title"])}"></video></div>')
    if d['format'] == 'post':
        return f'<div class="frame post"><img src="{base}{d["images"][0]}" alt="Day {d["n"]} post: {e(d["title"])}"></div>'
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
    nav += (f'<a href="day-{pad(prev_d["n"])}.html"><small>← Day {pad(prev_d["n"])}</small>{e(prev_d["title"])}</a>' if prev_d else '<span></span>')
    nav += (f'<a class="next" href="day-{pad(next_d["n"])}.html"><small>Day {pad(next_d["n"])} →</small>{e(next_d["title"])}</a>' if next_d else '<span></span>')
    nav += '</nav>'
    body = f'''<article class="fact wrap" data-day="{n}" data-post="{d['date']}T{'00' if d.get('posted') else '19' if d['time'].startswith('7') else '13'}:00:00">
  <div class="fact-grid">
    <div class="fact-media">{media_html(d, base)}</div>
    <div class="fact-text">
      <p class="label">{e(d['topic'])} · Day {pad(n)} · {d['format']}</p>
      <h1>{e(d['title'])}</h1>
      <p class="meta">{'On Instagram now' if d.get('posted') else 'Posted ' + when}</p>
      <div class="story">{caption}</div>
      <aside class="sources" aria-labelledby="src-{n}">
        <h2 id="src-{n}">How we checked this</h2>
        <p>{check['claims']} claim{'s' if check['claims'] != 1 else ''} in this post, checked against:</p>
        <ul>{sources}</ul>
      </aside>
      <p class="tags">{e(tags)}</p>
      <div class="actions">
        <a class="btn" data-ig href="https://www.instagram.com/curiousorbit.daily/" target="_blank" rel="noopener">See it on Instagram</a>
        <a class="btn btn-ghost" href="../index.html#log">All facts</a>
      </div>
    </div>
  </div>
  <div class="fact-locked" hidden>
    <p class="label">Day {pad(n)} · {d['format']}</p>
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
  <p class="meta">Last updated 7 October 2026</p>
  <h2>What we collect</h2>
  <p>If you subscribe to The Daily Orbit or join a waitlist, we store your email address and which form you used.</p>
  <p>If you buy something or log a tip, we store your name, email, the amount, the product and the UPI reference number (UTR) you give us, so we can match your payment and send your download. We never see your bank details or UPI PIN: you pay in your own UPI app.</p>
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
  <p class="meta">Last updated 7 October 2026</p>
  <h2>Our content</h2>
  <p>The reels, carousels, posts and text on this site are made by Curious Orbit. You're welcome to share links to them. Please don't re-upload them as your own.</p>
  <h2>Accuracy</h2>
  <p>We check every fact against reliable sources and link them. Science moves on, though: if you spot something out of date, tell us and we'll fix it.</p>
  <h2>Digital products</h2>
  <p>Shop items are digital downloads for personal and classroom use. Teachers may print and share them with their own students; please don't resell or re-upload them.</p>
  <p>You pay by UPI to our UPI ID, then send us the payment's UPI reference number. We check it against our account and unlock your download, usually within a few hours. If we can't find the payment, we'll tell you on your order page. Because downloads can't be returned, we refund within 14 days only if a file doesn't work and we can't fix it, or if you paid and never got access.</p>
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
    pub = {'upiId': CATALOG['upiId'], 'payee': CATALOG['payee'], 'products': [
        {k: v for k, v in p.items() if k != 'files'} | {'shots': shots(p['sku'])} | {'fileCount': len(p.get('files', [])) if 'includes' not in p else
                                                      sum(len(q.get('files', [])) for q in CATALOG['products'] if q['sku'] in p['includes'])}
        for p in CATALOG['products']]}
    (PUB / 'js/catalog.js').write_text('// Generated by tools/build-pages.py from lib/catalog.json. Edit that file, not this one.\n'
                                      f'window.CO_CATALOG = {json.dumps(pub, ensure_ascii=False, indent=1)};\n')

SHOP = '''<section class="shop-page wrap">
  <p class="label">Orbit Shop · pay by UPI</p>
  <h1>Take the facts <span class="ember">offline.</span></h1>
  <p class="lede">Quiz packs, printable cards, posters and wallpapers, every fact checked against a real source. Pay with any UPI app; your download unlocks as soon as we confirm the payment.</p>
  <ol class="how">
    <li><b>Pick</b> a product and tap Buy.</li>
    <li><b>Pay</b> the exact amount by UPI (scan or tap).</li>
    <li><b>Send</b> us the 12-digit UPI reference.</li>
    <li><b>Download</b> from your order page once we've checked it.</li>
  </ol>
  <ul class="products shop-grid" id="products" data-all></ul>
</section>'''

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
    (PUB / 'media-kit.html').write_text(page('Advertise with Curious Orbit', 'Sponsored reels, newsletter slots and story mentions on a fact-checked science page for curious 16 to 35 year olds.', MEDIA_KIT, path='media-kit', og='media/og/media-kit.jpg'))
    (PUB / 'privacy.html').write_text(page('Privacy | Curious Orbit', 'How Curious Orbit handles your email address and data.', PRIVACY, path='privacy'))
    (PUB / 'terms.html').write_text(page('Terms | Curious Orbit', 'Terms of use for the Curious Orbit site and shop.', TERMS, path='terms'))
    shop_js = ['js/shop.js']
    (PUB / 'shop.html').write_text(page('Orbit Shop | Curious Orbit', 'Fact-checked quiz packs, printable fact cards, posters and wallpapers. Pay by UPI.', SHOP, path='shop', scripts=shop_js))
    (PUB / 'order.html').write_text(page('Your order | Curious Orbit', 'Check your Curious Orbit order and download your files.', ORDER, path='order', scripts=shop_js, extra_head='<meta name="robots" content="noindex">\n'))
    (PUB / 'admin.html').write_text(page('Orders | Curious Orbit', 'Private.', ADMIN, path='admin', scripts=['js/admin.js'], extra_head='<meta name="robots" content="noindex">\n'))
    (PUB / '404.html').write_text(page('Lost in space | Curious Orbit', 'This page does not exist.', NOT_FOUND, path='404'))
    urls = ['', 'shop', 'media-kit', 'privacy', 'terms'] + [f'facts/day-{pad(d["n"])}' for d in made]
    (PUB / 'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + ''.join(f'  <url><loc>{SITE}/{u}</loc><lastmod>{TODAY}</lastmod></url>\n' for u in urls) + '</urlset>\n')
    (PUB / 'robots.txt').write_text(f'User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /order\nSitemap: {SITE}/sitemap.xml\n')
    print(f'{len(made)} fact pages + media kit, privacy, terms, 404, sitemap ({len(urls)} urls), robots')


main()
