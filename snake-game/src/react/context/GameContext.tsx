// ─── GameContext ─────────────────────────────────────────────────────────────
// React context for sharing game instance and UI settings across the component tree

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type Phaser from 'phaser';
import EventBridge, { GameEvents } from '../../game/systems/EventBridge';
import {
  readStoredSettings,
  saveStoredSettings,
  type PersistedGameSettings,
} from '../../settings/gameSettings';
import { usePhaserGame } from '../hooks/usePhaserGame';

interface GameContextValue {
  game: Phaser.Game | null;
  onGameInstance: (game: Phaser.Game) => void;
  settingsOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  showJoystick: boolean;
  setShowJoystick: (enabled: boolean) => void;
  showSwipeHint: boolean;
  setShowSwipeHint: (enabled: boolean) => void;
}

const GameContext = createContext<GameContextValue>({
  game: null,
  onGameInstance: () => {},
  settingsOpen: false,
  openSettings: () => {},
  closeSettings: () => {},
  soundEnabled: true,
  setSoundEnabled: () => {},
  showJoystick: true,
  setShowJoystick: () => {},
  showSwipeHint: true,
  setShowSwipeHint: () => {},
});

export function GameProvider({ children }: { children: ReactNode }) {
  const { game, onGameInstance } = usePhaserGame();
  const storedSettings = useMemo(() => readStoredSettings(), []);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(storedSettings.soundEnabled);
  const [showJoystick, setShowJoystick] = useState(storedSettings.showJoystick);
  const [showSwipeHint, setShowSwipeHint] = useState(storedSettings.showSwipeHint);

  const persistedSettings = useMemo<PersistedGameSettings>(() => ({
    soundEnabled,
    showJoystick,
    showSwipeHint,
  }), [soundEnabled, showJoystick, showSwipeHint]);

  useEffect(() => {
    saveStoredSettings(persistedSettings);
  }, [persistedSettings]);

  useEffect(() => {
    EventBridge.getInstance().emit(GameEvents.UI_SET_SOUND_ENABLED, soundEnabled);
  }, [soundEnabled]);

  return (
    <GameContext.Provider
      value={{
        game,
        onGameInstance,
        settingsOpen,
        openSettings: () => setSettingsOpen(true),
        closeSettings: () => setSettingsOpen(false),
        soundEnabled,
        setSoundEnabled,
        showJoystick,
        setShowJoystick,
        showSwipeHint,
        setShowSwipeHint,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

export function useGameContext(): GameContextValue {
  return useContext(GameContext);
}
