import type { Ctx } from '../../engine/draw';
import { FONT_DISPLAY, circle, ellipse, glow, mixHex, rgba, roundRect } from '../../engine/draw';
import { TAU } from '../../engine/math';
import type { ScreenSetup } from '../scenario/artClub';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const INK = '#22163f';

function face(ctx: Ctx, x: number, y: number, r: number, skin: string, mood: 'happy' | 'sad' | 'shout' | 'sly' | 'neutral' | 'focus' | 'sheepish', t: number, look = 0) {
  circle(ctx, x, y, r, skin);
  const ex = r * 0.38;
  const ey = y - r * 0.05;
  const blink = (t * 0.7 + x * 0.01) % 4 < 0.12;
  const eyeR = r * 0.12;
  if (mood === 'focus') {
    ctx.strokeStyle = INK;
    ctx.lineWidth = r * 0.07;
    ctx.beginPath();
    ctx.arc(x - ex, ey + r * 0.08, eyeR, Math.PI * 0.1, Math.PI * 0.9);
    ctx.moveTo(x + ex + eyeR, ey + r * 0.08);
    ctx.arc(x + ex, ey + r * 0.08, eyeR, Math.PI * 0.1, Math.PI * 0.9);
    ctx.stroke();
  } else if (blink) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = r * 0.06;
    ctx.beginPath();
    ctx.moveTo(x - ex - eyeR, ey);
    ctx.lineTo(x - ex + eyeR, ey);
    ctx.moveTo(x + ex - eyeR, ey);
    ctx.lineTo(x + ex + eyeR, ey);
    ctx.stroke();
  } else {
    circle(ctx, x - ex + look * eyeR * 0.5, ey, eyeR, INK);
    circle(ctx, x + ex + look * eyeR * 0.5, ey, eyeR, INK);
    circle(ctx, x - ex + look * eyeR * 0.5 - eyeR * 0.3, ey - eyeR * 0.3, eyeR * 0.35, '#fff');
    circle(ctx, x + ex + look * eyeR * 0.5 - eyeR * 0.3, ey - eyeR * 0.3, eyeR * 0.35, '#fff');
  }
  // brows
  ctx.strokeStyle = INK;
  ctx.lineWidth = r * 0.06;
  ctx.lineCap = 'round';
  const tilt = mood === 'sad' ? 0.35 : mood === 'shout' ? -0.3 : mood === 'sly' ? -0.15 : 0;
  [-1, 1].forEach((side) => {
    ctx.save();
    ctx.translate(x + side * ex, ey - r * 0.25);
    ctx.rotate(tilt * side * -1);
    ctx.beginPath();
    ctx.moveTo(-r * 0.13, 0);
    ctx.lineTo(r * 0.13, 0);
    ctx.stroke();
    ctx.restore();
  });
  // mouth
  const my = y + r * 0.42;
  ctx.fillStyle = INK;
  ctx.beginPath();
  switch (mood) {
    case 'happy':
      ctx.moveTo(x - r * 0.3, my - r * 0.06);
      ctx.quadraticCurveTo(x, my + r * 0.34, x + r * 0.3, my - r * 0.06);
      ctx.closePath();
      ctx.fill();
      break;
    case 'shout':
      ctx.ellipse(x, my + r * 0.05, r * 0.22, r * 0.2 + Math.abs(Math.sin(t * 10)) * r * 0.06, 0, 0, TAU);
      ctx.fill();
      break;
    case 'sad':
      ctx.lineWidth = r * 0.06;
      ctx.moveTo(x - r * 0.2, my + r * 0.08);
      ctx.quadraticCurveTo(x, my - r * 0.08, x + r * 0.2, my + r * 0.08);
      ctx.stroke();
      break;
    case 'sly':
    case 'sheepish':
      ctx.lineWidth = r * 0.06;
      ctx.moveTo(x - r * 0.22, my);
      ctx.quadraticCurveTo(x + r * 0.05, my + r * 0.12, x + r * 0.25, my - r * 0.08);
      ctx.stroke();
      break;
    default:
      ctx.lineWidth = r * 0.06;
      ctx.moveTo(x - r * 0.18, my);
      ctx.quadraticCurveTo(x, my + r * 0.1, x + r * 0.18, my);
      ctx.stroke();
  }
  // cheeks
  circle(ctx, x - r * 0.55, y + r * 0.22, r * 0.12, 'rgba(255,120,120,0.3)');
  circle(ctx, x + r * 0.55, y + r * 0.22, r * 0.12, 'rgba(255,120,120,0.3)');
}

function theo(ctx: Ctx, x: number, y: number, s: number, pose: ScreenSetup['theo'], t: number) {
  if (pose === 'none') return;
  const skin = '#8d5a3b';
  const bob = Math.sin(t * 2.2) * 2 * s;
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.scale(s, s);
  // hoodie body
  ctx.fillStyle = '#FF8A3D';
  ctx.beginPath();
  ctx.moveTo(-70, 120);
  ctx.quadraticCurveTo(-74, 10, 0, 6);
  ctx.quadraticCurveTo(74, 10, 70, 120);
  ctx.fill();
  ctx.strokeStyle = '#d96a22';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-14, 20);
  ctx.lineTo(-10, 60);
  ctx.moveTo(14, 20);
  ctx.lineTo(10, 60);
  ctx.stroke();
  // arm
  ctx.strokeStyle = '#FF8A3D';
  ctx.lineWidth = 22;
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (pose === 'shouting') {
    ctx.moveTo(40, 40);
    ctx.lineTo(70, -40 + Math.sin(t * 8) * 6);
  } else if (pose === 'offering') {
    ctx.moveTo(40, 40);
    ctx.lineTo(90, 30);
  } else {
    ctx.moveTo(40, 40);
    ctx.lineTo(60, 100);
  }
  ctx.stroke();
  if (pose === 'shouting') circle(ctx, 72, -50 + Math.sin(t * 8) * 6, 12, skin);
  if (pose === 'offering') {
    // pudding cup + paper
    circle(ctx, 100, 28, 12, skin);
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, 96, -6, 30, 30, 4);
    ctx.fill();
    ctx.fillStyle = '#8a5a2a';
    ctx.beginPath();
    ctx.ellipse(111, -4, 15, 5, 0, 0, TAU);
    ctx.fill();
  }
  // head + hair puffs
  for (let i = 0; i < 9; i++) {
    const a = Math.PI + (i / 8) * Math.PI;
    circle(ctx, Math.cos(a) * 38, -40 + Math.sin(a) * 36, 17, '#2a1a12');
  }
  const mood = pose === 'shouting' ? 'shout' : pose === 'offering' ? 'sly' : pose === 'sheepish' ? 'sheepish' : 'focus';
  face(ctx, 0, -34, 40, skin, mood, t, pose === 'sheepish' ? -1 : 0);
  ctx.restore();
}

function priya(ctx: Ctx, x: number, y: number, s: number, pose: ScreenSetup['priya'], t: number) {
  if (pose === 'none') return;
  const skin = '#c58b5e';
  const bob = Math.sin(t * 1.8 + 1) * 2 * s;
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.scale(s, s);
  // braid behind
  ctx.fillStyle = '#1a1020';
  for (let i = 0; i < 5; i++) circle(ctx, 40 + Math.sin(i) * 3, -10 + i * 20, 11 - i, '#1a1020');
  // sweater
  ctx.fillStyle = '#3CC6B8';
  ctx.beginPath();
  ctx.moveTo(-64, 120);
  ctx.quadraticCurveTo(-68, 12, 0, 8);
  ctx.quadraticCurveTo(68, 12, 64, 120);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (let i = -2; i <= 2; i++) ctx.fillRect(i * 22 - 2, 40, 4, 70);
  // hair
  ctx.beginPath();
  ctx.arc(0, -36, 42, Math.PI * 0.95, Math.PI * 2.05);
  ctx.fill();
  const mood = pose === 'quiet' ? 'sad' : pose === 'smiling' ? 'happy' : 'focus';
  face(ctx, 0, -30, 37, skin, mood, t, pose === 'quiet' ? 0 : -0.5);
  ctx.fillStyle = '#1a1020';
  ctx.beginPath();
  ctx.moveTo(-38, -44);
  ctx.quadraticCurveTo(-10, -80, 30, -60);
  ctx.quadraticCurveTo(0, -60, -38, -44);
  ctx.fill();
  // hair clip
  ctx.fillStyle = '#FFCF33';
  roundRect(ctx, -30, -62, 18, 7, 3);
  ctx.fill();
  ctx.restore();
}

function teacher(ctx: Ctx, x: number, y: number, s: number, t: number) {
  ctx.save();
  ctx.translate(x, y + Math.sin(t * 1.2) * 1.5);
  ctx.scale(s, s);
  ctx.fillStyle = '#7b4fa6';
  ctx.beginPath();
  ctx.moveTo(-60, 140);
  ctx.quadraticCurveTo(-60, 10, 0, 6);
  ctx.quadraticCurveTo(60, 10, 60, 140);
  ctx.fill();
  face(ctx, 0, -32, 36, '#5a3825', 'happy', t);
  // headwrap
  ctx.fillStyle = '#E9D27A';
  ctx.beginPath();
  ctx.ellipse(0, -66, 44, 26, 0, Math.PI, 0);
  ctx.fill();
  circle(ctx, 30, -80, 14, '#E9D27A');
  // glasses
  ctx.strokeStyle = '#22163f';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(-14, -34, 10, 0, TAU);
  ctx.moveTo(24, -34);
  ctx.arc(14, -34, 10, 0, TAU);
  ctx.stroke();
  ctx.restore();
}

/** Riley's first-person view of art club. */
export function drawArtRoom(ctx: Ctx, r: Rect, setup: ScreenSetup, t: number, highlight: { x: number; y: number }[] = []) {
  const { x, y, w, h } = r;
  // back wall
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#ffe7c9');
  g.addColorStop(1, '#f5c9a8');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  // window with sky
  ctx.fillStyle = '#9fd3ff';
  roundRect(ctx, x + w * 0.04, y + h * 0.08, w * 0.22, h * 0.38, 6);
  ctx.fill();
  ellipse(ctx, x + w * 0.1, y + h * 0.2, 26, 10, 'rgba(255,255,255,0.9)');
  ellipse(ctx, x + w * 0.18, y + h * 0.3, 20, 8, 'rgba(255,255,255,0.8)');
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 6;
  roundRect(ctx, x + w * 0.04, y + h * 0.08, w * 0.22, h * 0.38, 6);
  ctx.stroke();
  // posters / kids' art pinned on the wall
  const art = ['#FF8A3D', '#3D7BFF', '#52C46B', '#E8516A', '#A05CF0'];
  art.forEach((c, i) => {
    const px = x + w * (0.32 + i * 0.12);
    const py = y + h * (0.08 + (i % 2) * 0.05);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate((i % 2 ? 1 : -1) * 0.05);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w * 0.08, h * 0.16);
    ctx.fillStyle = c;
    circle(ctx, w * 0.04, h * 0.07, w * 0.022, c);
    ctx.fillRect(w * 0.015, h * 0.11, w * 0.05, 4);
    circle(ctx, w * 0.04, -2, 4, '#E8516A');
    ctx.restore();
  });
  // mural wall (blank or the cloud cat)
  if (setup.cloudCat) cloudCat(ctx, x + w * 0.9, y + h * 0.2, w * 0.00042, t, 0.9);
  if (setup.teacher) teacher(ctx, x + w * 0.52, y + h * 0.52, h * 0.0019, t);

  // kids across the table
  theo(ctx, x + w * 0.3, y + h * 0.62, h * 0.0023, setup.theo, t);
  priya(ctx, x + w * 0.76, y + h * 0.62, h * 0.0023, setup.priya, t);

  // the table (foreground)
  const tg = ctx.createLinearGradient(0, y + h * 0.7, 0, y + h);
  tg.addColorStop(0, '#c98c55');
  tg.addColorStop(1, '#a86d3c');
  ctx.fillStyle = tg;
  ctx.beginPath();
  ctx.moveTo(x - 10, y + h);
  ctx.lineTo(x + w * 0.08, y + h * 0.72);
  ctx.lineTo(x + w * 0.92, y + h * 0.72);
  ctx.lineTo(x + w + 10, y + h);
  ctx.fill();
  // paint splats on the table
  [
    [0.2, 0.86, '#3D7BFF'],
    [0.55, 0.92, '#FFCF33'],
    [0.8, 0.84, '#E8516A'],
  ].forEach(([u, v, c]) => ellipse(ctx, x + w * (u as number), y + h * (v as number), 14, 5, c as string));
  // the wobbly paint jar at the table edge
  if (setup.jar) {
    const wob = Math.sin(t * 5) * 0.12;
    ctx.save();
    ctx.translate(x + w * 0.16, y + h * 0.74);
    ctx.rotate(wob);
    ctx.fillStyle = 'rgba(200,230,255,0.75)';
    roundRect(ctx, -16, -50, 32, 50, 6);
    ctx.fill();
    ctx.fillStyle = '#3D7BFF';
    ctx.fillRect(-14, -26, 28, 24);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-18, -56, 36, 8);
    ctx.restore();
  }
  // Riley's sketch of the cloud cat
  if (setup.catSketch) {
    ctx.save();
    ctx.translate(x + w * 0.55, y + h * 0.84);
    ctx.rotate(-0.06);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-60, -34, 120, 68);
    cloudCat(ctx, 0, 0, 0.18, t, 1, true);
    ctx.restore();
  }
  // Priya's painting (with a smudge)
  if (setup.priya !== 'none') {
    ctx.save();
    ctx.translate(x + w * 0.7, y + h * 0.86);
    ctx.rotate(0.05);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-56, -30, 112, 60);
    // a horse, roughly
    ctx.fillStyle = '#8a5a2a';
    ellipse(ctx, 0, 4, 30, 14, '#8a5a2a');
    ellipse(ctx, 30, -10, 12, 9, '#8a5a2a');
    ctx.fillRect(-24, 10, 5, 16);
    ctx.fillRect(18, 10, 5, 16);
    if (setup.smudge) {
      ctx.fillStyle = 'rgba(60,50,90,0.7)';
      ctx.beginPath();
      ctx.ellipse(-4, -6, 44, 16, -0.4, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
  // Riley's own hands holding a brush, bottom of view (first person)
  ctx.fillStyle = '#f2b38f';
  ellipse(ctx, x + w * 0.42, y + h + 6, 34, 28, '#f2b38f');
  ctx.save();
  ctx.translate(x + w * 0.44, y + h - 10);
  ctx.rotate(-0.7 + Math.sin(t * 1.5) * 0.05);
  ctx.fillStyle = '#c7814a';
  ctx.fillRect(-3, -70, 6, 70);
  ctx.fillStyle = '#3D7BFF';
  ctx.beginPath();
  ctx.moveTo(-4, -70);
  ctx.quadraticCurveTo(0, -92, 4, -70);
  ctx.fill();
  ctx.restore();

  for (const p of highlight) glow(ctx, x + p.x * w, y + p.y * h, 60, '#ffffff', 0.4);
}

export function cloudCat(ctx: Ctx, x: number, y: number, s: number, t: number, alpha = 1, sketch = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s * 260, s * 260);
  ctx.globalAlpha = alpha;
  const fill = sketch ? 'rgba(0,0,0,0)' : '#ffffff';
  const stroke = sketch ? '#555' : '#9ab8ff';
  ctx.lineWidth = sketch ? 0.03 : 0.025;
  const puffs: [number, number, number][] = [
    [-0.4, 0.05, 0.28],
    [-0.1, -0.05, 0.32],
    [0.25, 0.02, 0.3],
    [0.5, 0.1, 0.22],
    [-0.2, 0.25, 0.24],
    [0.2, 0.26, 0.24],
  ];
  for (const [px, py, pr] of puffs) {
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.beginPath();
    ctx.arc(px, py + Math.sin(t + px * 5) * 0.01, pr, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }
  // head with ears
  ctx.beginPath();
  ctx.arc(0.62, -0.25, 0.22, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.48, -0.38);
  ctx.lineTo(0.5, -0.62);
  ctx.lineTo(0.62, -0.44);
  ctx.moveTo(0.66, -0.44);
  ctx.lineTo(0.8, -0.6);
  ctx.lineTo(0.78, -0.36);
  ctx.fill();
  ctx.stroke();
  // face
  ctx.fillStyle = sketch ? '#555' : '#22163f';
  ctx.beginPath();
  ctx.arc(0.56, -0.27, 0.03, 0, TAU);
  ctx.arc(0.7, -0.27, 0.03, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = sketch ? '#555' : '#22163f';
  ctx.beginPath();
  ctx.moveTo(0.63, -0.2);
  ctx.lineTo(0.85, -0.22);
  ctx.moveTo(0.63, -0.18);
  ctx.lineTo(0.84, -0.12);
  ctx.moveTo(0.6, -0.2);
  ctx.lineTo(0.38, -0.22);
  ctx.stroke();
  // tail
  ctx.strokeStyle = stroke;
  ctx.lineWidth = sketch ? 0.04 : 0.09;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-0.65, 0.05);
  ctx.quadraticCurveTo(-0.9, -0.2, -0.7, -0.4 + Math.sin(t * 2) * 0.03);
  ctx.stroke();
  ctx.restore();
}

/** Before the scenario: the school corridor outside art club. */
export function drawHallway(ctx: Ctx, r: Rect, t: number) {
  const { x, y, w, h } = r;
  const vx = x + w / 2;
  const vy = y + h * 0.45;
  ctx.fillStyle = '#d9e3f5';
  ctx.fillRect(x, y, w, h);
  // floor
  ctx.fillStyle = '#9aa7c7';
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(vx - 70, vy + 50);
  ctx.lineTo(vx + 70, vy + 50);
  ctx.lineTo(x + w, y + h);
  ctx.fill();
  // ceiling
  ctx.fillStyle = '#eef2fb';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(vx - 70, vy - 60);
  ctx.lineTo(vx + 70, vy - 60);
  ctx.lineTo(x + w, y);
  ctx.fill();
  // lockers on both walls
  for (let i = 0; i < 6; i++) {
    const k0 = i / 6;
    const k1 = (i + 0.85) / 6;
    const c = i % 2 ? '#3D7BFF' : '#52a0ff';
    [-1, 1].forEach((side) => {
      const ex = side < 0 ? x : x + w;
      const xa = ex + (vx + side * 70 - ex) * k0;
      const xb = ex + (vx + side * 70 - ex) * k1;
      const ta = y + (vy - 60 - y) * k0 + 30 * (1 - k0);
      const tb = y + (vy - 60 - y) * k1 + 30 * (1 - k1);
      const ba = y + h - (y + h - (vy + 50)) * k0 - 20 * (1 - k0);
      const bb = y + h - (y + h - (vy + 50)) * k1 - 20 * (1 - k1);
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(xa, ta);
      ctx.lineTo(xb, tb);
      ctx.lineTo(xb, bb);
      ctx.lineTo(xa, ba);
      ctx.fill();
    });
  }
  // door at the end
  ctx.fillStyle = '#ffb86b';
  roundRect(ctx, vx - 48, vy - 46, 96, 96, 4);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, vx - 34, vy - 34, 68, 30, 3);
  ctx.fill();
  ctx.fillStyle = '#22163f';
  ctx.font = `800 13px ${FONT_DISPLAY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ART CLUB', vx, vy - 24);
  ctx.font = `700 10px ${FONT_DISPLAY}`;
  ctx.fillText('Room 14B', vx, vy - 11);
  glow(ctx, vx, vy, 120, '#FFCF33', 0.25 + Math.sin(t * 2) * 0.08);
  // a little sticky note telling Riley it starts soon
  ctx.save();
  ctx.translate(x + w * 0.2, y + h * 0.3);
  ctx.rotate(-0.08);
  ctx.fillStyle = '#FFF1B0';
  ctx.fillRect(0, 0, 90, 70);
  ctx.fillStyle = '#5a4a20';
  ctx.font = `700 13px ${FONT_DISPLAY}`;
  ctx.textAlign = 'left';
  ctx.fillText('New members', 8, 20);
  ctx.fillText('welcome!', 8, 38);
  ctx.fillText('3:30', 8, 56);
  ctx.restore();
}

/** After the scenario: the finished mural. */
export function drawMural(ctx: Ctx, r: Rect, t: number) {
  const { x, y, w, h } = r;
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#8fd0ff');
  g.addColorStop(1, '#ffd9f0');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  // sun (Theo did the sky)
  glow(ctx, x + w * 0.15, y + h * 0.22, 140, '#FFCF33', 0.9);
  circle(ctx, x + w * 0.15, y + h * 0.22, 36, '#FFE58A');
  cloudCat(ctx, x + w * 0.5, y + h * 0.48, 0.0035 * w * 0.37, t, 1);
  // painted signatures
  ctx.fillStyle = mixHex('#22163f', '#3CC6B8', 0.3);
  ctx.font = `700 22px ${FONT_DISPLAY}`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('Riley + Priya + Theo', x + w - 40, y + h - 30);
  for (let i = 0; i < 20; i++) circle(ctx, x + ((i * 97) % w), y + h - 10 - ((i * 37) % 40), 3, rgba(['#FFCF33', '#E8516A', '#3CC6B8'][i % 3], 0.7));
}
