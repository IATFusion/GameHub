// ─── Phaser Game Configuration ──────────────────────────────────────────────

import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from './systems/GameConstants';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { GameScene } from './scenes/GameScene';
import { UIScene } from './scenes/UIScene';

export function createGameConfig(parent: string | HTMLElement): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    parent,
    backgroundColor: `#${COLORS.BG.toString(16).padStart(6, '0')}`,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [BootScene, PreloadScene, GameScene, UIScene],
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 0 },
        debug: false,
      },
    },
    render: {
      antialias: true,
      pixelArt: false,
      roundPixels: false,
      transparent: false,
    },
    audio: {
      noAudio: true, // We handle audio via Web Audio API
    },
    input: {
      keyboard: true,
      mouse: true,
      touch: true,
    },
    fps: {
      target: 60,
      forceSetTimeOut: false,
    },
  };
}
