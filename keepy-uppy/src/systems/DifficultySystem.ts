/**
 * DifficultySystem — Invisible progressive difficulty scaling.
 *
 * The player should NEVER notice this system directly.
 * It subtly increases challenge as score grows:
 * - Gravity increases
 * - Ball spin becomes more unpredictable
 * - Bounce behavior gets slightly random
 *
 * Designed to create the "why can't I get past X score?" feeling
 * that drives "one more try" psychology.
 */

import { GAME } from './GameConstants';

export interface DifficultyParams {
  gravityMultiplier: number;
  spinVariance: number;
  bounceRandomness: number;
  level: number;
}

export class DifficultySystem {
  private score = 0;

  reset(): void {
    this.score = 0;
  }

  updateScore(score: number): void {
    this.score = score;
  }

  /** Get current difficulty parameters. Pure function of score. */
  getParams(): DifficultyParams {
    const level = Math.floor(this.score / 100);

    const gravityMultiplier = Math.min(
      GAME.DIFFICULTY.MAX_GRAVITY_MULTIPLIER,
      1.0 + this.score * GAME.DIFFICULTY.GRAVITY_INCREASE_PER_SCORE / 100,
    );

    const spinVariance = Math.min(
      GAME.DIFFICULTY.MAX_SPIN_VARIANCE,
      this.score * GAME.DIFFICULTY.SPIN_VARIANCE_INCREASE,
    );

    const bounceRandomness = Math.min(
      GAME.DIFFICULTY.MAX_BOUNCE_RANDOMNESS,
      this.score * GAME.DIFFICULTY.BOUNCE_RANDOMNESS_INCREASE,
    );

    return { gravityMultiplier, spinVariance, bounceRandomness, level };
  }
}
