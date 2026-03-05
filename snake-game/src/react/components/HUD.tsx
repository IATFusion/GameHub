// ─── HUD ────────────────────────────────────────────────────────────────────
// Heads-up display showing score, time, snake lengths, and difficulty

import { CSS_COLORS } from '../../game/systems/GameConstants';
import { useGameState } from '../hooks/useGameState';
import '../../styles/hud.css';

/* ── Inline SVG icons ─────────────────────────────────────────────────────── */

const SnakeIcon = ({ color }: { color: string }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ color }}>
    <path
      d="M4 12 Q4 6 8 6 Q12 6 12 10 Q12 14 16 14 Q20 14 20 8"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      fill="none"
    />
    <circle cx="20" cy="7" r="1.5" fill="currentColor" />
  </svg>
);

export function HUD() {
  const { score, bestScore, timeSurvived, playerLength, cpuLength, gameActive } = useGameState();

  if (!gameActive) return null;

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="hud">
      <div className="hud-top">
        <div className="hud-score">
          <span className="hud-label">SCORE</span>
          <span className="hud-value" style={{ color: CSS_COLORS.ACCENT }}>{score}</span>
        </div>
        <div className="hud-time">
          <span className="hud-label">SURVIVAL</span>
          <span className="hud-value">{formatTime(timeSurvived)}</span>
        </div>
        <div className="hud-best">
          <span className="hud-label">BEST</span>
          <span className="hud-value" style={{ color: CSS_COLORS.FOOD_NORMAL }}>{bestScore}</span>
        </div>
      </div>

      <div className="hud-bottom">
        <div className="hud-snake-info player">
          <div className="hud-snake-icon">
            <SnakeIcon color={CSS_COLORS.PLAYER} />
          </div>
          <span className="hud-snake-length">{playerLength}</span>
        </div>
        <div className="hud-snake-info cpu">
          <div className="hud-snake-icon">
            <SnakeIcon color={CSS_COLORS.CPU} />
          </div>
          <span className="hud-snake-length">{cpuLength}</span>
        </div>
      </div>
    </div>
  );
}
