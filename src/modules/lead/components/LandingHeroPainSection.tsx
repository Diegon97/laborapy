import React, { useState, useMemo, useCallback } from 'react';
import { createWhatsAppUrl } from '../../../config/laborapy';

export type AppRoute = 'home' | 'calculadora' | 'servicios' | 'cliente-login' | 'documentos' | 'legal';

export interface LandingHeroPainSectionProps {
  currentRoute: AppRoute;
  onNavigate: (route: AppRoute) => void;
}

type ChecklistAnswer = boolean | null;

interface ChecklistQuestion {
  readonly id: number;
  readonly text: string;
  readonly shortTitle: string;
  readonly warning: string;
  readonly severity: 'grave' | 'moderada';
  readonly minJornales: number;
  readonly maxJornales: number;
  readonly affirmativeIsInfraction: boolean;
  readonly legalRef: string;
}

const JORNAL_MINIMO = 107627;
const EMPLEADOS_PRESETS = [3, 10, 25, 50, 100] as const;

const CHECKLIST_QUESTIONS: readonly ChecklistQuestion[] = [
  {
    id: 1,
    text: '¿Tus colaboradores trabajan más de 8 horas diarias sin registrar ni percibir el pago de horas extras con recargo legal (50% / 100%)?',
    shortTitle: 'Horas extras impagas y exceso de jornada',
    warning: 'Infracción grave: el MTESS exige registro fidedigno de asistencia/biometría y sanciona con 10 a 30 jornales por cada trabajador afectado.',
    severity: 'grave',
    minJornales: 10,
    maxJornales: 30,
    affirmativeIsInfraction: true,
    legalRef: 'Art. 194-205 Código del Trabajo',
  },
  {
    id: 2,
    text: '¿Omitís entregar a los colaboradores su recibo de salario oficial firmado en duplicado con el detalle legal de haberes y deducciones?',
    shortTitle: 'No entrega de recibos de salario',
    warning: 'Sanción de 5 a 15 jornales por empleado. Ante reclamos o juicios, la falta de recibo firmado presume legalmente la falta de pago.',
    severity: 'moderada',
    minJornales: 5,
    maxJornales: 15,
    affirmativeIsInfraction: true,
    legalRef: 'Art. 235 Código del Trabajo',
  },
  {
    id: 3,
    text: '¿Dejás de suministrar gratuitamente la ropa de trabajo, calzados de seguridad o equipos de protección (EPP) obligatorios para sus funciones?',
    shortTitle: 'Incumplimiento en ropa de trabajo y EPP',
    warning: 'Obligación patronal indelegable: el empleador debe proveer indumentaria y equipos sin costo alguno (10 a 30 jornales de multa por empleado).',
    severity: 'grave',
    minJornales: 10,
    maxJornales: 30,
    affirmativeIsInfraction: true,
    legalRef: 'Art. 272 C.T. · Seguridad e Higiene Laboral',
  },
  {
    id: 4,
    text: '¿Carecés de los exámenes médicos laborales obligatorios (admisionales y periódicos anuales) de tu personal registrados ante Salud Ocupacional?',
    shortTitle: 'Falta de exámenes médicos obligatorios',
    warning: 'Exigencia obligatoria del MTESS e IPS: todo colaborador debe contar con ficha médica de aptitud física (10 a 20 jornales por trabajador).',
    severity: 'grave',
    minJornales: 10,
    maxJornales: 20,
    affirmativeIsInfraction: true,
    legalRef: 'Art. 275 C.T. & Res. Salud Ocupacional MTESS',
  },
  {
    id: 5,
    text: '¿Aplicás descuentos salariales por uniformes, faltantes de mercadería, roturas o conceptos no contemplados en el Código Laboral?',
    shortTitle: 'Descuentos indebidos (uniformes/faltantes)',
    warning: 'Intangibilidad salarial: el MTESS sanciona con 10 a 30 jornales por trabajador y exige la restitución retroactiva total de los montos retenidos.',
    severity: 'grave',
    minJornales: 10,
    maxJornales: 30,
    affirmativeIsInfraction: true,
    legalRef: 'Art. 240, 241 y 242 Código del Trabajo',
  },
];

const CHECKLIST_TOTAL = CHECKLIST_QUESTIONS.length;
const createEmptyAnswers = (): ChecklistAnswer[] => Array.from({ length: CHECKLIST_TOTAL }, () => null);

const FINIQUITO_HASH = '7f3a9c1d84e5b206a1d9f4c73b8e0152c6a4d9e8f12b03a75c8e6d41b9f0a73c';

const PAYROLL_ITEMS = [
  { label: 'Sueldo proporcional', detail: 'Ley N.º 213/93 · Art. 219 (15 días)', value: 'Gs. 2.150.000' },
  { label: 'Aguinaldo proporcional', detail: 'Art. 243 · Exento IPS Art. 76', value: 'Gs. 1.850.000' },
  { label: 'Vacaciones causadas', detail: 'Art. 218 · 12 días corridos', value: 'Gs. 1.150.000' },
  { label: 'Indemnización por despido', detail: 'Art. 91 · 2 años y 4 meses', value: 'Gs. 5.160.000' },
  { label: 'Total liquidación', detail: 'Neto legal a percibir', value: 'Gs. 10.310.000' },
];

type RiskTier = 'idle' | 'low' | 'medium' | 'high';

const RISK_CONFIG: Record<RiskTier, { label: string; percent: number; classModifier: string }> = {
  idle: { label: 'Diagnóstico sin completar', percent: 0, classModifier: 'idle' },
  low: { label: 'Riesgo Bajo (Documentación y Nómina en Regla)', percent: 15, classModifier: 'low' },
  medium: { label: 'Riesgo Medio (Contingencia Patronal Detectada)', percent: 60, classModifier: 'medium' },
  high: { label: 'Riesgo Alto (Exposición Crítica a Multas MTESS)', percent: 100, classModifier: 'high' },
};

export const LandingHeroPainSection: React.FC<LandingHeroPainSectionProps> = ({
  currentRoute,
  onNavigate,
}) => {
  const [employees, setEmployees] = useState<number>(10);
  const [answers, setAnswers] = useState<ChecklistAnswer[]>(createEmptyAnswers);

  const setAnswer = useCallback((index: number, value: boolean) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[index] = next[index] === value ? null : value;
      return next;
    });
  }, []);

  const resetChecklist = useCallback(() => {
    setAnswers(createEmptyAnswers());
  }, []);

  const handleEmployeesChange = useCallback((value: number) => {
    const valid = Math.max(1, Math.min(2000, isNaN(value) ? 1 : value));
    setEmployees(valid);
  }, []);

  // Evaluación de infracciones conforme a los 5 focos oficiales MTESS 2026
  const { infractions, answeredCount, risk, totalMinJornales, totalMaxJornales } = useMemo(() => {
    const detected: ChecklistQuestion[] = [];
    let answered = 0;
    let minJornales = 0;
    let maxJornales = 0;

    answers.forEach((ans, idx) => {
      if (ans !== null) {
        answered++;
        const q = CHECKLIST_QUESTIONS[idx];
        const isInfraction = q.affirmativeIsInfraction ? ans === true : ans === false;
        if (isInfraction) {
          detected.push(q);
          minJornales += q.minJornales;
          maxJornales += q.maxJornales;
        }
      }
    });

    let tier: RiskTier = 'idle';
    if (answered > 0) {
      if (detected.length === 0) tier = 'low';
      else if (detected.length <= 2) tier = 'medium';
      else tier = 'high';
    }

    return {
      infractions: detected,
      answeredCount: answered,
      risk: tier,
      totalMinJornales: minJornales,
      totalMaxJornales: maxJornales,
    };
  }, [answers]);

  const riskMeta = RISK_CONFIG[risk];

  const fineEstimate = useMemo(() => {
    if (answeredCount === 0) {
      return `Completá las preguntas para calcular la exposición de tus ${employees} empleados`;
    }
    if (infractions.length === 0) {
      return 'Gs. 0 (Sin contingencia de multas identificada en este relevamiento)';
    }

    const minGs = totalMinJornales * employees * JORNAL_MINIMO;
    const maxGs = totalMaxJornales * employees * JORNAL_MINIMO;

    return `Gs. ${minGs.toLocaleString('es-PY')} a Gs. ${maxGs.toLocaleString('es-PY')} (${totalMinJornales} a ${totalMaxJornales} jornales acumulados por trabajador)`;
  }, [answeredCount, infractions.length, totalMinJornales, totalMaxJornales, employees]);

  const whatsappUrl = useMemo(() => {
    const infractionsList =
      infractions.length > 0
        ? infractions.map((q) => `• ${q.shortTitle} (${q.legalRef} · ${q.minJornales}-${q.maxJornales} jornales/emp)`).join('\n')
        : '• Ninguna contingencia crítica detectada';

    const message =
      `Hola LaboraPy 👋, realicé el Diagnóstico de Riesgo MTESS en su web para una empresa de ${employees} colaboradores:\n\n` +
      `• Diagnóstico: ${riskMeta.label}\n` +
      `• Preguntas respondidas: ${answeredCount}/${CHECKLIST_TOTAL}\n` +
      `• Infracciones detectadas (${infractions.length}):\n${infractionsList}\n` +
      `• Exposición estimada a multas: ${fineEstimate}\n\n` +
      `Quiero solicitar una auditoría preventiva de nómina y regularizar legajos/finiquitos para evitar sanciones en fiscalizaciones del MTESS. ¿Podemos coordinar?`;

    return createWhatsAppUrl(message);
  }, [employees, riskMeta.label, answeredCount, infractions, fineEstimate]);

  return (
    <section className="lp-hero-pain" aria-labelledby="lp-hero-title">
      {/* A) TOP BAR */}
      <div className="lp-topbar">
        <span className="lp-topbar__badge">
          🇵🇾 PARAGUAY · CERO MULTAS MTESS · LEY N.º 213/93 &amp; IPS
        </span>
      </div>

      {/* B) HEADLINE */}
      <header className="lp-head">
        <h1 id="lp-hero-title" className="lp-head__title">
          Evitá multas del MTESS y demandas laborales con finiquitos blindados en{' '}
          <span className="lp-head__accent">3 minutos</span>
        </h1>
        <p className="lp-head__subtitle">
          Calculá liquidaciones exactas bajo la Ley N.º 213/93, generá documentos oficiales con
          sello digital QR y blindá la nómina y contabilidad de tu empresa en Paraguay.
        </p>
      </header>

      {/* C) AUDIENCE CARDS -> NAVEGACIÓN DEDICADA SPA */}
      <div className="lp-audience" role="group" aria-label="Seleccioná tu perfil">
        <button
          type="button"
          className={`lp-audience__card lp-audience__card--company ${currentRoute === 'cliente-login' ? 'is-active' : ''}`}
          onClick={() => onNavigate('cliente-login')}
        >
          <span className="lp-audience__icon" aria-hidden="true">🏢</span>
          <span className="lp-audience__title">Empresa / Patrono</span>
          <span className="lp-audience__desc">
            Portal del cliente ERP, nómina blindada, contratos PDF y planillas al día para el MTESS.
          </span>
          <span className="lp-audience__cta">Ingresar al Portal Clientes ERP →</span>
        </button>

        <button
          type="button"
          className={`lp-audience__card lp-audience__card--worker ${currentRoute === 'calculadora' ? 'is-active' : ''}`}
          onClick={() => onNavigate('calculadora')}
        >
          <span className="lp-audience__icon" aria-hidden="true">👤</span>
          <span className="lp-audience__title">Colaborador / Empleado</span>
          <span className="lp-audience__desc">
            Calculá tu liquidación de salida por despido o renuncia con pleno rigor de la Ley N.º 213/93.
          </span>
          <span className="lp-audience__cta">Calcular mi Liquidación →</span>
        </button>

        <button
          type="button"
          className={`lp-audience__card lp-audience__card--accountant ${currentRoute === 'servicios' ? 'is-active' : ''}`}
          onClick={() => onNavigate('servicios')}
        >
          <span className="lp-audience__icon" aria-hidden="true">📊</span>
          <span className="lp-audience__title">Contador / Profesional</span>
          <span className="lp-audience__desc">
            Automatizá liquidaciones, balances auditables, IVA, IRE e IRP ante la DNIT y bancos.
          </span>
          <span className="lp-audience__cta">Ver Servicios &amp; Balances DNIT →</span>
        </button>
      </div>

      {/* D) COMPARADOR VISUAL */}
      <div className="lp-compare">
        <div className="lp-compare__col lp-compare__col--red">
          <div className="lp-compare__header">
            <span className="lp-compare__emoji" aria-hidden="true">⚠️</span>
            <h3 className="lp-compare__title">El Dolor en Excel (Riesgo Patronal)</h3>
          </div>
          <ul className="lp-compare__list">
            <li>Exceso de jornada sin registro ni pago de horas extras con recargo legal.</li>
            <li>No entrega de recibos de salario oficiales (presunción de no pago).</li>
            <li>Incumplimiento en provisión gratuita de uniformes y equipos de protección (EPP).</li>
            <li>Falta de exámenes médicos laborales obligatorios (admisionales y periódicos).</li>
            <li>Descuentos indebidos por uniformes o faltantes no permitidos en el Código Laboral.</li>
            <li>Multas acumuladas de 10 a 30 jornales por cada trabajador de la nómina.</li>
          </ul>
        </div>

        <div className="lp-compare__col lp-compare__col--green">
          <div className="lp-compare__header">
            <span className="lp-compare__emoji" aria-hidden="true">🛡️</span>
            <h3 className="lp-compare__title">Con LaboraPy (Blindaje Total)</h3>
          </div>
          <ul className="lp-compare__list">
            <li>Cómputo exacto de jornadas, horas extraordinarias y recargos según Ley 213/93.</li>
            <li>Emisión automática de recibos legales de salario en duplicado conforme al Art. 235.</li>
            <li>Constancias documentales de entrega de indumentaria laboral y EPP obligatorio.</li>
            <li>Control de vencimientos y legajos de salud ocupacional y exámenes médicos.</li>
            <li>Blindaje estricto de intangibilidad salarial: cero deducciones no autorizadas.</li>
            <li>Finiquitos con Sello QR y Hash SHA-256 con efecto liberatorio pleno de reclamos.</li>
          </ul>
        </div>
      </div>

      {/* E) MOCKUP FINIQUITO BLINDADO */}
      <div className="lp-mockup" aria-label="Vista previa del Finiquito Blindado">
        <div className="lp-mockup__header">
          <div className="lp-mockup__brand">
            <span className="lp-mockup__brand-dot" aria-hidden="true">🇵🇾</span>
            <span className="lp-mockup__brand-name">LABORAPY · DOCUMENTO OFICIAL BLINDADO</span>
          </div>
          <span className="lp-mockup__seal">VERIFICADO · LEY N.º 213/93 · SELLO QR ACTIVO</span>
        </div>

        <div className="lp-mockup__meta">
          <div className="lp-mockup__meta-row">
            <span className="lp-mockup__meta-label">Tipo Documento:</span>
            <span className="lp-mockup__meta-value">Finiquito de Liquidación Final con Deslinde de Reclamos</span>
          </div>
          <div className="lp-mockup__meta-row">
            <span className="lp-mockup__meta-label">Marco Legal:</span>
            <span className="lp-mockup__meta-value">Ley N.º 213/93 · Decreto-Ley 1860/50 IPS · Ley 4017/10</span>
          </div>
          <div className="lp-mockup__meta-row">
            <span className="lp-mockup__meta-label">Integridad Hash SHA-256:</span>
            <span className="lp-mockup__hash" title={FINIQUITO_HASH}>
              {FINIQUITO_HASH}
            </span>
          </div>
        </div>

        <div className="lp-mockup__body">
          <div className="lp-mockup__breakdown">
            {PAYROLL_ITEMS.map((item, idx) => (
              <div
                key={item.label}
                className={
                  idx === PAYROLL_ITEMS.length - 1
                    ? 'lp-mockup__item lp-mockup__item--total'
                    : 'lp-mockup__item'
                }
              >
                <div className="lp-mockup__item-left">
                  <span className="lp-mockup__item-label">{item.label}</span>
                  <span className="lp-mockup__item-detail">{item.detail}</span>
                </div>
                <span className="lp-mockup__item-value">{item.value}</span>
              </div>
            ))}
          </div>

          <div className="lp-mockup__qr-block">
            <div className="lp-mockup__qr" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="80" height="80" fill="none">
                <rect x="2" y="2" width="8" height="8" rx="1" fill="#0b1220" />
                <rect x="14" y="2" width="8" height="8" rx="1" fill="#0b1220" />
                <rect x="2" y="14" width="8" height="8" rx="1" fill="#0b1220" />
                <rect x="4" y="4" width="4" height="4" fill="#ffffff" />
                <rect x="16" y="4" width="4" height="4" fill="#ffffff" />
                <rect x="4" y="16" width="4" height="4" fill="#ffffff" />
                <rect x="14" y="14" width="3" height="3" fill="#0b1220" />
                <rect x="19" y="14" width="3" height="3" fill="#0b1220" />
                <rect x="14" y="19" width="3" height="3" fill="#0b1220" />
                <rect x="19" y="19" width="3" height="3" fill="#0b1220" />
              </svg>
            </div>
            <span className="lp-mockup__qr-caption">
              Verificación inmediata escaneando el QR oficial
            </span>
          </div>
        </div>

        <div className="lp-mockup__signature">
          <div className="lp-mockup__sign-line" />
          <span className="lp-mockup__sign-label">Firma Digital Certificada LaboraPy</span>
          <span className="lp-mockup__sign-role">Conforme a la Ley N.º 4017/10 y Código del Trabajo</span>
        </div>
      </div>

      {/* F) CHECKLIST DIAGNÓSTICO MTESS INDEXADO A NÓMINA (5 FOCOS OFICIALES) */}
      <div className="lp-checklist">
        {/* Alerta de Fiscalizaciones MTESS 2026 */}
        <div className="lp-news-alert" role="alert">
          <span className="lp-news-alert__badge">🚨 FISCALIZACIONES PRIORITARIAS MTESS 2026</span>
          <p className="lp-news-alert__text">
            El Ministerio de Trabajo aplica sanciones acumulativas <strong>por cada trabajador de la nómina</strong> sobre: <strong>exceso de jornada sin horas extras, no entrega de recibos, falta de uniformes/EPP, omisión de exámenes médicos y descuentos salariales indebidos</strong> (Art. 194-275 C.T.).
          </p>
        </div>

        <div className="lp-checklist__head">
          <h2 className="lp-checklist__title">Diagnóstico de Riesgo MTESS en 30 segundos</h2>
          <p className="lp-checklist__subtitle">
            Las multas del MTESS se calculan por <strong>cantidad de empleados</strong> (Jornal mínimo legal: <strong>Gs. 107.627</strong>). Indicá el tamaño de tu nómina para evaluar tu exposición patrimonial exacta:
          </p>
        </div>

        {/* Selector de Cantidad de Empleados */}
        <div className="lp-emp-selector">
          <label htmlFor="lp-emp-input" className="lp-emp-selector__label">
            Cantidad de trabajadores en tu empresa:
          </label>
          <div className="lp-emp-selector__controls">
            <div className="lp-emp-selector__presets">
              {EMPLEADOS_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={`lp-emp-selector__preset-btn ${employees === preset ? 'is-selected' : ''}`}
                  onClick={() => setEmployees(preset)}
                >
                  {preset} emp.
                </button>
              ))}
            </div>
            <div className="lp-emp-selector__input-wrap">
              <input
                id="lp-emp-input"
                type="number"
                min={1}
                max={2000}
                value={employees}
                onChange={(e) => handleEmployeesChange(parseInt(e.target.value, 10))}
                className="lp-emp-selector__input"
                aria-label="Cantidad exacta de empleados"
              />
              <span className="lp-emp-selector__unit">colaboradores</span>
            </div>
          </div>
        </div>

        {/* Lista de las 5 Preguntas Críticas Oficiales */}
        <ul className="lp-checklist__list">
          {CHECKLIST_QUESTIONS.map((q, idx) => {
            const value = answers[idx];
            const isInfraction = value === true;

            return (
              <li
                key={q.id}
                className={`lp-checklist__item ${isInfraction ? 'lp-checklist__item--danger' : ''}`}
              >
                <span className="lp-checklist__num">{idx + 1}</span>
                <div className="lp-checklist__content">
                  <span className="lp-checklist__question">{q.text}</span>
                  <span className="lp-checklist__warning">
                    ⚠️ {q.warning}
                  </span>
                  <span className="lp-checklist__ref">
                    ⚖️ {q.legalRef} · Sanción: {q.minJornales} a {q.maxJornales} jornales por empleado
                  </span>
                </div>
                <div className="lp-checklist__actions">
                  <button
                    type="button"
                    className={`lp-checklist__btn lp-checklist__btn--yes ${value === true ? 'is-active' : ''}`}
                    aria-pressed={value === true}
                    onClick={() => setAnswer(idx, true)}
                  >
                    Sí
                  </button>
                  <button
                    type="button"
                    className={`lp-checklist__btn lp-checklist__btn--no ${value === false ? 'is-active' : ''}`}
                    aria-pressed={value === false}
                    onClick={() => setAnswer(idx, false)}
                  >
                    No
                  </button>
                </div>
              </li>
            );
          })}
        </ul>

        {/* Tacómetro Dinámico Indexado a Nómina */}
        <div className={`lp-risk lp-risk--${riskMeta.classModifier}`}>
          <div className="lp-risk__top">
            <span className="lp-risk__label">
              Nivel de riesgo ({employees} empleados): <strong>{riskMeta.label}</strong>
            </span>
            <span className="lp-risk__count">{answeredCount}/{CHECKLIST_TOTAL} evaluadas</span>
          </div>

          <div
            className="lp-risk__bar"
            role="progressbar"
            aria-label={`Nivel de exposición a multas MTESS para ${employees} empleados`}
            aria-valuenow={riskMeta.percent}
            aria-valuetext={`${riskMeta.label} (${riskMeta.percent}%)`}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span className="lp-risk__bar-fill" style={{ width: `${riskMeta.percent}%` }} />
          </div>

          <div className="lp-risk__footer">
            <span className="lp-risk__fine-label">Exposición estimada a multas patronales:</span>
            <span className="lp-risk__fine-value">{fineEstimate}</span>
          </div>

          {infractions.length > 0 && (
            <div className="lp-risk__infractions-alert">
              ⚠️ <strong>{infractions.length} contingencia(s) crítica(s) detectada(s):</strong>{' '}
              {infractions.map((inf) => inf.shortTitle).join(', ')}. El MTESS fiscaliza y exige restitución de haberes más sumario patronal.
            </div>
          )}
        </div>

        {/* Botones de Conversión */}
        <div className="lp-checklist__cta-bar">
          <a
            className="lp-checklist__whatsapp"
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="lp-checklist__whatsapp-icon" aria-hidden="true">💬</span>
            Blindar mis {employees} empleados por WhatsApp
          </a>
          {answeredCount > 0 && (
            <button
              type="button"
              className="lp-checklist__reset"
              onClick={resetChecklist}
            >
              Reiniciar diagnóstico
            </button>
          )}
        </div>
      </div>
    </section>
  );
};

export default LandingHeroPainSection;
