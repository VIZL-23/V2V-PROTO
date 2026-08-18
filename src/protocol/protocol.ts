/**
 * Protocol layer (workflow doc §4) — the code that makes "decentralized" true.
 *
 * This module is deliberately given NO access to the global vehicle array. It
 * receives only a vehicle's own id, its own inbox, and its own state (the
 * dedupe set + local world model). If the function can't reach the world, the
 * architecture can't drift into a centralized loop.
 *
 * Per received message it does three things:
 *   1. DEDUPE  — reject anything whose (senderId:seq) key was already seen.
 *   2. LEARN   — fold the message into the local world model (freshest wins).
 *   3. RELAY   — if TTL still has hops left, hand back a decremented copy to
 *                re-broadcast. The copy keeps the ORIGINAL senderId + seq, so
 *                dedupe stops it looping forever (multi-hop, not infinite flood).
 */

import { MSG, PROTO } from '../sim/config';
import { messageKey } from '../sim/message';
import type { V2VMessage, VehicleId } from '../sim/message';

/** One entry in a vehicle's local world model: what it believes about another car. */
export interface KnownVehicle {
  id: VehicleId;
  pos: { x: number; y: number };
  vel: number;
  accel: number;
  heading: number;
  seq: number; // latest seq heard from this sender
  hops: number; // relay distance of the copy we learned from (0 = heard directly)
  lastHeardMs: number; // sim clock of last update → drives model pruning
}

export interface ProcessResult {
  /** Messages to re-broadcast this tick (TTL already decremented). */
  forwards: V2VMessage[];
  /** How many inbox messages were rejected as duplicates. */
  duplicates: number;
  /** How many world-model entries were created or refreshed. */
  newInfo: number;
  /** Largest hop distance observed among accepted messages this call. */
  maxHops: number;
}

export type SeenSet = Map<string, number>; // key → sim clock last seen
export type WorldModel = Map<VehicleId, KnownVehicle>;

/**
 * Process one vehicle's inbox. Mutates `seen` and `worldModel` in place; does
 * NOT clear the inbox (the caller does). Returns messages to relay + stats.
 */
export function processInbox(
  selfId: VehicleId,
  inbox: V2VMessage[],
  seen: SeenSet,
  worldModel: WorldModel,
  now: number
): ProcessResult {
  const forwards: V2VMessage[] = [];
  let duplicates = 0;
  let newInfo = 0;
  let maxHops = 0;

  for (const msg of inbox) {
    const key = messageKey(msg);

    // 1. DEDUPE. Already seen this exact message → reject.
    if (seen.has(key)) {
      duplicates++;
      continue;
    }
    seen.set(key, now);

    // Ignore echoes of our own broadcasts (they come back via relays).
    if (msg.senderId === selfId) continue;

    // hops taken so far = how much TTL has been spent since origin.
    const hops = MSG.DEFAULT_TTL - msg.ttl;
    if (hops > maxHops) maxHops = hops;

    // 2. LEARN. Fold into the local world model, keeping the freshest seq.
    const prev = worldModel.get(msg.senderId);
    if (!prev || msg.seq >= prev.seq) {
      worldModel.set(msg.senderId, {
        id: msg.senderId,
        pos: msg.pos,
        vel: msg.vel,
        accel: msg.accel,
        heading: msg.heading,
        seq: msg.seq,
        hops,
        lastHeardMs: now,
      });
      newInfo++;
    }

    // 3. RELAY. Still have hops left? Hand back a decremented copy.
    if (msg.ttl > 1) {
      forwards.push({ ...msg, ttl: msg.ttl - 1 });
    }
  }

  return { forwards, duplicates, newInfo, maxHops };
}

/** Age out stale dedupe keys and forgotten vehicles. Call once per tick. */
export function pruneProtocol(seen: SeenSet, worldModel: WorldModel, now: number): void {
  for (const [k, t] of seen) {
    if (now - t > PROTO.SEEN_TTL_MS) seen.delete(k);
  }
  for (const [id, v] of worldModel) {
    if (now - v.lastHeardMs > PROTO.MODEL_TTL_MS) worldModel.delete(id);
  }
}
