// ─── useGameState Hook ──────────────────────────────────────────────────────
// Subscribes to EventBridge events and provides reactive game state to React

import { useState, useEffect, useCallback } from 'react';
import EventBridge, { GameEvents } from '../../game/systems/EventBridge';

export interface GameOverData {
  score: number;
  length: number;
  time: number;
  bestScore: number;
}

export interface GameState {
  gameActive: boolean;
  gameOver: boolean;
  paused: boolean;
  gameOverData: GameOverData | null;
  score: number;
  bestScore: number;
  timeSurvived: number;
  playerLength: number;
  cpuLength: number;
}

export function useGameState(): GameState {
  const [gameActive, setGameActive] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [gameOverData, setGameOverData] = useState<GameOverData | null>(null);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [timeSurvived, setTimeSurvived] = useState(0);
  const [playerLength, setPlayerLength] = useState(4);
  const [cpuLength, setCpuLength] = useState(4);

  useEffect(() => {
    const bridge = EventBridge.getInstance();

    const unsubs: (() => void)[] = [];

    unsubs.push(bridge.on(GameEvents.GAME_START, () => {
      setGameActive(true);
      setGameOver(false);
      setPaused(false);
      setGameOverData(null);
      setScore(0);
      setTimeSurvived(0);
      setPlayerLength(4);
      setCpuLength(4);
    }));

    unsubs.push(bridge.on(GameEvents.GAME_OVER, (data) => {
      setGameActive(false);
      setGameOver(true);
      setPaused(false);
      setGameOverData(data as GameOverData);
    }));

    unsubs.push(bridge.on(GameEvents.GAME_RESTART, () => {
      setGameOver(false);
      setPaused(false);
      setGameOverData(null);
    }));

    unsubs.push(bridge.on(GameEvents.GAME_PAUSE, () => {
      setPaused(true);
    }));

    unsubs.push(bridge.on(GameEvents.GAME_RESUME, () => {
      setPaused(false);
    }));

    unsubs.push(bridge.on(GameEvents.SCORE_UPDATE, (s) => {
      setScore(s as number);
    }));

    unsubs.push(bridge.on(GameEvents.BEST_SCORE, (s) => {
      setBestScore(s as number);
    }));

    unsubs.push(bridge.on(GameEvents.TIME_UPDATE, (t) => {
      setTimeSurvived(t as number);
    }));

    unsubs.push(bridge.on(GameEvents.PLAYER_LENGTH, (l) => {
      setPlayerLength(l as number);
    }));

    unsubs.push(bridge.on(GameEvents.CPU_LENGTH, (l) => {
      setCpuLength(l as number);
    }));

    return () => {
      unsubs.forEach(unsub => unsub());
    };
  }, []);

  return {
    gameActive,
    gameOver,
    paused,
    gameOverData,
    score,
    bestScore,
    timeSurvived,
    playerLength,
    cpuLength,
  };
}
