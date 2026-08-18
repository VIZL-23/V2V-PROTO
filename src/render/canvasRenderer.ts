/**
 * Canvas renderer.
 *
 * Rule: this is the ONLY place metres are converted to pixels.
 * The sim knows nothing about pixels; the UI knows nothing about metres.
 */

import { RENDER, ROAD, ROAD_WIDTH_M, VEHICLE } from '../sim/config';
import type { World } from '../sim/world';
import type { Vehicle } from '../sim/vehicle';

const COLORS = {
  bgAsphalt: '#1a2233',
  shoulder: '#2a3247',
  laneDash: '#e6ecf8',
  centerLine: '#ffb020',
  vehicleNormal: '#29b6d8',
  vehicleWarning: '#ffb020',
  vehicleEmergency: '#ff5b5b',
  vehicleOutline: '#0b1220',
  vehicleHeading: '#0b1220',
  vehicleLabel: '#e6ecf8',
  hudLabel: '#8ea1c9',
  rangeRing: '#29b6d8',
  linkDirect: '#29d391', // heard directly (0 hops)
  linkRelayed: '#ffb020', // heard via relay (multi-hop)
  selectHalo: '#ffffff',
} as const;

const m2px = (m: number) => m * RENDER.PX_PER_M;

export interface DrawOptions {
  /** Vehicle to highlight, draw a range ring around, and link to neighbours. */
  selectedId?: string | null;
}

/** Shared origin math so hit-testing in the UI matches what's drawn. */
export function roadOrigin(canvasHeight: number): { x: number; y: number } {
  const roadPxH = m2px(ROAD_WIDTH_M);
  return { x: 0, y: Math.max(0, (canvasHeight - roadPxH) / 2) };
}

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  world: World,
  canvasWidth: number,
  canvasHeight: number,
  opts: DrawOptions = {}
): void {
  // Canvas coord system: we draw the road horizontally.
  // World: x is along road (0..LENGTH_M), y is across road (0..ROAD_WIDTH_M).

  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  // The road is scaled to fit horizontally.
  // If the road is longer than the canvas allows, PX_PER_M would need tuning.
  const roadPxW = m2px(ROAD.LENGTH_M);
  const roadPxH = m2px(ROAD_WIDTH_M);

  // Centre the road vertically in the canvas.
  const { x: originX, y: originY } = roadOrigin(canvasHeight);

  drawRoad(ctx, originX, originY, roadPxW, roadPxH);

  // Channel overlay: range ring + links from the selected vehicle. Drawn under
  // the vehicles so the cars stay crisp on top.
  const selected = opts.selectedId ? world.findVehicle(opts.selectedId) : undefined;
  if (selected) {
    drawChannelOverlay(ctx, world, selected, originX, originY);
  }

  // Emergency propagation pulse (drawn under the cars).
  if (world.emergencyBrakerId && world.emergencyStartMs !== null) {
    drawEmergencyPulse(ctx, world, originX, originY);
  }

  // Vehicles.
  for (const v of world.vehicles) {
    drawVehicle(ctx, v, originX, originY, v === selected);
  }

  // HUD text.
  drawHud(ctx, world, canvasWidth, canvasHeight);
}

/**
 * Expanding "sonar" ring from the emergency braker — a visual for the warning
 * spreading outward from where the braking started. Purely decorative; the
 * real propagation is the red/amber wave in the cars themselves.
 */
function drawEmergencyPulse(
  ctx: CanvasRenderingContext2D,
  world: World,
  originX: number,
  originY: number
): void {
  const braker = world.findVehicle(world.emergencyBrakerId!);
  if (!braker || world.emergencyStartMs === null) return;

  const cx = originX + m2px(braker.x);
  const cy = originY + m2px(braker.y);
  const elapsed = world.simClockMs - world.emergencyStartMs;
  const period = 1000; // ms per pulse
  const maxR = m2px(140);

  ctx.save();
  for (let k = 0; k < 2; k++) {
    const phase = (((elapsed - k * (period / 2)) % period) + period) % period / period;
    const r = phase * maxR;
    ctx.globalAlpha = (1 - phase) * 0.35;
    ctx.strokeStyle = COLORS.vehicleEmergency;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Range ring around the selected vehicle plus a link to every car in its LOCAL
 * WORLD MODEL — what it has actually heard, coloured by how it heard it:
 * green = directly, amber = via a relay. Amber links reaching cars OUTSIDE the
 * range ring are the visible proof of multi-hop propagation: the vehicle knows
 * about traffic it can't reach on its own.
 */
function drawChannelOverlay(
  ctx: CanvasRenderingContext2D,
  world: World,
  sel: Vehicle,
  originX: number,
  originY: number
): void {
  const cx = originX + m2px(sel.x);
  const cy = originY + m2px(sel.y);
  const rangePx = m2px(world.channel.cfg.rangeM);

  ctx.save();

  // Range ring + faint disc.
  ctx.strokeStyle = COLORS.rangeRing;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.arc(cx, cy, rangePx, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 0.06;
  ctx.fillStyle = COLORS.rangeRing;
  ctx.fill();

  // Links to everything in the world model, drawn to the position THIS vehicle
  // believes each car is at (i.e. the last message it heard).
  ctx.lineWidth = 1.25;
  for (const known of sel.worldModel.values()) {
    const direct = known.hops === 0;
    ctx.strokeStyle = direct ? COLORS.linkDirect : COLORS.linkRelayed;
    ctx.globalAlpha = direct ? 0.5 : 0.75;
    const kx = originX + m2px(known.pos.x);
    const ky = originY + m2px(known.pos.y);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(kx, ky);
    ctx.stroke();
    // Small ring on relayed peers so multi-hop knowledge is obvious.
    if (!direct) {
      ctx.beginPath();
      ctx.arc(kx, ky, 6, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawRoad(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  // Full road surface.
  ctx.fillStyle = COLORS.bgAsphalt;
  ctx.fillRect(x, y, w, h);

  // Shoulders (top and bottom).
  const shoulderPx = m2px(ROAD.SHOULDER_M);
  ctx.fillStyle = COLORS.shoulder;
  ctx.fillRect(x, y, w, shoulderPx);
  ctx.fillRect(x, y + h - shoulderPx, w, shoulderPx);

  // Lane markings.
  // Between lanes: dashed white.
  const laneW = m2px(ROAD.LANE_WIDTH_M);
  ctx.strokeStyle = COLORS.laneDash;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([16, 14]);
  for (let i = 1; i < ROAD.LANES; i++) {
    const ly = y + shoulderPx + i * laneW;
    ctx.beginPath();
    ctx.moveTo(x, ly);
    ctx.lineTo(x + w, ly);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Solid edge lines just inside the shoulders.
  ctx.strokeStyle = COLORS.laneDash;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.4;
  ctx.beginPath();
  ctx.moveTo(x, y + shoulderPx);
  ctx.lineTo(x + w, y + shoulderPx);
  ctx.moveTo(x, y + h - shoulderPx);
  ctx.lineTo(x + w, y + h - shoulderPx);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawVehicle(
  ctx: CanvasRenderingContext2D,
  v: Vehicle,
  originX: number,
  originY: number,
  selected: boolean
): void {
  const cx = originX + m2px(v.x);
  const cy = originY + m2px(v.y);
  const w = m2px(VEHICLE.LENGTH_M);
  const h = m2px(VEHICLE.WIDTH_M);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(v.heading);

  // Selection halo.
  if (selected) {
    ctx.save();
    ctx.strokeStyle = COLORS.selectHalo;
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = 2;
    roundRect(ctx, -w / 2 - 3, -h / 2 - 3, w + 6, h + 6, 4);
    ctx.stroke();
    ctx.restore();
  }

  // Body — rounded rectangle.
  const fill =
    v.status === 'EMERGENCY'
      ? COLORS.vehicleEmergency
      : v.status === 'WARNING'
      ? COLORS.vehicleWarning
      : COLORS.vehicleNormal;

  ctx.fillStyle = fill;
  ctx.strokeStyle = COLORS.vehicleOutline;
  ctx.lineWidth = 1;
  roundRect(ctx, -w / 2, -h / 2, w, h, 2.5);
  ctx.fill();
  ctx.stroke();

  // Heading indicator — a small dark triangle at the front.
  const fx = w / 2 - 2;
  ctx.fillStyle = COLORS.vehicleHeading;
  ctx.beginPath();
  ctx.moveTo(fx, 0);
  ctx.lineTo(fx - 5, -h / 2 + 1.5);
  ctx.lineTo(fx - 5, h / 2 - 1.5);
  ctx.closePath();
  ctx.fill();

  ctx.restore();

  // Vehicle ID label above the car (in screen space, not rotated).
  ctx.fillStyle = COLORS.vehicleLabel;
  ctx.font = '10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(v.id, cx, cy - h / 2 - 4);

  // TTC readout below at-risk cars — the risk engine made visible.
  if (v.status !== 'NORMAL' && v.ttc !== null && Number.isFinite(v.ttc)) {
    ctx.fillStyle = v.status === 'EMERGENCY' ? COLORS.vehicleEmergency : COLORS.vehicleWarning;
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText(`TTC ${v.ttc.toFixed(1)}s`, cx, cy + h / 2 + 3);
  }
}

function drawHud(
  ctx: CanvasRenderingContext2D,
  world: World,
  _canvasWidth: number,
  canvasHeight: number
): void {
  ctx.fillStyle = COLORS.hudLabel;
  ctx.font = '11px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  const t = (world.simClockMs / 1000).toFixed(2);
  ctx.fillText(
    `t=${t}s   tick=${world.tickCount}   vehicles=${world.vehicles.length}`,
    12,
    canvasHeight - 10
  );
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
