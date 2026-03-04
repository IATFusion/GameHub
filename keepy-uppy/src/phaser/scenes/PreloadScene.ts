import Phaser from 'phaser';
import { GAME } from '../../systems/GameConstants';

/**
 * PreloadScene — Generate all textures procedurally.
 *
 * Zero external assets — everything is generated via Phaser Graphics.
 * This ensures instant load times and small bundle size.
 *
 * Textures generated:
 * - ball: Soccer ball with pentagon pattern
 * - foot-left: Left foot (neon cyan)
 * - foot-right: Right foot (neon pink)
 * - ground: Ground plane texture
 * - glow: Soft radial glow circle
 * - shadow: Soft shadow ellipse
 */
export class PreloadScene extends Phaser.Scene {
  public static readonly Key = 'PreloadScene';

  constructor() {
    super(PreloadScene.Key);
  }

  preload(): void {
    // Load the ball image via Vite URL so it gets hashed and served correctly.
    const ballUrl = new URL('../../assets/football.png', import.meta.url).toString();
    this.load.image('ball', ballUrl);
  }

  create(): void {
    this.generateTextures();

    // Start game scene + UI overlay
    this.scene.start('GameScene');
    this.scene.launch('UIScene');
  }

  private generateTextures(): void {
    const g = this.add.graphics();
    // ═══════════════════════════════════════════════════════
    // PLAYERS — Neon capsule bodies (two people)
    // ═══════════════════════════════════════════════════════
    const pw = GAME.PLAYER.WIDTH;
    const ph = GAME.PLAYER.HEIGHT;

    // Left player
    g.clear();
    g.fillStyle(GAME.COLORS.FOOT_LEFT, 0.18);
    g.fillRoundedRect(0, 0, pw + 14, ph + 14, 20);
    g.fillStyle(GAME.COLORS.FOOT_LEFT, 1);
    g.fillRoundedRect(7, 7, pw, ph, 24);
    g.fillStyle(0xffffff, 0.25);
    g.fillRoundedRect(14, 12, pw - 18, ph * 0.25, 18);
    // Face visor
    g.fillStyle(0x0b1220, 0.6);
    g.fillRoundedRect(18, 26, pw - 26, 18, 10);
    g.generateTexture('player-left', pw + 14, ph + 14);

    // Right player
    g.clear();
    g.fillStyle(GAME.COLORS.FOOT_RIGHT, 0.18);
    g.fillRoundedRect(0, 0, pw + 14, ph + 14, 20);
    g.fillStyle(GAME.COLORS.FOOT_RIGHT, 1);
    g.fillRoundedRect(7, 7, pw, ph, 24);
    g.fillStyle(0xffffff, 0.25);
    g.fillRoundedRect(14, 12, pw - 18, ph * 0.25, 18);
    g.fillStyle(0x0b1220, 0.6);
    g.fillRoundedRect(18, 26, pw - 26, 18, 10);
    g.generateTexture('player-right', pw + 14, ph + 14);

    // ═══════════════════════════════════════════════════════
    // GOAL POST — simple neon rect
    // ═══════════════════════════════════════════════════════
    g.clear();
    g.fillStyle(GAME.COLORS.NEON_YELLOW, 0.9);
    g.fillRoundedRect(0, 0, 10, 60, 4);
    g.generateTexture('goal-post', 10, 60);

    // ═══════════════════════════════════════════════════════
    // SHADOW — Soft elliptical shadow
    // ═══════════════════════════════════════════════════════
    g.clear();
    g.fillStyle(0x000000, 0.3);
    g.fillEllipse(30, 8, 60, 16);
    g.generateTexture('shadow', 60, 16);

    // ═══════════════════════════════════════════════════════
    // GLOW — Radial glow for ball
    // ═══════════════════════════════════════════════════════
    g.clear();
    const glowR = 40;
    for (let i = glowR; i > 0; i -= 2) {
      const alpha = (1 - i / glowR) * 0.15;
      g.fillStyle(0x00ffaa, alpha);
      g.fillCircle(glowR, glowR, i);
    }
    g.generateTexture('glow', glowR * 2, glowR * 2);

    g.destroy();
  }
}
