#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
=============================================================================
BOT AUTÓNOMO GRANJERO — COSECHA 100% AUTOMÁTICA (TIKTOK / IG / FACEBOOK)
=============================================================================
Misión: Cosechar de forma autónoma (sin intervención manual) comentarios y
        consultas laborales en las cuentas de los principales abogados
        laboralistas de Paraguay (Ernesto Yampey, Juan Bernis y colegas).
        
Flujo 100% Automático:
1. Extrae comentarios de los videos y posts más recientes en TikTok/IG/FB.
2. Aplica el Escudo Anti-Contaminación (100% Paraguay, 0% leyes extranjeras).
3. Genera el dictamen pericial con Gemini 3.8 Flash (Capataz local) y cierre
   comercial a Diego Núñez (+595 984 469 005).
4. Inserta automáticamente en Supabase (tabla jurisprudencia_multimedia / RAG).
=============================================================================
"""

from __future__ import annotations

import os
import sys
import json
import time
import re
import argparse
from pathlib import Path
from typing import Dict, List, Any, Optional

try:
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
except Exception:
    pass

import requests

# Asegurar que el directorio de este script esté en sys.path
CURRENT_DIR = Path(__file__).resolve().parent
if str(CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(CURRENT_DIR))

# Importar el motor pericial y filtro de cosecha
from cosechador_redes_py import (
    es_comentario_paraguayo_valido,
    generar_dictamen_pericial_granjero,
    insertar_en_supabase,
    ABOGADOS_PY
)

# ---------------------------------------------------------------------------
# CUENTAS OBJETIVO DE ABOGADOS LABORALISTAS EN PARAGUAY
# ---------------------------------------------------------------------------
OBJETIVOS_PARAGUAY = [
    {
        'clave': 'yampey',
        'nombre': 'Ernesto Yampey',
        'tiktok_url': 'https://www.tiktok.com/@ernestoyampey',
        'instagram_url': 'https://www.instagram.com/ernesto.yampey/',
        'facebook_url': 'https://www.facebook.com/ernesto.yampey/'
    },
    {
        'clave': 'bernis',
        'nombre': 'Juan Bernis / Naty Ovando',
        'tiktok_url': 'https://www.tiktok.com/@juanbernis',
        'instagram_url': 'https://www.instagram.com/juanbernis/',
        'facebook_url': 'https://www.facebook.com/juanbernisabogado/'
    },
    {
        'clave': 'jorgefleitas',
        'nombre': 'Dr. Jorge Fleitas',
        'tiktok_url': 'https://www.tiktok.com/@jorgefleitasoficial8',
        'instagram_url': 'https://www.instagram.com/jorgefleitasoficial8/',
        'facebook_url': 'https://www.facebook.com/jorgefleitasoficial8/'
    },
    {
        'clave': 'dahianavalos',
        'nombre': 'Dahiana Avalos',
        'tiktok_url': 'https://www.tiktok.com/@dahianavalos',
        'instagram_url': 'https://www.instagram.com/dahianavalos/',
        'facebook_url': 'https://www.facebook.com/dahianavalos/'
    },
    {
        'clave': 'claralopez',
        'nombre': 'Abg. Clara López',
        'tiktok_url': 'https://www.tiktok.com/@abg.clara.lopez',
        'instagram_url': 'https://www.instagram.com/abg.clara.lopez/',
        'facebook_url': 'https://www.facebook.com/abg.clara.lopez/'
    }
]

def get_apify_token() -> Optional[str]:
    token = os.environ.get('APIFY_API_TOKEN') or os.environ.get('APIFY_TOKEN')
    if token:
        return token
    # Intentar leer desde .env en la raíz del proyecto
    for env_path in [
        Path(__file__).resolve().parent.parent.parent / '.env',
        Path(__file__).resolve().parent.parent.parent / '.env.local',
    ]:
        if env_path.exists():
            try:
                for line in env_path.read_text(encoding='utf-8').splitlines():
                    line = line.strip()
                    if line.startswith('APIFY_API_TOKEN=') or line.startswith('APIFY_TOKEN='):
                        return line.split('=', 1)[1].strip().strip('"').strip("'")
            except Exception:
                pass
    return None

APIFY_TOKEN = get_apify_token()

# ---------------------------------------------------------------------------
# MÉTODO 1: COSECHA CLOUD VÍA APIFY (100% Manos Libres, Sin Captchas ni Bloqueos)
# ---------------------------------------------------------------------------
def cosechar_con_apify(
    plataforma: str,
    target_urls: List[str],
    max_comments: int = 200
) -> List[Dict[str, Any]]:
    """
    Ejecuta un actor de Apify en la nube para extraer comentarios sin que el usuario
    tenga que abrir el navegador ni lidiar con captchas o bloqueos de IP.
    """
    if not APIFY_TOKEN:
        print("  ⚠️ APIFY_API_TOKEN no configurado. Para extracción cloud sin abrir navegador,")
        print("     configurá tu token gratuito de Apify en las variables de entorno.")
        return []

    try:
        from apify_client import ApifyClient
    except ImportError:
        print("  ❌ apify-client no instalado. Ejecutá: pip install apify-client")
        return []

    client = ApifyClient(APIFY_TOKEN)
    comentarios_extraidos = []

    print(f"\n☁️ [Apify Cloud] Iniciando extracción de comentarios para {plataforma.upper()}...")

    if plataforma == 'tiktok':
        # Actor especializado clockworks/tiktok-scraper
        profile_names = []
        for u in target_urls:
            if '@' in u:
                profile_names.append(u.split('@')[-1].split('/')[0])
            else:
                profile_names.append(u)

        run_input = {
            "profiles": profile_names,
            "resultsPerPage": 5,
            "commentsPerPost": max_comments,
            "profileScrapeSections": ["videos"],
            "profileSorting": "latest",
            "shouldDownloadVideos": False,
            "shouldDownloadCovers": False
        }
        try:
            run = client.actor("clockworks/tiktok-scraper").call(run_input=run_input)
            dataset = client.dataset(run.default_dataset_id)
            for item in dataset.iterate_items():
                comments_url = item.get("commentsDatasetUrl")
                if comments_url:
                    try:
                        resp = requests.get(comments_url, timeout=20)
                        if resp.status_code == 200:
                            for c in resp.json():
                                text = c.get("text")
                                if text:
                                    comentarios_extraidos.append({
                                        "texto": text,
                                        "plataforma": "tiktok",
                                        "post_url": item.get("webVideoUrl", "")
                                    })
                    except Exception as ce:
                        print(f"    ⚠️ Error descargando comentarios del dataset: {ce}")
        except Exception as e:
            print(f"  ❌ Error ejecutando actor de TikTok en Apify: {e}")

    elif plataforma == 'instagram':
        run_input = {
            "directUrls": target_urls,
            "resultsLimit": max_comments
        }
        try:
            run = client.actor("apify/instagram-comment-scraper").call(run_input=run_input)
            for item in client.dataset(run["defaultDatasetId"]).iterate_items():
                text = item.get("text")
                if text:
                    comentarios_extraidos.append({
                        "texto": text,
                        "plataforma": "instagram",
                        "post_url": item.get("postUrl", "")
                    })
        except Exception as e:
            print(f"  ❌ Error ejecutando actor de Instagram en Apify: {e}")

    return comentarios_extraidos

# ---------------------------------------------------------------------------
# MÉTODO 2: COSECHA LOCAL CON PLAYWRIGHT STEALTH (Segundo Plano)
# ---------------------------------------------------------------------------
def cosechar_tiktok_playwright_automatico(perfil_url: str, max_videos: int = 5) -> List[str]:
    """
    Navega en segundo plano al perfil de TikTok, extrae los videos y rescata comentarios.
    """
    try:
        from playwright.sync_api import sync_playwright
        from playwright_stealth import Stealth
    except ImportError:
        print("  ❌ Playwright no instalado. Ejecutá: pip install playwright playwright-stealth")
        return []

    comentarios = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            locale='es-ES'
        )
        page = context.new_page()
        Stealth().apply_stealth_sync(page)

        try:
            print(f"  🤖 Navegando en segundo plano a: {perfil_url}")
            page.goto(perfil_url, wait_until='networkidle', timeout=35000)
            time.sleep(3)

            # Extraer enlaces a videos
            links = page.eval_on_selector_all('a[href*="/video/"]', 'elements => elements.map(el => el.href)')
            unique_links = list(set(links))[:max_videos]
            print(f"  🎬 Videos encontrados en el perfil: {len(unique_links)}")

            for v_idx, v_url in enumerate(unique_links, 1):
                print(f"    [{v_idx}/{len(unique_links)}] Extrayendo de video: {v_url}")
                v_page = context.new_page()
                Stealth().apply_stealth_sync(v_page)

                v_comments = []
                def on_response(response):
                    if '/api/comment/list/' in response.url:
                        try:
                            data = response.json()
                            for c in data.get('comments', []):
                                t = c.get('text', '').strip()
                                if t and len(t) > 15:
                                    v_comments.append(t)
                        except Exception:
                            pass

                v_page.on('response', on_response)

                try:
                    v_page.goto(v_url, wait_until='domcontentloaded', timeout=30000)
                    time.sleep(2)
                    try:
                        v_page.click('[data-e2e="comment-icon"]', timeout=3000)
                        time.sleep(2)
                    except Exception:
                        pass

                    # Scroll suave para forzar carga
                    for _ in range(3):
                        v_page.mouse.wheel(0, 800)
                        time.sleep(1)

                    # Si la API no respondió, intentar extraer del DOM
                    if not v_comments:
                        dom_texts = v_page.eval_on_selector_all(
                            '[data-e2e="comment-level-1"] [dir="auto"], [class*="CommentText"]',
                            'els => els.map(e => e.innerText)'
                        )
                        for dt in dom_texts:
                            if dt and len(dt.strip()) > 15:
                                v_comments.append(dt.strip())

                    print(f"      💬 Comentarios capturados: {len(v_comments)}")
                    comentarios.extend(v_comments)
                except Exception as ex:
                    print(f"      ⚠️ No se pudo procesar video {v_url}: {ex}")
                finally:
                    v_page.close()

        except Exception as e:
            print(f"  ❌ Error accediendo al perfil: {e}")
        finally:
            browser.close()

    return list(set(comentarios))

# ---------------------------------------------------------------------------
# BUCLE MAESTRO AUTOMÁTICO
# ---------------------------------------------------------------------------
def ejecutar_bot_autonomo():
    print("\n" + "="*70)
    print("🌾 BOT AUTÓNOMO GRANJERO — COSECHA MASIVA DE REDES SOCIALES")
    print("🛡️  Filtro Inviolable: 100% LEY PARAGUAYA (Ley 213/93, 5508/15)")
    print("💼 Misión Comercial: Traer clientes a Diego Núñez (+595 984 469 005)")
    print("="*70 + "\n")

    total_cosechados = 0
    total_insertados_supabase = 0

    for obj in OBJETIVOS_PARAGUAY:
        nombre = obj['nombre']
        clave = obj['clave']
        print(f"\n🎯 OBJETIVO: {nombre.upper()} ({clave})")

        comentarios_candidatos = []

        # 1. Intentar con Apify Cloud si hay token
        if APIFY_TOKEN:
            print("  ☁️ Usando Apify Cloud Scraper (sin abrir navegador)...")
            apify_items = cosechar_con_apify('tiktok', [obj['tiktok_url']], max_comments=100)
            comentarios_candidatos.extend([it['texto'] for it in apify_items if it.get('texto')])
        else:
            # 2. Usar Playwright Headless local automático
            print("  🤖 Usando Playwright Headless automático en segundo plano...")
            playwright_items = cosechar_tiktok_playwright_automatico(obj['tiktok_url'], max_videos=6)
            comentarios_candidatos.extend(playwright_items)

        print(f"  📥 Total comentarios en bruto recolectados: {len(comentarios_candidatos)}")

        # Filtrar con el Escudo Paraguayo
        validos = []
        for c in comentarios_candidatos:
            ok, motivo = es_comentario_paraguayo_valido(c)
            if ok:
                validos.append(c)

        print(f"  ✅ Consultas reales paraguayas validadas: {len(validos)} (Cero leyes foráneas)")

        # Procesar con Gemini 3.8 Flash (Capataz) e insertar en Supabase
        for idx, consulta in enumerate(validos, 1):
            print(f"\n  [{idx}/{len(validos)}] Peritando caso con Gemini 3.8 Flash...")
            print(f"    👉 \"{consulta[:80]}...\"")

            dictamen = generar_dictamen_pericial_granjero(consulta)
            if not dictamen:
                print("    ❌ Falla generando dictamen.")
                continue

            print(f"    ⚖️ Tema: {dictamen.get('titulo_tema')}")
            print(f"    📜 Artículos: {', '.join(dictamen.get('articulos_citados', []))}")

            ok_sb = insertar_en_supabase(clave, 'tiktok', dictamen, consulta)
            if ok_sb:
                print("    💾 Insertado en Supabase (tobi_knowledge_base) ✓")
                total_insertados_supabase += 1
            else:
                print("    📁 Guardado en lote local ✓")

            total_cosechados += 1
            time.sleep(0.5)

    print("\n" + "="*70)
    print("🌾 COSECHA AUTÓNOMA FINALIZADA")
    print(f"📊 Total consultas paraguayas peritadas: {total_cosechados}")
    print(f"💾 Total insertados en Supabase para el RAG de Tobi: {total_insertados_supabase}")
    print("="*70 + "\n")

if __name__ == '__main__':
    ejecutar_bot_autonomo()
