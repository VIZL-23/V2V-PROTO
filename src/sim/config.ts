/**
 * Simulation constants.
 *
 * IMPORTANT: All simulation state is in METRES / SECONDS.
 * Convert to pixels ONLY at render time using PX_PER_M.
 */

export const SIM = {
  /** Fixed simulation timestep in milliseconds. Physics runs at exactly this rate. */
  STEP_MS: 50,

  /** Cap accumulator to avoid spiral-of-death after a tab is backgrounded. */
  MAX_ACCUMULATOR_MS: 250,
};

export const RENDER = {
  /** Pixels per metre. One place to tune the "zoom". */
  PX_PER_M: 4,
};

export const ROAD = {
  /** Straight-corridor demo road: length in metres. */
  LENGTH_M: 300,

  /** Number of lanes. */
  LANES: 3,

  /** Lane width in metres. */
  LANE_WIDTH_M: 3.5,

  /** Shoulder padding in metres (each side). */
  SHOULDER_M: 1.5,
};

export const VEHICLE = {
  /** Vehicle length in metres. */
  LENGTH_M: 4.5,

  /** Vehicle width in metres. */
  WIDTH_M: 1.9,

  /** Default cruise speed range (m/s). ~50-72 km/h. */
  CRUISE_MIN_MPS: 14,
  CRUISE_MAX_MPS: 20,

  /** Spawn count for phase 1. */
  DEFAULT_COUNT: 12,
};

/**
 * V2V communication channel (Phase 2).
 *
 * These are the parameters of an EXPLICIT channel model. Every metric on
 * screen (latency, PRR, loss) is a real measurement of THIS model — not a
 * decoration. That is what makes the numbers defensible in the demo.
 *
 * Loss grows with distance: near 0 at point-blank range, up to
 * LOSS_AT_RANGE_M at the edge of range. Beyond RANGE_M, a message is simply
 * out of range and never counted against PRR (PRR = delivered ÷ in-range).
 */
export const CHANNEL = {
  /** Max communication range in metres. Live-tunable in the UI. */
  RANGE_M: 100,

  /** Base one-way delay in ms before any jitter. */
  BASE_DELAY_MS: 8,

  /** Uniform jitter added on top of base delay (0..JITTER_MS). */
  JITTER_MS: 6,

  /** Packet loss probability at zero distance. */
  LOSS_AT_ZERO_M: 0.01,

  /** Packet loss probability at the edge of range (interpolated by distance). */
  LOSS_AT_RANGE_M: 0.35,

  /** Rolling window for "live" metrics, in ms. Stats reflect recent traffic. */
  METRICS_WINDOW_MS: 3000,
};

export const MSG = {
  /**
   * CAM (cooperative awareness) beacon cadence per vehicle, in ms.
   * 4 Hz. Lower than a raw beacon rate on purpose: in Phase 3 every beacon is
   * relayed multi-hop, and the seen-set keeps that from becoming a broadcast
   * storm — but a slower cadence keeps total channel traffic comfortable.
   */
  BEACON_INTERVAL_MS: 250,

  /** Default TTL (hops remaining) stamped on a new message. */
  DEFAULT_TTL: 3,
};

/**
 * Protocol layer (Phase 3) — dedupe + local world model.
 *
 * The one hard rule (workflow doc §4): a vehicle acts ONLY on its own inbox and
 * its own state. It never reads the global vehicle array. Its picture of the
 * world is `worldModel`, built entirely from messages it received.
 */
export const PROTO = {
  /** How long a (senderId:seq) key stays in the dedupe set before pruning. */
  SEEN_TTL_MS: 3000,

  /** Forget a vehicle from the local world model if unheard this long. */
  MODEL_TTL_MS: 1500,
};

/** Total road width in metres (used by renderer + spawn logic). */
export const ROAD_WIDTH_M =
  ROAD.LANES * ROAD.LANE_WIDTH_M + 2 * ROAD.SHOULDER_M;
