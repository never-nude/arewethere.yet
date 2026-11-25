// Reconstruct each single published METR series at its actual release dates.
// The historical evaluation uses the data vintage in the selected checkpoint.
const dayMs = 86400000;
const mean = values => values.reduce((sum, v) => sum + v, 0) / values.length;
const names = {persistence:'Persistence', linear:'Linear', exponential:'Exponential'};
const rateModels = Object.keys(names);
const precision = v => Number.isFinite(v) ? Number(v.toPrecision(6)) : null;

function train(points, family) {
  const last = points.at(-1);
  if (family === 'persistence') return {lastDate:last.date, atLast:last.value, slope:0, family};
  const times = points.map(p => (Date.parse(p.date) - Date.parse(last.date)) / dayMs);
  const levels = points.map(p => family === 'exponential' ? Math.log(p.value) : p.value);
  const x = mean(times), y = mean(levels);
  const variance = times.reduce((sum, t) => sum + (t - x) ** 2, 0);
  if (!variance) return null;
  const slope = times.reduce((sum, t, i) => sum + (t - x) * (levels[i] - y), 0) / variance;
  return {lastDate:last.date, atLast:y - slope * x, slope, family};
}

function predict(model, date) {
  if (!model) return Infinity;
  const level = model.atLast + model.slope * ((Date.parse(date) - Date.parse(model.lastDate)) / dayMs);
  return model.family === 'exponential' ? Math.exp(level) : Math.max(0, level);
}

function errorsFor(points, start, family, fixed = false) {
  const fixedModel = fixed ? train(points.slice(0,start), family) : null;
  return points.slice(start).map((p,i) => Math.abs(p.value - predict(fixed ? fixedModel : train(points.slice(0,start+i), family), p.date)));
}

function best(errors) {
  // Ties favor the simpler null or linear model.
  return rateModels.reduce((a,b) => errors[b] < errors[a] ? b : a);
}

export function fitPace(points) {
  const n = points.length, origins = n - 4;
  const result = {winner:null,supported:false,holdouts:0,selectionCount:0,errors:{persistence:null,linear:null,exponential:null},
    selectionErrors:null,fixedErrors:null,doublingDays:null,maxLeadDays:null,description:''};
  const allExponential = n >= 4 ? train(points,'exponential') : null;
  if (origins < 4) {
    result.description = n + ' measured release months. Comparing the trends requires four initial months and at least two separate months each for selection and evaluation.';
    return {fit:result, selectedModel:null, illustrativeModel:allExponential};
  }
  const selectionCount = Math.max(2,Math.floor(origins / 2));
  const boundary = 4 + selectionCount;
  const selection = {}, holdout = {}, fixed = {};
  for (const key of rateModels) {
    const errors = errorsFor(points,4,key);
    selection[key] = mean(errors.slice(0,selectionCount));
    holdout[key] = mean(errors.slice(selectionCount));
    fixed[key] = mean(errorsFor(points,boundary,key,true));
  }
  const candidate = best(selection);
  const supported = candidate !== 'persistence' && holdout[candidate] < holdout.persistence && fixed[candidate] < fixed.persistence &&
    best(holdout) === candidate && best(fixed) === candidate;
  const selected = supported ? train(points,candidate) : null;
  const roundErrors = e => Object.fromEntries(rateModels.map(k => [k,precision(e[k])]));
  Object.assign(result,{winner:names[candidate],supported,selectionCount,holdouts:n-boundary,errors:roundErrors(holdout),
    selectionErrors:roundErrors(selection),fixedErrors:roundErrors(fixed),
    maxLeadDays:Math.round((Date.parse(points.at(-1).date)-Date.parse(points[boundary-1].date))/dayMs),
    doublingDays:selected?.family === 'exponential' && selected.slope > 0 ? precision(Math.log(2)/selected.slope) : null,
    description: supported ? names[candidate]+' trend had the lowest average error on both the later one-step comparisons and the multi-month projection from their common starting date.' :
      names[candidate]+' had the smallest early error. The later tests did not establish a growth rule that consistently improved on both alternatives.'});
  return {fit:result,selectedModel:selected,illustrativeModel:allExponential};
}

function crossing(model, target, last) {
  if (!model || model.slope <= 0) return null;
  const level = model.family === 'exponential' ? Math.log(target) : target;
  // Keep the forecast origin, slope and intercept consistent with the historical test.
  const days = (level-model.atLast)/model.slope;
  if (!(days > 0 && days < 36525)) return null;
  return new Date(Date.parse(last.date)+Math.ceil(days)*dayMs).toISOString().slice(0,10);
}

export function waypoint(series, models, hours) {
  const last = series.points.at(-1);
  const base = {hours,latestHours:last?.value ?? null,latestDate:last?.date ?? null,estimatedDate:null,illustrativeDate:null,
    status:'No qualified projection',reason:'This edition contains no comparable measurement.'};
  if (!last) return base;
  const reached = series.points.find(p => p.value >= hours);
  if (last.value >= hours) return {...base, status:'Observed on this suite',estimatedDate:reached.date,
    reason:'A measured monthly peak reached this task length on the selected suite. This records the benchmark result for that model.'};
  if (reached) base.previouslyReachedDate = reached.date;
  const projected = crossing(models.selectedModel,hours,last);
  if (projected && Date.parse(projected)-Date.parse(last.date) <= series.fit.maxLeadDays*dayMs)
    return {...base, status:'Within tested forecast horizon',estimatedDate:projected,
      reason:'The selected growth rule crosses within a lead time tested against later releases. The milestone still requires independent evidence.'};
  return {...base,illustrativeDate:crossing(models.illustrativeModel,hours,last),
    reason:models.selectedModel ? 'The crossing falls outside the lead time supported by the later comparisons, or the fitted trend supplies no future crossing.' :
      'The 80% series has no validated growth rule. Extending its fitted exponential curve illustrates a possibility only.'};
}

const protocols = [
  {id:'horizon80',topic:'reliability',success:80,label:'Reliable task length · 80% success'},
  {id:'horizon50',topic:'horizon',success:50,label:'Task length · 50% success'},
];

function available(row, cutoff, spec) {
  if (row.topic !== spec.topic || row.source !== 'METR' || row.classification !== 'Independent evaluation' ||
      row.referenceDateBasis !== 'Model release date' || row.unit !== 'h' || !Number.isFinite(row.value) || row.value <= 0 ||
      !row.system || !row.publishedOn || !row.referenceOn || !row.datasetUrl || !row.sourceUrl ||
      ['unavailable','withdrawn','retracted','missing'].includes(row.sourceStatus)) return false;
  try {
    if (new URL(row.sourceUrl).origin !== 'https://metr.org' || new URL(row.datasetUrl).origin !== 'https://metr.org') return false;
  } catch { return false; }
  return [row.referenceOn,row.publishedOn,...(row.retrievedAt ? [row.retrievedAt] : [])].every(t => Number.isFinite(Date.parse(t)) && Date.parse(t) <= cutoff);
}

export function taskPace(assessment) {
  const cutoff = Date.parse(assessment.evidenceCutoff ?? assessment.checkpointAt);
  const series = []; let waypoints=[];
  for (const spec of protocols) {
    const rows = (assessment.observations ?? []).filter(r => available(r,cutoff,spec));
    const publication = rows.map(r=>r.publishedOn).sort().at(-1);
    const reports = rows.filter(r=>r.publishedOn === publication);
    // Refuse to pool distinct suites even if they share the same release day.
    const datasets = new Set(reports.map(r=>r.datasetUrl));
    const chosen = datasets.size === 1 ? reports : [];
    const monthly = new Map();
    for (const r of chosen) {
      const key=r.referenceOn.slice(0,7), old=monthly.get(key);
      if (!old || r.value > old.value || (r.value === old.value && (r.referenceOn < old.date || (r.referenceOn === old.date && r.system < old.system))))
        monthly.set(key,{date:r.referenceOn,value:r.value,system:r.system});
    }
    const points=[...monthly.values()].sort((a,b)=>a.date.localeCompare(b.date));
    const models=fitPace(points);
    const row={id:spec.id,label:spec.label,unit:'expert hours',success:spec.success,points,fit:models.fit,
      publishedOn:publication ?? null,sourceUrl:chosen[0]?.sourceUrl ?? null};
    if (spec.success === 50 && chosen[0]?.sourceUrl?.startsWith('https://metr.org/blog/2026-11-20-q4-2026-capability-update/') && publication === '2026-11-20')
      row.publishedEstimate={doublingMonths:3.61,lowMonths:2.08,highMonths:4.94,interval:'95% confidence interval',
        description:'METR’s own analysis combines TH1.1 and TH2 task suites and includes additional modeling choices.'};
    series.push(row);
    if (spec.success === 80) {
      waypoints=[8,40].map(hours=>{
        const reading=waypoint(row,models,hours);
        if (reading.illustrativeDate && Date.parse(reading.illustrativeDate)<cutoff)
          reading.reason+=' The illustrative date has passed without a qualifying measurement in this edition.';
        return reading;
      });
    }
  }
  return {series,waypoints};
}
