"""Builds public/js/days.js from the fact-checked playbook and the day folders.
Run: python3 tools/make-data.py   (from the curious-orbit-site folder)"""
import re, json, pathlib, datetime
CO = pathlib.Path('/mnt/project-files/curious-orbit')
OUT = pathlib.Path(__file__).resolve().parent.parent / 'public/js/days.js'
MEDIA = OUT.parent.parent / 'media'
txt = (CO / 'Curious-Orbit-Playbook-Final.txt').read_text()
topics = {1:'Space',2:'History',3:'Plants',4:'Body',5:'Space',6:'Animals',7:'Animals',8:'Body',9:'Space',10:'Maths',
          11:'Myths',12:'Physics',13:'Animals',14:'Earth',15:'Animals',16:'Body',17:'Space',18:'Quiz',19:'Physics',20:'Recap'}
titles = {1:'A day on Venus is longer than its year.',2:'5 things that are older than you think.',3:"Bananas are berries. Strawberries aren't.",
          4:"You're 1 to 2 cm taller in the morning.",5:'How big is space, really?',6:'Octopuses have 3 hearts and blue blood.',
          7:'Wombat poop is cube-shaped.',8:'Your body, by the numbers.',9:'A teaspoon of neutron star weighs a billion tonnes.',
          10:'More chess games than atoms in the universe.',11:'5 facts school got wrong.'}
emoji = re.compile(r'\s*[\U0001F000-\U0001FFFF⌀-⏿☀-➿️‍]+')
# Days 1-11 were all on Instagram by 7 Oct 2026 (Aditya posted ahead of the plan).
# The rest follow one a day from the next morning.
POSTED, POSTED_BY = 11, datetime.date(2026, 10, 7)
start = POSTED_BY + datetime.timedelta(days=1)
# Sources and claim counts per day, from the fact-check table
import openpyxl
checks = {}
for r in list(openpyxl.load_workbook(CO / 'Curious-Orbit-Fact-Check.xlsx')['Fact-check'].iter_rows(values_only=True))[1:]:
    if not r[1] or not str(r[1]).isdigit(): continue
    c = checks.setdefault(int(r[1]), {'claims': 0, 'sources': []})
    c['claims'] += 1
    src = {'name': str(r[7]).strip(), 'url': str(r[8]).strip()}
    if r[8] and src['url'].startswith('http') and all(x['url'] != src['url'] for x in c['sources']): c['sources'].append(src)
days = []
for m in re.finditer(r'^Day (\d+) · (\w+ \d+ \w+) · (\w+) at (\d+ pm)\n\nWhat it is: (.+)$', txt, re.M):
    n = int(m.group(1)); fmt = m.group(3).lower()
    if n > POSTED: continue  # the old Day 12-20 drafts were replaced by the numbered post plan below
    d = {'n': n, 'date': (POSTED_BY if n <= POSTED else start + datetime.timedelta(days=n-POSTED-1)).isoformat(), 'time': m.group(4),
         'format': fmt, 'topic': topics[n], 'summary': m.group(5).strip()}
    if n <= POSTED: d['posted'] = True
    folder = CO / f'day-{n:02d}'
    cap = folder / 'caption.txt'
    if n in titles:
        if cap.exists(): raw = cap.read_text()
        else:  # Day 1 has no caption.txt: take it from the playbook
            block = txt[m.end():].split('Caption:', 1)[1].split('\nDay ', 1)[0]
            raw = '\n\n'.join(l.strip() for l in block.strip().split('\n\n'))
        paras = [emoji.sub('', p).strip() for p in raw.split('\n\n') if p.strip() and not p.strip().startswith('#')]
        d['title'] = titles[n]
        d['caption'] = [re.sub(r'\s+', ' ', p) for p in paras]
        d['tags'] = re.findall(r'#\w+', raw)
        if n in checks: d['check'] = checks[n]
        if fmt == 'reel':
            d['video'] = f'media/day{n:02d}.mp4'; d['poster'] = f'media/day{n:02d}-cover.webp'
        else:
            d['images'] = sorted(f'media/{p.name}' for p in MEDIA.glob(f'day{n:02d}-*.webp'))
    days.append(d)
# Facts 12+ come from the numbered post plan (Post 001 = fact 12). A post is on the site once its folder
# /mnt/project-files/curious-orbit/post-NNN/ exists; MADE lists the date each one was made. The next few show as "coming up".
MADE = {1: '2026-10-08', 2: '2026-10-08'}
# sources come from the verified fact bank, one per fact the post uses
BANK = {}
for f in pathlib.Path('/mnt/project-files/curious-orbit-shop/facts').glob('*.json'):
    for x in json.loads(f.read_text()): BANK[x['id']] = x
UPCOMING = 8
plan = json.loads((CO / 'plan-100/plan-100.json').read_text())
shown_next = 0
def sources_for(r):
    ids = [i.strip() for i in r['fact_id'].split(',') if i.strip()]
    src = []
    for i in ids:
        x = BANK.get(i)
        if x and all(s['url'] != x['url'] for s in src): src.append({'name': x['source'], 'url': x['url']})
    return {'claims': max(1, len(ids)), 'sources': src or [{'name': r['source'], 'url': r['url']}]}
for r in plan:
    k = int(r['post'].split()[1]); n = r['n']; folder = CO / f'post-{k:03d}'
    d = {'n': n, 'post': k, 'format': r['format'], 'topic': r['pillar'].split(' & ')[0], 'time': '7 pm' if r['format'] == 'reel' else '1 pm'}
    if k in MADE and (folder / 'caption.txt').exists():
        raw = (folder / 'caption.txt').read_text()
        paras = [emoji.sub('', p).strip() for p in raw.split('\n\n') if p.strip() and not p.strip().startswith('#')]
        d.update({'date': MADE[k], 'posted': True, 'title': r['title'], 'summary': r['fact'],
                  'caption': [re.sub(r'\s+', ' ', p) for p in paras], 'tags': re.findall(r'#\w+', raw),
                  'check': sources_for(r)})
        if r['format'] == 'reel':
            d['video'] = f'media/day{n:02d}.mp4'; d['poster'] = f'media/day{n:02d}-cover.webp'
        else:
            d['images'] = sorted(f'media/{p.name}' for p in MEDIA.glob(f'day{n:02d}-*.webp'))
    elif shown_next < UPCOMING:
        shown_next += 1; d.update({'date': None, 'summary': ''})
    else:
        break
    days.append(d)
OUT.write_text('// Generated by tools/make-data.py from the fact-checked playbook (v1.3) and the post plan. Do not edit by hand.\nwindow.CO_DAYS = '
               + json.dumps(days, ensure_ascii=False, indent=1) + ';\n')
print(len(days), 'days;', sum('title' in d for d in days), 'made')
