# Phase 1 — Road & Motion

The visible skeleton the rest of the prototype hangs off. A road, a
handful of vehicles moving under a fixed-timestep physics loop, and
start / pause / reset controls.

## What's here

```
V2V-SIH/
├── package.json           Vite + React + TS deps
├── vite.config.ts
├── tsconfig.json          strict, noUnusedLocals, noUnusedParameters
├── tsconfig.node.json
├── index.html
├── PHASE1.md              ← you are here
├── README.md
└── src/
    ├── main.tsx           React entry
    ├── index.css          globals
    ├── App.tsx            rAF loop + fixed-timestep accumulator, sim in a ref
    ├── App.css
    ├── sim/
    │   ├── config.ts      PX_PER_M, road dims, vehicle dims, step size
    │   ├── rng.ts         mulberry32 seeded PRNG (never Math.random)
    │   ├── vehicle.ts     Vehicle class + per-step physics
    │   └── world.ts       World: owns vehicles, fixed-step tick, reset()
    ├── render/
    │   └── canvasRenderer.ts   draws road + vehicles (only place m→px)
    └── ui/
        └── Controls.tsx   start / pause / reset / vehicle count / seed
```

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

## What you should see

- A dark 3-lane road with lane dashes and shoulders.
- ~12 vehicles (cyan) spaced along it, each labelled `V1`…`V12`.
- Header showing status pill (`RUNNING` / `PAUSED`).
- HUD at the bottom of the canvas showing `t=…s   tick=…   vehicles=…`.
- Controls row: **▶ Start / ⏸ Pause · ⟲ Reset · Vehicles slider · Seed input**.

## Done-criteria (from the workflow doc)

Phase 1 is done when both of these hold:

1. **Cars move smoothly.** No stutter, no jumps. Try changing browser
   focus — physics should not speed up or slow down.
2. **Reset produces the identical run twice.** Press Start, let it run
   for a few seconds, hit Reset, run again. The `V1`…`V12` positions
   at any given `tick=N` should be pixel-identical between the two
   runs. Change the seed number → different run. Change it back → same
   run as the first time.

If both pass, we move on to **Phase 2: Channel & metrics**.

## Why the architecture looks like it does

These aren't stylistic choices — they set us up for later phases.

- **Simulation state is in a class held in `useRef`, not in React state.**
  At 20 vehicles × 20 Hz you'd thrash the reconciler. React only
  re-renders when the user changes a control.
- **Fixed 50 ms simulation timestep, decoupled from `requestAnimationFrame`.**
  Physics runs at exactly the same rate regardless of the monitor or
  tab focus. TTC, PRR, latency (coming in Phase 2) will all mean
  the same thing every run.
- **Everything in metres and seconds inside `sim/`.** Only
  `canvasRenderer.ts` converts to pixels, via one `PX_PER_M` constant.
  Mixing units silently corrupts every distance-based calculation
  downstream.
- **Seeded PRNG in place from day one.** The Phase 5 edge-vs-cloud
  comparison needs identical runs with a mode toggle — the seed
  infrastructure has to exist before any random spawn or channel loss
  is added.
- **Vehicles integrate their own state only.** No vehicle reads the
  global vehicle array. The empty inbox goes in during Phase 3.

## What's deliberately NOT here yet

- No V2V messages, no communication channel, no metrics — Phase 2.
- No collision risk / TTC — Phase 4.
- No RSU / edge node — Phase 5.
- No dashboard panels beyond the canvas HUD — arrives with Phase 2 metrics.
