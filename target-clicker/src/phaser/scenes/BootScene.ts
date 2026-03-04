import Phaser from 'phaser'

import { DEFAULT_ROUND_SECONDS, RegistryKeys } from '../config'

/**
 * BootScene
 *
 * Minimal setup that runs once.
 * - Set any global registry defaults
 * - Configure input settings / scale options if needed
 *
 * For new games: usually you won't touch this scene.
 */
export class BootScene extends Phaser.Scene {
  public static readonly Key = 'BootScene'

  public constructor() {
    super(BootScene.Key)
  }

  public create(): void {
    // Global state defaults. These are safe to re-apply on restart.
    this.registry.set(RegistryKeys.Score, 0)
    this.registry.set(RegistryKeys.DefaultRoundSeconds, DEFAULT_ROUND_SECONDS)
    this.registry.set(RegistryKeys.TimeLeftSeconds, DEFAULT_ROUND_SECONDS)
    this.registry.set(RegistryKeys.IsGameOver, false)

    this.scene.start('SplashScene')
  }
}
