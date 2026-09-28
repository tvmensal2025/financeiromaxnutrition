import urllib.request, json

BASE_URL = 'http://72.60.159.48:3000'
req = urllib.request.Request(
    f'{BASE_URL}/api/trpc/auth.login',
    data=json.dumps({'json': {'email': 'rafael.ids@icloud.com', 'password': '201097De.'}}).encode('utf-8'),
    headers={'Content-Type': 'application/json'}
)
with urllib.request.urlopen(req) as res:
    token = json.loads(res.read().decode('utf-8'))['json']['token']

req2 = urllib.request.Request(
    f'{BASE_URL}/api/trpc/projects.listProjectsAndServices',
    headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
)
with urllib.request.urlopen(req2) as res:
    data = json.loads(res.read().decode('utf-8'))['json']

for s in data.get('services', []):
    env = s.get('env', '')
    p_name = s.get('projectName')
    s_name = s.get('name')
    for line in env.split('\n'):
        if any(k in line.upper() for k in ['GEMINI', 'GOOGLE', 'AI_KEY', 'GROK', 'OPENAI', 'OCR']):
            print(f'{p_name}/{s_name}: {line}')
