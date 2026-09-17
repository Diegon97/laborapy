# REGLA INEXPUGNABLE: PARIDAD VISUAL Y FUNCIONAL TOTAL MULTIPLATAFORMA (MÓVIL Y WEB)

> **Estado:** OBLIGATORIA, PERMANENTE E INEXPUGNABLE en todas las sesiones y prompts.  
> **Ámbito:** Toda modificación, arreglo, corrección, nueva funcionalidad o refactorización.

---

## 1. MANDATO INEXPUGNABLE ANTI-"ARREGLO A CUOTA"

1. **Verificación Simultánea Obligatoria:**  
   Cada vez que se haga cualquier cambio, arreglo, corrección o nueva funcionalidad, es OBLIGATORIO auditar y verificar que todo corra, compute y se vea perfecto tanto en la versión Web (Desktop ≥ 1024px) como en la versión Móvil (teléfonos inteligentes iOS / Android en viewports estrechos de 360px a 430px).
2. **Cobertura Total y Exhaustiva:**  
   La verificación móvil y web debe cubrir:
   - **TODAS las ventanas y modales** (Liquidación, Documentos, Clientes ERP, Admin Hub, Asistente RRHH, Verificación QR).
   - **TODOS los menús y barras de navegación** (Header principal, pestañas de navegación, selectores de empresa, pestañas de módulos).
   - **TODOS los módulos** (Nómina mensual, contratos, recibos, presentismo, IPS, MTESS, auditoría, bonificación familiar).
   - **TODAS las consultas, formularios y paneles de resultado**.
3. **Erradicación del "Arreglar a Cuota":**  
   Queda terminantemente PROHIBIDO dar por terminada una tarea o lanzar un despliegue si la versión móvil queda desordenada, desencuadrada, con elementos encimados, textos recortados o scroll horizontal indeseado. No se permite que el usuario tenga que probar en producción para reportar desencuadres y "arreglar a cuota" lo que debió ser blindado de entrada.

---

## 2. CHECKLIST OBLIGATORIO DE DISEÑO RESPONSIVO (VIEWPORTS 360px – 430px)

- **Viewport y Cero Desbordes Horizontales:**
  - `html, body` protegidos contra desbordes (`overflow-x: hidden; overflow-x: clip; max-width: 100%`).
  - Ningún contenedor o elemento debe forzar anchos fijos superiores al ancho de la pantalla (`min-width: 0; max-width: 100%; box-sizing: border-box`).
- **Navegación Móvil y Menús Horizontales:**
  - Toda barra con pestañas múltiples (ej. las 11 pestañas del ERP o pestañas de modales) debe incorporar desplazamiento horizontal táctil suave (`overflow-x: auto !important; flex-wrap: nowrap !important; -webkit-overflow-scrolling: touch; scrollbar-width: none;`).
  - Los botones de pestañas deben mantener `flex: 0 0 auto` y altura táctil mínima de 44px para permitir arrastrar y pulsar con el pulgar.
- **Formularios e Inputs Móvil-First:**
  - `font-size: 16px` mínimo en inputs, selects y textareas para erradicar el auto-zoom molesto de Safari en iOS.
  - Altura mínima táctil de 44px a 48px en botones, selectores y chips para pulsación ergonómica.
  - Chips y botones con etiquetas extensas deben contar con `white-space: normal`, `overflow-wrap: anywhere` y ajuste centrado para no desbordar en 360px.
- **Grillas y Tablas de Datos:**
  - Grillas de múltiples columnas (ej. métricas 3 columnas o campos de verificación) deben colapsar automáticamente a 1 columna en pantallas móviles (`@media (max-width: 640px) { grid-template-columns: minmax(0, 1fr) !important; }`).
  - Todas las tablas de salarios, nóminas, aportes IPS y asistencias deben estar dentro de contenedores con scroll horizontal táctil o convertirse en tarjetas verticales.
- **Modales y Diálogos:**
  - En móviles, modales deben usar `max-height: 94dvh` / `94vh` con `overflow-y: auto; overscroll-behavior: contain;` y padding reducido (10px a 14px) para que ningún botón de acción (Guardar, Cerrar, Descargar, Salir) quede inaccesible fuera de pantalla.
- **Persistencia de Formularios:**
  - No desmontar componentes que contengan formularios o cálculos para que el usuario no pierda su progreso al alternar pestañas o secciones.

---

## 3. PROTOCOLO TÉCNICO PREVIO A DEPLOY

Antes de ejecutar cualquier despliegue a producción (`npx vercel --prod --yes`):
1. `npx vitest run` → 100% de tests pasando sin regresiones.
2. `npm run build` → Compilación limpia de TypeScript y Vite (código 0).
3. **Auditoría visual multiplataforma:** Confirmar que no existen desbordes ni elementos desencuadrados tanto en desktop como en resoluciones móviles de 360px, 390px y 430px.
