import zipfile, os, sys

sys.stdout.reconfigure(encoding='utf-8')
zip_path = 'audios_laborales_py.zip'
dest = '.'

print("Iniciando extracción de audios de Bernis desde el ZIP...", flush=True)
with zipfile.ZipFile(zip_path, 'r') as z:
    bernis_files = [f for f in z.namelist() if f.startswith('audios/bernis/') and f.endswith('.mp3')]
    total = len(bernis_files)
    print(f"Total de audios de Bernis a extraer: {total}", flush=True)
    for i, f in enumerate(bernis_files, 1):
        z.extract(f, dest)
        if i % 200 == 0 or i == total:
            print(f"Extraídos {i}/{total} audios de Bernis...", flush=True)
print("¡Extracción de Bernis finalizada con éxito!", flush=True)
