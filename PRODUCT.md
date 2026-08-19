# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary audience (who the design must win over):** judges at the SIH (Smart
India Hackathon) Makeathon, watching a short (~3–5 minute) live demo, most
likely projected. They decide fast and will probe the claims.

**Secondary:** the presenting team, who drive the simulation live during the
pitch (start, select a car, trigger the emergency, toggle controls).

**Fictional end-users inside the product world:** vehicles / drivers on a road.
The interface simulates their vehicle-to-vehicle safety exchange, but no real
driver ever uses this build — the real viewer is always a judge or presenter.

## Product Purpose

A browser-based prototype that demonstrates a **decentralized vehicle-to-vehicle
(V2V) communication system**: vehicles exchange real-time safety and traffic
information directly with each other, detect collision risk locally, and rely on
a roadside **edge** node for traffic awareness — **without depending on cloud
connectivity** in the safety-critical path.

Success is judged by whether, in a few minutes, the audience (a) immediately
grasps the decentralized-plus-edge story, (b) is convinced it is real rather than
staged, and (c) finds it holds up when questioned ("where does that number come
from?").

## Positioning

The mechanism a neighboring "V2V demo" could not truthfully copy without
building the same honest simulation:

- **The safety loop never leaves the vehicle.** Each car computes its own
  collision risk from only the messages it personally received; no vehicle reads
  a global list of all cars. Decentralization is enforced by the shape of the
  code, not asserted by a diagram.
- **Every metric is a real measurement.** An explicit software channel model
  (range, delay, jitter, distance-based loss) sits between vehicles, so latency,
  packet-reception ratio, and warning time are measured from the running
  simulation — never typed into the UI.
- **The edge node observes but never steers.** A roadside unit (RSU) aggregates
  density and congestion in parallel; nothing it computes flows back into a
  braking decision. Edge intelligence adds awareness without becoming a central
  point of control.
- **Deterministic and reproducible.** A seeded generator means the same seed
  reproduces the same run exactly, so any result can be shown twice and trusted.

## Operating Context

- **Event:** SIH Makeathon, EV category. Problem brief: *"Design a decentralized
  communication system that enables vehicles to exchange real-time safety and
  traffic information without depending on cloud connectivity. The solution
  should support collision avoidance, cooperative driving and traffic
  optimisation using edge computing."*
- **The demo is a script, not an exploration:** start → a dozen calm green cars
  beaconing → point at the measured metrics → trigger emergency → the front car
  brakes and the DANGER/WARNING wave propagates backward → the RSU independently
  flags congestion. Rehearsed and time-boxed.
- **Runtime:** everything runs in a single browser tab. No backend, no network,
  no real radio — the whole V2V world is one page, which is itself part of the
  pitch (no infrastructure required).
- **Companion artifact:** `V2V-SIH-Documentation.pdf` explains the project and
  every on-screen metric for anyone reviewing it outside the live demo.

## Capabilities and Constraints

**Confirmed functionality (the five build phases, all shipped):**

1. Fixed-timestep vehicle physics on a canvas road with start / pause / reset.
2. Explicit V2V channel (range, delay, jitter, distance-based loss) with live
   measured metrics: latency p50/p95, packet-reception ratio (PRR), loss.
3. Decentralized protocol: per-vehicle inbox + local world model, duplicate
   rejection keyed on (senderId, sequence), TTL-limited multi-hop relay.
4. In-vehicle risk engine: time-to-collision (TTC) + RSS-lite safe distance →
   SAFE / WARNING / DANGER, autonomous braking, a Trigger Emergency action, and
   the headline warning-time metric.
5. Roadside edge node (RSU): a parallel observer reporting connected count,
   density (LOW/MED/HIGH), and congestion / incident detection.

**Durable technical constraints future work must preserve:**

- Browser-only, single tab, no backend, no sockets — an explicit software
  channel model stands in for the radio.
- Fixed 50 ms simulation timestep decoupled from rendering; simulation state
  lives outside React (a plain class), sampled ~10 Hz for the UI panels.
- All simulation state in metres/seconds; pixels only at render, via one
  constant. Mixing units would corrupt every distance calculation.
- Seeded PRNG only — never real randomness inside the simulation. Determinism is
  load-bearing for a trustworthy demo.
- The decentralization rule (a vehicle acts only on its own inbox and state) and
  the "metrics are measured, never typed" rule are both non-negotiable product
  claims, not implementation details.

**Terminology used throughout:** CAM beacon, TTL, hop, relay, world model, TTC,
RSS-lite, PRR, packet loss, warning time, RSU, congestion.

**In-progress / changing:** an earlier Edge-vs-Cloud comparison toggle is being
removed so the system is purely decentralized/edge with no cloud path at all —
which tightens alignment with the "without depending on cloud connectivity"
brief. Treat the cloud comparison as retired, not a feature to preserve.

## Brand Commitments

- Working name: **V2V-SIH**.
- **Visual identity is deliberately open** — the user has no locked logo,
  palette, or typography. Future visual work is free to establish a distinctive
  identity (decided in new-work, not here). No official SIH template constraint
  was stated; confirm submission-format rules before assuming one.

## Evidence on Hand

- A real, working simulation — the on-screen metrics are genuine measurements,
  verified against the underlying modules during the build.
- Documentation: `PHASE1.md`–`PHASE5.md`, `README.md`, `prototype-workflow.md`
  (the build reference / design rationale), and `V2V-SIH-Documentation.pdf`.
- **Absences future work must not fabricate:** there is no real vehicle
  hardware, no field data, no external users, no partnerships, benchmarks,
  testimonials, or deployment. All numbers come from the simulation only; do not
  present them as real-world measurements.

## Product Principles

1. **Decentralized by construction.** Safety decisions never leave the vehicle
   and no cloud sits in the critical loop; preserve the structural enforcement,
   not just the label.
2. **Every number is measured, never faked.** Metrics come from the simulation,
   so the demo survives a judge asking where a figure comes from.
3. **Reproducible by design.** Seeded determinism means any result can be shown
   twice and trusted, and runs can be compared fairly.
4. **Legible under demo pressure.** The decentralized-plus-edge story must read
   at a glance on a projector in minutes; narrative clarity outranks feature
   density.
5. **A durable foundation.** Demo-first, but built to continue after SIH — avoid
   one-way-door shortcuts.

## Accessibility & Inclusion

No formal standard was mandated, but the live-projected-demo context makes two
needs real: high contrast and large, readable type that survives a projector and
a back-row viewer, and risk states that are distinguishable **beyond colour
alone** (the SAFE/WARNING/DANGER encoding should not rely solely on
green/amber/red for a colour-blind judge).
