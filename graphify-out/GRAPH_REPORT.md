# Graph Report - calculadora-rrhh-py  (2026-09-14)

## Corpus Check
- 152 files · ~237,467 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1221 nodes · 3411 edges · 62 communities (50 shown, 11 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 24 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- services/leadService.ts
- payroll/types.ts
- indemnizacion.ts
- dependencies
- devDependencies
- compilerOptions
- compilerOptions
- react
- liquidacion.ts
- plugins
- attendanceService.ts
- REGLA INEXPUGNABLE: PARIDAD VISUAL Y FUNCIONAL TOTAL MULTIPLATAFORMA (MÓVIL Y WEB)
- React + TypeScript + Vite
- tsconfig.json
- arquitecto/agent.md
- codificador/agent.md
- revisor/agent.md
- vercel.json
- safeFormulaEvaluator.ts
- 2. Arquitectura de Seguridad Actual (Fase Producción Web / MVP)
- clientAuthService.ts
- preaviso.ts
- monthlyPayrollEngine.ts
- adminAuthService.ts
- vacationNoticePdfGenerator.ts
- PayrollClosingDashboard.tsx
- mtessExportService.ts
- clientPortal.ts
- payrollNoveltiesStorage.ts
- payrollAccountingEngine.test.ts
- clientStorageService.ts
- ClientERPModal.tsx
- ExcelPayrollGrid.tsx
- payrollClosingCompliance.ts
- Empleado
- hrAuditor.ts
- clientPortal.test.ts
- assistant/types.ts
- HRAssistantModal.tsx
- CompactDatePicker.tsx
- EmpresaCliente
- PayrollNoveltiesModal.tsx
- assistant.ts
- hrKnowledgeBase.ts
- employmentContractPdfGenerator.ts
- assistantService.ts
- telegramPdfGenerator.ts
- scripts
- check-no-sensitive-data.mjs
- package.json
- assistant/index.ts
- jspdf
- @testing-library/jest-dom
- @testing-library/react
- @types/file-saver
- @types/react
- metaPixel.ts
- LandingHeroPainSection.tsx
- HRDocumentModal.tsx
- numberToWordsPY.ts
- keep-alive.ts

## God Nodes (most connected - your core abstractions)
1. `EmpresaCliente` - 60 edges
2. `react` - 45 edges
3. `getSafeStorage()` - 43 edges
4. `Empleado` - 40 edges
5. `getEmpleadosByCliente()` - 32 edges
6. `initializeLocalStorage()` - 28 edges
7. `AttendanceAndPayrollTab()` - 25 edges
8. `formatPYG()` - 23 edges
9. `EmpleadoNominaInput` - 23 edges
10. `formatGuaranies()` - 22 edges

## Surprising Connections (you probably didn't know these)
- `Props` --references--> `EmpresaCliente`  [EXTRACTED]
  src/modules/clientPortal/components/AttendanceAndPayrollTab.tsx → src/modules/clientPortal/types/clientPortal.ts
- `Props` --references--> `EmpresaCliente`  [EXTRACTED]
  src/modules/clientPortal/components/ClientDashboardTab.tsx → src/modules/clientPortal/types/clientPortal.ts
- `CumpleanheroMes` --references--> `Empleado`  [EXTRACTED]
  src/modules/clientPortal/services/attendanceService.ts → src/modules/clientPortal/types/clientPortal.ts
- `deleteAjusteHorasExtrasEmpleado()` --calls--> `getSafeStorage()`  [EXTRACTED]
  src/modules/clientPortal/services/attendanceService.ts → src/modules/clientPortal/services/clientStorageService.ts
- `AguinaldoResult` --references--> `Concepto`  [EXTRACTED]
  src/modules/payroll/engine/aguinaldo.ts → src/modules/payroll/types.ts

## Import Cycles
- None detected.

## Communities (62 total, 11 thin omitted)

### Community 0 - "services/leadService.ts"
Cohesion: 0.09
Nodes (47): getSupabaseClient(), isSupabaseConfigured(), saveLeadsBatchToSupabase(), saveLeadToSupabase(), supabase, SupabaseLeadPayload, CommercialLeadsModal(), Props (+39 more)

### Community 1 - "payroll/types.ts"
Cohesion: 0.19
Nodes (14): Props, QuickSettlementModalContentProps, AccionAlerta, FuenteLegal, LiquidacionInput, MotivoEgreso, TipoAlerta, ValidacionTelegramasAbandono (+6 more)

### Community 2 - "indemnizacion.ts"
Cohesion: 0.20
Nodes (12): DIAS_INDEMNIZACION_POR_ANIO, ESCALA_VACACIONES, calcularAniosIndemnizables(), calcularAntiguedad(), fraccionCuentaComoAnio(), calcularIndemnizacion(), MOTIVOS_CON_INDEMNIZACION, MOTIVOS_SIN_INDEMNIZACION (+4 more)

### Community 3 - "dependencies"
Cohesion: 0.10
Nodes (21): date-fns, docx, file-saver, jspdf-autotable, dependencies, date-fns, docx, file-saver (+13 more)

### Community 4 - "devDependencies"
Cohesion: 0.11
Nodes (19): jsdom, oxlint, devDependencies, jsdom, oxlint, @types/node, @types/react-dom, typescript (+11 more)

### Community 5 - "compilerOptions"
Cohesion: 0.08
Nodes (23): DOM, src, vite/client, compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx (+15 more)

### Community 6 - "compilerOptions"
Cohesion: 0.10
Nodes (19): node, vite.config.ts, compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection (+11 more)

### Community 7 - "react"
Cohesion: 0.21
Nodes (16): react, createWhatsAppUrl(), LABORAPY_CONFIG, WhatsAppMessages, FloatingWhatsAppButton(), Props, Props, LeadCapturedData (+8 more)

### Community 8 - "liquidacion.ts"
Cohesion: 0.11
Nodes (26): ASIGNACION_FAMILIAR_EDAD_MAXIMA_HIJO, ASIGNACION_FAMILIAR_LIMITE_SALARIO, ASIGNACION_FAMILIAR_PORCENTAJE, CATEGORIAS_SALARIALES_MTESS, CategoriaSalarialMTESS, DIVISOR_JORNAL_DIARIO, FUENTES_LEGALES, IMPONIBILIDAD_IPS (+18 more)

### Community 9 - "plugins"
Cohesion: 0.22
Nodes (8): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema, oxc, typescript, warn

### Community 10 - "attendanceService.ts"
Cohesion: 0.06
Nodes (68): Props, DIAS_INICIALES, WeeklyOvertimeCalculatorModal(), WeeklyOvertimeCalculatorModalProps, AjusteHorasExtrasEmpleado, ATTENDANCE_STORAGE_KEYS, buscarEmpleadoPorIdentificador(), calcularJornadaDiaria() (+60 more)

### Community 11 - "REGLA INEXPUGNABLE: PARIDAD VISUAL Y FUNCIONAL TOTAL MULTIPLATAFORMA (MÓVIL Y WEB)"
Cohesion: 0.40
Nodes (4): 1. MANDATO INEXPUGNABLE ANTI-"ARREGLO A CUOTA", 2. CHECKLIST OBLIGATORIO DE DISEÑO RESPONSIVO (VIEWPORTS 360px – 430px), 3. PROTOCOLO TÉCNICO PREVIO A DEPLOY, REGLA INEXPUGNABLE: PARIDAD VISUAL Y FUNCIONAL TOTAL MULTIPLATAFORMA (MÓVIL Y WEB)

### Community 12 - "React + TypeScript + Vite"
Cohesion: 0.40
Nodes (4): Expanding the Oxlint configuration, POLITICA DE PROTECCION DE DATOS (OBLIGATORIA), React Compiler, React + TypeScript + Vite

### Community 17 - "vercel.json"
Cohesion: 0.33
Nodes (5): buildCommand, crons, headers, outputDirectory, rewrites

### Community 19 - "safeFormulaEvaluator.ts"
Cohesion: 0.09
Nodes (28): ASTNode, BinaryNode, BooleanNode, CallNode, EvalContext, evalNode(), evaluateCellMath(), evaluateFormula() (+20 more)

### Community 20 - "2. Arquitectura de Seguridad Actual (Fase Producción Web / MVP)"
Cohesion: 0.12
Nodes (16): 1.1 Compromiso Institucional, 1.2 Marco Normativo Paraguayo, 1.3 Ejercicio de Derechos ARCO, 1. Declaración Institucional y Marco Legal (República del Paraguay), 2.1 Cero Fuga de Datos de Nómina (Client-Side Privacy Engine), 2.2 Seguridad Criptográfica de Transporte, 2.3 Cabeceras HTTP Defensivas en Vercel (`vercel.json`), 2.4 Captura de Leads en Supabase Cloud con RLS Blindado (Append-Only) (+8 more)

### Community 21 - "clientAuthService.ts"
Cohesion: 0.11
Nodes (41): ClientERPModal(), ClientLoginModal(), Props, DEMO_USUARIOS, checkLockout(), CLIENT_LOCKOUT_STORAGE_KEY, CLIENT_RECOVERY_STORAGE_KEY, CLIENT_REMEMBERED_EMAIL_KEY (+33 more)

### Community 22 - "preaviso.ts"
Cohesion: 0.22
Nodes (13): ESCALA_PREAVISO, ESCALA_PREAVISO_DOMESTICO, BonificacionFamiliarResult, IndemnizacionResult, IPSResult, calcularPreaviso(), getDiasPreaviso(), PreavisoResult (+5 more)

### Community 23 - "monthlyPayrollEngine.ts"
Cohesion: 0.11
Nodes (35): getEmpresaById(), saveEmpleado(), Props, BatchPayrollTable(), MonthlyPayrollModule(), AVATAR_BG_COLORS, PayrollCardsView(), PayrollCardsViewProps (+27 more)

### Community 24 - "adminAuthService.ts"
Cohesion: 0.08
Nodes (67): RFC-4226, RFC-4648, RFC-8018, decryptData(), deriveKey(), encryptData(), generateSecureToken(), getCrypto() (+59 more)

### Community 25 - "vacationNoticePdfGenerator.ts"
Cohesion: 0.14
Nodes (21): APORTE_IPS_OBRERO, calcularLiquidacionVacaciones(), DIAS_MES_COMERCIAL, DIAS_VACACIONES_DEFAULT, formatearFechaTexto(), formatFechaDDMMYYYY(), formatGs(), formatGuaranies() (+13 more)

### Community 26 - "PayrollClosingDashboard.tsx"
Cohesion: 0.13
Nodes (19): sanitizeExcelFormula(), bgNivel, bordeNivel, btnStyle, calcularBanner(), cardStyle, iconoNivel, kpiBase (+11 more)

### Community 27 - "mtessExportService.ts"
Cohesion: 0.14
Nodes (32): AsignacionRecord, buildMonthlyRow(), buildSettlementRow(), buildSheetName(), calcularAporteSegSocial(), calcularBaseImponibleLiquidacion(), calcularBaseImponibleMensual(), CellValue (+24 more)

### Community 28 - "clientPortal.ts"
Cohesion: 0.14
Nodes (17): Props, GenerarConstanciaMaternidadParams, generarConstanciaMaternidadPDF(), AlertaAntiguedad, AlertaMaternidadLactancia, CertificadoLactanciaTrimestral, DashboardMetrics, DepartamentoParaguay (+9 more)

### Community 29 - "payrollNoveltiesStorage.ts"
Cohesion: 0.18
Nodes (28): PayrollClosingDashboard(), PayrollNoveltiesModal(), aplicarNovedadesAEmpleado(), aplicarNovedadesANominaCompleta(), calcularTopeLegalEmbargos(), formatPeriodoFormal(), MESES_ES, parsePeriodoId() (+20 more)

### Community 30 - "payrollAccountingEngine.test.ts"
Cohesion: 0.09
Nodes (41): AccountingEntryCard(), PlanDeCuentasModalProps, formatMontoMoneda(), DEFAULT_CHART_OF_ACCOUNTS, ENTERPRISE_CHART_OF_ACCOUNTS, generarAsientoContableNomina(), descargarArchivoContable(), exportarAsientoJSON() (+33 more)

### Community 31 - "clientStorageService.ts"
Cohesion: 0.11
Nodes (27): ClientDashboardTab(), Props, DEMO_ADENDAS, DEMO_CONTRATOS, DEMO_DOCUMENTOS, DEMO_EMPLEADOS, DEMO_EMPRESAS, DEMO_MATERNIDAD (+19 more)

### Community 32 - "ClientERPModal.tsx"
Cohesion: 0.17
Nodes (30): AttendanceAndPayrollTab(), Props, IpsComplianceTab(), MtessComplianceTab(), sanitizePatronal(), sanitizeSucursal(), SalaryReceiptsTab(), descargarArchivoTexto() (+22 more)

### Community 33 - "ExcelPayrollGrid.tsx"
Cohesion: 0.09
Nodes (34): COLOR_PALETTE, ColumnConfigModal(), ColumnConfigModalProps, ColumnVisibilityDrawer(), ColumnVisibilityDrawerProps, ANIOS, btnRecibo, btnSecondary (+26 more)

### Community 34 - "payrollClosingCompliance.ts"
Cohesion: 0.14
Nodes (21): PayrollPeriodManagerBar(), PayrollPeriodManagerBarProps, roundGs(), exportarBancoItau_TXT(), exportarBancoSIPAP_CSV(), exportarBancoSudameris_TXT(), FormatoBanco, sanitizeBankCell() (+13 more)

### Community 35 - "Empleado"
Cohesion: 0.12
Nodes (31): EmployeeDirectoryTab(), EmployeeTransferModal(), inputStyle, labelStyle, QuickSettlementModal(), descargarNotaTrasladoPDF(), formatFechaLarga(), formatPYGLocal() (+23 more)

### Community 36 - "hrAuditor.ts"
Cohesion: 0.17
Nodes (18): auditSettlement(), calculateSeniorityYears(), formatGs(), parseLocalDate(), parseNumericInput(), PENALIZACION, requiredPreavisoDays(), resolveSalarioMinimo() (+10 more)

### Community 37 - "clientPortal.test.ts"
Cohesion: 0.13
Nodes (37): BADGES_MOTIVOS, EmploymentContractsTab(), MaternityLactationModal(), generateComprobanteCode(), generateVacId(), VacationsManagementTab(), formatFechaLargaPY(), generarAdendaContratoPDF() (+29 more)

### Community 38 - "assistant/types.ts"
Cohesion: 0.11
Nodes (18): HRAssistantModalProps, AssistantCitation, AssistantQueryContext, AssistantRole, AuditCategory, AuditSummary, DeadlineKind, DeadlineStatus (+10 more)

### Community 39 - "HRAssistantModal.tsx"
Cohesion: 0.22
Nodes (16): askDeepSeekAssistant(), generateOfflineAnswer(), HRAssistantModal(), TabType, addBusinessDays(), calculateRetentionLimits(), formatISODateLocal(), getDaysRemaining() (+8 more)

### Community 40 - "CompactDatePicker.tsx"
Cohesion: 0.23
Nodes (16): CompactDatePicker(), CompactDatePickerProps, daysInMonth(), formatDisplayFromIso(), getDecadeBlock(), getMondayBasedWeekday(), isValidYmd(), maskDateInput() (+8 more)

### Community 41 - "EmpresaCliente"
Cohesion: 0.09
Nodes (23): calcularDV(), ChecklistItem, CompanyProfileTab(), CompanyProfileTabProps, formatearPatronalIps(), inputStyle, labelStyle, sectionCardStyle (+15 more)

### Community 42 - "PayrollNoveltiesModal.tsx"
Cohesion: 0.27
Nodes (11): PayrollNoveltiesModalProps, TabFiltro, EmpleadoNominaInput, CodigoLiquidacionImpacto, EstadoPeriodo, ModalidadCalculoNovedad, NovedadPersonal, ResultadoAplicacionNovedades (+3 more)

### Community 43 - "assistant.ts"
Cohesion: 0.24
Nodes (10): callCloudflare(), callDeepSeek(), callGemini(), callGroq(), callOpenRouter(), config, DEFAULT_SYSTEM_PROMPT, handler() (+2 more)

### Community 44 - "hrKnowledgeBase.ts"
Cohesion: 0.21
Nodes (9): KNOWLEDGE_ENTRIES, normalizeSearchText(), searchKnowledgeBase(), STOPWORDS, tokenize(), TOPIC_LABELS, KnowledgeEntry, KnowledgeSearchResult (+1 more)

### Community 45 - "employmentContractPdfGenerator.ts"
Cohesion: 0.83
Nodes (3): formatearFechaEspanol(), generarContratoTrabajoPDF(), numeroALetrasPY()

### Community 46 - "assistantService.ts"
Cohesion: 0.22
Nodes (5): askHRAssistant, AssistantMessage, AuditReport, HRAuditRecord, HRChatMessage

### Community 47 - "telegramPdfGenerator.ts"
Cohesion: 0.28
Nodes (8): QuickSettlementModalContent(), AbsenceLawValidation, downloadTelegramPDF(), formatAbsenceDatesToSpanish(), formatCiNumber(), generateTelegramPDF(), TelegramConfig, validateAbsencesLaborLaw()

### Community 48 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, lint, preview, test

### Community 49 - "check-no-sensitive-data.mjs"
Cohesion: 0.33
Nodes (4): EXTENSIONES_IGNORADAS, hallazgos, RAICES, TERMINOS_PROHIBIDOS

### Community 50 - "package.json"
Cohesion: 0.40
Nodes (4): name, private, type, version

### Community 57 - "metaPixel.ts"
Cohesion: 0.25
Nodes (15): getMetaPixelId(), initMetaPixel(), META_PIXEL_STORAGE_KEY, setMetaPixelId(), trackCalculoLiquidacion(), trackDescargaDocx(), trackDescargaPDF(), trackEmisionNota() (+7 more)

### Community 58 - "LandingHeroPainSection.tsx"
Cohesion: 0.18
Nodes (11): AppRoute, CHECKLIST_QUESTIONS, ChecklistAnswer, ChecklistQuestion, createEmptyAnswers(), EMPLEADOS_PRESETS, LandingHeroPainSection(), LandingHeroPainSectionProps (+3 more)

### Community 59 - "HRDocumentModal.tsx"
Cohesion: 0.39
Nodes (7): HRDocumentModal(), Props, downloadMtessWorkbooks(), exportMtessMonthly(), exportMtessSettlements(), generarNotaLaboralPDF(), NotaLaboralOptions

### Community 60 - "numberToWordsPY.ts"
Cohesion: 0.36
Nodes (8): CENTENAS, convertirCentenas(), convertirDecenas(), convertirMiles(), DECENAS, numeroALetrasGuaranies(), soloLetras(), UNIDADES

## Knowledge Gaps
- **348 isolated node(s):** `$schema`, `typescript`, `oxc`, `react/rules-of-hooks`, `warn` (+343 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 378 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `react` to `services/leadService.ts`, `payroll/types.ts`, `plugins`, `attendanceService.ts`, `clientAuthService.ts`, `monthlyPayrollEngine.ts`, `adminAuthService.ts`, `PayrollClosingDashboard.tsx`, `clientPortal.ts`, `payrollAccountingEngine.test.ts`, `clientStorageService.ts`, `ClientERPModal.tsx`, `ExcelPayrollGrid.tsx`, `payrollClosingCompliance.ts`, `Empleado`, `clientPortal.test.ts`, `HRAssistantModal.tsx`, `CompactDatePicker.tsx`, `EmpresaCliente`, `PayrollNoveltiesModal.tsx`, `assistant/index.ts`, `metaPixel.ts`, `LandingHeroPainSection.tsx`, `HRDocumentModal.tsx`?**
  _High betweenness centrality (0.205) - this node is a cross-community bridge._
- **Why does `EmpresaCliente` connect `EmpresaCliente` to `ClientERPModal.tsx`, `payroll/types.ts`, `ExcelPayrollGrid.tsx`, `Empleado`, `payrollClosingCompliance.ts`, `clientPortal.test.ts`, `react`, `attendanceService.ts`, `employmentContractPdfGenerator.ts`, `clientAuthService.ts`, `monthlyPayrollEngine.ts`, `vacationNoticePdfGenerator.ts`, `PayrollClosingDashboard.tsx`, `clientPortal.ts`, `clientStorageService.ts`?**
  _High betweenness centrality (0.066) - this node is a cross-community bridge._
- **What connects `$schema`, `typescript`, `oxc` to the rest of the system?**
  _348 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `services/leadService.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08834586466165413 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.08333333333333333 - nodes in this community are weakly interconnected._