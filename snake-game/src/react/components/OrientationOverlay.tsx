import { useEffect, useMemo, useState } from 'react';
import '../../styles/overlay.css';

function getMatches(query: string): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia(query).matches;
}

export function OrientationOverlay() {
  const [isPortrait, setIsPortrait] = useState(() => getMatches('(orientation: portrait)'));
  const isMobile = useMemo(() => {
    const coarse = getMatches('(pointer: coarse)');
    const small = getMatches('(max-width: 900px)');
    return coarse && small;
  }, []);

  useEffect(() => {
    const update = () => setIsPortrait(getMatches('(orientation: portrait)'));

    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);

    // Best-effort attempt; most browsers require fullscreen/PWA to succeed.
    // We still show the overlay as the enforcement mechanism.
    const maybeLock = async () => {
      try {
        // @ts-expect-error: Screen Orientation API is not fully typed across TS libs
        await window.screen?.orientation?.lock?.('landscape');
      } catch {
        // ignore
      }
    };

    if (isMobile) {
      void maybeLock();
    }

    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, [isMobile]);

  if (!isMobile || !isPortrait) return null;

  return (
    <div className="orientation-overlay" role="alert" aria-live="assertive">
      <div className="orientation-overlay__card">
        <div className="orientation-overlay__title">ROTATE DEVICE</div>
        <div className="orientation-overlay__subtitle">
          This game is landscape-only on mobile.
        </div>
      </div>
    </div>
  );
}
