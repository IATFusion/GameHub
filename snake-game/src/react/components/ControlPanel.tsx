// ─── ControlPanel ───────────────────────────────────────────────────────────
// Bottom console bar: brand badge, START/PAUSE button, New Game + Settings

import EventBridge, { GameEvents } from '../../game/systems/EventBridge';
import { useGameState } from '../hooks/useGameState';
import '../../styles/control-panel.css';

/* ── SVG Icons ─────────────────────────────────────────────────────────── */

const SnakeLogoIcon = () => (
  <svg className="cp-brand__icon" viewBox="0 0 32 32" fill="none">
    <path
      d="M6 16 Q6 8 12 8 Q18 8 18 14 Q18 20 24 20 Q28 20 28 14"
      stroke="#2ef2c3"
      strokeWidth="3"
      strokeLinecap="round"
      fill="none"
    />
    <circle cx="28" cy="13" r="2" fill="#2ef2c3" />
    <circle cx="28" cy="13" r="0.8" fill="#05050f" />
  </svg>
);

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

const RestartIcon = () => (
  <svg className="cp-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 12a9 9 0 019-9 9 9 0 016.36 2.64L21 3v5h-5l2.36-2.36A7 7 0 0012 5a7 7 0 00-7 7" strokeLinecap="round" />
    <path d="M21 12a9 9 0 01-9 9 9 9 0 01-6.36-2.64L3 21v-5h5l-2.36 2.36A7 7 0 0012 19a7 7 0 007-7" strokeLinecap="round" />
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
  const bridge = EventBridge.getInstance();

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

  const handleNewGame = () => {
    bridge.emit(GameEvents.UI_RESTART_GAME);
  };

  const handleSettings = () => {
    bridge.emit(GameEvents.UI_TOGGLE_SOUND);
  };

  const primaryLabel = !gameActive && !gameOver
    ? 'START'
    : gameOver
      ? 'RESTART'
      : paused
        ? 'RESUME'
        : 'PAUSE';

  return (
    <>
      {/* ── Control Console Bar ─────────────────────────── */}
      <div className="control-panel">
        {/* Left: Brand */}
        <div className="cp-brand">
          <SnakeLogoIcon />
          <span className="cp-brand__text">NEBULA</span>
        </div>

        {/* Center: Primary button */}
        <button
          className={`cp-primary-btn ${gameOver ? 'cp-primary-btn--danger' : ''}`}
          onClick={handlePrimaryAction}
        >
          {primaryLabel}
        </button>

        {/* Right: Action buttons */}
        <div className="cp-actions">
          <button className="cp-btn" onClick={handleNewGame} title="New Game">
            <RestartIcon />
            <span>NEW</span>
          </button>
          <button className="cp-btn" onClick={handleSettings} title="Toggle Sound">
            <SettingsIcon />
            <span>SFX</span>
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
