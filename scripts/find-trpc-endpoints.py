import urllib.request, re

url = 'http://72.60.159.48:3000/assets/index-Cth7m8Ml.js'
js = urllib.request.urlopen(url).read().decode('utf-8', errors='ignore')

matches = set(re.findall(r'/api/trpc/([a-zA-Z0-9_\.]+)', js))
print('Endpoints com /api/trpc/:', len(matches))
for m in sorted(list(matches)):
    print(' -', m)

# Busca strings de procedures tRPC comuns como 'services.' ou '.logs'
matches2 = set(re.findall(r'["\'](services\.[a-zA-Z0-9_\.]+)["\']', js))
print('\nProcedures com services.:', len(matches2))
for m in sorted(list(matches2)):
    print(' -', m)
