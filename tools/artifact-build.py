"""Makes a preview copy of index.html for a claude.ai Artifact (the host adds its own <html>/<head>/<body>).
Run: python3 tools/artifact-build.py OUT.html"""
import re, sys, pathlib
src = (pathlib.Path(__file__).resolve().parent.parent / 'public/index.html').read_text()
for pat in [r'<!doctype html>\s*', r'</?html[^>]*>\s*', r'</?head>\s*', r'</?body>\s*', r'<meta charset[^>]*>\s*', r'<meta name="viewport"[^>]*>\s*']:
    src = re.sub(pat, '', src, flags=re.I)
pathlib.Path(sys.argv[1]).write_text(src)
