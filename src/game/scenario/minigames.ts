import type { AudioEngine } from '../../engine/audio';
import type { Ctx } from '../../engine/draw';
import { FONT_BODY, FONT_DISPLAY, circle, glow, mixHex, rgba, roundRect, wrapText } from '../../engine/draw';
import { TAU, clamp, easeOutBack, easeOutCubic } from '../../engine/math';
import type { EmitOptions, Particles } from '../../engine/particles';
import type { Rect } from '../art/screen';
import type { EmotionId } from '../content/emotions';
import { EMOTIONS } from '../content/emotions';
import type { Beat } from './artClub';

/** The parts of a moment each ability's game needs. */
export type Flavor = Pick<Beat, 'fear' | 'disgust' | 'anger' | 'sadness' | 'joy'>;

export interface MGInput {
  u: number;
  v: number;
  inside: boolean;
  moved: boolean;
  pressed: boolean;
  down: boolean;
  primaryPressed: boolean;
  primaryDown: boolean;
  axisX: number;
  axisY: number;
}

export abstract class Minigame {
  t = 0;
  done = false;
  score = 0;
  progress = 0;
  protected finishing = -1;
  protected verdict = '';
  abstract readonly emotion: EmotionId;
  abstract readonly title: string;
  abstract instruction: string;
  abstract readonly mode: 'tap' | 'hold' | 'none';
  primaryLabel?: string;
  protected rect: Rect = { x: 0, y: 0, w: 1, h: 1 };

  constructor(public beat: Flavor, protected sfx: AudioEngine, protected particles: Particles) {}

  setRect(r: Rect) {
    this.rect = r;
  }

  protected emit(u: number, v: number, o: Omit<EmitOptions, 'x' | 'y'>) {
    this.particles.emit({ ...o, x: this.rect.x + u * this.rect.w, y: this.rect.y + v * this.rect.h });
  }

  protected finish(score: number) {
    if (this.finishing >= 0) return;
    this.score = clamp(score, 0, 1);
    this.finishing = 0;
    this.verdict = this.score >= 0.85 ? 'Nailed it' : this.score >= 0.5 ? 'Not bad' : 'A bit shaky';
    if (this.score >= 0.5) this.sfx.success();
    else this.sfx.soft();
  }

  get finished() {
    return this.finishing >= 0;
  }

  step(dt: number, input: MGInput) {
    this.t += dt;
    if (this.finishing >= 0) {
      this.finishing += dt;
      if (this.finishing > 1.4) this.done = true;
      return;
    }
    this.update(dt, input);
  }

  protected abstract update(dt: number, input: MGInput): void;
  abstract render(ctx: Ctx, r: Rect): void;

  /** Shared overlay: title chip, timer ring and the verdict splash. */
  protected chrome(ctx: Ctx, r: Rect, timeLeft?: number, total?: number) {
    const E = EMOTIONS[this.emotion];
    ctx.save();
    ctx.font = `800 24px ${FONT_DISPLAY}`;
    const tw = ctx.measureText(E.ability.name).width;
    ctx.fillStyle = rgba('#120a30', 0.75);
    roundRect(ctx, r.x + 24, r.y + 22, tw + 40, 42, 21);
    ctx.fill();
    ctx.strokeStyle = E.color;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = E.light;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(E.ability.name, r.x + 44, r.y + 44);
    if (timeLeft !== undefined && total) {
      const k = clamp(timeLeft / total, 0, 1);
      const cx = r.x + r.w - 52;
      const cy = r.y + 46;
      circle(ctx, cx, cy, 24, rgba('#120a30', 0.75));
      ctx.strokeStyle = k < 0.25 ? '#ffffff' : E.color;
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(cx, cy, 17, -Math.PI / 2, -Math.PI / 2 + k * TAU);
      ctx.stroke();
    }
    if (this.finishing >= 0) {
      const k = easeOutBack(clamp(this.finishing / 0.5, 0, 1));
      const a = clamp((1.4 - this.finishing) / 0.3, 0, 1);
      ctx.globalAlpha = a;
      ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
      ctx.scale(k, k);
      ctx.font = `800 64px ${FONT_DISPLAY}`;
      ctx.textAlign = 'center';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 14;
      ctx.strokeStyle = rgba('#120a30', 0.85);
      ctx.strokeText(this.verdict, 0, 0);
      ctx.fillStyle = E.light;
      ctx.fillText(this.verdict, 0, 0);
    }
    ctx.restore();
  }
}

// ─────────────────────────────── FEAR: Scan ───────────────────────────────
export class ScanGame extends Minigame {
  readonly emotion = 'fear' as const;
  readonly title = 'Scan for hazards';
  instruction = 'Move the flashlight with the mouse or arrow keys. Hold it on anything risky.';
  readonly mode = 'none' as const;
  private lx = 0.5;
  private ly = 0.5;
  private found: number[];
  private limit = 14;

  constructor(beat: Flavor, sfx: AudioEngine, p: Particles) {
    super(beat, sfx, p);
    this.found = beat.fear.hazards.map(() => 0);
  }

  protected update(dt: number, i: MGInput) {
    if (i.inside && (i.moved || i.down)) {
      this.lx += (i.u - this.lx) * Math.min(1, dt * 14);
      this.ly += (i.v - this.ly) * Math.min(1, dt * 14);
    }
    this.lx = clamp(this.lx + i.axisX * dt * 0.7, 0.04, 0.96);
    this.ly = clamp(this.ly + i.axisY * dt * 0.9, 0.06, 0.94);
    const aspect = this.rect.w / this.rect.h;
    this.beat.fear.hazards.forEach((h, idx) => {
      if (this.found[idx] >= 1) return;
      const d = Math.hypot((h.x - this.lx) * aspect, h.y - this.ly);
      if (d < 0.16) {
        this.found[idx] += dt / 0.45;
        if (Math.floor(this.t * 12) % 2 === 0) this.sfx.tick();
        if (this.found[idx] >= 1) {
          this.found[idx] = 1;
          this.sfx.blip(1.5);
          this.emit(h.x, h.y, { count: 18, color: ['#A05CF0', '#DDC4FF'], shape: 'spark', speed: [80, 220], life: [0.3, 0.7] });
        }
      } else this.found[idx] = Math.max(0, this.found[idx] - dt * 0.6);
    });
    const n = this.found.filter((f) => f >= 1).length;
    this.progress = n / this.found.length;
    if (n === this.found.length) this.finish(1);
    else if (this.t > this.limit) this.finish(n / this.found.length);
  }

  render(ctx: Ctx, r: Rect) {
    const cx = r.x + this.lx * r.w;
    const cy = r.y + this.ly * r.h;
    const rad = r.h * 0.26;
    const g = ctx.createRadialGradient(cx, cy, rad * 0.55, cx, cy, rad);
    g.addColorStop(0, 'rgba(14,6,40,0)');
    g.addColorStop(1, 'rgba(14,6,40,0.88)');
    ctx.fillStyle = g;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = rgba('#DDC4FF', 0.6);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, rad * 0.78, 0, TAU);
    ctx.stroke();
    this.beat.fear.hazards.forEach((h, idx) => {
      const f = this.found[idx];
      const hx = r.x + h.x * r.w;
      const hy = r.y + h.y * r.h;
      if (f > 0 && f < 1) {
        ctx.strokeStyle = '#DDC4FF';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(hx, hy, 30, -Math.PI / 2, -Math.PI / 2 + f * TAU);
        ctx.stroke();
      }
      if (f >= 1) {
        ctx.strokeStyle = '#A05CF0';
        ctx.lineWidth = 4;
        ctx.setLineDash([8, 6]);
        ctx.lineDashOffset = -this.t * 30;
        ctx.beginPath();
        ctx.arc(hx, hy, 34, 0, TAU);
        ctx.stroke();
        ctx.setLineDash([]);
        tag(ctx, hx, hy - 50, h.label, '#A05CF0');
      }
    });
    const left = this.found.length - this.found.filter((f) => f >= 1).length;
    footer(ctx, r, left ? `${left} hazard${left > 1 ? 's' : ''} left to find` : 'All clear!');
    this.chrome(ctx, r, this.limit - this.t, this.limit);
  }
}

// ─────────────────────────────── DISGUST: Nope ───────────────────────────────
interface Item {
  label: string;
  bad: boolean;
  u: number;
  state: 'moving' | 'rejected' | 'passed';
  t: number;
  verdict?: string;
}

export class NopeGame extends Minigame {
  readonly emotion = 'disgust' as const;
  readonly title = 'Draw the line';
  instruction = 'Things slide past. Press Space, click, or tap Nope to reject anything that isn’t okay. Let the good things through.';
  readonly mode = 'tap' as const;
  primaryLabel = 'Nope';
  private items: Item[];
  private spawned = 0;
  private nextAt = 0.4;
  private correct = 0;

  constructor(beat: Flavor, sfx: AudioEngine, p: Particles) {
    super(beat, sfx, p);
    this.items = beat.disgust.items.map((it) => ({ ...it, u: 1.15, state: 'moving', t: 0 }));
  }

  private zone(u: number) {
    return u > 0.3 && u < 0.72;
  }

  protected update(dt: number, i: MGInput) {
    if (this.spawned < this.items.length && this.t >= this.nextAt) {
      this.spawned++;
      this.nextAt = this.t + 1.9;
    }
    const live = this.items.slice(0, this.spawned);
    for (const it of live) {
      it.t += dt;
      if (it.state === 'moving') {
        it.u -= dt * 0.24;
        if (it.u < -0.15) {
          it.state = 'passed';
          it.t = 0;
          if (!it.bad) this.correct++;
          it.verdict = it.bad ? 'Ew. That slipped through.' : 'Good call';
          if (it.bad) this.sfx.fail();
          else this.sfx.blip();
        }
      }
    }
    const target = live.find((it) => it.state === 'moving' && this.zone(it.u));
    let reject = i.primaryPressed;
    if (i.pressed && i.inside && target && Math.abs(target.u - i.u) < 0.2 && i.v > 0.6) reject = true;
    if (reject && target) {
      target.state = 'rejected';
      target.t = 0;
      if (target.bad) this.correct++;
      target.verdict = target.bad ? 'Nope!' : 'Hey, that one was fine';
      this.sfx.ability('disgust');
      this.emit(target.u, 0.8, { count: 22, color: ['#52C46B', '#C2F0CC'], shape: 'bubble', speed: [100, 260], angle: [-Math.PI * 0.9, -Math.PI * 0.1], life: [0.5, 1], size: [4, 9] });
    }
    const resolved = this.items.filter((it) => it.state !== 'moving').length;
    this.progress = resolved / this.items.length;
    if (resolved === this.items.length) this.finish(this.correct / this.items.length);
  }

  render(ctx: Ctx, r: Rect) {
    ctx.fillStyle = 'rgba(14,6,40,0.35)';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    // conveyor
    const by = r.y + r.h * 0.8;
    ctx.fillStyle = rgba('#120a30', 0.8);
    roundRect(ctx, r.x + 10, by - 50, r.w - 20, 100, 24);
    ctx.fill();
    ctx.strokeStyle = rgba('#C2F0CC', 0.15);
    ctx.lineWidth = 3;
    for (let k = 0; k < 20; k++) {
      const x = r.x + ((k * 60 - this.t * 0.24 * r.w) % (r.w + 60) + r.w + 60) % (r.w + 60);
      ctx.beginPath();
      ctx.moveTo(x, by - 46);
      ctx.lineTo(x - 20, by + 46);
      ctx.stroke();
    }
    // decision zone
    const zx0 = r.x + r.w * 0.3;
    const zx1 = r.x + r.w * 0.72;
    ctx.strokeStyle = rgba('#52C46B', 0.8 + Math.sin(this.t * 6) * 0.2);
    ctx.lineWidth = 4;
    ctx.setLineDash([12, 8]);
    roundRect(ctx, zx0, by - 56, zx1 - zx0, 112, 20);
    ctx.stroke();
    ctx.setLineDash([]);
    for (const it of this.items.slice(0, this.spawned)) {
      let x = r.x + it.u * r.w;
      let y = by;
      let a = 1;
      let rot = 0;
      if (it.state === 'rejected') {
        const k = easeOutCubic(clamp(it.t / 0.7, 0, 1));
        y -= k * r.h * 0.7;
        x += k * 120;
        rot = k * 0.8;
        a = 1 - k;
      } else if (it.state === 'passed') a = clamp(1 - it.t / 0.4, 0, 1);
      if (a > 0) {
        ctx.save();
        ctx.globalAlpha = a;
        ctx.translate(x, y);
        ctx.rotate(rot);
        card(ctx, 0, 0, it.label, it.state === 'moving' && this.zone(it.u));
        ctx.restore();
      }
      if (it.verdict && it.t < 1.1) {
        ctx.save();
        ctx.globalAlpha = clamp(1.1 - it.t, 0, 1);
        tag(ctx, it.state === 'passed' ? r.x + 140 : x, by - 100 - it.t * 30, it.verdict, it.verdict === 'Nope!' || it.verdict === 'Good call' ? '#52C46B' : '#E8516A');
        ctx.restore();
      }
    }
    footer(ctx, r, 'Reject what isn’t okay. Let the rest through.', r.y + r.h * 0.56);
    this.chrome(ctx, r);
  }
}

// ─────────────────────────────── ANGER: Stand Up ───────────────────────────────
export class StandUpGame extends Minigame {
  readonly emotion = 'anger' as const;
  readonly title = 'Stand up';
  instruction = 'The heat rises and falls. Press Space, click, or tap Speak up when the needle is in the firm zone. Not too timid, not too much.';
  readonly mode = 'tap' as const;
  primaryLabel = 'Speak up';
  private needle = 0;
  private locked = -1;
  private shout = 0;
  private pending = 0;

  protected update(dt: number, i: MGInput) {
    if (this.locked < 0) {
      const speed = 1.6 + this.t * 0.25;
      this.needle = 0.5 - Math.cos(this.t * speed) * 0.5;
      this.progress = this.needle;
      if (i.primaryPressed || (i.pressed && i.inside)) {
        this.locked = this.needle;
        this.sfx.ability('anger');
        this.shout = 0.001;
        const n = this.locked;
        this.pending = n >= 0.55 && n <= 0.8 ? 1 : n > 0.8 ? 0.35 : n >= 0.4 ? 0.6 : 0.3;
        this.emit(0.5, 0.45, { count: 40, color: ['#F0412D', '#FFB13B', '#FFE07A'], shape: 'ember', speed: [150, 420], life: [0.4, 0.9] });
      }
    } else {
      this.shout += dt;
      if (this.shout > 0.9) this.finish(this.pending);
    }
  }

  render(ctx: Ctx, r: Rect) {
    const shake = this.shout > 0 && this.shout < 0.5 ? Math.sin(this.t * 80) * 6 * (1 - this.shout * 2) : 0;
    ctx.fillStyle = rgba('#3a0a06', 0.32 + (this.locked >= 0 ? 0 : this.needle * 0.2));
    ctx.fillRect(r.x, r.y, r.w, r.h);
    const cx = r.x + r.w / 2 + shake;
    const cy = r.y + r.h * 0.86;
    const R = r.h * 0.5;
    // zones
    const zones: [number, number, string, string][] = [
      [0, 0.4, '#3D7BFF', 'Too timid'],
      [0.4, 0.55, '#FFB13B', ''],
      [0.55, 0.8, '#F0412D', 'Firm'],
      [0.8, 1, '#ffffff', 'Too much'],
    ];
    ctx.lineCap = 'butt';
    for (const [a, b, c, label] of zones) {
      ctx.strokeStyle = rgba(c, 0.85);
      ctx.lineWidth = 30;
      ctx.beginPath();
      ctx.arc(cx, cy, R, Math.PI + a * Math.PI, Math.PI + b * Math.PI);
      ctx.stroke();
      if (label) {
        const m = Math.PI + ((a + b) / 2) * Math.PI;
        tag(ctx, cx + Math.cos(m) * (R + 46), cy + Math.sin(m) * (R + 46), label, c === '#ffffff' ? '#E8516A' : c);
      }
    }
    const n = this.locked >= 0 ? this.locked : this.needle;
    const na = Math.PI + n * Math.PI;
    glow(ctx, cx + Math.cos(na) * R, cy + Math.sin(na) * R, 80, '#F0412D', 0.8);
    ctx.strokeStyle = '#F3EEFF';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(na) * (R + 10), cy + Math.sin(na) * (R + 10));
    ctx.stroke();
    circle(ctx, cx, cy, 16, '#E7B76A');
    if (this.locked >= 0) {
      const k = easeOutBack(clamp(this.shout / 0.35, 0, 1));
      ctx.save();
      ctx.translate(r.x + r.w / 2, r.y + r.h * 0.36);
      ctx.scale(k, k);
      ctx.font = `800 34px ${FONT_DISPLAY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const lines = wrapText(ctx, `“${this.beat.anger.line}”`, r.w * 0.8);
      lines.forEach((l, i) => {
        ctx.lineWidth = 10;
        ctx.strokeStyle = '#3a0a06';
        ctx.strokeText(l, 0, i * 40);
        ctx.fillStyle = '#FFE07A';
        ctx.fillText(l, 0, i * 40);
      });
      ctx.restore();
    }
    this.chrome(ctx, r);
  }
}

// ─────────────────────────────── SADNESS: Understand ───────────────────────────────
export class UnderstandGame extends Minigame {
  readonly emotion = 'sadness' as const;
  readonly title = 'Listen';
  instruction = 'Hold Space, or press and hold Listen. Stay with it. Letting go early lets the feeling slip away.';
  readonly mode = 'hold' as const;
  primaryLabel = 'Hold to listen';
  private fill = 0;
  private holding = false;

  protected update(dt: number, i: MGInput) {
    this.holding = i.primaryDown || (i.down && i.inside);
    if (this.holding) this.fill += dt / 3.6;
    else this.fill = Math.max(0, this.fill - dt * 0.18);
    if (this.holding && Math.random() < dt * 3) this.emit(0.5 + (Math.random() - 0.5) * 0.6, 0.9, { count: 1, color: ['#BBD2FF', '#3D7BFF'], shape: 'drop', speed: [10, 30], angle: [-Math.PI * 0.6, -Math.PI * 0.4], life: [1.5, 2.5], additive: false });
    this.progress = clamp(this.fill, 0, 1);
    if (this.fill >= 1) this.finish(this.t < 8 ? 1 : 0.8);
  }

  render(ctx: Ctx, r: Rect) {
    const k = clamp(this.fill, 0, 1);
    // the world goes soft and blue while you listen
    ctx.fillStyle = rgba('#0d1f5c', 0.35 + k * 0.25);
    ctx.fillRect(r.x, r.y, r.w, r.h);
    const cx = r.x + r.w * 0.5;
    const cy = r.y + r.h * 0.55;
    for (let i = 0; i < 4; i++) {
      const p = (this.t * 0.35 + i / 4) % 1;
      ctx.strokeStyle = rgba('#BBD2FF', (1 - p) * 0.4 * (this.holding ? 1 : 0.4));
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, 40 + p * r.h * 0.5, 0, TAU);
      ctx.stroke();
    }
    // progress ring
    ctx.strokeStyle = rgba('#1E3E9C', 0.6);
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(cx, cy, 56, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = '#BBD2FF';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy, 56, -Math.PI / 2, -Math.PI / 2 + k * TAU);
    ctx.stroke();
    // heart-drop in the middle
    ctx.fillStyle = mixHex('#3D7BFF', '#BBD2FF', k);
    ctx.beginPath();
    ctx.moveTo(cx, cy - 30);
    ctx.quadraticCurveTo(cx + 26, cy, cx, cy + 22);
    ctx.quadraticCurveTo(cx - 26, cy, cx, cy - 30);
    ctx.fill();
    // the hidden thought surfaces
    ctx.save();
    ctx.globalAlpha = clamp((k - 0.15) / 0.7, 0, 1);
    thought(ctx, cx, r.y + r.h * 0.2, this.beat.sadness.thought);
    ctx.restore();
    footer(ctx, r, this.holding ? 'Listening…' : k > 0 ? 'Keep holding' : 'Hold to listen');
    this.chrome(ctx, r);
  }
}

// ─────────────────────────────── JOY: Bright Side ───────────────────────────────
interface Cloud {
  gloom: string;
  bright: string;
  u: number;
  v: number;
  lit: number;
  done: boolean;
  seed: number;
}

export class BrightSideGame extends Minigame {
  readonly emotion = 'joy' as const;
  readonly title = 'Find the bright side';
  instruction = 'Grey thoughts are drifting in. Click each one, or press Space, to turn it golden.';
  readonly mode = 'tap' as const;
  primaryLabel = 'Brighten';
  private clouds: Cloud[];
  private limit = 12;

  constructor(beat: Flavor, sfx: AudioEngine, p: Particles) {
    super(beat, sfx, p);
    const n = beat.joy.clouds.length;
    this.clouds = beat.joy.clouds.map((c, i) => ({
      ...c,
      u: 0.14 + (i / Math.max(1, n - 1)) * 0.72,
      v: 0.3 + (i % 2) * 0.28,
      lit: 0,
      done: false,
      seed: i * 1.7,
    }));
  }

  private brighten(c: Cloud) {
    c.done = true;
    this.sfx.ability('joy');
    this.emit(c.u, c.v, { count: 30, color: ['#FFCF33', '#FFF1B0', '#ffffff'], shape: 'star', speed: [80, 260], life: [0.5, 1.1] });
  }

  protected update(dt: number, i: MGInput) {
    for (const c of this.clouds) {
      c.u += Math.sin(this.t * 0.5 + c.seed) * dt * 0.015;
      c.v += Math.cos(this.t * 0.7 + c.seed) * dt * 0.02;
      if (c.done) c.lit = Math.min(1, c.lit + dt * 3);
    }
    if (i.pressed && i.inside) {
      const aspect = this.rect.w / this.rect.h;
      let best: Cloud | null = null;
      let bd = 0.2;
      for (const c of this.clouds) {
        if (c.done) continue;
        const d = Math.hypot((c.u - i.u) * aspect * 0.5, c.v - i.v);
        if (d < bd) {
          bd = d;
          best = c;
        }
      }
      if (best) this.brighten(best);
    }
    if (i.primaryPressed) {
      const next = this.clouds.find((c) => !c.done);
      if (next) this.brighten(next);
    }
    const n = this.clouds.filter((c) => c.done).length;
    this.progress = n / this.clouds.length;
    if (n === this.clouds.length && this.clouds.every((c) => c.lit >= 1)) this.finish(1);
    else if (this.t > this.limit) this.finish(n / this.clouds.length);
  }

  render(ctx: Ctx, r: Rect) {
    const lit = this.progress;
    ctx.fillStyle = rgba('#3a3550', 0.45 * (1 - lit));
    ctx.fillRect(r.x, r.y, r.w, r.h);
    if (lit > 0) glow(ctx, r.x + r.w / 2, r.y + r.h / 2, r.w * 0.6, '#FFCF33', lit * 0.6);
    for (const c of this.clouds) {
      const x = r.x + c.u * r.w;
      const y = r.y + c.v * r.h;
      const col = mixHex('#8b86a0', '#FFD84D', c.lit);
      const s = 1 + Math.sin(c.lit * Math.PI) * 0.25;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(s, s);
      if (c.lit > 0) glow(ctx, 0, 0, 120, '#FFCF33', c.lit);
      ctx.fillStyle = col;
      ctx.beginPath();
      [
        [-46, 6, 30],
        [-12, -12, 38],
        [28, -2, 32],
        [52, 12, 22],
        [0, 16, 34],
      ].forEach(([px, py, pr]) => {
        ctx.moveTo(px + pr, py);
        ctx.arc(px, py, pr, 0, TAU);
      });
      ctx.fill();
      ctx.font = `800 20px ${FONT_DISPLAY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = c.lit > 0.5 ? '#5a3a00' : '#2a2640';
      ctx.fillText(c.lit > 0.5 ? c.bright : c.gloom, 4, 6);
      ctx.restore();
    }
    this.chrome(ctx, r, this.limit - this.t, this.limit);
  }
}

export function createMinigame(id: EmotionId, beat: Flavor, sfx: AudioEngine, p: Particles): Minigame {
  switch (id) {
    case 'fear':
      return new ScanGame(beat, sfx, p);
    case 'disgust':
      return new NopeGame(beat, sfx, p);
    case 'anger':
      return new StandUpGame(beat, sfx, p);
    case 'sadness':
      return new UnderstandGame(beat, sfx, p);
    case 'joy':
      return new BrightSideGame(beat, sfx, p);
  }
}

// ─────────────────────────────── small drawing helpers ───────────────────────────────
function tag(ctx: Ctx, x: number, y: number, text: string, color: string) {
  ctx.save();
  ctx.font = `800 18px ${FONT_BODY}`;
  const w = ctx.measureText(text).width + 24;
  ctx.fillStyle = rgba('#120a30', 0.85);
  roundRect(ctx, x - w / 2, y - 16, w, 32, 16);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.fillStyle = '#F3EEFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + 1);
  ctx.restore();
}

function card(ctx: Ctx, x: number, y: number, text: string, focused: boolean) {
  ctx.font = `800 20px ${FONT_BODY}`;
  const w = Math.max(140, ctx.measureText(text).width + 36);
  ctx.fillStyle = focused ? '#ffffff' : '#e8e3f7';
  roundRect(ctx, x - w / 2, y - 30, w, 60, 14);
  ctx.fill();
  ctx.strokeStyle = focused ? '#52C46B' : 'rgba(18,10,48,0.3)';
  ctx.lineWidth = focused ? 4 : 2;
  ctx.stroke();
  ctx.fillStyle = '#21164f';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + 1);
}

function footer(ctx: Ctx, r: Rect, text: string, y = r.y + r.h - 34) {
  ctx.save();
  ctx.font = `800 20px ${FONT_BODY}`;
  const w = ctx.measureText(text).width + 32;
  ctx.fillStyle = rgba('#120a30', 0.75);
  roundRect(ctx, r.x + r.w / 2 - w / 2, y - 18, w, 36, 18);
  ctx.fill();
  ctx.fillStyle = '#F3EEFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, r.x + r.w / 2, y + 1);
  ctx.restore();
}

function thought(ctx: Ctx, x: number, y: number, text: string) {
  ctx.font = `700 italic 24px ${FONT_BODY}`;
  const lines = wrapText(ctx, text, 420);
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 50;
  const h = lines.length * 30 + 30;
  ctx.fillStyle = '#F3F7FF';
  roundRect(ctx, x - w / 2, y - h / 2, w, h, h / 2);
  ctx.fill();
  circle(ctx, x - 20, y + h / 2 + 14, 10, '#F3F7FF');
  circle(ctx, x - 30, y + h / 2 + 34, 6, '#F3F7FF');
  ctx.fillStyle = '#1E3E9C';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((l, i) => ctx.fillText(l, x, y - ((lines.length - 1) * 30) / 2 + i * 30));
}
