# scripts/get-action-logs.py
import urllib.request
import json
import time
from require_env import require_env

time.sleep(2)
BASE_URL = 'http://72.60.159.48:3000'
req = urllib.request.Request(
    f'{BASE_URL}/api/trpc/auth.login',
    data=json.dumps({'json': {'email': require_env('EASYPANEL_EMAIL'), 'password': require_env('EASYPANEL_PASSWORD')}}).encode(),
    headers={'Content-Type': 'application/json'}
)
with urllib.request.urlopen(req, timeout=10) as res:
    token = json.loads(res.read())['json']['token']

req2 = urllib.request.Request(
    f'{BASE_URL}/api/trpc/actions.listActions?input=%7B%22json%22%3A%7B%22projectName%22%3A%22helena-automation%22%7D%7D',
    headers={'Authorization': f'Bearer {token}'}
)
with urllib.request.urlopen(req2, timeout=10) as res2:
    actions = json.loads(res2.read()).get('json', [])
    for a in actions[:4]:
        act_id = a.get('id')
        svc = a.get('serviceName')
        st = a.get('status')
        print(f'=== ACTION {act_id} ({svc}): {st} ===')
        for ep in ['actions.getAction', 'actions.getLogs', 'actions.getActionLogs']:
            req_log = urllib.request.Request(
                f'{BASE_URL}/api/trpc/{ep}?input=%7B%22json%22%3A%7B%22id%22%3A%22{act_id}%22%7D%7D',
                headers={'Authorization': f'Bearer {token}'}
            )
            try:
                with urllib.request.urlopen(req_log, timeout=5) as res_log:
                    data = json.loads(res_log.read())
                    print(f'[{ep}] ->', json.dumps(data)[:500])
                    break
            except Exception as e:
                pass
