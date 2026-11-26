// The dashboard can replay an edition and its detailed evidence from the archive.
const homeAliases = {
  'projection-title': 'answer', 'clock-reading': 'home-countdown', 'countdown-duration': 'home-countdown',
  edition: 'stamp', 'next-check': 'stamp', 'front-countdown': 'countdown',
  'milestone-progress': 'stops', 'milestone-heading': 'stops', 'assessment-list': 'stops',
  'milestone-tabs': 'stops', 'milestone-reader': 'stops', 'front-milestones': 'stops',
  acceleration: 'pace',
};

const dashboardAliases = {
  answer: 'dashboard-reference', 'projection-title': 'dashboard-reference', stamp: 'edition',
  'home-countdown': 'countdown', 'countdown-duration': 'countdown', 'clock-reading': 'countdown',
  stops: 'milestone-progress', 'milestone-heading': 'milestone-progress',
  'milestone-tabs': 'milestone-progress', 'milestone-reader': 'milestone-progress',
  'brief-evidence': 'signals', ladder: 'chart-task-horizons', pace: 'acceleration',
  field: 'metric-charts', whatif: 'forecasts', work: 'oversight',
};

// Other historical aliases (front-*, factor-* etc.) are resolved by the dashboard itself.
const dashboardSections = new Set([
  'about', 'acceleration', 'archive', 'assessment-list', 'atlas', 'calculation-visual', 'calculations',
  'changes', 'countdown', 'definitions', 'definitions-heading', 'edition', 'evidence', 'evidence-gates',
  'forecast', 'forecasts', 'history', 'human-evidence', 'indicator-forecasts', 'leaders', 'mc-release-month',
  'measured-lead', 'methodology', 'metric-charts', 'milestone-progress', 'model-catalog', 'model-investment',
  'model-leaders', 'next-check', 'observatory-field', 'outlook', 'oversight', 'public-sources', 'scenario',
  'signals', 'terrain', 'trends', 'watchdog', 'x-factors',
]);

function fragment(url) {
  try { return decodeURIComponent(url.hash.slice(1)); } catch { return ''; }
}

export function homeLinkDestination(url, hasHomeTarget) {
  const id = fragment(url);
  const archive = Boolean(url.searchParams.get('assessment'));
  if (!archive && (!id || hasHomeTarget(id))) return null;

  const next = new URL(url);
  if (!archive && Object.hasOwn(homeAliases, id)) {
    next.hash = homeAliases[id];
    return next;
  }

  const tab = /^milestone-tab-(rsi|agi|asi|singularity)$/.exec(id);
  const alias = Object.hasOwn(dashboardAliases, id) ? dashboardAliases[id] : null;
  const historical = /^(arrival-|assessment-|term-|chart-|prediction-|home-|front-|factor-)/.test(id);
  if (!archive && !alias && !tab && !historical && !dashboardSections.has(id)) return null;

  const dashboard = new URL('./dashboard.html', url);
  dashboard.search = url.search;
  dashboard.hash = alias || (tab ? 'assessment-' + tab[1] : url.hash);
  return dashboard;
}

// Charts become visible after the edition is rendered. Restore anchors against the finished layout.
export function settleHomeFragment() {
  const target = document.getElementById(fragment(location));
  if (target && !target.closest('[hidden]')) target.scrollIntoView({behavior: 'instant'});
}

function followHomeLink() {
  const url = new URL(location.href);
  const next = homeLinkDestination(url, id => document.getElementById(id));
  if (!next) return true;
  if (next.pathname !== url.pathname) {
    location.replace(next.href);
    return false;
  }
  history.replaceState(history.state, '', next.href);
  settleHomeFragment();
  return true;
}

export function installHomeLinks() {
  window.addEventListener('hashchange', followHomeLink);
  return followHomeLink();
}
