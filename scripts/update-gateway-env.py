import urllib.request
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

# 1. Pega lista de servicos para pegar o env atual
req = urllib.request.Request(
    f'{BASE_URL}/api/trpc/projects.listProjectsAndServices',
    headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
)
with urllib.request.urlopen(req, timeout=10) as res:
    data = json.loads(res.read().decode('utf-8'))
    services = data.get('json', {}).get('services', [])
    gateway = next(s for s in services if s.get('projectName') == 'helena-automation' and s.get('name') == 'helena-gateway')
    cur_env = gateway.get('env', '')

lines = cur_env.split('\n')
env_dict = {}
for line in lines:
    line = line.strip()
    if line and not line.startswith('#') and '=' in line:
        k, v = line.split('=', 1)
        env_dict[k.strip()] = v.strip()

# Adiciona a chave Google Gemini e Kokoro
env_dict['GOOGLE_AI_API_KEY'] = 'AQ.Ab8RN6KL6RtZGf3r27Tfv1xAgnD-JpC0goy2gUSBmCxzemPjaw'
env_dict['KOKORO_BASE_URL'] = 'https://helena-automation-kokoro.d9v63q.easypanel.host'
env_dict['MEOWCALLER_BASE_URL'] = 'https://helena-automation-meowcaller-service.d9v63q.easypanel.host'

new_env = '\n'.join([f'{k}={v}' for k, v in env_dict.items()])

print('=== Atualizando Env do helena-gateway ===')
update_url = f'{BASE_URL}/api/trpc/services.app.updateEnv'
payload = {
    'json': {
        'projectName': 'helena-automation',
        'serviceName': 'helena-gateway',
        'env': new_env
    }
}
req2 = urllib.request.Request(
    update_url,
    data=json.dumps(payload).encode('utf-8'),
    headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
)
with urllib.request.urlopen(req2, timeout=15) as res:
    print('updateEnv status:', res.status, res.read().decode('utf-8'))
