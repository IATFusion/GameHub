// ─── Joystick ──────────────────────────────────────────────────────────────
// Mobile on-screen joystick / trackpad for 4-way movement

import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import EventBridge, { GameEvents } from '../../game/systems/EventBridge';
import { Direction } from '../../game/systems/GameConstants';
import { useGameState } from '../hooks/useGameState';
import '../../styles/joystick.css';

type Point = { x: number; y: number };

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function directionFromVector(dx: number, dy: number): Direction {
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx >= 0 ? Direction.RIGHT : Direction.LEFT;
  }
  return dy >= 0 ? Direction.DOWN : Direction.UP;
}

export function Joystick() {
  const { gameActive } = useGameState();
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [active, setActive] = useState(false);

  const baseRef = useRef<HTMLDivElement>(null);
  const pointerIdRef = useRef<number | null>(null);
  const centerRef = useRef<Point>({ x: 0, y: 0 });
  const [thumb, setThumb] = useState<Point>({ x: 0, y: 0 });
  const lastDirRef = useRef<Direction | null>(null);

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

  if (!isTouchDevice || !gameActive) return null;

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!baseRef.current) return;

    const rect = baseRef.current.getBoundingClientRect();
    centerRef.current = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };

    pointerIdRef.current = e.pointerId;
    baseRef.current.setPointerCapture(e.pointerId);
    setActive(true);
    setThumb({ x: 0, y: 0 });
    lastDirRef.current = null;
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!active) return;
    if (pointerIdRef.current !== e.pointerId) return;

    const radius = 44;
    const deadzone = 12;

    const dx = e.clientX - centerRef.current.x;
    const dy = e.clientY - centerRef.current.y;

    const dist = Math.hypot(dx, dy);
    const unitX = dist === 0 ? 0 : dx / dist;
    const unitY = dist === 0 ? 0 : dy / dist;

    const clampedDist = clamp(dist, 0, radius);
    setThumb({ x: unitX * clampedDist, y: unitY * clampedDist });

    if (dist < deadzone) return;

    const dir = directionFromVector(dx, dy);
    if (dir !== lastDirRef.current) {
      lastDirRef.current = dir;
      bridge.emit(GameEvents.UI_SET_DIRECTION, dir);
    }
  };

  const handlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== e.pointerId) return;

    pointerIdRef.current = null;
    setActive(false);
    setThumb({ x: 0, y: 0 });
    lastDirRef.current = null;

    try {
      baseRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  return (
    <div className="joystick" aria-label="Joystick">
      <div
        ref={baseRef}
        className={`joystick__base ${active ? 'is-active' : ''}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div
          className="joystick__thumb"
          style={{
            transform: `translate(${thumb.x}px, ${thumb.y}px)`,
          }}
        />
      </div>
      <div className="joystick__label">DRAG</div>
    </div>
  );
}
