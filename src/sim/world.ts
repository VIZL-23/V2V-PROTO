/**
 * World — owns the simulation.
 *
 * Key architectural rules (from the workflow doc):
 *
 *  1. FIXED SIMULATION TIMESTEP (SIM.STEP_MS).
 *     step() advances physics by exactly STEP_MS. The rAF loop in the UI
 *     accumulates real elapsed time and calls step() as many times as needed.
 *     This means TTC, latency, and every metric are independent of the
 *     viewer's monitor / tab focus / laptop power state.
 *
 *  2. SIM CLOCK, NOT Date.now().
 *     `simClockMs` is the ONLY time source for anything in sim/.
 *     Pausing doesn't create phantom time. Resetting resets time to 0.
 *
 *  3. SEEDED PRNG.
 *     Same seed → identical run. This is the Phase 1 done-criterion.
 *
 *  4. NO REACT STATE in here. The UI holds the World in a useRef and
 *     subscribes to snapshots on a throttled clock.
 */

import { Rng } from './rng';
import { Vehicle } from './vehicle';
import { Metrics } from './metrics';
import { Channel } from '../channel/channel';
import { CHANNEL, MSG, ROAD, SIM, VEHICLE } from './config';

export interface WorldOptions {
  seed: number;
  vehicleCount: number;
}

/**
 * Derive the channel's RNG seed from the world seed. A separate stream keeps
 * spawn randomness and channel randomness independent, while a single user
 * seed still reproduces the entire run.
 */
function channelSeed(worldSeed: number): number {
  return (worldSeed ^ 0x9e3779b9) >>> 0;
}

export class World {
  vehicles: Vehicle[] = [];
  simClockMs = 0;
  tickCount = 0;

  /** Real channel + real metrics (Phase 2). */
  readonly metrics = new Metrics();
  readonly channel: Channel;

  private readonly seed: number;
  private readonly vehicleCount: number;
  private rng: Rng;

  constructor(opts: WorldOptions) {
    this.seed = opts.seed;
    this.vehicleCount = opts.vehicleCount;
    this.rng = new Rng(this.seed);
    this.channel = new Channel(
      channelSeed(this.seed),
      {
        rangeM: CHANNEL.RANGE_M,
        baseDelayMs: CHANNEL.BASE_DELAY_MS,
        jitterMs: CHANNEL.JITTER_MS,
        lossAtZeroM: CHANNEL.LOSS_AT_ZERO_M,
        lossAtRangeM: CHANNEL.LOSS_AT_RANGE_M,
      },
      this.metrics
    );
    this.spawn();
  }

  /**
   * Reset back to t=0 with the same seed → identical spawn positions
   * and identical initial velocities. This is what makes "reset produces
   * the identical run twice" work.
   */
  reset(): void {
    this.simClockMs = 0;
    this.tickCount = 0;
    this.rng = new Rng(this.seed);
    this.metrics.reset();
    this.channel.reset();
    this.vehicles = [];
    this.spawn();
  }

  /** Advance sim by exactly one fixed step. */
  step(): void {
    const dtSec = SIM.STEP_MS / 1000;

    // 1. Physics — each vehicle integrates its own state only.
    for (const v of this.vehicles) {
      v.step(dtSec);
      // Wrap around the road so cars don't drive off the end in Phase 1.
      // (Later phases will use a longer road and interactive traffic.)
      if (v.x > ROAD.LENGTH_M) {
        v.x -= ROAD.LENGTH_M;
      } else if (v.x < 0) {
        v.x += ROAD.LENGTH_M;
      }
    }

    this.simClockMs += SIM.STEP_MS;
    this.tickCount += 1;
    const now = this.simClockMs;

    // 2. CAM beacons — each vehicle broadcasts through the CHANNEL on its
    //    own cadence. This is what generates real latency/PRR measurements.
    for (const v of this.vehicles) {
      if (now - v.lastBeaconMs >= MSG.BEACON_INTERVAL_MS) {
        v.lastBeaconMs = now;
        this.channel.broadcast(v, v.makeCam(now), this.vehicles, now);
      }
    }

    // 3. Deliver any messages whose (delayed) arrival time has come.
    this.channel.deliverDue(now);

    // 4. Protocol: each vehicle processes its OWN inbox — dedupe, update its
    //    local world model, and emit relay copies (multi-hop). A vehicle never
    //    reads the global array here; it only sees what it received.
    let dupCount = 0;
    let fwdCount = 0;
    let maxHops = 0;
    const relays: { from: Vehicle; msg: ReturnType<Vehicle['makeCam']> }[] = [];
    for (const v of this.vehicles) {
      const r = v.process(now);
      dupCount += r.duplicates;
      fwdCount += r.forwards.length;
      if (r.maxHops > maxHops) maxHops = r.maxHops;
      for (const m of r.forwards) relays.push({ from: v, msg: m });
    }
    // Re-broadcast relays AFTER all inboxes are processed, so a forwarded copy
    // is delivered on a later tick — each hop genuinely costs channel time.
    for (const { from, msg } of relays) {
      this.channel.broadcast(from, msg, this.vehicles, now);
    }
    this.metrics.recordProtocol(now, dupCount, fwdCount, maxHops);

    // 5. Age out old metric samples so the panel reads "live".
    this.metrics.prune(now);
  }

  /**
   * Nearest vehicle to a point (metres), within `radiusM`. For click-to-select
   * and drag. Returns null if nothing is close enough.
   */
  pickVehicleAt(xM: number, yM: number, radiusM: number): Vehicle | null {
    let best: Vehicle | null = null;
    let bestD = radiusM;
    for (const v of this.vehicles) {
      const d = Math.hypot(v.x - xM, v.y - yM);
      if (d <= bestD) {
        bestD = d;
        best = v;
      }
    }
    return best;
  }

  findVehicle(id: string): Vehicle | undefined {
    return this.vehicles.find((v) => v.id === id);
  }

  /** How many other vehicles are within the current channel range of `id`. */
  inRangeCount(id: string): number {
    const self = this.findVehicle(id);
    if (!self) return 0;
    const r = this.channel.cfg.rangeM;
    let n = 0;
    for (const v of this.vehicles) {
      if (v === self) continue;
      if (Math.hypot(v.x - self.x, v.y - self.y) <= r) n++;
    }
    return n;
  }

  /**
   * Spawn vehicles evenly along the road, distributed across lanes.
   * Uses the seeded RNG so this is deterministic.
   */
  private spawn(): void {
    const n = this.vehicleCount;
    // Lane centres (y-coordinates), skipping the shoulder.
    const laneCenters: number[] = [];
    for (let i = 0; i < ROAD.LANES; i++) {
      laneCenters.push(
        ROAD.SHOULDER_M + ROAD.LANE_WIDTH_M / 2 + i * ROAD.LANE_WIDTH_M
      );
    }

    // Space vehicles apart along x.
    const spacing = ROAD.LENGTH_M / n;

    for (let i = 0; i < n; i++) {
      const laneIdx = this.rng.intRange(0, ROAD.LANES - 1);
      const y = laneCenters[laneIdx];
      // Small jitter within the lane so it doesn't look mechanical.
      const yJitter = this.rng.range(-0.15, 0.15);

      const x = i * spacing + this.rng.range(-1.5, 1.5);
      const vel = this.rng.range(VEHICLE.CRUISE_MIN_MPS, VEHICLE.CRUISE_MAX_MPS);

      this.vehicles.push(
        new Vehicle({
          id: `V${i + 1}`,
          x: this.wrapX(x),
          y: y + yJitter,
          vel,
          accel: 0,
          heading: 0, // 0 rad = travelling in +x direction
        })
      );
    }
  }

  private wrapX(x: number): number {
    while (x < 0) x += ROAD.LENGTH_M;
    while (x >= ROAD.LENGTH_M) x -= ROAD.LENGTH_M;
    return x;
  }
}
