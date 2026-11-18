/**
 * Island activities: short games that let Riley tend each part of her personality.
 * They render into a world-space rect and take the same input shape as the console mini-games.
 */
import type { AudioEngine } from '../engine/audio';
import type { Ctx } from '../engine/draw';
import { FONT_BODY, FONT_DISPLAY, circle, ellipse, glow, mixHex, roundRect } from '../engine/draw';
import { TAU, clamp, easeOutBack } from '../engine/math';
import type { Particles } from '../engine/particles';
import type { Rect } from './art/screen';
import type { MGInput } from './scenario/minigames';

export abstract class Activity {
  t = 0;
  done = false;
  score = 0;
  protected endT = -1;
  protected verdict = '';
  abstract readonly title: string;
  abstract readonly instruction: string;
  abstract readonly accent: string;
  readonly primaryLabel: string = 'Go';
  readonly mode: 'tap' | 'hold' | 'none' = 'tap';
  rect: Rect = { x: 0, y: 0, w: 1, h: 1 };
  /** Discrete keys pressed this frame, for activities that need more than one button. */
  keys: string[] = [];
  progress = 0;

  constructor(protected sfx: AudioEngine, protected particles: Particles) {}

  protected finish(score: number, verdict: string) {
    if (this.endT >= 0) return;
    this.score = clamp(score, 0, 1);
    this.verdict = verdict;
    this.endT = 0;
    if (this.score >= 0.5) this.sfx.success();
    else this.sfx.soft();
  }

  step(dt: number, i: MGInput) {
    this.t += dt;
    if (this.endT >= 0) {
      this.endT += dt;
      if (this.endT > 1.8) this.done = true;
      return;
    }
    this.update(dt, i);
  }

  protected emit(u: number, v: number, color: string[], shape: 'star' | 'spark' | 'bubble' | 'dot' = 'star', count = 20) {
    this.particles.emit({ x: this.rect.x + u * this.rect.w, y: this.rect.y + v * this.rect.h, count, color, shape, speed: [60, 240], life: [0.4, 1] });
  }

  protected abstract update(dt: number, i: MGInput): void;
  abstract render(ctx: Ctx): void;

  protected frame(ctx: Ctx, bg: string) {
    const r = this.rect;
    ctx.fillStyle = 'rgba(10,6,30,0.35)';
    roundRect(ctx, r.x + 8, r.y + 12, r.w, r.h, 40);
    ctx.fill();
    ctx.fillStyle = bg;
    roundRect(ctx, r.x, r.y, r.w, r.h, 40);
    ctx.fill();
    ctx.strokeStyle = this.accent;
    ctx.lineWidth = 8;
    ctx.stroke();
  }

  protected hud(ctx: Ctx, text: string) {
    const r = this.rect;
    ctx.save();
    ctx.font = `800 24px ${FONT_BODY}`;
    const w = ctx.measureText(text).width + 36;
    ctx.fillStyle = 'rgba(12,7,38,0.8)';
    roundRect(ctx, r.x + r.w / 2 - w / 2, r.y + 18, w, 44, 22);
    ctx.fill();
    ctx.fillStyle = '#F3EEFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, r.x + r.w / 2, r.y + 41);
    if (this.endT >= 0) {
      const k = easeOutBack(clamp(this.endT / 0.5, 0, 1));
      ctx.globalAlpha = clamp((1.8 - this.endT) / 0.3, 0, 1);
      ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
      ctx.scale(k, k);
      ctx.font = `800 64px ${FONT_DISPLAY}`;
      ctx.lineWidth = 14;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(12,7,38,0.85)';
      ctx.strokeText(this.verdict, 0, 0);
      ctx.fillStyle = this.accent;
      ctx.fillText(this.verdict, 0, 0);
    }
    ctx.restore();
  }
}

// ───────────────────────────── Family: Sunday pancakes ─────────────────────────────
export class PancakeFlip extends Activity {
  readonly title = 'Sunday pancakes';
  readonly instruction = 'Each pancake browns in the pan. Press Space, click, or tap Flip when it turns golden. Not pale, not burnt.';
  readonly accent = '#F4A259';
  readonly primaryLabel = 'Flip';
  private cook = 0;
  private speed = 0.3;
  private stack: number[] = [];
  private flipT = -1;
  private flipCook = 0;
  private readonly total = 5;

  protected update(dt: number, i: MGInput) {
    if (this.flipT >= 0) {
      this.flipT += dt;
      if (this.flipT > 0.6) {
        this.stack.push(this.flipCook);
        this.flipT = -1;
        this.cook = 0;
        this.speed = 0.28 + Math.random() * 0.22;
        if (this.stack.length >= this.total) {
          const good = this.stack.filter((c) => c >= 0.55 && c <= 0.82).length;
          this.finish(good / this.total, good >= 4 ? 'Perfect stack' : good >= 2 ? 'Tasty enough' : 'Dad eats the burnt ones');
        }
      }
      return;
    }
    this.cook += dt * this.speed;
    this.progress = this.stack.length / this.total;
    if (i.primaryPressed || (i.pressed && i.inside) || this.cook > 1.15) {
      this.flipCook = this.cook;
      this.flipT = 0;
      const good = this.cook >= 0.55 && this.cook <= 0.82;
      this.sfx.pop();
      if (good) this.emit(0.35, 0.55, ['#FFCF33', '#FFF1B0'], 'star', 16);
    }
  }

  private color(c: number) {
    if (c < 0.55) return mixHex('#f6e3b0', '#e8b45a', c / 0.55);
    if (c <= 0.82) return mixHex('#e8b45a', '#c9852f', (c - 0.55) / 0.27);
    return mixHex('#c9852f', '#3a2010', clamp((c - 0.82) / 0.3, 0, 1));
  }

  render(ctx: Ctx) {
    const r = this.rect;
    this.frame(ctx, '#FFE8B6');
    // stove and pan
    const px = r.x + r.w * 0.35;
    const py = r.y + r.h * 0.62;
    glow(ctx, px, py + 40, 140, '#FF6B35', 0.5);
    ellipse(ctx, px, py + 10, 130, 34, '#2b2b3a');
    ellipse(ctx, px, py, 120, 30, '#3a3a4c');
    ctx.fillStyle = '#2b2b3a';
    ctx.fillRect(px + 110, py - 8, 120, 16);
    if (this.flipT < 0) ellipse(ctx, px, py - 4, 80, 18, this.color(this.cook));
    else {
      const k = this.flipT / 0.6;
      const sx = px + (r.w * 0.38) * k;
      const sy = py - 4 - Math.sin(k * Math.PI) * 160;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.scale(1, Math.cos(k * TAU));
      ellipse(ctx, 0, 0, 80, 18, this.color(this.flipCook));
      ctx.restore();
    }
    // cook gauge
    const gx = r.x + r.w * 0.12;
    const gw = r.w * 0.46;
    const gy = r.y + r.h * 0.86;
    ctx.fillStyle = 'rgba(12,7,38,0.25)';
    roundRect(ctx, gx, gy, gw, 18, 9);
    ctx.fill();
    ctx.fillStyle = 'rgba(82,196,107,0.6)';
    ctx.fillRect(gx + gw * 0.55, gy, gw * 0.27, 18);
    circle(ctx, gx + gw * clamp(this.cook, 0, 1.1) / 1.1, gy + 9, 12, '#5a3a10');
    // the stack on a plate
    const sx = r.x + r.w * 0.76;
    const sy = r.y + r.h * 0.8;
    ellipse(ctx, sx, sy + 8, 110, 20, '#ffffff');
    this.stack.forEach((c, i) => ellipse(ctx, sx + Math.sin(i * 1.7) * 4, sy - i * 16, 80, 16, this.color(c)));
    if (this.stack.length) ellipse(ctx, sx, sy - this.stack.length * 16 - 6, 20, 6, '#fff6c0');
    this.hud(ctx, `Pancakes: ${this.stack.length} of ${this.total}`);
  }
}

// ───────────────────────────── Friendship: bracelet weaving ─────────────────────────────
const BEADS = [
  { c: '#3CC6B8', key: 'ArrowUp', u: 0.5, v: 0.32, name: 'Up' },
  { c: '#FF7A6B', key: 'ArrowRight', u: 0.66, v: 0.56, name: 'Right' },
  { c: '#FFCF33', key: 'ArrowDown', u: 0.5, v: 0.8, name: 'Down' },
  { c: '#A05CF0', key: 'ArrowLeft', u: 0.34, v: 0.56, name: 'Left' },
];

export class BraceletWeave extends Activity {
  readonly title = 'Friendship bracelet';
  readonly instruction = 'Watch the beads light up, then repeat the pattern with the arrow keys or by clicking the beads.';
  readonly accent = '#3CC6B8';
  private round = 0;
  private seq: number[] = [];
  private input: number[] = [];
  private phase: 'show' | 'input' | 'between' = 'between';
  private phaseT = 0;
  private lit = -1;
  private litT = 0;
  private shown = -1;
  private wins = 0;
  private woven: string[] = [];
  private readonly rounds = 3;
  /** Set by the scene from keyboard: which arrow was pressed this frame. */
  arrow: number = -1;

  protected update(dt: number, i: MGInput) {
    this.phaseT += dt;
    this.litT = Math.max(0, this.litT - dt);
    if (this.litT <= 0) this.lit = -1;
    this.progress = this.round / this.rounds;
    if (this.phase === 'between') {
      if (this.phaseT > 0.9) {
        if (this.round >= this.rounds) {
          this.finish(this.wins / this.rounds, this.wins === 3 ? 'Best friends forever' : this.wins >= 2 ? 'Pretty bracelet' : 'A bit knotty');
          return;
        }
        this.seq = Array.from({ length: 3 + this.round }, () => Math.floor(Math.random() * 4));
        this.input = [];
        this.shown = -1;
        this.phase = 'show';
        this.phaseT = 0;
      }
      return;
    }
    if (this.phase === 'show') {
      const idx = Math.floor(this.phaseT / 0.6);
      if (idx >= this.seq.length) {
        this.phase = 'input';
        this.phaseT = 0;
        this.lit = -1;
        return;
      }
      const on = this.phaseT % 0.6 < 0.4;
      if (on && idx !== this.shown) {
        this.shown = idx;
        this.sfx.blip(1 + this.seq[idx] * 0.15);
      }
      this.lit = on ? this.seq[idx] : -1;
      this.litT = on ? 0.05 : 0;
      return;
    }
    // input
    let pick = this.arrow;
    if (i.pressed && i.inside) {
      let best = -1;
      let bd = 0.12;
      BEADS.forEach((b, k) => {
        const d = Math.hypot((b.u - i.u) * (this.rect.w / this.rect.h), b.v - i.v);
        if (d < bd) {
          bd = d;
          best = k;
        }
      });
      if (best >= 0) pick = best;
    }
    this.arrow = -1;
    if (pick < 0) return;
    this.lit = pick;
    this.litT = 0.25;
    this.sfx.blip(1 + pick * 0.15);
    const want = this.seq[this.input.length];
    if (pick !== want) {
      this.sfx.fail();
      this.round++;
      this.phase = 'between';
      this.phaseT = 0;
      return;
    }
    this.input.push(pick);
    this.woven.push(BEADS[pick].c);
    if (this.input.length === this.seq.length) {
      this.wins++;
      this.round++;
      this.emit(0.5, 0.56, ['#3CC6B8', '#FF7A6B', '#FFCF33'], 'star', 24);
      this.phase = 'between';
      this.phaseT = 0;
    }
  }

  render(ctx: Ctx) {
    const r = this.rect;
    this.frame(ctx, '#E9FBF7');
    BEADS.forEach((b, k) => {
      const x = r.x + b.u * r.w;
      const y = r.y + b.v * r.h;
      const on = this.lit === k;
      if (on) glow(ctx, x, y, 90, b.c, 1);
      circle(ctx, x, y, on ? 46 : 38, b.c);
      circle(ctx, x - 12, y - 12, 10, 'rgba(255,255,255,0.6)');
      ctx.fillStyle = 'rgba(12,7,38,0.55)';
      ctx.font = `800 16px ${FONT_BODY}`;
      ctx.textAlign = 'center';
      ctx.fillText(b.name, x, y + 64);
    });
    // the bracelet being woven
    const bx = r.x + r.w * 0.82;
    const by = r.y + r.h * 0.56;
    ctx.strokeStyle = '#c99b6d';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(bx, by, 80, 0, TAU);
    ctx.stroke();
    this.woven.forEach((c, k) => {
      const a = -Math.PI / 2 + (k / 16) * TAU;
      circle(ctx, bx + Math.cos(a) * 80, by + Math.sin(a) * 80, 11, c);
    });
    const label = this.phase === 'show' ? 'Watch the pattern' : this.phase === 'input' ? `Your turn: ${this.input.length} of ${this.seq.length}` : `Round ${Math.min(this.round + 1, this.rounds)} of ${this.rounds}`;
    this.hud(ctx, label);
  }
}

// ───────────────────────────── Hockey: penalty shots ─────────────────────────────
export class PenaltyShots extends Activity {
  readonly title = 'Penalty shots';
  readonly instruction = 'The aim marker sweeps across the goal. Press Space, click, or tap Shoot when it’s away from the goalie.';
  readonly accent = '#7FC8FF';
  readonly primaryLabel = 'Shoot';
  private aim = 0;
  private goalie = 0.5;
  private shots: boolean[] = [];
  private puck: { t: number; from: [number, number]; to: [number, number]; goal: boolean } | null = null;
  private readonly total = 5;

  protected update(dt: number, i: MGInput) {
    const level = this.shots.length;
    this.aim = 0.5 + Math.sin(this.t * (1.8 + level * 0.25)) * 0.45;
    this.goalie = 0.5 + Math.sin(this.t * (1.1 + level * 0.3) + 1.3) * 0.32;
    this.progress = this.shots.length / this.total;
    if (this.puck) {
      this.puck.t += dt;
      if (this.puck.t > 0.55) {
        this.shots.push(this.puck.goal);
        if (this.puck.goal) {
          this.sfx.success();
          this.emit(0.5, 0.35, ['#E63946', '#ffffff', '#7FC8FF'], 'star', 30);
        } else this.sfx.thud();
        this.puck = null;
        if (this.shots.length >= this.total) {
          const g = this.shots.filter(Boolean).length;
          this.finish(g / this.total, g >= 4 ? 'Hat trick and then some' : g >= 2 ? 'Nice shooting' : 'The goalie wins this one');
        }
      }
      return;
    }
    if (i.primaryPressed || (i.pressed && i.inside)) {
      const goal = Math.abs(this.aim - this.goalie) > 0.16;
      this.puck = { t: 0, from: [0.5, 0.88], to: [0.18 + this.aim * 0.64, 0.38], goal };
      this.sfx.ability('anger');
    }
  }

  render(ctx: Ctx) {
    const r = this.rect;
    this.frame(ctx, '#E8F4FF');
    // ice markings
    ctx.strokeStyle = 'rgba(230,57,70,0.5)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(r.x + 30, r.y + r.h * 0.6);
    ctx.lineTo(r.x + r.w - 30, r.y + r.h * 0.6);
    ctx.stroke();
    // goal
    const gx = r.x + r.w * 0.18;
    const gw = r.w * 0.64;
    const gy = r.y + r.h * 0.2;
    const gh = r.h * 0.3;
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillRect(gx, gy, gw, gh);
    ctx.strokeStyle = 'rgba(20,33,61,0.25)';
    ctx.lineWidth = 1;
    for (let k = 0; k < 16; k++) {
      ctx.beginPath();
      ctx.moveTo(gx + (k / 16) * gw, gy);
      ctx.lineTo(gx + (k / 16) * gw, gy + gh);
      ctx.stroke();
    }
    ctx.strokeStyle = '#E63946';
    ctx.lineWidth = 8;
    ctx.strokeRect(gx, gy, gw, gh);
    // goalie: a big padded mascot
    const gox = gx + this.goalie * gw;
    ctx.fillStyle = '#14213D';
    roundRect(ctx, gox - 60, gy + gh * 0.2, 120, gh * 0.8, 20);
    ctx.fill();
    circle(ctx, gox, gy + gh * 0.15, 30, '#f2f2f2');
    ctx.fillStyle = '#14213D';
    for (let k = -1; k <= 1; k++) ctx.fillRect(gox - 18, gy + gh * 0.1 + k * 8, 36, 3);
    // aim marker
    const ax = gx + this.aim * gw;
    ctx.strokeStyle = '#E63946';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(ax, gy + gh * 0.5, 22, 0, TAU);
    ctx.moveTo(ax - 32, gy + gh * 0.5);
    ctx.lineTo(ax + 32, gy + gh * 0.5);
    ctx.moveTo(ax, gy + gh * 0.5 - 32);
    ctx.lineTo(ax, gy + gh * 0.5 + 32);
    ctx.stroke();
    // puck
    if (this.puck) {
      const k = this.puck.t / 0.55;
      const x = r.x + (this.puck.from[0] + (this.puck.to[0] - this.puck.from[0]) * k) * r.w;
      const y = r.y + (this.puck.from[1] + (this.puck.to[1] - this.puck.from[1]) * k) * r.h;
      ellipse(ctx, x, y, 14, 6, '#111');
    } else ellipse(ctx, r.x + r.w * 0.5, r.y + r.h * 0.88, 14, 6, '#111');
    // shot record
    for (let k = 0; k < this.total; k++) {
      const s = this.shots[k];
      circle(ctx, r.x + r.w * 0.5 + (k - 2) * 34, r.y + r.h * 0.72, 12, s === undefined ? 'rgba(20,33,61,0.2)' : s ? '#52C46B' : '#E63946');
    }
    this.hud(ctx, `Shot ${Math.min(this.shots.length + 1, this.total)} of ${this.total}`);
  }
}

// ───────────────────────────── Goofball: bounce house ─────────────────────────────
interface Giggle {
  x: number;
  y: number;
  vx: number;
  got: boolean;
  seed: number;
}

export class BounceHouse extends Activity {
  readonly title = 'Bounce house';
  readonly instruction = 'Hold Space (or the button) to crouch, let go to bounce higher. Move with the arrow keys. Catch the floating giggles.';
  readonly accent = '#FF7FB0';
  readonly primaryLabel = 'Hold to crouch';
  readonly mode = 'hold' as const;
  private x = 0.5;
  private y = 0.86;
  private vy = 0;
  private charge = 0;
  private giggles: Giggle[] = [];
  private caught = 0;
  private spawnT = 0;
  private readonly limit = 22;
  private readonly target = 10;

  protected update(dt: number, i: MGInput) {
    const floor = 0.86;
    this.x = clamp(this.x + i.axisX * dt * 0.55, 0.08, 0.92);
    if (i.pressed && i.inside) this.x += (clamp(i.u, 0.08, 0.92) - this.x) * 0.5;
    const onGround = this.y >= floor - 0.001;
    if (onGround) {
      if (i.primaryDown || (i.down && i.inside)) this.charge = Math.min(1, this.charge + dt * 1.4);
      else {
        this.vy = -(1.0 + this.charge * 1.3);
        if (this.charge > 0.2) this.sfx.blip(1 + this.charge);
        this.charge = 0;
      }
    }
    this.vy += dt * 2.6;
    this.y = Math.min(floor, this.y + this.vy * dt);
    if (this.y >= floor) this.vy = 0;
    // giggles drift across at different heights
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = 0.9;
      const left = Math.random() < 0.5;
      this.giggles.push({ x: left ? -0.05 : 1.05, y: 0.18 + Math.random() * 0.5, vx: (left ? 1 : -1) * (0.12 + Math.random() * 0.1), got: false, seed: Math.random() * 10 });
    }
    for (const g of this.giggles) {
      g.x += g.vx * dt;
      if (!g.got && Math.hypot((g.x - this.x) * (this.rect.w / this.rect.h), g.y - (this.y - 0.08)) < 0.09) {
        g.got = true;
        this.caught++;
        this.sfx.pop();
        this.emit(g.x, g.y, ['#FF7FB0', '#FFE45E', '#7AE7C7'], 'bubble', 14);
      }
    }
    this.giggles = this.giggles.filter((g) => !g.got && g.x > -0.1 && g.x < 1.1);
    this.progress = Math.min(1, this.caught / this.target);
    if (this.caught >= this.target) this.finish(1, 'Giggle champion');
    else if (this.t > this.limit) this.finish(this.caught / this.target, this.caught >= 5 ? 'Very bouncy' : 'Mostly flailing');
  }

  render(ctx: Ctx) {
    const r = this.rect;
    this.frame(ctx, '#FFE1EE');
    // striped tent walls
    for (let k = 0; k < 10; k++) {
      ctx.fillStyle = k % 2 ? 'rgba(255,127,176,0.35)' : 'rgba(255,228,94,0.35)';
      ctx.fillRect(r.x + (k / 10) * r.w, r.y + 20, r.w / 10, r.h - 40);
    }
    // trampoline
    const fy = r.y + r.h * 0.9;
    const dip = this.y >= 0.859 ? this.charge * 18 : 0;
    ctx.strokeStyle = '#8E5BD9';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(r.x + 40, fy);
    ctx.quadraticCurveTo(r.x + this.x * r.w, fy + dip * 2, r.x + r.w - 40, fy);
    ctx.stroke();
    // giggles
    for (const g of this.giggles) {
      const gx = r.x + g.x * r.w;
      const gy = r.y + g.y * r.h + Math.sin(this.t * 3 + g.seed) * 8;
      glow(ctx, gx, gy, 40, '#FFE45E', 0.6);
      circle(ctx, gx, gy, 18, '#FFE45E');
      ctx.strokeStyle = '#8a5a00';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(gx, gy + 2, 9, 0.2, Math.PI - 0.2);
      ctx.stroke();
      circle(ctx, gx - 6, gy - 5, 2.5, '#8a5a00');
      circle(ctx, gx + 6, gy - 5, 2.5, '#8a5a00');
    }
    // Riley's goofball self: a bouncy round blob with a ponytail
    const px = r.x + this.x * r.w;
    const py = r.y + this.y * r.h + dip;
    const squash = this.y >= 0.859 ? 1 - this.charge * 0.3 : 1 + Math.min(0.2, Math.abs(this.vy) * 0.08);
    ctx.save();
    ctx.translate(px, py);
    ctx.scale(1 / squash, squash);
    ellipse(ctx, -34, -60, 12, 22, '#5a3418', 0.6);
    circle(ctx, 0, -40, 40, '#FF8A5B');
    circle(ctx, 0, -48, 26, '#f2c29b');
    circle(ctx, -9, -52, 4, '#22163f');
    circle(ctx, 9, -52, 4, '#22163f');
    ctx.fillStyle = '#22163f';
    ctx.beginPath();
    ctx.arc(0, -42, 9, 0, Math.PI);
    ctx.fill();
    ctx.restore();
    // charge meter
    if (this.charge > 0) {
      ctx.fillStyle = 'rgba(12,7,38,0.3)';
      roundRect(ctx, px - 40, py + 14, 80, 10, 5);
      ctx.fill();
      ctx.fillStyle = '#8E5BD9';
      roundRect(ctx, px - 40, py + 14, 80 * this.charge, 10, 5);
      ctx.fill();
    }
    this.hud(ctx, `Giggles: ${this.caught} of ${this.target}   ${Math.max(0, Math.ceil(this.limit - this.t))}s`);
  }
}
