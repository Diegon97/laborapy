import { describe, it, expect } from 'vitest';
import { TOBI_SYSTEM_PROMPT } from '../tobiSystemPrompt';

describe('Tobi — reglas canónicas v1 inyectadas (16/09/2026)', () => {
  it('blinda el principio de primacía de la realidad frente a la emisión de facturas y aportes al IPS', () => {
    expect(TOBI_SYSTEM_PROMPT).toMatch(/la emisión de facturas no exime/i);
    expect(TOBI_SYSTEM_PROMPT).toMatch(/aportes retroactivos al IPS/i);
    expect(TOBI_SYSTEM_PROMPT).toMatch(/Primacía de la Realidad/i);
  });

  it('establece los topes absolutos de horas extraordinarias', () => {
    expect(TOBI_SYSTEM_PROMPT).toMatch(/3 horas diarias y 57 horas semanales/i);
  });

  it('regula la jornada a tiempo parcial proporcional al valor hora mínimo', () => {
    expect(TOBI_SYSTEM_PROMPT).toMatch(/jornada parcial/i);
    expect(TOBI_SYSTEM_PROMPT).toMatch(/proporcional a las horas trabajadas/i);
    expect(TOBI_SYSTEM_PROMPT).toMatch(/valor hora mínimo/i);
  });

  it('asimila los rubros indemnizatorios del retiro justificado al despido injustificado', () => {
    expect(TOBI_SYSTEM_PROMPT).toMatch(/mismos conceptos que el despido injustificado/i);
  });

  it('protege los derechos adquiridos en la liquidación por renuncia voluntaria', () => {
    expect(TOBI_SYSTEM_PROMPT).toMatch(/derechos adquiridos/i);
  });

  it('prohíbe emitir el bloque :::liquidacion_action en pedidos de documentos o notas', () => {
    expect(TOBI_SYSTEM_PROMPT).toMatch(/nunca emitas un bloque :::liquidacion_action/i);
  });

  it('exige la base de salario mensual bruto como referencia de cálculo', () => {
    expect(TOBI_SYSTEM_PROMPT).toMatch(/salario mensual bruto/i);
  });

  it('exige que el certificado de trabajo sea objetivo y sin juicios de valor', () => {
    expect(TOBI_SYSTEM_PROMPT).toMatch(/sin juicios de valor/i);
  });
});

describe('Tobi — regresión de reglas críticas existentes', () => {
  it('preserva el salario mínimo legal vigente y prohíbe el valor vencido', () => {
    expect(TOBI_SYSTEM_PROMPT).toContain('3.044.000');
    expect(TOBI_SYSTEM_PROMPT).toContain('2.798.309');
  });

  it('garantiza topes de jornada mixta y recargos nocturnos y extraordinarios', () => {
    expect(TOBI_SYSTEM_PROMPT).toContain('45 horas semanales');
    expect(TOBI_SYSTEM_PROMPT).toMatch(/NUNCA 25%/);
    expect(TOBI_SYSTEM_PROMPT).toMatch(/100% en horario nocturno o días feriados/);
  });

  it('mantiene plazos de caducidad, fuero maternal y estabilidad laboral especial', () => {
    expect(TOBI_SYSTEM_PROMPT).toMatch(/60 días corridos/);
    expect(TOBI_SYSTEM_PROMPT).toMatch(/Ley 5508\/15/);
    expect(TOBI_SYSTEM_PROMPT).toMatch(/Art\. 94/);
  });

  it('preserva el blindaje ZERO-LEAK, canales oficiales y protocolos de acción', () => {
    expect(TOBI_SYSTEM_PROMPT).toMatch(/ZERO-LEAK/);
    expect(TOBI_SYSTEM_PROMPT).toContain('984 469 005');
    expect(TOBI_SYSTEM_PROMPT).toContain('diegonunez1997@gmail.com');
    expect(TOBI_SYSTEM_PROMPT).toContain(':::documento_action');
    expect(TOBI_SYSTEM_PROMPT).toContain(':::liquidacion_action');
  });
});

describe('Tobi — identidad, creador y blindaje del motor (Regla N° 0)', () => {
  it('define a Diego Núñez como creador y fundador de LaboraPy', () => {
    expect(TOBI_SYSTEM_PROMPT).toMatch(/Tu creador es Diego Núñez/i);
    expect(TOBI_SYSTEM_PROMPT).toMatch(/fundador de LaboraPy/i);
    expect(TOBI_SYSTEM_PROMPT).toMatch(/REGLA INEXPUGNABLE N° 0 — IDENTIDAD, CREADOR Y CONFIDENCIALIDAD DEL MOTOR:/i);
  });

  it('instruye responder sobre Diego Núñez si se pregunta por el creador o quién es Diego', () => {
    expect(TOBI_SYSTEM_PROMPT).toMatch(/¿Quién es tu creador\?/);
    expect(TOBI_SYSTEM_PROMPT).toMatch(/¿Quién es Diego\?/);
    expect(TOBI_SYSTEM_PROMPT).toMatch(/respondé con orgullo, calidez y precisión/i);
    expect(TOBI_SYSTEM_PROMPT).toMatch(/creado y desarrollado por Diego Núñez \(LaboraPy\)/i);
  });

  it('prohíbe autodenominarse modelo de OpenAI, GPT-4, Claude o Gemini', () => {
    expect(TOBI_SYSTEM_PROMPT).toMatch(/CONFIDENCIALIDAD DEL MOTOR Y ZERO-LEAK DE PROVEEDORES/i);
    expect(TOBI_SYSTEM_PROMPT).toMatch(/OpenAI/);
    expect(TOBI_SYSTEM_PROMPT).toMatch(/GPT-4/);
    expect(TOBI_SYSTEM_PROMPT).toMatch(/Claude/);
    expect(TOBI_SYSTEM_PROMPT).toMatch(/Gemini/);
    expect(TOBI_SYSTEM_PROMPT).toMatch(/TERMINANTEMENTE PROHIBIDO responder, afirmar o sugerir/i);
  });

  it('no contiene "ESTILO CHATGPT" ni "Claude, ChatGPT" en sus directivas de estilo', () => {
    expect(TOBI_SYSTEM_PROMPT).not.toMatch(/ESTILO CHATGPT/i);
    expect(TOBI_SYSTEM_PROMPT).not.toMatch(/Claude, ChatGPT/i);
    expect(TOBI_SYSTEM_PROMPT).toMatch(/como un consultor ejecutivo de primer nivel/i);
  });
});

describe('Tobi — anonimización de jurisprudencia y whitelist normativa', () => {
  it('permite citar jurisprudencia por año/materia pero prohíbe datos sensibles y nombres de personas físicas', () => {
    expect(TOBI_SYSTEM_PROMPT).toMatch(/REGLA SOBRE JURISPRUDENCIA Y PRECEDENTES JUDICIALES DE LA CSJ/i);
    expect(TOBI_SYSTEM_PROMPT).toMatch(/datos sensibles/i);
    expect(TOBI_SYSTEM_PROMPT).toMatch(/nombres y apellidos de personas físicas/i);
    expect(TOBI_SYSTEM_PROMPT).toMatch(/Anonimizá siempre la identidad de los trabajadores particulares/i);
    expect(TOBI_SYSTEM_PROMPT).toMatch(/el trabajador demandante/i);
  });

  it('prohíbe explícitamente las normas apócrifas (Ley 527/96, Ley 5272/14, Decreto 3525/12)', () => {
    expect(TOBI_SYSTEM_PROMPT).toMatch(/WHITELIST NORMATIVA TAXATIVA/i);
    expect(TOBI_SYSTEM_PROMPT).toMatch(/Ley 527\/96/);
    expect(TOBI_SYSTEM_PROMPT).toMatch(/Ley 5272\/14/);
    expect(TOBI_SYSTEM_PROMPT).toMatch(/Decreto 3525\/12/);
    expect(TOBI_SYSTEM_PROMPT).toMatch(/citar normas inexistentes, derogadas o inventadas/i);
  });

  it('fija el Art. 399 exclusivamente en 60 días corridos y prohíbe citar 2 años para despido injustificado', () => {
    expect(TOBI_SYSTEM_PROMPT).toMatch(/Art\. 399 C\.T\.: Prescripción extintiva de 60 DÍAS CORRIDOS/i);
    expect(TOBI_SYSTEM_PROMPT).toMatch(/citar "2 años" para el reclamo por despido injustificado/i);
    expect(TOBI_SYSTEM_PROMPT).toMatch(/Art\. 31 NO fija el salario mínimo/i);
    expect(TOBI_SYSTEM_PROMPT).toMatch(/NO regula ningún supuesto "derecho a la desconexión digital"/i);
  });

  it('prohíbe etiquetas HTML crudas en formato Markdown', () => {
    expect(TOBI_SYSTEM_PROMPT).toMatch(/PROHIBICIÓN DE HTML CRUDO/i);
    expect(TOBI_SYSTEM_PROMPT).toMatch(/<br>/);
    expect(TOBI_SYSTEM_PROMPT).toMatch(/utilizá viñetas, guiones o texto corrido limpio/i);
  });
});
