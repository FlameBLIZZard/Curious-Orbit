"""Encodes a made post's web media into public/media/ (reels: dayNN.mp4 + dayNN-cover.webp; carousels: dayNN-slide-NN.webp; posts: dayNN-post.webp).
Run: python3 tools/import-media.py 19 20 21 22 23   (post numbers; Fact NN = post + 11)"""
import json, pathlib, subprocess, sys
CO = pathlib.Path('/mnt/project-files/curious-orbit')
MEDIA = pathlib.Path(__file__).resolve().parent.parent / 'public/media'
# final reels that live outside the post folder (PC renders staged at the library root)
REEL_SRC = {68: pathlib.Path('/mnt/project-files/daily-co-post068-halley_9x16.mp4')}
fmt = {int(r['post'].split()[1]): r['format'] for r in json.loads((CO / 'plan-1000/plan-1000.json').read_text())}
def run(*a): subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', *a], check=True)
def img(src, dst): run('-i', str(src), '-vf', 'scale=720:-1', '-quality', '82', str(dst))
for k in map(int, sys.argv[1:]):
    d, n = CO / f'post-{k:03d}', k + 11
    if fmt[k] == 'reel':
        src = REEL_SRC.get(k) or next(p for p in sorted(d.glob('*_9x16.mp4')) if 'sfx-only' not in p.name)
        run('-i', str(src), '-vf', 'scale=720:-2', '-r', '30', '-c:v', 'libx264', '-crf', '26', '-preset', 'slow',
            '-movflags', '+faststart', '-c:a', 'aac', '-b:a', '96k', str(MEDIA / f'day{n:02d}.mp4'))
        img(d / 'cover.jpg', MEDIA / f'day{n:02d}-cover.webp')
    elif fmt[k] == 'carousel':
        slides = sorted((d / 'out').glob('slide-*.png')) or sorted(d.glob('slide-*.png'))
        for i, s in enumerate(slides, 1): img(s, MEDIA / f'day{n:02d}-slide-{i:02d}.webp')
    else:
        img(next(p for p in [d / 'out/post.png', d / 'post.png'] if p.exists()), MEDIA / f'day{n:02d}-post.webp')
    print(f'Post {k:03d} -> Fact {n} ({fmt[k]})')
