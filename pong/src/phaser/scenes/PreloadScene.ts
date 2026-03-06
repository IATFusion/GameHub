import Phaser from 'phaser'

export class PreloadScene extends Phaser.Scene {
  public static readonly Key = 'PreloadScene'

  public constructor() {
    super(PreloadScene.Key)
  }

  public preload(): void {
    // No external loads – generated textures only.
  }

  public create(): void {
    this.generateTextures()
    this.scene.start('GameScene')
    this.scene.launch('UIScene')
  }

  private generateTextures(): void {
    const gfx = this.add.graphics()

    // Paddle (horizontal mode: 16w x 80h, vertical mode: 80w x 16h) – generated at 16x80, rotated in scene
    gfx.clear()
    gfx.fillStyle(0x2dd4bf, 1)
    gfx.fillRoundedRect(0, 0, 16, 80, 4)
    gfx.generateTexture('paddle', 16, 80)

    // Horizontal paddle for vertical mode (80w x 16h)
    gfx.clear()
    gfx.fillStyle(0x2dd4bf, 1)
    gfx.fillRoundedRect(0, 0, 80, 16, 4)
    gfx.generateTexture('paddleH', 80, 16)

    // Ball (16x16 circle)
    gfx.clear()
    gfx.fillStyle(0xfbbf24, 1)
    gfx.fillCircle(8, 8, 8)
    gfx.generateTexture('ball', 16, 16)

    gfx.destroy()
  }
}
