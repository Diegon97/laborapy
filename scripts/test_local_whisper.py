import time, sys
sys.stdout.reconfigure(encoding='utf-8')
from faster_whisper import WhisperModel

print('Cargando modelo local faster-whisper (base)...', flush=True)
t0 = time.time()
model = WhisperModel('base', device='cpu', compute_type='int8')
print(f'Modelo cargado en {time.time()-t0:.2f}s', flush=True)

t1 = time.time()
segments, info = model.transcribe('audios/yampey/4 DERECHOS BASICOS.mp3', language='es')
text = ' '.join([s.text for s in segments]).strip()
print(f'Transcripción local en {time.time()-t1:.2f}s:\n"{text[:150]}..."', flush=True)
