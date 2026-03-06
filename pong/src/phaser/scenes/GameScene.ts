import Phaser from 'phaser'

import { GameEvents, readRegistryBoolean, RegistryKeys } from '../config'

/* ───────────────────────── Types & constants ───────────────────────── */

enum Mode {
  DesktopHorizontal = 'DesktopHorizontal',
  MobileVertical = 'MobileVertical',
}

type Difficulty = 'easy' | 'medium' | 'hard' | 'impossible'

interface AiParams {
  maxSpeed: number
  reactionDelayMs: number
  predictionErrorPx: number
  deadzonePx: number
  lerpFactor: number
  hitChance: number // 0–1: probability AI actually tries to hit the ball
}

// ── TWEAK: AI parameters per difficulty ──
// hitChance: easy 60%, medium 70%, hard 80%, impossible 95%
const AI_CONFIGS: Record<Difficulty, AiParams> = {
  easy:       { maxSpeed: 180, reactionDelayMs: 300, predictionErrorPx: 40, deadzonePx: 20, lerpFactor: 0.06, hitChance: 0.60 },
  medium:     { maxSpeed: 260, reactionDelayMs: 160, predictionErrorPx: 20, deadzonePx: 12, lerpFactor: 0.09, hitChance: 0.70 },
  hard:       { maxSpeed: 380, reactionDelayMs: 60,  predictionErrorPx: 8,  deadzonePx: 6,  lerpFactor: 0.14, hitChance: 0.80 },
  impossible: { maxSpeed: 600, reactionDelayMs: 10,  predictionErrorPx: 2,  deadzonePx: 2,  lerpFactor: 0.25, hitChance: 0.95 },
}

// ── TWEAK: win score ──
const WIN_SCORE = 7

// ── TWEAK: ball speed settings ──
const BALL_INITIAL_SPEED = 260
const BALL_SPEED_INCREMENT = 40 // added on each paddle hit — by hit 10 the ball is ~660px/s
const BALL_MAX_SPEED = 800

// ── TWEAK: orientation detection threshold ──
const PORTRAIT_RATIO = 1.0 // width/height < this → portrait

const PADDLE_MARGIN = 30
const COUNTDOWN_SECONDS = 3
const PADDLE_SPEED = 400 // player paddle speed (desktop)

/* ───────────────────────── GameScene ───────────────────────── */

export class GameScene extends Phaser.Scene {
  public static readonly Key = 'GameScene'

  /* mode */
  private mode!: Mode

  /* game objects */
  private ball!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody
  private playerPaddle!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody
  private cpuPaddle!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody

  /* state */
  private playerScore = 0
  private cpuScore = 0
  private currentBallSpeed = BALL_INITIAL_SPEED
  private matchStarted = false
  private countdownActive = false
  private difficulty: Difficulty = 'medium'

  /* AI */
  private aiParams!: AiParams
  private aiTargetPos = 0 // the position (x or y) the AI aims for
  private aiLastReactionTime = 0 // ms timestamp of when AI last recalculated
  private aiPredictionError = 0 // randomised error offset applied to target
  private aiWillMiss = false // decided once per rally – if true, AI deliberately drifts to wrong position
  private aiMissDecided = false // whether the hit/miss roll has been made for this rally

  /* input */
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys | undefined
  private pointerTargetPos = 0 // mobile: where the player wants the paddle

  /* menu objects (destroyed when match starts) */
  private menuContainer: Phaser.GameObjects.Container | undefined

  /* score text rendered in GameScene (the UIScene handles its own overlay, but we show pong scores here) */
  private playerScoreText!: Phaser.GameObjects.Text
  private cpuScoreText!: Phaser.GameObjects.Text
  private centreText!: Phaser.GameObjects.Text

  /* timers */
  private delayedCalls: Phaser.Time.TimerEvent[] = []

  /* dashed centre line */
  private centreLineGfx!: Phaser.GameObjects.Graphics

  public constructor() {
    super(GameScene.Key)
  }

  /* ─── Lifecycle ─── */

  public create(): void {
    this.resetState()
    this.mode = this.detectMode()
    this.createUI()
    this.createArenaForMode(this.mode)
    this.createPaddlesForMode(this.mode)
    this.createBallForMode(this.mode)
    this.setupCollisions()

    // Hide gameplay objects until match starts
    this.setGameplayVisible(false)

    this.showDifficultyMenu()

    // Resize / orientation change
    this.scale.on('resize', this.handleResize, this)

    // Cleanup on shutdown
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.handleResize, this)
      this.clearAllTimers()
      this.input.keyboard?.removeAllListeners()
    })
  }

  public update(_time: number, delta: number): void {
    if (!this.matchStarted || this.countdownActive) return
    if (readRegistryBoolean(this, RegistryKeys.IsGameOver, false)) return

    this.updatePlayerInput(delta)
    this.updateAI(delta)
    this.checkScoring()
  }

  /* ─── Mode detection ─── */

  private detectMode(): Mode {
    const { width, height } = this.scale
    const isTouch = this.sys.game.device.input.touch
    const isPortrait = width / height < PORTRAIT_RATIO
    return isTouch || isPortrait ? Mode.MobileVertical : Mode.DesktopHorizontal
  }

  /* ─── State reset ─── */

  private resetState(): void {
    this.playerScore = 0
    this.cpuScore = 0
    this.currentBallSpeed = BALL_INITIAL_SPEED
    this.matchStarted = false
    this.countdownActive = false
    this.aiLastReactionTime = 0
    this.aiPredictionError = 0
    this.aiWillMiss = false
    this.aiMissDecided = false
    this.registry.set(RegistryKeys.PlayerScore, 0)
    this.registry.set(RegistryKeys.CpuScore, 0)
    this.registry.set(RegistryKeys.IsGameOver, false)
  }

  /* ─── UI (scores + centre text) ─── */

  private createUI(): void {
    const fontBase: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: 'monospace',
      fontSize: '28px',
      color: '#e2e8f0',
    }

    this.playerScoreText = this.add.text(0, 12, '0', { ...fontBase }).setOrigin(0.5, 0).setDepth(10)
    this.cpuScoreText = this.add.text(0, 12, '0', { ...fontBase }).setOrigin(0.5, 0).setDepth(10)
    this.centreText = this.add.text(0, 0, '', { ...fontBase, fontSize: '48px', color: '#fbbf24' })
      .setOrigin(0.5, 0.5)
      .setDepth(20)

    this.centreLineGfx = this.add.graphics().setDepth(0)

    this.layoutScoreText()
  }

  private layoutScoreText(): void {
    const { width, height } = this.scale
    if (this.mode === Mode.DesktopHorizontal) {
      this.playerScoreText.setPosition(width * 0.25, 12)
      this.cpuScoreText.setPosition(width * 0.75, 12)
    } else {
      this.playerScoreText.setPosition(width - 40, height * 0.75)
      this.cpuScoreText.setPosition(width - 40, height * 0.25)
    }
    this.centreText.setPosition(width / 2, height / 2)
    this.drawCentreLine()
  }

  private drawCentreLine(): void {
    const { width, height } = this.scale
    const g = this.centreLineGfx
    g.clear()
    g.lineStyle(2, 0x334155, 0.5)
    if (this.mode === Mode.DesktopHorizontal) {
      const x = width / 2
      for (let y = 0; y < height; y += 16) {
        g.moveTo(x, y)
        g.lineTo(x, y + 8)
      }
    } else {
      const y = height / 2
      for (let x = 0; x < width; x += 16) {
        g.moveTo(x, y)
        g.lineTo(x + 8, y)
      }
    }
    g.strokePath()
  }

  /* ─── Arena (world bounds) ─── */

  private createArenaForMode(mode: Mode): void {
    const { width, height } = this.scale
    this.cameras.main.setBackgroundColor(0x0b0f14)

    if (mode === Mode.DesktopHorizontal) {
      // Only top & bottom walls — left/right open so ball exits for scoring
      this.physics.world.setBounds(0, 0, width, height, false, false, true, true)
    } else {
      // Only left & right walls — top/bottom open so ball exits for scoring
      this.physics.world.setBounds(0, 0, width, height, true, true, false, false)
    }
  }

  /* ─── Paddles ─── */

  private createPaddlesForMode(mode: Mode): void {
    const { width, height } = this.scale

    if (mode === Mode.DesktopHorizontal) {
      // Left = player, Right = CPU  (tall paddles: 16×80)
      this.playerPaddle = this.physics.add
        .sprite(PADDLE_MARGIN, height / 2, 'paddle')
        .setImmovable(true) as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody
      this.playerPaddle.body.setAllowGravity(false)

      this.cpuPaddle = this.physics.add
        .sprite(width - PADDLE_MARGIN, height / 2, 'paddle')
        .setImmovable(true) as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody
      this.cpuPaddle.body.setAllowGravity(false)
    } else {
      // Bottom = player, Top = CPU  (wide paddles: 80×16)
      this.playerPaddle = this.physics.add
        .sprite(width / 2, height - PADDLE_MARGIN, 'paddleH')
        .setImmovable(true) as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody
      this.playerPaddle.body.setAllowGravity(false)

      this.cpuPaddle = this.physics.add
        .sprite(width / 2, PADDLE_MARGIN, 'paddleH')
        .setImmovable(true) as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody
      this.cpuPaddle.body.setAllowGravity(false)
    }
  }

  /* ─── Ball ─── */

  private createBallForMode(_mode: Mode): void {
    const { width, height } = this.scale
    this.ball = this.physics.add
      .sprite(width / 2, height / 2, 'ball')
      .setBounce(1, 1) as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody
    this.ball.body.setAllowGravity(false)
    this.ball.body.setMaxSpeed(BALL_MAX_SPEED)

    // For desktop: bounce off top/bottom only. For mobile: bounce off left/right only.
    // We configure per-axis world-bounce via collideWorldBounds + a custom worldbounds callback.
    this.ball.setCollideWorldBounds(true)
  }

  /* ─── Collisions ─── */

  private setupCollisions(): void {
    this.physics.add.collider(this.ball, this.playerPaddle, this.onPaddleHit as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback, undefined, this)
    this.physics.add.collider(this.ball, this.cpuPaddle, this.onPaddleHit as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback, undefined, this)
  }

  private onPaddleHit(
    ballObj: Phaser.Types.Physics.Arcade.GameObjectWithBody,
    paddleObj: Phaser.Types.Physics.Arcade.GameObjectWithBody,
  ): void {
    const ball = ballObj as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody
    const paddle = paddleObj as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody

    // Increase ball speed slightly
    this.currentBallSpeed = Math.min(this.currentBallSpeed + BALL_SPEED_INCREMENT, BALL_MAX_SPEED)

    // Calculate deflection based on where ball hit the paddle
    if (this.mode === Mode.DesktopHorizontal) {
      const relativeY = (ball.y - paddle.y) / (paddle.displayHeight / 2)
      const clampedRelY = Phaser.Math.Clamp(relativeY, -1, 1)
      const angle = clampedRelY * (Math.PI / 3) // max ±60°
      const direction = ball.x < this.scale.width / 2 ? 1 : -1
      ball.body.setVelocity(
        Math.cos(angle) * this.currentBallSpeed * direction,
        Math.sin(angle) * this.currentBallSpeed,
      )
    } else {
      const relativeX = (ball.x - paddle.x) / (paddle.displayWidth / 2)
      const clampedRelX = Phaser.Math.Clamp(relativeX, -1, 1)
      const angle = clampedRelX * (Math.PI / 3)
      const direction = ball.y > this.scale.height / 2 ? -1 : 1
      ball.body.setVelocity(
        Math.sin(angle) * this.currentBallSpeed,
        Math.cos(angle) * this.currentBallSpeed * direction,
      )
    }
  }

  /* ─── Scoring ─── */

  private checkScoring(): void {
    const { width, height } = this.scale
    const bx = this.ball.x
    const by = this.ball.y
    const margin = 16 // ball must be clearly past the edge

    if (this.mode === Mode.DesktopHorizontal) {
      if (bx <= -margin) {
        this.onScore('cpu')
      } else if (bx >= width + margin) {
        this.onScore('player')
      }
    } else {
      if (by >= height + margin) {
        this.onScore('cpu')
      } else if (by <= -margin) {
        this.onScore('player')
      }
    }
  }

  private onScore(scoredBy: 'player' | 'cpu'): void {
    if (scoredBy === 'player') {
      this.playerScore++
      this.registry.set(RegistryKeys.PlayerScore, this.playerScore)
    } else {
      this.cpuScore++
      this.registry.set(RegistryKeys.CpuScore, this.cpuScore)
    }

    this.playerScoreText.setText(String(this.playerScore))
    this.cpuScoreText.setText(String(this.cpuScore))
    this.game.events.emit(GameEvents.ScoreChanged, { player: this.playerScore, cpu: this.cpuScore })

    if (this.playerScore >= WIN_SCORE) {
      this.showWinScreen('YOU WIN!')
      return
    }
    if (this.cpuScore >= WIN_SCORE) {
      this.showWinScreen('CPU WINS!')
      return
    }

    this.resetBall(scoredBy)
  }

  /* ─── Ball reset with countdown ─── */

  private resetBall(scoredBy: 'player' | 'cpu'): void {
    const { width, height } = this.scale
    this.ball.body.setVelocity(0, 0)
    this.ball.setPosition(width / 2, height / 2)
    this.countdownActive = true
    this.currentBallSpeed = BALL_INITIAL_SPEED
    this.aiMissDecided = false
    this.aiWillMiss = false

    let remaining = COUNTDOWN_SECONDS
    this.centreText.setText(String(remaining))

    const tick = this.time.addEvent({
      delay: 700,
      repeat: COUNTDOWN_SECONDS - 1,
      callback: () => {
        remaining--
        if (remaining > 0) {
          this.centreText.setText(String(remaining))
        } else {
          this.centreText.setText('')
          this.countdownActive = false
          this.launchBall(scoredBy === 'player' ? 'towardCpu' : 'towardPlayer')
        }
      },
    })
    this.delayedCalls.push(tick)
  }

  private launchBall(toward: 'towardCpu' | 'towardPlayer'): void {
    const angle = Phaser.Math.FloatBetween(-Math.PI / 6, Math.PI / 6)

    if (this.mode === Mode.DesktopHorizontal) {
      const dirX = toward === 'towardCpu' ? 1 : -1
      this.ball.body.setVelocity(
        Math.cos(angle) * this.currentBallSpeed * dirX,
        Math.sin(angle) * this.currentBallSpeed,
      )
    } else {
      const dirY = toward === 'towardCpu' ? -1 : 1
      this.ball.body.setVelocity(
        Math.sin(angle) * this.currentBallSpeed,
        Math.cos(angle) * this.currentBallSpeed * dirY,
      )
    }
  }

  /* ─── Player input ─── */

  private setupControlsForMode(mode: Mode): void {
    if (mode === Mode.DesktopHorizontal) {
      const keyboard = this.input.keyboard
      if (keyboard) {
        this.cursors = keyboard.createCursorKeys()
      }
    } else {
      // Mobile: track pointer position
      this.input.on('pointermove', this.onPointerMove, this)
      this.input.on('pointerdown', this.onPointerMove, this)
    }
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    this.pointerTargetPos = pointer.x
  }

  private updatePlayerInput(delta: number): void {
    const dt = delta / 1000

    if (this.mode === Mode.DesktopHorizontal) {
      let vy = 0
      if (this.cursors?.up?.isDown) vy -= PADDLE_SPEED
      if (this.cursors?.down?.isDown) vy += PADDLE_SPEED
      this.playerPaddle.body.setVelocityY(vy)

      // Clamp within bounds
      const halfH = this.playerPaddle.displayHeight / 2
      const minY = halfH
      const maxY = this.scale.height - halfH
      this.playerPaddle.y = Phaser.Math.Clamp(this.playerPaddle.y, minY, maxY)
    } else {
      // Smoothly move toward pointer X
      const halfW = this.playerPaddle.displayWidth / 2
      const target = Phaser.Math.Clamp(this.pointerTargetPos, halfW, this.scale.width - halfW)
      const diff = target - this.playerPaddle.x
      const maxDelta = PADDLE_SPEED * dt
      this.playerPaddle.x += Phaser.Math.Clamp(diff, -maxDelta, maxDelta)
      this.playerPaddle.body.reset(this.playerPaddle.x, this.playerPaddle.y)
    }
  }

  /* ─── CPU AI ─── */

  private updateAI(delta: number): void {
    const dt = delta / 1000
    const now = this.time.now
    const ai = this.aiParams

    const ballMovingTowardCpu = this.isBallMovingTowardCpu()

    // Roll hit/miss once per rally when ball starts coming toward CPU
    if (ballMovingTowardCpu && !this.aiMissDecided) {
      this.aiMissDecided = true
      this.aiWillMiss = Math.random() >= ai.hitChance
    }
    // Reset decision when ball moves away (new rally)
    if (!ballMovingTowardCpu) {
      this.aiMissDecided = false
      this.aiWillMiss = false
    }

    if (ballMovingTowardCpu && now - this.aiLastReactionTime >= ai.reactionDelayMs) {
      this.aiLastReactionTime = now

      if (this.aiWillMiss) {
        // Miss by just barely more than half the paddle — looks like a near-miss
        const intercept = this.predictBallIntercept()
        const paddleHalf = this.mode === Mode.DesktopHorizontal
          ? this.cpuPaddle.displayHeight / 2
          : this.cpuPaddle.displayWidth / 2
        const missOffset = Phaser.Math.FloatBetween(paddleHalf + 8, paddleHalf + 30)
        const missDir = Math.random() < 0.5 ? 1 : -1
        this.aiTargetPos = intercept + missOffset * missDir
        this.aiPredictionError = 0
      } else {
        this.aiTargetPos = this.predictBallIntercept()
        this.aiPredictionError = Phaser.Math.FloatBetween(-ai.predictionErrorPx, ai.predictionErrorPx)
      }
    }

    // If ball moving away, slowly return to centre
    const targetWithError = ballMovingTowardCpu
      ? this.aiTargetPos + this.aiPredictionError
      : this.getCentrePosition()

    const currentPos = this.mode === Mode.DesktopHorizontal ? this.cpuPaddle.y : this.cpuPaddle.x
    const diff = targetWithError - currentPos

    if (Math.abs(diff) < ai.deadzonePx) return

    // Smooth lerp + capped velocity
    const lerpedTarget = Phaser.Math.Linear(currentPos, targetWithError, ai.lerpFactor)
    const clampedDelta = Phaser.Math.Clamp(lerpedTarget - currentPos, -ai.maxSpeed * dt, ai.maxSpeed * dt)

    if (this.mode === Mode.DesktopHorizontal) {
      const halfH = this.cpuPaddle.displayHeight / 2
      this.cpuPaddle.y = Phaser.Math.Clamp(this.cpuPaddle.y + clampedDelta, halfH, this.scale.height - halfH)
      this.cpuPaddle.body.reset(this.cpuPaddle.x, this.cpuPaddle.y)
    } else {
      const halfW = this.cpuPaddle.displayWidth / 2
      this.cpuPaddle.x = Phaser.Math.Clamp(this.cpuPaddle.x + clampedDelta, halfW, this.scale.width - halfW)
      this.cpuPaddle.body.reset(this.cpuPaddle.x, this.cpuPaddle.y)
    }
  }

  private isBallMovingTowardCpu(): boolean {
    if (this.mode === Mode.DesktopHorizontal) {
      return (this.ball.body.velocity.x > 0) // CPU is on the right
    }
    return (this.ball.body.velocity.y < 0) // CPU is at the top
  }

  private predictBallIntercept(): number {
    if (this.mode === Mode.DesktopHorizontal) {
      // Predict Y where ball will reach CPU's x
      const vx = this.ball.body.velocity.x
      const vy = this.ball.body.velocity.y
      if (vx <= 0) return this.cpuPaddle.y // shouldn't happen
      const timeToReach = (this.cpuPaddle.x - this.ball.x) / vx
      let predictedY = this.ball.y + vy * timeToReach
      // Simulate bounces off top/bottom
      const h = this.scale.height
      predictedY = this.reflectAxis(predictedY, 0, h)
      return predictedY
    } else {
      const vx = this.ball.body.velocity.x
      const vy = this.ball.body.velocity.y
      if (vy >= 0) return this.cpuPaddle.x
      const timeToReach = (this.cpuPaddle.y - this.ball.y) / vy
      let predictedX = this.ball.x + vx * timeToReach
      const w = this.scale.width
      predictedX = this.reflectAxis(predictedX, 0, w)
      return predictedX
    }
  }

  /** Simulate axis-aligned bouncing to find final position within [min, max]. */
  private reflectAxis(value: number, min: number, max: number): number {
    const range = max - min
    if (range <= 0) return (min + max) / 2
    let v = value - min
    v = v % (range * 2)
    if (v < 0) v += range * 2
    if (v > range) v = range * 2 - v
    return v + min
  }

  private getCentrePosition(): number {
    if (this.mode === Mode.DesktopHorizontal) return this.scale.height / 2
    return this.scale.width / 2
  }

  /* ─── Difficulty menu ─── */

  private showDifficultyMenu(): void {
    const { width, height } = this.scale

    this.menuContainer = this.add.container(width / 2, height / 2).setDepth(50)

    // Background overlay
    const bg = this.add.graphics()
    bg.fillStyle(0x0b0f14, 0.92)
    bg.fillRoundedRect(-160, -170, 320, 340, 16)
    this.menuContainer.add(bg)

    // Title
    const title = this.add.text(0, -140, 'PONG', {
      fontFamily: 'monospace',
      fontSize: '48px',
      color: '#fbbf24',
    }).setOrigin(0.5, 0.5)
    this.menuContainer.add(title)

    // Subtitle
    const subtitle = this.add.text(0, -90, 'Select Difficulty', {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: '#94a3b8',
    }).setOrigin(0.5, 0.5)
    this.menuContainer.add(subtitle)

    const difficulties: { label: string; key: Difficulty; color: number }[] = [
      { label: 'Easy', key: 'easy', color: 0x22c55e },
      { label: 'Medium', key: 'medium', color: 0x3b82f6 },
      { label: 'Hard', key: 'hard', color: 0xf97316 },
      { label: 'Impossible', key: 'impossible', color: 0xef4444 },
    ]

    difficulties.forEach((d, i) => {
      const yPos = -40 + i * 60

      const btnBg = this.add.graphics()
      btnBg.fillStyle(d.color, 0.2)
      btnBg.fillRoundedRect(-110, yPos - 20, 220, 44, 8)
      btnBg.lineStyle(2, d.color, 0.7)
      btnBg.strokeRoundedRect(-110, yPos - 20, 220, 44, 8)
      this.menuContainer!.add(btnBg)

      const btnText = this.add.text(0, yPos, d.label, {
        fontFamily: 'monospace',
        fontSize: '22px',
        color: '#e2e8f0',
      }).setOrigin(0.5, 0.5)

      // Create a hit area zone for interaction
      const zone = this.add.zone(0, yPos, 220, 44).setInteractive({ useHandCursor: true })
      zone.on('pointerover', () => btnText.setColor('#ffffff'))
      zone.on('pointerout', () => btnText.setColor('#e2e8f0'))
      zone.on('pointerdown', () => this.selectDifficulty(d.key))

      this.menuContainer!.add(btnText)
      this.menuContainer!.add(zone)
    })
  }

  private selectDifficulty(difficulty: Difficulty): void {
    this.difficulty = difficulty
    this.aiParams = { ...AI_CONFIGS[difficulty] }

    if (this.menuContainer) {
      this.menuContainer.destroy(true)
      this.menuContainer = undefined
    }

    this.setGameplayVisible(true)
    this.setupControlsForMode(this.mode)
    this.matchStarted = true
    this.resetBall('player')
  }

  /* ─── Win screen ─── */

  private showWinScreen(message: string): void {
    this.registry.set(RegistryKeys.IsGameOver, true)
    this.game.events.emit(GameEvents.GameOver)
    this.ball.body.setVelocity(0, 0)

    const { width, height } = this.scale

    this.menuContainer = this.add.container(width / 2, height / 2).setDepth(50)

    const bg = this.add.graphics()
    bg.fillStyle(0x0b0f14, 0.92)
    bg.fillRoundedRect(-160, -110, 320, 220, 16)
    this.menuContainer.add(bg)

    const msgText = this.add.text(0, -70, message, {
      fontFamily: 'monospace',
      fontSize: '36px',
      color: '#fbbf24',
    }).setOrigin(0.5, 0.5)
    this.menuContainer.add(msgText)

    const scoreText = this.add.text(0, -20, `${this.playerScore}  -  ${this.cpuScore}`, {
      fontFamily: 'monospace',
      fontSize: '28px',
      color: '#e2e8f0',
    }).setOrigin(0.5, 0.5)
    this.menuContainer.add(scoreText)

    // Play Again button
    const btnBg = this.add.graphics()
    btnBg.fillStyle(0x3b82f6, 0.3)
    btnBg.fillRoundedRect(-90, 20, 180, 50, 8)
    btnBg.lineStyle(2, 0x3b82f6, 0.7)
    btnBg.strokeRoundedRect(-90, 20, 180, 50, 8)
    this.menuContainer.add(btnBg)

    const btnText = this.add.text(0, 44, 'Play Again', {
      fontFamily: 'monospace',
      fontSize: '22px',
      color: '#93c5fd',
    }).setOrigin(0.5, 0.5)
    this.menuContainer.add(btnText)

    const zone = this.add.zone(0, 44, 180, 50).setInteractive({ useHandCursor: true })
    zone.on('pointerdown', () => this.restartMatch())
    this.menuContainer.add(zone)

    // Also allow Enter key or tap anywhere outside button
    const enterKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER)
    enterKey?.once('down', () => this.restartMatch())
  }

  private restartMatch(): void {
    this.clearAllTimers()
    this.scene.restart()
  }

  /* ─── Visibility helpers ─── */

  private setGameplayVisible(visible: boolean): void {
    const alpha = visible ? 1 : 0
    this.ball.setAlpha(alpha)
    this.playerPaddle.setAlpha(alpha)
    this.cpuPaddle.setAlpha(alpha)
    this.playerScoreText.setAlpha(alpha)
    this.cpuScoreText.setAlpha(alpha)
    this.centreLineGfx.setAlpha(alpha)
  }

  /* ─── Resize handling ─── */

  private handleResize(gameSize: Phaser.Structs.Size): void {
    const width = Math.max(1, Math.floor(gameSize.width))
    const height = Math.max(1, Math.floor(gameSize.height))

    const newMode = this.detectMode()
    if (newMode !== this.mode) {
      // Mode changed – full restart
      this.clearAllTimers()
      this.scene.restart()
      return
    }

    if (this.mode === Mode.DesktopHorizontal) {
      this.physics.world.setBounds(0, 0, width, height, false, false, true, true)
    } else {
      this.physics.world.setBounds(0, 0, width, height, true, true, false, false)
    }
    this.layoutScoreText()

    // Keep paddles in valid positions
    if (this.mode === Mode.DesktopHorizontal) {
      this.playerPaddle.setX(PADDLE_MARGIN)
      this.cpuPaddle.setX(width - PADDLE_MARGIN)
      this.playerPaddle.y = Phaser.Math.Clamp(this.playerPaddle.y, 0, height)
      this.cpuPaddle.y = Phaser.Math.Clamp(this.cpuPaddle.y, 0, height)
    } else {
      this.playerPaddle.setY(height - PADDLE_MARGIN)
      this.cpuPaddle.setY(PADDLE_MARGIN)
      this.playerPaddle.x = Phaser.Math.Clamp(this.playerPaddle.x, 0, width)
      this.cpuPaddle.x = Phaser.Math.Clamp(this.cpuPaddle.x, 0, width)
    }

    // Re-centre menu if visible
    if (this.menuContainer) {
      this.menuContainer.setPosition(width / 2, height / 2)
    }
  }

  /* ─── Timer management ─── */

  private clearAllTimers(): void {
    for (const t of this.delayedCalls) {
      t.destroy()
    }
    this.delayedCalls = []
  }
}
