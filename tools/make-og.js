// Renders 1200x630 share images into public/media/og/ (home, media kit, one per made day).
// Run: NODE_PATH=$(npm root -g) node tools/make-og.js
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const PUB = path.join(__dirname, '..', 'public');
global.window = {}; eval(fs.readFileSync(path.join(PUB, 'js/days.js'), 'utf8'));
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const card = (label, title, accent) => `<!doctype html><html><head>
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@700&family=Space+Grotesk:wght@700&display=swap" rel="stylesheet">
<style>
body{margin:0;width:1200px;height:630px;background:#0B0E17;color:#F3EEE4;font-family:'Space Grotesk';position:relative;overflow:hidden}
.s{position:absolute;inset:0}
.l{position:absolute;left:80px;top:84px;font:700 22px 'JetBrains Mono';letter-spacing:.18em;color:#8A91A6;display:flex;gap:14px;align-items:center;text-transform:uppercase}
.l:before{content:"";width:13px;height:13px;background:#FF6B3D}
h1{position:absolute;left:80px;top:150px;width:720px;margin:0;font-size:${title.length > 48 ? 62 : 74}px;line-height:1;letter-spacing:-.035em}
h1 span{color:#FF6B3D}
.ring{position:absolute;right:-120px;top:120px;width:460px;height:460px;border:8px solid #F3EEE4;border-radius:50%}
.dot{position:absolute;left:939px;top:115px;width:64px;height:64px;border-radius:50%;background:#FF6B3D}
.h{position:absolute;left:80px;bottom:70px;font:700 22px 'JetBrains Mono';letter-spacing:.06em;color:#8A91A6}
</style></head><body><canvas class="s" id="c" width="1200" height="630"></canvas>
<div class="l">${esc(label)}</div><h1>${esc(title)}${accent ? ` <span>${esc(accent)}</span>` : ''}</h1>
<div class="ring"></div><div class="dot"></div><div class="h">curious orbit · @curiousorbit.daily</div>
<script>let s=7;const r=()=>(s=s*16807%2147483647)/2147483647,c=document.getElementById('c').getContext('2d');
for(let i=0;i<110;i++){c.globalAlpha=.12+r()*.35;c.fillStyle='#F3EEE4';c.beginPath();c.arc(r()*1200,r()*630,r()<.9?1:1.8,0,7);c.fill()}</script></body></html>`;
(async () => {
  const out = path.join(PUB, 'media/og'); fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
  const jobs = [['home', 'Science · one fact a day', 'One surprising, true science fact.', 'Every single day.'],
                ['media-kit', 'Media kit', 'Reach people who', 'love learning.'],
                ...window.CO_DAYS.filter((d) => d.title).map((d) => [`day${String(d.n).padStart(2, '0')}`, `${d.topic} · Day ${String(d.n).padStart(2, '0')}`, d.title, ''])];
  for (const [name, label, title, accent] of jobs) {
    await p.setContent(card(label, title, accent), { waitUntil: 'networkidle' });
    await p.screenshot({ path: path.join(out, `${name}.jpg`), type: 'jpeg', quality: 86 });
  }
  await b.close(); console.log(jobs.length, 'share images');
})();
