#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TRAIN_QLORA_UNSLOTH.PY — LABORAPY
Script de fine-tuning QLoRA (4-bit) optimizado para Qwen 2.5 7B / LLaMA 3.1 8B
usando Unsloth y Hugging Face TRL (Supervised Fine-Tuning).
Compatible con Google Colab (GPU T4 / A100), Kaggle y RunPod.
"""

import os
import torch

def main():
    print("================================================================")
    print("🚀 INICIANDO FINE-TUNING QLORA (TOBI RRHH PARAGUAY)")
    print("================================================================\n")

    try:
        from unsloth import FastLanguageModel
        from trl import SFTTrainer
        from transformers import TrainingArguments
        from datasets import load_dataset
    except ImportError:
        print("❌ Bibliotecas no instaladas. Para instalar ejecuta:")
        print("   pip install unsloth torch transformers trl datasets bitsandbytes accelerate")
        return

    # 1. Configuración del Modelo Base
    max_seq_length = 2048
    model_name = "Qwen/Qwen2.5-7B-Instruct"  # O "meta-llama/Meta-Llama-3.1-8B-Instruct"

    print(f"📦 Cargando modelo base: {model_name} en 4-bit (bitsandbytes)...")
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=model_name,
        max_seq_length=max_seq_length,
        load_in_4bit=True,
    )

    # 2. Configuración de Adaptadores LoRA
    print("🔧 Inyectando adaptadores LoRA (r=16, alpha=32)...")
    model = FastLanguageModel.get_peft_model(
        model,
        r=16,
        target_modules=[
            "q_proj", "k_proj", "v_proj", "o_proj",
            "gate_proj", "up_proj", "down_proj"
        ],
        lora_alpha=32,
        lora_dropout=0,  # 0 es óptimo para Unsloth
        bias="none",
        use_gradient_checkpointing="unsloth",
        random_state=3407,
    )

    # 3. Carga del Dataset de Oro
    dataset_path = "datasets/tobi_gold_dataset_v3_combined.jsonl"
    if not os.path.exists(dataset_path):
        dataset_path = "calculadora-rrhh-py/datasets/tobi_gold_dataset_v3_combined.jsonl"

    print(f"📂 Cargando dataset: {dataset_path}...")
    dataset = load_dataset("json", data_files=dataset_path, split="train")

    def formatting_prompts_func(examples):
        convos = examples["messages"]
        texts = [
            tokenizer.apply_chat_template(convo, tokenize=False, add_generation_prompt=False)
            for convo in convos
        ]
        return {"text": texts}

    dataset = dataset.map(formatting_prompts_func, batched=True)

    # 4. Parámetros de Entrenamiento (SFT)
    training_args = TrainingArguments(
        per_device_train_batch_size=2,
        gradient_accumulation_steps=4,
        warmup_steps=10,
        max_steps=120,  # O num_train_epochs=3
        learning_rate=2e-4,
        fp16=not torch.cuda.is_bf16_supported(),
        bf16=torch.cuda.is_bf16_supported(),
        logging_steps=5,
        optim="adamw_8bit",
        weight_decay=0.01,
        lr_scheduler_type="linear",
        seed=3407,
        output_dir="outputs/tobi-qlora-adapter",
        report_to="none",
    )

    trainer = SFTTrainer(
        model=model,
        tokenizer=tokenizer,
        train_dataset=dataset,
        dataset_text_field="text",
        max_seq_length=max_seq_length,
        dataset_num_proc=2,
        packing=False,
        args=training_args,
    )

    # 5. Ejecutar Entrenamiento
    print("🔥 Entrenando adaptadores QLoRA...")
    trainer_stats = trainer.train()
    print(f"✅ Entrenamiento finalizado en {trainer_stats.metrics.get('train_runtime', 0):.2f} segundos.")

    # 6. Guardar Adaptadores LoRA y Modelo en GGUF (para Ollama / vLLM)
    output_dir = "models/tobi-lora-py"
    print(f"💾 Guardando adaptadores en {output_dir}...")
    model.save_pretrained(output_dir)
    tokenizer.save_pretrained(output_dir)

    print("\n🎉 ¡Fine-Tuning completado exitosamente!")
    print("👉 Para exportar a GGUF para Ollama:")
    print("   model.save_pretrained_gguf('models/tobi-qwen2.5-7b-q4_k_m.gguf', tokenizer, quantization_method='q4_k_m')")

if __name__ == "__main__":
    main()
