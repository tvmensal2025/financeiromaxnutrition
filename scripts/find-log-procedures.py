import urllib.request, re, json
from require_env import require_env

BASE_URL = 'http://72.60.159.48:3000'
req = urllib.request.Request(f'{BASE_URL}/api/trpc/auth.login', data=json.dumps({'json': {'email': require_env('EASYPANEL_EMAIL'), 'password': require_env('EASYPANEL_PASSWORD')}}).encode(), headers={'Content-Type': 'application/json'})
with urllib.request.urlopen(req) as res:
    token = json.loads(res.read())['json']['token']

req2 = urllib.request.Request(f'{BASE_URL}/projects/helena-automation/services/app/meowcaller-service/logs', headers={'Authorization': f'Bearer {token}'})
try:
    html = urllib.request.urlopen(req2).read().decode('utf-8', errors='ignore')
    scripts = re.findall(r'src="(/_next/static/chunks/[^"]+)"', html)
    print('Scripts na pagina de logs:', len(scripts))
    found = set()
    for s in scripts:
        try:
            js = urllib.request.urlopen(f'{BASE_URL}{s}').read().decode('utf-8', errors='ignore')
            for m in re.findall(r'([a-zA-Z0-9_\.]+\.use(?:Query|Subscription|Mutation))', js):
                found.add(m)
        except Exception:
            pass
    for f in sorted(list(found)):
        if any(k in f.lower() for k in ['log', 'service', 'app']):
            print('  ->', f)
except Exception as e:
    print('Err:', e)
