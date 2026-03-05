// ─── MobileControls ─────────────────────────────────────────────────────────
// On-screen swipe hint for touch devices — neon teal sci-fi theme

import { useEffect, useState } from 'react';
import { useGameState } from '../hooks/useGameState';

export function MobileControls() {
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const { gameActive } = useGameState();

  useEffect(() => {
    setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  if (!isTouchDevice || !gameActive) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '6px',
      opacity: 0.3,
      pointerEvents: 'none',
      zIndex: 10,
    }}>
      <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
        <path d="M16 4 L16 28 M4 16 L28 16" stroke="#2ef2c3" strokeWidth="1.5" opacity="0.5" />
        <path d="M12 8 L16 4 L20 8" stroke="#2ef2c3" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        <path d="M12 24 L16 28 L20 24" stroke="#2ef2c3" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        <path d="M8 12 L4 16 L8 20" stroke="#2ef2c3" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        <path d="M24 12 L28 16 L24 20" stroke="#2ef2c3" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      </svg>
      <div style={{
        color: '#2ef2c3',
        fontFamily: "'Rajdhani', sans-serif",
        fontSize: '11px',
        letterSpacing: '3px',
        textAlign: 'center',
      }}>
        SWIPE TO NAVIGATE
      </div>
    </div>
  );
}
