/**
 * Generative background music. Each area has a short chord loop, a bass line,
 * an arpeggio and a sparse melody, all synthesized and scheduled ahead on the
 * WebAudio clock. Original material: simple progressions, no borrowed themes.
 */

export type TrackId =
  | 'title'
  | 'hq'
  | 'memory'
  | 'fading'
  | 'islands'
  | 'family'
  | 'friendship'
  | 'hockey'
  | 'goofball'
  | 'imagination'
  | 'dreams'
  | 'subconscious'
  | 'finale';

interface Track {
  bpm: number;
  root: number; // MIDI note of the key centre
  /** Chords as scale-degree semitone offsets from root, one per bar. */
  chords: number[][];
  arp: 'up' | 'updown' | 'sparse' | 'none' | 'swing' | 'bounce';
  wave: OscillatorType;
  bassWave: OscillatorType;
  melody: number; // 0..1 chance per beat of a melody note
  scale: number[];
  bright: number; // filter cutoff
  bell?: boolean;
  swing?: number;
}

const MAJ = [0, 2, 4, 5, 7, 9, 11];
const MIN = [0, 2, 3, 5, 7, 8, 10];
const LYD = [0, 2, 4, 6, 7, 9, 11];
const DOR = [0, 2, 3, 5, 7, 9, 10];

const TRACKS: Record<TrackId, Track> = {
  title: { bpm: 70, root: 60, chords: [[0, 4, 7, 11], [-3, 0, 4, 7], [-7, -3, 0, 5], [-5, -1, 2, 7]], arp: 'updown', wave: 'sine', bassWave: 'sine', melody: 0.25, scale: MAJ, bright: 1800, bell: true },
  hq: { bpm: 84, root: 60, chords: [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]], arp: 'up', wave: 'triangle', bassWave: 'sine', melody: 0.2, scale: MAJ, bright: 2200 },
  memory: { bpm: 72, root: 62, chords: [[0, 3, 7, 10], [5, 9, 12], [-2, 2, 5, 9], [0, 3, 7]], arp: 'updown', wave: 'sine', bassWave: 'sine', melody: 0.3, scale: DOR, bright: 2400, bell: true },
  fading: { bpm: 54, root: 57, chords: [[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [-5, -2, 2]], arp: 'sparse', wave: 'sine', bassWave: 'sine', melody: 0.12, scale: MIN, bright: 900 },
  islands: { bpm: 96, root: 67, chords: [[0, 4, 7], [5, 9, 12], [-3, 0, 4], [7, 11, 14]], arp: 'up', wave: 'triangle', bassWave: 'triangle', melody: 0.3, scale: MAJ, bright: 2600 },
  family: { bpm: 80, root: 65, chords: [[0, 4, 7, 11], [5, 9, 12], [2, 5, 9], [7, 11, 14]], arp: 'updown', wave: 'triangle', bassWave: 'sine', melody: 0.28, scale: MAJ, bright: 2000 },
  friendship: { bpm: 104, root: 70, chords: [[0, 4, 7], [7, 11, 14], [-3, 0, 4], [5, 9, 12]], arp: 'bounce', wave: 'square', bassWave: 'triangle', melody: 0.35, scale: MAJ, bright: 1700 },
  hockey: { bpm: 112, root: 64, chords: [[0, 3, 7], [-4, 0, 3], [-7, -4, 0], [-2, 2, 5]], arp: 'up', wave: 'sawtooth', bassWave: 'square', melody: 0.2, scale: MIN, bright: 1500 },
  goofball: { bpm: 120, root: 60, chords: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7]], arp: 'bounce', wave: 'square', bassWave: 'triangle', melody: 0.45, scale: MAJ, bright: 2000 },
  imagination: { bpm: 92, root: 65, chords: [[0, 4, 7, 11], [2, 6, 9, 14], [-1, 4, 7, 11], [2, 6, 9]], arp: 'updown', wave: 'sine', bassWave: 'sine', melody: 0.4, scale: LYD, bright: 3200, bell: true },
  dreams: { bpm: 100, root: 63, chords: [[0, 4, 7, 10], [5, 9, 12, 15], [2, 5, 9, 12], [7, 11, 14, 17]], arp: 'swing', wave: 'triangle', bassWave: 'sine', melody: 0.3, scale: MAJ, bright: 1900, swing: 0.62 },
  subconscious: { bpm: 60, root: 50, chords: [[0, 3, 7], [0, 3, 8], [-2, 3, 7], [-4, 0, 3]], arp: 'sparse', wave: 'sine', bassWave: 'sine', melody: 0.1, scale: MIN, bright: 700, bell: true },
  finale: { bpm: 76, root: 62, chords: [[0, 4, 7], [-3, 0, 4], [-7, -3, 0, 4], [-5, -1, 2, 7]], arp: 'updown', wave: 'triangle', bassWave: 'sine', melody: 0.35, scale: MAJ, bright: 2400, bell: true },
};

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

export class Music {
  private ctx: AudioContext;
  private out: GainNode;
  private filter: BiquadFilterNode;
  private track: Track | null = null;
  private trackId: TrackId | null = null;
  private nextTime = 0;
  private step = 0;
  private timer = 0;
  private seed = 1;

  constructor(ctx: AudioContext, dest: AudioNode) {
    this.ctx = ctx;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 2000;
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.filter.connect(this.out).connect(dest);
  }

  get current() {
    return this.trackId;
  }

  private rand() {
    this.seed = (this.seed * 16807) % 2147483647;
    return this.seed / 2147483647;
  }

  /** Cross-fade to a new track. */
  play(id: TrackId) {
    if (this.trackId === id) return;
    const t = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setTargetAtTime(0, t, 0.25);
    const start = () => {
      this.trackId = id;
      this.track = TRACKS[id];
      this.filter.frequency.setTargetAtTime(this.track.bright, this.ctx.currentTime, 0.4);
      this.step = 0;
      this.seed = id.length * 7919;
      this.nextTime = this.ctx.currentTime + 0.1;
      this.out.gain.setTargetAtTime(0.32, this.ctx.currentTime, 1.2);
      if (!this.timer) this.timer = window.setInterval(() => this.schedule(), 40);
    };
    if (this.trackId) window.setTimeout(start, 600);
    else start();
  }

  stop() {
    this.out.gain.setTargetAtTime(0, this.ctx.currentTime, 0.4);
    this.trackId = null;
    this.track = null;
  }

  private note(freq: number, at: number, dur: number, vol: number, wave: OscillatorType) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = wave;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g).connect(this.filter);
    o.start(at);
    o.stop(at + dur + 0.05);
  }

  /** Look ahead and schedule anything due in the next ~150ms. */
  private schedule() {
    const tr = this.track;
    if (!tr) return;
    const eighth = 60 / tr.bpm / 2;
    while (this.nextTime < this.ctx.currentTime + 0.15) {
      const s = this.step;
      const bar = Math.floor(s / 8) % tr.chords.length;
      const chord = tr.chords[bar];
      const inBar = s % 8;
      let at = this.nextTime;
      if (tr.swing && inBar % 2 === 1) at += eighth * (tr.swing - 0.5);
      // bass on beats one and three, a walking line for the swing track
      if (inBar === 0 || inBar === 4) this.note(midi(tr.root - 24 + chord[0]), at, eighth * 3.6, 0.18, tr.bassWave);
      else if (tr.arp === 'swing' && inBar % 2 === 0) this.note(midi(tr.root - 24 + chord[(inBar / 2) % chord.length] + 12), at, eighth * 1.6, 0.1, tr.bassWave);
      // a soft pad chord at the top of each bar
      if (inBar === 0) for (const c of chord) this.note(midi(tr.root - 12 + c), at, eighth * 7.6, 0.035, 'sine');
      // the arpeggio
      const pattern = tr.arp;
      let idx = -1;
      if (pattern === 'up') idx = inBar % chord.length;
      else if (pattern === 'updown') idx = [0, 1, 2, 3, 2, 1, 0, 1][inBar] % chord.length;
      else if (pattern === 'bounce') idx = inBar % 2 === 0 ? 0 : (inBar / 2 + 1) % chord.length | 0;
      else if (pattern === 'swing') idx = inBar % 2 === 1 ? (inBar >> 1) % chord.length : -1;
      else if (pattern === 'sparse') idx = inBar === 2 || inBar === 6 ? (inBar >> 2) % chord.length : -1;
      if (idx >= 0) this.note(midi(tr.root + chord[idx]), at, eighth * (pattern === 'sparse' ? 5 : 1.4), pattern === 'bounce' ? 0.05 : 0.065, tr.wave === 'sawtooth' ? 'triangle' : tr.wave);
      // a sparse melody that stays in the scale
      if (inBar % 2 === 0 && this.rand() < tr.melody) {
        const deg = tr.scale[Math.floor(this.rand() * tr.scale.length)];
        const n = tr.root + 12 + deg;
        this.note(midi(n), at, eighth * (1.5 + this.rand() * 2), 0.05, tr.bell ? 'sine' : tr.wave === 'square' ? 'triangle' : tr.wave);
        if (tr.bell) this.note(midi(n + 12), at, eighth * 3, 0.015, 'sine');
      }
      this.nextTime += eighth;
      this.step++;
    }
  }
}
