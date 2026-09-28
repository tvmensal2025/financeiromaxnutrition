# scripts/search-js.py
import urllib.request
import re

s_res = urllib.request.urlopen('http://72.60.159.48:3000/assets/index-Cth7m8Ml.js')
js = s_res.read().decode('utf-8')

# Search around "listProjects"
idx = js.find('listProjects')
print('listProjects index:', idx)
if idx != -1:
    print('Context around listProjects:')
    print(js[max(0, idx - 200):min(len(js), idx + 400)])

matches = re.findall(r'trpc\.([a-zA-Z0-9_\.]+)', js)
print('\nTRPC properties found:', sorted(list(set(matches)))[:30])
