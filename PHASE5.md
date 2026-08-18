# Phase 5 — Edge Node

The roadside unit. Everything so far runs entirely on the vehicles; this phase
adds an **edge node beside the road** that watches the same channel and reports
on the traffic — without ever being in the safety loop (workflow doc §3).

## What's new

```
V2V-SIH/
├── src/
│   ├── edge/
│   │   └── rsu.ts        Rsu — parallel observer: connected · density · congestion
│   ├── sim/
│   │   ├── world.ts      + RSU tap each tick → edgeStats
│   │   └── config.ts     + RSU (range, density thresholds, congestion speeds)
│   ├── render/
│   │   └── canvasRenderer.ts  + RSU mast, coverage band, congestion badge
│   └── ui/
│       └── MetricsPanel.tsx   + Edge node panel (connected / density / congestion)
```

## The RSU — a parallel observer (§3)

The roadside unit taps the channel to aggregate the corridor:

- **Connected** — vehicles within its range.
- **Density** — vehicles per km over the observed span → LOW / MED / HIGH.
- **Avg speed** — mean speed of connected vehicles.
- **Congestion** — the corridor is crawling on average, OR a vehicle has come to
  a stop in coverage (an incident the RSU should surface).

The one rule that keeps the system decentralized: **nothing the RSU computes
ever flows back into a vehicle's braking decision.** Read the arrows in §3 —
they only ever point *out* of the safety loop. The RSU adds situational
awareness (traffic aggregation, incident detection) while every safety decision
stays local at the vehicle. That separation is the whole architectural claim.

## Done-criterion

The edge node observes the road live, and independently flags an incident when
one occurs. Verified on the default seed:

| | before emergency | after emergency |
|---|---|---|
| Connected | 12 | 12 |
| Density | MED | MED |
| Congestion | no | **YES** |

Trigger the emergency and the braker comes to a stop; the RSU lights up
`CONGESTION` on its own, from what it heard on the channel — a demonstration that
the edge node contributes awareness without touching the critical path. The
warning-time metric (Phase 4) is unchanged: **950 ms**, decided locally.

## Reproducibility

The RSU is a pure function of the vehicles it observes, so it adds no randomness:
same seed → identical run and identical RSU readings, confirmed.

## Try it

Start, let the traffic settle, watch the **Edge node** panel track connected /
density / avg speed. Then **🚨 Trigger Emergency**: as the braker stops, the RSU
flags `CONGESTION` (and the mast on the canvas turns red) — while the braking
decisions themselves stay entirely on the vehicles.

## Status: prototype complete

Phases 1–5 all land in one running app: fixed-timestep physics, an explicit
channel with real metrics, a decentralized protocol with multi-hop relay, an
in-vehicle risk engine with the emergency hero scenario, and a roadside edge
observer. Stretch goals from the workflow doc (road-graph routing, intersection
scenario, Web Workers, spoofed-message security demo) remain out of scope.
