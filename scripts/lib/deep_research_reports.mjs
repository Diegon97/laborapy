// Generación pura de reportes de Fase 2 (sin estado, red ni fs): reglas candidatas, notas JSON y reporte Markdown.
const ARTIFACTS = [
  'datasets/tobi_deep_improved.jsonl',
  'datasets/tobi_deep_improved.json',
  'datasets/tobi_gold_dataset_final.jsonl',
  'datasets/tobi_gold_dataset_final.json',
  'reports/TOBI_DEEP_RESEARCH_NOTES.json',
  'reports/TOBI_DEEP_RESEARCH_REPORT.md',
  'scripts/deep_improvement_progress.json',
];

// Agrupa reglas idénticas (trim) y devuelve {rule, count, cases} ordenado por frecuencia desc y regla ascendente.
export function buildCandidateRules(enhancedEntries) {
  const entries = Array.isArray(enhancedEntries) ? enhancedEntries : [];
  const index = new Map();
  for (const entry of entries) {
    const id = entry?.id ?? '—';
    const rules = Array.isArray(entry?.key_rules) ? entry.key_rules : [];
    for (const raw of rules) {
      const rule = typeof raw === 'string' ? raw.trim() : '';
      if (!rule) continue;
      if (!index.has(rule)) index.set(rule, { rule, count: 0, cases: [] });
      const bucket = index.get(rule);
      if (!bucket.cases.includes(id)) bucket.cases.push(id);
    }
  }
  for (const bucket of index.values()) {
    bucket.count = bucket.cases.length;
  }
  return [...index.values()].sort((a, b) => (b.count - a.count) || a.rule.localeCompare(b.rule, 'es'));
}

// Construye el documento JSON de notas (notes + reglas candidatas + auditorías + artefactos).
export function buildNotesDoc({ startedAt, model, phase1Source, totals, enhancedEntries, audits, artifacts } = {}) {
  const entries = Array.isArray(enhancedEntries) ? enhancedEntries : [];
  const t = totals || {};
  return {
    generatedAt: new Date().toISOString(),
    startedAt: startedAt ?? null,
    model: model ?? null,
    phase1Source: phase1Source ?? null,
    totals: {
      weakTotal: t.weakTotal ?? 0,
      nearTotal: t.nearTotal ?? 0,
      processed: t.processed ?? 0,
      verified: t.verified ?? 0,
      unverified: t.unverified ?? 0,
      requeued: t.requeued ?? 0,
      auditRounds: t.auditRounds ?? 0,
    },
    cases: entries.map((e) => ({
      id: e?.id ?? '—',
      category: e?.category ?? '—',
      title: e?.title ?? '—',
      studyCycle: e?.studyCycle ?? 0,
      verified: Boolean(e?.verified),
      before: e?.before ?? null,
      retest: e?.retest
        ? { scores: e.retest.scores ?? null, passed: Boolean(e.retest.passed), failures: e.retest.failures ?? [] }
        : null,
      key_rules: Array.isArray(e?.key_rules) ? e.key_rules : [],
      citations: Array.isArray(e?.citations) ? e.citations : [],
      sources: Array.isArray(e?.sources) ? e.sources : [],
      generatedAt: e?.generatedAt ?? null,
    })),
    candidateRules: buildCandidateRules(entries),
    audits: audits?.entries || [],
    artifacts: artifacts || {},
  };
}

// Construye el informe Markdown completo (6 secciones) de la investigación profunda Fase 2.
export function buildMarkdownReport({ startedAt, deadlineAt, model, phase1Source, totals, enhancedEntries, phase1Entries, audits } = {}) {
  const entries = Array.isArray(enhancedEntries) ? enhancedEntries : [];
  const phase1 = Array.isArray(phase1Entries) ? phase1Entries : [];
  const t = totals || {};
  const auditEntries = audits?.entries || [];
  const dash = (value) => (value === undefined || value === null || value === '' ? '—' : value);
  const list = (value) => (Array.isArray(value) && value.length > 0 ? value.map((item) => String(item)).join('; ') : '—');
  const afterScore = (entry) => {
    const value = entry?.retest?.scores?.total;
    return typeof value === 'number' && Number.isFinite(value) ? value : -1;
  };

  const lines = [];
  lines.push('# INFORME DE INVESTIGACIÓN PROFUNDA — TOBI × QWEN 2.5 (FASE 2)');
  lines.push('');
  lines.push(`- **Generado:** ${new Date().toISOString()}`);
  lines.push(`- **Inicio:** ${dash(startedAt)}`);
  lines.push(`- **Deadline:** ${dash(deadlineAt)}`);
  lines.push(`- **Modelo:** ${dash(model)}`);
  lines.push(`- **Fuente Fase 1:** ${dash(phase1Source)}`);
  lines.push('');

  lines.push('## 1. Resumen ejecutivo');
  lines.push('');
  lines.push('| Métrica | Valor |');
  lines.push('| --- | --- |');
  lines.push(`| Casos débiles | ${dash(t.weakTotal)} |`);
  lines.push(`| Near-perfect | ${dash(t.nearTotal)} |`);
  lines.push(`| Procesados | ${dash(t.processed)} |`);
  lines.push(`| Verificados | ${dash(t.verified)} |`);
  lines.push(`| No verificados | ${dash(t.unverified)} |`);
  lines.push(`| Re-encolados | ${dash(t.requeued)} |`);
  lines.push(`| Auditorías | ${dash(t.auditRounds)} |`);
  lines.push('');
  lines.push(`Dataset final: ${phase1.length} entradas Fase 1 + ${entries.length} mejoradas Fase 2`);
  lines.push('');

  lines.push('## 2. Casos mejorados');
  lines.push('');
  lines.push('| ID | Tema | Antes | Después | Estado | Ciclos |');
  lines.push('| --- | --- | --- | --- | --- | --- |');
  const ranked = [...entries].sort((a, b) => (Number(Boolean(b?.verified)) - Number(Boolean(a?.verified))) || (afterScore(b) - afterScore(a)));
  for (const e of ranked) {
    lines.push(`| ${dash(e?.id)} | ${dash(e?.title)} | ${e?.before?.scores?.total ?? '-'} | ${e?.retest?.scores?.total ?? '-'} | ${e?.verified ? 'VERIFICADO' : 'PENDIENTE'} | ${dash(e?.studyCycle)} |`);
  }
  lines.push('');

  lines.push('## 3. Detalle por caso');
  lines.push('');
  if (entries.length === 0) {
    lines.push('Sin casos mejorados.');
  } else {
    for (const e of entries) {
      lines.push(`### ${dash(e?.id)} — ${dash(e?.title)} (${dash(e?.category)})`);
      lines.push('');
      lines.push(`- **Puntaje antes:** ${e?.before?.scores?.total ?? '—'}/100 — fallas: ${list(e?.before?.failures)}`);
      lines.push(`- **Puntaje después:** ${e?.retest?.scores?.total ?? '—'}/100 — fallas: ${list(e?.retest?.failures)}`);
      lines.push(`- **Fuentes del corpus usadas:** ${list(e?.sources)}`);
      lines.push(`- **Reglas aprendidas:** ${list(e?.key_rules)}`);
      lines.push(`- **Citas:** ${list(e?.citations)}`);
      lines.push('');
    }
  }

  lines.push('## 4. Reglas candidatas para el prompt canónico');
  lines.push('');
  const candidates = buildCandidateRules(entries);
  if (candidates.length === 0) {
    lines.push('Sin reglas candidatas.');
  } else {
    candidates.forEach((candidate, index) => {
      lines.push(`${index + 1}. "${candidate.rule}" (${candidate.count} casos: ${candidate.cases.join(', ')})`);
    });
  }
  lines.push('');

  lines.push('## 5. Auditorías de estabilidad');
  lines.push('');
  if (auditEntries.length > 0) {
    lines.push('| ID | Puntaje | Estado | Fecha |');
    lines.push('| --- | --- | --- | --- |');
    for (const entry of auditEntries) {
      lines.push(`| ${dash(entry?.id)} | ${entry?.scores?.total ?? '—'} | ${entry?.passed ? 'APROBADO' : 'REPROBADO'} | ${dash(entry?.at)} |`);
    }
  } else {
    lines.push('No se ejecutaron auditorías.');
  }
  lines.push('');

  lines.push('## 6. Artefactos');
  lines.push('');
  for (const artifact of ARTIFACTS) {
    lines.push(`- \`${artifact}\``);
  }
  lines.push('');

  return lines.join('\n');
}