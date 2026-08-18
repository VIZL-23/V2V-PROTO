/**
 * Metrics — real measurements of the channel model (workflow doc §10).
 *
 * NOTHING here is typed into the UI. Every number is computed from actual
 * delivery attempts through the Channel. The panel just displays snapshots.
 *
 * We keep a rolling window (CHANNEL.METRICS_WINDOW_MS) of per-attempt records
 * so the figures feel "live": pull a car toward the edge of range and its
 * link quality visibly degrades within a couple of seconds, because older
 * good samples age out of the window.
 *
 * Definitions (doc §10):
 *   Latency  = receivedAt − sentAt  → reported as p50 / p95 (the tail matters)
 *   PRR      = delivered ÷ in-range receivers   (out-of-range never counted)
 *   Loss     = 1 − PRR
 */

import { CHANNEL } from './config';
import type { VehicleId } from './message';

/**
 * One delivery attempt to one in-range receiver. Recorded at send time —
 * loss is rolled and delay is drawn then, so latencyMs (for delivered ones)
 * is exactly receivedAt − sentAt.
 */
interface Attempt {
  t: number; // sim clock at send, ms
  receiverId: VehicleId;
  delivered: boolean;
  latencyMs: number; // meaningful only when delivered
}

export interface MetricsSnapshot {
  attempts: number; // in-range delivery attempts in window
  delivered: number;
  dropped: number;
  prr: number; // 0..1
  loss: number; // 0..1
  latP50: number; // ms
  latP95: number; // ms
  deliveredPerSec: number;
  windowMs: number;
  // Phase 3 — protocol layer
  forwardedPerSec: number; // multi-hop relays emitted
  duplicatesPerSec: number; // messages rejected by dedupe
  maxHops: number; // deepest relay observed in window
}

/** One tick's protocol activity (aggregated across all vehicles). */
interface ProtoTick {
  t: number;
  dup: number;
  fwd: number;
  hops: number;
}

/** Per-vehicle link quality, for the "drag a car out of range" demo. */
export interface LinkSnapshot {
  attempts: number;
  delivered: number;
  prr: number; // 0..1 (NaN-safe: 0 when no attempts)
  latP50: number;
}

export class Metrics {
  private events: Attempt[] = [];
  private proto: ProtoTick[] = [];
  private readonly windowMs = CHANNEL.METRICS_WINDOW_MS;

  reset(): void {
    this.events = [];
    this.proto = [];
  }

  /** Record one in-range attempt (delivered or dropped by loss). */
  record(t: number, receiverId: VehicleId, delivered: boolean, latencyMs: number): void {
    this.events.push({ t, receiverId, delivered, latencyMs });
  }

  /** Record one tick's aggregate protocol activity. */
  recordProtocol(t: number, dup: number, fwd: number, maxHops: number): void {
    this.proto.push({ t, dup, fwd, hops: maxHops });
  }

  /** Drop records older than the rolling window. Called once per tick. */
  prune(now: number): void {
    const cutoff = now - this.windowMs;
    let i = 0;
    while (i < this.events.length && this.events[i].t < cutoff) i++;
    if (i > 0) this.events.splice(0, i);
    let j = 0;
    while (j < this.proto.length && this.proto[j].t < cutoff) j++;
    if (j > 0) this.proto.splice(0, j);
  }

  /** Global channel metrics over the current window. */
  snapshot(): MetricsSnapshot {
    const ev = this.events;
    let delivered = 0;
    const lat: number[] = [];
    for (const e of ev) {
      if (e.delivered) {
        delivered++;
        lat.push(e.latencyMs);
      }
    }
    const attempts = ev.length;
    const dropped = attempts - delivered;
    const prr = attempts === 0 ? 1 : delivered / attempts;

    let dup = 0;
    let fwd = 0;
    let maxHops = 0;
    for (const p of this.proto) {
      dup += p.dup;
      fwd += p.fwd;
      if (p.hops > maxHops) maxHops = p.hops;
    }
    const perSec = this.windowMs / 1000;

    return {
      attempts,
      delivered,
      dropped,
      prr,
      loss: 1 - prr,
      latP50: percentile(lat, 0.5),
      latP95: percentile(lat, 0.95),
      deliveredPerSec: delivered / perSec,
      windowMs: this.windowMs,
      forwardedPerSec: fwd / perSec,
      duplicatesPerSec: dup / perSec,
      maxHops,
    };
  }

  /** Link quality for messages received BY one vehicle. */
  snapshotFor(receiverId: VehicleId): LinkSnapshot {
    let attempts = 0;
    let delivered = 0;
    const lat: number[] = [];
    for (const e of this.events) {
      if (e.receiverId !== receiverId) continue;
      attempts++;
      if (e.delivered) {
        delivered++;
        lat.push(e.latencyMs);
      }
    }
    return {
      attempts,
      delivered,
      prr: attempts === 0 ? 0 : delivered / attempts,
      latP50: percentile(lat, 0.5),
    };
  }
}

/** Nearest-rank percentile over an unsorted sample. Returns 0 for empty. */
function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[idx];
}
