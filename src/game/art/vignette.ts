/**
 * Vignettes: small animated scenes from Riley's life, drawn in code.
 * Used for memory replays, scenario openings and the moment-by-moment view on the HQ screen.
 * Everything is in rect-relative units: x/y in 0..1 of the frame, people sized from frame height.
 */
import type { Ctx } from '../../engine/draw';
import { FONT_BODY, circle, ellipse, glow, mixHex, rgba, roundRect, wrapText } from '../../engine/draw';
import { TAU, clamp, hash, lerp } from '../../engine/math';
import type { EmotionId } from '../content/emotions';
import type { Rect } from './screen';

export type Kit =
  | 'kitchen'
  | 'bedroom'
  | 'livingroom'
  | 'classroom'
  | 'cafeteria'
  | 'hallway'
  | 'rink'
  | 'park'
  | 'street'
  | 'car'
  | 'snow'
  | 'stage'
  | 'phone'
  | 'yard'
  | 'locker';

export type ActorKind = 'riley' | 'mum' | 'dad' | 'dani' | 'priya' | 'theo' | 'coach' | 'grandpa' | 'grandma' | 'kidA' | 'kidB' | 'kidC' | 'dog' | 'marco';
export type VPose =
  | 'stand'
  | 'walk'
  | 'run'
  | 'sit'
  | 'cry'
  | 'cheer'
  | 'hug'
  | 'point'
  | 'slump'
  | 'ride'
  | 'skate'
  | 'shoot'
  | 'phone'
  | 'wave'
  | 'arms'
  | 'dance'
  | 'sleep'
  | 'eat'
  | 'shout'
  | 'kneel'
  | 'hold';
export type Mood = 'happy' | 'sad' | 'angry' | 'scared' | 'gross' | 'calm' | 'shock';
export type PropKind =
  | 'box'
  | 'photo'
  | 'puck'
  | 'trophy'
  | 'pancakes'
  | 'vase'
  | 'shards'
  | 'shovel'
  | 'tshirt'
  | 'fort'
  | 'olive'
  | 'plate'
  | 'harmonica'
  | 'flyer'
  | 'tray'
  | 'balloon'
  | 'icecream'
  | 'anthill'
  | 'cake'
  | 'sprouts'
  | 'note'
  | 'phoneProp'
  | 'microphone'
  | 'tv';

/** [time, x, pose?, facing?, mood?, y?] */
export type AKey = [number, number, VPose?, (1 | -1)?, Mood?, number?];
export interface ActorTrack {
  who: ActorKind;
  keys: AKey[];
  scale?: number;
}
/** [time, x, y, scale?, rotation?, alpha?] */
export type PKey = [number, number, number, number?, number?, number?];
export interface PropTrack {
  what: PropKind;
  keys: PKey[];
  n?: number;
}
export interface VCaption {
  t: number;
  text: string;
}
export interface VignetteScript {
  kit: Kit;
  dur: number;
  night?: boolean;
  fx?: 'rain' | 'snow' | 'thunder' | 'confetti' | 'stars' | 'sparkle' | null;
  actors: ActorTrack[];
  props?: PropTrack[];
  captions?: VCaption[];
}

export interface VignetteOpts {
  lens?: EmotionId | null;
  /** 0..1, how washed-out the memory is (faded / forgotten). */
  fade?: number;
  captions?: boolean;
  /** Hold on a single moment instead of looping (used as a backdrop). */
  freezeAt?: number;
}

// ───────────────────────────── people ─────────────────────────────

interface Look {
  skin: string;
  hair: string;
  style: 'ponytail' | 'bun' | 'short' | 'curly' | 'bob' | 'braid' | 'cap' | 'bald';
  top: string;
  bottom: string;
  kid: boolean;
  beard?: string;
  glasses?: boolean;
}

const LOOKS: Record<Exclude<ActorKind, 'dog'>, Look> = {
  riley: { skin: '#f2c29b', hair: '#5a3418', style: 'ponytail', top: '#FF8A5B', bottom: '#3b4a7a', kid: true },
  mum: { skin: '#d9a27a', hair: '#2b1a12', style: 'bun', top: '#4FA98A', bottom: '#3a3550', kid: false },
  dad: { skin: '#e8b48c', hair: '#7a4a2a', style: 'short', top: '#3D6FB6', bottom: '#4a4a5a', kid: false, beard: '#7a4a2a', glasses: true },
  dani: { skin: '#f3d0b0', hair: '#c8552a', style: 'bob', top: '#9B6BDB', bottom: '#2f3a5a', kid: true },
  priya: { skin: '#c58b5e', hair: '#1a1020', style: 'braid', top: '#3CC6B8', bottom: '#3a3550', kid: true },
  theo: { skin: '#8d5a3b', hair: '#2a1a12', style: 'curly', top: '#FF8A3D', bottom: '#3b4a7a', kid: true },
  coach: { skin: '#b07850', hair: '#E63946', style: 'cap', top: '#E63946', bottom: '#22263a', kid: false },
  grandpa: { skin: '#e8b48c', hair: '#dcdcdc', style: 'short', top: '#8a6a4a', bottom: '#4a4a5a', kid: false, glasses: true },
  grandma: { skin: '#e2a888', hair: '#e0e0e8', style: 'bun', top: '#B57BEB', bottom: '#4a3a5a', kid: false },
  kidA: { skin: '#e8b48c', hair: '#e0b040', style: 'ponytail', top: '#F7B32B', bottom: '#3a3550', kid: true },
  kidB: { skin: '#6b4430', hair: '#1a1210', style: 'braid', top: '#E8516A', bottom: '#2f3a5a', kid: true },
  kidC: { skin: '#f0c8a0', hair: '#3a2a1a', style: 'short', top: '#52C46B', bottom: '#3b4a7a', kid: true },
  marco: { skin: '#d9a27a', hair: '#2a1a12', style: 'short', top: '#3D7BFF', bottom: '#3a3550', kid: true },
};

const INK = '#22163f';

function line(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, w: number, c: string) {
  ctx.strokeStyle = c;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function face(ctx: Ctx, x: number, y: number, r: number, mood: Mood, t: number, facing: number, seed: number) {
  const ex = r * 0.36;
  const ey = y - r * 0.05;
  const fx = facing * r * 0.12;
  const blink = (t * 0.8 + seed) % 3.7 < 0.1;
  ctx.fillStyle = INK;
  ctx.strokeStyle = INK;
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(1.2, r * 0.1);
  for (const s of [-1, 1]) {
    const cx = x + fx + s * ex;
    if (blink || mood === 'calm') {
      ctx.beginPath();
      ctx.arc(cx, ey, r * 0.12, Math.PI * 0.1, Math.PI * 0.9);
      ctx.stroke();
    } else if (mood === 'shock' || mood === 'scared') {
      circle(ctx, cx, ey, r * 0.16, '#fff');
      circle(ctx, cx, ey, r * 0.08, INK);
    } else circle(ctx, cx, ey, r * 0.11, INK);
    // brows
    const tilt = mood === 'sad' || mood === 'scared' ? 0.4 : mood === 'angry' ? -0.45 : mood === 'gross' ? (s < 0 ? -0.2 : 0.3) : 0;
    ctx.save();
    ctx.translate(cx, ey - r * 0.3);
    ctx.rotate(tilt * s * -1);
    ctx.beginPath();
    ctx.moveTo(-r * 0.14, 0);
    ctx.lineTo(r * 0.14, 0);
    ctx.stroke();
    ctx.restore();
  }
  const my = y + r * 0.42;
  const mx = x + fx;
  ctx.beginPath();
  switch (mood) {
    case 'happy':
      ctx.moveTo(mx - r * 0.28, my - r * 0.05);
      ctx.quadraticCurveTo(mx, my + r * 0.32, mx + r * 0.28, my - r * 0.05);
      ctx.closePath();
      ctx.fill();
      break;
    case 'sad':
      ctx.moveTo(mx - r * 0.2, my + r * 0.1);
      ctx.quadraticCurveTo(mx, my - r * 0.1, mx + r * 0.2, my + r * 0.1);
      ctx.stroke();
      break;
    case 'angry':
      ctx.moveTo(mx - r * 0.22, my + r * 0.04);
      ctx.lineTo(mx + r * 0.22, my);
      ctx.stroke();
      break;
    case 'scared':
    case 'shock':
      ctx.ellipse(mx, my + r * 0.04, r * 0.12, r * 0.16, 0, 0, TAU);
      ctx.fill();
      break;
    case 'gross':
      ctx.moveTo(mx - r * 0.22, my);
      ctx.quadraticCurveTo(mx, my - r * 0.12, mx + r * 0.22, my + r * 0.04);
      ctx.stroke();
      circle(ctx, mx + r * 0.08, my + r * 0.1, r * 0.08, '#ff6f8f');
      break;
    default:
      ctx.moveTo(mx - r * 0.16, my);
      ctx.quadraticCurveTo(mx, my + r * 0.1, mx + r * 0.16, my);
      ctx.stroke();
  }
  circle(ctx, x + fx - r * 0.55, y + r * 0.2, r * 0.12, 'rgba(255,120,120,0.28)');
  circle(ctx, x + fx + r * 0.55, y + r * 0.2, r * 0.12, 'rgba(255,120,120,0.28)');
}

function hair(ctx: Ctx, L: Look, hx: number, hy: number, r: number, facing: number, t: number, back: boolean) {
  ctx.fillStyle = L.hair;
  const f = facing;
  switch (L.style) {
    case 'ponytail':
      if (back) {
        const sw = Math.sin(t * 4) * r * 0.15;
        ctx.beginPath();
        ctx.ellipse(hx - f * r * 1.05, hy - r * 0.1 + sw * 0.3, r * 0.32, r * 0.7, f * 0.5 + sw * 0.02, 0, TAU);
        ctx.fill();
        circle(ctx, hx - f * r * 0.8, hy - r * 0.45, r * 0.18, '#FFCF33');
      } else {
        ctx.beginPath();
        ctx.arc(hx, hy - r * 0.05, r * 1.04, Math.PI * 1.02, Math.PI * 1.98);
        ctx.fill();
      }
      break;
    case 'bun':
      if (back) circle(ctx, hx - f * r * 0.3, hy - r * 1.05, r * 0.42, L.hair);
      else {
        ctx.beginPath();
        ctx.arc(hx, hy - r * 0.05, r * 1.04, Math.PI * 1.0, Math.PI * 2.0);
        ctx.fill();
      }
      break;
    case 'short':
      if (!back) {
        ctx.beginPath();
        ctx.arc(hx, hy - r * 0.1, r * 1.02, Math.PI * 1.05, Math.PI * 1.95);
        ctx.fill();
      }
      break;
    case 'curly':
      if (back) for (let i = 0; i < 9; i++) {
        const a = Math.PI + (i / 8) * Math.PI;
        circle(ctx, hx + Math.cos(a) * r * 0.95, hy - r * 0.1 + Math.sin(a) * r * 0.9, r * 0.38, L.hair);
      }
      break;
    case 'bob':
      if (back) {
        ctx.beginPath();
        ctx.arc(hx, hy, r * 1.15, Math.PI * 0.9, Math.PI * 2.1);
        ctx.lineTo(hx + r * 1.15, hy + r * 0.6);
        ctx.lineTo(hx - r * 1.15, hy + r * 0.6);
        ctx.fill();
      }
      break;
    case 'braid':
      if (back) for (let i = 0; i < 5; i++) circle(ctx, hx - f * r * 0.9, hy + i * r * 0.4, r * (0.3 - i * 0.03), L.hair);
      else {
        ctx.beginPath();
        ctx.arc(hx, hy - r * 0.05, r * 1.04, Math.PI * 1.0, Math.PI * 2.0);
        ctx.fill();
      }
      break;
    case 'cap':
      if (!back) {
        ctx.beginPath();
        ctx.arc(hx, hy - r * 0.15, r * 1.02, Math.PI, 0);
        ctx.fill();
        ctx.fillRect(hx + (f > 0 ? 0 : -r * 1.6), hy - r * 0.2, r * 1.6, r * 0.22);
      }
      break;
    case 'bald':
      break;
  }
}

function drawDog(ctx: Ctx, x: number, y: number, h: number, pose: VPose, facing: number, t: number) {
  const s = h / 60;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing * s, s);
  const run = pose === 'run' || pose === 'walk';
  const bob = run ? Math.abs(Math.sin(t * 14)) * 4 : Math.sin(t * 3) * 1;
  ellipse(ctx, 0, 0, 30, 5, 'rgba(0,0,0,0.18)');
  const col = '#E3B062';
  for (const [lx, ph] of [
    [-16, 0],
    [16, Math.PI],
  ] as const) {
    const sw = run ? Math.sin(t * 14 + ph) * 8 : 0;
    line(ctx, lx, -14 - bob, lx + sw, 0, 6, '#c8954a');
  }
  ellipse(ctx, 0, -22 - bob, 26, 14, col);
  // tail
  line(ctx, -24, -26 - bob, -36, -38 - bob + Math.sin(t * 16) * 6, 5, col);
  // head
  circle(ctx, 24, -36 - bob, 13, col);
  ellipse(ctx, 18, -44 - bob, 6, 10, '#a0703a', 0.4);
  circle(ctx, 28, -38 - bob, 2.4, INK);
  circle(ctx, 36, -33 - bob, 3, INK);
  ctx.restore();
}

export function drawPerson(ctx: Ctx, who: ActorKind, x: number, y: number, frameH: number, pose: VPose, facing: 1 | -1, mood: Mood, t: number, seed = 0, scale = 1) {
  if (who === 'dog') return drawDog(ctx, x, y, frameH * 0.16 * scale, pose, facing, t);
  const L = LOOKS[who];
  const H = frameH * (L.kid ? 0.36 : 0.46) * scale;
  const r = H * 0.13;
  const f = facing;
  const lw = Math.max(2, H * 0.06);
  ctx.save();
  ctx.translate(x, y);
  ellipse(ctx, 0, 0, H * 0.18, H * 0.035, 'rgba(0,0,0,0.18)');

  if (pose === 'sleep') {
    ctx.rotate(-Math.PI / 2 * f);
    ctx.translate(-H * 0.5 * f, -H * 0.15);
  }

  let bob = 0;
  let lean = 0;
  let hip = H * 0.48;
  const walkPh = t * (pose === 'run' ? 13 : 8) + seed;
  if (pose === 'walk' || pose === 'run') bob = Math.abs(Math.sin(walkPh)) * H * 0.03;
  if (pose === 'cheer' || pose === 'dance') bob = Math.abs(Math.sin(t * 7 + seed)) * H * 0.06;
  if (pose === 'skate' || pose === 'shoot') {
    lean = 0.28 * f;
    hip = H * 0.4;
  }
  if (pose === 'sit' || pose === 'eat' || pose === 'ride') hip = H * 0.28;
  if (pose === 'kneel') hip = H * 0.24;
  if (pose === 'slump') lean = 0.12 * f;
  const shake = pose === 'cry' ? Math.sin(t * 30) * H * 0.006 : pose === 'shout' ? Math.sin(t * 40) * H * 0.004 : 0;
  ctx.translate(shake, -bob);

  // bike under a rider
  if (pose === 'ride') {
    const wr = H * 0.17;
    ctx.strokeStyle = '#2a2a3a';
    ctx.lineWidth = lw * 0.6;
    for (const wx of [-H * 0.28, H * 0.28]) {
      ctx.beginPath();
      ctx.arc(wx, -wr, wr, 0, TAU);
      ctx.stroke();
      for (let i = 0; i < 3; i++) {
        const a = t * 6 + (i / 3) * TAU;
        line(ctx, wx, -wr, wx + Math.cos(a) * wr, -wr + Math.sin(a) * wr, 1, '#666');
      }
    }
    line(ctx, -H * 0.28, -wr, 0, -H * 0.3, lw * 0.7, '#E8516A');
    line(ctx, 0, -H * 0.3, H * 0.28, -wr, lw * 0.7, '#E8516A');
    line(ctx, H * 0.18 * f, -H * 0.42, H * 0.28 * f, -wr, lw * 0.7, '#E8516A');
  }

  // legs
  const legC = L.bottom;
  const shoe = '#2a2a3a';
  if (pose === 'sit' || pose === 'eat') {
    line(ctx, 0, -hip, f * H * 0.2, -hip, lw * 1.3, legC);
    line(ctx, f * H * 0.2, -hip, f * H * 0.22, 0, lw * 1.2, legC);
    ellipse(ctx, f * H * 0.26, -lw * 0.3, lw, lw * 0.5, shoe);
  } else if (pose === 'ride') {
    const a = t * 6;
    for (const ph of [0, Math.PI]) {
      const px = Math.cos(a + ph) * H * 0.08;
      const py = -H * 0.2 + Math.sin(a + ph) * H * 0.08;
      line(ctx, 0, -hip - H * 0.08, px + f * H * 0.06, py, lw * 1.2, legC);
    }
  } else if (pose === 'kneel') {
    line(ctx, 0, -hip, f * H * 0.16, -hip * 0.4, lw * 1.2, legC);
    line(ctx, f * H * 0.16, -hip * 0.4, f * H * 0.1, 0, lw * 1.2, legC);
    line(ctx, 0, -hip, -f * H * 0.1, 0, lw * 1.2, legC);
  } else {
    const swing = pose === 'walk' || pose === 'run' ? Math.sin(walkPh) * H * (pose === 'run' ? 0.16 : 0.1) : pose === 'skate' ? Math.sin(t * 4) * H * 0.12 : 0;
    const spread = pose === 'cheer' ? H * 0.05 : H * 0.04;
    line(ctx, -spread, -hip, -spread - swing, 0, lw * 1.2, legC);
    line(ctx, spread, -hip, spread + swing, 0, lw * 1.2, legC);
    if (pose === 'skate' || pose === 'shoot') {
      line(ctx, -spread - swing - H * 0.06, 1, -spread - swing + H * 0.08, 1, lw * 0.5, '#cfd8e3');
      line(ctx, spread + swing - H * 0.06, 1, spread + swing + H * 0.08, 1, lw * 0.5, '#cfd8e3');
    }
    ellipse(ctx, -spread - swing + f * lw * 0.5, -lw * 0.3, lw, lw * 0.55, shoe);
    ellipse(ctx, spread + swing + f * lw * 0.5, -lw * 0.3, lw, lw * 0.55, shoe);
  }

  // torso
  ctx.save();
  ctx.translate(0, -hip);
  ctx.rotate(lean);
  const torsoH = H * (L.kid ? 0.3 : 0.34);
  const torsoW = H * (L.kid ? 0.2 : 0.22);
  ctx.fillStyle = L.top;
  roundRect(ctx, -torsoW / 2, -torsoH, torsoW, torsoH + lw * 0.5, [torsoW * 0.4, torsoW * 0.4, lw, lw]);
  ctx.fill();
  if (who === 'riley') {
    // hoodie pocket and strings
    ctx.fillStyle = rgba('#ffffff', 0.18);
    roundRect(ctx, -torsoW * 0.3, -torsoH * 0.38, torsoW * 0.6, torsoH * 0.22, 3);
    ctx.fill();
  }
  if (who === 'coach') circle(ctx, f * torsoW * 0.15, -torsoH * 0.75, lw * 0.6, '#cfd8e3');

  // arms
  const sx = torsoW * 0.42;
  const sy = -torsoH * 0.85;
  const arm = H * 0.26;
  const skin = L.skin;
  const armC = L.top;
  const drawArm = (side: -1 | 1, ang: number, elbow = 0.2) => {
    const ax = side * sx;
    const ex = ax + Math.sin(ang) * arm * 0.5;
    const ey = sy + Math.cos(ang) * arm * 0.5;
    const hx = ex + Math.sin(ang + elbow * side) * arm * 0.5;
    const hy = ey + Math.cos(ang + elbow * side) * arm * 0.5;
    line(ctx, ax, sy, ex, ey, lw, armC);
    line(ctx, ex, ey, hx, hy, lw * 0.9, armC);
    circle(ctx, hx, hy, lw * 0.6, skin);
    return { hx, hy };
  };
  const sw = Math.sin(walkPh) * 0.5;
  switch (pose) {
    case 'walk':
    case 'run':
      drawArm(-1, -sw * (pose === 'run' ? 1.4 : 1));
      drawArm(1, sw * (pose === 'run' ? 1.4 : 1));
      break;
    case 'cheer':
      drawArm(-1, Math.PI - 0.4 + Math.sin(t * 9) * 0.2);
      drawArm(1, Math.PI + 0.4 - Math.sin(t * 9) * 0.2);
      break;
    case 'dance':
      drawArm(-1, Math.PI - 0.6 + Math.sin(t * 6) * 0.7);
      drawArm(1, Math.PI + 0.6 + Math.sin(t * 6 + 1) * 0.7);
      break;
    case 'wave':
      drawArm(-f as -1 | 1, 0.15);
      drawArm(f as -1 | 1, Math.PI * f - 0.3 * f + Math.sin(t * 10) * 0.35);
      break;
    case 'hug':
      drawArm(-1, f * 1.4, -0.5);
      drawArm(1, f * 1.6, 0.5);
      break;
    case 'point':
      drawArm(-f as -1 | 1, 0.1);
      drawArm(f as -1 | 1, f * 1.55, 0);
      break;
    case 'cry': {
      drawArm(-1, 2.6, 1.2);
      drawArm(1, -2.6, -1.2);
      break;
    }
    case 'phone': {
      drawArm(-f as -1 | 1, 0.1);
      const h = drawArm(f as -1 | 1, f * 2.6, 1.0 * f);
      ctx.fillStyle = '#2a2a3a';
      roundRect(ctx, h.hx - lw * 0.5, h.hy - lw * 1.4, lw, lw * 2, 2);
      ctx.fill();
      break;
    }
    case 'arms':
      line(ctx, -sx, sy, sx * 0.6, sy + torsoH * 0.45, lw, armC);
      line(ctx, sx, sy, -sx * 0.6, sy + torsoH * 0.35, lw, armC);
      break;
    case 'shout':
      drawArm(-1, -1.0 + Math.sin(t * 12) * 0.1);
      drawArm(1, 1.0 - Math.sin(t * 12) * 0.1);
      break;
    case 'eat': {
      drawArm(-f as -1 | 1, f * 0.9, 0.6);
      const up = (Math.sin(t * 2.5) + 1) / 2;
      drawArm(f as -1 | 1, f * (1.2 + up * 1.4), f * 0.8);
      break;
    }
    case 'skate':
    case 'shoot':
    case 'hold': {
      const swing = pose === 'shoot' ? Math.sin(t * 5) * 0.9 : 0;
      const h1 = drawArm(f as -1 | 1, f * (0.9 + swing * 0.5), 0.3);
      drawArm(-f as -1 | 1, f * (0.6 + swing * 0.5), 0.3);
      if (pose !== 'hold') {
        // hockey stick
        ctx.save();
        ctx.translate(h1.hx, h1.hy);
        ctx.rotate(-f * (0.3 + swing * 0.6));
        line(ctx, 0, 0, f * H * 0.18, hip - (h1.hy + hip) * 0 + H * 0.25, lw * 0.5, '#8a5a2a');
        line(ctx, f * H * 0.18, H * 0.25 + hip * 0, f * H * 0.32, H * 0.27, lw * 0.7, '#2a2a3a');
        ctx.restore();
      }
      break;
    }
    case 'ride':
      drawArm(-1, f * 1.3, 0.2);
      drawArm(1, f * 1.4, 0.2);
      break;
    case 'slump':
      drawArm(-1, 0.05);
      drawArm(1, -0.05);
      break;
    default:
      drawArm(-1, -0.12 + Math.sin(t * 1.5 + seed) * 0.03);
      drawArm(1, 0.12 - Math.sin(t * 1.5 + seed) * 0.03);
  }

  // head
  const hy = -torsoH - r * 0.95 + (pose === 'slump' || pose === 'cry' ? r * 0.25 : 0);
  const hx = (pose === 'slump' ? f * r * 0.3 : 0);
  hair(ctx, L, hx, hy, r, f, t, true);
  circle(ctx, hx, hy, r, skin);
  hair(ctx, L, hx, hy, r, f, t, false);
  if (L.beard) {
    ctx.fillStyle = L.beard;
    ctx.beginPath();
    ctx.arc(hx + f * r * 0.1, hy + r * 0.25, r * 0.78, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.fill();
  }
  const m: Mood = pose === 'cry' ? 'sad' : pose === 'shout' ? 'angry' : pose === 'sleep' ? 'calm' : mood;
  face(ctx, hx, hy, r, m, t, f, seed);
  if (L.glasses) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(1, r * 0.08);
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(hx + f * r * 0.12 + s * r * 0.36, hy - r * 0.05, r * 0.24, 0, TAU);
      ctx.stroke();
    }
  }
  if (pose === 'cry') {
    const k = (t * 1.5) % 1;
    for (const s of [-1, 1]) circle(ctx, hx + s * r * 0.4, hy + r * 0.2 + k * r * 1.2, r * 0.1, rgba('#8ec5ff', 1 - k));
  }
  ctx.restore();
  ctx.restore();
}

// ───────────────────────────── props ─────────────────────────────

export function drawProp(ctx: Ctx, what: PropKind, x: number, y: number, s: number, t: number, n = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  switch (what) {
    case 'box':
      ctx.fillStyle = '#c99b6d';
      ctx.fillRect(-28, -40, 56, 40);
      ctx.fillStyle = '#b5845a';
      ctx.fillRect(-28, -40, 56, 8);
      ctx.fillStyle = '#e9d9b5';
      ctx.fillRect(-6, -40, 12, 40);
      break;
    case 'photo':
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-18, -24, 36, 30);
      ctx.fillStyle = '#7fc2ff';
      ctx.fillRect(-14, -20, 28, 18);
      for (let i = 0; i < 4; i++) circle(ctx, -9 + i * 6, -8, 3, ['#E63946', '#E63946', '#14213D', '#E63946'][i]);
      break;
    case 'puck':
      ellipse(ctx, 0, 0, 7, 3, '#111');
      break;
    case 'trophy':
      ctx.fillStyle = '#F2C14E';
      ctx.beginPath();
      ctx.moveTo(-14, -40);
      ctx.lineTo(14, -40);
      ctx.quadraticCurveTo(12, -18, 0, -16);
      ctx.quadraticCurveTo(-12, -18, -14, -40);
      ctx.fill();
      ctx.fillRect(-3, -16, 6, 10);
      ctx.fillRect(-10, -6, 20, 6);
      break;
    case 'pancakes':
      for (let i = 0; i < n; i++) ellipse(ctx, Math.sin(i * 1.7) * 2, -4 - i * 5, 18, 4, i % 2 ? '#e3a857' : '#d4954a');
      ellipse(ctx, 0, -6 - n * 5, 6, 2.5, '#fff6c0');
      break;
    case 'vase':
      ctx.fillStyle = '#5aa0d8';
      ctx.beginPath();
      ctx.moveTo(-6, -40);
      ctx.lineTo(6, -40);
      ctx.quadraticCurveTo(18, -20, 8, 0);
      ctx.lineTo(-8, 0);
      ctx.quadraticCurveTo(-18, -20, -6, -40);
      ctx.fill();
      break;
    case 'shards':
      ctx.fillStyle = '#5aa0d8';
      for (let i = 0; i < 6; i++) {
        ctx.save();
        ctx.translate(-20 + i * 8, -2);
        ctx.rotate(i);
        ctx.fillRect(-4, -2, 8, 4);
        ctx.restore();
      }
      break;
    case 'shovel':
      line(ctx, 0, 0, 0, -26, 3, '#8a5a2a');
      ctx.fillStyle = '#E63946';
      roundRect(ctx, -7, -6, 14, 14, 3);
      ctx.fill();
      break;
    case 'tshirt':
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(-20, -30);
      ctx.lineTo(-8, -36);
      ctx.lineTo(8, -36);
      ctx.lineTo(20, -30);
      ctx.lineTo(14, -22);
      ctx.lineTo(10, -24);
      ctx.lineTo(10, 0);
      ctx.lineTo(-10, 0);
      ctx.lineTo(-10, -24);
      ctx.lineTo(-14, -22);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#3D7BFF';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(-7 + i * 3, -20 + (i % 2) * 6);
        ctx.lineTo(-3 + i * 3, -18 + (i % 2) * 6);
        ctx.stroke();
      }
      break;
    case 'fort':
      ctx.fillStyle = '#f4f8ff';
      ctx.beginPath();
      ctx.arc(0, 0, 60, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#c9d8ef';
      ctx.beginPath();
      ctx.arc(0, 0, 20, Math.PI, 0);
      ctx.fill();
      for (let i = 0; i < 5; i++) ellipse(ctx, -48 + i * 24, -50 + Math.abs(i - 2) * 10, 10, 6, '#ffffff');
      break;
    case 'olive':
      ellipse(ctx, 0, 0, 5, 4, '#5a6b2a');
      break;
    case 'plate':
      ellipse(ctx, 0, 0, 18, 5, '#ffffff');
      break;
    case 'harmonica':
      ctx.fillStyle = '#c0c6d0';
      roundRect(ctx, -14, -5, 28, 10, 2);
      ctx.fill();
      ctx.fillStyle = '#5a6070';
      for (let i = 0; i < 6; i++) ctx.fillRect(-11 + i * 4, -2, 2, 4);
      break;
    case 'flyer':
      ctx.fillStyle = '#fff4c2';
      ctx.fillRect(-14, -20, 28, 36);
      ctx.fillStyle = '#E63946';
      ctx.fillRect(-10, -16, 20, 6);
      ctx.fillStyle = '#14213D';
      for (let i = 0; i < 3; i++) ctx.fillRect(-10, -6 + i * 6, 20 - i * 4, 2);
      break;
    case 'tray':
      ctx.fillStyle = '#9aa7c7';
      roundRect(ctx, -22, -4, 44, 6, 2);
      ctx.fill();
      ellipse(ctx, -8, -8, 7, 4, '#e3a857');
      circle(ctx, 9, -8, 4, '#E8516A');
      break;
    case 'balloon':
      line(ctx, 0, 0, Math.sin(t * 2) * 4, -40, 1.2, '#666');
      ellipse(ctx, Math.sin(t * 2) * 4, -54, 12, 15, '#E8516A');
      break;
    case 'icecream':
      ctx.fillStyle = '#e3a857';
      ctx.beginPath();
      ctx.moveTo(-6, -12);
      ctx.lineTo(6, -12);
      ctx.lineTo(0, 6);
      ctx.fill();
      circle(ctx, 0, -16, 7, '#ffd1e0');
      break;
    case 'anthill':
      ctx.fillStyle = '#8a6a3a';
      ctx.beginPath();
      ctx.arc(0, 0, 22, Math.PI, 0);
      ctx.fill();
      for (let i = 0; i < 8; i++) {
        const k = (t * 0.3 + i / 8) % 1;
        circle(ctx, -40 + k * 80, -2 + Math.sin(k * 20) * 2, 1.6, '#2a1a10');
      }
      break;
    case 'cake':
      ctx.fillStyle = '#fbe3ec';
      ctx.fillRect(-18, -20, 36, 20);
      ctx.fillStyle = '#E8516A';
      ctx.fillRect(-18, -22, 36, 4);
      line(ctx, 0, -22, 0, -30, 2, '#3D7BFF');
      glow(ctx, 0, -33, 10, '#FFCF33', 0.8 + Math.sin(t * 12) * 0.2);
      break;
    case 'sprouts':
      for (let i = 0; i < 5; i++) circle(ctx, -8 + (i % 3) * 8, -4 - Math.floor(i / 3) * 6, 4, '#6b8f3a');
      for (let i = 0; i < 3; i++) {
        const k = (t * 0.5 + i / 3) % 1;
        ctx.strokeStyle = rgba('#9acd60', 1 - k);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-6 + i * 6, -12 - k * 20);
        ctx.quadraticCurveTo(-2 + i * 6, -18 - k * 20, -6 + i * 6, -24 - k * 20);
        ctx.stroke();
      }
      break;
    case 'note':
      ctx.fillStyle = '#ffffff';
      ctx.save();
      ctx.rotate(-0.1);
      ctx.fillRect(-12, -16, 24, 30);
      ctx.fillStyle = '#3D7BFF';
      for (let i = 0; i < 4; i++) ctx.fillRect(-8, -10 + i * 6, 16 - (i % 2) * 5, 1.5);
      ctx.restore();
      break;
    case 'phoneProp':
      ctx.fillStyle = '#2a2a3a';
      roundRect(ctx, -9, -16, 18, 32, 3);
      ctx.fill();
      ctx.fillStyle = '#9fd3ff';
      ctx.fillRect(-7, -12, 14, 24);
      break;
    case 'microphone':
      line(ctx, 0, 0, 0, -16, 3, '#8a5a2a');
      ellipse(ctx, 0, -20, 4, 6, '#d4954a');
      break;
    case 'tv':
      ctx.fillStyle = '#2a2a3a';
      roundRect(ctx, -40, -50, 80, 50, 4);
      ctx.fill();
      ctx.fillStyle = rgba('#7fc2ff', 0.6 + Math.sin(t * 7) * 0.2);
      ctx.fillRect(-35, -45, 70, 40);
      break;
  }
  ctx.restore();
}

// ───────────────────────────── places ─────────────────────────────

function sky(ctx: Ctx, r: Rect, night: boolean, top = '#8fd0ff', low = '#ffe0f0') {
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  g.addColorStop(0, night ? '#14204a' : top);
  g.addColorStop(1, night ? '#3a3a7a' : low);
  ctx.fillStyle = g;
  ctx.fillRect(r.x, r.y, r.w, r.h);
}

function windowFrame(ctx: Ctx, x: number, y: number, w: number, h: number, night: boolean, t: number, weather?: string | null) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, night ? '#14204a' : '#8fd0ff');
  g.addColorStop(1, night ? '#2a3a6a' : '#d8f0ff');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  if (night) {
    for (let i = 0; i < 8; i++) circle(ctx, x + hash(i) * w, y + hash(i + 9) * h * 0.6, 1, '#fff8e0');
    circle(ctx, x + w * 0.75, y + h * 0.3, h * 0.12, '#fff4c8');
  } else {
    ellipse(ctx, x + w * 0.3 + Math.sin(t * 0.2) * 6, y + h * 0.3, w * 0.12, h * 0.06, 'rgba(255,255,255,0.9)');
  }
  if (weather === 'rain') {
    ctx.strokeStyle = 'rgba(200,220,255,0.6)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 10; i++) {
      const k = (t * 1.5 + hash(i)) % 1;
      ctx.beginPath();
      ctx.moveTo(x + hash(i * 3) * w, y + k * h);
      ctx.lineTo(x + hash(i * 3) * w - 2, y + k * h + 6);
      ctx.stroke();
    }
  }
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4;
  ctx.strokeRect(x, y, w, h);
  line(ctx, x + w / 2, y, x + w / 2, y + h, 3, '#ffffff');
}

function floor(ctx: Ctx, r: Rect, gy: number, c1: string, c2: string) {
  const g = ctx.createLinearGradient(0, r.y + gy * r.h, 0, r.y + r.h);
  g.addColorStop(0, c1);
  g.addColorStop(1, c2);
  ctx.fillStyle = g;
  ctx.fillRect(r.x, r.y + gy * r.h, r.w, r.h * (1 - gy));
}

export function drawKit(ctx: Ctx, kit: Kit, r: Rect, t: number, night: boolean, fx?: string | null) {
  const { x, y, w, h } = r;
  const gy = 0.86;
  switch (kit) {
    case 'kitchen': {
      ctx.fillStyle = night ? '#6a5a7a' : '#ffe9c7';
      ctx.fillRect(x, y, w, h);
      // tiles
      ctx.strokeStyle = rgba('#ffffff', 0.35);
      ctx.lineWidth = 1;
      for (let i = 0; i < 14; i++) line(ctx, x + (i / 14) * w, y + h * 0.42, x + (i / 14) * w, y + h * 0.58, 1, rgba('#c99b6d', 0.25));
      windowFrame(ctx, x + w * 0.38, y + h * 0.12, w * 0.24, h * 0.28, night, t, fx);
      // counter and cupboards
      ctx.fillStyle = '#e9b97a';
      ctx.fillRect(x, y + h * 0.58, w * 0.3, h * 0.28);
      ctx.fillStyle = '#d29a5a';
      ctx.fillRect(x, y + h * 0.56, w * 0.32, h * 0.03);
      ctx.fillStyle = '#9fd6c8';
      roundRect(ctx, x + w * 0.84, y + h * 0.3, w * 0.12, h * 0.56, 6);
      ctx.fill();
      // table
      ctx.fillStyle = '#b5845a';
      ctx.fillRect(x + w * 0.42, y + h * 0.66, w * 0.3, h * 0.04);
      line(ctx, x + w * 0.45, y + h * 0.7, x + w * 0.45, y + h * gy, 5, '#8a5a2a');
      line(ctx, x + w * 0.69, y + h * 0.7, x + w * 0.69, y + h * gy, 5, '#8a5a2a');
      floor(ctx, r, gy, '#d9b48a', '#b88a5a');
      break;
    }
    case 'bedroom': {
      ctx.fillStyle = night ? '#3a3560' : '#c9d8ff';
      ctx.fillRect(x, y, w, h);
      windowFrame(ctx, x + w * 0.08, y + h * 0.12, w * 0.2, h * 0.3, night, t, fx);
      // posters
      ctx.fillStyle = '#E63946';
      ctx.fillRect(x + w * 0.42, y + h * 0.14, w * 0.08, h * 0.18);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + w * 0.44, y + h * 0.18, w * 0.04, h * 0.02);
      ctx.fillStyle = '#FFCF33';
      ctx.fillRect(x + w * 0.54, y + h * 0.18, w * 0.07, h * 0.12);
      // bed
      ctx.fillStyle = '#8a6ad0';
      roundRect(ctx, x + w * 0.66, y + h * 0.6, w * 0.3, h * 0.2, 8);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      roundRect(ctx, x + w * 0.88, y + h * 0.56, w * 0.07, h * 0.07, 6);
      ctx.fill();
      ctx.fillStyle = '#5a3a9a';
      ctx.fillRect(x + w * 0.66, y + h * 0.5, w * 0.02, h * 0.36);
      floor(ctx, r, gy, night ? '#5a4a6a' : '#e0c8a8', night ? '#3a2a4a' : '#c9a880');
      break;
    }
    case 'livingroom': {
      ctx.fillStyle = night ? '#4a3a5a' : '#f6d9c4';
      ctx.fillRect(x, y, w, h);
      windowFrame(ctx, x + w * 0.62, y + h * 0.12, w * 0.22, h * 0.3, night, t, fx);
      ctx.fillStyle = '#5a7ab8';
      roundRect(ctx, x + w * 0.08, y + h * 0.58, w * 0.34, h * 0.2, [18, 18, 6, 6]);
      ctx.fill();
      ctx.fillStyle = '#4a68a0';
      roundRect(ctx, x + w * 0.06, y + h * 0.68, w * 0.38, h * 0.12, 10);
      ctx.fill();
      // shelf + lamp
      ctx.fillStyle = '#b5845a';
      ctx.fillRect(x + w * 0.48, y + h * 0.5, w * 0.12, h * 0.36);
      line(ctx, x + w * 0.9, y + h * gy, x + w * 0.9, y + h * 0.45, 3, '#2a2a3a');
      ctx.fillStyle = night ? '#FFE58A' : '#f0d070';
      ctx.beginPath();
      ctx.moveTo(x + w * 0.86, y + h * 0.45);
      ctx.lineTo(x + w * 0.94, y + h * 0.45);
      ctx.lineTo(x + w * 0.92, y + h * 0.38);
      ctx.lineTo(x + w * 0.88, y + h * 0.38);
      ctx.fill();
      if (night) glow(ctx, x + w * 0.9, y + h * 0.45, w * 0.18, '#FFCF33', 0.6);
      floor(ctx, r, gy, '#c9a07a', '#a07a5a');
      break;
    }
    case 'classroom':
    case 'hallway': {
      ctx.fillStyle = '#e8eef8';
      ctx.fillRect(x, y, w, h);
      if (kit === 'classroom') {
        ctx.fillStyle = '#2f5a48';
        ctx.fillRect(x + w * 0.2, y + h * 0.12, w * 0.5, h * 0.28);
        ctx.strokeStyle = '#b5845a';
        ctx.lineWidth = 5;
        ctx.strokeRect(x + w * 0.2, y + h * 0.12, w * 0.5, h * 0.28);
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + w * 0.25, y + h * 0.2);
        ctx.quadraticCurveTo(x + w * 0.35, y + h * 0.14, x + w * 0.45, y + h * 0.22);
        ctx.stroke();
        for (let i = 0; i < 3; i++) {
          ctx.fillStyle = '#c99b6d';
          ctx.fillRect(x + w * (0.1 + i * 0.3), y + h * 0.7, w * 0.18, h * 0.03);
        }
      } else {
        for (let i = 0; i < 8; i++) {
          ctx.fillStyle = i % 2 ? '#3D7BFF' : '#52a0ff';
          ctx.fillRect(x + w * (0.04 + i * 0.12), y + h * 0.28, w * 0.1, h * 0.58);
          ctx.fillStyle = 'rgba(255,255,255,0.4)';
          ctx.fillRect(x + w * (0.06 + i * 0.12), y + h * 0.34, w * 0.06, h * 0.01);
        }
      }
      floor(ctx, r, gy, '#b9c4dc', '#97a3c0');
      break;
    }
    case 'cafeteria': {
      ctx.fillStyle = '#fff1d6';
      ctx.fillRect(x, y, w, h);
      for (let i = 0; i < 4; i++) windowFrame(ctx, x + w * (0.06 + i * 0.24), y + h * 0.1, w * 0.14, h * 0.2, false, t);
      ctx.fillStyle = '#4FA98A';
      ctx.fillRect(x, y + h * 0.42, w, h * 0.04);
      for (const tx of [0.08, 0.56]) {
        ctx.fillStyle = '#d29a5a';
        ctx.fillRect(x + w * tx, y + h * 0.7, w * 0.36, h * 0.035);
        line(ctx, x + w * (tx + 0.04), y + h * 0.735, x + w * (tx + 0.04), y + h * gy, 4, '#8a5a2a');
        line(ctx, x + w * (tx + 0.32), y + h * 0.735, x + w * (tx + 0.32), y + h * gy, 4, '#8a5a2a');
      }
      floor(ctx, r, gy, '#e8d4b8', '#c9b090');
      break;
    }
    case 'rink': {
      sky(ctx, r, true);
      // bleachers with a crowd
      for (let row = 0; row < 4; row++) {
        ctx.fillStyle = mixHex('#2a3550', '#14213D', row / 4);
        ctx.fillRect(x, y + h * (0.14 + row * 0.08), w, h * 0.08);
        for (let i = 0; i < 26; i++) {
          const bob = Math.sin(t * 4 + i + row) * 1.5;
          circle(ctx, x + (i / 26) * w + 8 + (row % 2) * 6, y + h * (0.16 + row * 0.08) + bob, h * 0.018, ['#E63946', '#f2c29b', '#3D7BFF', '#c58b5e', '#ffffff'][(i + row) % 5]);
        }
      }
      // floodlight glow
      glow(ctx, x + w * 0.2, y, w * 0.4, '#ffffff', 0.25);
      glow(ctx, x + w * 0.8, y, w * 0.4, '#ffffff', 0.25);
      // scoreboard
      ctx.fillStyle = '#111';
      roundRect(ctx, x + w * 0.4, y + h * 0.02, w * 0.2, h * 0.1, 4);
      ctx.fill();
      ctx.fillStyle = '#E63946';
      ctx.font = `800 ${h * 0.06}px ${FONT_BODY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('2 : 3', x + w * 0.5, y + h * 0.07);
      // boards
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, y + h * 0.48, w, h * 0.08);
      ctx.fillStyle = '#E63946';
      ctx.fillRect(x, y + h * 0.54, w, h * 0.015);
      // ice
      const g = ctx.createLinearGradient(0, y + h * 0.56, 0, y + h);
      g.addColorStop(0, '#dff0ff');
      g.addColorStop(1, '#b9d8f0');
      ctx.fillStyle = g;
      ctx.fillRect(x, y + h * 0.56, w, h * 0.44);
      line(ctx, x + w * 0.5, y + h * 0.56, x + w * 0.5, y + h, 3, '#E63946');
      ctx.strokeStyle = '#3D7BFF';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x + w * 0.5, y + h * 0.78, w * 0.08, h * 0.08, 0, 0, TAU);
      ctx.stroke();
      // goal
      ctx.strokeStyle = '#E63946';
      ctx.lineWidth = 4;
      ctx.strokeRect(x + w * 0.88, y + h * 0.66, w * 0.08, h * 0.16);
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 1;
      for (let i = 1; i < 5; i++) line(ctx, x + w * 0.88 + (i / 5) * w * 0.08, y + h * 0.66, x + w * 0.88 + (i / 5) * w * 0.08, y + h * 0.82, 1, 'rgba(255,255,255,0.6)');
      break;
    }
    case 'park':
    case 'yard':
    case 'street': {
      sky(ctx, r, night);
      if (!night) {
        glow(ctx, x + w * 0.85, y + h * 0.15, h * 0.3, '#FFE58A', 0.8);
        circle(ctx, x + w * 0.85, y + h * 0.15, h * 0.06, '#FFF1B0');
      } else for (let i = 0; i < 20; i++) circle(ctx, x + hash(i) * w, y + hash(i + 3) * h * 0.4, 1.2, '#fff8e0');
      if (kit === 'street') {
        // a new city of hills and stacked houses
        ctx.fillStyle = night ? '#2a2a5a' : '#9db8e8';
        ctx.beginPath();
        ctx.moveTo(x, y + h * 0.6);
        ctx.quadraticCurveTo(x + w * 0.3, y + h * 0.3, x + w * 0.6, y + h * 0.5);
        ctx.quadraticCurveTo(x + w * 0.85, y + h * 0.62, x + w, y + h * 0.4);
        ctx.lineTo(x + w, y + h);
        ctx.lineTo(x, y + h);
        ctx.fill();
        for (let i = 0; i < 12; i++) {
          const hx = x + (i / 12) * w;
          const hh = h * (0.12 + hash(i * 2) * 0.12);
          const by = y + h * 0.66 - Math.sin((i / 12) * Math.PI) * h * 0.12;
          ctx.fillStyle = ['#f6c7a0', '#9fd6c8', '#f2a3b0', '#c9b6ef', '#fff1b0'][i % 5];
          ctx.fillRect(hx, by - hh, w / 12 - 4, hh);
          ctx.fillStyle = night ? '#FFE58A' : 'rgba(40,40,80,0.4)';
          ctx.fillRect(hx + 6, by - hh + 8, 8, 8);
        }
        floor(ctx, r, gy, '#8a8aa0', '#6a6a80');
      } else {
        ctx.fillStyle = night ? '#2a4a3a' : '#8fd18a';
        ctx.beginPath();
        ctx.moveTo(x, y + h * 0.66);
        ctx.quadraticCurveTo(x + w * 0.5, y + h * 0.56, x + w, y + h * 0.66);
        ctx.lineTo(x + w, y + h);
        ctx.lineTo(x, y + h);
        ctx.fill();
        // tree
        line(ctx, x + w * 0.15, y + h * gy, x + w * 0.15, y + h * 0.4, w * 0.02, '#7a5030');
        circle(ctx, x + w * 0.15, y + h * 0.36, h * 0.16, night ? '#1f3a2a' : '#5aa04a');
        circle(ctx, x + w * 0.2, y + h * 0.3, h * 0.11, night ? '#2a4a3a' : '#6ab85a');
        if (kit === 'yard') {
          ctx.fillStyle = '#f6c7a0';
          ctx.fillRect(x + w * 0.7, y + h * 0.36, w * 0.28, h * 0.3);
          ctx.fillStyle = '#b5533c';
          ctx.beginPath();
          ctx.moveTo(x + w * 0.68, y + h * 0.36);
          ctx.lineTo(x + w * 0.84, y + h * 0.2);
          ctx.lineTo(x + w * 1.0, y + h * 0.36);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(x + w * 0.72, y + h * 0.66, w * 0.26, h * 0.02);
        }
        floor(ctx, r, gy, night ? '#2a4a3a' : '#7cc276', night ? '#1a3a2a' : '#5aa04a');
        if (kit === 'park') {
          ctx.fillStyle = '#d9c8a0';
          ctx.fillRect(x, y + h * 0.88, w, h * 0.04);
        }
      }
      break;
    }
    case 'snow': {
      sky(ctx, r, night, '#c8dcf8', '#eef4ff');
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(x, y + h * 0.6);
      ctx.quadraticCurveTo(x + w * 0.4, y + h * 0.5, x + w, y + h * 0.62);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x, y + h);
      ctx.fill();
      ctx.fillStyle = '#c9b6ef';
      ctx.fillRect(x + w * 0.8, y + h * 0.3, w * 0.18, h * 0.32);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + w * 0.78, y + h * 0.28, w * 0.22, h * 0.04);
      floor(ctx, r, gy, '#f4f8ff', '#dce8f8');
      break;
    }
    case 'car': {
      sky(ctx, r, night);
      // passing streetlights / trees
      for (let i = 0; i < 6; i++) {
        const px = x + (((i / 6) * w * 1.4 - t * w * 0.5) % (w * 1.4) + w * 1.4) % (w * 1.4) - w * 0.2;
        if (night) glow(ctx, px, y + h * 0.2, h * 0.2, '#FFE58A', 0.6);
        else circle(ctx, px, y + h * 0.42, h * 0.1, '#5aa04a');
      }
      ctx.fillStyle = '#3a3550';
      ctx.fillRect(x, y + h * 0.55, w, h * 0.45);
      ctx.fillStyle = '#2a2640';
      roundRect(ctx, x + w * 0.02, y + h * 0.04, w * 0.96, h * 0.5, 30);
      ctx.strokeStyle = '#2a2640';
      ctx.lineWidth = 14;
      ctx.stroke();
      ctx.fillStyle = 'rgba(160,200,255,0.12)';
      ctx.fillRect(x + w * 0.04, y + h * 0.06, w * 0.92, h * 0.46);
      line(ctx, x + w * 0.5, y + h * 0.04, x + w * 0.5, y + h * 0.55, 10, '#2a2640');
      // seats
      ctx.fillStyle = '#5a5070';
      roundRect(ctx, x + w * 0.12, y + h * 0.5, w * 0.22, h * 0.4, 14);
      ctx.fill();
      roundRect(ctx, x + w * 0.6, y + h * 0.5, w * 0.22, h * 0.4, 14);
      ctx.fill();
      break;
    }
    case 'stage': {
      ctx.fillStyle = '#5a1a2a';
      ctx.fillRect(x, y, w, h);
      for (let i = 0; i < 10; i++) {
        ctx.fillStyle = i % 2 ? '#8a2438' : '#7a1f30';
        ctx.fillRect(x + (i / 10) * w, y, w / 10, h * 0.7);
      }
      glow(ctx, x + w * 0.5, y + h * 0.5, w * 0.35, '#FFE58A', 0.5);
      ctx.fillStyle = '#b5845a';
      ctx.fillRect(x, y + h * 0.7, w, h * 0.3);
      ctx.fillStyle = '#2a1a2a';
      for (let i = 0; i < 12; i++) circle(ctx, x + (i / 12) * w + 20, y + h * 0.98, h * 0.06, '#2a1a2a');
      break;
    }
    case 'phone': {
      // a video call, split down the middle
      ctx.fillStyle = '#1a1a2a';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#c9d8ff';
      roundRect(ctx, x + w * 0.03, y + h * 0.06, w * 0.45, h * 0.88, 12);
      ctx.fill();
      ctx.fillStyle = '#ffe0c8';
      roundRect(ctx, x + w * 0.52, y + h * 0.06, w * 0.45, h * 0.88, 12);
      ctx.fill();
      // Dani's old-town backdrop: hockey posters
      ctx.fillStyle = '#E63946';
      ctx.fillRect(x + w * 0.6, y + h * 0.14, w * 0.08, h * 0.16);
      ctx.fillStyle = '#14213D';
      ctx.fillRect(x + w * 0.78, y + h * 0.14, w * 0.1, h * 0.12);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      roundRect(ctx, x + w * 0.42, y + h * 0.86, w * 0.16, h * 0.08, 10);
      ctx.fill();
      circle(ctx, x + w * 0.47, y + h * 0.9, h * 0.025, '#E63946');
      circle(ctx, x + w * 0.53, y + h * 0.9, h * 0.025, '#ffffff');
      break;
    }
    case 'locker': {
      ctx.fillStyle = '#c8ccd8';
      ctx.fillRect(x, y, w, h);
      for (let i = 0; i < 9; i++) {
        ctx.fillStyle = i % 2 ? '#6a7a9a' : '#7a8aaa';
        ctx.fillRect(x + (i / 9) * w + 2, y + h * 0.1, w / 9 - 4, h * 0.56);
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        for (let k = 0; k < 3; k++) ctx.fillRect(x + (i / 9) * w + 10, y + h * (0.16 + k * 0.03), w / 9 - 20, 2);
      }
      ctx.fillStyle = '#b5845a';
      ctx.fillRect(x, y + h * 0.66, w, h * 0.06);
      floor(ctx, r, gy, '#8a96b0', '#6a7690');
      break;
    }
  }
}

// ───────────────────────────── lenses: one memory, five readings ─────────────────────────────

function applyLens(ctx: Ctx, r: Rect, lens: EmotionId, t: number) {
  const { x, y, w, h } = r;
  ctx.save();
  switch (lens) {
    case 'joy': {
      ctx.globalCompositeOperation = 'soft-light';
      ctx.fillStyle = 'rgba(255,207,51,0.55)';
      ctx.fillRect(x, y, w, h);
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, x + w * 0.5, y + h * 0.35, w * 0.5, '#FFCF33', 0.35);
      for (let i = 0; i < 18; i++) {
        const k = (t * 0.2 + hash(i)) % 1;
        const sx = x + hash(i * 7) * w;
        const sy = y + h * (1 - k);
        const s = 2 + hash(i * 3) * 3;
        ctx.fillStyle = rgba('#FFF1B0', Math.sin(k * Math.PI));
        ctx.beginPath();
        for (let j = 0; j < 8; j++) {
          const a = (j / 8) * TAU + t;
          const rr = j % 2 ? s * 0.4 : s * 1.6;
          ctx.lineTo(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr);
        }
        ctx.fill();
      }
      break;
    }
    case 'sadness': {
      ctx.globalCompositeOperation = 'saturation';
      ctx.fillStyle = 'rgba(128,128,128,0.65)';
      ctx.fillRect(x, y, w, h);
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = 'rgba(110,150,255,0.55)';
      ctx.fillRect(x, y, w, h);
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = 'rgba(200,220,255,0.55)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 40; i++) {
        const k = (t * 0.9 + hash(i)) % 1;
        const rx = x + hash(i * 5) * w;
        ctx.beginPath();
        ctx.moveTo(rx, y + k * h);
        ctx.lineTo(rx - 3, y + k * h + 12);
        ctx.stroke();
      }
      break;
    }
    case 'anger': {
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = 'rgba(255,120,90,0.55)';
      ctx.fillRect(x, y, w, h);
      ctx.globalCompositeOperation = 'source-over';
      const g = ctx.createRadialGradient(x + w / 2, y + h / 2, h * 0.3, x + w / 2, y + h / 2, w * 0.7);
      g.addColorStop(0, 'rgba(255,60,30,0)');
      g.addColorStop(1, 'rgba(160,20,10,0.6)');
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, h);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 16; i++) {
        const k = (t * 0.6 + hash(i)) % 1;
        glow(ctx, x + hash(i * 9) * w + Math.sin(t * 3 + i) * 10, y + h * (1 - k), 10, '#FF8A3D', 1 - k);
      }
      break;
    }
    case 'fear': {
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = 'rgba(150,110,220,0.6)';
      ctx.fillRect(x, y, w, h);
      ctx.globalCompositeOperation = 'source-over';
      const pulse = 0.5 + Math.sin(t * 3) * 0.1;
      const g = ctx.createRadialGradient(x + w / 2, y + h / 2, h * 0.15, x + w / 2, y + h / 2, w * 0.55);
      g.addColorStop(0, 'rgba(20,6,50,0)');
      g.addColorStop(1, `rgba(20,6,50,${0.75 * pulse + 0.2})`);
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, h);
      // shifting eyes in the dark
      for (let i = 0; i < 3; i++) {
        const ex = x + (i === 0 ? 0.08 : i === 1 ? 0.92 : 0.1) * w;
        const ey = y + (i === 2 ? 0.8 : 0.2) * h;
        const blink = Math.sin(t * 1.3 + i * 2) > 0.2 ? 1 : 0;
        circle(ctx, ex - 5, ey, 2.2 * blink, 'rgba(255,240,180,0.8)');
        circle(ctx, ex + 5, ey, 2.2 * blink, 'rgba(255,240,180,0.8)');
      }
      break;
    }
    case 'disgust': {
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = 'rgba(170,230,120,0.6)';
      ctx.fillRect(x, y, w, h);
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = 'rgba(120,180,60,0.6)';
      ctx.lineWidth = 2.5;
      for (let i = 0; i < 7; i++) {
        const k = (t * 0.25 + hash(i)) % 1;
        const sx = x + hash(i * 4) * w;
        const sy = y + h * (0.9 - k * 0.6);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.bezierCurveTo(sx + 8, sy - 10, sx - 8, sy - 20, sx, sy - 30);
        ctx.stroke();
      }
      break;
    }
  }
  ctx.restore();
}

function weather(ctx: Ctx, r: Rect, fx: VignetteScript['fx'], t: number) {
  if (!fx) return;
  const { x, y, w, h } = r;
  ctx.save();
  if (fx === 'rain' || fx === 'thunder') {
    ctx.strokeStyle = 'rgba(200,220,255,0.5)';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 60; i++) {
      const k = (t * 1.6 + hash(i)) % 1;
      const rx = x + hash(i * 3) * w;
      ctx.beginPath();
      ctx.moveTo(rx, y + k * h);
      ctx.lineTo(rx - 4, y + k * h + 14);
      ctx.stroke();
    }
    if (fx === 'thunder' && (t % 4.2) < 0.12) {
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.fillRect(x, y, w, h);
    }
  } else if (fx === 'snow') {
    for (let i = 0; i < 50; i++) {
      const k = (t * 0.15 + hash(i)) % 1;
      circle(ctx, x + hash(i * 3) * w + Math.sin(t + i) * 8, y + k * h, 2 + hash(i) * 2, 'rgba(255,255,255,0.9)');
    }
  } else if (fx === 'confetti') {
    for (let i = 0; i < 40; i++) {
      const k = (t * 0.3 + hash(i)) % 1;
      ctx.fillStyle = ['#FFCF33', '#E8516A', '#3CC6B8', '#3D7BFF'][i % 4];
      ctx.save();
      ctx.translate(x + hash(i * 3) * w + Math.sin(t * 2 + i) * 10, y + k * h);
      ctx.rotate(t * 3 + i);
      ctx.fillRect(-3, -1.5, 6, 3);
      ctx.restore();
    }
  } else if (fx === 'sparkle' || fx === 'stars') {
    for (let i = 0; i < 24; i++) {
      const tw = 0.5 + 0.5 * Math.sin(t * 3 + i);
      circle(ctx, x + hash(i * 3) * w, y + hash(i * 7) * h * (fx === 'stars' ? 0.5 : 1), 1.5 + tw * 1.5, rgba('#FFF1B0', tw));
    }
  }
  ctx.restore();
}

// ───────────────────────────── timeline ─────────────────────────────

function sampleActor(tr: ActorTrack, t: number) {
  const k = tr.keys;
  let i = 0;
  while (i < k.length - 1 && t >= k[i + 1][0]) i++;
  const a = k[i];
  const b = k[Math.min(i + 1, k.length - 1)];
  const span = b[0] - a[0];
  const p = span > 0 ? clamp((t - a[0]) / span, 0, 1) : 0;
  const x = lerp(a[1], b[1], p);
  const y = lerp(a[5] ?? 0.86, b[5] ?? 0.86, p);
  const moving = Math.abs(b[1] - a[1]) > 0.001 && p > 0 && p < 1;
  let pose: VPose = a[2] ?? 'stand';
  if (moving && (pose === 'stand' || pose === undefined)) pose = 'walk';
  const facing: 1 | -1 = a[3] ?? (b[1] < a[1] ? -1 : 1);
  return { x, y, pose, facing, mood: a[4] ?? 'calm' };
}

function sampleProp(tr: PropTrack, t: number) {
  const k = tr.keys;
  let i = 0;
  while (i < k.length - 1 && t >= k[i + 1][0]) i++;
  const a = k[i];
  const b = k[Math.min(i + 1, k.length - 1)];
  const span = b[0] - a[0];
  const p = span > 0 ? clamp((t - a[0]) / span, 0, 1) : 0;
  return {
    x: lerp(a[1], b[1], p),
    y: lerp(a[2], b[2], p),
    s: lerp(a[3] ?? 1, b[3] ?? 1, p),
    rot: lerp(a[4] ?? 0, b[4] ?? 0, p),
    alpha: lerp(a[5] ?? 1, b[5] ?? 1, p),
  };
}

export function captionAt(s: VignetteScript, t: number) {
  const tt = t % s.dur;
  let c: string | null = null;
  for (const cap of s.captions ?? []) if (tt >= cap.t) c = cap.text;
  return c;
}

/** Render one frame of a vignette into `r` at time `t` (seconds; loops on `dur`). */
export function renderVignette(ctx: Ctx, r: Rect, s: VignetteScript, t: number, o: VignetteOpts = {}) {
  const tt = o.freezeAt !== undefined ? o.freezeAt : t % s.dur;
  const anim = t; // idle motion keeps going even when frozen
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();
  drawKit(ctx, s.kit, r, anim, !!s.night, s.fx);
  for (const p of s.props ?? []) {
    const v = sampleProp(p, tt);
    if (v.alpha <= 0.01) continue;
    ctx.save();
    ctx.globalAlpha = v.alpha;
    ctx.translate(r.x + v.x * r.w, r.y + v.y * r.h);
    ctx.rotate(v.rot);
    drawProp(ctx, p.what, 0, 0, v.s * (r.h / 360), anim, p.n ?? 1);
    ctx.restore();
  }
  s.actors.forEach((a, i) => {
    const v = sampleActor(a, tt);
    drawPerson(ctx, a.who, r.x + v.x * r.w, r.y + v.y * r.h, r.h, v.pose, v.facing, v.mood, anim, i * 1.7, a.scale ?? 1);
  });
  weather(ctx, r, s.fx, anim);
  if (o.lens) applyLens(ctx, r, o.lens, anim);
  if (o.fade && o.fade > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'saturation';
    ctx.fillStyle = `rgba(128,128,128,${o.fade})`;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(200,196,210,${o.fade * 0.45})`;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.restore();
  }
  if (o.captions) {
    const c = captionAt(s, tt);
    if (c) {
      const fs = Math.max(14, r.h * 0.055);
      ctx.font = `800 ${fs}px ${FONT_BODY}`;
      const lines = wrapText(ctx, c, r.w * 0.8);
      const bh = lines.length * fs * 1.3 + fs * 0.8;
      ctx.fillStyle = 'rgba(12,7,38,0.72)';
      roundRect(ctx, r.x + r.w * 0.08, r.y + r.h - bh - r.h * 0.04, r.w * 0.84, bh, 14);
      ctx.fill();
      ctx.fillStyle = '#F3EEFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      lines.forEach((l, i) => ctx.fillText(l, r.x + r.w / 2, r.y + r.h - bh - r.h * 0.04 + fs * 0.4 + fs * 0.65 + i * fs * 1.3));
    }
  }
  ctx.restore();
}
