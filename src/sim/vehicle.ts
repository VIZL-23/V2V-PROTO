/**
 * Vehicle — a single vehicle's OWN state.
 *
 * Design rule (from the workflow doc):
 *   - Each vehicle knows ONLY about itself.
 *   - In Phase 3 we'll add an inbox; each vehicle's world model is built
 *     from received messages, NOT by reading the global vehicle array.
 *   - Phase 1: no inter-vehicle interaction yet. Just physics.
 *
 * Units: METRES, SECONDS, RADIANS.
 */

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

  constructor(init: VehicleInit) {
    this.id = init.id;
    this.x = init.x;
    this.y = init.y;
    this.vel = init.vel;
    this.accel = init.accel;
    this.heading = init.heading;
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
