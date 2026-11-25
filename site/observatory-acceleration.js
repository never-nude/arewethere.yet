import { chronologicalMilestones, unitSuffix } from './observatory-display.js';

function matchesEdition(bulletin, assessment, manifest) {
  return Boolean(bulletin?.outlook && bulletin.basedOnCheckpoint === assessment.checkpointAt &&
    manifest.currentRecord?.checkpointAt === assessment.checkpointAt &&
    /^[a-f0-9]{64}$/i.test(bulletin.basedOnSha256) && bulletin.basedOnSha256 === manifest.currentRecord.sha256);
}

// A bulletin issued after a checkpoint can amend today's outlook. Replaying
// that checkpoint must still show the forecast actually recorded at the time.
export function selectOutlook(assessment, manifest, archived = false) {
  const next = manifest.supplementalPaceOutlook;
  const first = manifest.supplementalOutlook;
  let bulletin = null;
  if (!archived && matchesEdition(next, assessment, manifest)) bulletin = next;
  else if (!archived && !assessment.arrivalOutlook && matchesEdition(first, assessment, manifest)) bulletin = first;
  return {bulletin, outlook: bulletin?.outlook ?? assessment.arrivalOutlook ?? null};
}

function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined && text !== null) node.textContent = text;
  if (className) node.className = className;
  return node;
}

const number = new Intl.NumberFormat('en', {maximumSignificantDigits: 3});
const monthDay = new Intl.DateTimeFormat('en', {month:'short',day:'numeric',year:'numeric',timeZone:'UTC'});
const date = value => Number.isFinite(Date.parse(value)) ? monthDay.format(Date.parse(value)) : 'date unavailable';
const finite = Number.isFinite;
const format = x => finite(x) ? number.format(x) : 'Unavailable';
const ns = 'http://www.w3.org/2000/svg';
function svg(tag, attrs, text) {
  const node = document.createElementNS(ns, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  if (text != null) node.textContent = text;
  return node;
}

function referenceShift(outlook) {
  const r = outlook?.milestones?.find(m => m.id === 'singularity');
  if (!r || r.status !== 'Scenario estimate') return null;
  const alternative = r.scenarios?.find(s => s.label === 'Sustained acceleration');
  return alternative ? {reference:r.centralYear, accelerated:alternative.year, horizon:r.horizonYear} : null;
}

function sourceLink(item) {
  if (!item.sourceUrl || !/^https:\/\//.test(item.sourceUrl)) return null;
  const a = el('a',item.source || new URL(item.sourceUrl).hostname);
  a.href = item.sourceUrl;
  return a;
}

const indexScore = new Intl.NumberFormat('en',{maximumFractionDigits:2});
const shortDate = new Intl.DateTimeFormat('en', {month:'short',year:'numeric',timeZone:'UTC'});
const miniNames = {agi:'Artificial general intelligence', asi:'Artificial superintelligence', rsi:'Recursive self-improvement', singularity:'Singularity'};
const growthTitle = fit => fit?.winner === 'Exponential' && finite(fit.doublingDays) && fit.supported
  ? 'Estimated doubling time · ' + format(fit.doublingDays) + ' days'
  : fit?.winner === 'Linear' && fit.supported ? 'A straight line predicted better'
  : fit?.winner === 'Persistence' ? 'Repeating the last reading was competitive' : 'A compounding rate is unresolved';

function selector(label, choices, active, select) {
  const wrapper = el('div',null,'pace-select');
  wrapper.setAttribute('role','group');
  wrapper.setAttribute('aria-label',label);
  for (const [value, text] of choices) {
    const button = el('button',text);
    button.type = 'button';
    button.dataset.value = value;
    button.setAttribute('aria-pressed',String(value === active));
    button.addEventListener('click', () => {
      if (button.getAttribute('aria-pressed') === 'true') return;
      for (const b of wrapper.children) b.setAttribute('aria-pressed',String(b === button));
      select(value);
    });
    wrapper.append(button);
  }
  return wrapper;
}

function directionsYear(a, b) {
  if (!Number.isInteger(a) || !Number.isInteger(b)) return '';
  const d = b - a;
  return !d ? 'Same year' : Math.abs(d)+' '+(Math.abs(d) === 1 ? 'year' : 'years')+' '+(d < 0 ? 'earlier' : 'later');
}

// Release counts use equal-width 30-day windows. Task lengths use the actual
// timestamps and show individual readings, with a doubling scale when selected.
function historicalChart(rows, {unit, measure, bars=false, log=false, describe}) {
  const chart = el('div',null,'pace-chart');
  const points = rows.filter(r => finite(Date.parse(r.date)));
  if (!points.length || !points.some(p => finite(p.value))) {
    chart.append(el('p','This edition has no comparable readings for this measurement.','pace-note'));
    return chart;
  }
  const valid = points.filter(r => finite(r.value) && (!log || r.value > 0));
  if (!valid.length) return chart;
  const width=440, left=49, right=425, top=12, bottom=132;
  const graphic=svg('svg',{viewBox:'0 0 440 159',role:'img','aria-label':measure+' over time. Choose a reading below to inspect its value.'});
  const first=Date.parse(points[0].date), last=Date.parse(points.at(-1).date);
  const pad=bars?(right-left)/(2*points.length):3;
  const x=p=>last===first?(left+right)/2:left+pad+(Date.parse(p.date)-first)/(last-first)*(right-left-2*pad);
  const values=valid.map(p=>log?Math.log2(p.value):p.value);
  let low=log?Math.floor(Math.min(...values)):Math.min(0,...values);
  let high=log?Math.ceil(Math.max(...values)):Math.max(0,...values);
  if (high===low) high=low+1;
  const y=v=>bottom-((log?Math.log2(v):v)-low)/(high-low)*(bottom-top);
  const ticks=log?[low,Math.round((low+high)/2),high]:[low,(low+high)/2,high];
  for (const t of new Set(ticks)) {
    const val=log?2**t:t, pos=y(val);
    graphic.append(svg('line',{x1:left,x2:right,y1:pos,y2:pos,class:'pace-gridline'}),
      svg('text',{x:left-7,y:pos+4,'text-anchor':'end'},format(val)));
  }
  graphic.append(svg('text',{x:left,y:153},shortDate.format(first)));
  if (first!==last) graphic.append(svg('text',{x:right,y:153,'text-anchor':'end'},shortDate.format(last)));
  const rule=svg('line',{y1:top,y2:bottom,class:'pace-cursor'}); graphic.append(rule);
  let prev;
  const marks=points.map(p=>{
    const cx=x(p);
    let mark;
    if (finite(p.value) && (!log || p.value>0)) {
      const cy=y(p.value);
      if (bars) {
        const w=Math.min(23,1.18*pad), base=y(0);
        mark=svg('rect',{x:cx-w/2,y:Math.min(base,cy)-0.6,width:w,height:Math.max(1.2,Math.abs(base-cy)),rx:1.5,class:'pace-mark pace-bar'});
      } else {
        if (prev) graphic.append(svg('line',{x1:x(prev),y1:y(prev.value),x2:cx,y2:cy,class:'pace-line'}));
        mark=svg('circle',{cx,cy,r:3.4,class:'pace-mark'});
      }
      graphic.append(mark);
      prev=p;
    } else {
      prev=null;
      graphic.append(svg('text',{x:cx,y:bottom,'text-anchor':'middle'},'–'));
    }
    return mark;
  });
  const readout=el('output',null,'pace-readout');
  const slider=el('input');
  slider.type='range';slider.min=0;slider.max=points.length-1;slider.step=1;
  slider.disabled=points.length===1;slider.setAttribute('aria-label','Inspect '+measure.toLowerCase()+' by date');
  function choose(i) {
    const p=points[i];
    slider.value=i;rule.setAttribute('x1',x(p));rule.setAttribute('x2',x(p));
    marks.forEach((m,j)=>m?.classList.toggle('selected',j===i));
    const value=finite(p.value)?format(p.value)+unitSuffix(unit):'Outside recorded coverage';
    const stamp=p.start ? date(p.start)+'–'+date(p.date) : date(p.date);
    readout.replaceChildren(el('strong',value), el('span',[p.label,stamp].filter(Boolean).join(' · ')));
    const explanation=describe?.(p);
    if(explanation) readout.append(explanation);
    slider.setAttribute('aria-valuetext',value+' · '+stamp);
  }
  graphic.addEventListener('click',e=>{
    const rect=graphic.getBoundingClientRect();
    const pos=(e.clientX-rect.left)*width/rect.width;
    let closest=0;
    for (let i=1;i<points.length;i++) if(Math.abs(x(points[i])-pos)<Math.abs(x(points[closest])-pos)) closest=i;
    choose(closest);
  });
  slider.addEventListener('input',()=>choose(Number(slider.value)));
  const label=el('p',unit+(log?' · equal spacing for each doubling':''),'pace-unit');
  chart.append(label,graphic,slider,readout);
  choose(points.length-1);
  return chart;
}

function comparison(fit) {
  const list=el('dl',null,'pace-errors');
  const rows=[['Compounding growth',fit?.errors?.exponential],['Straight-line growth',fit?.errors?.linear],['Repeat last reading',fit?.errors?.persistence]];
  const max=Math.max(0,...rows.map(r=>r[1]).filter(finite));
  for (const [name, error] of rows) {
    const item=el('div');
    const bar=el('span',null,'pace-error-track');
    bar.setAttribute('aria-hidden','true');
    const fill=el('i');fill.style.width=max&&finite(error)?(100*error/max)+'%':'0%';bar.append(fill);
    item.append(el('dt',name),bar,el('dd',format(error)));list.append(item);
  }
  return list;
}

function capabilityView(body, pace, detailed) {
  const entries=(pace.series || []).filter(s=>['horizon80','horizon50'].includes(s.id));
  if (!entries.length) {body.append(el('p','This edition has no comparable capability measurements.'));return;}
  const selected = entries.find(s=>s.fit?.supported && finite(s.fit.doublingDays)) || entries.find(s=>s.id==='horizon80') || entries[0];
  const panel=el('div',null,'pace-inner');
  let series=selected, log=true;
  const scales=selector('Vertical chart scale',[['doubling','Doubling scale'],['linear','Linear scale']],'doubling',value=>{log=value==='doubling';paint();});
  const controls=selector('Task success rate',entries.map(s=>[s.id,s.id==='horizon80'?'80% success':'50% success']),selected.id,id=>{series=entries.find(s=>s.id===id);paint();});
  function paint() {
    const figure=el('div',null,'pace-figure');
    const side=el('div',null,'pace-summary');
    const fit=series.fit;
    const points=series.points || [];
    figure.append(scales,historicalChart(points.map(p=>({date:p.date,value:p.value,label:p.system})),
      {unit:'expert hours',measure:'Task duration',log}),
      el('p','Each dot is the best model released in a measured month.','pace-note'));
    side.append(el('h3',growthTitle(fit)),el('p','METR measures the length of tasks a system completes at '+(series.id==='horizon80'?'80%':'50%')+' success. Hours are the time a human expert would need.'));
    if (fit?.description) side.append(el('p',fit.description,'pace-note'));
    const published=series.publishedEstimate;
    if(published && finite(published.doublingMonths)) {
      side.append(el('p','METR’s combined-suite estimate was '+format(published.doublingMonths)+' months per doubling'
        +(finite(published.lowMonths)&&finite(published.highMonths)?' ('+published.interval+' '+format(published.lowMonths)+'–'+format(published.highMonths)+' months).':'.'),'pace-note'));
    }
    if (fit?.holdouts>0) {
      const details=el('details',null,'obs-detail pace-details'); details.open=detailed;
      details.append(el('summary','Compare prediction errors'),el('p',fit.holdouts+' later readings tested the fitted trends. The bars give the average absolute error in expert hours. Shorter is better.','pace-note'),comparison(fit));
      side.append(details);
    }
    const source=sourceLink({source:'METR · task evaluation data',sourceUrl:series.sourceUrl});
    if(source)side.append(source);
    panel.replaceChildren(figure,side);
  }
  body.append(controls,panel);paint();
}

const counts = {
  releaseDays:{label:'Publisher activity',unit:'publisher release days',definition:'Selected OpenAI model launches and Anthropic’s Claude release announcements and API availability notes each count once per publisher per day. Both publishers releasing on the same day counts as two.'},
  scoredModels:{label:'Scored releases',unit:'scored releases',definition:'Each distinct model version in the benchmark dataset counts in its release window. Older windows use the dataset available to this edition.'},
  frontierGain:{label:'Best score gained',unit:'ECI points',definition:'Change in the best published Epoch Capabilities Index score among model versions released by the end of each window. ECI points use a benchmark scale.'},
};
function activityView(body, events) {
  const panel=el('div',null,'pace-inner');
  function paint(id) {
    const m=counts[id];
    const points=(events.periods||[]).map(r=>({...r,date:r.end,value:r[id]}));
    const describe = p => {
      const actions = id==='frontierGain' ? p.scoreChanges : id==='releaseDays' ? p.releaseEvents : [];
      if(!actions?.length) return null;
      const notes=el('small',null,'pace-events');
      if(id==='frontierGain') {
        notes.textContent=actions.map(c=>c.models.join(', ')+' · '+indexScore.format(c.from)+' → '+indexScore.format(c.to)+' ECI ('+date(c.date)+')').join(' • ');
      } else notes.textContent=actions.map(c=>[c.publisher,c.title].join(' · ')).join(' • ');
      return notes;
    };
    const figure=historicalChart(points,{unit:m.unit,measure:m.label,bars:true,describe});
    const side=el('div',null,'pace-summary');
    side.append(el('h3',m.label+' in '+events.windowDays+'-day windows'),el('p',m.definition));
    const cov=events.coverage;
    if(id==='releaseDays' && cov?.publishers?.length) side.append(el('p',cov.publishers.join(' and ')+' feeds · '+date(cov.releaseStart)+' through '+date(cov.releaseThrough)+'.','pace-note'));
    else if(cov?.scoreThrough) side.append(el('p','Dataset coverage through '+date(cov.scoreThrough)+'.','pace-note'));
    const fit=id==='releaseDays'?events.activityFit:id==='scoredModels'?events.scoredReleaseFit:null;
    if (fit) {
      const interval=fit.perWindowInterval;
      if (finite(fit.perWindowPercent)) {
        const sign=fit.perWindowPercent>0?'+':'';
        side.append(el('p',sign+format(fit.perWindowPercent)+'% per '+events.windowDays+' days in the fitted curve.','pace-rate'));
      }
      if (interval && finite(interval.low) && finite(interval.high)) side.append(el('p','Approximate 95% interval · '+format(interval.low)+'% to '+format(interval.high)+'% per window.','pace-note'));
      if (fit.holdouts && finite(fit.errors?.exponential)) {
        const comparison = el('details',null,'obs-detail pace-details');
        comparison.append(el('summary','How the growth curve performed'),el('p',fit.holdouts+' later windows tested the three models. Average errors in '+m.unit+' per window were '+format(fit.errors.exponential)+' for exponential growth, '+format(fit.errors.linear)+' for a straight line and '+format(fit.errors.constant)+' for a flat rate.','pace-note'));
        if (finite(fit.stabilityWins)) comparison.append(el('p','With one later window left out at a time, the exponential fit beat both alternatives in '+fit.stabilityWins+' of '+fit.holdouts+' checks.','pace-note'));
        side.append(comparison);
      }
      side.append(el('p',fit.status,'pace-note'));
      if (fit.supported && finite(fit.halvingDays)) side.append(el('p','Fitted halving time · '+format(fit.halvingDays)+' days.','pace-note'));
      if (fit.supported && finite(fit.doublingDays)) side.append(el('p','Fitted doubling time · '+format(fit.doublingDays)+' days.','pace-note'));
    }
    side.append(el('p','A new release can add to the activity count without improving the best score. The forecast checks capability and research outcomes separately.','pace-note'));
    panel.replaceChildren(figure,side);
  }
  body.append(selector('Activity measure',Object.entries(counts).map(([id,m])=>[id,m.label]),'releaseDays',paint),panel);paint('releaseDays');
}

function impactView(body, events) {
  const items=events.impacts || [];
  if (!items.length) {body.append(el('p','No qualifying research impact observations in this edition.'));return;}
  const grid=el('div',null,'pace-impacts');
  for(const item of items) {
    const card=el('article');
    const value=format(item.value)+unitSuffix(item.unit);
    card.append(el('h3',item.label),el('strong',value,'pace-impact-value'));
    if(finite(item.fromValue)&&finite(item.toValue))
      card.append(el('p',format(item.fromValue)+(item.unit==='percentage points'?'%':'')+' → '+format(item.toValue)+(item.unit==='percentage points'?'%':'')+(item.fromDate&&item.toDate?' · '+date(item.fromDate)+'–'+date(item.toDate):''),'pace-note'));
    if(finite(item.low)&&finite(item.high))
      card.append(el('p',(item.intervalLabel||'Reported range')+' · '+format(item.low)+'–'+format(item.high)+unitSuffix(item.unit),'pace-note'));
    if(item.scope)card.append(el('p',item.scope,'pace-note'));
    const source=sourceLink(item);if(source)card.append(source);
    if(item.followupUrl) {
      const follow=sourceLink({source:'Follow-up study',sourceUrl:item.followupUrl});
      if(follow)card.append(' · ',follow);
    }
    grid.append(card);
  }
  body.append(grid);
}

function forecastEffect(body, pace, outlook) {
  const milestones=pace.milestones || [];
  const table=el('table',null,'pace-effect');
  const cap=el('caption','How the four dates respond');table.append(cap);
  const head=table.createTHead().insertRow();
  for (const name of ['Milestone','Reference','Sustained acceleration']) {const th=el('th',name);th.scope='col';head.append(th);}
  const rows=table.createTBody();
  for (const {id} of chronologicalMilestones(outlook.milestones, outlook)) {
    const m=milestones.find(row=>row.id===id);
    if (!m)continue;
    const tr=rows.insertRow(), th=el('th',miniNames[id]);th.scope='row';
    const ref=el('td',Number.isInteger(m.referenceYear)?m.referenceYear:'Open');
    const issued=outlook.milestones.find(row=>row.id===id)?.scenarios?.find(s=>s.label==='Sustained acceleration');
    const adjusted=Number.isInteger(m.accelerationYear) ? String(m.accelerationYear)
      : (issued?.year===null?'After '+outlook.horizonYear+' or never':'No dated projection');
    const alt=el('td',adjusted);
    const delta=directionsYear(m.referenceYear,m.accelerationYear);
    if(delta) alt.append(el('small',delta));
    tr.append(th,ref,alt);
  }
  body.append(table);
  const reason=milestones.find(m=>m.id==='singularity')?.reason;
  if(reason)body.append(el('p',reason,'pace-note'));
  const inputs=pace.referenceInputs || {};
  const gates=inputs.accelerationGates;
  if (gates?.length && gates.every(g=>Number.isInteger(g.year))) {
    const explanation=el('details',null,'obs-detail pace-details');
    explanation.append(el('summary','What sets the accelerated date?'));
    const list=el('dl',null,'pace-gates');
    const last=Math.max(...gates.map(g=>g.year));
    for (const g of gates) {
      const item=el('div');
      const result=el('dd',g.year);
      if(g.year===last) result.append(el('small','Sets the date'));
      item.append(el('dt',g.label),result);list.append(item);
    }
    explanation.append(list);
    if (finite(pace.cycle?.ratio) && finite(pace.cycle?.months)) explanation.append(el('p','One extra research cycle lasting '+format(pace.cycle.originalMonths)+' months would take '+format(pace.cycle.months)+' months if the '+format(pace.cycle.ratio)+'× pace measured at Anthropic transferred to that cycle.','pace-note'));
    body.append(explanation);
  }
  const link=el('a','Explore each milestone scenario ↓');link.href='#calculations';body.append(link);
}

export function renderAcceleration(root, outlook, {detailed=false}={}) {
  if (!root) return;
  root.replaceChildren();
  root.hidden = !outlook?.pace;
  if(root.hidden) return;
  const pace=outlook.pace;
  const pane=el('div',null,'pace-body');
  const events=pace.eventPace;
  const options=[['capability','Task capability']];
  if (events?.periods?.length) options.push(['activity','Release activity']);
  if (events?.impacts?.length) options.push(['impact','Measured impact']);
  if (pace.milestones?.length) options.push(['forecast','Forecast impact']);
  const draw=id=>{
    pane.replaceChildren();
    if(id==='capability')capabilityView(pane,pace,detailed);
    else if(id==='activity')activityView(pane,events);
    else if(id==='impact')impactView(pane,events);
    else forecastEffect(pane,pace,outlook);
  };
  const title=el('h2','The measured pace of AI');
  const menu=selector('Explore the acceleration evidence',options,'capability',draw);
  menu.classList.add('pace-views');
  root.append(title,menu,pane);draw('capability');
}

export function paceHeadline(outlook) {
  const {pace}=outlook || {};
  const shift=referenceShift(outlook);
  if (!pace || !shift) return null;
  const box=el('div',null,'pace-hero-reading');
  const year=Number.isInteger(shift.accelerated) ? shift.accelerated : 'After '+shift.horizon+' or never';
  const title=el('p');title.append(el('strong',year),' under sustained acceleration');
  const delta=directionsYear(shift.reference,shift.accelerated);
  if(delta)title.append(el('small',delta==='Same year'?'Matches the reference':delta+' than the reference'));
  box.append(title);
  const fit=pace.series?.find(s=>s.fit?.supported && finite(s.fit.doublingDays));
  if (fit) box.append(el('p','On METR’s '+(fit.id==='horizon50'?'50%':'80%')+'-success tests, task length doubled about every '+Math.round(fit.fit.doublingDays)+' days.'));
  const a=el('a','See the growth rates and assumptions ↓');a.href='#acceleration';box.append(a);
  return box;
}
