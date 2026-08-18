/**
 * App shell — canvas + controls + live metrics (Phases 1–2).
 *
 * Design rules baked in here (from the workflow doc, §11):
 *
 *   1. Simulation state is NEVER in React state. It lives in a ref (`worldRef`).
 *      React state holds ONLY UI-observable things: is it running, seed, count,
 *      selection, channel range, and the latest metrics SNAPSHOT.
 *
 *   2. The rAF loop accumulates real elapsed time and calls world.step()
 *      in fixed 50ms increments. Rendering runs at rAF cadence. Physics does NOT.
 *
 *   3. Two independent clocks on purpose: the canvas redraws every frame, but
 *      the React metrics panel re-renders on a THROTTLED 10 Hz subscription.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { World } from './sim/world';
import { CHANNEL, RENDER, ROAD, ROAD_WIDTH_M, SIM, VEHICLE } from './sim/config';
import type { MetricsSnapshot } from './sim/metrics';
import { drawFrame, roadOrigin } from './render/canvasRenderer';
import { Controls } from './ui/Controls';
import { MetricsPanel } from './ui/MetricsPanel';
import './App.css';

/** What the throttled subscription publishes to the metrics panel. */
interface PanelState {
  metrics: MetricsSnapshot;
  selected:
    | {
        id: string;
        inRange: number;
        link: ReturnType<World['metrics']['snapshotFor']>;
        known: { id: string; hops: number }[];
        riskLevel: import('./risk/risk').RiskLevel;
        ttc: number | null;
        gap: number | null;
        dSafe: number;
        insideSafe: boolean;
      }
    | null;
  scenario: { emergencyActive: boolean; brakerId: string | null; warningTimeMs: number | null };
}

/** Grab radius (metres) for click-to-select. */
const PICK_RADIUS_M = 6;

export function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const worldRef = useRef<World | null>(null);
  const runningRef = useRef(false);
  const rafIdRef = useRef<number | null>(null);
  const lastRealTimeMsRef = useRef<number | null>(null);
  const accumulatorMsRef = useRef(0);
  const draggingIdRef = useRef<string | null>(null);

  const [running, setRunning] = useState(false);
  const [vehicleCount, setVehicleCount] = useState(VEHICLE.DEFAULT_COUNT);
  const [seed, setSeed] = useState(42);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [channelRange, setChannelRange] = useState(CHANNEL.RANGE_M);
  const [panel, setPanel] = useState<PanelState | null>(null);

  // Refs mirror state the rAF/draw closures need to read at their latest value.
  const selectedIdRef = useRef<string | null>(null);
  const channelRangeRef = useRef(channelRange);
  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);
  useEffect(() => { channelRangeRef.current = channelRange; }, [channelRange]);

  // --- Sim (re)creation ------------------------------------------------------
  const buildWorld = useCallback(() => {
    const world = new World({ seed, vehicleCount });
    world.channel.cfg.rangeM = channelRangeRef.current;
    worldRef.current = world;
    accumulatorMsRef.current = 0;
    lastRealTimeMsRef.current = null;
    draggingIdRef.current = null;
  }, [seed, vehicleCount]);

  // Rebuild the world whenever seed or vehicleCount changes.
  useEffect(() => {
    buildWorld();
    setPanel(null);
    requestAnimationFrame(() => drawOnce());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, vehicleCount]);

  // Live channel-range control: no rebuild, just retune the running channel.
  useEffect(() => {
    const world = worldRef.current;
    if (world) {
      world.channel.cfg.rangeM = channelRange;
      if (!runningRef.current) drawOnce();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelRange]);

  // --- Canvas sizing ---------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawOnce();
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Throttled 10 Hz metrics subscription ---------------------------------
  useEffect(() => {
    const id = window.setInterval(() => {
      const world = worldRef.current;
      if (!world) return;
      const selId = selectedIdRef.current;
      const selVehicle = selId ? world.findVehicle(selId) : undefined;
      const selected = selVehicle
        ? {
            id: selVehicle.id,
            inRange: world.inRangeCount(selVehicle.id),
            link: world.metrics.snapshotFor(selVehicle.id),
            known: [...selVehicle.worldModel.values()].map((k) => ({ id: k.id, hops: k.hops })),
            riskLevel: selVehicle.riskLevel,
            ttc: selVehicle.ttc,
            gap: selVehicle.gap,
            dSafe: selVehicle.dSafe,
            insideSafe: selVehicle.insideSafe,
          }
        : null;
      setPanel({
        metrics: world.metrics.snapshot(),
        selected,
        scenario: {
          emergencyActive: world.emergencyBrakerId !== null,
          brakerId: world.emergencyBrakerId,
          warningTimeMs: world.warningTimeMs,
        },
      });
    }, 100);
    return () => window.clearInterval(id);
  }, []);

  // --- Draw one frame from the current world state --------------------------
  const drawOnce = useCallback(() => {
    const canvas = canvasRef.current;
    const world = worldRef.current;
    if (!canvas || !world) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    drawFrame(ctx, world, rect.width, rect.height, { selectedId: selectedIdRef.current });
  }, []);

  // --- Main loop ------------------------------------------------------------
  const tick = useCallback(
    (nowMs: number) => {
      if (!runningRef.current) return;

      const world = worldRef.current;
      if (!world) return;

      if (lastRealTimeMsRef.current == null) {
        lastRealTimeMsRef.current = nowMs;
      }
      let elapsed = nowMs - lastRealTimeMsRef.current;
      lastRealTimeMsRef.current = nowMs;

      // Guard against absurd deltas (tab was backgrounded).
      if (elapsed > SIM.MAX_ACCUMULATOR_MS) elapsed = SIM.MAX_ACCUMULATOR_MS;
      accumulatorMsRef.current += elapsed;

      // Fixed-step physics: run as many steps as fit into elapsed time.
      let safetyBudget = 20; // hard cap on steps per frame
      while (accumulatorMsRef.current >= SIM.STEP_MS && safetyBudget-- > 0) {
        world.step();
        accumulatorMsRef.current -= SIM.STEP_MS;
      }

      drawOnce();
      rafIdRef.current = requestAnimationFrame(tick);
    },
    [drawOnce]
  );

  // --- Control handlers ------------------------------------------------------
  const start = useCallback(() => {
    if (runningRef.current) return;
    runningRef.current = true;
    setRunning(true);
    lastRealTimeMsRef.current = null;
    rafIdRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const pause = useCallback(() => {
    runningRef.current = false;
    setRunning(false);
    if (rafIdRef.current != null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  }, []);

  const toggleRun = useCallback(() => {
    if (runningRef.current) pause();
    else start();
  }, [pause, start]);

  const reset = useCallback(() => {
    const wasRunning = runningRef.current;
    if (wasRunning) pause();
    worldRef.current?.reset();
    accumulatorMsRef.current = 0;
    lastRealTimeMsRef.current = null;
    draggingIdRef.current = null;
    drawOnce();
    if (wasRunning) start();
  }, [pause, start, drawOnce]);

  const toggleEmergency = useCallback(() => {
    const world = worldRef.current;
    if (!world) return;
    if (world.emergencyBrakerId !== null) {
      world.clearEmergency();
    } else {
      world.triggerEmergency(selectedIdRef.current ?? undefined);
    }
    if (!runningRef.current) drawOnce();
  }, [drawOnce]);

  // --- Canvas pointer: click-to-select + drag a car -------------------------
  /** Convert a pointer event to world metres, matching the renderer's origin. */
  const eventToWorld = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const origin = roadOrigin(rect.height);
    return {
      xM: (e.clientX - rect.left - origin.x) / RENDER.PX_PER_M,
      yM: (e.clientY - rect.top - origin.y) / RENDER.PX_PER_M,
    };
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const world = worldRef.current;
      if (!world) return;
      const { xM, yM } = eventToWorld(e);
      const hit = world.pickVehicleAt(xM, yM, PICK_RADIUS_M);
      if (hit) {
        setSelectedId(hit.id);
        selectedIdRef.current = hit.id;
        draggingIdRef.current = hit.id;
        hit.held = true;
        canvasRef.current?.setPointerCapture(e.pointerId);
      } else {
        setSelectedId(null);
        selectedIdRef.current = null;
      }
      drawOnce();
    },
    [drawOnce, eventToWorld]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const id = draggingIdRef.current;
      const world = worldRef.current;
      if (!id || !world) return;
      const v = world.findVehicle(id);
      if (!v) return;
      const { xM, yM } = eventToWorld(e);
      // Wrap along the road; clamp across it so the car stays on the surface.
      v.x = ((xM % ROAD.LENGTH_M) + ROAD.LENGTH_M) % ROAD.LENGTH_M;
      v.y = clamp(yM, VEHICLE.WIDTH_M / 2, ROAD_WIDTH_M - VEHICLE.WIDTH_M / 2);
      if (!runningRef.current) drawOnce();
    },
    [drawOnce, eventToWorld]
  );

  const endDrag = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const id = draggingIdRef.current;
    if (!id) return;
    const v = worldRef.current?.findVehicle(id);
    if (v) v.held = false;
    draggingIdRef.current = null;
    canvasRef.current?.releasePointerCapture(e.pointerId);
  }, []);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      if (rafIdRef.current != null) cancelAnimationFrame(rafIdRef.current);
    };
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-dot" />
          <span className="brand-title">V2V-SIH</span>
          <span className="brand-sub">Phase 4 · Risk &amp; Hero Scenario</span>
        </div>
        <div className="status">
          <span className={`status-dot ${running ? 'status-run' : 'status-pause'}`} />
          {running ? 'RUNNING' : 'PAUSED'}
        </div>
      </header>

      <Controls
        running={running}
        vehicleCount={vehicleCount}
        seed={seed}
        emergencyActive={panel?.scenario.emergencyActive ?? false}
        selectedId={selectedId}
        onToggleRun={toggleRun}
        onReset={reset}
        onTriggerEmergency={toggleEmergency}
        onVehicleCountChange={setVehicleCount}
        onSeedChange={setSeed}
      />

      <div className="stage">
        <div className="canvas-wrap">
          <canvas
            ref={canvasRef}
            className="road-canvas"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          />
        </div>
        <MetricsPanel
          metrics={panel?.metrics ?? null}
          channelRange={channelRange}
          onRangeChange={setChannelRange}
          selected={panel?.selected ?? null}
          scenario={panel?.scenario ?? { emergencyActive: false, brakerId: null, warningTimeMs: null }}
        />
      </div>

      <footer className="app-footer">
        Risk (TTC + RSS-lite) computed inside each vehicle · 🚨 trigger to watch
        brake → broadcast → DANGER → propagate · warning time is the headline number.
      </footer>
    </div>
  );
}

function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}
