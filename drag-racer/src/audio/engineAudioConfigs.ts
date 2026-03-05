/**
 * engineAudioConfigs.ts
 *
 * Pre-built audio configurations for EngineAudio.
 *
 * Audio files originate from UndeadRonin99/engine-audio (MIT licence).
 * They are copied into public/audio by the "copy:engine-audio" npm script
 * and served at /audio/... by Vite in both dev and production.
 */

import type { SoundSource, SoundKey } from './EngineAudio';

export interface EngineAudioConfig {
  sounds: Partial<Record<SoundKey, SoundSource>>;
  limiterRpm: number;
  softLimiterRpm: number;
}

// ── BAC Mono – high-revving naturally-aspirated sports car ────────────────
// https://www.motormatchup.com/catalog/BAC/Mono/2020/Base
// Limiter: 9 000 RPM  (matches upstream bac_mono config)
export const bacMono: EngineAudioConfig = {
  sounds: {
    on_high: {
      source: 'audio/BAC_Mono_onhigh.wav',
      rpm:    1000,
      volume: 0.5,
    },
    on_low: {
      source: 'audio/BAC_Mono_onlow.wav',
      rpm:    1000,
      volume: 0.5,
    },
    off_high: {
      source: 'audio/BAC_Mono_offveryhigh.wav',
      rpm:    1000,
      volume: 0.5,
    },
    off_low: {
      source: 'audio/BAC_Mono_offlow.wav',
      rpm:    1000,
      volume: 0.5,
    },
    limiter: {
      source: 'audio/limiter.wav',
      rpm:    8000,
      volume: 0.4,
    },
  },
  limiterRpm:     9000,
  softLimiterRpm: 8950,
};

// ── Arcade V8 alias – same samples, slightly louder for game context ───────
export const arcadeV8: EngineAudioConfig = {
  sounds: {
    on_low: {
      source: 'audio/BAC_Mono_onlow.wav',
      rpm:    3000,
      volume: 1.0,
    },
    on_high: {
      source: 'audio/BAC_Mono_onhigh.wav',
      rpm:    6500,
      volume: 1.0,
    },
    off_low: {
      source: 'audio/BAC_Mono_offlow.wav',
      rpm:    3000,
      volume: 1.0,
    },
    off_high: {
      source: 'audio/BAC_Mono_offveryhigh.wav',
      rpm:    6500,
      volume: 1.0,
    },
    limiter: {
      source: 'audio/limiter.wav',
      rpm:    0,
      volume: 1.0,
    },
  },
  // 9 000 RPM redline; soft limiter at 8 800 RPM
  limiterRpm:     9000,
  softLimiterRpm: 8800,
};
