/**
 * V2V message schema (workflow doc §5).
 *
 * Phase 2 only sends CAM beacons and delivers them single-hop, so it can
 * measure the channel. The full protocol machinery — dedupe by (senderId,seq),
 * TTL-based multi-hop re-broadcast, seen-set pruning — arrives in Phase 3.
 * The `seq` and `ttl` fields are already here so the wire format doesn't change
 * when that lands.
 *
 * Note (from the doc): there is deliberately NO separate `messageId`.
 * `(senderId, seq)` is already a unique key and is what dedupe will use.
 */

export type VehicleId = string;

export type MessageType = 'CAM' | 'EMERGENCY_BRAKING';

export interface V2VMessage {
  senderId: VehicleId;
  seq: number; // per-sender counter → dedupe key with senderId
  type: MessageType;
  sentAt: number; // sim clock, ms (never Date.now())
  ttl: number; // hops remaining (Phase 3 decrements on re-broadcast)
  pos: { x: number; y: number }; // metres
  vel: number; // m/s
  accel: number; // m/s²
  heading: number; // radians
}

/** Stable dedupe key for a message. Used by the Phase 3 seen-set. */
export function messageKey(m: Pick<V2VMessage, 'senderId' | 'seq'>): string {
  return `${m.senderId}:${m.seq}`;
}
