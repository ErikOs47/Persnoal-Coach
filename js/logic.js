// Planlogik: reine Funktionen ohne DOM-Zugriff, damit sie mit `node --test` geprüft werden können.
// Begründungen und Quellen: README.md und die Ansicht „So rechnet Formkurve“.
import { EX, exById, MUSCLES, TPL, SPLITS, RIR, WF } from './data.js';

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
export function candidates(pat, prof) {
  const eq = new Set(prof.equipment);
  return EX.filter(e => e.p === pat && e.eq.every(q => eq.has(q)) && !(e.av || []).some(a => prof.limits.includes(a)));
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
  const base = { beg: 10, int: 13, adv: 16 }[prof.exp] + (prof.goal === 'fat' ? -2 : 0) + (prof.volAdj || 0);
  const T = {};
  for (const m in MUSCLES) {
    let t = base;
    if (m === 'calves' || m === 'abs' || m === 'glutes') t = Math.max(6, base - 4);
    if (prof.prio.includes(m)) t += 4;
    T[m] = t;
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
  const days = SPLITS[nDays].map((key, di) => {
    const tpl = TPL[key]; const used = new Set(); const ex = [];
    tpl.slots.forEach((pat, si) => {
      const c = candidates(pat, prof).filter(e => !used.has(e.id));
      if (!c.length) return;
      const prevDay = keep && keep.days && keep.days[di] && keep.days[di].key === key ? keep.days[di] : null;
      const prev = prevDay ? (prevDay.ex.find(x => x.slot === si) || {}).id : null;
      const pick = (prev && c.find(e => e.id === prev)) || c[Math.min(tpl.v || 0, c.length - 1)];
      used.add(pick.id);
      ex.push({ slot: si, id: pick.id, rr: repRange(pick, prof.goal), rest: restFor(pick, prof.goal), sets: [0, 0, 0, 0, 0] });
    });
    return { key, name: tpl.name, ex };
  });
  const T = allocateSets(days, prof);
  return {
    created: isoDate(now) + '_' + now.getTime().toString(36),
    meso: { n: ((keep && keep.meso && keep.meso.n) || 0) + 1, start: isoDate(mondayOf(now)) },
    split: nDays, days, T,
  };
}

/* ---------- Zyklus und Tagesziele ---------- */
export function mesoWeek(S, now = new Date()) {
  if (!S.plan) return 1;
  return Math.max(1, Math.floor(daysBetween(parseISO(S.plan.meso.start), mondayOf(now)) / 7) + 1);
}
export const weekIdx = (S, now) => Math.min(mesoWeek(S, now), 5) - 1;

export function targetFor(S, e, wk, light) {
  const x = exById(e.id); const p = S.prog[e.id] || {}; const wi = Math.min(wk, 5) - 1;
  let sets = e.sets[wi] || 1; let rir = RIR[S.profile.exp][wi];
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
  const avgRir = rirs.length ? rirs.reduce((a, b) => a + b, 0) / rirs.length : null;
  const tRir = RIR[S.profile.exp][wk - 1];
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
  const planned = 5 * S.profile.weekdays.length;
  const adh = ms.length / planned;
  const rs = ms.map(s => s.rscore).filter(Boolean);
  const avg = rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : 3;
  if (adh >= 0.8 && avg >= 3.5) return { delta: 1, adh, avg, why: 'Gute Erholung und Trainingstreue: +1 Satz pro Muskel und Woche.' };
  if (avg < 2.5) return { delta: -2, adh, avg, why: 'Erholung war niedrig: −2 Sätze pro Muskel und Woche.' };
  return { delta: 0, adh, avg, why: 'Volumen bleibt gleich.' };
}
