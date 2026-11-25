// New chart selections and paginated evidence rows enter the DOM after the edition loads.
let observer;
const excluded = '[translate="no"], script, style, textarea, template, noscript';

export function protectEditionTerms(root, observations) {
  observer?.disconnect();
  const names = new Set(['METR', 'UTC', 'ECI', 'AGI', 'ASI', 'RSI']);
  for (const row of observations) if (row.system) names.add(row.system);
  const alternatives = [...names].sort((a, b) => b.length - a.length)
    .map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp('(?<![\\p{L}\\p{N}_])(?:' + alternatives.join('|') + ')(?![\\p{L}\\p{N}_])', 'gu');

  function protectText(text) {
    const parent = text.parentElement;
    if (!parent || parent.closest(excluded)) return;
    const matches = [...text.data.matchAll(pattern)];
    if (!matches.length) return;
    // Options and SVG titles only support plain text.
    if (parent.matches('option, svg title, svg desc')) {
      parent.setAttribute('translate', 'no');
      return;
    }
    const fragment = document.createDocumentFragment();
    let end = 0;
    for (const match of matches) {
      if (match.index > end) fragment.append(text.data.slice(end, match.index));
      const mark = parent instanceof SVGElement
        ? document.createElementNS(parent.namespaceURI, 'tspan')
        : document.createElement('bdi');
      mark.setAttribute('translate', 'no');
      mark.textContent = match[0];
      fragment.append(mark);
      end = match.index + match[0].length;
    }
    if (end < text.length) fragment.append(text.data.slice(end));
    text.replaceWith(fragment);
  }

  function protect(node) {
    if (node.nodeType === Node.TEXT_NODE) return protectText(node);
    if (!(node instanceof Element) || node.closest(excluded)) return;
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
      acceptNode(candidate) {
        if (candidate.nodeType === Node.TEXT_NODE) return NodeFilter.FILTER_ACCEPT;
        return candidate.matches(excluded) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP;
      },
    });
    const texts = [];
    while (walker.nextNode()) texts.push(walker.currentNode);
    texts.forEach(protectText);
  }

  protect(root);
  observer = new MutationObserver(changes => {
    for (const change of changes) {
      if (change.type === 'characterData') protectText(change.target);
      else for (const node of change.addedNodes) if (root.contains(node)) protect(node);
    }
  });
  observer.observe(root, {childList: true, characterData: true, subtree: true});
}
