// ─── Joystick ──────────────────────────────────────────────────────────────
// Mobile on-screen touch pad for 4-way movement

import { useEffect, useMemo, useState } from 'react';
import EventBridge, { GameEvents } from '../../game/systems/EventBridge';
import { Direction } from '../../game/systems/GameConstants';
import { useGameContext } from '../context/GameContext';
import { useGameState } from '../hooks/useGameState';
import '../../styles/joystick.css';

const DIRECTION_LABELS: Record<Direction, string> = {
  [Direction.UP]: 'Up',
  [Direction.RIGHT]: 'Right',
  [Direction.DOWN]: 'Down',
  [Direction.LEFT]: 'Left',
};

const DIRECTION_SYMBOLS: Record<Direction, string> = {
  [Direction.UP]: '▲',
  [Direction.RIGHT]: '▶',
  [Direction.DOWN]: '▼',
  [Direction.LEFT]: '◀',
};

export function Joystick() {
  const { gameActive } = useGameState();
  const { showJoystick } = useGameContext();
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    const coarse = window.matchMedia?.('(pointer: coarse)');
    const small = window.matchMedia?.('(max-width: 900px)');

    const compute = () => {
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const coarsePointer = coarse?.matches ?? false;
      const smallViewport = small?.matches ?? false;
      setIsTouchDevice(hasTouch || coarsePointer || smallViewport);
    };

    compute();

    const handleChange = () => compute();
    coarse?.addEventListener?.('change', handleChange);
    small?.addEventListener?.('change', handleChange);
    window.addEventListener('resize', handleChange);

    return () => {
      coarse?.removeEventListener?.('change', handleChange);
      small?.removeEventListener?.('change', handleChange);
      window.removeEventListener('resize', handleChange);
    };
  }, []);

  const bridge = useMemo(() => EventBridge.getInstance(), []);

  if (!isTouchDevice || !gameActive || !showJoystick) return null;

  const handleDirectionPress = (direction: Direction) => {
    bridge.emit(GameEvents.UI_SET_DIRECTION, direction);
  };

  return (
    <div className="joystick" aria-label="Touch pad">
      <div className="joystick__base" role="group" aria-label="Directional touch pad">
        <button
          type="button"
          className="joystick__button joystick__button--up"
          aria-label={DIRECTION_LABELS[Direction.UP]}
          onPointerDown={() => handleDirectionPress(Direction.UP)}
        >
          {DIRECTION_SYMBOLS[Direction.UP]}
        </button>
        <button
          type="button"
          className="joystick__button joystick__button--left"
          aria-label={DIRECTION_LABELS[Direction.LEFT]}
          onPointerDown={() => handleDirectionPress(Direction.LEFT)}
        >
          {DIRECTION_SYMBOLS[Direction.LEFT]}
        </button>
        <div className="joystick__core" aria-hidden="true">
          TAP
        </div>
        <button
          type="button"
          className="joystick__button joystick__button--right"
          aria-label={DIRECTION_LABELS[Direction.RIGHT]}
          onPointerDown={() => handleDirectionPress(Direction.RIGHT)}
        >
          {DIRECTION_SYMBOLS[Direction.RIGHT]}
        </button>
        <button
          type="button"
          className="joystick__button joystick__button--down"
          aria-label={DIRECTION_LABELS[Direction.DOWN]}
          onPointerDown={() => handleDirectionPress(Direction.DOWN)}
        >
          {DIRECTION_SYMBOLS[Direction.DOWN]}
        </button>
      </div>
      <div className="joystick__label">TOUCH PAD</div>
    </div>
  );
}
