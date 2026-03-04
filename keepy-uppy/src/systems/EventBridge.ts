/**
 * EventBridge — Typed event emitter bridging Phaser ↔ React.
 *
 * This is a lightweight pub/sub bus so React components can subscribe
 * to gameplay events without holding a reference to the Phaser Game instance.
 *
 * Architecture:
 * - Phaser scenes emit events INTO the bridge.
 * - React hooks subscribe to the bridge via usePhaserEvent().
 * - Bridge is a singleton; created once, lives for app lifetime.
 */

export type GameEventMap = {
  // Legacy from keepy-uppy mode (unused in the new duel mode)
  'score-changed': { score: number; combo: number; multiplier: number };
  // Duel mode score
  'match-score-changed': { left: number; right: number };
  'combo-changed': { combo: number; multiplier: number; hitQuality: HitQuality };
  'flow-changed': { flow: number; maxFlow: boolean };
  'game-over': { finalScore: number; bestCombo: number; reason: string };
  'game-start': undefined;
  'game-restart': undefined;
  'game-ready': undefined;
  'bounce': { quality: HitQuality; foot: 'left' | 'right'; x: number; y: number };
  'goal': { scorer: 'left' | 'right'; left: number; right: number };
  'difficulty-changed': { level: number };
  'state-changed': { state: GameState };
};

export type HitQuality = 'perfect' | 'good' | 'bad';
export type GameState = 'menu' | 'playing' | 'gameover' | 'paused';

type Listener<T> = (data: T) => void;

class EventBridge {
  private listeners = new Map<string, Set<Listener<unknown>>>();

  /** Subscribe to a typed event. Returns an unsubscribe function. */
  on<K extends keyof GameEventMap>(
    event: K,
    listener: Listener<GameEventMap[K]>,
  ): () => void {
    const key = event as string;
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    const set = this.listeners.get(key)!;
    const wrapped = listener as Listener<unknown>;
    set.add(wrapped);

    return () => {
      set.delete(wrapped);
      if (set.size === 0) this.listeners.delete(key);
    };
  }

  /** Emit a typed event to all subscribers. */
  emit<K extends keyof GameEventMap>(
    event: K,
    ...args: GameEventMap[K] extends undefined ? [] : [GameEventMap[K]]
  ): void {
    const key = event as string;
    const set = this.listeners.get(key);
    if (!set) return;
    const data = args[0] as unknown;
    for (const listener of set) {
      try {
        listener(data);
      } catch (err) {
        console.error(`[EventBridge] Error in listener for "${key}":`, err);
      }
    }
  }

  /** Remove all listeners (cleanup). */
  clear(): void {
    this.listeners.clear();
  }
}

/** Singleton event bridge instance. */
export const eventBridge = new EventBridge();
