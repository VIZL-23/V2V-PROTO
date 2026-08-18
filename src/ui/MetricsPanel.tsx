/**
 * MetricsPanel — the "SYSTEM STATUS" side panel (workflow doc §2).
 *
 * Every value shown here is a real measurement pulled from the simulation's
 * Metrics on a throttled 10 Hz subscription (see App.tsx). Nothing is typed in.
 *
 * The "Selected link" block is what makes the Phase 2 done-criterion legible:
 * click a car, drag it toward the edge of range, and watch ITS packet-reception
 * ratio fall as distance-dependent loss climbs — then read OUT OF RANGE when it
 * crosses the ring.
 */

import { CHANNEL } from '../sim/config';
import type { LinkSnapshot, MetricsSnapshot } from '../sim/metrics';

interface KnownPeer {
  id: string;
  hops: number;
}

interface SelectedInfo {
  id: string;
  inRange: number;
  link: LinkSnapshot;
  /** The selected vehicle's local world model — who it has heard, and how. */
  known: KnownPeer[];
}

interface MetricsPanelProps {
  metrics: MetricsSnapshot | null;
  channelRange: number;
  onRangeChange: (m: number) => void;
  selected: SelectedInfo | null;
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const ms = (x: number) => `${x.toFixed(1)} ms`;

export function MetricsPanel(props: MetricsPanelProps) {
  const { metrics, channelRange, onRangeChange, selected } = props;

  return (
    <aside className="sidebar">
      <section className="panel">
        <h2 className="panel-title">System status</h2>

        <div className="metric-grid">
          <Metric label="Latency p50" value={metrics ? ms(metrics.latP50) : '—'} />
          <Metric label="Latency p95" value={metrics ? ms(metrics.latP95) : '—'} accent />
          <Metric label="PRR" value={metrics ? pct(metrics.prr) : '—'} tone={prrTone(metrics?.prr)} />
          <Metric label="Packet loss" value={metrics ? pct(metrics.loss) : '—'} tone={lossTone(metrics?.loss)} />
        </div>

        <div className="metric-sub">
          {metrics
            ? `${metrics.delivered}/${metrics.attempts} delivered · ${metrics.deliveredPerSec.toFixed(0)} msg/s · ${(metrics.windowMs / 1000).toFixed(0)}s window`
            : 'waiting for traffic…'}
        </div>
      </section>

      <section className="panel">
        <h2 className="panel-title">Protocol · decentralized</h2>
        <div className="metric-grid">
          <Metric label="Relays /s" value={metrics ? metrics.forwardedPerSec.toFixed(0) : '—'} />
          <Metric label="Max hops" value={metrics ? String(metrics.maxHops) : '—'} accent />
          <Metric
            label="Dupes rejected /s"
            value={metrics ? metrics.duplicatesPerSec.toFixed(0) : '—'}
            tone="tone-ok"
          />
          <Metric
            label="Dedupe"
            value={metrics && metrics.duplicatesPerSec > 0 ? 'ACTIVE' : '—'}
            tone="tone-ok"
          />
        </div>
        <div className="metric-sub">
          Every relay keeps the origin's (senderId, seq); duplicates are dropped so
          multi-hop can't loop.
        </div>
      </section>

      <section className="panel">
        <h2 className="panel-title">Channel model</h2>

        <div className="control-group range-control">
          <label htmlFor="range">Range</label>
          <input
            id="range"
            type="range"
            min={30}
            max={160}
            step={1}
            value={channelRange}
            onChange={(e) => onRangeChange(Number(e.target.value))}
          />
          <span className="control-value">{channelRange} m</span>
        </div>

        <dl className="param-list">
          <div><dt>Base delay</dt><dd>{CHANNEL.BASE_DELAY_MS} ms</dd></div>
          <div><dt>Jitter</dt><dd>0–{CHANNEL.JITTER_MS} ms</dd></div>
          <div><dt>Loss @ 0 m</dt><dd>{pct(CHANNEL.LOSS_AT_ZERO_M)}</dd></div>
          <div><dt>Loss @ range</dt><dd>{pct(CHANNEL.LOSS_AT_RANGE_M)}</dd></div>
        </dl>
      </section>

      <section className="panel">
        <h2 className="panel-title">Selected link</h2>
        {selected ? (
          <>
            <div className="sel-head">
              <span className="sel-id">{selected.id}</span>
              {selected.inRange === 0 ? (
                <span className="badge badge-danger">OUT OF RANGE</span>
              ) : (
                <span className="badge badge-ok">{selected.inRange} in range</span>
              )}
            </div>
            <div className="metric-grid">
              <Metric label="Link PRR" value={pct(selected.link.prr)} tone={prrTone(selected.link.prr)} />
              <Metric label="Link p50" value={ms(selected.link.latP50)} />
            </div>
            <div className="metric-sub">
              {selected.link.attempts === 0
                ? 'no beacons reaching this vehicle'
                : `${selected.link.delivered}/${selected.link.attempts} beacons received`}
            </div>

            <div className="model-head">
              Knows {selected.known.length} vehicle{selected.known.length === 1 ? '' : 's'}
              <span className="model-legend">
                <i className="dot dot-direct" /> direct
                <i className="dot dot-relayed" /> relayed
              </span>
            </div>
            <div className="chip-row">
              {selected.known.length === 0 ? (
                <span className="hint">world model empty</span>
              ) : (
                [...selected.known]
                  .sort((a, b) => a.hops - b.hops || a.id.localeCompare(b.id))
                  .map((k) => (
                    <span key={k.id} className={`chip ${k.hops === 0 ? 'chip-direct' : 'chip-relayed'}`}>
                      {k.id}
                      {k.hops > 0 && <span className="chip-hops">{k.hops}h</span>}
                    </span>
                  ))
              )}
            </div>
          </>
        ) : (
          <p className="hint">
            Click a car to select it. Green links are cars it hears directly;
            amber links reach cars beyond its range via multi-hop relay. Drag it
            toward the ring edge to watch its link PRR fall as loss climbs.
          </p>
        )}
      </section>
    </aside>
  );
}

function Metric(props: { label: string; value: string; accent?: boolean; tone?: string }) {
  return (
    <div className={`metric-tile${props.accent ? ' metric-accent' : ''}`}>
      <div className="metric-label">{props.label}</div>
      <div className={`metric-value${props.tone ? ` ${props.tone}` : ''}`}>{props.value}</div>
    </div>
  );
}

function prrTone(prr: number | undefined): string {
  if (prr == null) return '';
  if (prr >= 0.9) return 'tone-ok';
  if (prr >= 0.7) return 'tone-warn';
  return 'tone-danger';
}

function lossTone(loss: number | undefined): string {
  if (loss == null) return '';
  if (loss <= 0.1) return 'tone-ok';
  if (loss <= 0.3) return 'tone-warn';
  return 'tone-danger';
}
