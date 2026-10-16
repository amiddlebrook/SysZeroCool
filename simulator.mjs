export const SCENARIOS = Object.freeze([
  { id: 'nominal', label: 'Nominal operations', description: 'Steady-state operations with low incident pressure.' },
  { id: 'surge', label: 'Traffic surge', description: 'Elevated traffic, queue pressure and latency.' },
  { id: 'thermal', label: 'Thermal stress', description: 'Sustained compute pressure and overheating risk.' },
  { id: 'security', label: 'Security event', description: 'Increased network anomalies and security risk.' }
]);

export const DEFAULT_THRESHOLDS = Object.freeze({ cpu: 78, latency: 105, threat: 66 });
export const NODE_COUNT = 24;
export const CLUSTERS = ['EDGE', 'CORE', 'DATA', 'SEC'];

export function clamp(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

export function sampleAt(tick, scenario = 'nominal') {
  const t = Number.isFinite(tick) ? tick : 0;
  const wave = Math.sin(t * .23) * 7 + Math.sin(t * .083 + 1) * 4;
  const surge = scenario === 'surge';
  const thermal = scenario === 'thermal';
  const security = scenario === 'security';
  const cpu = clamp(42 + wave + (thermal ? 37 : 0) + (surge ? 17 : 0));
  const memory = clamp(54 + Math.cos(t * .115) * 5 + (thermal ? 19 : 0) + (surge ? 8 : 0));
  const throughput = Math.max(0, 1.35 + Math.sin(t * .19) * .22 + (surge ? 2.25 : 0) + (security ? .5 : 0));
  const latency = Math.max(3, 24 + Math.sin(t * .24) * 10 + (surge ? 94 : 0) + (thermal ? 38 : 0));
  const threat = clamp(13 + Math.sin(t * .12 + 3) * 8 + (security ? 69 : 0) + (surge ? 12 : 0));
  return {
    tick: t,
    cpu: Math.round(cpu),
    memory: Math.round(memory),
    throughput: Math.round(throughput * 100) / 100,
    latency: Math.round(latency),
    threat: Math.round(threat),
    health: Math.round(clamp(100 - cpu * .16 - latency * .10 - threat * .31)),
  };
}

export function nodesAt(tick, scenario = 'nominal') {
  const base = sampleAt(tick, scenario);
  return Array.from({ length: NODE_COUNT }, (_, i) => {
    const index = i + 1;
    const cluster = CLUSTERS[Math.floor(i / 6)];
    const oscillation = Math.sin(tick * .22 + i * 2.13) * 13;
    const load = Math.round(clamp(base.cpu + oscillation + (i % 5 - 2) * 4));
    const impacted = (scenario === 'security' && cluster === 'SEC') ||
      (scenario === 'surge' && cluster === 'EDGE') ||
      (scenario === 'thermal' && cluster === 'CORE');
    const status = impacted && index % 3 === 0 ? 'critical' :
      (load >= 79 || (impacted && index % 2 === 0)) ? 'warning' : 'healthy';
    return {
      id: `SZ-${String(index).padStart(2, '0')}`,
      cluster,
      name: `${cluster.toLowerCase()}-${String((i % 6) + 1).padStart(2, '0')}`,
      load,
      status,
      latency: Math.max(2, Math.round(base.latency * (.6 + (i % 7) * .1))),
    };
  });
}

export function incidentsFor(sample, nodes, thresholds = DEFAULT_THRESHOLDS) {
  const incidents = [];
  if (sample.cpu >= thresholds.cpu) {
    incidents.push({ id: 'cpu', level: 'critical', title: 'Compute saturation', detail: `CPU utilization ${sample.cpu}% exceeds ${thresholds.cpu}% threshold.` });
  }
  if (sample.latency >= thresholds.latency) {
    incidents.push({ id: 'latency', level: 'warning', title: 'Latency threshold exceeded', detail: `Response latency ${sample.latency} ms exceeds ${thresholds.latency} ms threshold.` });
  }
  if (sample.threat >= thresholds.threat) {
    incidents.push({ id: 'threat', level: 'critical', title: 'Network anomaly detected', detail: `Threat index ${sample.threat} exceeds ${thresholds.threat} threshold.` });
  }
  const degraded = nodes.filter(node => node.status === 'critical').length;
  if (degraded > 0) {
    incidents.push({ id: 'nodes', level: 'warning', title: 'Nodes require attention', detail: `${degraded} simulated nodes are in a critical state.` });
  }
  return incidents;
}

export function historyAt(tick, scenario, length = 48) {
  return Array.from({ length }, (_, index) => sampleAt(tick - length + index + 1, scenario));
}

export function serializeCsv(history) {
  const keys = ['tick', 'cpu', 'memory', 'throughput', 'latency', 'threat', 'health'];
  return [keys.join(','), ...history.map(item => keys.map(key => item[key]).join(','))].join('\n') + '\n';
}
