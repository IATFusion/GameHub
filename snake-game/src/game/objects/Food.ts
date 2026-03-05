// ─── Food System ────────────────────────────────────────────────────────────
// Manages food spawning, rendering, expiration, and collection

import {
  CELL_SIZE, FoodType, COLORS,
  BONUS_FOOD_CHANCE, SUPER_FOOD_CHANCE,
  BONUS_FOOD_LIFETIME, SUPER_FOOD_LIFETIME,
  MAX_FOOD_ON_SCREEN,
} from '../systems/GameConstants';
import type { GridPos } from '../systems/GridSystem';
import { gridToPixel, randomFreeGridPos, posKey } from '../systems/GridSystem';

export interface FoodItem {
  gx: number;
  gy: number;
  type: FoodType;
  lifetime: number;  // remaining ms (-1 = permanent)
  maxLifetime: number;
  pulse: number;     // animation phase
}

export class FoodManager {
  private scene: Phaser.Scene;
  private foods: FoodItem[] = [];
  private graphics: Phaser.GameObjects.Graphics;
  private glowGraphics: Phaser.GameObjects.Graphics;
  private spawnCooldown = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.glowGraphics = scene.add.graphics();
    this.glowGraphics.setDepth(3);
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(4);
  }

  /** Get all food positions for collision/AI */
  getFoodPositions(): GridPos[] {
    return this.foods.map(f => ({ x: f.gx, y: f.gy }));
  }

  /** Get all foods */
  getFoods(): readonly FoodItem[] {
    return this.foods;
  }

  /** Check if there's food at a specific grid position and return it */
  checkCollision(gx: number, gy: number): FoodItem | null {
    const idx = this.foods.findIndex(f => f.gx === gx && f.gy === gy);
    if (idx >= 0) {
      const food = this.foods[idx];
      this.foods.splice(idx, 1);
      return food;
    }
    return null;
  }

  /** Update food lifecycle, spawn new food */
  update(delta: number, occupied: Set<string>): void {
    // Update existing food
    for (let i = this.foods.length - 1; i >= 0; i--) {
      const f = this.foods[i];
      f.pulse += delta * 0.004;

      if (f.lifetime > 0) {
        f.lifetime -= delta;
        if (f.lifetime <= 0) {
          this.foods.splice(i, 1);
        }
      }
    }

    // Spawn new food if needed
    this.spawnCooldown -= delta;
    if (this.foods.length < MAX_FOOD_ON_SCREEN && this.spawnCooldown <= 0) {
      this.spawnFood(occupied);
      this.spawnCooldown = 400 + Math.random() * 400;
    }

    this.render();
  }

  /** Spawn a single food item */
  spawnFood(occupied: Set<string>): void {
    // Add existing food to occupied
    const allOccupied = new Set(occupied);
    for (const f of this.foods) {
      allOccupied.add(posKey(f.gx, f.gy));
    }

    const pos = randomFreeGridPos(allOccupied);
    if (!pos) return;

    // Determine food type
    let type = FoodType.NORMAL;
    const roll = Math.random();
    if (roll < SUPER_FOOD_CHANCE) {
      type = FoodType.SUPER;
    } else if (roll < SUPER_FOOD_CHANCE + BONUS_FOOD_CHANCE) {
      type = FoodType.BONUS;
    }

    let lifetime = -1;
    let maxLifetime = -1;
    if (type === FoodType.BONUS) {
      lifetime = BONUS_FOOD_LIFETIME;
      maxLifetime = BONUS_FOOD_LIFETIME;
    } else if (type === FoodType.SUPER) {
      lifetime = SUPER_FOOD_LIFETIME;
      maxLifetime = SUPER_FOOD_LIFETIME;
    }

    this.foods.push({
      gx: pos.x,
      gy: pos.y,
      type,
      lifetime,
      maxLifetime,
      pulse: Math.random() * Math.PI * 2,
    });
  }

  /** Render all food items */
  private render(): void {
    this.graphics.clear();
    this.glowGraphics.clear();

    for (const food of this.foods) {
      const { px, py } = gridToPixel(food.gx, food.gy);
      const colorMap = {
        [FoodType.NORMAL]: COLORS.FOOD_NORMAL,
        [FoodType.BONUS]:  COLORS.FOOD_BONUS,
        [FoodType.SUPER]:  COLORS.FOOD_SUPER,
      };
      const glowMap = {
        [FoodType.NORMAL]: COLORS.FOOD_GLOW_NORMAL,
        [FoodType.BONUS]:  COLORS.FOOD_GLOW_BONUS,
        [FoodType.SUPER]:  COLORS.FOOD_GLOW_SUPER,
      };

      const color = colorMap[food.type];
      const glowColor = glowMap[food.type];

      // Pulsing animation
      const pulseScale = 1 + Math.sin(food.pulse * 2) * 0.15;
      const baseSize = CELL_SIZE * 0.35;
      const size = baseSize * pulseScale;

      // Expiration flash
      let alpha = 1;
      if (food.lifetime > 0 && food.maxLifetime > 0) {
        const remaining = food.lifetime / food.maxLifetime;
        if (remaining < 0.3) {
          alpha = 0.4 + Math.sin(food.pulse * 8) * 0.3 + 0.3;
        }
      }

      // Glow layers
      const glowSize = size * 3;
      this.glowGraphics.fillStyle(glowColor, 0.08 * alpha);
      this.glowGraphics.fillCircle(px, py, glowSize);

      const glowSize2 = size * 2;
      this.glowGraphics.fillStyle(glowColor, 0.15 * alpha);
      this.glowGraphics.fillCircle(px, py, glowSize2);

      // Food body
      this.graphics.fillStyle(color, alpha);

      if (food.type === FoodType.SUPER) {
        // Diamond shape for super food
        this.drawDiamond(this.graphics, px, py, size * 1.2);
      } else if (food.type === FoodType.BONUS) {
        // Star shape for bonus food
        this.drawStar(this.graphics, px, py, size * 1.1);
      } else {
        // Circle for normal food
        this.graphics.fillCircle(px, py, size);
      }

      // Inner highlight
      this.graphics.fillStyle(0xffffff, 0.35 * alpha);
      this.graphics.fillCircle(px - size * 0.2, py - size * 0.2, size * 0.35);
    }
  }

  private drawDiamond(g: Phaser.GameObjects.Graphics, x: number, y: number, size: number): void {
    g.beginPath();
    g.moveTo(x, y - size);
    g.lineTo(x + size * 0.7, y);
    g.lineTo(x, y + size);
    g.lineTo(x - size * 0.7, y);
    g.closePath();
    g.fillPath();
  }

  private drawStar(g: Phaser.GameObjects.Graphics, x: number, y: number, size: number): void {
    const points = 5;
    const innerRadius = size * 0.5;
    g.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const angle = (Math.PI * 2 * i) / (points * 2) - Math.PI / 2;
      const r = i % 2 === 0 ? size : innerRadius;
      const px = x + Math.cos(angle) * r;
      const py = y + Math.sin(angle) * r;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.closePath();
    g.fillPath();
  }

  /** Force spawn initial food set */
  spawnInitialFood(occupied: Set<string>): void {
    this.foods.length = 0;
    for (let i = 0; i < MAX_FOOD_ON_SCREEN; i++) {
      this.spawnFood(occupied);
    }
  }

  /** Remove all food */
  clear(): void {
    this.foods.length = 0;
  }

  destroy(): void {
    this.graphics.destroy();
    this.glowGraphics.destroy();
    this.foods.length = 0;
  }
}
