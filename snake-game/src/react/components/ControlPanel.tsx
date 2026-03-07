// ─── ControlPanel ───────────────────────────────────────────────────────────
// Bottom console bar: START/PAUSE button + settings access

import EventBridge, { GameEvents } from '../../game/systems/EventBridge';
import { useGameContext } from '../context/GameContext';
import { useGameState } from '../hooks/useGameState';
import '../../styles/control-panel.css';

/* ── SVG Icons ─────────────────────────────────────────────────────────── */

const PlayIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M8 5v14l11-7z" />
  </svg>
);

const PauseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="4" width="4" height="16" />
    <rect x="14" y="4" width="4" height="16" />
  </svg>
);

const SettingsIcon = () => (
  <svg className="cp-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
  </svg>
);

/* Direction arrows for nav strip */
const ArrowSVG = ({ direction }: { direction: 'up' | 'down' | 'left' | 'right' }) => {
  const rotations = { up: 0, right: 90, down: 180, left: 270 };
  return (
    <svg
      className="nav-strip__arrow"
      viewBox="0 0 16 16"
      fill="none"
      style={{ transform: `rotate(${rotations[direction]}deg)` }}
    >
      <path d="M4 10 L8 5 L12 10" stroke="#2ef2c3" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </svg>
  );
};

export function ControlPanel() {
  const { gameActive, gameOver, paused } = useGameState();
  const { openSettings } = useGameContext();
  const bridge = EventBridge.getInstance();

  if (gameOver) return null;

  const handlePrimaryAction = () => {
    if (!gameActive && !gameOver) {
      bridge.emit(GameEvents.UI_START_GAME);
    } else if (gameOver) {
      bridge.emit(GameEvents.UI_RESTART_GAME);
    } else if (gameActive) {
      // Toggle pause
      bridge.emit(paused ? GameEvents.UI_RESUME_GAME : GameEvents.UI_PAUSE_GAME);
    }
  };

  const handleSettings = () => {
    openSettings();
  };

  const primaryLabel = !gameActive && !gameOver
    ? 'START'
    : paused
        ? 'RESUME'
        : 'PAUSE';

  return (
    <>
      {/* ── Control Console Bar ─────────────────────────── */}
      <div className="control-panel">
        <button
          className="cp-primary-btn"
          onClick={handlePrimaryAction}
        >
          {primaryLabel}
        </button>

        {/* Right: Action buttons */}
        <div className="cp-actions">
          <button className="cp-btn" onClick={handleSettings} title="Open Game Settings">
            <SettingsIcon />
            <span>SETTINGS</span>
          </button>
        </div>
      </div>

      {/* ── Navigation Strip ────────────────────────────── */}
      <div className="nav-strip">
        <div className="nav-strip__line" />
        <div className="nav-strip__arrows">
          <ArrowSVG direction="left" />
          <ArrowSVG direction="up" />
          <ArrowSVG direction="down" />
          <ArrowSVG direction="right" />
        </div>
        <div className="nav-strip__line" />
      </div>
    </>
  );
}
