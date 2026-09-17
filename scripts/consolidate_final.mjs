#!/usr/bin/env node
/**
 * CONSOLIDACIÓN FINAL — Fase 2 interrumpida por reinicio (16/09 05:11)
 * Fusiona: dataset Fase 1 (40) + entradas mejoradas Fase 2 (4) → dataset final,
 * notas de investigación y reporte Markdown. Reproduce la lógica de consolidate()
 * del motor (prioridad: verified Fase 2 > Fase 1 > unverified Fase 2), operando
 * sobre artefactos en disco. Idempotente: puede re-ejecutarse sin daño.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TEST_CASES } from './lib/tobi_night_core.mjs';
import { buildNotesDoc, buildMarkdownReport } from './lib/deep_research_reports.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return null; } };
const writeJson = (p, d) => fs.writeFileSync(p, JSON.stringify(d, null, 2), 'utf-8');
const writeText = (p, t) => fs.writeFileSync(p, t, 'utf-8');

const F = {
  gold50: path.join(ROOT, 'datasets', 'tobi_gold_dataset_50.json'),
  deep: path.join(ROOT, 'datasets', 'tobi_deep_improved.json'),
  finalJsonl: path.join(ROOT, 'datasets', 'tobi_gold_dataset_final.jsonl'),
  finalJson: path.join(ROOT, 'datasets', 'tobi_gold_dataset_final.json'),
  notes: path.join(ROOT, 'reports', 'TOBI_DEEP_RESEARCH_NOTES.json'),
  report: path.join(ROOT, 'reports', 'TOBI_DEEP_RESEARCH_REPORT.md'),
  p1: path.join(ROOT, 'scripts', 'night_calibration_progress.json'),
  p2: path.join(ROOT, 'scripts', 'deep_improvement_progress.json'),
};

const gold50 = readJson(F.gold50) || [];
const deep = readJson(F.deep) || [];
const p1 = readJson(F.p1) || {};
const p2 = readJson(F.p2) || {};

const phase1Entries = gold50.map((g) => ({
  id: g.id, category: g.category, title: g.title, prompt: g.prompt, response: g.response, origin: 'phase1',
}));

const enhancedEntries = deep.map((e) => ({
  id: e.id, category: e.category, title: e.title, prompt: e.prompt, response: e.improved_response,
  origin: 'phase2', verified: !!e.verified, scores: e.retest?.scores ?? null,
  key_rules: e.key_rules || [], citations: e.citations || [],
}));

const byId = new Map();
for (const e of enhancedEntries) if (e.verified) byId.set(e.id, e);
for (const e of phase1Entries) if (!byId.has(e.id)) byId.set(e.id, e);
for (const e of enhancedEntries) if (!e.verified && !byId.has(e.id)) byId.set(e.id, e);
const finalEntries = TEST_CASES.map((c) => byId.get(c.id)).filter(Boolean);

const jsonl = finalEntries.map((e) => JSON.stringify(e)).join('\n');
writeText(F.finalJsonl, jsonl ? jsonl + '\n' : '');
writeJson(F.finalJson, finalEntries);

const results = Array.isArray(p1.results) ? p1.results : [];
const weakTotal = results.filter((r) => !r.passed || (r.total ?? 0) < 90).length;
const nearTotal = results.filter((r) => r.passed && (r.total ?? 0) >= 90 && (r.total ?? 0) < 100).length;
const verifiedCount = deep.filter((e) => e.verified).length;
const unverifiedCount = deep.length - verifiedCount;

const totals = {
  weakTotal,
  nearTotal,
  processed: p2.processed ?? deep.length,
  verified: verifiedCount,
  unverified: unverifiedCount,
  requeued: p2.requeued ?? 0,
  auditRounds: p2.audits?.count ?? 0,
};

writeJson(F.notes, buildNotesDoc({
  startedAt: p2.startedAt || p1.startedAt,
  model: 'qwen2.5:7b',
  phase1Source: 'tobi_stress_test_report.json',
  totals,
  enhancedEntries: deep,
  audits: p2.audits || { count: 0, entries: [] },
  artifacts: {
    finalJsonl: 'datasets/tobi_gold_dataset_final.jsonl',
    finalJson: 'datasets/tobi_gold_dataset_final.json',
    notes: 'reports/TOBI_DEEP_RESEARCH_NOTES.json',
    report: 'reports/TOBI_DEEP_RESEARCH_REPORT.md',
  },
}));

writeText(F.report, buildMarkdownReport({
  startedAt: p2.startedAt || p1.startedAt,
  deadlineAt: '2026-09-16T08:00:00-03:00 (interrumpido por reinicio de la PC a las 05:11)',
  model: 'qwen2.5:7b',
  phase1Source: 'tobi_stress_test_report.json',
  totals,
  enhancedEntries: deep,
  phase1Entries,
  audits: p2.audits || { count: 0, entries: [] },
}));

p2.status = 'interrupted';
p2.verifiedImproved = verifiedCount;
p2.unverified = unverifiedCount;
p2.interruptionNote = 'Reinicio de la PC a las 05:11:49 detuvo la corrida (16 estudios quedaron sin parsear y 18 casos re-encolados). Dataset final consolidado desde artefactos en disco.';
p2.updatedAt = new Date().toISOString();
writeJson(F.p2, p2);

console.log(`OK — dataset final: ${finalEntries.length} casos (Fase 1: ${phase1Entries.length} · Fase 2: ${enhancedEntries.length}; verified ${verifiedCount} / unverified ${unverifiedCount})`);
console.log(`   ${F.finalJsonl}`);
console.log(`   ${F.notes}`);
console.log(`   ${F.report}`);
