# scripts/inspect-easypanel-html.py
import urllib.request
import re

res = urllib.request.urlopen('http://72.60.159.48:3000')
html = res.read().decode('utf-8')
print('HTML length:', len(html))

# find scripts
scripts = re.findall(r'src="(/[^"]+\.js)"', html)
print('Scripts found:', scripts)

for s in scripts[:2]:
    s_res = urllib.request.urlopen(f'http://72.60.159.48:3000{s}')
    js = s_res.read().decode('utf-8')
    print(f'\nScanning {s} ({len(js)} bytes)...')
    # search for trpc queries related to project or services
    matches = re.findall(r'"([a-zA-Z0-9_\.]+\.(?:get|list|destroy|create|deploy|update)[a-zA-Z0-9_]*)"', js)
    unique_matches = sorted(list(set(matches)))
    print('Trpc procedure matches:', [m for m in unique_matches if 'service' in m.lower() or 'project' in m.lower()][:30])
