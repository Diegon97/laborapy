import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateChatTitle,
  createChatSession,
  listChatSessions,
  getChatSession,
  deleteChatSession,
  prepareContextForInference,
  clearAllSessions,
  MAX_INFERENCE_HISTORY_TURNS,
} from '../sessionManager';
import type { AssistantMessage } from '../types';

describe('sessionManager — Historial de Chats y Poda de Contexto', () => {
  beforeEach(() => {
    clearAllSessions();
  });

  it('genera títulos limpios y concisos a partir del primer prompt del usuario', () => {
    expect(generateChatTitle('Hola tobi, quiero suspenderle a mi funcionario de logistica')).toBe(
      'Suspenderle a mi funcionario de log…',
    );
    expect(generateChatTitle('Buenas tardes, necesito calcular una liquidación')).toBe(
      'Calcular una liquidación',
    );
    expect(generateChatTitle('')).toBe('Nueva consulta');
  });

  it('crea, guarda, lista y elimina sesiones de chat correctamente', () => {
    const session = createChatSession('Quiero calcular mi aguinaldo');
    expect(session.id).toBeDefined();
    expect(session.title).toMatch(/aguinaldo/i);

    const list = listChatSessions();
    expect(list.length).toBe(1);
    expect(list[0].id).toBe(session.id);

    const found = getChatSession(session.id);
    expect(found?.id).toBe(session.id);

    deleteChatSession(session.id);
    expect(listChatSessions().length).toBe(0);
  });

  it('aplica ventana deslizante (Sliding Window) manteniendo solo los últimos turnos', () => {
    const messages: AssistantMessage[] = [];
    for (let i = 1; i <= 15; i++) {
      messages.push({
        id: `msg-${i}`,
        role: i % 2 === 1 ? 'user' : 'assistant',
        content: `Mensaje de prueba número ${i}`,
        createdAt: new Date().toISOString(),
      });
    }

    const turns = prepareContextForInference(messages);
    expect(turns.length).toBeLessThanOrEqual(MAX_INFERENCE_HISTORY_TURNS);
    // Debe contener los últimos mensajes de la serie
    expect(turns[turns.length - 1].content).toContain('15');
  });

  it('aplica Attachment Stripping en turnos históricos para no saturar el contexto', () => {
    const messages: AssistantMessage[] = [
      {
        id: 'msg-1',
        role: 'user',
        content: 'Revisá esta nota de despido',
        createdAt: new Date().toISOString(),
        attachment: {
          name: 'nota_despido.pdf',
          mimeType: 'application/pdf',
          data: 'data:application/pdf;base64,JVBERi0xLjQK...', // base64 gigante
        },
      },
      {
        id: 'msg-2',
        role: 'assistant',
        content: 'La nota fue analizada y viola el Art. 81.',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'msg-3',
        role: 'user',
        content: '¿Cuánto me corresponde cobrar?',
        createdAt: new Date().toISOString(),
      },
    ];

    const turns = prepareContextForInference(messages);
    expect(turns[0].content).toContain('[Documento adjunto analizado: nota_despido.pdf]');
    expect(turns[0].content).not.toContain('JVBERi0xLjQK');
  });

  it('inyecta el Scratchpad de variables confirmadas como memoria fáctica compacta', () => {
    const messages: AssistantMessage[] = [
      {
        id: 'msg-1',
        role: 'user',
        content: '¿Cuál es el siguiente paso?',
        createdAt: new Date().toISOString(),
      },
    ];

    const scratchpad = {
      colaborador: 'Juan Pérez',
      salario: 4500000,
      causal: 'despido_sin_causa',
    };

    const turns = prepareContextForInference(messages, scratchpad);
    expect(turns[0].content).toContain('[Ficha del caso confirmada:');
    expect(turns[0].content).toContain('Juan Pérez');
    expect(turns[0].content).toContain('4500000');
  });
});
