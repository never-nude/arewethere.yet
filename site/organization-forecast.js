import { organizationSites } from './model-links.js';

const dayMs = 86_400_000;
const lookback = 365;
const latestLimit = 120;
const minimumMonths = 3;
const minimumSpan = 60;
const horizon = 180;
const bound = (value, min, max) => Math.min(max, Math.max(min, value));
const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const signed = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1, signDisplay: 'exceptZero' });
const dateFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const mounted = new WeakMap();

function dayTime(value) {
  if (typeof value !== 'string') return NaN;
  const day = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return NaN;
  const time = Date.parse(day);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === day ? time : NaN;
}

function medianPace(points) {
  const slopes = [];
  for (const [position, current] of points.entries()) {
    for (const later of points.slice(position + 1)) {
      slopes.push((later.value - current.value) / ((later.time - current.time) / dayMs));
    }
  }
  slopes.sort((a, b) => a - b);
  const middle = Math.floor(slopes.length / 2);
  return slopes.length % 2 ? slopes[middle] : (slopes[middle - 1] + slopes[middle]) / 2;
}

export function buildOrganizationForecast({ payload, index } = {}) {
  const indexTime = dayTime(index?.date);
  const asOf = Number.isFinite(indexTime) ? indexTime : dayTime(payload?.checkedAt);
  const observations = payload?.metrics?.find((metric) => metric.id === 'breadth')?.observations;
  const organizations = new Map();
  if (Number.isFinite(asOf) && Array.isArray(observations)) {
    for (const observation of observations) {
      const organization = typeof observation.organization === 'string' ? observation.organization.trim() : '';
      const time = dayTime(observation.date);
      if (!organization || !Number.isFinite(observation.value) || !Number.isFinite(time) ||
          time > asOf || time < asOf - lookback * dayMs) continue;
      const monthly = organizations.get(organization) ?? new Map();
      const month = observation.date.slice(0, 7);
      const existing = monthly.get(month);
      if (!existing || observation.value > existing.value || (observation.value === existing.value && time > existing.time)) {
        monthly.set(month, { time, value: observation.value, model: observation.label });
      }
      organizations.set(organization, monthly);
    }
  }

  const eligible = [];
  const unavailable = [];
  for (const [organization, monthly] of organizations) {
    const points = [...monthly.values()].sort((a, b) => a.time - b.time);
    const latest = points.at(-1);
    if (points.length < minimumMonths) {
      unavailable.push({ organization, reason: points.length + ' measured month' + (points.length === 1 ? '' : 's') });
    } else if (latest.time - points[0].time < minimumSpan * dayMs) {
      unavailable.push({ organization, reason: 'less than 60 days of history' });
    } else if (asOf - latest.time > latestLimit * dayMs) {
      unavailable.push({ organization, reason: 'latest reading older than 120 days' });
    } else {
      eligible.push({ organization, latest, pace: medianPace(points), months: points.length });
    }
  }
  unavailable.sort((a, b) => a.organization.localeCompare(b.organization));
  const endpoints = eligible.flatMap((lab) => [lab.latest.value, estimate(lab, asOf), estimate(lab, asOf + horizon * dayMs)]);
  const min = endpoints.length ? Math.floor(Math.min(...endpoints) / 10) * 10 : 0;
  const max = endpoints.length ? Math.max(min + 10, Math.ceil(Math.max(...endpoints) / 10) * 10) : 100;
  return { asOf, eligible, unavailable, min, max };
}

function estimate(lab, time) {
  return lab.latest.value + lab.pace * ((time - lab.latest.time) / dayMs);
}

export function forecastAt(model, days = 0) {
  const time = model.asOf + bound(Number.isFinite(days) ? Math.round(days) : 0, 0, horizon) * dayMs;
  const rows = model.eligible.map((lab) => ({ ...lab, score: estimate(lab, time) }))
    .sort((a, b) => b.score - a.score || a.organization.localeCompare(b.organization)).slice(0, 10);
  const lead = rows.length >= 2 ? rows[0].score - rows[1].score : null;
  return { time, rows, lead };
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function listItem(row, position, model) {
  const item = element('li', 'org-forecast__item');
  const rank = element('span', 'org-forecast__rank', String(position + 1));
  const identity = element('div', 'org-forecast__identity');
  const caption = [row.latest.model, 'released ' + dateFormat.format(row.latest.time), row.months + ' measured months'].filter(Boolean);
  const site = organizationSites(row.organization).find(({ url }) => url);
  const organization = element(site ? 'a' : 'strong', '', row.organization);
  if (site) {
    organization.href = site.url;
    organization.target = '_blank';
    organization.rel = 'noopener noreferrer';
  }
  identity.append(organization,
    element('span', '', 'Latest monthly high ' + number.format(row.latest.value) + ' ECI · ' + caption.join(' · ')));
  const reading = element('strong', 'org-forecast__estimated', number.format(row.score));
  reading.append(element('span', 'org-forecast__unit', ' ECI'));
  reading.title = 'Projected ECI under the selected scenario';
  const pace = element('span', 'org-forecast__pace', signed.format(row.pace * 30) + ' / 30d');
  pace.dataset.direction = row.pace === 0 ? 'flat' : row.pace < 0 ? 'down' : 'up';
  pace.title = 'Fitted ECI change per 30 days';
  const track = element('div', 'org-forecast__track');
  track.setAttribute('aria-hidden', 'true');
  const bar = element('span');
  const share = (value) => bound((value - model.min) / (model.max - model.min), 0, 1) * 100;
  bar.style.width = share(row.score) + '%';
  const measured = element('i');
  measured.style.left = share(row.latest.value) + '%';
  track.append(bar, measured);
  item.append(rank, identity, reading, pace, track);
  return item;
}

function update(state) {
  const { model, slider, selection, lead, table, scale } = state;
  if (!Number.isFinite(model.asOf)) {
    slider.disabled = true;
    selection.textContent = 'Waiting for benchmark data';
    lead.textContent = 'Organization-specific projections need a dated benchmark release.';
    table.replaceChildren();
    scale.hidden = true;
    return;
  }
  const days = Number(slider.value);
  slider.disabled = false;
  const selected = dateFormat.format(model.asOf + days * dayMs);
  slider.setAttribute('aria-valuetext', selected + ', ' + days + ' days after the snapshot');
  selection.textContent = selected + ' · +' + days + ' days';
  if (days > horizon) {
    lead.textContent = 'Organization estimates cover the first 180 days, through ' + dateFormat.format(model.asOf + horizon * dayMs) + '.';
    table.replaceChildren();
    scale.hidden = true;
  } else {
    const { rows, lead: margin } = forecastAt(model, days);
    const marginLabel = margin === null ? '' : margin < .05
      ? 'Projected margin below 0.1 ECI'
      : number.format(margin) + ' ECI projected lead over ' + rows[1].organization;
    lead.textContent = margin === 0 ? rows[0].organization + ' and ' + rows[1].organization + ' tie in this scenario.'
      : rows.length ? rows[0].organization + ' leads this scenario' + (marginLabel ? ' · ' + marginLabel : '')
        : 'No organization has enough recent data to project a pace.';
    table.replaceChildren(...rows.map((row, position) => listItem(row, position, model)));
    scale.hidden = !rows.length;
    scale.textContent = 'The end of each colored bar marks the projected ECI score. The scale starts at ' + number.format(model.min)
      + ' and ends at ' + number.format(model.max) + '. A white tick marks that developer’s latest measured monthly high.';
  }
  state.onDateChange?.(days);
}

function configureSlider(state, projection, previousDate) {
  const { slider, model, end } = state;
  const future = dayTime(projection?.date);
  const crossing = projection?.status === 'conditional' && future > model.asOf ? future : null;
  const maximum = crossing ? Math.round((crossing - model.asOf) / dayMs) : horizon;
  slider.max = String(maximum);
  const offset = Number.isFinite(previousDate) ? Math.round((previousDate - model.asOf) / dayMs) : 90;
  slider.value = String(bound(offset, 0, maximum));
  if (!Number.isFinite(model.asOf)) {
    end.textContent = 'Waiting for scenario dates.';
    return;
  }
  const last = dateFormat.format(model.asOf + maximum * dayMs);
  const start = dateFormat.format(model.asOf);
  end.textContent = crossing ? 'Horizon ends ' + last + ' at the scenario’s 75-point watch line.'
    : 'Horizon covers 180 days through ' + last + '.';
  state.ticks.replaceChildren(element('span', '', start), element('span', '', '+' + Math.floor(maximum / 2) + ' days'), element('span', '', last));
}

function mount(container) {
  container.classList.add('org-forecast');
  container.innerHTML = `
    <div class="org-forecast__header">
      <div><h3>Future ECI scenario</h3><p>Slide forward to compare organizations if their measured pace holds.</p></div>
      <output class="org-forecast__date" for="org-forecast-days"></output>
    </div>
    <div class="org-forecast__control">
      <label for="org-forecast-days">Choose a date to project</label>
      <input type="range" id="org-forecast-days" min="0" max="${horizon}" step="1" value="90">
      <div class="org-forecast__ticks" aria-hidden="true"></div>
      <p class="org-forecast__end"></p>
    </div>
    <p class="org-forecast__lead"></p>
    <p class="org-forecast__scale"></p>
    <ol class="org-forecast__table" aria-label="Organizations ranked by projected ECI"></ol>
    <details class="org-forecast__method">
      <summary>Projection method and data gaps</summary>
      <p>For each organization, the scenario takes monthly high scores from the last 365 days. It uses the median daily change across pairs of months and extends that pace from the last measured high. A slope requires three measured months spanning at least 60 days and a latest score within 120 days of the snapshot. The date slider extends observed Epoch benchmark performance under a constant pace assumption.</p>
      <p class="org-forecast__unavailable"></p>
      <ul></ul>
    </details>
    <nav class="org-forecast__links" aria-label="Related scenarios">
      <a href="#agi">AGI benchmark trajectory ↗</a>
      <a href="#scenario">Evidence index scenario ↗</a>
    </nav>`;
  const state = {
    slider: container.querySelector('input'),
    selection: container.querySelector('output'),
    lead: container.querySelector('.org-forecast__lead'),
    table: container.querySelector('ol'),
    scale: container.querySelector('.org-forecast__scale'),
    end: container.querySelector('.org-forecast__end'),
    ticks: container.querySelector('.org-forecast__ticks'),
    unavailable: container.querySelector('.org-forecast__unavailable'),
    gaps: container.querySelector('ul'),
  };
  state.slider.addEventListener('input', () => update(state));
  mounted.set(container, state);
  return state;
}

export function renderOrganizationForecast(container, { payload, index, projection, onDateChange } = {}) {
  const state = mounted.get(container) ?? mount(container);
  const handlerChanged = state.onDateChange !== onDateChange;
  state.onDateChange = onDateChange;
  const modelChanged = !state.model || state.payload !== payload || state.date !== index?.date;
  const scenarioKey = [projection?.status, projection?.date, projection?.monthlyPoints].join('|');
  if (!modelChanged && state.scenarioKey === scenarioKey) {
    if (handlerChanged && Number.isFinite(state.model.asOf)) onDateChange?.(Number(state.slider.value));
    return;
  }
  const previousDate = state.model?.asOf + Number(state.slider.value) * dayMs;
  if (modelChanged) {
    state.payload = payload;
    state.date = index?.date;
    state.model = buildOrganizationForecast({ payload, index });
  }
  state.scenarioKey = scenarioKey;
  const { unavailable, asOf } = state.model;
  state.unavailable.textContent = !Number.isFinite(asOf) ? 'Waiting for benchmark data.' : unavailable.length
    ? 'Unprojectable organizations with observations in the last year'
    : 'All organizations with a reading in the last year meet the minimum data requirements.';
  if (!state.model.eligible.length && Number.isFinite(asOf) && !unavailable.length) {
    state.unavailable.textContent = 'There are no organization observations in the last year.';
  }
  state.gaps.replaceChildren(...unavailable.map(({ organization, reason }) =>
    element('li', '', organization + ' · ' + reason)));
  configureSlider(state, projection, previousDate);
  update(state);
}
