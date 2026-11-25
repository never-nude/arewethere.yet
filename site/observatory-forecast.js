import { dated, safeLink } from './observatory-criteria.js';

export const modelVersion = '1.0.0';
const dayMs = 86400000;
const families = ['Persistence', 'Linear trend', 'Log-linear trend'];
const mean = (values) => values.reduce((sum, v) => sum + v, 0) / values.length;
function quantile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const n = p * (sorted.length - 1),
    i = Math.floor(n);
  return sorted[i] + (sorted[Math.min(i + 1, sorted.length - 1)] - sorted[i]) * (n - i);
}
const rounded = (v) => (Number.isFinite(v) ? Number(v.toPrecision(3)) : null);

// Refit at each origin. The final chronological block never participates in
// model-family selection. All families face identical targets and timestamps.
function fit(points, family) {
  if (!points.length || (family === 'Log-linear trend' && points.some((p) => p.value <= 0))) return null;
  const at = points.at(-1).time;
  if (family === 'Persistence') return { level: points.at(-1).value, slope: 0, at, family };
  const x = points.map((p) => (p.time - at) / dayMs),
    y = points.map((p) => (family === 'Log-linear trend' ? Math.log(p.value) : p.value));
  const xbar = mean(x),
    ybar = mean(y);
  const denom = x.reduce((s, v) => s + (v - xbar) ** 2, 0);
  if (!denom) return null;
  const slope = x.reduce((s, v, i) => s + (v - xbar) * (y[i] - ybar), 0) / denom;
  return { at, level: ybar - slope * xbar, slope, family };
}
function project(model, time) {
  const v = model.level + model.slope * ((time - model.at) / dayMs);
  return model.family === 'Log-linear trend' ? Math.exp(v) : v;
}

function evaluateSeries(points) {
  const count = points.length - 4;
  if (count < 4)
    return { models: [], selected: null, holdoutCount: 0, originCount: Math.max(0, count), eligible: false };
  const split = Math.max(2, Math.floor(count * 0.6));
  const holdoutCount = count - split;
  const models = families
    .map((name) => {
      const errors = [];
      for (let i = 4; i < points.length; i++) {
        const model = fit(points.slice(0, i), name);
        if (!model) return null;
        const pred = project(model, points[i].time);
        if (!Number.isFinite(pred)) return null;
        errors.push(Math.abs(pred - points[i].value));
      }
      return {
        name,
        selectionMAE: mean(errors.slice(0, split)),
        holdoutMAE: mean(errors.slice(split)),
        holdoutErrors: errors.slice(split),
      };
    })
    .filter(Boolean);
  const selected = [...models].sort((a, b) => a.selectionMAE - b.selectionMAE)[0];
  const baseline = models.find((m) => m.name === 'Persistence');
  return {
    models,
    selected: selected?.name ?? null,
    holdoutCount,
    originCount: count,
    eligible: Boolean(selected && selected.name !== 'Persistence' && selected.holdoutMAE < baseline.holdoutMAE),
  };
}

function chronological(readings) {
  // Each release date provides one frontier estimate; simultaneous releases
  // must never appear on opposite sides of a holdout boundary.
  const perDay = new Map();
  for (const row of readings) {
    if (!Number.isFinite(row.value) || !dated(row.date)) continue;
    const date = dated(row.date);
    if (!perDay.has(date) || row.value > perDay.get(date)) perDay.set(date, row.value);
  }
  return [...perDay]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ time: Date.parse(date), value, date }));
}

export function validateIndicators(observations) {
  const topics = ['breadth', 'horizon', 'reliability', 'research-autonomy', 'research-acceleration', 'compute'];
  return topics.map((topic) => {
    const records = observations.filter((o) => o.topic === topic && Number.isFinite(o.value));
    const points = chronological(records.map((o) => ({ date: o.referenceOn, value: o.value })));
    const observationsByMonth = new Map();
    for (const p of points) {
      const key = p.date.slice(0, 7),
        existing = observationsByMonth.get(key);
      // Monthly peak across observed systems, so weaker releases and downward
      // revisions can appear in a later month. Months without data stay empty.
      observationsByMonth.set(key, {
        date: p.date,
        time: p.time,
        value: Math.max(existing?.value ?? -Infinity, p.value),
      });
    }
    const monthly = [...observationsByMonth.values()];
    const result = evaluateSeries(monthly);
    return {
      topic,
      label: records[0]?.label ?? topic,
      unit: records[0]?.unit ?? null,
      observations: points.length,
      months: monthly.length,
      originCount: result.originCount,
      holdoutCount: result.holdoutCount,
      selected: result.selected,
      beatsPersistence: result.eligible,
      models: result.models.map((m) => ({
        name: m.name,
        selectionMAE: rounded(m.selectionMAE),
        holdoutMAE: rounded(m.holdoutMAE),
      })),
      status: result.models.length ? 'Evaluated on later observations' : 'Insufficient comparable history',
      limitations:
        'Monthly peaks in months with observations. Fit on earlier months and test on the next observed month. The final block is reserved for evaluating the selected family. Historical source revisions and model release dates make this a retrospective proxy test. MAE is mean absolute prediction error in the original unit.',
    };
  });
}

const monthlyTargets = [
  ...['Open', 'Closed'].map((access) => ({
    id: 'breadth-' + access.toLowerCase(),
    topic: 'breadth',
    label: access + '-weight models on broad tests',
    access: access + ' weights',
    source: 'Epoch AI',
    sourceUrl: 'https://epoch.ai/eci',
    dataset: 'https://epoch.ai/data/eci_scores.csv',
    nativeUnit: 'ECI',
    unit: 'ECI points',
    classification: 'Independent evaluation',
    definition: 'The highest combined test score Epoch AI records for a' + (access === 'Open' ? 'n open' : ' closed') +
      '-weight model released in the target month. A higher score means stronger performance across Epoch’s tests.',
  })),
  {
    id: 'task-horizon', topic: 'horizon', label: 'Length of tasks AI can finish',
    source: 'METR', sourceUrl: 'https://metr.org/time-horizons/', nativeUnit: 'h', unit: 'hours',
    classification: 'Independent evaluation',
    definition: 'The longest task duration at which a model released in the target month succeeds about half the time on METR’s comparable TH1.1/TH2 tests. Duration is measured in human expert working hours.',
  },
  {
    id: 'training-compute', topic: 'compute', label: 'Computation used to train a model',
    source: 'Epoch AI', sourceUrl: 'https://epoch.ai/data/ai-models',
    dataset: 'https://epoch.ai/data/frontier_ai_models.csv', nativeUnit: 'FLOP', unit: 'FLOP',
    classification: 'Independent estimate',
    definition: 'The largest estimated number of mathematical operations used to train a model with a publication date in the target month in Epoch AI’s frontier model dataset.',
  },
];

const monthIndex = (date) => Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1;
const monthDay = (index, day) => new Date(Date.UTC(Math.floor(index / 12), index % 12, day)).toISOString().slice(0, 10);

export function indicatorObservations(observations, id) {
  const target = monthlyTargets.find((series) => series.id === id);
  if (!target) return [];
  return observations.filter((o) =>
    o.topic === target.topic && o.source === target.source && o.classification === target.classification &&
    o.unit === target.nativeUnit && o.system && Number.isFinite(o.value) && dated(o.referenceOn) &&
    (!target.access || o.weightAccess === target.access) && (!target.dataset || o.datasetUrl === target.dataset) &&
    o.referenceDateBasis === (target.topic === 'compute' ? 'Model publication date' : 'Model release date'));
}

function monthlyPeaks(records, asOf) {
  const months = new Map();
  for (const row of records) {
    if (row.referenceOn > asOf || (row.publishedOn && row.publishedOn > asOf)) continue;
    const month = monthIndex(row.referenceOn);
    const prior = months.get(month);
    if (!prior || prior.value < row.value || (prior.value === row.value && row.referenceOn < prior.date))
      months.set(month, { month, time: month * dayMs, date: row.referenceOn, value: row.value });
  }
  return [...months.values()].sort((a, b) => a.month - b.month);
}

function estimateMonth(training, family, targetMonth, target) {
  const model = fit(training, family);
  if (!model) return null;
  const value = project(model, targetMonth * dayMs);
  if (!Number.isFinite(value)) return null;
  return target.nativeUnit === 'ECI' ? value : Math.max(0, value);
}

function matchedTrials(records, peaks, cutoff, targetMonth) {
  if (!peaks.length) return [];
  const trainingLead = targetMonth - peaks.at(-1).month;
  const originLead = targetMonth - monthIndex(cutoff);
  const day = Number(cutoff.slice(8, 10));
  const trials = [];
  for (const month of peaks) {
    // The issue month's peak is still partial; it cannot serve as a historical outcome.
    if (month.month >= monthIndex(cutoff)) continue;
    const verificationStart = monthDay(month.month + 2, 1);
    // Live archives will give an exact verification vintage. In retrospective
    // tests use observations available by the start of verification, and exclude
    // targets whose reporting window has not opened as of this edition.
    if (verificationStart > cutoff) continue;
    const outcome = monthlyPeaks(records.filter((r) => monthIndex(r.referenceOn) === month.month), verificationStart)[0];
    if (!outcome) continue;
    const origin = outcome.month - originLead;
    const originDate = monthDay(origin, Math.min(day, Number(monthDay(origin + 1, 0).slice(8))));
    const training = monthlyPeaks(records, originDate);
    if (training.length < 4 || outcome.month - training.at(-1).month !== trainingLead) continue;
    trials.push({ training, outcome, originDate, verificationStart });
  }
  return trials;
}

function methodErrors(trials, name, target) {
  const errors = trials.map(({ training, outcome }) => {
    const value = estimateMonth(training, name, outcome.month, target);
    return value === null ? null : Math.abs(value - outcome.value);
  });
  return errors.every(Number.isFinite) ? errors : null;
}

function publishedValue(value, target) {
  return target.nativeUnit === 'ECI' ? Math.round(value * 10) / 10 : rounded(value);
}

function issueIndicator(target, records, previous, issuedAt, evidenceCutoff) {
  const cutoff = dated(evidenceCutoff);
  const issueMonth = monthIndex(issuedAt);
  const targetMonth = issueMonth + 1;
  const targetStart = monthDay(targetMonth, 1);
  const prior = previous?.indicatorForecasts?.find((f) => f.id === target.id);
  // Later checks may repair a missing source. Once actually issued, the public
  // forecast and its data cutoff stay fixed, including after source revisions.
  if (prior?.status === 'Issued' && prior.targetStart === targetStart) return prior;
  const lastIssued = prior?.status === 'Issued' ? prior :
    previous?.indicatorOutcomes?.find((outcome) => outcome.id === target.id);
  const peaks = monthlyPeaks(records, cutoff);
  const latest = peaks.at(-1);
  const trials = matchedTrials(records, peaks, cutoff, targetMonth);
  const split = Math.floor(trials.length * 0.6);
  const evaluation = trials.slice(split);
  const firstHoldoutOrigin = evaluation[0]?.originDate ?? null;
  // A tuning target can be in an earlier release month yet still await verification
  // when the first held-out prediction would have been made.
  const tuning = trials.slice(0, split).filter((trial) => trial.verificationStart <= firstHoldoutOrigin);
  const base = {
    id: target.id, label: target.label, status: 'Insufficient evidence', issuedAt: null, evidenceCutoff,
    targetStart, targetEnd: monthDay(targetMonth + 1, 0), verifyOn: monthDay(targetMonth + 2, 1),
    verifyThrough: monthDay(targetMonth + 2, 7), centralValue: null, unit: target.unit, range: null,
    rangeNote: 'The band adds and subtracts the 90th percentile of absolute errors on later historical months. Its coverage on future releases is unknown.',
    limitations: 'Historical tests reconstruct past release months from this source edition. Known publication dates restrict what each test can use. Unrecorded publication delays and later source revisions can change the result. Months without eligible models cannot be scored.',
    model: null, definition: target.definition, source: target.source, sourceUrl: records[0]?.sourceUrl ?? target.sourceUrl,
    reason: '', change: 'No monthly prediction issued.', previousValue: lastIssued?.centralValue ?? null,
    previousTargetStart: lastIssued?.targetStart ?? null,
    basis: { lastDate: latest?.date ?? null, lastValue: latest?.value ?? null, months: peaks.length,
      originCount: trials.length, selectionCount: tuning.length,
      lastSelectionVerifiedOn: tuning.at(-1)?.verificationStart ?? null, firstHoldoutOrigin,
      holdoutCount: evaluation.length, holdoutMAE: null, baselineMAE: null },
  };
  if (!records.some((o) => o.sourceStatus === 'live') || issueMonth !== monthIndex(cutoff)) {
    base.reason = 'A fresh source check in the issue month is required to issue a prediction.';
    return base;
  }
  if (tuning.length < 4 || evaluation.length < 4) {
    base.reason = 'Too few comparable past months to choose a method and test it on at least four later months at this forecast distance.';
    return base;
  }
  const choices = families.map((name) => {
    const errors = methodErrors(tuning, name, target);
    return errors && { name, error: mean(errors) };
  }).filter(Boolean).sort((a, b) => a.error - b.error);
  const model = choices[0]?.name;
  const holdout = model ? methodErrors(evaluation, model, target) : null;
  const baseline = methodErrors(evaluation, 'Persistence', target);
  const raw = model ? estimateMonth(peaks, model, targetMonth, target) : null;
  if (!holdout || !baseline || raw === null) {
    base.reason = 'The selected method could not produce finite estimates across the later test months and this issue.';
    return base;
  }
  const centralValue = publishedValue(raw, target);
  const spread = quantile(holdout, 0.9);
  const low = centralValue - spread;
  const holdoutMAE = rounded(mean(holdout)), baselineMAE = rounded(mean(baseline));
  const reason = model === 'Persistence'
    ? 'Carrying forward the latest observed monthly high had the smallest average error on the earlier comparison months.'
    : 'This trend had the smallest average error on the earlier comparison months. ' +
      (mean(holdout) < mean(baseline) ? 'It also improved on carrying the last value forward in the later tests.'
        : 'Carrying the last value forward was at least as accurate in the later tests.');
  return { ...base, status: 'Issued', issuedAt, centralValue, model, reason,
    range: { low: publishedValue(target.nativeUnit === 'ECI' ? low : Math.max(0, low), target),
      high: publishedValue(centralValue + spread, target) },
    change: !lastIssued ? 'First prediction for this series.'
      : 'New target month. The estimate uses the latest available source measurements.',
    basis: { ...base.basis, holdoutMAE, baselineMAE } };
}

function pendingOutcome(forecast) {
  const { id, label, issuedAt, targetStart, targetEnd, verifyOn, verifyThrough, centralValue, unit, range } = forecast;
  return { id, label, issuedAt, targetStart, targetEnd, verifyOn, verifyThrough, centralValue, unit, range,
    status: 'Pending', observedValue: null, absoluteError: null, resolvedAt: null, observationCount: 0,
    reason: 'Awaiting the verification window.' };
}

function resolveOutcome(outcome, records, validatedAt, cutoff) {
  if (outcome.status !== 'Pending' || validatedAt.slice(0, 10) < outcome.verifyOn) return outcome;
  const day = validatedAt.slice(0, 10);
  if (day > outcome.verifyThrough)
    return { ...outcome, status: 'Unscored', resolvedAt: validatedAt,
      reason: 'No qualifying live source check was archived during the verification window.' };
  if (cutoff < outcome.verifyOn || !records.some((r) => r.sourceStatus === 'live')) return outcome;
  const eligible = records.filter((r) => r.sourceStatus === 'live' && r.referenceOn >= outcome.targetStart &&
    r.referenceOn <= outcome.targetEnd && (!r.publishedOn || r.publishedOn <= cutoff));
  if (!eligible.length)
    return { ...outcome, status: 'Unscored', resolvedAt: validatedAt,
      reason: 'The live source contained no qualifying model for the target month at verification.' };
  const best = eligible.reduce((winner, row) => row.value > winner.value ? row : winner);
  return { ...outcome, status: 'Scored', observedValue: best.value,
    absoluteError: rounded(Math.abs(best.value - outcome.centralValue)), observationCount: eligible.length,
    observationId: best.id, sourceUrl: best.sourceUrl, resolvedAt: validatedAt,
    reason: 'Highest eligible value in the first live source check during the verification window.' };
}

export function forecastIndicators(observations, previous, validatedAt, evidenceCutoff) {
  const cutoff = dated(evidenceCutoff);
  const records = new Map(monthlyTargets.map((t) => [t.id, indicatorObservations(observations, t.id)]));
  const indicatorForecasts = monthlyTargets.map((t) => issueIndicator(t, records.get(t.id), previous, validatedAt, evidenceCutoff));
  const previousIssues = (previous?.indicatorForecasts ?? []).filter((f) =>
    f.status === 'Issued' && f.targetStart < indicatorForecasts[0].targetStart);
  const history = new Map();
  for (const row of [...previousIssues.map(pendingOutcome), ...(previous?.indicatorOutcomes ?? [])])
    history.set(row.targetStart + '/' + row.id, row);
  const indicatorOutcomes = [...history.values()].map((o) => resolveOutcome(o, records.get(o.id) ?? [], validatedAt, cutoff))
    .sort((a, b) => b.targetStart.localeCompare(a.targetStart) || a.id.localeCompare(b.id));
  return { indicatorForecastVersion: '1.0.0', indicatorForecasts, indicatorOutcomes };
}

// A trajectory is an editorial, independently sourced calibration from one
// repeatable measurement to a particular criterion's acceptance rule. Ordinary
// benchmarks lack that link. Gate all evidence on publication availability.
function trajectoryData(series, criterion, system, snapshot, cutoff) {
  if (
    series.criterion !== criterion ||
    series.system !== system ||
    !series.calibration ||
    !dated(series.registeredOn) ||
    !safeLink(series.protocolUrl) ||
    !series.reviewer ||
    !dated(series.reviewedAt) ||
    Date.parse(series.reviewedAt) > Date.parse(cutoff) ||
    !Number.isFinite(series.target) ||
    !series.observationIds?.length ||
    !['above', 'below'].includes(series.direction)
  )
    return null;
  const records = series.observationIds.map((id) => snapshot.get(id));
  if (
    records.some(
      (o) =>
        !o ||
        o.system !== system ||
        o.classification !== 'Independent evaluation' ||
        o.protocolUrl !== series.protocolUrl ||
        !dated(o.measuredOn) ||
        !dated(o.publishedOn) ||
        !Number.isFinite(o.value) ||
        o.measuredOn > o.publishedOn ||
        o.publishedOn > cutoff.slice(0, 10),
    )
  )
    return null;
  if (new Set(records.map((r) => r.unit)).size !== 1 || new Set(records.map((r) => r.topic)).size !== 1)
    return null;
  const ordered = [...records].sort((a, b) => a.measuredOn.localeCompare(b.measuredOn));
  const firstHoldout = 4 + Math.max(2, Math.floor((ordered.length - 4) * 0.6));
  if (
    !ordered[firstHoldout] ||
    dated(series.registeredOn) >= ordered[firstHoldout].measuredOn ||
    dated(series.registeredOn) > dated(series.reviewedAt)
  )
    return null;
  // Exclude retrospective series whose publication makes earlier origins
  // unavailable, duplicate occasions and out-of-order measurement vintages.
  if (ordered.some((r, i) => i && ordered[i - 1].publishedOn >= r.measuredOn)) return null;
  return ordered.map((r) => ({ time: Date.parse(r.measuredOn), value: r.value }));
}

function crossing(model, target, direction, horizon) {
  const sign = direction === 'above' ? 1 : -1;
  if (sign * model.slope <= 0 || (model.family === 'Log-linear trend' && target <= 0)) return null;
  const level = model.family === 'Log-linear trend' ? Math.log(target) : target;
  const time = model.at + (dayMs * (level - model.level)) / model.slope;
  return Number.isFinite(time) && time >= model.at && time <= horizon ? time : null;
}

function criterionProjection(series, criterion, system, snapshot, cutoff, horizon) {
  const points = trajectoryData(series, criterion, system, snapshot, cutoff);
  if (!points || points.length < 12) return null;
  const evaluation = evaluateSeries(points);
  if (!evaluation.eligible) return null;
  const residuals = evaluation.models.find((m) => m.name === evaluation.selected).holdoutErrors;
  const training = points.slice(0, -evaluation.holdoutCount);
  const tail = points.slice(-evaluation.holdoutCount);
  const frozenFit = fit(training, evaluation.selected);
  const finalTraining = training.at(-1);
  const longErrors = tail.map((p) => Math.abs(project(frozenFit, p.time) - p.value));
  const baselineErrors = tail.map((p) => Math.abs(finalTraining.value - p.value));
  if (mean(longErrors) >= mean(baselineErrors)) return null;
  const testedLead = tail.at(-1).time - finalTraining.time;
  const uncertainty = Math.max(quantile(residuals, 0.9), quantile(longErrors, 0.9));
  const fitted = fit(points, evaluation.selected);
  const center = crossing(fitted, series.target, series.direction, horizon);
  if (center == null || center < Date.parse(cutoff) || center - points.at(-1).time > testedLead) return null;
  const sign = series.direction === 'above' ? 1 : -1;
  const early = crossing(fitted, series.target - sign * uncertainty, series.direction, horizon);
  const late = crossing(fitted, series.target + sign * uncertainty, series.direction, horizon);
  // Include model-form sensitivity, recent-window fitting, and a no-growth
  // alternative with no assigned probability. A failed crossing is censored.
  const alternatives = [early, late, center];
  for (const f of ['Linear trend', 'Log-linear trend']) {
    for (const subset of [points, points.slice(Math.floor(points.length / 3))]) {
      const m = fit(subset, f);
      alternatives.push(m ? crossing(m, series.target, series.direction, horizon) : null);
    }
  }
  return {
    criterion,
    center,
    lastMeasurementAt: points.at(-1).time,
    testedLeadDays: testedLead / dayMs,
    directHoldoutMAE: rounded(mean(longErrors)),
    early: Math.max(Date.parse(cutoff), Math.min(...alternatives.filter((t) => t !== null))),
    late: alternatives.some((t) => t === null) ? null : Math.max(...alternatives),
    family: evaluation.selected,
    holdoutCount: evaluation.holdoutCount,
    calibration: series.calibration,
    protocolUrl: series.protocolUrl,
  };
}

// A calendar month is the finest published resolution. The clock uses the
// month's final day so an estimate later this month never becomes yesterday.
function monthDate(t) {
  const d = new Date(t);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
}

function criticalPathAdjustment(projection, system, events, snapshot) {
  const dates = [];
  for (const event of events) {
    for (const effect of event.effects ?? []) {
      for (const id of effect.evidenceIds ?? []) {
        const row = snapshot.get(id);
        if (
          row?.topic !== 'research-schedule' ||
          row.eventId !== event.id ||
          row.system !== system ||
          row.criterion !== projection.criterion ||
          row.unit !== 'days' ||
          !Number.isFinite(row.value) ||
          !row.measuredOn ||
          Date.parse(row.measuredOn) <= projection.lastMeasurementAt ||
          !['Independent evaluation', 'Official statistics'].includes(row.classification) ||
          row.basis !== 'Net critical-path shift'
        )
          continue;
        dates.push(row);
      }
    }
  }
  // A net schedule measurement supersedes earlier estimates for this same
  // critical path. Adding each reported outage would count overlapping work twice.
  const last = dates.sort((a, b) => b.measuredOn.localeCompare(a.measuredOn) || b.id.localeCompare(a.id))[0];
  return last ? { days: last.value, sourceId: last.id, eventId: last.eventId, label: last.label } : null;
}

export function forecastMilestones(
  milestones,
  observations,
  trajectories,
  previous,
  checkpointAt,
  cutoff,
  version,
  events = [],
) {
  const snapshot = new Map(observations.map((o) => [o.id, o]));
  const horizon = new Date(checkpointAt);
  horizon.setUTCFullYear(horizon.getUTCFullYear() + 5);
  const complete = Array.isArray(trajectories) ? trajectories : [];
  return milestones.map((m) => {
    const prior = previous?.forecasts?.find((f) => f.id === m.id);
    const base = {
      id: m.id,
      label: m.label,
      status: 'Not reliably estimable',
      centralDate: null,
      range: null,
      precision: 'month',
      horizonEnd: horizon.toISOString().slice(0, 10),
      previousDate: prior?.centralDate ?? null,
      previousStatus: prior?.status ?? null,
      rangeKind: 'Conditional sensitivity range; predictive coverage for an unprecedented event is unknown.',
      previousRange: prior?.range ?? null,
      drivers: [],
      assumptions: [
        'All required criteria must be satisfied within a coherent system or lineage.',
        'A flat trajectory, unresolved bottleneck or major disruption can put arrival beyond the five-year modeling horizon. Those scenarios have no assigned probability.',
      ],
      reason:
        'The available measurements do not calibrate every required criterion to a dated threshold. Faster benchmarks, training compute and research productivity alone cannot identify an arrival date.',
    };
    if (m.score === 100) {
      const firstConfirmed =
        prior?.status === 'Observed' && previous.methodologyVersion === version
          ? prior.centralDate
          : checkpointAt.slice(0, 10);
      Object.assign(base, {
        status: 'Observed',
        centralDate: firstConfirmed,
        precision: 'assessment day',
        reason: 'All required criteria were independently met. The date marks the first verified checkpoint.',
      });
    } else if (!m.criteria.some((c) => c.status === 'conflicting')) {
      const systems = m.system ? [m.system] : [...new Set(complete.filter((s) => s?.system).map((s) => s.system))];
      for (const system of systems) {
        const remaining = m.criteria.filter((c) => c.status !== 'met');
        const projections = remaining.map((c) => {
          const series = complete.find((s) => s.system === system && s.criterion === c.id);
          const p = series ? criterionProjection(series, c.id, system, snapshot, cutoff, horizon.getTime()) : null;
          if (!p) return null;
          const adjustment = criticalPathAdjustment(p, system, events, snapshot);
          if (!adjustment) return p;
          const offset = adjustment.days * dayMs;
          if (p.center + offset > horizon.getTime() || p.center + offset < Date.parse(cutoff)) return null;
          const late = p.late === null || p.late + offset > horizon.getTime() ? null : p.late + offset;
          return {
            ...p,
            center: p.center + offset,
            early: Math.max(Date.parse(cutoff), p.early + offset),
            late,
            adjustment,
          };
        });
        if (!projections.length || projections.some((p) => p === null)) continue;
        const center = monthDate(Math.max(...projections.map((p) => p.center)));
        if (!base.centralDate || center < base.centralDate)
          Object.assign(base, {
            status: 'Estimated',
            system,
            centralDate: center,
            range: {
              low: monthDate(Math.max(...projections.map((p) => p.early))),
              high: projections.some((p) => p.late === null)
                ? null
                : monthDate(Math.max(...projections.map((p) => p.late))),
            },
            drivers: projections,
            reason:
              'The last required criterion determines this conditional crossing period. The range covers trajectory and fit sensitivity. An unweighted stagnation scenario also extends beyond the horizon.',
          });
      }
    }
    if (base.status === 'Not reliably estimable') {
      const unresolved = m.criteria.filter((c) => c.status !== 'met');
      const missing = unresolved.filter(
        (c) => !complete.some((t) => t.criterion === c.id && (!m.system || t.system === m.system)),
      );
      if (m.criteria.some((c) => c.status === 'conflicting'))
        base.reason = 'Conflicting independent findings must first be reconciled for the same system.';
      else if (missing.length)
        base.reason =
          'No calibrated series for ' +
          missing.map((c) => c.label.toLowerCase()).join(', ') +
          '. Current measurements cannot date all required conditions for one system.';
      else
        base.reason =
          'The proposed series could not establish a coherent, independently validated crossing within the tested lead time and model horizon.';
    }
    const rangeChanged = prior && (prior.range?.low !== base.range?.low || prior.range?.high !== base.range?.high);
    base.change = !prior
      ? 'First assessment.'
      : previous.methodologyVersion !== version || previous.modelVersion !== modelVersion
        ? 'Method or model version changed.'
        : prior.centralDate === base.centralDate && prior.status === base.status
          ? rangeChanged
            ? 'The conditional range changed.'
            : 'Unchanged from the previous checkpoint.'
          : base.centralDate && prior.centralDate
            ? base.centralDate < prior.centralDate
              ? 'Moved earlier.'
              : 'Moved later.'
            : 'Forecast eligibility changed.';
    if (prior && base.status === 'Estimated' && base.change !== 'Unchanged from the previous checkpoint.') {
      const changed = base.drivers.filter((d) => {
        const old = prior.drivers?.find((p) => p.criterion === d.criterion);
        return (
          !old || old.family !== d.family || old.center !== d.center || old.early !== d.early || old.late !== d.late
        );
      });
      if (changed.length)
        base.reason +=
          ' Revised crossing estimates for ' +
          changed.map((d) => m.criteria.find((c) => c.id === d.criterion).label).join(', ') +
          '.';
      if (changed.some((d) => d.adjustment))
        base.reason += ' The source record includes a measured change to the research schedule.';
    }
    return base;
  });
}
