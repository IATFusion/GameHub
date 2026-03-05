// ─── GridSystem ─────────────────────────────────────────────────────────────
// Utility functions for grid operations, collision checking, and coordinate math

import { GRID_WIDTH, GRID_HEIGHT, CELL_SIZE } from './GameConstants';

export interface GridPos {
  x: number;
  y: number;
}

/** Convert grid position to pixel center */
export function gridToPixel(gx: number, gy: number): { px: number; py: number } {
  return {
    px: gx * CELL_SIZE + CELL_SIZE * 0.5,
    py: gy * CELL_SIZE + CELL_SIZE * 0.5,
  };
}

/** Check if a grid position is within bounds */
export function isInBounds(gx: number, gy: number): boolean {
  return gx >= 0 && gx < GRID_WIDTH && gy >= 0 && gy < GRID_HEIGHT;
}

/** Linear interpolation */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Ease-out cubic for smooth deceleration */
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** Ease-in-out for smooth movement */
export function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/** Manhattan distance between two grid positions */
export function manhattanDist(a: GridPos, b: GridPos): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/** Get a random grid position */
export function randomGridPos(): GridPos {
  return {
    x: Math.floor(Math.random() * GRID_WIDTH),
    y: Math.floor(Math.random() * GRID_HEIGHT),
  };
}

/**
 * Get a random grid position that doesn't overlap with any occupied positions.
 * @param occupied Set of "x,y" strings
 * @param maxAttempts Max random attempts before scanning
 */
export function randomFreeGridPos(occupied: Set<string>, maxAttempts = 100): GridPos | null {
  // Try random positions first
  for (let i = 0; i < maxAttempts; i++) {
    const pos = randomGridPos();
    if (!occupied.has(`${pos.x},${pos.y}`)) {
      return pos;
    }
  }
  // Fallback: scan grid
  for (let y = 0; y < GRID_HEIGHT; y++) {
    for (let x = 0; x < GRID_WIDTH; x++) {
      if (!occupied.has(`${x},${y}`)) {
        return { x, y };
      }
    }
  }
  return null; // Grid is completely full (shouldn't happen)
}

/** Create a position key string */
export function posKey(x: number, y: number): string {
  return `${x},${y}`;
}

/** Clamp a value between min and max */
export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/** Convert hex color to CSS rgba string */
export function hexToRgba(hex: number, alpha = 1): string {
  const r = (hex >> 16) & 0xff;
  const g = (hex >> 8) & 0xff;
  const b = hex & 0xff;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
