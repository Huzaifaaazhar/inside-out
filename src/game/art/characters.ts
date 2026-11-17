import type { Ctx } from '../../engine/draw';
import { circle, ellipse, glow, mixHex, rgba } from '../../engine/draw';
import { TAU, clamp } from '../../engine/math';
import type { EmotionId } from '../content/emotions';
import { EMOTIONS } from '../content/emotions';

export type Pose = 'idle' | 'talk' | 'cheer' | 'slump' | 'ability' | 'scared' | 'point';

export interface CharState {
  t: number;
  /** Walk cycle phase in radians. */
  walk: number;
  moving: boolean;
  facing: 1 | -1;
  pose: Pose;
  /** Seconds since the pose began. */
  poseT: number;
  /** Where the eyes look horizontally, -1..1. */
  look: number;
  talking: boolean;
  seed: number;
  /** 0..1 selection glow under the feet. */
  highlight: number;
  /** Optional colour tint override (used for "faded" looks). */
  alpha?: number;
}

export const defaultCharState = (seed = 0): CharState => ({
  t: 0,
  walk: 0,
  moving: false,
  facing: 1,
  pose: 'idle',
  poseT: 0,
  look: 0,
  talking: false,
  seed,
  highlight: 0,
});

const INK = '#1d1240';

function limb(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, w: number, color: string) {
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

/** A bent limb through a midpoint (elbow/knee). */
function limb2(ctx: Ctx, x1: number, y1: number, mx: number, my: number, x2: number, y2: number, w: number, color: string) {
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.quadraticCurveTo(mx, my, x2, y2);
  ctx.stroke();
}

function blinkAmount(t: number, seed: number) {
  const period = 3.2 + (seed % 7) * 0.4;
  const p = (t + seed * 1.37) % period;
  return p < 0.13 ? Math.sin((p / 0.13) * Math.PI) : 0;
}

interface EyeOpts {
  r: number;
  pupil: number;
  look: number;
  lookY?: number;
  blink: number;
  lid?: number; // 0 = wide open, 1 = closed (top lid droop)
  lidColor: string;
  lidTilt?: number; // radians, positive = outer edge down
  iris?: string;
  side: -1 | 1;
}

function eye(ctx: Ctx, x: number, y: number, o: EyeOpts) {
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x, y, o.r, o.r * 1.08, 0, 0, TAU);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.clip();
  const px = x + o.look * o.r * 0.45;
  const py = y + (o.lookY ?? 0) * o.r * 0.45;
  if (o.iris) circle(ctx, px, py, o.pupil * 1.55, o.iris);
  circle(ctx, px, py, o.pupil, INK);
  circle(ctx, px - o.pupil * 0.35, py - o.pupil * 0.4, o.pupil * 0.38, '#ffffff');
  // eyelid
  const lid = clamp(Math.max(o.lid ?? 0, o.blink), 0, 1);
  if (lid > 0.01) {
    ctx.translate(x, y);
    ctx.rotate((o.lidTilt ?? 0) * o.side);
    ctx.fillStyle = o.lidColor;
    ctx.fillRect(-o.r * 1.4, -o.r * 1.4, o.r * 2.8, o.r * 1.4 + (lid * 2 - 1) * o.r * 1.1);
  }
  ctx.restore();
  ctx.strokeStyle = rgba(INK, 0.55);
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.ellipse(x, y, o.r, o.r * 1.08, 0, 0, TAU);
  ctx.stroke();
}

function brow(ctx: Ctx, x: number, y: number, w: number, angle: number, thick: number, color = INK) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.strokeStyle = color;
  ctx.lineWidth = thick;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-w / 2, 0);
  ctx.quadraticCurveTo(0, -thick * 0.6, w / 2, 0);
  ctx.stroke();
  ctx.restore();
}

type MouthKind = 'smile' | 'grin' | 'open' | 'frown' | 'flat' | 'o' | 'shout' | 'smirk' | 'bleh' | 'wobble';

function mouth(ctx: Ctx, x: number, y: number, w: number, kind: MouthKind, talkOpen: number, color = INK) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = 'round';
  ctx.lineWidth = 2.6;
  const open = talkOpen;
  switch (kind) {
    case 'smile':
      if (open > 0.15) {
        ctx.beginPath();
        ctx.moveTo(x - w / 2, y);
        ctx.quadraticCurveTo(x, y + w * 0.35 + open * w * 0.4, x + w / 2, y);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(x - w / 2, y);
        ctx.quadraticCurveTo(x, y + w * 0.45, x + w / 2, y);
        ctx.stroke();
      }
      break;
    case 'grin': {
      ctx.beginPath();
      ctx.moveTo(x - w / 2, y - 2);
      ctx.quadraticCurveTo(x, y + w * 0.75 + open * 4, x + w / 2, y - 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ff7d8a';
      ctx.beginPath();
      ctx.ellipse(x, y + w * 0.36, w * 0.22, w * 0.12, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x - w * 0.3, y - 1.5, w * 0.6, 3.5);
      break;
    }
    case 'open':
    case 'o':
      ellipse(ctx, x, y + 2, w * (kind === 'o' ? 0.18 : 0.3), w * (0.18 + open * 0.2), color);
      break;
    case 'frown':
      ctx.beginPath();
      ctx.moveTo(x - w / 2, y + w * 0.18);
      ctx.quadraticCurveTo(x, y - w * 0.12 - open * 3, x + w / 2, y + w * 0.18);
      ctx.stroke();
      if (open > 0.3) ellipse(ctx, x, y + 2, w * 0.15, w * 0.1 * open, color);
      break;
    case 'flat':
      ctx.beginPath();
      ctx.moveTo(x - w / 2, y);
      ctx.lineTo(x + w / 2, y + (open > 0.3 ? 2 : 0));
      ctx.stroke();
      if (open > 0.3) ellipse(ctx, x, y + 2, w * 0.25, w * 0.08 * open + 1, color);
      break;
    case 'shout': {
      ctx.beginPath();
      ctx.roundRect(x - w / 2, y - w * 0.1, w, w * 0.45 + open * 4, 5);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x - w / 2 + 3, y - w * 0.1, w - 6, 4);
      ctx.fillRect(x - w / 2 + 3, y + w * 0.3 + open * 4 - 3, w - 6, 3);
      break;
    }
    case 'smirk':
      ctx.beginPath();
      ctx.moveTo(x - w / 2, y + 2);
      ctx.quadraticCurveTo(x + w * 0.1, y + 4 + open * 4, x + w / 2, y - 4);
      ctx.stroke();
      break;
    case 'bleh': {
      ctx.beginPath();
      ctx.moveTo(x - w / 2, y);
      ctx.quadraticCurveTo(x, y - 5, x + w / 2, y);
      ctx.stroke();
      ctx.fillStyle = '#ff6f8f';
      ctx.beginPath();
      ctx.ellipse(x + 2, y + 6, w * 0.2, w * 0.26, 0.2, 0, TAU);
      ctx.fill();
      break;
    }
    case 'wobble': {
      ctx.beginPath();
      const n = 6;
      for (let i = 0; i <= n; i++) {
        const px = x - w / 2 + (w * i) / n;
        const py = y + (i % 2 ? -2.5 : 2.5);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      break;
    }
  }
}

const talkOpen = (s: CharState) => (s.talking ? Math.abs(Math.sin(s.t * 14 + s.seed)) : 0);

function shadow(ctx: Ctx, w: number) {
  ellipse(ctx, 0, 0, w, w * 0.22, 'rgba(10,4,40,0.35)');
}

function selectionRing(ctx: Ctx, w: number, color: string, amt: number, t: number) {
  if (amt <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = amt;
  glow(ctx, 0, 0, w * 2.2, color, 0.8);
  ctx.strokeStyle = rgba(color, 0.9);
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 8]);
  ctx.lineDashOffset = -t * 30;
  ctx.beginPath();
  ctx.ellipse(0, 0, w * 1.35, w * 0.36, 0, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

// ───────────────────────────────── JOY: a sun-sprite ─────────────────────────────────
function drawJoy(ctx: Ctx, s: CharState) {
  const E = EMOTIONS.joy;
  const skin = '#FFE58A';
  const dress = '#FF9F43';
  const t = s.t;
  const bounce = s.moving ? Math.abs(Math.sin(s.walk)) * 14 : Math.sin(t * 3.2) * 2.2;
  const cheer = s.pose === 'cheer' || s.pose === 'ability';
  const hop = cheer ? Math.abs(Math.sin(s.poseT * 7)) * 16 * Math.max(0, 1 - s.poseT / 1.6) : 0;
  const y0 = -bounce - hop;

  glow(ctx, 0, -95 + y0, 120, E.color, 0.55);
  shadow(ctx, 26);
  selectionRing(ctx, 30, E.color, s.highlight, t);

  // legs and coral shoes
  const sw = s.moving ? Math.sin(s.walk) * 12 : 0;
  limb(ctx, -6, -40 + y0, -6 - sw, -4 + (s.moving ? Math.max(0, Math.sin(s.walk)) * -4 : 0), 6, skin);
  limb(ctx, 6, -40 + y0, 6 + sw, -4 + (s.moving ? Math.max(0, -Math.sin(s.walk)) * -4 : 0), 6, skin);
  ellipse(ctx, -6 - sw + 2, -3, 7, 4, '#FF6B5A');
  ellipse(ctx, 6 + sw + 2, -3, 7, 4, '#FF6B5A');

  // arms
  const armY = -92 + y0;
  if (cheer) {
    const wv = Math.sin(s.poseT * 12) * 6;
    limb2(ctx, -12, armY, -30, armY - 18, -26 + wv, armY - 44, 5.5, skin);
    limb2(ctx, 12, armY, 30, armY - 18, 26 - wv, armY - 44, 5.5, skin);
  } else if (s.pose === 'point' || s.talking) {
    const wv = Math.sin(t * 5) * 8;
    limb2(ctx, -12, armY, -26, armY + 10, -30, armY + 30, 5.5, skin);
    limb2(ctx, 12, armY, 30, armY - 6 + wv * 0.3, 42, armY - 22 + wv, 5.5, skin);
  } else {
    const sway = s.moving ? Math.sin(s.walk) * 10 : Math.sin(t * 2) * 3;
    limb2(ctx, -12, armY, -22, armY + 16, -24 - sway, armY + 34, 5.5, skin);
    limb2(ctx, 12, armY, 22, armY + 16, 24 + sway, armY + 34, 5.5, skin);
  }

  // tangerine swing dress with a cream sun motif
  ctx.save();
  ctx.translate(0, y0);
  const swish = s.moving ? Math.sin(s.walk * 2) * 3 : Math.sin(t * 2.4) * 1.5;
  ctx.beginPath();
  ctx.moveTo(-11, -98);
  ctx.quadraticCurveTo(-14, -70, -28 + swish, -40);
  ctx.quadraticCurveTo(0, -32, 28 + swish, -40);
  ctx.quadraticCurveTo(14, -70, 11, -98);
  ctx.closePath();
  const dg = ctx.createLinearGradient(0, -100, 0, -38);
  dg.addColorStop(0, mixHex(dress, '#ffffff', 0.2));
  dg.addColorStop(1, mixHex(dress, '#b34a00', 0.25));
  ctx.fillStyle = dg;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,248,225,0.85)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-24 + swish, -46);
  ctx.quadraticCurveTo(0, -39, 24 + swish, -46);
  ctx.stroke();
  circle(ctx, 0, -70, 6, '#FFF3D0');
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + t;
    limb(ctx, Math.cos(a) * 8, -70 + Math.sin(a) * 8, Math.cos(a) * 11, -70 + Math.sin(a) * 11, 2, '#FFF3D0');
  }
  ctx.restore();

  // neck + head
  const hy = -126 + y0;
  limb(ctx, 0, -100 + y0, 0, hy + 18, 6, skin);
  // sunburst: two rings of amber rays that turn slowly
  ctx.save();
  ctx.translate(0, hy - 2);
  for (let ring = 0; ring < 2; ring++) {
    const rays = ring ? 9 : 13;
    for (let i = 0; i < rays; i++) {
      const a = (i / rays) * TAU + t * (ring ? -0.25 : 0.35) + ring * 0.2;
      const len = (ring ? 30 : 40) + Math.sin(t * 4 + i * 1.7) * 3;
      ctx.fillStyle = ring ? '#FFD23F' : i % 2 ? '#FF9A1F' : '#FFB21F';
      ctx.beginPath();
      ctx.moveTo(Math.cos(a - 0.2) * 20, Math.sin(a - 0.2) * 20);
      ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len);
      ctx.lineTo(Math.cos(a + 0.2) * 20, Math.sin(a + 0.2) * 20);
      ctx.fill();
    }
  }
  ctx.restore();
  const hg = ctx.createRadialGradient(-6, hy - 8, 4, 0, hy, 28);
  hg.addColorStop(0, '#FFF6C9');
  hg.addColorStop(1, skin);
  circle(ctx, 0, hy, 25, hg);
  // face
  const f = s.facing * 3;
  const blink = blinkAmount(t, s.seed);
  eye(ctx, -9 + f, hy - 2, { r: 7.5, pupil: 3.6, iris: '#9a5410', look: s.look, blink, lidColor: skin, side: -1 });
  eye(ctx, 9 + f, hy - 2, { r: 7.5, pupil: 3.6, iris: '#9a5410', look: s.look, blink, lidColor: skin, side: 1 });
  brow(ctx, -9 + f, hy - 13, 10, -0.15, 2.4, '#c06a10');
  brow(ctx, 9 + f, hy - 13, 10, 0.15, 2.4, '#c06a10');
  // freckles
  for (const [fx, fy] of [
    [-15, 6],
    [-12, 9],
    [-17, 10],
    [15, 6],
    [12, 9],
    [17, 10],
  ])
    circle(ctx, fx + f, hy + fy, 1.2, 'rgba(200,110,40,0.6)');
  mouth(ctx, f, hy + 9, 14, cheer || s.talking ? 'grin' : 'smile', talkOpen(s));
}

// ───────────────────────────────── SADNESS: a raindrop in a long scarf ─────────────────────────────────
function drawSadness(ctx: Ctx, s: CharState) {
  const E = EMOTIONS.sadness;
  const t = s.t;
  const step = s.moving ? Math.sin(s.walk) : 0;
  const sway = s.moving ? step * 0.05 : Math.sin(t * 1.1 + s.seed) * 0.035;
  const slump = s.pose === 'slump' ? 6 : 0;
  const lift = s.pose === 'ability' ? Math.min(1, s.poseT * 2) : 0;
  const y0 = (s.moving ? Math.abs(step) * -3 : Math.sin(t * 1.4) * 1.5) + slump;
  const skin = '#6E9BFF';

  glow(ctx, 0, -60, 100, E.color, 0.4 + lift * 0.4);
  shadow(ctx, 30);
  selectionRing(ctx, 32, E.color, s.highlight, t);

  ctx.save();
  ctx.rotate(sway);
  // rain boots
  for (const side of [-1, 1]) {
    const bx = side * 12 + side * step * 5;
    ctx.fillStyle = '#1E3E9C';
    ctx.beginPath();
    ctx.roundRect(bx - 9, -24, 16, 22, 4);
    ctx.fill();
    ellipse(ctx, bx + 2, -3, 11, 5, '#1E3E9C');
    ctx.fillStyle = '#4A6FD6';
    ctx.fillRect(bx - 9, -24, 16, 4);
  }
  // arms (behind the body)
  const ay = -56 + y0;
  if (s.pose === 'ability') {
    limb2(ctx, -26, ay, -44, ay - 4, -36, ay - 22 - lift * 6, 6.5, skin);
    limb2(ctx, 26, ay, 44, ay - 4, 36, ay - 22 - lift * 6, 6.5, skin);
  } else {
    limb2(ctx, -28, ay, -38, ay + 14, -34 - step * 3, ay + 28 + slump, 6.5, skin);
    limb2(ctx, 28, ay, 38, ay + 14, 34 + step * 3, ay + 28 + slump, 6.5, skin);
  }
  // the droplet body (head and body are one shape)
  ctx.save();
  ctx.translate(0, y0);
  const tip = -132 + slump * 0.6 + Math.sin(t * 1.3) * 2;
  ctx.beginPath();
  ctx.moveTo(0, tip);
  ctx.bezierCurveTo(10, tip + 30, 40, -72, 40, -46);
  ctx.bezierCurveTo(40, -18, 22, -18, 0, -18);
  ctx.bezierCurveTo(-22, -18, -40, -18, -40, -46);
  ctx.bezierCurveTo(-40, -72, -10, tip + 30, 0, tip);
  const bg = ctx.createRadialGradient(-12, -78, 6, 0, -50, 70);
  bg.addColorStop(0, '#CFE0FF');
  bg.addColorStop(0.45, '#7FA8FF');
  bg.addColorStop(1, '#2F5FD8');
  ctx.fillStyle = bg;
  ctx.fill();
  // glassy highlight
  ellipse(ctx, -16, -86, 6, 14, 'rgba(255,255,255,0.55)', -0.4);
  // long knitted scarf, wrapped twice with a trailing end
  ctx.fillStyle = '#E4ECFF';
  ctx.beginPath();
  ctx.roundRect(-36, -60, 72, 14, 7);
  ctx.fill();
  ctx.fillStyle = '#A9C2FF';
  for (let i = -30; i < 34; i += 12) ctx.fillRect(i, -60, 5, 14);
  const flap = Math.sin(t * 1.8) * 3 + (s.moving ? -s.facing * 6 : 0);
  ctx.fillStyle = '#E4ECFF';
  ctx.beginPath();
  ctx.moveTo(14, -50);
  ctx.quadraticCurveTo(24 + flap, -30, 18 + flap, -6);
  ctx.lineTo(8 + flap, -8);
  ctx.quadraticCurveTo(14 + flap * 0.5, -30, 4, -50);
  ctx.fill();
  ctx.fillStyle = '#A9C2FF';
  ctx.fillRect(9 + flap, -16, 10, 4);
  ctx.restore();

  // face
  const hy = -84 + y0 + slump * 0.6;
  const f = s.facing * 2;
  const blink = blinkAmount(t, s.seed);
  const lid = s.pose === 'ability' ? 0.2 : 0.5;
  eye(ctx, -11 + f, hy, { r: 8, pupil: 3.6, look: s.look, lookY: 0.35, blink, lid, lidTilt: 0.4, lidColor: '#86ADFF', iris: '#1E3E9C', side: -1 });
  eye(ctx, 11 + f, hy, { r: 8, pupil: 3.6, look: s.look, lookY: 0.35, blink, lid, lidTilt: 0.4, lidColor: '#86ADFF', iris: '#1E3E9C', side: 1 });
  brow(ctx, -11 + f, hy - 12, 9, 0.4, 2.2, '#173285');
  brow(ctx, 11 + f, hy - 12, 9, -0.4, 2.2, '#173285');
  mouth(ctx, f, hy + 15, 9, s.pose === 'ability' ? 'smile' : 'frown', talkOpen(s) * 0.6);

  // her own little raincloud when things feel heavy
  if (s.pose === 'slump') {
    const ca = Math.min(1, s.poseT * 3);
    ctx.save();
    ctx.globalAlpha = ca;
    const cy = -170 + y0;
    ctx.fillStyle = '#8C93B8';
    ctx.beginPath();
    ctx.arc(-14, cy, 14, 0, TAU);
    ctx.arc(4, cy - 8, 18, 0, TAU);
    ctx.arc(22, cy, 12, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(190,210,255,0.8)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const dy = ((s.poseT * 80 + i * 12) % 34) + cy + 12;
      ctx.beginPath();
      ctx.moveTo(-14 + i * 11, dy);
      ctx.lineTo(-16 + i * 11, dy + 6);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
}

// ───────────────────────────────── ANGER: a small volcano ─────────────────────────────────
function drawAnger(ctx: Ctx, s: CharState) {
  const E = EMOTIONS.anger;
  const t = s.t;
  const step = s.moving ? Math.sin(s.walk) : 0;
  const stomp = s.moving ? Math.pow(Math.abs(Math.cos(s.walk)), 6) * 4 : 0;
  const fury = s.pose === 'ability' ? Math.max(0, 1 - s.poseT / 1.4) : 0;
  const heat = 0.35 + fury * 0.65 + (s.talking ? 0.25 : 0) + Math.sin(t * 3) * 0.08;
  const shake = (s.pose === 'ability' ? Math.sin(t * 60) * 2.2 * fury : 0) + (s.talking ? Math.sin(t * 40) * 0.6 : 0);
  const y0 = stomp;

  glow(ctx, 0, -55, 95 + fury * 60, E.color, 0.35 + fury * 0.5);
  shadow(ctx, 36);
  selectionRing(ctx, 36, E.color, s.highlight, t);

  ctx.save();
  ctx.translate(shake, 0);
  // stubby legs, charcoal sneakers
  limb(ctx, -14, -22 + y0, -14 - step * 6, -6, 10, '#5a140e');
  limb(ctx, 14, -22 + y0, 14 + step * 6, -6, 10, '#5a140e');
  ellipse(ctx, -16 - step * 6, -4, 13, 6, '#2b2b3a');
  ellipse(ctx, 16 + step * 6, -4, 13, 6, '#2b2b3a');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-24 - step * 6, -4, 16, 2);
  ctx.fillRect(8 + step * 6, -4, 16, 2);

  // arms
  const ay = -60 + y0;
  const rock = '#8F1A10';
  if (s.pose === 'ability') {
    const pump = Math.sin(s.poseT * 18) * 6 * fury;
    limb2(ctx, -30, ay, -50, ay - 8, -46, ay - 30 + pump, 10, rock);
    limb2(ctx, 30, ay, 50, ay - 8, 46, ay - 30 - pump, 10, rock);
    circle(ctx, -46, ay - 32 + pump, 8, rock);
    circle(ctx, 46, ay - 32 - pump, 8, rock);
  } else {
    limb2(ctx, -32, ay, -46, ay + 12, -42 - step * 4, ay + 30, 10, rock);
    limb2(ctx, 32, ay, 46, ay + 12, 42 + step * 4, ay + 30, 10, rock);
    circle(ctx, -42 - step * 4, ay + 32, 7.5, rock);
    circle(ctx, 42 + step * 4, ay + 32, 7.5, rock);
  }

  // volcano body: wide base, narrow crater top
  ctx.save();
  ctx.translate(0, y0);
  const top = -112;
  ctx.beginPath();
  ctx.moveTo(-42, -18);
  ctx.quadraticCurveTo(-46, -60, -24, top + 6);
  ctx.quadraticCurveTo(-20, top, -14, top);
  ctx.lineTo(14, top);
  ctx.quadraticCurveTo(20, top, 24, top + 6);
  ctx.quadraticCurveTo(46, -60, 42, -18);
  ctx.quadraticCurveTo(0, -10, -42, -18);
  const bg = ctx.createLinearGradient(0, top, 0, -14);
  bg.addColorStop(0, '#E8432F');
  bg.addColorStop(1, '#7E160D');
  ctx.fillStyle = bg;
  ctx.fill();
  // glowing magma cracks that pulse with temper
  ctx.strokeStyle = rgba('#FFB13B', clamp(heat, 0, 1));
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-30, -26);
  ctx.lineTo(-22, -40);
  ctx.lineTo(-28, -52);
  ctx.moveTo(26, -24);
  ctx.lineTo(20, -36);
  ctx.lineTo(30, -48);
  ctx.moveTo(-6, -20);
  ctx.lineTo(0, -30);
  ctx.stroke();
  // charcoal belt
  ctx.fillStyle = '#2b2b3a';
  ctx.beginPath();
  ctx.moveTo(-44, -32);
  ctx.quadraticCurveTo(0, -24, 44, -32);
  ctx.lineTo(43, -24);
  ctx.quadraticCurveTo(0, -16, -43, -24);
  ctx.fill();
  ctx.fillStyle = '#E7B76A';
  ctx.fillRect(-5, -30, 10, 8);
  // crater with molten glow
  ellipse(ctx, 0, top + 2, 15, 5, '#3a0a06');
  ellipse(ctx, 0, top + 2, 11, 3, rgba('#FFB13B', 0.5 + heat * 0.5));
  ctx.restore();

  // steam puffs, or a full eruption
  const hy = -78 + y0;
  if (fury > 0.05 || s.talking) {
    const flameAmt = 0.3 + fury * 1.3 + (s.talking ? 0.25 : 0);
    for (let i = 0; i < 5; i++) {
      const fx = -12 + i * 6;
      const fh = (12 + Math.sin(t * 18 + i * 2.1) * 4) * flameAmt * (i === 2 ? 1.6 : 1) * 2;
      const fg = ctx.createLinearGradient(0, top - fh + y0, 0, top + y0);
      fg.addColorStop(0, 'rgba(255,240,150,0)');
      fg.addColorStop(0.4, 'rgba(255,190,40,0.9)');
      fg.addColorStop(1, 'rgba(255,90,20,0.95)');
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.moveTo(fx - 5, top + 2 + y0);
      ctx.quadraticCurveTo(fx - 3 + Math.sin(t * 9 + i) * 3, top - fh * 0.6 + y0, fx + Math.sin(t * 11 + i) * 2, top - fh + y0);
      ctx.quadraticCurveTo(fx + 4, top - fh * 0.5 + y0, fx + 5, top + 2 + y0);
      ctx.fill();
    }
  } else {
    for (let i = 0; i < 3; i++) {
      const k = (t * 0.6 + i / 3) % 1;
      circle(ctx, Math.sin(k * 6 + i) * 6, top - 6 - k * 40 + y0, 5 + k * 8, `rgba(220,210,230,${0.35 * (1 - k)})`);
    }
  }
  // face
  const f = s.facing * 2;
  const blink = blinkAmount(t, s.seed);
  eye(ctx, -11 + f, hy, { r: 6.5, pupil: 3, look: s.look, blink, lid: 0.38, lidTilt: -0.45, lidColor: '#D93A26', side: -1 });
  eye(ctx, 11 + f, hy, { r: 6.5, pupil: 3, look: s.look, blink, lid: 0.38, lidTilt: -0.45, lidColor: '#D93A26', side: 1 });
  ctx.strokeStyle = '#3a0a06';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-20 + f, hy - 13);
  ctx.lineTo(-3 + f, hy - 6);
  ctx.lineTo(3 + f, hy - 6);
  ctx.lineTo(20 + f, hy - 13);
  ctx.stroke();
  mouth(ctx, f, hy + 14, 18, s.pose === 'ability' || s.talking ? 'shout' : s.pose === 'cheer' ? 'smirk' : 'flat', talkOpen(s));
  ctx.restore();
}

// ───────────────────────────────── FEAR: a lanky safety enthusiast ─────────────────────────────────
function drawFear(ctx: Ctx, s: CharState) {
  const E = EMOTIONS.fear;
  const t = s.t;
  const skin = '#B98BF5';
  const tremble = Math.sin(t * 38 + s.seed) * (s.pose === 'scared' ? 2 : 0.6);
  const step = s.moving ? Math.sin(s.walk) : 0;
  const tip = s.moving ? Math.abs(Math.sin(s.walk)) * 6 : 0;
  const scared = s.pose === 'scared';
  const scanning = s.pose === 'ability';
  const y0 = -tip;

  glow(ctx, 0, -100, 110, E.color, 0.4);
  shadow(ctx, 24);
  selectionRing(ctx, 28, E.color, s.highlight, t);

  ctx.save();
  ctx.translate(tremble, 0);
  // long legs with chunky knee pads
  const kneeIn = scared ? 6 : 0;
  const k1x = -10 + kneeIn - step * 6;
  const k2x = 10 - kneeIn + step * 6;
  limb2(ctx, -6, -66 + y0, k1x, -34 + y0, -10 - step * 12, -5, 4.5, '#3a1f78');
  limb2(ctx, 6, -66 + y0, k2x, -34 + y0, 10 + step * 12, -5, 4.5, '#3a1f78');
  ctx.fillStyle = '#F3EEFF';
  ctx.beginPath();
  ctx.roundRect(k1x - 6 + (k1x < -6 ? 2 : 0), -44 + y0, 12, 12, 4);
  ctx.roundRect(k2x - 6 - (k2x > 6 ? 2 : 0), -44 + y0, 12, 12, 4);
  ctx.fill();
  ellipse(ctx, -12 - step * 12, -4, 9, 4, '#120c2a');
  ellipse(ctx, 12 + step * 12, -4, 9, 4, '#120c2a');
  // lavender cardigan with big buttons
  ctx.save();
  ctx.translate(0, y0);
  ctx.beginPath();
  ctx.moveTo(-10, -120);
  ctx.quadraticCurveTo(-22, -92, -16, -62);
  ctx.lineTo(16, -62);
  ctx.quadraticCurveTo(22, -92, 10, -120);
  ctx.closePath();
  ctx.fillStyle = '#D9C2FF';
  ctx.fill();
  ctx.strokeStyle = '#8b5ad6';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -116);
  ctx.lineTo(0, -62);
  ctx.stroke();
  for (let i = 0; i < 3; i++) circle(ctx, 4, -106 + i * 14, 2.6, '#8b5ad6');
  ctx.fillStyle = '#7c4bd0';
  ctx.fillRect(-15, -68, 30, 6);
  ctx.restore();
  // arms; one hand holds a flashlight
  const ay = -112 + y0;
  const fl = (hx: number, hy: number, aim: number) => {
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(aim);
    ctx.fillStyle = '#5b5f73';
    ctx.beginPath();
    ctx.roundRect(-3, -4, 18, 8, 2);
    ctx.fill();
    ctx.fillStyle = '#c8ccd8';
    ctx.fillRect(13, -5, 5, 10);
    if (scanning) {
      const bg = ctx.createLinearGradient(18, 0, 160, 0);
      bg.addColorStop(0, 'rgba(255,250,210,0.75)');
      bg.addColorStop(1, 'rgba(255,250,210,0)');
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.moveTo(18, -4);
      ctx.lineTo(160, -40);
      ctx.lineTo(160, 40);
      ctx.lineTo(18, 4);
      ctx.fill();
    }
    ctx.restore();
  };
  if (scared) {
    const w = Math.sin(t * 30) * 2;
    limb2(ctx, -10, ay, -30, ay + 10, -18 + w, ay - 18, 4.5, skin);
    limb2(ctx, 10, ay, 30, ay + 10, 18 - w, ay - 18, 4.5, skin);
  } else if (scanning) {
    const sweep = Math.sin(s.poseT * 5) * 0.5;
    limb2(ctx, -10, ay, -24, ay + 22, -18, ay + 44, 4.5, skin);
    limb2(ctx, 10 * s.facing, ay, 24 * s.facing, ay + 8, 34 * s.facing, ay + 6, 4.5, skin);
    fl(34 * s.facing, ay + 6, (s.facing > 0 ? 0 : Math.PI) + sweep);
  } else {
    const sw = s.moving ? step * 10 : Math.sin(t * 2.5) * 2;
    limb2(ctx, -10, ay, -24, ay + 22, -18 - sw, ay + 44, 4.5, skin);
    limb2(ctx, 10, ay, 24, ay + 22, 18 + sw, ay + 44, 4.5, skin);
    fl(18 + sw, ay + 44, Math.PI / 2 - 0.3);
  }
  // neck
  limb(ctx, 0, -120 + y0, 0, -134 + y0, 6, skin);
  // head: tall oval
  const hy = -156 + y0;
  ctx.beginPath();
  ctx.ellipse(0, hy, 22, 28, 0, 0, TAU);
  const hg = ctx.createRadialGradient(-6, hy - 8, 4, 0, hy, 28);
  hg.addColorStop(0, '#E2CCFF');
  hg.addColorStop(1, skin);
  ctx.fillStyle = hg;
  ctx.fill();
  // bike helmet with vents and a chin strap
  const lift = scared ? -4 + Math.sin(t * 30) * 1.5 : 0;
  ctx.fillStyle = '#F3EEFF';
  ctx.beginPath();
  ctx.ellipse(0, hy - 14 + lift, 26, 22, 0, Math.PI, 0);
  ctx.lineTo(28, hy - 12 + lift);
  ctx.lineTo(-28, hy - 12 + lift);
  ctx.fill();
  ctx.fillStyle = '#8b5ad6';
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.ellipse(i * 9, hy - 26 + lift + Math.abs(i) * 2, 2.6, 7, i * 0.25, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = '#FF6B5A';
  ctx.fillRect(-26, hy - 15 + lift, 52, 3);
  ctx.strokeStyle = '#5b5f73';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-20, hy - 12);
  ctx.quadraticCurveTo(-16, hy + 22, 0, hy + 26);
  ctx.quadraticCurveTo(16, hy + 22, 20, hy - 12);
  ctx.stroke();
  // face
  const f = s.facing * 2;
  const dart = scared || scanning ? Math.sin(t * 17) : Math.sin(t * 2.3 + Math.sin(t * 5.1)) * 0.6;
  const blink = blinkAmount(t, s.seed);
  eye(ctx, -9 + f, hy + 1, { r: 9, pupil: 2.4, look: clamp(s.look + dart, -1, 1), blink, lidColor: skin, side: -1 });
  eye(ctx, 9 + f, hy + 1, { r: 9, pupil: 2.4, look: clamp(s.look + dart, -1, 1), blink, lidColor: skin, side: 1 });
  brow(ctx, -9 + f, hy - 11, 9, 0.45, 2, '#3a1f78');
  brow(ctx, 9 + f, hy - 11, 9, -0.45, 2, '#3a1f78');
  mouth(ctx, f, hy + 17, 12, s.talking ? 'open' : 'wobble', talkOpen(s));
  ctx.restore();
}

// ───────────────────────────────── DISGUST: a potted cactus with standards ─────────────────────────────────
function drawDisgust(ctx: Ctx, s: CharState) {
  const E = EMOTIONS.disgust;
  const t = s.t;
  const step = s.moving ? Math.sin(s.walk) : 0;
  const hip = s.moving ? Math.sin(s.walk) * 3 : 0;
  const y0 = s.moving ? -Math.abs(step) * 3 : 0;
  const nope = s.pose === 'ability';
  const tilt = (nope ? -0.12 : Math.sin(t * 0.9 + s.seed) * 0.04) * s.facing;

  glow(ctx, 0, -90, 100, E.color, 0.4);
  shadow(ctx, 26);
  selectionRing(ctx, 28, E.color, s.highlight, t);

  // little legs under the pot
  limb(ctx, -8, -20 + y0, -8 - step * 9, -6, 5, '#2E9E4D');
  limb(ctx, 8, -20 + y0, 8 + step * 9, -6, 5, '#2E9E4D');
  ellipse(ctx, -8 - step * 9 + 2, -4, 7, 4, '#7b3fb8');
  ellipse(ctx, 8 + step * 9 + 2, -4, 7, 4, '#7b3fb8');

  ctx.save();
  ctx.translate(hip, y0);
  ctx.rotate(tilt);
  // terracotta pot, worn like a skirt
  ctx.fillStyle = '#D9774B';
  ctx.beginPath();
  ctx.moveTo(-26, -58);
  ctx.lineTo(26, -58);
  ctx.lineTo(19, -18);
  ctx.lineTo(-19, -18);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#E8916A';
  ctx.beginPath();
  ctx.roundRect(-29, -64, 58, 12, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (let i = 0; i < 4; i++) circle(ctx, -12 + i * 8, -38 + (i % 2) * 6, 2, 'rgba(255,240,220,0.5)');

  // the cactus column (body and head together)
  const top = -150;
  ctx.beginPath();
  ctx.moveTo(-21, -62);
  ctx.lineTo(-21, top + 24);
  ctx.quadraticCurveTo(-21, top, 0, top);
  ctx.quadraticCurveTo(21, top, 21, top + 24);
  ctx.lineTo(21, -62);
  ctx.closePath();
  const cg = ctx.createLinearGradient(-22, 0, 22, 0);
  cg.addColorStop(0, '#2E9E4D');
  cg.addColorStop(0.45, '#6ED486');
  cg.addColorStop(1, '#2E9E4D');
  ctx.fillStyle = cg;
  ctx.fill();
  ctx.strokeStyle = 'rgba(20,90,45,0.45)';
  ctx.lineWidth = 2;
  for (const rx of [-11, 11]) {
    ctx.beginPath();
    ctx.moveTo(rx, -64);
    ctx.lineTo(rx, top + 18);
    ctx.stroke();
  }
  // tiny spines (her boundaries)
  ctx.strokeStyle = '#F1FFE8';
  ctx.lineWidth = 1.3;
  for (let i = 0; i < 9; i++) {
    const sx = i % 3 === 0 ? -17 : i % 3 === 1 ? 0 : 17;
    const sy = -72 - Math.floor(i / 3) * 20 - (i % 2) * 6;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + (sx < 0 ? -4 : sx > 0 ? 4 : 0), sy - 3);
    ctx.stroke();
  }

  // cactus arms: one on the hip, one that flicks out "nope"
  const armCol = '#4CB765';
  const flick = nope ? Math.min(1, s.poseT * 5) : 0;
  const gest = s.talking ? Math.sin(t * 4) * 0.25 : 0;
  // left arm: elbow out, hand on hip
  ctx.strokeStyle = armCol;
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(-20, -96);
  ctx.lineTo(-34, -90);
  ctx.lineTo(-22, -72);
  ctx.stroke();
  // right arm: a classic upturned cactus branch, or a hand held up
  ctx.save();
  ctx.translate(20, -100);
  ctx.rotate(-flick * 0.9 + gest);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(16, 0);
  ctx.lineTo(16, -22 - flick * 8);
  ctx.stroke();
  if (flick > 0.5) {
    ctx.fillStyle = armCol;
    ctx.beginPath();
    ctx.arc(16, -32, 8, 0, TAU);
    ctx.fill();
  }
  ctx.restore();

  // flower crown
  const fx = 6;
  const fy = top - 2;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + Math.sin(t) * 0.1;
    ellipse(ctx, fx + Math.cos(a) * 7, fy + Math.sin(a) * 5, 6, 4, '#FF7FB0', a);
  }
  circle(ctx, fx, fy, 4, '#FFE58A');

  // face
  const hy = top + 34;
  const f = s.facing * 2;
  const blink = blinkAmount(t, s.seed);
  const roll = !s.moving && !s.talking && (t + s.seed) % 7 < 0.9 ? -1 : 0;
  eye(ctx, -7 + f, hy, { r: 7, pupil: 3.2, iris: '#1F7A35', look: s.look, lookY: roll, blink, lid: nope ? 0.6 : 0.42, lidTilt: 0.1, lidColor: '#5CC874', side: -1 });
  eye(ctx, 9 + f, hy, { r: 7, pupil: 3.2, iris: '#1F7A35', look: s.look, lookY: roll, blink, lid: nope ? 0.6 : 0.42, lidTilt: 0.1, lidColor: '#5CC874', side: 1 });
  brow(ctx, -7 + f, hy - 11, 9, -0.05, 2.2, '#145a2a');
  brow(ctx, 9 + f, hy - 15, 9, -0.4, 2.2, '#145a2a');
  mouth(ctx, f + 1, hy + 15, 11, nope ? 'bleh' : s.talking ? 'flat' : 'smirk', talkOpen(s));
  ctx.restore();
}

const DRAWERS: Record<EmotionId, (ctx: Ctx, s: CharState) => void> = {
  joy: drawJoy,
  sadness: drawSadness,
  anger: drawAnger,
  fear: drawFear,
  disgust: drawDisgust,
};

/** Approximate top of each head, for speech bubbles and prompts. */
export const HEAD_Y: Record<EmotionId, number> = { joy: -172, sadness: -140, anger: -128, fear: -196, disgust: -162 };

export function drawEmotion(ctx: Ctx, id: EmotionId, x: number, y: number, s: CharState, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  if (s.alpha !== undefined) ctx.globalAlpha = s.alpha;
  DRAWERS[id](ctx, s);
  ctx.restore();
}

// ───────────────────────────── Mote, a Mind Worker ─────────────────────────────
export function drawMote(ctx: Ctx, x: number, y: number, t: number, sweeping: boolean, facing: 1 | -1, talking: boolean) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing, 1);
  ellipse(ctx, 0, 0, 26, 6, 'rgba(10,4,40,0.35)');
  const bob = Math.sin(t * 6) * (sweeping ? 3 : 1.2);
  // broom
  const sw = sweeping ? Math.sin(t * 6) * 0.35 : 0.1;
  ctx.save();
  ctx.translate(18, -40 + bob);
  ctx.rotate(0.5 + sw);
  limb(ctx, 0, 0, 0, 46, 4, '#a0703a');
  ctx.fillStyle = '#e8c070';
  ctx.beginPath();
  ctx.moveTo(-9, 44);
  ctx.lineTo(9, 44);
  ctx.lineTo(13, 60);
  ctx.lineTo(-13, 60);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // feet
  ellipse(ctx, -9, -3, 7, 4, '#5b2f6a');
  ellipse(ctx, 9, -3, 7, 4, '#5b2f6a');
  // fluffy body
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    circle(ctx, Math.cos(a) * 18, -30 + bob + Math.sin(a) * 18, 9, '#F7B8D8');
  }
  circle(ctx, 0, -30 + bob, 20, '#FBD0E5');
  // hard hat
  ctx.fillStyle = '#FFCF33';
  ctx.beginPath();
  ctx.arc(0, -46 + bob, 16, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(-20, -47 + bob, 40, 4);
  // face
  circle(ctx, -6, -32 + bob, 4.5, '#ffffff');
  circle(ctx, 6, -32 + bob, 4.5, '#ffffff');
  circle(ctx, -5, -31 + bob, 2.2, INK);
  circle(ctx, 7, -31 + bob, 2.2, INK);
  mouth(ctx, 1, -22 + bob, 8, talking ? 'open' : 'smile', talking ? Math.abs(Math.sin(t * 14)) : 0);
  ctx.restore();
}
