// Formkurve – Oberfläche. Planlogik in logic.js, Stammdaten in data.js, Coach in coach.js.
import { MUSCLES, EQUIP, LIMITS, GOALS, EXP, WEEKDAYS, EX, exById, SPLITNAME, RIR, WF } from './data.js';
import * as L from './logic.js';
import { askCoach, COACH_MODELS } from './coach.js';
const { isoDate, parseISO, mondayOf, addDays, roundW, e1rm, repRange, restFor, generatePlan } = L;

/* ---------- Helfer ---------- */
const $=(s,r=document)=>r.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=(n,d=1)=>n==null||isNaN(n)?'–':(Math.round(n*10**d)/10**d).toLocaleString('de-DE');
const todayISO=()=>isoDate(new Date());
const wdIdx=d=>(d.getDay()+6)%7;
const fmtDate=s=>parseISO(s).toLocaleDateString('de-DE',{weekday:'short',day:'2-digit',month:'2-digit'});
function toast(t){const el=$('#toast');el.textContent=t;el.hidden=false;clearTimeout(toast.h);toast.h=setTimeout(()=>el.hidden=true,2600)}
function lsGet(k){try{return JSON.parse(localStorage.getItem(k))}catch(e){return null}}
function lsSet(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch(e){return false}}
function lsDel(k){try{localStorage.removeItem(k)}catch(e){}}

/* ---------- Speicher: lokal im Browser (localStorage), mit Export/Import als Sicherung ---------- */
const LS='formkurve_v1';
const Store={
 persisted:false,
 async init(){try{if(navigator.storage&&navigator.storage.persist)this.persisted=await navigator.storage.persist()}catch(e){}},
 load(){const v=lsGet(LS);return v||{profile:null,plan:null,prog:{},body:[],sessions:[]}},
 save(){if(!lsSet(LS,S))toast('Speichern fehlgeschlagen. Bitte Daten exportieren.')},
 del(){this.save()}
};

/* ---------- Zustand ---------- */
let S={profile:null,plan:null,prog:{},body:[],sessions:[]};
let W=null; // laufendes Training

const DEFAULT_PROFILE={name:'',sex:'m',age:30,height:180,weight:80,goal:'hyp',exp:'int',weekdays:[0,2,4,5],dur:60,equipment:['barbell','dumbbell','bench','cable','machine','pullupbar'],limits:[],prio:[],volAdj:0};

/* ---------- Planlogik (an aktuellen Zustand gebunden) ---------- */
const mesoWeek=()=>L.mesoWeek(S);
const weekIdx=()=>L.weekIdx(S);
const targetFor=(e,wk,light)=>L.targetFor(S,e,wk,light);
const progressExercise=(en,wk,light)=>L.progressExercise(S,en,wk,light);
const sessionsThisWeek=()=>L.sessionsThisWeek(S);
const nextDayIndex=()=>L.nextDayIndex(S);
const weekVolume=()=>L.weekVolume(S);
const bodyTrend=()=>L.bodyTrend(S);

/* ---------- Routing ---------- */
const VIEWS=['heute','plan','fortschritt','coach','profil','wissen','training','start'];
function route(){
 let v=(location.hash||'#heute').slice(1);if(!VIEWS.includes(v))v='heute';
 if(!S.profile||!S.plan)v='start';
 if(v==='training'&&!W)v='heute';
 document.querySelectorAll('nav.tabs a').forEach(a=>a.setAttribute('aria-current',a.dataset.tab===v?'page':'false'));
 $('#tabs').hidden=v==='start';
 renderHeader();
 ({heute:vHeute,plan:vPlan,fortschritt:vFortschritt,coach:vCoach,profil:vProfil,wissen:vWissen,training:vTraining,start:vStart})[v]();
 renderTimer();
}
function go(v){if(location.hash==='#'+v)route();else location.hash=v}
window.addEventListener('hashchange',()=>{route();window.scrollTo(0,0)});
function renderHeader(){
 const h=$('#hdr');if(!S.plan){h.innerHTML='';return}
 const wk=mesoWeek();
 h.innerHTML=`<span class="chip ${wk>=5?'warn':'acc'}">${wk>5?'Zyklus fertig':wk===5?'Deload':'Woche '+wk+'/5'}</span>`;
}

/* ---------- Ansicht: Start / Onboarding ---------- */
function profileForm(p,isStart){
 const seg=(name,opts,val,multi)=>`<div class="seg" data-seg="${name}" data-multi="${multi?1:0}">${Object.entries(opts).map(([k,l])=>`<button type="button" data-v="${k}" aria-pressed="${multi?val.includes(k):String(val)===String(k)}">${esc(l)}</button>`).join('')}</div>`;
 return `<form id="pf" class="stack-lg">
  <section class="stack"><h3>Über dich</h3>
   <div class="grid2">
    <label class="f">Name (optional)<input id="pf_name" value="${esc(p.name)}" autocomplete="given-name"></label>
    <label class="f">Geschlecht<select id="pf_sex"><option value="m"${p.sex==='m'?' selected':''}>männlich</option><option value="w"${p.sex==='w'?' selected':''}>weiblich</option><option value="d"${p.sex==='d'?' selected':''}>divers</option></select></label>
    <label class="f">Alter<input id="pf_age" type="number" inputmode="numeric" min="14" max="90" value="${p.age}"></label>
    <label class="f">Größe (cm)<input id="pf_height" type="number" inputmode="numeric" min="120" max="230" value="${p.height}"></label>
    <label class="f">Gewicht (kg)<input id="pf_weight" type="number" inputmode="decimal" step="0.1" min="35" max="250" value="${p.weight}"></label>
   </div></section>
  <section class="stack"><h3>Ziel</h3>${seg('goal',GOALS,p.goal)}</section>
  <section class="stack"><h3>Trainingserfahrung</h3>${seg('exp',EXP,p.exp)}<p class="small muted">Regelmäßiges Krafttraining, nicht Sport allgemein. Bestimmt Startvolumen und Intensität.</p></section>
  <section class="stack"><h3>Trainingstage</h3>${seg('weekdays',Object.fromEntries(WEEKDAYS.map((d,i)=>[i,d])),p.weekdays.map(String),true)}<p class="small muted" id="splitinfo"></p></section>
  <section class="stack"><h3>Zeit pro Training</h3>${seg('dur',{45:'45 min',60:'60 min',75:'75 min',90:'90 min'},p.dur)}</section>
  <section class="stack"><h3>Ausrüstung</h3>
   <div class="row small"><span class="muted">Vorlage:</span><button type="button" class="ghost" data-act="eqpreset" data-v="gym">Fitnessstudio</button><button type="button" class="ghost" data-act="eqpreset" data-v="home">Zuhause mit Hanteln</button><button type="button" class="ghost" data-act="eqpreset" data-v="bw">Nur Körpergewicht</button></div>
   ${seg('equipment',EQUIP,p.equipment,true)}</section>
  <section class="stack"><h3>Beschwerden</h3>${seg('limits',LIMITS,p.limits,true)}<p class="small muted">Übungen, die diese Region typischerweise stark belasten, werden ersetzt. Ersetzt keine ärztliche Abklärung.</p></section>
  <section class="stack"><h3>Schwerpunkte (optional)</h3>${seg('prio',MUSCLES,p.prio,true)}<p class="small muted">+4 Sätze pro Woche für gewählte Muskeln. Höchstens 2–3 wählen.</p></section>
  <p id="pf_err" class="small" style="color:var(--bad)" hidden></p>
  <button class="primary big" type="submit">${isStart?'Plan erstellen':'Speichern und Plan neu berechnen'}</button>
 </form>`;
}
function readSeg(name){const el=$(`[data-seg="${name}"]`);const on=[...el.querySelectorAll('[aria-pressed="true"]')].map(b=>b.dataset.v);return el.dataset.multi==='1'?on:on[0]}
function bindProfileForm(onSave){
 const upd=()=>{const n=readSeg('weekdays').length;$('#splitinfo').textContent=n<2||n>6?'Bitte 2 bis 6 Tage wählen.':`${n} Tage → Split: ${SPLITNAME[n]}`};
 upd();
 $('#pf').addEventListener('click',ev=>{
  const b=ev.target.closest('[data-seg] button');
  if(b){const seg=b.parentElement;if(seg.dataset.multi==='1')b.setAttribute('aria-pressed',b.getAttribute('aria-pressed')==='true'?'false':'true');else seg.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));upd()}
  const pr=ev.target.closest('[data-act="eqpreset"]');
  if(pr){const sets={gym:Object.keys(EQUIP).filter(k=>k!=='band'),home:['dumbbell','bench','pullupbar','band'],bw:['pullupbar','band']}[pr.dataset.v];
   document.querySelectorAll('[data-seg="equipment"] button').forEach(x=>x.setAttribute('aria-pressed',String(sets.includes(x.dataset.v))))}
 });
 $('#pf').addEventListener('submit',ev=>{ev.preventDefault();
  const wd=readSeg('weekdays').map(Number).sort((a,b)=>a-b);
  const err=$('#pf_err');
  if(wd.length<2||wd.length>6){err.textContent='Bitte 2 bis 6 Trainingstage auswählen.';err.hidden=false;return}
  const p={...(S.profile||DEFAULT_PROFILE),name:$('#pf_name').value.trim(),sex:$('#pf_sex').value,age:+$('#pf_age').value||30,height:+$('#pf_height').value||175,weight:+$('#pf_weight').value||75,
   goal:readSeg('goal'),exp:readSeg('exp'),weekdays:wd,dur:+readSeg('dur'),equipment:readSeg('equipment'),limits:readSeg('limits'),prio:readSeg('prio')};
  onSave(p);
 });
}
function vStart(){
 $('#app').innerHTML=`<div class="stack-lg fade" style="padding-top:12px">
  <div class="stack"><h1>Dein Trainingsplan, aus deinen Daten berechnet</h1>
  <p class="muted prose">Formkurve erstellt einen Plan in Mesozyklen von 5 Wochen (4 Aufbauwochen, 1 Deload), steigert Gewichte automatisch nach deinen geloggten Sätzen und passt das Volumen an deine Erholung an. Die Regeln dahinter stehen unter <a href="#wissen">So rechnet Formkurve</a>.</p></div>
  ${profileForm(S.profile||DEFAULT_PROFILE,true)}</div>`;
 bindProfileForm(p=>{
  S.profile=p;S.plan=generatePlan(p,null);
  if(!S.body.length||S.body[S.body.length-1].kg!==p.weight){S.body=S.body.filter(b=>b.d!==todayISO());S.body.push({d:todayISO(),kg:p.weight})}
  Store.save('profile',S.profile);Store.save('plan',S.plan);Store.save('body',S.body);
  toast('Plan erstellt');go('heute');
 });
}

/* ---------- Ansicht: Heute ---------- */
function weekStrip(){
 const mon=mondayOf(new Date());const n=S.plan.days.length;let rot=nextDayIndex();const t=todayISO();
 const doneByDate={};S.sessions.forEach(s=>{(doneByDate[s.date]=doneByDate[s.date]||[]).push(s.dayName)});
 return `<div class="week">${WEEKDAYS.map((w,i)=>{const d=isoDate(addDays(mon,i));const planned=S.profile.weekdays.includes(i);let cls='wd',txt='Pause';
  if(doneByDate[d]){cls+=' done';txt='✓ '+doneByDate[d][0]}
  else if(planned&&d>=t){cls+=' plan';txt=S.plan.days[rot].name;rot=(rot+1)%n}
  else if(planned&&d>=S.plan.created.slice(0,10)){txt='verpasst'}
  if(d===t)cls+=' today';
  return `<div class="${cls}"><span class="small muted">${w}</span><b>${parseISO(d).getDate()}</b><span class="t">${esc(txt)}</span></div>`}).join('')}</div>`;
}
function vHeute(){
 const wk=mesoWeek();const di=nextDayIndex();const day=S.plan.days[di];
 const isToday=S.profile.weekdays.includes(wdIdx(new Date()));const doneToday=S.sessions.some(s=>s.date===todayISO());
 const last=S.sessions[S.sessions.length-1];const tr=bodyTrend();
 const estMin=day.ex.reduce((s,e)=>s+targetFor(e,wk).sets*(e.rest/60+0.8),0)+8;
 const name=S.profile.name?`, ${esc(S.profile.name)}`:'';
 const h=new Date().getHours();const greet=h<11?'Guten Morgen':h<18?'Hallo':'Guten Abend';
 $('#app').innerHTML=`<div class="stack-lg fade">
  <div class="stack"><h1>${greet}${name}</h1><p class="muted">${doneToday?'Heute schon trainiert. Erholung ist Teil des Plans.':isToday?'Heute ist Trainingstag.':'Heute ist kein Trainingstag geplant.'}</p></div>
  ${wk>5?`<div class="banner warn stack"><b>Mesozyklus ${S.plan.meso.n} ist abgeschlossen.</b><p class="small">Formkurve wertet Erholung und Trainingstreue aus und baut daraus den nächsten Zyklus.</p><div><button class="primary" data-act="newmeso">Nächsten Zyklus starten</button></div></div>`:''}
  ${wk===5?`<div class="banner"><b>Deload-Woche.</b> <span class="small">Etwa halbe Satzzahl, ~10 % weniger Gewicht, 4 Wiederholungen Reserve. Damit sich Ermüdung abbaut, bevor der nächste Zyklus startet.</span></div>`:''}
  <section class="stack"><div class="row between"><span class="label">Diese Woche</span><span class="small muted">${sessionsThisWeek().length} von ${S.profile.weekdays.length} Trainings</span></div>${weekStrip()}</section>
  <section class="card stack">
   <div class="row between"><div><span class="label">Nächstes Training</span><h2>${esc(day.name)}</h2></div><span class="chip">~${Math.round(estMin/5)*5} min</span></div>
   <div class="exl">${day.ex.map(e=>{const x=exById(e.id);const t=targetFor(e,wk);return `<div class="it"><div class="grow"><div class="nm">${esc(x.n)}</div><div class="tag">${MUSCLES[x.m]}</div></div><div class="num small" style="text-align:right">${t.sets} × ${t.lo}–${t.hi}<br><span class="muted">${t.w==null?'Gewicht testen':x.bw&&!t.w?'Körpergewicht':fmt(t.w)+' kg'} · RIR ${t.rir}</span></div></div>`}).join('')}</div>
   <button class="primary big" data-act="start" data-day="${di}">Training starten</button>
   <details><summary class="small">Anderes Training wählen</summary><div class="row" style="margin-top:8px">${S.plan.days.map((d,i)=>i===di?'':`<button data-act="start" data-day="${i}">${esc(d.name)}</button>`).join('')}</div></details>
  </section>
  <section class="stack"><span class="label">Körpergewicht</span>
   <div class="row"><input id="bw_in" type="number" inputmode="decimal" step="0.1" placeholder="kg heute" style="max-width:140px"><button data-act="bw">Eintragen</button>
   <span class="small muted grow">${tr&&tr.avg?`7-Tage-Schnitt ${fmt(tr.avg)} kg${tr.delta!=null?` · ${tr.delta>=0?'+':''}${fmt(tr.delta,2)} kg zur Vorwoche (${tr.pct>=0?'+':''}${fmt(tr.pct,2)} %)`:''}`:'Täglich morgens wiegen ergibt den verlässlichsten Trend.'}</span></div>
   ${tr&&tr.pct!=null?`<p class="small">${weightAdvice(tr.pct)}</p>`:''}
  </section>
  ${last?`<section class="stack"><span class="label">Letztes Training</span><div class="card flat stack"><div class="row between"><b>${esc(last.dayName)}</b><span class="small muted">${fmtDate(last.date)} · ${last.dur>0?last.dur+' min':'unter 1 min'}</span></div>
   <div class="small stack" style="gap:4px">${(last.results||[]).map(r=>`<div class="row between"><span>${esc(exById(r.id).n)}</span><span class="prog-${r.kind}">${esc(r.msg)}</span></div>`).join('')}</div></div></section>`:''}
 </div>`;
}
function weightAdvice(pct){
 const g=S.profile.goal;
 if(g==='fat'){if(pct>-0.3)return'Gewicht sinkt langsamer als die empfohlenen 0,5–1 % pro Woche. Kalorienzufuhr leicht senken oder Alltagsbewegung erhöhen.';if(pct<-1.2)return'Gewicht sinkt schneller als 1 % pro Woche. Das erhöht das Risiko, Muskulatur zu verlieren: etwas mehr essen.';return'Abnahmetempo liegt im empfohlenen Bereich von 0,5–1 % pro Woche.'}
 if(g==='hyp'){if(pct<0)return'Gewicht sinkt. Für Muskelaufbau ist ein leichter Überschuss sinnvoll (≈0,25–0,5 % pro Woche).';if(pct>0.7)return'Zunahme über 0,5 % pro Woche: vermutlich mehr Fett als nötig. Überschuss etwas reduzieren.';return'Zunahmetempo passt zum Muskelaufbau.'}
 return Math.abs(pct)>0.7?'Deutliche Gewichtsänderung diese Woche. Wenn das nicht gewollt ist, Ernährung prüfen.':'Gewicht stabil.';
}

/* ---------- Ansicht: Training ---------- */
function startWorkout(di){
 const draft=lsGet(LS+'_draft');
 if(draft&&draft.planCreated===S.plan.created){W=draft;go('training');return}
 const wk=mesoWeek();const day=S.plan.days[di];
 W={day:di,dayName:day.name,wk:Math.min(wk,5),start:Date.now(),planCreated:S.plan.created,readiness:null,light:false,
  entries:day.ex.map(e=>({id:e.id,rr:e.rr.slice(),rest:e.rest,sets:[]}))};
 go('training');
}
function buildSets(){
 W.entries.forEach((en,i)=>{const e=S.plan.days[W.day].ex[i]||{sets:[1,1,1,1,1],rr:en.rr,id:en.id};const t=targetFor({...e,id:en.id,rr:en.rr},W.wk,W.light);en.t=t;
  en.sets=Array.from({length:t.sets},()=>({w:t.w==null?'':t.w,r:'',rir:'',done:false,ph:t.reps}))});
}
function saveDraft(){lsSet(LS+'_draft',W)}
function vTraining(){
 if(!W.readiness){
  const q=[['sleep','Wie hast du geschlafen?',['schlecht','','ok','','super']],['sore','Muskelkater / Ermüdung?',['stark','','mittel','','keiner']],['energy','Energie & Motivation?',['leer','','normal','','voll da']]];
  $('#app').innerHTML=`<div class="stack-lg"><div class="stack"><span class="label">${esc(W.dayName)} · Woche ${W.wk}</span><h1>Kurzer Check vor dem Training</h1><p class="muted small prose">Bei schlechter Erholung reduziert Formkurve heute die Sätze um einen pro Übung und erhöht die Wiederholungsreserve. So steuert der Plan nach deiner Tagesform statt stur nach Kalender.</p></div>
  ${q.map(([k,l,a])=>`<section class="stack"><b>${l}</b><div class="seg" data-rd="${k}">${[1,2,3,4,5].map(v=>`<button type="button" data-v="${v}" aria-pressed="${v===3}">${v}${a[v-1]?' · '+a[v-1]:''}</button>`).join('')}</div></section>`).join('')}
  <div class="row"><button class="primary big" data-act="ready">Weiter</button></div><button class="ghost" data-act="cancelw">Abbrechen</button></div>`;
  return;
 }
 if(!W.entries[0]||!W.entries[0].t)buildSets();
 const allDone=W.entries.every(en=>en.sets.some(s=>s.done));
 $('#app').innerHTML=`<div class="stack-lg">
  <div class="stack"><span class="label">Woche ${W.wk}${W.wk===5?' · Deload':''}${W.light?' · leichter Tag':''}</span><h1>${esc(W.dayName)}</h1>
  ${W.light?`<div class="banner warn small">Erholung heute niedrig (Ø ${fmt(W.rscore)}). Ein Satz weniger pro Übung, RIR +1.</div>`:''}</div>
  ${W.entries.map((en,i)=>{const x=exById(en.id);const t=en.t;const p=S.prog[en.id];return `<section class="card stack" id="ex${i}">
   <div class="row between" style="align-items:flex-start"><div class="grow"><h3>${esc(x.n)}</h3><div class="tag">${MUSCLES[x.m]}${x.s.length?' · '+x.s.map(m=>MUSCLES[m]).join(', '):''}</div></div>
   <span class="chip acc num">${t.sets} × ${t.lo}–${t.hi} · RIR ${t.rir}</span></div>
   <p class="small muted">${t.w==null?`Erstes Mal: Wähle ein Gewicht, mit dem du ${t.lo} Wiederholungen schaffst und noch ${t.rir} weitere könntest. Formkurve übernimmt es ab dem nächsten Mal.`:`Ziel: ${t.reps} Wdh.${x.bw?(t.w?` mit ${fmt(t.w)} kg Zusatzlast`:''):` mit ${fmt(t.w)} kg`}. ${esc(x.cue)}`}</p>
   <div class="sets"><span class="h">#</span><span class="h">${x.bw?'+kg':'kg'}</span><span class="h">Wdh.</span><span class="h">RIR</span><span></span>
   ${en.sets.map((s,j)=>`<span class="n">${j+1}</span>
    <input class="${s.done?'setrow-done':''}" aria-label="Gewicht Satz ${j+1}" inputmode="decimal" type="number" step="0.5" min="0" data-f="w" data-e="${i}" data-s="${j}" value="${s.w}">
    <input aria-label="Wiederholungen Satz ${j+1}" inputmode="numeric" type="number" min="0" data-f="r" data-e="${i}" data-s="${j}" value="${s.r}" placeholder="${s.ph}">
    <select aria-label="Reserve Satz ${j+1}" data-f="rir" data-e="${i}" data-s="${j}"><option value="">–</option>${[0,1,2,3,4,5].map(v=>`<option${String(s.rir)===String(v)?' selected':''}>${v}</option>`).join('')}</select>
    <button class="chk" aria-label="Satz ${j+1} erledigt" aria-pressed="${s.done}" data-act="done" data-e="${i}" data-s="${j}"><svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg></button>`).join('')}
   </div>
   <div class="row"><button class="ghost small" data-act="addset" data-e="${i}">+ Satz</button>${en.sets.length>1?`<button class="ghost small" data-act="rmset" data-e="${i}">− Satz</button>`:''}${p&&p.last?`<span class="small muted grow" style="text-align:right">Letztes Mal: ${esc(p.last)}</span>`:''}</div>
  </section>`}).join('')}
  <p class="small muted">RIR = Wiederholungen in Reserve: wie viele saubere Wiederholungen du noch geschafft hättest. Leer lassen geht, dann bewertet Formkurve nur Gewicht und Wiederholungen.</p>
  <button class="primary big" data-act="finish" ${W.entries.some(en=>en.sets.some(s=>s.done))?'':'disabled'}>Training abschließen${allDone?'':' (unvollständig)'}</button>
  <button class="ghost danger" data-act="cancelw">Training verwerfen</button>
 </div>`;
}
let timerEnd=0,timerInt=null;
function startTimer(sec){timerEnd=Date.now()+sec*1000;clearInterval(timerInt);timerInt=setInterval(renderTimer,500);renderTimer()}
function renderTimer(){
 const el=$('#timer');const left=Math.round((timerEnd-Date.now())/1000);
 const onTraining=(location.hash==='#training');
 if(!timerEnd||!onTraining){el.hidden=true;if(!timerEnd)clearInterval(timerInt);return}
 if(left<=0){beep();timerEnd=0;clearInterval(timerInt);el.hidden=true;toast('Pause vorbei – nächster Satz');return}
 el.hidden=false;el.innerHTML=`<div class="in"><span class="small">Pause</span><span class="t">${Math.floor(left/60)}:${String(left%60).padStart(2,'0')}</span><button data-act="t+">+30 s</button><button data-act="tskip">Fertig</button></div>`;
}
let actx=null;
function beep(){try{actx=actx||new (window.AudioContext||window.webkitAudioContext)();const o=actx.createOscillator(),g=actx.createGain();o.frequency.value=880;g.gain.setValueAtTime(.15,actx.currentTime);g.gain.exponentialRampToValueAtTime(.001,actx.currentTime+.4);o.connect(g).connect(actx.destination);o.start();o.stop(actx.currentTime+.4)}catch(e){}}
let wakeLock=null;async function keepAwake(){try{wakeLock=await navigator.wakeLock.request('screen')}catch(e){}}
function finishWorkout(){
 const id=Date.now().toString(36);const results=[];
 W.entries.forEach((en,i)=>{
  const r=progressExercise(en,W.wk,W.light);if(!r)return;
  results.push({id:en.id,kind:r.kind,msg:r.msg});
  if(r.w!=null){const done=en.sets.filter(s=>s.done&&+s.r>0);
   S.prog[en.id]={w:r.w,reps:r.reps,fails:r.fails,last:done.map(s=>`${fmt(+s.w||0)}×${s.r}`).join(', ')}}
  else if(W.wk===5){const done=en.sets.filter(s=>s.done&&+s.r>0);if(S.prog[en.id])S.prog[en.id].last=done.map(s=>`${fmt(+s.w||0)}×${s.r}`).join(', ')}
 });
 const sess={id,ts:Date.now(),date:todayISO(),day:W.day,dayName:W.dayName,week:W.wk,meso:S.plan.meso.n,planCreated:S.plan.created,readiness:W.readiness,rscore:W.rscore,light:W.light,
  dur:Math.round((Date.now()-W.start)/60000),entries:W.entries.map(en=>({id:en.id,rr:en.rr,sets:en.sets.filter(s=>s.done).map(s=>({w:+s.w||0,r:+s.r||0,rir:s.rir===''?null:+s.rir,done:true}))})),results};
 S.sessions.push(sess);Store.save('s_'+id,sess);Store.save('prog',S.prog);
 lsDel(LS+'_draft');W=null;timerEnd=0;try{wakeLock&&wakeLock.release()}catch(e){}
 showSummary(sess);
}
function showSummary(sess){
 location.hash='heute';
 setTimeout(()=>{
  const prs=[];sess.entries.forEach(en=>{const best=Math.max(0,...en.sets.map(s=>e1rm(s.w,s.r,s.rir)));const prev=Math.max(0,...S.sessions.filter(s=>s.id!==sess.id).flatMap(s=>s.entries.filter(e=>e.id===en.id).flatMap(e=>e.sets.map(z=>e1rm(z.w,z.r,z.rir)))));if(best>0&&prev>0&&best>prev*1.005)prs.push(`${exById(en.id).n}: geschätztes 1RM ${fmt(best)} kg (vorher ${fmt(prev)})`)});
  const vol=sess.entries.reduce((s,e)=>s+e.sets.reduce((a,z)=>a+z.w*z.r,0),0);
  const el=document.createElement('section');el.className='banner good stack fade';
  el.innerHTML=`<b>Training gespeichert · ${sess.dur} min · ${sess.entries.reduce((s,e)=>s+e.sets.length,0)} Sätze · ${fmt(vol,0)} kg bewegt</b>${prs.length?`<div class="small"><b>Neue Bestwerte:</b><br>${prs.map(esc).join('<br>')}</div>`:''}<div class="small">Die Ziele fürs nächste Mal stehen unten unter „Letztes Training“.</div>`;
  $('#app .stack-lg').prepend(el);
 },30);
}

/* ---------- Ansicht: Plan ---------- */
let editKey=null;
function vPlan(){
 const wk=mesoWeek(),wi=weekIdx();const rir=RIR[S.profile.exp];
 $('#app').innerHTML=`<div class="stack-lg fade">
  <div class="stack"><span class="label">Mesozyklus ${S.plan.meso.n} · seit ${fmtDate(S.plan.meso.start)}</span><h1>${SPLITNAME[S.plan.split]||'Plan'}</h1>
  <p class="muted small">${GOALS[S.profile.goal]} · ${EXP[S.profile.exp]} · ${S.profile.weekdays.map(i=>WEEKDAYS[i]).join(', ')} · ${S.profile.dur} min</p></div>
  ${S.plan.days.some(d=>d.capped)?`<div class="banner warn small">Dein Zeitlimit von ${S.profile.dur} Minuten reicht nicht für das volle Wochenvolumen. Formkurve hat vor allem bei Bauch, Waden und Isolationsübungen gekürzt. Mehr Volumen gibt es mit längeren Einheiten oder einem weiteren Trainingstag.</div>`:''}
  <section class="stack"><span class="label">Zyklusverlauf</span>
   <div class="meso">${[0,1,2,3,4].map(i=>`<div class="mw ${i===wi&&wk<=5?'cur':i<wi||wk>5?'past':''}"><b>W${i+1}</b>${i===4?'Deload':Math.round(WF[i]*100)+' % Vol.'}<br>RIR ${rir[i]}</div>`).join('')}</div>
   <p class="small muted">Volumen steigt von Woche zu Woche, die Reserve sinkt. Woche 5 halbiert die Sätze, damit Ermüdung abklingt.</p>
   <div class="row"><button data-act="repeatweek">Woche wiederholen (Urlaub, Krankheit)</button></div>
  </section>
  ${S.plan.days.map((d,di)=>`<section class="card stack"><div class="row between"><h2>${esc(d.name)}</h2><span class="chip num">${d.ex.reduce((s,e)=>s+(e.sets[wi]||0),0)} Sätze</span></div>
   <div class="exl">${d.ex.map((e,ei)=>{const x=exById(e.id);const p=S.prog[e.id];const k=di+'_'+ei;return `<div class="it" style="flex-wrap:wrap"><div class="grow"><div class="nm">${esc(x.n)}</div><div class="tag">${MUSCLES[x.m]} · ${e.sets.slice(0,4).join('/')} Sätze (W1–4) · ${e.rr[0]}–${e.rr[1]} Wdh. · ${e.rest}s Pause${p&&p.w!=null?` · ${x.bw&&!p.w?'KG':fmt(p.w)+' kg'}`:''}</div></div><button class="ghost" data-act="edit" data-k="${k}" aria-expanded="${editKey===k}">Ändern</button>
    ${editKey===k?editor(di,ei):''}</div>`}).join('')}</div>
   <button class="ghost" data-act="addex" data-d="${di}" style="align-self:flex-start">+ Übung hinzufügen</button>
   ${editKey==='add_'+di?addEditor(di):''}
  </section>`).join('')}
  <section class="stack"><span class="label">Wochenvolumen-Ziele (Woche 3, Sätze pro Muskel)</span>
   <p class="small muted">${Object.entries(S.plan.T).map(([m,t])=>`${MUSCLES[m]} ${t}`).join(' · ')}</p></section>
  <section class="stack"><span class="label">Neu berechnen</span><p class="small muted">Erstellt den Plan aus deinem Profil neu. Arbeitsgewichte bleiben erhalten, eigene Änderungen an Sätzen gehen verloren.</p>
   <div class="row"><button data-act="regen">Plan neu berechnen</button><span id="regen_c"></span></div></section>
 </div>`;
}
function editor(di,ei){
 const e=S.plan.days[di].ex[ei];const x=exById(e.id);
 const eq=new Set(S.profile.equipment);
 const alts=EX.filter(a=>a.id!==e.id&&(a.p===x.p||a.m===x.m)&&a.eq.every(q=>eq.has(q))).sort((a,b)=>(a.p===x.p?0:1)-(b.p===x.p?0:1));
 return `<div class="edit stack" style="flex-basis:100%">
  <label class="f">Übung tauschen<select id="ed_swap"><option value="">${esc(x.n)} (aktuell)</option>${alts.map(a=>`<option value="${a.id}">${esc(a.n)}${(a.av||[]).some(l=>S.profile.limits.includes(l))?' ⚠ Beschwerden':''}</option>`).join('')}</select></label>
  <div class="grid2"><label class="f">Sätze Woche 1–4<input id="ed_sets" value="${e.sets.slice(0,4).join('/')}"></label>
  <label class="f">Wdh. von–bis<input id="ed_rr" value="${e.rr[0]}-${e.rr[1]}"></label>
  <label class="f">Pause (s)<input id="ed_rest" type="number" min="30" max="300" step="15" value="${e.rest}"></label>
  <label class="f">Arbeitsgewicht (kg)<input id="ed_w" type="number" step="0.5" min="0" value="${S.prog[e.id]&&S.prog[e.id].w!=null?S.prog[e.id].w:''}" placeholder="noch offen"></label></div>
  <div class="row"><button class="primary" data-act="edsave" data-d="${di}" data-e="${ei}">Übernehmen</button><button data-act="edcancel">Abbrechen</button><button class="ghost danger" data-act="edrm" data-d="${di}" data-e="${ei}">Entfernen</button></div></div>`;
}
function addEditor(di){
 const eq=new Set(S.profile.equipment);const used=new Set(S.plan.days[di].ex.map(e=>e.id));
 const opts=EX.filter(a=>!used.has(a.id)&&a.eq.every(q=>eq.has(q)));
 return `<div class="edit stack"><label class="f">Übung<select id="add_sel">${Object.keys(MUSCLES).map(m=>`<optgroup label="${MUSCLES[m]}">${opts.filter(a=>a.m===m).map(a=>`<option value="${a.id}">${esc(a.n)}</option>`).join('')}</optgroup>`).join('')}</select></label>
  <div class="row"><button class="primary" data-act="addsave" data-d="${di}">Hinzufügen</button><button data-act="edcancel">Abbrechen</button></div></div>`;
}

/* ---------- Ansicht: Fortschritt ---------- */
let selEx=null;
function lineChart(pts,{unit='kg',h=180}={}){
 if(pts.length<2)return `<p class="small muted">Noch zu wenige Datenpunkte. Ab zwei Einträgen erscheint hier der Verlauf.</p>`;
 const W0=640,H=h,pl=44,pr=14,pt=14,pb=26;
 const xs=pts.map(p=>parseISO(p.d).getTime()),ys=pts.map(p=>p.y);
 let x0=Math.min(...xs),x1=Math.max(...xs);if(x1===x0)x1=x0+86400000;
 let y0=Math.min(...ys),y1=Math.max(...ys);const pad=Math.max((y1-y0)*0.15,1);y0=Math.floor(y0-pad);y1=Math.ceil(y1+pad);
 const sx=x=>pl+(x-x0)/(x1-x0)*(W0-pl-pr),sy=y=>pt+(1-(y-y0)/(y1-y0))*(H-pt-pb);
 const ticks=4;let g='';for(let i=0;i<=ticks;i++){const v=y0+(y1-y0)*i/ticks;g+=`<line x1="${pl}" x2="${W0-pr}" y1="${sy(v)}" y2="${sy(v)}" stroke="var(--line)" stroke-width="1"/><text x="${pl-6}" y="${sy(v)+4}" text-anchor="end">${fmt(v,0)}</text>`}
 const xl=[x0,(x0+x1)/2,x1].map((x,i)=>`<text x="${sx(x)}" y="${H-6}" text-anchor="${['start','middle','end'][i]}">${new Date(x).toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'})}</text>`).join('');
 const path=pts.map((p,i)=>`${i?'L':'M'}${sx(xs[i]).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');
 const area=`${path} L${sx(xs[xs.length-1]).toFixed(1)},${sy(y0)} L${sx(xs[0]).toFixed(1)},${sy(y0)} Z`;
 const lx=sx(xs[xs.length-1]),ly=sy(ys[ys.length-1]);
 return `<svg class="chart" viewBox="0 0 ${W0} ${H}" role="img" aria-label="Verlauf in ${unit}">${g}${xl}<path d="${area}" fill="var(--accent)" fill-opacity=".1"/><path d="${path}" fill="none" stroke="var(--accent)" stroke-width="2.2" stroke-linejoin="round"/>${pts.map((p,i)=>`<circle cx="${sx(xs[i])}" cy="${sy(p.y)}" r="2.6" fill="var(--accent)"/>`).join('')}<circle cx="${lx}" cy="${ly}" r="5" fill="var(--surface)" stroke="var(--accent)" stroke-width="2.4"/><text x="${Math.min(lx,W0-pr-4)}" y="${Math.max(ly-10,12)}" text-anchor="end" style="fill:var(--fg);font-weight:600">${fmt(ys[ys.length-1])} ${unit}</text></svg>`;
}
function exHistory(id){
 const byDate={};S.sessions.forEach(s=>s.entries.filter(e=>e.id===id).forEach(e=>e.sets.forEach(z=>{const v=e1rm(z.w,z.r,z.rir);if(v>(byDate[s.date]||0))byDate[s.date]=v})));
 return Object.entries(byDate).sort().map(([d,y])=>({d,y}));
}
function vFortschritt(){
 const {done,plan}=weekVolume();const total=S.sessions.length;
 const mesoS=S.sessions.filter(s=>s.planCreated===S.plan.created&&s.meso===S.plan.meso.n);
 const weeksIn=Math.min(mesoWeek(),5);const planned=weeksIn*S.profile.weekdays.length;
 const rs=mesoS.map(s=>s.rscore).filter(Boolean);const avgR=rs.length?rs.reduce((a,b)=>a+b,0)/rs.length:null;
 const trained=[...new Set(S.sessions.flatMap(s=>s.entries.map(e=>e.id)))].filter(id=>!exById(id).bw&&exById(id).inc>0);
 if(!selEx||!trained.includes(selEx))selEx=trained[0]||null;
 const body=S.body.slice().sort((a,b)=>a.d<b.d?-1:1).map(b=>({d:b.d,y:b.kg}));
 $('#app').innerHTML=`<div class="stack-lg fade"><h1>Fortschritt</h1>
  <div class="kpis">
   <div class="kpi"><span class="label">Trainings gesamt</span><div class="v">${total}</div></div>
   <div class="kpi"><span class="label">Trainingstreue Zyklus</span><div class="v">${planned?Math.min(100,Math.round(mesoS.length/planned*100)):0} %</div><span class="small muted">${mesoS.length} von ${planned} geplant</span></div>
   <div class="kpi"><span class="label">Ø Erholung</span><div class="v">${avgR?fmt(avgR):'–'}<span class="small muted"> / 5</span></div></div>
   <div class="kpi"><span class="label">Körpergewicht</span><div class="v">${body.length?fmt(body[body.length-1].y):'–'}<span class="small muted"> kg</span></div></div>
  </div>
  <section class="stack"><span class="label">Kraftentwicklung (geschätztes 1RM)</span>
   ${trained.length?`<select id="exsel" aria-label="Übung wählen">${trained.map(id=>`<option value="${id}"${id===selEx?' selected':''}>${esc(exById(id).n)}</option>`).join('')}</select>${lineChart(exHistory(selEx))}<p class="small muted">Berechnet mit der Epley-Formel aus Gewicht × (Wiederholungen + Reserve). Ein Schätzwert, der Trends zeigt, kein echter Maximalversuch.</p>`:`<p class="small muted">Erscheint nach dem ersten Training mit Gewichten.</p>`}
  </section>
  <section class="stack"><div class="row between"><span class="label">Sätze pro Muskel, diese Woche</span><span class="small muted">erledigt / geplant</span></div>
   <div class="bars">${Object.keys(MUSCLES).filter(m=>plan[m]>0).map(m=>{const pc=Math.min(100,done[m]/plan[m]*100);return `<div class="bar"><span>${MUSCLES[m]}</span><div class="tr"><div class="fl ${pc>=95?'ok':''}" style="width:${pc}%"></div></div><span class="num small" style="text-align:right">${fmt(done[m])} / ${fmt(plan[m])}</span></div>`}).join('')}</div>
   <p class="small muted">Hilfsmuskeln zählen mit einem halben Satz (z. B. Trizeps beim Bankdrücken).</p></section>
  <section class="stack"><span class="label">Körpergewicht</span>${lineChart(body)}</section>
  <section class="stack"><span class="label">Verlauf</span>
   ${S.sessions.length?`<div class="overflow"><table class="t"><thead><tr><th>Datum</th><th>Training</th><th>Woche</th><th>Sätze</th><th>Erholung</th><th></th></tr></thead><tbody>${S.sessions.slice().reverse().slice(0,30).map(s=>`<tr><td>${fmtDate(s.date)}</td><td>${esc(s.dayName)}</td><td class="num">${s.week}</td><td class="num">${s.entries.reduce((a,e)=>a+e.sets.length,0)}</td><td class="num">${s.rscore?fmt(s.rscore):'–'}${s.light?' (leicht)':''}</td><td><button class="ghost small" data-act="delsess" data-id="${s.id}">Löschen</button></td></tr>`).join('')}</tbody></table></div>`:'<p class="small muted">Noch keine Trainings. Das erste startest du unter „Heute“.</p>'}
  </section></div>`;
}

/* ---------- Ansicht: Coach (Claude über die Anthropic-API, eigener API-Schlüssel) ---------- */
let chat=lsGet(LS+'_chat')||[];let sampling=false;let abortCtl=null;
const coachCfg=()=>Object.assign({key:'',model:'claude-opus-5-5'},lsGet(LS+'_coach')||{});
function coachContext(){
 const wk=mesoWeek();const p=S.profile;
 const plan=S.plan.days.map(d=>`${d.name}: `+d.ex.map(e=>{const x=exById(e.id);const pr=S.prog[e.id];return `${x.n} ${e.sets[weekIdx()]}x${e.rr[0]}-${e.rr[1]}${pr&&pr.w!=null?' @'+pr.w+'kg':''}`}).join('; ')).join('\n');
 const sess=S.sessions.slice(-10).map(s=>`${s.date} ${s.dayName} (W${s.week}, Erholung ${s.rscore||'?'}/5${s.light?', leichter Tag':''}): `+s.entries.map(e=>`${exById(e.id).n} `+e.sets.map(z=>`${z.w}x${z.r}${z.rir!=null?'@'+z.rir:''}`).join(',')).join(' | ')).join('\n');
 const tr=bodyTrend();const {done,plan:pl}=weekVolume();
 return `PROFIL: ${p.sex}, ${p.age} J., ${p.height} cm, Ziel ${GOALS[p.goal]}, ${EXP[p.exp]}, ${p.weekdays.length}x/Woche à ${p.dur} min, Ausrüstung: ${p.equipment.map(e=>EQUIP[e]).join(', ')||'keine'}, Beschwerden: ${p.limits.map(l=>LIMITS[l]).join(', ')||'keine'}, Schwerpunkte: ${p.prio.map(m=>MUSCLES[m]).join(', ')||'keine'}
MESOZYKLUS ${S.plan.meso.n}, aktuelle Woche ${wk} von 5 (W5 = Deload), Ziel-RIR diese Woche ${RIR[p.exp][weekIdx()]}
PLAN (Sätze diese Woche x Wdh-Bereich @ Arbeitsgewicht):
${plan}
WOCHENVOLUMEN erledigt/geplant: ${Object.keys(MUSCLES).map(m=>`${MUSCLES[m]} ${fmt(done[m])}/${fmt(pl[m])}`).join(', ')}
KÖRPERGEWICHT: ${S.body.slice(-14).map(b=>b.d+' '+b.kg).join(', ')||'keine Daten'}${tr&&tr.pct!=null?` (Trend ${fmt(tr.pct,2)} %/Woche)`:''}
LETZTE TRAININGS (Gewicht x Wdh @ RIR):
${sess||'noch keine'}`;
}
const COACH_SYS=`Du bist der Coach in der Trainings-App "Formkurve". Antworte auf Deutsch, direkt und ohne Floskeln oder Einleitungen. Begründe Empfehlungen trainingswissenschaftlich und nenne bei Fakten die Quelle (Autor, Jahr, Journal), wenn du sie sicher kennst; erfinde keine Quellen. Wenn der Nutzer etwas Falsches annimmt, sag es klar und korrigiere es mit Belegen. Beziehe dich konkret auf die Daten unten (Übungen, Gewichte, Wiederholungen, RIR, Erholung). Keine medizinischen Diagnosen; bei Schmerzen auf ärztliche Abklärung verweisen. Halte Antworten kurz (max. ~200 Wörter), nutze kurze Listen, wenn es hilft. Die App steuert Progression selbst (Doppelprogression mit RIR); schlage Änderungen vor, die der Nutzer im Plan-Tab umsetzen kann (Übung tauschen, Sätze, Wiederholungsbereich, Pause).`;
async function ask(q){
 const cfg=coachCfg();
 if(sampling||!cfg.key)return;sampling=true;abortCtl=new AbortController();
 chat.push({role:'user',content:q});chat.push({role:'assistant',content:''});vCoach();
 const history=chat.slice(-13,-1).filter(m=>m.content);
 while(history.length&&history[0].role!=='user')history.shift();
 try{
  const text=await askCoach({apiKey:cfg.key,model:cfg.model,system:COACH_SYS+'\n\nAKTUELLE DATEN DES NUTZERS:\n'+coachContext(),messages:history,signal:abortCtl.signal,
   onText:t=>{chat[chat.length-1].content=t;const el=$('#lastbubble');if(el)el.textContent=t}});
  chat[chat.length-1].content=text;
 }catch(e){chat[chat.length-1].content=e.userMessage||('Der Coach ist gerade nicht erreichbar: '+(e.message||e))}
 sampling=false;abortCtl=null;lsSet(LS+'_chat',chat.slice(-30));if(location.hash==='#coach')vCoach();
}
function vCoach(){
 const cfg=coachCfg();const avail=!!cfg.key;
 const quick=['Analysiere meine letzte Trainingswoche','Warum stagniert meine Kraft?','Passt mein Volumen zu meinem Ziel?','Wie viel Protein brauche ich?'];
 $('#app').innerHTML=`<div class="stack-lg fade"><div class="stack"><h1>Coach</h1><p class="muted small prose">Der Coach ist Claude von Anthropic. Er sieht dein Profil, deinen Plan, deine letzten 10 Trainings und dein Körpergewicht, berät dich und ändert selbst nichts. Vorschläge setzt du im Plan um.</p></div>
  ${avail?'':`<div class="banner warn stack small"><b>API-Schlüssel fehlt.</b><span>Der Coach braucht einen eigenen Schlüssel von der Anthropic-Konsole (console.anthropic.com → API Keys). Er wird nur auf diesem Gerät gespeichert und direkt an api.anthropic.com gesendet. Kosten laufen über dein Anthropic-Konto. Den Schlüssel trägst du unter <a href="#profil">Profil</a> ein.</span></div>`}
  <div class="chat">${chat.length?chat.map((m,i)=>`<div class="bubble ${m.role==='user'?'u':'a'} msg" ${i===chat.length-1&&m.role==='assistant'?'id="lastbubble"':''}>${esc(m.content||'…')}</div>`).join(''):`<p class="small muted">Noch keine Fragen. Starte mit einem Vorschlag:</p>`}</div>
  <div class="row">${quick.map(q=>`<button class="small" data-act="ask" data-q="${esc(q)}" ${avail&&!sampling?'':'disabled'}>${esc(q)}</button>`).join('')}</div>
  <form id="askf" class="row"><input id="askin" class="grow" placeholder="Frag deinen Coach …" ${avail?'':'disabled'}><button class="primary" ${avail&&!sampling?'':'disabled'}>Senden</button>${sampling?'<button type="button" data-act="stopask">Stopp</button>':''}</form>
  ${chat.length&&!sampling?`<button class="ghost small" data-act="clearchat" style="align-self:flex-start">Verlauf leeren</button>`:''}
 </div>`;
 $('#askf').addEventListener('submit',ev=>{ev.preventDefault();const v=$('#askin').value.trim();if(v)ask(v)});
}

/* ---------- Ansicht: Profil ---------- */
function vProfil(){
 $('#app').innerHTML=`<div class="stack-lg fade"><h1>Profil</h1>
  ${profileForm(S.profile,false)}
  <section class="stack"><span class="label">Daten</span>
   <p class="small muted">Deine Daten liegen nur auf diesem Gerät in diesem Browser, nichts geht an einen Server. ${Store.persisted?'Der Browser hat dauerhaften Speicher zugesagt.':'Auf dem iPhone die App über „Zum Home-Bildschirm“ installieren, sonst kann Safari Daten nach längerer Nichtnutzung löschen.'} Exportiere regelmäßig eine Sicherung, besonders vor einem Gerätewechsel.</p>
   <div class="row"><button data-act="export">Daten exportieren (JSON)</button><button data-act="import">Daten importieren</button></div>
   <div id="io"></div>
  </section>
  <section class="stack"><span class="label">Coach (Claude)</span>
   <div class="grid2"><label class="f">Anthropic API-Schlüssel<input id="ck_key" type="password" autocomplete="off" placeholder="sk-ant-…" value="${esc(coachCfg().key)}"></label>
   <label class="f">Modell<select id="ck_model">${Object.entries(COACH_MODELS).map(([k,l])=>`<option value="${k}"${coachCfg().model===k?' selected':''}>${esc(l)}</option>`).join('')}</select></label></div>
   <p class="small muted">Wird nur auf diesem Gerät gespeichert. Der Schlüssel erlaubt Zugriff auf dein Anthropic-Konto: lege am besten einen eigenen Schlüssel mit Ausgabenlimit an.</p>
   <div class="row"><button data-act="cksave">Coach-Einstellungen speichern</button>${coachCfg().key?'<button class="ghost danger" data-act="ckdel">Schlüssel entfernen</button>':''}</div>
  </section>
  <section class="stack"><span class="label">Wissen</span><p class="small"><a href="#wissen">So rechnet Formkurve: Regeln und Studien</a></p></section>
  <section class="stack"><span class="label">Zurücksetzen</span><div class="row"><button class="danger" data-act="reset">Alle Daten löschen</button><span id="reset_c"></span></div></section>
 </div>`;
 bindProfileForm(p=>{
  const old=S.profile;S.profile=p;
  const structural=['goal','exp','dur'].some(k=>old[k]!==p[k])||['weekdays','equipment','limits','prio'].some(k=>JSON.stringify(old[k])!==JSON.stringify(p[k]));
  if(structural){const keep=S.plan;S.plan=generatePlan(p,keep);S.plan.meso.n=keep.meso.n;S.plan.meso.start=keep.meso.start;Store.save('plan',S.plan)}
  if(old.weight!==p.weight){S.body=S.body.filter(b=>b.d!==todayISO());S.body.push({d:todayISO(),kg:p.weight});Store.save('body',S.body)}
  Store.save('profile',p);toast(structural?'Gespeichert, Plan neu berechnet':'Gespeichert');go('plan');
 });
}

/* ---------- Ansicht: Wissen ---------- */
function vWissen(){
 const src=[
  ['Schoenfeld, Ogborn, Krieger (2017). Dose-response relationship between weekly resistance training volume and increases in muscle mass. J Sports Sci 35(11).','https://doi.org/10.1080/02640414.2016.1210197'],
  ['Schoenfeld, Ogborn, Krieger (2016). Effects of resistance training frequency on measures of muscle hypertrophy. Sports Med 46(11).','https://doi.org/10.1007/s40279-016-0543-8'],
  ['Zourdos et al. (2016). Novel resistance training–specific RPE scale measuring repetitions in reserve. J Strength Cond Res 30(1).','https://doi.org/10.1519/JSC.0000000000001049'],
  ['Helms et al. (2016). Application of the repetitions in reserve-based RPE scale for resistance training. Strength Cond J 38(4).','https://doi.org/10.1519/SSC.0000000000000218'],
  ['ACSM (2009). Position Stand: Progression models in resistance training for healthy adults. Med Sci Sports Exerc 41(3).','https://doi.org/10.1249/MSS.0b013e3181915670'],
  ['Schoenfeld, Grgic et al. (2017). Strength and hypertrophy adaptations between low- vs. high-load resistance training. J Strength Cond Res 31(12).','https://doi.org/10.1519/JSC.0000000000002200'],
  ['Bell et al. (2023). Integrating deloading into strength and physique sports training programmes. Sports Med Open 9.','https://doi.org/10.1186/s40798-023-00633-0'],
  ['Greig et al. (2020). Autoregulation in resistance training: addressing the inconsistencies. Sports Med 50.','https://doi.org/10.1007/s40279-020-01330-8'],
  ['Helms, Aragon, Fitschen (2014). Evidence-based recommendations for natural bodybuilding contest preparation: nutrition and supplementation. JISSN 11:20.','https://doi.org/10.1186/1550-2783-11-20'],
  ['Iraki et al. (2019). Nutrition recommendations for bodybuilders in the off-season: a narrative review. Sports 7(7):154.','https://doi.org/10.3390/sports7070154']
 ];
 $('#app').innerHTML=`<div class="stack-lg fade prose"><div class="stack"><h1>So rechnet Formkurve</h1><p class="muted">Alle Regeln sind feste, nachvollziehbare Formeln. Nur der Coach-Tab nutzt ein Sprachmodell.</p></div>
  <section class="stack"><h3>1. Split nach Trainingstagen</h3><p>2–3 Tage: Ganzkörper. 4 Tage: Ober-/Unterkörper. 5 Tage: Ober/Unter plus Push/Pull/Beine. 6 Tage: Push/Pull/Beine zweimal. So wird jeder Muskel etwa zweimal pro Woche trainiert; die Meta-Analyse von Schoenfeld et al. (2016) fand bei 2× pro Woche mehr Muskelzuwachs als bei 1× bei vergleichbarem Volumen [2].</p></section>
  <section class="stack"><h3>2. Volumen pro Muskel und Woche</h3><p>Zielwert in Woche 3: Anfänger 10, Fortgeschrittene 13, Erfahrene 16 harte Sätze pro Muskel (Waden, Bauch, Gesäß 4 weniger, weil Kniebeuge und Hüftbeuge sie mittrainieren). Bei Fettabbau −2, für Schwerpunkt-Muskeln +4. Grundlage: Dosis-Wirkungs-Beziehung mit mehr Zuwachs ab etwa 10 Sätzen pro Woche [1]. Hilfsmuskeln zählen als halber Satz (z. B. Bizeps beim Rudern) und werden vom direkten Ziel abgezogen, mindestens die Hälfte bleibt direkt. Pro Training gilt eine Obergrenze von etwa 20 Sätzen pro Stunde; gekürzt wird zuerst bei Bauch, Waden und Isolation, nie unter 2 Sätze pro Übung.</p></section>
  <section class="stack"><h3>3. Mesozyklus mit 5 Wochen</h3><p>Volumen 80 → 90 → 100 → 110 % des Zielwerts, Wiederholungen in Reserve (RIR) 3 → 2 → 2 → 1 (Anfänger 3 → 3 → 2 → 2). Woche 5 ist ein Deload mit halber Satzzahl, ~10 % weniger Last und RIR 4. Deloads werden in der Praxis meist alle 4–8 Wochen eingesetzt, die Evidenz dazu stützt sich vor allem auf Expertenkonsens [7].</p></section>
  <section class="stack"><h3>4. Wiederholungsbereiche</h3><p>Muskelaufbau: Grundübungen 6–10, Isolation 10–15. Kraft: 3–6 bzw. 8–12. Fettabbau und Fitness: 8–12 bzw. 10–15/12–15. Muskelaufbau ist über weite Lastbereiche ähnlich, solange Sätze nah ans Muskelversagen gehen [6]; für Maximalkraft sind schwere Lasten überlegen [5][6].</p></section>
  <section class="stack"><h3>5. Automatische Progression (Doppelprogression)</h3><p>Nach jedem Training pro Übung: Alle Sätze am oberen Ende des Bereichs → Gewicht + Steigerungsschritt (Langhantel Beine 5 kg, Oberkörper 2,5 kg, Kurzhanteln 1–2 kg). Lag die Reserve dabei 2 oder mehr über dem Ziel, doppelter Schritt. Im Bereich → Gewicht halten, +1 Wiederholung als Ziel. Unter dem Bereich → gleiches Gewicht; beim zweiten Mal in Folge −10 % Reset. Das entspricht dem Progressionsmodell des ACSM (Last steigern, wenn die Zielwiederholungen übertroffen werden) [5] kombiniert mit RIR-Steuerung [3][4].</p></section>
  <section class="stack"><h3>6. Tagesform</h3><p>Vor jedem Training: Schlaf, Muskelkater, Energie (1–5). Liegt der Schnitt bei 2,3 oder darunter, gibt es einen Satz weniger pro Übung und RIR +1; ein verfehlter Bereich zählt dann nicht als Fehlversuch. Autoregulation nach Tagesform wird in der Literatur als Alternative zu starren Plänen diskutiert, die Studienlage ist uneinheitlich [8].</p></section>
  <section class="stack"><h3>7. Nächster Zyklus</h3><p>Nach Woche 5: Trainingstreue ≥ 80 % und Ø-Erholung ≥ 3,5 → +1 Satz pro Muskel und Woche. Erholung unter 2,5 → −2 Sätze. Sonst gleich. Übungen und Gewichte bleiben.</p></section>
  <section class="stack"><h3>8. Körpergewicht</h3><p>Trend aus 7-Tage-Mittelwerten. Fettabbau: 0,5–1 % pro Woche [9]. Muskelaufbau: etwa 0,25–0,5 % pro Woche [10].</p></section>
  <section class="stack"><h3>9. Geschätztes 1RM</h3><p>Epley-Formel: Gewicht × (1 + (Wiederholungen + RIR) / 30). Die Reserve wird addiert, weil ein Satz mit 2 RIR einem Satz mit 2 Wiederholungen mehr bis zum Versagen entspricht.</p></section>
  <section class="stack"><h3>Quellen</h3><ol class="src small">${src.map(([t,u])=>`<li>${esc(t)} <a href="${u}" target="_blank" rel="noopener">${u.replace('https://','')}</a></li>`).join('')}</ol></section>
 </div>`;
}

/* ---------- Aktionen ---------- */
document.addEventListener('click',async ev=>{
 const b=ev.target.closest('[data-act]');if(!b)return;const a=b.dataset.act;
 if(a==='start'){startWorkout(+b.dataset.day);return}
 if(a==='ready'){const r={};document.querySelectorAll('[data-rd]').forEach(s=>r[s.dataset.rd]=+s.querySelector('[aria-pressed="true"]').dataset.v);
  W.readiness=r;W.rscore=(r.sleep+r.sore+r.energy)/3;W.light=W.rscore<=2.34&&W.wk<5;buildSets();saveDraft();keepAwake();vTraining();window.scrollTo(0,0);return}
 if(b.closest('[data-rd]')){b.parentElement.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));return}
 if(a==='cancelw'){if(b.dataset.c!=='1'){b.dataset.c='1';b.textContent='Wirklich verwerfen? Nochmal tippen';return}W=null;lsDel(LS+'_draft');timerEnd=0;go('heute');return}
 if(a==='done'){const en=W.entries[+b.dataset.e];const s=en.sets[+b.dataset.s];
  if(!s.done&&(s.r===''||s.r==null)){s.r=s.ph}
  s.done=!s.done;saveDraft();if(s.done)startTimer(en.rest);const y=window.scrollY;vTraining();window.scrollTo(0,y);return}
 if(a==='addset'){const en=W.entries[+b.dataset.e];const l=en.sets[en.sets.length-1]||{w:'',ph:en.t.reps};en.sets.push({w:l.w,r:'',rir:'',done:false,ph:l.ph||en.t.reps});saveDraft();const y=window.scrollY;vTraining();window.scrollTo(0,y);return}
 if(a==='rmset'){const en=W.entries[+b.dataset.e];en.sets.pop();saveDraft();const y=window.scrollY;vTraining();window.scrollTo(0,y);return}
 if(a==='finish'){finishWorkout();return}
 if(a==='t+'){timerEnd+=30000;renderTimer();return}
 if(a==='tskip'){timerEnd=0;renderTimer();return}
 if(a==='bw'){const v=parseFloat(String($('#bw_in').value).replace(',','.'));if(!(v>30&&v<300)){toast('Bitte Gewicht in kg eingeben');return}
  S.body=S.body.filter(x=>x.d!==todayISO());S.body.push({d:todayISO(),kg:v});S.body.sort((x,y)=>x.d<y.d?-1:1);Store.save('body',S.body);S.profile.weight=v;Store.save('profile',S.profile);toast('Gewicht eingetragen');vHeute();return}
 if(a==='newmeso'){newMeso();return}
 if(a==='repeatweek'){S.plan.meso.start=isoDate(addDays(parseISO(S.plan.meso.start),7));Store.save('plan',S.plan);toast('Woche wird wiederholt');route();return}
 if(a==='edit'){editKey=editKey===b.dataset.k?null:b.dataset.k;vPlan();return}
 if(a==='edcancel'){editKey=null;vPlan();return}
 if(a==='edsave'){const e=S.plan.days[+b.dataset.d].ex[+b.dataset.e];const sw=$('#ed_swap').value;
  const sets=$('#ed_sets').value.split(/[\/,\s]+/).map(Number).filter(n=>n>0&&n<=10);
  const rr=$('#ed_rr').value.split(/[-–\s]+/).map(Number).filter(n=>n>0);
  const w=$('#ed_w').value;
  if(sw){e.id=sw;const x=exById(sw);e.rr=repRange(x,S.profile.goal);e.rest=restFor(x,S.profile.goal)}
  else{if(rr.length===2&&rr[0]<rr[1])e.rr=rr;}
  if(sets.length){for(let i=0;i<4;i++)e.sets[i]=sets[Math.min(i,sets.length-1)];e.sets[4]=Math.max(1,Math.round(e.sets[0]/2))}
  e.rest=+$('#ed_rest').value||e.rest;
  if(!sw&&w!==''){S.prog[e.id]={...(S.prog[e.id]||{}),w:+w,fails:0};Store.save('prog',S.prog)}
  Store.save('plan',S.plan);editKey=null;toast('Plan geändert');vPlan();return}
 if(a==='edrm'){S.plan.days[+b.dataset.d].ex.splice(+b.dataset.e,1);Store.save('plan',S.plan);editKey=null;vPlan();return}
 if(a==='addex'){editKey='add_'+b.dataset.d;vPlan();return}
 if(a==='addsave'){const id=$('#add_sel').value;if(!id)return;const x=exById(id);const d=S.plan.days[+b.dataset.d];
  d.ex.push({slot:100+d.ex.length,id,rr:repRange(x,S.profile.goal),rest:restFor(x,S.profile.goal),sets:[2,3,3,3,1]});Store.save('plan',S.plan);editKey=null;toast('Übung hinzugefügt');vPlan();return}
 if(a==='regen'){if(b.dataset.c!=='1'){b.dataset.c='1';b.textContent='Sicher? Nochmal tippen';return}
  const keep=S.plan;S.plan=generatePlan(S.profile,keep);S.plan.meso.n=keep.meso.n;S.plan.meso.start=keep.meso.start;Store.save('plan',S.plan);toast('Plan neu berechnet');vPlan();return}
 if(a==='delsess'){if(b.dataset.c!=='1'){b.dataset.c='1';b.textContent='Sicher?';return}S.sessions=S.sessions.filter(s=>s.id!==b.dataset.id);Store.del('s_'+b.dataset.id);vFortschritt();return}
 if(a==='ask'){ask(b.dataset.q);return}
 if(a==='stopask'){if(abortCtl)abortCtl.abort();return}
 if(a==='cksave'){lsSet(LS+'_coach',{key:$('#ck_key').value.trim(),model:$('#ck_model').value});toast('Coach-Einstellungen gespeichert');vProfil();return}
 if(a==='ckdel'){lsDel(LS+'_coach');toast('Schlüssel entfernt');vProfil();return}
 if(a==='clearchat'){chat=[];lsDel(LS+'_chat');vCoach();return}
 if(a==='export'){const txt=JSON.stringify(S);$('#io').innerHTML=`<div class="stack"><textarea id="io_t" readonly>${esc(txt)}</textarea><div class="row"><button data-act="copy">Kopieren</button><button data-act="save">Als Datei speichern</button></div></div>`;return}
 if(a==='copy'){const t=$('#io_t');try{await navigator.clipboard.writeText(t.value);toast('Kopiert')}catch(e){t.select();toast('Text markiert – jetzt kopieren')}return}
 if(a==='save'){const blob=new Blob([JSON.stringify(S,null,1)],{type:'application/json'});const u=URL.createObjectURL(blob);const l=document.createElement('a');l.href=u;l.download=`formkurve-${todayISO()}.json`;document.body.appendChild(l);l.click();l.remove();setTimeout(()=>URL.revokeObjectURL(u),2000);return}
 if(a==='import'){$('#io').innerHTML=`<div class="stack"><textarea id="io_i" placeholder="Exportierten JSON-Text hier einfügen"></textarea><div class="row"><button class="primary" data-act="doimport">Importieren und ersetzen</button></div></div>`;return}
 if(a==='doimport'){try{const v=JSON.parse($('#io_i').value);if(!v.profile||!v.plan)throw 0;S={profile:v.profile,plan:v.plan,prog:v.prog||{},body:v.body||[],sessions:v.sessions||[]};Store.save();toast('Importiert');go('heute')}catch(e){toast('Ungültige Daten')}return}
 if(a==='reset'){if(b.dataset.c!=='1'){b.dataset.c='1';b.textContent='Wirklich alles löschen? Nochmal tippen';return}
  ['profile','plan','prog','body'].forEach(k=>Store.del(k));S.sessions.forEach(s=>Store.del('s_'+s.id));S={profile:null,plan:null,prog:{},body:[],sessions:[]};lsDel(LS);lsDel(LS+'_draft');lsDel(LS+'_chat');chat=[];W=null;go('start');return}
});
document.addEventListener('input',ev=>{
 const t=ev.target;if(t.dataset.f&&W){const s=W.entries[+t.dataset.e].sets[+t.dataset.s];s[t.dataset.f]=t.value;saveDraft()}
});
document.addEventListener('change',ev=>{
 const t=ev.target;
 if(t.id==='exsel'){selEx=t.value;vFortschritt()}
 if(t.dataset.f==='w'&&W){const en=W.entries[+t.dataset.e];const j=+t.dataset.s;en.sets.forEach((s,k)=>{if(k>j&&!s.done){s.w=t.value;const el=document.querySelector(`[data-f="w"][data-e="${t.dataset.e}"][data-s="${k}"]`);if(el)el.value=t.value}});saveDraft()}
});
function newMeso(){
 const r=L.mesoReview(S);
 S.profile.volAdj=Math.max(-4,Math.min(8,(S.profile.volAdj||0)+r.delta));
 const keep=S.plan;S.plan=generatePlan(S.profile,keep);
 Store.save();
 toast(`Zyklus ${S.plan.meso.n} gestartet. ${r.why}`);route();
}

/* ---------- Start ---------- */
(async function boot(){
 await Store.init();
 S=Store.load();S.prog=S.prog||{};S.body=S.body||[];S.sessions=S.sessions||[];
 const draft=lsGet(LS+'_draft');if(draft&&S.plan&&draft.planCreated===S.plan.created)W=draft;
 route();
 if('serviceWorker' in navigator&&location.protocol!=='file:'){navigator.serviceWorker.register('./sw.js').catch(()=>{})}
})();
