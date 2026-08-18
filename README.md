# V2V-SIH — Decentralized V2V + Edge Intelligence

Prototype for the SIH Makeathon: a Vehicle-to-Vehicle communication
platform demonstrating decentralized safety messaging, local collision
detection at the vehicle, and edge intelligence — without a cloud in
the safety-critical loop.

## Status

- **Phase 1 — Road & Motion** ✅
  Fixed-timestep vehicle physics on a canvas road with start/pause/reset
  and a seeded PRNG for reproducible runs. See `PHASE1.md`.
- **Phase 2 — Channel & metrics** ✅
  Explicit V2V channel with range, delay, jitter, and distance-dependent
  loss; live latency (p50/p95) and PRR meters; drag a car out of range to
  watch its link degrade. See `PHASE2.md`.
- **Phase 3 — Protocol & decentralization** ✅ current
  Per-vehicle inbox + local world model, dedupe by (senderId, seq), TTL
  multi-hop relay, and duplicate rejection. Select a car to see its own
  world model — green links direct, amber links relayed. See `PHASE3.md`.

Upcoming phases (dependency order):
- **Phase 4 — Risk & the hero scenario.** TTC + RSS-lite risk engine,
  `🚨 Trigger Emergency` button, propagation animation, colour-coded
  risk states.
- **Phase 5 — Edge node & cloud toggle.** RSU on the road doing traffic
  aggregation, plus an Edge/Cloud switch that runs the same seed with
  a simulated cloud round-trip so the warning-time gap is visible.

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:5173.

## Stack

React + TypeScript + Canvas via Vite. No backend. See `PHASE1.md`
for architectural rules that carry through all later phases.
