import Phaser from 'phaser'

import {
  GameEvents,
  RegistryKeys,
} from '../config'

/**
 * UIScene – Drag Racer overlay
 *
 * Runs on top of GameScene at all times.
 * Shows a post-race panel with a REMATCH button after GameOver.
 * All in-race HUD (RPM, speed, gear, score, shift button) lives
 * inside GameScene so it can react directly to game state.
 */
export class UIScene extends Phaser.Scene {
  public static readonly Key = 'UIScene'

  private overlayBg!:    Phaser.GameObjects.Rectangle
  private restartBtn!:   Phaser.GameObjects.Container
  private restartBtnBg!: Phaser.GameObjects.Rectangle

  public constructor() {
    super(UIScene.Key)
  }

  public create(): void {
    this.buildOverlay()
    this.wireEvents()

    this.scale.on('resize', this.onResize, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(GameEvents.GameOver,    this.onGameOver,    this)
      this.game.events.off(GameEvents.GameRestart, this.onGameRestart, this)
      this.scale.off('resize', this.onResize, this)
    })
  }

  /* ================================================================
   *  Build
   * ================================================================ */

  private buildOverlay(): void {
    const { width, height } = this.scale
    const oh   = this.overlayH()
    const btnW = this.btnW()
    const btnH = this.btnH()
    const fsz  = this.fontSize(20)

    // Dark bottom strip
    this.overlayBg = this.add
      .rectangle(width / 2, height - oh / 2, width, oh, 0x06060e)
      .setDepth(60)
      .setAlpha(0)

    // REMATCH button body
    this.restartBtnBg = this.add
      .rectangle(0, 0, btnW, btnH, 0x0f2d1c)
      .setStrokeStyle(2, 0x2ea043)

    const icon = this.add.text(-btnW * 0.26, 0, '↺', {
      fontFamily: 'monospace, "Courier New"',
      fontSize:   this.fontSize(26),
      color:      '#3fb950',
    }).setOrigin(0.5)

    const label = this.add.text(btnW * 0.06, 0, 'REMATCH', {
      fontFamily: 'monospace, "Courier New"',
      fontSize:   fsz,
      color:      '#f0f6fc',
      fontStyle:  'bold',
    }).setOrigin(0.5)

    this.restartBtn = this.add
      .container(width / 2, height - oh / 2, [this.restartBtnBg, icon, label])
      .setDepth(61)
      .setSize(btnW, btnH)
      .setInteractive({ useHandCursor: true })
      .setAlpha(0)

    this.restartBtn.on('pointerdown', () => this.restartGame())
    this.restartBtn.on('pointerover', () => {
      this.restartBtnBg.setFillStyle(0x1a4d2e)
      this.tweens.add({ targets: this.restartBtn, scaleX: 1.05, scaleY: 1.05, duration: 80 })
    })
    this.restartBtn.on('pointerout', () => {
      this.restartBtnBg.setFillStyle(0x0f2d1c)
      this.tweens.add({ targets: this.restartBtn, scaleX: 1, scaleY: 1, duration: 80 })
    })
  }

  /* ================================================================
   *  Events
   * ================================================================ */

  private wireEvents(): void {
    this.game.events.on(GameEvents.GameOver,    this.onGameOver,    this)
    this.game.events.on(GameEvents.GameRestart, this.onGameRestart, this)
  }

  private onGameOver(): void {
    this.tweens.add({
      targets:  [this.overlayBg, this.restartBtn],
      alpha:    1,
      duration: 420,
      ease:     'Cubic.easeOut',
    })
  }

  private onGameRestart(): void {
    this.tweens.add({
      targets:  [this.overlayBg, this.restartBtn],
      alpha:    0,
      duration: 150,
    })
  }

  /* ================================================================
   *  Restart
   * ================================================================ */

  private restartGame(): void {
    // Guard against double-tap during fade-in animation
    if (this.restartBtn.alpha < 0.5) return

    this.registry.set(RegistryKeys.IsGameOver, false)
    this.game.events.emit(GameEvents.GameRestart)

    if (this.scene.isPaused('GameScene')) this.scene.resume('GameScene')
    this.scene.stop('GameScene')
    this.scene.start('GameScene')
  }

  /* ================================================================
   *  Resize
   * ================================================================ */

  private onResize(): void {
    if (!this.overlayBg) return
    const { width, height } = this.scale
    const oh   = this.overlayH()
    const btnW = this.btnW()
    const btnH = this.btnH()

    this.overlayBg.setPosition(width / 2, height - oh / 2)
    this.overlayBg.setSize(width, oh)
    this.restartBtn.setPosition(width / 2, height - oh / 2)
    this.restartBtn.setSize(btnW, btnH)
    this.restartBtnBg.setSize(btnW, btnH)
  }

  /* ================================================================
   *  Helpers
   * ================================================================ */

  private overlayH(): number { return Math.round(this.scale.height * 0.22) }
  private btnW():     number { return Math.min(320, Math.round(this.scale.width  * 0.72)) }
  private btnH():     number { return Math.max(60,  Math.round(this.scale.height * 0.12)) }

  private fontSize(base: number): string {
    const scaled = Math.round(base * Math.min(1, this.scale.width / 420))
    return `${Math.max(12, scaled)}px`
  }
}
