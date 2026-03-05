// ─── GameFrame ──────────────────────────────────────────────────────────────
// Sci-fi glowing frame that wraps the Phaser canvas

import type { ReactNode } from 'react';
import '../../styles/game-frame.css';

/* Corner bracket SVG — reused for all 4 corners */
const CornerSVG = () => (
  <svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M1 10 L1 2 Q1 1 2 1 L10 1"
      stroke="#2ef2c3"
      strokeWidth="2"
      strokeLinecap="round"
      fill="none"
    />
    <path
      d="M1 7 L1 4 Q1 2.5 2.5 2.5 L7 2.5"
      stroke="#29e0ff"
      strokeWidth="0.8"
      strokeLinecap="round"
      fill="none"
      opacity="0.4"
    />
    <circle cx="2" cy="2" r="1.5" fill="#2ef2c3" opacity="0.7">
      <animate attributeName="opacity" values="0.7;0.3;0.7" dur="2.5s" repeatCount="indefinite" />
    </circle>
  </svg>
);

interface GameFrameProps {
  children: ReactNode;
}

export function GameFrame({ children }: GameFrameProps) {
  return (
    <div className="game-frame">
        {/* Neon border */}
        <div className="game-frame__border" />

        {/* Corner accents */}
        <div className="game-frame__corner game-frame__corner--tl"><CornerSVG /></div>
        <div className="game-frame__corner game-frame__corner--tr"><CornerSVG /></div>
        <div className="game-frame__corner game-frame__corner--bl"><CornerSVG /></div>
        <div className="game-frame__corner game-frame__corner--br"><CornerSVG /></div>

        {/* Top shimmer line */}
        <div className="game-frame__edge-top" />
        <div className="game-frame__edge-bottom" />

        {/* Holographic glass */}
        <div className="game-frame__glass" />

        {/* Canvas container */}
        <div className="game-frame__canvas">
          {children}
        </div>
    </div>
  );
}
