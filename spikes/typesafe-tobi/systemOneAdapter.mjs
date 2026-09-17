/**
 * SYSTEM ONE ADAPTER (PORT DE SYSTEM-ONE-ADAPTER-PYTHON A NODE/JS)
 * Emula la API de TypeSafe System One sobre cualquier proveedor compatible con OpenAI.
 * Por defecto conecta a Capataz local (http://127.0.0.1:8317) con costo $0 en cuota Antigravity.
 */

import { normalizeProbabilities, calculateConfidence } from './systemOneCore.mjs';

export class SystemOneAdapterClient {
  constructor(config = {}) {
    this.baseUrl = config.baseUrl || 'http://127.0.0.1:8317/v1/chat/completions';
    this.apiKey = config.apiKey || 'cpa-local-2f1e299d67fe4fbbaa862ef78d418f08047245b8';
    this.model = config.model || 'gemini-3.8-flash-high';
    this.providerName = config.providerName || 'capataz';
  }

  async systemOne({ state, questions }) {
    const prompt = this.buildPrompt(state, questions);

    const res = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'Sos el motor de evaluación determinística y probabilística System One de LaboraPy. Respondé ÚNICAMENTE un JSON válido con la estructura solicitada, sin introducciones ni markdown extra.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.1,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`System One Adapter API error ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const rawContent = data.choices[0].message.content;
    const parsed = this.cleanAndParseJson(rawContent);

    return this.formatResponse(parsed, questions);
  }

  buildPrompt(state, questions) {
    const formattedQuestions = {};
    for (const [id, q] of Object.entries(questions)) {
      if (q.type === 'noul') {
        formattedQuestions[id] = {
          type: 'noul',
          instructions: q.instructions,
          output_required: {
            noul: 'float between 0.0 and 1.0 representing probability of YES'
          },
        };
      } else if (q.type === 'choice') {
        formattedQuestions[id] = {
          type: 'choice',
          instructions: q.instructions,
          candidates: q.criteria,
          output_required: {
            choice: 'selected option string',
            probabilities: 'object mapping each candidate key to probability float (summing to 1.0)',
          },
        };
      } else if (q.type === 'score') {
        formattedQuestions[id] = {
          type: 'score',
          instructions: q.instructions,
          levels: q.criteria,
          output_required: {
            score: 'float position across levels',
            probabilities: 'object mapping level index to probability',
          },
        };
      }
    }

    return `
EVALUÁ ESTE ESTADO:
"""
${typeof state === 'string' ? state : JSON.stringify(state, null, 2)}
"""

PREGUNTAS TIPADAS A RESOLVER:
${JSON.stringify(formattedQuestions, null, 2)}

Devolvé un JSON con esta estructura exacta para "answers":
{
  "answers": {
    "<question_id>": {
      "type": "choice | noul | score",
      ... campos correspondientes
    }
  }
}
`;
  }

  cleanAndParseJson(text) {
    const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      // Intento de rescate si hay texto circundante
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
      throw new Error(`No se pudo parsear el JSON de System One Adapter: ${cleaned.slice(0, 100)}...`);
    }
  }

  formatResponse(rawJson, originalQuestions) {
    const answers = {};
    const rawAnswers = rawJson.answers || rawJson;

    for (const [id, q] of Object.entries(originalQuestions)) {
      const rawA = rawAnswers[id];
      if (!rawA) continue;

      if (q.type === 'noul') {
        const rawVal = typeof rawA === 'number' ? rawA : (rawA.noul ?? rawA.value ?? rawA.probability ?? 0.5);
        const val = typeof rawVal === 'number' ? rawVal : Number(rawVal) || 0.5;
        answers[id] = {
          type: 'noul',
          noul: Math.min(1.0, Math.max(0.0, Number(val.toFixed(2)))),
        };
      } else if (q.type === 'choice') {
        const choiceVal = rawA.choice || Object.keys(q.criteria)[0];
        const probs = normalizeProbabilities(rawA.probabilities || { [choiceVal]: 1.0 });
        answers[id] = {
          type: 'choice',
          choice: choiceVal,
          confidence: calculateConfidence(probs),
          probabilities: probs,
        };
      } else if (q.type === 'score') {
        const scoreVal = typeof rawA.score === 'number' ? rawA.score : 0;
        const probs = normalizeProbabilities(rawA.probabilities || {});
        answers[id] = {
          type: 'score',
          score: scoreVal,
          confidence: calculateConfidence(probs),
          probabilities: probs,
        };
      }
    }

    return {
      model: `${this.providerName}/${this.model}`,
      adapter: true,
      answers,
    };
  }
}
