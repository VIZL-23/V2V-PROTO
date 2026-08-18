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
} as const;

const m2px = (m: number) => m * RENDER.PX_PER_M;

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  world: World,
  canvasWidth: number,
  canvasHeight: number
): void {
  // Canvas coord system: we draw the road horizontally.
  // World: x is along road (0..LENGTH_M), y is across road (0..ROAD_WIDTH_M).

  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  // The road is scaled to fit horizontally.
  // If the road is longer than the canvas allows, PX_PER_M would need tuning.
  const roadPxW = m2px(ROAD.LENGTH_M);
  const roadPxH = m2px(ROAD_WIDTH_M);

  // Centre the road vertically in the canvas.
  const originX = 0;
  const originY = Math.max(0, (canvasHeight - roadPxH) / 2);

  drawRoad(ctx, originX, originY, roadPxW, roadPxH);

  // Vehicles.
  for (const v of world.vehicles) {
    drawVehicle(ctx, v, originX, originY);
  }

  // HUD text.
  drawHud(ctx, world, canvasWidth, canvasHeight);
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
  originY: number
): void {
  const cx = originX + m2px(v.x);
  const cy = originY + m2px(v.y);
  const w = m2px(VEHICLE.LENGTH_M);
  const h = m2px(VEHICLE.WIDTH_M);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(v.heading);

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
