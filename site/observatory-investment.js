import firstResources from './data/first-training-resources.js';
import {scoredModelObservations} from './observatory-scored-models.js';

const dollars = new Intl.NumberFormat('en', {style: 'currency', currency: 'USD', notation: 'compact', maximumSignificantDigits: 3});
export const formatCost = value => Number.isFinite(value) ? dollars.format(value) : 'No figure';

export function resourcesFor(assessment, {archived = false} = {}) {
  return assessment.modelResources || (!archived && assessment.checkpointAt === firstResources.forEdition ? firstResources : null);
}

const costMaps = new WeakMap();
export function modelTrainingCost(assessment, modelName, options) {
  const data = resourcesFor(assessment, options);
  if (!data) return null;
  if (!costMaps.has(data)) costMaps.set(data, new Map(data.models.map(r => [r.model, r.cost])));
  return costMaps.get(data).get(modelName) ?? null;
}

const measures = {
  cost: {label: 'Training cost', unit: 'Estimated training compute cost · 2023 USD', format: formatCost},
  operations: {label: 'Computation', unit: 'Training computation · operations', format: v => v.toExponential(1).replace('e+', ' × 10^')},
  hours: {label: 'Training time', unit: 'Training duration · days', format: v => new Intl.NumberFormat('en', {maximumSignificantDigits: 3}).format(v / 24) + ' days'},
};
const access = {'Open weights': 'open', 'Closed weights': 'closed'};
const svgNS = 'http://www.w3.org/2000/svg';
function node(tag, text, cls) {
  const n = document.createElement(tag);
  if (text != null) n.textContent = text;
  if (cls) n.className = cls;
  return n;
}
function shape(tag, attrs, text) {
  const n = document.createElementNS(svgNS, tag);
  for (const [key, value] of Object.entries(attrs)) n.setAttribute(key, String(value));
  if (text != null) n.textContent = text;
  return n;
}
function external(label, url) {
  const a = node('a', label);
  a.href = url;
  return a;
}
export function scoredResources(assessment, resources) {
  const inputs = new Map((resources?.models || []).map(row => [row.model, row]));
  const byName = new Map();
  for (const r of scoredModelObservations(assessment)) {
    if (byName.has(r.system) && byName.get(r.system).date >= r.referenceOn) continue;
    byName.set(r.system, {...inputs.get(r.system), model: r.system, date: r.referenceOn, score: r.value,
      access: access[r.weightAccess] || 'other', organization: r.organization || 'Unlisted developer'});
  }
  return [...byName.values()].sort((a,b) => b.score - a.score || a.model.localeCompare(b.model));
}

function transactionAmount(row) {
  return new Intl.NumberFormat('en', {style:'currency', currency:row.currency, notation:'compact', maximumSignificantDigits:3}).format(row.amount);
}

function fundingChart(container, entries, preferred) {
  const rows = node('div', null, 'iv-funding-rows');
  const info = node('div', null, 'iv-readout');
  info.setAttribute('aria-live', 'polite');
  container.append(node('p', 'Select a disclosure to see what the money covered. Bars compare individual US-dollar transactions. Other currencies appear at face value.', 'iv-caption'), rows, info);
  const usd = entries.filter(r => r.currency === 'USD');
  if (!entries.length) { rows.append(node('p', 'No company disclosures in this edition.')); return; }
  const highest = Math.max(...usd.map(r => r.amount));
  const buttons = [];
  function choose(index) {
    const row = entries[index];
    buttons.forEach((btn, i) => btn.setAttribute('aria-pressed', String(i === index)));
    info.replaceChildren(node('h4', row.kind), node('p', row.scope),
      external(row.issuer + ' · ' + row.when, row.url));
  }
  for (const [index, row] of entries.entries()) {
    const btn = node('button', null, 'iv-funding-row');
    btn.type = 'button';
    const bar = node('span', null, 'iv-funding-bar');
    bar.style.width = (row.amount / highest * 100) + '%';
    const track = node('span', null, 'iv-funding-track');
    track.setAttribute('aria-hidden','true'); track.append(bar);
    btn.append(node('span', row.organization), row.currency === 'USD' ? track : node('small', 'Reported in '+row.currency), node('strong', transactionAmount(row)));
    btn.addEventListener('click', () => choose(index)); rows.append(btn); buttons.push(btn);
  }
  choose(Math.max(0,entries.findIndex(r=>r.organization===preferred)));
}
function scatter(container, list, metric, selected, onSelected, funding, seeFunding) {
  const field = measures[metric];
  const available = list.filter(r => Number.isFinite(r[metric]) && r[metric] > 0);
  const body = node('div', null, 'iv-layout');
  const figure = node('figure', null, 'iv-figure');
  const caption = node('figcaption', field.unit + ' · logarithmic scale');
  const chart = shape('svg', {viewBox:'0 0 425 192', role:'img', 'aria-label':field.unit + ' compared with benchmark score. A model selector follows.'});
  figure.append(caption, chart);
  const detail = node('div', null, 'iv-inspector');
  const picker = node('select');
  const label = node('label', 'Inspect a model');
  label.append(picker);
  const record = node('div', null,'iv-reading');
  record.setAttribute('aria-live','polite');
  detail.append(label, record);
  const points = new Map();
  function select(name) {
    const r = list.find(row => row.model === name);
    if (!r) return;
    onSelected(name);
    picker.value = name;
    const pin = points.get(name);
    for (const p of points.values()) p.classList.toggle('iv-picked', p === pin);
    if (pin) chart.append(pin);
    const amount = Number.isFinite(r[metric]) ? field.format(r[metric]) : 'No public figure in this dataset';
    record.replaceChildren(node('strong', amount, 'iv-value'), node('span', r.organization + ' · ' + r.score + ' ECI', 'iv-model-meta'));
    const issuer = funding.find(entry => entry.organization.toLowerCase() === r.organization.toLowerCase());
    if (issuer) {
      const disclosure = node('button', issuer.organization + ' company financing · ' + transactionAmount(issuer), 'iv-see-funding');
      disclosure.type = 'button';
      disclosure.addEventListener('click', () => seeFunding(issuer.organization));
      record.append(disclosure);
    }
    if (metric === 'operations' && r.confidence && r.operations) record.append(node('small', 'Epoch rates the underlying training data as ' + r.confidence.toLowerCase() + '.'));
  }
  for (const r of list) picker.add(new Option(r.model, r.model));
  picker.addEventListener('change', () => select(picker.value));
  if (available.length) {
    const low = Math.floor(Math.log10(Math.min(...available.map(r => r[metric]))));
    const high = Math.max(low + 1, Math.ceil(Math.log10(Math.max(...available.map(r => r[metric])))));
    const start = Math.floor(Math.min(...available.map(r => r.score)) / 10) * 10;
    const end = Math.max(start + 10,Math.ceil(Math.max(...available.map(r => r.score)) / 10) * 10);
    const x=v=>81+(v-start)/(end-start)*325, y=v=>13+(high-Math.log10(v))/(high-low)*137;
    const step = Math.max(1, Math.ceil((high-low)/4));
    for (let exponent=low;exponent<=high;exponent+=step) {
      const v=10**exponent, pos=y(v);
      const tick = metric==='operations' ? '10^'+exponent : field.format(v);
      chart.append(shape('line',{x1:81,x2:406,y1:pos,y2:pos,class:'iv-line'}),
        shape('text',{x:74,y:pos+4,'text-anchor':'end'},tick));
    }
    for(let i=0;i<=2;i++) {
      const value=start+(end-start)*i/2;
      chart.append(shape('text',{x:x(value),y:167,'text-anchor':'middle'},value));
    }
    chart.append(shape('text',{x:243,y:187,'text-anchor':'middle'},'Benchmark score (ECI) →'));
    for (const r of available) {
      const group=shape('g',{class:'iv-point iv-'+r.access});
      const base={cx:x(r.score),cy:y(r[metric])};
      group.append(shape('circle',{...base,r:11,class:'iv-hit'}),shape('circle',{...base,r:4.4,class:'iv-dot'}),
        shape('title',{},r.model+' · '+field.format(r[metric])+' · '+r.score+' ECI'));
      group.addEventListener('click',()=>select(r.model));
      chart.append(group); points.set(r.model, group);
    }
  } else figure.replaceChildren(node('p','This edition has no models with both a score and this resource figure.'));
  const legend = node('div',null,'iv-key');
  for (const [cls,text] of [['open','Open'],['closed','Closed'],['other','Other access']]) {
    if (available.some(r=>r.access===cls)) legend.append(node('span',text,'iv-'+cls));
  }
  figure.append(legend);
  body.append(figure, detail);
  container.append(body, node('p', available.length+' of '+list.length+' scored models have a comparable '+field.label.toLowerCase()+' figure. Each dot is one model. Each tenfold increase gets the same vertical space.', 'iv-caption'));
  select(selected && list.some(r=>r.model===selected) ? selected : (available[0] || list[0])?.model);
}

export function renderInvestment(root, assessment, options = {}) {
  if (!root) return;
  const data = resourcesFor(assessment, options);
  root.classList.add('obs-panel','iv-panel');
  root.replaceChildren(node('h2','What goes into training a model?'));
  if (!data) {
    root.append(node('p','Model cost and financing records were first collected after this archived edition.', 'iv-caption'));
    return;
  }
  const scored = scoredResources(assessment, data);
  const controls = node('div',null,'iv-controls');
  controls.setAttribute('role','group'); controls.setAttribute('aria-label','Choose a resource to compare');
  const content = node('div',null,'iv-content');
  const reading = node('details',null,'obs-detail iv-details');
  reading.append(node('summary','Sources and forecast use'));
  const stamp = data.checkedAt ? new Date(data.checkedAt).toLocaleString('en-US',{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',timeZone:'UTC'}) + ' UTC' : 'unavailable';
  reading.append(node('p','Training cost covers the share of hardware used for a run and its electricity, expressed in 2023 US dollars. Salaries, earlier experiments and operating a deployed service are outside this figure. Versions can share a base training run, so adding their costs would double count some work.'),
    node('p','Funding shows selected company-wide disclosures. The forecast uses measured task performance and published expert estimates. Converting an investment dollar into days gained would require evidence about the capability it delivered.'),
    node('p','Resource dataset checked '+stamp + (data.status === 'last verified' ? '. Showing the last successful check.' : '.') + (data.forEdition ? ' This resource check followed the morning forecast.' : '')));
  const sources=node('p'); sources.append(external('Epoch AI · dataset and field definitions','https://epoch.ai/data/ai-models-documentation/records'),' · ',external('Epoch AI · source data (CC BY)', data.dataset)); if (data.forEdition) sources.append(' · ', external('First resource snapshot (JSON)', './data/first-training-resources.json'));
  reading.append(sources);
  root.append(controls, content, reading);
  let model, active, preferredCompany;
  const buttons = new Map();
  function show(id) {
    if (active === id) return;
    active = id;
    for (const [k,btn] of buttons) btn.setAttribute('aria-pressed',String(k===id));
    content.replaceChildren();
    if (id === 'funding') fundingChart(content, data.funding || [], preferredCompany);
    else scatter(content, scored, id, model, name => {model=name;}, data.funding || [], company => {
      preferredCompany = company;
      show('funding');
      buttons.get('funding').focus({preventScroll:true});
    });
  }
  for (const [id, label] of [...Object.entries(measures).map(([key,v])=>[key,v.label]), ['funding','Company funding']]) {
    const btn=node('button',label); btn.type='button';btn.dataset.metric=id;btn.addEventListener('click',()=>show(id));buttons.set(id,btn);controls.append(btn);
  }
  show('cost');
}
