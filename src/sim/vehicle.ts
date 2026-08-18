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

import { MSG, RISK } from './config';
import type { V2VMessage } from './message';
import {
  processInbox,
  pruneProtocol,
  type ProcessResult,
  type SeenSet,
  type WorldModel,
} from '../protocol/protocol';
import { assessRisk, type RiskLevel } from '../risk/risk';

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

  /** Dedupe memory: (senderId:seq) → sim clock last seen. Pruned by age. */
  readonly seen: SeenSet = new Map();

  /**
   * Local world model — what THIS vehicle believes about others, built only
   * from received messages. It never reads the global vehicle array. This map
   * is the concrete form of "decentralized".
   */
  readonly worldModel: WorldModel = new Map();

  /** Per-sender sequence counter → dedupe key with id (see message.ts). */
  private seq = 0;

  /** Sim clock of the last CAM beacon this vehicle sent. */
  lastBeaconMs = -Infinity;

  /** When true, the user is dragging this car: skip physics integration. */
  held = false;

  // --- Risk state (Phase 4), computed from the world model each tick ---------
  riskLevel: RiskLevel = 'SAFE';
  ttc: number | null = null; // seconds to worst threat ahead
  threatId: string | null = null;
  gap: number | null = null; // metres to that threat
  dSafe = 0; // RSS-lite safe distance
  insideSafe = false;

  /** Speed this vehicle wants to hold when the road ahead is clear. */
  desiredVel: number;

  /** Set by the 🚨 emergency trigger: this car brakes hard and broadcasts it. */
  manualBrake = false;

  constructor(init: VehicleInit) {
    this.id = init.id;
    this.x = init.x;
    this.y = init.y;
    this.vel = init.vel;
    this.accel = init.accel;
    this.heading = init.heading;
    this.desiredVel = init.vel;
  }

  /** Build a CAM (cooperative awareness) beacon describing this vehicle now. */
  makeCam(nowMs: number): V2VMessage {
    const msg: V2VMessage = {
      senderId: this.id,
      seq: this.seq++,
      // A hard-braking vehicle flags its telemetry as an emergency so the log
      // and visuals can single it out. Followers react to the kinematics either
      // way, but the type marks the origin of the cascade.
      type: this.manualBrake ? 'EMERGENCY_BRAKING' : 'CAM',
      sentAt: nowMs,
      ttl: MSG.DEFAULT_TTL,
      pos: { x: this.x, y: this.y },
      vel: this.vel,
      accel: this.accel,
      heading: this.heading,
    };
    // Remember our own message so relays of it don't come back and re-forward.
    this.seen.set(`${msg.senderId}:${msg.seq}`, nowMs);
    return msg;
  }

  /**
   * Process everything delivered since last tick: dedupe, learn, and produce
   * relay messages. Clears the inbox and ages out stale protocol state.
   */
  process(nowMs: number): ProcessResult {
    const result = processInbox(this.id, this.inbox, this.seen, this.worldModel, nowMs);
    this.inbox.length = 0;
    pruneProtocol(this.seen, this.worldModel, nowMs);
    return result;
  }

  /**
   * Assess collision risk over the local world model and set this vehicle's
   * own control (acceleration) accordingly. This is the decentralized safety
   * loop: input is only self + world model; output is only this car's braking.
   */
  updateRiskAndControl(): void {
    const a = assessRisk(
      { x: this.x, y: this.y, vel: this.vel, heading: this.heading },
      this.worldModel.values()
    );
    this.riskLevel = a.level;
    this.ttc = a.ttc;
    this.threatId = a.threatId;
    this.gap = a.gap;
    this.dSafe = a.dSafe;
    this.insideSafe = a.insideSafe;

    // The emergency initiator brakes hard regardless of what's ahead.
    if (this.manualBrake) {
      this.accel = -RISK.A_BRAKE_MPS2;
      this.status = 'EMERGENCY';
      return;
    }

    switch (a.level) {
      case 'DANGER':
        this.accel = -RISK.A_BRAKE_MPS2;
        this.status = 'EMERGENCY';
        break;
      case 'WARNING':
        this.accel = -RISK.A_BRAKE_MPS2 * RISK.WARNING_EASE_FACTOR;
        this.status = 'WARNING';
        break;
      default: {
        // SAFE: resume gently toward desired cruise speed.
        this.status = 'NORMAL';
        const dv = this.desiredVel - this.vel;
        if (dv > 0.1) this.accel = Math.min(RISK.RESUME_ACCEL_MPS2, dv);
        else if (dv < -0.1) this.accel = Math.max(-RISK.RESUME_ACCEL_MPS2, dv);
        else this.accel = 0;
        break;
      }
    }
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
