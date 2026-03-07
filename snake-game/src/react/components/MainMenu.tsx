// ─── MainMenu ───────────────────────────────────────────────────────────────
// Start screen overlay — loadingasset.png + Launch button

import EventBridge, { GameEvents } from '../../game/systems/EventBridge';
import { useGameContext } from '../context/GameContext';
import { useGameState } from '../hooks/useGameState';
import loadingImg from '../../img/loadingasset.png';
import '../../styles/menu.css';

export function MainMenu() {
  const { gameActive, gameOver } = useGameState();
  const { openSettings } = useGameContext();

  if (gameActive || gameOver) return null;

  const handleStart = () => {
    EventBridge.getInstance().emit(GameEvents.UI_START_GAME);
  };

  return (
    <div className="menu-overlay">
      <div className="menu-overlay__content">
        <div className="menu-overlay__img-wrap">
          <img
            src={loadingImg}
            alt="Nebula Slither"
            className="menu-overlay__img"
          />
        </div>

        <div className="menu-overlay__buttons">
          <button className="menu-launch-btn" onClick={handleStart}>
            LAUNCH
          </button>
          <button className="menu-settings-btn" onClick={openSettings}>
            SETTINGS
          </button>
        </div>
      </div>
    </div>
  );
}
