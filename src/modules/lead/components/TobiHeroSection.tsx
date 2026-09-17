import React, { useState, useMemo, useCallback } from 'react';
import type { AppRoute } from './LandingHeroPainSection';

export interface TobiHeroSectionProps {
  userName?: string;
  companyName?: string;
  onStartConversation: (prompt: string) => void;
  onNavigate: (route: AppRoute) => void;
}

interface ActionPill {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  prompt: string;
}

const ACTION_PILLS: readonly ActionPill[] = [
  {
    id: 'amonestacion',
    icon: '📄',
    title: 'Amonestación Escrita',
    subtitle: 'Apercibimiento formal por llegadas tardías o faltas',
    prompt: 'Necesito redactar una amonestación escrita formal para un colaborador que incurrió en faltas laborales reiteradas.',
  },
  {
    id: 'liquidacion',
    icon: '📊',
    title: 'Calcular Liquidación',
    subtitle: 'Finiquito, indemnización Art. 91 y preaviso oficial',
    prompt: 'Quiero calcular la liquidación laboral oficial de un colaborador con salario mensual y fechas de ingreso y egreso.',
  },
  {
    id: 'suspension',
    icon: '⚠️',
    title: 'Suspensión Disciplinaria',
    subtitle: 'Sanción sin goce de sueldo (Arts. 352/353 C.T.)',
    prompt: 'Necesito redactar una notificación formal de suspensión disciplinaria laboral conforme a los Arts. 352 y 353 del Código del Trabajo.',
  },
  {
    id: 'traslado',
    icon: '🔄',
    title: 'Nota de Traslado',
    subtitle: 'Cambio de sucursal o puesto según Art. 34 C.T.',
    prompt: 'Necesito comunicar formalmente el traslado de sucursal de un colaborador preservando categoría y salario según el Art. 34 del Código Laboral.',
  },
  {
    id: 'renuncia',
    icon: '📝',
    title: 'Despido / Renuncia',
    subtitle: 'Notificación oficial con causales o renuncia',
    prompt: 'Quiero redactar una nota oficial de despido o renuncia voluntaria con constancia de recepción para legajo.',
  },
  {
    id: 'csj',
    icon: '⚖️',
    title: 'Jurisprudencia CSJ',
    subtitle: 'Fallos vinculantes de la Corte Suprema en lo laboral',
    prompt: '¿Cuáles son los criterios vinculantes y precedentes de la Corte Suprema de Justicia (CSJ) sobre despidos y fraude laboral en Paraguay?',
  },
];

export const TobiHeroSection: React.FC<TobiHeroSectionProps> = ({
  userName,
  onStartConversation,
  onNavigate,
}) => {
  const [promptText, setPromptText] = useState('');

  const saludo = useMemo(() => {
    const hora = new Date().getHours();
    if (hora >= 5 && hora < 12) return 'Buenos días';
    if (hora >= 12 && hora < 19) return 'Buenas tardes';
    return 'Buenas noches';
  }, []);

  const nombreMostrado = userName?.trim();
  const saludoCompleto = nombreMostrado ? `${saludo}, ${nombreMostrado}` : saludo;
  const subtituloManos = nombreMostrado ? `¡Manos a la obra, ${nombreMostrado}!` : '¡Manos a la obra!';

  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      const clean = promptText.trim();
      if (!clean) return;
      onStartConversation(clean);
      setPromptText('');
    },
    [promptText, onStartConversation],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <section className="tobi-hero">
      <div className="tobi-hero__glow-1" />
      <div className="tobi-hero__glow-2" />

      <div className="tobi-hero__container">
        {/* Badge Tobi AI */}
        <div className="tobi-hero__badge">
          <span className="tobi-hero__badge-dot" />
          <span>TOBI · ASISTENTE PERICIAL & LEGAL RRHH</span>
        </div>

        {/* Saludo dinámico y Título */}
        <h1 className="tobi-hero__title">{saludoCompleto}</h1>
        <h2 className="tobi-hero__subtitle">{subtituloManos} ¿Qué resolvemos hoy?</h2>
        <p className="tobi-hero__desc">
          Especialista en derecho laboral paraguayo (Ley Nº 213/93). Redactá amonestaciones, suspensiones o traslados,
          calculá liquidaciones oficiales o auditá riesgos de demanda con fallos de la CSJ en el acto.
        </p>

        {/* Barra de Chat Central */}
        <form onSubmit={handleSubmit} className="tobi-hero__chatbox">
          <textarea
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            placeholder="Escribí tu caso o consulta... (ej: 'Necesito amonestar por escrito a un chofer que no vino el lunes')"
            className="tobi-hero__textarea"
          />

          <div className="tobi-hero__chatbox-footer">
            <div className="tobi-hero__kbd-hint">
              <span>Presioná</span>
              <kbd className="tobi-hero__kbd">Enter ↵</kbd>
              <span>para consultar</span>
            </div>

            <button
              type="submit"
              disabled={!promptText.trim()}
              className="tobi-hero__submit-btn"
            >
              <span>Consultar a Tobi</span>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M1 8a.5.5 0 0 1 .5-.5h11.793l-3.147-3.146a.5.5 0 0 1 .708-.708l4 4a.5.5 0 0 1 0 .708l-4 4a.5.5 0 0 1-.708-.708L13.293 8.5H1.5A.5.5 0 0 1 1 8z" />
              </svg>
            </button>
          </div>
        </form>

        {/* Action Pills Grid estilo Claude / ChatGPT */}
        <div className="tobi-hero__pills-wrapper">
          <div className="tobi-hero__pills-label">Acciones rápidas frecuentes</div>
          <div className="tobi-hero__pills-grid">
            {ACTION_PILLS.map((pill) => (
              <button
                key={pill.id}
                type="button"
                onClick={() => onStartConversation(pill.prompt)}
                className="tobi-hero__pill-btn"
              >
                <div className="tobi-hero__pill-header">
                  <span className="tobi-hero__pill-icon">{pill.icon}</span>
                  <span className="tobi-hero__pill-title">{pill.title}</span>
                </div>
                <span className="tobi-hero__pill-sub">{pill.subtitle}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Acceso Secundario a la Calculadora Tradicional */}
        <div className="tobi-hero__footer-switch">
          <span>¿Preferís el formulario clásico?</span>
          <button
            type="button"
            onClick={() => onNavigate('calculadora')}
            className="tobi-hero__switch-link"
          >
            Abrir Calculadora Tradicional →
          </button>
        </div>
      </div>
    </section>
  );
};
