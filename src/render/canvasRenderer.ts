/**
 * Canvas renderer — the road sensor-feed.
 *
 * Rule: this is the ONLY place metres are converted to pixels. The sim knows
 * nothing about pixels; the UI knows nothing about metres.
 *
 * The corridor is scaled to FIT the viewport width (one shared transform drives
 * both drawing and hit-testing), so the whole 300 m road is always visible and
 * the demo survives any projector resolution.
 *
 * Colour is semantic and non-overlapping: SAFE green / WARNING amber /
 * DANGER red for risk, one cyan signal for interaction + direct links, violet
 * for the RSU. Nothing here is decorative.
 */

import { ROAD, ROAD_WIDTH_M, VEHICLE } from '../sim/config';
import type { World } from '../sim/world';
import type { Vehicle } from '../sim/vehicle';

const COLORS = {
  field: '#080b11',
  grid: '#10161f',
  frame: '#1c2430',
  reg: '#2b3646',
  asphalt: '#0c111a',
  asphaltEdge: '#141b26',
  shoulder: '#0a0e15',
  laneDash: '#2c3947',
  rail: '#38485a',
  text: '#e9edf3',
  dim: '#8592a3',
  faint: '#566373',
  signal: '#35c2e6',
  safe: '#33c98a',
  warn: '#f2b23d',
  danger: '#ff5666',
  rsu: '#8b80f2',
  ink: '#05070b',
} as const;

const MARGIN_X = 44;
const MAX_SCALE = 5.4;

export interface ViewTransform {
  scale: number; // px per metre
  ox: number; // road origin x (px)
  oy: number; // road origin y (px)
  roadW: number;
  roadH: number;
}

/** Fit the full corridor to the viewport width. Shared by draw + hit-testing. */
export function viewTransform(canvasWidth: number, canvasHeight: number): ViewTransform {
  const usableW = Math.max(140, canvasWidth - MARGIN_X * 2);
  const scale = Math.min(MAX_SCALE, usableW / ROAD.LENGTH_M);
  const roadW = ROAD.LENGTH_M * scale;
  const roadH = ROAD_WIDTH_M * scale;
  const ox = (canvasWidth - roadW) / 2;
  const oy = Math.max(64, (canvasHeight - roadH) / 2);
  return { scale, ox, oy, roadW, roadH };
}

export interface DrawOptions {
  selectedId?: string | null;
}

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  world: World,
  w: number,
  h: number,
  opts: DrawOptions = {}
): void {
  const t = viewTransform(w, h);
  const X = (m: number) => t.ox + m * t.scale;
  const Y = (m: number) => t.oy + m * t.scale;
  const L = (m: number) => m * t.scale;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = COLORS.field;
  ctx.fillRect(0, 0, w, h);

  drawInstrumentField(ctx, w, h);
  drawRoad(ctx, t, X, Y, L);
  drawRuler(ctx, t, X, L);

  const selected = opts.selectedId ? world.findVehicle(opts.selectedId) : undefined;

  drawRsu(ctx, world, X, Y, L);
  if (selected) drawChannelOverlay(ctx, world, selected, X, Y, L);
  if (world.emergencyBrakerId && world.emergencyStartMs !== null) {
    drawEmergencyPulse(ctx, world, X, Y, L);
  }

  for (const v of world.vehicles) drawVehicle(ctx, v, X, Y, L, v === selected);

  drawHud(ctx, world);
}

/* ---- instrument field: faint grid + registration marks ------------------ */
function drawInstrumentField(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.save();
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  const step = 40;
  ctx.beginPath();
  for (let x = (w % step) / 2; x < w; x += step) {
    ctx.moveTo(Math.round(x) + 0.5, 0);
    ctx.lineTo(Math.round(x) + 0.5, h);
  }
  for (let y = (h % step) / 2; y < h; y += step) {
    ctx.moveTo(0, Math.round(y) + 0.5);
    ctx.lineTo(w, Math.round(y) + 0.5);
  }
  ctx.stroke();

  // Corner registration marks.
  ctx.strokeStyle = COLORS.reg;
  ctx.lineWidth = 1.5;
  const m = 12;
  const len = 12;
  const corners: Array<[number, number, number, number]> = [
    [m, m, 1, 1],
    [w - m, m, -1, 1],
    [m, h - m, 1, -1],
    [w - m, h - m, -1, -1],
  ];
  ctx.beginPath();
  for (const [cx, cy, sx, sy] of corners) {
    ctx.moveTo(cx, cy + sy * len);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx + sx * len, cy);
  }
  ctx.stroke();
  ctx.restore();
}

/* ---- the road ----------------------------------------------------------- */
function drawRoad(
  ctx: CanvasRenderingContext2D,
  t: ViewTransform,
  X: (m: number) => number,
  Y: (m: number) => number,
  L: (m: number) => number
): void {
  const x = t.ox;
  const y = t.oy;
  const w = t.roadW;
  const h = t.roadH;

  ctx.fillStyle = COLORS.asphalt;
  ctx.fillRect(x, y, w, h);

  const shoulderPx = L(ROAD.SHOULDER_M);
  ctx.fillStyle = COLORS.shoulder;
  ctx.fillRect(x, y, w, shoulderPx);
  ctx.fillRect(x, y + h - shoulderPx, w, shoulderPx);

  // Lane dashes.
  const laneW = L(ROAD.LANE_WIDTH_M);
  ctx.strokeStyle = COLORS.laneDash;
  ctx.lineWidth = 1;
  ctx.setLineDash([L(3), L(4)]);
  ctx.beginPath();
  for (let i = 1; i < ROAD.LANES; i++) {
    const ly = Math.round(y + shoulderPx + i * laneW) + 0.5;
    ctx.moveTo(x, ly);
    ctx.lineTo(x + w, ly);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // Rails — bright hairlines at the road edges (the active track).
  ctx.strokeStyle = COLORS.rail;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, Math.round(y + shoulderPx) + 0.5);
  ctx.lineTo(x + w, Math.round(y + shoulderPx) + 0.5);
  ctx.moveTo(x, Math.round(y + h - shoulderPx) - 0.5);
  ctx.lineTo(x + w, Math.round(y + h - shoulderPx) - 0.5);
  ctx.stroke();

  // Faint frame around the whole corridor.
  ctx.strokeStyle = COLORS.frame;
  ctx.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, w, h);

  void X;
  void Y;
}

/* ---- metre ruler under the road ----------------------------------------- */
function drawRuler(
  ctx: CanvasRenderingContext2D,
  t: ViewTransform,
  X: (m: number) => number,
  L: (m: number) => number
): void {
  const baseY = t.oy + t.roadH + 10;
  ctx.save();
  ctx.strokeStyle = COLORS.frame;
  ctx.fillStyle = COLORS.faint;
  ctx.lineWidth = 1;
  ctx.font = "10px 'IBM Plex Mono', monospace";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  ctx.beginPath();
  ctx.moveTo(X(0), baseY + 0.5);
  ctx.lineTo(X(ROAD.LENGTH_M), baseY + 0.5);
  ctx.stroke();

  ctx.beginPath();
  for (let m = 0; m <= ROAD.LENGTH_M; m += 25) {
    const major = m % 50 === 0;
    const px = Math.round(X(m)) + 0.5;
    ctx.moveTo(px, baseY);
    ctx.lineTo(px, baseY + (major ? 6 : 3));
    if (major) ctx.fillText(String(m), X(m), baseY + 9);
  }
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.fillStyle = COLORS.dim;
  ctx.fillText('METRES', X(ROAD.LENGTH_M) + 8, baseY + 9);
  ctx.restore();
  void L;
}

/* ---- RSU ---------------------------------------------------------------- */
function drawRsu(
  ctx: CanvasRenderingContext2D,
  world: World,
  X: (m: number) => number,
  Y: (m: number) => number,
  L: (m: number) => number
): void {
  const rsu = world.rsu;
  const cx = X(rsu.x);
  const roadTop = Y(0);
  const congested = world.edgeStats.congestion;
  const color = congested ? COLORS.danger : COLORS.rsu;

  ctx.save();
  // Coverage band.
  const cov = L(rsu.rangeM);
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.04;
  ctx.fillRect(cx - cov, roadTop, cov * 2, L(ROAD_WIDTH_M));
  ctx.globalAlpha = 1;

  // Mast above the road.
  const mastY = roadTop - 18;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx, roadTop);
  ctx.lineTo(cx, mastY);
  ctx.stroke();
  for (let i = 1; i <= 2; i++) {
    ctx.globalAlpha = 0.55 / i;
    ctx.beginPath();
    ctx.arc(cx, mastY, 3 + i * 4, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(cx, mastY, 2.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = "600 10px 'IBM Plex Mono', monospace";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(congested ? 'RSU · CONGESTION' : 'RSU', cx, mastY - 11);
  ctx.restore();
}

/* ---- channel overlay for the selected vehicle --------------------------- */
function drawChannelOverlay(
  ctx: CanvasRenderingContext2D,
  world: World,
  sel: Vehicle,
  X: (m: number) => number,
  Y: (m: number) => number,
  L: (m: number) => number
): void {
  const cx = X(sel.x);
  const cy = Y(sel.y);

  ctx.save();
  // Range ring.
  ctx.strokeStyle = COLORS.signal;
  ctx.globalAlpha = 0.4;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.arc(cx, cy, L(world.channel.cfg.rangeM), 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  // Links to the world model — solid = direct, dashed = relayed.
  ctx.lineWidth = 1.25;
  for (const known of sel.worldModel.values()) {
    const direct = known.hops === 0;
    const kx = X(known.pos.x);
    const ky = Y(known.pos.y);
    ctx.strokeStyle = COLORS.signal;
    ctx.globalAlpha = direct ? 0.55 : 0.4;
    ctx.setLineDash(direct ? [] : [3, 3]);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(kx, ky);
    ctx.stroke();
    if (!direct) {
      ctx.beginPath();
      ctx.arc(kx, ky, 5, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.setLineDash([]);
  ctx.restore();
}

/* ---- emergency propagation pulse ---------------------------------------- */
function drawEmergencyPulse(
  ctx: CanvasRenderingContext2D,
  world: World,
  X: (m: number) => number,
  Y: (m: number) => number,
  L: (m: number) => number
): void {
  const braker = world.findVehicle(world.emergencyBrakerId!);
  if (!braker || world.emergencyStartMs === null) return;
  const cx = X(braker.x);
  const cy = Y(braker.y);
  const elapsed = world.simClockMs - world.emergencyStartMs;
  const period = 1000;
  const maxR = L(120);

  ctx.save();
  ctx.strokeStyle = COLORS.danger;
  ctx.lineWidth = 1.5;
  for (let k = 0; k < 2; k++) {
    const phase = ((((elapsed - k * (period / 2)) % period) + period) % period) / period;
    ctx.globalAlpha = (1 - phase) * 0.4;
    ctx.beginPath();
    ctx.arc(cx, cy, phase * maxR, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

/* ---- a vehicle ---------------------------------------------------------- */
function riskColor(v: Vehicle): string {
  return v.status === 'EMERGENCY' ? COLORS.danger : v.status === 'WARNING' ? COLORS.warn : COLORS.safe;
}

function drawVehicle(
  ctx: CanvasRenderingContext2D,
  v: Vehicle,
  X: (m: number) => number,
  Y: (m: number) => number,
  L: (m: number) => number,
  selected: boolean
): void {
  const cx = X(v.x);
  const cy = Y(v.y);
  const w = L(VEHICLE.LENGTH_M);
  const h = Math.max(6, L(VEHICLE.WIDTH_M));
  const fill = riskColor(v);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(v.heading);

  if (selected) {
    ctx.strokeStyle = COLORS.signal;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-w / 2 - 3, -h / 2 - 3, w + 6, h + 6);
  }

  ctx.fillStyle = fill;
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1;
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.strokeRect(-w / 2, -h / 2, w, h);

  // Heading nib.
  ctx.fillStyle = COLORS.ink;
  ctx.beginPath();
  ctx.moveTo(w / 2 - 1, 0);
  ctx.lineTo(w / 2 - Math.min(5, w * 0.3), -h / 2 + 1.5);
  ctx.lineTo(w / 2 - Math.min(5, w * 0.3), h / 2 - 1.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Label above.
  ctx.fillStyle = selected ? COLORS.signal : COLORS.dim;
  ctx.font = "500 10px 'IBM Plex Mono', monospace";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(v.id, cx, cy - h / 2 - 4);

  // TTC readout below at-risk cars.
  if (v.status !== 'NORMAL' && v.ttc !== null && Number.isFinite(v.ttc)) {
    ctx.fillStyle = fill;
    ctx.font = "600 9px 'IBM Plex Mono', monospace";
    ctx.textBaseline = 'top';
    ctx.fillText(`${v.ttc.toFixed(1)}s`, cx, cy + h / 2 + 4);
  }
}

/* ---- instrument HUD (top-left) ------------------------------------------ */
function worstStatus(world: World): 'NORMAL' | 'WARNING' | 'EMERGENCY' {
  let worst: 'NORMAL' | 'WARNING' | 'EMERGENCY' = 'NORMAL';
  for (const v of world.vehicles) {
    if (v.status === 'EMERGENCY') return 'EMERGENCY';
    if (v.status === 'WARNING') worst = 'WARNING';
  }
  return worst;
}

function drawHud(ctx: CanvasRenderingContext2D, world: World): void {
  const pad = 14;
  const x = pad + 8;
  let y = pad + 8;
  const line = 15;

  const status = worstStatus(world);
  const statusColor =
    status === 'EMERGENCY' ? COLORS.danger : status === 'WARNING' ? COLORS.warn : COLORS.safe;
  const statusLabel = status === 'EMERGENCY' ? 'DANGER' : status === 'WARNING' ? 'WARNING' : 'NOMINAL';

  ctx.save();
  ctx.textBaseline = 'alphabetic';

  const rows: Array<[string, string, string]> = [
    ['CLK', `${(world.simClockMs / 1000).toFixed(2)}s`, COLORS.text],
    ['TICK', String(world.tickCount), COLORS.text],
    ['VEH', String(world.vehicles.length), COLORS.text],
    ['STATUS', statusLabel, statusColor],
  ];

  ctx.font = "500 10px 'IBM Plex Mono', monospace";
  for (const [label, value, color] of rows) {
    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.faint;
    ctx.fillText(label, x, y);
    ctx.textAlign = 'left';
    ctx.fillStyle = color;
    ctx.font = "600 11px 'IBM Plex Mono', monospace";
    ctx.fillText(value, x + 42, y);
    ctx.font = "500 10px 'IBM Plex Mono', monospace";
    y += line;
  }
  ctx.restore();
}
