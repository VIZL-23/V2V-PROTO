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
import { ROAD, SIM, VEHICLE } from './config';

export interface WorldOptions {
  seed: number;
  vehicleCount: number;
}

export class World {
  vehicles: Vehicle[] = [];
  simClockMs = 0;
  tickCount = 0;

  private readonly seed: number;
  private readonly vehicleCount: number;
  private rng: Rng;

  constructor(opts: WorldOptions) {
    this.seed = opts.seed;
    this.vehicleCount = opts.vehicleCount;
    this.rng = new Rng(this.seed);
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
    this.vehicles = [];
    this.spawn();
  }

  /** Advance sim by exactly one fixed step. */
  step(): void {
    const dtSec = SIM.STEP_MS / 1000;
    for (const v of this.vehicles) {
      v.step(dtSec);
      // Wrap around the road so cars don't drive off the end in Phase 1.
      // (Later phases will use a longer road and interactive traffic.)
      if (v.x > ROAD.LENGTH_M) {
        v.x -= ROAD.LENGTH_M;
      }
    }
    this.simClockMs += SIM.STEP_MS;
    this.tickCount += 1;
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
