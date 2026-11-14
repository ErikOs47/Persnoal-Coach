// Planlogik: reine Funktionen ohne DOM-Zugriff, damit sie mit `node --test` geprüft werden können.
// Begründungen und Quellen: README.md und die Ansicht „So rechnet Formkurve“.
import { EX, exById, MUSCLES, TPL, SPLITS, RIR, WF, LEGS } from './data.js';

/* ---------- Datum ---------- */
export function isoDate(d) { const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return z.toISOString().slice(0, 10); }
export function parseISO(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
export function mondayOf(d) { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
export function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
export const daysBetween = (a, b) => Math.round((b - a) / 86400000);

/* ---------- Gewichte ---------- */
export function roundW(w, x) { const step = x.inc >= 5 ? 2.5 : (x.inc || 1); return Math.max(0, Math.round(w / step) * step); }
// Epley (1985) mit Reserve: Gewicht × (1 + (Wdh. + RIR) / 30)
export const e1rm = (w, r, rir) => (w > 0 ? w * (1 + ((+r) + (+rir || 0)) / 30) : 0);

/* ---------- Planerstellung ---------- */
// Trainingsorte: 'gym' nutzt profile.equipment, 'home' profile.equipHome. place = gym | home | both.
export const primaryLoc = prof => (prof.place === 'home' ? 'home' : 'gym');
export const equipFor = (prof, loc) => ((loc || primaryLoc(prof)) === 'home' ? (prof.equipHome || []) : prof.equipment);
// Starke Beschwerden (limits) schließen Übungen aus, leichte (mild) stellen sie ans Ende der Auswahl. Gesperrte Übungen (ban) fallen weg.
export function candidates(pat, prof, loc) {
  const eq = new Set(equipFor(prof, loc)); const mild = prof.mild || []; const ban = prof.ban || [];
  const hit = e => ((e.av || []).some(a => mild.includes(a)) ? 1 : 0);
  return EX.filter(e => e.p === pat && e.eq.every(q => eq.has(q)) && !(e.av || []).some(a => prof.limits.includes(a)) && !ban.includes(e.id))
    .map((e, i) => [e, i]).sort((a, b) => hit(a[0]) - hit(b[0]) || a[1] - b[1]).map(a => a[0]);
}
export function repRange(x, goal) {
  if (x.rr) return x.rr.slice();
  if (x.bw) return [8, 20];
  if (x.inc === 0) return [12, 20];
  const R = { hyp: { c: [6, 10], i: [10, 15] }, str: { c: [3, 6], i: [8, 12] }, fat: { c: [8, 12], i: [12, 15] }, fit: { c: [8, 12], i: [10, 15] } }[goal];
  return R[x.t].slice();
}
export const restFor = (x, goal) => (x.t === 'c' ? (goal === 'str' ? 180 : 120) : 75);

export function weeklyTargets(prof) {
  // Wiedereinstieg nach Pause: erster Zyklus mit 3 Sätzen weniger. Anderer Sport mit Beinbelastung: 1 Satz weniger pro Sporttag (max. 3).
  const base = { beg: 10, int: 13, adv: 16 }[prof.exp] + (prof.goal === 'fat' ? -2 : 0) + (prof.volAdj || 0) + (prof.reentry ? -3 : 0);
  const sport = Math.min(3, (prof.sportDays || []).length);
  const T = {};
  for (const m in MUSCLES) {
    let t = base;
    if (m === 'calves' || m === 'abs' || m === 'glutes') t = Math.max(6, base - 4);
    if (prof.prio.includes(m)) t += 4;
    if (LEGS.includes(m)) t -= sport;
    t += (prof.mAdj || {})[m] || 0; // gelernte Anpassung pro Muskel aus den Zyklusauswertungen
    T[m] = Math.max(4, t);
  }
  return T;
}

export function allocateSets(days, prof) {
  const T = weeklyTargets(prof);
  const byM = {};
  days.forEach(d => d.ex.forEach(e => { const m = exById(e.id).m; (byM[m] = byM[m] || []).push(e); }));
  const maxPer = prof.exp === 'beg' ? 4 : 6;
  const all = days.flatMap(d => d.ex);
  const fill = target => {
    for (const m in byM) {
      const list = byM[m].slice().sort((a, b) => (exById(a.id).t === 'c' ? 0 : 1) - (exById(b.id).t === 'c' ? 0 : 1));
      for (let w = 0; w < 4; w++) {
        const total = Math.round(target[m] * WF[w]);
        const n = list.length; const per = Math.floor(total / n); let rem = total - per * n;
        list.forEach(e => { e.sets[w] = Math.min(maxPer, Math.max(2, per + (rem > 0 ? 1 : 0))); if (rem > 0) rem--; });
      }
    }
  };
  // Durchgang 1: volles Ziel. Durchgang 2: indirekte Sätze (Hilfsmuskel = halber Satz, z. B. Bizeps beim Rudern)
  // vom direkten Ziel abziehen, mindestens aber die Hälfte direkt trainieren.
  fill(T);
  const direct = {};
  for (const m in T) {
    const indirect = all.reduce((s, e) => s + (exById(e.id).s.includes(m) ? 0.5 * e.sets[2] : 0), 0);
    direct[m] = Math.max(Math.round(T[m] * 0.5), Math.round(T[m] - indirect));
  }
  fill(direct);
  // Obergrenze pro Training (~20 Sätze pro Stunde), gemessen an der Spitzenwoche 4.
  // Gekürzt wird zuerst bei Bauch/Waden, dann bei Isolation, zuletzt bei Grundübungen;
  // jeweils 1 Satz in allen Wochen, damit der Anstieg über den Zyklus erhalten bleibt.
  const cap = Math.round(prof.dur / 60 * 20);
  const cutRank = e => { const x = exById(e.id); return x.m === 'abs' || x.m === 'calves' ? 0 : x.t === 'i' ? 1 : 2; };
  days.forEach(d => {
    d.capped = false;
    let peak = d.ex.reduce((s, e) => s + e.sets[3], 0);
    while (peak > cap) {
      // Kürzen, wo am meisten Sätze liegen; Bauch/Waden und Isolation werden bevorzugt gekürzt. Nie unter 2 Sätze.
      const score = e => e.sets[3] + (2 - cutRank(e)) * 1.5;
      const c = d.ex.filter(e => e.sets[3] > 2).sort((a, b) => score(b) - score(a))[0];
      if (c) { for (let w = 0; w < 4; w++) if (c.sets[w] > 2) c.sets[w]--; }
      else {
        // Alles auf 2 Sätzen: zuerst eine Bauch/Waden-, dann eine Isolationsübung streichen
        const r = d.ex.map((e, i) => [cutRank(e), i]).filter(([k]) => k < 2).sort((a, b) => a[0] - b[0] || b[1] - a[1])[0];
        if (!r) break;
        d.ex.splice(r[1], 1);
      }
      d.capped = true;
      peak = d.ex.reduce((s, e) => s + e.sets[3], 0);
    }
    d.ex.forEach(e => {
      for (let w = 1; w < 4; w++) if (e.sets[w] < e.sets[w - 1]) e.sets[w] = e.sets[w - 1];
      e.sets[4] = Math.max(1, Math.round(e.sets[0] / 2)); // Deload: etwa halbe Sätze
    });
  });
  return T;
}

export function generatePlan(prof, keep, now = new Date()) {
  const nDays = Math.min(6, Math.max(2, prof.weekdays.length));
  const loc = primaryLoc(prof); const other = prof.place === 'both' ? (loc === 'gym' ? 'home' : 'gym') : null; const fav = prof.fav || [];
  const days = SPLITS[nDays].map((key, di) => {
    const tpl = TPL[key]; const used = new Set(); const usedAlt = new Set(); const ex = [];
    const prevDay = keep && keep.days && keep.days[di] && keep.days[di].key === key ? keep.days[di] : null;
    // Reihenfolge der Wahl: bisherige Übung behalten, sonst Favorit, sonst Vorlage
    const choose = (c, prev) => (prev && c.find(e => e.id === prev)) || c.find(e => fav.includes(e.id)) || c[Math.min(tpl.v || 0, c.length - 1)];
    tpl.slots.forEach((pat, si) => {
      const c = candidates(pat, prof, loc).filter(e => !used.has(e.id));
      if (!c.length) return;
      const prevE = (prevDay && prevDay.ex.find(x => x.slot === si)) || {};
      const pick = choose(c, prevE.id);
      used.add(pick.id);
      const e = { slot: si, id: pick.id, rr: repRange(pick, prof.goal), rest: restFor(pick, prof.goal), sets: [0, 0, 0, 0, 0] };
      if (other) {
        // Zweiter Ort: dieselbe Übung, wenn sie dort möglich ist, sonst gleiche Bewegung mit der dortigen Ausrüstung
        const c2 = candidates(pat, prof, other).filter(x => !usedAlt.has(x.id));
        const alt = c2.find(x => x.id === pick.id) || (c2.length ? choose(c2, prevE.alt) : null);
        if (alt) { usedAlt.add(alt.id); e.alt = alt.id; e.altRr = repRange(alt, prof.goal); e.altRest = restFor(alt, prof.goal); } else e.alt = null;
      }
      ex.push(e);
    });
    return { key, name: tpl.name, ex };
  });
  const T = allocateSets(days, prof);
  return {
    created: isoDate(now) + '_' + now.getTime().toString(36),
    meso: { n: ((keep && keep.meso && keep.meso.n) || 0) + 1, start: isoDate(mondayOf(now)) },
    split: nDays, days, T, loc, reentry: !!prof.reentry,
  };
}

// Sicht auf eine Plan-Übung am gewählten Ort. null, wenn es dort keine passende Übung gibt.
export function viewAt(e, plan, loc) {
  if (e.only) return e.only === loc || !loc ? { id: e.id, rr: e.rr, rest: e.rest, sets: e.sets, e } : null;
  if (!loc || !plan.loc || loc === plan.loc) return { id: e.id, rr: e.rr, rest: e.rest, sets: e.sets, e };
  return e.alt ? { id: e.alt, rr: e.altRr || e.rr, rest: e.altRest || e.rest, sets: e.sets, e } : null;
}
export const dayAt = (plan, di, loc) => plan.days[di].ex.map((e, ei) => { const v = viewAt(e, plan, loc); return v && { ...v, ei }; }).filter(Boolean);
export const rirRow = S => RIR[S.plan && S.plan.reentry ? 'beg' : S.profile.exp];

/* ---------- Zyklus und Tagesziele ---------- */
// Kalenderwoche im Zyklus (1, 2, 3 …)
export function calWeek(S, now = new Date()) {
  if (!S.plan) return 1;
  return Math.max(1, Math.floor(daysBetween(parseISO(S.plan.meso.start), mondayOf(now)) / 7) + 1);
}
// Wirksame Woche: 1–4 Aufbau, 5 Deload, 6 = Zyklus fertig. Der Deload liegt in der Woche meso.deloadAt.
// Ohne Festlegung laufen die Aufbauwochen nach Woche 4 mit dem Volumen von Woche 4 weiter, spätestens Woche 7 ist Deload.
export function mesoWeek(S, now = new Date()) {
  if (!S.plan) return 1;
  const c = calWeek(S, now); const d = S.plan.meso.deloadAt || 7;
  return c < d ? Math.min(c, 4) : c === d ? 5 : 6;
}
// Ermüdungszeichen aus den letzten Trainings des laufenden Zyklus (ohne Deload-Einheiten)
export function fatigue(S) {
  const ms = S.sessions.filter(s => s.planCreated === S.plan.created && s.week < 5);
  const last = ms.slice(-3); const reasons = [];
  const rs = last.map(s => s.rscore).filter(Boolean);
  const recLow = rs.length >= 2 && rs.reduce((a, b) => a + b, 0) / rs.length < 2.8;
  const ld = last.flatMap(s => s.entries || []).map(e => e.fb && e.fb.load).filter(Boolean);
  const loadHigh = ld.length >= 3 && ld.reduce((a, b) => a + b, 0) / ld.length >= 2.5;
  const series = {};
  ms.forEach(s => (s.entries || []).forEach(e => { const b = Math.max(0, ...e.sets.map(z => e1rm(z.w, z.r, z.rir))); if (b > 0) (series[e.id] = series[e.id] || []).push(b); }));
  const drops = Object.values(series).filter(v => v.length >= 3 && v[v.length - 1] < v[v.length - 3] * 0.98 && v[v.length - 2] < v[v.length - 3] * 0.98).length;
  const perfDrop = drops >= 2;
  if (perfDrop) reasons.push(`Leistung bei ${drops} Übungen zwei Einheiten in Folge gesunken`);
  if (recLow) reasons.push('Erholung der letzten Trainings unter 2,8 von 5');
  if (loadHigh) reasons.push('Belastung mehrfach als „zu viel“ bewertet');
  return { any: reasons.length > 0, strong: (perfDrop && (recLow || loadHigh)) || (recLow && loadHigh), reasons };
}
// Ab Woche 5: Deload, sobald ein Ermüdungszeichen vorliegt; Woche 7 immer. Gibt die Woche zurück, die als Deload festgelegt werden soll.
export function deloadDecision(S, now = new Date()) {
  if (!S.plan || S.plan.meso.deloadAt) return null;
  const c = calWeek(S, now);
  if (c >= 7) return c === 7 ? 7 : c - 1;
  if (c >= 5 && fatigue(S).any) return c;
  return null;
}
export const weekIdx = (S, now) => Math.min(mesoWeek(S, now), 5) - 1;

export function targetFor(S, e, wk, light) {
  const x = exById(e.id); const p = S.prog[e.id] || {}; const wi = Math.min(wk, 5) - 1;
  let sets = e.sets[wi] || 1; let rir = rirRow(S)[wi];
  let w = p.w != null ? p.w : (x.bw ? 0 : null); let reps = p.reps || e.rr[0];
  if (wi === 4) { if (w) w = roundW(w * 0.9, x); reps = e.rr[0]; }
  if (light) { sets = Math.max(1, sets - 1); rir += 1; }
  return { sets, rir, w, reps, lo: e.rr[0], hi: e.rr[1] };
}

const fmt = (n, d = 1) => (n == null || isNaN(n) ? '–' : (Math.round(n * 10 ** d) / 10 ** d).toLocaleString('de-DE'));

// Doppelprogression mit RIR-Korrektur. Gibt neuen Zustand + Hinweis zurück, oder null ohne erledigte Sätze.
export function progressExercise(S, entry, wk, light) {
  const x = exById(entry.id);
  const done = entry.sets.filter(s => s.done && +s.r > 0);
  if (!done.length) return null;
  if (wk >= 5) return { kind: 'hold', msg: 'Deload-Woche: keine Steigerung, Erholung hat Vorrang' };
  const p = S.prog[entry.id] || { fails: 0 };
  const [lo, hi] = entry.rr;
  const w = Math.max(...done.map(s => +s.w || 0));
  const top = done.filter(s => (+s.w || 0) === w);
  const minR = Math.min(...top.map(s => +s.r));
  const rirs = top.map(s => s.rir).filter(v => v !== '' && v != null).map(Number);
  // rirBias: gemessene Abweichung der eigenen RIR-Schätzung (Kalibrierungssätze), wird auf die Angabe addiert
  const avgRir = rirs.length ? rirs.reduce((a, b) => a + b, 0) / rirs.length + (S.profile.rirBias || 0) : null;
  const tRir = rirRow(S)[wk - 1];
  if (entry.fb && entry.fb.pain >= 2) return { w, reps: p.reps || lo, fails: p.fails || 0, kind: 'warn', msg: 'Schmerz gemeldet: keine Steigerung' };
  if (minR >= hi) {
    if (x.inc === 0) return { w, reps: lo, fails: 0, kind: 'up', msg: 'Obere Grenze erreicht: stärkeres Band oder langsameres Tempo' };
    const big = avgRir != null && avgRir >= tRir + 2;
    const add = x.inc * (big ? 2 : 1); const nw = w + add;
    const msg = (x.bw && w === 0 ? `Obere Grenze erreicht: ab jetzt ${fmt(add)} kg Zusatzlast oder schwerere Variante` : `+${fmt(add)} kg → ${fmt(nw)} kg × ${lo}`) + (big ? ' (RIR deutlich über Ziel, doppelter Schritt)' : '');
    return { w: nw, reps: lo, fails: 0, kind: 'up', msg };
  }
  if (minR >= lo) { const nr = Math.min(hi, minR + 1); return { w, reps: nr, fails: 0, kind: 'hold', msg: `${fmt(w)} kg halten, Ziel ${nr} Wdh. pro Satz` }; }
  const f = (p.fails || 0) + (light ? 0 : 1);
  if (f >= 2 && w > 0) { const nw = roundW(w * 0.9, x); return { w: nw, reps: lo, fails: 0, kind: 'down', msg: `2× unter ${lo} Wdh.: Reset auf ${fmt(nw)} kg (−10 %)` }; }
  return { w, reps: lo, fails: f, kind: 'warn', msg: `Unter dem Zielbereich. Nächstes Mal gleiches Gewicht${light ? ' (leichter Tag, zählt nicht als Fehlversuch)' : ''}` };
}

/* ---------- Ableitungen ---------- */
export function sessionsThisWeek(S, now = new Date()) { const mon = isoDate(mondayOf(now)); return S.sessions.filter(s => s.date >= mon); }

export function nextDayIndex(S) {
  const n = S.plan.days.length;
  const ofPlan = S.sessions.filter(s => s.planCreated === S.plan.created);
  const last = ofPlan[ofPlan.length - 1];
  return last ? (last.day + 1) % n : 0;
}

export function weekVolume(S, now = new Date()) {
  const done = {}, plan = {};
  for (const m in MUSCLES) { done[m] = 0; plan[m] = 0; }
  const wi = weekIdx(S, now);
  S.plan.days.forEach(d => d.ex.forEach(e => { const x = exById(e.id); plan[x.m] += e.sets[wi] || 0; x.s.forEach(s => (plan[s] += 0.5 * (e.sets[wi] || 0))); }));
  sessionsThisWeek(S, now).forEach(s => s.entries.forEach(en => { const x = exById(en.id); const n = en.sets.filter(z => z.done).length; done[x.m] += n; x.s.forEach(m => (done[m] += 0.5 * n)); }));
  return { done, plan };
}

export function bodyTrend(S) {
  const b = S.body.slice().sort((a, c) => (a.d < c.d ? -1 : 1));
  if (b.length < 2) return null;
  const last = parseISO(b[b.length - 1].d);
  const avg = (from, to) => { const v = b.filter(x => { const dd = parseISO(x.d); return dd > from && dd <= to; }).map(x => x.kg); return v.length ? v.reduce((a, c) => a + c, 0) / v.length : null; };
  const a1 = avg(addDays(last, -7), last), a0 = avg(addDays(last, -14), addDays(last, -7));
  if (a1 == null || a0 == null) return { avg: a1 };
  return { avg: a1, delta: a1 - a0, pct: (a1 - a0) / a0 * 100 };
}

// Auswertung am Zyklusende: Volumenanpassung für den nächsten Mesozyklus
export function mesoReview(S) {
  const ms = S.sessions.filter(s => s.planCreated === S.plan.created);
  const planned = (S.plan.meso.deloadAt || 5) * S.profile.weekdays.length;
  const adh = ms.length / planned;
  const rs = ms.map(s => s.rscore).filter(Boolean);
  const avg = rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : 3;
  const g = adh >= 0.8 && avg >= 3.5 ? { delta: 1, why: 'Gute Erholung und Trainingstreue: +1 Satz pro Muskel und Woche.' }
    : avg < 2.5 ? { delta: -2, why: 'Erholung war niedrig: −2 Sätze pro Muskel und Woche.' } : { delta: 0, why: 'Volumen bleibt gleich.' };
  // Pro Muskel: Belastungs-Feedback (1 leicht, 2 passend, 3 zu viel) und Kraftverlauf der Übungen dieses Muskels.
  // Ohne mindestens 3 Rückmeldungen gilt die allgemeine Regel oben.
  const build = ms.filter(s => s.week < 5); const muscles = {};
  for (const m in MUSCLES) {
    const en = build.flatMap(s => (s.entries || []).filter(e => exById(e.id).m === m));
    const ld = en.map(e => e.fb && e.fb.load).filter(Boolean);
    const series = {};
    en.forEach(e => { const b = Math.max(0, ...e.sets.map(z => e1rm(z.w, z.r, z.rir))); if (b > 0) (series[e.id] = series[e.id] || []).push(b); });
    const tr = Object.values(series).filter(v => v.length >= 3).map(v => { const k = v.length >= 4 ? 2 : 1; const a = v.slice(0, k).reduce((x, y) => x + y, 0) / k, b = v.slice(-k).reduce((x, y) => x + y, 0) / k; return (b - a) / a * 100; });
    const trend = tr.length ? tr.reduce((a, b) => a + b, 0) / tr.length : null;
    if (ld.length < 3) { muscles[m] = { delta: g.delta, trend, load: null, why: 'zu wenig Rückmeldungen, allgemeine Regel' }; continue; }
    const load = ld.reduce((a, b) => a + b, 0) / ld.length; let d, why;
    if (load >= 2.5) { d = -2; why = 'Belastung meist „zu viel“'; }
    else if (load <= 1.6) { d = trend != null && trend < 1 ? 2 : 1; why = trend != null && trend < 1 ? 'Belastung „leicht“ und Kraft stagniert' : 'Belastung meist „leicht“'; }
    else if (trend != null && trend < 0.5 && avg >= 3 && adh >= 0.8) { d = 1; why = 'Kraft stagniert bei guter Erholung'; }
    else { d = 0; why = trend != null && trend >= 0.5 ? 'Kraft steigt, Belastung passt' : 'Belastung passt'; }
    if (avg < 2.5) { d = Math.min(d, -1); why += ', Erholung insgesamt niedrig'; }
    muscles[m] = { delta: d, trend, load, why };
  }
  return { ...g, adh, avg, muscles };
}

/* ---------- Tageswahl, Zeit, Fußball ---------- */
const wd = d => (d.getDay() + 6) % 7;
export const sportSoon = (S, now = new Date()) => { const sd = S.profile.sportDays || []; return sd.includes(wd(now)) ? 'heute' : sd.includes(wd(addDays(now, 1))) ? 'morgen' : null; };
export function legShare(S, di, loc, now = new Date()) {
  const wi = weekIdx(S, now); const v = dayAt(S.plan, di, loc); const tot = v.reduce((s, e) => s + (e.sets[wi] || 0), 0);
  return tot ? v.filter(e => LEGS.includes(exById(e.id).m)).reduce((s, e) => s + (e.sets[wi] || 0), 0) / tot : 0;
}
// Nächstes Training: erste noch offene Einheit der Woche in Planreihenfolge. Steht heute oder morgen anderer Sport an,
// wird eine Einheit ohne Beinschwerpunkt vorgezogen; gibt es keine, läuft das Beintraining reduziert (legLight).
export function pickDay(S, loc, now = new Date()) {
  const n = S.plan.days.length; const start = nextDayIndex(S);
  const done = new Set(sessionsThisWeek(S, now).filter(s => s.planCreated === S.plan.created).map(s => s.day));
  let order = Array.from({ length: n }, (_, i) => (start + i) % n).filter(i => !done.has(i));
  if (!order.length) order = [start];
  const soon = sportSoon(S, now); let di = order[0];
  if (!soon || legShare(S, di, loc, now) < 0.5) return { di, legLight: !!soon && legShare(S, di, loc, now) > 0, soon, why: '' };
  const alt = order.find(i => legShare(S, i, loc, now) < 0.5);
  const name = S.profile.sportName || 'Sport';
  if (alt != null) return { di: alt, legLight: legShare(S, alt, loc, now) > 0, soon, why: `${name} ${soon}: ${S.plan.days[alt].name} vorgezogen, das Beintraining folgt danach.` };
  return { di, legLight: true, soon, why: `${name} ${soon}: Beinübungen heute mit einem Satz weniger und mehr Reserve.` };
}
export const estMinutes = list => Math.round(list.reduce((s, e) => s + e.sets * ((e.ss ? 20 : e.rest) / 60 + 0.8), 0) + 5);
// Kurzes Training: erst Isolationsübungen zu Supersätzen koppeln, dann Sätze kürzen (Bauch/Waden, Isolation, zuletzt Grundübungen),
// dann Isolationsübungen streichen. list: [{id, sets, rest}], wird verändert zurückgegeben.
export function trimToTime(list, minutes) {
  if (!minutes || estMinutes(list) <= minutes) return list;
  for (let i = 0; i + 1 < list.length; i++) {
    const a = exById(list[i].id), b = exById(list[i + 1].id);
    if (a.t === 'i' && b.t === 'i' && a.m !== b.m && !(i && list[i - 1].ss)) { list[i].ss = true; i++; }
  }
  const rank = e => { const x = exById(e.id); return x.m === 'abs' || x.m === 'calves' ? 0 : x.t === 'i' ? 1 : 2; };
  let guard = 60;
  while (estMinutes(list) > minutes && guard--) {
    const c = list.filter(e => e.sets > 2).sort((a, b) => (b.sets + (2 - rank(b)) * 1.5) - (a.sets + (2 - rank(a)) * 1.5))[0];
    if (c) { c.sets--; continue; }
    const r = list.map((e, i) => [rank(e), i]).filter(([k]) => k < 2).sort((a, b) => a[0] - b[0] || b[1] - a[1])[0];
    if (!r) break;
    if (r[1] > 0 && list[r[1] - 1].ss) list[r[1] - 1].ss = false;
    list.splice(r[1], 1);
  }
  return list;
}
// Ersatz für eine Übung, die eine heute schmerzende Region belastet (flare) oder die gesperrt wurde
export function altFor(id, prof, loc, flare, used = []) {
  const x = exById(id);
  const c = candidates(x.p, { ...prof, limits: [...prof.limits, ...flare], ban: [...(prof.ban || []), id] }, loc).filter(e => !used.includes(e.id));
  return (c.find(e => !(e.av || []).length) || c[0] || {}).id || null;
}

/* ---------- Plateau, Kalibrierung, Hilfen ---------- */
// Plateau: mindestens 5 Einheiten in 6 Wochen, und die letzten 3 liegen nicht über dem Bestwert davor.
export function plateaus(S, now = new Date()) {
  const from = isoDate(addDays(now, -42)); const ids = new Set(S.plan.days.flatMap(d => d.ex.flatMap(e => [e.id, e.alt].filter(Boolean)))); const out = [];
  for (const id of ids) {
    const v = S.sessions.filter(s => s.date >= from && s.week < 5).map(s => Math.max(0, ...(s.entries || []).filter(e => e.id === id).flatMap(e => e.sets.map(z => e1rm(z.w, z.r, z.rir))))).filter(b => b > 0);
    if (v.length < 5) continue;
    const before = Math.max(...v.slice(0, -3)), recent = Math.max(...v.slice(-3));
    if (recent <= before * 1.005) out.push({ id, best: before, recent, n: v.length });
  }
  return out;
}
// Kalibrierungssatz: letzter Satz bis zum Versagen. Abweichung = tatsächliche Wdh. − (Wdh. + geschätzte RIR des Satzes davor, gleiches Gewicht).
// Positiv heißt: Reserve wurde unterschätzt. Ermüdung zwischen den Sätzen macht den Wert eher zu klein.
export function calibration(sets) {
  const d = sets.filter(s => s.done && +s.r > 0); if (d.length < 2) return null;
  const f = d[d.length - 1], p = d[d.length - 2];
  if (p.rir === '' || p.rir == null || (+p.w || 0) !== (+f.w || 0)) return null;
  return +f.r - (+p.r + +p.rir);
}
export function rirBias(cal) {
  const v = (cal || []).slice(-6).map(c => c.bias); if (v.length < 2) return 0;
  return Math.max(-1, Math.min(3, Math.round(v.reduce((a, b) => a + b, 0) / v.length * 2) / 2));
}
// Aufwärmsätze für Grundübungen mit Zusatzgewicht: erste Grundübung 3 Stufen, weitere 1 Stufe
export function warmup(w, x, first) {
  if (!w || x.bw || x.t !== 'c' || w < 20) return [];
  const min = x.eq.includes('barbell') ? 20 : 0;
  return (first ? [[0.5, 8], [0.7, 4], [0.85, 2]] : [[0.7, 4]]).map(([f, r]) => [Math.max(min, roundW(w * f, x)), r]).filter(([v]) => v < w);
}
// Scheiben pro Seite für eine Langhantel (Standard 20 kg)
export function plates(w, bar = 20, avail = [25, 20, 15, 10, 5, 2.5, 1.25]) {
  let side = (w - bar) / 2; if (side < 0) return null; const out = [];
  for (const p of avail) while (side >= p - 1e-9) { out.push(p); side -= p; }
  return side > 0.01 ? null : out;
}
export const proteinTarget = kg => [Math.round(kg * 1.6 / 5) * 5, Math.round(kg * 2.2 / 5) * 5];

// Wochenbericht aus den letzten 7 Tagen: feste Regeln, kein Sprachmodell
export function weekReport(S, now = new Date()) {
  const from = isoDate(addDays(now, -6)); const ss = S.sessions.filter(s => s.date >= from); const L = [];
  L.push(`${ss.length} von ${S.profile.weekdays.length} geplanten Trainings in den letzten 7 Tagen.`);
  if (!ss.length) return L;
  const res = ss.flatMap(s => s.results || []); const c = k => res.filter(r => r.kind === k).length;
  L.push(`Progression: ${c('up')}× Gewicht gesteigert, ${c('hold')}× gehalten, ${c('warn') + c('down')}× unter dem Zielbereich.`);
  const rs = ss.map(s => s.rscore).filter(Boolean);
  if (rs.length) L.push(`Erholung im Schnitt ${fmt(rs.reduce((a, b) => a + b, 0) / rs.length)} von 5.`);
  const fb = ss.flatMap(s => s.entries || []).filter(e => e.fb);
  const pain = [...new Set(fb.filter(e => e.fb.pain >= 1).map(e => exById(e.id).n))];
  if (pain.length) L.push(`Schmerz gemeldet bei: ${pain.join(', ')}.`);
  const heavy = {}, light = {};
  fb.forEach(e => { const m = exById(e.id).m; if (e.fb.load === 3) heavy[m] = (heavy[m] || 0) + 1; if (e.fb.load === 1) light[m] = (light[m] || 0) + 1; });
  const nm = o => Object.keys(o).filter(m => o[m] >= 2).map(m => MUSCLES[m]);
  if (nm(heavy).length) L.push(`Mehrfach „zu viel“: ${nm(heavy).join(', ')}. Hält das an, sinkt dort das Volumen im nächsten Zyklus.`);
  if (nm(light).length) L.push(`Mehrfach „leicht“: ${nm(light).join(', ')}. Hält das an, steigt dort das Volumen im nächsten Zyklus.`);
  const pl = plateaus(S, now);
  if (pl.length) L.push(`Stagnation: ${pl.map(p => exById(p.id).n).join(', ')}.`);
  const f = fatigue(S);
  if (f.any) L.push(`Ermüdungszeichen: ${f.reasons.join('; ')}.`);
  const t = bodyTrend(S);
  if (t && t.pct != null) L.push(`Körpergewicht ${t.pct >= 0 ? '+' : ''}${fmt(t.pct, 2)} % zur Vorwoche.`);
  const w = mesoWeek(S, now);
  L.push(w === 5 ? 'Diese Woche: Deload.' : w > 5 ? 'Zyklus abgeschlossen: nächsten Zyklus starten.' : `Diese Woche: Aufbauwoche ${calWeek(S, now)}, Ziel-RIR ${rirRow(S)[w - 1]}.`);
  return L;
}
