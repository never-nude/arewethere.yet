export const checkTimeZone = 'America/New_York';
export const checkTimes = Object.freeze(['00:00', '09:30', '16:00']);
const formatter = new Intl.DateTimeFormat('en-US', {
  timeZone: checkTimeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});
const dayMs = 86400000;

export function editionLabel(record) {
  if (record.kind === 'commissioning') return 'Launch baseline';
  if (record.trigger?.type === 'initial-measurement') return record.trigger.label || 'Launch test';
  return 'Scheduled assessment';
}

function parts(instant) {
  return Object.fromEntries(formatter.formatToParts(instant)
    .filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]));
}

// Convert local civil time to an instant with the offset on that particular date.
// The three chosen local times exist exactly once on both DST transition days.
function localInstant(utcDay, clock) {
  const [hour, minute] = clock.split(':').map(Number);
  const wall = utcDay + hour * 3600000 + minute * 60000;
  let instant = wall;
  for (let pass = 0; pass < 3; pass++) {
    const p = parts(instant);
    const localAsUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    if (localAsUTC === wall) return new Date(instant).toISOString();
    instant += wall - localAsUTC;
  }
  throw new Error('Unable to resolve the New York checkpoint time.');
}

export function checkpointWindow(now = new Date()) {
  const instant = new Date(now);
  if (!Number.isFinite(instant.getTime())) throw new TypeError('Invalid checkpoint timestamp');
  const local = parts(instant);
  const day = Date.UTC(local.year, local.month - 1, local.day);
  const slots = [-1, 0, 1].flatMap(offset => checkTimes.map(time => localInstant(day + offset * dayMs, time)));
  const stamp = instant.toISOString();
  return { previous: slots.findLast(slot => slot <= stamp), next: slots.find(slot => slot > stamp) };
}

// Creation time belongs to the original workflow run, including on retries.
// A late job can finish verification in its own interval. It cannot backfill an expired one.
export function checkpointForRun({ event, cron, createdAt, now = new Date() }) {
  if (event !== 'schedule' || !createdAt) return null;
  const created = new Date(createdAt);
  if (!Number.isFinite(created.getTime()) || created.getTime() > new Date(now).getTime()) return null;
  const slot = checkpointWindow(created).previous;
  const p = parts(new Date(slot));
  if (cron !== p.minute + ' ' + p.hour + ' * * *') return null;
  return slot === checkpointWindow(now).previous ? slot : null;
}
