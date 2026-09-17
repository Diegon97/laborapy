# Graph Report - calculadora-rrhh-py  (2026-09-05)

## Corpus Check
- 53 files · ~46,216 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 323 nodes · 653 edges · 19 communities (13 shown, 5 thin omitted)
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
- App.tsx
- metaPixel.ts
- plugins
- numberToWordsPY.ts
- Regla Obligatoria: Verificación Multiplataforma Simultánea (Móvil y Web)
- React + TypeScript + Vite
- tsconfig.json
- arquitecto/agent.md
- codificador/agent.md
- revisor/agent.md
- vercel.json

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 18 edges
2. `getStoredLeads()` - 16 edges
3. `calcularLiquidacion()` - 16 edges
4. `CommercialLeadsModal()` - 15 edges
5. `compilerOptions` - 15 edges
6. `Concepto` - 14 edges
7. `Alerta` - 12 edges
8. `recordLead()` - 11 edges
9. `react` - 10 edges
10. `createWhatsAppUrl()` - 10 edges

## Surprising Connections (you probably didn't know these)
- `FinalSettlementModal()` --calls--> `createWhatsAppUrl()`  [EXTRACTED]
  src/modules/payroll/components/FinalSettlementModal.tsx → src/config/laborapy.ts
- `FinalSettlementModal()` --calls--> `trackCalculoLiquidacion()`  [EXTRACTED]
  src/modules/payroll/components/FinalSettlementModal.tsx → src/modules/analytics/metaPixel.ts
- `FinalSettlementModal()` --calls--> `trackDescargaPDF()`  [EXTRACTED]
  src/modules/payroll/components/FinalSettlementModal.tsx → src/modules/analytics/metaPixel.ts
- `HRDocumentModal()` --calls--> `trackEmisionNota()`  [EXTRACTED]
  src/modules/payroll/components/HRDocumentModal.tsx → src/modules/analytics/metaPixel.ts
- `recordLead()` --calls--> `trackLeadCapturado()`  [EXTRACTED]
  src/modules/lead/services/leadService.ts → src/modules/analytics/metaPixel.ts

## Import Cycles
- None detected.

## Communities (19 total, 5 thin omitted)

### Community 0 - "services/leadService.ts"
Cohesion: 0.09
Nodes (49): RFC-4180, getSupabaseClient(), isSupabaseConfigured(), saveLeadsBatchToSupabase(), saveLeadToSupabase(), supabase, SupabaseLeadPayload, CommercialLeadsModal() (+41 more)

### Community 1 - "liquidacion.ts"
Cohesion: 0.10
Nodes (39): trackDescargaDocx(), FinalSettlementModal(), Props, ASIGNACION_FAMILIAR_EDAD_MAXIMA_HIJO, ASIGNACION_FAMILIAR_LIMITE_SALARIO, ASIGNACION_FAMILIAR_PORCENTAJE, CATEGORIAS_SALARIALES_MTESS, CategoriaSalarialMTESS (+31 more)

### Community 2 - "indemnizacion.ts"
Cohesion: 0.10
Nodes (30): DIAS_INDEMNIZACION_POR_ANIO, DIVISOR_JORNAL_DIARIO, ESCALA_PREAVISO, ESCALA_VACACIONES, AguinaldoResult, calcularAguinaldo(), BonificacionFamiliarResult, calcularAniosIndemnizables() (+22 more)

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

### Community 7 - "App.tsx"
Cohesion: 0.27
Nodes (12): react, createWhatsAppUrl(), LABORAPY_CONFIG, WhatsAppMessages, FloatingWhatsAppButton(), Props, LaboraPyServicesSection(), Props (+4 more)

### Community 8 - "metaPixel.ts"
Cohesion: 0.27
Nodes (14): getMetaPixelId(), initMetaPixel(), META_PIXEL_STORAGE_KEY, setMetaPixelId(), trackCalculoLiquidacion(), trackDescargaPDF(), trackEmisionNota(), trackLeadCapturado() (+6 more)

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

## Knowledge Gaps
- **119 isolated node(s):** `$schema`, `typescript`, `oxc`, `react/rules-of-hooks`, `warn` (+114 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 131 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `App.tsx` to `metaPixel.ts`, `plugins`, `services/leadService.ts`, `liquidacion.ts`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **Why does `plugins` connect `plugins` to `App.tsx`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Why does `calcularLiquidacion()` connect `liquidacion.ts` to `indemnizacion.ts`, `numberToWordsPY.ts`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **What connects `$schema`, `typescript`, `oxc` to the rest of the system?**
  _119 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `services/leadService.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08708357685563997 - nodes in this community are weakly interconnected._
- **Should `liquidacion.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09803921568627451 - nodes in this community are weakly interconnected._
- **Should `indemnizacion.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09872241579558652 - nodes in this community are weakly interconnected._