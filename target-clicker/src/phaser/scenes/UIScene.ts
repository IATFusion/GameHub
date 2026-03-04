import Phaser from 'phaser'

import {
  COMBO_TIER,
  GameEvents,
  GRID_FRACTION,
  GRID_FRACTION_PORTRAIT,
  readRegistryBoolean,
  readRegistryNumber,
  RegistryKeys,
} from '../config'
import {
  fetchLeaderboard,
  leaderboardConfigured,
  submitScore,
  type LeaderboardEntry,
} from '../leaderboard'

const LS_KEY       = 'tc_highscore'
const LS_NAME_KEY  = 'tc_playername'
const FONT         = 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif'

export class UIScene extends Phaser.Scene {
  public static readonly Key = 'UIScene'

  /* ── stat panel ── */
  private scoreLabelText!: Phaser.GameObjects.Text
  private scoreValueText!: Phaser.GameObjects.Text
  private bestLabelText!:  Phaser.GameObjects.Text
  private bestValueText!:  Phaser.GameObjects.Text
  private timerLabelText!: Phaser.GameObjects.Text
  private timerValueText!: Phaser.GameObjects.Text
  private comboLabelText!: Phaser.GameObjects.Text
  private comboValueText!: Phaser.GameObjects.Text
  private pauseButton!:    Phaser.GameObjects.Text
  private restartButton!:  Phaser.GameObjects.Text

  /* ── game-over / leaderboard overlay ── */
  private overlayBg!:        Phaser.GameObjects.Rectangle
  private overlayTitle!:     Phaser.GameObjects.Text
  private overlayScore!:     Phaser.GameObjects.Text
  private overlayStatus!:    Phaser.GameObjects.Text       // "Submitting…" / "Failed" etc.
  private overlayRows:       Phaser.GameObjects.Text[] = []
  private overlayContainer!: Phaser.GameObjects.Container  // groups everything for easy hide/show
  private overlayRestartBtn!: Phaser.GameObjects.Text

  private sessionBest = 0
  private overlayVisible = false

  public constructor() {
    super(UIScene.Key)
  }

  /* ================================================================
   * Lifecycle
   * ============================================================= */

  public create(): void {
    this.sessionBest = parseInt(localStorage.getItem(LS_KEY) ?? '0', 10) || 0

    this.createStatPanel()
    this.createOverlay()
    this.syncFromRegistry()
    this.wireEvents()

    this.scale.on('resize', this.handleResize, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.handleResize, this)
    })
  }

  /* ================================================================
   * Stat panel
   * ============================================================= */

  private createStatPanel(): void {
    const mk = (txt: string, size: string, color: string, bold = false) =>
      this.add
        .text(0, 0, txt, { fontFamily: FONT, fontSize: size, color, fontStyle: bold ? 'bold' : 'normal' })
        .setScrollFactor(0).setDepth(10)

    this.scoreLabelText = mk('SCORE', '11px', '#475569')
    this.scoreValueText = mk('0',     '32px', '#f1f5f9', true)
    this.bestLabelText  = mk('BEST',  '11px', '#78350f')
    this.bestValueText  = mk(String(this.sessionBest), '32px', '#fbbf24', true)
    this.timerLabelText = mk('TIME',  '11px', '#475569')
    this.timerValueText = mk('60',    '32px', '#f1f5f9', true)
    this.comboLabelText = mk('COMBO', '11px', '#475569')
    this.comboValueText = mk('-',     '24px', '#fbbf24', true)

    // H) HUD polish – subtle glow shadow + dark stroke on value texts
    this.scoreValueText
      .setShadow(0, 0, '#2aff7b', 10, true, true)
      .setStroke('#0b1a12', 3)
    this.bestValueText
      .setShadow(0, 0, '#fbbf24', 10, true, true)
      .setStroke('#0b1a12', 3)
    this.timerValueText
      .setShadow(0, 0, '#2aff7b', 10, true, true)
      .setStroke('#0b1a12', 3)
    this.comboValueText
      .setShadow(0, 0, '#fbbf24', 8, true, true)
      .setStroke('#0b1a12', 2)

    this.pauseButton = this.add
      .text(0, 0, 'Pause', { fontFamily: FONT, fontSize: '14px', color: '#93c5fd' })
      .setScrollFactor(0).setDepth(10)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.togglePause())

    this.restartButton = this.add
      .text(0, 0, 'Restart', { fontFamily: FONT, fontSize: '14px', color: '#a7f3d0' })
      .setScrollFactor(0).setDepth(10)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.restartGame())

    this.layoutPanel()
  }

  /* ================================================================
   * Game-over / leaderboard overlay
   * ================================================================
   *  Layout (centered, width ~min(w,h)*0.78):
   *
   *    ┌─────────────────────┐
   *    │     GAME  OVER      │
   *    │      1,234 pts      │
   *    │  ─────────────────  │
   *    │  # NAME       SCORE │  ← up to 10 rows
   *    │  …                  │
   *    │  [  PLAY AGAIN  ]   │
   *    └─────────────────────┘
   * ============================================================= */

  private createOverlay(): void {
    this.overlayContainer = this.add.container(0, 0).setDepth(50)

    // Dark semi-transparent full-screen backdrop
    this.overlayBg = this.add.rectangle(0, 0, 10, 10, 0x000000, 0.82)
    this.overlayContainer.add(this.overlayBg)

    this.overlayTitle = this.add.text(0, 0, 'GAME OVER', {
      fontFamily: FONT, fontSize: '28px', color: '#fca5a5', fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5, 0)
    this.overlayContainer.add(this.overlayTitle)

    this.overlayScore = this.add.text(0, 0, '', {
      fontFamily: FONT, fontSize: '20px', color: '#f1f5f9', align: 'center',
    }).setOrigin(0.5, 0)
    this.overlayContainer.add(this.overlayScore)

    this.overlayStatus = this.add.text(0, 0, '', {
      fontFamily: FONT, fontSize: '13px', color: '#94a3b8', align: 'center',
    }).setOrigin(0.5, 0)
    this.overlayContainer.add(this.overlayStatus)

    // 10 row slots for leaderboard entries
    for (let i = 0; i < 10; i++) {
      const row = this.add.text(0, 0, '', {
        fontFamily: FONT, fontSize: '13px', color: '#e2e8f0',
      }).setOrigin(0, 0)
      this.overlayRows.push(row)
      this.overlayContainer.add(row)
    }

    this.overlayRestartBtn = this.add.text(0, 0, 'PLAY AGAIN', {
      fontFamily: FONT, fontSize: '16px', color: '#0b0f14', backgroundColor: '#4ade80',
      padding: { x: 20, y: 10 },
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.restartGame())
    this.overlayContainer.add(this.overlayRestartBtn)

    this.overlayContainer.setVisible(false)
    this.layoutOverlay()
  }

  /** Position all overlay elements relative to screen center. */
  private layoutOverlay(): void {
    const { width, height } = this.scale
    const panelW = Math.min(width * 0.82, 360)
    const cx     = width  / 2
    const top    = height / 2 - 220   // start above center

    this.overlayBg.setPosition(cx, height / 2).setSize(width, height)

    let y = top
    this.overlayTitle.setPosition(cx, y);  y += 40
    this.overlayScore.setPosition(cx, y);  y += 32
    this.overlayStatus.setPosition(cx, y); y += 24

    // Divider line drawn as a thin tinted text (simplest approach)
    y += 8

    const rowX = cx - panelW / 2 + 6
    for (const row of this.overlayRows) {
      row.setPosition(rowX, y)
      row.setWordWrapWidth(panelW - 12)
      y += 22
    }

    y += 10
    this.overlayRestartBtn.setPosition(cx, y)
  }

  /** Show the overlay and populate leaderboard rows. */
  private showOverlay(score: number, entries: LeaderboardEntry[] | null, statusMsg: string): void {
    this.overlayVisible = true

    const newBest = score >= this.sessionBest && score > 0
    this.overlayScore.setText(
      `${score.toLocaleString()} pts${newBest ? '  🏆 New best!' : ''}`,
    )
    this.overlayStatus.setText(statusMsg)

    // Clear all rows first
    this.overlayRows.forEach(r => r.setText(''))

    if (entries && entries.length > 0) {
      entries.slice(0, 10).forEach((e, i) => {
        const medal  = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`
        const name   = e.name.padEnd(12, ' ').slice(0, 14)
        this.overlayRows[i].setText(`${medal}  ${name}  ${e.score.toLocaleString()}`)
        // Highlight the player's just-submitted row
        this.overlayRows[i].setColor(e.score === score ? '#4ade80' : '#e2e8f0')
      })
    } else if (!leaderboardConfigured()) {
      this.overlayRows[0].setText('Leaderboard not configured.')
      this.overlayRows[1].setText('See src/phaser/leaderboard.ts')
      this.overlayRows[0].setColor('#fbbf24')
      this.overlayRows[1].setColor('#94a3b8')
    }

    this.overlayContainer.setVisible(true)
    this.layoutOverlay()
  }

  private hideOverlay(): void {
    this.overlayVisible = false
    this.overlayContainer.setVisible(false)
  }

  /* ================================================================
   * Layout
   * ============================================================= */

  private layoutPanel(): void {
    const { width, height } = this.scale
    width >= height ? this.layoutLandscape(width, height) : this.layoutPortrait(width, height)
  }

  private layoutLandscape(width: number, height: number): void {
    const gridSize = height * GRID_FRACTION
    const px = width  / 2 + gridSize / 2 + 32
    const py = height / 2 - gridSize / 2
    const dy = 88
    const LO = 16

    ;[this.scoreValueText, this.bestValueText, this.timerValueText].forEach(t => t.setFontSize('36px'))
    this.comboValueText.setFontSize('28px')
    ;[this.scoreLabelText, this.bestLabelText, this.timerLabelText, this.comboLabelText].forEach(t => t.setFontSize('12px'))

    this.scoreLabelText.setPosition(px, py).setOrigin(0, 0)
    this.scoreValueText.setPosition(px, py + LO).setOrigin(0, 0)
    this.bestLabelText.setPosition(px, py + dy).setOrigin(0, 0)
    this.bestValueText.setPosition(px, py + dy + LO).setOrigin(0, 0)
    this.timerLabelText.setPosition(px, py + dy * 2).setOrigin(0, 0)
    this.timerValueText.setPosition(px, py + dy * 2 + LO).setOrigin(0, 0)
    this.comboLabelText.setPosition(px, py + dy * 3).setOrigin(0, 0)
    this.comboValueText.setPosition(px, py + dy * 3 + LO).setOrigin(0, 0)
    this.pauseButton.setPosition(px,       py + dy * 4 + LO + 8).setOrigin(0, 0)
    this.restartButton.setPosition(px + 68, py + dy * 4 + LO + 8).setOrigin(0, 0)
  }

  private layoutPortrait(width: number, height: number): void {
    const gridSize   = width * GRID_FRACTION_PORTRAIT
    const gridTop    = height / 2 - gridSize / 2
    const gridBottom = height / 2 + gridSize / 2

    const valSize = Math.round(Math.min(width * 0.075, 32))
    const lblSize = Math.round(Math.min(width * 0.03,  12))
    const LO      = Math.round(lblSize * 1.3)

    ;[this.scoreValueText, this.bestValueText, this.timerValueText].forEach(t => t.setFontSize(`${valSize}px`))
    ;[this.scoreLabelText, this.bestLabelText, this.timerLabelText, this.comboLabelText].forEach(t => t.setFontSize(`${lblSize}px`))
    this.comboValueText.setFontSize(`${Math.round(valSize * 0.82)}px`)

    const topBarHeight = LO + valSize + 4
    const barY = Math.max(8, (gridTop - topBarHeight) / 2)
    const col1 = width * 0.17, col2 = width * 0.50, col3 = width * 0.83

    this.scoreLabelText.setPosition(col1, barY).setOrigin(0.5, 0)
    this.scoreValueText.setPosition(col1, barY + LO).setOrigin(0.5, 0)
    this.bestLabelText.setPosition(col2, barY).setOrigin(0.5, 0)
    this.bestValueText.setPosition(col2, barY + LO).setOrigin(0.5, 0)
    this.timerLabelText.setPosition(col3, barY).setOrigin(0.5, 0)
    this.timerValueText.setPosition(col3, barY + LO).setOrigin(0.5, 0)

    const belowGap   = (height - gridBottom) / 2
    const comboAreaY = gridBottom + Math.max(8, belowGap * 0.25)
    this.comboLabelText.setPosition(width / 2, comboAreaY).setOrigin(0.5, 0)
    this.comboValueText.setPosition(width / 2, comboAreaY + LO).setOrigin(0.5, 0)

    const btnY = comboAreaY + LO + Math.round(valSize * 0.82) + 10
    this.pauseButton.setPosition(width / 2 - 44, btnY).setOrigin(0.5, 0)
    this.restartButton.setPosition(width / 2 + 44, btnY).setOrigin(0.5, 0)
  }

  /* ================================================================
   * Event wiring
   * ============================================================= */

  private wireEvents(): void {
    this.game.events.on(GameEvents.ScoreChanged, this.onScoreChanged, this)
    this.game.events.on(GameEvents.TimeChanged,  this.onTimeChanged,  this)
    this.game.events.on(GameEvents.ComboChanged, this.onComboChanged, this)
    this.game.events.on(GameEvents.GameOver,     this.onGameOver,     this)
    this.game.events.on(GameEvents.GameRestart,  this.onGameRestart,  this)
    this.game.events.on(GameEvents.GameStarted,  this.onGameStarted,  this)

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(GameEvents.ScoreChanged, this.onScoreChanged, this)
      this.game.events.off(GameEvents.TimeChanged,  this.onTimeChanged,  this)
      this.game.events.off(GameEvents.ComboChanged, this.onComboChanged, this)
      this.game.events.off(GameEvents.GameOver,     this.onGameOver,     this)
      this.game.events.off(GameEvents.GameRestart,  this.onGameRestart,  this)
      this.game.events.off(GameEvents.GameStarted,  this.onGameStarted,  this)
    })
  }

  /* ================================================================
   * Event handlers
   * ============================================================= */

  private onScoreChanged(score: unknown): void {
    const s = typeof score === 'number' ? score : readRegistryNumber(this, RegistryKeys.Score, 0)
    this.scoreValueText.setText(s.toLocaleString())
    if (s > this.sessionBest) {
      this.sessionBest = s
      localStorage.setItem(LS_KEY, String(s))
      this.bestValueText.setText(s.toLocaleString())
    }
  }

  private onTimeChanged(seconds: unknown): void {
    const t = typeof seconds === 'number' ? seconds : readRegistryNumber(this, RegistryKeys.TimeLeftSeconds, 60)
    this.timerValueText.setText(String(t))
    if (t > 15)     this.timerValueText.setColor('#f1f5f9')
    else if (t > 5) this.timerValueText.setColor('#fbbf24')
    else            this.timerValueText.setColor('#f87171')
  }

  private onComboChanged(streak: unknown): void {
    const n = typeof streak === 'number' ? streak : 0
    if (n <= 0) {
      this.comboValueText.setText('-')
    } else {
      const mult = 1 + Math.floor(n / COMBO_TIER)
      this.comboValueText.setText(mult > 1 ? `x${mult}  (${n})` : String(n))
    }
  }

  /** On game over: get/set player name, submit score, show leaderboard. */
  private onGameOver(): void {
    this.pauseButton.setText('-')
    const currentScore = readRegistryNumber(this, RegistryKeys.Score, 0)
    // Always submit the all-time best (loaded from localStorage on startup),
    // so players who scored higher in previous sessions aren't penalised.
    const submitBest = Math.max(currentScore, this.sessionBest)

    // Show immediately with a loading state
    this.showOverlay(submitBest, null, leaderboardConfigured() ? 'Submitting score…' : '')

    if (!leaderboardConfigured()) {
      this.showOverlay(submitBest, null, 'Set up leaderboard.ts to go global!')
      return
    }

    // Get or prompt for player name (stored so they only type it once)
    let name = localStorage.getItem(LS_NAME_KEY) ?? ''
    if (!name) {
      name = window.prompt('Enter your name for the leaderboard:', 'Player') ?? 'Player'
      localStorage.setItem(LS_NAME_KEY, name.trim() || 'Player')
    }

    void submitScore(name, submitBest).then(entries => {
      if (entries) {
        this.showOverlay(submitBest, entries, '✓ Score submitted')
      } else {
        void fetchLeaderboard().then(fallback => {
          this.showOverlay(submitBest, fallback, 'Could not submit – showing current board')
        })
      }
    })
  }

  private onGameRestart(): void {
    this.hideOverlay()
    this.pauseButton.setText('Pause')
    this.comboValueText.setText('-')
    this.timerValueText.setColor('#f1f5f9')
    this.syncFromRegistry()
  }

  private onGameStarted(): void { /* reserved */ }

  /* ================================================================
   * Helpers
   * ============================================================= */

  private syncFromRegistry(): void {
    this.onScoreChanged(readRegistryNumber(this, RegistryKeys.Score, 0))
    this.onTimeChanged(readRegistryNumber(this, RegistryKeys.TimeLeftSeconds, 60))
    if (readRegistryBoolean(this, RegistryKeys.IsGameOver, false)) return
    this.hideOverlay()
  }

  private togglePause(): void {
    if (readRegistryBoolean(this, RegistryKeys.IsGameOver, false)) return
    const isPaused = this.scene.isPaused('GameScene')
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
    if (this.scene.isPaused('GameScene')) this.scene.resume('GameScene')
    this.scene.stop('GameScene')
    this.scene.launch('GameScene')
  }

  /* ================================================================
   * Resize
   * ============================================================= */

  private handleResize(): void {
    this.layoutPanel()
    if (this.overlayVisible) this.layoutOverlay()
  }
}
