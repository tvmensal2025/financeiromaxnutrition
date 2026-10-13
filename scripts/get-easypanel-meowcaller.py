# scripts/get-easypanel-meowcaller.py
import urllib.request
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

def get_service_details(token, service_name):
    url = f'{BASE_URL}/api/trpc/services.app.getService?input=' + urllib.parse.quote(json.dumps({
        'json': {'projectName': 'helena-automation', 'serviceName': service_name}
    }))
    req = urllib.request.Request(
        url,
        headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(req, timeout=10) as res:
        return json.loads(res.read().decode('utf-8'))

token = login()
for name in ['meowcaller-service', 'helena-gateway']:
    print(f'=== {name} ===')
    svc = get_service_details(token, name)
    # print keys of json
    jsonData = svc.get('json', {})
    print('Keys:', list(jsonData.keys()))
    # Let's inspect env
    env = jsonData.get('env', '')
    print('Raw env:', env)
