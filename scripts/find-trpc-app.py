import urllib.request, re, json
from require_env import require_env

BASE_URL = 'http://72.60.159.48:3000'
def login():
    data = json.dumps({'json': {'email': require_env('EASYPANEL_EMAIL'), 'password': require_env('EASYPANEL_PASSWORD')}}).encode()
    req = urllib.request.Request(f'{BASE_URL}/api/trpc/auth.login', data=data, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=10) as res:
        return json.loads(res.read())['json']['token']

token = login()
req = urllib.request.Request(f'{BASE_URL}/', headers={'Authorization': f'Bearer {token}', 'Accept': 'text/html'})
html = urllib.request.urlopen(req).read().decode('utf-8', errors='ignore')
scripts = re.findall(r'src="(/_next/static/chunks/[^"]+)"', html)

services_app_methods = set()
for s in scripts:
    try:
        js = urllib.request.urlopen(f'{BASE_URL}{s}').read().decode('utf-8', errors='ignore')
        matches = re.findall(r'["\'](services\.[a-zA-Z0-9_\.]+)["\']', js)
        for m in matches:
            services_app_methods.add(m)
    except Exception as e:
        pass

print('SERVICES METHODS:')
for m in sorted(list(services_app_methods)):
    print(' -', m)
