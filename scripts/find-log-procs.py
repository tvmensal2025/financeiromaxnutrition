import urllib.request, re, json
from require_env import require_env

BASE_URL = 'http://72.60.159.48:3000'
req = urllib.request.Request(f'{BASE_URL}/api/trpc/auth.login', data=json.dumps({'json': {'email': require_env('EASYPANEL_EMAIL'), 'password': require_env('EASYPANEL_PASSWORD')}}).encode(), headers={'Content-Type': 'application/json'})
with urllib.request.urlopen(req) as res:
    token = json.loads(res.read())['json']['token']

req2 = urllib.request.Request(f'{BASE_URL}/', headers={'Authorization': f'Bearer {token}'})
html = urllib.request.urlopen(req2).read().decode('utf-8', errors='ignore')
scripts = re.findall(r'src="(/_next/static/chunks/[^"]+)"', html)

all_procs = set()
for s in scripts:
    try:
        js = urllib.request.urlopen(f'{BASE_URL}{s}').read().decode('utf-8', errors='ignore')
        matches = re.findall(r'["\']([a-zA-Z0-9_\.]+\.[a-zA-Z0-9_]+)["\']', js)
        for m in matches:
            if 'log' in m.lower():
                all_procs.add(m)
    except Exception:
        pass

for p in sorted(list(all_procs)):
    print(p)
