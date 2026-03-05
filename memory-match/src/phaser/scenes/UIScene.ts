import Phaser from 'phaser'

import {
  GameEvents,
  readRegistryBoolean,
  readRegistryNumber,
  RegistryKeys,
} from '../config'

/**
 * UIScene
 *
 * Overlay UI:
 * - Score
 * - Countdown timer
 * - Pause/Resume
 * - Restart
 *
 * For new games: keep UI stable and change GameScene only.
 */
export class UIScene extends Phaser.Scene {
  public static readonly Key = 'UIScene'

  private scoreText!: Phaser.GameObjects.Text
  private timerText!: Phaser.GameObjects.Text
  private pauseButton!: Phaser.GameObjects.Text
  private gameOverText!: Phaser.GameObjects.Text

  public constructor() {
    super(UIScene.Key)
  }

  public create(): void {
    this.createUi()
    this.syncFromRegistry()
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

    this.scoreText = this.add.text(16, 12, 'Score: 0', fontStyle).setScrollFactor(0)
    this.timerText = this.add.text(16, 36, 'Time: 60', fontStyle).setScrollFactor(0)

    this.pauseButton = this.add
      .text(16, 64, 'Pause', {
        ...fontStyle,
        color: '#93c5fd',
      })
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.togglePause())

    this.add
      .text(92, 64, 'Restart', {
        ...fontStyle,
        color: '#a7f3d0',
      })
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.restartGame())

    this.gameOverText = this.add
      .text(0, 0, '', {
        ...fontStyle,
        fontSize: '28px',
        color: '#fca5a5',
      })
      .setScrollFactor(0)
  }

  private wireEvents(): void {
    // Listen to game-level events coming from GameScene.
    this.game.events.on(GameEvents.ScoreChanged, this.onScoreChanged, this)
    this.game.events.on(GameEvents.TimeChanged, this.onTimeChanged, this)
    this.game.events.on(GameEvents.GameOver, this.onGameOver, this)
    this.game.events.on(GameEvents.GameRestart, this.onGameRestart, this)

    // Clean up when this scene shuts down.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(GameEvents.ScoreChanged, this.onScoreChanged, this)
      this.game.events.off(GameEvents.TimeChanged, this.onTimeChanged, this)
      this.game.events.off(GameEvents.GameOver, this.onGameOver, this)
      this.game.events.off(GameEvents.GameRestart, this.onGameRestart, this)
    })
  }

  private onScoreChanged(score: unknown): void {
    const safeScore = typeof score === 'number' ? score : readRegistryNumber(this, RegistryKeys.Score, 0)
    this.scoreText.setText(`Score: ${safeScore}`)
  }

  private onTimeChanged(seconds: unknown): void {
    const safeSeconds =
      typeof seconds === 'number'
        ? seconds
        : readRegistryNumber(this, RegistryKeys.TimeLeftSeconds, 60)
    this.timerText.setText(`Time: ${safeSeconds}`)
  }

  private onGameOver(): void {
    this.pauseButton.setText('Resume')
    this.gameOverText.setText('Game Over')
    this.layoutCenteredGameOverText()
  }

  private onGameRestart(): void {
    this.gameOverText.setText('')
    this.pauseButton.setText('Pause')
    this.syncFromRegistry()
  }

  private syncFromRegistry(): void {
    this.onScoreChanged(readRegistryNumber(this, RegistryKeys.Score, 0))
    this.onTimeChanged(readRegistryNumber(this, RegistryKeys.TimeLeftSeconds, 60))

    const isGameOver = readRegistryBoolean(this, RegistryKeys.IsGameOver, false)
    if (!isGameOver) this.gameOverText.setText('')
  }

  private togglePause(): void {
    const isPaused = this.scene.isPaused('GameScene')

    // If game over, the gameplay scene is paused already; allow "resume" to do nothing.
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
    const defaultSeconds = readRegistryNumber(this, RegistryKeys.DefaultRoundSeconds, 60)

    this.registry.set(RegistryKeys.Score, 0)
    this.registry.set(RegistryKeys.TimeLeftSeconds, defaultSeconds)
    this.registry.set(RegistryKeys.IsGameOver, false)
    this.game.events.emit(GameEvents.GameRestart)
    this.game.events.emit(GameEvents.ScoreChanged, 0)
    this.game.events.emit(GameEvents.TimeChanged, defaultSeconds)

    // Ensure gameplay is running fresh.
    if (this.scene.isPaused('GameScene')) this.scene.resume('GameScene')
    this.scene.stop('GameScene')
    this.scene.start('GameScene')
  }

  private handleResize(gameSize: Phaser.Structs.Size): void {
    // Keep game-over text centered.
    void gameSize
    this.layoutCenteredGameOverText()
  }

  private layoutCenteredGameOverText(): void {
    if (!this.gameOverText.text) return
    const { width, height } = this.scale
    this.gameOverText.setPosition(width / 2, height / 2)
    this.gameOverText.setOrigin(0.5, 0.5)
  }
}
