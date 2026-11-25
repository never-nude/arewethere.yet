import {pathwayKinds} from './observatory-field-model.js';

// Layout is conceptual. Types, reasons and verification counts come from the
// selected checkpoint. The separate AGI → RSI and RSI → AGI curves stay selectable.
const nodes = {
  singularity: {x: 111, y: 8, w: 118, title: 'Singularity'},
  asi: {x: 192, y: 76, w: 145, title: 'Superintelligence'},
  rsi: {x: 3, y: 76, w: 143, title: 'Self-improvement'},
  agi: {x: 92, y: 148, w: 156, title: 'General intelligence'},
};
const edges = {
  'rsi-singularity': 'M90 75 Q98 55 133 42',
  'agi-asi': 'M204 147 Q239 133 246 110',
  'agi-rsi': 'M136 147 Q126 129 95 110',
  'rsi-agi': 'M59 110 Q63 141 91 157',
  'asi-singularity': 'M250 75 Q238 52 207 42',
};
const ns = 'http://www.w3.org/2000/svg';

function tag(name, text, className) {
  const node = document.createElement(name);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function svg(name, attrs) {
  const node = document.createElementNS(ns, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
}

function routeName(route) {
  const from = nodes[route.from]?.title;
  const to = nodes[route.to]?.title;
  if (!from || !to) return route.label;
  return from + (route.id === 'asi-singularity' ? ' alone' : '') + ' → ' + to;
}

function briefReason(route) {
  const statements = route?.reason?.match(/[^.!?]+(?:[.!?]+|$)/g)?.map(s => s.trim());
  if (!statements?.length) return '';
  return route.kind === 'unsupported' ? statements.at(-1) : statements[0];
}

// The brief uses the same diagram on every device. The dashboard uses it if its
// WebGL scene is unavailable and keeps its full node, pathway and replay controls.
export function pathwayExplorer(root, {compact = false, onSelect}) {
  const figure = tag('div', null, 'of-path-figure');
  const diagram = svg('svg', {viewBox: '0 0 340 189', 'aria-hidden': 'true', focusable: 'false'});
  // The native selector exposes all the plotted choices to keyboards and screen readers.
  const markers = svg('defs', {});
  const prefix = compact ? 'brief-path-' : 'dashboard-path-';
  for (const type of ['arrow', 'stop']) {
    const marker = svg('marker', {id: prefix + type, viewBox: '0 0 10 10', refX: 8,
      refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse', markerUnits: 'userSpaceOnUse'});
    marker.append(svg('path', type === 'arrow' ?
      {d: 'M1 1 L8 5 L1 9', fill: 'none', stroke: 'context-stroke', 'stroke-width': 2} :
      {d: 'M7 0 L7 10', stroke: 'context-stroke', 'stroke-width': 3}));
    markers.append(marker);
  }
  const lines = svg('g', {}), labels = svg('g', {});
  diagram.append(markers, lines, labels);
  figure.append(diagram);
  const block = tag('div', null, 'of-path-layout');
  block.append(figure);
  const panel = tag('div', null, 'of-path-panel');
  const picker = tag('select');
  const reason = tag('p', '', 'of-path-reason');
  const kind = tag('strong', '', 'of-path-kind');
  const evidence = tag('p', '', 'of-path-proof');
  const link = tag('a', 'Inspect this connection in the 3D field');
  const readout = tag('div', null, 'of-path-readout');
  readout.setAttribute('role', 'status');
  readout.append(kind, reason, evidence);
  if (compact) {
    const label = tag('label', 'Explore a connection', 'of-path-picker');
    label.append(picker);
    picker.addEventListener('change', () => onSelect(picker.value));
    panel.append(label, readout, link);
    block.append(panel);
  }
  root.append(block);
  let drawnField, paths = [], marks = [], boxes = [];

  function update(field, selection) {
    if (field !== drawnField) {
      drawnField = field;
      const byId = new Map((field.pathways ?? []).map(p => [p.id, p]));
      paths = Object.keys(edges).map(id => byId.get(id)).filter(p => p && nodes[p.from] && nodes[p.to]);
      const pathNodes = new Map((field.nodes ?? []).map(n => [n.id, n]));
      lines.replaceChildren();
      labels.replaceChildren();
      picker.replaceChildren();
      marks = paths.map(route => {
        const group = svg('g', {'class': 'of-map-edge', 'data-kind': route.kind, 'data-route': route.id});
        const title = svg('title', {});
        title.textContent = routeName(route) + ' · ' + (pathwayKinds[route.kind] ?? route.kind);
        const blocked = route.kind === 'incompatible' || route.kind === 'unsupported';
        const visible = svg('path', {d: edges[route.id], 'class': 'of-edge-line',
          'marker-end': `url(#${prefix}${blocked ? 'stop' : 'arrow'})`});
        const hitTarget = svg('path', {d: edges[route.id], 'class': 'of-edge-hit'});
        group.append(title, visible, hitTarget);
        group.addEventListener('click', () => onSelect(route.id));
        lines.append(group);
        const option = new Option(routeName(route).replace('General intelligence', 'General AI').replace(' alone', ''), route.id);
        option.setAttribute('aria-label', routeName(route));
        picker.add(option);
        return {id: route.id, group};
      });
      boxes = Object.entries(nodes).filter(([id]) => pathNodes.has(id)).map(([id, n]) => {
        const group = svg('g', {'class': 'of-map-node', 'data-milestone': id});
        const rect = svg('rect', {x: n.x, y: n.y, width: n.w, height: 33, rx: 12});
        const text = svg('text', {x: n.x + n.w / 2, y: n.y + 21.5, 'text-anchor': 'middle'});
        text.textContent = n.title;
        if (!compact) {
          group.addEventListener('click', () => onSelect(id));
          group.classList.add('is-selectable');
        }
        group.append(rect, text);
        labels.append(group);
        return {id, group};
      });
    }
    const path = paths.find(p => p.id === selection) ?? (compact ? paths[0] : undefined);
    for (const {id, group} of marks) group.classList.toggle('is-active', id === path?.id);
    for (const {id, group} of boxes)
      group.classList.toggle('is-active', id === path?.from || id === path?.to || id === selection);
    if (compact) {
      picker.disabled = !path;
      picker.value = path?.id ?? '';
      kind.textContent = path ? pathwayKinds[path.kind] ?? path.kind : 'No published connection in this edition';
      reason.textContent = briefReason(path);
      evidence.textContent = path?.total ? `${path.met} of ${path.total} transition criteria independently met.` : '';
      link.hidden = !path;
      if (path) {
        const url = new URL('./dashboard.html', location.href);
        const archive = new URL(location.href).searchParams.get('assessment');
        if (archive) url.searchParams.set('assessment', archive);
        url.searchParams.set('field', path.id);
        url.hash = 'atlas';
        link.href = url.href;
      }
    }
    return path?.id;
  }
  return {update};
}
