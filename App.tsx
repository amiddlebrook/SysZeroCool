import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowDownToLine, ArrowRight, BarChart3, Bell,
  Check, CheckCheck, ChevronRight, CircleDot, Cpu, Gauge, GitBranch,
  HardDrive, Info, LayoutDashboard, Network, Pause, Play,
  Radio, RefreshCcw, Search, Server, Settings2, ShieldCheck, Zap
} from 'lucide-react';
import {
  Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis
} from 'recharts';
import {
  SCENARIOS, DEFAULT_THRESHOLDS, historyAt, incidentsFor,
  nodesAt, sampleAt, serializeCsv
} from './simulator.mjs';

type View = 'overview' | 'network' | 'logic' | 'analytics';
type Metric = 'cpu' | 'latency' | 'throughput' | 'threat';

const NAVIGATION = [
  { id: 'overview' as View, name: 'Overview', icon: LayoutDashboard, number: '01' },
  { id: 'network' as View, name: 'Network topology', icon: Network, number: '02' },
  { id: 'logic' as View, name: 'Rule engine', icon: GitBranch, number: '03' },
  { id: 'analytics' as View, name: 'Analytics', icon: BarChart3, number: '04' }
];

const METRICS: Record<Metric, { name: string; unit: string; color: string }> = {
  cpu: { name: 'Compute utilization', unit: '%', color: '#fb7046' },
  latency: { name: 'Response latency', unit: 'ms', color: '#75b8ff' },
  throughput: { name: 'Network throughput', unit: 'Gbps', color: '#c0a1ff' },
  threat: { name: 'Threat index', unit: '/100', color: '#f0bd69' }
};

function initialSetting<T>(key: string, fallback: T): T {
  try {
    const saved = localStorage.getItem('syszero.' + key);
    return saved === null ? fallback : JSON.parse(saved) as T;
  } catch {
    return fallback;
  }
}

function MetricCard({ title, value, unit, annotation, icon: Icon, points, color }: {
  title: string; value: string | number; unit: string; annotation: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  points: number[]; color: string;
}) {
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const polyline = points.map((v, i) =>
    `${(i / Math.max(1, points.length - 1)) * 130},${42 - ((v - min) / span) * 30}`
  ).join(' ');
  return (
    <div className="metric-card">
      <div className="metric-label"><span>{title}</span><Icon size={16} /></div>
      <div className="metric-value">{value}<span>{unit}</span></div>
      <div className="metric-footer">
        <span>{annotation}</span>
        <svg viewBox="0 0 130 50" className="spark" aria-hidden="true">
          <polyline points={polyline} stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  return <span className={`status-pill ${status}`}><span className="status-dot" />{status}</span>;
}

function ChartPanel({ history, metric, setMetric, expanded = false }: {
  history: any[]; metric: Metric; setMetric?: (m: Metric) => void; expanded?: boolean;
}) {
  const meta = METRICS[metric];
  return (
    <div className="chart-area">
      {setMetric && (
        <div className="chart-tabs" role="group" aria-label="Chart metric">
          {(Object.keys(METRICS) as Metric[]).map(key =>
            <button key={key} type="button" className={key === metric ? 'chart-tab selected' : 'chart-tab'}
              onClick={() => setMetric(key)}>{key === 'cpu' ? 'Compute' : key === 'throughput' ? 'Traffic' : key === 'threat' ? 'Threat' : 'Latency'}</button>
          )}
        </div>
      )}
      <div className="chart-heading">
        <span>{meta.name}</span>
        <span className="chart-unit">{meta.unit} · last {history.length} samples</span>
      </div>
      <div className={expanded ? 'chart-plot tall' : 'chart-plot'}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={history} margin={{ top: 8, right: 9, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id={`fill-${metric}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={meta.color} stopOpacity={0.25} />
                <stop offset="95%" stopColor={meta.color} stopOpacity={0.005} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#2a303b" strokeDasharray="3 7" />
            <XAxis dataKey="tick" tickLine={false} axisLine={false} minTickGap={35}
              tick={{ fill: '#788190', fontSize: 10 }} tickFormatter={v => `T+${v}`} />
            <YAxis tickLine={false} axisLine={false} width={44} tick={{ fill: '#788190', fontSize: 10 }} />
            <Tooltip cursor={{ stroke: '#556174', strokeDasharray: '4 4' }}
              contentStyle={{ background: '#161c25', border: '1px solid #39414c', borderRadius: 9, color: '#f2f5f9', fontSize: 12 }}
              labelFormatter={value => `Simulation tick ${value}`}
              formatter={(value: number | undefined) => [value ?? 0, meta.name]} />
            <Area type="monotone" dataKey={metric} stroke={meta.color} strokeWidth={2.5}
              fill={`url(#fill-${metric})`} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function downloadCsv(history: any[]) {
  const csv = serializeCsv(history);
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const element = document.createElement('a');
  element.href = url;
  element.download = 'syszero-simulation.csv';
  document.body.appendChild(element);
  element.click();
  element.remove();
  URL.revokeObjectURL(url);
}

function App() {
  const [view, setView] = useState<View>('overview');
  const [scenario, setScenario] = useState<string>(() => {
    const candidate = initialSetting('scenario', 'nominal');
    return SCENARIOS.some(s => s.id === candidate) ? candidate : 'nominal';
  });
  const [tick, setTick] = useState(60);
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState<1 | 2>(1);
  const [metric, setMetric] = useState<Metric>('cpu');
  const [selectedNode, setSelectedNode] = useState('SZ-01');
  const [nodeSearch, setNodeSearch] = useState('');
  const [nodeFilter, setNodeFilter] = useState('all');
  const [thresholds, setThresholds] = useState(() => ({
    ...DEFAULT_THRESHOLDS, ...initialSetting('thresholds', {})
  }));
  const [rulesEnabled, setRulesEnabled] = useState(() => ({
    cpu: true, latency: true, threat: true, ...initialSetting('rules', {})
  }));
  const [acknowledged, setAcknowledged] = useState<string[]>([]);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setTick(current => current + 1), speed === 2 ? 750 : 1500);
    return () => window.clearInterval(timer);
  }, [running, speed]);

  useEffect(() => {
    try {
      localStorage.setItem('syszero.scenario', JSON.stringify(scenario));
      localStorage.setItem('syszero.thresholds', JSON.stringify(thresholds));
      localStorage.setItem('syszero.rules', JSON.stringify(rulesEnabled));
    } catch { /* Storage is optional; simulation remains usable. */ }
  }, [scenario, thresholds, rulesEnabled]);

  const sample = useMemo(() => sampleAt(tick, scenario), [tick, scenario]);
  const history = useMemo(() => historyAt(tick, scenario, 56), [tick, scenario]);
  const nodes = useMemo(() => nodesAt(tick, scenario), [tick, scenario]);
  const appliedThresholds = {
    cpu: rulesEnabled.cpu ? thresholds.cpu : Infinity,
    latency: rulesEnabled.latency ? thresholds.latency : Infinity,
    threat: rulesEnabled.threat ? thresholds.threat : Infinity
  };
  const incidents = incidentsFor(sample, nodes, appliedThresholds);
  const outstanding = incidents.filter(item => !acknowledged.includes(item.id));
  const unhealthyCount = nodes.filter(node => node.status !== 'healthy').length;
  const chosen = nodes.find(node => node.id === selectedNode) ?? nodes[0];
  const filteredNodes = nodes.filter(node =>
    (nodeFilter === 'all' || node.status === nodeFilter) &&
    (`${node.id} ${node.name} ${node.cluster}`.toLowerCase().includes(nodeSearch.toLowerCase()))
  );
  const currentScenario = SCENARIOS.find(item => item.id === scenario) ?? SCENARIOS[0];

  const updateScenario = (next: string) => {
    if (!SCENARIOS.some(s => s.id === next)) return;
    setScenario(next);
    setTick(60);
    setAcknowledged([]);
  };
  const reset = () => { setTick(60); setAcknowledged([]); setRunning(true); };
  const changeThreshold = (key: 'cpu' | 'latency' | 'threat', next: number) =>
    setThresholds(old => ({ ...old, [key]: next }));
  const toggleRule = (key: 'cpu' | 'latency' | 'threat') =>
    setRulesEnabled(old => ({ ...old, [key]: !old[key] }));

  const metricHistory = (key: Metric) => history.map(row => row[key]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo"><span>0</span><i /></div>
          <div><strong>SYS<span>ZERO</span></strong><small>OPERATIONS CONSOLE</small></div>
        </div>

        <div className="nav-section-label">WORKSPACE <span>/ 01</span></div>
        <nav aria-label="Main navigation">
          {NAVIGATION.map(item => {
            const Icon = item.icon;
            return (
              <button key={item.id} type="button" onClick={() => setView(item.id)}
                aria-current={view === item.id ? 'page' : undefined}
                className={`nav-link ${view === item.id ? 'active' : ''}`}>
                <Icon size={18} strokeWidth={1.8} /><span>{item.name}</span><small>{item.number}</small>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="sim-card">
            <div className="sim-card-head"><Radio size={16} /><span>SIMULATION MODE</span></div>
            <p>Deterministic local telemetry. No production infrastructure is connected.</p>
            <div className="sim-card-foot"><span className="pulse-dot" /> Engine {running ? 'running' : 'paused'}</div>
          </div>
          <div className="sidebar-footer"><span>SYSZERO / v1.0</span><span>CF · EDGE READY</span></div>
        </div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs"><span>SYSZERO</span><ChevronRight size={14} /><strong>{NAVIGATION.find(n => n.id === view)?.name}</strong></div>
          <div className="topbar-right">
            <span className="environment-label"><CircleDot size={13} /> LOCAL SIMULATION</span>
            <div className="top-divider" />
            <span className="tick-label">TICK <b>{String(tick).padStart(4, '0')}</b></span>
            <button className="notification-button" type="button" title="Go to active incidents" aria-label={`${outstanding.length} active incidents`}
              onClick={() => { setView('overview'); document.getElementById('incidents')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}>
              <Bell size={18} />{outstanding.length > 0 && <i />}
            </button>
          </div>
        </header>

        <main className="main-content">
          <div className="page-header">
            <div>
              <div className="eyebrow"><span className="eyebrow-rule" /> CONTROL CENTER <span className="eyebrow-muted">/ {view.toUpperCase()}</span></div>
              <h1>{view === 'overview' ? 'Command overview' : view === 'network' ? 'Network topology' : view === 'logic' ? 'Detection rules' : 'Signal analytics'}<span className="orange-dot">.</span></h1>
              <p className="page-description">
                {view === 'overview' ? 'Operational awareness across a simulated distributed system.' :
                  view === 'network' ? 'Inspect synthetic node conditions and isolate degraded clusters.' :
                  view === 'logic' ? 'Tune the local detection thresholds used to generate incidents.' :
                  'Explore generated signals and export reproducible simulation samples.'}
              </p>
            </div>
            <div className="header-controls">
              <label className="field-label" htmlFor="scenario">SCENARIO</label>
              <select id="scenario" value={scenario} onChange={e => updateScenario(e.target.value)} aria-label="Simulation scenario">
                {SCENARIOS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
              <button type="button" className="button icon-button" onClick={reset} title="Reset simulation" aria-label="Reset simulation"><RefreshCcw size={17} /></button>
              <button type="button" className="button button-primary" onClick={() => setRunning(value => !value)}>
                {running ? <Pause size={16} /> : <Play size={16} />}
                {running ? 'Pause' : 'Resume'}
              </button>
            </div>
          </div>

          <div className="scenario-strip">
            <div className="strip-left"><span className="strip-icon"><Zap size={16} /></span><strong>{currentScenario.label}</strong><span>{currentScenario.description}</span></div>
            <div className="strip-right">
              <span className={`health-indicator ${outstanding.length ? 'attention' : ''}`}><span />{outstanding.length ? `${outstanding.length} unacknowledged` : 'No open incidents'}</span>
              <button type="button" className="speed-button" onClick={() => setSpeed(v => v === 1 ? 2 : 1)} title="Change simulation playback speed">{speed}× SPEED</button>
            </div>
          </div>

          {(view === 'overview' || view === 'analytics') && (
            <section className="metric-grid" aria-label="System metrics">
              <MetricCard title="CPU UTILIZATION" value={sample.cpu} unit="%" annotation="Simulated compute load" icon={Cpu} points={metricHistory('cpu')} color="#fb7046" />
              <MetricCard title="THROUGHPUT" value={sample.throughput.toFixed(2)} unit="Gbps" annotation="Synthetic network traffic" icon={Activity} points={metricHistory('throughput')} color="#c0a1ff" />
              <MetricCard title="LATENCY" value={sample.latency} unit="ms" annotation="Synthetic response time" icon={Gauge} points={metricHistory('latency')} color="#75b8ff" />
              <MetricCard title="SYSTEM HEALTH" value={sample.health} unit="/100" annotation={`${nodes.length - unhealthyCount} / ${nodes.length} nodes healthy`} icon={ShieldCheck} points={history.map(row => row.health)} color="#55cbb6" />
            </section>
          )}

          {view === 'overview' && (
            <>
              <div className="overview-grid">
                <section className="panel performance-panel">
                  <div className="panel-header">
                    <div><div className="overline">TELEMETRY / 001</div><h2>System performance</h2></div>
                    <div className="panel-header-meta"><span className="live-dot" /> {running ? 'PLAYING' : 'PAUSED'} · SYNTHETIC</div>
                  </div>
                  <ChartPanel history={history} metric={metric} setMetric={setMetric} />
                  <div className="chart-legend"><span><i style={{ background: METRICS[metric].color }} />{METRICS[metric].name}</span><span>Sample interval: {speed === 2 ? '0.75' : '1.5'}s</span></div>
                </section>

                <section className="panel incidents-panel" id="incidents">
                  <div className="panel-header">
                    <div><div className="overline">EVENT STREAM / 002</div><h2>Active incidents</h2></div>
                    <span className="count-pill">{outstanding.length} ACTIVE</span>
                  </div>
                  <div className="incident-list">
                    {incidents.length === 0 && (
                      <div className="empty-state"><ShieldCheck size={30} /><strong>All clear</strong><span>No current thresholds exceeded in this scenario.</span></div>
                    )}
                    {incidents.map(item => (
                      <div key={item.id} className={`incident ${acknowledged.includes(item.id) ? 'ack' : ''}`}>
                        <span className={`incident-symbol ${item.level}`}><AlertTriangle size={15} /></span>
                        <div className="incident-body"><div className="incident-line"><strong>{item.title}</strong><small>{item.level.toUpperCase()}</small></div>
                          <p>{item.detail}</p>
                          <button type="button" className="ack-button" disabled={acknowledged.includes(item.id)}
                            onClick={() => setAcknowledged(items => [...items, item.id])}>
                            {acknowledged.includes(item.id) ? <><Check size={13} /> Acknowledged</> : 'Acknowledge event →'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="panel-footnote"><Info size={14} /> Generated locally from scenario and detection rules.</div>
                </section>
              </div>

              <div className="bottom-grid">
                <section className="panel nodes-overview">
                  <div className="panel-header">
                    <div><div className="overline">INFRASTRUCTURE / 003</div><h2>Node fleet</h2></div>
                    <button type="button" className="text-link" onClick={() => setView('network')}>Explore topology <ArrowRight size={15} /></button>
                  </div>
                  <div className="fleet-summary">
                    <div><strong>{nodes.length}</strong><span>Total nodes</span></div>
                    <div><strong className="green-text">{nodes.filter(n => n.status === 'healthy').length}</strong><span>Healthy</span></div>
                    <div><strong className="amber-text">{nodes.filter(n => n.status === 'warning').length}</strong><span>Warning</span></div>
                    <div><strong className="red-text">{nodes.filter(n => n.status === 'critical').length}</strong><span>Critical</span></div>
                  </div>
                  <div className="fleet-matrix" aria-label="Fleet status">
                    {nodes.map(node => <button key={node.id} type="button" className={`fleet-square ${node.status}`} title={`${node.id}: ${node.status}`}
                      onClick={() => { setSelectedNode(node.id); setView('network'); }} aria-label={`Inspect ${node.name}: ${node.status}`} />)}
                  </div>
                  <div className="fleet-footnote"><span>EDGE · CORE · DATA · SEC</span><span>24 SIMULATED ENDPOINTS</span></div>
                </section>
                <section className="panel insight-panel">
                  <div className="panel-header"><div><div className="overline">EXECUTION / 004</div><h2>Quick actions</h2></div></div>
                  <button type="button" className="action-row" onClick={() => setView('logic')}><div className="action-icon"><Settings2 size={19} /></div><div><strong>Configure detection</strong><span>Adjust thresholds & enabled rules</span></div><ChevronRight size={17} /></button>
                  <button type="button" className="action-row" onClick={() => downloadCsv(history)}><div className="action-icon"><ArrowDownToLine size={19} /></div><div><strong>Export telemetry</strong><span>Download current synthetic samples</span></div><ChevronRight size={17} /></button>
                </section>
              </div>
            </>
          )}

          {view === 'network' && (
            <div className="network-layout">
              <section className="panel topology-panel">
                <div className="panel-header"><div><div className="overline">24 ENDPOINTS / 4 CLUSTERS</div><h2>Cluster map</h2></div><span className="panel-header-meta">SELECT A NODE TO INSPECT</span></div>
                <div className="topology-toolbar">
                  <label className="search-box"><Search size={16} /><input value={nodeSearch} onChange={e => setNodeSearch(e.target.value)} placeholder="Search node or cluster" aria-label="Search nodes" /></label>
                  <div className="filter-buttons" role="group" aria-label="Filter node status">{['all', 'healthy', 'warning', 'critical'].map(status =>
                    <button key={status} type="button" className={nodeFilter === status ? 'filter active' : 'filter'}
                      onClick={() => setNodeFilter(status)}>{status}</button>)}</div>
                </div>
                <div className="topology-grid">
                  {filteredNodes.map(node => (
                    <button type="button" key={node.id} className={`node-tile ${node.id === selectedNode ? 'selected' : ''}`}
                      onClick={() => setSelectedNode(node.id)} aria-pressed={node.id === selectedNode}>
                      <div className="node-tile-top"><Server size={17} /><span className={`node-light ${node.status}`} /></div>
                      <strong>{node.name}</strong><small>{node.id} · {node.cluster}</small>
                      <div className="node-tile-bottom"><span>LOAD</span><span>{node.load}%</span></div>
                      <div className="load-track"><i style={{ width: `${node.load}%` }} /></div>
                    </button>
                  ))}
                  {filteredNodes.length === 0 && <div className="no-results">No nodes match your filters.</div>}
                </div>
              </section>
              <aside className="panel node-details">
                <div className="panel-header"><div><div className="overline">NODE INSPECTOR</div><h2>{chosen.name}</h2></div></div>
                <div className="inspector-glyph"><Server size={42} strokeWidth={1} /></div>
                <StatusPill status={chosen.status} />
                <dl className="inspector-list">
                  <div><dt>Identifier</dt><dd>{chosen.id}</dd></div>
                  <div><dt>Cluster</dt><dd>{chosen.cluster}</dd></div>
                  <div><dt>Load</dt><dd>{chosen.load}%</dd></div>
                  <div><dt>Latency</dt><dd>{chosen.latency} ms</dd></div>
                  <div><dt>Data source</dt><dd>Local simulator</dd></div>
                </dl>
                <p className="inspector-note"><Info size={15} /> This is a simulated node. No host scan, remote connection, or diagnostic command is executed.</p>
              </aside>
            </div>
          )}

          {view === 'logic' && (
            <div className="rules-layout">
              <section className="panel rules-panel">
                <div className="panel-header"><div><div className="overline">POLICY / DETECTION</div><h2>Threshold configuration</h2></div><span className="panel-header-meta">AUTO-SAVED ON THIS DEVICE</span></div>
                {([
                  { key: 'cpu' as const, title: 'Compute saturation', detail: 'Trigger when synthetic CPU utilization reaches this level.', min: 40, max: 100, unit: '%', color: '#fb7046' },
                  { key: 'latency' as const, title: 'Latency spike', detail: 'Flag slow synthetic response times.', min: 20, max: 180, unit: 'ms', color: '#75b8ff' },
                  { key: 'threat' as const, title: 'Threat anomaly', detail: 'Flag an elevated synthetic threat index.', min: 10, max: 100, unit: '/100', color: '#f0bd69' },
                ]).map(rule => (
                  <div className="rule-row" key={rule.key}>
                    <div className="rule-top"><div><strong>{rule.title}</strong><p>{rule.detail}</p></div>
                      <label className="toggle-control"><input type="checkbox" checked={rulesEnabled[rule.key]} onChange={() => toggleRule(rule.key)} aria-label={`Enable ${rule.title}`} /><span /></label></div>
                    <div className={rulesEnabled[rule.key] ? 'rule-range' : 'rule-range disabled'}>
                      <input type="range" min={rule.min} max={rule.max} value={thresholds[rule.key]}
                        onChange={e => changeThreshold(rule.key, Number(e.target.value))} disabled={!rulesEnabled[rule.key]}
                        style={{ accentColor: rule.color }} aria-label={`${rule.title} threshold`} />
                      <output>{thresholds[rule.key]}{rule.unit}</output>
                    </div>
                  </div>
                ))}
                <div className="rule-actions"><button type="button" className="button" onClick={() => { setThresholds({ ...DEFAULT_THRESHOLDS }); setRulesEnabled({ cpu: true, latency: true, threat: true }); }}>Reset defaults <RefreshCcw size={15} /></button></div>
              </section>
              <section className="panel rules-help">
                <div className="panel-header"><div><div className="overline">EVALUATION</div><h2>Rule status</h2></div></div>
                <div className="rule-status"><span className="rule-status-glyph"><GitBranch size={28} /></span><strong>{Object.values(rulesEnabled).filter(Boolean).length} / 3 enabled</strong><span>Rules evaluated on each simulation tick.</span></div>
                <div className="evaluation-row"><span>Current CPU</span><b>{sample.cpu}%</b></div>
                <div className="evaluation-row"><span>Current latency</span><b>{sample.latency} ms</b></div>
                <div className="evaluation-row"><span>Threat index</span><b>{sample.threat} / 100</b></div>
                <div className="evaluation-row"><span>Triggered conditions</span><b>{incidents.length}</b></div>
                <div className="help-note"><Info size={16} /> Thresholds are saved to this browser only. Rule changes never modify real infrastructure.</div>
              </section>
            </div>
          )}

          {view === 'analytics' && (
            <div className="analytics-layout">
              <section className="panel analytics-primary">
                <div className="panel-header"><div><div className="overline">SIGNAL HISTORY / 56 SAMPLES</div><h2>Trend explorer</h2></div>
                  <button type="button" className="button export-button" onClick={() => downloadCsv(history)}><ArrowDownToLine size={16} /> Export CSV</button>
                </div>
                <ChartPanel history={history} metric={metric} setMetric={setMetric} expanded />
              </section>
              <div className="analytics-mini-grid">
                {(Object.keys(METRICS) as Metric[]).map(key => (
                  <button type="button" key={key} className={`signal-card ${metric === key ? 'selected' : ''}`} onClick={() => setMetric(key)}>
                    <div className="signal-head"><span>{METRICS[key].name}</span><span style={{ color: METRICS[key].color }}>{sample[key]} {METRICS[key].unit}</span></div>
                    <div className="signal-spark">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={history}><Line type="monotone" dataKey={key} stroke={METRICS[key].color} strokeWidth={2} dot={false} isAnimationActive={false} /></LineChart>
                      </ResponsiveContainer>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <footer className="main-footer"><span><CircleDot size={12} /> LOCAL DATA ONLY · NO LIVE SYSTEM CONNECTION</span><span>BUILT FOR CLOUDFLARE WORKERS <span className="footer-slash">//</span> SYSZERO 2026</span></footer>
        </main>
      </div>
    </div>
  );
}

export default App;
