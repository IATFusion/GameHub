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

/* ──────────────────────────────────────────────
 * TWEAK THESE to adjust difficulty / feel
 * ────────────────────────────────────────────── */

const GRID_COLS = 4
const GRID_ROWS = 4
/** How many cells can be lit at the same time. */
const MAX_ACTIVE = 4
const BASE_HIT_SCORE = 10
const MISS_PENALTY = 5

/** Delay (ms) before a new cell lights up after one is clicked. */
const RESPAWN_DELAY_MS = 250

interface GridCell {
  index:     number
  col:       number
  row:       number
  x:         number
  y:         number
  active:    boolean
  node?:     Phaser.GameObjects.Image  // egg sprite
  baseScale: number                    // baseline scale for breathing tweens
}

/**
 * GameScene – Grid Target Clicker
 *
 * A 4x4 grid of circles is always visible. Up to MAX_ACTIVE
 * circles are "lit" at once. Click lit circles to score; miss
 * and your combo resets. Targets that expire also count as misses.
 */
export class GameScene extends Phaser.Scene {
  public static readonly Key = 'GameScene'

  /* ── state ── */
  private combo     = 0
  private isWaiting = true   // waiting for first tap
  private isRunning = false  // true once countdown finishes

  /* ── grid ── */
  private cells:      GridCell[] = []
  private cellRadius = 0

  /* ── game objects ── */
  private missOverlay!:    Phaser.GameObjects.Rectangle
  private tapPromptText!:  Phaser.GameObjects.Text
  private cdLabel!:        Phaser.GameObjects.Text

  /* ── particles ── */
  private slimeParticles!: Phaser.GameObjects.Particles.ParticleEmitter

  /* ── audio ── */
  private audioCtx: AudioContext | null = null
  private music!:   Phaser.Sound.WebAudioSound

  /* ── timers ── */
  private countdownEvent?: Phaser.Time.TimerEvent

  public constructor() {
    super(GameScene.Key)
  }

  /* ================================================================
   * Lifecycle
   * ============================================================= */

  public create(): void {
    this.cameras.main.setBackgroundColor(0x0b0f14)

    this.combo     = 0
    this.isWaiting = true
    this.isRunning = false

    // A) Background – centered and scaled to fill canvas
    const { width, height } = this.scale
    this.add.image(width / 2, height / 2, 'bg')
      .setDisplaySize(width, height)
      .setDepth(-10)

    this.createMissOverlay()

    this.buildGrid()
    this.buildNodes()   // B) create egg sprites for each cell

    // G) Slime particle emitter – created once, reused per correct tap
    this.slimeParticles = this.add.particles(0, 0, 'active', {
      speed:    { min: 80,   max: 220 },
      scale:    { start: 0.14, end: 0 },
      alpha:    { start: 0.85, end: 0 },
      lifespan: { min: 250,  max: 420 },
      angle:    { min: 0,    max: 360 },
      rotate:   { min: -30,  max: 30  },
      gravityY: 120,
      blendMode: 'ADD',
      emitting:  false,
    }).setDepth(5)

    // Background music – looping, starts at rate 1, speeds up with combo
    this.music = this.sound.add('bgmusic', { loop: true, volume: 0.5, rate: 1 }) as Phaser.Sound.WebAudioSound
    this.music.play()

    this.createTapPrompt()
    this.setupInput()

    this.scale.on('resize', this.handleResize, this)

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.handleResize, this)
      this.input.off('pointerdown', this.onPointerDown, this)
      this.countdownEvent?.destroy()
      this.countdownEvent = undefined
      this.isRunning = false
      this.isWaiting = false
      if (this.audioCtx) { void this.audioCtx.close(); this.audioCtx = null }
      this.music?.stop()
      this.tapPromptText?.destroy()
      this.cdLabel?.destroy()
    })
  }

  /* ================================================================
   * Grid layout
   * ============================================================= */

  /** Compute cell center positions, centered on screen. */
  private buildGrid(): void {
    const { width, height } = this.scale
    const isPortrait = height > width

    const gridSize = isPortrait
      ? width * GRID_FRACTION_PORTRAIT
      : Math.min(width, height) * GRID_FRACTION
    const cellSize = gridSize / Math.max(GRID_COLS, GRID_ROWS)
    this.cellRadius = cellSize * 0.38   // tweak circle size here

    const totalW  = GRID_COLS * cellSize
    const totalH  = GRID_ROWS * cellSize
    const originX = width  / 2 - totalW / 2
    const originY = height / 2 - totalH / 2

    this.cells = []
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const index = row * GRID_COLS + col
        this.cells.push({
          index,
          col,
          row,
          x: originX + col * cellSize + cellSize / 2,
          y: originY + row * cellSize + cellSize / 2,
          active:    false,
          node:      undefined,
          baseScale: 0,
        })
      }
    }
  }

  /** B) Create/recreate egg Image nodes for every cell (destroys old ones first). */
  private buildNodes(): void {
    // Destroy any existing nodes and their tweens
    for (const cell of this.cells) {
      if (cell.node) {
        this.tweens.killTweensOf(cell.node)
        cell.node.destroy()
        cell.node = undefined
      }
    }

    const nodeSize = this.cellRadius * 4   // 2× the original cellRadius*2

    for (const cell of this.cells) {
      const node = this.add.image(cell.x, cell.y, 'idle')
        .setInteractive({ useHandCursor: true })
        .setDisplaySize(nodeSize, nodeSize)
        .setDepth(1)

      cell.node      = node
      cell.baseScale = node.scaleX

      // C) Idle breathing – slow pulse, random phase so eggs feel alive independently
      this.tweens.add({
        targets:  node,
        scale:    node.scaleX * 1.03,
        duration: 1200 + Phaser.Math.Between(-250, 250),
        yoyo:     true,
        repeat:   -1,
        ease:     'Sine.easeInOut',
        delay:    Phaser.Math.Between(0, 400),
      })
    }
  }

  /** Redraw all 16 cells (no-op: cells are now egg sprites managed by buildNodes). */
  private drawGrid(): void { /* replaced by buildNodes() + setNodeActive() */ }

  /* ================================================================
   * Node state helpers
   * ============================================================= */

  /** D) Switch a node between idle / active textures with matching feedback tweens. */
  private setNodeActive(cell: GridCell, active: boolean): void {
    cell.active = active
    const node = cell.node
    if (!node) return

    this.tweens.killTweensOf(node)

    if (active) {
      // Switch to active egg texture, pulse once to sell the activation
      node.setTexture('active').clearTint()
      this.tweens.add({
        targets:  node,
        scale:    cell.baseScale * 1.06,
        duration: 180,
        yoyo:     true,
        ease:     'Quad.easeOut',
        onComplete: () => {
          // Resume breathing on the active texture
          this.tweens.add({
            targets:  node,
            scale:    cell.baseScale * 1.03,
            duration: 1200 + Phaser.Math.Between(-250, 250),
            yoyo:     true,
            repeat:   -1,
            ease:     'Sine.easeInOut',
          })
        },
      })
    } else {
      // Return to idle texture + immediate scale reset + breathing restart
      node.setTexture('idle').clearTint().setScale(cell.baseScale)
      this.tweens.add({
        targets:  node,
        scale:    cell.baseScale * 1.03,
        duration: 1200 + Phaser.Math.Between(-250, 250),
        yoyo:     true,
        repeat:   -1,
        ease:     'Sine.easeInOut',
        delay:    Phaser.Math.Between(0, 200),
      })
    }
  }

  /** E) Success feedback: pop tween + slime burst + camera micro-shake. */
  private playSuccessFeedback(cell: GridCell): void {
    const node = cell.node
    if (!node) return

    // Kill breathing first so pop tween has clean control of scale
    this.tweens.killTweensOf(node)

    // Pop – scale up fast then settle back
    this.tweens.add({
      targets:  node,
      scale:    cell.baseScale * 1.15,
      duration: 80,
      yoyo:     true,
      ease:     'Quad.easeOut',
      onComplete: () => {
        node.setScale(cell.baseScale)
        // Restart breathing after pop
        this.tweens.add({
          targets:  node,
          scale:    cell.baseScale * 1.03,
          duration: 1200 + Phaser.Math.Between(-250, 250),
          yoyo:     true,
          repeat:   -1,
          ease:     'Sine.easeInOut',
        })
      },
    })

    // Slime splash + subtle camera shake
    this.spawnSlimeSplash(node.x, node.y)
    this.cameras.main.shake(60, 0.002)
  }

  /** F) Wrong-tap feedback: brief node nudge + red tint flash. */
  private playFailFeedback(cell: GridCell | null): void {
    if (!cell?.node) return
    const node = cell.node
    const ox   = node.x

    // Tiny horizontal nudge
    this.tweens.add({
      targets:  node,
      x:        ox + 6,
      duration: 40,
      yoyo:     true,
      repeat:   1,
      ease:     'Sine.easeInOut',
      onComplete: () => { node.x = ox },
    })

    // Brief red tint – subtle, gone in 90 ms
    node.setTint(0xff3b3b)
    this.time.delayedCall(90, () => node.clearTint())
  }

  /** G) Emit slime blob burst at (x, y) using the shared ParticleEmitter. */
  private spawnSlimeSplash(x: number, y: number): void {
    this.slimeParticles.explode(14, x, y)
  }


  /* ================================================================
   * Target activation / deactivation
   * ============================================================= */

  private activateRandomCell(): void {
    if (!this.isRunning) return

    const activeCount = this.cells.filter(c => c.active).length
    if (activeCount >= MAX_ACTIVE) return

    const inactive = this.cells.filter(c => !c.active)
    if (inactive.length === 0) return

    const cell = Phaser.Utils.Array.GetRandom(inactive) as GridCell
    this.setNodeActive(cell, true)
  }

  private deactivateCell(index: number, wasHit: boolean): void {
    const cell = this.cells[index]
    if (!cell || !cell.active) return

    // Switch visual back to idle first
    this.setNodeActive(cell, false)

    if (wasHit) {
      this.playSuccessFeedback(cell)
    } else {
      this.handleMiss()
    }

    this.time.delayedCall(RESPAWN_DELAY_MS, () => {
      if (this.isRunning) this.activateRandomCell()
    })
  }

  /* ================================================================
   * Input
   * ============================================================= */

  private setupInput(): void {
    this.input.on('pointerdown', this.onPointerDown, this)
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.isWaiting) { this.startPreCountdown(); return }
    if (!this.isRunning) return

    const hitRadius = this.cellRadius * 2.2   // scaled up to match 2× visual size

    let bestCell: GridCell | null = null
    let bestDist  = Infinity

    for (const cell of this.cells) {
      if (!cell.active) continue
      const d = Phaser.Math.Distance.Between(pointer.x, pointer.y, cell.x, cell.y)
      if (d <= hitRadius && d < bestDist) {
        bestDist = d
        bestCell = cell
      }
    }

    if (bestCell !== null) {
      this.combo += 1
      const multiplier = 1 + Math.floor(this.combo / COMBO_TIER)
      this.addScore(BASE_HIT_SCORE * multiplier)
      this.game.events.emit(GameEvents.ComboChanged, this.combo)
      this.playHitSound()
      this.deactivateCell(bestCell.index, true)
    } else {
      // F) Wrong tap – nudge the nearest active cell for visual feedback
      let nearestActive: GridCell | null = null
      let nearestDist = Infinity
      for (const cell of this.cells) {
        if (!cell.active) continue
        const d = Phaser.Math.Distance.Between(pointer.x, pointer.y, cell.x, cell.y)
        if (d < nearestDist) { nearestDist = d; nearestActive = cell }
      }
      this.playFailFeedback(nearestActive)
      this.handleMiss()
    }
  }

  /* ================================================================
   * Scoring helpers
   * ============================================================= */

  private addScore(amount: number): void {
    const current = readRegistryNumber(this, RegistryKeys.Score, 0)
    const next    = Math.max(0, current + amount)
    this.registry.set(RegistryKeys.Score, next)
    this.game.events.emit(GameEvents.ScoreChanged, next)
  }

  private handleMiss(): void {
    this.combo = 0
    this.game.events.emit(GameEvents.ComboChanged, 0)
    this.addScore(-MISS_PENALTY)
    this.playMissSound()
    this.triggerHaptic()
    this.showMissFeedback()
  }

  /* ================================================================
   * Visual feedback
   * ============================================================= */

  private showMissFeedback(): void {
    this.missOverlay.setAlpha(0.12)
    this.tweens.killTweensOf(this.missOverlay)
    this.tweens.add({
      targets:  this.missOverlay,
      alpha:    0,
      duration: 220,
      ease:     'Quad.easeOut',
    })
    this.cameras.main.shake(70, 0.004)
  }

  /* ================================================================
   * Tap-to-start countdown
   * ============================================================= */

  private createTapPrompt(): void {
    const { width, height } = this.scale
    const fontSize = Math.round(Math.min(width, height) * 0.065)
    this.tapPromptText = this.add.text(width / 2, height / 2, 'TAP TO START', {
      fontFamily: 'system-ui, Arial, sans-serif',
      fontSize:   `${fontSize}px`,
      color:      '#f1f5f9',
      fontStyle:  'bold',
      stroke:     '#0b1a12',
      strokeThickness: 5,
    }).setOrigin(0.5).setDepth(30)

    // I) Pulsing alpha prompt – 1 → 0.55 → 1 repeating
    this.tweens.add({
      targets:  this.tapPromptText,
      alpha:    0.55,
      duration: 800,
      yoyo:     true,
      repeat:   -1,
      ease:     'Sine.easeInOut',
    })
  }

  private startPreCountdown(): void {
    if (!this.isWaiting) return
    this.isWaiting = false

    // Lazy-create AudioContext on first user gesture
    this.ensureAudio()

    this.tapPromptText?.destroy()

    const { width, height } = this.scale
    const fontSize = Math.round(Math.min(width, height) * 0.22)

    this.cdLabel = this.add.text(width / 2, height / 2, '', {
      fontFamily: 'system-ui, Arial, sans-serif',
      fontSize:   `${fontSize}px`,
      color:      '#fbbf24',
      fontStyle:  'bold',
      stroke:     '#0b0f14',
      strokeThickness: 6,
    }).setOrigin(0.5).setDepth(30).setAlpha(0)

    const steps = ['3', '2', '1', 'GO!']
    let step = 0

    const showStep = (): void => {
      if (step >= steps.length) {
        this.cdLabel.destroy()
        this.beginGame()
        return
      }
      const label = steps[step++]
      this.cdLabel.setText(label).setScale(0.5).setAlpha(1)
      this.tweens.add({
        targets:  this.cdLabel,
        scaleX:   1,
        scaleY:   1,
        alpha:    label === 'GO!' ? 0 : 0.15,
        duration: 800,
        ease:     'Back.easeOut',
        onComplete: () => {
          this.time.delayedCall(label === 'GO!' ? 0 : 150, showStep)
        },
      })
    }

    showStep()
  }

  private beginGame(): void {
    this.isRunning = true
    const initial = Math.min(MAX_ACTIVE, GRID_COLS * GRID_ROWS)
    for (let i = 0; i < initial; i++) this.activateRandomCell()
    this.setupCountdownTimer()
    this.game.events.emit(GameEvents.GameStarted)
  }

  /* ================================================================
   * Audio & haptics
   * ============================================================= */

  private ensureAudio(): AudioContext {
    if (!this.audioCtx) this.audioCtx = new AudioContext()
    return this.audioCtx
  }

  /** Short sine-wave ding on hit. */
  private playHitSound(): void {
    try {
      const ctx  = this.ensureAudio()
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.setValueAtTime(880, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.18)
      gain.gain.setValueAtTime(0.18, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.18)
    } catch { /* audio unavailable – silent fail */ }
  }

  /** Plays /miss.mp3 from the public folder. */
  private playMissSound(): void {
    try {
      const audio = new Audio('/miss.mp3')
      audio.volume = 0.7
      void audio.play()
    } catch { /* audio unavailable – silent fail */ }
  }

  /** 2-pulse vibration on miss. No-ops silently on desktop / unsupported browsers. */
  private triggerHaptic(): void {
    if ('vibrate' in navigator) {
      try { navigator.vibrate([55, 25, 55]) } catch { /* ignore */ }
    }
  }

  /* ================================================================
   * UI helpers
   * ============================================================= */

  private createMissOverlay(): void {
    const { width, height } = this.scale
    this.missOverlay = this.add
      .rectangle(width / 2, height / 2, width, height, 0xff0000, 0)
      .setDepth(20)
      .setScrollFactor(0)
  }

  /* ================================================================
   * Countdown timer
   * ============================================================= */

  private setupCountdownTimer(): void {
    const defaultSeconds = readRegistryNumber(this, RegistryKeys.DefaultRoundSeconds, 60)
    this.registry.set(RegistryKeys.TimeLeftSeconds, defaultSeconds)
    this.game.events.emit(GameEvents.TimeChanged, defaultSeconds)

    this.countdownEvent?.destroy()
    this.countdownEvent = this.time.addEvent({
      delay:    1000,
      loop:     true,
      callback: () => {
        if (readRegistryBoolean(this, RegistryKeys.IsGameOver, false)) return

        const current = readRegistryNumber(this, RegistryKeys.TimeLeftSeconds, defaultSeconds)
        const next    = Math.max(0, current - 1)
        this.registry.set(RegistryKeys.TimeLeftSeconds, next)
        this.game.events.emit(GameEvents.TimeChanged, next)

        if (next <= 0) this.endGame()
      },
    })
  }

  private endGame(): void {
    if (readRegistryBoolean(this, RegistryKeys.IsGameOver, false)) return

    this.isRunning = false
    // Deactivate all cells (switch back to idle egg texture)
    this.cells.forEach(c => { if (c.active) this.setNodeActive(c, false) })

    this.registry.set(RegistryKeys.IsGameOver, true)
    this.game.events.emit(GameEvents.GameOver)
    this.scene.pause()
  }

  /* ================================================================
   * Resize
   * ============================================================= */

  private handleResize(): void {
    const { width, height } = this.scale

    // Preserve which cells were active before the rebuild
    const activeIndices = new Set(this.cells.filter(c => c.active).map(c => c.index))
    this.buildGrid()
    this.buildNodes()   // recreate egg sprites at new positions / sizes

    // Re-apply active state so hotspots are correct after resize
    activeIndices.forEach(i => {
      const cell = this.cells[i]
      if (cell) this.setNodeActive(cell, true)
    })

    this.missOverlay?.setPosition(width / 2, height / 2)
    this.missOverlay?.setSize(width, height)
  }
}
