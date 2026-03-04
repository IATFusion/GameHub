/**
 * AudioSystem — Procedural audio generation for game sounds.
 *
 * Uses Web Audio API to generate all sounds procedurally:
 * - No external audio files needed
 * - Pitch-scaled bounce sounds based on combo
 * - Hit quality affects timbre
 * - Ambient pad that evolves with gameplay
 *
 * Performance:
 * - AudioContext created lazily (user gesture required)
 * - Oscillators created per-sound and auto-cleaned
 * - No memory leaks: nodes disconnect after use
 */

import type { HitQuality } from './EventBridge';
import { GAME } from './GameConstants';

export class AudioSystem {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private ambientOsc: OscillatorNode | null = null;
  private ambientLfo: OscillatorNode | null = null;
  private muted = false;

  /** Lazily initialize AudioContext (must be called from user gesture). */
  init(): void {
    if (this.ctx) return;

    try {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.3;
      this.masterGain.connect(this.ctx.destination);

      this.startAmbient();
    } catch {
      console.warn('[AudioSystem] Web Audio API not available');
    }
  }

  /** Resume context if suspended (mobile browser policy). */
  resume(): void {
    if (this.ctx?.state === 'suspended') {
      this.ctx.resume();
    }
  }

  /** Play a bounce sound with quality and combo-based variation. */
  playBounce(quality: HitQuality, combo: number): void {
    if (!this.ctx || !this.masterGain || this.muted) return;

    const now = this.ctx.currentTime;

    // Base frequency varies by quality
    const baseFreq = quality === 'perfect' ? 880 : quality === 'good' ? 660 : 440;

    // Combo raises pitch (capped)
    const comboPitch = Math.min(
      GAME.AUDIO.MAX_PITCH,
      1.0 + combo * GAME.AUDIO.COMBO_PITCH_STEP,
    );
    const freq = baseFreq * comboPitch;

    // Create a short percussive tone
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = quality === 'perfect' ? 'sine' : quality === 'good' ? 'triangle' : 'square';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.5, now + 0.15);

    // Volume envelope
    const vol = quality === 'perfect' ? 0.25 : quality === 'good' ? 0.18 : 0.12;
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.25);

    // Perfect hit gets a harmonics layer
    if (quality === 'perfect') {
      this.playPerfectChime(now, freq, comboPitch);
    }

    // Auto-cleanup
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }

  /** Shimmering chime overlay for perfect hits. */
  private playPerfectChime(now: number, baseFreq: number, _comboPitch: number): void {
    if (!this.ctx || !this.masterGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq * 2, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 3, now + 0.3);

    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.45);

    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }

  /** Play game over sound — descending tone. */
  playGameOver(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.8);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.linearRampToValueAtTime(0, now + 1.0);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 1.1);

    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }

  /** Evolving ambient pad — creates atmosphere. */
  private startAmbient(): void {
    if (!this.ctx || !this.masterGain) return;

    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.value = 0.03;
    this.ambientGain.connect(this.masterGain);

    // Low drone
    this.ambientOsc = this.ctx.createOscillator();
    this.ambientOsc.type = 'sine';
    this.ambientOsc.frequency.value = 55; // A1
    this.ambientOsc.connect(this.ambientGain);
    this.ambientOsc.start();

    // LFO for subtle movement
    this.ambientLfo = this.ctx.createOscillator();
    this.ambientLfo.type = 'sine';
    this.ambientLfo.frequency.value = 0.1;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 5;
    this.ambientLfo.connect(lfoGain);
    lfoGain.connect(this.ambientOsc.frequency);
    this.ambientLfo.start();
  }

  /** Evolve ambient based on game intensity. */
  setIntensity(intensity: number): void {
    if (!this.ambientGain) return;
    // Intensity 0-1 maps ambient volume
    const vol = 0.02 + intensity * 0.04;
    this.ambientGain.gain.setTargetAtTime(vol, this.ctx!.currentTime, 0.5);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(
        muted ? 0 : 0.3,
        this.ctx!.currentTime,
        0.05,
      );
    }
  }

  toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  destroy(): void {
    this.ambientOsc?.stop();
    this.ambientLfo?.stop();
    this.ctx?.close();
    this.ctx = null;
  }
}

/** Singleton audio system. */
export const audioSystem = new AudioSystem();
