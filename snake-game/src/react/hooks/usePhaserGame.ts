// ─── usePhaserGame Hook ─────────────────────────────────────────────────────
// Provides access to the Phaser game instance across React components

import { useState, useCallback } from 'react';
import type Phaser from 'phaser';

export function usePhaserGame() {
  const [game, setGame] = useState<Phaser.Game | null>(null);

  const onGameInstance = useCallback((instance: Phaser.Game) => {
    setGame(instance);
  }, []);

  return { game, onGameInstance };
}
