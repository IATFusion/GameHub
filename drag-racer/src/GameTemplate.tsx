import Phaser from 'phaser'
import { useEffect, useRef } from 'react'

import { createGameConfig } from './phaser/config'

/**
 * React + Phaser 3 mount component
 *
 * For new games:
 * - Keep this component identical
 * - Only duplicate/modify `src/phaser/scenes/GameScene.ts`
 *
 * Suggested structure:
 * src/
 *   phaser/
 *     scenes/
 *       BootScene.ts
 *       PreloadScene.ts
 *       GameScene.ts
 *       UIScene.ts
 *     config.ts
 *   GameTemplate.tsx
 */
export function GameTemplate() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const gameRef = useRef<Phaser.Game | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    if (gameRef.current) return

    // Mount Phaser
    const game = new Phaser.Game(createGameConfig(container))
    gameRef.current = game

    // Mobile responsive: Resize canvas to match container.
    const resize = (): void => {
      const width = Math.max(1, Math.floor(container.clientWidth))
      const height = Math.max(1, Math.floor(container.clientHeight))
      game.scale.resize(width, height)
    }

    resize()
    const observer = new ResizeObserver(() => resize())
    observer.observe(container)
    resizeObserverRef.current = observer

    return () => {
      // Unmount Phaser cleanly.
      resizeObserverRef.current?.disconnect()
      resizeObserverRef.current = null

      gameRef.current?.destroy(true)
      gameRef.current = null

      // Defensive: ensure container is clean (Phaser usually handles this).
      container.innerHTML = ''
    }
  }, [])

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
      }}
    />
  )
}
