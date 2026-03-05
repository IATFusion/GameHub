import Phaser from 'phaser'

import {
  GameEvents,
  readRegistryBoolean,
  RegistryKeys,
} from '../config'

/**
 * UIScene — minimal overlay for Pong.
 * Score display is handled in GameScene itself, so this scene only provides
 * Pause / Restart buttons and a game-over label.
 */
export class UIScene extends Phaser.Scene {
  public static readonly Key = 'UIScene'

  private pauseButton!: Phaser.GameObjects.Text
  private gameOverText!: Phaser.GameObjects.Text

  public constructor() {
    super(UIScene.Key)
  }

  public create(): void {
    this.createUi()
    this.wireEvents()

    this.scale.on('resize', this.handleResize, this)

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.handleResize, this)
    })
  }

  private createUi(): void {
    const fontStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
      fontSize: '18px',
      color: '#e2e8f0',
    }

    this.pauseButton = this.add
      .text(16, 12, 'Pause', { ...fontStyle, color: '#93c5fd' })
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.togglePause())

    this.add
      .text(92, 12, 'Restart', { ...fontStyle, color: '#a7f3d0' })
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.restartGame())

    this.gameOverText = this.add
      .text(0, 0, '', { ...fontStyle, fontSize: '28px', color: '#fca5a5' })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(100)
  }

  private wireEvents(): void {
    this.game.events.on(GameEvents.GameOver, this.onGameOver, this)
    this.game.events.on(GameEvents.GameRestart, this.onGameRestart, this)

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(GameEvents.GameOver, this.onGameOver, this)
      this.game.events.off(GameEvents.GameRestart, this.onGameRestart, this)
    })
  }

  private onGameOver(): void {
    this.pauseButton.setText('Resume')
  }

  private onGameRestart(): void {
    this.pauseButton.setText('Pause')
    this.gameOverText.setText('')
  }

  private togglePause(): void {
    const isPaused = this.scene.isPaused('GameScene')

    if (readRegistryBoolean(this, RegistryKeys.IsGameOver, false)) return

    if (isPaused) {
      this.scene.resume('GameScene')
      this.pauseButton.setText('Pause')
    } else {
      this.scene.pause('GameScene')
      this.pauseButton.setText('Resume')
    }
  }

  private restartGame(): void {
    this.registry.set(RegistryKeys.PlayerScore, 0)
    this.registry.set(RegistryKeys.CpuScore, 0)
    this.registry.set(RegistryKeys.IsGameOver, false)
    this.game.events.emit(GameEvents.GameRestart)

    if (this.scene.isPaused('GameScene')) this.scene.resume('GameScene')
    this.scene.stop('GameScene')
    this.scene.start('GameScene')
  }

  private handleResize(_gameSize: Phaser.Structs.Size): void {
    this.layoutCenteredGameOverText()
  }

  private layoutCenteredGameOverText(): void {
    if (!this.gameOverText.text) return
    const { width, height } = this.scale
    this.gameOverText.setPosition(width / 2, height / 2)
    this.gameOverText.setOrigin(0.5, 0.5)
  }
}
