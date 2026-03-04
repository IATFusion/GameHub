import Phaser from 'phaser';

import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { GameScene } from './scenes/GameScene';
import { UIScene } from './scenes/UIScene';

/**
 * Phaser game configuration for KEEPY UPPY.
 *
 * Key decisions:
 * - Phaser.AUTO → uses WebGL when available, Canvas fallback
 * - RESIZE scale mode → canvas matches React container exactly
 * - No Arcade physics globally (we do manual physics for ball control)
 * - Transparent background → React can render behind if needed
 * - Input: touch + keyboard enabled
 */
export function createGameConfig(parent: HTMLElement): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#0a0e27',
    width: Math.max(1, parent.clientWidth),
    height: Math.max(1, parent.clientHeight),
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    // No arcade physics needed — we use manual physics for full control
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 0 },
        debug: false,
      },
    },
    input: {
      touch: true,
      keyboard: true,
    },
    render: {
      pixelArt: false,
      antialias: true,
      roundPixels: false,
    },
    scene: [BootScene, PreloadScene, GameScene, UIScene],
  };
}
