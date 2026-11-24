import { buildIndex } from './index-model.js';
import { measureMilestoneProgress } from './milestone-progress.js';

const numbers = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const dates = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/New_York',
});
const feedUrl = new URL('./data/signals.json', import.meta.url);
const lastCheck = document.getElementById('home-last-check');
let checkedAt;
let loading = false;

function displayLatest(payload) {
  const index = buildIndex(payload);
  const measured = Number.isFinite(index.score);
  document.getElementById('home-score').textContent = measured ? numbers.format(index.score) : '—';
  document.getElementById('home-fill').style.width = (measured ? index.score : 0) + '%';

  const answer = document.getElementById('home-answer');
  answer.hidden = !measured;
  answer.textContent = index.threshold.observed
    ? 'The Watch’s independent evidence checks for sustained acceleration have been met.'
    : 'So far, the evidence falls short of confirming that AI keeps speeding up its own development.';

  for (const { id, score } of measureMilestoneProgress(index)) {
    const row = document.querySelector('[data-milestone="' + id + '"]');
    const available = Number.isFinite(score);
    row.querySelector('output').textContent = available ? numbers.format(score) + '%' : 'Awaiting data';
    row.querySelector('i').style.width = (available ? score : 0) + '%';
  }
}

async function refresh() {
  if (document.hidden || loading) return;
  loading = true;
  try {
    const response = await fetch(feedUrl, { cache: 'no-cache', signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('Source check unavailable');
    const payload = await response.json();
    if (!Array.isArray(payload.metrics) || !Array.isArray(payload.sources) || !Array.isArray(payload.events) ||
        !Number.isFinite(Date.parse(payload.checkedAt))) throw new Error('Invalid reading');
    if (payload.checkedAt !== checkedAt) {
      displayLatest(payload);
      checkedAt = payload.checkedAt;
    }
    lastCheck.textContent = 'Last source check ' + dates.format(new Date(checkedAt)) + ' Eastern.';
  } catch {
    lastCheck.textContent = checkedAt
      ? 'Latest check unavailable. Showing the reading from ' + dates.format(new Date(checkedAt)) + ' Eastern.'
      : 'Reading unavailable. We’ll try again in a minute.';
  } finally {
    loading = false;
  }
}

refresh();
document.addEventListener('visibilitychange', refresh);
window.setInterval(refresh, 60_000);
