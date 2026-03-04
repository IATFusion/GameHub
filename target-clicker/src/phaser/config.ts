import Phaser from 'phaser'

import { BootScene } from './scenes/BootScene'
import { GameScene } from './scenes/GameScene'
import { PreloadScene } from './scenes/PreloadScene'
import { UIScene } from './scenes/UIScene'

/**
 * Shared keys for Phaser's global Registry.
 *
 * Registry is a simple global key/value store that all scenes can read/write.
 * This template uses it for score + time-left so UI can stay decoupled.
 */
export const RegistryKeys = {
  Score: 'score',
  TimeLeftSeconds: 'timeLeftSeconds',
  DefaultRoundSeconds: 'defaultRoundSeconds',
  IsGameOver: 'isGameOver',
} as const

export type RegistryKey = (typeof RegistryKeys)[keyof typeof RegistryKeys]

/**
 * Game-level events emitted on `this.game.events`.
 *
 * Prefer emitting *domain* events here instead of tightly coupling scenes.
 */
export const GameEvents = {
  ScoreChanged:  'score-changed',
  TimeChanged:   'time-changed',
  ComboChanged:  'combo-changed',
  GameOver:      'game-over',
  GameRestart:   'game-restart',
  /** Fired when the pre-game countdown finishes and play actually begins. */
  GameStarted:   'game-started',
} as const

export type GameEvent = (typeof GameEvents)[keyof typeof GameEvents]

export const DEFAULT_ROUND_SECONDS = 60
/** Grid fraction for landscape (fraction of screen height). */
export const GRID_FRACTION = 0.5
/** Grid fraction for portrait – larger so circles are finger-friendly on mobile. */
export const GRID_FRACTION_PORTRAIT = 0.76
/** Combo tier size – exported so UIScene can display the multiplier. */
export const COMBO_TIER = 5

/**
 * Helper: typed read for numeric values in registry.
 * (Phaser registry returns `unknown`, so we validate at runtime.)
 */
export function readRegistryNumber(
  scene: Phaser.Scene,
  key: RegistryKey,
  fallback: number,
): number {
  const value = scene.registry.get(key)
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export function readRegistryBoolean(
  scene: Phaser.Scene,
  key: RegistryKey,
  fallback: boolean,
): boolean {
  const value = scene.registry.get(key)
  return typeof value === 'boolean' ? value : fallback
}

/**
 * Phaser game config is defined separately for clarity.
 *
 * Mobile responsiveness:
 * - We use `Phaser.Scale.RESIZE` and drive the canvas size from the React
 *   container via a ResizeObserver (see `GameTemplate.tsx`).
 */
export function createGameConfig(parent: HTMLElement): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#0b0f14',
    // Initial size is immediately resized by the React ResizeObserver.
    width: Math.max(1, parent.clientWidth),
    height: Math.max(1, parent.clientHeight),
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 0 },
        debug: false,
      },
    },
    scene: [BootScene, PreloadScene, GameScene, UIScene],
  }
}
