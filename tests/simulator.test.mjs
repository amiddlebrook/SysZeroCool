import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SCENARIOS, DEFAULT_THRESHOLDS, NODE_COUNT, clamp, sampleAt,
  nodesAt, incidentsFor, historyAt, serializeCsv
} from '../simulator.mjs';

test('scenarios generate deterministic, bounded samples', () => {
  for (const scenario of SCENARIOS) {
    const a = sampleAt(17, scenario.id);
    const b = sampleAt(17, scenario.id);
    assert.deepEqual(a, b);
    for (const metric of ['cpu', 'memory', 'threat', 'health']) {
      assert.ok(a[metric] >= 0 && a[metric] <= 100, metric);
    }
  }
});

test('the scenario engine has meaningful pressure states', () => {
  assert.ok(sampleAt(12, 'thermal').cpu > sampleAt(12, 'nominal').cpu);
  assert.ok(sampleAt(12, 'surge').latency > sampleAt(12, 'nominal').latency);
  assert.ok(sampleAt(12, 'security').threat > sampleAt(12, 'nominal').threat);
});

test('nodes use stable identifiers and expected status values', () => {
  const nodes = nodesAt(25, 'security');
  assert.equal(nodes.length, NODE_COUNT);
  assert.equal(new Set(nodes.map(node => node.id)).size, NODE_COUNT);
  assert.ok(nodes.every(node => ['healthy', 'warning', 'critical'].includes(node.status)));
  assert.ok(nodes.some(node => node.status === 'critical'));
});

test('incidents honor configurable thresholds', () => {
  const data = sampleAt(25, 'security');
  const nodes = nodesAt(25, 'security');
  const incidents = incidentsFor(data, nodes, { ...DEFAULT_THRESHOLDS, threat: 10 });
  assert.ok(incidents.some(item => item.id === 'threat'));
  assert.ok(!incidents.some(item => item.id === 'cpu') || data.cpu >= DEFAULT_THRESHOLDS.cpu);
});

test('exports exact length and CSV headers', () => {
  const history = historyAt(30, 'nominal', 12);
  assert.equal(history.length, 12);
  assert.equal(history.at(-1).tick, 30);
  const csv = serializeCsv(history);
  assert.equal(csv.trim().split('\n').length, 13);
  assert.match(csv, /^tick,cpu,memory,throughput,latency,threat,health\n/);
});

test('clamp enforces limits', () => {
  assert.equal(clamp(110), 100);
  assert.equal(clamp(-7), 0);
  assert.equal(clamp(32), 32);
});
