/**
 * settings.ts
 *
 * Persistent player preferences stored in localStorage.
 * Import `Settings` anywhere; changes survive page reloads.
 */

const LS_KEY = 'tc_settings'

export interface GameSettings {
  volumeEnabled:     boolean
  sfxEnabled:        boolean
  vibrationEnabled:  boolean
  shakeEnabled:      boolean
}

const DEFAULTS: GameSettings = {
  volumeEnabled:    true,
  sfxEnabled:       true,
  vibrationEnabled: true,
  shakeEnabled:     true,
}

function load(): GameSettings {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return { ...DEFAULTS }
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<GameSettings>) }
  } catch {
    return { ...DEFAULTS }
  }
}

function save(s: GameSettings): void {
  try { localStorage.setItem(LS_KEY, JSON.stringify(s)) } catch { /* ignore */ }
}

// Single shared instance – mutated in place so all importers see the same object.
export const Settings: GameSettings = load()

export function applySettings(patch: Partial<GameSettings>): void {
  Object.assign(Settings, patch)
  save(Settings)
}
