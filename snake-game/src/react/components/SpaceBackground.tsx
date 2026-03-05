// ─── SpaceBackground ────────────────────────────────────────────────────────
// Animated deep space scene with stars, nebula clouds, and planets

import { useMemo } from 'react';
import '../../styles/space-background.css';

interface Star {
  x: number;
  y: number;
  size: number;
  minOpacity: number;
  maxOpacity: number;
  duration: number;
  delay: number;
  color: string;
}

function generateStars(count: number): Star[] {
  const colors = ['#ffffff', '#d0e8ff', '#a0d0ff', '#2ef2c3', '#29e0ff', '#b34dff'];
  const stars: Star[] = [];
  for (let i = 0; i < count; i++) {
    const isColored = Math.random() < 0.12;
    stars.push({
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 0.5 + Math.random() * (isColored ? 2.5 : 1.5),
      minOpacity: 0.08 + Math.random() * 0.15,
      maxOpacity: 0.3 + Math.random() * 0.5,
      duration: 2 + Math.random() * 5,
      delay: Math.random() * 6,
      color: isColored ? colors[Math.floor(Math.random() * colors.length)] : '#ffffff',
    });
  }
  return stars;
}

export function SpaceBackground() {
  const stars = useMemo(() => generateStars(120), []);

  return (
    <div className="space-bg" aria-hidden="true">
      {/* Nebula clouds */}
      <div className="space-bg__nebula space-bg__nebula--1" />
      <div className="space-bg__nebula space-bg__nebula--2" />
      <div className="space-bg__nebula space-bg__nebula--3" />
      <div className="space-bg__nebula space-bg__nebula--4" />

      {/* Star field */}
      <div className="space-bg__stars">
        {stars.map((star, i) => (
          <div
            key={i}
            className="space-bg__star"
            style={{
              left: `${star.x}%`,
              top: `${star.y}%`,
              width: `${star.size}px`,
              height: `${star.size}px`,
              background: star.color,
              '--twinkle-dur': `${star.duration}s`,
              '--twinkle-delay': `${star.delay}s`,
              '--star-min': star.minOpacity,
              '--star-max': star.maxOpacity,
            } as React.CSSProperties}
          />
        ))}
      </div>

      {/* Planets */}
      <div className="space-bg__planet space-bg__planet--1">
        <div className="planet-ring" />
      </div>
      <div className="space-bg__planet space-bg__planet--2" />
    </div>
  );
}
