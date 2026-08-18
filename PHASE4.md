# Phase 4 — Risk & the Hero Scenario

The payoff phase. Everything built so far — physics, the channel, the per-vehicle
world model — now feeds a **risk engine that runs inside each vehicle**, and one
button press produces the demo's whole argument: brake → broadcast → DANGER →
propagate.

## The architectural point, made concrete

The risk engine ([risk/risk.ts](src/risk/risk.ts)) is handed a vehicle's own
kinematics and its own world model — and **nothing else**. It cannot see the
global vehicle array. Safety decisions never pass through a central node; each
car decides for itself from what it heard. That is the thesis of the whole
project, now enforced in a function signature.

## What's new

```
V2V-SIH/
├── src/
│   ├── risk/
│   │   └── risk.ts        assessRisk(self, worldModel) → TTC + RSS-lite + level
│   ├── sim/
│   │   ├── vehicle.ts     + risk state, desiredVel, manualBrake, updateRiskAndControl()
│   │   ├── world.ts       + triggerEmergency/clearEmergency, warning-time latch
│   │   └── config.ts      + RISK thresholds, narrower cruise band for a calm start
│   ├── render/
│   │   └── canvasRenderer.ts  + TTC labels, emergency sonar pulse, risk colours
│   └── ui/
│       ├── Controls.tsx       + 🚨 Trigger / ✖ Clear Emergency
│       └── MetricsPanel.tsx   + Warning-time headline + selected-car risk (TTC, RSS)
```

## The risk engine (§7)

For each known neighbour **ahead**:

```
 d  = distance          vr = closing speed along the line between us
 vr ≤ 0 ? → SAFE (separating)          ← the guard that stops green cars painting red
 TTC = d / vr
      TTC > 5s     ● SAFE
      3–5s         ● WARNING   (ease off)
      TTC < 3s     ● DANGER    (brake)
```

- **The `vr ≤ 0` guard** is explicit — a separating car gives a negative/∞ TTC
  and would otherwise flag a false DANGER. This is the classic first-TTC bug.
- **Only cars ahead** are threats (a tailgater is their problem, not ours).
- **Thresholds live in `RISK` config**, not as literals, so they tune live.
- **RSS-lite** safe distance is shown alongside: `d_safe = v·t_react + v²/(2·a)`
  ≈ 54 m at 18 m/s. "Inside safe distance" reads as more rigorous than TTC alone.

Control follows the level: DANGER → full brake, WARNING → ease (0.4×), SAFE →
resume gently toward desired cruise. So traffic self-organises and recovers
after the emergency clears.

## Done-criterion (from the workflow doc)

> **One button press produces: brake → broadcast → V2 DANGER → propagate → V3 WARNING.**

Verified on the default seed (front car V9 triggered), the risk wave propagates
backward through the column exactly as intended:

```
 baseline        12 cars all SAFE (calm green start)
 +1.0s   V8 → DANGER  (TTC 3.0)     warning time = 950 ms
 +1.5s   V7 → WARNING (TTC 4.4)     propagates one car back
 +3.0s   V7 → DANGER
 +5.0s   V6 → WARNING               wave keeps moving back
 +5.5s   V5 → WARNING
```

Each vehicle computes its **own** TTC from messages it received — some of that
knowledge arrives via multi-hop relay (maxHops 2). No collisions, no NaNs.

## Warning time — the headline metric (§10)

Sim-clock ms from the braker decelerating to the **first** other vehicle
reaching DANGER. On the default seed: **950 ms**. This single number is the
argument Phase 5 makes: the same seed in cloud mode will produce a visibly
larger warning time, and the gap is the whole point.

## Reproducibility carried forward

The entire hero scenario is deterministic: same seed + trigger → bit-identical
run **and identical warning time** (950 ms), confirmed; a different seed gives a
different geometry (e.g. 2600 ms). This is exactly the controlled experiment the
Edge/Cloud toggle needs.

## Try it

Start, let it settle to all-green, then **🚨 Trigger Emergency** (fires on the
front car, or on the car you've selected). Watch the red/amber wave roll backward
and the **Warning time** latch. Select a car to read its live **TTC** and
**RSS-lite safe distance**. **✖ Clear Emergency** lets traffic recover.

## What's deliberately NOT here yet

- No RSU / edge node, no Edge/Cloud toggle. The warning-time metric this phase
  produces is the number that comparison will move. → **Phase 5**.
