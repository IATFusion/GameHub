// ─── CPUSnake (AI) ──────────────────────────────────────────────────────────
// AI-controlled snake with heuristic pathfinding

import { Snake } from './Snake';
import type { SnakeSegment } from './Snake';
import {
  Direction, DIR_VECTORS, ALL_DIRECTIONS, OPPOSITE_DIR,
  CPU_BASE_MOVE_INTERVAL, GRID_WIDTH, GRID_HEIGHT, COLORS,
} from '../systems/GameConstants';
import type { GridPos } from '../systems/GridSystem';
import { isInBounds, manhattanDist, posKey } from '../systems/GridSystem';

export class CPUSnake extends Snake {
  private targetFood: GridPos | null = null;
  private dangerCells = new Set<string>();
  private randomnessFactor = 0.08; // chance of random move

  constructor(scene: Phaser.Scene, startX: number, startY: number) {
    super(scene, {
      startX,
      startY,
      direction: Direction.LEFT,
      headColor: COLORS.CPU_HEAD,
      bodyColor: COLORS.CPU_BODY,
      tailColor: COLORS.CPU_TAIL,
      glowColor: COLORS.CPU_GLOW,
      eyeColor:  COLORS.CPU_EYE,
    }, CPU_BASE_MOVE_INTERVAL);
  }

  /** Update the set of cells the CPU should avoid */
  updateDangerCells(playerSegments: readonly SnakeSegment[]): void {
    this.dangerCells.clear();
    // Own body (skip head)
    for (let i = 1; i < this.segments.length; i++) {
      this.dangerCells.add(posKey(this.segments[i].gx, this.segments[i].gy));
    }
    // Player snake
    for (const seg of playerSegments) {
      this.dangerCells.add(posKey(seg.gx, seg.gy));
    }
  }

  /** Set the food positions so AI can target them */
  setFoodTargets(foodPositions: GridPos[]): void {
    if (foodPositions.length === 0) {
      this.targetFood = null;
      return;
    }

    const head = this.getHead();
    let nearest: GridPos | null = null;
    let nearestDist = Infinity;

    for (const food of foodPositions) {
      const d = manhattanDist({ x: head.gx, y: head.gy }, food);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = food;
      }
    }
    this.targetFood = nearest;
  }

  protected chooseDirection(): Direction {
    const head = this.getHead();

    // Occasional random move for variety
    if (Math.random() < this.randomnessFactor) {
      const safeDirs = this.getSafeDirections(head);
      if (safeDirs.length > 0) {
        return safeDirs[Math.floor(Math.random() * safeDirs.length)];
      }
    }

    // If we have a food target, steer toward it
    if (this.targetFood) {
      const bestDir = this.steerToward(head, this.targetFood);
      if (bestDir) return bestDir;
    }

    // Fallback: pick any safe direction, preferring current direction
    const safeDirs = this.getSafeDirections(head);
    if (safeDirs.includes(this.direction)) {
      return this.direction;
    }
    if (safeDirs.length > 0) {
      return safeDirs[Math.floor(Math.random() * safeDirs.length)];
    }

    // No safe direction — we're trapped, keep going
    return this.direction;
  }

  /** Steer toward a target position, considering safety */
  private steerToward(head: SnakeSegment, target: GridPos): Direction | null {
    const dx = target.x - head.gx;
    const dy = target.y - head.gy;

    // Rank directions by how much they reduce distance to target
    const ranked = ALL_DIRECTIONS
      .filter(d => d !== OPPOSITE_DIR[this.direction])
      .map(d => {
        const v = DIR_VECTORS[d];
        const nx = head.gx + v.x;
        const ny = head.gy + v.y;
        const dist = Math.abs(target.x - nx) + Math.abs(target.y - ny);
        const safe = this.isSafe(nx, ny);
        // Also look one step ahead for trap avoidance
        const futureOptions = this.countSafeExits(nx, ny, d);
        return { dir: d, dist, safe, futureOptions };
      })
      .filter(entry => entry.safe)
      .sort((a, b) => {
        // Prefer directions with more future options (avoid dead-ends)
        if (a.futureOptions === 0 && b.futureOptions > 0) return 1;
        if (b.futureOptions === 0 && a.futureOptions > 0) return -1;
        return a.dist - b.dist;
      });

    return ranked.length > 0 ? ranked[0].dir : null;
  }

  /** Get all safe directions from current position */
  private getSafeDirections(head: SnakeSegment): Direction[] {
    return ALL_DIRECTIONS
      .filter(d => d !== OPPOSITE_DIR[this.direction])
      .filter(d => {
        const v = DIR_VECTORS[d];
        return this.isSafe(head.gx + v.x, head.gy + v.y);
      });
  }

  /** Check if a cell is safe to move into */
  private isSafe(gx: number, gy: number): boolean {
    if (!isInBounds(gx, gy)) return false;
    if (this.dangerCells.has(posKey(gx, gy))) return false;
    return true;
  }

  /** Count how many safe exits exist from a cell (look-ahead for trap avoidance) */
  private countSafeExits(gx: number, gy: number, fromDir: Direction): number {
    let count = 0;
    for (const d of ALL_DIRECTIONS) {
      if (d === OPPOSITE_DIR[fromDir]) continue;
      const v = DIR_VECTORS[d];
      if (this.isSafe(gx + v.x, gy + v.y)) count++;
    }
    return count;
  }

  /** Set randomness (lower = more predictable/harder) */
  setRandomness(factor: number): void {
    this.randomnessFactor = factor;
  }

  /** Reset for respawn */
  respawn(startX: number, startY: number, dir: Direction): void {
    this.revive(startX, startY, dir);
  }
}
