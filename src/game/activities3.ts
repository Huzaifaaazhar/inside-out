/**
 * Part 3 activities: imagining a bridge out of nothing, and running the cues for a dream take.
 */
import type { Ctx } from '../engine/draw';
import { FONT_BODY, FONT_DISPLAY, circle, ellipse, glow, rgba, roundRect } from '../engine/draw';
import { TAU, clamp, easeOutBack } from '../engine/math';
import { Activity } from './activities';
import type { MGInput } from './scenario/minigames';

// ───────────────────────────── Imagination Land: imagine a bridge ─────────────────────────────

type Shape = 'arch' | 'plank' | 'spiral' | 'steps' | 'ring';

interface Idea {
  label: string;
  shape: Shape;
}

const IDEAS: Idea[] = [
  { label: 'A sleeping dragon', shape: 'arch' },
  { label: 'A rainbow', shape: 'arch' },
  { label: 'A giant ruler', shape: 'plank' },
  { label: 'A really long spoon', shape: 'plank' },
  { label: 'A curly straw', shape: 'spiral' },
  { label: 'A snail shell', shape: 'spiral' },
  { label: 'Stacked cake slices', shape: 'steps' },
  { label: 'Piano keys', shape: 'steps' },
  { label: 'A doughnut', shape: 'ring' },
  { label: 'A hula hoop', shape: 'ring' },
];
const SHAPES: Shape[] = ['arch', 'plank', 'spiral', 'steps', 'ring'];

function drawShape(ctx: Ctx, shape: Shape, x: number, y: number, s: number, fill: string, stroke: string, t = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 6;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  switch (shape) {
    case 'arch':
      ctx.arc(0, 30, 70, Math.PI, 0);
      ctx.arc(0, 30, 40, 0, Math.PI, true);
      ctx.closePath();
      break;
    case 'plank':
      ctx.roundRect(-80, -12, 160, 24, 10);
      break;
    case 'spiral':
      for (let k = 0; k <= 60; k++) {
        const a = k * 0.32 + t;
        const r = 6 + k * 1.05;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r * 0.7);
      }
      ctx.stroke();
      ctx.restore();
      return;
    case 'steps':
      ctx.moveTo(-70, 40);
      for (let k = 0; k < 4; k++) {
        ctx.lineTo(-70 + k * 35, 40 - (k + 1) * 22);
        ctx.lineTo(-35 + k * 35, 40 - (k + 1) * 22);
      }
      ctx.lineTo(70, 40);
      ctx.closePath();
      break;
    case 'ring':
      ctx.arc(0, 0, 55, 0, TAU);
      ctx.moveTo(28, 0);
      ctx.arc(0, 0, 28, 0, TAU, true);
      break;
  }
  ctx.fill('evenodd');
  ctx.stroke();
  ctx.restore();
}

export class BridgeBuilder extends Activity {
  readonly title = 'Imagine a bridge';
  readonly instruction = 'The fog of nothing is closing in. Pick the imagined thing whose shape fits the gap: press 1, 2 or 3, or click it.';
  readonly accent = '#7AE7C7';
  readonly mode = 'tap' as const;
  readonly primaryLabel = 'Imagine';
  private round = 0;
  private readonly rounds = 5;
  private target: Shape = 'arch';
  private options: Idea[] = [];
  private roundT = 0;
  private limit = 7;
  private pick = 1;
  private built: (Idea & { ok: boolean })[] = [];
  private flash = 0;
  private lastOk = true;

  constructor(...a: ConstructorParameters<typeof Activity>) {
    super(...a);
    this.newRound();
  }

  private newRound() {
    this.target = SHAPES[Math.floor(Math.random() * SHAPES.length)];
    const right = IDEAS.filter((i) => i.shape === this.target);
    const wrong = IDEAS.filter((i) => i.shape !== this.target).sort(() => Math.random() - 0.5);
    const opts = [right[Math.floor(Math.random() * right.length)], wrong[0], wrong.find((w) => w.shape !== wrong[0].shape) ?? wrong[1]];
    this.options = opts.sort(() => Math.random() - 0.5);
    this.roundT = 0;
    this.limit = Math.max(4, 7.5 - this.round * 0.7);
    this.pick = 1;
  }

  private choose(i: number) {
    const idea = this.options[i];
    if (!idea) return;
    const ok = idea.shape === this.target;
    this.built.push({ ...idea, ok });
    this.lastOk = ok;
    this.flash = 1;
    if (ok) {
      this.sfx.ability('joy');
      this.emit(0.2 + this.round * 0.15, 0.55, ['#7AE7C7', '#FFE45E', '#FF7FB0'], 'star', 26);
    } else this.sfx.fail();
    this.round++;
    if (this.round >= this.rounds) {
      const good = this.built.filter((b) => b.ok).length;
      this.finish(good / this.rounds, good >= 4 ? 'A bridge of pure imagination' : good >= 3 ? 'Wobbly, but it holds' : 'Mostly fog');
    } else this.newRound();
  }

  protected update(dt: number, i: MGInput) {
    this.roundT += dt;
    this.flash = Math.max(0, this.flash - dt * 2);
    this.progress = this.round / this.rounds;
    for (const k of this.keys) {
      if (k === 'Digit1' || k === 'Digit2' || k === 'Digit3') return this.choose(Number(k.slice(-1)) - 1);
      if (k === 'ArrowLeft' || k === 'KeyA') this.pick = (this.pick + 2) % 3;
      if (k === 'ArrowRight' || k === 'KeyD') this.pick = (this.pick + 1) % 3;
    }
    if (i.primaryPressed) return this.choose(this.pick);
    if (i.pressed && i.inside && i.v > 0.68) {
      const k = Math.floor(i.u * 3);
      if (k >= 0 && k < 3) return this.choose(k);
    }
    if (this.roundT > this.limit) {
      // the fog wins this round
      this.built.push({ label: 'fog', shape: this.target, ok: false });
      this.lastOk = false;
      this.flash = 1;
      this.sfx.soft();
      this.round++;
      if (this.round >= this.rounds) {
        const good = this.built.filter((b) => b.ok).length;
        this.finish(good / this.rounds, good >= 3 ? 'Wobbly, but it holds' : 'Mostly fog');
      } else this.newRound();
    }
  }

  render(ctx: Ctx) {
    const r = this.rect;
    this.frame(ctx, '#FFF4FB');
    // the gap and the bridge so far
    const gy = r.y + r.h * 0.42;
    ctx.fillStyle = '#c9b6ef';
    roundRect(ctx, r.x + 20, gy, 80, 60, 10);
    ctx.fill();
    roundRect(ctx, r.x + r.w - 100, gy, 80, 60, 10);
    ctx.fill();
    const segW = (r.w - 200) / this.rounds;
    for (let k = 0; k < this.rounds; k++) {
      const cx = r.x + 100 + segW * (k + 0.5);
      const b = this.built[k];
      if (b) {
        if (b.ok) drawShape(ctx, b.shape, cx, gy + 20, 0.55, '#FFE45E', '#2b1846', this.t);
        else {
          glow(ctx, cx, gy + 20, 50, '#cfc8dc', 0.6);
          ellipse(ctx, cx, gy + 24, 44, 14, 'rgba(160,150,180,0.6)');
        }
      } else if (k === this.round) {
        // the silhouette to fill
        ctx.save();
        ctx.setLineDash([8, 8]);
        drawShape(ctx, this.target, cx, gy + 20, 0.55, 'rgba(43,24,70,0.12)', 'rgba(43,24,70,0.6)', 0);
        ctx.restore();
        // fog creeping in from both sides
        const k2 = clamp(this.roundT / this.limit, 0, 1);
        const fg = ctx.createRadialGradient(cx, gy + 20, 10, cx, gy + 20, 140);
        fg.addColorStop(0, `rgba(210,205,225,${k2 * 0.9})`);
        fg.addColorStop(1, 'rgba(210,205,225,0)');
        ctx.fillStyle = fg;
        ctx.fillRect(cx - 140, gy - 120, 280, 280);
      }
    }
    // three imagined options
    this.options.forEach((o, k) => {
      const ox = r.x + r.w * (0.18 + k * 0.32);
      const oy = r.y + r.h * 0.82;
      const on = k === this.pick;
      ctx.fillStyle = on ? '#ffffff' : 'rgba(255,255,255,0.7)';
      roundRect(ctx, ox - 120, oy - 70, 240, 140, 24);
      ctx.fill();
      ctx.strokeStyle = on ? '#2b1846' : 'rgba(43,24,70,0.25)';
      ctx.lineWidth = on ? 4 : 2;
      ctx.stroke();
      drawShape(ctx, o.shape, ox, oy - 14, 0.42, ['#FF7FB0', '#7AE7C7', '#FFE45E'][k], '#2b1846', this.t);
      ctx.fillStyle = '#2b1846';
      ctx.font = `800 18px ${FONT_BODY}`;
      ctx.textAlign = 'center';
      ctx.fillText(`${k + 1}. ${o.label}`, ox, oy + 52);
    });
    if (this.flash > 0) {
      ctx.save();
      ctx.globalAlpha = this.flash;
      ctx.font = `800 40px ${FONT_DISPLAY}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = this.lastOk ? '#2a9d6a' : '#8d8a9e';
      ctx.fillText(this.lastOk ? 'It fits!' : 'Swallowed by fog', r.x + r.w / 2, gy - 50);
      ctx.restore();
    }
    this.hud(ctx, `Piece ${Math.min(this.round + 1, this.rounds)} of ${this.rounds}`);
  }
}

// ───────────────────────────── Dream Productions: the dream take ─────────────────────────────

const CUES = [
  { label: 'Lights', color: '#FFCF33', key: '1' },
  { label: 'Props', color: '#FF7FB0', key: '2' },
  { label: 'Sound', color: '#7FC8FF', key: '3' },
];

interface Cue {
  lane: number;
  t: number; // when it should be hit
  hit: 'none' | 'good' | 'miss';
}

export class DreamTake extends Activity {
  readonly title = 'Shoot tonight’s dream';
  readonly instruction = 'Cues slide toward the line. When one reaches it, press its number (1 Lights, 2 Props, 3 Sound), or tap its lane.';
  readonly accent = '#FFCF33';
  readonly mode = 'none' as const;
  private cues: Cue[] = [];
  private readonly speed = 0.32; // screen widths per second
  private good = 0;
  private flashLane = -1;
  private flashT = 0;
  private flashOk = true;
  private readonly length: number;

  constructor(...a: ConstructorParameters<typeof Activity>) {
    super(...a);
    let t = 2.2;
    for (let i = 0; i < 14; i++) {
      this.cues.push({ lane: Math.floor(Math.random() * 3), t, hit: 'none' });
      t += 0.75 + Math.random() * 0.7;
    }
    this.length = t + 1.4;
  }

  private press(lane: number) {
    // the closest unhit cue in this lane, within the window
    let best: Cue | null = null;
    let bd = 0.32;
    for (const c of this.cues) {
      if (c.lane !== lane || c.hit !== 'none') continue;
      const d = Math.abs(c.t - this.t);
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
    this.flashLane = lane;
    this.flashT = 0.3;
    if (best) {
      best.hit = 'good';
      this.good++;
      this.flashOk = true;
      this.sfx.blip(1 + lane * 0.25);
      this.emit(0.2, 0.25 + lane * 0.25, [CUES[lane].color, '#ffffff'], 'spark', 12);
    } else {
      this.flashOk = false;
      this.sfx.tick();
    }
  }

  protected update(dt: number, i: MGInput) {
    this.flashT = Math.max(0, this.flashT - dt);
    for (const k of this.keys) if (k === 'Digit1' || k === 'Digit2' || k === 'Digit3') this.press(Number(k.slice(-1)) - 1);
    if (i.pressed && i.inside && i.v > 0.12 && i.v < 0.88) this.press(clamp(Math.floor((i.v - 0.12) / 0.25), 0, 2));
    for (const c of this.cues) if (c.hit === 'none' && this.t > c.t + 0.32) c.hit = 'miss';
    this.progress = clamp(this.t / this.length, 0, 1);
    if (this.t >= this.length) {
      const q = this.good / this.cues.length;
      this.finish(q, q >= 0.8 ? 'That’s a wrap!' : q >= 0.5 ? 'Good enough for a dream' : 'A very strange dream');
    }
  }

  render(ctx: Ctx) {
    const r = this.rect;
    this.frame(ctx, '#1a1636');
    const lineX = r.x + r.w * 0.2;
    CUES.forEach((c, k) => {
      const ly = r.y + r.h * (0.25 + k * 0.25);
      ctx.fillStyle = rgba(c.color, 0.12);
      roundRect(ctx, r.x + 20, ly - 44, r.w - 40, 88, 20);
      ctx.fill();
      const on = this.flashLane === k && this.flashT > 0;
      if (on) glow(ctx, lineX, ly, 90, this.flashOk ? c.color : '#ffffff', 0.8);
      ctx.fillStyle = c.color;
      ctx.font = `800 20px ${FONT_BODY}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${c.key}  ${c.label}`, r.x + 40, ly);
    });
    // the hit line
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.moveTo(lineX, r.y + r.h * 0.12);
    ctx.lineTo(lineX, r.y + r.h * 0.88);
    ctx.stroke();
    ctx.setLineDash([]);
    for (const c of this.cues) {
      const x = lineX + (c.t - this.t) * this.speed * r.w;
      if (x < r.x - 40 || x > r.x + r.w + 40) continue;
      const ly = r.y + r.h * (0.25 + c.lane * 0.25);
      const col = CUES[c.lane].color;
      const s = c.hit === 'good' ? easeOutBack(clamp(1 - (this.t - c.t) * 3, 0, 1)) : 1;
      if (c.hit === 'good' && s <= 0.01) continue;
      ctx.globalAlpha = c.hit === 'miss' ? 0.3 : 1;
      circle(ctx, x, ly, 26 * s, col);
      ctx.fillStyle = '#1a1636';
      ctx.font = `800 20px ${FONT_DISPLAY}`;
      ctx.textAlign = 'center';
      ctx.fillText(CUES[c.lane].key, x, ly + 1);
      ctx.globalAlpha = 1;
    }
    this.hud(ctx, `Cues hit: ${this.good} of ${this.cues.length}`);
  }
}
