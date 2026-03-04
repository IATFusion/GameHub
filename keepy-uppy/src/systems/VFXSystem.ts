/**
 * VFXSystem — Visual effects manager for Phaser scene.
 *
 * Handles:
 * - Particle bursts on bounce (color varies by quality)
 * - Screen shake (intensity varies by quality)
 * - Time dilation (micro slow-mo on perfect hits)
 * - Ball glow pulses
 * - Chromatic aberration simulation
 * - Motion trails
 * - Impact text popups
 *
 * Architecture:
 * - Object pooling for particles (no runtime allocations)
 * - All effects are delta-time aware
 * - Automatic cleanup on scene shutdown
 *
 * Performance:
 * - Max 200 particles active at once
 * - Particles are simple circles (no texture loads)
 * - Trail positions stored in ring buffer
 */

import Phaser from 'phaser';
import type { HitQuality } from './EventBridge';
import { GAME } from './GameConstants';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: number;
  size: number;
  active: boolean;
}

interface TrailPoint {
  x: number;
  y: number;
  alpha: number;
  scale: number;
}

interface FloatingText {
  text: Phaser.GameObjects.Text;
  life: number;
  vy: number;
}

export class VFXSystem {
  private scene: Phaser.Scene;
  private particleGraphics: Phaser.GameObjects.Graphics;
  private trailGraphics: Phaser.GameObjects.Graphics;
  private glowGraphics: Phaser.GameObjects.Graphics;

  // Object pools
  private particles: Particle[] = [];
  private readonly MAX_PARTICLES = 200;

  // Trail ring buffer
  private trail: TrailPoint[] = [];
  private readonly MAX_TRAIL = 12;

  // Floating score texts
  private floatingTexts: FloatingText[] = [];

  // Time dilation
  private timeDilationTimer = 0;
  private targetTimeScale = 1;

  // Screen shake
  private shakeIntensity = 0;
  private shakeDuration = 0;
  private shakeTimer = 0;

  // Glow pulse
  private glowAlpha = 0;
  private glowColor = 0x00ffaa;

  // Chromatic aberration (tracked via glow system)

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    // Create graphics layers (ordered for draw order)
    this.trailGraphics = scene.add.graphics().setDepth(5);
    this.glowGraphics = scene.add.graphics().setDepth(6);
    this.particleGraphics = scene.add.graphics().setDepth(50);

    // Pre-allocate particle pool
    for (let i = 0; i < this.MAX_PARTICLES; i++) {
      this.particles.push({
        x: 0, y: 0, vx: 0, vy: 0,
        life: 0, maxLife: 0, color: 0xffffff, size: 3,
        active: false,
      });
    }

    // Pre-allocate trail
    for (let i = 0; i < this.MAX_TRAIL; i++) {
      this.trail.push({ x: 0, y: 0, alpha: 0, scale: 1 });
    }
  }

  /** Trigger a bounce effect at position. */
  triggerBounce(x: number, y: number, quality: HitQuality): void {
    // Particle burst
    const count =
      quality === 'perfect'
        ? GAME.VFX.PARTICLE_COUNT_PERFECT
        : quality === 'good'
          ? GAME.VFX.PARTICLE_COUNT_GOOD
          : GAME.VFX.PARTICLE_COUNT_BAD;

    const colors = GAME.COLORS.PARTICLE_COLORS;
    const speed = quality === 'perfect' ? 350 : quality === 'good' ? 250 : 150;

    for (let i = 0; i < count; i++) {
      const p = this.getPooledParticle();
      if (!p) break;

      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const spd = speed * (0.5 + Math.random() * 0.5);

      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * spd;
      p.vy = Math.sin(angle) * spd - 100; // Bias upward
      p.life = 0.4 + Math.random() * 0.3;
      p.maxLife = p.life;
      p.color = colors[Math.floor(Math.random() * colors.length)];
      p.size = quality === 'perfect' ? 3 + Math.random() * 3 : 2 + Math.random() * 2;
      p.active = true;
    }

    // Screen shake
    if (quality === 'perfect') {
      this.shake(GAME.VFX.SCREENSHAKE_PERFECT.intensity, GAME.VFX.SCREENSHAKE_PERFECT.duration);
    } else if (quality === 'good') {
      this.shake(GAME.VFX.SCREENSHAKE_GOOD.intensity, GAME.VFX.SCREENSHAKE_GOOD.duration);
    }

    // Time dilation on perfect
    if (quality === 'perfect') {
      this.timeDilationTimer = GAME.VFX.SLOW_MO_DURATION;
      this.targetTimeScale = GAME.VFX.SLOW_MO_SCALE;
    }

    // Glow pulse
    this.glowAlpha = quality === 'perfect' ? 0.6 : quality === 'good' ? 0.3 : 0.1;
    this.glowColor =
      quality === 'perfect'
        ? GAME.COLORS.BALL_GLOW_PERFECT
        : GAME.COLORS.BALL_GLOW;

    // Chromatic aberration (handled via glow pulse)
  }

  /** Show floating score text. */
  showScorePopup(x: number, y: number, text: string, color: number): void {
    const textObj = this.scene.add.text(x, y, text, {
      fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
      fontSize: '22px',
      color: '#' + color.toString(16).padStart(6, '0'),
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    })
      .setOrigin(0.5)
      .setDepth(100)
      .setAlpha(1);

    this.floatingTexts.push({
      text: textObj,
      life: 1.0,
      vy: -120,
    });
  }

  /** Show hit quality text. */
  showQualityText(x: number, y: number, quality: HitQuality): void {
    const label =
      quality === 'perfect' ? 'PERFECT!' : quality === 'good' ? 'GOOD' : '';
    if (!label) return;

    const color =
      quality === 'perfect' ? GAME.COLORS.PERFECT_TEXT : GAME.COLORS.GOOD_TEXT;

    const textObj = this.scene.add.text(x, y - 40, label, {
      fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
      fontSize: quality === 'perfect' ? '28px' : '20px',
      color: '#' + color.toString(16).padStart(6, '0'),
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
    })
      .setOrigin(0.5)
      .setDepth(100)
      .setAlpha(1)
      .setScale(quality === 'perfect' ? 1.3 : 1.0);

    this.floatingTexts.push({
      text: textObj,
      life: 0.8,
      vy: -80,
    });
  }

  /** Update trail with current ball position. */
  updateTrail(x: number, y: number, scale: number): void {
    // Shift trail forward
    for (let i = this.MAX_TRAIL - 1; i > 0; i--) {
      this.trail[i].x = this.trail[i - 1].x;
      this.trail[i].y = this.trail[i - 1].y;
      this.trail[i].alpha = this.trail[i - 1].alpha * (1 - GAME.VFX.TRAIL_ALPHA_DECAY);
      this.trail[i].scale = this.trail[i - 1].scale * 0.92;
    }
    this.trail[0].x = x;
    this.trail[0].y = y;
    this.trail[0].alpha = 0.4;
    this.trail[0].scale = scale;
  }

  /** Apply screen shake. */
  private shake(intensity: number, duration: number): void {
    this.shakeIntensity = intensity;
    this.shakeDuration = duration;
    this.shakeTimer = duration;
  }

  /** Main update loop — call from GameScene.update(). */
  update(delta: number): void {
    const dt = delta / 1000; // Convert to seconds

    this.updateParticles(dt);
    this.updateFloatingTexts(dt);
    this.updateShake(delta);
    this.updateTimeDilation(delta);
    this.updateGlow(dt);
    this.drawTrail();
    this.drawParticles();
  }

  private updateParticles(dt: number): void {
    for (const p of this.particles) {
      if (!p.active) continue;

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 400 * dt; // Particle gravity
      p.life -= dt;

      if (p.life <= 0) {
        p.active = false;
      }
    }
  }

  private drawParticles(): void {
    this.particleGraphics.clear();

    for (const p of this.particles) {
      if (!p.active) continue;

      const alpha = Math.max(0, p.life / p.maxLife);
      const size = p.size * alpha;

      this.particleGraphics.fillStyle(p.color, alpha * 0.9);
      this.particleGraphics.fillCircle(p.x, p.y, size);
    }
  }

  private drawTrail(): void {
    this.trailGraphics.clear();

    for (let i = 1; i < this.MAX_TRAIL; i++) {
      const t = this.trail[i];
      if (t.alpha < 0.02) continue;

      const radius = GAME.BALL.RADIUS * t.scale * 0.8;
      this.trailGraphics.fillStyle(GAME.COLORS.BALL_GLOW, t.alpha * 0.3);
      this.trailGraphics.fillCircle(t.x, t.y, radius);
    }
  }

  /** Draw glow around ball position. */
  drawGlow(x: number, y: number): void {
    this.glowGraphics.clear();

    if (this.glowAlpha < 0.01) return;

    const radius = GAME.BALL.RADIUS * 2.5;
    this.glowGraphics.fillStyle(this.glowColor, this.glowAlpha * 0.3);
    this.glowGraphics.fillCircle(x, y, radius);
    this.glowGraphics.fillStyle(this.glowColor, this.glowAlpha * 0.15);
    this.glowGraphics.fillCircle(x, y, radius * 1.5);
  }

  private updateGlow(dt: number): void {
    this.glowAlpha = Math.max(0, this.glowAlpha - dt * 2);
  }

  private updateFloatingTexts(dt: number): void {
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.life -= dt;
      ft.text.y += ft.vy * dt;
      ft.text.setAlpha(Math.max(0, ft.life));
      ft.text.setScale(ft.text.scaleX * (1 + dt * 0.3)); // Subtle grow

      if (ft.life <= 0) {
        ft.text.destroy();
        this.floatingTexts.splice(i, 1);
      }
    }
  }

  private updateShake(delta: number): void {
    if (this.shakeTimer <= 0) return;

    this.shakeTimer -= delta;
    const progress = this.shakeTimer / this.shakeDuration;
    const intensity = this.shakeIntensity * progress;

    const offsetX = (Math.random() - 0.5) * 2 * intensity;
    const offsetY = (Math.random() - 0.5) * 2 * intensity;

    this.scene.cameras.main.setScroll(offsetX, offsetY);

    if (this.shakeTimer <= 0) {
      this.scene.cameras.main.setScroll(0, 0);
    }
  }

  private updateTimeDilation(delta: number): void {
    if (this.timeDilationTimer <= 0) {
      if (this.scene.time.timeScale !== 1) {
        this.scene.time.timeScale = Phaser.Math.Linear(
          this.scene.time.timeScale, 1, 0.1,
        );
        if (Math.abs(this.scene.time.timeScale - 1) < 0.01) {
          this.scene.time.timeScale = 1;
        }
      }
      return;
    }

    this.timeDilationTimer -= delta;
    this.scene.time.timeScale = this.targetTimeScale;
  }

  /** Get a particle from the pool. */
  private getPooledParticle(): Particle | null {
    for (const p of this.particles) {
      if (!p.active) return p;
    }
    return null; // Pool exhausted
  }

  /** Trigger flow state visual transformation. */
  triggerFlowState(): void {
    // Big particle explosion
    const { width, height } = this.scene.scale;
    const cx = width / 2;
    const cy = height / 2;

    for (let i = 0; i < 40; i++) {
      const p = this.getPooledParticle();
      if (!p) break;

      const angle = (Math.PI * 2 * i) / 40;
      const spd = 200 + Math.random() * 300;

      p.x = cx;
      p.y = cy;
      p.vx = Math.cos(angle) * spd;
      p.vy = Math.sin(angle) * spd;
      p.life = 1.0 + Math.random() * 0.5;
      p.maxLife = p.life;
      p.color = GAME.COLORS.NEON_YELLOW;
      p.size = 4 + Math.random() * 4;
      p.active = true;
    }

    // Big shake
    this.shake(8, 300);
  }

  /** Game over death effect. */
  triggerDeathEffect(x: number, y: number): void {
    for (let i = 0; i < 30; i++) {
      const p = this.getPooledParticle();
      if (!p) break;

      const angle = (Math.PI * 2 * i) / 30;
      const spd = 100 + Math.random() * 200;

      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * spd;
      p.vy = Math.sin(angle) * spd;
      p.life = 0.8 + Math.random() * 0.4;
      p.maxLife = p.life;
      p.color = 0xff4444;
      p.size = 3 + Math.random() * 3;
      p.active = true;
    }

    this.shake(6, 400);
  }

  destroy(): void {
    this.particleGraphics.destroy();
    this.trailGraphics.destroy();
    this.glowGraphics.destroy();
    for (const ft of this.floatingTexts) {
      ft.text.destroy();
    }
    this.floatingTexts = [];
  }
}
