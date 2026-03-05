// ─── GameOverOverlay ────────────────────────────────────────────────────────
// Game over screen using gameover.png + Play Again button

import EventBridge, { GameEvents } from '../../game/systems/EventBridge';
import { useGameState } from '../hooks/useGameState';
import gameoverImg from '../../img/gameover.png';
import '../../styles/overlay.css';

export function GameOverOverlay() {
  const { gameOver, gameOverData } = useGameState();

  if (!gameOver || !gameOverData) return null;

  const handleRestart = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    EventBridge.getInstance().emit(GameEvents.UI_RESTART_GAME);
  };

  return (
    <div className="gameover-overlay">
      <div className="gameover-overlay__content">
        <div className="gameover-overlay__img-wrap">
          <img
            src={gameoverImg}
            alt="Game Over"
            className="gameover-overlay__img"
          />

          {/* Invisible-positioned text overlays (aligned to the art) */}
          <div className="gameover-overlay__stat gameover-overlay__stat--score" aria-label={`Score ${gameOverData.score}`}>
            <span className="gameover-overlay__stat-value">{gameOverData.score}</span>
          </div>
          <div className="gameover-overlay__stat gameover-overlay__stat--best" aria-label={`Best score ${gameOverData.bestScore}`}>
            <span className="gameover-overlay__stat-value">{gameOverData.bestScore}</span>
          </div>
        </div>

        <button className="go-restart-btn" onClick={handleRestart}>
          PLAY AGAIN
        </button>
      </div>
    </div>
  );
}
