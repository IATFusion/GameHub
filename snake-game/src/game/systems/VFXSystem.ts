// ─── VFXSystem ──────────────────────────────────────────────────────────────
// Visual effects: particles, screen shake, glow pulses, score popups

import { CELL_SIZE, COLORS, FoodType } from './GameConstants';

export class VFXSystem {
  private scene: Phaser.Scene;
  private particles: Phaser.GameObjects.Graphics;
  private activeParticles: Particle[] = [];
  private scorePopups: ScorePopup[] = [];
  private screenGlowAlpha = 0;
  private screenGlowColor: number = COLORS.PLAYER_GLOW;
  private glowOverlay!: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.particles = scene.add.graphics();
    this.particles.setDepth(50);

    this.glowOverlay = scene.add.graphics();
    this.glowOverlay.setDepth(100);
  }

  update(delta: number): void {
    // Update particles
    for (let i = this.activeParticles.length - 1; i >= 0; i--) {
      const p = this.activeParticles[i];
      p.life -= delta;
      if (p.life <= 0) {
        this.activeParticles.splice(i, 1);
        continue;
      }
      p.x += p.vx * (delta / 1000);
      p.y += p.vy * (delta / 1000);
      p.vy += 20 * (delta / 1000); // slight gravity
      p.alpha = Math.max(0, p.life / p.maxLife);
      p.size *= 0.995;
    }

    // Update score popups
    for (let i = this.scorePopups.length - 1; i >= 0; i--) {
      const sp = this.scorePopups[i];
      sp.life -= delta;
      if (sp.life <= 0) {
        sp.text.destroy();
        this.scorePopups.splice(i, 1);
        continue;
      }
      const t = 1 - sp.life / sp.maxLife;
      sp.text.y = sp.startY - t * 40;
      sp.text.alpha = 1 - t;
      sp.text.setScale(1 + t * 0.3);
    }

    // Fade screen glow
    if (this.screenGlowAlpha > 0) {
      this.screenGlowAlpha = Math.max(0, this.screenGlowAlpha - delta * 0.003);
    }

    this.render();
  }

  private render(): void {
    this.particles.clear();

    // Draw particles
    for (const p of this.activeParticles) {
      this.particles.fillStyle(p.color, p.alpha * 0.8);
      this.particles.fillCircle(p.x, p.y, p.size * 1.5);
      this.particles.fillStyle(p.color, p.alpha);
      this.particles.fillCircle(p.x, p.y, p.size);
    }

    // Draw screen glow overlay
    this.glowOverlay.clear();
    if (this.screenGlowAlpha > 0.01) {
      this.glowOverlay.fillStyle(this.screenGlowColor, this.screenGlowAlpha * 0.12);
      this.glowOverlay.fillRect(0, 0, this.scene.scale.width, this.scene.scale.height);
    }
  }

  // ── Effects ──────────────────────────────────────────────────────────

  /** Burst particles when food is eaten */
  emitFoodEaten(px: number, py: number, foodType: FoodType): void {
    const colorMap = {
      [FoodType.NORMAL]: COLORS.FOOD_NORMAL,
      [FoodType.BONUS]:  COLORS.FOOD_BONUS,
      [FoodType.SUPER]:  COLORS.FOOD_SUPER,
    };
    const color = colorMap[foodType];
    const count = foodType === FoodType.SUPER ? 24 : foodType === FoodType.BONUS ? 16 : 10;

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
      const speed = 60 + Math.random() * 120;
      this.activeParticles.push({
        x: px,
        y: py,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 30,
        size: 2 + Math.random() * 3,
        color,
        alpha: 1,
        life: 400 + Math.random() * 300,
        maxLife: 700,
      });
    }

    // Screen glow
    this.screenGlowColor = color;
    this.screenGlowAlpha = foodType === FoodType.SUPER ? 0.8 : foodType === FoodType.BONUS ? 0.5 : 0.3;
  }

  /** Death explosion */
  emitDeath(px: number, py: number, color: number): void {
    for (let i = 0; i < 30; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 160;
      this.activeParticles.push({
        x: px,
        y: py,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 2 + Math.random() * 4,
        color,
        alpha: 1,
        life: 600 + Math.random() * 400,
        maxLife: 1000,
      });
    }
    this.screenGlowColor = 0xff2244;
    this.screenGlowAlpha = 1;
  }

  /** Snake grow pulse */
  emitGrowPulse(px: number, py: number, color: number): void {
    for (let i = 0; i < 6; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 20 + Math.random() * 40;
      this.activeParticles.push({
        x: px,
        y: py,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 1.5 + Math.random() * 2,
        color,
        alpha: 0.7,
        life: 200 + Math.random() * 200,
        maxLife: 400,
      });
    }
  }

  /** Score popup text */
  showScorePopup(px: number, py: number, text: string, color: number): void {
    const txt = this.scene.add.text(px, py, text, {
      fontFamily: '"Orbitron", "Segoe UI", monospace',
      fontSize: '18px',
      color: `#${color.toString(16).padStart(6, '0')}`,
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    });
    txt.setOrigin(0.5);
    txt.setDepth(60);

    this.scorePopups.push({
      text: txt,
      startY: py,
      life: 800,
      maxLife: 800,
    });
  }

  /** Camera shake */
  shake(intensity?: number, duration?: number): void {
    this.scene.cameras.main.shake(
      duration ?? 150,
      intensity ?? 0.006
    );
  }

  /** Slow motion effect */
  slowMotion(duration: number, scale: number): Promise<void> {
    return new Promise((resolve) => {
      this.scene.time.timeScale = scale;
      this.scene.time.delayedCall(duration * scale, () => {
        this.scene.time.timeScale = 1;
        resolve();
      });
    });
  }

  /** Zoom effect */
  zoomTo(zoom: number, duration: number): void {
    this.scene.tweens.add({
      targets: this.scene.cameras.main,
      zoom,
      duration,
      ease: 'Cubic.easeInOut',
    });
  }

  /** Trail particle behind a moving snake head */
  emitTrailParticle(px: number, py: number, color: number): void {
    this.activeParticles.push({
      x: px + (Math.random() - 0.5) * CELL_SIZE * 0.3,
      y: py + (Math.random() - 0.5) * CELL_SIZE * 0.3,
      vx: (Math.random() - 0.5) * 10,
      vy: (Math.random() - 0.5) * 10,
      size: 1.5 + Math.random() * 1.5,
      color,
      alpha: 0.5,
      life: 150 + Math.random() * 100,
      maxLife: 250,
    });
  }

  destroy(): void {
    this.particles.destroy();
    this.glowOverlay.destroy();
    for (const sp of this.scorePopups) sp.text.destroy();
    this.activeParticles.length = 0;
    this.scorePopups.length = 0;
  }
}

// ── Types ───────────────────────────────────────────────────────────────────

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: number;
  alpha: number;
  life: number;
  maxLife: number;
}

interface ScorePopup {
  text: Phaser.GameObjects.Text;
  startY: number;
  life: number;
  maxLife: number;
}
