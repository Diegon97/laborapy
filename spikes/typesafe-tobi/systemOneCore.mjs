/**
 * TYPESAFE SYSTEM ONE CORE — DEFINICIÓN DE PRIMITIVAS Y UTILIDADES
 * Inspirado en typesafe-sdk-js y system-one-adapter-python.
 */

export function choice(instructions, criteria) {
  return {
    type: 'choice',
    instructions,
    criteria,
  };
}

export function score(instructions, criteria) {
  return {
    type: 'score',
    instructions,
    criteria,
  };
}

export function noul(instructions, criteria = null) {
  return {
    type: 'noul',
    instructions,
    criteria,
  };
}

/**
 * Normaliza probabilidades para que sumen exactamente 1.0
 */
export function normalizeProbabilities(rawProbs) {
  const keys = Object.keys(rawProbs);
  if (keys.length === 0) return {};
  
  const sum = keys.reduce((acc, k) => acc + (Number(rawProbs[k]) || 0), 0);
  if (sum <= 0) {
    const uniform = 1 / keys.length;
    const res = {};
    keys.forEach(k => res[k] = uniform);
    return res;
  }

  const normalized = {};
  keys.forEach(k => {
    normalized[k] = Number(((Number(rawProbs[k]) || 0) / sum).toFixed(4));
  });
  return normalized;
}

/**
 * Calcula el nivel de confianza a partir de la concentración de probabilidad
 */
export function calculateConfidence(probabilities) {
  const vals = Object.values(probabilities).map(Number);
  if (vals.length <= 1) return 1.0;
  
  const sorted = vals.sort((a, b) => b - a);
  const top = sorted[0];
  const second = sorted[1] || 0;
  
  // Confianza alta si hay una diferencia clara entre el primero y el segundo
  return Math.min(1.0, Math.max(0.0, Number((top - second * 0.5).toFixed(2))));
}
