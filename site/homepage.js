import {startClock} from './clock.js';
import {installHomeLinks, settleHomeFragment} from './home-links.js';
import {selectOutlook} from './observatory-acceleration.js';
import {singularityReference} from './observatory-reference.js';
import {countdownParts, countdownUnits, formatCountdownPart, referenceInstant} from './observatory-clock.js';
import {installBriefingGlossary} from './front-glossary.js';
import {protectEditionTerms} from './translation-terms.js';

function startHome() {
  const board = document.getElementById('home-countdown');
  const parts = board.querySelector('.home-time-parts');
  const note = board.querySelector('.home-clock-note');
  const yearNote = note.textContent;
  const range = document.getElementById('home-range');
  const cells = countdownUnits.map(() => {
    const cell = document.createElement('span');
    const digits = document.createElement('b');
    const unit = document.createElement('span');
    cell.translate = false;
    cell.append(digits, ' ', unit);
    parts.append(cell);
    return {digits, unit};
  });
  let target;
  let firstEdition = true;

  function tick() {
    if (document.hidden) return;
    const remaining = countdownParts(Date.now(), target);
    board.hidden = !remaining;
    if (!remaining) return;
    remaining.forEach((value, index) => {
      const {digits, label} = formatCountdownPart(document.documentElement.lang, index, value);
      const cell = cells[index];
      if (cell.digits.textContent !== digits) cell.digits.textContent = digits;
      if (cell.unit.textContent !== label) cell.unit.textContent = label;
    });
  }

  for (const element of document.querySelectorAll('.chart, .sr, #stamp, #status, #forecast, #home-countdown')) {
    element.setAttribute('data-glossary-exclude', '');
  }
  installBriefingGlossary(document.getElementById('main'));
  setInterval(tick, 1000);
  document.addEventListener('visibilitychange', tick);

  startClock((feed, view) => {
    const assessment = feed.assessment;
    const {outlook} = selectOutlook(assessment, feed);
    const reference = singularityReference(assessment, outlook);
    range.textContent = reference.range;
    range.hidden = !reference.range;
    document.getElementById('meaning-link').hash = view.stops.length ? 'stops' : 'definitions';
    if (!view.forecast) {
      // Confirmed, undated and pre-scenario editions retain their published wording.
      const headline = document.getElementById('big');
      headline.textContent = reference.headline;
      headline.dataset.kind = 'summary';
      document.getElementById('answer').textContent = 'When might the singularity arrive?';
    }
    const exact = assessment.forecasts?.find(row => row.id === 'singularity');
    const year = view.forecast?.year;
    target = NaN;
    if (!view.arrived) {
      if (Number.isInteger(year)) target = referenceInstant(year);
      else if (!view.arrival) target = Date.parse(exact?.centralDate);
    }
    const explanation = Number.isInteger(year) ? yearNote : 'The clock uses the assessment’s published reference date.';
    if (note.textContent !== explanation) note.textContent = explanation;
    tick();
    protectEditionTerms(document.body, assessment.observations ?? []);
    if (firstEdition) {
      firstEdition = false;
      settleHomeFragment();
    }
  });
}

if (installHomeLinks()) startHome();
