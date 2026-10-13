import urllib.request, urllib.parse, json
from require_env import require_env

BASE_URL = 'http://72.60.159.48:3000'
req = urllib.request.Request(
    f'{BASE_URL}/api/trpc/auth.login',
    data=json.dumps({'json': {'email': require_env('EASYPANEL_EMAIL'), 'password': require_env('EASYPANEL_PASSWORD')}}).encode('utf-8'),
    headers={'Content-Type': 'application/json'}
)
with urllib.request.urlopen(req, timeout=10) as res:
    token = json.loads(res.read().decode('utf-8'))['json']['token']

payload = '{"json":{"projectName":"helena-automation","serviceName":"meowcaller-service","lines":1500}}'
for endpoint in ['services.getLogs', 'services.app.getLogs', 'project.service.getLogs']:
    url = f'{BASE_URL}/api/trpc/{endpoint}?input=' + urllib.parse.quote(payload)
    req2 = urllib.request.Request(url, headers={'Authorization': f'Bearer {token}'})
    try:
        with urllib.request.urlopen(req2) as res:
            print(f'Success with {endpoint}:')
            print(res.read().decode('utf-8')[-5000:])
            break
    except Exception as e:
        print(f'Failed with {endpoint}:', e)
