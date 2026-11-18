import type { Ctx } from '../../engine/draw';
import { circle, ellipse, glow, memoryOrb, mixHex, rgba, stars } from '../../engine/draw';
import { TAU, hash, noise1 } from '../../engine/math';
import type { IslandId } from '../content/world';
import { ISLANDS } from '../content/world';

export const MIND_NIGHT = '#170F3B';
export const HQ_PLUM = '#34265F';
export const LILAC = '#B9A7F5';
export const GLASS = '#F3EEFF';
export const BRASS = '#E7B76A';

/** The sky of Riley's mind: deep indigo with a warm horizon and drifting thought-light. */
export function drawSky(ctx: Ctx, x: number, y: number, w: number, h: number, t: number, tint = '#B9A7F5', horizon = 0.72) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#0f0a2e');
  g.addColorStop(0.45, '#2a1b66');
  g.addColorStop(horizon, mixHex('#7a4fb8', tint, 0.25));
  g.addColorStop(1, mixHex('#f0a3c8', tint, 0.2));
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  ctx.save();
  ctx.translate(x, y);
  stars(ctx, w, h * 0.6, Math.round(w / 9), t, 7);
  ctx.restore();
  // aurora threads: the light of thoughts travelling
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 4; i++) {
    const col = ['#FFCF33', '#3D7BFF', '#A05CF0', '#52C46B'][i];
    ctx.strokeStyle = rgba(col, 0.12);
    ctx.lineWidth = 26 - i * 4;
    ctx.beginPath();
    for (let k = 0; k <= 24; k++) {
      const px = x + (k / 24) * w;
      const py = y + h * (0.2 + i * 0.07) + Math.sin(k * 0.5 + t * 0.25 + i * 1.7) * 30 + noise1(k * 0.3 + i * 10 + t * 0.1) * 40;
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/** Soft cloud puffs. */
export function cloudBank(ctx: Ctx, x: number, y: number, w: number, color: string, alpha: number, seed = 1, depth = 60) {
  ctx.fillStyle = rgba(color, alpha);
  ctx.beginPath();
  const n = Math.max(3, Math.round(w / 60));
  for (let i = 0; i < n; i++) {
    const px = x + (i / (n - 1)) * w;
    const r = 30 + hash(i + seed * 13) * 40;
    ctx.moveTo(px + r, y);
    ctx.arc(px, y - hash(i * 3 + seed) * 20, r, 0, TAU);
  }
  ctx.rect(x, y, w, depth);
  ctx.fill();
}

/** Distant ridges of long-term memory shelves, glinting with orbs. */
export function drawMemoryRidges(ctx: Ctx, x: number, y: number, w: number, h: number, t: number, depth: number) {
  const col = mixHex('#3b2a7c', '#170F3B', depth);
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  for (let i = 0; i <= 40; i++) {
    const px = x + (i / 40) * w;
    const py = y + Math.sin(i * 0.7 + depth * 3) * h * 0.18 + noise1(i * 0.4 + depth * 9) * h * 0.25;
    ctx.lineTo(px, py);
  }
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
  ctx.fill();
  // shelf rows as glinting dots
  const colors = ['#FFCF33', '#3D7BFF', '#F0412D', '#A05CF0', '#52C46B'];
  for (let r = 0; r < 3; r++) {
    for (let i = 0; i < w / 14; i++) {
      const px = x + i * 14 + (r * 7) % 14;
      const base = y + h * (0.35 + r * 0.18);
      if (hash(i * 7.1 + r * 33 + depth * 99) < 0.45) continue;
      const c = colors[Math.floor(hash(i * 3.3 + r + depth) * 5)];
      const tw = 0.45 + 0.55 * Math.sin(t * 2 + i * 1.3 + r);
      circle(ctx, px, base, 2 + (1 - depth) * 1.5, rgba(c, (0.35 + 0.5 * tw) * (1 - depth * 0.5)));
    }
  }
}

/** Island silhouettes and lit details. `lit` 0..1. */
export function drawIsland(ctx: Ctx, id: IslandId, x: number, y: number, s: number, t: number, lit: number) {
  const def = ISLANDS.find((i) => i.id === id)!;
  const col = def.color;
  const rock = mixHex('#2a1f5c', '#4a3a8a', lit * 0.4);
  ctx.save();
  ctx.translate(x, y + Math.sin(t * 0.6 + x * 0.01) * 6 * s);
  ctx.scale(s, s);
  if (lit > 0) glow(ctx, 0, -60, 260, col, 0.55 * lit);
  // floating rock base
  ctx.fillStyle = rock;
  ctx.beginPath();
  ctx.moveTo(-120, 0);
  ctx.quadraticCurveTo(-100, -18, 0, -16);
  ctx.quadraticCurveTo(100, -18, 120, 0);
  ctx.quadraticCurveTo(60, 50, 20, 110);
  ctx.quadraticCurveTo(0, 140, -10, 110);
  ctx.quadraticCurveTo(-60, 60, -120, 0);
  ctx.fill();
  ctx.fillStyle = mixHex(rock, '#0c0726', 0.35);
  ctx.beginPath();
  ctx.moveTo(-120, 0);
  ctx.quadraticCurveTo(0, 18, 120, 0);
  ctx.quadraticCurveTo(60, 50, 20, 110);
  ctx.quadraticCurveTo(0, 140, -10, 110);
  ctx.quadraticCurveTo(-60, 60, -120, 0);
  ctx.fill();
  // grassy top
  ctx.fillStyle = lit ? mixHex('#3a2f70', col, 0.35 * lit) : '#3a2f70';
  ctx.beginPath();
  ctx.ellipse(0, -10, 118, 14, 0, 0, TAU);
  ctx.fill();

  const lineCol = lit > 0 ? mixHex('#5b4a9a', col, lit) : '#4a3d80';
  const light = (a: number) => rgba(col, a * lit);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  switch (id) {
    case 'family': {
      // a house with a big tree and a porch light
      ctx.fillStyle = lineCol;
      ctx.beginPath();
      ctx.moveTo(-50, -14);
      ctx.lineTo(-50, -70);
      ctx.lineTo(-10, -104);
      ctx.lineTo(30, -70);
      ctx.lineTo(30, -14);
      ctx.fill();
      ctx.fillStyle = light(0.95);
      ctx.fillRect(-36, -60, 14, 14);
      ctx.fillRect(2, -60, 14, 14);
      ctx.fillRect(-18, -40, 16, 26);
      circle(ctx, 60, -80, 40, lineCol);
      circle(ctx, 80, -100, 26, lineCol);
      ctx.fillRect(56, -50, 8, 40);
      if (lit) glow(ctx, -10, -30, 40, col, lit);
      break;
    }
    case 'friendship': {
      // a ferris wheel that turns when lit
      const rot = t * 0.5 * lit;
      ctx.strokeStyle = lineCol;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(-40, -14);
      ctx.lineTo(0, -80);
      ctx.lineTo(40, -14);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -80, 58, 0, TAU);
      ctx.stroke();
      for (let i = 0; i < 8; i++) {
        const a = rot + (i / 8) * TAU;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(0, -80);
        ctx.lineTo(Math.cos(a) * 58, -80 + Math.sin(a) * 58);
        ctx.stroke();
        const cc = ['#FFCF33', '#3D7BFF', '#F0412D', '#A05CF0', '#52C46B', '#3CC6B8', '#FF7FB0', '#FFB86B'][i];
        circle(ctx, Math.cos(a) * 58, -80 + Math.sin(a) * 58 + 8, 8, lit > 0 ? mixHex('#4a3d80', cc, lit) : '#4a3d80');
      }
      circle(ctx, 0, -80, 8, lineCol);
      break;
    }
    case 'honesty': {
      // lighthouse with a sweeping beam
      ctx.fillStyle = lineCol;
      ctx.beginPath();
      ctx.moveTo(-22, -14);
      ctx.lineTo(-14, -120);
      ctx.lineTo(14, -120);
      ctx.lineTo(22, -14);
      ctx.fill();
      ctx.fillStyle = rgba('#ffffff', 0.25);
      ctx.fillRect(-18, -60, 36, 10);
      ctx.fillRect(-16, -96, 32, 10);
      ctx.fillStyle = lineCol;
      ctx.fillRect(-20, -136, 40, 16);
      ctx.beginPath();
      ctx.moveTo(-16, -136);
      ctx.lineTo(0, -156);
      ctx.lineTo(16, -136);
      ctx.fill();
      if (lit) {
        const a = Math.sin(t * 0.8) * 0.9;
        ctx.save();
        ctx.translate(0, -128);
        ctx.rotate(a);
        const bg = ctx.createLinearGradient(0, 0, 340, 0);
        bg.addColorStop(0, light(0.8));
        bg.addColorStop(1, light(0));
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.moveTo(0, -4);
        ctx.lineTo(340, -50);
        ctx.lineTo(340, 50);
        ctx.lineTo(0, 4);
        ctx.fill();
        ctx.restore();
        glow(ctx, 0, -128, 40, '#ffffff', lit);
      }
      break;
    }
    case 'curiosity': {
      // observatory dome with a telescope
      ctx.fillStyle = lineCol;
      ctx.fillRect(-46, -50, 92, 36);
      ctx.beginPath();
      ctx.arc(0, -50, 46, Math.PI, 0);
      ctx.fill();
      ctx.save();
      ctx.translate(10, -74);
      ctx.rotate(-0.7 + Math.sin(t * 0.3) * 0.15 * lit);
      ctx.fillRect(0, -9, 76, 18);
      ctx.fillRect(70, -12, 14, 24);
      ctx.restore();
      ctx.fillStyle = light(0.9);
      ctx.fillRect(-30, -40, 12, 14);
      ctx.fillRect(18, -40, 12, 14);
      if (lit) for (let i = 0; i < 5; i++) circle(ctx, 120 + i * 18, -170 - i * 14, 2.5, light(0.5 + 0.5 * Math.sin(t * 3 + i)));
      break;
    }
    case 'hockey': {
      // a little floodlit rink with a goal and a scoreboard
      ctx.fillStyle = lit ? mixHex('#4a3d80', '#E8F4FF', lit * 0.8) : '#4a3d80';
      ctx.beginPath();
      ctx.ellipse(0, -22, 80, 12, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = lineCol;
      ctx.lineWidth = 4;
      ctx.strokeRect(40, -48, 26, 22);
      ctx.fillStyle = lineCol;
      ctx.fillRect(-70, -100, 6, 80);
      ctx.fillRect(64, -100, 6, 80);
      ctx.fillRect(-36, -96, 60, 30);
      ctx.fillStyle = lit ? rgba('#E63946', lit) : '#3a2f70';
      ctx.fillRect(-30, -90, 48, 18);
      if (lit) {
        glow(ctx, -67, -104, 60, '#ffffff', lit * 0.8);
        glow(ctx, 67, -104, 60, '#ffffff', lit * 0.8);
      }
      break;
    }
    case 'goofball': {
      // wobbly striped bouncy tent
      const wob = Math.sin(t * 3) * 6 * lit;
      ctx.fillStyle = lineCol;
      ctx.beginPath();
      ctx.moveTo(-60, -14);
      ctx.quadraticCurveTo(-40 + wob, -70, 0 + wob, -110);
      ctx.quadraticCurveTo(40 + wob, -70, 60, -14);
      ctx.fill();
      ctx.fillStyle = light(0.85);
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 22 - 8, -14);
        ctx.quadraticCurveTo(i * 10 + wob * 0.8, -70, wob, -108);
        ctx.quadraticCurveTo(i * 10 + 6 + wob * 0.8, -70, i * 22 + 8, -14);
        ctx.fill();
      }
      circle(ctx, wob, -116, 8, lit ? '#FFCF33' : lineCol);
      break;
    }
  }
  ctx.restore();
}

/** Headquarters seen from outside: a glowing pod on a tall stem. */
export function drawHQTower(ctx: Ctx, x: number, y: number, s: number, t: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  glow(ctx, 0, -320, 420, '#FFCF33', 0.4);
  // stem
  const sg = ctx.createLinearGradient(-40, 0, 40, 0);
  sg.addColorStop(0, '#2a1f5c');
  sg.addColorStop(0.5, '#5a4898');
  sg.addColorStop(1, '#2a1f5c');
  ctx.fillStyle = sg;
  ctx.beginPath();
  ctx.moveTo(-36, 0);
  ctx.quadraticCurveTo(-18, -150, -40, -240);
  ctx.lineTo(40, -240);
  ctx.quadraticCurveTo(18, -150, 36, 0);
  ctx.fill();
  // pod
  ctx.fillStyle = '#4a3a8a';
  ctx.beginPath();
  ctx.ellipse(0, -310, 190, 96, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#5e4ca6';
  ctx.beginPath();
  ctx.ellipse(0, -330, 180, 70, 0, Math.PI, 0);
  ctx.fill();
  // panoramic window
  const wg = ctx.createLinearGradient(0, -350, 0, -280);
  wg.addColorStop(0, '#FFF1B0');
  wg.addColorStop(1, '#FFCF33');
  ctx.fillStyle = wg;
  ctx.beginPath();
  ctx.ellipse(0, -312, 150, 34, 0, 0, TAU);
  ctx.fill();
  // tiny silhouettes of emotions in the window
  const cols = ['#F0412D', '#A05CF0', '#FFCF33', '#3D7BFF', '#52C46B'];
  cols.forEach((c, i) => {
    const px = -80 + i * 40 + Math.sin(t * 2 + i) * 3;
    ellipse(ctx, px, -306, 7, 13, mixHex(c, '#2a1f5c', 0.3));
  });
  // antenna
  ctx.strokeStyle = '#5e4ca6';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(0, -400);
  ctx.lineTo(0, -460);
  ctx.stroke();
  circle(ctx, 0, -466, 10, '#FFCF33');
  glow(ctx, 0, -466, 40 + Math.sin(t * 4) * 8, '#FFCF33', 1);
  ctx.restore();
}

/** A light-thread bridge between two points (thought connections). */
export function lightBridge(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, color: string, t: number, alpha = 1) {
  const mx = (x1 + x2) / 2;
  const my = Math.max(y1, y2) + 60;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = rgba(color, 0.35 * alpha);
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.quadraticCurveTo(mx, my, x2, y2);
  ctx.stroke();
  ctx.strokeStyle = rgba('#ffffff', 0.5 * alpha);
  ctx.lineWidth = 2;
  ctx.stroke();
  // pulses travelling along
  for (let i = 0; i < 3; i++) {
    const k = (t * 0.35 + i / 3) % 1;
    const px = (1 - k) * (1 - k) * x1 + 2 * (1 - k) * k * mx + k * k * x2;
    const py = (1 - k) * (1 - k) * y1 + 2 * (1 - k) * k * my + k * k * y2;
    glow(ctx, px, py, 18, color, alpha);
  }
  ctx.restore();
}

/** A rotating little memory orb used as decoration. */
export function orbAt(ctx: Ctx, x: number, y: number, r: number, color: string, t: number) {
  memoryOrb(ctx, x, y + Math.sin(t * 2 + x) * 2, r, color, { t });
}

export function vignette(ctx: Ctx, w: number, h: number, amt = 0.55) {
  const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, h * 0.95);
  g.addColorStop(0, 'rgba(8,4,28,0)');
  g.addColorStop(1, `rgba(8,4,28,${amt})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

export { ellipse };
