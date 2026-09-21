# ARQUITECTURA DE NEGOCIO AUTÓNOMO 24/7 (MULTI-AGENTE + EVENT-DRIVEN)
> **Estado:** APROBADO PARA FASE POST-LANZAMIENTO COMERCIAL.  
> **Fecha de Documentación:** 2026-09-19  
> **Target:** Automatización operativa integral de LaboraPy (Marketing, Ventas, Meta Ads, Finanzas, Legal y Desarrollo).

---

## 1. FILOSOFÍA EJECUTIVA Y PRINCIPIOS DE GOBERNANZA

### 1.1 Desmitificación: Event-Driven vs. "Bucles 24/7"
- **El Mito:** Agentes corriendo en un ciclo infinito (`while true`), dialogando entre sí en el vacío para administrar la empresa. (Resultado real: costos astronómicos de API, alucinaciones financieras/legales, suspensiones de cuentas de Meta por spam y fallos en cascada).
- **La Realidad Arquitectónica:** Una **arquitectura basada en eventos (Event-Driven)** gobernada por un orquestador determinista central, complementada con **Agentes Cognitivos Especializados** y un esquema estricto de **Human-in-the-Loop (HITL)** para acciones de riesgo medio y alto.

### 1.2 Regla de Oro: Lo determinista jamás usa LLMs
1. **Flujos Deterministas ($0 tokens / 100% predecible):**
   - Webhooks, sincronización de base de datos, enrutamiento de leads, cálculo de balances, facturación e impuestos. Todo esto se programa en código puro / nodos de integración.
2. **Agentes Cognitivos (Invocación deliberada por valor marginal):**
   - Calificación cualitativa de prospectos (BANT/MEDDIC), redacción de copys contextuales, parsing multimodal de facturas desestructuradas (OCR con LLM), auditoría de métricas publicitarias anómalas y análisis de cláusulas contractuales.

---

## 2. DIAGRAMA DE ARQUITECTURA GENERAL

```
                          ┌──────────────────────────────────────────────┐
                          │          EVENTOS DEL MUNDO REAL              │
                          │ (WhatsApp, Stripe, Meta Ads, Webhooks, Cron) │
                          └──────────────────────┬───────────────────────┘
                                                 │
                                                 ▼
                          ┌──────────────────────────────────────────────┐
                          │    ORQUESTADOR CENTRAL DETERMINISTA (n8n)     │
                          │   Maneja colas, reintentos, webhooks y APIs  │
                          └──────┬───────────────┬───────────────┬───────┘
                                 │               │               │
        ┌────────────────────────┘               │               └────────────────────────┐
        ▼                                        ▼                                        ▼
 ┌──────────────┐                         ┌──────────────┐                         ┌──────────────┐
 │ AGENTE LEADS │                         │ AGENTE ADS / │                         │ AGENTE ADMIN │
 │  & VENTAS    │                         │  CONTENIDO   │                         │   & LEGAL    │
 └──────┬───────┘                         └──────┬───────┘                         └──────┬───────┘
        │                                        │                                        │
        └────────────────────────┬───────────────┴────────────────────────────────────────┘
                                 ▼
        ┌────────────────────────────────────────────────────────┐
        │       GATE DE AUTORIZACIÓN (Telegram / WhatsApp)       │
        │   [Aprobar / Rechazar] antes de ejecutar gastos/posts   │
        └────────────────────────────────────────────────────────┘
```

---

## 3. EL STACK TÉCNICO MAESTRO

| Capa | Herramienta / Tecnología | Rol y Justificación |
| :--- | :--- | :--- |
| **Orquestador Central** | **n8n (Self-Hosted en VPS)** | Manejo de webhooks, colas, reintentos y orquestación de agentes con nodos LangChain integrados. Costo fijo ($10–$20/mes) en Hetzner o Railway. |
| **Memoria & Estado** | **Supabase (PostgreSQL + pgvector)** | Base de datos relacional para leads, métricas y finanzas. Búsqueda vectorial (`pgvector`) para RAG empresarial (manual de marca, políticas, leyes). |
| **Canal de Clientes** | **WhatsApp Cloud API / Evolution API** | Ingesta y respuesta a clientes en tiempo real sin riesgo de baneos por herramientas no oficiales. |
| **Canal del Dueño (HITL)** | **Telegram Bot Privado** | Mensajes interactivos con botones inline (`Aprobar`, `Rechazar`, `Editar`) para autorizar publicaciones, presupuestos o gastos. |
| **Modelos de Lenguaje** | **Gemini 3.5 Flash / DeepSeek Flash** | Modelos económicos y veloces para tareas diarias (clasificación, resúmenes, extracción). |
| **Modelos de Razonamiento** | **Gemini 3.1 Pro / DeepSeek V4.1** | Invocados exclusivamente para el Agente CEO semanal, auditorías legales complejas y análisis de arquitectura. |

---

## 4. AGENTES DEPARTAMENTALES Y MATRIZ DE RIESGO

### 4.1 Niveles de Autonomía
- **Nivel 1 (Autonomía Total):** Solo lectura, análisis, alertas internas, clasificación de leads. Cero impacto exterior destructivo.
- **Nivel 2 (Semi-Autónomo / HITL Obligatorio):** Generación de borradores de contenido, propuestas comerciales personalizadas, cambios en presupuestos de Meta Ads. Requiere confirmación de 1 tap en Telegram.
- **Nivel 3 (Asistencia / Humano Obligatorio):** Transferencias bancarias, firmas de contratos legales, despido o liquidación formal de personal.

---

### 4.2 Especificación por Departamento

#### A. Ventas y Gestión de Leads (WhatsApp CRM)
- **Disparador:** Mensaje entrante de WhatsApp o formulario web.
- **Lógica:**
  1. Identifica al cliente en Supabase por número de teléfono.
  2. Si es nuevo, califica usando metodología BANT (Presupuesto, Autoridad, Necesidad, Tiempo).
  3. Responde consultas frecuentes consultando el RAG de la base de conocimiento de LaboraPy.
  4. Si el lead está listo para compra: genera link de pago directo o agenda demo en Calendly.
  5. Si el lead tiene dudas complejas: etiqueta en CRM (`requiere_humano`) y notifica al equipo comercial.

#### B. Marketing y Redes Sociales
- **Disparador:** Cron semanal (Lunes 08:00) o evento de tendencias.
- **Lógica:**
  1. Lee el calendario editorial y los pilares de contenido de la marca.
  2. Genera 5 propuestas de publicaciones (carruseles, posts de LinkedIn, reels/TikTok scripts).
  3. Envía los borradores al canal de Telegram del fundador con botones: `[Publicar en Buffer/Meta] | [Regenerar] | [Descartar]`.
  4. Tras la aprobación, la API de Buffer o Meta Graph API publica automáticamente en el horario óptimo.

#### C. Meta Ads (Media Buyer Autónomo)
- **Disparador:** Cron cada 4 o 6 horas.
- **Lógica:**
  1. Consulta la Meta Graph API para métricas clave: Gasto, Impresiones, CTR, CPC, CPA, ROAS.
  2. **Kill-Switch Automático (Nivel 1):** Si un adset gastó > $15 con CTR < 0.8% o CPA > 2x el objetivo, lo pausa inmediatamente y envía alerta.
  3. **Escalado Sugerido (Nivel 2):** Si un creativo tiene ROAS > 3.5 con volumen sostenido, envía mensaje a Telegram: *"Creativo #4 tiene ROAS 4.2. ¿Aumentar presupuesto diario de $10 a $15?"*

#### D. Financiero y Administrativo
- **Disparador:** Webhook de pasarela de pago (Stripe/Bancard) o foto/PDF de factura subido a Telegram/Drive.
- **Lógica:**
  1. Para facturas: Ingesta multimodal con Gemini Flash para extraer RUC, proveedor, fecha, monto exento, IVA 5%, IVA 10% y total.
  2. Registra el gasto clasificado en Supabase.
  3. Compara en tiempo real contra el presupuesto mensual del área.
  4. Si detecta un gasto duplicado o un desvío mayor al 15%, emite alerta inmediata.

#### E. Legal y Cumplimiento
- **Disparador:** Subida de nuevo contrato, acuerdo de confidencialidad o consulta sobre finiquito.
- **Lógica:**
  1. RAG especializado sobre la legislación laboral paraguaya (Ley 213/93, Ley 496/95 y decretos reglamentarios).
  2. Audita cláusulas de exclusividad, no competencia, periodos de prueba y causales de despido.
  3. Emite un informe de riesgos con nivel de criticidad (Rojo/Amarillo/Verde) antes de la firma.

#### F. Desarrollo y Soporte de Software
- **Disparador:** Issues de GitHub, reportes de Sentry o prompts en opencode.
- **Lógica:** Operado por el protocolo de la Tríada v4.1 (Orquestador Gemini + DeepSeek Writer/Reviewer), garantizando tests 100% pasando antes de cualquier deploy a producción.

---

## 5. EL AGENTE CEO (REPORTE EJECUTIVO SEMANAL)

- **Frecuencia:** Domingos a las 20:00.
- **Flujo:**
  1. Consulta las tablas consolidadas de Supabase de la semana que cierra:
     - Facturación bruta, neta, ARPU, churn y margen operativo.
     - Leads recibidos, tasa de conversión y costo por adquisición (CAC).
     - Gasto publicitario total, ROAS consolidado y mejores anuncios.
     - Incidentes técnicos y tiempos de respuesta de soporte.
  2. Procesa los datos con un modelo de alto razonamiento con foco directivo.
  3. Entrega un resumen ejecutivo estructurado directamente al WhatsApp/Telegram del fundador con las 3 prioridades estratégicas de la siguiente semana.

---

## 6. HOJA DE RUTA DE IMPLEMENTACIÓN POST-LANZAMIENTO

```
[LANZAMIENTO COMERCIAL]
         │
         ▼
[FASE 1: VENTAS & LEADS]  ──────► n8n + WhatsApp + Calificación BANT + Supabase
         │
         ▼
[FASE 2: MARKETING & ADS] ──────► Ingesta Meta Graph API + Kill-Switch + Borradores
         │
         ▼
[FASE 3: FINANZAS & OCR]  ──────► Facturación automática + Ingesta de gastos PDF
         │
         ▼
[FASE 4: AGENTE CEO 24/7] ──────► Consolidación ejecutiva dominical + RAG Legal
```

1. **Fase 1 (Semanas 1-2 post-lanzamiento):** Atender y monetizar el tráfico comercial. WhatsApp Cloud API + n8n + Supabase.
2. **Fase 2 (Semanas 3-4 post-lanzamiento):** Control de inversión publicitaria y generación continua de contenido con aprobación en 1 tap.
3. **Fase 3 (Mes 2):** OCR de facturas y conciliación de cobros para tener visibilidad financiera en tiempo real.
4. **Fase 4 (Mes 3):** Conexión del Agente CEO y auditoría legal continua.
