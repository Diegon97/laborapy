import os, requests, json, sys

sys.stdout.reconfigure(encoding='utf-8')

url = 'https://wbbcqololvxlnmxajurd.supabase.co/rest/v1/jurisprudencia_multimedia?select=autor_id,titulo_tema,caso_abuso_detectado,fundamento_juridico,criterio_practico,articulos_citados&limit=5'
key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')

if not key:
    print('Falta SUPABASE_SERVICE_ROLE_KEY en el entorno.', file=sys.stderr)
    sys.exit(1)

r = requests.get(url, headers={'apikey': key, 'Authorization': f'Bearer {key}'})
for idx, d in enumerate(r.json()[:4], 1):
    print(f"=== CASO {idx} ===")
    print(f"Título: {d.get('titulo_tema')}")
    print(f"Abuso: {d.get('caso_abuso_detectado')}")
    print(f"Fundamento: {d.get('fundamento_juridico')}")
    print(f"Criterio: {d.get('criterio_practico')}")
    print(f"Artículos: {d.get('articulos_citados')}\n")
