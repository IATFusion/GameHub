/**
 * ComboSystem — Tracks combo chains, multiplier, and flow state.
 *
 * Rules:
 * - Player must ALTERNATE feet (left→right→left→...) to build combo.
 * - Breaking alternation resets combo to 0.
 * - Perfect hits give bonus combo points.
 * - Flow meter builds with consecutive hits, decays when idle.
 * - At max flow → slow-motion activation.
 *
 * This is a pure logic system — no Phaser dependencies.
 * Can be unit tested independently.
 */

import type { HitQuality } from './EventBridge';
import { GAME } from './GameConstants';

export interface ComboState {
  combo: number;
  multiplier: number;
  lastFoot: 'left' | 'right' | null;
  flow: number;
  maxFlow: boolean;
  totalScore: number;
  bestCombo: number;
  bounceCount: number;
}

export class ComboSystem {
  private state: ComboState = {
    combo: 0,
    multiplier: 1,
    lastFoot: null,
    flow: 0,
    maxFlow: false,
    totalScore: 0,
    bestCombo: 0,
    bounceCount: 0,
  };

  /** Reset all state for a new game. */
  reset(): void {
    this.state = {
      combo: 0,
      multiplier: 1,
      lastFoot: null,
      flow: 0,
      maxFlow: false,
      totalScore: 0,
      bestCombo: 0,
      bounceCount: 0,
    };
  }

  /** Get current state (readonly copy). */
  getState(): Readonly<ComboState> {
    return this.state;
  }

  /**
   * Register a ball bounce.
   * Returns the score earned from this bounce.
   */
  registerBounce(foot: 'left' | 'right', quality: HitQuality): number {
    const s = this.state;
    s.bounceCount++;

    // Check alternation
    const alternated = s.lastFoot === null || s.lastFoot !== foot;
    s.lastFoot = foot;

    if (alternated && GAME.COMBO.ALTERNATION_REQUIRED) {
      // Build combo
      s.combo += quality === 'perfect' ? 1 + GAME.COMBO.PERFECT_BONUS : 1;
    } else if (GAME.COMBO.ALTERNATION_REQUIRED) {
      // Same foot twice — reset combo
      s.combo = 0;
    } else {
      s.combo++;
    }

    // Update best combo
    if (s.combo > s.bestCombo) {
      s.bestCombo = s.combo;
    }

    // Calculate multiplier
    s.multiplier = Math.min(
      GAME.COMBO.MAX_MULTIPLIER,
      1 + Math.floor(s.combo / 2) * GAME.COMBO.MULTIPLIER_STEP,
    );

    // Build flow
    const flowGain =
      quality === 'perfect'
        ? GAME.FLOW.GAIN_PERFECT
        : quality === 'good'
          ? GAME.FLOW.GAIN_GOOD
          : GAME.FLOW.GAIN_BAD;
    s.flow = Math.min(GAME.FLOW.MAX, s.flow + flowGain);

    // Check max flow activation
    if (s.flow >= GAME.FLOW.ACTIVATION_THRESHOLD && !s.maxFlow) {
      s.maxFlow = true;
    }

    // Calculate score for this bounce
    const basePoints =
      GAME.SCORE.BASE_POINTS +
      (quality === 'perfect'
        ? GAME.SCORE.PERFECT_BONUS
        : quality === 'good'
          ? GAME.SCORE.GOOD_BONUS
          : 0);

    const earnedScore = Math.round(basePoints * s.multiplier);
    s.totalScore += earnedScore;

    return earnedScore;
  }

  /** Called each frame to decay flow meter. */
  updateFlow(deltaSeconds: number): void {
    const s = this.state;
    if (s.maxFlow) return; // Don't decay during max flow

    s.flow = Math.max(0, s.flow - GAME.FLOW.DECAY_RATE * deltaSeconds);
  }

  /** Consume max flow state (after slow-mo activates). */
  consumeMaxFlow(): void {
    this.state.maxFlow = false;
    this.state.flow = 0;
  }

  /** Get the difficulty level based on total score. */
  getDifficultyLevel(): number {
    return Math.floor(this.state.totalScore / 100);
  }
}
