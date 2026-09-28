# scripts/get-meow-source.py
import urllib.request
import json

BASE_URL = 'http://72.60.159.48:3000'

def login():
    url = f'{BASE_URL}/api/trpc/auth.login'
    payload = {'json': {'email': 'rafael.ids@icloud.com', 'password': '201097De.'}}
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
    meow = next(s for s in services if s.get('name') == 'meowcaller-service')
    print('Source:', json.dumps(meow.get('source'), indent=2))
    print('Build:', json.dumps(meow.get('build'), indent=2))
    print('Deploy:', json.dumps(meow.get('deploy'), indent=2))
    print('Commit:', json.dumps(meow.get('commit'), indent=2))
