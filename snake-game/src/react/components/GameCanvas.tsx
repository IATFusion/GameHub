// ─── GameCanvas ─────────────────────────────────────────────────────────────
// React component that hosts the Phaser game instance

import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { createGameConfig } from '../../game/config';

interface GameCanvasProps {
  onGameInstance?: (game: Phaser.Game) => void;
}

export function GameCanvas({ onGameInstance }: GameCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;

    const config = createGameConfig(containerRef.current);
    const game = new Phaser.Game(config);
    gameRef.current = game;

    onGameInstance?.(game);

    const containerEl = containerRef.current;
    const refreshScale = () => {
      try {
        game.scale.refresh();
      } catch {
        // Ignore refresh errors during teardown
      }
    };

    // Listen for viewport changes only (no ResizeObserver to avoid feedback loops)
    const handleResize = () => {
      // Small delay so CSS has settled after viewport change
      setTimeout(refreshScale, 100);
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      game.destroy(true);
      gameRef.current = null;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    />
  );
}
