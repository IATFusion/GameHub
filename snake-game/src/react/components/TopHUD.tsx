// ─── TopHUD ─────────────────────────────────────────────────────────────────
// Top HUD bar with three glowing sci-fi panels:
//   Left: Score, High Score, Lives
//   Center: Game Title
//   Right: Level indicator, Goal description

import { CSS_COLORS } from '../../game/systems/GameConstants';
import { useGameState } from '../hooks/useGameState';
import '../../styles/hud.css';

/* ── SVG Icons ─────────────────────────────────────────────────────────── */

const HeartIcon = ({ filled = true, color = '#2ef2c3' }: { filled?: boolean; color?: string }) => (
  <svg
    className={`hud-lives__heart ${!filled ? 'hud-lives__heart--lost' : ''}`}
    viewBox="0 0 20 20"
    fill="none"
  >
    <path
      d="M10 17 L3 10.5 C1 8.5 1 5.5 3.5 4 C5.5 2.8 7.5 3.5 10 6 C12.5 3.5 14.5 2.8 16.5 4 C19 5.5 19 8.5 17 10.5 Z"
      fill={filled ? color : 'none'}
      stroke={color}
      strokeWidth="1.2"
      opacity={filled ? 0.9 : 0.25}
    />
  </svg>
);

const SnakeIcon = ({ color }: { color: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ color }}>
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

export function TopHUD() {
  const { score, bestScore, timeSurvived, playerLength, cpuLength, gameActive } = useGameState();

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Calculate pseudo-level from time survived
  const level = Math.floor(timeSurvived / 30) + 1;

  return (
    <>
      {/* ── Top HUD Bar ─────────────────────────────────── */}
      <div className="top-hud">
        {/* Left Panel */}
        <div className="hud-card hud-card--left">
          <div className="hud-stat">
            <span className="hud-stat__label">SCORE</span>
            <span className="hud-stat__value hud-stat__value--accent">{gameActive ? score : '---'}</span>
          </div>
          <div className="hud-divider" />
          <div className="hud-stat">
            <span className="hud-stat__label">HI-SCORE</span>
            <span className="hud-stat__value hud-stat__value--cyan">{bestScore || '---'}</span>
          </div>
          <div className="hud-divider" />
          <div className="hud-lives">
            <span className="hud-stat__label">LIVES</span>
            <div className="hud-lives__icons">
              <HeartIcon filled={gameActive} />
              <HeartIcon filled={gameActive} />
              <HeartIcon filled={gameActive} />
            </div>
          </div>
        </div>

        {/* Center Panel */}
        <div className="hud-card hud-card--center">
          <div className="hud-title">NEBULA SLITHER</div>
          <div className="hud-subtitle">SCI-FI ARCADE</div>
        </div>

        {/* Right Panel */}
        <div className="hud-card hud-card--right">
          <div className="hud-level">
            <span className="hud-stat__label">LEVEL</span>
            <span className="hud-level__number">{gameActive ? level : '-'}</span>
          </div>
          <div className="hud-divider" />
          <div className="hud-goal">
            <span className="hud-stat__label">MISSION</span>
            <span className="hud-goal__detail">{gameActive ? `${formatTime(timeSurvived)} SURVIVED` : 'AWAITING'}</span>
          </div>
        </div>
      </div>

      {/* ── Snake length pills (shown below game frame via parent layout) ── */}
      {gameActive && (
        <div className="hud-snakes">
          <div className="hud-snake-pill">
            <div className="hud-snake-pill__icon">
              <SnakeIcon color={CSS_COLORS.PLAYER} />
            </div>
            <span className="hud-snake-pill__value" style={{ color: CSS_COLORS.PLAYER }}>{playerLength}</span>
          </div>
          <div className="hud-snake-pill">
            <div className="hud-snake-pill__icon">
              <SnakeIcon color={CSS_COLORS.CPU} />
            </div>
            <span className="hud-snake-pill__value" style={{ color: CSS_COLORS.CPU }}>{cpuLength}</span>
          </div>
        </div>
      )}
    </>
  );
}
