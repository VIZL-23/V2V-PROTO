# Phase 3 — Protocol & Decentralization

The phase that makes "decentralized" *true* instead of a label on a diagram
(workflow doc §2, §4). Until now the channel moved messages, but nobody did
anything with them — the inbox was drained unread. Now every vehicle runs the
real protocol on its **own** inbox: dedupe, learn, relay.

## The one hard rule

> A vehicle acts only on its own inbox and its own state. It never reads the
> global vehicle array.

Enforced structurally: `protocol/protocol.ts` is handed a vehicle's id, its
inbox, its dedupe set, and its world model — and nothing else. It *cannot* reach
the world, so the code can't drift into a centralized loop. Each car's picture
of traffic is its `worldModel`, built entirely from messages it received.

## What's new

```
V2V-SIH/
├── src/
│   ├── protocol/
│   │   └── protocol.ts    processInbox() — dedupe · learn · relay; pruneProtocol()
│   ├── sim/
│   │   ├── vehicle.ts     + seen-set, worldModel, makeCam() self-mark, process()
│   │   ├── world.ts       step() phase 4: process inboxes → collect → re-broadcast
│   │   ├── metrics.ts     + relays/s, duplicates-rejected/s, max hops
│   │   └── config.ts      + PROTO (seen/model TTLs), beacon → 4 Hz
│   ├── render/
│   │   └── canvasRenderer.ts  overlay now draws the world MODEL, coloured by hop
│   └── ui/
│       └── MetricsPanel.tsx   + Protocol panel + selected car's world-model chips
```

## Per-message logic (each vehicle, each tick)

For every message delivered to its inbox:

1. **Dedupe** — key = `(senderId:seq)`. Already seen → reject (counts as a
   duplicate). This is what stops multi-hop from looping forever.
2. **Learn** — fold the message into the local world model, freshest `seq` wins.
   Record `hops = DEFAULT_TTL − ttl` (0 = heard directly). The first copy to
   arrive is normally the shortest path, so hop counts come out topologically
   correct for free.
3. **Relay** — if `ttl > 1`, hand back a copy with `ttl − 1`, keeping the
   **original** `senderId` and `seq` so dedupe can still catch it downstream.

A vehicle also marks its **own** beacons as seen when it sends them, so relays
that echo back don't get re-forwarded.

## Done-criterion (from the workflow doc)

> **V1 → V2 → V3 reaches V3 with TTL decremented, and duplicates are rejected.**

Verified on a frozen line topology (cars 60 m apart, range 100 m):

```
 V1 ─60m─ V2 ─60m─ V3 ─60m─ V4 ─60m─ V5
```

| Vehicle | Its world model | Meaning |
|---|---|---|
| V1 | V2\@0h, V3\@1h, V4\@2h | learns V3/V4 only via relay; TTL stops it at V4 |
| V4 | V1\@2h, V2\@1h, V3\@0h, V5\@0h | hears V1 two hops away |
| V5 | does **not** know V1 | 4 hops needed, TTL=3 — propagation correctly bounded |

Duplicates rejected: **~28/s** on this tiny map (dedupe actively working).

In the UI: select a car and its **world-model chips** list who it knows and at
how many hops; on the canvas, **green links = direct, amber links = relayed** —
amber links reaching cars *outside the range ring* are the visible proof that a
vehicle knows about traffic it can't reach on its own.

## Reproducibility carried forward

Relay traffic is deterministic (relays are collected and re-broadcast in a fixed
order), so the channel RNG stream stays reproducible: same seed → bit-identical
positions **and** metrics, confirmed. A normal 12-car run relays ~400 msg/s while
**rejecting ~1700 duplicates/s** — multi-hop stays bounded, never a broadcast
storm, precisely because of the seen-set.

## What's deliberately NOT here yet

- No risk / TTC engine, no colour-coded danger states, no emergency trigger.
  The world model this phase builds is exactly the input the risk engine will
  read. → **Phase 4**.
- No RSU / edge node, no cloud toggle. → **Phase 5**.
