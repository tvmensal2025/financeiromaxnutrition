import urllib.request
import urllib.parse
import json
import ssl
import time
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

def deploy_service(token, service_name):
    url = f'{BASE_URL}/api/trpc/services.app.deployService'
    payload = {'json': {'projectName': 'helena-automation', 'serviceName': service_name, 'forceRebuild': True}}
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode('utf-8'),
        headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as res:
            return {'status': res.status, 'data': json.loads(res.read().decode('utf-8'))}
    except Exception as e:
        return {'error': str(e)}

print('=== 1. Conectando ao EasyPanel ===')
token = login()
print('Token obtido com sucesso!')

for svc in ['meowcaller-service', 'helena-gateway']:
    print(f'\n=== 2. Disparando Deploy Rebuild para {svc} ===')
    res = deploy_service(token, svc)
    print(f'Resposta {svc}:', res)
    time.sleep(2)

print('\nAmbos os deploys foram solicitados no EasyPanel com forceRebuild: True!')
