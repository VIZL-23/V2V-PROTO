/**
 * Controls — start / pause / reset / vehicle count.
 *
 * These call methods on the sim (held by App in a ref). They do NOT
 * hold simulation state themselves.
 */

interface ControlsProps {
  running: boolean;
  vehicleCount: number;
  seed: number;
  onToggleRun: () => void;
  onReset: () => void;
  onVehicleCountChange: (n: number) => void;
  onSeedChange: (s: number) => void;
}

export function Controls(props: ControlsProps) {
  const {
    running,
    vehicleCount,
    seed,
    onToggleRun,
    onReset,
    onVehicleCountChange,
    onSeedChange,
  } = props;

  return (
    <div className="controls">
      <button
        className={`btn btn-primary ${running ? 'btn-pause' : ''}`}
        onClick={onToggleRun}
      >
        {running ? '⏸  Pause' : '▶  Start'}
      </button>

      <button className="btn" onClick={onReset}>
        ⟲  Reset
      </button>

      <div className="control-group">
        <label htmlFor="vcount">Vehicles</label>
        <input
          id="vcount"
          type="range"
          min={2}
          max={30}
          step={1}
          value={vehicleCount}
          onChange={(e) => onVehicleCountChange(Number(e.target.value))}
        />
        <span className="control-value">{vehicleCount}</span>
      </div>

      <div className="control-group">
        <label htmlFor="seed">Seed</label>
        <input
          id="seed"
          type="number"
          value={seed}
          onChange={(e) => onSeedChange(Number(e.target.value) || 1)}
          className="seed-input"
        />
      </div>
    </div>
  );
}
