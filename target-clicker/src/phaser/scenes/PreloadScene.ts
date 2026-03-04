import Phaser from 'phaser'

/**
 * PreloadScene
 *
 * This template avoids external assets. We generate textures instead.
 * For new games: replace/add generated textures here.
 */
export class PreloadScene extends Phaser.Scene {
  public static readonly Key = 'PreloadScene'

  public constructor() {
    super(PreloadScene.Key)
  }

  public preload(): void {
    // A) Alien Hive theme assets (files live directly in /public)
    this.load.image('bg',     'bg.png')
    this.load.image('idle',   'idle.png')
    this.load.image('active', 'active.png')
    // Background music
    this.load.audio('bgmusic', 'bg_music.wav')
  }

  public create(): void {
    // Generated textures (kept for potential future use)
    this.generateTextures()

    // Start core gameplay + UI overlay.
    this.scene.start('GameScene')
    this.scene.launch('UIScene')
  }

  private generateTextures(): void {
    const graphics = this.add.graphics()

    // Player (32x32 rounded rect)
    graphics.clear()
    graphics.fillStyle(0x2dd4bf, 1)
    graphics.fillRoundedRect(0, 0, 32, 32, 6)
    graphics.generateTexture('player', 32, 32)

    // Wall/platform (64x20)
    graphics.clear()
    graphics.fillStyle(0x64748b, 1)
    graphics.fillRoundedRect(0, 0, 64, 20, 6)
    graphics.generateTexture('wall', 64, 20)

    // Coin (20x20 circle)
    graphics.clear()
    graphics.fillStyle(0xfbbf24, 1)
    graphics.fillCircle(10, 10, 10)
    graphics.lineStyle(2, 0x92400e, 1)
    graphics.strokeCircle(10, 10, 9)
    graphics.generateTexture('coin', 20, 20)

    graphics.destroy()
  }
}
