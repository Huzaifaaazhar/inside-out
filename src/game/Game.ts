import { audio } from '../engine/audio';
import { STAGE_H, STAGE_W, view } from '../engine/camera';
import type { Ctx } from '../engine/draw';
import { circle, rgba } from '../engine/draw';
import { Input } from '../engine/input';
import { TAU, clamp, easeInOutCubic } from '../engine/math';
import type { TransitionKind } from '../state/store';
import { useGame } from '../state/store';
import { EMOTIONS } from './content/emotions';
import type { Scene, SceneId } from './Scene';
import { HQScene } from './scenes/HQScene';
import { IslandsScene } from './scenes/IslandsScene';
import { MemoryScene } from './scenes/MemoryScene';
import { OpeningScene } from './scenes/OpeningScene';
import { FadingScene } from './scenes/FadingScene';
import { FamilyIsland } from './scenes/islands/FamilyIsland';
import { FriendshipIsland } from './scenes/islands/FriendshipIsland';
import { GoofballIsland } from './scenes/islands/GoofballIsland';
import { HockeyIsland } from './scenes/islands/HockeyIsland';
import { ImaginationScene } from './scenes/ImaginationScene';
import { DreamScene } from './scenes/DreamScene';
import { SubconsciousScene } from './scenes/SubconsciousScene';
import type { TrackId } from '../engine/music';

const TRACK: Record<SceneId, TrackId> = {
  opening: 'title',
  hq: 'hq',
  memory: 'memory',
  fading: 'fading',
  islands: 'islands',
  'isle-family': 'family',
  'isle-friendship': 'friendship',
  'isle-hockey': 'hockey',
  'isle-goofball': 'goofball',
  imagination: 'imagination',
  dreams: 'dreams',
  subconscious: 'subconscious',
};

interface Transition {
  kind: TransitionKind;
  t: number;
  dur: number;
  to: SceneId;
  spawn?: number;
  swapped: boolean;
  color: string;
}

/**
 * Owns the canvas, the loop, input and the scene stack.
 * React mounts it once and talks to it through the Zustand store.
 */
export class Game {
  ctx: Ctx;
  input: Input;
  audio = audio;
  scenes: Record<SceneId, Scene>;
  current: Scene;
  private transition: Transition | null = null;
  private raf = 0;
  private last = 0;
  private dpr = 1;
  private scale = 1;
  private offX = 0;
  private offY = 0;
  private unsub: () => void;
  time = 0;
  fps = 60;

  constructor(public canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D is not available in this browser.');
    this.ctx = ctx;
    this.input = new Input(canvas);
    this.input.setStageMapper((cx, cy) => {
      const r = canvas.getBoundingClientRect();
      return { x: (cx - r.left - this.offX) / this.scale, y: (cy - r.top - this.offY) / this.scale };
    });
    this.scenes = {
      opening: new OpeningScene(this),
      hq: new HQScene(this),
      memory: new MemoryScene(this),
      islands: new IslandsScene(this),
      fading: new FadingScene(this),
      'isle-family': new FamilyIsland(this),
      'isle-friendship': new FriendshipIsland(this),
      'isle-hockey': new HockeyIsland(this),
      'isle-goofball': new GoofballIsland(this),
      imagination: new ImaginationScene(this),
      dreams: new DreamScene(this),
      subconscious: new SubconsciousScene(this),
    };
    this.current = this.scenes.opening;

    this.unsub = useGame.subscribe((s, prev) => {
      if (s.active !== prev.active) {
        this.audio.select(s.active);
        this.audio.setMood(s.active);
        this.current.onEmotionChanged(prev.active, s.active);
      }
      if (s.pendingTravel && s.pendingTravel !== prev.pendingTravel) {
        const p = s.pendingTravel;
        this.go(p.area, p.via, p.spawn);
        useGame.setState({ pendingTravel: null });
      }
      if (s.muted !== prev.muted) this.audio.setMuted(s.muted);
      if (s.musicVolume !== prev.musicVolume || s.sfxVolume !== prev.sfxVolume) this.audio.setVolumes(s.musicVolume, s.sfxVolume);
      if (s.consoleStage !== prev.consoleStage && this.current.id === 'hq') this.audio.playTrack(this.trackFor('hq'));
      if (s.phase === 'opening' && prev.phase !== 'opening') {
        this.switchTo('opening');
      }
      if (s.phase === 'playing' && prev.phase === 'opening') {
        this.go('hq', 'fade');
      }
      if (s.phase === 'playing' && prev.phase === 'title') {
        // continuing a saved game: go straight back to where Riley's operator left off
        this.audio.setMood(s.active);
        this.go(s.area, 'fade');
      }
    });

    window.addEventListener('resize', this.resize);
    this.resize();
    const s0 = useGame.getState();
    this.audio.setVolumes(s0.musicVolume, s0.sfxVolume);
    this.audio.playTrack('title');
  }

  start() {
    this.last = performance.now();
    const loop = (now: number) => {
      this.raf = requestAnimationFrame(loop);
      const dt = clamp((now - this.last) / 1000, 0, 1 / 20);
      this.last = now;
      this.fps = this.fps * 0.95 + (1 / Math.max(dt, 1e-3)) * 0.05;
      this.frame(dt);
    };
    this.raf = requestAnimationFrame(loop);
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.resize);
    this.input.dispose();
    this.unsub();
  }

  resize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    // "cover" the window: fill the screen and crop the edges of the stage on odd aspect ratios,
    // but never crop more than ~20% of either axis.
    const cover = Math.max(w / STAGE_W, h / STAGE_H);
    const contain = Math.min(w / STAGE_W, h / STAGE_H);
    // portrait phones get a tighter crop so characters stay a readable size
    this.scale = Math.min(cover, contain * (h > w ? 1.7 : 1.25));
    this.offX = (w - STAGE_W * this.scale) / 2;
    this.offY = (h - STAGE_H * this.scale) / 2;
    view.w = Math.min(STAGE_W, w / this.scale);
    view.h = Math.min(STAGE_H, h / this.scale);
  };

  /** Stage→CSS pixel mapping so the DOM overlay can anchor to world points. */
  stageToClient(x: number, y: number) {
    return { x: x * this.scale + this.offX, y: y * this.scale + this.offY };
  }

  get stageScale() {
    return this.scale;
  }

  switchTo(id: SceneId, spawn?: number) {
    this.current.exit();
    this.current = this.scenes[id];
    this.current.enter(spawn);
    if (id !== 'opening') {
      useGame.setState({ area: id });
      useGame.getState().visitArea(id);
    }
    this.audio.playTrack(this.trackFor(id));
  }

  /** The finale gets its own score while it plays at the console. */
  trackFor(id: SceneId): TrackId {
    const s = useGame.getState();
    if (id === 'hq' && s.objective === 'p3-final' && s.consoleStage !== 'off') return 'finale';
    return TRACK[id];
  }

  /** Travel with a transition. */
  go(id: SceneId, kind: TransitionKind = 'iris', spawn?: number) {
    if (this.transition) return;
    const reduced = useGame.getState().reducedMotion;
    const k = reduced ? 'fade' : kind;
    const color = EMOTIONS[useGame.getState().active].color;
    this.transition = { kind: k, t: 0, dur: k === 'fade' ? 1.0 : 1.5, to: id, spawn, swapped: false, color };
    useGame.setState({ transitioning: true, prompt: null });
    if (k === 'tube') this.audio.tube();
    else if (k === 'glide') this.audio.whoosh(false);
    else if (k === 'iris') this.audio.whoosh(true);
  }

  private frame(dt: number) {
    this.time += dt;
    this.input.beginFrame();
    if (this.transition) {
      const tr = this.transition;
      tr.t += dt;
      if (!tr.swapped && tr.t >= tr.dur / 2) {
        tr.swapped = true;
        this.switchTo(tr.to, tr.spawn);
      }
      if (tr.t >= tr.dur) {
        this.transition = null;
        useGame.setState({ transitioning: false });
      }
    }
    this.current.update(dt);
    this.input.endFrame();
    this.render();
  }

  private render() {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0c0726';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(this.dpr * this.scale, 0, 0, this.dpr * this.scale, this.dpr * this.offX, this.dpr * this.offY);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, STAGE_W, STAGE_H);
    ctx.clip();
    this.current.render(ctx);
    if (this.transition) this.renderTransition(ctx, this.transition);
    ctx.restore();
  }

  private renderTransition(ctx: Ctx, tr: Transition) {
    const p = tr.t / tr.dur; // 0..1
    const k = p < 0.5 ? easeInOutCubic(p * 2) : easeInOutCubic((1 - p) * 2); // 0→1→0 coverage
    const W = STAGE_W;
    const H = STAGE_H;
    switch (tr.kind) {
      case 'fade': {
        ctx.fillStyle = `rgba(12,7,38,${k})`;
        ctx.fillRect(0, 0, W, H);
        break;
      }
      case 'iris': {
        // a thought bubble closes onto the centre, then reopens
        const maxR = Math.hypot(W, H) * 0.6;
        const r = maxR * (1 - k);
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, W, H);
        ctx.arc(W / 2, H / 2, Math.max(0.1, r), 0, TAU, true);
        ctx.fillStyle = '#150d3a';
        ctx.fill('evenodd');
        ctx.restore();
        // bubble rim with small satellite bubbles
        ctx.strokeStyle = rgba(tr.color, 0.9 * Math.min(1, k * 3));
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.arc(W / 2, H / 2, Math.max(0.1, r), 0, TAU);
        ctx.stroke();
        for (let i = 0; i < 3; i++) {
          const a = -0.7 + i * 0.25;
          const rr = r + 40 + i * 30;
          circle(ctx, W / 2 + Math.cos(a) * rr, H / 2 + Math.sin(a) * rr, Math.max(0, 16 - i * 4) * Math.min(1, k * 2), rgba(tr.color, 0.8));
        }
        break;
      }
      case 'tube': {
        // pneumatic memory tube: streaks rush past while the screen glasses over
        ctx.fillStyle = `rgba(20,12,60,${k * 0.95})`;
        ctx.fillRect(0, 0, W, H);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 46; i++) {
          const x = ((i * 137.5) % W) + Math.sin(i) * 20;
          const speed = 1800 + (i % 7) * 400;
          const y = H - (((tr.t * speed + i * 211) % (H + 400)) - 200);
          const len = 80 + (i % 5) * 60;
          const g = ctx.createLinearGradient(x, y, x, y + len);
          g.addColorStop(0, rgba(i % 3 ? '#B9A7F5' : tr.color, 0));
          g.addColorStop(1, rgba(i % 3 ? '#B9A7F5' : tr.color, 0.8 * k));
          ctx.strokeStyle = g;
          ctx.lineWidth = 3 + (i % 3) * 2;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + len);
          ctx.stroke();
        }
        ctx.restore();
        // glass tube walls
        const wall = W * 0.5 * (1 - k * 0.72);
        const g2 = ctx.createLinearGradient(0, 0, W, 0);
        g2.addColorStop(0, `rgba(185,167,245,${0.5 * k})`);
        g2.addColorStop(0.5, 'rgba(185,167,245,0)');
        g2.addColorStop(1, `rgba(185,167,245,${0.5 * k})`);
        ctx.fillStyle = g2;
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = `rgba(12,7,38,${k})`;
        ctx.fillRect(0, 0, W / 2 - wall, H);
        ctx.fillRect(W / 2 + wall, 0, W / 2 - wall, H);
        break;
      }
      case 'glide': {
        // a bank of clouds slides across the view
        // the leading edge must have crossed the whole stage at p = 0.5, when the scene swaps
        const x = -W * 0.2 + p * W * 2.8;
        ctx.save();
        for (let layer = 0; layer < 3; layer++) {
          const lx = x - layer * 240;
          const col = ['#d8ccff', '#a996ec', '#6f5bc4'][layer];
          ctx.fillStyle = col;
          ctx.globalAlpha = Math.min(1, k * 1.6);
          ctx.beginPath();
          for (let i = 0; i < 14; i++) {
            const cy = (i / 13) * (H + 200) - 100;
            const r = 140 + Math.sin(i * 2.3 + layer) * 50;
            ctx.moveTo(lx + r, cy);
            ctx.arc(lx, cy, r, 0, TAU);
          }
          ctx.rect(lx - W * 1.6, -50, W * 1.6, H + 100);
          ctx.fill();
        }
        ctx.restore();
        break;
      }
    }
  }
}

let instance: Game | null = null;
export const setGame = (g: Game | null) => {
  instance = g;
};
export const getGame = () => instance;
