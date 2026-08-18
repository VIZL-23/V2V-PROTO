/**
 * App shell — canvas + controls.
 *
 * Design rules baked in here (from the workflow doc, §11):
 *
 *   1. Simulation state is NEVER in React state. It lives in a ref (`worldRef`).
 *      React state holds ONLY UI-observable things: is it running, seed, count.
 *
 *   2. The rAF loop accumulates real elapsed time and calls world.step()
 *      in fixed 50ms increments. Rendering runs at rAF cadence (whatever the
 *      monitor is doing). Physics does NOT.
 *
 *   3. HUD text and controls re-render on React state changes, not per frame.
 *      A throttled subscription for a metric panel comes in a later phase.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { World } from './sim/world';
import { SIM, VEHICLE } from './sim/config';
import { drawFrame } from './render/canvasRenderer';
import { Controls } from './ui/Controls';
import './App.css';

export function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const worldRef = useRef<World | null>(null);
  const runningRef = useRef(false);
  const rafIdRef = useRef<number | null>(null);
  const lastRealTimeMsRef = useRef<number | null>(null);
  const accumulatorMsRef = useRef(0);

  const [running, setRunning] = useState(false);
  const [vehicleCount, setVehicleCount] = useState(VEHICLE.DEFAULT_COUNT);
  const [seed, setSeed] = useState(42);

  // --- Sim (re)creation ------------------------------------------------------
  const buildWorld = useCallback(() => {
    worldRef.current = new World({ seed, vehicleCount });
    accumulatorMsRef.current = 0;
    lastRealTimeMsRef.current = null;
  }, [seed, vehicleCount]);

  // Rebuild the world whenever seed or vehicleCount changes.
  useEffect(() => {
    buildWorld();
    // Immediately draw the paused initial frame so the user sees the effect.
    requestAnimationFrame(() => drawOnce());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, vehicleCount]);

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

  // --- Draw one frame from the current world state --------------------------
  const drawOnce = useCallback(() => {
    const canvas = canvasRef.current;
    const world = worldRef.current;
    if (!canvas || !world) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    drawFrame(ctx, world, rect.width, rect.height);
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
      while (
        accumulatorMsRef.current >= SIM.STEP_MS &&
        safetyBudget-- > 0
      ) {
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
    drawOnce();
    if (wasRunning) start();
  }, [pause, start, drawOnce]);

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
          <span className="brand-sub">Phase 1 · Road &amp; Motion</span>
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
        onToggleRun={toggleRun}
        onReset={reset}
        onVehicleCountChange={setVehicleCount}
        onSeedChange={setSeed}
      />

      <div className="canvas-wrap">
        <canvas ref={canvasRef} className="road-canvas" />
      </div>

      <footer className="app-footer">
        Fixed timestep {SIM.STEP_MS}ms · Seeded PRNG · Physics decoupled from render ·
        Reset ⟲ produces an identical run.
      </footer>
    </div>
  );
}
