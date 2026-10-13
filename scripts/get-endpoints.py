import urllib.request, urllib.parse, json, re
from require_env import require_env

BASE_URL = 'http://72.60.159.48:3000'
req = urllib.request.Request(
    f'{BASE_URL}/api/trpc/auth.login',
    data=json.dumps({'json': {'email': require_env('EASYPANEL_EMAIL'), 'password': require_env('EASYPANEL_PASSWORD')}}).encode('utf-8'),
    headers={'Content-Type': 'application/json'}
)
with urllib.request.urlopen(req, timeout=10) as res:
    token = json.loads(res.read().decode('utf-8'))['json']['token']

req_dash = urllib.request.Request(f'{BASE_URL}/', headers={'Cookie': f'easypanel.auth={token}'})
with urllib.request.urlopen(req_dash) as res:
    html = res.read().decode('utf-8')
    scripts = re.findall(r'src="(/_next/static/chunks/[^"]+)"', html)

endpoints = set()
for script in scripts:
    try:
        url = f'{BASE_URL}{script}'
        with urllib.request.urlopen(url) as res:
            js = res.read().decode('utf-8')
            for match in re.findall(r'"([a-zA-Z0-9_]+\.[a-zA-Z0-9_]+\.[a-zA-Z0-9_]+)"', js):
                if 'getLogs' in match:
                    endpoints.add(match)
            for match in re.findall(r'"([a-zA-Z0-9_]+\.[a-zA-Z0-9_]+)"', js):
                if 'getLogs' in match:
                    endpoints.add(match)
    except:
        pass

print('Found getLogs endpoints:', endpoints)
