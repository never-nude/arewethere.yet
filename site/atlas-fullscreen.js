const focusable = 'a[href], button, input, select, textarea, summary, [tabindex], [contenteditable="true"]';

function makeOutsideInert(panel) {
  const changed = [];
  let section = panel;
  while (section.parentElement) {
    const parent = section.parentElement;
    for (const sibling of parent.children) {
      if (sibling === section || sibling.hasAttribute('inert')) continue;
      sibling.setAttribute('inert', '');
      changed.push(sibling);
    }
    if (parent === panel.ownerDocument.body) break;
    section = parent;
  }
  return changed;
}

export function mountAtlasFullscreen(panel, button) {
  if (!panel || !button) return;

  const doc = panel.ownerDocument;
  const view = doc.defaultView;
  const controls = button.closest('.atlas-controls, .origins-header') ?? button;
  const initialButtonText = button.textContent.trim() || 'Full screen';
  const initialButtonLabel = button.getAttribute('aria-label');
  const modalAttributes = ['role', 'aria-modal', 'aria-label'];
  let mode;
  let previous;
  let pending = false;
  let followingLink = false;

  button.classList.add('chart-fullscreen');
  button.setAttribute('aria-pressed', 'false');
  if (panel.id) button.setAttribute('aria-controls', panel.id);

  function updateButton() {
    button.textContent = mode ? 'Exit full screen' : initialButtonText;
    button.setAttribute('aria-pressed', String(Boolean(mode)));
    if (initialButtonLabel !== null) {
      button.setAttribute('aria-label', mode ? 'Exit full screen' : initialButtonLabel);
    }
  }

  function enter(nextMode) {
    mode = nextMode;
    panel.dataset.expanded = mode;
    if (mode === 'overlay') {
      previous.inert = makeOutsideInert(panel);
      previous.attributes = modalAttributes.map((attribute) => [attribute, panel.getAttribute(attribute)]);
      doc.documentElement.setAttribute('data-atlas-fullscreen-overlay', '');
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-modal', 'true');
      if (!panel.hasAttribute('aria-labelledby') && !panel.hasAttribute('aria-label')) {
        panel.setAttribute('aria-label', panel.querySelector('h2, h3')?.textContent ?? 'Expanded chart');
      }
    }
    doc.addEventListener('keydown', onFullscreenKey);
    updateButton();
    const stages = panel.querySelectorAll('.sw-terrain__stage, .hist-plot__stage');
    const stage = [...stages].find((candidate) => candidate.getClientRects().length > 0);
    const target = stage ?? controls;
    const offset = target.getBoundingClientRect().top - panel.getBoundingClientRect().top;
    panel.scrollTop += Math.max(0, offset - (stage ? controls.offsetHeight + 8 : 0));
    button.focus({ preventScroll: true });
  }

  function leave() {
    doc.removeEventListener('keydown', onFullscreenKey);
    if (mode === 'overlay') {
      doc.documentElement.removeAttribute('data-atlas-fullscreen-overlay');
      for (const element of previous.inert) element.removeAttribute('inert');
      for (const [attribute, value] of previous.attributes) {
        if (value === null) panel.removeAttribute(attribute);
        else panel.setAttribute(attribute, value);
      }
    }
    mode = null;
    delete panel.dataset.expanded;
    updateButton();
    panel.scrollTop = previous.panelScroll;
    view.scrollTo({ top: previous.scrollY, left: previous.scrollX, behavior: 'instant' });
    if (!followingLink) button.focus({ preventScroll: true });
  }

  function onFullscreenKey(event) {
    if (event.defaultPrevented) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      if (mode === 'overlay') leave();
      else if (!pending) void exitNative();
      return;
    }
    if (mode !== 'overlay' || event.key !== 'Tab') return;
    const visible = [...panel.querySelectorAll(focusable)].filter((element) =>
      element.tabIndex >= 0 && !element.matches(':disabled') && !element.closest('[inert]') && element.getClientRects().length > 0);
    const first = visible[0] ?? button;
    const last = visible.at(-1) ?? button;
    if (!panel.contains(doc.activeElement) || doc.activeElement === (event.shiftKey ? first : last)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    }
  }

  function syncNative() {
    if (doc.fullscreenElement === panel) {
      if (!mode && previous) enter('native');
    } else if (mode === 'native') {
      leave();
    }
  }

  async function exitNative() {
    pending = true;
    try { await doc.exitFullscreen(); } catch { /* Escape remains available. */ }
    finally { pending = false; syncNative(); }
  }

  panel.addEventListener('click', async (event) => {
    if (!mode || pending || event.defaultPrevented || event.button !== 0 ||
        event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const link = event.target.closest?.('a[href]');
    if (!link || (link.target && link.target !== '_self') || link.hasAttribute('download')) return;
    const destination = new URL(link.href, view.location.href);
    const current = view.location;
    if (!destination.hash || destination.origin !== current.origin ||
        destination.pathname !== current.pathname || destination.search !== current.search) return;
    let target;
    try { target = doc.getElementById(decodeURIComponent(destination.hash.slice(1))); }
    catch { return; }
    if (!target || panel.contains(target)) return;

    event.preventDefault();
    followingLink = true;
    try {
      if (mode === 'overlay') leave();
      else await exitNative();
      if (mode) return;
      if (current.hash === destination.hash) target.scrollIntoView();
      else current.hash = destination.hash;
    } finally {
      followingLink = false;
    }
  });

  button.addEventListener('click', async () => {
    if (pending) return;
    if (mode === 'overlay') {
      leave();
      return;
    }
    if (doc.fullscreenElement === panel) {
      await exitNative();
      return;
    }

    previous = { scrollX: view.scrollX, scrollY: view.scrollY, panelScroll: panel.scrollTop };
    if (typeof panel.requestFullscreen !== 'function' || doc.fullscreenEnabled === false) {
      enter('overlay');
      return;
    }
    pending = true;
    try {
      await panel.requestFullscreen();
      syncNative();
    } catch {
      enter('overlay');
    } finally {
      pending = false;
    }
  });
  doc.addEventListener('fullscreenchange', syncNative);
}
