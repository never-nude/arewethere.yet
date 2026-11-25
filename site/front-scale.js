import { buildIndex, factorDefinitions, observationDay } from './index-model.js';

const dayMs = 86_400_000;
const dateFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const dateLabel = date => dateFormat.format(Date.parse(date));

function firstArchiveDay(payload, index) {
  const dates = [index.date, payload.releaseStart];
  const ids = new Set(factorDefinitions.map(factor => factor.id));
  for (const metric of payload.metrics ?? []) {
    if (!ids.has(metric?.id)) continue;
    dates.push(metric.asOf);
    for (const series of [metric.history, metric.observations]) {
      if (!Array.isArray(series)) continue;
      for (const point of series) {
        if (Number.isFinite(point?.value)) dates.push(observationDay(point.publishedAt) ?? point.date);
      }
    }
  }
  for (const event of payload.releaseEvents ?? payload.events ?? []) dates.push(event?.date);
  for (const factor of index.factors) dates.push(factor.publishedAt ?? factor.date);
  return dates.map(observationDay).filter(date => date && date <= index.date).sort()[0];
}

function reading(frame) {
  if (!Number.isFinite(frame?.score)) return null;
  return { date: frame.date, score: frame.score, coverage: frame.coverage };
}

function releaseChange(before, after) {
  if (!before || !after) return null;
  const changed = after.factors.filter((factor, i) => factor.score !== before.factors[i].score);
  if (changed.length !== 1 || changed[0].id !== 'releases') return null;
  const prior = before.factors.find(factor => factor.id === 'releases');
  if (!Number.isInteger(prior.value)) return null;
  return { from: prior.value, to: changed[0].value, points: Math.round((after.score - before.score) * 100) / 100 };
}

export function summarizeScaleHistory(payload, index) {
  const firstDay = firstArchiveDay(payload, index);
  const end = Date.parse(index.date);
  let first, atTwenty, previous, beforeTwenty;
  let exactTwentyDate = null, zeroDate = null, fullCoverage = null;
  // Walk the full dated archive in years. buildIndex limits a single call to 1,100 days.
  for (let start = Date.parse(firstDay); start <= end; start += 365 * dayMs) {
    const days = Math.min(365, Math.round((end - start) / dayMs) + 1);
    const checkedAt = new Date(start + (days - 1) * dayMs).toISOString();
    const { history } = buildIndex({ ...payload, checkedAt }, { days });
    for (const frame of history) {
      if (Number.isFinite(frame.score)) {
        first ??= frame;
        if (frame.score === 0) zeroDate ??= frame.date;
        if (frame.score === 20) exactTwentyDate ??= frame.date;
        if (frame.coverage === 100) fullCoverage ??= frame;
        if (frame.score >= 20 && !atTwenty) {
          atTwenty = frame;
          beforeTwenty = previous;
        }
      }
      previous = frame;
    }
  }
  return {
    checkedAt: payload.checkedAt, first: reading(first),
    firstInputs: first?.factors.filter(factor => Number.isFinite(factor.score)).map(factor => factor.id) ?? [],
    atTwenty: reading(atTwenty), beforeTwenty: reading(beforeTwenty), exactTwentyDate, zeroDate,
    releaseChangeAtTwenty: releaseChange(beforeTwenty, atTwenty),
    fullCoverageDate: fullCoverage?.date ?? null, fullCoverageScore: fullCoverage?.score ?? null,
  };
}

export function renderScaleHistory(payload, index) {
  const record = document.getElementById('front-scale-record');
  const detail = document.getElementById('front-scale-detail');
  const history = payload.scaleHistory && payload.scaleHistory.checkedAt === payload.checkedAt
    ? payload.scaleHistory : summarizeScaleHistory(payload, index);
  const { first, firstInputs, atTwenty, beforeTwenty, exactTwentyDate, zeroDate, fullCoverageDate, fullCoverageScore } = history;
  if (!first) {
    record.textContent = 'There are no dated readings to reconstruct the score yet.';
    detail.textContent = '';
    return;
  }

  const onlyCompute = firstInputs.length === 1 && firstInputs[0] === 'compute';
  const coverage = onlyCompute
    ? 'Only computing power used in training was on record, leaving ' + (100 - first.coverage) + ' points unmeasured.'
    : 'Available measurements covered ' + first.coverage + ' of 100 possible points.';
  record.textContent = 'The earliest reconstructed score was ' + number.format(first.score) + ' on ' +
    dateLabel(first.date) + '. ' + coverage;

  const crossing = [];
  if (atTwenty) {
    const change = beforeTwenty ? ', up from ' + number.format(beforeTwenty.score) + ' the day before' : '';
    crossing.push('The first reading at or above 20 was ' + number.format(atTwenty.score) + ' on ' +
      dateLabel(atTwenty.date) + change + '.');
    const release = history.releaseChangeAtTwenty;
    if (release) {
      const gain = release.points === 0.5 ? 'half a point' : release.points === 1 ? 'one point' : number.format(release.points) + ' points';
      crossing.push('The 45-day count of model launches rose from ' + release.from + ' to ' + release.to + ', adding ' + gain + '.');
    }
    crossing.push('Measurements then covered ' + atTwenty.coverage + ' possible points.');
    if (!exactTwentyDate) crossing.push('No reconstructed day scored exactly 20.');
    else if (atTwenty.date !== exactTwentyDate) crossing.push('The first reading of exactly 20 came on ' + dateLabel(exactTwentyDate) + '.');
  } else crossing.push('The reconstructed score has yet to reach 20.');

  const method = [];
  if (zeroDate && zeroDate !== first.date) method.push('The first zero came on ' + dateLabel(zeroDate) + '.');
  else if (!zeroDate) method.push('No reconstructed day scored zero.');
  if (fullCoverageDate) {
    const score = Number.isFinite(fullCoverageScore) ? ', when the score was ' + number.format(fullCoverageScore) : '';
    method.push('All eight indicators first had readings on ' + dateLabel(fullCoverageDate) + score + '.');
  }
  method.push('We apply today’s rules to model release dates and published research. Missing inputs leave their points unfilled. Revised sources can change earlier totals.');

  const interpretation = 'Twenty is a point of comparison. At 100, every indicator would earn its full weight. There is no validated way to convert points into years or a probability. The Watch evaluates a singularity using three separate tests.';
  const paragraphs = [crossing.join(' '), method.join(' '), interpretation];
  detail.replaceChildren(...paragraphs.map(text => {
    const paragraph = document.createElement('p');
    paragraph.textContent = text;
    return paragraph;
  }));
}
