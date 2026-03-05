import Phaser from 'phaser'

import { RegistryKeys } from '../config'

export class BootScene extends Phaser.Scene {
  public static readonly Key = 'BootScene'

  public constructor() {
    super(BootScene.Key)
  }

  public create(): void {
    this.registry.set(RegistryKeys.PlayerScore, 0)
    this.registry.set(RegistryKeys.CpuScore, 0)
    this.registry.set(RegistryKeys.IsGameOver, false)

    this.scene.start('PreloadScene')
  }
}
