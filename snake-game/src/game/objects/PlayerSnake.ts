// ─── PlayerSnake ────────────────────────────────────────────────────────────
// Player-controlled snake with input system integration

import { Snake } from './Snake';
import { InputSystem } from '../systems/InputSystem';
import { Direction, PLAYER_MOVE_INTERVAL, COLORS } from '../systems/GameConstants';

export class PlayerSnake extends Snake {
  private inputSystem: InputSystem;

  constructor(scene: Phaser.Scene, startX: number, startY: number) {
    super(scene, {
      startX,
      startY,
      direction: Direction.RIGHT,
      headColor: COLORS.PLAYER_HEAD,
      bodyColor: COLORS.PLAYER_BODY,
      tailColor: COLORS.PLAYER_TAIL,
      glowColor: COLORS.PLAYER_GLOW,
      eyeColor:  COLORS.PLAYER_EYE,
    }, PLAYER_MOVE_INTERVAL);

    this.inputSystem = new InputSystem(scene);
  }

  protected chooseDirection(): Direction {
    return this.inputSystem.consumeDirection();
  }

  getInputSystem(): InputSystem {
    return this.inputSystem;
  }

  resetWithInput(startX: number, startY: number, dir: Direction): void {
    this.revive(startX, startY, dir);
    this.inputSystem.setDirection(dir);
  }

  destroy(): void {
    super.destroy();
    this.inputSystem.destroy();
  }
}
