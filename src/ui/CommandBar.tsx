/**
 * CommandBar — the single top rail. Identity, transport, the scenario trigger,
 * a glanceable fleet-risk readout, and the run configuration, tiered so the
 * primary actions read first and the knobs sit quietly at the end.
 */

import { IconAlert, IconClear, IconNode, IconPause, IconPlay, IconReset, IconVehicle } from './icons';

interface Fleet {
  safe: number;
  warning: number;
  danger: number;
}

interface CommandBarProps {
  running: boolean;
  vehicleCount: number;
  seed: number;
  emergencyActive: boolean;
  selectedId: string | null;
  fleet: Fleet;
  onToggleRun: () => void;
  onReset: () => void;
  onTriggerEmergency: () => void;
  onVehicleCountChange: (n: number) => void;
  onSeedChange: (s: number) => void;
}

export function CommandBar(props: CommandBarProps) {
  const {
    running,
    vehicleCount,
    seed,
    emergencyActive,
    selectedId,
    fleet,
    onToggleRun,
    onReset,
    onTriggerEmergency,
    onVehicleCountChange,
    onSeedChange,
  } = props;

  return (
    <header className="cmd">
      <div className="cmd-brand">
        <span className="cmd-mark">
          <IconNode size={17} />
        </span>
        <span className="cmd-word">
          VahaanSetu<span className="cmd-word-dim">·</span>
        </span>
        <span className="cmd-tagline">Decentralized V2V telemetry</span>
      </div>

      <div className="cmd-sep" />

      <div className="cmd-group">
        <button
          className={`ibtn ${running ? 'ibtn-armed' : 'ibtn-primary'}`}
          onClick={onToggleRun}
        >
          {running ? <IconPause /> : <IconPlay />}
          {running ? 'Pause' : 'Start'}
        </button>
        <button className="ibtn" onClick={onReset}>
          <IconReset />
          Reset
        </button>
      </div>

      <button
        className={`ibtn ibtn-danger ${emergencyActive ? 'ibtn-danger-active' : ''}`}
        onClick={onTriggerEmergency}
        title={selectedId ? `Trigger on ${selectedId}` : 'Trigger on the front vehicle'}
      >
        {emergencyActive ? <IconClear /> : <IconAlert />}
        {emergencyActive
          ? 'Clear emergency'
          : `Trigger emergency${selectedId ? ` · ${selectedId}` : ''}`}
      </button>

      <div className="cmd-fleet" role="status" aria-label="fleet risk">
        <FleetCell label="Safe" value={fleet.safe} tone="safe" />
        <FleetCell label="Warn" value={fleet.warning} tone="warn" />
        <FleetCell label="Danger" value={fleet.danger} tone="danger" />
      </div>

      <div className="cmd-spacer" />

      <div className="cmd-config">
        <label className="cmd-field">
          <span className="cmd-field-label">
            <IconVehicle size={13} /> Veh
          </span>
          <input
            type="range"
            min={2}
            max={30}
            step={1}
            value={vehicleCount}
            onChange={(e) => onVehicleCountChange(Number(e.target.value))}
          />
          <span className="cmd-field-value mono">{vehicleCount}</span>
        </label>
        <label className="cmd-field">
          <span className="cmd-field-label">Seed</span>
          <input
            type="number"
            className="cmd-seed mono"
            value={seed}
            onChange={(e) => onSeedChange(Number(e.target.value) || 1)}
          />
        </label>
      </div>

      <div className={`cmd-run ${running ? 'cmd-run-live' : ''}`}>
        <span className="cmd-run-dot" />
        {running ? 'RUNNING' : 'PAUSED'}
      </div>
    </header>
  );
}

function FleetCell(props: { label: string; value: number; tone: 'safe' | 'warn' | 'danger' }) {
  const active = props.value > 0;
  return (
    <div className={`fleet-cell fleet-${props.tone}${active ? ' is-active' : ''}`}>
      <span className="fleet-value mono">{props.value}</span>
      <span className="fleet-label">{props.label}</span>
    </div>
  );
}
