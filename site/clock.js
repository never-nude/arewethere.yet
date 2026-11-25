// The visual front page at /clock. It reads the same published feed as the rest
// of the site, redraws after each scheduled check and once an hour in between.
import {
  approxWhen, buildClock, dayMonthYear, dials, plainHours, rangeWhen, whatIfQuestions, whatIfStart, whatIfView, yearsAway,
} from './clock-model.js';
import {drawLadder, ladderRows} from './clock-charts.js';
import {dialIcon, drawGauge, drawSquares} from './clock-visuals.js';
import {checkTimeZone, checkpointWindow} from './checkpoint-schedule.js';

const feedUrl = './data/observatory.json';
const byId = id => document.getElementById(id);
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
};
const cells = row => {
  const line = el('tr');
  line.append(...row.map(value => el('td', '', value)));
  return line;
};

const editionTime = new Intl.DateTimeFormat('en-US', {
  timeZone: checkTimeZone, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
});
const checkTime = new Intl.DateTimeFormat('en-US', {timeZone: checkTimeZone, hour: 'numeric', minute: '2-digit', timeZoneName: 'short'});
const numberWords = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six'];

let view = null, chart = null, tip = null, current = null;
let firstDraw = true, drawnWidth = 0, loadedAt = 0, timer = 0;
let turned = whatIfStart(), asked = null, gauge = null;

function renderHero() {
  byId('reply').textContent = view.arrived ? 'We are.' : 'Not yet.';
  const lead = view.lead;
  if (!lead) return;
  byId('lead').textContent = (view.arrived ? 'The' : 'But the') + ' best AI can now pull off a job that takes a person ' + lead.now +
    ', about half the time.' + (lead.then ? ' ' + lead.when + ', its limit was ' + lead.then + '.' : '');
}

function describe(item) {
  if (item.kind === 'point') {
    const leading = item.point === view.ladder.record;
    return {head: plainHours(item.point.hours), lines: [item.point.system, dayMonthYear(item.point.time) + (leading ? ', the record so far' : '')]};
  }
  if (item.kind === 'today') return {head: 'About ' + plainHours(item.hours), lines: ['Where the pace points today', 'Not measured yet']};
  const stop = item.stop;
  if (stop.due || !stop.when) return {head: stop.name + ', ' + plainHours(stop.hours), lines: ['The pace says this is due', 'No measurement has reached it yet']};
  const lines = ['Around ' + approxWhen(stop.when, Date.now()) + ' if the pace holds'];
  if (stop.earliest && stop.latest) lines.push('Could be ' + rangeWhen(stop.earliest, stop.latest));
  lines.push(stop.tested ? 'Inside the tested range' : 'Beyond the tested range');
  return {head: stop.name + ', ' + plainHours(stop.hours), lines};
}

function showTip(item, announce = false) {
  if (!chart || !tip || !item) return;
  if (item === current && !announce) return;
  current = item;
  chart.mark(item);
  const {head, lines} = describe(item);
  tip.replaceChildren(el('b', '', head), ...lines.map(text => el('div', '', text)));
  tip.hidden = false;
  const host = byId('ladder-chart'), wide = tip.offsetWidth, tall = tip.offsetHeight;
  let left = item.x + 16;
  if (left + wide > host.clientWidth - 4) left = item.x - wide - 16;
  let top = item.y - tall - 14;
  if (top < 0) top = item.y + 18;
  tip.style.transform = 'translate(' + Math.round(Math.max(4, left)) + 'px,' + Math.round(top) + 'px)';
  if (announce) byId('ladder-live').textContent = head + '. ' + lines.join('. ') + '.';
}

function hideTip() {
  current = null;
  chart?.mark(null);
  if (tip) tip.hidden = true;
}

function renderLadder() {
  const figure = byId('ladder'), host = byId('ladder-chart');
  if (!view.ladder) { figure.hidden = true; return; }
  figure.hidden = false;
  const width = Math.round(host.clientWidth);
  if (!width) return;
  const now = Date.now();
  current = null;
  chart = drawLadder(host, view.ladder, {width, now, animate: firstDraw});
  firstDraw = false;
  drawnWidth = width;
  host.style.minHeight = chart.height + 'px';
  tip = el('div', 'tip');
  tip.hidden = true;
  host.append(tip);
  byId('ladder-rows').replaceChildren(...ladderRows(view.ladder, now).map(cells));
}

function wireLadder() {
  const host = byId('ladder-chart');
  const point = event => {
    if (chart) showTip(chart.nearest(event.clientX - host.getBoundingClientRect().left));
  };
  host.addEventListener('pointermove', point);
  host.addEventListener('pointerdown', point);
  host.addEventListener('pointerleave', event => { if (event.pointerType === 'mouse') hideTip(); });
  document.addEventListener('pointerdown', event => { if (!host.contains(event.target)) hideTip(); });
  host.addEventListener('blur', hideTip);
  host.addEventListener('keydown', event => {
    if (!chart?.items.length) return;
    const last = chart.items.length - 1;
    // The first key press lands on the record. After that the arrows walk the line.
    const start = Math.max(0, chart.items.findIndex(item => item.point === view.ladder.record));
    const here = current ? chart.items.indexOf(current) : null;
    const step = {
      ArrowRight: here === null ? start : Math.min(last, here + 1),
      ArrowLeft: here === null ? start : Math.max(0, here - 1),
      Home: 0, End: last,
    }[event.key];
    if (event.key === 'Escape') hideTip();
    if (step === undefined) return;
    event.preventDefault();
    showTip(chart.items[step], true);
  });
  new ResizeObserver(() => {
    const width = Math.round(host.clientWidth);
    if (!view?.ladder || !width || Math.abs(width - drawnWidth) < 4) return;
    hideTip();
    renderLadder();
  }).observe(host);
}

const wait = ms => {
  const minutes = Math.max(1, Math.round(ms / 60000)), hours = Math.floor(minutes / 60), rest = minutes % 60;
  return hours ? hours + ' hr' + (rest ? ' ' + rest + ' min' : '') : rest + ' min';
};

function renderStamp() {
  if (!view) return;
  const now = Date.now(), parts = [];
  if (view.edition) parts.push('Last checked ' + editionTime.format(new Date(view.edition)) + '.');
  try {
    const next = Date.parse(checkpointWindow(new Date(now)).next);
    if (Number.isFinite(next)) parts.push('Next check ' + checkTime.format(next) + ', in ' + wait(next - now) + '.');
  } catch { /* An unreadable schedule leaves the last check standing alone. */ }
  byId('stamp').textContent = parts.join(' ');
}

function renderArrival() {
  const box = byId('arrival'), stop = view.arrival;
  if (!stop || view.arrived || (stop.reference === null && stop.pace === null && stop.low === null)) { box.hidden = true; return; }
  const answers = [];
  if (stop.pace !== null) answers.push({kind: 'pace', year: stop.pace, text: String(stop.pace), how: 'if today’s speed-up lasts'});
  answers.push(stop.reference !== null
    ? {kind: 'experts', year: stop.reference, text: String(stop.reference), how: 'on experts’ survey answers'}
    : {kind: 'experts', year: Infinity, text: 'After ' + view.horizonYear, how: 'on experts’ survey answers'});
  byId('eta').replaceChildren(...answers.sort((a, b) => a.year - b.year).map(answer => {
    const line = el('li'), pin = el('span', 'key-pin is-' + answer.kind), how = el('span', 'how');
    line.dataset.stop = stop.id;
    pin.setAttribute('aria-hidden', 'true');
    // The countdown, in the only unit a forecast this loose can honestly carry.
    const away = yearsAway(answer.year, view.nowYear);
    if (away) how.append(el('span', 'away', away), ' ');
    how.append(answer.how);
    line.append(pin, el('b', '', answer.text), how);
    return line;
  }));
  box.hidden = false;
  renderStamp();
}

// The what-if panel. Its arithmetic lives in clock-model.js. This only moves
// the dials and reports what they add up to.
function wireWhatIf() {
  byId('asks').replaceChildren(...whatIfQuestions.map(question => {
    const button = el('button', 'ask', question.ask);
    button.type = 'button';
    button.dataset.ask = question.id;
    return button;
  }));
  byId('asks').addEventListener('click', event => {
    const question = whatIfQuestions.find(row => row.id === event.target.closest('[data-ask]')?.dataset.ask);
    if (!question) return;
    turned = {...whatIfStart(), ...question.set};
    asked = question.id;
    renderWhatIf();
  });
  byId('dials').replaceChildren(...dials.map(dial => {
    const row = el('div', 'dial'), name = el('label', 'dial-name'), value = el('output', 'dial-value');
    const input = el('input'), ticks = el('span', 'dial-ticks'), about = el('p', 'dial-about', dial.about);
    row.dataset.dial = dial.id;
    name.htmlFor = 'dial-' + dial.id;
    name.append(dialIcon(dial.id), el('span', '', dial.name));
    value.htmlFor = input.id = 'dial-' + dial.id;
    about.id = 'dial-' + dial.id + '-about';
    Object.assign(input, {type: 'range', min: 0, max: dial.stops.length - 1, step: 1, value: dial.start});
    input.setAttribute('aria-describedby', about.id);
    ticks.setAttribute('aria-hidden', 'true');
    ticks.append(...dial.stops.map((stop, index) => el('i', index === dial.start ? 'is-start' : '')));
    row.append(name, value, input, ticks, about);
    return row;
  }));
  byId('dials').addEventListener('input', event => {
    const id = event.target.closest('.dial')?.dataset.dial;
    if (!id) return;
    turned = {...turned, [id]: Number(event.target.value)};
    asked = null;
    renderWhatIf();
  });
  byId('whatif-reset').addEventListener('click', () => {
    turned = whatIfStart();
    asked = null;
    renderWhatIf();
  });
  gauge = drawGauge(byId('gauge'));
}

// A marker on a short road from now to a far year. The hollow one stays on the
// published date and the solid one follows the dials.
function placeRoad(id, from, to, base, moved) {
  const road = byId(id), share = time => Math.min(1, Math.max(0, (time - from) / (to - from)));
  road.style.setProperty('--base', share(base).toFixed(4));
  road.style.setProperty('--at', (moved === null ? 1 : share(moved)).toFixed(4));
  road.dataset.off = String(moved === null || moved > to);
}

function renderWhatIf() {
  const box = byId('whatif');
  if (!view?.arrival || view.arrived || view.arrival.reference === null || !view.ladder?.trend) { box.hidden = true; return; }
  const now = Date.now(), out = whatIfView(view, turned, now), speed = out.reading.speed;
  for (const dial of dials) {
    const row = box.querySelector('[data-dial="' + dial.id + '"]'), input = row.querySelector('input'), stop = dial.stops[turned[dial.id]];
    input.value = turned[dial.id];
    input.setAttribute('aria-valuetext', stop.label);
    row.querySelector('output').textContent = stop.label;
    row.style.setProperty('--fill', (turned[dial.id] / (dial.stops.length - 1) * 100).toFixed(1) + '%');
    row.dataset.held = String(out.reading.limitedBy.includes(dial.id));
    row.dataset.moved = String(turned[dial.id] !== dial.start);
  }
  for (const button of byId('asks').children) button.setAttribute('aria-pressed', String(button.dataset.ask === asked));
  gauge.set(speed);
  byId('whatif-speed').textContent = Math.round(speed * 100) + '%';

  const yearStart = Date.UTC(view.nowYear, 0, 1), horizon = Date.UTC(view.horizonYear, 0, 1);
  const arrival = out.arrival, midYear = year => Date.UTC(year, 6, 1);
  byId('whatif-year').textContent = arrival.year === null ? 'Never' : arrival.beyond ? 'After ' + view.horizonYear : String(arrival.year);
  byId('whatif-year-shift').textContent = arrival.beyond ? 'not this century' : arrival.shift;
  placeRoad('road-arrival', yearStart, horizon, midYear(arrival.base), arrival.year === null ? null : midYear(arrival.year));

  const next = out.next, nextBox = byId('whatif-next-box');
  nextBox.hidden = !next;
  if (next) {
    const reach = now + 6 * 365.25 * 86400000;
    byId('whatif-next-name').textContent = 'Next stop, ' + next.name.toLowerCase();
    byId('whatif-next').textContent = next.when === null ? 'Never' : approxWhen(next.when, now);
    byId('whatif-next-shift').textContent = next.shift;
    placeRoad('road-next', now, reach, next.base, next.when);
    byId('road-next-end').textContent = String(new Date(reach).getUTCFullYear());
  }
  byId('road-arrival-end').textContent = String(view.horizonYear);
  byId('whatif-why').textContent = out.sentences.join(' ');
  byId('whatif-reset').disabled = !out.reading.changed;
  box.dataset.state = !out.reading.changed ? 'today' : speed > 1 ? 'faster' : speed < 1 ? 'slower' : 'same';
  box.hidden = false;
}

function scaledBar(share) {
  const bar = el('span', 'bar');
  bar.style.setProperty('--share', Math.min(1, Math.max(0, share)).toFixed(4));
  return bar;
}

function renderPace() {
  const box = byId('pace'), pace = view.pace;
  if (!pace?.answer) { box.hidden = true; return; }
  byId('pace-answer').textContent = pace.answer;
  byId('pace-detail').textContent = pace.detail;
  byId('moments').replaceChildren(...pace.moments.map(moment => {
    const row = el('li'), who = el('span', 'who', moment.system), track = el('span', 'track');
    who.append(el('small', '', moment.when));
    track.append(scaledBar(moment.share), el('span', 'val', moment.text));
    row.append(who, track);
    return row;
  }));
  box.hidden = false;
}

function renderStops() {
  const box = byId('stops');
  const stops = view.stops.filter(stop => stop.reference !== null || stop.low !== null);
  if (!stops.length) { box.hidden = true; return; }
  const from = view.nowYear, to = Math.max(view.horizonYear, from + 10);
  const at = year => Math.min(1, Math.max(0, (year - from) / (to - from))).toFixed(4);
  const ticks = [];
  for (let year = Math.ceil((from + 6) / 20) * 20; year <= to; year += 20) ticks.push(year);

  const rows = stops.map(stop => {
    const row = el('div', 'stop'), name = el('div', 'stop-name'), track = el('div', 'stop-track');
    row.dataset.stop = stop.id;
    name.append(el('b', '', stop.name));
    if (stop.term) name.append(el('span', '', stop.term));
    const said = [];
    if (stop.reference !== null) said.push('experts’ survey answers point to ' + stop.reference);
    if (stop.pace !== null) said.push(stop.pace + ' if today’s speed-up lasts');
    if (stop.low !== null) said.push('scenarios run from ' + stop.low + ' to ' + (stop.high ?? 'beyond ' + view.horizonYear));
    track.setAttribute('role', 'img');
    track.setAttribute('aria-label', stop.name + ': ' + said.join('; ') + '.');
    for (const year of ticks) {
      const line = el('span', 'stop-tick');
      line.style.setProperty('--at', at(year));
      track.append(line);
    }
    if (stop.low !== null) {
      const span = el('span', 'stop-span');
      span.style.setProperty('--from', at(stop.low));
      span.style.setProperty('--to', at(stop.high ?? to));
      track.append(span);
    }
    const pin = (kind, year) => {
      const mark = el('span', 'pin is-' + kind), place = Number(at(year));
      mark.style.setProperty('--at', place);
      if (place < 0.06) mark.dataset.edge = 'start';
      if (place > 0.94) mark.dataset.edge = 'end';
      mark.append(el('i'), el('b', '', String(year)));
      track.append(mark);
    };
    if (stop.reference !== null) pin('experts', stop.reference);
    if (stop.pace !== null) pin('pace', stop.pace);
    row.append(name, track);
    return row;
  });
  const axis = el('div', 'stop-axis'), labels = el('div', 'stop-ticks');
  labels.setAttribute('aria-hidden', 'true');
  for (const [year, text] of [[from, 'Now'], ...ticks.map(year => [year, String(year)])]) {
    const label = el('span', '', text);
    label.style.setProperty('--at', at(year));
    labels.append(label);
  }
  axis.append(labels);
  byId('stops-chart').replaceChildren(...rows, axis);

  const decades = stops.every(stop => stop.low !== null && (stop.high ?? to) - stop.low >= 20);
  byId('stops-answer').textContent = (numberWords[stops.length] ?? stops.length) + ' big moment' + (stops.length === 1 ? '' : 's') +
    '. For each one, the guesses ' + (decades ? 'span decades.' : 'differ widely.');
  byId('stops-key-pace').hidden = !stops.some(stop => stop.pace !== null);
  const never = stops.filter(stop => stop.never).length;
  byId('stops-note').textContent = never === stops.length ? 'For each of them, one scenario never arrives this century.'
    : never ? 'For some of them, one scenario never arrives this century.' : '';
  byId('stops-note').hidden = !never;
  byId('stops-rows').replaceChildren(...stops.map(stop => cells([
    stop.name, stop.reference ?? 'After ' + view.horizonYear, stop.pace ?? 'Same', stop.low ?? 'None', stop.high ?? 'After ' + view.horizonYear,
  ])));
  box.hidden = false;
}

function renderWork() {
  const box = byId('work');
  if (!view.work.length) { box.hidden = true; return; }
  const seen = new Set(view.work.map(effect => effect.id));
  byId('work-answer').textContent = seen.has('service-issues-resolved') && seen.has('developer-completion-time')
    ? 'At work, a little, and it cuts both ways.' : 'At work, the first measurements are in.';
  byId('effects').replaceChildren(...view.work.map(effect => {
    const tile = el('article', 'effect'), say = el('p', 'effect-say'), pair = el('div', 'pair');
    say.append(effect.say[0], el('b', '', effect.say[1]), effect.say[2]);
    // One square for each unit, and a switch between the two readings.
    const [before, after] = effect.rows, picture = el('div'), reading = el('p', 'pair-reading');
    const squares = drawSquares(picture, {before, after, unit: effect.unit});
    const flip = el('div', 'flip');
    flip.setAttribute('role', 'group');
    flip.setAttribute('aria-label', 'Show');
    const show = row => {
      squares.show(row);
      reading.replaceChildren(el('b', '', row.text), ' ' + effect.unit);
      for (const button of flip.children) button.setAttribute('aria-pressed', String(button.dataset.row === row.label));
    };
    for (const row of effect.rows) {
      const button = el('button', '', row.label);
      button.type = 'button';
      button.dataset.row = row.label;
      button.addEventListener('click', () => show(row));
      flip.append(button);
    }
    pair.append(flip, picture, reading);
    show(after);
    const source = el('p', 'effect-source'), credit = effect.source + (effect.year ? ', ' + effect.year : '');
    if (effect.url) {
      const link = el('a', '', credit);
      link.href = effect.url;
      source.append(link);
    } else source.textContent = credit;
    tile.append(say, pair, source);
    if (effect.scope) {
      const more = el('details', 'numbers');
      more.append(el('summary', '', 'About this study'), el('p', '', effect.scope));
      tile.append(more);
    }
    return tile;
  }));
  box.hidden = false;
}

function render() {
  renderHero();
  renderLadder();
  renderArrival();
  renderWhatIf();
  renderPace();
  renderStops();
  renderWork();
}

// Publication follows each scheduled check by a few minutes. The hourly pass
// covers a check that ran late.
function schedule() {
  clearTimeout(timer);
  const now = Date.now();
  let afterCheck = Infinity;
  try { afterCheck = Date.parse(checkpointWindow(new Date(now)).next) + 12 * 60000 - now; } catch { /* hourly only */ }
  const nextHour = 3600000 - now % 3600000 + 90000;
  timer = setTimeout(load, Math.max(60000, Math.min(Number.isFinite(afterCheck) ? afterCheck : Infinity, nextHour)));
}

async function load() {
  try {
    const response = await fetch(feedUrl, {cache: 'no-cache'});
    if (!response.ok) throw new Error('The published assessment answered ' + response.status + '.');
    view = buildClock(await response.json(), Date.now());
    loadedAt = Date.now();
    byId('notice').hidden = true;
    render();
  } catch (error) {
    console.error(error);
    // A failed refresh keeps the last good picture on screen.
    if (!view) {
      const notice = byId('notice'), link = el('a', '', 'full dashboard');
      link.href = './dashboard.html';
      notice.replaceChildren('The latest measurements did not load. Reload the page, or open the ', link, '.');
      notice.hidden = false;
    }
  } finally {
    schedule();
  }
}

wireLadder();
wireWhatIf();
load();
setInterval(renderStamp, 30000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && Date.now() - loadedAt > 30 * 60000) load();
});
