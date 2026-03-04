import Phaser from 'phaser';
import { useEffect, useRef, useCallback } from 'react';
import { createGameConfig } from './phaser/config';
import { eventBridge } from './systems/EventBridge';

/**
 * GameTemplate — React ↔ Phaser mount component.
 *
 * Architecture:
 * - Mounts Phaser game into a div ref
 * - ResizeObserver keeps canvas matched to container
 * - Clean unmount destroys Phaser and clears event bridge
 * - Handles game restart via event bridge
 *
 * Performance:
 * - No re-renders from Phaser events (all handled in hooks)
 * - ResizeObserver is the only bridge between React layout and Phaser
 */
export function GameTemplate() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (gameRef.current) return;

    // Mount Phaser
    const game = new Phaser.Game(createGameConfig(container));
    gameRef.current = game;

    // Resize canvas to match container
    const resize = (): void => {
      const width = Math.max(1, Math.floor(container.clientWidth));
      const height = Math.max(1, Math.floor(container.clientHeight));
      game.scale.resize(width, height);
    };

    resize();
    const observer = new ResizeObserver(() => resize());
    observer.observe(container);
    resizeObserverRef.current = observer;

    return () => {
      // Clean unmount
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;

      gameRef.current?.destroy(true);
      gameRef.current = null;

      // Clear all event bridge listeners
      eventBridge.clear();

      // Clean container
      container.innerHTML = '';
    };
  }, []);

  // Handle click/tap on game over to restart
  const handleClick = useCallback(() => {
    // This allows React overlay clicks to pass through to Phaser input
  }, []);

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    />
  );
}
