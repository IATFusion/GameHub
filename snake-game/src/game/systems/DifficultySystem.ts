// ─── DifficultySystem ───────────────────────────────────────────────────────
// Scales game difficulty over time

import {
  CPU_BASE_MOVE_INTERVAL,
  CPU_MIN_MOVE_INTERVAL,
  CPU_SPEED_DECREASE_PER_TICK,
  DIFFICULTY_TICK_INTERVAL,
} from './GameConstants';
import EventBridge, { GameEvents } from './EventBridge';

export class DifficultySystem {
  private level = 1;
  private elapsed = 0;
  private cpuMoveInterval: number;
  private bridge: EventBridge;

  constructor() {
    this.cpuMoveInterval = CPU_BASE_MOVE_INTERVAL;
    this.bridge = EventBridge.getInstance();
  }

  update(delta: number): void {
    this.elapsed += delta;

    if (this.elapsed >= DIFFICULTY_TICK_INTERVAL) {
      this.elapsed -= DIFFICULTY_TICK_INTERVAL;
      this.level++;

      // Decrease CPU move interval (make it faster)
      this.cpuMoveInterval = Math.max(
        CPU_MIN_MOVE_INTERVAL,
        this.cpuMoveInterval - CPU_SPEED_DECREASE_PER_TICK
      );

      this.bridge.emit(GameEvents.DIFFICULTY_UP, this.level);
    }
  }

  getCpuMoveInterval(): number {
    return this.cpuMoveInterval;
  }

  getLevel(): number {
    return this.level;
  }

  reset(): void {
    this.level = 1;
    this.elapsed = 0;
    this.cpuMoveInterval = CPU_BASE_MOVE_INTERVAL;
  }
}
