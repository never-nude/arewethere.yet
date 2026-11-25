const number = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
const scientific = new Intl.NumberFormat(undefined, { notation: 'scientific', maximumSignificantDigits: 3 });
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' });

const indicators = {
  reliability: {
    name: 'Reliable work on longer tasks',
    reading: value => 'On the tested tasks AI completes with 80% success, a human expert would need about ' + value + ' hours.',
  },
  horizon: {
    name: 'Reach on difficult tasks',
    reading: value => 'On the tested tasks AI completes with 50% success, a human expert would need about ' + value + ' hours.',
  },
  breadth: {
    name: 'Skills across different tasks',
    reading: value => 'The strongest model released in the past 90 days earned ' + value + ' points on the Epoch Capabilities Index, which combines benchmark results.',
  },
  'research-autonomy': {
    name: 'Research tasks completed without help',
    reading: value => 'On OpenAI’s internal test, AI finished ' + value + '% of selected research tasks without human intervention. Experts estimated each task would take them four to eight hours.',
  },
  'research-acceleration': {
    name: 'Pace of research gains at one lab',
    reading: value => 'METR estimated that Anthropic’s model capabilities were improving at ' + value + ' times their earlier rate. How much AI assistance caused that change remains uncertain.',
  },
  compute: {
    name: 'Computation used in training',
    reading: value => 'The largest training run in the tracked data used an estimated ' + value + ' arithmetic operations (FLOP). This measures a resource available to developers.',
  },
  forecast: {
    name: 'Expectations in a play-money market',
    reading: value => 'The YES price was ' + value + '% in a market asking whether general AI will arrive before 2030. This records participants’ expectations.',
  },
  releases: {
    name: 'Recent model launches',
    reading: value => 'The Watch counted ' + value + ' tracked model ' + (value === number.format(1) ? 'launch' : 'launches') + ' over the past 45 days. A launch falls out of this count after that window.',
  },
};

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text != null) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function rawReading(factor) {
  if (!Number.isFinite(factor.value)) return 'A reading is still needed for this input.';
  const value = (factor.id === 'compute' ? scientific : number).format(factor.value);
  return indicators[factor.id]?.reading(value) ?? (factor.label + ' measured ' + value + ' ' + factor.unit + '.');
}

function evidenceDate(factor) {
  if (!factor.date) return '';
  const observed = dateFormat.format(Date.parse(factor.date));
  if (factor.id === 'releases') return 'Window ending ' + observed + '.';
  if (factor.publishedAt && factor.date !== factor.publishedAt) {
    return 'Observation from ' + observed + ', published ' + dateFormat.format(Date.parse(factor.publishedAt)) + '.';
  }
  return 'Reading dated ' + observed + '.';
}

function sourceLink(factor) {
  const anchor = element('a');
  if (typeof factor.sourceUrl === 'string' && factor.sourceUrl.startsWith('https://')) {
    anchor.href = factor.sourceUrl;
    anchor.textContent = 'Source · ' + (factor.source || 'Original evidence');
  } else {
    anchor.href = './dashboard.html#factor-' + factor.id;
    anchor.textContent = 'See the underlying indicator';
  }
  return anchor;
}

function updateIndexGuide(index) {
  const root = document.getElementById('front-score-guide');
  let list = root.querySelector('ol');
  if (!list) {
    list = element('ol', null, 'front-factor-list');
    root.replaceChildren(element('p', 'One index point is one hundredth of the total credit available under our scoring rules. We choose how much each input can contribute. The eight contributions add up to the headline score, with small differences possible from rounding.'), element('p', null, 'front-example'), list);
  }
  const market = index.factors.find(factor => factor.id === 'forecast');
  const example = root.querySelector('.front-example');
  example.textContent = Number.isFinite(market?.value) && Number.isFinite(market.contribution)
    ? 'For example, the play-money market can contribute ' + market.weight + ' points. Its ' + number.format(market.value) + '% YES price earns ' + number.format(market.contribution) + ' of those ' + market.weight + ' points.'
    : 'A missing measurement leaves its points open. Check the date beside each input to see how recent the underlying evidence is.';

  for (const factor of index.factors) {
    let details = list.querySelector('details[data-input="' + factor.id + '"]');
    if (!details) {
      details = element('details');
      details.dataset.input = factor.id;
      const summary = element('summary');
      summary.append(element('span', indicators[factor.id]?.name ?? factor.label, 'front-factor-name'), element('span', null, 'front-factor-points'));
      details.append(summary, element('p', null, 'front-raw'), element('p', null, 'front-rule'), element('p', null, 'front-source'));
      const row = element('li');
      row.append(details);
      list.append(row);
    }
    details.querySelector('.front-factor-points').textContent = Number.isFinite(factor.contribution)
      ? number.format(factor.contribution) + ' of ' + factor.weight + ' points'
      : factor.weight + ' points awaiting a reading';
    details.querySelector('.front-raw').textContent = rawReading(factor);
    const logScale = factor.scoring.startsWith('Log scale');
    const share = Number.isFinite(factor.score)
      ? ' The current measurement earns ' + number.format(factor.score) + '% of this input’s available points.'
      : '';
    details.querySelector('.front-rule').textContent = factor.scoring + (logScale ? ' Each doubling within the range earns the same number of additional points.' : '') + share;
    details.querySelector('.front-source').replaceChildren(evidenceDate(factor) + ' ', sourceLink(factor));
  }
}

export function renderScoreGuide(index, milestones) {
  updateIndexGuide(index);
  const factors = new Map(index.factors.map(factor => [factor.id, factor]));
  for (const milestone of milestones) {
    const root = document.querySelector('[data-front-checklist="' + milestone.id + '"]');
    const total = Number.isFinite(milestone.score)
      ? 'The evidence earns ' + number.format(milestone.score) + ' of the 100 points available for this milestone.'
      : 'This checklist is awaiting evidence.';
    const items = element('ul');
    for (const part of milestone.contributions) {
      const item = element('li');
      const factor = factors.get(part.id);
      const title = indicators[part.id]?.name ?? part.label;
      const credit = Number.isFinite(part.points) ? number.format(part.points) + ' of ' + part.weight + ' points'
        : part.weight + ' points awaiting ' + (part.verification ? 'independent verification' : 'a reading');
      item.append(element('strong', title), element('span', credit, 'front-factor-points'));
      if (factor) {
        item.append(element('p', rawReading(factor) + ' ' + factor.scoring), sourceLink(factor));
      } else {
        item.append(element('p', part.detail));
        if (Number.isFinite(part.points) && part.sourceUrl) item.append(sourceLink(part));
      }
      items.append(item);
    }
    root.replaceChildren(element('p', total), items);
  }
}
