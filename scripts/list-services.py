# scripts/list-services.py
import urllib.request
import urllib.parse
import json
import ssl
from require_env import require_env

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

BASE_URL = 'http://72.60.159.48:3000'

def login():
    url = f'{BASE_URL}/api/trpc/auth.login'
    payload = {'json': {'email': require_env('EASYPANEL_EMAIL'), 'password': require_env('EASYPANEL_PASSWORD')}}
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(req, timeout=10) as res:
        data = json.loads(res.read().decode('utf-8'))
        return data['json']['token']

token = login()
print('Logged in')

# List projects
req = urllib.request.Request(
    f'{BASE_URL}/api/trpc/projects.listProjects',
    headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
)
with urllib.request.urlopen(req, timeout=10) as res:
    print('Projects:', res.read().decode('utf-8'))

# List services in project
req = urllib.request.Request(
    f'{BASE_URL}/api/trpc/projects.getProject?input=' + urllib.parse.quote(json.dumps({'json': {'projectName': 'helena-automation'}})),
    headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
)
with urllib.request.urlopen(req, timeout=10) as res:
    data = json.loads(res.read().decode('utf-8'))
    services = data.get('result', {}).get('data', {}).get('json', {}).get('services', [])
    print('\nServices in helena-automation:')
    for s in services:
        print('-', s.get('name'), '| type:', s.get('type'))
