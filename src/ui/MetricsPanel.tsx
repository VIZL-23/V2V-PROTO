/**
 * MetricsPanel — the telemetry column.
 *
 * Every value here is a real measurement pulled from the simulation on a
 * throttled 10 Hz subscription (see App.tsx). Nothing is typed in. Readouts are
 * instrument type (mono, tabular), separated by hairlines rather than boxed into
 * cards, ordered by importance: Warning time leads, supporting telemetry
 * follows, the selected-vehicle detail closes.
 */

import type { ReactNode } from 'react';
import { CHANNEL } from '../sim/config';
import type { LinkSnapshot, MetricsSnapshot } from '../sim/metrics';
import type { RiskLevel } from '../risk/risk';
import type { EdgeStats } from '../edge/rsu';
import { IconAlert, IconCheck } from './icons';

interface KnownPeer {
  id: string;
  hops: number;
}

interface SelectedInfo {
  id: string;
  inRange: number;
  link: LinkSnapshot;
  known: KnownPeer[];
  riskLevel: RiskLevel;
  ttc: number | null;
  gap: number | null;
  dSafe: number;
  insideSafe: boolean;
}

interface ScenarioInfo {
  emergencyActive: boolean;
  brakerId: string | null;
  warningTimeMs: number | null;
  edgeStats: EdgeStats;
}

interface MetricsPanelProps {
  metrics: MetricsSnapshot | null;
  channelRange: number;
  onRangeChange: (m: number) => void;
  selected: SelectedInfo | null;
  scenario?: ScenarioInfo;
}

const pct = (x: number) => `${(x * 100).toFixed(1)}`;
const ms = (x: number) => x.toFixed(1);

const NO_SCENARIO: ScenarioInfo = {
  emergencyActive: false,
  brakerId: null,
  warningTimeMs: null,
  edgeStats: { connected: 0, densityPerKm: 0, density: 'LOW', avgSpeedMps: 0, congestion: false },
};

export function MetricsPanel(props: MetricsPanelProps) {
  const { metrics, channelRange, onRangeChange, selected } = props;
  const scenario = props.scenario ?? NO_SCENARIO;
  const { edgeStats } = scenario;

  return (
    <aside className="rail">
      {/* Priority 2 — the headline safety number. */}
      <section className={`primary${scenario.emergencyActive ? ' primary-active' : ''}`}>
        <div className="primary-head">
          <span className="rail-label">Warning time</span>
          {scenario.emergencyActive && <span className="tag tag-danger">ACTIVE</span>}
        </div>
        <div className="primary-value mono">
          {scenario.warningTimeMs !== null ? (
            <>
              {scenario.warningTimeMs.toFixed(0)}
              <span className="primary-unit">ms</span>
            </>
          ) : scenario.emergencyActive ? (
            <span className="primary-idle">measuring…</span>
          ) : (
            <span className="primary-idle">standby</span>
          )}
        </div>
        <p className="primary-note">
          {scenario.emergencyActive
            ? `${scenario.brakerId} braking → first DANGER downstream`
            : 'braker decelerates → first follower reaches DANGER · decided locally'}
        </p>
      </section>

      {/* Priority 4 — V2V link telemetry. */}
      <Section label="V2V link">
        <div className="stat-grid">
          <Stat label="Latency p50" value={metrics ? ms(metrics.latP50) : '—'} unit="ms" />
          <Stat label="Latency p95" value={metrics ? ms(metrics.latP95) : '—'} unit="ms" />
          <Stat label="PRR" value={metrics ? pct(metrics.prr) : '—'} unit="%" tone={prrTone(metrics?.prr)} />
          <Stat label="Packet loss" value={metrics ? pct(metrics.loss) : '—'} unit="%" tone={lossTone(metrics?.loss)} />
        </div>
        <Foot>
          {metrics
            ? `${metrics.delivered}/${metrics.attempts} delivered · ${metrics.deliveredPerSec.toFixed(0)} msg/s · ${(metrics.windowMs / 1000).toFixed(0)}s window`
            : 'waiting for traffic…'}
        </Foot>
      </Section>

      {/* Priority 5 — protocol / multi-hop. */}
      <Section label="Protocol" tail="decentralized">
        <div className="stat-grid">
          <Stat label="Relays" value={metrics ? metrics.forwardedPerSec.toFixed(0) : '—'} unit="/s" />
          <Stat label="Max hops" value={metrics ? String(metrics.maxHops) : '—'} />
          <Stat label="Dupes rejected" value={metrics ? metrics.duplicatesPerSec.toFixed(0) : '—'} unit="/s" tone="ok" />
          <Stat
            label="Dedupe"
            value={metrics && metrics.duplicatesPerSec > 0 ? 'ACTIVE' : 'idle'}
            tone={metrics && metrics.duplicatesPerSec > 0 ? 'ok' : undefined}
          />
        </div>
        <Foot>Relays keep the origin (senderId, seq); duplicates drop so multi-hop can't loop.</Foot>
      </Section>

      {/* Channel model — the inputs. */}
      <Section label="Channel model">
        <label className="range">
          <span className="range-name">Range</span>
          <input
            type="range"
            min={30}
            max={160}
            step={1}
            value={channelRange}
            onChange={(e) => onRangeChange(Number(e.target.value))}
          />
          <span className="range-value mono">
            {channelRange}
            <span className="unit">m</span>
          </span>
        </label>
        <dl className="rows">
          <Row k="Base delay" v={`${CHANNEL.BASE_DELAY_MS} ms`} />
          <Row k="Jitter" v={`0–${CHANNEL.JITTER_MS} ms`} />
          <Row k="Loss @ 0 m" v={`${(CHANNEL.LOSS_AT_ZERO_M * 100).toFixed(0)} %`} />
          <Row k="Loss @ range" v={`${(CHANNEL.LOSS_AT_RANGE_M * 100).toFixed(0)} %`} />
        </dl>
      </Section>

      {/* Edge node / RSU. */}
      <Section label="Edge node" tail="RSU">
        <dl className="rows">
          <Row k="Connected" v={String(edgeStats.connected)} />
          <Row k="Density" v={`${edgeStats.density} · ${edgeStats.densityPerKm.toFixed(0)}/km`} />
          <Row k="Avg speed" v={`${edgeStats.avgSpeedMps.toFixed(1)} m/s`} />
          <Row
            k="Congestion"
            v={edgeStats.congestion ? 'DETECTED' : 'clear'}
            tone={edgeStats.congestion ? 'danger' : 'ok'}
          />
        </dl>
        <Foot>Observes only — nothing it computes reaches a braking decision.</Foot>
      </Section>

      {/* Priority 6 — selected vehicle risk. */}
      <Section label="Selected vehicle">
        {selected ? (
          <>
            <div className="sel-head">
              <span className="sel-id mono">{selected.id}</span>
              <RiskBadge level={selected.riskLevel} />
            </div>
            <div className="stat-grid">
              <Stat
                label="TTC"
                value={selected.ttc !== null ? selected.ttc.toFixed(2) : '∞'}
                unit={selected.ttc !== null ? 's' : undefined}
                tone={riskToneName(selected.riskLevel)}
              />
              <Stat
                label="Safe dist"
                value={selected.dSafe.toFixed(0)}
                unit="m"
                tone={selected.insideSafe ? 'warn' : 'ok'}
              />
            </div>
            <Foot>
              {selected.gap !== null
                ? `gap ${selected.gap.toFixed(0)} m · ${selected.insideSafe ? 'inside safe distance' : 'outside safe distance'}`
                : 'no closing threat ahead'}
            </Foot>

            <div className="sub-divider">
              <span className="sub-label">Link</span>
              {selected.inRange === 0 ? (
                <span className="tag tag-danger">OUT OF RANGE</span>
              ) : (
                <span className="tag tag-signal">{selected.inRange} in range</span>
              )}
            </div>
            <div className="stat-grid">
              <Stat label="Link PRR" value={pct(selected.link.prr)} unit="%" tone={prrTone(selected.link.prr)} />
              <Stat label="Link p50" value={ms(selected.link.latP50)} unit="ms" />
            </div>
            <Foot>
              {selected.link.attempts === 0
                ? 'no beacons reaching this vehicle'
                : `${selected.link.delivered}/${selected.link.attempts} beacons received`}
            </Foot>

            <div className="model-head">
              <span>
                World model · knows <span className="mono">{selected.known.length}</span>
              </span>
              <span className="model-legend">
                <i className="legend-swatch legend-direct" />direct
                <i className="legend-swatch legend-relayed" />relay
              </span>
            </div>
            <div className="chip-row">
              {selected.known.length === 0 ? (
                <span className="hint">world model empty</span>
              ) : (
                [...selected.known]
                  .sort((a, b) => a.hops - b.hops || a.id.localeCompare(b.id))
                  .map((k) => (
                    <span key={k.id} className={`chip mono ${k.hops === 0 ? 'chip-direct' : 'chip-relayed'}`}>
                      {k.id}
                      {k.hops > 0 && <span className="chip-hops">{k.hops}h</span>}
                    </span>
                  ))
              )}
            </div>
          </>
        ) : (
          <p className="hint">
            Click a vehicle on the feed to inspect it. Solid links are heard
            directly; dashed links reach cars beyond range via multi-hop relay.
            Drag it toward the range edge to watch its link PRR fall.
          </p>
        )}
      </Section>
    </aside>
  );
}

/* ---- building blocks ---------------------------------------------------- */

function Section(props: { label: string; tail?: string; children: ReactNode }) {
  return (
    <section className="rail-section">
      <div className="rail-label">
        {props.label}
        {props.tail && <span className="rail-label-tail">{props.tail}</span>}
      </div>
      {props.children}
    </section>
  );
}

function Stat(props: { label: string; value: string; unit?: string; tone?: Tone }) {
  return (
    <div className="stat">
      <div className="stat-label">{props.label}</div>
      <div className={`stat-value mono${props.tone ? ` t-${props.tone}` : ''}`}>
        {props.value}
        {props.unit && <span className="unit">{props.unit}</span>}
      </div>
    </div>
  );
}

function Row(props: { k: string; v: string; tone?: Tone }) {
  return (
    <div className="row">
      <dt>{props.k}</dt>
      <dd className={`mono${props.tone ? ` t-${props.tone}` : ''}`}>{props.v}</dd>
    </div>
  );
}

function Foot(props: { children: ReactNode }) {
  return <p className="foot mono">{props.children}</p>;
}

function RiskBadge({ level }: { level: RiskLevel }) {
  const tone = riskToneName(level);
  const Icon = level === 'SAFE' ? IconCheck : IconAlert;
  return (
    <span className={`rbadge rbadge-${tone}`}>
      <Icon size={12} />
      {level}
    </span>
  );
}

type Tone = 'ok' | 'warn' | 'danger';

function prrTone(prr: number | undefined): Tone | undefined {
  if (prr == null) return undefined;
  if (prr >= 0.9) return 'ok';
  if (prr >= 0.7) return 'warn';
  return 'danger';
}

function lossTone(loss: number | undefined): Tone | undefined {
  if (loss == null) return undefined;
  if (loss <= 0.1) return 'ok';
  if (loss <= 0.3) return 'warn';
  return 'danger';
}

function riskToneName(level: RiskLevel): Tone {
  return level === 'DANGER' ? 'danger' : level === 'WARNING' ? 'warn' : 'ok';
}
