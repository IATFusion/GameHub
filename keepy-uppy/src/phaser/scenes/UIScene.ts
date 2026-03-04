import Phaser from 'phaser';
import { GAME } from '../../systems/GameConstants';
import { eventBridge } from '../../systems/EventBridge';
import type { GameState } from '../../systems/EventBridge';

/**
 * UIScene — Duel mode HUD.
 *
 * Displays:
 * - Match score (left vs right)
 * - Start prompt + controls
 * - Goal flash
 */
export class UIScene extends Phaser.Scene {
  public static readonly Key = 'UIScene';

  // HUD elements
  private scoreText!: Phaser.GameObjects.Text;
  private stateText!: Phaser.GameObjects.Text;
  private controlsText!: Phaser.GameObjects.Text;
  private goalText!: Phaser.GameObjects.Text;

  // Animated values
  private displayLeft = 0;
  private displayRight = 0;
  private targetLeft = 0;
  private targetRight = 0;
  private goalFlashMs = 0;

  // State
  private currentState: GameState = 'menu';

  // Unsub functions
  private unsubs: Array<() => void> = [];

  constructor() {
    super(UIScene.Key);
  }

  create(): void {
    this.createHUD();
    this.wireEvents();
    this.updateLayout();

    this.scale.on('resize', this.handleResize, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.handleResize, this);
      for (const unsub of this.unsubs) unsub();
      this.unsubs = [];
    });
  }

  update(_time: number, delta: number): void {
    // Animate match score (smooth counting up)
    if (this.displayLeft !== this.targetLeft || this.displayRight !== this.targetRight) {
      this.displayLeft = this.stepToward(this.displayLeft, this.targetLeft);
      this.displayRight = this.stepToward(this.displayRight, this.targetRight);
      this.scoreText.setText(`${this.displayLeft}  -  ${this.displayRight}`);

      // Pulse briefly when numbers change
      const currentScale = this.scoreText.scaleX;
      this.scoreText.setScale(Math.max(currentScale, 1.12));
    } else {
      const currentScale = this.scoreText.scaleX;
      if (currentScale > 1.001) this.scoreText.setScale(Phaser.Math.Linear(currentScale, 1, 0.12));
    }

    // Goal flash
    if (this.goalFlashMs > 0) {
      this.goalFlashMs -= delta;
      const t = Phaser.Math.Clamp(this.goalFlashMs / 650, 0, 1);
      this.goalText.setVisible(true);
      this.goalText.setAlpha(Phaser.Math.Clamp(0.35 + t * 0.9, 0, 1));
      const s = 1 + (1 - t) * 0.12;
      this.goalText.setScale(s);
    } else {
      this.goalText.setVisible(false);
    }

    // Pulse state text in menu state
    if (this.currentState === 'menu') {
      const pulse = Math.sin(_time / 400) * 0.2 + 0.8;
      this.stateText.setAlpha(pulse);
    }

    // Subtle float for state text
    if (this.currentState === 'menu' || this.currentState === 'gameover') {
      const baseY = this.scale.height * 0.48;
      this.stateText.y = baseY + Math.sin(_time / 600) * 4;
    }
  }

  private createHUD(): void {
    const titleFont: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
      fontSize: '48px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2,
    };

    const scoreFont: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
      fontSize: '40px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2,
    };

    const stateFont: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
      fontSize: '24px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
      align: 'center',
    };

    const controlFont: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
      fontSize: '14px',
      color: '#8888bb',
      align: 'center',
    };

    const goalFont: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
      fontSize: '38px',
      color: '#' + GAME.COLORS.NEON_YELLOW.toString(16).padStart(6, '0'),
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
      align: 'center',
    };

    // Score (top center)
    this.scoreText = this.add.text(0, 0, '0  -  0', scoreFont)
      .setOrigin(0.5, 0)
      .setDepth(200)
      .setScrollFactor(0);

    // State text (center screen)
    this.stateText = this.add.text(0, 0, '', stateFont)
      .setOrigin(0.5, 0.5)
      .setDepth(200)
      .setScrollFactor(0);

    // Controls hint
    this.controlsText = this.add.text(0, 0, '', controlFont)
      .setOrigin(0.5, 0)
      .setDepth(200)
      .setScrollFactor(0);

    // Goal flash
    this.goalText = this.add.text(0, 0, 'GOAL!', goalFont)
      .setOrigin(0.5, 0.5)
      .setDepth(220)
      .setScrollFactor(0)
      .setVisible(false);

    void titleFont; // used for reference
  }

  private wireEvents(): void {
    this.unsubs.push(
      eventBridge.on('match-score-changed', (data) => {
        this.targetLeft = data.left;
        this.targetRight = data.right;
      }),

      eventBridge.on('goal', (data) => {
        this.goalFlashMs = 650;
        this.goalText.setText(data.scorer === 'left' ? 'LEFT SCORES!' : 'RIGHT SCORES!');
      }),

      eventBridge.on('state-changed', (data) => {
        this.currentState = data.state;
        this.updateStateText();
      }),

      eventBridge.on('game-start', () => {
        this.displayLeft = 0;
        this.displayRight = 0;
        this.targetLeft = 0;
        this.targetRight = 0;
        this.scoreText.setText('0  -  0');
      }),
    );
  }

  private updateStateText(): void {
    const { width, height } = this.scale;
    const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    switch (this.currentState) {
      case 'menu':
        this.stateText.setText('DUEL');
        this.stateText.setFontSize(36);
        this.stateText.setPosition(width / 2, height * 0.42);
        this.stateText.setVisible(true);

        this.controlsText.setText(
          isMobile
            ? 'DRAG LEFT/RIGHT TO MOVE\nSWIPE UP TO JUMP\nTAP TO KICK\n\nTAP TO START'
            : 'LEFT: A/D MOVE  W JUMP  S KICK\nRIGHT: J/L MOVE  I JUMP  K KICK\n\nPRESS ANY KEY TO START',
        );
        this.controlsText.setPosition(width / 2, height * 0.55);
        this.controlsText.setVisible(true);
        break;

      case 'playing':
        this.stateText.setVisible(false);
        this.controlsText.setVisible(false);
        break;

      case 'paused':
        // Brief pause state is used during goal reset; goal text is handled separately.
        this.stateText.setVisible(false);
        this.controlsText.setVisible(false);
        break;

      case 'gameover': {
        this.stateText.setText('GAME OVER');
        this.stateText.setFontSize(28);
        this.stateText.setPosition(width / 2, height * 0.4);
        this.stateText.setVisible(true);

        this.controlsText.setText(
          isMobile ? 'TAP TO RETRY' : 'PRESS ANY KEY TO RETRY',
        );
        this.controlsText.setPosition(width / 2, height * 0.58);
        this.controlsText.setVisible(true);

        break;
      }
    }
  }

  private updateLayout(): void {
    const { width } = this.scale;

    // Score at top center
    this.scoreText.setPosition(width / 2, 16);

    this.goalText.setPosition(width / 2, this.scale.height * 0.35);

    this.updateStateText();
  }

  private handleResize(_gameSize: Phaser.Structs.Size): void {
    this.updateLayout();
  }

  private stepToward(current: number, target: number): number {
    if (current === target) return current;
    const diff = target - current;
    const step = Math.sign(diff) * Math.max(1, Math.ceil(Math.abs(diff) * 0.25));
    const next = current + step;
    if (diff > 0) return Math.min(target, next);
    return Math.max(target, next);
  }
}
