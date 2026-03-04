import Phaser from 'phaser';

/**
 * BootScene — Minimal first scene.
 *
 * Responsibilities:
 * - Initialize global registry values
 * - Transition to PreloadScene
 */
export class BootScene extends Phaser.Scene {
  public static readonly Key = 'BootScene';

  constructor() {
    super(BootScene.Key);
  }

  create(): void {
    // Set registry defaults
    this.registry.set('score', 0);
    this.registry.set('combo', 0);
    this.registry.set('bestCombo', 0);
    this.registry.set('gameState', 'menu');
    this.registry.set('highScore',
      parseInt(localStorage.getItem('keepy-uppy-highscore') || '0', 10));

    this.scene.start('PreloadScene');
  }
}
