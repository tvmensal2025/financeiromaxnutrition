import urllib.request, re

url = 'http://72.60.159.48:3000/assets/index-Cth7m8Ml.js'
js = urllib.request.urlopen(url).read().decode('utf-8', errors='ignore')

# Procura chamadas tRPC
matches = re.findall(r'trpc\.([a-zA-Z0-9_\.]+)', js)
unique = sorted(list(set(matches)))
print('Total trpc matches:', len(unique))
for m in unique:
    if any(k in m.lower() for k in ['log', 'app', 'service', 'console']):
        print(' -', m)
