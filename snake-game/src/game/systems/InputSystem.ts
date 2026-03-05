// ─── InputSystem ────────────────────────────────────────────────────────────
// Handles keyboard and touch/swipe input, buffers directional commands

import { Direction, OPPOSITE_DIR, INPUT_BUFFER_SIZE } from './GameConstants';
import EventBridge, { GameEvents } from './EventBridge';

export class InputSystem {
  private inputQueue: Direction[] = [];
  private currentDirection: Direction = Direction.RIGHT;
  private scene: Phaser.Scene;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private swipeStartX = 0;
  private swipeStartY = 0;
  private isSwiping = false;
  private static readonly SWIPE_THRESHOLD = 30;
  private unsubDirection?: () => void;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.setupKeyboard();
    this.setupTouch();
    this.setupExternalDirection();
  }

  private setupExternalDirection(): void {
    const bridge = EventBridge.getInstance();
    this.unsubDirection = bridge.on(GameEvents.UI_SET_DIRECTION, (dir) => {
      // Payload should be a Direction string
      if (dir === Direction.UP || dir === Direction.DOWN || dir === Direction.LEFT || dir === Direction.RIGHT) {
        this.injectDirection(dir);
      }
    });
  }

  private setupKeyboard(): void {
    if (!this.scene.input.keyboard) return;

    this.cursors = this.scene.input.keyboard.createCursorKeys();
    this.wasd = {
      W: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };

    // Use keydown events for responsive buffered input
    this.scene.input.keyboard.on('keydown-UP',    () => this.bufferDirection(Direction.UP));
    this.scene.input.keyboard.on('keydown-DOWN',  () => this.bufferDirection(Direction.DOWN));
    this.scene.input.keyboard.on('keydown-LEFT',  () => this.bufferDirection(Direction.LEFT));
    this.scene.input.keyboard.on('keydown-RIGHT', () => this.bufferDirection(Direction.RIGHT));
    this.scene.input.keyboard.on('keydown-W',     () => this.bufferDirection(Direction.UP));
    this.scene.input.keyboard.on('keydown-S',     () => this.bufferDirection(Direction.DOWN));
    this.scene.input.keyboard.on('keydown-A',     () => this.bufferDirection(Direction.LEFT));
    this.scene.input.keyboard.on('keydown-D',     () => this.bufferDirection(Direction.RIGHT));
  }

  private setupTouch(): void {
    this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.swipeStartX = pointer.x;
      this.swipeStartY = pointer.y;
      this.isSwiping = true;
    });

    this.scene.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (!this.isSwiping) return;
      this.isSwiping = false;

      const dx = pointer.x - this.swipeStartX;
      const dy = pointer.y - this.swipeStartY;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      if (Math.max(absDx, absDy) < InputSystem.SWIPE_THRESHOLD) return;

      if (absDx > absDy) {
        this.bufferDirection(dx > 0 ? Direction.RIGHT : Direction.LEFT);
      } else {
        this.bufferDirection(dy > 0 ? Direction.DOWN : Direction.UP);
      }
    });
  }

  private bufferDirection(dir: Direction): void {
    // Don't buffer the exact opposite of the last queued or current direction
    const lastDir = this.inputQueue.length > 0
      ? this.inputQueue[this.inputQueue.length - 1]
      : this.currentDirection;

    if (dir === OPPOSITE_DIR[lastDir]) return;
    if (dir === lastDir) return;

    if (this.inputQueue.length < INPUT_BUFFER_SIZE) {
      this.inputQueue.push(dir);
    }
  }

  /** Called each snake tick to consume the next buffered direction */
  consumeDirection(): Direction {
    if (this.inputQueue.length > 0) {
      const next = this.inputQueue.shift()!;
      // Double-check it's not opposite of current (safety)
      if (next !== OPPOSITE_DIR[this.currentDirection]) {
        this.currentDirection = next;
      }
    }
    return this.currentDirection;
  }

  /** Get current confirmed direction (without consuming) */
  getCurrentDirection(): Direction {
    return this.currentDirection;
  }

  /** Set direction externally (e.g. on restart) */
  setDirection(dir: Direction): void {
    this.currentDirection = dir;
    this.inputQueue.length = 0;
  }

  /** Inject a direction from mobile controls */
  injectDirection(dir: Direction): void {
    this.bufferDirection(dir);
  }

  destroy(): void {
    this.inputQueue.length = 0;
    this.unsubDirection?.();
  }
}
