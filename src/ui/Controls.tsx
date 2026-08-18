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
  emergencyActive: boolean;
  selectedId: string | null;
  onToggleRun: () => void;
  onReset: () => void;
  onTriggerEmergency: () => void;
  onVehicleCountChange: (n: number) => void;
  onSeedChange: (s: number) => void;
}

export function Controls(props: ControlsProps) {
  const {
    running,
    vehicleCount,
    seed,
    emergencyActive,
    selectedId,
    onToggleRun,
    onReset,
    onTriggerEmergency,
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

      <button
        className={`btn btn-emergency ${emergencyActive ? 'btn-emergency-active' : ''}`}
        onClick={onTriggerEmergency}
        title={selectedId ? `Trigger on ${selectedId}` : 'Trigger on the front car'}
      >
        {emergencyActive
          ? '✖  Clear Emergency'
          : `🚨  Trigger Emergency${selectedId ? ` (${selectedId})` : ''}`}
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
