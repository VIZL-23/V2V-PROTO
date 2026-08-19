# Design — V2V-SIH Telemetry Console

<!-- impeccable:design-schema 1 -->

The visual authority for the interface. Product truth lives in `PRODUCT.md`; this
records how the surface looks and why. Direction: **"Instrument, not dashboard"** —
a decentralized-safety telemetry console read like an autonomy ground station,
not a generic SaaS admin panel. Mode: **Operate** (a presenter drives it; a judge
reads it under demo pressure).

## Principles

1. **Colour is meaning, never decoration.** Every hue has exactly one job. A grey
   readout is nominal; a coloured one is telling you something.
2. **Separate by hairline and value, not by box.** No stacked rounded cards, no
   shadows, no gradients, no glass. Density comes from rules and alignment.
3. **Measured values are instrument type.** Every number the simulation produces
   is set in mono, tabular — the type itself signals "this was measured, not typed".
4. **The road leads.** The sensor feed is the hero; the telemetry serves it.

## Colour

Near-black cold ground (not navy). Defined as tokens in `src/index.css`.

| Token | Value | Role |
|---|---|---|
| `--bg` | `#06080c` | app ground |
| `--field` | `#080b11` | road sensor-feed ground |
| `--surface-1` | `#0b0e15` | command bar, telemetry rail |
| `--surface-2` / `--well` | `#10141d` / `#090c12` | raised / recessed readout wells |
| `--line` / `--line-strong` | `#19202b` / `#253040` | hairlines |
| `--text` / `--text-dim` / `--text-faint` | `#e9edf3` / `#8592a3` / `#566373` | text tiers |

**Semantic hues — one job each, never overlapping:**

| Token | Value | Sole meaning |
|---|---|---|
| `--signal` | `#35c2e6` | interactive · live · selection · **direct** V2V link |
| `--safe` | `#33c98a` | SAFE / nominal risk |
| `--warn` | `#f2b23d` | WARNING risk |
| `--danger` | `#ff5666` | DANGER risk · congestion incident |
| `--rsu` | `#8b80f2` | roadside unit (infrastructure) |

Risk uses **SAFE/WARNING/DANGER identically** on the road (vehicle fill) and in
every readout (badge, TTC, HUD status) — one language across canvas and DOM.
Link topology is re-encoded off the safety hues: **direct = signal solid,
relayed = signal dashed**, freeing green/amber/red for risk only. Congestion is
flagged in `--danger`; the RSU mast recolours to danger when it detects an incident.

Colour never rides alone: risk badges carry a drawn icon (check / alert) and the
literal word, so state survives a colour-blind viewer and a projector.

## Type

Self-hosted IBM Plex superfamily (offline-safe), imported in `src/main.tsx`.

- `--font-ui` **IBM Plex Sans** — labels, chrome, UI. Weights 400/500/600/700.
- `--font-mono` **IBM Plex Mono** — every measured value, IDs, HUD, ruler.
  `.mono` sets tabular-nums + slashed zero.

Scale: micro-label 10px uppercase (tracking ~0.05–0.16em); row/value 12.5–13px;
stat value 20px mono; selected id 18px; **primary Warning-Time readout 46px mono**
(the largest type on the page, by intent).

## Components & layout

Three regions: **command bar** (top), **road sensor-feed viewport** (hero, left),
**telemetry rail** (right, 328px). No footer.

- **Command bar** (`.cmd`, `CommandBar.tsx`): identity · transport (Start/Pause,
  Reset) · the scenario **Trigger emergency** (danger-tiered, pulses when active) ·
  a glanceable **fleet-risk readout** (Safe/Warn/Danger counts, cells that light
  only when non-zero) · run config (vehicles, seed) · RUN/PAUSE status. Tiered so
  primary actions read first, knobs sit last.
- **Viewport** (`.viewport`, `canvasRenderer.ts`): a labelled "ROAD SENSOR FEED"
  strip over a full-bleed canvas. The corridor **scales to fit** the width (one
  shared `viewTransform` drives drawing and hit-testing, so it never clips at any
  resolution). Instrument field = faint measurement grid + corner registration
  marks; a metre ruler under the road; an instrument HUD (CLK/TICK/VEH/STATUS)
  top-left. Overlays: cyan range ring + direct/relay links on the selected vehicle,
  violet RSU mast with coverage band, red emergency propagation pulse.
- **Telemetry rail** (`.rail`, `MetricsPanel.tsx`): sections separated by hairline
  rules (not cards), ordered by importance — **Warning time** (primary well) →
  V2V link → Protocol → Channel model → Edge node/RSU → Selected vehicle.
  Readouts are label-over-value `.stat` cells in a 2-col grid, or `.row` key/values;
  world-model peers render as signal chips (solid = direct, dashed = relayed).

Buttons `.ibtn`: flat, 3px radius, hairline border, icon + label. Primary = signal
fill; danger = danger-tinted, filled + pulse when armed. Controls (range thumb,
scrollbar, selection, focus ring, caret) are themed from the palette in `index.css`.

Icons are drawn SVG on a 16-unit grid, one 1.5px stroke (`ui/icons.tsx`) — no
emoji or unicode glyphs.

## Motion

Restrained. One authored moment: the **emergency** — the Trigger button and the
canvas braker pulse together on a ~1s ease. Everything else is instantaneous state
change. `prefers-reduced-motion` collapses all animation.

## Refused (category defaults this direction rejects)

Stacked rounded SaaS cards · gradients (incl. the old warning-panel gradient) ·
glass/blur · pill (999px) badges · decorative glow shadows · a marketing footer ·
emoji-as-icons · monospace-as-costume (mono here is for genuine measurement) ·
colour used without a single fixed meaning.

## Known follow-ups

- Verified: type-check, production build, console (clean), and the canvas hero in
  nominal + emergency states (rendered offscreen). The **DOM shell could not be
  rastered in this environment** (the preview pane does not composite headless);
  its design system was verified by computed styles and it awaits a live visual
  pass on the user's screen.
- Mobile (<900px) stacks viewport-over-rail; it is functional but the demo target
  is a projected desktop, so mobile density is not yet tuned.
