import { dated } from './observatory-criteria.js';
import { outlookAnchors as anchors, outlookSources, outlookResearchCheckedOn } from './observatory-outlook-sources.js';

export const outlookVersion = '1.0.0';
const horizonYear = 2100;
const yearMs = 365.2425 * 86400000;
const dateYear = date => Number(dated(date)?.slice(0, 4)) || null;
const meanPair = (a, b) => (a + b) / 2;
const steps = ['Faster development', 'Reference scenario', 'Slower development', 'Stalled or never realized'];
const median = values => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : meanPair(sorted[middle - 1], sorted[middle]);
};
const latest = rows => [...rows].sort((a, b) => (b.referenceOn || '').localeCompare(a.referenceOn || '') || b.value - a.value)[0];
// An integer stands for the midpoint of a named calendar year. Rounding after
// a lag then returns the year containing a date, including July–December.
const absoluteYear = iso => {
  const day = new Date(iso), year = day.getUTCFullYear();
  return year - 0.5 + (day - Date.UTC(year, 0, 1)) / (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1));
};
const showNumber = n => Number(n.toPrecision(3)).toString();
const add = (year, lag) => year === null ? null : year + lag;
const later = (...years) => years.includes(null) ? null : Math.max(...years);
const yearOrOpen = year => Number.isFinite(year) && Math.round(year) <= horizonYear ? Math.round(year) : null;

function researchPanel(panel, cutoff) {
  // Each panelist contributes exactly one SAR median. Do not treat correlated
  // panelists, or the spread of their medians, as independent probability draws.
  const catalogDate = outlookSources.find(s => s.id === 'ai-futures-nov').publishedOn;
  if (panel && dated(panel.publishedOn) && panel.publishedOn >= catalogDate && panel.publishedOn <= cutoff && panel.medians?.length &&
      panel.medians.every(x => /^\d{4}-(?:0[1-9]|1[0-2])$/.test(x.month)) &&
      new Set(panel.medians.map(x => x.author)).size === panel.medians.length &&
      /^https:\/\/blog\.aifutures\.org\/p\/[a-z0-9-]+$/.test(panel.articleUrl ?? '')) {
    const years = panel.medians.map(x => Number(x.month.slice(0, 4)) - 0.5 + (Number(x.month.slice(5)) - 0.5) / 12);
    return { year: median(years), date: panel.publishedOn, url: panel.articleUrl, fromArchive: true };
  }
  return { year: anchors.aiFutures.sarYear, date: null, url: null, fromArchive: false };
}

function reliabilityPace(rows) {
  const reports = rows.filter(r => r.topic === 'reliability' && r.source === 'METR' &&
    r.classification === 'Independent evaluation' && r.unit === 'h' && r.system &&
    r.referenceDateBasis === 'Model release date' && dated(r.referenceOn) && r.value > 0);
  const byMonth = new Map();
  for (const row of reports) {
    const month = row.referenceOn.slice(0, 7);
    const existing = byMonth.get(month);
    if (!existing || row.value > existing.value || (row.value === existing.value && row.referenceOn < existing.referenceOn))
      byMonth.set(month, row);
  }
  const history = [...byMonth.values()].sort((a, b) => a.referenceOn.localeCompare(b.referenceOn));
  const last = history.at(-1);
  if (!last) return null;
  const recent = history.filter(r => Date.parse(last.referenceOn) - Date.parse(r.referenceOn) <= 2 * yearMs);
  const slopes = [];
  if (recent.length >= 4)
    for (let i = 1; i < recent.length; i++)
      for (const earlier of recent.slice(0, i))
        slopes.push(Math.log2(recent[i].value / earlier.value) * yearMs / (Date.parse(recent[i].referenceOn) - Date.parse(earlier.referenceOn)));
  return { last, months: recent.length, doublingsPerYear: slopes.length ? median(slopes) : null };
}

// A proxy crossing is an explicit scenario assumption. With inadequate data
// the outside anchors stand alone. A measured non-growing series can stall.
function proxyFloor(pace, hours, outsideYear, alternateYear) {
  if (outsideYear === null) return null;
  if (!pace || pace.doublingsPerYear === null) return outsideYear;
  const start = absoluteYear(pace.last.referenceOn);
  if (pace.last.value >= hours) return Math.max(outsideYear, start);
  const crossing = pace.doublingsPerYear > 0 ? start + Math.log2(hours / pace.last.value) / pace.doublingsPerYear : Infinity;
  // In the faster and reference cases another development route can deliver at
  // the next slower outside anchor. Gradually worsening benchmark pace then
  // cannot produce an earlier date at the arbitrary reporting-horizon boundary.
  const route = Number.isFinite(alternateYear) ? Math.min(crossing, Math.max(outsideYear, alternateYear)) : crossing;
  return route <= horizonYear ? Math.max(outsideYear, route) : null;
}

function surveyLag(answers) {
  // Straight-line interpolation in elapsed years between the two elicited
  // conditional probabilities. Also expose a log-time alternative.
  const f = (0.5 - answers.p1) / (answers.p2 - answers.p1);
  return { linear: answers.years1 + f * (answers.years2 - answers.years1),
    log: answers.years1 * (answers.years2 / answers.years1) ** f };
}

function applyStrict(path, strict) {
  if (!dateYear(strict?.centralDate)) return path;
  const center = dateYear(strict.centralDate);
  if (strict.status === 'Observed') return [center, center, center, center];
  if (strict.status === 'Estimated')
    return [dateYear(strict.range?.low) ?? center, center, dateYear(strict.range?.high), null];
  return path;
}

function initialLinkYear(m, asOf) {
  const link = m?.criteria?.find(c => c.id === 'rsi-contribution' && c.status === 'met');
  const review = link?.reviews?.map(r => dated(r.reviewedAt)).filter(d => d && d <= asOf).sort()[0];
  return review ? absoluteYear(review) : null;
}

function progressFor(id, m, observations, sources, pace) {
  const source = key => sources.find(s => s.id === key)?.finding;
  const evidence = [], ids = [];
  const note = (key, item) => { if (item) { evidence.push(item); if (key) ids.push(key); } };
  if (id === 'agi') {
    note('arc-agi-3', source('arc-agi-3'));
    if (pace) note('metr-horizons', 'On METR’s latest measured release month, ' + pace.last.system +
      ' reached an estimated 80% success rate on selected tasks taking a human expert about ' +
      showNumber(pace.last.value) + ' hours (' + pace.last.referenceOn + ' model release).');
  }
  if (id === 'rsi') {
    note('sakana-dgm', source('sakana-dgm'));
    note('dgm-followup', source('dgm-followup'));
    note('epoch-work', source('epoch-work'));
    const work = latest(observations.filter(o => o.topic === 'research-autonomy' && o.unit === '%' && o.organization === 'OpenAI'));
    if (work) note(null, 'OpenAI reported that its AI systems completed ' + work.value + '% of its selected internal research tasks without assistance in the period ending ' + work.referenceOn + '.');
  }
  if (id === 'asi') {
    note('epoch-frontiermath', source('epoch-frontiermath'));
    note('arc-agi-3', source('arc-agi-3'));
  }
  if (id === 'singularity') {
    const rate = latest(observations.filter(o => o.topic === 'research-acceleration' && o.source === 'METR' && o.unit === '×'));
    if (rate) note('metr-research', 'METR estimated that progress on the measured benchmarks at Anthropic ran at ' +
      showNumber(rate.value) + ' times its earlier rate' +
      (Number.isFinite(rate.low) && Number.isFinite(rate.high) ? ' (reported range ' + showNumber(rate.low) + '–' + showNumber(rate.high) + ')' : '') +
      '. This comparison includes changes in compute, staffing and other inputs.');
    note('fri-fast-year', source('fri-fast-year'));
    note('leap-growth', source('leap-growth'));
  }
  const explanations = {
    agi: pace ? pace.last.system + ' reached 80% success on selected tasks taking an expert about ' + showNumber(pace.last.value) + ' hours. Reliable transfer across unfamiliar domains remains open.' : 'Comparable tests of broad human-level skill and transfer on unfamiliar work remain open.',
    rsi: (source('dgm-followup') ? 'A second team reproduced gains in a self-editing coding agent. ' : '') + 'The contribution of each successive generation on independent tests remains open.',
    asi: (source('epoch-frontiermath') ? 'Epoch credited AI alone with five open mathematics solutions in its November 2026 register. ' : '') + 'Comparable superiority across other disciplines remains open.',
    singularity: (ids.includes('metr-research') ? 'METR observed faster capability gains at one lab. ' : '') + 'Independent evidence of a sustained AI-driven speedup across wider technology remains open.',
  };
  return { summary: m?.score === 100 ? 'The observatory has independently verified all required conditions for this milestone.' : explanations[id],
    evidence, sourceIds: [...new Set(ids)], coverage: m?.coverage ?? null };
}

export function buildArrivalOutlook(assessment, { previous = null, researchForecast = null } = {}) {
  const asOf = assessment.evidenceCutoff ?? assessment.checkpointAt, cutoff = dated(asOf);
  if (!cutoff) throw new Error('A dated assessment is required for the arrival outlook.');
  if (cutoff < outlookResearchCheckedOn) return null;
  const sources = outlookSources.filter(s => {
    // Publication month alone must not imply access on the first day of that month.
    const published = /^\d{4}-\d{2}$/.test(s.publishedOn ?? '') ?
      new Date(Date.UTC(Number(s.publishedOn.slice(0, 4)), Number(s.publishedOn.slice(5)), 0)).toISOString().slice(0, 10) : dated(s.publishedOn);
    return (s.availableBy ?? published ?? s.dataThrough ?? outlookResearchCheckedOn) <= cutoff && (!s.dataThrough || s.dataThrough <= cutoff);
  });
  const primary = ['espai-2024', 'leap-8', 'ai-futures-nov'];
  // A later supplement may be attached to the original reading. Replaying an
  // earlier scientific edition must never introduce then-unpublished forecasts.
  if (!primary.every(id => sources.some(s => s.id === id))) return null;
  const observations = (assessment.observations ?? []).filter(o =>
    (!o.referenceOn || o.referenceOn <= cutoff) && (!o.publishedOn || o.publishedOn <= cutoff) &&
    (!o.retrievedAt || Date.parse(o.retrievedAt) <= Date.parse(asOf)));
  const byId = new Map(assessment.milestones.map(m => [m.id, m]));
  const strict = new Map((assessment.forecasts ?? []).map(f => [f.id, f]));
  const pace = reliabilityPace(observations), panel = researchPanel(researchForecast, cutoff);
  if (panel.fromArchive && !sources.some(s => s.url === panel.url))
    sources.push({id:'current-sar-panel', title:'Latest archived AI Futures research forecast', url:panel.url, publishedOn:panel.date,
      finding:'Median of the individual forecast dates in this edition’s research-automation panel.', limitation:'The target concerns AI research at a laboratory.', milestones:['rsi','singularity']});
  const sarId = sources.some(s => s.id === 'current-sar-panel') ? 'current-sar-panel' : 'ai-futures-nov';
  const broad = anchors.hlmi, labor = anchors.leapAgi;
  const broadYears = [broad.q10, meanPair(broad.q50,labor.q50), labor.q75, null];
  const agi = applyStrict(broadYears.map((t,i) => proxyFloor(pace, 8, t, broadYears[i+1])), strict.get('agi'));
  // A separately dated, same-system ASI verification/projection also supplies an
  // upper bound on AGI, because this site's ASI definition includes AGI.
  const specificAsi = strict.get('asi');
  if (['Observed','Estimated'].includes(specificAsi?.status)) {
    const cap = applyStrict([], specificAsi);
    for (let i = 0; i < agi.length; i++)
      if (cap[i] !== null && (agi[i] === null || agi[i] > cap[i])) agi[i] = cap[i];
  }
  const firstLink = initialLinkYear(byId.get('rsi'), cutoff);
  const researchYears = [panel.year, meanPair(panel.year, anchors.mlPaper.q50), anchors.researchJob.q50];
  const cycles = [0.5, 1, 2]; // declared durations in years per successor cycle
  const rsi = applyStrict([...researchYears.map((t, i) => firstLink === null
    ? add(proxyFloor(pace, 40, t, researchYears[i+1]), 2 * cycles[i]) : firstLink + cycles[i]), null], strict.get('rsi'));
  const asiLag = surveyLag(anchors.asiLag), speedLag = surveyLag(anchors.speedupLag);
  const asi = applyStrict([later(agi[0], anchors.aiFutures.topExpertYear), add(agi[1], asiLag.linear),
    add(agi[2], anchors.asiLag.years2), null], specificAsi);
  // Only the broad-diffusion paths use AGI as an enabling stage. A faster
  // research-led transition could precede general intelligence.
  const singularity = applyStrict([add(rsi[0], cycles[0]),
    later(add(rsi[1], cycles[1]), add(agi[1], speedLag.linear), anchors.leapRapid.q50),
    later(add(rsi[2], cycles[2]), add(agi[2], anchors.speedupLag.years2), anchors.leapRapid.q50), null],
  strict.get('singularity'));
  const proxyText = pace?.doublingsPerYear != null
    ? 'The last ' + pace.months + ' measured months in the two-year release window imply ' + showNumber(pace.doublingsPerYear) +
      ' doublings per year on METR’s 80%-success series. This is the median slope between pairs of monthly peaks on a logarithmic scale. The fast and reference cases can also reach the capability by another route at the next slower outside anchor. This limits how far one narrow test can delay them. The slow case has no fallback and can remain unresolved beyond 2100. Sparse results and limited task coverage make continued growth uncertain.'
    : 'There are too few comparable task-horizon measurements to estimate a growth rate. The outside forecasts supply the timing.';
  const methods = {
    agi: {
      path: agi, sourceIds: ['espai-2024','leap-8','metr-horizons','metaculus-agi'],
      basis: 'The reference takes the calendar-year midpoint of ' + broad.q50 + ' for machines doing every task better and more cheaply than humans and ' +
        labor.q50 + ' for beating 90th-percentile professionals on most tasks in each nonphysical occupation, conditional on recognition by 2100. Each central date gets equal weight. Both targets demand more on some dimensions than our skilled-human test, which could make this reference late. Our requirements for independent proof and transfer can delay recognition.',
      assumptions: ['The early case uses the AI researcher survey’s 10% year (' + broad.q10 + '). The slow case uses LEAP’s conditional 75th-percentile year (' + labor.q75 + '). The finite span combines different questions and has no assigned probability.',
        'All three paths assume a system capable of broad, reliable work can also handle a human workday (8 expert hours) on METR’s selected tasks at 80% success. If that extrapolated waypoint falls later than the survey anchor, it delays this estimate. The workday is an illustrative bridge to the forecast.', proxyText] },
    rsi: {
      path:rsi, sourceIds:[sarId,'espai-2024','metr-horizons','sakana-dgm'],
      basis:'The reference averages the AI Futures panel’s research-automation date (about ' + Math.round(panel.year) +
        ') with the surveyed ' + anchors.mlPaper.q50 + ' date for autonomously conducting and writing one publishable ML study. It then allows one year each for two successive improvements.',
      assumptions:['The faster case starts at the research panel’s estimate with six months per cycle. The slower case starts at the surveyed AI-researcher job date (' +
        anchors.researchJob.q50 + ') with two years per cycle. These durations are modeling choices. Successor cycles could fail altogether.',
        'Until a first successor improvement is independently established, each path also assumes a 40-expert-hour task at 80% success on METR’s selected suite. A specialist could achieve repeated improvement with shorter tasks. A verified first link replaces the assumed start with its review date and leaves one cycle.', proxyText] },
    asi: {
      path:asi, sourceIds:['espai-2024','ai-futures-nov','leap-8'],
      basis:'Under this definition broad expert superiority includes AGI. The reference adds about ' + Math.round(asiLag.linear) +
        ' years to the AGI reference. That delay interpolates survey responses on how quickly vastly superhuman performance could follow human-level AI.',
      assumptions:['Respondents’ median conditional probabilities were ' + 100*anchors.asiLag.p1 + '% after two years and ' + 100*anchors.asiLag.p2 +
        '% after thirty. Straight-line interpolation in elapsed years gives the reference delay. Interpolating in log time gives about ' + Math.round(asiLag.log) + ' years instead. Neither calculation is a measured takeoff rate.',
        'The fast case uses the AI Futures panel’s top-expert-dominating AI date (' + anchors.aiFutures.topExpertYear + '), subject to the fast AGI date. The slow case adds 30 years to slow AGI. Some systems that reach AGI may never achieve broad expert superiority.'] },
    singularity: {
      path:singularity, sourceIds:['espai-2024','leap-8',sarId,'metr-research','fri-fast-year'],
      basis:'The reference waits for all three conditions: another development interval after recursive improvement, the surveyed global technology speedup after human-level AI, and LEAP’s conditional ' + anchors.leapRapid.q50 + ' estimate for widespread rapid progress.',
      assumptions:['Survey respondents’ median conditional probabilities for a dramatic technology speedup were ' + 100*anchors.speedupLag.p1 + '% within two years and ' + 100*anchors.speedupLag.p2 +
        '% within thirty. Straight-line interpolation gives a delay of ' + Math.round(speedLag.linear) + ' years after AGI. Interpolation in log time gives about ' +
        Math.round(speedLag.log) + '. The LEAP question includes physical progress and does not require AI causation. Both are proxies.',
        'In the faster case, the next six-month research interval after RSI already establishes accelerating gains and broad spillover. In the slower case, the transition takes at least 30 years after slow AGI and another two-year interval after slow RSI. Even advanced AI might produce no sustained, independently attributable change in the wider pace of technology.'] },
  };
  const rows = Object.entries(methods).map(([id, rule]) => {
    const m = byId.get(id), measured = strict.get(id);
    const scenes = rule.path.map((v, i) => ({label:steps[i],year:yearOrOpen(v)}));
    const centralYear = scenes[1].year, dates = scenes.map(s => s.year).filter(Number.isFinite);
    const status = ['Observed','Estimated'].includes(measured?.status) ? (measured.status === 'Observed' ? 'Observed' : 'Criterion-based estimate') : 'Scenario estimate';
    if (status === 'Observed') scenes.splice(0, scenes.length, {label:'First independently verified', year:centralYear});
    const progress = progressFor(id, m, observations, sources, pace);
    const prior = previous?.milestones?.find(x => x.id === id);
    const range = {low:dates.length ? Math.min(...dates) : null,high:scenes[2]?.year === null ? null : dates.length ? Math.max(...dates) : null};
    const changedRange = prior && (range.low !== prior.range?.low || range.high !== prior.range?.high);
    return {
      id,label:m?.label ?? id, status, timingStatus:status === 'Observed' ? 'Observed' : centralYear === null ? 'Beyond horizon' : centralYear < dateYear(asOf) ? 'Reference year passed' : 'Current',
      centralYear,yearsRemaining:centralYear === null ? null : Math.max(0, centralYear - dateYear(asOf)),
      range, horizonYear,beyondHorizonPathCount:scenes.filter(s => s.year === null).length,scenarioCount:scenes.length,scenarios:scenes,
      basis:status === 'Scenario estimate' ? rule.basis : measured.reason,
      assumptions:status === 'Scenario estimate' ? rule.assumptions : measured.assumptions ?? [],
      sourceIds:[...new Set([...rule.sourceIds,...progress.sourceIds])].filter(key => sources.some(s => s.id === key)),
      progress,previousYear:prior?.centralYear ?? null,
      change:!prior ? 'First published arrival outlook.' : prior.centralYear === centralYear && prior.status === status ?
        changedRange ? 'The central estimate held steady. The scenario range changed from ' +
          (prior.range?.low ?? 'open') + '–' + (prior.range?.high ?? 'beyond 2100') + ' to ' +
          (range.low ?? 'open') + '–' + (range.high ?? 'beyond 2100') + '.' :
          'Central estimate and range unchanged from the previous outlook.' : 'Revised from ' + (prior.centralYear ?? 'beyond 2100') + ' to ' + (centralYear ?? 'beyond 2100') + '.',
    };
  });
  return { version:outlookVersion,asOf,horizonYear,
    method:'Three explicit development paths combine survey judgments, independent measurements and declared assumptions. A fourth path allows progress to stall beyond 2100. Calendar years are rounded. Time remaining is the difference in calendar years.',
    limitations:'The central estimate is the reference scenario. The early and late dates show how assumptions change the answer. Scenario counts carry no measured probability. There is no historical sample of these four transitions against which to validate coverage.',
    sources,milestones:rows };
}
