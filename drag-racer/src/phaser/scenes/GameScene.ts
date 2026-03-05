import Phaser from 'phaser'

import { EngineAudio } from '../../audio/EngineAudio'
import { arcadeV8 } from '../../audio/engineAudioConfigs'

import {
  GameEvents,
  readRegistryBoolean,
  RegistryKeys,
} from '../config'

// ── Tuning Constants ────────────────────────────────────────────────
// tweak: reaction-time thresholds for launch (ms)
const REACTION_PERFECT_MS = 250
const REACTION_GOOD_MS = 400

// ── Christmas tree sequence (ms from enterReady) ────────────────────
const TREE_PRESTAGE_MS  = 0
const TREE_STAGE_MS     = 250
const TREE_AMBER1_MS    = 700
const TREE_AMBER2_MS    = 1100
const TREE_AMBER3_MS    = 1500
const TREE_GO_HOLD_MIN  = 200   // earliest GO after last amber
const TREE_GO_HOLD_MAX  = 800   // max random extra hold

// ── Track layout (fractions of screen) ──────────────────────────────
const TRACK_MID_FRAC     = 0.44   // top 44% = race track, bottom 56% = HUD
const TREE_X_FRAC        = 0.07
const CAR_START_X_FRAC   = 0.16
const FINISH_LINE_X_FRAC = 0.93
const AI_LANE_Y_FRAC     = 0.13
const PLAYER_LANE_Y_FRAC = 0.35
const LANE_DIV_Y_FRAC    = 0.24

// tweak: RPM perfect-shift window (normalised 0..1)
const SHIFT_PERFECT_LOW = 0.82
const SHIFT_PERFECT_HIGH = 0.90
// tweak: "good" zone boundary
const SHIFT_GOOD_LOW = 0.70
const SHIFT_GOOD_HIGH = 0.96

// tweak: RPM ramp durations per gear index 1/2/3/4/5/6 (ms)
const RAMP_DURATIONS: Record<number, number> = { 1: 2700, 2: 2700, 3: 2400, 4: 2100, 5: 1800, 6: 1500 }

// tweak: score values
const SCORE_PERFECT_LAUNCH = 300
const SCORE_GOOD_LAUNCH = 200
const SCORE_BAD_LAUNCH = 100
const SCORE_FALSE_START = -200
const SCORE_PERFECT_SHIFT = 250
const SCORE_GOOD_SHIFT = 150
const SCORE_EARLY_LATE_SHIFT = 75

// ── Quarter mile ────────────────────────────────────────────────────
const QUARTER_MILE_M = 402  // metres

// ── AI opponent ──────────────────────────────────────────────────────
const AI_FINISH_TIME_S = 11.9
// Constant-acceleration model: d = ½at²  →  a = 2d / t²
const AI_ACCEL_MS2 = (2 * QUARTER_MILE_M) / (AI_FINISH_TIME_S * AI_FINISH_TIME_S)

// ── Gear physics ────────────────────────────────────────────────────
// Max speed the engine can push the car in each gear (km/h)
const GEAR_MAX_SPEED: Record<number, number> = { 1: 75, 2: 125, 3: 170, 4: 210, 5: 240, 6: 270 }
// Peak acceleration at full throttle / redline (km/h per second)
const GEAR_ACCELERATION: Record<number, number> = { 1: 60, 2: 45, 3: 32, 4: 22, 5: 15, 6: 10 }
// Minimum throttle factor after a shift (engine isn't dead, just dropped RPM)
const THROTTLE_FLOOR = 0.3

// tweak: launch speed (km/h) granted at wheel-spin off the line
const LAUNCH_SPEED_PERFECT = 55
const LAUNCH_SPEED_GOOD = 40
const LAUNCH_SPEED_BAD = 25

// tweak: speed multiplier applied to currentSpeed on each shift
const SHIFT_MULT_PERFECT = 1.04    // perfect rev-match → tiny bonus
const SHIFT_MULT_GOOD = 1.0
const SHIFT_MULT_EARLY_LATE = 0.96  // missed rev-match → small scrub

// RPM display range
const RPM_MIN = 1200
const RPM_MAX = 9000

// tweak: popup duration (ms)
const POPUP_DURATION = 600

// tweak: combo multiplier
const COMBO_INCREMENT = 0.1
const COMBO_MAX = 1.5

// ── Race Stage ──────────────────────────────────────────────────────
const RaceStage = {
  Waiting: 0,
  Ready: 1,
  Go: 2,
  Gear1: 3,
  Gear2: 4,
  Gear3: 5,
  Gear4: 6,
  Gear5: 7,
  Gear6: 8,
  Cruising: 9,
  Finished: 10,
} as const

type RaceStage = (typeof RaceStage)[keyof typeof RaceStage]

/**
 * GameScene – Drag Racer
 *
 * A 4-stage launch + gear-shift reaction game.
 * All visuals are generated (no external assets).
 */
export class GameScene extends Phaser.Scene {
  public static readonly Key = 'GameScene'

  // ── State ─────────────────────────────────────────────────────
  private stage: RaceStage = RaceStage.Waiting
  private score = 0
  private raceStartTime = 0
  private raceElapsedMs = 0
  private goTimestamp = 0
  private rpmProgress = 0 // 0..1
  private currentSpeed = 0
  private inputLocked = false
  private shiftAccepted = false
  private comboMultiplier = 1.0
  /** How many successful shifts so far this race */
  private shiftCount = 0
  /** Dynamic left edge of the blue perfect zone (halves each shift) */
  private perfectZoneLow = SHIFT_PERFECT_LOW
  /** Distance travelled since launch (metres) */
  private distanceTravelled = 0
  /** Highest speed reached during this race (km/h) */
  private topSpeed = 0

  // ── AI state ─────────────────────────────────────────────────
  private aiDistance    = 0       // metres from start
  private aiSpeed       = 0       // m/s
  private aiRaceStarted = false
  private aiFinished    = false

  // ── Race-track display objects ────────────────────────────────
  private playerCarGraphic!: Phaser.GameObjects.Container
  private aiCarGraphic!:     Phaser.GameObjects.Container
  private treePreStage!:     Phaser.GameObjects.Arc
  private treeStage!:        Phaser.GameObjects.Arc
  private treeAmbers:        Phaser.GameObjects.Arc[] = []
  private treeGreen!:        Phaser.GameObjects.Arc
  private treeRed!:          Phaser.GameObjects.Arc

  // ── Display objects ───────────────────────────────────────────

  // RPM meter parts
  private rpmBarBg!: Phaser.GameObjects.Rectangle
  private rpmBarFill!: Phaser.GameObjects.Rectangle
  private rpmNeedle!: Phaser.GameObjects.Rectangle
  private rpmGreenZone!: Phaser.GameObjects.Rectangle
  private rpmYellowZone!: Phaser.GameObjects.Rectangle
  private rpmPerfectZone!: Phaser.GameObjects.Rectangle
  private rpmRedZone!: Phaser.GameObjects.Rectangle

  // HUD labels
  private rpmLabel!:      Phaser.GameObjects.Text
  private speedLabel!:    Phaser.GameObjects.Text
  private gearLabel!:     Phaser.GameObjects.Text
  private scoreLabel!:    Phaser.GameObjects.Text
  private raceTimeLabel!: Phaser.GameObjects.Text
  private distanceLabel!: Phaser.GameObjects.Text
  private comboLabel!:    Phaser.GameObjects.Text
  private centerMessage!: Phaser.GameObjects.Text
  private popupText!:     Phaser.GameObjects.Text

  // ── Timers ────────────────────────────────────────────────────
  private goDelayTimer?: Phaser.Time.TimerEvent
  private popupTimer?: Phaser.Time.TimerEvent

  // ── Input ─────────────────────────────────────────────────────
  private spaceKey?: Phaser.Input.Keyboard.Key
  // ── Engine audio (sample-based via EngineAudio / engine-audio MIT) ──
  private engineAudio = new EngineAudio()
  /** True once init() has been fired on the first user gesture */
  private engineAudioReady = false
  public constructor() {
    super(GameScene.Key)
  }

  /* ================================================================
   *  Lifecycle
   * ================================================================ */

  public create(): void {
    this.resetState()
    this.buildTrack()
    this.buildChristmasTree()
    this.buildCars()
    this.buildRpmMeter()
    this.buildHud()
    this.buildShiftButton()
    this.setupInput()
    this.setRpmVisible(false)
    // engineAudio.init() is deferred to the first user gesture (onShift)

    // Kick off the race sequence after a short pause
    this.time.delayedCall(500, () => this.enterReady())

    this.scale.on('resize', this.relayout, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.relayout, this)
      this.goDelayTimer?.destroy()
      this.popupTimer?.destroy()
      if (this.spaceKey) this.input.keyboard?.removeKey(this.spaceKey)
      this.engineAudio.dispose()
    })
  }

  public update(_time: number, delta: number): void {
    // Drive engine audio every frame (including Finished so it idles down)
    const { rpm, throttle } = this.getEngineAudioParams()
    this.engineAudio.update({ rpm, throttle, rpmPitchFactor: 0.5 })

    // ── AI physics (runs even after player finishes so car keeps moving) ──
    if (this.aiRaceStarted && !this.aiFinished) {
      const maxAiSpeed = AI_ACCEL_MS2 * AI_FINISH_TIME_S
      this.aiSpeed    = Math.min(this.aiSpeed + AI_ACCEL_MS2 * delta / 1000, maxAiSpeed)
      this.aiDistance += this.aiSpeed * delta / 1000
      if (this.aiDistance >= QUARTER_MILE_M) {
        this.aiDistance = QUARTER_MILE_M
        this.aiFinished = true
      }
    }

    // ── Car x positions (always update so Finished state shows correct spots) ─
    {
      const tw = this.scale.width * (FINISH_LINE_X_FRAC - CAR_START_X_FRAC)
      const sx = this.scale.width * CAR_START_X_FRAC
      this.playerCarGraphic.x = sx + Math.min(1, this.distanceTravelled / QUARTER_MILE_M) * tw
      this.aiCarGraphic.x     = sx + Math.min(1, this.aiDistance         / QUARTER_MILE_M) * tw
    }

    if (this.stage === RaceStage.Finished) return

    // ── Elapsed race time ─────────────────────────────────────────
    if (this.stage >= RaceStage.Go && this.raceStartTime > 0) {
      this.raceElapsedMs = Date.now() - this.raceStartTime
      const sec = (this.raceElapsedMs / 1000).toFixed(2)
      this.raceTimeLabel.setText(`Time: ${sec}s`)
      this.registry.set(RegistryKeys.TimeLeftSeconds, Math.floor(this.raceElapsedMs / 1000))
      this.game.events.emit(GameEvents.TimeChanged, Math.floor(this.raceElapsedMs / 1000))
    }

    // ── Continuous speed physics ──────────────────────────────────
    // throttleFac = 30-100% so the car still pulls right after a shift (engine
    // isn't dead, it just dropped RPM).  Cruising holds full power.
    if (this.isGearStage() || this.stage === RaceStage.Cruising) {
      const gear        = this.stage === RaceStage.Cruising ? 6 : this.gearIndex()
      const maxSpd      = GEAR_MAX_SPEED[gear] ?? 270
      const accel       = GEAR_ACCELERATION[gear] ?? 10
      const throttleFac = this.stage === RaceStage.Cruising
        ? 1.0
        : THROTTLE_FLOOR + (1 - THROTTLE_FLOOR) * this.rpmProgress
      this.currentSpeed = Math.min(maxSpd, this.currentSpeed + accel * throttleFac * delta / 1000)
      if (this.currentSpeed > this.topSpeed) this.topSpeed = this.currentSpeed
      this.speedLabel.setText(`${Math.round(this.currentSpeed)} km/h`)
    }

    // ── Distance tracking + quarter-mile check ────────────────────
    // (Finished already returns early above; Cruising is included here)
    if (this.stage >= RaceStage.Gear1) {
      this.distanceTravelled += (this.currentSpeed / 3.6) * (delta / 1000)
      this.distanceLabel.setText(`${Math.round(this.distanceTravelled)}m / 402m`)
      if (this.distanceTravelled >= QUARTER_MILE_M) {
        this.finishRace()
        return
      }
    }

    // ── RPM ramp during gear stages ───────────────────────────────
    if (this.isGearStage() && !this.shiftAccepted) {
      const ramp = RAMP_DURATIONS[this.gearIndex()] ?? 1500
      this.rpmProgress = Math.min(1, this.rpmProgress + delta / ramp)
      this.drawRpm()

      // Over-rev → auto-miss
      if (this.rpmProgress >= 1) {
        this.shiftAccepted = true
        this.resolveShift('OVER-REV!', '#f85149', SCORE_EARLY_LATE_SHIFT, SHIFT_MULT_EARLY_LATE, true)
      }
    }
  }

  /* ================================================================
   *  State
   * ================================================================ */

  private resetState(): void {
    // Always start with a fresh audio engine (Phaser reuses scene instances on restart)
    this.engineAudio     = new EngineAudio()
    this.engineAudioReady = false

    this.stage = RaceStage.Waiting
    this.score = 0
    this.raceStartTime = 0
    this.raceElapsedMs = 0
    this.goTimestamp = 0
    this.rpmProgress = 0
    this.currentSpeed = 0
    this.inputLocked = false
    this.shiftAccepted = false
    this.comboMultiplier = 1.0
    this.shiftCount = 0
    this.perfectZoneLow = SHIFT_PERFECT_LOW
    this.distanceTravelled = 0
    this.topSpeed = 0
    this.aiDistance    = 0
    this.aiSpeed       = 0
    this.aiRaceStarted = false
    this.aiFinished    = false

    // Sync registry
    this.registry.set(RegistryKeys.Score, 0)
    this.registry.set(RegistryKeys.TimeLeftSeconds, 0)
    this.registry.set(RegistryKeys.IsGameOver, false)
    this.game.events.emit(GameEvents.ScoreChanged, 0)
    this.game.events.emit(GameEvents.TimeChanged, 0)
  }

  /* ================================================================
   *  Visual construction
   * ================================================================ */

  /* ── Track visual ─────────────────────────────────────────────── */

  private buildTrack(): void {
    const { width, height } = this.scale
    const trackH  = height * TRACK_MID_FRAC
    const laneH   = trackH * 0.36

    // Tarmac background
    this.add.rectangle(width / 2, trackH / 2, width, trackH, 0x0e0e16).setDepth(0)

    // Lane beds
    this.add.rectangle(width / 2, height * AI_LANE_Y_FRAC,     width, laneH, 0x14141e).setDepth(1)
    this.add.rectangle(width / 2, height * PLAYER_LANE_Y_FRAC, width, laneH, 0x14141e).setDepth(1)

    // Lane divider
    this.add.rectangle(width / 2, height * LANE_DIV_Y_FRAC, width, 2, 0x2a2a40).setDepth(2)

    // Dashed center stripes (one per lane)
    const dashW   = 20
    const dashGap = 28
    const numD    = Math.ceil(width / (dashW + dashGap)) + 1
    for (let i = 0; i < numD; i++) {
      const dx = i * (dashW + dashGap)
      this.add.rectangle(dx, height * AI_LANE_Y_FRAC,     dashW, 2, 0x22223a).setOrigin(0, 0.5).setDepth(2).setAlpha(0.8)
      this.add.rectangle(dx, height * PLAYER_LANE_Y_FRAC, dashW, 2, 0x22223a).setOrigin(0, 0.5).setDepth(2).setAlpha(0.8)
    }

    // Track borders
    this.add.rectangle(width / 2, 2,          width, 4, 0x252540).setDepth(2)
    this.add.rectangle(width / 2, trackH - 1, width, 4, 0x30363d).setDepth(2)

    // Start line
    const startX = width * CAR_START_X_FRAC
    this.add.rectangle(startX, trackH / 2, 3, trackH, 0xffffff).setDepth(3).setAlpha(0.4)

    // Finish line — checkered flag
    const finX = width * FINISH_LINE_X_FRAC
    const sqSz = 9
    const rows = Math.ceil(trackH / sqSz)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < 3; c++) {
        if ((r + c) % 2 === 0) {
          this.add.rectangle(
            finX + (c - 1) * sqSz, r * sqSz + sqSz / 2, sqSz, sqSz, 0xffffff,
          ).setDepth(3).setAlpha(0.88)
        }
      }
    }

    // "FINISH" label below the line
    this.add.text(finX, trackH + 2, 'FINISH', {
      fontFamily: 'monospace, "Courier New"',
      fontSize: '9px',
      color: '#aaaacc',
    }).setOrigin(0.5, 0).setDepth(4)

    // Lane labels
    this.add.text(width * 0.035, height * AI_LANE_Y_FRAC, 'CPU', {
      fontFamily: 'monospace, "Courier New"', fontSize: '10px', color: '#ff6655',
    }).setOrigin(0.5).setDepth(6)
    this.add.text(width * 0.035, height * PLAYER_LANE_Y_FRAC, 'YOU', {
      fontFamily: 'monospace, "Courier New"', fontSize: '10px', color: '#58a6ff',
    }).setOrigin(0.5).setDepth(6)

    // HUD backdrop (below track)
    this.add.rectangle(width / 2, (trackH + height) / 2, width, height - trackH, 0x0d1117).setDepth(0)
  }

  private buildChristmasTree(): void {
    const { width, height } = this.scale
    const trackH  = height * TRACK_MID_FRAC
    const tx      = width * TREE_X_FRAC
    const spacing = trackH / 8.5
    const r       = Math.max(5, Math.min(9, spacing * 0.42))
    const topY    = spacing * 0.7

    // Panel background
    this.add.rectangle(tx, trackH / 2, r * 3.0, trackH * 0.88, 0x07070f)
      .setStrokeStyle(1, 0x1e1e30).setDepth(4)

    // Header label
    this.add.text(tx, topY - r - 5, 'TREE', {
      fontFamily: 'monospace', fontSize: '7px', color: '#444466',
    }).setOrigin(0.5, 1).setDepth(5)

    // Pre-stage (white)
    this.treePreStage = this.add.circle(tx, topY,            r, 0x151520).setDepth(5)
    this.add.circle(tx, topY,            r).setStrokeStyle(1, 0x2a2a44).setDepth(5)

    // Stage (white)
    this.treeStage = this.add.circle(tx, topY + spacing,     r, 0x151520).setDepth(5)
    this.add.circle(tx, topY + spacing,     r).setStrokeStyle(1, 0x2a2a44).setDepth(5)

    // Ambers x3
    this.treeAmbers = []
    for (let i = 0; i < 3; i++) {
      const y = topY + spacing * (2 + i)
      this.treeAmbers.push(this.add.circle(tx, y, r, 0x151510).setDepth(5))
      this.add.circle(tx, y, r).setStrokeStyle(1, 0x302810).setDepth(5)
    }

    // Green
    this.treeGreen = this.add.circle(tx, topY + spacing * 5, r, 0x0a150a).setDepth(5)
    this.add.circle(tx, topY + spacing * 5, r).setStrokeStyle(1, 0x103010).setDepth(5)

    // Red (foul)
    this.treeRed = this.add.circle(tx, topY + spacing * 6,   r, 0x150a0a).setDepth(5)
    this.add.circle(tx, topY + spacing * 6,   r).setStrokeStyle(1, 0x301010).setDepth(5)
  }

  private buildCars(): void {
    const { width, height } = this.scale
    const carW   = 70
    const carH   = 20
    const startX = width * CAR_START_X_FRAC

    // ── Player car (blue) ──────────────────────────────────────────
    const pb = this.add.rectangle(0, 0,  carW,        carH,      0x1856b8)
    const pc = this.add.rectangle(-3, 0, carW * 0.36, carH - 6,  0x09244e)
    const pn = this.add.rectangle(carW / 2 - 3, 0, 6, carH - 8,  0x4a9dff)
    const pd = this.add.rectangle(-carW / 2 + 3, 0, 5, carH - 4, 0x4a9dff)
    const ps = this.add.rectangle(0, -(carH / 2) + 2, carW - 8, 3, 0x58c8ff).setAlpha(0.5)
    // Wheels (two dark rectangles top/bottom)
    const pw1 = this.add.rectangle(-carW / 2 + 10, -(carH / 2) - 1, 14, 5, 0x1a1a1a)
    const pw2 = this.add.rectangle( carW / 2 - 10, -(carH / 2) - 1, 14, 5, 0x1a1a1a)
    const pw3 = this.add.rectangle(-carW / 2 + 10,  (carH / 2) + 1, 14, 5, 0x1a1a1a)
    const pw4 = this.add.rectangle( carW / 2 - 10,  (carH / 2) + 1, 14, 5, 0x1a1a1a)

    this.playerCarGraphic = this.add
      .container(startX, height * PLAYER_LANE_Y_FRAC, [pb, pc, pn, pd, ps, pw1, pw2, pw3, pw4])
      .setDepth(10)

    // ── AI car (red) ───────────────────────────────────────────────
    const ab = this.add.rectangle(0, 0,  carW,        carH,      0xaa1414)
    const ac = this.add.rectangle(-3, 0, carW * 0.36, carH - 6,  0x4e0909)
    const an = this.add.rectangle(carW / 2 - 3, 0, 6, carH - 8,  0xff4422)
    const ad = this.add.rectangle(-carW / 2 + 3, 0, 5, carH - 4, 0xff4422)
    const as_ = this.add.rectangle(0, -(carH / 2) + 2, carW - 8, 3, 0xff6644).setAlpha(0.5)
    const aw1 = this.add.rectangle(-carW / 2 + 10, -(carH / 2) - 1, 14, 5, 0x1a1a1a)
    const aw2 = this.add.rectangle( carW / 2 - 10, -(carH / 2) - 1, 14, 5, 0x1a1a1a)
    const aw3 = this.add.rectangle(-carW / 2 + 10,  (carH / 2) + 1, 14, 5, 0x1a1a1a)
    const aw4 = this.add.rectangle( carW / 2 - 10,  (carH / 2) + 1, 14, 5, 0x1a1a1a)

    this.aiCarGraphic = this.add
      .container(startX, height * AI_LANE_Y_FRAC, [ab, ac, an, ad, as_, aw1, aw2, aw3, aw4])
      .setDepth(10)
  }

  private resetTreeLights(): void {
    this.treePreStage?.setFillStyle(0x151520)
    this.treeStage?.setFillStyle(0x151520)
    this.treeAmbers?.forEach(l => l.setFillStyle(0x151510))
    this.treeGreen?.setFillStyle(0x0a150a)
    this.treeRed?.setFillStyle(0x150a0a)
  }

  private resetCarPositions(): void {
    const { width, height } = this.scale
    const startX = width * CAR_START_X_FRAC
    this.playerCarGraphic.x = startX
    this.aiCarGraphic.x     = startX
    this.playerCarGraphic.y = height * PLAYER_LANE_Y_FRAC
    this.aiCarGraphic.y     = height * AI_LANE_Y_FRAC
  }

  private buildRpmMeter(): void {
    const { width, height } = this.scale
    const barX = width * 0.08
    const barY = height * 0.570
    const barW = width * 0.84
    const barH = Math.max(28, Math.round(height * 0.046))

    this.rpmBarBg = this.add.rectangle(barX, barY, barW, barH, 0x21262d).setOrigin(0, 0.5).setDepth(2)

    // Zone overlays — widths proportional to the normalised thresholds
    const gW = barW * SHIFT_GOOD_LOW
    const yW = barW * (SHIFT_PERFECT_LOW - SHIFT_GOOD_LOW)
    const pW = barW * (SHIFT_PERFECT_HIGH - SHIFT_PERFECT_LOW)
    const rW = barW * (1 - SHIFT_PERFECT_HIGH)

    this.rpmGreenZone = this.add
      .rectangle(barX, barY, gW, barH, 0x238636)
      .setOrigin(0, 0.5).setDepth(3).setAlpha(0.35)
    this.rpmYellowZone = this.add
      .rectangle(barX + gW, barY, yW, barH, 0xd29922)
      .setOrigin(0, 0.5).setDepth(3).setAlpha(0.35)
    this.rpmPerfectZone = this.add
      .rectangle(barX + gW + yW, barY, pW, barH, 0x58a6ff)
      .setOrigin(0, 0.5).setDepth(3).setAlpha(0.55)
    this.rpmRedZone = this.add
      .rectangle(barX + gW + yW + pW, barY, rW, barH, 0xf85149)
      .setOrigin(0, 0.5).setDepth(3).setAlpha(0.35)

    // Fill bar (moves with RPM)
    this.rpmBarFill = this.add
      .rectangle(barX, barY, 0, barH - 6, 0x58a6ff)
      .setOrigin(0, 0.5).setDepth(4)

    // Needle marker
    this.rpmNeedle = this.add
      .rectangle(barX, barY, 4, barH + 12, 0xf0f6fc)
      .setOrigin(0.5, 0.5).setDepth(5)
  }

  private buildHud(): void {
    const { width, height } = this.scale
    const mono = 'monospace, "Courier New"'

    // ── HUD divider ─────────────────────────────────────────────────
    this.add.rectangle(width / 2, height * TRACK_MID_FRAC, width, 2, 0x21262d).setDepth(5)

    // ── Row 1: Gear  |  Speed  |  Score ────────────────────────────
    const r1y = height * 0.468
    this.gearLabel = this.add
      .text(width * 0.05, r1y, 'GEAR 1 / 6', {
        fontFamily: mono, fontSize: this.hfs(17), color: '#58a6ff', fontStyle: 'bold',
      }).setOrigin(0, 0.5).setDepth(10)

    this.speedLabel = this.add
      .text(width * 0.5, r1y, '0 km/h', {
        fontFamily: mono, fontSize: this.hfs(22), color: '#f0f6fc', fontStyle: 'bold',
      }).setOrigin(0.5, 0.5).setDepth(10)

    this.scoreLabel = this.add
      .text(width * 0.95, r1y, 'Score: 0', {
        fontFamily: mono, fontSize: this.hfs(14), color: '#8b949e',
      }).setOrigin(1, 0.5).setDepth(10)

    // ── Row 2: Time  |  Distance ────────────────────────────────────
    const r2y = height * 0.508
    this.raceTimeLabel = this.add
      .text(width * 0.05, r2y, 'Time: 0.00s', {
        fontFamily: mono, fontSize: this.hfs(13), color: '#8b949e',
      }).setOrigin(0, 0.5).setDepth(10)

    this.distanceLabel = this.add
      .text(width * 0.95, r2y, '0m / 402m', {
        fontFamily: mono, fontSize: this.hfs(13), color: '#8b949e',
      }).setOrigin(1, 0.5).setDepth(10)

    // ── RPM label  +  Combo ───────────────────────────────────────────
    const r3y = height * 0.544
    this.rpmLabel = this.add
      .text(width * 0.05, r3y, 'RPM: 0', {
        fontFamily: mono, fontSize: this.hfs(13), color: '#8b949e',
      }).setOrigin(0, 0.5).setDepth(10)

    this.comboLabel = this.add
      .text(width * 0.95, r3y, '', {
        fontFamily: mono, fontSize: this.hfs(13), color: '#d2a8ff',
      }).setOrigin(1, 0.5).setDepth(10)

    // ── Centre message (overlaid on track area) ──────────────────────
    this.centerMessage = this.add
      .text(width / 2, height * LANE_DIV_Y_FRAC, '', {
        fontFamily: mono,
        fontSize:   this.hfs(44),
        color:      '#f0f6fc',
        fontStyle:  'bold',
        align:      'center',
      })
      .setOrigin(0.5)
      .setDepth(20)

    // ── Result text (final time / win-loss, shown over track) ────────
    this.popupText = this.add
      .text(width / 2, height * 0.20, '', {
        fontFamily: mono,
        fontSize:   this.hfs(28),
        color:      '#f0f6fc',
        fontStyle:  'bold',
        stroke:     '#0d1117',
        strokeThickness: 4,
        align:      'center',
      })
      .setOrigin(0.5)
      .setDepth(25)
      .setAlpha(0)
  }

  /** Responsive font size: scales with screen width, min 10px */
  private hfs(base: number): string {
    return `${Math.max(10, Math.round(base * Math.min(1, this.scale.width / 420)))}px`
  }

  private buildShiftButton(): void {
    const { width, height } = this.scale
    const bw = Math.min(340, Math.round(width  * 0.76))
    const bh = Math.max(70,  Math.round(height * 0.13))
    const by = height * 0.87
    const mono = 'monospace, "Courier New"'

    const bg = this.add
      .rectangle(0, 0, bw, bh, 0x0f2d1c)
      .setStrokeStyle(2, 0x2ea043)

    const lbl = this.add
      .text(0, -bh * 0.12, 'SHIFT', {
        fontFamily: mono,
        fontSize:   this.hfs(26),
        color:      '#3fb950',
        fontStyle:  'bold',
      })
      .setOrigin(0.5)

    const sub = this.add
      .text(0, bh * 0.22, '[ SPACE ]', {
        fontFamily: mono,
        fontSize:   this.hfs(11),
        color:      '#555566',
      })
      .setOrigin(0.5)

    this.add
      .container(width / 2, by, [bg, lbl, sub])
      .setDepth(30)
      .setSize(bw, bh)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.onShift())
      .on('pointerover', () => bg.setFillStyle(0x1a4d2e))
      .on('pointerout',  () => bg.setFillStyle(0x0f2d1c))
  }

  /* ================================================================
   *  Input
   * ================================================================ */

  private setupInput(): void {
    if (this.input.keyboard) {
      this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
      this.spaceKey.on('down', () => this.onShift())
    }
  }

  private onShift(): void {
    // Init sample-based engine audio on the very first user gesture
    // (AudioContext must be created / resumed from a user-event call stack)
    if (!this.engineAudioReady) {
      this.engineAudioReady = true
      void this.engineAudio.init({
        sounds:          arcadeV8.sounds,
        masterVolume:    0.7,
        limiterRpm:      arcadeV8.limiterRpm,
        softLimiterRpm:  arcadeV8.softLimiterRpm,
      })
    }
    if (readRegistryBoolean(this, RegistryKeys.IsGameOver, false)) return
    if (this.inputLocked) return

    switch (this.stage) {
      case RaceStage.Waiting:
        break // ignore

      case RaceStage.Ready:
        this.handleFalseStart()
        break

      case RaceStage.Go:
        this.handleLaunch()
        break

      case RaceStage.Gear1:
      case RaceStage.Gear2:
      case RaceStage.Gear3:
      case RaceStage.Gear4:
      case RaceStage.Gear5:
      case RaceStage.Gear6:
        if (!this.shiftAccepted) {
          this.shiftAccepted = true
          this.evaluateShift()
        }
        break

      case RaceStage.Finished:
        break
    }
  }

  /* ================================================================
   *  Race flow
   * ================================================================ */

  private enterReady(): void {
    this.stage = RaceStage.Ready
    this.inputLocked = false
    this.shiftAccepted = false
    this.centerMessage.setText('')
    this.gearLabel.setText('GEAR 1 / 6')
    this.resetTreeLights()
    this.resetCarPositions()

    // ── Christmas tree countdown ────────────────────────────────────
    this.time.delayedCall(TREE_PRESTAGE_MS, () => {
      this.treePreStage.setFillStyle(0xffffff)
    })
    this.time.delayedCall(TREE_STAGE_MS, () => {
      this.treeStage.setFillStyle(0xffffff)
    })
    this.time.delayedCall(TREE_AMBER1_MS, () => this.treeAmbers[0]?.setFillStyle(0xff9900))
    this.time.delayedCall(TREE_AMBER2_MS, () => this.treeAmbers[1]?.setFillStyle(0xff9900))
    this.time.delayedCall(TREE_AMBER3_MS, () => this.treeAmbers[2]?.setFillStyle(0xff9900))

    const goDelay = TREE_AMBER3_MS + TREE_GO_HOLD_MIN + Phaser.Math.Between(0, TREE_GO_HOLD_MAX)
    this.goDelayTimer = this.time.delayedCall(goDelay, () => {
      this.stage = RaceStage.Go
      this.goTimestamp = Date.now()
      if (this.raceStartTime === 0) this.raceStartTime = Date.now()
      this.treeGreen.setFillStyle(0x00ff55)
      this.aiRaceStarted = true
      this.centerMessage.setText('GO!').setColor('#3fb950').setFontSize(52)
      this.tweens.add({
        targets: this.centerMessage,
        scaleX: 1.3,
        scaleY: 1.3,
        duration: 120,
        yoyo: true,
      })
    })
  }

  /* ── Stage 1: Launch ─────────────────────────────────────────── */

  private handleFalseStart(): void {
    this.inputLocked = true
    this.goDelayTimer?.destroy()
    this.addScore(SCORE_FALSE_START)
    this.currentSpeed = 0
    this.speedLabel.setText('0 km/h')
    this.treeRed.setFillStyle(0xff2222)           // red foul light
    this.treeGreen.setFillStyle(0x0a150a)         // kill green (if lit early)
    this.showPopup('FALSE START!', '#f85149')
    this.centerMessage.setText('')
    this.comboMultiplier = 1.0

    this.time.delayedCall(1200, () => {
      this.inputLocked = false
      this.enterReady()
    })
  }

  private handleLaunch(): void {
    const reaction = Date.now() - this.goTimestamp
    this.inputLocked = true
    this.centerMessage.setText('')

    let label: string
    let color: string
    let pts: number
    let launchSpeed: number

    if (reaction <= REACTION_PERFECT_MS) {
      label = 'PERFECT LAUNCH!'
      color = '#58a6ff'
      pts = SCORE_PERFECT_LAUNCH
      launchSpeed = LAUNCH_SPEED_PERFECT
      this.comboMultiplier = Math.min(COMBO_MAX, this.comboMultiplier + COMBO_INCREMENT)
    } else if (reaction <= REACTION_GOOD_MS) {
      label = 'GOOD LAUNCH!'
      color = '#3fb950'
      pts = SCORE_GOOD_LAUNCH
      launchSpeed = LAUNCH_SPEED_GOOD
      this.comboMultiplier = 1.0
    } else {
      label = 'SLOW LAUNCH'
      color = '#d29922'
      pts = SCORE_BAD_LAUNCH
      launchSpeed = LAUNCH_SPEED_BAD
      this.comboMultiplier = 1.0
    }

    this.addScore(Math.round(pts * this.comboMultiplier))
    this.currentSpeed = launchSpeed
    this.speedLabel.setText(`${Math.round(this.currentSpeed)} km/h`)
    this.playShiftSound()
    this.showPopup(`${label}\n${reaction} ms`, color)

    this.time.delayedCall(POPUP_DURATION + 250, () => this.enterGear(RaceStage.Gear1))
  }

  /* ── Stages 2-4: Gear shifts ────────────────────────────────── */

  private evaluateShift(): void {
    const p = this.rpmProgress

    let label: string
    let color: string
    let pts: number
    let speedMult: number
    let isPerfect = false

    if (p >= this.perfectZoneLow && p <= SHIFT_PERFECT_HIGH) {
      label = 'PERFECT SHIFT!'
      color = '#58a6ff'
      pts = SCORE_PERFECT_SHIFT
      speedMult = SHIFT_MULT_PERFECT
      isPerfect = true
    } else if ((p >= SHIFT_GOOD_LOW && p < this.perfectZoneLow) ||
               (p > SHIFT_PERFECT_HIGH && p <= SHIFT_GOOD_HIGH)) {
      label = 'GOOD SHIFT'
      color = '#3fb950'
      pts = SCORE_GOOD_SHIFT
      speedMult = SHIFT_MULT_GOOD
    } else if (p < SHIFT_GOOD_LOW) {
      label = 'EARLY!'
      color = '#d29922'
      pts = SCORE_EARLY_LATE_SHIFT
      speedMult = SHIFT_MULT_EARLY_LATE
    } else {
      label = 'LATE!'
      color = '#f85149'
      pts = SCORE_EARLY_LATE_SHIFT
      speedMult = SHIFT_MULT_EARLY_LATE
    }

    this.resolveShift(
      `${label}\nRPM: ${Math.round(p * 100)}%`,
      color,
      pts,
      speedMult,
      !isPerfect,
    )
  }

  /**
   * Common handler for both player-triggered and over-rev shifts.
   */
  private resolveShift(
    msg: string,
    color: string,
    pts: number,
    speedMult: number,
    resetCombo: boolean,
  ): void {
    if (resetCombo) {
      this.comboMultiplier = 1.0
    } else {
      this.comboMultiplier = Math.min(COMBO_MAX, this.comboMultiplier + COMBO_INCREMENT)
    }

    this.addScore(Math.round(pts * this.comboMultiplier))
    // Apply rev-match quality: perfect = tiny boost, early/late = slight scrub
    this.currentSpeed *= speedMult
    this.playShiftSound()
    this.showPopup(msg, color)

    // Shrink the perfect (blue) zone: halve its width, right edge stays fixed
    this.shiftCount++
    const initialWidth = SHIFT_PERFECT_HIGH - SHIFT_PERFECT_LOW
    const newWidth = Math.max(0.01, initialWidth / Math.pow(2, this.shiftCount))
    this.perfectZoneLow = SHIFT_PERFECT_HIGH - newWidth

    const next = this.nextStage()
    if (next === RaceStage.Cruising) {
      this.enterCruising()
    } else {
      // Enter the next gear immediately so the RPM ramp (and audio) keeps
      // climbing without pause – the popup fades over the live engine sound.
      this.enterGear(next)
    }
  }

  private enterGear(stage: RaceStage): void {
    this.stage = stage
    this.rpmProgress = 0
    this.shiftAccepted = false
    this.inputLocked = false
    this.setRpmVisible(true)
    this.updateZoneVisuals()
    this.drawRpm()
    this.gearLabel.setText(`GEAR ${this.gearIndex()} / 6`)
    this.refreshCombo()
  }

  private enterCruising(): void {
    this.stage = RaceStage.Cruising
    this.shiftAccepted = true  // no more player input needed
    this.inputLocked = false
    this.setRpmVisible(false)
    this.gearLabel.setText('GEAR 6 / 6  ▶')
    this.refreshCombo()
  }

  /* ── Finish ──────────────────────────────────────────────────── */

  private finishRace(): void {
    this.stage = RaceStage.Finished
    this.raceElapsedMs = Date.now() - this.raceStartTime
    this.inputLocked = true
    this.setRpmVisible(false)

    const rank      = this.rank()
    const t         = (this.raceElapsedMs / 1000).toFixed(2)
    const topSpd    = Math.round(this.topSpeed)
    const playerWon = (this.raceElapsedMs / 1000) < AI_FINISH_TIME_S
    const resultLine  = playerWon
      ? `WIN  •  You: ${t}s  |  CPU: ${AI_FINISH_TIME_S.toFixed(2)}s`
      : `LOSS •  You: ${t}s  |  CPU: ${AI_FINISH_TIME_S.toFixed(2)}s`
    const resultColor = playerWon ? '#3fb950' : '#f85149'

    this.centerMessage
      .setText(`FINISH!\n\n${resultLine}\nTop: ${topSpd} km/h  •  Score: ${this.score}  •  Rank: ${rank}`)
      .setColor(resultColor)
      .setFontSize(22)

    this.raceTimeLabel.setText(`Final: ${t}s`)

    this.registry.set(RegistryKeys.IsGameOver, true)
    this.game.events.emit(GameEvents.GameOver)
    // Fade engine audio to silence, then release resources
    this.engineAudio.setMasterVolume(0)
    this.time.delayedCall(1500, () => this.engineAudio.dispose())
  }

  private rank(): string {
    if (this.score >= 1000) return 'S'
    if (this.score >= 750) return 'A'
    if (this.score >= 500) return 'B'
    return 'C'
  }

  /* ================================================================
   *  Helpers
   * ================================================================ */

  private gearIndex(): number {
    switch (this.stage) {
      case RaceStage.Gear1: return 1
      case RaceStage.Gear2: return 2
      case RaceStage.Gear3: return 3
      case RaceStage.Gear4: return 4
      case RaceStage.Gear5: return 5
      case RaceStage.Gear6: return 6
      default: return 1
    }
  }

  private nextStage(): RaceStage {
    switch (this.stage) {
      case RaceStage.Gear1: return RaceStage.Gear2
      case RaceStage.Gear2: return RaceStage.Gear3
      case RaceStage.Gear3: return RaceStage.Gear4
      case RaceStage.Gear4: return RaceStage.Gear5
      case RaceStage.Gear5: return RaceStage.Gear6
      case RaceStage.Gear6: return RaceStage.Cruising
      default: return RaceStage.Finished
    }
  }

  private isGearStage(): boolean {
    return (
      this.stage === RaceStage.Gear1 ||
      this.stage === RaceStage.Gear2 ||
      this.stage === RaceStage.Gear3 ||
      this.stage === RaceStage.Gear4 ||
      this.stage === RaceStage.Gear5 ||
      this.stage === RaceStage.Gear6
    )
  }

  /* ── Score ───────────────────────────────────────────────────── */

  private addScore(pts: number): void {
    this.score = Math.max(0, this.score + pts)
    this.scoreLabel.setText(`Score: ${this.score}`)
    this.registry.set(RegistryKeys.Score, this.score)
    this.game.events.emit(GameEvents.ScoreChanged, this.score)
    this.refreshCombo()
  }

  private refreshCombo(): void {
    this.comboLabel.setText(
      this.comboMultiplier > 1 ? `Combo x${this.comboMultiplier.toFixed(1)}` : '',
    )
  }

  /* ── RPM meter drawing ──────────────────────────────────────── */

  private drawRpm(): void {
    const { width } = this.scale
    const barX = width * 0.1
    const barW = width * 0.8

    const fill = barW * this.rpmProgress
    this.rpmBarFill.x = barX
    this.rpmBarFill.width = Math.max(0, fill)

    // Colour the fill bar to match zone
    if (this.rpmProgress >= this.perfectZoneLow && this.rpmProgress <= SHIFT_PERFECT_HIGH) {
      this.rpmBarFill.setFillStyle(0x58a6ff)
    } else if (this.rpmProgress > SHIFT_GOOD_HIGH) {
      this.rpmBarFill.setFillStyle(0xf85149)
    } else if (this.rpmProgress >= SHIFT_GOOD_LOW) {
      this.rpmBarFill.setFillStyle(0xd29922)
    } else {
      this.rpmBarFill.setFillStyle(0x238636)
    }

    this.rpmNeedle.x = barX + fill

    const rpm = Math.round(RPM_MIN + (RPM_MAX - RPM_MIN) * this.rpmProgress)
    this.rpmLabel.setText(`RPM: ${rpm}`)
  }

  private setRpmVisible(show: boolean): void {
    const a = show ? 1 : 0
    this.rpmBarBg.setAlpha(a)
    this.rpmBarFill.setAlpha(a)
    this.rpmNeedle.setAlpha(a)
    this.rpmGreenZone.setAlpha(show ? 0.35 : 0)
    this.rpmYellowZone.setAlpha(0) // always hidden; green now fills its space
    this.rpmPerfectZone.setAlpha(show ? 0.55 : 0)
    this.rpmRedZone.setAlpha(show ? 0.35 : 0)
    this.rpmLabel.setAlpha(a)
  }

  /**
   * Reposition the zone rectangles to reflect the current `perfectZoneLow`.
   * Green extends rightward to fill all space left of the (now smaller) blue zone.
   * Red zone stays fixed on the right.
   */
  private updateZoneVisuals(): void {
    const { width } = this.scale
    const barX = width * 0.1
    const barW = width * 0.8
    const barH = 36

    const gW = barW * this.perfectZoneLow
    const pW = barW * (SHIFT_PERFECT_HIGH - this.perfectZoneLow)
    const rW = barW * (1 - SHIFT_PERFECT_HIGH)

    // Green: 0 → perfectZoneLow (absorbs yellow as blue shrinks)
    this.rpmGreenZone.x = barX
    this.rpmGreenZone.width = gW
    this.rpmGreenZone.height = barH

    // Blue perfect zone: perfectZoneLow → SHIFT_PERFECT_HIGH (right edge fixed)
    this.rpmPerfectZone.x = barX + gW
    this.rpmPerfectZone.width = pW
    this.rpmPerfectZone.height = barH

    // Red: SHIFT_PERFECT_HIGH → 1.0 (never changes)
    this.rpmRedZone.x = barX + gW + pW
    this.rpmRedZone.width = rW
    this.rpmRedZone.height = barH
  }

  /* ── Popup animation ────────────────────────────────────────── */

  private showPopup(text: string, color: string): void {
    this.popupTimer?.destroy()
    this.popupText.setText(text).setColor(color).setAlpha(1).setScale(0.5)

    this.tweens.add({
      targets: this.popupText,
      scaleX: 1,
      scaleY: 1,
      duration: 150,
      ease: 'Back.easeOut',
    })

    this.popupTimer = this.time.delayedCall(POPUP_DURATION, () => {
      this.tweens.add({
        targets: this.popupText,
        alpha: 0,
        scaleX: 0.8,
        scaleY: 0.8,
        duration: 200,
        ease: 'Quad.easeIn',
      })
    })
  }

  /* ── Resize (basic) ────────────────────────────────────────── */

  private relayout(): void {
    // The game uses percentage-based positioning so a simple
    // scene restart handles resizes cleanly.
  }

  /* ================================================================
   *  Engine Audio  (sample-based via EngineAudio / engine-audio MIT)
   * ================================================================ */

  /**
   * Map current game stage + rpmProgress to the rpm/throttle values
   * that EngineAudio.update() expects.
   */
  private getEngineAudioParams(): { rpm: number; throttle: number } {
    switch (this.stage) {
      case RaceStage.Waiting:
        return { rpm: 900,  throttle: 0.0 }
      case RaceStage.Ready:
        return { rpm: 1200, throttle: 0.0 }
      case RaceStage.Go:
        // Engine sitting at high revs on the line, ready to launch
        return { rpm: 5000, throttle: 0.8 }
      case RaceStage.Gear1:
      case RaceStage.Gear2:
      case RaceStage.Gear3:
      case RaceStage.Gear4:
      case RaceStage.Gear5:
      case RaceStage.Gear6: {
        // rpmProgress 0→1 maps to 6 750 RPM (gear bite, 75% of 9 000) → 9 000 RPM (redline)
        const rpm = 6750 + this.rpmProgress * 2250
        return { rpm, throttle: 1.0 }
      }
      case RaceStage.Cruising:
        return { rpm: 8800, throttle: 1.0 }
      case RaceStage.Finished:
        return { rpm: 800, throttle: 0.0 }
      default:
        return { rpm: 1000, throttle: 0.0 }
    }
  }

  /** No-op shift transient – the rpm drop caused by entering the next gear
   *  naturally pitch-shifts the sample layers via EngineAudio.update(). */
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private playShiftSound(): void {}
}
