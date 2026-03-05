/**
 * EngineAudio.ts
 *
 * Phaser-agnostic WebAudio engine sound module.
 *
 * Reference implementation: UndeadRonin99/engine-audio (MIT)
 * https://github.com/UndeadRonin99/engine-audio
 *
 * Usage:
 *   const ea = new EngineAudio();
 *
 *   // ① Call init() only after a user gesture (click / tap)
 *   await ea.init({ sounds: arcadeV8.sounds, masterVolume: 0.7 });
 *
 *   // ② Call update() every frame
 *   ea.update({ rpm: car.rpm, throttle: car.throttle });
 *
 *   // ③ Release resources when done
 *   ea.dispose();
 */

// ── Types ──────────────────────────────────────────────────────────────────

export type SoundKey = 'on_low' | 'off_low' | 'on_high' | 'off_high' | 'limiter';

export interface SoundSource {
  /** Relative path resolved against the page origin, e.g. "audio/BAC_Mono_onlow.wav" */
  source: string;
  /** RPM at which the sample was recorded – used for pitch-shifting via detune */
  rpm: number;
  /** Linear volume scale (default 1.0) */
  volume?: number;
}

export interface EngineAudioInitOptions {
  sounds: Partial<Record<SoundKey, SoundSource>>;
  /** Master output volume, 0..2 (default 1.0) */
  masterVolume?: number;
  /** Hard rev-limiter RPM (default 9 000) */
  limiterRpm?: number;
  /** Soft rev-limiter threshold (default limiterRpm × 0.98) */
  softLimiterRpm?: number;
}

export interface EngineAudioUpdateParams {
  rpm: number;
  /** 0 = fully off-throttle, 1 = full throttle */
  throttle: number;
  /** Not used yet; reserved for transmission sounds */
  gearRatio?: number;
  /** Cents-per-RPM pitch offset (default 0.2, matches upstream) */
  rpmPitchFactor?: number;
}

// ── Internal node record ───────────────────────────────────────────────────

interface SampleNode {
  gain: GainNode;
  audio: AudioBufferSourceNode;
  rpm: number;
  volume: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Equal-power cosine crossfade (matches AudioManager.crossFade upstream).
 *
 * @returns gain1 – "start" layer gain (high at start, 0 at end)
 *          gain2 – "end" layer gain  (0 at start, high at end)
 */
function crossFade(
  value: number,
  start: number,
  end: number,
): { gain1: number; gain2: number } {
  const x = clamp((value - start) / (end - start), 0, 1);
  const gain1 = Math.cos((1.0 - x) * 0.5 * Math.PI);
  const gain2 = Math.cos(x * 0.5 * Math.PI);
  return { gain1, gain2 };
}

// ── EngineAudio class ──────────────────────────────────────────────────────

export class EngineAudio {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private samples: Partial<Record<SoundKey, SampleNode>> = {};

  private limiterRpm = 9000;
  private softLimiterRpm = 8820; // limiterRpm * 0.98

  /** Guard: init() must only run once per instance */
  private started = false;

  // ── Public API ─────────────────────────────────────────────────────────

  /**
   * Initialise the AudioContext and start all sample loops.
   *
   * MUST be called from within a user-gesture event handler
   * (e.g. a click or touchstart callback) to satisfy browser
   * autoplay policies.
   */
  async init(opts: EngineAudioInitOptions): Promise<void> {
    if (this.started) return;
    this.started = true;

    const {
      sounds,
      masterVolume = 1.0,
      limiterRpm = 9000,
      softLimiterRpm,
    } = opts;

    this.limiterRpm = limiterRpm;
    this.softLimiterRpm = softLimiterRpm ?? limiterRpm * 0.98;

    // Create the AudioContext here (inside a user-gesture call stack).
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = clamp(masterVolume, 0, 2);
    this.masterGain.connect(this.ctx.destination);

    // Load all provided samples in parallel for faster startup.
    const loadPromises = (Object.keys(sounds) as SoundKey[]).map((key) => {
      const def = sounds[key];
      if (def) return this.addSample(key, def);
      return Promise.resolve();
    });

    await Promise.all(loadPromises);

    // Un-suspend the context if the browser suspended it during setup.
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  /**
   * Drive the mixing engine.  Call every frame (e.g. from Phaser's update()).
   * Safe to call before init() completes – no-ops until ready.
   */
  update(params: EngineAudioUpdateParams): void {
    if (!this.ctx || !this.masterGain) return;

    const {
      rpm,
      throttle: rawThrottle,
      rpmPitchFactor = 0.2,
    } = params;

    const throttle = clamp(rawThrottle, 0, 1);

    // ── Crossfades (match upstream Engine.applySounds) ─────────────────
    // low/high blend by RPM band 3 000 → 6 500
    const { gain1: high, gain2: low } = crossFade(rpm, 3000, 6500);
    // on/off blend by throttle 0 → 1
    const { gain1: on, gain2: off } = crossFade(throttle, 0, 1);

    // Limiter layer (ratio of rpm above soft-limiter knee / limiter delta)
    const limiterGain = clamp(
      (rpm - this.softLimiterRpm * 0.93) /
        (this.limiterRpm - this.softLimiterRpm * 0.93),
      0,
      1,
    );

    // ── Per-sample application ─────────────────────────────────────────
    const applySample = (
      key: SoundKey,
      layerGain: number,
      applyPitch = true,
    ): void => {
      const s = this.samples[key];
      if (!s) return;

      if (applyPitch) {
        // Detune in cents: positive = pitch up, negative = pitch down
        s.audio.detune.value = (rpm - s.rpm) * rpmPitchFactor;
      }

      s.gain.gain.value = layerGain * s.volume;
    };

    applySample('on_low',  on  * low);
    applySample('off_low', off * low);
    applySample('on_high', on  * high);
    applySample('off_high', off * high);
    applySample('limiter', limiterGain, false); // no pitch on limiter layer
  }

  /** Adjust master output volume (clamped 0..2). */
  setMasterVolume(v: number): void {
    if (!this.masterGain) return;
    this.masterGain.gain.value = clamp(v, 0, 2);
  }

  /**
   * Stop all audio and release the AudioContext.
   * Safe to call multiple times.
   */
  dispose(): void {
    for (const key of Object.keys(this.samples) as SoundKey[]) {
      const s = this.samples[key];
      if (s) {
        try { s.audio.stop(); } catch { /* already stopped */ }
      }
    }
    this.samples = {};

    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }

    this.masterGain = null;
    this.started = false;
  }

  // ── Private helpers ────────────────────────────────────────────────────

  private async addSample(key: SoundKey, def: SoundSource): Promise<void> {
    if (!this.ctx || !this.masterGain) return;

    try {
      const arrayBuffer = await fetch(def.source).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status} fetching ${def.source}`);
        return r.arrayBuffer();
      });

      const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);

      const sourceNode = this.ctx.createBufferSource();
      sourceNode.buffer = audioBuffer;
      sourceNode.loop = true;

      const gainNode = this.ctx.createGain();
      gainNode.gain.value = 0; // start silent; update() will mix it in

      sourceNode
        .connect(gainNode)
        .connect(this.masterGain);

      sourceNode.start();

      this.samples[key] = {
        gain: gainNode,
        audio: sourceNode,
        rpm: def.rpm,
        volume: def.volume ?? 1.0,
      };
    } catch (err) {
      console.warn(`[EngineAudio] Failed to load sample "${key}" (${def.source}):`, err);
      // Gracefully degrade: other samples continue to play.
    }
  }
}
