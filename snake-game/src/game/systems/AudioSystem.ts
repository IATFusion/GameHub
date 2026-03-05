// ─── AudioSystem ────────────────────────────────────────────────────────────
// Procedural audio using Web Audio API — no external audio files needed

export class AudioSystem {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private enabled = true;
  private basePitch = 1.0;

  constructor() {
    this.initContext();
  }

  private initContext(): void {
    try {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.3;
      this.masterGain.connect(this.ctx.destination);
    } catch {
      console.warn('Web Audio API not available');
    }
  }

  private ensureRunning(): void {
    if (this.ctx?.state === 'suspended') {
      this.ctx.resume();
    }
  }

  /** Set pitch multiplier based on snake length */
  setPitchScale(snakeLength: number): void {
    this.basePitch = 1.0 + (snakeLength - 4) * 0.008;
  }

  toggle(): void {
    this.enabled = !this.enabled;
    if (this.masterGain) {
      this.masterGain.gain.value = this.enabled ? 0.3 : 0;
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  // ── Sound Effects ────────────────────────────────────────────────────

  playEat(): void {
    this.ensureRunning();
    if (!this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(440 * this.basePitch, now);
    osc.frequency.exponentialRampToValueAtTime(880 * this.basePitch, now + 0.08);
    osc.frequency.exponentialRampToValueAtTime(1320 * this.basePitch, now + 0.12);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  playBonusEat(): void {
    this.ensureRunning();
    if (!this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;

    // Two-tone chime
    for (let i = 0; i < 2; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const offset = i * 0.08;

      osc.type = 'sine';
      osc.frequency.setValueAtTime((660 + i * 220) * this.basePitch, now + offset);
      osc.frequency.exponentialRampToValueAtTime((880 + i * 330) * this.basePitch, now + offset + 0.1);

      gain.gain.setValueAtTime(0.35, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.01, now + offset + 0.2);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(now + offset);
      osc.stop(now + offset + 0.25);
    }
  }

  playSuperEat(): void {
    this.ensureRunning();
    if (!this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;

    // Rising arpeggio
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const offset = i * 0.06;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq * this.basePitch, now + offset);

      gain.gain.setValueAtTime(0.3, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.01, now + offset + 0.2);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(now + offset);
      osc.stop(now + offset + 0.25);
    });
  }

  playDeath(): void {
    this.ensureRunning();
    if (!this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;

    // Descending buzz
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.6);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.7);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.8);

    // Sub hit
    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(80, now);
    sub.frequency.exponentialRampToValueAtTime(30, now + 0.4);
    subGain.gain.setValueAtTime(0.5, now);
    subGain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
    sub.connect(subGain);
    subGain.connect(this.masterGain);
    sub.start(now);
    sub.stop(now + 0.6);
  }

  playCpuDeath(): void {
    this.ensureRunning();
    if (!this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.3);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.4);
  }

  playMove(): void {
    this.ensureRunning();
    if (!this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(120 * this.basePitch, now);

    gain.gain.setValueAtTime(0.03, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.05);
  }

  playStartGame(): void {
    this.ensureRunning();
    if (!this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;
    const notes = [262, 330, 392, 523];

    notes.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const offset = i * 0.1;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + offset);

      gain.gain.setValueAtTime(0.25, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.01, now + offset + 0.15);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(now + offset);
      osc.stop(now + offset + 0.2);
    });
  }

  destroy(): void {
    this.ctx?.close();
    this.ctx = null;
    this.masterGain = null;
  }
}
