import { createRequire } from 'module';const { chromium, devices } = createRequire(import.meta.url)('playwright');
const out=(process.env.SHOTS||'/tmp/formkurve-shots')+'/';
const b=await chromium.launch();const ctx=await b.newContext({...devices['iPhone 13'],serviceWorkers:'block'});const p=await ctx.newPage();
const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message));p.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text())});
await p.route('**fonts.g**',r=>r.abort());
const step=async(n,f)=>{try{await f();console.log('ok',n)}catch(e){console.log('FAIL',n,e.message.split('\n')[0]);await p.screenshot({path:out+'fail-'+n+'.png'})}};
await p.goto('http://localhost:8080/');
await step('onboarding',async()=>{
 await p.click('[data-seg="goal"] [data-v="hyp"]');await p.click('[data-seg="exp"] [data-v="int"]');await p.click('[data-seg="reentry"] [data-v="1"]');
 await p.click('[data-seg="place"] [data-v="both"]');await p.click('[data-seg="lim_knee"] [data-v="1"]');
 await p.fill('#pf_sport','Fußball');await p.click('[data-seg="sportDays"] [data-v="1"]');await p.click('[data-seg="sportDays"] [data-v="6"]');
 await p.click('#pf button[type=submit]');await p.waitForSelector('[data-sw]');});
await p.screenshot({path:out+'1-gewichte.png',fullPage:true});
await step('startgewichte',async()=>{const i=p.locator('[data-sw]').first();await i.fill('60');await p.click('[data-act="swsave"]');await p.waitForSelector('[data-act="start"]')});
await p.screenshot({path:out+'2-heute.png',fullPage:true});
await step('ortswechsel',async()=>{const a=await p.locator('.exl .nm').allTextContents();await p.click('[data-act="loc"][data-v="home"]');const h=await p.locator('.exl .nm').allTextContents();console.log('  gym :',a.join(' | '));console.log('  home:',h.join(' | '));if(a.join()===h.join())throw new Error('gleich')});
await step('dialog',async()=>{await p.locator('[data-act="exinfo"]').first().click();await p.waitForSelector('dialog[open]');await p.screenshot({path:out+'3-dialog.png'});await p.click('[data-close]')});
await step('training',async()=>{await p.click('[data-act="loc"][data-v="gym"]');await p.locator('[data-act="start"]').first().click();await p.waitForSelector('[data-act="ready"]');
 await p.screenshot({path:out+'4-check.png',fullPage:true});
 await p.click('[data-rd="sleep"] [data-v="4"]');await p.click('[data-pre="mins"] [data-v="30"]');await p.click('[data-pre="fl_knee"] [data-v="1"]');await p.click('[data-act="ready"]');await p.waitForSelector('[data-act="finish"]');
 console.log('  notes:',(await p.locator('.banner').allTextContents()).join(' || '));
 const n=await p.locator('section.card').count();
 for(let i=0;i<n;i++){const c=p.locator('section.card').nth(i);const w=c.locator('[data-f="w"]').first();if(await w.inputValue()==='')await w.fill('20');await w.dispatchEvent('change');
  const k=await c.locator('[data-act="done"]').count();for(let j=0;j<k;j++){await p.locator(`#ex${i} [data-act="done"]`).nth(j).click()}
  await p.locator(`#ex${i} [data-fb="load"] [data-v="2"]`).click();await p.locator(`#ex${i} [data-fb="pain"] [data-v="${i===0?2:0}"]`).click()}
 await p.screenshot({path:out+'5-training.png',fullPage:true});
 await p.click('[data-act="finish"]');await p.waitForSelector('.banner.good')});
await p.screenshot({path:out+'6-nach.png',fullPage:true});
for(const v of ['plan','fortschritt','uebungen','coach','profil','wissen']){await step(v,async()=>{await p.goto('http://localhost:8080/#'+v);await p.waitForTimeout(250);await p.screenshot({path:out+'7-'+v+'.png',fullPage:v!=='wissen'&&v!=='profil'})})}
await step('plan-edit',async()=>{await p.goto('http://localhost:8080/#plan');await p.locator('[data-act="edit"]').first().click();await p.waitForSelector('#ed_swap');await p.selectOption('#ed_swap',{index:1});await p.click('[data-act="edsave"]');
 await p.click('[data-act="loc"][data-v="home"]');await p.locator('[data-act="addex"]').first().click();await p.click('[data-act="addsave"]')});
await step('suche',async()=>{await p.goto('http://localhost:8080/#uebungen');await p.fill('#ex_q','nordic');const c=await p.locator('.exrow').count();if(c!==1)throw new Error('treffer '+c)});
await step('filter',async()=>{await p.click('[data-act="exreset"]');const all=await p.locator('.exrow').count();
 await p.click('[data-act="exloc"][data-v="home"]');const home=await p.locator('.exrow').count();
 await p.click('[data-act="exeq"][data-v="band"]');const band=await p.locator('.exrow').count();
 const tags=await p.locator('.exrow .tag').allTextContents();if(tags.some(t=>!t.includes('Widerstandsbänder')))throw new Error('Gerätefilter');
 console.log('  alle',all,'zuhause',home,'zuhause+Band',band);if(!(all>home&&home>band&&band>0))throw new Error('Anzahl');
 await p.screenshot({path:out+'8-filter.png',fullPage:false});
 await p.click('[data-act="exreset"]');await p.fill('#ex_q','pike');await p.locator('.exrow').first().click();await p.waitForSelector('dialog[open]');
 await p.waitForTimeout(300);await p.screenshot({path:out+'9-pike.png'});await p.click('[data-close]')});
const st=await p.evaluate(()=>{const s=JSON.parse(localStorage.formkurve_v1);return {ban:s.profile.ban,loc:s.loc,sess:s.sessions.length,fb:s.sessions[0].entries.map(e=>e.id+':'+JSON.stringify(e.fb)),res:s.sessions[0].results.map(r=>r.msg)}});
console.log(JSON.stringify(st,null,1));console.log(errs.length?errs.join('\n'):'keine Fehler');
await b.close();
