// ─── Snake (Base Class) ─────────────────────────────────────────────────────
// Shared logic for both player and CPU snakes: movement, growth, rendering

import {
  CELL_SIZE, GRID_WIDTH, GRID_HEIGHT,
  Direction, DIR_VECTORS, INITIAL_SNAKE_LENGTH, COLORS,
} from '../systems/GameConstants';
import { gridToPixel, lerp, easeOutCubic, posKey } from '../systems/GridSystem';

export interface SnakeSegment {
  gx: number;  // current grid x
  gy: number;  // current grid y
  pgx: number; // previous grid x
  pgy: number; // previous grid y
}

export interface SnakeConfig {
  startX: number;
  startY: number;
  direction: Direction;
  headColor: number;
  bodyColor: number;
  tailColor: number;
  glowColor: number;
  eyeColor: number;
  length?: number;
}

export class Snake {
  protected scene: Phaser.Scene;
  protected segments: SnakeSegment[] = [];
  protected direction: Direction;
  protected headColor: number;
  protected bodyColor: number;
  protected tailColor: number;
  protected glowColor: number;
  protected eyeColor: number;

  protected graphics: Phaser.GameObjects.Graphics;
  protected glowGraphics: Phaser.GameObjects.Graphics;

  protected moveTimer = 0;
  protected moveInterval: number;
  protected interpolation = 1; // start fully arrived
  protected growQueue = 0;
  protected alive = true;

  // Cached pixel positions for external reads
  public headPixelX = 0;
  public headPixelY = 0;

  constructor(scene: Phaser.Scene, config: SnakeConfig, moveInterval: number) {
    this.scene = scene;
    this.direction = config.direction;
    this.headColor = config.headColor;
    this.bodyColor = config.bodyColor;
    this.tailColor = config.tailColor;
    this.glowColor = config.glowColor;
    this.eyeColor = config.eyeColor;
    this.moveInterval = moveInterval;

    // Create graphics layers
    this.glowGraphics = scene.add.graphics();
    this.glowGraphics.setDepth(5);
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(10);

    // Initialize segments
    const len = config.length ?? INITIAL_SNAKE_LENGTH;
    const vec = DIR_VECTORS[config.direction];
    for (let i = 0; i < len; i++) {
      const gx = config.startX - vec.x * i;
      const gy = config.startY - vec.y * i;
      this.segments.push({ gx, gy, pgx: gx - vec.x, pgy: gy - vec.y });
    }
  }

  // ── Getters ──────────────────────────────────────────────────────────

  getHead(): SnakeSegment {
    return this.segments[0];
  }

  getSegments(): readonly SnakeSegment[] {
    return this.segments;
  }

  getLength(): number {
    return this.segments.length;
  }

  isAlive(): boolean {
    return this.alive;
  }

  getDirection(): Direction {
    return this.direction;
  }

  /** Get set of "x,y" keys for all occupied cells */
  getOccupiedCells(): Set<string> {
    const set = new Set<string>();
    for (const s of this.segments) {
      set.add(posKey(s.gx, s.gy));
    }
    return set;
  }

  // ── Movement ─────────────────────────────────────────────────────────

  /** Override in subclass to set direction before each tick */
  protected chooseDirection(): Direction {
    return this.direction;
  }

  /** Main update — accumulates time and ticks movement */
  update(delta: number): void {
    if (!this.alive) return;

    this.moveTimer += delta;
    this.interpolation = Math.min(1, this.moveTimer / this.moveInterval);

    if (this.moveTimer >= this.moveInterval) {
      this.moveTimer -= this.moveInterval;
      this.direction = this.chooseDirection();
      this.tick();
      this.interpolation = 0;
    }

    this.updatePixelPositions();
    this.render();
  }

  /** Advance one grid step */
  protected tick(): void {
    const vec = DIR_VECTORS[this.direction];
    const head = this.segments[0];

    // Save previous positions and shift body
    for (let i = this.segments.length - 1; i > 0; i--) {
      const seg = this.segments[i];
      seg.pgx = seg.gx;
      seg.pgy = seg.gy;
      seg.gx = this.segments[i - 1].gx;
      seg.gy = this.segments[i - 1].gy;
    }

    // Move head
    head.pgx = head.gx;
    head.pgy = head.gy;
    head.gx += vec.x;
    head.gy += vec.y;

    // Handle growth
    if (this.growQueue > 0) {
      this.growQueue--;
      const tail = this.segments[this.segments.length - 1];
      this.segments.push({
        gx: tail.pgx,
        gy: tail.pgy,
        pgx: tail.pgx,
        pgy: tail.pgy,
      });
    }
  }

  /** Cache interpolated pixel position for head */
  protected updatePixelPositions(): void {
    const head = this.segments[0];
    const t = easeOutCubic(this.interpolation);
    const { px: px1, py: py1 } = gridToPixel(head.pgx, head.pgy);
    const { px: px2, py: py2 } = gridToPixel(head.gx, head.gy);
    this.headPixelX = lerp(px1, px2, t);
    this.headPixelY = lerp(py1, py2, t);
  }

  // ── Growth ───────────────────────────────────────────────────────────

  grow(amount: number): void {
    this.growQueue += amount;
  }

  // ── Collision ────────────────────────────────────────────────────────

  /** Check if head hit walls */
  isOutOfBounds(): boolean {
    const h = this.segments[0];
    return h.gx < 0 || h.gx >= GRID_WIDTH || h.gy < 0 || h.gy >= GRID_HEIGHT;
  }

  /** Check if head hits its own body (skip first 3 segments — impossible to self-collide) */
  isSelfCollision(): boolean {
    const h = this.segments[0];
    for (let i = 3; i < this.segments.length; i++) {
      if (this.segments[i].gx === h.gx && this.segments[i].gy === h.gy) {
        return true;
      }
    }
    return false;
  }

  /** Check if head hits any segment of another snake */
  collidesWithSnake(other: Snake): boolean {
    const h = this.segments[0];
    for (const seg of other.segments) {
      if (seg.gx === h.gx && seg.gy === h.gy) {
        return true;
      }
    }
    return false;
  }

  /** Check if head is on a specific grid cell */
  headIsAt(gx: number, gy: number): boolean {
    const h = this.segments[0];
    return h.gx === gx && h.gy === gy;
  }

  // ── Lifecycle ────────────────────────────────────────────────────────

  kill(): void {
    this.alive = false;
  }

  revive(startX: number, startY: number, dir: Direction, length?: number): void {
    this.alive = true;
    this.direction = dir;
    this.moveTimer = 0;
    this.interpolation = 1;
    this.growQueue = 0;
    this.segments.length = 0;

    const vec = DIR_VECTORS[dir];
    const len = length ?? INITIAL_SNAKE_LENGTH;
    for (let i = 0; i < len; i++) {
      const gx = startX - vec.x * i;
      const gy = startY - vec.y * i;
      this.segments.push({ gx, gy, pgx: gx - vec.x, pgy: gy - vec.y });
    }
  }

  setMoveInterval(interval: number): void {
    this.moveInterval = interval;
  }

  // ── Rendering ────────────────────────────────────────────────────────

  protected render(): void {
    this.graphics.clear();
    this.glowGraphics.clear();

    if (!this.alive || this.segments.length === 0) return;

    const t = easeOutCubic(this.interpolation);
    const segSize = CELL_SIZE * 0.75;
    const glowSize = CELL_SIZE * 1.1;

    for (let i = this.segments.length - 1; i >= 0; i--) {
      const seg = this.segments[i];
      const { px: px1, py: py1 } = gridToPixel(seg.pgx, seg.pgy);
      const { px: px2, py: py2 } = gridToPixel(seg.gx, seg.gy);
      const px = lerp(px1, px2, t);
      const py = lerp(py1, py2, t);

      // Segment scale: head is largest, tail tapers
      const segScale = i === 0 ? 1.0 : Math.max(0.6, 1.0 - (i / this.segments.length) * 0.35);
      const size = segSize * segScale;
      const gSize = glowSize * segScale;

      // Color gradient from head to tail
      const colorT = this.segments.length > 1 ? i / (this.segments.length - 1) : 0;
      const bodyCol = i === 0 ? this.headColor : lerpColor(this.bodyColor, this.tailColor, colorT);

      // Glow layer (multiple passes for bloom effect)
      const glowAlpha = i === 0 ? 0.25 : 0.12 - colorT * 0.06;
      this.glowGraphics.fillStyle(this.glowColor, Math.max(0.03, glowAlpha));
      this.glowGraphics.fillRoundedRect(
        px - gSize * 0.5, py - gSize * 0.5, gSize, gSize,
        gSize * 0.35
      );

      // Outer glow
      if (i === 0) {
        this.glowGraphics.fillStyle(this.glowColor, 0.08);
        const outerSize = glowSize * 1.5;
        this.glowGraphics.fillRoundedRect(
          px - outerSize * 0.5, py - outerSize * 0.5, outerSize, outerSize,
          outerSize * 0.35
        );
      }

      // Body segment
      this.graphics.fillStyle(bodyCol, 1);
      this.graphics.fillRoundedRect(
        px - size * 0.5, py - size * 0.5, size, size,
        size * 0.3
      );

      // Inner highlight
      const hlSize = size * 0.5;
      this.graphics.fillStyle(0xffffff, i === 0 ? 0.15 : 0.06);
      this.graphics.fillRoundedRect(
        px - hlSize * 0.5, py - hlSize * 0.35, hlSize, hlSize * 0.5,
        hlSize * 0.25
      );
    }

    // Draw eyes on head
    this.renderEyes(t);
  }

  private renderEyes(t: number): void {
    const head = this.segments[0];
    const { px: px1, py: py1 } = gridToPixel(head.pgx, head.pgy);
    const { px: px2, py: py2 } = gridToPixel(head.gx, head.gy);
    const px = lerp(px1, px2, t);
    const py = lerp(py1, py2, t);

    const vec = DIR_VECTORS[this.direction];
    const eyeOffset = CELL_SIZE * 0.18;
    const eyeSize = CELL_SIZE * 0.12;
    const pupilSize = eyeSize * 0.6;

    // Perpendicular to direction for eye placement
    const perpX = -vec.y;
    const perpY = vec.x;

    for (const side of [-1, 1]) {
      const ex = px + vec.x * eyeOffset * 0.8 + perpX * eyeOffset * side;
      const ey = py + vec.y * eyeOffset * 0.8 + perpY * eyeOffset * side;

      // Eye white
      this.graphics.fillStyle(this.eyeColor, 0.95);
      this.graphics.fillCircle(ex, ey, eyeSize);

      // Pupil (offset in movement direction)
      this.graphics.fillStyle(0x111122, 1);
      this.graphics.fillCircle(ex + vec.x * 1.5, ey + vec.y * 1.5, pupilSize);
    }
  }

  destroy(): void {
    this.graphics.destroy();
    this.glowGraphics.destroy();
  }
}

// ── Utility ─────────────────────────────────────────────────────────────────

/** Interpolate between two hex colors */
function lerpColor(c1: number, c2: number, t: number): number {
  const r1 = (c1 >> 16) & 0xff, g1 = (c1 >> 8) & 0xff, b1 = c1 & 0xff;
  const r2 = (c2 >> 16) & 0xff, g2 = (c2 >> 8) & 0xff, b2 = c2 & 0xff;
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return (r << 16) | (g << 8) | b;
}
