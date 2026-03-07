import { useEffect } from 'react';
import { useGameContext } from '../context/GameContext';
import { useGameState } from '../hooks/useGameState';
import '../../styles/settings-overlay.css';

interface SettingRowProps {
  label: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}

function SettingRow({ label, description, enabled, onToggle }: SettingRowProps) {
  return (
    <div className="settings-overlay__row">
      <div className="settings-overlay__copy">
        <div className="settings-overlay__label">{label}</div>
        <div className="settings-overlay__description">{description}</div>
      </div>
      <button
        type="button"
        className={`settings-overlay__toggle ${enabled ? 'is-on' : ''}`}
        onClick={onToggle}
        aria-pressed={enabled}
      >
        <span className="settings-overlay__toggle-track">
          <span className="settings-overlay__toggle-thumb" />
        </span>
        <span className="settings-overlay__toggle-text">{enabled ? 'ON' : 'OFF'}</span>
      </button>
    </div>
  );
}

export function GameSettingsOverlay() {
  const {
    settingsOpen,
    closeSettings,
    soundEnabled,
    setSoundEnabled,
    showJoystick,
    setShowJoystick,
    showSwipeHint,
    setShowSwipeHint,
  } = useGameContext();
  const { gameActive, paused, gameOver } = useGameState();

  useEffect(() => {
    if (!settingsOpen) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeSettings();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeSettings, settingsOpen]);

  if (!settingsOpen) return null;

  const gameStatus = gameOver ? 'Game Over' : gameActive ? (paused ? 'Paused' : 'Live Run') : 'Ready';

  return (
    <div className="settings-overlay" onClick={closeSettings}>
      <div
        className="settings-overlay__card"
        role="dialog"
        aria-modal="true"
        aria-label="Game settings"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="settings-overlay__header">
          <div>
            <div className="settings-overlay__eyebrow">Game Settings</div>
            <h2 className="settings-overlay__title">Tune the current run</h2>
          </div>
          <button type="button" className="settings-overlay__close" onClick={closeSettings} aria-label="Close settings">
            CLOSE
          </button>
        </div>

        <div className="settings-overlay__status">
          <span className="settings-overlay__status-label">Status</span>
          <span className="settings-overlay__status-value">{gameStatus}</span>
        </div>

        <div className="settings-overlay__list">
          <SettingRow
            label="Sound effects"
            description="Turns all gameplay audio on or off."
            enabled={soundEnabled}
            onToggle={() => setSoundEnabled(!soundEnabled)}
          />
          <SettingRow
            label="On-screen touch pad"
            description="Shows or hides the four-direction touch pad while playing on mobile."
            enabled={showJoystick}
            onToggle={() => setShowJoystick(!showJoystick)}
          />
          <SettingRow
            label="Swipe hint"
            description="Shows or hides the touch navigation hint during a run."
            enabled={showSwipeHint}
            onToggle={() => setShowSwipeHint(!showSwipeHint)}
          />
        </div>

        <div className="settings-overlay__footer">
          <button type="button" className="settings-overlay__done" onClick={closeSettings}>
            DONE
          </button>
        </div>
      </div>
    </div>
  );
}