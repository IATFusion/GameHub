// ─── BootScene ──────────────────────────────────────────────────────────────
// First scene: minimal setup then move to preload

import { COLORS, GAME_WIDTH, GAME_HEIGHT } from '../systems/GameConstants';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.BG);

    // Simple loading text
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'LOADING...', {
      fontFamily: '"Segoe UI", monospace',
      fontSize: '18px',
      color: '#00ffaa',
    }).setOrigin(0.5);

    // Move to preload after a brief moment
    this.time.delayedCall(200, () => {
      this.scene.start('PreloadScene');
    });
  }
}
