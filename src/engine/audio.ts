import type { EmotionId } from '../game/content/emotions';

/**
 * All sound is synthesized with WebAudio, so there are no audio files to license.
 * Each emotion has a distinct timbre for its voice, select sting, footsteps and ability.
 */
type Wave = OscillatorType;

interface ToneOpts {
  freq: number;
  to?: number;
  type?: Wave;
  dur?: number;
  vol?: number;
  attack?: number;
  delay?: number;
  vibrato?: number;
  vibratoRate?: number;
  filter?: number;
  q?: number;
  filterType?: BiquadFilterType;
  dest?: AudioNode;
  curve?: 'exp' | 'lin';
}

const NOTE = (semi: number, base = 440) => base * Math.pow(2, semi / 12);

export class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private musicBus!: GainNode;
  private shaper!: WaveShaperNode;
  private padOsc: OscillatorNode[] = [];
  private padFilter!: BiquadFilterNode;
  private padGain!: GainNode;
  private lfo!: OscillatorNode;
  private noiseBuf!: AudioBuffer;
  private muted = false;
  private lastVoice = 0;

  /** Must be called from a user gesture. Safe to call repeatedly. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);
    this.sfx = ctx.createGain();
    this.sfx.gain.value = 0.9;
    this.sfx.connect(this.master);
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = 0.0;
    this.musicBus.connect(this.master);

    this.shaper = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) {
      const x = (i / 1023) * 2 - 1;
      curve[i] = Math.tanh(x * 4);
    }
    this.shaper.curve = curve;
    this.shaper.connect(this.sfx);

    const len = ctx.sampleRate * 1.5;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    this.startPad();
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.05);
  }

  private get now() {
    return this.ctx!.currentTime;
  }

  tone(o: ToneOpts) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t0 = this.now + (o.delay ?? 0);
    const dur = o.dur ?? 0.2;
    const osc = ctx.createOscillator();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(o.freq, t0);
    if (o.to) {
      if (o.curve === 'lin') osc.frequency.linearRampToValueAtTime(o.to, t0 + dur);
      else osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t0 + dur);
    }
    const g = ctx.createGain();
    const vol = o.vol ?? 0.2;
    const atk = o.attack ?? 0.01;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node: AudioNode = osc;
    if (o.vibrato) {
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      lfo.frequency.value = o.vibratoRate ?? 6;
      lg.gain.value = o.vibrato;
      lfo.connect(lg).connect(osc.frequency);
      lfo.start(t0);
      lfo.stop(t0 + dur + 0.05);
    }
    if (o.filter) {
      const f = ctx.createBiquadFilter();
      f.type = o.filterType ?? 'lowpass';
      f.frequency.value = o.filter;
      f.Q.value = o.q ?? 1;
      node.connect(f);
      node = f;
    }
    node.connect(g).connect(o.dest ?? this.sfx);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  private noise(o: { dur?: number; vol?: number; filter?: number; to?: number; q?: number; delay?: number; type?: BiquadFilterType }) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t0 = this.now + (o.delay ?? 0);
    const dur = o.dur ?? 0.2;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = o.type ?? 'bandpass';
    f.frequency.setValueAtTime(o.filter ?? 1200, t0);
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t0 + dur);
    f.Q.value = o.q ?? 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(o.vol ?? 0.2, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(this.sfx);
    src.start(t0, Math.random() * 0.5);
    src.stop(t0 + dur + 0.05);
  }

  // ───────────────────────── emotion signatures ─────────────────────────

  /** Played when an emotion is selected: a short sting in its character. */
  select(id: EmotionId) {
    if (!this.ctx) return;
    switch (id) {
      case 'joy':
        [0, 4, 7, 12].forEach((s, i) => this.tone({ freq: NOTE(s + 3, 523.25 / 1.1892), type: 'triangle', dur: 0.22, vol: 0.18, delay: i * 0.055 }));
        this.tone({ freq: 2093, type: 'sine', dur: 0.4, vol: 0.05, delay: 0.22, vibrato: 12, vibratoRate: 9 });
        break;
      case 'sadness':
        [7, 3, 0].forEach((s, i) => this.tone({ freq: NOTE(s - 12), type: 'sine', dur: 0.7, vol: 0.16, attack: 0.08, delay: i * 0.2, vibrato: 3, vibratoRate: 4.5 }));
        break;
      case 'anger':
        this.tone({ freq: 110, to: 70, type: 'sawtooth', dur: 0.35, vol: 0.35, dest: this.shaper, filter: 900 });
        this.noise({ dur: 0.18, vol: 0.4, filter: 160, type: 'lowpass' });
        this.tone({ freq: 55, type: 'sine', dur: 0.3, vol: 0.4 });
        break;
      case 'fear':
        [0, 1, 0, 1, 2].forEach((s, i) => this.tone({ freq: NOTE(s + 10), type: 'square', dur: 0.07, vol: 0.06, delay: i * 0.05, filter: 2600 }));
        this.tone({ freq: 900, to: 1400, type: 'sine', dur: 0.3, vol: 0.06, delay: 0.25, vibrato: 30, vibratoRate: 14 });
        break;
      case 'disgust':
        this.tone({ freq: 330, to: 196, type: 'sawtooth', dur: 0.32, vol: 0.12, filter: 1100, q: 6, filterType: 'bandpass' });
        this.tone({ freq: 392, to: 262, type: 'triangle', dur: 0.25, vol: 0.08, delay: 0.12 });
        break;
    }
  }

  /** Character babble for one dialogue line — rate-limited so typing stays pleasant. */
  voice(id: string) {
    if (!this.ctx) return;
    const now = performance.now();
    if (now - this.lastVoice < 70) return;
    this.lastVoice = now;
    const r = Math.random();
    switch (id) {
      case 'joy':
        this.tone({ freq: 620 + r * 260, to: 760 + r * 300, type: 'triangle', dur: 0.07, vol: 0.06, filter: 3000 });
        break;
      case 'sadness':
        this.tone({ freq: 210 + r * 50, to: 180 + r * 40, type: 'sine', dur: 0.14, vol: 0.08, attack: 0.03 });
        break;
      case 'anger':
        this.tone({ freq: 120 + r * 40, type: 'sawtooth', dur: 0.06, vol: 0.06, filter: 700 });
        break;
      case 'fear':
        this.tone({ freq: 480 + r * 400, type: 'square', dur: 0.04, vol: 0.03, filter: 2400 });
        break;
      case 'disgust':
        this.tone({ freq: 380 + r * 80, to: 300 + r * 60, type: 'sawtooth', dur: 0.08, vol: 0.04, filter: 1300, q: 5, filterType: 'bandpass' });
        break;
      case 'mote':
        this.tone({ freq: 900 + r * 300, type: 'sine', dur: 0.05, vol: 0.04 });
        break;
      default:
        this.tone({ freq: 330 + r * 120, type: 'triangle', dur: 0.06, vol: 0.04, filter: 2000 });
    }
  }

  footstep(id: EmotionId) {
    if (!this.ctx) return;
    switch (id) {
      case 'joy':
        this.tone({ freq: 880, to: 1320, type: 'sine', dur: 0.06, vol: 0.025 });
        break;
      case 'sadness':
        this.noise({ dur: 0.18, vol: 0.05, filter: 300, type: 'lowpass' });
        break;
      case 'anger':
        this.tone({ freq: 70, to: 40, type: 'sine', dur: 0.16, vol: 0.22 });
        this.noise({ dur: 0.08, vol: 0.08, filter: 200, type: 'lowpass' });
        break;
      case 'fear':
        this.noise({ dur: 0.03, vol: 0.04, filter: 3200, q: 3 });
        break;
      case 'disgust':
        this.noise({ dur: 0.04, vol: 0.06, filter: 2200, q: 8 });
        break;
    }
  }

  ability(id: EmotionId) {
    if (!this.ctx) return;
    switch (id) {
      case 'joy':
        [0, 4, 7, 11, 14, 19].forEach((s, i) => this.tone({ freq: NOTE(s, 523.25), type: 'triangle', dur: 0.35, vol: 0.12, delay: i * 0.045 }));
        this.noise({ dur: 0.6, vol: 0.06, filter: 6000, to: 9000, q: 2, type: 'highpass' });
        break;
      case 'sadness':
        [0, 3, 7, 10].forEach((s, i) => this.tone({ freq: NOTE(s - 9), type: 'sine', dur: 1.4, vol: 0.1, attack: 0.25, delay: i * 0.12, vibrato: 2, vibratoRate: 3 }));
        break;
      case 'anger':
        this.tone({ freq: 90, to: 35, type: 'sawtooth', dur: 0.6, vol: 0.4, dest: this.shaper, filter: 600 });
        this.noise({ dur: 0.5, vol: 0.5, filter: 400, to: 90, type: 'lowpass' });
        this.tone({ freq: 45, type: 'sine', dur: 0.5, vol: 0.5 });
        break;
      case 'fear':
        this.tone({ freq: 400, to: 1600, type: 'sine', dur: 0.8, vol: 0.06, vibrato: 40, vibratoRate: 18 });
        [0, 0.25, 0.5].forEach((d) => this.tone({ freq: 1760, type: 'sine', dur: 0.12, vol: 0.05, delay: d + 0.1 }));
        break;
      case 'disgust':
        this.tone({ freq: 500, to: 160, type: 'sawtooth', dur: 0.4, vol: 0.12, filter: 1400, q: 7, filterType: 'bandpass' });
        this.noise({ dur: 0.25, vol: 0.12, filter: 1800, to: 500, q: 2 });
        break;
    }
  }

  // ───────────────────────── generic UI / world ─────────────────────────
  blip(pitch = 1) {
    this.tone({ freq: 660 * pitch, to: 880 * pitch, type: 'triangle', dur: 0.08, vol: 0.06 });
  }
  hover() {
    this.tone({ freq: 1200, type: 'sine', dur: 0.04, vol: 0.02 });
  }
  whoosh(up = true) {
    this.noise({ dur: 0.9, vol: 0.25, filter: up ? 300 : 3000, to: up ? 4000 : 250, q: 1.5 });
  }
  tube() {
    this.noise({ dur: 1.0, vol: 0.3, filter: 500, to: 5000, q: 3 });
    this.tone({ freq: 200, to: 900, type: 'sine', dur: 0.9, vol: 0.08 });
  }
  chime(base = 0) {
    [0, 7, 12, 16].forEach((s, i) => this.tone({ freq: NOTE(s + base, 659.25), type: 'sine', dur: 1.2, vol: 0.08, delay: i * 0.09, vibrato: 4, vibratoRate: 5 }));
  }
  success() {
    [0, 4, 7, 12].forEach((s, i) => this.tone({ freq: NOTE(s, 523.25), type: 'triangle', dur: 0.4, vol: 0.12, delay: i * 0.08 }));
  }
  soft() {
    [0, 5].forEach((s, i) => this.tone({ freq: NOTE(s, 392), type: 'sine', dur: 0.4, vol: 0.08, delay: i * 0.1 }));
  }
  fail() {
    this.tone({ freq: 300, to: 150, type: 'triangle', dur: 0.4, vol: 0.1 });
  }
  thud() {
    this.tone({ freq: 90, to: 40, type: 'sine', dur: 0.3, vol: 0.3 });
    this.noise({ dur: 0.15, vol: 0.15, filter: 200, type: 'lowpass' });
  }
  pop() {
    this.tone({ freq: 400, to: 1400, type: 'sine', dur: 0.08, vol: 0.12 });
  }
  coreMemory() {
    [0, 4, 7, 11, 12, 16, 19, 24].forEach((s, i) => this.tone({ freq: NOTE(s - 5, 523.25), type: 'triangle', dur: 1.6, vol: 0.09, delay: i * 0.11, vibrato: 3 }));
    this.tone({ freq: 130.8, type: 'sine', dur: 2.4, vol: 0.18, attack: 0.3 });
  }
  tick() {
    this.tone({ freq: 2200, type: 'square', dur: 0.015, vol: 0.02 });
  }

  // ───────────────────────── ambient pad ─────────────────────────
  private startPad() {
    const ctx = this.ctx!;
    this.padFilter = ctx.createBiquadFilter();
    this.padFilter.type = 'lowpass';
    this.padFilter.frequency.value = 700;
    this.padFilter.Q.value = 0.7;
    this.padGain = ctx.createGain();
    this.padGain.gain.value = 0.06;
    this.padFilter.connect(this.padGain).connect(this.musicBus);
    this.lfo = ctx.createOscillator();
    this.lfo.frequency.value = 0.08;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 260;
    this.lfo.connect(lfoGain).connect(this.padFilter.frequency);
    this.lfo.start();
    const freqs = [130.81, 196.0, 261.63, 329.63];
    this.padOsc = freqs.map((f, i) => {
      const o = ctx.createOscillator();
      o.type = i % 2 ? 'triangle' : 'sine';
      o.frequency.value = f;
      o.detune.value = (i - 1.5) * 6;
      o.connect(this.padFilter);
      o.start();
      return o;
    });
    this.musicBus.gain.setTargetAtTime(1, ctx.currentTime, 2);
  }

  /** Retune the ambient bed to the active emotion. */
  setMood(id: EmotionId | 'neutral') {
    if (!this.ctx || !this.padOsc.length) return;
    const chords: Record<string, number[]> = {
      neutral: [130.81, 196.0, 261.63, 329.63],
      joy: [146.83, 220.0, 293.66, 369.99],
      sadness: [110.0, 164.81, 220.0, 261.63],
      anger: [73.42, 110.0, 146.83, 155.56],
      fear: [123.47, 174.61, 246.94, 261.63],
      disgust: [116.54, 174.61, 233.08, 277.18],
    };
    const filt: Record<string, number> = { neutral: 700, joy: 1400, sadness: 500, anger: 900, fear: 1100, disgust: 800 };
    const t = this.ctx.currentTime;
    chords[id].forEach((f, i) => this.padOsc[i]?.frequency.setTargetAtTime(f, t, 0.6));
    this.padFilter.frequency.setTargetAtTime(filt[id], t, 0.8);
    if (id === 'anger') this.padOsc[0].type = 'sawtooth';
    else this.padOsc[0].type = 'sine';
  }

  setAmbience(level: number) {
    if (!this.ctx) return;
    this.musicBus.gain.setTargetAtTime(level, this.ctx.currentTime, 0.8);
  }
}

export const audio = new AudioEngine();
