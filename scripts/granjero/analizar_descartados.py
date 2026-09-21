import json
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

cp_path = r'C:\Users\dnunez.SWOOSH\Documents\Calculadora RRHH\calculadora-rrhh-py\datasets\checkpoint_gemini_eval.json'
unicos_path = r'C:\Users\dnunez.SWOOSH\Documents\Calculadora RRHH\calculadora-rrhh-py\datasets\comentarios_unicos_5_abogados_real.json'

with open(cp_path, 'r', encoding='utf-8') as f:
    cp = json.load(f)

with open(unicos_path, 'r', encoding='utf-8') as f:
    unicos = json.load(f)

unicos_map = {idx: c for idx, c in enumerate(unicos, 1)}

preguntas_descartadas = []
afirmaciones_laborales_descartadas = []

for k, v in cp.items():
    if not v.get('oiko'):
        c_orig = unicos_map.get(int(k), {})
        com = c_orig.get('comentario', '')
        motivo = v.get('motivo', '')
        item = {
            'id': int(k),
            'abogado': c_orig.get('abogado'),
            'comentario': com,
            'motivo': motivo
        }
        
        com_l = com.lower()
        es_pregunta = ('?' in com or 'cuanto' in com_l or 'puedo' in com_l or 'como' in com_l or 'sera' in com_l or 'debo' in com_l or 'que pasa' in com_l or 'se puede' in com_l)
        
        if es_pregunta and len(com.strip()) > 20:
            preguntas_descartadas.append(item)
        elif any(w in com_l for w in ['ips', 'sueldo', 'renuncia', 'despido', 'aguinaldo', 'vacaciones', 'liquidacion', 'preaviso', 'descuento', 'reposo', 'horas extra']) and len(com.strip()) > 25:
            afirmaciones_laborales_descartadas.append(item)

print(f"Preguntas descartadas (potencialmente rescatables): {len(preguntas_descartadas)}")
print(f"Comentarios sobre temas laborales descartados: {len(afirmaciones_laborales_descartadas)}")

print("\n--- MUESTRA 1: PREGUNTAS REALES DESCARTADAS POR SER 'GENÉRICAS' O 'BREVES' ---")
for p in preguntas_descartadas[:8]:
    print(f"ID {p['id']} (@{p['abogado']}): \"{p['comentario']}\"")
    print(f"  -> Motivo: {p['motivo']}\n")

print("\n--- MUESTRA 2: SITUACIONES LABORALES DESCARTADAS POR TONO/QUEJA ---")
for a in afirmaciones_laborales_descartadas[:8]:
    print(f"ID {a['id']} (@{a['abogado']}): \"{a['comentario']}\"")
    print(f"  -> Motivo: {a['motivo']}\n")
