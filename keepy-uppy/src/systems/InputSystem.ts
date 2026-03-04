/**
 * InputSystem — Handles keyboard + touch input for both feet.
 *
 * Architecture:
 * - Polls every frame (called from GameScene.update)
 * - Returns normalized movement values [-1, 0, +1] for each foot
 * - Touch: left half = left foot, right half = right foot
 * - Keyboard: A/D = left foot, J/L = right foot
 *
 * Performance: No allocations per frame. Reuses state object.
 */

export interface FootInput {
  leftDirection: number; // -1 (left), 0, +1 (right)
  rightDirection: number;
  leftJump: boolean;
  rightJump: boolean;
  leftKick: boolean;
  rightKick: boolean;
}

export class InputSystem {
  private keys: {
    leftA: boolean;
    leftD: boolean;
    rightJ: boolean;
    rightL: boolean;
    leftW: boolean;
    leftS: boolean;
    rightI: boolean;
    rightK: boolean;
  } = {
    leftA: false,
    leftD: false,
    rightJ: false,
    rightL: false,
    leftW: false,
    leftS: false,
    rightI: false,
    rightK: false,
  };

  private pressed: {
    leftJump: boolean;
    rightJump: boolean;
    leftKick: boolean;
    rightKick: boolean;
  } = {
    leftJump: false,
    rightJump: false,
    leftKick: false,
    rightKick: false,
  };

  private touchLeftDirection = 0;
  private touchRightDirection = 0;
  private touchPressed: {
    leftJump: boolean;
    rightJump: boolean;
    leftKick: boolean;
    rightKick: boolean;
  } = {
    leftJump: false,
    rightJump: false,
    leftKick: false,
    rightKick: false,
  };

  private activeTouches = new Map<
    number,
    {
      startX: number;
      startY: number;
      currentX: number;
      currentY: number;
      startTime: number;
      side: 'left' | 'right';
    }
  >();

  private scene: Phaser.Scene;
  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundKeyUp: (e: KeyboardEvent) => void;
  private canvasWidth = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.canvasWidth = scene.scale.width;

    // Keyboard handlers (direct DOM for lowest latency)
    this.boundKeyDown = this.onKeyDown.bind(this);
    this.boundKeyUp = this.onKeyUp.bind(this);
    window.addEventListener('keydown', this.boundKeyDown);
    window.addEventListener('keyup', this.boundKeyUp);

    // Touch handlers via Phaser input
    this.setupTouch();

    // Resize tracking
    scene.scale.on('resize', this.onResize, this);
  }

  /** Call every frame to get current foot input state. Zero allocations. */
  getInput(): FootInput {
    // Left foot: A = left, D = right
    let leftDir = 0;
    if (this.keys.leftA) leftDir -= 1;
    if (this.keys.leftD) leftDir += 1;

    // Right foot: J = left, L = right
    let rightDir = 0;
    if (this.keys.rightJ) rightDir -= 1;
    if (this.keys.rightL) rightDir += 1;

    // Merge touch input (touch overrides if non-zero)
    if (this.touchLeftDirection !== 0) leftDir = this.touchLeftDirection;
    if (this.touchRightDirection !== 0) rightDir = this.touchRightDirection;

    const leftJump = this.consumePressed('leftJump');
    const rightJump = this.consumePressed('rightJump');
    const leftKick = this.consumePressed('leftKick');
    const rightKick = this.consumePressed('rightKick');

    return {
      leftDirection: leftDir,
      rightDirection: rightDir,
      leftJump,
      rightJump,
      leftKick,
      rightKick,
    };
  }

  private onKeyDown(e: KeyboardEvent): void {
    switch (e.code) {
      case 'KeyA': this.keys.leftA = true; break;
      case 'KeyD': this.keys.leftD = true; break;
      case 'KeyJ': this.keys.rightJ = true; break;
      case 'KeyL': this.keys.rightL = true; break;
      case 'KeyW':
        if (!this.keys.leftW) this.pressed.leftJump = true;
        this.keys.leftW = true;
        break;
      case 'KeyS':
        if (!this.keys.leftS) this.pressed.leftKick = true;
        this.keys.leftS = true;
        break;
      case 'KeyI':
        if (!this.keys.rightI) this.pressed.rightJump = true;
        this.keys.rightI = true;
        break;
      case 'KeyK':
        if (!this.keys.rightK) this.pressed.rightKick = true;
        this.keys.rightK = true;
        break;
    }
  }

  private onKeyUp(e: KeyboardEvent): void {
    switch (e.code) {
      case 'KeyA': this.keys.leftA = false; break;
      case 'KeyD': this.keys.leftD = false; break;
      case 'KeyJ': this.keys.rightJ = false; break;
      case 'KeyL': this.keys.rightL = false; break;
      case 'KeyW': this.keys.leftW = false; break;
      case 'KeyS': this.keys.leftS = false; break;
      case 'KeyI': this.keys.rightI = false; break;
      case 'KeyK': this.keys.rightK = false; break;
    }
  }

  private setupTouch(): void {
    const input = this.scene.input;

    input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const side = pointer.x < this.canvasWidth / 2 ? 'left' : 'right';
      this.activeTouches.set(pointer.id, {
        startX: pointer.x,
        startY: pointer.y,
        currentX: pointer.x,
        currentY: pointer.y,
        startTime: performance.now(),
        side,
      });
      this.updateTouchDirections();
    });

    input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      const touch = this.activeTouches.get(pointer.id);
      if (touch) {
        touch.currentX = pointer.x;
        touch.currentY = pointer.y;
        this.updateTouchDirections();
      }
    });

    input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      const touch = this.activeTouches.get(pointer.id);
      if (touch) {
        const dx = touch.currentX - touch.startX;
        const dy = touch.currentY - touch.startY;
        const dt = performance.now() - touch.startTime;

        // Gesture actions (single-touch):
        // - Swipe up = jump
        // - Tap = kick
        const tap = dt < 220 && Math.abs(dx) < 14 && Math.abs(dy) < 14;
        const swipeUp = dy < -34;

        if (swipeUp) {
          if (touch.side === 'left') this.touchPressed.leftJump = true;
          else this.touchPressed.rightJump = true;
        } else if (tap) {
          if (touch.side === 'left') this.touchPressed.leftKick = true;
          else this.touchPressed.rightKick = true;
        }
      }

      this.activeTouches.delete(pointer.id);
      this.updateTouchDirections();
    });
  }

  private consumePressed(which: 'leftJump' | 'rightJump' | 'leftKick' | 'rightKick'): boolean {
    const v = this.pressed[which] || this.touchPressed[which];
    this.pressed[which] = false;
    this.touchPressed[which] = false;
    return v;
  }

  private updateTouchDirections(): void {
    this.touchLeftDirection = 0;
    this.touchRightDirection = 0;

    for (const touch of this.activeTouches.values()) {
      const dx = touch.currentX - touch.startX;
      const threshold = 10; // Dead zone in px

      if (Math.abs(dx) > threshold) {
        const dir = dx > 0 ? 1 : -1;
        if (touch.side === 'left') {
          this.touchLeftDirection = dir;
        } else {
          this.touchRightDirection = dir;
        }
      } else {
        // If touching but not swiping, move foot toward touch point
        const halfW = this.canvasWidth / 2;
        if (touch.side === 'left') {
          // Move left foot toward touch X position relative to left half
          this.touchLeftDirection = touch.currentX < halfW * 0.4 ? -1 : touch.currentX > halfW * 0.6 ? 1 : 0;
        } else {
          // Move right foot toward touch position relative to right half
          const relX = touch.currentX - halfW;
          this.touchRightDirection = relX < halfW * 0.4 ? -1 : relX > halfW * 0.6 ? 1 : 0;
        }
      }
    }
  }

  private onResize(gameSize: Phaser.Structs.Size): void {
    this.canvasWidth = gameSize.width;
  }

  /** Must be called when scene shuts down to prevent memory leaks. */
  destroy(): void {
    window.removeEventListener('keydown', this.boundKeyDown);
    window.removeEventListener('keyup', this.boundKeyUp);
    this.scene.scale.off('resize', this.onResize, this);
    this.activeTouches.clear();
  }
}
