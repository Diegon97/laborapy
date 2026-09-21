import { describe, it, expect } from 'vitest';
import { TOBI_SYSTEM_PROMPT } from '../tobiSystemPrompt';

describe('TOBI_SYSTEM_PROMPT — regla inexpugnable del salario mínimo', () => {
  it('fija el salario mínimo vigente en Gs. 3.044.000', () => {
    expect(TOBI_SYSTEM_PROMPT).toContain('3.044.000');
  });

  it('prohíbe explícitamente el valor vencido Gs. 2.798.309', () => {
    expect(TOBI_SYSTEM_PROMPT).toContain('2.798.309');
    expect(TOBI_SYSTEM_PROMPT).toMatch(/PROHIBIDO/i);
    expect(TOBI_SYSTEM_PROMPT).toMatch(/VENCIDO/i);
  });

  it('no presenta el valor viejo entre paréntesis como vigente', () => {
    expect(TOBI_SYSTEM_PROMPT).not.toContain('2.798.309)');
    expect(TOBI_SYSTEM_PROMPT).not.toMatch(/vigente[^.]*2\.798\.309/i);
  });

  it('mantiene la identidad y el marco normativo de Tobi', () => {
    expect(TOBI_SYSTEM_PROMPT).toContain('Tobi');
    expect(TOBI_SYSTEM_PROMPT).toContain('Art. 19');
  });

  it('fija las reglas taxativas de jornadas de trabajo en Paraguay (Arts. 194-196 y 234)', () => {
    expect(TOBI_SYSTEM_PROMPT).toContain('Art. 196');
    expect(TOBI_SYSTEM_PROMPT).toContain('45 horas semanales');
    expect(TOBI_SYSTEM_PROMPT).toContain('20:00 y las 06:00');
    expect(TOBI_SYSTEM_PROMPT).toContain('30%');
    expect(TOBI_SYSTEM_PROMPT).toContain('30% (Art. 234, NUNCA 25%)');
  });
});

describe('TOBI_SYSTEM_PROMPT — jornada mixta (Art. 196 C.T.)', () => {
  it('fija el tope máximo de la jornada mixta en 7 horas y media (7.5h) diarias', () => {
    expect(TOBI_SYSTEM_PROMPT).toMatch(/7 horas y media/i);
    expect(TOBI_SYSTEM_PROMPT).toMatch(/7h 30m|7\.5/);
  });

  it('fija el máximo semanal de la jornada mixta en 45 horas semanales', () => {
    expect(TOBI_SYSTEM_PROMPT).toContain('45 horas semanales');
  });

  it('prohíbe expresamente considerar 8 horas como tope ordinario de la jornada mixta', () => {
    expect(TOBI_SYSTEM_PROMPT).toMatch(/PROHIBIDO[^.]*8 horas diarias[^.]*tope ordinario[^.]*jornada mixta/i);
    expect(TOBI_SYSTEM_PROMPT).toMatch(/media hora excedente diaria[^.]*hora extraordinaria/i);
  });

  it('exige que el tramo nocturno sea estrictamente menor a 3 horas y media', () => {
    expect(TOBI_SYSTEM_PROMPT).toMatch(/MENOR de 3 horas y media/i);
  });

  it('aplica recargo nocturno del 30% (nunca 25%) a las horas nocturnas de la mixta', () => {
    expect(TOBI_SYSTEM_PROMPT).toMatch(/30%/);
    expect(TOBI_SYSTEM_PROMPT).toMatch(/NUNCA 25%/);
  });
});

describe('TOBI_SYSTEM_PROMPT — horas extraordinarias y artículos taxativos', () => {
  it('cita los Arts. 196, 202 y 234 de forma taxativa', () => {
    expect(TOBI_SYSTEM_PROMPT).toContain('Art. 196');
    expect(TOBI_SYSTEM_PROMPT).toContain('Art. 202');
    expect(TOBI_SYSTEM_PROMPT).toContain('Art. 234');
  });

  it('no usa esquemas foráneos de recargo (50% primera hora / horas triples)', () => {
    expect(TOBI_SYSTEM_PROMPT).toMatch(/50% la primera hora y 100% la segunda/);
    expect(TOBI_SYSTEM_PROMPT).toMatch(/horas triples/i);
    expect(TOBI_SYSTEM_PROMPT).toMatch(/PROHIBIDO[^.]*esquemas foráneos/i);
  });
});

describe('TOBI_SYSTEM_PROMPT — control de alucinaciones jurídicas', () => {
  it('prohíbe atribuir jornada u horas extras a los Arts. 30 y 31', () => {
    expect(TOBI_SYSTEM_PROMPT).toMatch(/Arts\. 30 y 31[^.]*NO regulan jornada/i);
  });

  it('aclara que el Art. 84 es indemnización por despido injustificado (no horas extras)', () => {
    expect(TOBI_SYSTEM_PROMPT).toMatch(/Art\. 84[^.]*indemnización por despido injustificado/i);
  });

  it('aclara que el Art. 85 es despido indirecto (no horas extras)', () => {
    expect(TOBI_SYSTEM_PROMPT).toMatch(/Art\. 85[^.]*despido indirecto/i);
  });

  it('aclara que el Art. 166 no regula vacaciones y fija la escala exclusiva del Art. 218 en días hábiles', () => {
    expect(TOBI_SYSTEM_PROMPT).toMatch(/Art\. 166[^.]*NO regula vacaciones/i);
    expect(TOBI_SYSTEM_PROMPT).toContain('12 DÍAS HÁBILES');
    expect(TOBI_SYSTEM_PROMPT).toContain('18 DÍAS HÁBILES');
    expect(TOBI_SYSTEM_PROMPT).toContain('30 DÍAS HÁBILES');
    expect(TOBI_SYSTEM_PROMPT).toMatch(/PROHIBIDO inventar escalas foráneas[^.]*36 días/i);
  });

  it('prohíbe inventar nombres de empresas no mencionadas por el usuario', () => {
    expect(TOBI_SYSTEM_PROMPT).toMatch(/PROHIBIDO inventar nombres de empresas/i);
  });
});

describe('TOBI_SYSTEM_PROMPT — protocolo de liquidación y finiquito', () => {
  it('contiene la directiva del bloque determinístico :::liquidacion_action', () => {
    expect(TOBI_SYSTEM_PROMPT).toContain(':::liquidacion_action');
    expect(TOBI_SYSTEM_PROMPT).toContain('salarioMensual');
    expect(TOBI_SYSTEM_PROMPT).toContain('despido_sin_causa');
  });

  it('ordena solicitar datos indispensables si no fueron proporcionados', () => {
    expect(TOBI_SYSTEM_PROMPT).toMatch(/faltan datos indispensables[^.]*solicitalos/i);
  });

  it('contempla la directiva de seguridad CISO zero-leak y lenguaje humano sin pedir JSON', () => {
    expect(TOBI_SYSTEM_PROMPT).toMatch(/ZERO-LEAK/i);
    expect(TOBI_SYSTEM_PROMPT).toMatch(/Jamás le pidas al usuario que envíe un "JSON"/i);
  });

  it('incorpora guardrail anti-spam de tokens y regla anti-truncamiento', () => {
    expect(TOBI_SYSTEM_PROMPT).toMatch(/ANTI-SPAM Y PROTECCIÓN DE TOKENS/i);
    expect(TOBI_SYSTEM_PROMPT).toMatch(/CONCISIÓN Y ANTI-TRUNCAMIENTO/i);
  });
});

describe('TOBI_SYSTEM_PROMPT — blindaje legal y canales oficiales', () => {
  it('no contiene nombres de abogados particulares no autorizados', () => {
    expect(TOBI_SYSTEM_PROMPT).not.toContain('Ernesto Yampey');
    expect(TOBI_SYSTEM_PROMPT).not.toContain('Juan Bernis');
  });

  it('fija los canales oficiales de contacto de LaboraPy', () => {
    expect(TOBI_SYSTEM_PROMPT).toContain('+595 984 469 005');
    expect(TOBI_SYSTEM_PROMPT).toContain('diegonunez1997@gmail.com');
  });

  it('prohíbe citar abogados particulares con nombre propio o atribuirles vínculo con LaboraPy', () => {
    expect(TOBI_SYSTEM_PROMPT).toMatch(/PROHIBIDO[^.]*abogados[^.]*particulares/i);
    expect(TOBI_SYSTEM_PROMPT).toMatch(/nombre y apellido/i);
  });

  it('prohíbe inventar números de teléfono, correos, dominios o nombres de profesionales', () => {
    expect(TOBI_SYSTEM_PROMPT).toMatch(/PROHIBIDO inventar[^.]*números de teléfono/i);
  });

  it('deriva los litigios contenciosos a entes públicos (MTESS, Defensa Pública y CAP)', () => {
    expect(TOBI_SYSTEM_PROMPT).toMatch(/MTESS/i);
    expect(TOBI_SYSTEM_PROMPT).toMatch(/Defensa Pública/i);
    expect(TOBI_SYSTEM_PROMPT).toMatch(/Colegio de Abogados del Paraguay/i);
  });
});

describe('TOBI_SYSTEM_PROMPT — sanciones disciplinarias y gradualidad (Arts. 352, 353 y 354 C.T.)', () => {
  it('funda el régimen disciplinario y tope en los Arts. 352, 353 inc. a) y 354 C.T.', () => {
    expect(TOBI_SYSTEM_PROMPT).toContain('Art. 353 inc. a');
    expect(TOBI_SYSTEM_PROMPT).toContain('Art. 352 inc. i');
    expect(TOBI_SYSTEM_PROMPT).toContain('Art. 354');
  });

  it('prohíbe aplicar 8 días directos sin amonestación previa por escrito', () => {
    expect(TOBI_SYSTEM_PROMPT).toMatch(/PROHIBIDO aplicar o sugerir 8 días de suspensión directa/i);
    expect(TOBI_SYSTEM_PROMPT).toMatch(/despedido indirectamente con justa causa \(Art\. 85 C\.T\.\)/i);
  });

  it('establece el máximo prudente de 1 día de suspensión si no hay amonestación previa', () => {
    expect(TOBI_SYSTEM_PROMPT).toMatch(/máxima legalmente prudente es de 1 DÍA/i);
    expect(TOBI_SYSTEM_PROMPT).toMatch(/asignar obligatoriamente "diasSuspension": 1 \(NUNCA 8 por defecto\)/i);
  });

  it('exige sumario administrativo previo y Reglamento Interno homologado para suspensiones de 4 a 8 días', () => {
    expect(TOBI_SYSTEM_PROMPT).toMatch(/sumario administrativo previo/i);
    expect(TOBI_SYSTEM_PROMPT).toMatch(/Reglamento Interno homologado/i);
  });
});

describe('TOBI_SYSTEM_PROMPT — identidad pedagógica de Profesor y Mentor de RRHH (Humanizer)', () => {
  it('encarna la identidad de Copilot, Profesor y Asesor Senior sin atribuirse años ficticios de experiencia', () => {
    expect(TOBI_SYSTEM_PROMPT).toContain('Copilot, Profesor y Asesor Senior de Recursos Humanos y Legislación Laboral');
    expect(TOBI_SYSTEM_PROMPT).toContain('IDENTIDAD PEDAGÓGICA Y MENTOR DE RRHH');
    expect(TOBI_SYSTEM_PROMPT).not.toContain('30 años de experiencia');
    expect(TOBI_SYSTEM_PROMPT).not.toContain('tres décadas');
    expect(TOBI_SYSTEM_PROMPT).toMatch(/Queda TERMINANTEMENTE PROHIBIDO inventar o atribuirte años o décadas de experiencia humana/);
  });

  it('declara sabiduría, contención, paciencia, empatía y simpatía humanas', () => {
    expect(TOBI_SYSTEM_PROMPT).toMatch(/Sabiduría y contención/);
    expect(TOBI_SYSTEM_PROMPT).toMatch(/Paciencia y simpatía/);
    expect(TOBI_SYSTEM_PROMPT).toMatch(/empatía genuina/i);
    expect(TOBI_SYSTEM_PROMPT).toContain('Tranquilo, vamos a analizar esto juntos paso a paso');
  });

  it('aplica pedagogía viva y principios Humanizer con cero vicios de IA', () => {
    expect(TOBI_SYSTEM_PROMPT).toMatch(/Pedagogía viva y principios Humanizer/);
    expect(TOBI_SYSTEM_PROMPT).toMatch(/cero clichés y vicios de IA/i);
    expect(TOBI_SYSTEM_PROMPT).toContain('no es solo X sino Y');
    expect(TOBI_SYSTEM_PROMPT).toContain('es crucial');
  });

  it('define la modulación y cadencia cálida al hablar por voz o audio', () => {
    expect(TOBI_SYSTEM_PROMPT).toMatch(/Modulación y cadencia al hablar/);
    expect(TOBI_SYSTEM_PROMPT).toMatch(/pausada, cálida, reconfortante y cercana/);
  });

  it('preserva la Regla N° 0, la Regla N° 1 y las reglas taxativas canónicas', () => {
    expect(TOBI_SYSTEM_PROMPT).toContain('REGLA INEXPUGNABLE N° 0');
    expect(TOBI_SYSTEM_PROMPT).toContain('REGLA INEXPUGNABLE N° 1');
    expect(TOBI_SYSTEM_PROMPT).toContain('Diego Núñez');
    expect(TOBI_SYSTEM_PROMPT).toContain('3.044.000');
    expect(TOBI_SYSTEM_PROMPT).toContain('Art. 218');
    expect(TOBI_SYSTEM_PROMPT).toContain('Art. 243');
    expect(TOBI_SYSTEM_PROMPT).toContain('Art. 94');
    expect(TOBI_SYSTEM_PROMPT).toContain('Art. 399');
  });

  it('mantiene intactos los bloques de acción y el zero-leak de proveedores', () => {
    expect(TOBI_SYSTEM_PROMPT).toContain(':::liquidacion_action');
    expect(TOBI_SYSTEM_PROMPT).toContain(':::documento_action');
    expect(TOBI_SYSTEM_PROMPT).toContain(':::opciones_continuar');
    expect(TOBI_SYSTEM_PROMPT).toMatch(/ZERO-LEAK/i);
  });

  it('incorpora el protocolo corporativo bilingüe del Expat HR Desk (cuotas, IPS y multimoneda)', () => {
    expect(TOBI_SYSTEM_PROMPT).toContain('EXPAT HR DESK & PROTOCOLO CORPORATIVO GLOBAL BILINGÜE');
    expect(TOBI_SYSTEM_PROMPT).toContain('Art. 10 Código del Trabajo Ley 213/93');
    expect(TOBI_SYSTEM_PROMPT).toContain('90% del personal debe ser de nacionalidad paraguaya');
    expect(TOBI_SYSTEM_PROMPT).toContain('Afiliación Obligatoria al IPS para Extranjeros');
    expect(TOBI_SYSTEM_PROMPT).toContain('Contratos y Nómina en Moneda Extranjera (USD / EUR)');
    expect(TOBI_SYSTEM_PROMPT).toContain('Aguinaldo Legal Internacional (Art. 243 C.T.)');
  });

  it('blinda las reglas sobre reposo médico, ausencias y abandono de trabajo (Art. 81 incs. p y q)', () => {
    expect(TOBI_SYSTEM_PROMPT).toContain('REGLA TAXATIVA SOBRE REPOSO MÉDICO, AUSENCIAS Y ABANDONO DE TRABAJO');
    expect(TOBI_SYSTEM_PROMPT).toContain('Arts. 68 inc. a y 71 C.T.');
    expect(TOBI_SYSTEM_PROMPT).toContain('Art. 81 inc. p C.T.');
    expect(TOBI_SYSTEM_PROMPT).toContain('Art. 81 inc. q C.T.');
    expect(TOBI_SYSTEM_PROMPT).toContain('PROHIBICIÓN ESTRICTA DE LA MULETILLA "CONSULTÁ CON UN ABOGADO LABORALISTA"');
    expect(TOBI_SYSTEM_PROMPT).toMatch(/Telegrama Colacionado otorgando un plazo de 48 a 72 horas/i);
    expect(TOBI_SYSTEM_PROMPT).toMatch(/Faltar 1 o 2 días en un mes sin justificación NO CONFIGURA causal de despido justificado/i);
  });
});
