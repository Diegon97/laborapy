/**
 * TYPESAFE NATIVE CLIENT (JEV-1.13 / JEV-LATEST)
 * Implementación oficial basada en typesafe-sdk-js.
 */

export class TypeSafeClient {
  constructor(config = {}) {
    this.apiKey = config.apiKey || process.env.TYPESAFE_API_KEY;
    this.baseUrl = config.baseUrl || 'https://api.typesafe.ai/v1/systemone';
    this.model = config.model || 'jev-latest';
  }

  async systemOne({ state, questions }) {
    if (!this.apiKey) {
      throw new Error('TypeSafe API Key no configurada.');
    }

    const res = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        state,
        model: this.model,
        questions,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`TypeSafe API error ${res.status}: ${errText}`);
    }

    return await res.json();
  }
}
