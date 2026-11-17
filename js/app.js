// Formkurve – Oberfläche. Planlogik in logic.js, Stammdaten in data.js, Coach in coach.js.
import { MUSCLES, EQUIP, LIMITS, GOALS, EXP, WEEKDAYS, EX, exById, SPLITNAME, WF, MEDIA, MEDIA_NOTE, LEGS, LOCS, PATTERNS } from './data.js';
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
 // Ältere Datenstände auf das aktuelle Format bringen
 migrate(v){v.prog=v.prog||{};v.body=v.body||[];v.sessions=v.sessions||[];v.cal=v.cal||[];v.notes=v.notes||[];v.meta=v.meta||{};
  if(v.profile){const p=v.profile={...DEFAULT_PROFILE,...v.profile};
   if(!v.profile.limitLv||!Object.keys(p.limitLv).length){p.limitLv={};(p.limits||[]).forEach(l=>p.limitLv[l]=2)}
   p.limits=Object.keys(p.limitLv).filter(k=>p.limitLv[k]===2);p.mild=Object.keys(p.limitLv).filter(k=>p.limitLv[k]===1);
   if(!v.loc||(p.place!=='both'&&v.loc!==L.primaryLoc(p)))v.loc=L.primaryLoc(p)}
  if(v.plan&&!v.plan.loc)v.plan.loc=v.profile?L.primaryLoc(v.profile):'gym';
  return v},
 save(){if(!lsSet(LS,S))toast('Speichern fehlgeschlagen. Bitte Daten exportieren.')},
 del(){this.save()}
};

/* ---------- Zustand ---------- */
let S={profile:null,plan:null,prog:{},body:[],sessions:[],cal:[],notes:[],meta:{},loc:'gym'};
let W=null; // laufendes Training

const DEFAULT_PROFILE={name:'',sex:'m',age:30,height:180,weight:80,goal:'hyp',exp:'int',weekdays:[0,2,4,5],dur:60,equipment:['barbell','dumbbell','bench','cable','machine','pullupbar'],limits:[],prio:[],volAdj:0,
 place:'gym',equipHome:['dumbbell','bench','pullupbar','band'],limitLv:{},mild:[],sportDays:[],sportName:'',reentry:false,fav:[],ban:[],banWhy:{},mAdj:{},rirBias:0};

/* ---------- Planlogik (an aktuellen Zustand gebunden) ---------- */
const mesoWeek=()=>L.mesoWeek(S);
const weekIdx=()=>L.weekIdx(S);
const targetFor=(e,wk,light)=>L.targetFor(S,e,wk,light);
const progressExercise=(en,wk,light)=>L.progressExercise(S,en,wk,light);
const sessionsThisWeek=()=>L.sessionsThisWeek(S);
const nextDayIndex=()=>L.nextDayIndex(S);
const weekVolume=()=>L.weekVolume(S);
const bodyTrend=()=>L.bodyTrend(S);
const calWeek=()=>L.calWeek(S);
const rirRow=()=>L.rirRow(S);
const both=()=>S.profile.place==='both';
const loc=()=>both()?S.loc:L.primaryLoc(S.profile);
// e1RM mit der gemessenen Abweichung der eigenen RIR-Schätzung
const e1=(z)=>e1rm(z.w,z.r,z.rir==null||z.rir===''?0:(+z.rir)+(S.profile.rirBias||0));
const locSwitch=()=>both()?`<div class="seg loc" role="group" aria-label="Trainingsort">${Object.entries(LOCS).map(([k,l])=>`<button type="button" data-act="loc" data-v="${k}" aria-pressed="${loc()===k}">${l}</button>`).join('')}</div>`:'';

/* ---------- Routing ---------- */
const VIEWS=['heute','plan','fortschritt','coach','profil','wissen','training','start','uebungen','gewichte'];
function route(){
 let v=(location.hash||'#heute').slice(1);if(!VIEWS.includes(v))v='heute';
 if(!S.profile||!S.plan)v='start';
 if(v==='training'&&!W)v='heute';
 if(S.plan){const d=L.deloadDecision(S);if(d){S.plan.meso.deloadAt=d;Store.save()}}
 document.querySelectorAll('nav.tabs a').forEach(a=>a.setAttribute('aria-current',a.dataset.tab===v?'page':'false'));
 $('#tabs').hidden=v==='start';
 renderHeader();
 ({heute:vHeute,plan:vPlan,fortschritt:vFortschritt,coach:vCoach,profil:vProfil,wissen:vWissen,training:vTraining,start:vStart,uebungen:vUebungen,gewichte:vGewichte})[v]();
 renderTimer();
}
function go(v){if(location.hash==='#'+v)route();else location.hash=v}
window.addEventListener('hashchange',()=>{route();window.scrollTo(0,0)});
function renderHeader(){
 const h=$('#hdr');if(!S.plan){h.innerHTML='';return}
 const wk=mesoWeek();
 h.innerHTML=`${both()?`<span class="chip">${LOCS[loc()]}</span>`:''}<span class="chip ${wk>=5?'warn':'acc'}">${wk>5?'Zyklus fertig':wk===5?'Deload':'Aufbauwoche '+calWeek()}</span>`;
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
  <section class="stack"><h3>Trainingserfahrung</h3>${seg('exp',EXP,p.exp)}<p class="small muted">Regelmäßiges Krafttraining, nicht Sport allgemein. Bestimmt Startvolumen und Intensität. Bei Training mit Unterbrechungen die Summe der aktiven Zeit nehmen.</p>
   ${seg('reentry',{0:'Durchgehend im Training',1:'Wiedereinstieg nach längerer Pause'},p.reentry?1:0)}<p class="small muted">Wiedereinstieg: Der erste Zyklus startet mit 3 Sätzen weniger pro Muskel und mehr Reserve, weil ungewohnte Belastung nach einer Pause starken Muskelkater auslöst. Ab dem zweiten Zyklus gilt das normale Volumen.</p></section>
  <section class="stack"><h3>Trainingstage</h3>${seg('weekdays',Object.fromEntries(WEEKDAYS.map((d,i)=>[i,d])),p.weekdays.map(String),true)}<p class="small muted" id="splitinfo"></p></section>
  <section class="stack"><h3>Zeit pro Training</h3>${seg('dur',{45:'45 min',60:'60 min',75:'75 min',90:'90 min'},p.dur)}</section>
  <section class="stack"><h3>Trainingsort</h3>${seg('place',{gym:'Gym',home:'Zuhause',both:'Beides'},p.place)}
   <p class="small muted">Bei „Beides“ hat jede Übung im Plan eine Variante für jeden Ort. Du wechselst vor jedem Training oder im Plan zwischen Gym und Zuhause; Sätze und Wochenvolumen bleiben gleich, Gewichte werden pro Übung getrennt gesteigert.</p>
   <b class="small">Ausrüstung im Gym</b>
   <div class="row small"><span class="muted">Vorlage:</span><button type="button" class="ghost" data-act="eqpreset" data-t="equipment" data-v="gym">Fitnessstudio</button><button type="button" class="ghost" data-act="eqpreset" data-t="equipment" data-v="home">Hanteln</button></div>
   ${seg('equipment',EQUIP,p.equipment,true)}
   <b class="small">Ausrüstung zuhause</b>
   <div class="row small"><span class="muted">Vorlage:</span><button type="button" class="ghost" data-act="eqpreset" data-t="equipHome" data-v="home">Hanteln, Bank, Stange, Bänder</button><button type="button" class="ghost" data-act="eqpreset" data-t="equipHome" data-v="bw">Nur Körpergewicht</button></div>
   ${seg('equipHome',EQUIP,p.equipHome,true)}</section>
  <section class="stack"><h3>Beschwerden</h3>
   ${Object.entries(LIMITS).map(([k,l])=>`<div class="row"><span style="min-width:110px">${l}</span>${seg('lim_'+k,{0:'keine',1:'leicht / phasenweise',2:'stark'},(p.limitLv||{})[k]||0)}</div>`).join('')}
   <p class="small muted">Stark: belastende Übungen werden ausgeschlossen. Leicht oder phasenweise: schonendere Übungen werden bevorzugt, und vor jedem Training fragt Formkurve nach dem heutigen Zustand und ersetzt dann nur für diesen Tag. Ersetzt keine ärztliche Abklärung.</p></section>
  <section class="stack"><h3>Anderer Sport</h3>
   <label class="f">Sportart (optional)<input id="pf_sport" value="${esc(p.sportName||'')}" placeholder="z. B. Fußball"></label>
   ${seg('sportDays',Object.fromEntries(WEEKDAYS.map((d,i)=>[i,d])),(p.sportDays||[]).map(String),true)}
   <p class="small muted">Tage mit Training oder Spiel. Pro Sporttag 1 Satz weniger pro Beinmuskel und Woche (höchstens 3). Steht der Sport heute oder morgen an, zieht Formkurve ein Training ohne Beinschwerpunkt vor oder reduziert die Beinübungen.</p></section>
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
  if(pr){const sets={gym:Object.keys(EQUIP).filter(k=>k!=='band'),home:['dumbbell','bench','pullupbar','band'],bw:[]}[pr.dataset.v];
   document.querySelectorAll(`[data-seg="${pr.dataset.t}"] button`).forEach(x=>x.setAttribute('aria-pressed',String(sets.includes(x.dataset.v))))}
 });
 $('#pf').addEventListener('submit',ev=>{ev.preventDefault();
  const wd=readSeg('weekdays').map(Number).sort((a,b)=>a-b);
  const err=$('#pf_err');
  if(wd.length<2||wd.length>6){err.textContent='Bitte 2 bis 6 Trainingstage auswählen.';err.hidden=false;return}
  const p={...(S.profile||DEFAULT_PROFILE),name:$('#pf_name').value.trim(),sex:$('#pf_sex').value,age:+$('#pf_age').value||30,height:+$('#pf_height').value||175,weight:+$('#pf_weight').value||75,
   goal:readSeg('goal'),exp:readSeg('exp'),weekdays:wd,dur:+readSeg('dur'),equipment:readSeg('equipment'),prio:readSeg('prio'),
   place:readSeg('place'),equipHome:readSeg('equipHome'),reentry:readSeg('reentry')==='1',sportName:$('#pf_sport').value.trim(),sportDays:readSeg('sportDays').map(Number).sort((a,b)=>a-b)};
  p.limitLv={};Object.keys(LIMITS).forEach(k=>{const v=+readSeg('lim_'+k);if(v)p.limitLv[k]=v});
  p.limits=Object.keys(p.limitLv).filter(k=>p.limitLv[k]===2);p.mild=Object.keys(p.limitLv).filter(k=>p.limitLv[k]===1);
  if(p.place!=='both'||!S.loc)S.loc=L.primaryLoc(p);
  onSave(p);
 });
}
function vStart(){
 $('#app').innerHTML=`<div class="stack-lg fade" style="padding-top:12px">
  <div class="stack"><h1>Dein Trainingsplan, aus deinen Daten berechnet</h1>
  <p class="muted prose">Formkurve erstellt einen Plan in Mesozyklen (4 bis 6 Aufbauwochen, dann Deload nach Bedarf), steigert Gewichte automatisch nach deinen geloggten Sätzen und lernt aus deinem Feedback, wie viel Volumen jeder Muskel verträgt. Die Regeln dahinter stehen unter <a href="#wissen">So rechnet Formkurve</a>.</p></div>
  ${profileForm(S.profile||DEFAULT_PROFILE,true)}</div>`;
 bindProfileForm(p=>{
  S.profile=p;S.plan=generatePlan(p,null);
  if(!S.body.length||S.body[S.body.length-1].kg!==p.weight){S.body=S.body.filter(b=>b.d!==todayISO());S.body.push({d:todayISO(),kg:p.weight})}
  Store.save('profile',S.profile);Store.save('plan',S.plan);Store.save('body',S.body);
  toast('Plan erstellt');go('gewichte');
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
function plateauList(){
 const ack=S.meta.plAck||{};const lim=isoDate(addDays(new Date(),-28));
 return L.plateaus(S).filter(p=>!(ack[p.id]>lim));
}
function plateauCards(){
 return plateauList().slice(0,3).map(p=>{const x=exById(p.id);const e=S.plan.days.flatMap(d=>d.ex).find(z=>z.id===p.id||z.alt===p.id);const isAlt=e.id!==p.id;
  const lc=isAlt?(S.plan.loc==='gym'?'home':'gym'):(e.only||S.plan.loc);const alt=L.altFor(p.id,S.profile,lc,[]);const rr=isAlt?e.altRr:e.rr;const nr=newRange(rr);
  return `<div class="banner warn stack small"><span><b>Stagnation: ${esc(x.n)}.</b> Geschätztes 1RM seit 3 Einheiten nicht über ${fmt(p.best)} kg.</span>
   <div class="row">${alt?`<button data-act="plswap" data-id="${p.id}">Tauschen gegen ${esc(exById(alt).n)}</button>`:''}<button data-act="plrr" data-id="${p.id}">Wiederholungen ${nr[0]}–${nr[1]} statt ${rr[0]}–${rr[1]}</button><button class="ghost" data-act="plack" data-id="${p.id}">So lassen</button></div></div>`}).join('');
}
const newRange=rr=>rr[0]>=10?[6,10]:rr[0]>=6?[10,15]:[6,10];
// Übung im ganzen Plan ersetzen (beide Orte). ban: Übung zusätzlich sperren. Gibt den Namen des Ersatzes zurück.
function replaceEx(id,{ban=false,why=''}={}){
 const p=S.profile;let newName=null;const other=S.plan.loc==='gym'?'home':'gym';
 if(ban){p.ban=[...new Set([...(p.ban||[]),id])];p.banWhy={...(p.banWhy||{}),[id]:why};p.fav=(p.fav||[]).filter(f=>f!==id)}
 S.plan.days.forEach(d=>{d.ex.forEach(e=>{
  const fix=isAlt=>{const lc=isAlt?other:(e.only||S.plan.loc);
   const used=d.ex.map(z=>isAlt?z.alt:(z.only&&z.only!==lc?null:z.id)).filter(Boolean);
   const n=L.altFor(id,p,lc,[],used);
   if(isAlt){e.alt=n;if(n){const y=exById(n);e.altRr=repRange(y,p.goal);e.altRest=restFor(y,p.goal)}}
   else if(n){e.id=n;const y=exById(n);e.rr=repRange(y,p.goal);e.rest=restFor(y,p.goal)}else e.dead=true;
   if(n)newName=exById(n).n};
  if(e.alt===id)fix(true);if(e.id===id)fix(false)});
  d.ex=d.ex.map(e=>e.dead?(e.alt?{slot:e.slot,only:other,id:e.alt,rr:e.altRr,rest:e.altRest,sets:e.sets}:null):e).filter(Boolean)});
 return newName;
}
function vHeute(){
 const wk=mesoWeek();const pk=L.pickDay(S,loc());const di=pk.di;const day=S.plan.days[di];const view=L.dayAt(S.plan,di,loc());
 const isToday=S.profile.weekdays.includes(wdIdx(new Date()));const doneToday=S.sessions.some(s=>s.date===todayISO());
 const last=S.sessions[S.sessions.length-1];const tr=bodyTrend();
 const estMin=view.reduce((s,e)=>s+targetFor(e,wk).sets*(e.rest/60+0.8),0)+8;
 const name=S.profile.name?`, ${esc(S.profile.name)}`:'';
 const h=new Date().getHours();const greet=h<11?'Guten Morgen':h<18?'Hallo':'Guten Abend';
 const fat=wk<5?L.fatigue(S):{any:false};const cw=calWeek();
 const pr=L.proteinTarget(S.profile.weight);
 const lastExp=S.meta.lastExport||'';const needBackup=S.sessions.length>=3&&lastExp<isoDate(addDays(new Date(),-14));
 const missing=day.ex.length-view.length;
 $('#app').innerHTML=`<div class="stack-lg fade">
  <div class="stack"><h1>${greet}${name}</h1><p class="muted">${doneToday?'Heute schon trainiert. Erholung ist Teil des Plans.':isToday?'Heute ist Trainingstag.':'Heute ist kein Trainingstag geplant.'}</p></div>
  ${wk>5?`<div class="banner warn stack"><b>Mesozyklus ${S.plan.meso.n} ist abgeschlossen.</b><p class="small">Formkurve wertet pro Muskel dein Feedback und deinen Kraftverlauf aus und baut daraus den nächsten Zyklus.</p><div><button class="primary" data-act="newmeso">Nächsten Zyklus starten</button></div></div>`:''}
  ${wk===5?`<div class="banner"><b>Deload-Woche.</b> <span class="small">Etwa halbe Satzzahl, ~10 % weniger Gewicht, 4 Wiederholungen Reserve. Damit sich Ermüdung abbaut, bevor der nächste Zyklus startet.</span></div>`:''}
  ${wk<5&&fat.strong?`<div class="banner warn stack"><b>Ermüdungszeichen: Deload empfohlen.</b><span class="small">${esc(fat.reasons.join('; '))}.</span><div><button data-act="deloadnow">Deload-Woche jetzt starten</button></div></div>`:''}
  ${wk<5&&cw>=5&&!fat.strong?`<div class="banner small">Aufbauwoche ${cw}: keine Ermüdungszeichen, deshalb läuft der Aufbau mit dem Volumen von Woche 4 weiter. Deload spätestens in Woche 7 oder sobald Leistung oder Erholung fallen.</div>`:''}
  <section class="stack"><div class="row between"><span class="label">Diese Woche</span><span class="small muted">${sessionsThisWeek().length} von ${S.profile.weekdays.length} Trainings</span></div>${weekStrip()}</section>
  <section class="card stack">
   <div class="row between"><div><span class="label">Nächstes Training</span><h2>${esc(day.name)}</h2></div><span class="chip">~${Math.round(estMin/5)*5} min</span></div>
   ${locSwitch()}
   ${pk.why?`<div class="banner small">${esc(pk.why)}</div>`:''}
   <div class="exl">${view.map(e=>{const x=exById(e.id);const t=targetFor(e,wk);return `<div class="it"><div class="grow"><button class="link nm" data-act="exinfo" data-id="${x.id}">${esc(x.n)}</button><div class="tag">${MUSCLES[x.m]}</div></div><div class="num small" style="text-align:right">${t.sets} × ${t.lo}–${t.hi}<br><span class="muted">${t.w==null?'Gewicht testen':x.bw&&!t.w?'Körpergewicht':fmt(t.w)+' kg'} · RIR ${t.rir}</span></div></div>`}).join('')}</div>
   ${missing>0?`<p class="small muted">${missing} Übung${missing>1?'en':''} ohne Variante für ${LOCS[loc()]}. Im Plan kannst du dort eine ergänzen.</p>`:''}
   <button class="primary big" data-act="start" data-day="${di}">Training starten</button>
   <details><summary class="small">Anderes Training wählen</summary><div class="row" style="margin-top:8px">${S.plan.days.map((d,i)=>i===di?'':`<button data-act="start" data-day="${i}">${esc(d.name)}</button>`).join('')}</div></details>
  </section>
  ${plateauCards()}
  <section class="stack"><span class="label">Körpergewicht und Ernährung</span>
   <div class="row"><input id="bw_in" type="number" inputmode="decimal" step="0.1" placeholder="kg heute" style="max-width:140px"><button data-act="bw">Eintragen</button>
   <span class="small muted grow">${tr&&tr.avg?`7-Tage-Schnitt ${fmt(tr.avg)} kg${tr.delta!=null?` · ${tr.delta>=0?'+':''}${fmt(tr.delta,2)} kg zur Vorwoche (${tr.pct>=0?'+':''}${fmt(tr.pct,2)} %)`:''}`:'Täglich morgens wiegen ergibt den verlässlichsten Trend.'}</span></div>
   ${tr&&tr.pct!=null?`<p class="small">${weightAdvice(tr.pct)}</p>`:''}
   <p class="small muted">Protein-Ziel: ${pr[0]}–${pr[1]} g pro Tag (1,6–2,2 g pro kg bei ${fmt(S.profile.weight)} kg).</p>
  </section>
  ${last?`<section class="stack"><span class="label">Letztes Training</span><div class="card flat stack"><div class="row between"><b>${esc(last.dayName)}</b><span class="small muted">${fmtDate(last.date)} · ${last.dur>0?last.dur+' min':'unter 1 min'}</span></div>
   <div class="small stack" style="gap:4px">${(last.results||[]).map(r=>`<div class="row between"><span>${esc(exById(r.id).n)}</span><span class="prog-${r.kind}">${esc(r.msg)}</span></div>`).join('')}</div></div></section>`:''}
  ${needBackup?`<div class="banner small stack"><span><b>Sicherung fällig.</b> Deine Daten liegen nur auf diesem Gerät${lastExp?`, letzte Sicherung am ${fmtDate(lastExp)}`:' und wurden noch nie gesichert'}.</span><div><button data-act="save">Jetzt als Datei sichern</button></div></div>`:''}
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
 W={day:di,dayName:day.name,wk:Math.min(wk,5),start:Date.now(),planCreated:S.plan.created,readiness:null,light:false,loc:loc(),flare:[],mins:0,notes:[],
  legLight:!!L.sportSoon(S)&&L.legShare(S,di,loc())>0,entries:[]};
 go('training');
}
// Übungen des Tages für Ort, heutige Beschwerden, Tagesform und verfügbare Zeit zusammenstellen
function buildEntries(){
 const view=L.dayAt(S.plan,W.day,W.loc);const used=view.map(v=>v.id);W.notes=[];const g=S.profile.goal;
 let list=view.map(v=>{let id=v.id,rr=v.rr,rest=v.rest;const x=exById(id);
  if((x.av||[]).some(a=>W.flare.includes(a))){const alt=L.altFor(id,S.profile,W.loc,W.flare,used);
   if(alt){used.push(alt);W.notes.push(`${x.n} → ${exById(alt).n} (${W.flare.map(f=>LIMITS[f]).join(', ')} heute)`);id=alt;const y=exById(alt);rr=repRange(y,g);rest=restFor(y,g)}
   else W.notes.push(`${x.n}: kein schonender Ersatz verfügbar. Bei Schmerz auslassen.`)}
  const t=targetFor({id,rr,sets:v.sets},W.wk,W.light);
  if(W.legLight&&!W.light&&W.wk<5&&LEGS.includes(exById(id).m)){t.sets=Math.max(1,t.sets-1);t.rir+=1}
  return {id,rr:rr.slice(),rest,t,sets:t.sets}});
 if(W.legLight&&!W.light&&W.wk<5)W.notes.push(`${S.profile.sportName||'Sport'} ${L.sportSoon(S)||'bald'}: Beinübungen mit einem Satz weniger und RIR +1.`);
 if(W.mins){const n0=list.length,s0=list.reduce((a,e)=>a+e.sets,0);list=L.trimToTime(list,W.mins);const s1=list.reduce((a,e)=>a+e.sets,0);
  if(s1<s0||list.some(e=>e.ss))W.notes.push(`Kurzes Training (${W.mins} min): ${s0-s1} Sätze gekürzt${n0>list.length?`, ${n0-list.length} Übung${n0-list.length>1?'en':''} gestrichen`:''}${list.some(e=>e.ss)?', Isolationsübungen als Supersatz':''}.`)}
 W.entries=list.map(e=>({id:e.id,rr:e.rr,rest:e.rest,ss:!!e.ss,cal:false,fb:{},t:{...e.t,sets:e.sets},sets:Array.from({length:e.sets},()=>({w:e.t.w==null?'':e.t.w,r:'',rir:'',done:false,ph:e.t.reps}))}));
}
function saveDraft(){lsSet(LS+'_draft',W)}
const calDone=id=>S.cal.some(c=>c.id===id&&c.meso===S.plan.meso.n);
const calOk=(en,x)=>W.wk>=2&&W.wk<=4&&!W.light&&x.t==='i'&&x.inc>0&&en.sets.length>=2&&!calDone(en.id)&&(en.cal||W.entries.filter(z=>z.cal).length<2);
function vTraining(){
 if(!W.readiness){
  const q=[['sleep','Wie hast du geschlafen?',['schlecht','','ok','','super']],['sore','Muskelkater / Ermüdung?',['stark','','mittel','','keiner']],['energy','Energie & Motivation?',['leer','','normal','','voll da']]];
  const pre=(k,l,opts,val)=>`<section class="stack"><b>${l}</b><div class="seg" data-pre="${k}">${Object.entries(opts).map(([v,t])=>`<button type="button" data-v="${v}" aria-pressed="${String(v)===String(val)}">${t}</button>`).join('')}</div></section>`;
  const lim=Object.keys(S.profile.limitLv||{});
  $('#app').innerHTML=`<div class="stack-lg"><div class="stack"><span class="label">${esc(W.dayName)} · ${W.wk===5?'Deload':'Aufbauwoche '+calWeek()}</span><h1>Kurzer Check vor dem Training</h1><p class="muted small prose">Formkurve stellt das Training nach Ort, Zeit, Tagesform und Beschwerden zusammen. Bei schlechter Erholung gibt es einen Satz weniger pro Übung und mehr Reserve.</p></div>
  ${both()?pre('loc','Wo trainierst du heute?',LOCS,W.loc):''}
  ${pre('mins','Wie viel Zeit hast du?',{0:`Normal (${S.profile.dur} min)`,45:'45 min',30:'30 min',20:'20 min'},0)}
  ${q.map(([k,l,a])=>`<section class="stack"><b>${l}</b><div class="seg" data-rd="${k}">${[1,2,3,4,5].map(v=>`<button type="button" data-v="${v}" aria-pressed="${v===3}">${v}${a[v-1]?' · '+a[v-1]:''}</button>`).join('')}</div></section>`).join('')}
  ${lim.map(k=>pre('fl_'+k,`${LIMITS[k]} heute?`,{0:'ohne Beschwerden',1:'leicht spürbar',2:'deutlich'},0)).join('')}
  ${lim.length?`<p class="small muted">Bei Beschwerden ersetzt Formkurve heute Übungen, die diese Region stark belasten. Der Plan selbst bleibt unverändert.</p>`:''}
  <div class="row"><button class="primary big" data-act="ready">Weiter</button></div><button class="ghost" data-act="cancelw">Abbrechen</button></div>`;
  return;
 }
 const allDone=W.entries.every(en=>en.sets.some(s=>s.done));
 const firstC=W.entries.findIndex(en=>{const x=exById(en.id);return x.t==='c'&&!x.bw&&en.t.w>=20});
 $('#app').innerHTML=`<div class="stack-lg">
  <div class="stack"><span class="label">${W.wk===5?'Deload':'Aufbauwoche '+calWeek()}${both()?' · '+LOCS[W.loc]:''}${W.light?' · leichter Tag':''}</span><h1>${esc(W.dayName)}</h1>
  ${W.light?`<div class="banner warn small">Erholung heute niedrig (Ø ${fmt(W.rscore)}). Ein Satz weniger pro Übung, RIR +1.</div>`:''}
  ${(W.notes||[]).map(n=>`<div class="banner small">${esc(n)}</div>`).join('')}</div>
  ${W.entries.map((en,i)=>{const x=exById(en.id);const t=en.t;const p=S.prog[en.id];en.fb=en.fb||{};
   const wu=L.warmup(t.w,x,i===firstC);const pl=x.eq.includes('barbell')&&t.w?L.plates(t.w):null;const anyDone=en.sets.some(s=>s.done);
   const fbSeg=(k,l,opts)=>`<div class="fbrow"><span class="small muted">${l}</span><div class="seg" data-fb="${k}" data-e="${i}">${Object.entries(opts).map(([v,tx])=>`<button type="button" data-v="${v}" aria-pressed="${String(en.fb[k])===String(v)}">${tx}</button>`).join('')}</div></div>`;
   return `<section class="card stack" id="ex${i}">
   <div class="row between" style="align-items:flex-start"><div class="grow"><h3><button class="link" data-act="exinfo" data-id="${x.id}">${esc(x.n)} <span class="small">Ausführung</span></button></h3><div class="tag">${MUSCLES[x.m]}${x.s.length?' · '+x.s.map(m=>MUSCLES[m]).join(', '):''}</div></div>
   <span class="chip acc num">${t.sets} × ${t.lo}–${t.hi} · RIR ${t.rir}</span></div>
   <p class="small muted">${t.w==null?`Erstes Mal: Wähle ein Gewicht, mit dem du ${t.lo} Wiederholungen schaffst und noch ${t.rir} weitere könntest. Formkurve übernimmt es ab dem nächsten Mal.`:`Ziel: ${t.reps} Wdh.${x.bw?(t.w?` mit ${fmt(t.w)} kg Zusatzlast.`:''):` mit ${fmt(t.w)} kg.`} ${esc(x.cue)}`}</p>
   ${wu.length?`<p class="small"><b>Aufwärmen:</b> ${wu.map(([w,r])=>`${fmt(w)} kg × ${r}`).join(' · ')}</p>`:''}
   ${pl&&pl.length?`<p class="small muted">Scheiben pro Seite (20-kg-Stange): ${pl.map(v=>fmt(v,2)).join(' + ')}</p>`:''}
   ${en.ss?`<div class="banner small">Supersatz: nach jedem Satz ohne Pause zur nächsten Übung wechseln.</div>`:''}
   ${en.cal?`<div class="banner warn small"><b>Kalibrierung:</b> Den letzten Satz bis zum Muskelversagen ausführen, also bis keine saubere Wiederholung mehr geht. Bei den Sätzen davor die RIR wie gewohnt schätzen.</div>`:''}
   <div class="sets"><span class="h">#</span><span class="h">${x.bw?'+kg':'kg'}</span><span class="h">Wdh.</span><span class="h">RIR</span><span></span>
   ${en.sets.map((s,j)=>`<span class="n">${j+1}</span>
    <input class="${s.done?'setrow-done':''}" aria-label="Gewicht Satz ${j+1}" inputmode="decimal" type="number" step="0.5" min="0" data-f="w" data-e="${i}" data-s="${j}" value="${s.w}">
    <input aria-label="Wiederholungen Satz ${j+1}" inputmode="numeric" type="number" min="0" data-f="r" data-e="${i}" data-s="${j}" value="${s.r}" placeholder="${en.cal&&j===en.sets.length-1?'max':s.ph}">
    <select aria-label="Reserve Satz ${j+1}" data-f="rir" data-e="${i}" data-s="${j}"><option value="">–</option>${[0,1,2,3,4,5].map(v=>`<option${String(s.rir)===String(v)?' selected':''}>${v}</option>`).join('')}</select>
    <button class="chk" aria-label="Satz ${j+1} erledigt" aria-pressed="${s.done}" data-act="done" data-e="${i}" data-s="${j}"><svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg></button>`).join('')}
   </div>
   <div class="row"><button class="ghost small" data-act="addset" data-e="${i}">+ Satz</button>${en.sets.length>1?`<button class="ghost small" data-act="rmset" data-e="${i}">− Satz</button>`:''}${calOk(en,x)?`<button class="ghost small" data-act="caltoggle" data-e="${i}">${en.cal?'Kalibrierung aus':'RIR kalibrieren'}</button>`:''}${p&&p.last?`<span class="small muted grow" style="text-align:right">Letztes Mal: ${esc(p.last)}</span>`:''}</div>
   ${anyDone?`<div class="fb stack">${fbSeg('pain','Gelenkschmerz',{0:'keiner',1:'leicht',2:'deutlich'})}${fbSeg('feel','Muskelgefühl',{1:'kaum',2:'gut',3:'stark'})}${fbSeg('load','Belastung',{1:'leicht',2:'passend',3:'zu viel'})}</div>`:''}
  </section>`}).join('')}
  <p class="small muted">RIR = Wiederholungen in Reserve: wie viele saubere Wiederholungen du noch geschafft hättest. Die drei Rückmeldungen pro Übung steuern Übungsauswahl und das Volumen pro Muskel im nächsten Zyklus.</p>
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
 const id=Date.now().toString(36);const results=[];const lastLine=en=>en.sets.filter(s=>s.done&&+s.r>0).map(s=>`${fmt(+s.w||0)}×${s.r}`).join(', ');
 W.entries.forEach(en=>{
  en.fb=en.fb||{};
  // Kalibrierungssatz: der Satz bis zum Versagen zählt für die Progression als RIR 0
  let calMsg='';
  if(en.cal){const d=en.sets.filter(s=>s.done&&+s.r>0);if(d.length)d[d.length-1].rir=0;const b=L.calibration(en.sets);
   if(b!=null){S.cal.push({d:todayISO(),id:en.id,meso:S.plan.meso.n,bias:b});S.profile.rirBias=L.rirBias(S.cal);
    calMsg=` · Kalibrierung: ${b>0?`${b} Wdh. mehr als geschätzt`:b<0?`${-b} Wdh. weniger als geschätzt`:'Schätzung traf zu'}`}}
  const r=progressExercise(en,W.wk,W.light);if(!r)return;
  results.push({id:en.id,kind:r.kind,msg:r.msg+calMsg});
  if(r.w!=null)S.prog[en.id]={w:r.w,reps:r.reps,fails:r.fails,last:lastLine(en)};
  else if(S.prog[en.id])S.prog[en.id].last=lastLine(en);
  // Schmerz: deutlich oder zweimal in Folge leicht → Übung sperren und im Plan ersetzen
  const prev=S.sessions.slice().reverse().map(s=>s.entries.find(e=>e.id===en.id)).find(Boolean);
  if(en.fb.pain>=2||(en.fb.pain===1&&prev&&prev.fb&&prev.fb.pain>=1)){
   const n=replaceEx(en.id,{ban:true,why:'Schmerz am '+fmtDate(todayISO())});
   results.push({id:en.id,kind:'warn',msg:n?`Wegen Schmerz gesperrt, im Plan ersetzt durch ${n}`:'Wegen Schmerz gesperrt und aus dem Plan genommen'})}
 });
 const sess={id,ts:Date.now(),date:todayISO(),day:W.day,dayName:W.dayName,week:W.wk,meso:S.plan.meso.n,planCreated:S.plan.created,readiness:W.readiness,rscore:W.rscore,light:W.light,
  loc:W.loc,mins:W.mins||0,legLight:!!W.legLight,flare:W.flare||[],
  dur:Math.round((Date.now()-W.start)/60000),entries:W.entries.map(en=>({id:en.id,rr:en.rr,fb:en.fb,sets:en.sets.filter(s=>s.done).map(s=>({w:+s.w||0,r:+s.r||0,rir:s.rir===''?null:+s.rir,done:true}))})).filter(e=>e.sets.length),results};
 S.sessions.push(sess);Store.save();
 lsDel(LS+'_draft');W=null;timerEnd=0;try{wakeLock&&wakeLock.release()}catch(e){}
 showSummary(sess);
}
function showSummary(sess){
 location.hash='heute';
 setTimeout(()=>{
  const prs=[];sess.entries.forEach(en=>{const best=Math.max(0,...en.sets.map(e1));const prev=Math.max(0,...S.sessions.filter(s=>s.id!==sess.id).flatMap(s=>s.entries.filter(e=>e.id===en.id).flatMap(e=>e.sets.map(e1))));if(best>0&&prev>0&&best>prev*1.005)prs.push(`${exById(en.id).n}: geschätztes 1RM ${fmt(best)} kg (vorher ${fmt(prev)})`)});
  const vol=sess.entries.reduce((s,e)=>s+e.sets.reduce((a,z)=>a+z.w*z.r,0),0);
  const el=document.createElement('section');el.className='banner good stack fade';
  el.innerHTML=`<b>Training gespeichert · ${sess.dur} min · ${sess.entries.reduce((s,e)=>s+e.sets.length,0)} Sätze · ${fmt(vol,0)} kg bewegt</b>${prs.length?`<div class="small"><b>Neue Bestwerte:</b><br>${prs.map(esc).join('<br>')}</div>`:''}<div class="small">Die Ziele fürs nächste Mal stehen unten unter „Letztes Training“.</div>`;
  $('#app .stack-lg').prepend(el);
 },30);
}

/* ---------- Ansicht: Plan ---------- */
let editKey=null;
const otherLoc=()=>loc()==='gym'?'home':'gym';
const eqOk=(x,lc)=>x.eq.every(q=>L.equipFor(S.profile,lc).includes(q));
function vPlan(){
 const wk=mesoWeek(),wi=weekIdx();const rir=rirRow();const cw=calWeek();const rv=S.meta.lastReview;const lc=loc();
 $('#app').innerHTML=`<div class="stack-lg fade">
  <div class="stack"><span class="label">Mesozyklus ${S.plan.meso.n} · seit ${fmtDate(S.plan.meso.start)}</span><h1>${SPLITNAME[S.plan.split]||'Plan'}</h1>
  <p class="muted small">${GOALS[S.profile.goal]} · ${EXP[S.profile.exp]}${S.plan.reentry?' · Wiedereinstieg':''} · ${S.profile.weekdays.map(i=>WEEKDAYS[i]).join(', ')} · ${S.profile.dur} min${(S.profile.sportDays||[]).length?` · ${esc(S.profile.sportName||'Sport')}: ${S.profile.sportDays.map(i=>WEEKDAYS[i]).join(', ')}`:''}</p>
  ${locSwitch()}</div>
  ${S.plan.days.some(d=>d.capped)?`<div class="banner warn small">Dein Zeitlimit von ${S.profile.dur} Minuten reicht nicht für das volle Wochenvolumen. Formkurve hat vor allem bei Bauch, Waden und Isolationsübungen gekürzt. Mehr Volumen gibt es mit längeren Einheiten oder einem weiteren Trainingstag.</div>`:''}
  <section class="stack"><span class="label">Zyklusverlauf</span>
   <div class="meso">${[0,1,2,3,4].map(i=>`<div class="mw ${i===wi&&wk<=5?'cur':i<wi||wk>5?'past':''}"><b>${i===4?'Deload':i===3?'W4+':'W'+(i+1)}</b>${i===4?'bei Bedarf':Math.round(WF[i]*100)+' % Vol.'}<br>RIR ${rir[i]}</div>`).join('')}</div>
   <p class="small muted">${wk>5?'Zyklus abgeschlossen.':wk===5?`Deload in Woche ${cw}.`:`Aufbauwoche ${cw}.`} Volumen steigt bis Woche 4 und bleibt dann auf diesem Stand. Der Deload kommt, sobald Leistung oder Erholung fallen, frühestens automatisch ab Woche 5 und spätestens in Woche 7.</p>
   <div class="row"><button data-act="repeatweek">Woche wiederholen (Urlaub, Krankheit)</button>${wk<5?`<button data-act="deloadnow">Deload jetzt starten</button>`:''}</div>
  </section>
  ${rv?`<section class="stack"><span class="label">Auswertung des letzten Zyklus (${fmtDate(rv.d)})</span><p class="small muted">Trainingstreue ${Math.round(rv.adh*100)} %, Erholung Ø ${fmt(rv.avg)}. ${rv.lines.length?'Änderung der Wochensätze: '+rv.lines.map(esc).join(' · '):'Volumen unverändert.'}</p></section>`:''}
  ${S.plan.days.map((d,di)=>{const view=L.dayAt(S.plan,di,lc);const miss=d.ex.map((e,ei)=>[e,ei]).filter(([e])=>!L.viewAt(e,S.plan,lc)&&!e.only);
   return `<section class="card stack"><div class="row between"><h2>${esc(d.name)}</h2><span class="chip num">${view.reduce((s,e)=>s+(e.sets[wi]||0),0)} Sätze</span></div>
   <div class="exl">${view.map(e=>{const x=exById(e.id);const p=S.prog[e.id];const k=di+'_'+e.ei;return `<div class="it" style="flex-wrap:wrap"><div class="grow"><button class="link nm" data-act="exinfo" data-id="${x.id}">${esc(x.n)}</button><div class="tag">${MUSCLES[x.m]} · ${e.sets.slice(0,4).join('/')} Sätze (W1–4) · ${e.rr[0]}–${e.rr[1]} Wdh. · ${e.rest}s Pause${p&&p.w!=null?` · ${x.bw&&!p.w?'KG':fmt(p.w)+' kg'}`:''}</div></div><button class="ghost" data-act="edit" data-k="${k}" aria-expanded="${editKey===k}">Ändern</button>
    ${editKey===k?editor(di,e.ei):''}</div>`}).join('')}
    ${miss.map(([e,ei])=>{const k=di+'_'+ei;return `<div class="it" style="flex-wrap:wrap"><div class="grow"><div class="nm muted">${esc(exById(e.id).n)}</div><div class="tag">keine Variante für ${LOCS[lc]}</div></div><button class="ghost" data-act="edit" data-k="${k}">Ergänzen</button>${editKey===k?editor(di,ei):''}</div>`}).join('')}</div>
   <button class="ghost" data-act="addex" data-d="${di}" style="align-self:flex-start">+ Übung hinzufügen</button>
   ${editKey==='add_'+di?addEditor(di):''}
  </section>`}).join('')}
  <section class="stack"><span class="label">Wochenvolumen-Ziele (Woche 3, Sätze pro Muskel)</span>
   <p class="small muted">${Object.entries(S.plan.T).map(([m,t])=>`${MUSCLES[m]} ${t}`).join(' · ')}</p></section>
  <section class="stack"><span class="label">Neu berechnen</span><p class="small muted">Erstellt den Plan aus deinem Profil neu. Arbeitsgewichte, Favoriten und gesperrte Übungen bleiben erhalten, eigene Änderungen an Sätzen gehen verloren.</p>
   <div class="row"><button data-act="regen">Plan neu berechnen</button><a class="btn" href="#gewichte">Startgewichte eintragen</a><a class="btn" href="#uebungen">Übungsbibliothek</a></div></section>
 </div>`;
}
function editor(di,ei){
 const e=S.plan.days[di].ex[ei];const v=L.viewAt(e,S.plan,loc());const ref=exById(v?v.id:e.id);const lc=loc();
 const alts=EX.filter(a=>(!v||a.id!==v.id)&&(a.p===ref.p||a.m===ref.m)&&eqOk(a,lc)&&!(S.profile.ban||[]).includes(a.id)).sort((a,b)=>(a.p===ref.p?0:1)-(b.p===ref.p?0:1));
 const warn=a=>(a.av||[]).some(l=>(S.profile.limitLv||{})[l])?' ⚠ Beschwerden':'';
 if(!v)return `<div class="edit stack" style="flex-basis:100%"><label class="f">Übung für ${LOCS[lc]}<select id="ed_swap">${alts.map(a=>`<option value="${a.id}">${esc(a.n)}${warn(a)}</option>`).join('')}</select></label>
  <div class="row"><button class="primary" data-act="edsave" data-d="${di}" data-e="${ei}">Übernehmen</button><button data-act="edcancel">Abbrechen</button></div></div>`;
 return `<div class="edit stack" style="flex-basis:100%">
  <label class="f">Übung tauschen${both()?` (${LOCS[lc]})`:''}<select id="ed_swap"><option value="">${esc(ref.n)} (aktuell)</option>${alts.map(a=>`<option value="${a.id}">${esc(a.n)}${warn(a)}</option>`).join('')}</select></label>
  <div class="grid2"><label class="f">Sätze Woche 1–4<input id="ed_sets" value="${e.sets.slice(0,4).join('/')}"></label>
  <label class="f">Wdh. von–bis<input id="ed_rr" value="${v.rr[0]}-${v.rr[1]}"></label>
  <label class="f">Pause (s)<input id="ed_rest" type="number" min="30" max="300" step="15" value="${v.rest}"></label>
  <label class="f">Arbeitsgewicht (kg)<input id="ed_w" type="number" step="0.5" min="0" value="${S.prog[v.id]&&S.prog[v.id].w!=null?S.prog[v.id].w:''}" placeholder="noch offen"></label></div>
  <div class="row"><button class="primary" data-act="edsave" data-d="${di}" data-e="${ei}">Übernehmen</button><button data-act="edcancel">Abbrechen</button><button class="ghost danger" data-act="edrm" data-d="${di}" data-e="${ei}">Entfernen</button></div></div>`;
}
function addEditor(di){
 const used=new Set(L.dayAt(S.plan,di,loc()).map(e=>e.id));
 const opts=EX.filter(a=>!used.has(a.id)&&eqOk(a,loc())&&!(S.profile.ban||[]).includes(a.id));
 return `<div class="edit stack"><label class="f">Übung${both()?` (${LOCS[loc()]})`:''}<select id="add_sel">${Object.keys(MUSCLES).map(m=>`<optgroup label="${MUSCLES[m]}">${opts.filter(a=>a.m===m).map(a=>`<option value="${a.id}">${esc(a.n)}</option>`).join('')}</optgroup>`).join('')}</select></label>
  <div class="row"><button class="primary" data-act="addsave" data-d="${di}">Hinzufügen</button><button data-act="edcancel">Abbrechen</button></div></div>`;
}

/* ---------- Ansicht: Startgewichte ---------- */
function vGewichte(){
 const ids=[...new Set(S.plan.days.flatMap(d=>d.ex.flatMap(e=>[e.id,e.alt].filter(Boolean))))].filter(id=>{const x=exById(id);return !x.bw&&x.inc>0});
 const rrOf=id=>{const e=S.plan.days.flatMap(d=>d.ex).find(z=>z.id===id||z.alt===id);return e.id===id?e.rr:e.altRr};
 $('#app').innerHTML=`<div class="stack-lg fade"><div class="stack"><h1>Startgewichte</h1>
  <p class="muted small prose">Trag ein, was du bei einer Übung schon kennst: ein Gewicht, mit dem du die untere Wiederholungszahl sauber schaffst und noch etwa 3 Wiederholungen übrig hättest. Nach einer längeren Pause lieber 10–20 % unter den alten Werten starten; die Progression holt das in wenigen Wochen auf. Leere Felder testest du im ersten Training.</p></div>
  <div class="stack">${ids.map(id=>{const x=exById(id);const rr=rrOf(id);const p=S.prog[id];return `<label class="f">${esc(x.n)} <span class="muted small">(${rr[0]}–${rr[1]} Wdh.)</span><input type="number" inputmode="decimal" step="0.5" min="0" data-sw="${id}" data-lo="${rr[0]}" value="${p&&p.w!=null?p.w:''}" placeholder="kg, noch offen"></label>`}).join('')||'<p class="small muted">Dein Plan enthält nur Übungen mit Körpergewicht oder Bändern.</p>'}</div>
  <div class="row"><button class="primary" data-act="swsave">Speichern</button><button data-act="swskip">Überspringen</button></div></div>`;
}

/* ---------- Ansicht: Übungsbibliothek ---------- */
let exF=Object.assign({m:'',q:'',loc:'',eq:[]},lsGet(LS+'_exf')||{});delete exF.avail;
const saveExF=()=>lsSet(LS+'_exf',exF);
function exMedia(x){
 const note=MEDIA_NOTE[x.id]?`<p class="small muted">${esc(MEDIA_NOTE[x.id])}</p>`:'';
 return MEDIA.has(x.id)?`<div class="anim" role="img" aria-label="Start- und Endposition: ${esc(x.n)}"><img src="media/ex/${x.id}-0.webp" alt="" loading="lazy"><img class="f2" src="media/ex/${x.id}-1.webp" alt="" loading="lazy"></div>${note}`
  :`<div class="anim none small muted">Für diese Übung liegt kein Bild vor. Der Link unten führt zu Videos.</div>`;
}
function exDetail(id){
 const x=exById(id);const p=S.profile||DEFAULT_PROFILE;const fav=(p.fav||[]).includes(id),ban=(p.ban||[]).includes(id);const pr=S.prog[id];
 const hist=exHistory(id);
 return `<div class="stack">${exMedia(x)}
  <div><h2>${esc(x.n)}</h2><div class="tag">${MUSCLES[x.m]}${x.s.length?' · Hilfsmuskeln: '+x.s.map(m=>MUSCLES[m]).join(', '):''}</div></div>
  <p>${esc(x.cue)}</p>
  <p class="small muted">${PATTERNS[x.p]} · ${x.t==='c'?'Grundübung':'Isolationsübung'} · Ausrüstung: ${x.eq.map(q=>EQUIP[q]).join(', ')||'keine'}${(x.av||[]).length?` · belastet stark: ${x.av.map(a=>LIMITS[a]).join(', ')}`:''}</p>
  ${pr&&pr.w!=null?`<p class="small">Aktuelles Arbeitsgewicht: <b>${x.bw&&!pr.w?'Körpergewicht':fmt(pr.w)+' kg'}</b>${pr.last?` · letztes Mal ${esc(pr.last)}`:''}${hist.length?` · geschätztes 1RM ${fmt(hist[hist.length-1].y)} kg`:''}</p>`:''}
  ${ban&&(p.banWhy||{})[id]?`<p class="small" style="color:var(--warn)">Gesperrt: ${esc(p.banWhy[id])}</p>`:''}
  <div class="row"><a class="btn" href="https://www.youtube.com/results?search_query=${encodeURIComponent(x.n+' Ausführung Technik')}" target="_blank" rel="noopener">Videos suchen (YouTube)</a>
   ${S.profile?`<button data-act="fav" data-id="${id}" aria-pressed="${fav}">${fav?'★ Favorit':'☆ Als Favorit'}</button><button data-act="ban" data-id="${id}" aria-pressed="${ban}" class="${ban?'danger':''}">${ban?'Sperre aufheben':'Nicht einplanen'}</button>`:''}</div>
  <p class="small muted">Favoriten werden bei der nächsten Planberechnung bevorzugt. „Nicht einplanen“ ersetzt die Übung sofort im Plan.</p>
 </div>`;
}
function openEx(id){const d=$('#dlg');d.dataset.id=id;$('#dlg_body').innerHTML=exDetail(id);if(!d.open)d.showModal()}
function exList(){
 const p=S.profile;const l=L.filterEx(EX,p,exF);
 return `<p class="small muted">${l.length} von ${EX.length} Übungen</p>`+(l.length?l.map(x=>`<button class="exrow" data-act="exinfo" data-id="${x.id}">${MEDIA.has(x.id)?`<img src="media/ex/${x.id}-0.webp" alt="" loading="lazy">`:'<span class="ph"></span>'}<span class="grow"><span class="nm">${esc(x.n)}</span><span class="tag">${MUSCLES[x.m]} · ${x.eq.map(e=>EQUIP[e]).join(', ')||'Körpergewicht'}</span></span>${(p.fav||[]).includes(x.id)?'<span class="chip acc">★</span>':''}${(p.ban||[]).includes(x.id)?'<span class="chip bad">gesperrt</span>':''}</button>`).join(''):'<p class="small muted">Keine Übung gefunden. Filter lockern oder zurücksetzen.</p>');
}
const EXEQ={bw:'Körpergewicht',...EQUIP};
function vUebungen(){
 $('#app').innerHTML=`<div class="stack-lg fade"><div class="stack"><h1>Übungen</h1><p class="muted small prose">${EX.length} Übungen mit Bildfolge aus Start- und Endposition. Tippe eine Übung an für Ausführung, Hinweise und Videos.</p></div>
  <div class="stack"><input id="ex_q" placeholder="Übung suchen" value="${esc(exF.q)}" aria-label="Übung suchen">
  <div class="stack" style="gap:6px"><span class="label">Ort</span><div class="seg" role="group" aria-label="Ort">${Object.entries({'':'Alle',...LOCS}).map(([k,l])=>`<button type="button" data-act="exloc" data-v="${k}" aria-pressed="${exF.loc===k}">${l}</button>`).join('')}</div>
   ${exF.loc?`<span class="small muted">Nur Übungen, die mit deiner Ausrüstung ${exF.loc==='gym'?'im Gym':'zuhause'} machbar sind (${L.equipFor(S.profile,exF.loc).map(e=>EQUIP[e]).join(', ')||'keine Geräte'}). Ändern unter <a href="#profil">Profil</a>.</span>`:''}</div>
  <div class="stack" style="gap:6px"><span class="label">Geräte</span><div class="seg chips" role="group" aria-label="Geräte">${Object.entries(EXEQ).map(([k,l])=>`<button type="button" data-act="exeq" data-v="${k}" aria-pressed="${exF.eq.includes(k)}">${l}</button>`).join('')}</div>
   ${exF.eq.length>1?'<span class="small muted">Zeigt Übungen mit mindestens einem der gewählten Geräte.</span>':''}</div>
  <div class="row"><select id="ex_m" aria-label="Muskel" style="max-width:200px"><option value="">Alle Muskeln</option>${Object.entries(MUSCLES).map(([k,l])=>`<option value="${k}"${exF.m===k?' selected':''}>${l}</option>`).join('')}</select>
  <button class="ghost" data-act="exreset">Filter zurücksetzen</button></div></div>
  <div id="exlist" class="exlist">${exList()}</div></div>`;
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
 const byDate={};S.sessions.forEach(s=>s.entries.filter(e=>e.id===id).forEach(e=>e.sets.forEach(z=>{const v=e1(z);if(v>(byDate[s.date]||0))byDate[s.date]=v})));
 return Object.entries(byDate).sort().map(([d,y])=>({d,y}));
}
function vFortschritt(){
 const {done,plan}=weekVolume();const total=S.sessions.length;
 const mesoS=S.sessions.filter(s=>s.planCreated===S.plan.created&&s.meso===S.plan.meso.n);
 const weeksIn=Math.min(calWeek(),S.plan.meso.deloadAt||7);const planned=weeksIn*S.profile.weekdays.length;const rep=L.weekReport(S);const bias=S.profile.rirBias||0;const mAdj=Object.entries(S.profile.mAdj||{}).filter(([,v])=>v);
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
  <section class="stack"><span class="label">Wochenbericht</span><ul class="rep small">${rep.map(l=>`<li>${esc(l)}</li>`).join('')}</ul></section>
  ${plateauCards()}
  <section class="stack"><span class="label">Kraftentwicklung (geschätztes 1RM)</span>
   ${trained.length?`<select id="exsel" aria-label="Übung wählen">${trained.map(id=>`<option value="${id}"${id===selEx?' selected':''}>${esc(exById(id).n)}</option>`).join('')}</select>${lineChart(exHistory(selEx))}<p class="small muted">Berechnet mit der Epley-Formel aus Gewicht × (Wiederholungen + Reserve). Ein Schätzwert, der Trends zeigt, kein echter Maximalversuch.</p>`:`<p class="small muted">Erscheint nach dem ersten Training mit Gewichten.</p>`}
  </section>
  <section class="stack"><div class="row between"><span class="label">Sätze pro Muskel, diese Woche</span><span class="small muted">erledigt / geplant</span></div>
   <div class="bars">${Object.keys(MUSCLES).filter(m=>plan[m]>0).map(m=>{const pc=Math.min(100,done[m]/plan[m]*100);return `<div class="bar"><span>${MUSCLES[m]}</span><div class="tr"><div class="fl ${pc>=95?'ok':''}" style="width:${pc}%"></div></div><span class="num small" style="text-align:right">${fmt(done[m])} / ${fmt(plan[m])}</span></div>`}).join('')}</div>
   <p class="small muted">Hilfsmuskeln zählen mit einem halben Satz (z. B. Trizeps beim Bankdrücken).</p></section>
  <section class="stack"><span class="label">Was Formkurve über dich gelernt hat</span>
   <p class="small">${S.cal.length>=2?`RIR-Kalibrierung aus ${S.cal.length} Testsätzen: Du schaffst im Schnitt ${bias>0?fmt(bias)+' Wiederholungen mehr':bias<0?fmt(-bias)+' Wiederholungen weniger':'genau so viele Wiederholungen'}${bias?' als geschätzt':' wie geschätzt'}. ${bias>0?'Du kannst näher ans Limit gehen; die Auswertung rechnet die Abweichung ein.':''}`:'RIR-Kalibrierung: noch zu wenige Testsätze. In den Aufbauwochen 2–4 bietet das Training bei Isolationsübungen „RIR kalibrieren“ an.'}</p>
   <p class="small">${mAdj.length?'Volumen-Anpassung pro Muskel (Sätze pro Woche gegenüber dem Standard): '+mAdj.map(([m,v])=>`${MUSCLES[m]} ${v>0?'+':''}${v}`).join(' · '):'Volumen pro Muskel: noch Standardwerte. Die erste Anpassung kommt nach dem ersten Zyklus aus deinem Belastungs-Feedback.'}</p>
   ${(S.profile.ban||[]).length?`<p class="small">Gesperrte Übungen: ${S.profile.ban.map(id=>esc(exById(id).n)).join(', ')}. Aufheben in der <a href="#uebungen">Übungsbibliothek</a>.</p>`:''}</section>
  <section class="stack"><span class="label">Körpergewicht</span>${lineChart(body)}</section>
  <section class="stack"><span class="label">Verlauf</span>
   ${S.sessions.length?`<div class="overflow"><table class="t"><thead><tr><th>Datum</th><th>Training</th><th>Woche</th><th>Sätze</th><th>Erholung</th><th></th></tr></thead><tbody>${S.sessions.slice().reverse().slice(0,30).map(s=>`<tr><td>${fmtDate(s.date)}</td><td>${esc(s.dayName)}</td><td class="num">${s.week}</td><td class="num">${s.entries.reduce((a,e)=>a+e.sets.length,0)}</td><td class="num">${s.rscore?fmt(s.rscore):'–'}${s.light?' (leicht)':''}</td><td><button class="ghost small" data-act="delsess" data-id="${s.id}">Löschen</button></td></tr>`).join('')}</tbody></table></div>`:'<p class="small muted">Noch keine Trainings. Das erste startest du unter „Heute“.</p>'}
  </section></div>`;
}

/* ---------- Ansicht: Coach (Claude über die Anthropic-API, eigener API-Schlüssel) ---------- */
let chat=lsGet(LS+'_chat')||[];let sampling=false;let abortCtl=null;
const coachCfg=()=>Object.assign({key:'',model:'claude-opus-5-5'},lsGet(LS+'_coach')||{});
function coachContext(){
 const wk=mesoWeek();const p=S.profile;const lcs=both()?['gym','home']:[L.primaryLoc(p)];
 const plan=lcs.map(lc=>(both()?`[${LOCS[lc]}]\n`:'')+S.plan.days.map((d,di)=>`Tag ${di+1} ${d.name}: `+L.dayAt(S.plan,di,lc).map(e=>{const pr=S.prog[e.id];return `${e.id} ${e.sets[weekIdx()]}x${e.rr[0]}-${e.rr[1]}${pr&&pr.w!=null?' @'+pr.w+'kg':''}`}).join('; ')).join('\n')).join('\n');
 const sess=S.sessions.slice(-8).map(s=>`${s.date} ${s.dayName} (${s.week===5?'Deload':'Aufbau'}${s.loc?', '+LOCS[s.loc]:''}, Erholung ${s.rscore?fmt(s.rscore):'?'}/5${s.light?', leichter Tag':''}${s.mins?', '+s.mins+' min':''}): `+s.entries.map(e=>`${e.id} `+e.sets.map(z=>`${z.w}x${z.r}${z.rir!=null?'@'+z.rir:''}`).join(',')+(e.fb&&(e.fb.pain||e.fb.load)?` [Schmerz ${e.fb.pain||0}, Belastung ${e.fb.load||'?'}]`:'')).join(' | ')).join('\n');
 const tr=bodyTrend();const {done,plan:pl}=weekVolume();
 // Verlauf über alle Trainings verdichtet: 1RM-Schätzung je Übung (erste → letzte Einheit)
 const ids=[...new Set(S.sessions.flatMap(s=>s.entries.map(e=>e.id)))];
 const trends=ids.map(id=>{const h=exHistory(id);return h.length>=2?`${id}: ${fmt(h[0].y)} → ${fmt(h[h.length-1].y)} kg in ${h.length} Einheiten (${h[0].d} bis ${h[h.length-1].d})`:null}).filter(Boolean).join('\n');
 const fbM={};S.sessions.slice(-20).forEach(s=>s.entries.forEach(e=>{if(e.fb&&e.fb.load){const m=exById(e.id).m;(fbM[m]=fbM[m]||[]).push(e.fb.load)}}));
 const fat=L.fatigue(S);const plat=L.plateaus(S);
 const avail=EX.filter(x=>lcs.some(lc=>eqOk(x,lc))&&!(p.ban||[]).includes(x.id)).map(x=>`${x.id}=${x.n} [${MUSCLES[x.m]}${both()?', '+lcs.filter(lc=>eqOk(x,lc)).map(lc=>LOCS[lc]).join('+'):''}]`).join('; ');
 return `PROFIL: ${p.sex}, ${p.age} J., ${p.height} cm, ${p.weight} kg, Ziel ${GOALS[p.goal]}, ${EXP[p.exp]}${S.plan.reentry?', Wiedereinstieg nach Pause (erster Zyklus reduziert)':''}, ${p.weekdays.length}x/Woche (${p.weekdays.map(i=>WEEKDAYS[i]).join(', ')}) à ${p.dur} min
ORTE: ${lcs.map(lc=>`${LOCS[lc]}: ${L.equipFor(p,lc).map(e=>EQUIP[e]).join(', ')||'nur Körpergewicht'}`).join(' | ')}
BESCHWERDEN: ${Object.entries(p.limitLv||{}).map(([k,v])=>`${LIMITS[k]} (${v===2?'stark':'leicht/phasenweise'})`).join(', ')||'keine'}; gesperrte Übungen: ${(p.ban||[]).map(id=>`${id} (${(p.banWhy||{})[id]||'manuell'})`).join(', ')||'keine'}
ANDERER SPORT: ${(p.sportDays||[]).length?`${p.sportName||'Sport'} an ${p.sportDays.map(i=>WEEKDAYS[i]).join(', ')}`:'keiner'}
SCHWERPUNKTE: ${p.prio.map(m=>MUSCLES[m]).join(', ')||'keine'}; gelernte Volumen-Anpassung pro Muskel: ${Object.entries(p.mAdj||{}).filter(([,v])=>v).map(([m,v])=>`${MUSCLES[m]} ${v>0?'+':''}${v}`).join(', ')||'noch keine'}
MESOZYKLUS ${S.plan.meso.n}, Kalenderwoche ${calWeek()}, Phase ${wk===5?'Deload':wk>5?'abgeschlossen':'Aufbau'}, Ziel-RIR diese Woche ${rirRow()[weekIdx()]}; RIR-Kalibrierung: Nutzer schafft im Schnitt ${p.rirBias||0} Wdh. mehr als geschätzt
PLAN (Übungs-ID Sätze x Wdh-Bereich @ Arbeitsgewicht):
${plan}
WOCHENVOLUMEN erledigt/geplant: ${Object.keys(MUSCLES).map(m=>`${MUSCLES[m]} ${fmt(done[m])}/${fmt(pl[m])}`).join(', ')}
BELASTUNGS-FEEDBACK je Muskel (1 leicht, 2 passend, 3 zu viel; Schnitt der letzten 20 Trainings): ${Object.entries(fbM).map(([m,v])=>`${MUSCLES[m]} ${fmt(v.reduce((a,b)=>a+b,0)/v.length)}`).join(', ')||'noch keines'}
ERMÜDUNG: ${fat.any?fat.reasons.join('; '):'keine Zeichen'}; STAGNATION: ${plat.map(x=>x.id).join(', ')||'keine'}
KÖRPERGEWICHT: ${S.body.slice(-14).map(b=>b.d+' '+b.kg).join(', ')||'keine Daten'}${tr&&tr.pct!=null?` (Trend ${fmt(tr.pct,2)} %/Woche)`:''}
KRAFTVERLAUF (geschätztes 1RM, gesamter Verlauf):
${trends||'noch keine Daten'}
LETZTE TRAININGS (Gewicht x Wdh @ RIR):
${sess||'noch keine'}
NOTIZEN AUS FRÜHEREN GESPRÄCHEN:
${S.notes.map(n=>`- ${n.d}: ${n.t}`).join('\n')||'keine'}
VERFÜGBARE ÜBUNGEN (ID=Name):
${avail}`;
}
const COACH_SYS=`Du bist der Coach in der Trainings-App "Formkurve". Antworte auf Deutsch, direkt und ohne Floskeln oder Einleitungen. Begründe Empfehlungen trainingswissenschaftlich und nenne bei Fakten die Quelle (Autor, Jahr, Journal), wenn du sie sicher kennst; erfinde keine Quellen. Wenn der Nutzer etwas Falsches annimmt, sag es klar und korrigiere es mit Belegen. Beziehe dich konkret auf die Daten unten (Übungen, Gewichte, Wiederholungen, RIR, Erholung, Feedback). Keine medizinischen Diagnosen; bei anhaltenden Schmerzen auf ärztliche Abklärung verweisen. Halte Antworten kurz (max. ~200 Wörter), nutze kurze Listen, wenn es hilft.

Die App steuert Progression, Deload und Volumen pro Muskel selbst nach festen Regeln. Wenn eine Änderung am Plan sinnvoll ist oder der Nutzer darum bittet, rufe das Tool propose_plan_changes auf: Der Nutzer sieht den Vorschlag als Karte und bestätigt oder lehnt ab; es wird nichts ohne Bestätigung geändert. Erkläre im Text kurz das Warum. Verwende nur Übungs-IDs aus der Liste VERFÜGBARE ÜBUNGEN und achte bei zwei Orten darauf, dass die neue Übung am Ort der ersetzten Übung möglich ist. Schlage nur Änderungen vor, die die Daten stützen.

Wenn der Nutzer etwas Dauerhaftes über sich mitteilt, das für künftige Gespräche wichtig ist (Verletzung, Vorliebe, Termin, Einschränkung), rufe save_note mit einem kurzen Satz auf.`;
const COACH_TOOLS=[
 {name:'propose_plan_changes',description:'Schlägt dem Nutzer konkrete Änderungen am Trainingsplan vor. Die App zeigt sie als Karte; angewendet wird erst nach Bestätigung durch den Nutzer.',
  input_schema:{type:'object',properties:{summary:{type:'string',description:'Ein Satz: was sich ändert und warum.'},
   changes:{type:'array',items:{type:'object',properties:{
    op:{type:'string',enum:['swap','set_sets','set_reps','set_rest','add','remove','set_weight']},
    day:{type:'integer',description:'Nummer des Trainingstags (1 = erster Tag im Plan). Nicht nötig bei set_weight.'},
    exercise_id:{type:'string',description:'ID der betroffenen Übung; bei add die ID der neuen Übung.'},
    new_exercise_id:{type:'string',description:'Nur bei swap: ID der Ersatzübung.'},
    sets:{type:'array',items:{type:'integer'},description:'Nur bei set_sets: Sätze für die Aufbauwochen 1 bis 4.'},
    reps_min:{type:'integer'},reps_max:{type:'integer'},rest_s:{type:'integer'},weight_kg:{type:'number'}},required:['op','exercise_id']}}},required:['summary','changes']}},
 {name:'save_note',description:'Merkt sich einen dauerhaften Fakt über den Nutzer für künftige Gespräche.',input_schema:{type:'object',properties:{note:{type:'string',description:'Ein kurzer Satz.'}},required:['note']}}
];
// Planänderung des Coachs prüfen und beschreiben. Gibt null zurück, wenn sie nicht ausführbar ist.
function findChange(c){
 if(!c||typeof c!=='object'||!EX.some(x=>x.id===c.exercise_id))return null;
 const x=exById(c.exercise_id);
 if(c.op==='set_weight')return c.weight_kg>=0&&c.weight_kg<=500?{c,x,txt:`${x.n}: Arbeitsgewicht ${fmt(c.weight_kg)} kg`}:null;
 const di=(c.day|0)-1;const d=S.plan.days[di];if(!d)return null;
 if(c.op==='add'){if(!lcsFor(x).length)return null;return {c,x,di,txt:`${d.name}: ${x.n} hinzufügen`}}
 const e=d.ex.find(z=>z.id===c.exercise_id||z.alt===c.exercise_id);if(!e)return null;
 const isAlt=e.id!==c.exercise_id;const lc=isAlt?(S.plan.loc==='gym'?'home':'gym'):(e.only||S.plan.loc);const base={c,x,di,e,isAlt};
 if(c.op==='swap'){if(!EX.some(y=>y.id===c.new_exercise_id))return null;const y=exById(c.new_exercise_id);if(!eqOk(y,lc)||(S.profile.ban||[]).includes(y.id))return null;return {...base,y,txt:`${d.name}: ${x.n} → ${y.n}`}}
 if(c.op==='set_sets'){const v=(Array.isArray(c.sets)?c.sets:[]).map(n=>n|0).filter(n=>n>=1&&n<=10);if(!v.length)return null;return {...base,v,txt:`${d.name}: ${x.n} ${v.join('/')} Sätze (W1–4)`}}
 if(c.op==='set_reps'){if(!(c.reps_min>=1&&c.reps_max>c.reps_min&&c.reps_max<=40))return null;return {...base,txt:`${d.name}: ${x.n} ${c.reps_min}–${c.reps_max} Wdh.`}}
 if(c.op==='set_rest'){if(!(c.rest_s>=20&&c.rest_s<=300))return null;return {...base,txt:`${d.name}: ${x.n} ${c.rest_s} s Pause`}}
 if(c.op==='remove')return {...base,txt:`${d.name}: ${x.n} entfernen`};
 return null;
}
const lcsFor=x=>(both()?['gym','home']:[L.primaryLoc(S.profile)]).filter(lc=>eqOk(x,lc));
function addExercise(di,id){
 const x=exById(id);const d=S.plan.days[di];const g=S.profile.goal;const lcs=lcsFor(x);if(!lcs.length)return false;
 const e={slot:100+d.ex.length,id,rr:repRange(x,g),rest:restFor(x,g),sets:[2,3,3,3,1]};
 if(both()){if(lcs.length===2){e.alt=id;e.altRr=e.rr.slice();e.altRest=e.rest}else if(lcs[0]===S.plan.loc)e.alt=null;else e.only=lcs[0]}
 d.ex.push(e);return true;
}
function removeExercise(di,e,isAlt){
 const d=S.plan.days[di];const other=S.plan.loc==='gym'?'home':'gym';
 if(isAlt){e.alt=null;return}
 if(e.alt&&both()){const i=d.ex.indexOf(e);d.ex[i]={slot:e.slot,only:other,id:e.alt,rr:e.altRr,rest:e.altRest,sets:e.sets};return}
 d.ex.splice(d.ex.indexOf(e),1);
}
function setExercise(e,isAlt,id){const y=exById(id);const g=S.profile.goal;if(isAlt){e.alt=id;e.altRr=repRange(y,g);e.altRest=restFor(y,g)}else{e.id=id;e.rr=repRange(y,g);e.rest=restFor(y,g)}}
function applyChanges(changes){
 let n=0;
 changes.forEach(raw=>{const f=findChange(raw);if(!f)return;const {c,e,isAlt}=f;n++;
  if(c.op==='set_weight')S.prog[c.exercise_id]={...(S.prog[c.exercise_id]||{}),w:+c.weight_kg,fails:0};
  else if(c.op==='add'){if(!addExercise(f.di,c.exercise_id))n--}
  else if(c.op==='swap')setExercise(e,isAlt,c.new_exercise_id);
  else if(c.op==='set_sets'){for(let i=0;i<4;i++)e.sets[i]=f.v[Math.min(i,f.v.length-1)];e.sets[4]=Math.max(1,Math.round(e.sets[0]/2))}
  else if(c.op==='set_reps'){const rr=[c.reps_min,c.reps_max];if(isAlt)e.altRr=rr;else e.rr=rr;if(S.prog[c.exercise_id])S.prog[c.exercise_id].reps=rr[0]}
  else if(c.op==='set_rest'){if(isAlt)e.altRest=c.rest_s;else e.rest=c.rest_s}
  else if(c.op==='remove')removeExercise(f.di,e,isAlt)});
 Store.save();return n;
}
const apiText=m=>m.content+(m.prop?`\n[Vorschlag an die App: ${m.prop.summary} (${m.prop.lines.join('; ')}). Status: ${m.prop.status==='ok'?'vom Nutzer übernommen':m.prop.status==='no'?'vom Nutzer abgelehnt':'noch offen'}]`:'');
async function ask(q){
 const cfg=coachCfg();
 if(sampling||!cfg.key)return;sampling=true;abortCtl=new AbortController();
 chat.push({role:'user',content:q});chat.push({role:'assistant',content:''});vCoach();
 const history=chat.slice(-13,-1).filter(m=>m.content).map(m=>({role:m.role,content:apiText(m)}));
 while(history.length&&history[0].role!=='user')history.shift();
 const cur=chat[chat.length-1];
 try{
  const res=await askCoach({apiKey:cfg.key,model:cfg.model,system:COACH_SYS+'\n\nAKTUELLE DATEN DES NUTZERS:\n'+coachContext(),messages:history,tools:COACH_TOOLS,signal:abortCtl.signal,
   onText:t=>{cur.content=t;const el=$('#lastbubble');if(el)el.textContent=t}});
  let text=res.text;
  for(const call of res.calls){
   if(call.name==='save_note'&&call.input&&typeof call.input.note==='string'&&call.input.note.trim()){const t=call.input.note.trim().slice(0,300);S.notes.push({d:todayISO(),t});S.notes=S.notes.slice(-30);Store.save();text+=(text?'\n\n':'')+'Notiert: '+t}
   if(call.name==='propose_plan_changes'&&call.input&&Array.isArray(call.input.changes)){const ok=call.input.changes.filter(c=>findChange(c));
    if(ok.length)cur.prop={summary:String(call.input.summary||'Planänderung'),changes:ok,lines:ok.map(c=>findChange(c).txt),status:'open'};
    else text+=(text?'\n\n':'')+'(Der Coach wollte den Plan ändern, der Vorschlag war aber nicht ausführbar.)'}}
  cur.content=text||(cur.prop?cur.prop.summary:'Keine Antwort erhalten.');
 }catch(e){cur.content=e.userMessage||('Der Coach ist gerade nicht erreichbar: '+(e.message||e))}
 sampling=false;abortCtl=null;lsSet(LS+'_chat',chat.slice(-30));if(location.hash==='#coach')vCoach();
}
function vCoach(){
 const cfg=coachCfg();const avail=!!cfg.key;
 const quick=['Schreib meinen Wochenbericht: was lief, was stagniert, was sich ändern sollte','Warum stagniert meine Kraft?','Passt mein Volumen zu meinem Ziel und zu meinem Sport?','Schlag mir Anpassungen für mein Knie vor'];
 $('#app').innerHTML=`<div class="stack-lg fade"><div class="stack"><h1>Coach</h1><p class="muted small prose">Der Coach ist Claude von Anthropic. Er sieht Profil, Plan, den verdichteten Kraftverlauf aller Trainings, dein Feedback, Körpergewicht und seine Notizen aus früheren Gesprächen. Er kann Planänderungen vorschlagen, die du mit einem Tipp übernimmst oder ablehnst.</p></div>
  ${avail?'':`<div class="banner warn stack small"><b>API-Schlüssel fehlt.</b><span>Der Coach braucht einen eigenen Schlüssel von der Anthropic-Konsole (console.anthropic.com → API Keys). Er wird nur auf diesem Gerät gespeichert und direkt an api.anthropic.com gesendet. Kosten laufen über dein Anthropic-Konto. Den Schlüssel trägst du unter <a href="#profil">Profil</a> ein.</span></div>`}
  <div class="chat">${chat.length?chat.map((m,i)=>`<div class="bubble ${m.role==='user'?'u':'a'} msg" ${i===chat.length-1&&m.role==='assistant'?'id="lastbubble"':''}>${esc(m.content||'…')}</div>${m.prop?`<div class="card stack small prop"><b>Vorschlag: ${esc(m.prop.summary)}</b><ul class="rep">${m.prop.lines.map(l=>`<li>${esc(l)}</li>`).join('')}</ul>${m.prop.status==='open'?`<div class="row"><button class="primary" data-act="propok" data-i="${i}">Übernehmen</button><button data-act="propno" data-i="${i}">Ablehnen</button></div>`:`<span class="chip ${m.prop.status==='ok'?'good':''}">${m.prop.status==='ok'?'übernommen':'abgelehnt'}</span>`}</div>`:''}`).join(''):`<p class="small muted">Noch keine Fragen. Starte mit einem Vorschlag:</p>`}</div>
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
  <section class="stack"><span class="label">Notizen des Coachs</span>
   ${S.notes.length?`<div class="stack" style="gap:6px">${S.notes.map((n,i)=>`<div class="row between small"><span class="grow">${fmtDate(n.d)}: ${esc(n.t)}</span><button class="ghost small" data-act="notedel" data-i="${i}">Löschen</button></div>`).join('')}</div>`:'<p class="small muted">Noch keine. Der Coach merkt sich hier dauerhafte Fakten aus euren Gesprächen, zum Beispiel Verletzungen oder Vorlieben.</p>'}</section>
  <section class="stack"><span class="label">Wissen</span><p class="small"><a href="#wissen">So rechnet Formkurve: Regeln und Studien</a> · <a href="#uebungen">Übungsbibliothek</a> · <a href="#gewichte">Startgewichte</a></p></section>
  <section class="stack"><span class="label">Zurücksetzen</span><div class="row"><button class="danger" data-act="reset">Alle Daten löschen</button><span id="reset_c"></span></div></section>
 </div>`;
 bindProfileForm(p=>{
  const old=S.profile;S.profile=p;
  const structural=['goal','exp','dur','place','reentry'].some(k=>old[k]!==p[k])||['weekdays','equipment','equipHome','limitLv','prio','sportDays'].some(k=>JSON.stringify(old[k])!==JSON.stringify(p[k]));
  if(structural){const keep=S.plan;S.plan=generatePlan(p,keep);S.plan.meso={...keep.meso};Store.save('plan',S.plan)}
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
  ['Iraki et al. (2019). Nutrition recommendations for bodybuilders in the off-season: a narrative review. Sports 7(7):154.','https://doi.org/10.3390/sports7070154'],
  ['Morton et al. (2018). A systematic review, meta-analysis and meta-regression of the effect of protein supplementation on resistance training-induced gains in muscle mass and strength. Br J Sports Med 52(6).','https://doi.org/10.1136/bjsports-2017-097608'],
  ['Halperin et al. (2022). Accuracy in predicting repetitions to task failure in resistance exercise: a scoping review and exploratory meta-analysis. Sports Med 52.','https://pubmed.ncbi.nlm.nih.gov/?term=Halperin+accuracy+predicting+repetitions+to+task+failure+resistance+exercise'],
  ['van Dyk, Behan, Whiteley (2019). Including the Nordic hamstring exercise in injury prevention programmes halves the rate of hamstring injuries. Br J Sports Med 53(21).','https://doi.org/10.1136/bjsports-2018-100045'],
  ['Scarpelli et al. (2020). Muscle hypertrophy response is affected by previous resistance training volume in trained individuals. J Strength Cond Res.','https://pubmed.ncbi.nlm.nih.gov/?term=Scarpelli+muscle+hypertrophy+response+previous+resistance+training+volume'],
  ['Fonseca et al. (2014). Changes in exercises are more effective than in loading schemes to improve muscle strength. J Strength Cond Res 28(11).','https://pubmed.ncbi.nlm.nih.gov/?term=Fonseca+changes+in+exercises+are+more+effective+than+in+loading+schemes']
 ];
 $('#app').innerHTML=`<div class="stack-lg fade prose"><div class="stack"><h1>So rechnet Formkurve</h1><p class="muted">Alle Regeln sind feste, nachvollziehbare Formeln. Nur der Coach-Tab nutzt ein Sprachmodell. Wo eine Regel eine Faustregel ohne direkte Studie ist, steht das dabei.</p></div>
  <section class="stack"><h3>1. Split nach Trainingstagen</h3><p>2–3 Tage: Ganzkörper. 4 Tage: Ober-/Unterkörper. 5 Tage: Ober/Unter plus Push/Pull/Beine. 6 Tage: Push/Pull/Beine zweimal. So wird jeder Muskel etwa zweimal pro Woche trainiert; die Meta-Analyse von Schoenfeld et al. (2016) fand bei 2× pro Woche mehr Muskelzuwachs als bei 1× bei vergleichbarem Volumen [2].</p></section>
  <section class="stack"><h3>2. Volumen pro Muskel und Woche</h3><p>Zielwert in Woche 3: Anfänger 10, Fortgeschrittene 13, Erfahrene 16 harte Sätze pro Muskel (Waden, Bauch, Gesäß 4 weniger, weil Kniebeuge und Hüftbeuge sie mittrainieren). Bei Fettabbau −2, für Schwerpunkt-Muskeln +4. Grundlage: Dosis-Wirkungs-Beziehung mit mehr Zuwachs ab etwa 10 Sätzen pro Woche [1]. Hilfsmuskeln zählen als halber Satz (z. B. Bizeps beim Rudern) und werden vom direkten Ziel abgezogen, mindestens die Hälfte bleibt direkt. Pro Training gilt eine Obergrenze von etwa 20 Sätzen pro Stunde; gekürzt wird zuerst bei Bauch, Waden und Isolation, nie unter 2 Sätze pro Übung.</p></section>
  <section class="stack"><h3>3. Mesozyklus mit Deload nach Bedarf</h3><p>Volumen 80 → 90 → 100 → 110 % des Zielwerts, Wiederholungen in Reserve (RIR) 3 → 2 → 2 → 1 (Anfänger und Wiedereinstieg 3 → 3 → 2 → 2). Ab Woche 5 läuft der Aufbau mit dem Stand von Woche 4 weiter, bis ein Ermüdungszeichen auftritt: Leistung bei mindestens 2 Übungen zwei Einheiten in Folge gesunken, Erholung der letzten 3 Trainings unter 2,8 oder Belastung mehrfach „zu viel“. Dann folgt die Deload-Woche mit halber Satzzahl, ~10 % weniger Last und RIR 4, spätestens in Woche 7. Treffen zwei Zeichen schon vorher zusammen, schlägt Formkurve den Deload vor. Deloads werden in der Praxis meist alle 4–8 Wochen eingesetzt; die Evidenz stützt sich auf Expertenkonsens, ein festes Intervall ist nicht belegt [7]. Die Schwellenwerte sind Faustregeln.</p></section>
  <section class="stack"><h3>4. Wiederholungsbereiche</h3><p>Muskelaufbau: Grundübungen 6–10, Isolation 10–15. Kraft: 3–6 bzw. 8–12. Fettabbau und Fitness: 8–12 bzw. 10–15/12–15. Muskelaufbau ist über weite Lastbereiche ähnlich, solange Sätze nah ans Muskelversagen gehen [6]; für Maximalkraft sind schwere Lasten überlegen [5][6].</p></section>
  <section class="stack"><h3>5. Automatische Progression (Doppelprogression)</h3><p>Nach jedem Training pro Übung: Alle Sätze am oberen Ende des Bereichs → Gewicht + Steigerungsschritt (Langhantel Beine 5 kg, Oberkörper 2,5 kg, Kurzhanteln 1–2 kg). Lag die Reserve dabei 2 oder mehr über dem Ziel, doppelter Schritt. Im Bereich → Gewicht halten, +1 Wiederholung als Ziel. Unter dem Bereich → gleiches Gewicht; beim zweiten Mal in Folge −10 % Reset. Das entspricht dem Progressionsmodell des ACSM (Last steigern, wenn die Zielwiederholungen übertroffen werden) [5] kombiniert mit RIR-Steuerung [3][4].</p></section>
  <section class="stack"><h3>6. Tagesform</h3><p>Vor jedem Training: Schlaf, Muskelkater, Energie (1–5). Liegt der Schnitt bei 2,3 oder darunter, gibt es einen Satz weniger pro Übung und RIR +1; ein verfehlter Bereich zählt dann nicht als Fehlversuch. Autoregulation nach Tagesform wird in der Literatur als Alternative zu starren Plänen diskutiert, die Studienlage ist uneinheitlich [8].</p></section>
  <section class="stack"><h3>7. Nächster Zyklus: Volumen pro Muskel</h3><p>Nach jeder Übung bewertest du Gelenkschmerz, Muskelgefühl und Belastung. Am Zyklusende rechnet Formkurve pro Muskel: Belastung meist „zu viel“ → −2 Sätze pro Woche. Meist „leicht“ → +1, bei stagnierender Kraft +2. Belastung passend, Kraft stagniert, Erholung ≥ 3 und Trainingstreue ≥ 80 % → +1. Sonst unverändert. Liegen für einen Muskel weniger als 3 Rückmeldungen vor, gilt die allgemeine Regel: Trainingstreue ≥ 80 % und Erholung ≥ 3,5 → +1, Erholung unter 2,5 → −2. Die Anpassung bleibt zwischen −4 und +6 Sätzen. Hintergrund: Die Reaktion auf Volumen ist individuell, und ein am bisherigen Volumen orientierter Wert war in einer Studie dem Standardwert überlegen [14]. Die konkreten Schwellen sind Faustregeln.</p></section>
  <section class="stack"><h3>8. Körpergewicht</h3><p>Trend aus 7-Tage-Mittelwerten. Fettabbau: 0,5–1 % pro Woche [9]. Muskelaufbau: etwa 0,25–0,5 % pro Woche [10].</p></section>
  <section class="stack"><h3>9. Geschätztes 1RM</h3><p>Epley-Formel: Gewicht × (1 + (Wiederholungen + RIR) / 30). Die Reserve wird addiert, weil ein Satz mit 2 RIR einem Satz mit 2 Wiederholungen mehr bis zum Versagen entspricht.</p></section>
  <section class="stack"><h3>10. Gym und Zuhause</h3><p>Bei zwei Trainingsorten bekommt jede Übung eine Variante pro Ort: dieselbe Übung, wenn die Ausrüstung reicht, sonst dieselbe Bewegung (z. B. Latziehen → Klimmzüge). Sätze und Wochenvolumen sind gleich, Arbeitsgewichte laufen pro Übung getrennt.</p></section>
  <section class="stack"><h3>11. Beschwerden und Schmerz</h3><p>„Stark“ schließt belastende Übungen aus, „leicht / phasenweise“ stellt sie in der Auswahl hinten an. Vor jedem Training fragst du den heutigen Zustand ab; bei Beschwerden werden belastende Übungen nur für diesen Tag ersetzt. Meldest du bei einer Übung deutlichen Schmerz oder zweimal in Folge leichten, wird sie gesperrt und im Plan ersetzt. Das ist eine Vorsichtsregel und ersetzt keine ärztliche Abklärung.</p></section>
  <section class="stack"><h3>12. Anderer Sport</h3><p>Pro Sporttag 1 Satz weniger pro Beinmuskel und Woche, höchstens 3. Steht der Sport heute oder morgen an, zieht Formkurve eine Einheit ohne Beinschwerpunkt vor; gibt es keine, laufen Beinübungen mit einem Satz weniger und RIR +1. Faustregel, um Ermüdung vor Spiel und Training zu begrenzen. Der Nordic Hamstring Curl ist in der Bibliothek, weil er in Studien mit Fußballern die Rate an Beinbeuger-Verletzungen etwa halbierte [13].</p></section>
  <section class="stack"><h3>13. RIR-Kalibrierung</h3><p>Die eigene Reserve wird im Schnitt um etwa eine Wiederholung unterschätzt, bei hohen Wiederholungszahlen stärker [12]. In den Aufbauwochen 2–4 kannst du bei Isolationsübungen den letzten Satz bis zum Versagen ausführen. Abweichung = tatsächliche Wiederholungen − (Wiederholungen + geschätzte RIR im Satz davor). Der Mittelwert der letzten 6 Tests wird auf deine RIR-Angaben addiert, in der 1RM-Schätzung und bei der Entscheidung über den doppelten Steigerungsschritt. Weil der Testsatz ermüdet stattfindet, ist der Wert eher zu klein.</p></section>
  <section class="stack"><h3>14. Stagnation</h3><p>Eine Übung gilt als stagnierend, wenn bei mindestens 5 Einheiten in 6 Wochen die letzten 3 nicht über dem Bestwert davor liegen. Formkurve bietet dann einen Übungstausch oder einen anderen Wiederholungsbereich an (Gewicht wird über die Epley-Formel umgerechnet). Übungswechsel verbesserten in einer Studie die Kraft stärker als reine Laständerungen [15]; die Evidenz ist begrenzt.</p></section>
  <section class="stack"><h3>15. Kurze Trainings, Aufwärmen, Protein</h3><p>Bei weniger Zeit koppelt Formkurve Isolationsübungen zu Supersätzen, kürzt dann Sätze (zuerst Bauch, Waden, Isolation) und streicht zuletzt Isolationsübungen. Aufwärmsätze: erste Grundübung 50 % × 8, 70 % × 4, 85 % × 2, weitere Grundübungen 70 % × 4 (Praxisregel). Protein-Ziel 1,6–2,2 g pro kg Körpergewicht; über etwa 1,6 g/kg fand die Meta-Analyse im Mittel keinen weiteren Zuwachs, die obere Grenze deckt die Streuung ab [11].</p></section>
  <section class="stack"><h3>Bildmaterial</h3><p>Die Übungsfotos stammen aus dem gemeinfreien Datensatz free-exercise-db (Unlicense): <a href="https://github.com/yuhonas/free-exercise-db" target="_blank" rel="noopener">github.com/yuhonas/free-exercise-db</a>. Für 11 Übungen gibt es dort kein eigenes Foto; sie zeigen dieselbe Bewegung mit anderem Gerät, z. B. Kabelzug statt Band, und tragen einen Hinweis. Cyclist Squat und Pike Push-up sind eigene Zeichnungen.</p></section>
  <section class="stack"><h3>Quellen</h3><ol class="src small">${src.map(([t,u])=>`<li>${esc(t)} <a href="${u}" target="_blank" rel="noopener">${u.replace('https://','')}</a></li>`).join('')}</ol></section>
 </div>`;
}

/* ---------- Aktionen ---------- */
const rerender=()=>{const y=window.scrollY;route();window.scrollTo(0,y)};
document.addEventListener('click',async ev=>{
 // Auswahlfelder im Check vor dem Training und Feedback pro Übung
 const sb=ev.target.closest('[data-rd] button,[data-pre] button');
 if(sb){sb.parentElement.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===sb)));return}
 const fb=ev.target.closest('[data-fb] button');
 if(fb&&W){const g=fb.parentElement;const en=W.entries[+g.dataset.e];en.fb=en.fb||{};const v=+fb.dataset.v;en.fb[g.dataset.fb]=en.fb[g.dataset.fb]===v?undefined:v;saveDraft();g.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===fb&&en.fb[g.dataset.fb]===v)));return}
 if(ev.target.id==='dlg'||ev.target.closest('[data-close]')){$('#dlg').close();return}
 const b=ev.target.closest('[data-act]');if(!b)return;const a=b.dataset.act;
 if(a==='loc'){S.loc=b.dataset.v;Store.save();editKey=null;rerender();return}
 if(a==='exinfo'){openEx(b.dataset.id);return}
 if(a==='exloc'){exF.loc=b.dataset.v;saveExF();vUebungen();return}
 if(a==='exeq'){const k=b.dataset.v;exF.eq=exF.eq.includes(k)?exF.eq.filter(e=>e!==k):[...exF.eq,k];saveExF();vUebungen();return}
 if(a==='exreset'){exF={m:'',q:'',loc:'',eq:[]};saveExF();vUebungen();return}
 if(a==='fav'){const p=S.profile;const id=b.dataset.id;p.fav=(p.fav||[]).includes(id)?p.fav.filter(f=>f!==id):[...(p.fav||[]),id];Store.save();openEx(id);if(location.hash==='#uebungen')$('#exlist').innerHTML=exList();return}
 if(a==='ban'){const p=S.profile;const id=b.dataset.id;
  if((p.ban||[]).includes(id)){p.ban=p.ban.filter(f=>f!==id);if(p.banWhy)delete p.banWhy[id];toast('Sperre aufgehoben')}
  else{const n=replaceEx(id,{ban:true,why:'manuell gesperrt'});toast(n?`Im Plan ersetzt durch ${n}`:'Gesperrt')}
  Store.save();openEx(id);if(location.hash==='#uebungen')$('#exlist').innerHTML=exList();else if(location.hash!=='#training')rerender();return}
 if(a==='deloadnow'){if(b.dataset.c!=='1'){b.dataset.c='1';b.textContent='Diese Woche wird Deload. Nochmal tippen';return}S.plan.meso.deloadAt=calWeek();Store.save();toast('Deload-Woche gestartet');route();return}
 if(a==='plack'||a==='plswap'||a==='plrr'){const id=b.dataset.id;S.meta.plAck={...(S.meta.plAck||{}),[id]:todayISO()};
  if(a==='plswap'){const n=replaceEx(id);toast(n?`Getauscht gegen ${n}`:'Kein Ersatz verfügbar')}
  if(a==='plrr'){S.plan.days.forEach(d=>d.ex.forEach(e=>{const isAlt=e.alt===id&&e.id!==id;if(e.id!==id&&!isAlt)return;const old=isAlt?e.altRr:e.rr;const nr=newRange(old);if(isAlt)e.altRr=nr;else e.rr=nr;
    const pr=S.prog[id];if(pr&&pr.w){pr.w=roundW(pr.w*(1+old[0]/30)/(1+nr[0]/30),exById(id));pr.reps=nr[0];pr.fails=0}}));toast('Wiederholungsbereich geändert, Gewicht angepasst')}
  Store.save();rerender();return}
 if(a==='caltoggle'){const en=W.entries[+b.dataset.e];en.cal=!en.cal;saveDraft();rerender();return}
 if(a==='swsave'||a==='swskip'){if(a==='swsave'){document.querySelectorAll('[data-sw]').forEach(i=>{const v=parseFloat(String(i.value).replace(',','.'));if(v>=0&&i.value!=='')S.prog[i.dataset.sw]={...(S.prog[i.dataset.sw]||{}),w:v,reps:+i.dataset.lo,fails:0}});Store.save();toast('Startgewichte gespeichert')}go('heute');return}
 if(a==='propok'||a==='propno'){const m=chat[+b.dataset.i];if(!m||!m.prop||m.prop.status!=='open')return;
  if(a==='propok'){const n=applyChanges(m.prop.changes);m.prop.status='ok';toast(`${n} Änderung${n===1?'':'en'} übernommen`)}else m.prop.status='no';
  lsSet(LS+'_chat',chat.slice(-30));vCoach();return}
 if(a==='notedel'){S.notes.splice(+b.dataset.i,1);Store.save();vProfil();return}
 if(a==='start'){startWorkout(+b.dataset.day);return}
 if(a==='ready'){const r={};document.querySelectorAll('[data-rd]').forEach(s=>r[s.dataset.rd]=+s.querySelector('[aria-pressed="true"]').dataset.v);
  const pre=k=>{const el=$(`[data-pre="${k}"] [aria-pressed="true"]`);return el?el.dataset.v:null};
  W.loc=pre('loc')||loc();if(both()&&S.loc!==W.loc){S.loc=W.loc;Store.save()}
  W.mins=+pre('mins')||0;W.flare=Object.keys(S.profile.limitLv||{}).filter(k=>+pre('fl_'+k)>=1);
  W.legLight=!!L.sportSoon(S)&&L.legShare(S,W.day,W.loc)>0;
  W.readiness=r;W.rscore=(r.sleep+r.sore+r.energy)/3;W.light=W.rscore<=2.34&&W.wk<5;buildEntries();saveDraft();keepAwake();renderHeader();vTraining();window.scrollTo(0,0);return}
 if(a==='cancelw'){if(b.dataset.c!=='1'){b.dataset.c='1';b.textContent='Wirklich verwerfen? Nochmal tippen';return}W=null;lsDel(LS+'_draft');timerEnd=0;go('heute');return}
 if(a==='done'){const en=W.entries[+b.dataset.e];const s=en.sets[+b.dataset.s];
  if(!s.done&&(s.r===''||s.r==null)){s.r=s.ph}
  s.done=!s.done;saveDraft();if(s.done)startTimer(en.ss?20:en.rest);const y=window.scrollY;vTraining();window.scrollTo(0,y);return}
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
 if(a==='edsave'){const e=S.plan.days[+b.dataset.d].ex[+b.dataset.e];const sw=$('#ed_swap').value;const isAlt=!e.only&&loc()!==S.plan.loc;const cur=isAlt?e.alt:e.id;
  if(sw)setExercise(e,isAlt,sw);
  else if(cur&&$('#ed_sets')){
   const sets=$('#ed_sets').value.split(/[\/,\s]+/).map(Number).filter(n=>n>0&&n<=10);
   const rr=$('#ed_rr').value.split(/[-–\s]+/).map(Number).filter(n=>n>0);const w=$('#ed_w').value;const rest=+$('#ed_rest').value;
   if(rr.length===2&&rr[0]<rr[1]){if(isAlt)e.altRr=rr;else e.rr=rr}
   if(sets.length){for(let i=0;i<4;i++)e.sets[i]=sets[Math.min(i,sets.length-1)];e.sets[4]=Math.max(1,Math.round(e.sets[0]/2))}
   if(rest){if(isAlt)e.altRest=rest;else e.rest=rest}
   if(w!=='')S.prog[cur]={...(S.prog[cur]||{}),w:+w,fails:0}}
  Store.save();editKey=null;toast('Plan geändert');vPlan();return}
 if(a==='edrm'){const e=S.plan.days[+b.dataset.d].ex[+b.dataset.e];removeExercise(+b.dataset.d,e,!e.only&&loc()!==S.plan.loc);Store.save();editKey=null;vPlan();return}
 if(a==='addex'){editKey='add_'+b.dataset.d;vPlan();return}
 if(a==='addsave'){const id=$('#add_sel').value;if(!id)return;addExercise(+b.dataset.d,id);Store.save();editKey=null;toast('Übung hinzugefügt');vPlan();return}
 if(a==='regen'){if(b.dataset.c!=='1'){b.dataset.c='1';b.textContent='Sicher? Nochmal tippen';return}
  const keep=S.plan;S.plan=generatePlan(S.profile,keep);S.plan.meso={...keep.meso};Store.save('plan',S.plan);toast('Plan neu berechnet');vPlan();return}
 if(a==='delsess'){if(b.dataset.c!=='1'){b.dataset.c='1';b.textContent='Sicher?';return}S.sessions=S.sessions.filter(s=>s.id!==b.dataset.id);Store.del('s_'+b.dataset.id);vFortschritt();return}
 if(a==='ask'){ask(b.dataset.q);return}
 if(a==='stopask'){if(abortCtl)abortCtl.abort();return}
 if(a==='cksave'){lsSet(LS+'_coach',{key:$('#ck_key').value.trim(),model:$('#ck_model').value});toast('Coach-Einstellungen gespeichert');vProfil();return}
 if(a==='ckdel'){lsDel(LS+'_coach');toast('Schlüssel entfernt');vProfil();return}
 if(a==='clearchat'){chat=[];lsDel(LS+'_chat');vCoach();return}
 if(a==='export'){const txt=JSON.stringify(S);$('#io').innerHTML=`<div class="stack"><textarea id="io_t" readonly>${esc(txt)}</textarea><div class="row"><button data-act="copy">Kopieren</button><button data-act="save">Als Datei speichern</button></div></div>`;return}
 if(a==='copy'){const t=$('#io_t');S.meta.lastExport=todayISO();Store.save();try{await navigator.clipboard.writeText(t.value);toast('Kopiert')}catch(e){t.select();toast('Text markiert – jetzt kopieren')}return}
 if(a==='save'){S.meta.lastExport=todayISO();Store.save();const blob=new Blob([JSON.stringify(S,null,1)],{type:'application/json'});const u=URL.createObjectURL(blob);const l=document.createElement('a');l.href=u;l.download=`formkurve-${todayISO()}.json`;document.body.appendChild(l);l.click();l.remove();setTimeout(()=>URL.revokeObjectURL(u),2000);return}
 if(a==='import'){$('#io').innerHTML=`<div class="stack"><textarea id="io_i" placeholder="Exportierten JSON-Text hier einfügen"></textarea><div class="row"><button class="primary" data-act="doimport">Importieren und ersetzen</button></div></div>`;return}
 if(a==='doimport'){try{const v=JSON.parse($('#io_i').value);if(!v.profile||!v.plan)throw 0;S=Store.migrate({...v});Store.save();toast('Importiert');go('heute')}catch(e){toast('Ungültige Daten')}return}
 if(a==='reset'){if(b.dataset.c!=='1'){b.dataset.c='1';b.textContent='Wirklich alles löschen? Nochmal tippen';return}
  ['profile','plan','prog','body'].forEach(k=>Store.del(k));S.sessions.forEach(s=>Store.del('s_'+s.id));S={profile:null,plan:null,prog:{},body:[],sessions:[],cal:[],notes:[],meta:{},loc:'gym'};lsDel(LS);lsDel(LS+'_draft');lsDel(LS+'_chat');chat=[];W=null;go('start');return}
});
document.addEventListener('input',ev=>{
 const t=ev.target;if(t.id==='ex_q'){exF.q=t.value;saveExF();$('#exlist').innerHTML=exList();return}if(t.dataset.f&&W){const s=W.entries[+t.dataset.e].sets[+t.dataset.s];s[t.dataset.f]=t.value;saveDraft()}
});
document.addEventListener('change',ev=>{
 const t=ev.target;
 if(t.id==='exsel'){selEx=t.value;vFortschritt()}
 if(t.id==='ex_m'){exF.m=t.value;saveExF();vUebungen()}
 if(t.dataset.f==='w'&&W){const en=W.entries[+t.dataset.e];const j=+t.dataset.s;en.sets.forEach((s,k)=>{if(k>j&&!s.done){s.w=t.value;const el=document.querySelector(`[data-f="w"][data-e="${t.dataset.e}"][data-s="${k}"]`);if(el)el.value=t.value}});saveDraft()}
});
function newMeso(){
 const r=L.mesoReview(S);const p=S.profile;p.mAdj={...(p.mAdj||{})};const lines=[];
 for(const m in r.muscles){const d=r.muscles[m].delta;if(!d)continue;const nv=Math.max(-4,Math.min(6,(p.mAdj[m]||0)+d));if(nv===(p.mAdj[m]||0))continue;p.mAdj[m]=nv;lines.push(`${MUSCLES[m]} ${d>0?'+':''}${d} (${r.muscles[m].why})`)}
 const was=p.reentry;p.reentry=false;if(was)lines.push('Wiedereinstieg abgeschlossen: normales Startvolumen');
 S.meta.lastReview={d:todayISO(),adh:r.adh,avg:r.avg,lines};
 const keep=S.plan;S.plan=generatePlan(p,keep);
 Store.save();
 toast(`Zyklus ${S.plan.meso.n} gestartet. Auswertung steht im Plan.`);go('plan');
}

/* ---------- Start ---------- */
(async function boot(){
 await Store.init();
 S=Store.migrate(Store.load());
 const draft=lsGet(LS+'_draft');if(draft&&S.plan&&draft.planCreated===S.plan.created)W=draft;
 route();
 if('serviceWorker' in navigator&&location.protocol!=='file:'){navigator.serviceWorker.register('./sw.js').catch(()=>{})}
})();
