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
