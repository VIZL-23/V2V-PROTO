/**
 * Vehicle — a single vehicle's OWN state.
 *
 * Design rule (from the workflow doc):
 *   - Each vehicle knows ONLY about itself.
 *   - Its inbox is filled by the Channel, NOT by reading the global vehicle
 *     array. In Phase 3 the inbox drives a per-vehicle world model + risk.
 *   - Phase 2: the vehicle emits CAM beacons and receives others' beacons
 *     through the channel, but does not yet act on them.
 *
 * Units: METRES, SECONDS, RADIANS.
 */

import { MSG } from './config';
import type { V2VMessage } from './message';

export type VehicleStatus = 'NORMAL' | 'WARNING' | 'EMERGENCY';

export interface VehicleInit {
  id: string;
  x: number;         // metres, along the road (0 = start)
  y: number;         // metres, across the road (0 = top shoulder)
  vel: number;       // m/s, forward along heading
  accel: number;     // m/s², forward along heading (0 = cruising)
  heading: number;   // radians. 0 = +x (east / down-the-road).
}

export class Vehicle {
  readonly id: string;
  x: number;
  y: number;
  vel: number;
  accel: number;
  heading: number;
  status: VehicleStatus = 'NORMAL';

  /** Messages delivered by the Channel. The vehicle's only window on the world. */
  inbox: V2VMessage[] = [];

  /** Per-sender sequence counter → dedupe key with id (see message.ts). */
  private seq = 0;

  /** Sim clock of the last CAM beacon this vehicle sent. */
  lastBeaconMs = -Infinity;

  /** When true, the user is dragging this car: skip physics integration. */
  held = false;

  constructor(init: VehicleInit) {
    this.id = init.id;
    this.x = init.x;
    this.y = init.y;
    this.vel = init.vel;
    this.accel = init.accel;
    this.heading = init.heading;
  }

  /** Build a CAM (cooperative awareness) beacon describing this vehicle now. */
  makeCam(nowMs: number): V2VMessage {
    return {
      senderId: this.id,
      seq: this.seq++,
      type: 'CAM',
      sentAt: nowMs,
      ttl: MSG.DEFAULT_TTL,
      pos: { x: this.x, y: this.y },
      vel: this.vel,
      accel: this.accel,
      heading: this.heading,
    };
  }

  /**
   * Integrate physics for one fixed timestep.
   *
   * We use semi-implicit Euler:
   *   v ← v + a·dt
   *   x ← x + v·dt·cos(heading)
   *   y ← y + v·dt·sin(heading)
   *
   * This is stable enough for a driving sim at 50ms steps.
   */
  step(dtSec: number): void {
    // While the user is dragging this car, its position is set by the mouse.
    if (this.held) return;

    // Update velocity from acceleration.
    this.vel += this.accel * dtSec;

    // Prevent negative velocity for now (a braking vehicle stops, doesn't reverse).
    if (this.vel < 0) {
      this.vel = 0;
      // Once stopped, cancel further deceleration.
      if (this.accel < 0) this.accel = 0;
    }

    // Integrate position.
    this.x += this.vel * dtSec * Math.cos(this.heading);
    this.y += this.vel * dtSec * Math.sin(this.heading);
  }

  /** Snapshot for rendering / logging. Keep this cheap — it's called every frame. */
  snapshot() {
    return {
      id: this.id,
      x: this.x,
      y: this.y,
      vel: this.vel,
      accel: this.accel,
      heading: this.heading,
      status: this.status,
    };
  }
}
