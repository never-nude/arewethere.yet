// Older links point to sections that once lived on the main page or the daily briefing.
(() => {
  const sections = new Map([
    ['home-edition', 'front-date'],
    ['home-date', 'front-date'],
    ['home-question', 'front-headline'],
    ['home-score-title', 'front-score'],
    ['home-score', 'front-score'],
    ['home-fill', 'front-score'],
    ['home-movement', 'front-change'],
    ['home-score-meaning', 'front-score-meaning'],
    ['home-countdown', 'front-countdown'],
    ['home-last-check', 'front-checked'],
    ['home-day-title', 'front-change'],
    ['home-daily-reading', 'front-change'],
    ['home-answer', 'front-verdict'],
    ['home-week-title', 'front-history'],
    ['home-week-reading', 'front-history'],
    ['home-watch-title', 'front-verdict'],
    ['home-watch-reading', 'front-verdict'],
    ['home-milestones-title', 'front-milestones-title'],
    ['front-score-title', 'front-score'],
    ['front-score-guide', 'front-points'],
    ['front-driver-link', 'front-change'],
    ['front-history-caption', 'front-history'],
    ['front-milestones', 'front-milestones-title'],
    ['front-incident', 'watchdog'],
  ]);

  function openLinkedSection() {
    const fragment = location.hash.slice(1);
    const id = fragment.split(':~:')[0];
    if (!id || document.getElementById(id)) return;
    const section = sections.get(id);
    if (!section && id.startsWith('front-')) return;
    const target = new URL(location.href);
    if (!section?.startsWith('front-')) {
      target.pathname = new URL('./dashboard.html', target).pathname;
    }
    if (section) target.hash = section + fragment.slice(id.length);
    location.replace(target.href);
  }

  openLinkedSection();
  window.addEventListener('hashchange', openLinkedSection);
})();
