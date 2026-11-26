import assert from 'node:assert/strict';
import test from 'node:test';
import {homeLinkDestination} from '../site/home-links.js';

const native = new Set(['main', 'forecast', 'countdown', 'stops', 'home-countdown', 'about']);
function route(input) {
  const url = new URL(input, 'https://example.test/preview/');
  const next = homeLinkDestination(url, id => native.has(id));
  return next && next.pathname + next.search + next.hash;
}

test('the current homepage keeps native anchors and restores earlier section links', () => {
  assert.equal(route('./#stops'), null);
  assert.equal(route('./#forecast'), null);
  assert.equal(route('./#unknown'), null);
  assert.equal(route('./#%zz'), null);
  assert.equal(route('./?lang=en#milestone-progress'), '/preview/?lang=en#stops');
  assert.equal(route('./index.html#clock-reading'), '/preview/index.html#home-countdown');
  assert.equal(route('./#model-catalog'), '/preview/dashboard.html#model-catalog');
  assert.equal(route('./#milestone-tab-asi'), '/preview/dashboard.html#assessment-asi');
  assert.equal(route('./#factor-electricity'), '/preview/dashboard.html#factor-electricity');
});

test('archived homepage links carry their full query to the archive-aware dashboard', () => {
  assert.equal(route('./?assessment=2026-11-25T14%3A30%3A00.000Z&lang=fr#stops'),
    '/preview/dashboard.html?assessment=2026-11-25T14%3A30%3A00.000Z&lang=fr#milestone-progress');
  assert.equal(route('./?assessment=older#arrival-rsi'), '/preview/dashboard.html?assessment=older#arrival-rsi');
  assert.equal(route('./?assessment=older'), '/preview/dashboard.html?assessment=older');
  assert.equal(route('./?assessment=#about'), null);
});
