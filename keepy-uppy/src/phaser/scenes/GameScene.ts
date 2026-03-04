import Phaser from 'phaser';

import { audioSystem } from '../../systems/AudioSystem';
import { eventBridge } from '../../systems/EventBridge';
import type { GameState, HitQuality } from '../../systems/EventBridge';
import { GAME } from '../../systems/GameConstants';
import { InputSystem } from '../../systems/InputSystem';
import { VFXSystem } from '../../systems/VFXSystem';

/**
 * GameScene — Duel Mode
 *
 * Two players + two goals:
 * - Left player tries to score into the right goal.
 * - Right player tries to score into the left goal.
 *
 * Controls:
 * - Left player: A/D
 * - Right player: J/L
 * - Touch: left half controls left player, right half controls right player
 *
 * Key design goals:
 * - Super responsive horizontal movement with inertia
 * - Ball has satisfying weight + clear arcs
 * - Goals trigger punchy slow-mo + reset
 */
export class GameScene extends Phaser.Scene {
  public static readonly Key = 'GameScene';

  constructor() {
    super(GameScene.Key);
  }

  // Systems
  private inputSystem!: InputSystem;
  private vfx!: VFXSystem;

  // Objects
  private ball!: Phaser.GameObjects.Image;
  private ballShadow!: Phaser.GameObjects.Image;
  private leftPlayer!: Phaser.GameObjects.Image;
  private rightPlayer!: Phaser.GameObjects.Image;
  private leftGoalPosts: Phaser.GameObjects.Image[] = [];
  private rightGoalPosts: Phaser.GameObjects.Image[] = [];
  private background!: Phaser.GameObjects.Graphics;
  private groundGraphics!: Phaser.GameObjects.Graphics;

  // Manual ball physics
  private ballVX = 0;
  private ballVY = 0;
  private ballSpin = 0;
  private ballRot = 0;
  private squashX = 1;
  private squashY = 1;

  // Player physics
  private leftVX = 0;
  private rightVX = 0;
  private leftVY = 0;
  private rightVY = 0;
  private leftOnGround = true;
  private rightOnGround = true;
  private leftKickCooldownMs = 0;
  private rightKickCooldownMs = 0;

  // Match state
  private state: GameState = 'menu';
  private leftScore = 0;
  private rightScore = 0;
  private goalLockMs = 0;

  // Layout
  private worldW = 0;
  private worldH = 0;
  private groundY = 0;
  private playerY = 0;

  // Any-key / tap to start
  private onAnyKeyDown?: () => void;
  private onPointerDown?: () => void;
  private onWindowKeyDown?: (e: KeyboardEvent) => void;

  create(): void {
    this.updateLayout();

    this.inputSystem = new InputSystem(this);

    this.background = this.add.graphics().setDepth(0);
    this.groundGraphics = this.add.graphics().setDepth(2);

    this.drawBackground();
    this.drawGround();

    this.createGoals();
    this.createPlayers();
    this.createBall();

    this.vfx = new VFXSystem(this);

    // Initial registry values for UI
    this.registry.set('leftScore', 0);
    this.registry.set('rightScore', 0);

    this.setState('menu');

    // Start/retry input
    this.onAnyKeyDown = () => {
      if (this.state === 'menu') this.startMatch();
    };
    // Phaser keyboard events may require canvas focus; also listen globally.
    this.onWindowKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (this.state === 'menu') this.startMatch();
    };
    this.onPointerDown = () => {
      if (this.state === 'menu') this.startMatch();
    };
    this.input.keyboard?.on('keydown', this.onAnyKeyDown);
    window.addEventListener('keydown', this.onWindowKeyDown);
    this.input.on('pointerdown', this.onPointerDown);

    this.scale.on('resize', this.handleResize, this);

    // External restart (React)
    const unsub = eventBridge.on('game-restart', () => this.resetMatch());

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.handleResize, this);
      this.inputSystem.destroy();
      this.vfx.destroy();
      unsub();
      if (this.onAnyKeyDown) this.input.keyboard?.off('keydown', this.onAnyKeyDown);
      if (this.onWindowKeyDown) window.removeEventListener('keydown', this.onWindowKeyDown);
      if (this.onPointerDown) this.input.off('pointerdown', this.onPointerDown);
    });

    eventBridge.emit('game-ready');
    this.emitScore();
  }

  update(_time: number, deltaMs: number): void {
    const dtMs = Math.min(33.33, deltaMs);
    const dt = dtMs / 1000;

    if (this.state === 'menu') {
      this.updateMenu(dt);
      return;
    }

    // Goal lock / reset timing
    if (this.goalLockMs > 0) {
      this.goalLockMs -= dtMs;
      this.updateBall(dt, dtMs, true);
      this.updateVfx(dtMs);
      if (this.goalLockMs <= 0) {
        this.resetBall(false);
        this.setState('playing');
      }
      return;
    }

    // Core gameplay
    const input = this.inputSystem.getInput();

    this.updatePlayer('left', input.leftDirection, input.leftJump, dt);
    this.updatePlayer('right', input.rightDirection, input.rightJump, dt);

    if (this.leftKickCooldownMs > 0) this.leftKickCooldownMs -= dtMs;
    if (this.rightKickCooldownMs > 0) this.rightKickCooldownMs -= dtMs;

    if (input.leftKick) this.tryKick('left');
    if (input.rightKick) this.tryKick('right');

    // Ensure players never cross (each stays in their half)
    this.enforceHalfBoundaries();

    this.updateBall(dt, dtMs, false);

    // Collisions
    this.resolvePlayerCollision('left');
    this.resolvePlayerCollision('right');

    // Goals
    this.checkGoals();

    // Visuals
    this.updateBallVisuals();
    this.updateShadow();
    this.updateVfx(dtMs);
  }

  private updateMenu(dt: number): void {
    // Gentle idle motion
    this.ballRot += dt * 0.6;
    this.ball.setRotation(this.ballRot);

    this.ball.y = Phaser.Math.Linear(this.ball.y, this.worldH * 0.32 + Math.sin(this.time.now / 400) * 6, 0.08);
    this.ball.x = Phaser.Math.Linear(this.ball.x, this.worldW * 0.5, 0.08);

    this.updateBallVisuals();
    this.updateShadow();
    this.updateVfx(16);

    // Start if foot/player input pressed
    const input = this.inputSystem.getInput();
    if (input.leftDirection !== 0 || input.rightDirection !== 0) {
      this.startMatch();
    }
  }

  private startMatch(): void {
    audioSystem.init();
    audioSystem.resume();

    this.leftScore = 0;
    this.rightScore = 0;
    this.emitScore();

    this.resetBall(true);
    this.setState('playing');

    eventBridge.emit('game-start');
  }

  private resetMatch(): void {
    this.leftScore = 0;
    this.rightScore = 0;
    this.emitScore();
    this.resetBall(true);
    this.setState('menu');
  }

  private setState(state: GameState): void {
    this.state = state;
    this.registry.set('gameState', state);
    eventBridge.emit('state-changed', { state });
  }

  private emitScore(): void {
    this.registry.set('leftScore', this.leftScore);
    this.registry.set('rightScore', this.rightScore);
    eventBridge.emit('match-score-changed', { left: this.leftScore, right: this.rightScore });
  }

  private updatePlayer(which: 'left' | 'right', direction: number, jumpPressed: boolean, dt: number): void {
    const player = which === 'left' ? this.leftPlayer : this.rightPlayer;
    let vx = which === 'left' ? this.leftVX : this.rightVX;
    let vy = which === 'left' ? this.leftVY : this.rightVY;
    let onGround = which === 'left' ? this.leftOnGround : this.rightOnGround;

    // Horizontal
    if (direction !== 0) {
      vx += direction * GAME.PLAYER.ACCELERATION * dt;
      vx = Phaser.Math.Clamp(vx, -GAME.PLAYER.MAX_SPEED, GAME.PLAYER.MAX_SPEED);
    } else {
      if (Math.abs(vx) < GAME.PLAYER.DECELERATION * dt) {
        vx = 0;
      } else {
        vx -= Math.sign(vx) * GAME.PLAYER.DECELERATION * dt;
      }
    }

    player.x += vx * dt;

    // Keep on screen
    const halfW = GAME.PLAYER.WIDTH / 2;
    player.x = Phaser.Math.Clamp(player.x, halfW + 8, this.worldW - halfW - 8);

    // Vertical
    if (jumpPressed && onGround) {
      vy = GAME.PLAYER.JUMP_VELOCITY;
      onGround = false;
    }

    vy += GAME.PLAYER.GRAVITY * dt;
    player.y += vy * dt;

    const groundTop = this.groundY - GAME.PLAYER.HEIGHT / 2;
    if (player.y >= groundTop) {
      player.y = groundTop;
      vy = 0;
      onGround = true;
    }

    if (which === 'left') {
      this.leftVX = vx;
      this.leftVY = vy;
      this.leftOnGround = onGround;
    } else {
      this.rightVX = vx;
      this.rightVY = vy;
      this.rightOnGround = onGround;
    }
  }

  private enforceHalfBoundaries(): void {
    const centerX = this.worldW / 2;
    const gap = GAME.MATCH.HALF_GAP;

    const pHalf = GAME.PLAYER.WIDTH / 2;

    // Left cannot go past center - gap
    const leftMax = centerX - gap - pHalf;
    if (this.leftPlayer.x > leftMax) {
      this.leftPlayer.x = leftMax;
      this.leftVX = Math.min(this.leftVX, 0);
    }

    // Right cannot go past center + gap
    const rightMin = centerX + gap + pHalf;
    if (this.rightPlayer.x < rightMin) {
      this.rightPlayer.x = rightMin;
      this.rightVX = Math.max(this.rightVX, 0);
    }
  }

  private updateBall(dt: number, dtMs: number, slowMo: boolean): void {
    const scale = slowMo ? 0.35 : 1;
    const effectiveDt = dt * scale;

    // Gravity
    this.ballVY += GAME.BALL.GRAVITY * effectiveDt;
    this.ballVY = Math.min(GAME.BALL.MAX_VELOCITY_Y, this.ballVY);

    // Spin and air resistance
    this.ballVX += this.ballSpin * GAME.BALL.SPIN_FACTOR * effectiveDt * 60;
    this.ballVX *= GAME.BALL.AIR_RESISTANCE;
    this.ballSpin *= GAME.BALL.SPIN_DECAY;

    // Clamp horizontal speed
    this.ballVX = Phaser.Math.Clamp(this.ballVX, -GAME.BALL.MAX_VELOCITY_X, GAME.BALL.MAX_VELOCITY_X);

    // Move
    this.ball.x += this.ballVX * effectiveDt;
    this.ball.y += this.ballVY * effectiveDt;

    const R = GAME.BALL.RADIUS;

    // Wall bounce
    if (this.ball.x < R) {
      this.ball.x = R;
      this.ballVX = Math.abs(this.ballVX) * 0.8;
      this.ballSpin *= -0.5;
    } else if (this.ball.x > this.worldW - R) {
      this.ball.x = this.worldW - R;
      this.ballVX = -Math.abs(this.ballVX) * 0.8;
      this.ballSpin *= -0.5;
    }

    // Ground bounce
    if (this.ball.y + R >= this.groundY) {
      this.ball.y = this.groundY - R;
      this.ballVY = -Math.abs(this.ballVY) * 0.72;
      this.ballVX *= 0.96;

      // Micro squash on ground impact
      this.squashX = 1.18;
      this.squashY = 0.82;

      // If it becomes tiny bounces, settle
      if (Math.abs(this.ballVY) < 120) {
        this.ballVY = 0;
      }
    }

    // Ceiling
    if (this.ball.y < R) {
      this.ball.y = R;
      this.ballVY = Math.abs(this.ballVY) * 0.6;
    }

    // Rotation
    this.ballRot += this.ballSpin * effectiveDt;
    this.ball.setRotation(this.ballRot);

    // Squash recovery
    this.squashX = Phaser.Math.Linear(this.squashX, 1, GAME.BALL.SQUASH_RECOVERY);
    this.squashY = Phaser.Math.Linear(this.squashY, 1, GAME.BALL.SQUASH_RECOVERY);

    // Velocity stretch
    const speed = Math.sqrt(this.ballVX * this.ballVX + this.ballVY * this.ballVY);
    if (speed > 400) {
      const stretch = Math.min(0.12, (speed - 400) / 5000);
      this.squashX = Phaser.Math.Linear(this.squashX, 1 + stretch, 0.08);
      this.squashY = Phaser.Math.Linear(this.squashY, 1 - stretch * 0.6, 0.08);
    }

    // VFX trail
    this.vfx.updateTrail(this.ball.x, this.ball.y, 1);
    this.vfx.drawGlow(this.ball.x, this.ball.y);

    void dtMs;
  }

  private resolvePlayerCollision(which: 'left' | 'right'): void {
    const player = which === 'left' ? this.leftPlayer : this.rightPlayer;
    const vx = which === 'left' ? this.leftVX : this.rightVX;

    const R = GAME.BALL.RADIUS;

    // Circle vs AABB
    const halfW = GAME.PLAYER.WIDTH / 2;
    const halfH = GAME.PLAYER.HEIGHT / 2;

    const left = player.x - halfW;
    const right = player.x + halfW;
    const top = player.y - halfH;
    const bottom = player.y + halfH;

    const closestX = Phaser.Math.Clamp(this.ball.x, left, right);
    const closestY = Phaser.Math.Clamp(this.ball.y, top, bottom);

    const dx = this.ball.x - closestX;
    const dy = this.ball.y - closestY;
    const dist2 = dx * dx + dy * dy;

    if (dist2 > R * R) return;

    // Push out
    const dist = Math.max(0.001, Math.sqrt(dist2));
    const nx = dx / dist;
    const ny = dy / dist;

    this.ball.x = closestX + nx * (R + 0.5);
    this.ball.y = closestY + ny * (R + 0.5);

    // Hit quality based on how centered the hit is vertically + incoming speed
    const verticalHit = Phaser.Math.Clamp((player.y - this.ball.y) / (GAME.PLAYER.HEIGHT * 0.5), -1, 1);
    const centered = 1 - Math.abs(verticalHit);
    const impact = Math.min(1, Math.abs(this.ballVY) / 900);

    let quality: HitQuality = 'bad';
    if (centered > 0.75 && impact > 0.35) quality = 'perfect';
    else if (centered > 0.5) quality = 'good';

    // Apply impulse
    const away = which === 'left' ? 1 : -1;

    // Upward boost when ball hits upper body / falling in
    const upBoost = GAME.PLAYER.HIT_UPWARD_BOOST * (quality === 'perfect' ? 1.12 : quality === 'good' ? 1.0 : 0.88);

    // Side boost pushes ball toward the opponent goal
    const sideBoost = GAME.PLAYER.HIT_SIDE_BOOST * (quality === 'perfect' ? 1.15 : quality === 'good' ? 1.0 : 0.8);

    // If collision normal is mostly horizontal, prioritize sideways
    const horizontalBias = Math.abs(nx);

    // Ensure we don't instantly double-collide: only apply if ball is moving toward the player
    const towardPlayer = (away === 1 && this.ballVX < 0) || (away === -1 && this.ballVX > 0) || Math.abs(this.ballVX) < 40;
    if (!towardPlayer) return;

    this.ballVY = Math.min(this.ballVY, 0) + upBoost;
    this.ballVX = this.ballVX * 0.35 + away * sideBoost + vx * 0.35 + nx * 120 * horizontalBias;

    // Spin from player velocity
    this.ballSpin = Phaser.Math.Clamp((vx * 0.012) + nx * 6, -12, 12);

    // Squash
    this.squashX = 1.22;
    this.squashY = 0.78;

    // VFX + audio
    this.vfx.triggerBounce(this.ball.x, this.ball.y, quality);
    this.vfx.showQualityText(this.ball.x, this.ball.y, quality);
    audioSystem.playBounce(quality, 0);

    eventBridge.emit('bounce', { quality, foot: which, x: this.ball.x, y: this.ball.y });
  }

  private tryKick(which: 'left' | 'right'): void {
    if (which === 'left') {
      if (this.leftKickCooldownMs > 0) return;
      this.leftKickCooldownMs = GAME.PLAYER.KICK_COOLDOWN_MS;
    } else {
      if (this.rightKickCooldownMs > 0) return;
      this.rightKickCooldownMs = GAME.PLAYER.KICK_COOLDOWN_MS;
    }

    const player = which === 'left' ? this.leftPlayer : this.rightPlayer;
    const away = which === 'left' ? 1 : -1;

    const dx = this.ball.x - player.x;
    const dy = this.ball.y - player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > GAME.PLAYER.KICK_RANGE + GAME.BALL.RADIUS) return;

    // Only kick if ball is roughly in front of the player (toward opponent)
    if (away === 1 && dx < -8) return;
    if (away === -1 && dx > 8) return;

    this.ballVX = this.ballVX * 0.25 + away * GAME.PLAYER.KICK_POWER;
    this.ballVY = Math.min(this.ballVY, 0) + GAME.PLAYER.KICK_LIFT;
    this.ballSpin = Phaser.Math.Clamp(this.ballSpin + away * 6, -14, 14);

    this.squashX = 1.24;
    this.squashY = 0.76;

    this.vfx.triggerBounce(this.ball.x, this.ball.y, 'good');
    audioSystem.playBounce('good', 0);

    // Tiny kick punch
    player.setScale(1.08, 0.96);
    this.tweens.add({
      targets: player,
      scaleX: 1,
      scaleY: 1,
      duration: 120,
      ease: 'Sine.Out',
    });
  }

  private checkGoals(): void {
    const R = GAME.BALL.RADIUS;
    const goalTop = this.groundY - GAME.MATCH.GOAL_HEIGHT;

    // Only count goals if ball is within goal mouth height
    const inMouth = this.ball.y + R > goalTop && this.ball.y - R < this.groundY;
    if (!inMouth) return;

    const depth = GAME.MATCH.GOAL_DEPTH;

    // Left goal: ball crosses left edge region → right scores
    if (this.ball.x - R <= depth) {
      this.scoreGoal('right');
      return;
    }

    // Right goal: ball crosses right edge region → left scores
    if (this.ball.x + R >= this.worldW - depth) {
      this.scoreGoal('left');
    }
  }

  private scoreGoal(scorer: 'left' | 'right'): void {
    if (this.goalLockMs > 0) return;

    if (scorer === 'left') this.leftScore += 1;
    else this.rightScore += 1;

    this.emitScore();

    // Punchy goal moment
    this.goalLockMs = GAME.MATCH.RESET_DELAY_MS;

    this.vfx.triggerFlowState();
    audioSystem.playGameOver(); // placeholder goal sting

    eventBridge.emit('goal', { scorer, left: this.leftScore, right: this.rightScore });

    // Freeze-ish
    this.setState('paused');
  }

  private resetBall(centerKick: boolean): void {
    const cx = this.worldW / 2;
    const cy = this.worldH * 0.35;

    this.ball.setAlpha(1);
    this.ball.x = cx;
    this.ball.y = cy;

    // Kickoff velocity
    if (centerKick) {
      const dir = Math.random() < 0.5 ? -1 : 1;
      this.ballVX = dir * (220 + Math.random() * 180);
      this.ballVY = -500 - Math.random() * 250;
    } else {
      const dir = Math.random() < 0.5 ? -1 : 1;
      this.ballVX = dir * (180 + Math.random() * 120);
      this.ballVY = -420 - Math.random() * 220;
    }

    this.ballSpin = (Math.random() - 0.5) * 6;
    this.ballRot = 0;
    this.squashX = 1;
    this.squashY = 1;

    // Reset players to their halves
    const leftX = this.worldW * 0.25;
    const rightX = this.worldW * 0.75;
    this.leftPlayer.x = leftX;
    this.rightPlayer.x = rightX;
    this.leftVX = 0;
    this.rightVX = 0;
    this.leftVY = 0;
    this.rightVY = 0;
    this.leftOnGround = true;
    this.rightOnGround = true;
    this.leftPlayer.y = this.groundY - GAME.PLAYER.HEIGHT / 2;
    this.rightPlayer.y = this.groundY - GAME.PLAYER.HEIGHT / 2;

    this.enforceHalfBoundaries();
  }

  private updateBallVisuals(): void {
    this.ball.setScale(this.squashX, this.squashY);
  }

  private updateShadow(): void {
    this.ballShadow.x = this.ball.x;
    this.ballShadow.y = this.groundY + 2;

    const dist = this.groundY - this.ball.y;
    const maxDist = this.groundY * 0.75;
    const t = Phaser.Math.Clamp(dist / maxDist, 0, 1);

    const scale = 0.65 * (1 - t * 0.45);
    const alpha = 0.32 * (1 - t * 0.75);

    this.ballShadow.setScale(scale, scale * 0.32);
    this.ballShadow.setAlpha(alpha);
  }

  private updateVfx(dtMs: number): void {
    this.vfx.update(dtMs);
  }

  private createBall(): void {
    const x = this.worldW / 2;
    const y = this.worldH * 0.32;

    this.ballShadow = this.add.image(x, this.groundY + 2, 'shadow').setDepth(3).setAlpha(0.3);
    this.ball = this.add.image(x, y, 'ball').setDepth(10).setOrigin(0.5, 0.5);

    // Force the PNG to the collision radius size.
    const d = GAME.BALL.RADIUS * 2;
    this.ball.setDisplaySize(d, d);
  }

  private createPlayers(): void {
    const leftX = this.worldW * 0.25;
    const rightX = this.worldW * 0.75;

    this.leftPlayer = this.add.image(leftX, this.playerY, 'player-left').setDepth(8).setOrigin(0.5, 0.5);
    this.rightPlayer = this.add.image(rightX, this.playerY, 'player-right').setDepth(8).setOrigin(0.5, 0.5);

    // Ensure grounded spawn
    const groundTop = this.groundY - GAME.PLAYER.HEIGHT / 2;
    this.leftPlayer.y = groundTop;
    this.rightPlayer.y = groundTop;
  }

  private createGoals(): void {
    // Decorative posts (not physics)
    const goalTop = this.groundY - GAME.MATCH.GOAL_HEIGHT;

    // Left goal
    this.leftGoalPosts.forEach((p) => p.destroy());
    this.leftGoalPosts = [
      this.add.image(10, goalTop + 30, 'goal-post').setDepth(4).setAlpha(0.85),
      this.add.image(10, this.groundY - 30, 'goal-post').setDepth(4).setAlpha(0.65),
    ];

    // Right goal
    this.rightGoalPosts.forEach((p) => p.destroy());
    this.rightGoalPosts = [
      this.add.image(this.worldW - 10, goalTop + 30, 'goal-post').setDepth(4).setAlpha(0.85),
      this.add.image(this.worldW - 10, this.groundY - 30, 'goal-post').setDepth(4).setAlpha(0.65),
    ];
  }

  private drawBackground(): void {
    this.background.clear();

    const steps = 40;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const r = Phaser.Math.Linear(0x0a, 0x12, t);
      const g = Phaser.Math.Linear(0x0e, 0x09, t);
      const b = Phaser.Math.Linear(0x27, 0x3a, t);
      const color = (Math.floor(r) << 16) | (Math.floor(g) << 8) | Math.floor(b);
      this.background.fillStyle(color, 1);
      this.background.fillRect(0, (this.worldH / steps) * i, this.worldW, this.worldH / steps + 1);
    }

    // Midfield line
    this.background.lineStyle(2, GAME.COLORS.GROUND_LINE, 0.25);
    this.background.lineBetween(this.worldW / 2, 0, this.worldW / 2, this.groundY);

    // Subtle center circle
    this.background.lineStyle(2, GAME.COLORS.NEON_BLUE, 0.12);
    this.background.strokeCircle(this.worldW / 2, this.groundY - 110, 90);
  }

  private drawGround(): void {
    this.groundGraphics.clear();

    this.groundGraphics.fillStyle(GAME.COLORS.GROUND, 0.6);
    this.groundGraphics.fillRect(0, this.groundY, this.worldW, this.worldH - this.groundY);

    this.groundGraphics.lineStyle(2, GAME.COLORS.GROUND_LINE, 0.8);
    this.groundGraphics.lineBetween(0, this.groundY, this.worldW, this.groundY);
  }

  private updateLayout(): void {
    this.worldW = Math.max(1, Math.floor(this.scale.width));
    this.worldH = Math.max(1, Math.floor(this.scale.height));
    this.groundY = this.worldH * GAME.WORLD.GROUND_Y_RATIO;
    this.playerY = this.worldH * GAME.PLAYER.Y_RATIO;
  }

  private handleResize(gameSize: Phaser.Structs.Size): void {
    const oldW = this.worldW;
    const oldH = this.worldH;

    this.worldW = Math.max(1, Math.floor(gameSize.width));
    this.worldH = Math.max(1, Math.floor(gameSize.height));
    this.groundY = this.worldH * GAME.WORLD.GROUND_Y_RATIO;
    this.playerY = this.worldH * GAME.PLAYER.Y_RATIO;

    if (oldW > 0 && oldH > 0) {
      const sx = this.worldW / oldW;
      const sy = this.worldH / oldH;

      this.ball.x *= sx;
      this.ball.y *= sy;
      this.leftPlayer.x *= sx;
      this.rightPlayer.x *= sx;
      this.leftPlayer.y = this.playerY;
      this.rightPlayer.y = this.playerY;
    }

    this.drawBackground();
    this.drawGround();
    this.createGoals();
    this.enforceHalfBoundaries();
  }
}
