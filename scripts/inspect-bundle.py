import urllib.request, re

res = urllib.request.urlopen('http://72.60.159.48:3000/assets/index-Cth7m8Ml.js')
js = res.read().decode('utf-8')

for m in set(re.findall(r'"([a-zA-Z0-9_]+\.[a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)?)"', js)):
    if any(k in m for k in ['login', 'deployService', 'getService', 'logs', 'Logs', 'restartService', 'destroyService']):
        print(m)
