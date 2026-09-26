import urllib.request
import json
import time

def check():
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
        for a in actions:
            if a.get('id') == 'cmuigm05p007t07jxdh3jaysl':
                return a.get('status')
    return 'not_found'

for i in range(30):
    st = check()
    print(f'Attempt {i+1}: meowcaller-service status = {st}')
    if st in ['done', 'failed', 'error']:
        break
    time.sleep(5)
