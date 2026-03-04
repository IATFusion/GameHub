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
  private settingsButton!: Phaser.GameObjects.Text

  /* ── game-over / leaderboard overlay ── */
  private overlayBg!:         Phaser.GameObjects.Rectangle
  private overlayBgImage!:    Phaser.GameObjects.Image       // themed leaderboard panel
  private overlayTitle!:      Phaser.GameObjects.Text
  private overlayScore!:      Phaser.GameObjects.Text
  private overlayStatus!:     Phaser.GameObjects.Text
  private overlayRows:        Phaser.GameObjects.Text[] = []
  private overlayContainer!:  Phaser.GameObjects.Container
  private overlayRestartBtn!: Phaser.GameObjects.Text
  private leaderboardButton!: Phaser.GameObjects.Text        // always-visible HUD button
  private overlayMode:        'gameover' | 'browse' = 'gameover'

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

    this.scoreLabelText = mk('SCORE', '11px', '#7dd3fc')
    this.scoreValueText = mk('0',     '32px', '#f1f5f9', true)
    this.bestLabelText  = mk('BEST',  '11px', '#fcd34d')
    this.bestValueText  = mk(String(this.sessionBest), '32px', '#fbbf24', true)
    this.timerLabelText = mk('TIME',  '11px', '#7dd3fc')
    this.timerValueText = mk('60',    '32px', '#f1f5f9', true)
    this.comboLabelText = mk('COMBO', '11px', '#c8ff00')
    this.comboValueText = mk('-',     '24px', '#fef08a', true)

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
      .text(0, 0, '⏸ Pause', {
        fontFamily: FONT, fontSize: '13px', color: '#e0f2fe', fontStyle: 'bold',
        backgroundColor: '#1a3a5c', padding: { x: 12, y: 7 },
      })
      .setScrollFactor(0).setDepth(10)
      .setInteractive({ useHandCursor: true })
      .on('pointerover',  () => this.pauseButton.setAlpha(0.75))
      .on('pointerout',   () => this.pauseButton.setAlpha(1))
      .on('pointerdown',  () => this.togglePause())

    this.restartButton = this.add
      .text(0, 0, '↺ Restart', {
        fontFamily: FONT, fontSize: '13px', color: '#d1fae5', fontStyle: 'bold',
        backgroundColor: '#14432a', padding: { x: 12, y: 7 },
      })
      .setScrollFactor(0).setDepth(10)
      .setInteractive({ useHandCursor: true })
      .on('pointerover',  () => this.restartButton.setAlpha(0.75))
      .on('pointerout',   () => this.restartButton.setAlpha(1))
      .on('pointerdown',  () => this.restartGame())

    this.leaderboardButton = this.add
      .text(0, 0, '🏆 Leaderboard', {
        fontFamily: FONT, fontSize: '13px', color: '#c8ff00', fontStyle: 'bold',
        backgroundColor: '#2a3a00', padding: { x: 12, y: 7 },
      })
      .setScrollFactor(0).setDepth(10)
      .setInteractive({ useHandCursor: true })
      .on('pointerover',  () => this.leaderboardButton.setAlpha(0.75))
      .on('pointerout',   () => this.leaderboardButton.setAlpha(1))
      .on('pointerdown',  () => this.showLeaderboardOnly())

    this.settingsButton = this.add
      .text(0, 0, '⚙ Settings', {
        fontFamily: FONT, fontSize: '13px', color: '#c8ff00', fontStyle: 'bold',
        backgroundColor: '#1a3300', padding: { x: 12, y: 7 },
      })
      .setScrollFactor(0).setDepth(10)
      .setInteractive({ useHandCursor: true })
      .on('pointerover',  () => this.settingsButton.setAlpha(0.75))
      .on('pointerout',   () => this.settingsButton.setAlpha(1))
      .on('pointerdown',  () => this.scene.launch('SettingsScene'))

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

    // Full-screen dim backdrop
    this.overlayBg = this.add.rectangle(0, 0, 10, 10, 0x000000, 0.88)
    this.overlayContainer.add(this.overlayBg)

    // Themed leaderboard panel image
    this.overlayBgImage = this.add.image(0, 0, 'leaderboard_bg').setOrigin(0.5)
    this.overlayContainer.add(this.overlayBgImage)

    // GAME OVER title – shown above the panel in gameover mode only
    this.overlayTitle = this.add.text(0, 0, 'GAME OVER', {
      fontFamily: FONT, fontSize: '26px', color: '#c8ff00',
      fontStyle: 'bold', align: 'center',
      stroke: '#0b1a00', strokeThickness: 4,
    }).setOrigin(0.5, 1)
      .setShadow(0, 0, '#2aff7b', 12, true, true)
    this.overlayContainer.add(this.overlayTitle)

    // Score line – shown below title in gameover mode
    this.overlayScore = this.add.text(0, 0, '', {
      fontFamily: FONT, fontSize: '18px', color: '#ffffff',
      align: 'center', stroke: '#0b1a00', strokeThickness: 3,
    }).setOrigin(0.5, 1)
    this.overlayContainer.add(this.overlayScore)

    // Status line (submitting / error)
    this.overlayStatus = this.add.text(0, 0, '', {
      fontFamily: FONT, fontSize: '12px', color: '#7aad00', align: 'center',
    }).setOrigin(0.5, 0)
    this.overlayContainer.add(this.overlayStatus)

    // 10 row slots – text sits inside the image's row boxes
    for (let i = 0; i < 10; i++) {
      const row = this.add.text(0, 0, '', {
        fontFamily: FONT, fontSize: '13px', color: '#b8ff00', fontStyle: 'bold',
      }).setOrigin(0, 0.5)
      this.overlayRows.push(row)
      this.overlayContainer.add(row)
    }

    // Bottom action button
    this.overlayRestartBtn = this.add.text(0, 0, 'PLAY AGAIN', {
      fontFamily: FONT, fontSize: '16px', color: '#0b1a00',
      backgroundColor: '#c8ff00',
      padding: { x: 22, y: 11 },
      fontStyle: 'bold',
    }).setOrigin(0.5, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        if (this.overlayMode === 'browse') this.hideOverlay()
        else this.restartGame()
      })
    this.overlayContainer.add(this.overlayRestartBtn)

    this.overlayContainer.setVisible(false)
    this.layoutOverlay()
  }

  /** Position all overlay elements relative to the leaderboard panel image. */
  private layoutOverlay(): void {
    const { width, height } = this.scale
    const cx = width  / 2
    const cy = height / 2

    const margin = 18

    this.overlayBg.setPosition(cx, cy).setSize(width, height)

    // leaderboard.png is 1024×1536 → aspect ratio 1.5
    const IMG_RATIO = 1.5

    // Reserve vertical space below the panel so the game-over text and button don't get clipped
    // on shorter mobile screens (e.g. height < ~625).
    const reservedBelow = this.overlayMode === 'gameover' ? 190 : 70
    const maxPanelHByHeight = Math.max(220, height - margin * 2 - reservedBelow)
    const panelWByHeight = maxPanelHByHeight / IMG_RATIO

    const panelW    = Math.min(width * 0.88, panelWByHeight)
    const panelH    = panelW * IMG_RATIO
    const panelLeft = cx - panelW / 2
    const panelTop  = margin   // pin panel to top so the image's own internal top padding acts as the gap

    this.overlayBgImage.setPosition(cx, panelTop + panelH / 2).setDisplaySize(panelW, panelH)

    // Title + score visible only in gameover mode, below the panel
    if (this.overlayMode === 'gameover') {
      this.overlayTitle.setVisible(true)
      this.overlayScore.setVisible(true)
      this.overlayTitle.setPosition(cx, panelTop + panelH + 10)
      this.overlayScore.setPosition(cx, panelTop + panelH + 38)
    } else {
      this.overlayTitle.setVisible(false)
      this.overlayScore.setVisible(false)
    }

    this.overlayStatus.setPosition(cx, panelTop + panelH * 0.14)

    // Exact positions derived from image measurements (1024×1536):
    //   text X = 305/1024 = 29.79% from left edge of image (then nudged right for padding)
    //   row 1 Y = 381/1536 = 24.80% from top  (this is the TOP of the box)
    //   box height = 47px → half = 23.5px → 23.5/1536 = 1.53% to reach centre
    //   spacing = 79/1536  = 5.14%  per row
    const ROW_TEXT_X_NUDGE_PX = 24 // extra left padding inside the row box
    const rowTextX   = panelLeft + panelW * ((305 + ROW_TEXT_X_NUDGE_PX) / 1024)
    const rowStartY  = panelTop  + panelH * (0.2480 + 0.0153)  // top + half-box
    const rowSpacing = panelH    * 0.0514
    const fs         = Math.max(9, Math.round(panelH * 0.0178))

    for (let i = 0; i < this.overlayRows.length; i++) {
      this.overlayRows[i]
        .setOrigin(0, 0.5)
        .setPosition(rowTextX, rowStartY + i * rowSpacing)
        .setFontSize(`${fs}px`)
    }

    // Action button just below the panel
    this.overlayRestartBtn.setPosition(cx, panelTop + panelH + (this.overlayMode === 'gameover' ? 64 : 10))

    // Mobile/short screens: ensure the bottom content (score/button) stays visible.
    // We keep the dim backdrop full-screen, but shift the panel + overlay elements upward as needed.
    const bottomLimit = height - margin
    const panelBounds = this.overlayBgImage.getBounds()
    const restartBounds = this.overlayRestartBtn.getBounds()

    let maxBottom = Math.max(panelBounds.bottom, restartBounds.bottom)
    if (this.overlayMode === 'gameover') {
      maxBottom = Math.max(
        maxBottom,
        this.overlayTitle.getBounds().bottom,
        this.overlayScore.getBounds().bottom,
      )
    }

    if (maxBottom > bottomLimit) {
      // Negative delta moves everything up.
      let deltaY = bottomLimit - maxBottom

      // Clamp so the panel doesn't go beyond the top margin.
      const topLimit = margin
      const nextTop = panelBounds.top + deltaY
      if (nextTop < topLimit) deltaY += topLimit - nextTop

      if (deltaY !== 0) {
        const shiftY = (obj: Phaser.GameObjects.GameObject & { y: number; setY: (y: number) => unknown }) =>
          obj.setY(obj.y + deltaY)

        shiftY(this.overlayBgImage)
        shiftY(this.overlayStatus)
        this.overlayRows.forEach(r => shiftY(r))
        if (this.overlayMode === 'gameover') {
          shiftY(this.overlayTitle)
          shiftY(this.overlayScore)
        }
        shiftY(this.overlayRestartBtn)
      }
    }
  }

  /** Show the overlay and populate leaderboard rows. */
  private showOverlay(score: number, entries: LeaderboardEntry[] | null, statusMsg: string): void {
    this.overlayVisible = true

    const newBest = score >= this.sessionBest && score > 0
    this.overlayScore.setText(
      `${score.toLocaleString()} pts${newBest ? '  🏆 New best!' : ''}`,
    )
    this.overlayStatus.setText(statusMsg)

    // Update action button label based on mode
    this.overlayRestartBtn.setText(this.overlayMode === 'browse' ? 'CLOSE' : 'PLAY AGAIN')

    // Clear all rows first
    this.overlayRows.forEach(r => r.setText(''))

    if (entries && entries.length > 0) {
      entries.slice(0, 10).forEach((e, i) => {
        const name  = e.name.slice(0, 11)
        const pts   = e.score.toLocaleString()
        this.overlayRows[i].setText(`${name}   ${pts}`)
        if (this.overlayMode === 'gameover' && e.score === score)
          this.overlayRows[i].setColor('#ffffff')
        else if (i === 0) this.overlayRows[i].setColor('#ffe84d')
        else if (i === 1) this.overlayRows[i].setColor('#d4d4d4')
        else if (i === 2) this.overlayRows[i].setColor('#cd7f32')
        else              this.overlayRows[i].setColor('#b8ff00')
      })
    } else if (!leaderboardConfigured()) {
      this.overlayRows[0].setText('No leaderboard configured')
      this.overlayRows[1].setText('leaderboard.ts')
      this.overlayRows[0].setColor('#c8ff00')
      this.overlayRows[1].setColor('#7aad00')
    }

    this.overlayContainer.setVisible(true)
    this.layoutOverlay()
  }

  /** Open the leaderboard in browse mode (no score submission, available pre-game). */
  private showLeaderboardOnly(): void {
    if (this.overlayVisible) return
    this.overlayMode = 'browse'
    this.overlayRows.forEach(r => r.setText(''))
    this.overlayStatus.setText('Loading…')
    this.showOverlay(0, null, 'Loading…')

    if (!leaderboardConfigured()) {
      this.showOverlay(0, null, '')
      return
    }

    void fetchLeaderboard().then(entries => {
      if (this.overlayVisible && this.overlayMode === 'browse')
        this.showOverlay(0, entries, '')
    })
  }

  private hideOverlay(): void {
    this.overlayMode    = 'gameover'
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
    const btnRowY1 = py + dy * 4 + LO + 8
    const btnRowY2 = btnRowY1 + 32
    const btnRowY3 = btnRowY2 + 32
    this.pauseButton.setPosition(px,       btnRowY1).setOrigin(0, 0)
    this.restartButton.setPosition(px + 90, btnRowY1).setOrigin(0, 0)
    this.leaderboardButton.setPosition(px, btnRowY2).setOrigin(0, 0)
    this.settingsButton.setPosition(px,    btnRowY3).setOrigin(0, 0)
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
    const btnRowGap = 36
    this.pauseButton.setPosition(width / 2 - 54,  btnY).setOrigin(0.5, 0)
    this.restartButton.setPosition(width / 2 + 54, btnY).setOrigin(0.5, 0)
    this.leaderboardButton.setPosition(width / 2 - 54, btnY + btnRowGap).setOrigin(0.5, 0)
    this.settingsButton.setPosition(width / 2 + 54,    btnY + btnRowGap).setOrigin(0.5, 0)
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

  /** On game over: set mode to gameover, submit score, show leaderboard. */
  private onGameOver(): void {
    this.overlayMode = 'gameover'
    this.pauseButton.setText('⏸ Pause').setAlpha(0.35)
    const currentScore = readRegistryNumber(this, RegistryKeys.Score, 0)
    // Submit the all-time best to the leaderboard, but display only this round's score.
    const submitBest = Math.max(currentScore, this.sessionBest)

    // Show immediately (no status message)
    this.showOverlay(currentScore, null, '')

    if (!leaderboardConfigured()) return

    // Get or prompt for player name (stored so they only type it once)
    let name = localStorage.getItem(LS_NAME_KEY) ?? ''
    if (!name) {
      name = window.prompt('Enter your name for the leaderboard:', 'Player') ?? 'Player'
      localStorage.setItem(LS_NAME_KEY, name.trim() || 'Player')
    }

    void submitScore(name, submitBest).then(entries => {
      if (entries) {
        this.showOverlay(currentScore, entries, '')
      } else {
        void fetchLeaderboard().then(fallback => {
          this.showOverlay(currentScore, fallback, '')
        })
      }
    })
  }

  private onGameRestart(): void {
    this.hideOverlay()
    this.pauseButton.setText('⏸ Pause').setAlpha(1)
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
      this.pauseButton.setText('⏸ Pause')
    } else {
      this.scene.pause('GameScene')
      this.pauseButton.setText('▶ Resume')
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
