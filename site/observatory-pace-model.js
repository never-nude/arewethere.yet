import {buildArrivalOutlook} from './observatory-outlook-model.js';
import {outlookAnchors} from './observatory-outlook-sources.js';
import {taskPace} from './observatory-pace-fit.js';

export const paceOutlookVersion = '2.0.0';
const acceleratedLabel = 'Sustained acceleration';
const year = iso => iso ? new Date(iso).getUTCFullYear() : null;
const maximum = (...dates) => dates.every(Number.isFinite) ? Math.max(...dates) : null;
const plus = (v,years) => Number.isFinite(v) ? v+years : null;
const bounded = (v,horizon) => Number.isFinite(v) && Math.round(v)<=horizon ? Math.round(v) : null;
const isScenario = row => row?.status === 'Scenario estimate';
const index = rows => new Map(rows.map(row=>[row.id,row]));
const finite = value => Number.isFinite(value) ? Number(value.toPrecision(6)) : null;
function interpolate(q) {
  const t = (.5-q.p1)/(q.p2-q.p1);
  return {linear:q.years1+(q.years2-q.years1)*t,log:q.years1*(q.years2/q.years1)**t};
}

function nextCycle(assessment) {
  const cutoff = Date.parse(assessment.evidenceCutoff ?? assessment.checkpointAt);
  const rates = (assessment.observations ?? []).filter(r =>
    r.topic === 'research-acceleration' && r.source === 'METR' && r.classification === 'Independent evaluation' &&
    r.organization === 'Anthropic' && r.unit === '×' && Number.isFinite(r.value) && r.value > 0 &&
    r.sourceUrl?.split('#')[0] === 'https://metr.org/blog/2026-11-05-anthropic-ai-rd-acceleration-assessment/' && r.publishedOn === '2026-11-05' &&
    Date.parse(r.publishedOn) <= cutoff && (!r.referenceOn || Date.parse(r.referenceOn) <= cutoff) &&
    (!r.retrievedAt || Date.parse(r.retrievedAt) <= cutoff) &&
    !['unavailable','withdrawn','retracted','missing'].includes(r.sourceStatus));
  const latest = rates.sort((a,b)=>b.publishedOn.localeCompare(a.publishedOn))[0];
  // The derivative describes one subsequent interval. Never multiply the
  // forecasters' dates or successive development cycles by the same gain.
  const months = latest ? 12/latest.value : 12;
  return {months:finite(months),ratio:latest?.value ?? null,sourceUrl:latest?.sourceUrl ?? null,sourceDate:latest?.publishedOn ?? null,
    originalMonths:12,lowMonths:latest?.high>0 ? finite(12/latest.high) : null,
    highMonths:latest?.low>0 ? finite(12/latest.low) : null,
    assumption:latest ? 'If one additional twelve-month research interval after recursive improvement could run at the whole rate measured at Anthropic, its duration would be 12 months divided by that rate. Staffing and computing changes also contributed. This is a one-cycle sensitivity.' :
      'No comparable lab-rate measurement is available. The assumption remains one additional twelve-month research interval.'};
}

function scenarioRow(row,reference,acceleration,past,reason,horizon,asOf) {
  if (row.status === 'Observed') return {...row};
  const scenarios=row.scenarios.map(s=>s.label==='Reference scenario' ? {...s,year:reference} : {...s});
  scenarios.push({label:acceleratedLabel,year:acceleration});
  const years=scenarios.map(s=>s.year).filter(Number.isFinite);
  const range={low:years.length ? Math.min(...years) : null,
    high:years.length && scenarios.find(s=>s.label==='Slower development')?.year !== null ? Math.max(...years) : null};
  let change=row.change;
  if (past) {
    if (past.centralYear !== reference) change='The reference moved from '+(past.centralYear ?? 'beyond '+horizon)+' to '+(reference ?? 'beyond '+horizon)+'.';
    else if (past.scenarios?.some(s=>s.label===acceleratedLabel)) {
      const earlier=past.scenarios.find(s=>s.label===acceleratedLabel).year;
      change=earlier===acceleration ? 'The reference and sustained-acceleration years held steady.' :
        'The reference held steady. The sustained-acceleration year moved from '+(earlier ?? 'beyond '+horizon)+' to '+(acceleration ?? 'beyond '+horizon)+'.';
    } else change='The reference held steady. This edition adds a sustained-acceleration scenario.';
  }
  return {...row,centralYear:reference,yearsRemaining:reference===null?null:Math.max(0,reference-year(asOf)),
    timingStatus:reference===null?'Beyond horizon':reference<year(asOf)?'Reference year passed':'Current',
    scenarios,range,scenarioCount:scenarios.length,beyondHorizonPathCount:scenarios.filter(s=>s.year===null).length,
    basis:isScenario(row) ? reason : row.basis, previousYear:past?.centralYear ?? row.previousYear,change};
}

export function buildPaceOutlook(assessment, baseOutlook, options = {}) {
  if (!baseOutlook || baseOutlook.version !== '1.0.0') return baseOutlook;
  const asOf = assessment.evidenceCutoff ?? assessment.checkpointAt, horizon = baseOutlook.horizonYear;
  const {series,waypoints} = taskPace(assessment);
  const cycle = nextCycle(assessment);
  const original = index(baseOutlook.milestones);
  // Isolate the same surveys, direct estimates, observed lineages, and panel
  // vintage used in v1. Replace only its unvalidated reliability extrapolation.
  const anchorOnly = buildArrivalOutlook({...assessment, observations:(assessment.observations??[]).filter(r=>r.topic!=='reliability')},
    {researchForecast:options.researchForecast});
  if (!anchorOnly) return baseOutlook;
  const anchors = index(anchorOnly.milestones);
  const {agi:agiBase,rsi:rsiBase,asi:asiBase,singularity:singBase} = Object.fromEntries(original);
  const strictASI = !isScenario(asiBase) ? asiBase.centralYear : null;
  const verifiedFirst = assessment.milestones.find(m=>m.id==='rsi')?.criteria?.find(c=>c.id==='rsi-contribution' && c.status==='met')?.reviews?.some(r=> Date.parse(r.reviewedAt)<=Date.parse(asOf));
  const [workday,workweek]=waypoints.map(w=>year(w.estimatedDate));
  const mergeWaypoint = (anchor,gateway,cycles=0) => !Number.isFinite(gateway) ? anchor : maximum(anchor,gateway+cycles);
  const agiFloor=anchors.get('agi').centralYear;
  let agi = isScenario(agiBase) ? mergeWaypoint(agiFloor,workday) : agiBase.centralYear;
  if (Number.isFinite(strictASI) && (agi===null || agi>strictASI)) agi=strictASI;
  const rsiFloor=anchors.get('rsi').centralYear;
  const rsi=isScenario(rsiBase) && !verifiedFirst ? mergeWaypoint(rsiFloor,workweek,2) : rsiBase.centralYear;
  const asiLag=interpolate(outlookAnchors.asiLag), speedLag=interpolate(outlookAnchors.speedupLag);
  const rapidYear=outlookAnchors.leapRapid.q50;
  const agiYear=bounded(agi,horizon),rsiYear=bounded(rsi,horizon);
  const referenceGates=[
    {label:'One further research cycle',year:bounded(plus(rsiYear,1),horizon)},
    {label:'Independent widespread-progress forecast',year:rapidYear},
    {label:'Technology diffusion after general intelligence',year:bounded(plus(agiYear,speedLag.linear),horizon)}];
  const reference={agi:agiYear,rsi:rsiYear,
    asi:isScenario(asiBase)?bounded(plus(agiYear,asiLag.linear),horizon):asiBase.centralYear,
    singularity:isScenario(singBase)?maximum(...referenceGates.map(c=>c.year)):singBase.centralYear};

  // Use one acceleration-informed panel as a conditional path. Date the
  // independent diffusion gate separately from its lab-focused judgments.
  const topExpert=outlookAnchors.aiFutures.topExpertYear;
  let fastAgi = isScenario(agiBase) ? mergeWaypoint(topExpert,workday) : agiBase.centralYear;
  if (Number.isFinite(strictASI) && (fastAgi===null || strictASI<fastAgi)) fastAgi=strictASI;
  const fastStart=anchors.get('rsi').scenarios.find(s=>s.label==='Faster development')?.year ?? null;
  const fastRsi = isScenario(rsiBase) && !verifiedFirst ? mergeWaypoint(fastStart,workweek,1) :
    (isScenario(rsiBase) ? fastStart : rsiBase.centralYear);
  const accelerationGates=[
    {label:'One further research cycle',year:bounded(plus(fastRsi,cycle.months/12),horizon)},
    {label:'Independent widespread-progress forecast',year:rapidYear},
    {label:'Technology diffusion after general intelligence',year:bounded(plus(fastAgi,speedLag.log),horizon)}];
  const acceleration={agi:bounded(fastAgi,horizon),rsi:bounded(fastRsi,horizon),
    asi:isScenario(asiBase)?bounded(maximum(fastAgi,topExpert),horizon):asiBase.centralYear,
    singularity:isScenario(singBase)?maximum(...accelerationGates.map(c=>c.year)):singBase.centralYear};

  const notes = {
    agi:'The reference retains the midpoint of the two broad-capability forecasts ('+outlookAnchors.hlmi.q50+' and '+outlookAnchors.leapAgi.q50+'). An independently reviewed eight-hour task result or validated short-range crossing can impose a later floor. The acceleration path uses the '+topExpert+' top-expert AI forecast and assumes its capability transfers across unfamiliar fields.',
    rsi:'The reference retains the research-automation panel and the '+outlookAnchors.mlPaper.q50+' research-paper survey anchor. It requires two successor cycles after research automation, or one after an independently verified first cycle. A supported 40-hour task date can delay the modeled start. The acceleration path uses the faster research panel and its original two half-year cycle assumptions.',
    asi:'The reference adds the surveyed post-AGI delay of about '+Math.round(asiLag.linear)+' years. In the acceleration path, independently reproducing the panel’s forecast of broad superiority to top experts could establish AGI and ASI together.',
    singularity:'The reference waits for a further successor cycle, the '+rapidYear+' widespread-progress forecast and the survey-implied '+Math.round(speedLag.linear)+' years after AGI. The acceleration path retains the worldwide constraint, models one subsequent lab-speed cycle, and uses log-time interpolation of the same survey responses (about '+Math.round(speedLag.log)+' years after AGI).',
  };
  const rows=baseOutlook.milestones.map(row=>{
    const reason=isScenario(row) ? notes[row.id] : row.basis;
    const next=scenarioRow(row,reference[row.id],acceleration[row.id],
      options.previous?.milestones?.find(p=>p.id===row.id),reason,horizon,asOf);
    if (isScenario(row)) {
      const inherited = anchors.get(row.id).assumptions.filter(s =>
        !s.startsWith('There are too few') && !s.includes('If that extrapolated waypoint falls later') &&
        !s.startsWith('Until a first successor improvement'));
      next.assumptions = [...inherited];
      if (row.id === 'agi' || row.id === 'rsi') {
        const hours = row.id === 'agi' ? 8 : 40;
        next.assumptions.push('The ' + hours + '-hour reference waypoint uses the 80%-success suite. An unverified crossing outside the tested forecast lead stays illustrative.');
      }
      if (row.id === 'singularity') next.assumptions.push(cycle.assumption);
      if (['agi','asi'].includes(row.id)) next.sourceIds=[...new Set([...next.sourceIds,'ai-futures-nov'])];
    }
    return next;
  });
  return {...baseOutlook,version:paceOutlookVersion,asOf,milestones:rows,
    method:'Five calendar-year scenarios retain the published survey anchors and add a sustained-acceleration path. A short-range task projection enters the reference only when it wins earlier model selection and two later prediction tests. Observations and strict criterion-based dates take precedence.',
    pace:{version:'1.0.0',series,waypoints,eventPace:options.eventPace??null,cycle,
      validation:'Within one published suite, keep the highest result in each measured release month at its actual release date. After four training months, select a trend using early consecutive one-step errors. Test it on the remaining months, both stepwise and from one fixed starting date. Errors measure absolute differences in expert hours. All comparisons use the publication vintage available in this edition.',
      limitation:'These are retrospective tests of benchmark measurements. A forecast about software tasks cannot establish when a general capability or a worldwide transition will arrive. Source intervals and the choice of tasks add uncertainty beyond the printed error.',
      referenceInputs:{agiFloor,agiYear,rsiFloor,rsiYear,asiLagYears:finite(asiLag.linear),speedupLagYears:finite(speedLag.linear),
        logSpeedupLagYears:finite(speedLag.log),rapidYear,referenceGates,accelerationGates,cycleMonths:cycle.months},
      milestones:rows.map(row=>({id:row.id,baselineYear:original.get(row.id).centralYear,referenceYear:row.centralYear,
        accelerationYear:acceleration[row.id],reason:isScenario(row)?notes[row.id]:row.basis}))}};
}
