import urllib.request, json
from require_env import require_env

BASE_URL = 'http://72.60.159.48:3000'
req = urllib.request.Request(
    f'{BASE_URL}/api/trpc/auth.login',
    data=json.dumps({'json': {'email': require_env('EASYPANEL_EMAIL'), 'password': require_env('EASYPANEL_PASSWORD')}}).encode('utf-8'),
    headers={'Content-Type': 'application/json'}
)
with urllib.request.urlopen(req) as res:
    token = json.loads(res.read().decode('utf-8'))['json']['token']

req2 = urllib.request.Request(
    f'{BASE_URL}/api/trpc/projects.listProjectsAndServices',
    headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
)
with urllib.request.urlopen(req2) as res:
    data = json.loads(res.read().decode('utf-8'))['json']

for s in data.get('services', []):
    if s.get('projectName') == 'helena-automation':
        print('='*40)
        print('Name:', s.get('name'))
        print('Source:', json.dumps(s.get('source'), indent=2))
        print('Domains:', s.get('domains'))
