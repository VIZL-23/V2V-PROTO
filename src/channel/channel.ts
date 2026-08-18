/**
 * Channel model (workflow doc §6) — the module that turns "18 ms" from a
 * decoration into a measurement.
 *
 * When a vehicle broadcasts, the message does NOT arrive as a plain function
 * call. It passes through here:
 *
 *     for each other vehicle Vx:
 *       d = distance(sender, Vx)
 *       if d > range           → out of range   (not counted for PRR)
 *       p_loss = lerp(lossAtZero, lossAtRange, d/range)
 *       if rand() < p_loss     → dropped         (counts against PRR)
 *       delay = baseDelay + rand()*jitter
 *       schedule Vx.inbox.push(msg) at t + delay
 *
 * Determinism: the channel owns its OWN seeded RNG stream, separate from the
 * spawn RNG. Same seed → same loss/jitter rolls → same run. This is what makes
 * the Phase 5 edge-vs-cloud comparison a controlled experiment rather than two
 * different random worlds.
 */

import { Rng } from '../sim/rng';
import type { Vehicle } from '../sim/vehicle';
import type { V2VMessage } from '../sim/message';
import type { Metrics } from '../sim/metrics';

export interface ChannelConfig {
  rangeM: number;
  baseDelayMs: number;
  jitterMs: number;
  lossAtZeroM: number; // p(loss) at d = 0
  lossAtRangeM: number; // p(loss) at d = rangeM
}

interface Queued {
  deliverAt: number; // sim clock, ms
  to: Vehicle;
  msg: V2VMessage;
}

export class Channel {
  /** Live-tunable in the UI (range slider). Mutating rangeM is safe. */
  cfg: ChannelConfig;

  private rng: Rng;
  private queue: Queued[] = [];
  private readonly metrics: Metrics;
  private readonly seed: number;

  constructor(seed: number, cfg: ChannelConfig, metrics: Metrics) {
    this.seed = seed;
    this.rng = new Rng(seed);
    this.cfg = cfg;
    this.metrics = metrics;
  }

  /** Re-seed to the same stream and clear in-flight messages (on world reset). */
  reset(): void {
    this.rng = new Rng(this.seed);
    this.queue = [];
  }

  /**
   * Broadcast one message from `sender` to every OTHER vehicle. In-range
   * receivers get a loss roll and, if they survive it, a delayed delivery.
   *
   * `vehicles` is iterated in a fixed order, so RNG consumption is
   * deterministic for a given geometry and seed.
   */
  broadcast(sender: Vehicle, msg: V2VMessage, vehicles: Vehicle[], now: number): void {
    const { rangeM, baseDelayMs, jitterMs, lossAtZeroM, lossAtRangeM } = this.cfg;

    for (const v of vehicles) {
      if (v === sender) continue;

      const d = distance(sender, v);
      if (d > rangeM) continue; // out of range → not an in-range receiver

      const pLoss = lerp(lossAtZeroM, lossAtRangeM, d / rangeM);
      if (this.rng.next() < pLoss) {
        this.metrics.record(now, v.id, false, 0); // dropped: counts against PRR
        continue;
      }

      const delay = baseDelayMs + this.rng.next() * jitterMs;
      this.metrics.record(now, v.id, true, delay); // latency = receivedAt − sentAt
      this.queue.push({ deliverAt: now + delay, to: v, msg });
    }
  }

  /** Deliver every message whose scheduled time has arrived. */
  deliverDue(now: number): void {
    if (this.queue.length === 0) return;
    const still: Queued[] = [];
    for (const q of this.queue) {
      if (q.deliverAt <= now) {
        q.to.inbox.push(q.msg);
      } else {
        still.push(q);
      }
    }
    this.queue = still;
  }
}

function distance(a: Vehicle, b: Vehicle): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function lerp(a: number, b: number, t: number): number {
  const tc = t < 0 ? 0 : t > 1 ? 1 : t;
  return a + (b - a) * tc;
}
