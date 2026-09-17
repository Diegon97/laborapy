import json, os, sys
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

y_files = [f for f in os.listdir('audios/yampey') if f.lower().endswith('.mp3')] if os.path.exists('audios/yampey') else []
b_files = [f for f in os.listdir('audios/bernis') if f.lower().endswith('.mp3')] if os.path.exists('audios/bernis') else []

y_state = json.load(open('ingestion_state.json', encoding='utf-8')) if os.path.exists('ingestion_state.json') else {'processed': {}, 'failed': {}}
b_state = json.load(open('ingestion_state_bernis.json', encoding='utf-8')) if os.path.exists('ingestion_state_bernis.json') else {'processed': {}, 'failed': {}}

y_proc = len(y_state.get('processed', {}))
b_proc = len(b_state.get('processed', {}))

print(f"📊 ESTADO ACTUAL DE INGESTIÓN (APRENDIZAJE):")
print(f"==========================================")
print(f"👨‍⚖️ Ernesto Yampey:")
print(f"   • Total audios: {len(y_files)}")
print(f"   • Procesados: {y_proc} ({y_proc/len(y_files)*100:.1f}%)")
print(f"   • Pendientes: {len(y_files) - y_proc}")
print(f"   • Fallados: {len(y_state.get('failed', {}))}")
print(f"")
print(f"👨‍⚖️ Juan Bernis:")
print(f"   • Total audios: {len(b_files)}")
print(f"   • Procesados: {b_proc} ({b_proc/len(b_files)*100:.1f}%)" if len(b_files)>0 else "   • Procesados: 0")
print(f"   • Pendientes: {len(b_files) - b_proc}")
print(f"   • Fallados: {len(b_state.get('failed', {}))}")
print(f"==========================================")
