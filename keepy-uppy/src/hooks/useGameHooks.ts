import { useEffect, useRef, useState, useCallback } from 'react';
import type { GameEventMap, GameState, HitQuality } from '../systems/EventBridge';
import { eventBridge } from '../systems/EventBridge';

/**
 * usePhaserEvent — Subscribe to a typed event from the Phaser ↔ React bridge.
 *
 * Automatically cleans up on unmount.
 * Uses useRef for the callback to avoid re-subscribing on every render.
 */
export function usePhaserEvent<K extends keyof GameEventMap>(
  event: K,
  callback: (data: GameEventMap[K]) => void,
): void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    const handler = (data: GameEventMap[K]) => callbackRef.current(data);
    const unsub = eventBridge.on(event, handler as Parameters<typeof eventBridge.on>[1]);
    return unsub;
  }, [event]);
}

/**
 * useGameScore — Reactive score state from the Phaser game.
 */
export function useGameScore() {
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [multiplier, setMultiplier] = useState(1);

  usePhaserEvent('score-changed', (data) => {
    setScore(data.score);
    setCombo(data.combo);
    setMultiplier(data.multiplier);
  });

  return { score, combo, multiplier };
}

/**
 * useGameState — Reactive game state.
 */
export function useGameState() {
  const [state, setState] = useState<GameState>('menu');

  usePhaserEvent('state-changed', (data) => {
    setState(data.state);
  });

  const restart = useCallback(() => {
    eventBridge.emit('game-restart');
  }, []);

  return { state, restart };
}

/**
 * useGameOver — Game over event data.
 */
export function useGameOver() {
  const [data, setData] = useState<{
    finalScore: number;
    bestCombo: number;
    reason: string;
  } | null>(null);

  usePhaserEvent('game-over', (d) => {
    setData(d);
  });

  usePhaserEvent('game-start', () => {
    setData(null);
  });

  return data;
}

/**
 * useBounceEffect — Fires callback on each bounce.
 * Useful for React-side visual effects.
 */
export function useBounceEffect() {
  const [lastBounce, setLastBounce] = useState<{
    quality: HitQuality;
    foot: 'left' | 'right';
    timestamp: number;
  } | null>(null);

  usePhaserEvent('bounce', (data) => {
    setLastBounce({
      quality: data.quality,
      foot: data.foot,
      timestamp: Date.now(),
    });
  });

  return lastBounce;
}

/**
 * useFlowState — Reactive flow meter.
 */
export function useFlowState() {
  const [flow, setFlow] = useState(0);
  const [maxFlow, setMaxFlow] = useState(false);

  usePhaserEvent('flow-changed', (data) => {
    setFlow(data.flow);
    setMaxFlow(data.maxFlow);
  });

  return { flow, maxFlow };
}
