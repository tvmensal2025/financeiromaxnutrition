# scripts/find-trpc.py
import urllib.request
import urllib.parse
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

for ep in [
    'services.listServices',
    'services.getServices',
    'projects.getProjectServices',
    'services.app.listServices',
    'services.app.getServices',
    'projects.getProjectDetails'
]:
    url = f'{BASE_URL}/api/trpc/{ep}?input=' + urllib.parse.quote(json.dumps({'json': {'projectName': 'helena-automation'}}))
    req = urllib.request.Request(
        url,
        headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as res:
            print(f'SUCCESS: {ep} ->', res.read().decode('utf-8')[:200])
    except urllib.error.HTTPError as e:
        print(f'FAILED: {ep} -> {e.code}')
    except Exception as e:
        print(f'ERROR: {ep} -> {e}')
