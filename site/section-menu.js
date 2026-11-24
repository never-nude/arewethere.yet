// Keep one set of section links available in both layouts.
const menu = document.getElementById('section-menu');
const summary = menu.querySelector('summary');
const compact = window.matchMedia('(max-width: 780px)');

function setLayout() {
  menu.open = !compact.matches;
  if (!compact.matches && document.activeElement === summary) {
    menu.querySelector('a').focus();
  }
}
setLayout();
compact.addEventListener('change', setLayout);

menu.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || !compact.matches || !menu.open) return;
  menu.open = false;
  summary.focus();
  event.preventDefault();
});

menu.addEventListener('click', (event) => {
  const anchor = event.target.closest('a[href]');
  if (!anchor || !compact.matches || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  const target = document.getElementById(anchor.hash.slice(1));
  menu.open = false;
  if (!target) return;
  // Keep keyboard reading order at the section reached by the native link.
  requestAnimationFrame(() => {
    if (!target.hasAttribute('tabindex')) {
      target.tabIndex = -1;
      target.addEventListener('blur', () => target.removeAttribute('tabindex'), { once: true });
    }
    target.focus({preventScroll: true});
  });
});
