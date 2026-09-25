import urllib.request
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

def get_service_details(token, service_name):
    url = f'{BASE_URL}/api/trpc/services.app.getService?input=' + urllib.parse.quote(json.dumps({
        'json': {'projectName': 'helena-automation', 'serviceName': service_name}
    }))
    req = urllib.request.Request(
        url,
        headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as res:
            return json.loads(res.read().decode('utf-8'))
    except Exception as e:
        return {'error': str(e)}

def deploy_service(token, service_name):
    url = f'{BASE_URL}/api/trpc/services.app.deployService'
    payload = {'json': {'projectName': 'helena-automation', 'serviceName': service_name, 'forceRebuild': True}}
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode('utf-8'),
        headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as res:
            return {'status': res.status, 'data': json.loads(res.read().decode('utf-8'))}
    except Exception as e:
        return {'error': str(e)}

try:
    print('1. Realizando login no EasyPanel...')
    token = login()
    print('   Token obtido com sucesso!')

    for svc in ['helena-gateway', 'meowcaller-service', 'laya-service', 'evolution-api']:
        print(f'\n2. Inspecionando {svc}...')
        details = get_service_details(token, svc)
        env_vars = details.get('json', {}).get('env', '')
        # Imprime apenas nomes das variáveis (sem valores confidenciais)
        lines = env_vars.split('\n')
        var_names = [line.split('=')[0].strip() for line in lines if '=' in line]
        print(f'   Variáveis configuradas ({len(var_names)}): {var_names}')
        
        # Se for meowcaller, queremos ver se há MEOWCALLER_TOKEN ou API_KEY
        if svc == 'meowcaller-service':
            for line in lines:
                if any(k in line for k in ['TOKEN', 'KEY', 'AUTH']):
                    k = line.split('=')[0].strip()
                    print(f'   [MEOWCALLER KEY FOUND] Chave configurada no Meowcaller: {k}')

    print('\n3. Disparando deploy para helena-gateway...')
    deploy_res = deploy_service(token, 'helena-gateway')
    print('   Deploy helena-gateway resultado:', deploy_res)

except Exception as err:
    print('Erro:', err)
