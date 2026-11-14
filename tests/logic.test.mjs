import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../js/logic.js';
import { exById, MUSCLES } from '../js/data.js';

const gym = ['barbell', 'dumbbell', 'bench', 'cable', 'machine', 'pullupbar'];
const prof = (o = {}) => ({ goal: 'hyp', exp: 'int', weekdays: [0, 2, 4, 5], dur: 60, equipment: gym, limits: [], prio: [], volAdj: 0, ...o });
const NOW = new Date(2026, 10, 11); // Mittwoch, 11.11.2026

test('Split richtet sich nach der Anzahl Trainingstage', () => {
  assert.deepEqual(L.generatePlan(prof({ weekdays: [0, 3] }), null, NOW).days.map(d => d.key), ['FA', 'FB']);
  assert.deepEqual(L.generatePlan(prof({ weekdays: [0, 2, 4] }), null, NOW).days.map(d => d.key), ['FA', 'FB', 'FC']);
  assert.deepEqual(L.generatePlan(prof(), null, NOW).days.map(d => d.key), ['UA', 'LA', 'UB', 'LB']);
  assert.equal(L.generatePlan(prof({ weekdays: [0, 1, 2, 3, 4, 5] }), null, NOW).days.length, 6);
});

test('Volumen steigt über die Aufbauwochen, Deload halbiert', () => {
  const p = L.generatePlan(prof(), null, NOW);
  for (const d of p.days) for (const e of d.ex) {
    for (let w = 1; w < 4; w++) assert.ok(e.sets[w] >= e.sets[w - 1], `${e.id} W${w + 1}`);
    assert.ok(e.sets[4] <= Math.ceil(e.sets[0] / 2) + 0.5);
  }
  const chest = w => p.days.flatMap(d => d.ex).filter(e => exById(e.id).m === 'chest').reduce((s, e) => s + e.sets[w], 0);
  assert.ok(chest(3) > chest(0), 'Brust-Sätze W4 > W1');
});

test('Session-Obergrenze: ~20 Sätze pro Stunde', () => {
  const p = L.generatePlan(prof({ weekdays: [0, 3], dur: 45 }), null, NOW);
  for (const d of p.days) for (let w = 0; w < 4; w++) {
    const tot = d.ex.reduce((s, e) => s + e.sets[w], 0);
    assert.ok(tot <= 15 + d.ex.length / 2, `${d.name} W${w + 1}: ${tot}`);
  }
});

test('Ausrüstung und Beschwerden filtern Übungen', () => {
  const home = L.generatePlan(prof({ equipment: ['dumbbell', 'bench'] }), null, NOW);
  for (const e of home.days.flatMap(d => d.ex)) assert.ok(exById(e.id).eq.every(q => ['dumbbell', 'bench'].includes(q)), e.id);
  const sh = L.generatePlan(prof({ limits: ['shoulder', 'knee', 'back'] }), null, NOW);
  for (const e of sh.days.flatMap(d => d.ex)) assert.ok(!(exById(e.id).av || []).some(a => ['shoulder', 'knee', 'back'].includes(a)), e.id);
  const bw = L.generatePlan(prof({ equipment: [] }), null, NOW);
  assert.ok(bw.days.every(d => d.ex.length >= 3), 'Körpergewicht-Plan hat Übungen');
});

test('Keine doppelte Übung innerhalb eines Trainingstags', () => {
  for (const n of [2, 3, 4, 5, 6]) {
    const p = L.generatePlan(prof({ weekdays: [0, 1, 2, 3, 4, 5].slice(0, n) }), null, NOW);
    for (const d of p.days) assert.equal(new Set(d.ex.map(e => e.id)).size, d.ex.length, d.name);
  }
});

test('Schwerpunkt erhöht das Wochenziel um 4 Sätze', () => {
  const T = L.weeklyTargets(prof({ prio: ['shoulders'] }));
  assert.equal(T.shoulders, T.chest + 4);
  assert.equal(L.weeklyTargets(prof({ exp: 'beg' })).chest, 10);
  assert.equal(L.weeklyTargets(prof({ goal: 'fat' })).chest, 11);
});

function state() {
  const p = prof();
  const plan = L.generatePlan(p, null, NOW);
  return { profile: p, plan, prog: {}, body: [], sessions: [] };
}
const entry = (id, rr, sets) => ({ id, rr, sets: sets.map(([w, r, rir]) => ({ w, r, rir, done: true })) });

test('Doppelprogression: obere Grenze → Gewicht hoch', () => {
  const S = state();
  const r = L.progressExercise(S, entry('bench', [6, 10], [[80, 10, 2], [80, 10, 2], [80, 10, 1]]), 2, false);
  assert.equal(r.kind, 'up'); assert.equal(r.w, 82.5); assert.equal(r.reps, 6);
});

test('Doppelprogression: RIR weit über Ziel → doppelter Schritt', () => {
  const S = state();
  const r = L.progressExercise(S, entry('bb_squat', [6, 10], [[100, 10, 4], [100, 10, 4]]), 2, false);
  assert.equal(r.w, 110);
});

test('Im Bereich → Gewicht halten, +1 Wiederholung', () => {
  const S = state();
  const r = L.progressExercise(S, entry('bench', [6, 10], [[80, 8, 2], [80, 7, 1]]), 2, false);
  assert.equal(r.kind, 'hold'); assert.equal(r.w, 80); assert.equal(r.reps, 8);
});

test('Zweimal unter dem Bereich → Reset −10 %', () => {
  const S = state();
  const e = entry('bench', [6, 10], [[80, 4, 0]]);
  const r1 = L.progressExercise(S, e, 2, false);
  assert.equal(r1.kind, 'warn'); S.prog.bench = r1;
  const r2 = L.progressExercise(S, e, 3, false);
  assert.equal(r2.kind, 'down'); assert.equal(r2.w, 72.5);
});

test('Leichter Tag zählt nicht als Fehlversuch, Deload steigert nicht', () => {
  const S = state(); S.prog.bench = { w: 80, reps: 6, fails: 1 };
  assert.equal(L.progressExercise(S, entry('bench', [6, 10], [[80, 4, 0]]), 2, true).fails, 1);
  assert.equal(L.progressExercise(S, entry('bench', [6, 10], [[80, 10, 3]]), 5, false).w, undefined);
});

test('Tagesziel: Deload senkt Gewicht, leichter Tag streicht einen Satz', () => {
  const S = state(); const e = S.plan.days[0].ex[0]; S.prog[e.id] = { w: 100, reps: 8 };
  const t1 = L.targetFor(S, e, 3, false), tl = L.targetFor(S, e, 3, true), td = L.targetFor(S, e, 5, false);
  assert.equal(tl.sets, Math.max(1, t1.sets - 1)); assert.equal(tl.rir, t1.rir + 1);
  assert.ok(td.w < 100); assert.equal(td.rir, 4);
});

test('Mesozyklus-Woche aus dem Startdatum', () => {
  const S = state();
  assert.equal(L.mesoWeek(S, NOW), 1);
  assert.equal(L.mesoWeek(S, L.addDays(NOW, 7)), 2);
  assert.equal(L.mesoWeek(S, L.addDays(NOW, 35)), 6);
});

test('Epley mit Reserve', () => {
  assert.equal(Math.round(L.e1rm(100, 5, 0) * 10) / 10, 116.7);
  assert.equal(L.e1rm(100, 3, 2), L.e1rm(100, 5, 0));
});

test('Gewichtstrend aus 7-Tage-Mitteln', () => {
  const body = [];
  for (let i = 0; i < 14; i++) body.push({ d: L.isoDate(L.addDays(NOW, i)), kg: i < 7 ? 80 : 79.5 });
  const t = L.bodyTrend({ body });
  assert.ok(Math.abs(t.delta + 0.5) < 1e-9);
});

test('Zyklusauswertung: gute Treue und Erholung → mehr Volumen', () => {
  const S = state();
  for (let i = 0; i < 18; i++) S.sessions.push({ planCreated: S.plan.created, rscore: 4 });
  assert.equal(L.mesoReview(S).delta, 1);
  S.sessions.forEach(s => (s.rscore = 2));
  assert.equal(L.mesoReview(S).delta, -2);
});

test('Jede Übung hat gültige Muskeln und Muster', () => {
  for (const id of ['bench', 'pullup', 'dead_bug']) { const x = exById(id); assert.ok(MUSCLES[x.m]); x.s.forEach(m => assert.ok(MUSCLES[m])); }
});
