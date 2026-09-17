# Graph Report - calculadora-rrhh-py  (2026-09-05)

## Corpus Check
- 56 files · ~48,125 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 346 nodes · 692 edges · 24 communities (18 shown, 5 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- services/leadService.ts
- liquidacion.ts
- indemnizacion.ts
- dependencies
- devDependencies
- compilerOptions
- compilerOptions
- FinalSettlementModal.tsx
- constants.ts
- plugins
- numberToWordsPY.ts
- Regla Obligatoria: Verificación Multiplataforma Simultánea (Móvil y Web)
- React + TypeScript + Vite
- tsconfig.json
- arquitecto/agent.md
- codificador/agent.md
- revisor/agent.md
- vercel.json
- Concepto
- 2. Arquitectura de Defensa en Profundidad (5 Capas)
- salaryBase.ts
- preaviso.ts
- documentDocxGenerator.ts

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 18 edges
2. `getStoredLeads()` - 16 edges
3. `calcularLiquidacion()` - 16 edges
4. `CommercialLeadsModal()` - 15 edges
5. `compilerOptions` - 15 edges
6. `Concepto` - 14 edges
7. `recordLead()` - 12 edges
8. `Alerta` - 12 edges
9. `react` - 10 edges
10. `createWhatsAppUrl()` - 10 edges

## Surprising Connections (you probably didn't know these)
- `AguinaldoResult` --references--> `Concepto`  [EXTRACTED]
  src/modules/payroll/engine/aguinaldo.ts → src/modules/payroll/types.ts
- `recordLead()` --calls--> `trackLeadCapturado()`  [EXTRACTED]
  src/modules/lead/services/leadService.ts → src/modules/analytics/metaPixel.ts
- `LeadCaptureModal()` --calls--> `recordLead()`  [EXTRACTED]
  src/modules/lead/LeadCaptureModal.tsx → src/modules/lead/services/leadService.ts
- `FinalSettlementModal()` --calls--> `formatearAntiguedad()`  [EXTRACTED]
  src/modules/payroll/components/FinalSettlementModal.tsx → src/modules/payroll/engine/dates.ts
- `FinalSettlementModal()` --calls--> `descargarLiquidacionDocx()`  [EXTRACTED]
  src/modules/payroll/components/FinalSettlementModal.tsx → src/modules/payroll/generators/documentDocxGenerator.ts

## Import Cycles
- None detected.

## Communities (24 total, 5 thin omitted)

### Community 0 - "services/leadService.ts"
Cohesion: 0.08
Nodes (55): RFC-4180, RFC-8018, decryptData(), deriveKey(), encryptData(), generateSecureToken(), getCrypto(), sanitizeExcelFormula() (+47 more)

### Community 1 - "liquidacion.ts"
Cohesion: 0.19
Nodes (16): calcularDescuentoIPS(), calcularJornalDiario(), generarLiquidacionPDF(), calcularLiquidacion(), FUENTES_MOTOR, AccionAlerta, FuenteLegal, LiquidacionInput (+8 more)

### Community 2 - "indemnizacion.ts"
Cohesion: 0.26
Nodes (9): DIAS_INDEMNIZACION_POR_ANIO, calcularAniosIndemnizables(), calcularAntiguedad(), fraccionCuentaComoAnio(), calcularIndemnizacion(), MOTIVOS_CON_INDEMNIZACION, MOTIVOS_SIN_INDEMNIZACION, Antiguedad (+1 more)

### Community 3 - "dependencies"
Cohesion: 0.07
Nodes (26): date-fns, docx, file-saver, jspdf, jspdf-autotable, dependencies, date-fns, docx (+18 more)

### Community 4 - "devDependencies"
Cohesion: 0.07
Nodes (27): jsdom, oxlint, devDependencies, jsdom, oxlint, @testing-library/jest-dom, @testing-library/react, @types/file-saver (+19 more)

### Community 5 - "compilerOptions"
Cohesion: 0.08
Nodes (23): DOM, src, vite/client, compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx (+15 more)

### Community 6 - "compilerOptions"
Cohesion: 0.10
Nodes (19): node, vite.config.ts, compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection (+11 more)

### Community 7 - "FinalSettlementModal.tsx"
Cohesion: 0.13
Nodes (32): react, createWhatsAppUrl(), LABORAPY_CONFIG, WhatsAppMessages, getMetaPixelId(), initMetaPixel(), META_PIXEL_STORAGE_KEY, setMetaPixelId() (+24 more)

### Community 8 - "constants.ts"
Cohesion: 0.18
Nodes (13): ASIGNACION_FAMILIAR_EDAD_MAXIMA_HIJO, ASIGNACION_FAMILIAR_LIMITE_SALARIO, ASIGNACION_FAMILIAR_PORCENTAJE, CATEGORIAS_SALARIALES_MTESS, CategoriaSalarialMTESS, FUENTES_LEGALES, MESES_FRACCION_INDEMNIZACION, PERIODO_PRUEBA_DIAS (+5 more)

### Community 9 - "plugins"
Cohesion: 0.22
Nodes (8): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema, oxc, typescript, warn

### Community 10 - "numberToWordsPY.ts"
Cohesion: 0.36
Nodes (8): CENTENAS, convertirCentenas(), convertirDecenas(), convertirMiles(), DECENAS, numeroALetrasGuaranies(), soloLetras(), UNIDADES

### Community 11 - "Regla Obligatoria: Verificación Multiplataforma Simultánea (Móvil y Web)"
Cohesion: 0.50
Nodes (3): 1. Verificación Técnica de Una Sola Vez, 2. Criterios de Diseño Responsivo (Mobile & Desktop), Regla Obligatoria: Verificación Multiplataforma Simultánea (Móvil y Web)

### Community 12 - "React + TypeScript + Vite"
Cohesion: 0.50
Nodes (3): Expanding the Oxlint configuration, React Compiler, React + TypeScript + Vite

### Community 19 - "Concepto"
Cohesion: 0.22
Nodes (13): ESCALA_VACACIONES, IMPONIBILIDAD_IPS, IPS_TASAS, BonificacionFamiliarResult, IndemnizacionResult, IPSResult, PreavisoResult, calcularVacaciones() (+5 more)

### Community 20 - "2. Arquitectura de Defensa en Profundidad (5 Capas)"
Cohesion: 0.18
Nodes (10): 1. Declaración Institucional de Privacidad y Confidencialidad, 2. Arquitectura de Defensa en Profundidad (5 Capas), 3. Resumen de Certificación Técnica, Capa 1: Seguridad Criptográfica en Tránsito (TLS 1.3 y HSTS), Capa 2: Blindaje de Base de Datos y Row Level Security (Supabase Cloud), Capa 3: Cifrado en Reposo (AES-256-GCM y PBKDF2), Capa 4: Sanitización Activa y Mitigación OWASP, Capa 5: Confidencialidad y Cumplimiento Normativo (Paraguay) (+2 more)

### Community 21 - "salaryBase.ts"
Cohesion: 0.27
Nodes (7): DIVISOR_JORNAL_DIARIO, AguinaldoResult, calcularAguinaldo(), BaseAguinaldoResult, BaseIndemnizacionResult, calcularBaseAguinaldo(), calcularBaseIndemnizacion()

### Community 22 - "preaviso.ts"
Cohesion: 0.53
Nodes (4): ESCALA_PREAVISO, calcularPreaviso(), getDiasPreaviso(), PreavisoInput

### Community 23 - "documentDocxGenerator.ts"
Cohesion: 0.70
Nodes (4): formatearAntiguedad(), crearCalloutBoxDocx(), descargarLiquidacionDocx(), generarLiquidacionDocx()

## Knowledge Gaps
- **129 isolated node(s):** `$schema`, `typescript`, `oxc`, `react/rules-of-hooks`, `warn` (+124 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 141 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `FinalSettlementModal.tsx` to `services/leadService.ts`, `plugins`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **Why does `plugins` connect `plugins` to `FinalSettlementModal.tsx`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Why does `calcularLiquidacion()` connect `liquidacion.ts` to `indemnizacion.ts`, `FinalSettlementModal.tsx`, `constants.ts`, `numberToWordsPY.ts`, `Concepto`, `salaryBase.ts`, `preaviso.ts`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **What connects `$schema`, `typescript`, `oxc` to the rest of the system?**
  _129 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `services/leadService.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07785547785547786 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.07407407407407407 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.07407407407407407 - nodes in this community are weakly interconnected._