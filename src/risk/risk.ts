/**
 * Risk engine (workflow doc §7) — computed INSIDE each vehicle.
 *
 * The architectural point of the whole prototype lives here: this function is
 * given only the vehicle's own kinematics and its own world model (the picture
 * it built from received messages). It is handed NO access to the global
 * vehicle array. Safety decisions never pass through a central node.
 *
 * For each known neighbour AHEAD:
 *     d  = distance
 *     vr = closing speed along the line between us
 *     vr ≤ 0 ?  → separating → SAFE for this pair   (the classic TTC bug guard)
 *     TTC = d / vr
 *          TTC > 5s        → SAFE
 *          3s ≤ TTC ≤ 5s   → WARNING
 *          TTC < 3s        → DANGER (brake)
 *
 * RSS-lite safe distance is reported alongside TTC:
 *     d_safe = v·t_react + v²/(2·a_brake)
 */

import { RISK } from '../sim/config';
import type { KnownVehicle } from '../protocol/protocol';

export type RiskLevel = 'SAFE' | 'WARNING' | 'DANGER';

export interface SelfKinematics {
  x: number;
  y: number;
  vel: number;
  heading: number;
}

export interface RiskAssessment {
  level: RiskLevel;
  ttc: number | null; // seconds to the worst threat, null if nothing is closing ahead
  threatId: string | null;
  gap: number | null; // metres to that threat
  dSafe: number; // RSS-lite safe following distance for this vehicle (m)
  insideSafe: boolean; // is the threat closer than d_safe?
}

export function assessRisk(self: SelfKinematics, known: Iterable<KnownVehicle>): RiskAssessment {
  const sx = self.vel * Math.cos(self.heading);
  const sy = self.vel * Math.sin(self.heading);
  const hx = Math.cos(self.heading);
  const hy = Math.sin(self.heading);

  let bestTtc = Infinity;
  let threatId: string | null = null;
  let gap: number | null = null;

  for (const k of known) {
    const dx = k.pos.x - self.x;
    const dy = k.pos.y - self.y;
    const d = Math.hypot(dx, dy);
    if (d < 1e-6) continue;

    // Only worry about what is AHEAD of us (a tailgater is their problem).
    if (dx * hx + dy * hy <= 0) continue;

    const ux = dx / d;
    const uy = dy / d;

    // Closing speed: component of our velocity relative to theirs, along the
    // line to them. Positive = the gap is shrinking.
    const kx = k.vel * Math.cos(k.heading);
    const ky = k.vel * Math.sin(k.heading);
    const vr = (sx - kx) * ux + (sy - ky) * uy;

    if (vr <= 0) continue; // separating → not a threat (GUARD: no negative/∞ TTC)

    const ttc = d / vr;
    if (ttc < bestTtc) {
      bestTtc = ttc;
      threatId = k.id;
      gap = d;
    }
  }

  const dSafe = self.vel * RISK.T_REACT_S + (self.vel * self.vel) / (2 * RISK.A_BRAKE_MPS2);

  if (threatId === null) {
    return { level: 'SAFE', ttc: null, threatId: null, gap: null, dSafe, insideSafe: false };
  }

  const level: RiskLevel =
    bestTtc < RISK.TTC_DANGER_S ? 'DANGER' : bestTtc <= RISK.TTC_WARN_S ? 'WARNING' : 'SAFE';

  return {
    level,
    ttc: bestTtc,
    threatId,
    gap,
    dSafe,
    insideSafe: gap !== null && gap < dSafe,
  };
}
