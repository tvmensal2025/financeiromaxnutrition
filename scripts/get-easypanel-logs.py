import urllib.request, urllib.parse, json, re, ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

BASE_URL = 'http://72.60.159.48:3000'

def login():
    req = urllib.request.Request(
        f'{BASE_URL}/api/trpc/auth.login',
        data=json.dumps({'json': {'email': 'rafael.ids@icloud.com', 'password': '201097De.'}}).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(req, timeout=10) as res:
        return json.loads(res.read().decode('utf-8'))['json']['token']

token = login()

# Pega o chunk que contém os endpoints do EasyPanel
req2 = urllib.request.Request(f'{BASE_URL}/', headers={'Authorization': f'Bearer {token}'})
html = urllib.request.urlopen(req2).read().decode('utf-8', errors='ignore')
scripts = re.findall(r'src="(/_next/static/chunks/[^"]+)"', html)

endpoints = set()
for s in scripts:
    try:
        js = urllib.request.urlopen(f'{BASE_URL}{s}').read().decode('utf-8', errors='ignore')
        for match in re.findall(r'"([a-zA-Z0-9_\.]+\.(?:get|list|destroy|create|deploy|update|read|stream|find)[a-zA-Z0-9_]*)"', js):
            endpoints.add(match)
    except Exception:
        pass

print("Endpoints encontrados:")
for ep in sorted(endpoints):
    if any(k in ep.lower() for k in ['log', 'service', 'app', 'deploy']):
        print(" -", ep)
