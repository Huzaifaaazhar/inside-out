import { STAGE_H, STAGE_W } from '../../engine/camera';
import type { Ctx } from '../../engine/draw';
import { circle, glow, memoryOrb, rgba, stars } from '../../engine/draw';
import { TAU, clamp, easeInCubic, easeInOutCubic, easeOutCubic, lerp } from '../../engine/math';
import { useGame } from '../../state/store';
import { cloudBank, drawHQTower, drawIsland, drawMemoryRidges, drawSky, lightBridge } from '../art/mindscape';
import type { IslandId } from '../content/world';
import type { Game } from '../Game';
import { Scene } from '../Scene';

interface Shot {
  start: number;
  end: number;
  caption: string | null;
}

const SHOTS: Shot[] = [
  { start: 0, end: 5.5, caption: 'Every person carries a whole world inside them.' },
  { start: 5.5, end: 12, caption: 'This is Riley. She’s eleven, she just moved to a new city, and today is her first day at art club.' },
  { start: 12, end: 19, caption: 'Inside her mind, five emotions take turns at the controls.' },
  { start: 19, end: 25, caption: 'They work from a place called Headquarters. Today, they need an operator.' },
  { start: 25, end: 28, caption: 'That’s you.' },
];
const END = 28;
const COLORS = ['#FFCF33', '#3D7BFF', '#F0412D', '#A05CF0', '#52C46B'];

export class OpeningScene extends Scene {
  readonly id = 'opening' as const;
  private t = 0;
  private shot = -1;
  private done = false;

  constructor(game: Game) {
    super(game);
  }

  enter() {
    this.t = 0;
    this.shot = -1;
    this.done = false;
    this.particles.clear();
  }

  skip() {
    if (this.done) return;
    this.done = true;
    useGame.getState().setCaption(null);
    useGame.getState().finishOpening();
  }

  update(dt: number) {
    this.time += dt;
    const st = useGame.getState();
    if (st.phase !== 'opening') {
      this.particles.update(dt);
      return;
    }
    this.t += dt;
    const idx = SHOTS.findIndex((s) => this.t >= s.start && this.t < s.end);
    if (idx !== this.shot && idx >= 0) {
      this.shot = idx;
      st.setCaption(SHOTS[idx].caption);
      const a = this.game.audio;
      if (idx === 0) a.chime(-5);
      if (idx === 1) a.soft();
      if (idx === 2) a.whoosh(false);
      if (idx === 3) a.whoosh(true);
      if (idx === 4) a.coreMemory();
    }
    if (this.t >= END) this.skip();
    if (this.shot === 2) {
      for (let i = 0; i < 2; i++) this.particles.emit({ x: Math.random() * STAGE_W, y: STAGE_H + 20, count: 1, color: COLORS, shape: 'dot', speed: [200, 400], angle: [-Math.PI * 0.55, -Math.PI * 0.45], life: [1, 2], size: [2, 4] });
    }
    this.particles.update(dt);
  }

  render(ctx: Ctx) {
    const st = useGame.getState();
    if (st.phase === 'title') return this.renderTitleBackdrop(ctx);
    const t = this.t;
    const local = (i: number) => clamp((t - SHOTS[i].start) / (SHOTS[i].end - SHOTS[i].start), 0, 1);
    ctx.fillStyle = '#07041a';
    ctx.fillRect(0, 0, STAGE_W, STAGE_H);
    if (t < SHOTS[1].start + 0.8) this.shotSpark(ctx, local(0), t);
    if (t >= SHOTS[1].start && t < SHOTS[2].start + 1) this.shotRiley(ctx, local(1), t, clamp((t - SHOTS[1].start) / 0.8, 0, 1) * clamp((SHOTS[2].start + 1 - t) / 1, 0, 1));
    if (t >= SHOTS[2].start) this.shotDive(ctx, local(2), local(3), t);
    if (t >= SHOTS[4].start) {
      const k = local(4);
      ctx.fillStyle = `rgba(255,243,200,${clamp(k * 2.2, 0, 1) * clamp((1 - k) * 3, 0, 1) + (k > 0.6 ? 0 : 0)})`;
      ctx.fillRect(0, 0, STAGE_W, STAGE_H);
      if (k > 0.66) {
        ctx.fillStyle = `rgba(23,15,59,${(k - 0.66) * 3})`;
        ctx.fillRect(0, 0, STAGE_W, STAGE_H);
      }
    }
    this.particles.render(ctx);
    // letterbox bars for a cinematic frame
    const bar = 60;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, STAGE_W, bar);
    ctx.fillRect(0, STAGE_H - bar, STAGE_W, bar);
  }

  /** Behind the title screen: a slow drift through the mind sky. */
  private renderTitleBackdrop(ctx: Ctx) {
    const t = this.time;
    drawSky(ctx, 0, 0, STAGE_W, STAGE_H, t, '#B9A7F5', 0.75);
    drawMemoryRidges(ctx, -100 - ((t * 6) % 200), 600, STAGE_W + 400, 300, t, 0.5);
    const isl: IslandId[] = ['family', 'friendship', 'honesty', 'curiosity', 'goofball'];
    isl.forEach((id, i) => drawIsland(ctx, id, 160 + i * 320, 560 + (i % 2) * 40, 0.42, t, id === 'friendship' ? 0 : 0.8));
    drawHQTower(ctx, STAGE_W / 2, 900, 0.85, t);
    cloudBank(ctx, -200, 860, STAGE_W + 400, '#8c74d8', 0.7, 4);
    for (let i = 0; i < 14; i++) {
      const x = (i * 131 + t * (10 + (i % 4) * 6)) % (STAGE_W + 100) - 50;
      const y = 140 + ((i * 71) % 420) + Math.sin(t + i) * 14;
      memoryOrb(ctx, x, y, 6 + (i % 3) * 3, COLORS[i % 5], { glowAmt: 0.6 });
    }
    const g = ctx.createRadialGradient(STAGE_W / 2, STAGE_H * 0.42, 100, STAGE_W / 2, STAGE_H / 2, STAGE_W * 0.7);
    g.addColorStop(0, 'rgba(7,4,26,0.15)');
    g.addColorStop(1, 'rgba(7,4,26,0.75)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, STAGE_W, STAGE_H);
  }

  /** Shot 1: one golden spark in the dark becomes a memory. */
  private shotSpark(ctx: Ctx, p: number, t: number) {
    const fadeOut = clamp((SHOTS[1].start + 0.8 - t) / 0.8, 0, 1);
    ctx.save();
    ctx.globalAlpha = fadeOut;
    stars(ctx, STAGE_W, STAGE_H, 120, t, 3, 0, clamp(p * 2, 0, 1) * 0.7);
    const grow = easeOutCubic(clamp(p / 0.7, 0, 1));
    const cx = STAGE_W / 2;
    const cy = STAGE_H / 2 - 20 + Math.sin(t * 1.5) * 6;
    glow(ctx, cx, cy, 60 + grow * 260, '#FFCF33', 0.4 + grow * 0.6);
    memoryOrb(ctx, cx, cy, 4 + grow * 42, '#FFCF33', { t, swirl: grow > 0.5 ? COLORS : undefined, glowAmt: 1.5 });
    // tiny satellites of colour orbit as it forms
    for (let i = 0; i < 5; i++) {
      const a = t * 1.2 + (i / 5) * TAU;
      const r = 90 + Math.sin(t * 2 + i) * 10;
      circle(ctx, cx + Math.cos(a) * r * grow, cy + Math.sin(a) * r * 0.5 * grow, 4 * grow, rgba(COLORS[i], 0.9));
    }
    ctx.restore();
  }

  /** Shot 2: Riley in profile; the memory drifts into her head. */
  private shotRiley(ctx: Ctx, p: number, t: number, alpha: number) {
    ctx.save();
    ctx.globalAlpha = alpha;
    const g = ctx.createLinearGradient(0, 0, 0, STAGE_H);
    g.addColorStop(0, '#2a1b66');
    g.addColorStop(1, '#f0a3c8');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, STAGE_W, STAGE_H);
    // city skyline silhouette, hills and a bridge: a new city
    ctx.fillStyle = 'rgba(30,18,80,0.55)';
    for (let i = 0; i < 24; i++) {
      const bw = 40 + ((i * 37) % 50);
      const bh = 80 + ((i * 53) % 160);
      ctx.fillRect(i * 70 - 20, STAGE_H - 140 - bh, bw, bh + 140);
    }
    ctx.strokeStyle = 'rgba(30,18,80,0.6)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(900, STAGE_H - 200);
    ctx.quadraticCurveTo(1200, STAGE_H - 330, 1500, STAGE_H - 200);
    ctx.stroke();
    const zoom = 1 + easeInCubic(clamp((p - 0.7) / 0.3, 0, 1)) * 2.5;
    const hx = 700;
    const hy = 470;
    ctx.translate(hx, hy);
    ctx.scale(zoom, zoom);
    ctx.translate(-hx, -hy);
    // profile silhouette (facing right), with a ponytail
    ctx.fillStyle = '#1a1040';
    ctx.beginPath();
    ctx.moveTo(560, 900);
    ctx.bezierCurveTo(560, 760, 600, 700, 600, 640);
    ctx.bezierCurveTo(540, 600, 520, 470, 580, 380);
    ctx.bezierCurveTo(640, 290, 780, 290, 840, 380);
    ctx.bezierCurveTo(870, 420, 860, 450, 880, 480);
    ctx.lineTo(900, 520);
    ctx.lineTo(872, 530);
    ctx.bezierCurveTo(880, 560, 870, 570, 862, 580);
    ctx.bezierCurveTo(870, 600, 850, 620, 820, 620);
    ctx.bezierCurveTo(800, 640, 790, 680, 800, 720);
    ctx.bezierCurveTo(820, 790, 860, 840, 880, 900);
    ctx.closePath();
    ctx.fill();
    // ponytail
    const sway = Math.sin(t * 1.6) * 12;
    ctx.beginPath();
    ctx.moveTo(585, 400);
    ctx.bezierCurveTo(500 + sway, 400, 470 + sway, 520, 500 + sway, 600);
    ctx.bezierCurveTo(530, 520, 560, 470, 600, 440);
    ctx.fill();
    // rim light
    ctx.strokeStyle = rgba('#FFCF33', 0.6);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(840, 380);
    ctx.bezierCurveTo(870, 420, 860, 450, 880, 480);
    ctx.lineTo(900, 520);
    ctx.stroke();
    // the memory drifts in and the inside of her head lights up
    const k = easeInOutCubic(clamp(p / 0.6, 0, 1));
    const ox = lerp(1250, 700, k);
    const oy = lerp(250, 470, k) - Math.sin(k * Math.PI) * 60;
    const inside = clamp((p - 0.55) / 0.3, 0, 1);
    if (inside > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(700, 470, 150, 130, 0, 0, TAU);
      ctx.clip();
      drawSky(ctx, 540, 330, 320, 280, t, '#FFCF33');
      glow(ctx, 700, 470, 200, '#FFCF33', inside);
      ctx.restore();
    }
    memoryOrb(ctx, ox, oy, 22 * (1 - inside * 0.6), '#FFCF33', { t, swirl: COLORS, glowAmt: 1.2 });
    ctx.restore();
  }

  /** Shots 3–4: falling through thought-clouds into the mind world, then flying at HQ. */
  private shotDive(ctx: Ctx, p3: number, p4: number, t: number) {
    const fadeIn = clamp((t - SHOTS[2].start) / 1, 0, 1);
    ctx.save();
    ctx.globalAlpha = fadeIn;
    const descend = easeInOutCubic(p3);
    drawSky(ctx, 0, -400 + descend * 400, STAGE_W, STAGE_H + 400, t, '#B9A7F5', 0.78);
    // the world rises into view
    const worldY = lerp(500, 0, descend);
    const approach = easeInCubic(p4);
    const z = 1 + approach * 3.2;
    ctx.save();
    ctx.translate(STAGE_W / 2, 470);
    ctx.scale(z, z);
    ctx.translate(-STAGE_W / 2, -470 + worldY);
    drawMemoryRidges(ctx, -400, 560, STAGE_W + 800, 280, t, 0.6);
    drawMemoryRidges(ctx, -400, 660, STAGE_W + 800, 260, t, 0.3);
    const isl: [IslandId, number, number][] = [
      ['family', 230, 520],
      ['friendship', 470, 430],
      ['honesty', 1130, 440],
      ['curiosity', 1380, 520],
      ['goofball', 800, 300],
    ];
    for (const [id, x, y] of isl) {
      lightBridge(ctx, STAGE_W / 2, 560, x, y, id === 'friendship' ? '#3CC6B8' : '#FFCF33', t, id === 'friendship' ? 0.2 : 0.8);
      drawIsland(ctx, id, x, y, 0.5, t, id === 'friendship' ? 0 : 1);
    }
    drawHQTower(ctx, STAGE_W / 2, 800, 0.8, t);
    ctx.restore();
    // clouds rushing past, front-most layers scale fastest
    for (let layer = 0; layer < 3; layer++) {
      const speed = [1.0, 1.6, 2.4][layer];
      const y = STAGE_H + 120 + 260 * layer - descend * 900 * speed;
      cloudBank(ctx, -200, y, STAGE_W + 400, ['#d8ccff', '#b6a3f0', '#8c74d8'][layer], 0.55 * (1 - p4), layer + 4, 1400);
    }
    ctx.restore();
  }
}
