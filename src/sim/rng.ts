/**
 * Seeded PRNG — mulberry32.
 *
 * Reason we're using this even in Phase 1: reproducible spawns.
 * Same seed → identical run twice. That's the Phase 1 done-criterion, and it
 * keeps every later measurement (metrics, warning time) reproducible.
 *
 * NEVER call Math.random() anywhere in sim/ code.
 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    // Ensure a non-zero, 32-bit state.
    this.state = (seed >>> 0) || 1;
  }

  /** Returns a float in [0, 1). */
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Returns a float in [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Returns an integer in [min, max]. */
  intRange(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }
}
