export interface PersistedGameSettings {
  soundEnabled: boolean;
  showJoystick: boolean;
  showSwipeHint: boolean;
}

export const GAME_SETTINGS_STORAGE_KEY = 'snake-game:settings';

export const defaultGameSettings: PersistedGameSettings = {
  soundEnabled: true,
  showJoystick: true,
  showSwipeHint: true,
};

export function readStoredSettings(): PersistedGameSettings {
  try {
    const raw = window.localStorage.getItem(GAME_SETTINGS_STORAGE_KEY);
    if (!raw) return defaultGameSettings;

    const parsed = JSON.parse(raw) as Partial<PersistedGameSettings>;

    return {
      soundEnabled: parsed.soundEnabled ?? defaultGameSettings.soundEnabled,
      showJoystick: parsed.showJoystick ?? defaultGameSettings.showJoystick,
      showSwipeHint: parsed.showSwipeHint ?? defaultGameSettings.showSwipeHint,
    };
  } catch {
    return defaultGameSettings;
  }
}

export function saveStoredSettings(settings: PersistedGameSettings): void {
  try {
    window.localStorage.setItem(GAME_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage write failures.
  }
}