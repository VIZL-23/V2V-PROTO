/**
 * RSU / edge node (workflow doc §3, §5) — a PARALLEL OBSERVER.
 *
 * It taps the channel to build an aggregate picture of the road: how many
 * vehicles are connected, how dense the traffic is, whether it's congested.
 * Read the arrows in §3 carefully: nothing the RSU computes ever returns to a
 * vehicle's braking decision. It sits beside the safety loop, not inside it —
 * which is exactly why the system stays decentralized.
 *
 * (For the prototype it aggregates from the vehicles within its range each
 * tick; that models what it would learn from their CAM beacons. It is display
 * only, never a safety input, so this shortcut doesn't touch the thesis.)
 */

import { RSU } from '../sim/config';
import type { Vehicle } from '../sim/vehicle';

export type Density = 'LOW' | 'MED' | 'HIGH';

export interface EdgeStats {
  connected: number;
  densityPerKm: number;
  density: Density;
  avgSpeedMps: number;
  congestion: boolean;
}

export class Rsu {
  readonly x: number;
  readonly y: number;
  readonly rangeM: number;

  constructor(x: number, y: number, rangeM: number) {
    this.x = x;
    this.y = y;
    this.rangeM = rangeM;
  }

  observe(vehicles: Vehicle[]): EdgeStats {
    let connected = 0;
    let sumSpeed = 0;
    let stopped = false;
    for (const v of vehicles) {
      if (Math.hypot(v.x - this.x, v.y - this.y) <= this.rangeM) {
        connected++;
        sumSpeed += v.vel;
        if (v.vel < RSU.STOPPED_SPEED_MPS) stopped = true;
      }
    }
    const avgSpeedMps = connected > 0 ? sumSpeed / connected : 0;
    const spanKm = (2 * this.rangeM) / 1000;
    const densityPerKm = spanKm > 0 ? connected / spanKm : 0;

    const density: Density =
      densityPerKm < RSU.DENSITY_LOW_PER_KM
        ? 'LOW'
        : densityPerKm < RSU.DENSITY_HIGH_PER_KM
        ? 'MED'
        : 'HIGH';

    // Congestion: the corridor is crawling on average, OR a vehicle has come to
    // a stop in coverage (an incident the RSU should surface).
    const congestion =
      connected > 0 && (avgSpeedMps < RSU.CONGESTION_SPEED_MPS || stopped);

    return { connected, densityPerKm, density, avgSpeedMps, congestion };
  }
}
