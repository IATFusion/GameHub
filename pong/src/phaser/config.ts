import Phaser from 'phaser'

import { BootScene } from './scenes/BootScene'
import { GameScene } from './scenes/GameScene'
import { PreloadScene } from './scenes/PreloadScene'
import { UIScene } from './scenes/UIScene'

/* ── Registry keys ── */
export const RegistryKeys = {
  PlayerScore: 'playerScore',
  CpuScore: 'cpuScore',
  IsGameOver: 'isGameOver',
} as const

export type RegistryKey = (typeof RegistryKeys)[keyof typeof RegistryKeys]

/* ── Game-level events ── */
export const GameEvents = {
  ScoreChanged: 'score-changed',
  GameOver: 'game-over',
  GameRestart: 'game-restart',
} as const

export type GameEvent = (typeof GameEvents)[keyof typeof GameEvents]

/* ── Helpers ── */
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

/* ── Phaser config ── */
export function createGameConfig(parent: HTMLElement): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#0b0f14',
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
