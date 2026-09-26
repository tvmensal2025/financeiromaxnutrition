import urllib.request
import json

req = urllib.request.Request(
    'http://72.60.159.48:3000/api/trpc/auth.login',
    data=json.dumps({'json': {'email': 'rafael.ids@icloud.com', 'password': '201097De.'}}).encode('utf-8'),
    headers={'Content-Type': 'application/json'}
)
with urllib.request.urlopen(req) as res:
    token = json.loads(res.read().decode('utf-8'))['json']['token']

req2 = urllib.request.Request(
    'http://72.60.159.48:3000/api/trpc/actions.listActions?input=%7B%22json%22%3A%7B%22projectName%22%3A%22helena-automation%22%7D%7D',
    headers={'Authorization': f'Bearer {token}'}
)
with urllib.request.urlopen(req2) as res:
    actions = json.loads(res.read().decode('utf-8'))['json']
    for a in actions[:8]:
        svc = a.get('serviceName')
        status = a.get('status')
        typ = a.get('type')
        created = a.get('createdAt')
        aid = a.get('id')
        print(f'{created} | {svc} | {typ} | status: {status} | id: {aid}')
