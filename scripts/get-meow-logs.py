import urllib.request, urllib.parse, json

BASE_URL = 'http://72.60.159.48:3000'
req = urllib.request.Request(
    f'{BASE_URL}/api/trpc/auth.login',
    data=json.dumps({'json': {'email': 'rafael.ids@icloud.com', 'password': '201097De.'}}).encode('utf-8'),
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
