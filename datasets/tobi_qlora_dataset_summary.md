# DATASET DE ENTRENAMIENTO QLORA / LORA — TOBI RRHH
Fecha de exportación: 2026-09-16T18:57:47.047Z
Total de pares canónicos: 52

## Formatos Disponibles:
1. **ChatML / OpenAI Messages JSONL**: `datasets/tobi_qlora_messages.jsonl` (ideal para Unsloth, HuggingFace SFTTrainer, TRL).
2. **Alpaca Instruction JSON**: `datasets/tobi_qlora_alpaca.json` (ideal para LLaMA-Factory, Axolotl, FastChat).

## Estructura por Categorías:
- **Salario Mínimo**: 8 ejemplos
- **Jornada Laboral**: 8 ejemplos
- **Fraude Laboral**: 6 ejemplos
- **Estabilidad y Fueros**: 6 ejemplos
- **Horas Extras y Feriados**: 6 ejemplos
- **Acciones de Liquidación**: 6 ejemplos
- **Acciones de Documentos**: 6 ejemplos
- **Ciberseguridad y Prescripción**: 6 ejemplos

## Parámetros Sugeridos para Fine-Tuning QLoRA:
- **Base Model**: `Qwen/Qwen2.5-7B-Instruct` o `meta-llama/Llama-3.1-8B-Instruct`
- **LoRA Rank (r)**: 16 o 32
- **LoRA Alpha**: 32 o 64
- **Target Modules**: `q_proj`, `k_proj`, `v_proj`, `o_proj`, `gate_proj`, `up_proj`, `down_proj`
- **Quantization**: 4-bit (bitsandbytes NF4)
- **Learning Rate**: 2e-4
- **Epochs**: 3 a 5
- **Optimizer**: AdamW 8-bit / paged_adamw_8bit
