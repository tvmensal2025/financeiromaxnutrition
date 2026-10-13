import urllib.request
import json
import time
from require_env import require_env

req = urllib.request.Request(
    'http://72.60.159.48:3000/api/trpc/auth.login',
    data=json.dumps({'json': {'email': require_env('EASYPANEL_EMAIL'), 'password': require_env('EASYPANEL_PASSWORD')}}).encode('utf-8'),
    headers={'Content-Type': 'application/json'}
)
with urllib.request.urlopen(req) as res:
    token = json.loads(res.read().decode('utf-8'))['json']['token']

for i in range(25):
    req2 = urllib.request.Request(
        'http://72.60.159.48:3000/api/trpc/actions.listActions?input=%7B%22json%22%3A%7B%22projectName%22%3A%22helena-automation%22%7D%7D',
        headers={'Authorization': f'Bearer {token}'}
    )
    with urllib.request.urlopen(req2) as res:
        actions = json.loads(res.read().decode('utf-8'))['json']
        for a in actions[:3]:
            if a.get('serviceName') == 'meowcaller-service':
                status = a.get('status')
                aid = a.get('id')
                print(f'[{i}] meowcaller-service ({aid}): {status}')
                if status in ['done', 'failed', 'error']:
                    exit(0 if status == 'done' else 1)
                break
    time.sleep(4)
