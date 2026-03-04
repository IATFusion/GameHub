import './App.css';
import { GameTemplate } from './GameTemplate';

/**
 * App — Root React component for KEEPY UPPY.
 *
 * Architecture:
 * - GameTemplate mounts the Phaser canvas
 * - React overlay for future menus/settings sits on top
 * - Game state managed via EventBridge + hooks (not lifted into React)
 */
export default function App() {
  return (
    <div className="appRoot">
      <GameTemplate />
    </div>
  );
}
