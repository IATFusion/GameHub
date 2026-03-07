// ─── EventBridge ────────────────────────────────────────────────────────────
// Singleton event emitter for Phaser ↔ React communication

type EventCallback = (...args: unknown[]) => void;

class EventBridge {
  private static instance: EventBridge;
  private listeners = new Map<string, Set<EventCallback>>();

  static getInstance(): EventBridge {
    if (!EventBridge.instance) {
      EventBridge.instance = new EventBridge();
    }
    return EventBridge.instance;
  }

  on(event: string, callback: EventCallback): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    // Return unsubscribe function
    return () => this.off(event, callback);
  }

  off(event: string, callback: EventCallback): void {
    this.listeners.get(event)?.delete(callback);
  }

  emit(event: string, ...args: unknown[]): void {
    this.listeners.get(event)?.forEach((cb) => {
      try { cb(...args); } catch (e) { console.error(`EventBridge error [${event}]:`, e); }
    });
  }

  removeAllListeners(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}

// ─── Event Names ────────────────────────────────────────────────────────────

export const GameEvents = {
  // Game lifecycle
  GAME_READY:       'game:ready',
  GAME_START:       'game:start',
  GAME_OVER:        'game:over',
  GAME_RESTART:     'game:restart',
  GAME_PAUSE:       'game:pause',
  GAME_RESUME:      'game:resume',

  // Score & state
  SCORE_UPDATE:     'score:update',
  BEST_SCORE:       'score:best',
  TIME_UPDATE:      'time:update',
  PLAYER_LENGTH:    'player:length',
  CPU_LENGTH:       'cpu:length',

  // Gameplay events
  FOOD_EATEN:       'food:eaten',
  FOOD_SPAWNED:     'food:spawned',
  PLAYER_GROW:      'player:grow',
  CPU_DIED:         'cpu:died',
  CPU_RESPAWN:      'cpu:respawn',
  DIFFICULTY_UP:    'difficulty:up',

  // UI commands (React → Phaser)
  UI_START_GAME:    'ui:start',
  UI_RESTART_GAME:  'ui:restart',
  UI_TOGGLE_SOUND:  'ui:toggleSound',
  UI_SET_SOUND_ENABLED: 'ui:setSoundEnabled',
  UI_SET_DIRECTION: 'ui:direction',
  UI_PAUSE_GAME:    'ui:pause',
  UI_RESUME_GAME:   'ui:resume',
} as const;

export default EventBridge;
