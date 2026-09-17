#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
groq_pool.py
============
Módulo centralizado de configuración del Pool de API Keys de Groq Cloud para LaboraPy.
Permite balancear carga, ejecutar workers concurrentes (4x throughput)
y aislar límites de velocidad (RPM/TPM) a costo $0 con 0% de uso de CPU local.
"""

from __future__ import annotations
import os
from typing import List

# Pool de API keys de Groq Cloud — SOLO variables de entorno (sin credenciales hardcodeadas)
GROQ_POOL_KEYS: List[str] = [
    k for k in (
        os.environ.get("GROQ_API_KEY_1"),
        os.environ.get("GROQ_API_KEY_2"),
        os.environ.get("GROQ_API_KEY_3"),
        os.environ.get("GROQ_API_KEY_4"),
        os.environ.get("GROQ_API_KEY"),
    ) if k
]

if not GROQ_POOL_KEYS:
    raise RuntimeError(
        "No hay claves Groq configuradas: definí GROQ_API_KEY_1..4 (o GROQ_API_KEY) en el entorno."
    )

def get_groq_key(worker_index: int = 0) -> str:
    """Retorna una clave específica del pool según el índice del worker."""
    return GROQ_POOL_KEYS[worker_index % len(GROQ_POOL_KEYS)]

def get_all_groq_keys() -> List[str]:
    """Retorna la lista completa de claves activas en el pool."""
    return list(GROQ_POOL_KEYS)
