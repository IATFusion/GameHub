// ─── App ────────────────────────────────────────────────────────────────────
// Root React component — sci-fi arcade dashboard layout
// Layout: SpaceBackground → TopHUD → GameFrame → ControlPanel → NavStrip

import { useEffect } from 'react';
import { GameProvider, useGameContext } from './react/context/GameContext';
import { GameCanvas } from './react/components/GameCanvas';
import { TopHUD } from './react/components/TopHUD';
import { GameFrame } from './react/components/GameFrame';
import { ControlPanel } from './react/components/ControlPanel';
import { SpaceBackground } from './react/components/SpaceBackground';
import { MainMenu } from './react/components/MainMenu';
import { GameOverOverlay } from './react/components/GameOverOverlay';
import { GameSettingsOverlay } from './react/components/GameSettingsOverlay';
import { MobileControls } from './react/components/MobileControls';
import { Joystick } from './react/components/Joystick';
import { OrientationOverlay } from './react/components/OrientationOverlay';
import EventBridge, { GameEvents } from './game/systems/EventBridge';
import './styles/game.css';

function GameApp() {
  const { onGameInstance } = useGameContext();

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }
      if (e.key === 'Enter' || e.key === ' ') {
        EventBridge.getInstance().emit(GameEvents.UI_START_GAME);
      }
    };

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, []);

  return (
    <>
      {/* Deep space animated background */}
      <SpaceBackground />

      {/* Arcade dashboard wrapper */}
      <div className="arcade-dashboard">
        {/* Top HUD bar — Score / Title / Level */}
        <TopHUD />

        {/* Sci-fi frame enclosing the Phaser canvas */}
        <div className="arcade-dashboard__frame-row">
          <GameFrame>
            <GameCanvas onGameInstance={onGameInstance} />
          </GameFrame>
        </div>

        {/* Mobile joystick / trackpad (below game) */}
        <div className="arcade-dashboard__joystick-row">
          <Joystick />
        </div>

        {/* Control console & nav strip */}
        <ControlPanel />

        {/* Mobile swipe hint */}
        <MobileControls />

      </div>

      {/* Overlays */}
      <MainMenu />
      <GameOverOverlay />
      <GameSettingsOverlay />
      <OrientationOverlay />
    </>
  );
}

export default function App() {
  return (
    <GameProvider>
      <GameApp />
    </GameProvider>
  );
}
