import urllib.request
import json
import time

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
print('=== Login Easypanel realizado com sucesso ===')

deploy_url = f'{BASE_URL}/api/trpc/services.app.deployService'
payload = {
    'json': {
        'projectName': 'helena-automation',
        'serviceName': 'helena-gateway',
        'forceRebuild': True
    }
}

req_deploy = urllib.request.Request(
    deploy_url,
    data=json.dumps(payload).encode('utf-8'),
    headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
)

with urllib.request.urlopen(req_deploy, timeout=60) as res:
    print('Deploy disparado:', res.status, res.read().decode('utf-8'))

print('=== Monitorando status do deploy do helena-gateway ===')
for i in range(30):
    time.sleep(5)
    req_actions = urllib.request.Request(
        f'{BASE_URL}/api/trpc/actions.listActions?input=%7B%22json%22%3A%7B%22projectName%22%3A%22helena-automation%22%7D%7D',
        headers={'Authorization': f'Bearer {token}'}
    )
    with urllib.request.urlopen(req_actions) as res:
        actions = json.loads(res.read().decode('utf-8'))['json']
        for a in actions[:5]:
            if a.get('serviceName') == 'helena-gateway':
                status = a.get('status')
                aid = a.get('id')
                print(f'[{i}] helena-gateway ({aid}): {status}')
                if status in ['done', 'success']:
                    print('=== Deploy concluído com SUCESSO! ===')
                    exit(0)
                elif status in ['failed', 'error']:
                    print('=== Deploy FALHOU! ===')
                    exit(1)
                break
