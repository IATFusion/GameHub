// ─── GameContext ─────────────────────────────────────────────────────────────
// React context for sharing game instance and state across the component tree

import { createContext, useContext, type ReactNode } from 'react';
import type Phaser from 'phaser';
import { usePhaserGame } from '../hooks/usePhaserGame';

interface GameContextValue {
  game: Phaser.Game | null;
  onGameInstance: (game: Phaser.Game) => void;
}

const GameContext = createContext<GameContextValue>({
  game: null,
  onGameInstance: () => {},
});

export function GameProvider({ children }: { children: ReactNode }) {
  const { game, onGameInstance } = usePhaserGame();

  return (
    <GameContext.Provider value={{ game, onGameInstance }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGameContext(): GameContextValue {
  return useContext(GameContext);
}
