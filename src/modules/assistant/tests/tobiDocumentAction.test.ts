import { describe, it, expect } from 'vitest';
import {
  extractDocumentAction,
  toNotaLaboralOptions,
  isDocumentIntent,
  detectDocumentTypeFromText,
  extractDocContextFromHistory,
} from '../tobiDocumentAction';
import type { AssistantMessage } from '../types';

describe('tobiDocumentAction — extracción de bloque y normalización', () => {
  it('extrae el bloque :::documento_action de amonestación y limpia el texto visible', () => {
    const input = `Estimado usuario, aquí tiene el borrador de la amonestación.
:::documento_action
{
  "tipo": "amonestacion",
  "nombreEmpleado": "Martín Gómez",
  "ciEmpleado": "4.567.890",
  "cargoEmpleado": "Operario",
  "empresa": "Industrial del Sur S.A.",
  "hechosOcurridos": "Inasistencia injustificada el día 15/09/2026",
  "fundamentoLegal": "Art. 81 inc. a) Código del Trabajo"
}
:::
Quedo a las órdenes si precisa ajustar algún detalle.`;

    const { cleanedText, payload } = extractDocumentAction(input);

    expect(payload).not.toBeNull();
    expect(payload?.tipo).toBe('amonestacion');
    expect(payload?.nombreEmpleado).toBe('Martín Gómez');
    expect(payload?.ciEmpleado).toBe('4.567.890');
    expect(cleanedText).not.toContain(':::documento_action');
    expect(cleanedText).toContain('Estimado usuario');
    expect(cleanedText).toContain('Quedo a las órdenes');
  });

  it('retorna payload null y texto intacto cuando no hay bloque', () => {
    const text = 'Consulta jurídica sobre jornada nocturna.';
    const { cleanedText, payload } = extractDocumentAction(text);

    expect(payload).toBeNull();
    expect(cleanedText).toBe(text);
  });

  it('retorna payload null y limpia el bloque si el JSON es inválido', () => {
    const input = `Texto previo
:::documento_action
{ mal_formado: true,
:::
Texto posterior`;

    const { cleanedText, payload } = extractDocumentAction(input);

    expect(payload).toBeNull();
    expect(cleanedText).not.toContain(':::documento_action');
    expect(cleanedText).toContain('Texto previo');
    expect(cleanedText).toContain('Texto posterior');
  });

  it('normaliza a NotaLaboralOptions con empresa de fallback y fecha válida', () => {
    const payload = {
      tipo: 'suspension_disciplinaria' as const,
      nombreEmpleado: 'Laura Benítez',
      ciEmpleado: '3.123.456',
      diasSuspension: 3,
      hechosOcurridos: 'Falta disciplinaria en depósito',
    };

    const options = toNotaLaboralOptions(payload, 'Mi Empresa S.A.');

    expect(options.tipo).toBe('suspension_disciplinaria');
    expect(options.empresa).toBe('Mi Empresa S.A.');
    expect(options.nombreEmpleado).toBe('Laura Benítez');
    expect(options.ciEmpleado).toBe('3.123.456');
    expect(options.diasSuspension).toBe(3);
    expect(options.lugarFecha).toContain('Asunción');
  });

  it('asigna por defecto fundamento legal adecuado para suspension disciplinaria cuando se omite', () => {
    const payload = {
      tipo: 'suspension_disciplinaria' as const,
      nombreEmpleado: 'Juan Pérez',
      ciEmpleado: '4.567.890',
    };

    const options = toNotaLaboralOptions(payload);

    expect(options.tipo).toBe('suspension_disciplinaria');
    expect(options.diasSuspension).toBeUndefined();
    expect(options.fundamentoLegal).toContain('353 inc. a');
    expect(options.fundamentoLegal).toContain('352 inc. i');
    expect(options.fundamentoLegal).toContain('354');
  });

  it('detecta correctamente intención directa de documentación (isDocumentIntent)', () => {
    expect(isDocumentIntent('Quiero redactar la nota de suspensión con los datos del caso')).toBe(true);
    expect(isDocumentIntent('Quiero completar los datos exactos del caso')).toBe(true);
    expect(isDocumentIntent('Te paso ahora todos los datos del caso')).toBe(true);
    expect(isDocumentIntent('📝 Cargar datos en casillas y generar nota')).toBe(true);
    expect(isDocumentIntent('generar nota de amonestación')).toBe(true);
    expect(isDocumentIntent('¿Cuál es el salario mínimo legal en Paraguay?')).toBe(false);
  });

  it('detecta tipo de documento desde el texto (detectDocumentTypeFromText)', () => {
    expect(detectDocumentTypeFromText('suspender por mala actitud')).toBe('suspension_disciplinaria');
    expect(detectDocumentTypeFromText('hacer amonestación escrita')).toBe('amonestacion');
    expect(detectDocumentTypeFromText('notificar traslado a otra sucursal')).toBe('traslado');
    expect(detectDocumentTypeFromText('certificado laboral para presentar en banco')).toBe('certificado_trabajo');
    expect(detectDocumentTypeFromText('despido justificado por robo')).toBe('despido_justificado');
    expect(detectDocumentTypeFromText('despido sin causa')).toBe('despido_injustificado');
  });

  it('extrae contexto histórico con 2 días de suspensión y limita maxDiasPermitidos a 2 (caso real del usuario)', () => {
    const messages: AssistantMessage[] = [
      {
        id: '1',
        role: 'user',
        content: 'quiero suspender a mi funcionario 2 dias por mala actitud, ya le amoneste anteriormente',
        createdAt: '2026-09-17T20:36:25.777Z',
      },
      {
        id: '2',
        role: 'assistant',
        content: '# Suspensión de 2 días por mala actitud\nSí es viable suspender 2 días...',
        createdAt: '2026-09-17T20:36:35.408Z',
        documentData: {
          tipo: 'suspension_disciplinaria',
          nombreEmpleado: '[Completar nombre]',
          ciEmpleado: '[Completar C.I.]',
          empresa: '[Completar empresa]',
          cargoEmpleado: '[Completar cargo]',
          hechosOcurridos: 'Conducta inapropiada reiterada, ya objeto de amonestación escrita previa, sin corrección de conducta',
          fundamentoLegal: 'Arts. 352 inc. i) y 353 inc. a) del Código del Trabajo (Ley 213/93)',
          diasSuspension: 2,
        },
      },
      {
        id: '3',
        role: 'user',
        content: 'Quiero redactar la nota de suspensión con los datos del caso',
        createdAt: '2026-09-17T20:37:03.989Z',
      },
    ];

    const { tipo, data } = extractDocContextFromHistory(messages, 'Quiero completar los datos exactos del caso');

    expect(tipo).toBe('suspension_disciplinaria');
    expect(data.diasSuspension).toBe(2);
    // CRÍTICO: El caso inicial fue de 2 días, NO se le debe dejar generar 8 días a elección
    expect(data.maxDiasPermitidos).toBe(2);
    expect(data.tieneAntecedentes).toBe(true);
    expect(data.nombreEmpleado).toBe(''); // Limpia placeholders como [Completar nombre]
    expect(data.ciEmpleado).toBe('');
    expect(data.empresa).toBe('');
    expect(data.cargoEmpleado).toBe('');
    expect(data.hechosOcurridos).toContain('Conducta inapropiada');
    expect(data.motivoBloqueoDias).toContain('2 días');
  });
});
