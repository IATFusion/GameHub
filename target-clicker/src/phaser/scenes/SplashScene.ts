import Phaser from 'phaser'

/**
 * SplashScene
 *
 * Displays the Fusion Studio logo before the game loads.
 * - Uses fusion_logo_desktop.png on landscape / wide screens.
 * - Uses fusion_logo_mobile.png  on portrait / narrow screens.
 * Fades in → holds → fades out → starts PreloadScene.
 */
export class SplashScene extends Phaser.Scene {
  public static readonly Key = 'SplashScene'

  private logo!: Phaser.GameObjects.Image

  public constructor() {
    super(SplashScene.Key)
  }

  public preload(): void {
    // Load silently – create() uses textures.exists() as a fallback
    this.load.image('logo_desktop', 'fusion_logo_desktop.png')
    this.load.image('logo_mobile',  'fusion_logo_mobile.png')
  }

  public create(): void {
    this.cameras.main.setBackgroundColor(0x000000)

    const { width, height } = this.scale

    // If neither texture loaded (e.g. 404), skip straight to the game
    const hasDesktop = this.textures.exists('logo_desktop')
    const hasMobile  = this.textures.exists('logo_mobile')
    if (!hasDesktop && !hasMobile) {
      this.scene.start('PreloadScene')
      return
    }

    // Pick orientation-appropriate texture, fall back to whichever loaded
    const textureKey =
      width >= height
        ? (hasDesktop ? 'logo_desktop' : 'logo_mobile')
        : (hasMobile  ? 'logo_mobile'  : 'logo_desktop')

    this.logo = this.add
      .image(width / 2, height / 2, textureKey)
      .setOrigin(0.5)
      .setAlpha(0)

    this.fitLogo()

    // Fade in → hold → fade out → transition
    this.tweens.add({
      targets:  this.logo,
      alpha:    1,
      duration: 600,
      ease:     'Sine.easeIn',
      onComplete: () => {
        this.time.delayedCall(1600, () => {
          this.tweens.add({
            targets:  this.logo,
            alpha:    0,
            duration: 500,
            ease:     'Sine.easeOut',
            onComplete: () => this.scene.start('PreloadScene'),
          })
        })
      },
    })

    this.scale.on('resize', this.handleResize, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.handleResize, this)
    })
  }

  /** Scale logo to fit inside the canvas with padding, preserve aspect ratio. */
  private fitLogo(): void {
    const { width, height } = this.scale
    const iw = this.logo.width  || 1
    const ih = this.logo.height || 1
    // Fill the full canvas, preserving aspect ratio (cover)
    this.logo.setScale(Math.max(width / iw, height / ih))
  }

  private handleResize(): void {
    if (!this.logo?.active) return
    const { width, height } = this.scale
    const hasDesktop = this.textures.exists('logo_desktop')
    const hasMobile  = this.textures.exists('logo_mobile')
    const needed =
      width >= height
        ? (hasDesktop ? 'logo_desktop' : 'logo_mobile')
        : (hasMobile  ? 'logo_mobile'  : 'logo_desktop')
    if (this.logo.texture.key !== needed) this.logo.setTexture(needed)
    this.logo.setPosition(width / 2, height / 2)
    this.fitLogo()
  }
}
