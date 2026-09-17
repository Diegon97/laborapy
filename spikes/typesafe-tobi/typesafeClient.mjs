/**
 * CLIENTE NATIVO TYPESAFE AI (SYSTEM ONE) — SPIKE LABORAPY
 * Principio Ponytail: Cero dependencias npm externas, usa fetch estándar de Node 24.
 * Modelo: jev-latest
 */

const TYPESAFE_API_URL = 'https://api.typesafe.ai/v1/systemone';

export async function askTypeSafe({ state, questions }) {
  const apiKey = process.env.TYPESAFE_API_KEY;
  if (!apiKey) {
    throw new Error('TYPESAFE_API_KEY no encontrada en variables de entorno.');
  }

  const response = await fetch(TYPESAFE_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      state,
      model: 'jev-latest',
      questions,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`TypeSafe API error HTTP ${response.status}: ${errorBody}`);
  }

  return await response.json();
}
