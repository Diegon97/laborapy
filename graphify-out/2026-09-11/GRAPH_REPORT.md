# Graph Report - calculadora-rrhh-py  (2026-09-11)

## Corpus Check
- 144 files · ~219,603 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1127 nodes · 3169 edges · 57 communities (46 shown, 10 thin omitted)
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
- Concepto
- 2. Arquitectura de Seguridad Actual (Fase Producción Web / MVP)
- clientAuthService.ts
- preaviso.ts
- EmpresaCliente
- adminAuthService.ts
- validation.ts
- vacaciones.ts
- mtessExportService.ts
- clientPortal.ts
- PayrollClosingDashboard.tsx
- AccountingEntryCard.tsx
- clientStorageService.ts
- getEmpleadosByCliente
- ExcelPayrollGrid.tsx
- payrollClosingCompliance.ts
- EmployeeDirectoryTab.tsx
- hrAuditor.ts
- getSafeStorage
- assistant/types.ts
- HRAssistantModal.tsx
- CompactDatePicker.tsx
- clientPortal.test.ts
- payrollNoveltiesEngine.ts
- assistant.ts
- hrKnowledgeBase.ts
- formatPYG
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

## God Nodes (most connected - your core abstractions)
1. `EmpresaCliente` - 56 edges
2. `getSafeStorage()` - 43 edges
3. `react` - 41 edges
4. `Empleado` - 40 edges
5. `getEmpleadosByCliente()` - 32 edges
6. `initializeLocalStorage()` - 28 edges
7. `AttendanceAndPayrollTab()` - 25 edges
8. `formatPYG()` - 23 edges
9. `calcularLiquidacion()` - 20 edges
10. `LiquidacionInput` - 20 edges

## Surprising Connections (you probably didn't know these)
- `Props` --references--> `EmpresaCliente`  [EXTRACTED]
  src/modules/clientPortal/components/AttendanceAndPayrollTab.tsx → src/modules/clientPortal/types/clientPortal.ts
- `CompanyProfileTabProps` --references--> `EmpresaCliente`  [EXTRACTED]
  src/modules/clientPortal/components/CompanyProfileTab.tsx → src/modules/clientPortal/types/clientPortal.ts
- `Props` --references--> `EmpresaCliente`  [EXTRACTED]
  src/modules/clientPortal/components/MtessComplianceTab.tsx → src/modules/clientPortal/types/clientPortal.ts
- `Props` --references--> `EmpresaCliente`  [EXTRACTED]
  src/modules/clientPortal/components/SalaryReceiptsTab.tsx → src/modules/clientPortal/types/clientPortal.ts
- `Props` --references--> `EmpresaCliente`  [EXTRACTED]
  src/modules/clientPortal/components/VacationsManagementTab.tsx → src/modules/clientPortal/types/clientPortal.ts

## Import Cycles
- None detected.

## Communities (57 total, 10 thin omitted)

### Community 0 - "services/leadService.ts"
Cohesion: 0.09
Nodes (47): getSupabaseClient(), isSupabaseConfigured(), saveLeadsBatchToSupabase(), saveLeadToSupabase(), supabase, SupabaseLeadPayload, CommercialLeadsModal(), Props (+39 more)

### Community 1 - "payroll/types.ts"
Cohesion: 0.19
Nodes (14): Props, QuickSettlementModal(), QuickSettlementModalContentProps, formatearAntiguedad(), computeDocumentSealHex(), crearCalloutBoxDocx(), descargarLiquidacionDocx(), generarLiquidacionDocx() (+6 more)

### Community 2 - "indemnizacion.ts"
Cohesion: 0.29
Nodes (8): DIAS_INDEMNIZACION_POR_ANIO, calcularAniosIndemnizables(), calcularAntiguedad(), fraccionCuentaComoAnio(), calcularIndemnizacion(), MOTIVOS_CON_INDEMNIZACION, MOTIVOS_SIN_INDEMNIZACION, calcularBaseIndemnizacion()

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
Cohesion: 0.06
Nodes (68): react, createWhatsAppUrl(), LABORAPY_CONFIG, WhatsAppMessages, getMetaPixelId(), initMetaPixel(), META_PIXEL_STORAGE_KEY, setMetaPixelId() (+60 more)

### Community 8 - "liquidacion.ts"
Cohesion: 0.13
Nodes (22): ASIGNACION_FAMILIAR_EDAD_MAXIMA_HIJO, ASIGNACION_FAMILIAR_LIMITE_SALARIO, ASIGNACION_FAMILIAR_PORCENTAJE, CATEGORIAS_SALARIALES_MTESS, CategoriaSalarialMTESS, DIVISOR_JORNAL_DIARIO, FUENTES_LEGALES, MESES_FRACCION_INDEMNIZACION (+14 more)

### Community 9 - "plugins"
Cohesion: 0.22
Nodes (8): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema, oxc, typescript, warn

### Community 10 - "attendanceService.ts"
Cohesion: 0.07
Nodes (68): AttendanceAndPayrollTab(), Props, DIAS_INICIALES, WeeklyOvertimeCalculatorModal(), WeeklyOvertimeCalculatorModalProps, AjusteHorasExtrasEmpleado, ATTENDANCE_STORAGE_KEYS, buscarEmpleadoPorIdentificador() (+60 more)

### Community 11 - "REGLA INEXPUGNABLE: PARIDAD VISUAL Y FUNCIONAL TOTAL MULTIPLATAFORMA (MÓVIL Y WEB)"
Cohesion: 0.40
Nodes (4): 1. MANDATO INEXPUGNABLE ANTI-"ARREGLO A CUOTA", 2. CHECKLIST OBLIGATORIO DE DISEÑO RESPONSIVO (VIEWPORTS 360px – 430px), 3. PROTOCOLO TÉCNICO PREVIO A DEPLOY, REGLA INEXPUGNABLE: PARIDAD VISUAL Y FUNCIONAL TOTAL MULTIPLATAFORMA (MÓVIL Y WEB)

### Community 12 - "React + TypeScript + Vite"
Cohesion: 0.40
Nodes (4): Expanding the Oxlint configuration, POLITICA DE PROTECCION DE DATOS (OBLIGATORIA), React Compiler, React + TypeScript + Vite

### Community 17 - "vercel.json"
Cohesion: 0.40
Nodes (4): buildCommand, headers, outputDirectory, rewrites

### Community 19 - "Concepto"
Cohesion: 0.26
Nodes (11): IMPONIBILIDAD_IPS, IPS_TASAS, BonificacionFamiliarResult, IndemnizacionResult, calcularDescuentoIPS(), IPSResult, PreavisoResult, VacacionesResult (+3 more)

### Community 20 - "2. Arquitectura de Seguridad Actual (Fase Producción Web / MVP)"
Cohesion: 0.12
Nodes (16): 1.1 Compromiso Institucional, 1.2 Marco Normativo Paraguayo, 1.3 Ejercicio de Derechos ARCO, 1. Declaración Institucional y Marco Legal (República del Paraguay), 2.1 Cero Fuga de Datos de Nómina (Client-Side Privacy Engine), 2.2 Seguridad Criptográfica de Transporte, 2.3 Cabeceras HTTP Defensivas en Vercel (`vercel.json`), 2.4 Captura de Leads en Supabase Cloud con RLS Blindado (Append-Only) (+8 more)

### Community 21 - "clientAuthService.ts"
Cohesion: 0.08
Nodes (51): ClientERPModal(), Props, ClientLoginModal(), Props, calcularDV(), ChecklistItem, CompanyProfileTab(), CompanyProfileTabProps (+43 more)

### Community 22 - "preaviso.ts"
Cohesion: 0.36
Nodes (6): ESCALA_PREAVISO, ESCALA_PREAVISO_DOMESTICO, calcularPreaviso(), getDiasPreaviso(), PreavisoInput, RegimenLaboral

### Community 23 - "EmpresaCliente"
Cohesion: 0.09
Nodes (40): Props, Props, Props, EmpresaCliente, BatchPayrollTable(), BatchPayrollTableProps, ExcelPayrollGridProps, MonthlyPayrollModule() (+32 more)

### Community 24 - "adminAuthService.ts"
Cohesion: 0.08
Nodes (68): RFC-4226, RFC-4648, RFC-8018, decryptData(), deriveKey(), encryptData(), generateSecureToken(), getCrypto() (+60 more)

### Community 25 - "validation.ts"
Cohesion: 0.43
Nodes (6): ValidationError, ValidationResult, isFiniteNonNegative(), isFinitePositive(), isValidISODate(), validarInput()

### Community 26 - "vacaciones.ts"
Cohesion: 0.53
Nodes (4): ESCALA_VACACIONES, calcularVacaciones(), getDiasVacacionesPorAntiguedad(), Antiguedad

### Community 27 - "mtessExportService.ts"
Cohesion: 0.11
Nodes (39): MtessComplianceTab(), Props, sanitizePatronal(), sanitizeSucursal(), AsignacionRecord, buildMonthlyRow(), buildSettlementRow(), buildSheetName() (+31 more)

### Community 28 - "clientPortal.ts"
Cohesion: 0.10
Nodes (34): Props, EmployeeTransferModal(), EmployeeTransferModalProps, inputStyle, labelStyle, Props, GenerarConstanciaMaternidadParams, generarConstanciaMaternidadPDF() (+26 more)

### Community 29 - "PayrollClosingDashboard.tsx"
Cohesion: 0.13
Nodes (33): bgNivel, bordeNivel, btnStyle, calcularBanner(), cardStyle, iconoNivel, kpiBase, MESES (+25 more)

### Community 30 - "AccountingEntryCard.tsx"
Cohesion: 0.15
Nodes (28): AccountingEntryCard(), PlanDeCuentasModalProps, Props, DEFAULT_CHART_OF_ACCOUNTS, generarAsientoContableNomina(), descargarArchivoContable(), exportarAsientoJSON(), exportarAsientoOdooCSV() (+20 more)

### Community 31 - "clientStorageService.ts"
Cohesion: 0.12
Nodes (30): ClientDashboardTab(), DEMO_ADENDAS, DEMO_CONTRATOS, DEMO_DOCUMENTOS, DEMO_EMPLEADOS, DEMO_EMPRESAS, DEMO_MATERNIDAD, DEMO_USUARIOS (+22 more)

### Community 32 - "getEmpleadosByCliente"
Cohesion: 0.17
Nodes (23): IpsComplianceTab(), Props, SalaryReceiptsTab(), descargarArchivoTexto(), generarArchivoAcreditacionBancaria(), generarIpsPrn(), generarIpsReiTxt(), IpsPrnOutput (+15 more)

### Community 33 - "ExcelPayrollGrid.tsx"
Cohesion: 0.12
Nodes (25): ANIOS, btnRecibo, btnSecondary, calcStyle, CampoNumerico, COLUMNAS, ExcelPayrollGrid(), inputCell (+17 more)

### Community 34 - "payrollClosingCompliance.ts"
Cohesion: 0.14
Nodes (20): PayrollPeriodManagerBarProps, roundGs(), exportarBancoItau_TXT(), exportarBancoSIPAP_CSV(), exportarBancoSudameris_TXT(), FormatoBanco, sanitizeBankCell(), addBusinessDays() (+12 more)

### Community 35 - "EmployeeDirectoryTab.tsx"
Cohesion: 0.16
Nodes (20): EmployeeDirectoryTab(), deleteEmpleado(), SALARIO_MINIMO_LEGAL_PY, cleanCiNumber(), COLUMNS_EXPORT, descargarPlantillaExcel(), ExcelImportResult, exportarNominaAExcel() (+12 more)

### Community 36 - "hrAuditor.ts"
Cohesion: 0.17
Nodes (18): auditSettlement(), calculateSeniorityYears(), formatGs(), parseLocalDate(), parseNumericInput(), PENALIZACION, requiredPreavisoDays(), resolveSalarioMinimo() (+10 more)

### Community 37 - "getSafeStorage"
Cohesion: 0.24
Nodes (19): BADGES_MOTIVOS, EmploymentContractsTab(), MaternityLactationModal(), agregarCertificadoLactanciaTrimestral(), deleteAdendaContrato(), deleteRegistroMaternidad(), getAdendasByCliente(), getContratosByCliente() (+11 more)

### Community 38 - "assistant/types.ts"
Cohesion: 0.11
Nodes (18): HRAssistantModalProps, AssistantCitation, AssistantQueryContext, AssistantRole, AuditCategory, AuditSummary, DeadlineKind, DeadlineStatus (+10 more)

### Community 39 - "HRAssistantModal.tsx"
Cohesion: 0.22
Nodes (16): askDeepSeekAssistant(), generateOfflineAnswer(), HRAssistantModal(), TabType, addBusinessDays(), calculateRetentionLimits(), formatISODateLocal(), getDaysRemaining() (+8 more)

### Community 40 - "CompactDatePicker.tsx"
Cohesion: 0.22
Nodes (16): CompactDatePicker(), CompactDatePickerProps, daysInMonth(), formatDisplayFromIso(), getDecadeBlock(), getMondayBasedWeekday(), isValidYmd(), maskDateInput() (+8 more)

### Community 41 - "clientPortal.test.ts"
Cohesion: 0.25
Nodes (14): generateComprobanteCode(), generateVacId(), Props, VacationsManagementTab(), sumarDiasISO(), calcularDiasVacacionesSegunAntiguedad(), deleteRegistroVacacion(), generarPlanillaVacacionesMtessCSV() (+6 more)

### Community 42 - "payrollNoveltiesEngine.ts"
Cohesion: 0.27
Nodes (12): aplicarNovedadesAEmpleado(), aplicarNovedadesANominaCompleta(), calcularTopeLegalEmbargos(), MESES_ES, parsePeriodoId(), procesarAmortizacionCierrePeriodo(), TOPE_LEGAL_EMBARGOS, EmpleadoNominaInput (+4 more)

### Community 43 - "assistant.ts"
Cohesion: 0.24
Nodes (10): callCloudflare(), callDeepSeek(), callGemini(), callGroq(), callOpenRouter(), config, DEFAULT_SYSTEM_PROMPT, handler() (+2 more)

### Community 44 - "hrKnowledgeBase.ts"
Cohesion: 0.21
Nodes (9): KNOWLEDGE_ENTRIES, normalizeSearchText(), searchKnowledgeBase(), STOPWORDS, tokenize(), TOPIC_LABELS, KnowledgeEntry, KnowledgeSearchResult (+1 more)

### Community 45 - "formatPYG"
Cohesion: 0.31
Nodes (8): formatFechaLargaPY(), generarAdendaContratoPDF(), TITULOS_MOTIVOS, formatearFechaEspanol(), generarContratoTrabajoPDF(), numeroALetrasPY(), formatPYG(), MotivoAdenda

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

## Knowledge Gaps
- **323 isolated node(s):** `$schema`, `typescript`, `oxc`, `react/rules-of-hooks`, `warn` (+318 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 348 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `react` to `services/leadService.ts`, `payroll/types.ts`, `plugins`, `attendanceService.ts`, `clientAuthService.ts`, `EmpresaCliente`, `adminAuthService.ts`, `mtessExportService.ts`, `clientPortal.ts`, `PayrollClosingDashboard.tsx`, `AccountingEntryCard.tsx`, `clientStorageService.ts`, `getEmpleadosByCliente`, `ExcelPayrollGrid.tsx`, `payrollClosingCompliance.ts`, `EmployeeDirectoryTab.tsx`, `getSafeStorage`, `HRAssistantModal.tsx`, `CompactDatePicker.tsx`, `clientPortal.test.ts`, `assistant/index.ts`?**
  _High betweenness centrality (0.204) - this node is a cross-community bridge._
- **Why does `EmpresaCliente` connect `EmpresaCliente` to `getEmpleadosByCliente`, `payroll/types.ts`, `ExcelPayrollGrid.tsx`, `EmployeeDirectoryTab.tsx`, `payrollClosingCompliance.ts`, `getSafeStorage`, `react`, `clientPortal.test.ts`, `attendanceService.ts`, `formatPYG`, `clientAuthService.ts`, `mtessExportService.ts`, `clientPortal.ts`, `PayrollClosingDashboard.tsx`, `clientStorageService.ts`?**
  _High betweenness centrality (0.078) - this node is a cross-community bridge._
- **Why does `Empleado` connect `clientPortal.ts` to `getEmpleadosByCliente`, `payroll/types.ts`, `ExcelPayrollGrid.tsx`, `EmployeeDirectoryTab.tsx`, `getSafeStorage`, `react`, `clientPortal.test.ts`, `attendanceService.ts`, `formatPYG`, `clientAuthService.ts`, `EmpresaCliente`, `clientStorageService.ts`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **What connects `$schema`, `typescript`, `oxc` to the rest of the system?**
  _323 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `services/leadService.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08834586466165413 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._