# Phase 2 — Channel & Metrics

The phase that turns the numbers honest. In Phase 1 a "broadcast" would have
been a plain function call — there is no latency in a function call, so any
"18 ms / 97%" on screen would be theatre. Phase 2 puts an **explicit channel
model** between vehicles, so every metric is a real measurement of a declared
model (workflow doc §1, §6).

## What's new

```
V2V-SIH/
├── src/
│   ├── sim/
│   │   ├── message.ts     V2VMessage schema (§5) — CAM beacons, seq, ttl
│   │   ├── metrics.ts     rolling-window latency p50/p95, PRR, loss
│   │   ├── vehicle.ts     + inbox, makeCam(), held (drag), seq counter
│   │   ├── world.ts       + owns Channel + Metrics; beacon → deliver in step()
│   │   └── config.ts      + CHANNEL (range/delay/jitter/loss) + MSG cadence
│   ├── channel/
│   │   └── channel.ts     range → distance-loss → delay+jitter → scheduled deliver
│   ├── render/
│   │   └── canvasRenderer.ts  + range ring + in-range link lines + selection halo
│   └── ui/
│       └── MetricsPanel.tsx   live 10 Hz metrics + channel controls + selected link
```

## The channel model (where the metrics come from)

For every broadcast, for every *other* vehicle:

1. `d = distance(sender, receiver)`; if `d > range` → **out of range** (never
   counted against PRR — PRR only measures in-range receivers, §10).
2. `p_loss = lerp(lossAtZero, lossAtRange, d/range)` → roll against the seeded
   channel RNG. A drop counts against PRR.
3. Otherwise schedule delivery at `t + baseDelay + rand()*jitter` into the
   receiver's inbox.

Defaults (`config.ts`): range 100 m, base delay 8 ms, jitter 0–6 ms, loss 1 %
at point-blank rising to 35 % at the range edge.

## Metrics (measured, never typed)

| Metric | Definition |
|---|---|
| Latency p50 / p95 | `receivedAt − sentAt`, over a 3 s rolling window |
| PRR | delivered ÷ in-range delivery attempts |
| Packet loss | 1 − PRR |
| Link PRR (selected car) | delivered ÷ attempts, filtered to one receiver |

The panel re-renders on a **throttled 10 Hz subscription** — the canvas redraws
every animation frame, but React only samples the metrics ten times a second.
Two independent clocks, on purpose (§11).

## Done-criterion (from the workflow doc)

> **Move a car out of range and watch PRR drop live.**

Click a car to select it (range ring + green links to its in-range neighbours
appear), then drag it. As it approaches the ring its **link PRR falls smoothly**
as distance-dependent loss climbs; past the ring it reads **OUT OF RANGE** and
its link goes silent.

Verified numerically against the real modules — a frozen sender/receiver pair at
increasing separation:

| Distance | 10 m | 30 m | 50 m | 70 m | 90 m | 99 m | 105 m |
|---|---|---|---|---|---|---|---|
| Link PRR | 96.7% | 90.0% | 83.3% | 76.7% | 70.0% | 66.7% | out of range |

Measured latency p50 ≈ 11 ms, p95 ≈ 13.7 ms — exactly base 8 ms + uniform
0–6 ms jitter.

## Reproducibility carried forward

The channel owns its **own** seeded RNG stream (derived from the world seed), so
same seed → identical loss/jitter rolls → identical run. Confirmed: two same-seed
runs produce bit-identical vehicle positions **and** bit-identical metric
snapshots; reset reproduces both; a different seed diverges. This is the
foundation the Phase 5 edge-vs-cloud comparison stands on.

## What's deliberately NOT here yet

- No dedupe / TTL multi-hop re-broadcast — the inbox is drained unprocessed for
  now. Message schema (`seq`, `ttl`) is already in place so the wire format
  doesn't change. → **Phase 3**.
- No risk / TTC, no colour-coded cars beyond the status field. → **Phase 4**.
- No RSU / edge node, no cloud toggle. → **Phase 5**.
