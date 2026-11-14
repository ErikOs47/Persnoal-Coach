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

test('Mesozyklus: Aufbau läuft ohne Ermüdung weiter, Deload spätestens Woche 7', () => {
  const S = state();
  assert.equal(L.mesoWeek(S, NOW), 1);
  assert.equal(L.mesoWeek(S, L.addDays(NOW, 7)), 2);
  assert.equal(L.mesoWeek(S, L.addDays(NOW, 28)), 4); // Kalenderwoche 5: Aufbau mit Stand von Woche 4
  assert.equal(L.calWeek(S, L.addDays(NOW, 28)), 5);
  assert.equal(L.deloadDecision(S, L.addDays(NOW, 28)), null);
  assert.equal(L.mesoWeek(S, L.addDays(NOW, 42)), 5); // Woche 7: Deload
  assert.equal(L.deloadDecision(S, L.addDays(NOW, 42)), 7);
  assert.equal(L.mesoWeek(S, L.addDays(NOW, 49)), 6);
  S.plan.meso.deloadAt = 3;
  assert.equal(L.mesoWeek(S, L.addDays(NOW, 14)), 5);
  assert.equal(L.mesoWeek(S, L.addDays(NOW, 21)), 6);
});

test('Ermüdung: niedrige Erholung löst ab Woche 5 den Deload aus', () => {
  const S = state();
  for (let i = 0; i < 3; i++) S.sessions.push({ planCreated: S.plan.created, week: 4, rscore: 2.3, entries: [] });
  assert.ok(L.fatigue(S).any);
  assert.equal(L.deloadDecision(S, L.addDays(NOW, 28)), 5);
  assert.equal(L.deloadDecision(S, L.addDays(NOW, 14)), null);
});

test('Ermüdung: Leistungsabfall bei zwei Übungen wird erkannt', () => {
  const S = state();
  const mk = w => ({ planCreated: S.plan.created, week: 3, rscore: 4, entries: [entry('bench', [6, 10], [[w, 8, 2]]), entry('bb_row', [6, 10], [[w, 8, 2]])] });
  [80, 76, 76].forEach(w => S.sessions.push(mk(w)));
  const f = L.fatigue(S);
  assert.ok(f.any); assert.ok(!f.strong);
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

const home = ['dumbbell', 'bench', 'pullupbar', 'band'];

test('Zwei Orte: jede Übung hat eine Variante mit der Ausrüstung zuhause', () => {
  const p = prof({ place: 'both', equipHome: home });
  const plan = L.generatePlan(p, null, NOW);
  assert.equal(plan.loc, 'gym');
  for (let di = 0; di < plan.days.length; di++) {
    const h = L.dayAt(plan, di, 'home'), g = L.dayAt(plan, di, 'gym');
    assert.equal(g.length, plan.days[di].ex.length);
    assert.ok(h.length >= g.length - 1, plan.days[di].name);
    for (const e of h) assert.ok(exById(e.id).eq.every(q => home.includes(q)), e.id);
    assert.equal(new Set(h.map(e => e.id)).size, h.length);
  }
  // Übung, die an beiden Orten geht, bleibt dieselbe
  const same = plan.days.flatMap(d => d.ex).filter(e => exById(e.id).eq.every(q => home.includes(q)));
  for (const e of same) assert.equal(e.alt, e.id);
});

test('Leichte Kniebeschwerden: schonende Übungen zuerst, starke schließen aus', () => {
  const mild = L.candidates('squat', prof({ mild: ['knee'] }));
  assert.ok(!(mild[0].av || []).includes('knee'));
  assert.ok(mild.some(e => (e.av || []).includes('knee')));
  assert.ok(!L.candidates('squat', prof({ limits: ['knee'] })).some(e => (e.av || []).includes('knee')));
  assert.ok(!L.candidates('squat', prof({ ban: ['leg_press'] })).some(e => e.id === 'leg_press'));
});

test('Favorit wird gewählt, Ersatz bei heutigen Kniebeschwerden meidet das Knie', () => {
  const plan = L.generatePlan(prof({ fav: ['hack_squat'] }), null, NOW);
  assert.ok(plan.days.flatMap(d => d.ex).some(e => e.id === 'hack_squat'));
  const alt = L.altFor('hack_squat', prof(), 'gym', ['knee']);
  assert.ok(alt && alt !== 'hack_squat' && !(exById(alt).av || []).includes('knee'));
});

test('Wiedereinstieg und Sporttage senken das Wochenziel, Muskel-Anpassung wirkt', () => {
  const base = L.weeklyTargets(prof());
  assert.equal(L.weeklyTargets(prof({ reentry: true })).chest, base.chest - 3);
  const sp = L.weeklyTargets(prof({ sportDays: [1, 3] }));
  assert.equal(sp.quads, base.quads - 2); assert.equal(sp.chest, base.chest);
  assert.equal(L.weeklyTargets(prof({ mAdj: { back: 2 } })).back, base.back + 2);
  const S = state(); S.profile.reentry = true; S.plan = L.generatePlan(S.profile, null, NOW);
  assert.deepEqual(L.rirRow(S), [3, 3, 2, 2, 4]);
});

test('Sport morgen: Einheit ohne Beinschwerpunkt wird vorgezogen', () => {
  const S = state(); // Ober/Unter, Tag 0 = Oberkörper A, Tag 1 = Unterkörper A
  S.sessions.push({ planCreated: S.plan.created, date: L.isoDate(NOW), day: 0, entries: [] });
  S.profile.sportDays = [3]; // Donnerstag, NOW ist Mittwoch
  const pk = L.pickDay(S, 'gym', NOW);
  assert.equal(S.plan.days[pk.di].key, 'UB'); assert.ok(pk.why);
  S.profile.sportDays = [];
  assert.equal(S.plan.days[L.pickDay(S, 'gym', NOW).di].key, 'LA');
});

test('Kurzes Training passt in die Zeit und behält Grundübungen', () => {
  const S = state();
  const list = L.dayAt(S.plan, 0, 'gym').map(e => ({ id: e.id, sets: e.sets[2], rest: e.rest }));
  const before = L.estMinutes(list.map(e => ({ ...e })));
  const out = L.trimToTime(list, 30);
  assert.ok(before > 30); assert.ok(L.estMinutes(out) <= 30);
  assert.ok(out.some(e => exById(e.id).t === 'c'));
  assert.ok(out.every(e => e.sets >= 2));
});

test('Zyklusauswertung pro Muskel aus Belastungs-Feedback', () => {
  const S = state();
  const fb = (id, load, w) => ({ ...entry(id, [6, 10], [[w, 8, 2]]), fb: { load } });
  for (let i = 0; i < 16; i++) S.sessions.push({ planCreated: S.plan.created, week: 2, rscore: 4, entries: [fb('bench', 3, 80 + i), fb('bb_row', 1, 60), fb('bb_squat', 2, 100 + i)] });
  const m = L.mesoReview(S).muscles;
  assert.equal(m.chest.delta, -2);
  assert.equal(m.back.delta, 2); // leicht und Kraft stagniert
  assert.equal(m.quads.delta, 0); // passt und Kraft steigt
  assert.equal(m.biceps.delta, 1); // keine Rückmeldung: allgemeine Regel
});

test('Plateau: fünf Einheiten ohne neuen Bestwert in den letzten drei', () => {
  const S = state();
  [80, 82.5, 82.5, 82.5, 82.5].forEach((w, i) => S.sessions.push({ date: L.isoDate(L.addDays(NOW, -30 + i * 6)), week: 2, entries: [entry('bench', [6, 10], [[w, 8, 2]])] }));
  assert.deepEqual(L.plateaus(S, NOW).map(p => p.id), ['bench']);
  S.sessions[4].entries[0].sets[0].w = 85;
  assert.equal(L.plateaus(S, NOW).length, 0);
});

test('RIR-Kalibrierung, Aufwärmsätze, Scheiben, Protein', () => {
  const set = (w, r, rir) => ({ w, r, rir, done: true });
  assert.equal(L.calibration([set(20, 12, 2), set(20, 16, 0)]), 2);
  assert.equal(L.calibration([set(20, 12, ''), set(20, 16, 0)]), null);
  assert.equal(L.rirBias([{ bias: 2 }, { bias: 1 }]), 1.5);
  assert.equal(L.rirBias([{ bias: 2 }]), 0);
  assert.deepEqual(L.warmup(100, exById('bb_squat'), true), [[50, 8], [70, 4], [85, 2]]);
  assert.deepEqual(L.warmup(100, exById('db_curl'), true), []);
  assert.deepEqual(L.plates(100), [25, 15]);
  assert.deepEqual(L.plates(62.5), [20, 1.25]);
  assert.deepEqual(L.proteinTarget(80), [130, 175]);
});

test('Gemessene RIR-Abweichung löst den doppelten Steigerungsschritt aus', () => {
  const S = state();
  const e = entry('bench', [6, 10], [[80, 10, 2], [80, 10, 2]]);
  assert.equal(L.progressExercise(S, e, 2, false).w, 82.5);
  S.profile.rirBias = 2;
  assert.equal(L.progressExercise(S, e, 2, false).w, 85);
  assert.equal(L.progressExercise(S, { ...e, fb: { pain: 2 } }, 2, false).kind, 'warn');
});

test('Alle Übungen der Bibliothek sind vollständig, Bilder gehören zu vorhandenen Übungen', async () => {
  const { EX, MEDIA, PATTERNS, EQUIP } = await import('../js/data.js');
  assert.equal(new Set(EX.map(x => x.id)).size, EX.length);
  for (const x of EX) { assert.ok(MUSCLES[x.m] && PATTERNS[x.p] && x.cue, x.id); x.eq.forEach(q => assert.ok(EQUIP[q], x.id)); }
  for (const id of MEDIA) assert.ok(exById(id).cue, id);
});
