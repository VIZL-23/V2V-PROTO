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

/** Total road width in metres (used by renderer + spawn logic). */
export const ROAD_WIDTH_M =
  ROAD.LANES * ROAD.LANE_WIDTH_M + 2 * ROAD.SHOULDER_M;
