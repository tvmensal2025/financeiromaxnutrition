# scripts/find-service-type.py
import urllib.request
import urllib.parse
import json
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

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

# Let's inspect the project or search all service types
types = ['app', 'docker', 'compose', 'git', 'template']
for st in types:
    url = f'{BASE_URL}/api/trpc/services.{st}.getService?input=' + urllib.parse.quote(json.dumps({
        'json': {'projectName': 'helena-automation', 'serviceName': 'meowcaller-service'}
    }))
    req = urllib.request.Request(
        url,
        headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as res:
            print(f'SUCCESS for {st}! ->', res.read().decode('utf-8')[:300])
    except urllib.error.HTTPError as e:
        print(f'FAILED for {st} -> {e.code}')
    except Exception as e:
        print(f'ERROR for {st} -> {e}')
