// ─── PreloadScene ───────────────────────────────────────────────────────────
// Generate all needed textures procedurally — no external assets required

import { GAME_WIDTH, GAME_HEIGHT, COLORS } from '../systems/GameConstants';
import EventBridge, { GameEvents } from '../systems/EventBridge';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PreloadScene' });
  }

  preload(): void {
    // External background image for the playfield
    this.load.image('playfield-bg', new URL('../../img/background.png', import.meta.url).toString());
  }

  create(): void {
    // Generate a 1x1 white pixel texture for general use
    const whitePixel = this.textures.createCanvas('pixel', 1, 1);
    if (whitePixel) {
      const ctx = whitePixel.getContext();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 1, 1);
      whitePixel.refresh();
    }

    // Notify React that the game is ready
    EventBridge.getInstance().emit(GameEvents.GAME_READY);

    // Start the game scene + UI scene
    this.scene.start('GameScene');
    this.scene.start('UIScene');
  }
}
