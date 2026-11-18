import type { Ctx } from '../../engine/draw';
import { FONT_DISPLAY, circle, ellipse, glow, memoryOrb, mixHex, rgba, roundRect, signText } from '../../engine/draw';
import { TAU, hash } from '../../engine/math';
import type { EmotionId } from '../content/emotions';
import { EMOTIONS, EMOTION_ORDER } from '../content/emotions';
import type { MemoryDef } from '../content/world';
import { BRASS, cloudBank, drawIsland, drawMemoryRidges, drawSky } from './mindscape';

export const HQ_W = 3400;
export const HQ_FLOOR = 770;
export const SCREEN = { x: 1330, y: 96, w: 740, h: 372 };
export const CONSOLE_X = 1700;

const WALL_TOP = '#2b1f5e';
const WALL_LOW = '#45337f';
const PANEL = '#3a2b72';
const TRIM = BRASS;

/** The mind world as seen through a window, with its own parallax. */
export function windowVista(ctx: Ctx, x: number, y: number, w: number, h: number, t: number, camX: number, kind: 'ridges' | 'islands' | 'tower', islands?: Record<string, boolean>) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  const shift = (camX - x) * 0.15;
  drawSky(ctx, x - 200, y, w + 400, h, t, '#B9A7F5', 0.78);
  if (kind === 'ridges') {
    drawMemoryRidges(ctx, x - 300 - shift * 0.5, y + h * 0.55, w + 600, h * 0.4, t, 0.6);
    drawMemoryRidges(ctx, x - 300 - shift, y + h * 0.72, w + 600, h * 0.3, t, 0.2);
  } else if (kind === 'islands') {
    cloudBank(ctx, x - 200 - shift * 0.4, y + h * 0.9, w + 400, '#8c74d8', 0.5, 3);
    drawIsland(ctx, 'friendship', x + w * 0.3 - shift * 0.7, y + h * 0.6, 0.55, t, islands?.friendship ? 1 : 0);
    drawIsland(ctx, 'goofball', x + w * 0.78 - shift * 0.5, y + h * 0.66, 0.4, t, islands?.goofball === false ? 0 : 1);
    cloudBank(ctx, x - 200 - shift, y + h * 1.02, w + 400, '#cbbcff', 0.6, 5);
  } else {
    drawMemoryRidges(ctx, x - 300 - shift * 0.5, y + h * 0.65, w + 600, h * 0.35, t, 0.5);
    cloudBank(ctx, x - 200 - shift * 0.8, y + h * 0.95, w + 400, '#a08ae6', 0.55, 9);
  }
  ctx.restore();
}

export function drawBackWall(ctx: Ctx, t: number, camX: number, light: string, islands: Record<string, boolean>) {
  const W = HQ_W;
  // back wall
  const g = ctx.createLinearGradient(0, 0, 0, HQ_FLOOR);
  g.addColorStop(0, WALL_TOP);
  g.addColorStop(1, WALL_LOW);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, HQ_FLOOR);

  // large curved panels with arches: mid-century rhythm
  for (let i = 0; i < 17; i++) {
    const px = i * 200 + 20;
    if (px > SCREEN.x - 120 && px < SCREEN.x + SCREEN.w + 40) continue;
    ctx.fillStyle = i % 2 ? PANEL : mixHex(PANEL, '#4a3a8a', 0.4);
    roundRect(ctx, px, 130, 160, HQ_FLOOR - 210, [80, 80, 16, 16]);
    ctx.fill();
  }

  // windows into the mind world
  const wins: { x: number; y: number; w: number; h: number; kind: 'ridges' | 'islands' | 'tower' }[] = [
    { x: 560, y: 150, w: 380, h: 170, kind: 'ridges' },
    { x: 2380, y: 150, w: 300, h: 220, kind: 'tower' },
    { x: 2760, y: 140, w: 480, h: 380, kind: 'islands' },
  ];
  for (const w of wins) {
    ctx.save();
    roundRect(ctx, w.x, w.y, w.w, w.h, w.h / 2.2);
    ctx.clip();
    windowVista(ctx, w.x, w.y, w.w, w.h, t, camX, w.kind, islands);
    // glass sheen
    const sg = ctx.createLinearGradient(w.x, w.y, w.x + w.w, w.y + w.h);
    sg.addColorStop(0, 'rgba(255,255,255,0.14)');
    sg.addColorStop(0.4, 'rgba(255,255,255,0)');
    sg.addColorStop(0.55, 'rgba(255,255,255,0.08)');
    sg.addColorStop(0.6, 'rgba(255,255,255,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.restore();
    ctx.strokeStyle = TRIM;
    ctx.lineWidth = 8;
    roundRect(ctx, w.x, w.y, w.w, w.h, w.h / 2.2);
    ctx.stroke();
    ctx.strokeStyle = rgba('#000000', 0.25);
    ctx.lineWidth = 2;
    roundRect(ctx, w.x + 6, w.y + 6, w.w - 12, w.h - 12, w.h / 2.2 - 6);
    ctx.stroke();
  }

  // ceiling: a soft curved soffit with pendant lamps
  ctx.fillStyle = '#1f1548';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(W, 0);
  ctx.lineTo(W, 70);
  for (let i = 20; i >= 0; i--) ctx.lineTo((i / 20) * W, 70 + Math.sin(i * 0.9) * 10);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = rgba(TRIM, 0.6);
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i <= 20; i++) ctx.lineTo((i / 20) * W, 70 + Math.sin(i * 0.9) * 10);
  ctx.stroke();
  for (let i = 0; i < 9; i++) {
    const lx = 180 + i * 390;
    const ly = 108 + Math.sin(t * 0.8 + i) * 2;
    ctx.strokeStyle = '#5b4a9a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(lx, 74);
    ctx.lineTo(lx, ly - 14);
    ctx.stroke();
    glow(ctx, lx, ly + 10, 160, light, 0.6);
    ctx.fillStyle = '#5e4ca6';
    ctx.beginPath();
    ctx.ellipse(lx, ly, 34, 16, 0, Math.PI, 0);
    ctx.fill();
    ellipse(ctx, lx, ly, 30, 6, mixHex(light, '#ffffff', 0.5));
  }
}

export function drawFloor(ctx: Ctx, light: string, t: number) {
  const W = HQ_W;
  const g = ctx.createLinearGradient(0, HQ_FLOOR, 0, 900);
  g.addColorStop(0, '#5a4898');
  g.addColorStop(0.08, '#3d2d78');
  g.addColorStop(1, '#1d1446');
  ctx.fillStyle = g;
  ctx.fillRect(0, HQ_FLOOR, W, 900 - HQ_FLOOR);
  // skirting
  ctx.fillStyle = TRIM;
  ctx.fillRect(0, HQ_FLOOR - 6, W, 6);
  // floor tiles in perspective
  ctx.strokeStyle = 'rgba(185,167,245,0.12)';
  ctx.lineWidth = 2;
  for (let i = -10; i < W / 80 + 10; i++) {
    const x0 = i * 80;
    ctx.beginPath();
    ctx.moveTo(x0, HQ_FLOOR);
    ctx.lineTo(x0 + (x0 - W / 2) * 0.25, 900);
    ctx.stroke();
  }
  for (let j = 1; j < 5; j++) {
    const y = HQ_FLOOR + Math.pow(j / 5, 1.6) * (900 - HQ_FLOOR);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  // pools of light on the floor
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 9; i++) {
    const lx = 180 + i * 390;
    const pg = ctx.createRadialGradient(lx, HQ_FLOOR + 30, 0, lx, HQ_FLOOR + 30, 220);
    pg.addColorStop(0, rgba(light, 0.16 + Math.sin(t + i) * 0.02));
    pg.addColorStop(1, rgba(light, 0));
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.ellipse(lx, HQ_FLOOR + 30, 220, 60, 0, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/** The big window onto Riley's world. Content is drawn by the caller inside the clip. */
export function screenFrame(ctx: Ctx, light: string, t: number, inner: () => void) {
  const { x, y, w, h } = SCREEN;
  glow(ctx, x + w / 2, y + h / 2, w * 0.75, light, 0.45);
  ctx.fillStyle = '#20164a';
  roundRect(ctx, x - 26, y - 26, w + 52, h + 52, 70);
  ctx.fill();
  ctx.save();
  roundRect(ctx, x, y, w, h, 48);
  ctx.clip();
  inner();
  // scanline shimmer + glass reflection
  ctx.fillStyle = 'rgba(255,255,255,0.03)';
  for (let sy = y; sy < y + h; sy += 4) ctx.fillRect(x, sy, w, 1);
  const rg = ctx.createLinearGradient(x, y, x + w * 0.6, y + h);
  rg.addColorStop(0, 'rgba(255,255,255,0.16)');
  rg.addColorStop(0.35, 'rgba(255,255,255,0)');
  ctx.fillStyle = rg;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
  ctx.strokeStyle = TRIM;
  ctx.lineWidth = 10;
  roundRect(ctx, x - 4, y - 4, w + 8, h + 8, 52);
  ctx.stroke();
  ctx.strokeStyle = rgba(light, 0.6 + Math.sin(t * 3) * 0.2);
  ctx.lineWidth = 3;
  roundRect(ctx, x - 14, y - 14, w + 28, h + 28, 62);
  ctx.stroke();
}

/**
 * The central console. `needle` is the gauge angle 0..4 across the five emotions.
 */
export function drawConsole(ctx: Ctx, t: number, active: EmotionId, needle: number, pulse: number, engaged: number) {
  const cx = CONSOLE_X;
  const top = 600;
  const col = EMOTIONS[active].color;
  glow(ctx, cx, top + 20, 420, col, 0.5 + engaged * 0.4);
  // pedestal
  ctx.fillStyle = '#251a55';
  ctx.beginPath();
  ctx.moveTo(cx - 250, HQ_FLOOR);
  ctx.quadraticCurveTo(cx - 280, top + 90, cx - 330, top + 40);
  ctx.lineTo(cx + 330, top + 40);
  ctx.quadraticCurveTo(cx + 280, top + 90, cx + 250, HQ_FLOOR);
  ctx.closePath();
  ctx.fill();
  // front fascia with brass stripes
  ctx.strokeStyle = rgba(BRASS, 0.7);
  ctx.lineWidth = 3;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(cx - 290 + i * 18, top + 70 + i * 22);
    ctx.quadraticCurveTo(cx, top + 92 + i * 22, cx + 290 - i * 18, top + 70 + i * 22);
    ctx.stroke();
  }
  // desk surface (curved)
  const sg = ctx.createLinearGradient(0, top - 30, 0, top + 46);
  sg.addColorStop(0, '#6b58b4');
  sg.addColorStop(1, '#3a2b72');
  ctx.fillStyle = sg;
  ctx.beginPath();
  ctx.moveTo(cx - 360, top + 40);
  ctx.quadraticCurveTo(cx - 340, top - 20, cx - 260, top - 30);
  ctx.quadraticCurveTo(cx, top - 50, cx + 260, top - 30);
  ctx.quadraticCurveTo(cx + 340, top - 20, cx + 360, top + 40);
  ctx.quadraticCurveTo(cx, top + 66, cx - 360, top + 40);
  ctx.fill();
  ctx.strokeStyle = BRASS;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(cx - 360, top + 40);
  ctx.quadraticCurveTo(cx, top + 66, cx + 360, top + 40);
  ctx.stroke();

  // rows of buttons; the active emotion's row lights up
  EMOTION_ORDER.forEach((id, row) => {
    const E = EMOTIONS[id];
    const on = id === active;
    for (let i = 0; i < 7; i++) {
      const side = row < 3 ? -1 : 1;
      const r0 = row < 3 ? row : row - 3;
      const bx = cx + side * (120 + i * 26) + (side < 0 ? -0 : 0);
      const by = top - 8 + r0 * 20 + Math.abs(i - 3) * 1.2;
      const blink = on ? 0.55 + 0.45 * Math.sin(t * 6 + i * 0.9 + row) : 0.25;
      const c = mixHex('#2a1f5c', E.color, blink);
      ellipse(ctx, bx, by, 9, 6, c);
      if (on) glow(ctx, bx, by, 22, E.color, 0.5 * blink);
      ellipse(ctx, bx - 2, by - 2, 3, 1.5, 'rgba(255,255,255,0.5)');
    }
  });

  // gauge (half dial with five segments)
  const gx = cx + 210;
  const gy = top - 70;
  ctx.fillStyle = '#1b1240';
  ctx.beginPath();
  ctx.arc(gx, gy, 56, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  EMOTION_ORDER.forEach((id, i) => {
    const a0 = Math.PI + (i / 5) * Math.PI;
    ctx.strokeStyle = mixHex('#2a1f5c', EMOTIONS[id].color, id === active ? 1 : 0.45);
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.arc(gx, gy, 42, a0 + 0.04, a0 + Math.PI / 5 - 0.04);
    ctx.stroke();
  });
  const na = Math.PI + ((needle + 0.5) / 5) * Math.PI;
  ctx.strokeStyle = '#F3EEFF';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(gx, gy);
  ctx.lineTo(gx + Math.cos(na) * 46, gy + Math.sin(na) * 46);
  ctx.stroke();
  circle(ctx, gx, gy, 6, BRASS);
  ctx.strokeStyle = BRASS;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(gx, gy, 56, Math.PI, 0);
  ctx.closePath();
  ctx.stroke();
  // gauge stand
  ctx.fillStyle = '#3a2b72';
  ctx.fillRect(gx - 6, gy, 12, top - 30 - gy);

  // little memory monitor on the left
  const mx = cx - 260;
  const my = top - 130;
  ctx.fillStyle = '#3a2b72';
  ctx.fillRect(mx - 5, my + 60, 10, top - 30 - my - 60);
  ctx.fillStyle = '#1b1240';
  roundRect(ctx, mx - 60, my, 120, 70, 16);
  ctx.fill();
  ctx.strokeStyle = BRASS;
  ctx.lineWidth = 3;
  ctx.stroke();
  for (let i = 0; i < 12; i++) {
    const h = 6 + (Math.sin(t * 3 + i * 0.8) * 0.5 + 0.5) * 34 * (0.4 + pulse * 0.6);
    ctx.fillStyle = rgba(col, 0.85);
    ctx.fillRect(mx - 50 + i * 8.5, my + 60 - h, 5, h);
  }

  // the big control lever, knob glowing in the active colour
  const lean = Math.sin(t * 1.3) * 0.05 + engaged * 0.25;
  ctx.save();
  ctx.translate(cx, top - 20);
  ctx.rotate(lean);
  ctx.fillStyle = '#9a8ad8';
  roundRect(ctx, -5, -86, 10, 86, 5);
  ctx.fill();
  glow(ctx, 0, -96, 70 + pulse * 30, col, 0.9);
  const kg = ctx.createRadialGradient(-6, -102, 2, 0, -96, 20);
  kg.addColorStop(0, '#ffffff');
  kg.addColorStop(0.4, EMOTIONS[active].light);
  kg.addColorStop(1, col);
  circle(ctx, 0, -96, 20, kg);
  ctx.restore();
  ellipse(ctx, cx, top - 20, 34, 10, '#2a1f5c');
  ctx.strokeStyle = BRASS;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(cx, top - 20, 34, 10, 0, 0, TAU);
  ctx.stroke();
}

/** The pneumatic recall tube that leads to Long-Term Memory. */
export function drawRecallTube(ctx: Ctx, x: number, t: number, light: string) {
  const top = 60;
  const bottom = HQ_FLOOR;
  glow(ctx, x, 440, 260, '#B9A7F5', 0.5);
  const g = ctx.createLinearGradient(x - 70, 0, x + 70, 0);
  g.addColorStop(0, 'rgba(185,167,245,0.35)');
  g.addColorStop(0.3, 'rgba(185,167,245,0.08)');
  g.addColorStop(0.7, 'rgba(185,167,245,0.06)');
  g.addColorStop(1, 'rgba(185,167,245,0.3)');
  ctx.fillStyle = g;
  ctx.fillRect(x - 70, top, 140, bottom - top - 160);
  // rising orbs inside
  for (let i = 0; i < 6; i++) {
    const k = (t * 0.25 + i / 6) % 1;
    const oy = bottom - 200 - k * (bottom - top - 220);
    const c = [EMOTIONS.joy.color, EMOTIONS.sadness.color, EMOTIONS.fear.color, EMOTIONS.disgust.color, EMOTIONS.anger.color, light][i];
    memoryOrb(ctx, x + Math.sin(k * 12 + i) * 18, oy, 13, c, { glowAmt: 0.6 });
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x - 50, top);
  ctx.lineTo(x - 50, bottom - 160);
  ctx.stroke();
  // brass rings
  ctx.fillStyle = BRASS;
  for (let ry = top + 40; ry < bottom - 160; ry += 140) roundRect(ctx, x - 78, ry, 156, 12, 6), ctx.fill();
  // hatch at the base (the doorway)
  ctx.fillStyle = '#251a55';
  roundRect(ctx, x - 100, bottom - 170, 200, 170, [90, 90, 0, 0]);
  ctx.fill();
  ctx.strokeStyle = BRASS;
  ctx.lineWidth = 6;
  ctx.stroke();
  const dg = ctx.createRadialGradient(x, bottom - 80, 10, x, bottom - 80, 120);
  dg.addColorStop(0, 'rgba(220,205,255,0.85)');
  dg.addColorStop(1, 'rgba(120,90,220,0.15)');
  ctx.fillStyle = dg;
  roundRect(ctx, x - 82, bottom - 152, 164, 152, [80, 80, 0, 0]);
  ctx.fill();
  signText(ctx, 'Long-Term Memory', x, bottom - 200, 24, '#F3EEFF');
}

/** Shelves of today's memories along the left wall. */
export function drawDayShelves(ctx: Ctx, x0: number, x1: number, t: number, glowing: Record<number, boolean>) {
  const colors = [EMOTIONS.joy.color, EMOTIONS.sadness.color, EMOTIONS.anger.color, EMOTIONS.fear.color, EMOTIONS.disgust.color];
  for (let row = 0; row < 3; row++) {
    const y = 420 + row * 100;
    // shelf curve
    ctx.fillStyle = '#5e4ca6';
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.quadraticCurveTo((x0 + x1) / 2, y + 16, x1, y);
    ctx.lineTo(x1, y + 12);
    ctx.quadraticCurveTo((x0 + x1) / 2, y + 28, x0, y + 12);
    ctx.fill();
    ctx.fillStyle = BRASS;
    ctx.fillRect(x0, y + 10, 6, 4);
    const n = Math.floor((x1 - x0) / 38);
    for (let i = 0; i < n; i++) {
      const ox = x0 + 22 + i * 38;
      const oy = y - 16 + Math.sin(((ox - x0) / (x1 - x0)) * Math.PI) * 8;
      const c = colors[Math.floor(hash(i * 11.3 + row * 7) * 5)];
      const extra = glowing[row * 100 + i] ? 1 : 0;
      memoryOrb(ctx, ox, oy, 15, c, { glowAmt: 0.45 + extra, t });
    }
  }
}

/** The core memory holder: five slots, one per island. */
export function drawCoreHolder(ctx: Ctx, x: number, t: number, shelf: (MemoryDef | null)[], invite: number) {
  const baseY = HQ_FLOOR;
  glow(ctx, x, baseY - 180, 220, '#FFCF33', 0.35 + invite * 0.5);
  // pedestal
  ctx.fillStyle = '#251a55';
  ctx.beginPath();
  ctx.moveTo(x - 60, baseY);
  ctx.quadraticCurveTo(x - 30, baseY - 100, x - 26, baseY - 160);
  ctx.lineTo(x + 26, baseY - 160);
  ctx.quadraticCurveTo(x + 30, baseY - 100, x + 60, baseY);
  ctx.fill();
  ctx.strokeStyle = BRASS;
  ctx.lineWidth = 4;
  ctx.stroke();
  // arc of slots
  ctx.strokeStyle = BRASS;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(x, baseY - 160, 120, Math.PI * 1.08, Math.PI * 1.92);
  ctx.stroke();
  const n = shelf.length;
  for (let i = 0; i < n; i++) {
    const a = Math.PI * 1.12 + (i / (n - 1)) * Math.PI * 0.76;
    const sx = x + Math.cos(a) * 120;
    const sy = baseY - 160 + Math.sin(a) * 120;
    ctx.fillStyle = '#1b1240';
    ctx.beginPath();
    ctx.arc(sx, sy, 26, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = BRASS;
    ctx.lineWidth = 4;
    ctx.stroke();
    const m = shelf[i];
    if (m) {
      memoryOrb(ctx, sx, sy + Math.sin(t * 2 + i) * 2, 20, EMOTIONS[m.emotion].color, {
        t,
        swirl: m.swirl?.map((e) => EMOTIONS[e].color) ?? ['#ffffff'],
      });
    } else {
      // empty slot glimmers to show it can be filled
      ctx.strokeStyle = rgba('#FFCF33', 0.3 + invite * 0.6 * (0.5 + 0.5 * Math.sin(t * 5)));
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 6]);
      ctx.beginPath();
      ctx.arc(sx, sy, 18, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  signText(ctx, 'Core Memories', x, baseY - 330, 22, '#FFF1B0');
}

export function drawManual(ctx: Ctx, x: number, t: number) {
  const y = HQ_FLOOR;
  // side table
  ctx.fillStyle = '#5e4ca6';
  roundRect(ctx, x - 60, y - 110, 120, 14, 7);
  ctx.fill();
  ctx.strokeStyle = BRASS;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x - 40, y - 96);
  ctx.lineTo(x - 50, y);
  ctx.moveTo(x + 40, y - 96);
  ctx.lineTo(x + 50, y);
  ctx.stroke();
  // binders
  const cols = ['#E8516A', '#3CC6B8', '#FFCF33', '#9AD4FF'];
  cols.forEach((c, i) => {
    ctx.fillStyle = c;
    roundRect(ctx, x - 44 + i * 22, y - 170 + (i % 2) * 6, 20, 60 - (i % 2) * 6, 3);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillRect(x - 40 + i * 22, y - 150, 12, 4);
  });
  glow(ctx, x, y - 150, 60, '#FFF1B0', 0.3 + 0.1 * Math.sin(t * 2));
}

export function drawLamp(ctx: Ctx, x: number, lit: number, t: number) {
  const y = HQ_FLOOR;
  if (lit > 0) glow(ctx, x, y - 250, 260, '#FFCF33', lit * (0.9 + Math.sin(t * 3) * 0.05));
  ctx.strokeStyle = BRASS;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x - 30, y - 140, x + 10, y - 230);
  ctx.stroke();
  ellipse(ctx, x, y - 4, 40, 8, '#5e4ca6');
  ctx.fillStyle = lit > 0 ? mixHex('#5e4ca6', '#FFE58A', lit) : '#5e4ca6';
  ctx.beginPath();
  ctx.moveTo(x - 30, y - 220);
  ctx.lineTo(x + 50, y - 220);
  ctx.lineTo(x + 34, y - 270);
  ctx.lineTo(x - 14, y - 270);
  ctx.closePath();
  ctx.fill();
  if (lit > 0) {
    const lg = ctx.createLinearGradient(0, y - 220, 0, y);
    lg.addColorStop(0, rgba('#FFE58A', 0.35 * lit));
    lg.addColorStop(1, rgba('#FFE58A', 0));
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.moveTo(x - 30, y - 220);
    ctx.lineTo(x + 50, y - 220);
    ctx.lineTo(x + 140, y);
    ctx.lineTo(x - 120, y);
    ctx.fill();
  }
}

/** A loose cable across the floor: a trip hazard until Fear spots it. */
export function drawCable(ctx: Ctx, x: number, marked: number, fixed: boolean, t: number) {
  const y = HQ_FLOOR + 30;
  ctx.strokeStyle = '#1a1238';
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - 160, HQ_FLOOR - 2);
  if (fixed) {
    ctx.lineTo(x + 160, HQ_FLOOR - 2);
  } else {
    ctx.bezierCurveTo(x - 90, y + 30, x - 40, y - 26, x, y + 6);
    ctx.bezierCurveTo(x + 40, y + 40, x + 100, y - 10, x + 160, HQ_FLOOR - 2);
  }
  ctx.stroke();
  ctx.strokeStyle = '#7a64c8';
  ctx.lineWidth = 3;
  ctx.stroke();
  if (fixed) {
    ctx.fillStyle = '#FFCF33';
    for (let i = -1; i <= 1; i++) roundRect(ctx, x + i * 90 - 14, HQ_FLOOR - 9, 28, 14, 3), ctx.fill();
  }
  if (marked > 0 && !fixed) {
    ctx.save();
    ctx.globalAlpha = marked;
    ctx.strokeStyle = EMOTIONS.fear.color;
    ctx.lineWidth = 4;
    ctx.setLineDash([10, 8]);
    ctx.lineDashOffset = -t * 30;
    ctx.beginPath();
    ctx.ellipse(x, y + 4, 190, 40, 0, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    signText(ctx, 'Trip hazard!', x, y - 46, 22, EMOTIONS.fear.light);
    ctx.restore();
  }
}

/** A sticky bad idea drifting around HQ until Disgust flicks it out. */
export function drawBadIdea(ctx: Ctx, x: number, y: number, t: number, alpha: number) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  const r = 56 + Math.sin(t * 2) * 3;
  glow(ctx, x, y, r * 2, '#8a9a3a', 0.4);
  const g = ctx.createRadialGradient(x - 16, y - 18, 4, x, y, r);
  g.addColorStop(0, 'rgba(230,240,180,0.9)');
  g.addColorStop(1, 'rgba(140,160,60,0.75)');
  ctx.fillStyle = g;
  ctx.beginPath();
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * TAU;
    const rr = r + Math.sin(a * 5 + t * 3) * 4;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.fill();
  // drip
  ctx.beginPath();
  ctx.moveTo(x - 8, y + r - 4);
  ctx.quadraticCurveTo(x, y + r + 26 + Math.sin(t * 2) * 6, x + 8, y + r - 4);
  ctx.fill();
  ctx.fillStyle = '#2d3a10';
  ctx.font = `800 17px ${FONT_DISPLAY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Bad idea:', x, y - 14);
  ctx.font = `700 15px ${FONT_DISPLAY}`;
  ctx.fillText('eat the', x, y + 6);
  ctx.fillText('glue stick?', x, y + 24);
  ctx.restore();
}

export function drawBalconyDoor(ctx: Ctx, x: number, open: number, t: number, jammedShake: number) {
  const y = HQ_FLOOR;
  const w = 170;
  const h = 300;
  ctx.fillStyle = '#20164a';
  roundRect(ctx, x - w / 2 - 16, y - h - 16, w + 32, h + 16, [100, 100, 0, 0]);
  ctx.fill();
  // view beyond (glowing islands sky)
  ctx.save();
  roundRect(ctx, x - w / 2, y - h, w, h, [86, 86, 0, 0]);
  ctx.clip();
  const g = ctx.createLinearGradient(0, y - h, 0, y);
  g.addColorStop(0, '#3a2780');
  g.addColorStop(1, '#f0a3c8');
  ctx.fillStyle = g;
  ctx.fillRect(x - w / 2, y - h, w, h);
  glow(ctx, x, y - 60, 160, '#3CC6B8', 0.4 * open);
  // two door leaves slide apart
  const shake = Math.sin(t * 70) * jammedShake * 4;
  const leaf = (w / 2) * (1 - open);
  ctx.fillStyle = '#5e4ca6';
  ctx.fillRect(x - w / 2 + shake, y - h, leaf, h);
  ctx.fillRect(x + w / 2 - leaf - shake, y - h, leaf, h);
  ctx.strokeStyle = BRASS;
  ctx.lineWidth = 3;
  ctx.strokeRect(x - w / 2 + shake, y - h, leaf, h);
  ctx.strokeRect(x + w / 2 - leaf - shake, y - h, leaf, h);
  if (open < 0.05) {
    ellipse(ctx, x - 12, y - 140, 5, 14, BRASS);
    ellipse(ctx, x + 12, y - 140, 5, 14, BRASS);
  }
  ctx.restore();
  ctx.strokeStyle = BRASS;
  ctx.lineWidth = 7;
  roundRect(ctx, x - w / 2, y - h, w, h, [86, 86, 0, 0]);
  ctx.stroke();
  signText(ctx, 'Balcony', x, y - h - 40, 22, '#F3EEFF');
}

/** A couch with a cushion, for the lived-in feel. */
export function drawCouch(ctx: Ctx, x: number) {
  const y = HQ_FLOOR;
  ctx.fillStyle = '#E8516A';
  roundRect(ctx, x - 130, y - 120, 260, 70, [40, 40, 10, 10]);
  ctx.fill();
  ctx.fillStyle = '#c63c58';
  roundRect(ctx, x - 150, y - 70, 300, 50, 22);
  ctx.fill();
  ctx.fillStyle = '#ff7a92';
  roundRect(ctx, x - 120, y - 84, 110, 26, 13);
  ctx.fill();
  roundRect(ctx, x + 10, y - 84, 110, 26, 13);
  ctx.fill();
  ctx.strokeStyle = BRASS;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(x - 120, y - 22);
  ctx.lineTo(x - 132, y);
  ctx.moveTo(x + 120, y - 22);
  ctx.lineTo(x + 132, y);
  ctx.stroke();
}

/** Close foreground silhouettes for depth (drawn with parallax > 1). */
export function drawForeground(ctx: Ctx, t: number) {
  for (let i = 0; i < 9; i++) {
    const x = i * 520 + 120;
    ctx.fillStyle = 'rgba(12,7,38,0.85)';
    if (i % 3 === 0) {
      // potted thought-plant
      ellipse(ctx, x, 905, 70, 40, 'rgba(12,7,38,0.9)');
      for (let l = 0; l < 6; l++) {
        const a = -Math.PI / 2 + (l - 2.5) * 0.35 + Math.sin(t + l) * 0.03;
        ctx.beginPath();
        ctx.ellipse(x + Math.cos(a) * 60, 880 + Math.sin(a) * 90, 18, 54, a + Math.PI / 2, 0, TAU);
        ctx.fill();
      }
    } else if (i % 3 === 1) {
      // console cable bundle
      ctx.strokeStyle = 'rgba(12,7,38,0.9)';
      ctx.lineWidth = 22;
      ctx.beginPath();
      ctx.moveTo(x - 200, 920);
      ctx.quadraticCurveTo(x, 850, x + 200, 920);
      ctx.stroke();
    }
  }
}
