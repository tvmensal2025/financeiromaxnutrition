# scripts/get-helena-services.py
import urllib.request
import json
from require_env import require_env

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

req = urllib.request.Request(
    f'{BASE_URL}/api/trpc/projects.listProjectsAndServices',
    headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
)
with urllib.request.urlopen(req, timeout=10) as res:
    data = json.loads(res.read().decode('utf-8'))
    services = data.get('json', {}).get('services', [])
    helena_services = [s for s in services if s.get('projectName') == 'helena-automation']
    print(f'Found {len(helena_services)} services in helena-automation:')
    for s in helena_services:
        print('='*50)
        print('Name:', s.get('name'))
        print('Type:', s.get('type'))
        print('Env:')
        print(s.get('env', ''))
