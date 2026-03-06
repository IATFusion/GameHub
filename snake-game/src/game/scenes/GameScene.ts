// ─── GameScene ──────────────────────────────────────────────────────────────
// The main gameplay scene — snakes, food, collisions, scoring
//
// Orchestrates: PlayerSnake, CPUSnake, FoodManager, VFX, Audio, Difficulty

import {
  GAME_WIDTH, GAME_HEIGHT, GRID_WIDTH, GRID_HEIGHT, CELL_SIZE,
  COLORS, Direction, FoodType, FOOD_SCORES, FOOD_GROWTH,
  CAMERA_SHAKE_INTENSITY, CAMERA_SHAKE_DURATION,
  DEATH_SLOW_MO_DURATION, DEATH_SLOW_MO_SCALE,
} from '../systems/GameConstants';
import EventBridge, { GameEvents } from '../systems/EventBridge';
import { gridToPixel, posKey } from '../systems/GridSystem';
import { PlayerSnake } from '../objects/PlayerSnake';
import { CPUSnake } from '../objects/CPUSnake';
import { FoodManager } from '../objects/Food';
import type { FoodItem } from '../objects/Food';
import { VFXSystem } from '../systems/VFXSystem';
import { AudioSystem } from '../systems/AudioSystem';
import { DifficultySystem } from '../systems/DifficultySystem';

export class GameScene extends Phaser.Scene {
  // Core objects
  private player!: PlayerSnake;
  private cpu!: CPUSnake;
  private foodManager!: FoodManager;

  // Systems
  private vfx!: VFXSystem;
  private audio!: AudioSystem;
  private difficulty!: DifficultySystem;
  private bridge!: EventBridge;

  // Background
  private bgGraphics!: Phaser.GameObjects.Graphics;
  private gridGraphics!: Phaser.GameObjects.Graphics;
  private bgImage?: Phaser.GameObjects.Image;
  private bgStars: { x: number; y: number; size: number; alpha: number; speed: number }[] = [];

  // State
  private score = 0;
  private timeSurvived = 0;
  private gameActive = false;
  private gameOverProcessing = false;
  private paused = false;
  private cpuRespawnTimer = 0;
  private cpuAlive = true;
  private bestScore = 0;

  // Trail tracking
  private playerTrailTimer = 0;
  private cpuTrailTimer = 0;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    this.bridge = EventBridge.getInstance();

    // Load best score
    this.bestScore = parseInt(localStorage.getItem('xenoform_bestScore') ?? '0', 10);

    // Draw background
    this.createBackground();

    // Create game objects
    this.foodManager = new FoodManager(this);
    this.player = new PlayerSnake(this, 12, Math.floor(GRID_HEIGHT / 2));
    this.cpu = new CPUSnake(this, GRID_WIDTH - 13, Math.floor(GRID_HEIGHT / 2));

    // Create systems
    this.vfx = new VFXSystem(this);
    this.audio = new AudioSystem();
    this.difficulty = new DifficultySystem();

    // Listen for UI commands
    this.bridge.on(GameEvents.UI_START_GAME, () => this.startGame());
    this.bridge.on(GameEvents.UI_RESTART_GAME, () => this.restartGame());
    this.bridge.on(GameEvents.UI_TOGGLE_SOUND, () => this.audio.toggle());
    this.bridge.on(GameEvents.UI_PAUSE_GAME, () => this.pauseGame());
    this.bridge.on(GameEvents.UI_RESUME_GAME, () => this.resumeGame());

    // Emit initial state
    this.bridge.emit(GameEvents.BEST_SCORE, this.bestScore);
  }

  private pauseGame(): void {
    if (!this.gameActive) return;
    if (this.paused) return;
    this.paused = true;
    this.bridge.emit(GameEvents.GAME_PAUSE);
  }

  private resumeGame(): void {
    if (!this.gameActive) return;
    if (!this.paused) return;
    this.paused = false;
    this.bridge.emit(GameEvents.GAME_RESUME);
  }

  // ── Game Lifecycle ─────────────────────────────────────────────────────

  private startGame(): void {
    if (this.gameActive) return;

    this.score = 0;
    this.timeSurvived = 0;
    this.gameOverProcessing = false;
    this.paused = false;
    this.cpuAlive = true;
    this.cpuRespawnTimer = 0;

    // Reset camera
    this.cameras.main.zoom = 1;
    this.cameras.main.centerOn(GAME_WIDTH / 2, GAME_HEIGHT / 2);

    // Reset snakes
    this.player.resetWithInput(12, Math.floor(GRID_HEIGHT / 2), Direction.RIGHT);
    this.cpu.respawn(GRID_WIDTH - 13, Math.floor(GRID_HEIGHT / 2), Direction.LEFT);

    // Spawn food
    const occupied = this.getAllOccupied();
    this.foodManager.spawnInitialFood(occupied);

    // Reset systems
    this.difficulty.reset();

    this.gameActive = true;

    // Audio
    this.audio.playStartGame();

    // Emit events
    this.bridge.emit(GameEvents.GAME_START);
    this.bridge.emit(GameEvents.SCORE_UPDATE, 0);
    this.bridge.emit(GameEvents.PLAYER_LENGTH, this.player.getLength());
    this.bridge.emit(GameEvents.CPU_LENGTH, this.cpu.getLength());
  }

  private restartGame(): void {
    this.gameActive = false;
    this.paused = false;
    this.foodManager.clear();

    // Brief delay then start
    this.time.delayedCall(100, () => {
      this.startGame();
    });
  }

  private async handleGameOver(): Promise<void> {
    if (this.gameOverProcessing) return;
    this.gameOverProcessing = true;
    this.gameActive = false;
    this.paused = false;

    // Death effects
    this.audio.playDeath();
    this.vfx.emitDeath(this.player.headPixelX, this.player.headPixelY, COLORS.PLAYER_GLOW);
    this.vfx.shake(CAMERA_SHAKE_INTENSITY * 2, CAMERA_SHAKE_DURATION * 2);

    // Update best score
    if (this.score > this.bestScore) {
      this.bestScore = this.score;
      localStorage.setItem('xenoform_bestScore', String(this.bestScore));
      this.bridge.emit(GameEvents.BEST_SCORE, this.bestScore);
    }

    // Wait for slow-mo effect
    await new Promise<void>((resolve) => {
      this.time.delayedCall(DEATH_SLOW_MO_DURATION, resolve);
    });

    this.bridge.emit(GameEvents.GAME_OVER, {
      score: this.score,
      length: this.player.getLength(),
      time: Math.floor(this.timeSurvived / 1000),
      bestScore: this.bestScore,
    });
  }

  // ── Main Update Loop ───────────────────────────────────────────────────

  update(_time: number, delta: number): void {
    if (this.paused) return;
    // Always update VFX (for post-death particles)
    this.vfx.update(delta);

    // Animate background stars
    this.updateStars(delta);

    if (!this.gameActive) return;

    this.timeSurvived += delta;

    // Update difficulty
    this.difficulty.update(delta);
    this.cpu.setMoveInterval(this.difficulty.getCpuMoveInterval());

    // Update CPU AI info
    if (this.cpuAlive) {
      this.cpu.updateDangerCells(this.player.getSegments());
      this.cpu.setFoodTargets(this.foodManager.getFoodPositions());
    }

    // Update snakes
    this.player.update(delta);
    if (this.cpuAlive) {
      this.cpu.update(delta);
    }

    // Trail particles
    this.playerTrailTimer += delta;
    if (this.playerTrailTimer > 50) {
      this.playerTrailTimer = 0;
      this.vfx.emitTrailParticle(this.player.headPixelX, this.player.headPixelY, COLORS.PLAYER_GLOW);
    }
    if (this.cpuAlive) {
      this.cpuTrailTimer += delta;
      if (this.cpuTrailTimer > 60) {
        this.cpuTrailTimer = 0;
        this.vfx.emitTrailParticle(this.cpu.headPixelX, this.cpu.headPixelY, COLORS.CPU_GLOW);
      }
    }

    // Update audio pitch
    this.audio.setPitchScale(this.player.getLength());

    // Update food
    const occupied = this.getAllOccupied();
    this.foodManager.update(delta, occupied);

    // Check collisions
    this.checkCollisions();

    // CPU respawn timer
    if (!this.cpuAlive) {
      this.cpuRespawnTimer -= delta;
      if (this.cpuRespawnTimer <= 0) {
        this.respawnCPU();
      }
    }

    // Emit time
    this.bridge.emit(GameEvents.TIME_UPDATE, Math.floor(this.timeSurvived / 1000));
  }

  // ── Collisions ─────────────────────────────────────────────────────────

  private checkCollisions(): void {
    const playerHead = this.player.getHead();

    // Player food check
    const playerFood = this.foodManager.checkCollision(playerHead.gx, playerHead.gy);
    if (playerFood) {
      this.onPlayerEatFood(playerFood);
    }

    // CPU food check
    if (this.cpuAlive) {
      const cpuHead = this.cpu.getHead();
      const cpuFood = this.foodManager.checkCollision(cpuHead.gx, cpuHead.gy);
      if (cpuFood) {
        this.onCPUEatFood(cpuFood);
      }
    }

    // Player death checks
    if (this.player.isOutOfBounds()) {
      this.player.kill();
      this.handleGameOver();
      return;
    }
    if (this.player.isSelfCollision()) {
      this.player.kill();
      this.handleGameOver();
      return;
    }
    if (this.cpuAlive && this.player.collidesWithSnake(this.cpu)) {
      this.player.kill();
      this.handleGameOver();
      return;
    }

    // CPU death checks
    if (this.cpuAlive) {
      if (this.cpu.isOutOfBounds() || this.cpu.isSelfCollision() || this.cpu.collidesWithSnake(this.player)) {
        this.onCPUDeath();
      }
    }
  }

  // ── Food Events ────────────────────────────────────────────────────────

  private onPlayerEatFood(food: FoodItem): void {
    const points = FOOD_SCORES[food.type];
    const growth = FOOD_GROWTH[food.type];

    this.score += points;
    this.player.grow(growth);

    // VFX
    const { px, py } = gridToPixel(food.gx, food.gy);
    this.vfx.emitFoodEaten(px, py, food.type);
    this.vfx.showScorePopup(px, py - 10, `+${points}`, COLORS.PLAYER_GLOW);
    this.vfx.emitGrowPulse(this.player.headPixelX, this.player.headPixelY, COLORS.PLAYER_GLOW);

    if (food.type !== FoodType.NORMAL) {
      this.vfx.shake(0.004, 100);
    }

    // Audio
    if (food.type === FoodType.SUPER) {
      this.audio.playSuperEat();
    } else if (food.type === FoodType.BONUS) {
      this.audio.playBonusEat();
    } else {
      this.audio.playEat();
    }

    // Events
    this.bridge.emit(GameEvents.SCORE_UPDATE, this.score);
    this.bridge.emit(GameEvents.PLAYER_LENGTH, this.player.getLength());
    this.bridge.emit(GameEvents.FOOD_EATEN, { type: food.type, player: true });
  }

  private onCPUEatFood(food: FoodItem): void {
    const growth = FOOD_GROWTH[food.type];
    this.cpu.grow(growth);

    const { px, py } = gridToPixel(food.gx, food.gy);
    this.vfx.emitFoodEaten(px, py, food.type);
    this.bridge.emit(GameEvents.CPU_LENGTH, this.cpu.getLength());
  }

  // ── CPU Death & Respawn ────────────────────────────────────────────────

  private onCPUDeath(): void {
    this.cpu.kill();
    this.cpuAlive = false;
    this.cpuRespawnTimer = 3000; // Respawn after 3 seconds

    // Bonus points for player
    const bonus = 50;
    this.score += bonus;

    // Effects
    this.audio.playCpuDeath();
    this.vfx.emitDeath(this.cpu.headPixelX, this.cpu.headPixelY, COLORS.CPU_GLOW);
    this.vfx.showScorePopup(this.cpu.headPixelX, this.cpu.headPixelY - 10, `+${bonus} RIVAL DOWN`, COLORS.CPU_GLOW);

    this.bridge.emit(GameEvents.SCORE_UPDATE, this.score);
    this.bridge.emit(GameEvents.CPU_DIED);
  }

  private respawnCPU(): void {
    // Find a safe spawn point away from player
    const playerHead = this.player.getHead();
    let spawnX: number, spawnY: number;

    // Try to spawn on the opposite side of the map from the player
    if (playerHead.gx < GRID_WIDTH / 2) {
      spawnX = GRID_WIDTH - 8 + Math.floor(Math.random() * 5);
    } else {
      spawnX = 3 + Math.floor(Math.random() * 5);
    }
    if (playerHead.gy < GRID_HEIGHT / 2) {
      spawnY = GRID_HEIGHT - 6 + Math.floor(Math.random() * 3);
    } else {
      spawnY = 3 + Math.floor(Math.random() * 3);
    }

    // Clamp
    spawnX = Math.max(5, Math.min(GRID_WIDTH - 6, spawnX));
    spawnY = Math.max(3, Math.min(GRID_HEIGHT - 4, spawnY));

    const dir = spawnX > GRID_WIDTH / 2 ? Direction.LEFT : Direction.RIGHT;

    this.cpu.respawn(spawnX, spawnY, dir);
    this.cpuAlive = true;

    // Difficulty adjustment: make CPU slightly less random each respawn
    const newRandomness = Math.max(0.03, 0.08 - this.difficulty.getLevel() * 0.005);
    this.cpu.setRandomness(newRandomness);

    this.bridge.emit(GameEvents.CPU_RESPAWN);
    this.bridge.emit(GameEvents.CPU_LENGTH, this.cpu.getLength());
  }

  // ── Background ─────────────────────────────────────────────────────────

  private createBackground(): void {
    // Background image (in-canvas)
    if (this.textures.exists('playfield-bg')) {
      this.bgImage = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'playfield-bg');
      this.bgImage.setDepth(-2);
      this.bgImage.setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
      this.bgImage.setAlpha(1);
    }

    this.bgGraphics = this.add.graphics();
    this.bgGraphics.setDepth(0);

    this.gridGraphics = this.add.graphics();
    this.gridGraphics.setDepth(1);

    // Create background stars / galaxy particles
    this.bgStars = [];
    for (let i = 0; i < 140; i++) {
      this.bgStars.push({
        x: Math.random() * GAME_WIDTH,
        y: Math.random() * GAME_HEIGHT,
        size: 0.25 + Math.random() * 2.2,
        alpha: 0.04 + Math.random() * 0.22,
        speed: 0.10 + Math.random() * 0.75,
      });
    }

    this.drawGrid();
  }

  private drawGrid(): void {
    this.gridGraphics.clear();

    // Grid lines
    this.gridGraphics.lineStyle(1, COLORS.GRID_LINE, 0.3);

    // Vertical lines
    for (let x = 0; x <= GRID_WIDTH; x++) {
      const px = x * CELL_SIZE;
      this.gridGraphics.beginPath();
      this.gridGraphics.moveTo(px, 0);
      this.gridGraphics.lineTo(px, GAME_HEIGHT);
      this.gridGraphics.strokePath();
    }

    // Horizontal lines
    for (let y = 0; y <= GRID_HEIGHT; y++) {
      const py = y * CELL_SIZE;
      this.gridGraphics.beginPath();
      this.gridGraphics.moveTo(0, py);
      this.gridGraphics.lineTo(GAME_WIDTH, py);
      this.gridGraphics.strokePath();
    }

    // Grid intersection dots
    this.gridGraphics.fillStyle(COLORS.GRID_DOT, 0.15);
    for (let x = 0; x <= GRID_WIDTH; x += 4) {
      for (let y = 0; y <= GRID_HEIGHT; y += 4) {
        this.gridGraphics.fillCircle(x * CELL_SIZE, y * CELL_SIZE, 1);
      }
    }

    // Border glow — acid green
    this.gridGraphics.lineStyle(2, COLORS.PLAYER_GLOW, 0.12);
    this.gridGraphics.strokeRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.gridGraphics.lineStyle(1, COLORS.PLAYER_GLOW, 0.04);
    this.gridGraphics.strokeRect(-2, -2, GAME_WIDTH + 4, GAME_HEIGHT + 4);

    // Corner accent marks
    const cm = 20;
    this.gridGraphics.lineStyle(1, COLORS.PLAYER_GLOW, 0.2);
    // Top-left
    this.gridGraphics.beginPath(); this.gridGraphics.moveTo(0, cm); this.gridGraphics.lineTo(0, 0); this.gridGraphics.lineTo(cm, 0); this.gridGraphics.strokePath();
    // Top-right
    this.gridGraphics.beginPath(); this.gridGraphics.moveTo(GAME_WIDTH - cm, 0); this.gridGraphics.lineTo(GAME_WIDTH, 0); this.gridGraphics.lineTo(GAME_WIDTH, cm); this.gridGraphics.strokePath();
    // Bottom-left
    this.gridGraphics.beginPath(); this.gridGraphics.moveTo(0, GAME_HEIGHT - cm); this.gridGraphics.lineTo(0, GAME_HEIGHT); this.gridGraphics.lineTo(cm, GAME_HEIGHT); this.gridGraphics.strokePath();
    // Bottom-right
    this.gridGraphics.beginPath(); this.gridGraphics.moveTo(GAME_WIDTH - cm, GAME_HEIGHT); this.gridGraphics.lineTo(GAME_WIDTH, GAME_HEIGHT); this.gridGraphics.lineTo(GAME_WIDTH, GAME_HEIGHT - cm); this.gridGraphics.strokePath();
  }

  private updateStars(delta: number): void {
    this.bgGraphics.clear();
    // Light tint overlay so the snake/food remain readable against the image
    this.bgGraphics.fillStyle(COLORS.BG, 0.2);
    this.bgGraphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Very subtle gradient overlays for depth
    this.bgGraphics.fillStyle(COLORS.BG_GRADIENT, 0.08);
    this.bgGraphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT * 0.55);
    this.bgGraphics.fillStyle(COLORS.BG_GRADIENT, 0.06);
    this.bgGraphics.fillRect(0, GAME_HEIGHT * 0.35, GAME_WIDTH, GAME_HEIGHT * 0.65);

    // Nebula-like clouds
    const now = Date.now() * 0.00025;
    const nebulaAlpha1 = 0.030 + Math.sin(now) * 0.012;
    const nebulaAlpha2 = 0.022 + Math.sin(now * 1.25 + 1) * 0.010;
    const nebulaAlpha3 = 0.018 + Math.sin(now * 0.95 + 2) * 0.009;

    this.bgGraphics.fillStyle(COLORS.NEBULA_1, nebulaAlpha1);
    this.bgGraphics.fillCircle(GAME_WIDTH * 0.18, GAME_HEIGHT * 0.78, 210);
    this.bgGraphics.fillStyle(COLORS.NEBULA_2, nebulaAlpha2);
    this.bgGraphics.fillCircle(GAME_WIDTH * 0.82, GAME_HEIGHT * 0.22, 170);
    this.bgGraphics.fillStyle(COLORS.NEBULA_3, nebulaAlpha3);
    this.bgGraphics.fillCircle(GAME_WIDTH * 0.52, GAME_HEIGHT * 0.14, 140);
    // Additional faint band to suggest a galaxy arm
    this.bgGraphics.fillStyle(COLORS.NEBULA_2, nebulaAlpha2 * 0.75);
    this.bgGraphics.fillCircle(GAME_WIDTH * 0.35, GAME_HEIGHT * 0.35, 260);

    // Star / particle field (teal/cyan/purple)
    const starColors = [
      COLORS.PLAYER_GLOW,
      COLORS.FOOD_NORMAL,
      COLORS.FOOD_BONUS,
      0x8fb6ff,
      0x2a3b7a,
    ];
    for (const star of this.bgStars) {
      star.alpha += Math.sin(Date.now() * 0.001 * star.speed) * 0.002;
      star.alpha = Math.max(0.03, Math.min(0.35, star.alpha));

      const col = starColors[Math.floor(star.speed * 10) % starColors.length];
      this.bgGraphics.fillStyle(col, star.alpha);
      this.bgGraphics.fillCircle(star.x, star.y, star.size);
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  private getAllOccupied(): Set<string> {
    const set = new Set<string>();
    for (const s of this.player.getSegments()) set.add(posKey(s.gx, s.gy));
    if (this.cpuAlive) {
      for (const s of this.cpu.getSegments()) set.add(posKey(s.gx, s.gy));
    }
    return set;
  }
}
