import { STAGE_H, STAGE_W } from '../../engine/camera';
import type { Ctx } from '../../engine/draw';
import { circle, ellipse, glow, memoryOrb, rgba, signText } from '../../engine/draw';
import { TAU, hash } from '../../engine/math';
import { useGame } from '../../state/store';
import { EMOTIONS } from '../content/emotions';
import type { MemoryEntry } from '../content/memories';
import type { Game } from '../Game';
import { allEntries } from '../systems/library';
import type { Interactable } from '../WorldScene';
import { Actor, WorldScene } from '../WorldScene';

const FLOOR = 770;
const DOWN_X = 2960;

interface Drifter {
  entry: MemoryEntry;
  x: number;
  seed: number;
}

/**
 * The Fading: grey dunes, a pale sun, wind carrying dust. Colour drains here.
 * Forgotten memories drift until someone recalls them or lets them go.
 */
export class FadingScene extends WorldScene {
  readonly id = 'fading' as const;
  worldW = 3150;
  floorY = FLOOR;
  private drifters: Drifter[] = [];
  private sig = '';
  private dyn: Interactable[] = [];
  private wispX = 1300;

  constructor(game: Game) {
    super(game);
    this.actors = [new Actor('joy', 220, FLOOR, 6)];
    this.roomLight = 0.06;
    const store = () => useGame.getState();
    this.interactables.push({
      id: 'up',
      x: 160,
      y: FLOOR - 240,
      range: 130,
      hit: { x: 60, y: 300, w: 220, h: FLOOR - 300 },
      label: () => 'Climb back up to Long-Term Memory',
      interact: () => store().travel('memory', 'glide', 99999),
    });
    this.interactables.push({
      id: 'down',
      x: DOWN_X,
      y: FLOOR - 120,
      range: 140,
      hit: { x: DOWN_X - 130, y: FLOOR - 260, w: 260, h: 280 },
      label: () => (store().mind ? 'Take the dark stairs down into the Subconscious' : 'Peer down the dark stairwell'),
      interact: () => {
        if (!store().mind) return this.player.say('Stairs going down into the dark. Not yet. Riley isn’t ready to look down there.', 3.6);
        store().travel('subconscious', 'fade', 300);
      },
      abilities: { fear: () => this.player.say('Down? Into the DARK? Where she keeps the stuff she’s scared of? Sure. Cool.', 3.4) },
    });
    this.interactables.push({
      id: 'wisp',
      x: this.wispX,
      y: FLOOR - 220,
      range: 130,
      label: () => 'Talk to Wisp',
      interact: () => {
        const n = this.drifters.length;
        store().say([
          { speaker: 'wisp', text: 'Shh. Things are quiet here. I look after what nobody comes back for.' },
          { speaker: 'wisp', text: n ? `${n} memor${n === 1 ? 'y is' : 'ies are'} drifting today. You can carry them back up, or let them go.` : 'Nothing is drifting today. Everyone was remembered.' },
          { speaker: 'wisp', text: 'Letting go isn’t always sad. But some memories hold an island up. Those leave a gap.' },
          { speaker: store().active, text: store().active === 'disgust' ? 'Some of these definitely deserve to go.' : store().active === 'sadness' ? 'Can we stay a minute? It’s peaceful.' : 'Okay. Let’s be careful with them.' },
        ]);
      },
      abilities: { sadness: () => this.player.say('Wisp remembers every memory that ever came through here. All of them.', 4) },
    });
  }

  enter(spawn?: number) {
    this.actors[0].id = useGame.getState().active;
    this.layout();
    super.enter(spawn);
    this.game.audio.setAmbience(0.4);
    const st = useGame.getState();
    if (!st.flags.fadingVisited) {
      st.setFlag('fadingVisited');
      this.later(0.8, () => this.player.say('It’s so quiet. And so grey. These are memories nobody visited.', 3.6));
    }
  }

  exit() {
    super.exit();
    this.game.audio.setAmbience(1);
  }

  private layout() {
    const mind = useGame.getState().mind;
    const list = allEntries(mind).filter((e) => (mind ? mind.memories[e.id]?.status === 'forgotten' : e.start === 'forgotten'));
    const sig = list.map((e) => e.id).join('|');
    if (sig === this.sig) return;
    this.sig = sig;
    this.drifters = list.map((entry, i) => ({ entry, x: 520 + i * 330 + (i >= 2 ? 300 : 0), seed: i * 2.3 }));
    this.interactables = this.interactables.filter((i) => !this.dyn.includes(i));
    this.dyn = this.drifters.map((d) => this.drifterInteractable(d));
    this.interactables.push(...this.dyn);
  }

  private dy(d: Drifter) {
    return FLOOR - 170 + Math.sin(this.time * 0.8 + d.seed) * 30;
  }

  private drifterInteractable(d: Drifter): Interactable {
    const store = () => useGame.getState();
    return {
      id: `forgot-${d.entry.id}`,
      x: d.x,
      y: FLOOR - 230,
      range: 110,
      abilityRange: 200,
      hit: { x: d.x - 60, y: FLOOR - 260, w: 120, h: 180 },
      label: () => 'Look at a drifting memory',
      interact: () => store().setTheatre(d.entry.id),
      abilities: {
        joy: () => {
          if (!store().mind) return;
          store().recallMemory(d.entry.id);
          this.particles.emit({ x: d.x, y: this.dy(d), count: 60, color: [EMOTIONS[d.entry.emotion].color, '#ffffff'], shape: 'star', speed: [80, 300] });
          this.game.audio.chime(5);
          this.player.say(`Got it! “${d.entry.title}” is going back up.`, 3);
        },
        disgust: () => {
          if (!store().mind) return;
          if (d.entry.significance === 'important') {
            this.player.say('Hm. No. This one actually matters. I’m not flicking it.', 3.2);
            return;
          }
          store().releaseMemory(d.entry.id);
          this.particles.emit({ x: d.x, y: this.dy(d), count: 30, color: ['#cfc8dc', '#ffffff'], shape: 'dot', speed: [40, 160] });
          this.player.say(`“${d.entry.title}”? Nope. Bye. There’s more room now.`, 3);
        },
        sadness: () => this.player.say(d.entry.hidden, 4),
      },
    };
  }

  protected tick(dt: number) {
    this.layout();
    const st = useGame.getState();
    this.player.state.talking = !!st.dialogue && st.dialogue.lines[st.dialogue.index]?.speaker === this.player.id;
    this.wispX = 1300 + Math.sin(this.time * 0.3) * 80;
    const w = this.interactables.find((i) => i.id === 'wisp');
    if (w) w.x = this.wispX;
    // wind carries dust across the dunes
    if (Math.random() < dt * 14) this.particles.emit({ x: this.camera.x - STAGE_W * 0.6, y: 200 + Math.random() * 600, count: 1, color: ['#d6d0de', '#ffffff'], shape: 'dot', speed: [160, 260], angle: [-0.1, 0.1], drag: 0, life: [5, 7], size: [1, 2.5], additive: false });
  }

  render(ctx: Ctx) {
    const t = this.time;
    const cam = this.camera;
    const g = ctx.createLinearGradient(0, 0, 0, STAGE_H);
    g.addColorStop(0, '#b9b4c4');
    g.addColorStop(0.6, '#ddd8e0');
    g.addColorStop(1, '#efe9e2');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, STAGE_W, STAGE_H);
    ctx.save();
    cam.apply(ctx, 0.05);
    glow(ctx, 1100, 260, 300, '#ffffff', 0.7);
    circle(ctx, 1100, 260, 90, '#f6f2ea');
    ctx.restore();
    // dunes in layers, each paler with distance
    const layers = [
      [0.2, '#c9c3d2', 560],
      [0.45, '#b4adbf', 620],
      [0.75, '#9d96aa', 690],
    ] as const;
    for (const [p, c, base] of layers) {
      ctx.save();
      cam.apply(ctx, p);
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(-500, STAGE_H);
      for (let x = -500; x < this.worldW + 1200; x += 50) ctx.lineTo(x, base + Math.sin(x * 0.003 + p * 7) * 60 + Math.sin(x * 0.01) * 12);
      ctx.lineTo(this.worldW + 1200, STAGE_H);
      ctx.fill();
      // half-buried grey orbs in the dunes
      for (let i = 0; i < 18; i++) {
        const x = hash(i * 9 + p * 100) * (this.worldW + 1000) - 300;
        const y = base + Math.sin(x * 0.003 + p * 7) * 60 + 10;
        ellipse(ctx, x, y, 16 * p + 6, 10 * p + 4, rgba('#8d8a9e', 0.6));
      }
      ctx.restore();
    }
    // crumbling pillars
    ctx.save();
    cam.apply(ctx, 0.85);
    for (let i = 0; i < 6; i++) {
      const x = 300 + i * 560;
      const h = 220 + hash(i) * 200;
      ctx.fillStyle = '#a49db0';
      ctx.fillRect(x, FLOOR - h, 46, h);
      ctx.fillStyle = '#b8b1c3';
      ctx.beginPath();
      ctx.moveTo(x - 6, FLOOR - h);
      ctx.lineTo(x + 20, FLOOR - h - 30);
      ctx.lineTo(x + 52, FLOOR - h);
      ctx.fill();
    }
    ctx.restore();

    ctx.save();
    cam.apply(ctx, 1);
    // ground
    ctx.fillStyle = '#c8c1d0';
    ctx.fillRect(-200, FLOOR - 4, this.worldW + 400, STAGE_H);
    for (let x = 0; x < this.worldW; x += 70) ellipse(ctx, x, FLOOR + 30 + (x % 3) * 12, 50, 6, 'rgba(255,255,255,0.25)');
    // way back up
    ctx.fillStyle = '#b4adbf';
    ctx.beginPath();
    ctx.moveTo(0, FLOOR - 320);
    ctx.quadraticCurveTo(200, FLOOR - 150, 320, FLOOR);
    ctx.lineTo(0, FLOOR);
    ctx.fill();
    signText(ctx, 'Up to Long-Term Memory', 170, FLOOR - 360, 20, '#F3EEFF');
    // Wisp: a pale floating figure carrying a lantern
    this.drawWisp(ctx, this.wispX, FLOOR - 160 + Math.sin(t * 1.4) * 10, t);
    // the drifting memories
    for (const d of this.drifters) {
      const y = this.dy(d);
      const sink = (Math.sin(t * 0.4 + d.seed) + 1) * 0.5;
      ellipse(ctx, d.x, FLOOR + 4, 34, 6, 'rgba(90,84,102,0.25)');
      memoryOrb(ctx, d.x + Math.sin(t * 0.5 + d.seed) * 20, y + sink * 20, 28, EMOTIONS[d.entry.emotion].color, { faded: 0.85, glowAmt: 0.5 });
      if (d.entry.significance === 'important') {
        ctx.strokeStyle = rgba('#ffffff', 0.5 + 0.3 * Math.sin(t * 3));
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 5]);
        ctx.beginPath();
        ctx.arc(d.x + Math.sin(t * 0.5 + d.seed) * 20, y + sink * 20, 40, 0, TAU);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    if (!this.drifters.length) signText(ctx, 'Nothing drifting today', 1400, FLOOR - 320, 24, '#F3EEFF');
    // a stairwell spiralling down into the Subconscious
    ctx.fillStyle = '#2a2547';
    ctx.beginPath();
    ctx.ellipse(DOWN_X, FLOOR + 4, 130, 30, 0, 0, TAU);
    ctx.fill();
    for (let k = 0; k < 6; k++) {
      ctx.fillStyle = k % 2 ? '#8f88a0' : '#a59fb4';
      const a = t * 0.2 + k * 0.9;
      ctx.beginPath();
      ctx.ellipse(DOWN_X + Math.cos(a) * 70, FLOOR + 4 + Math.sin(a) * 12, 34 - k * 3, 8, 0, 0, TAU);
      ctx.fill();
    }
    ctx.strokeStyle = '#7d7690';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(DOWN_X - 140, FLOOR);
    ctx.lineTo(DOWN_X - 140, FLOOR - 150);
    ctx.moveTo(DOWN_X + 140, FLOOR);
    ctx.lineTo(DOWN_X + 140, FLOOR - 150);
    ctx.stroke();
    signText(ctx, 'Down to the Subconscious', DOWN_X, FLOOR - 190, 18, '#F3EEFF');
    this.drawActors(ctx);
    this.drawEffects(ctx);
    this.particles.render(ctx);
    ctx.restore();

    // memories lose their colour here
    ctx.save();
    ctx.globalCompositeOperation = 'saturation';
    ctx.fillStyle = 'rgba(128,128,128,0.55)';
    ctx.fillRect(0, 0, STAGE_W, STAGE_H);
    ctx.restore();
    this.drawMoodLight(ctx);
    ctx.save();
    cam.apply(ctx, 1);
    this.drawBarks(ctx);
    this.drawPrompt(ctx);
    ctx.restore();
  }

  private drawWisp(ctx: Ctx, x: number, y: number, t: number) {
    ctx.save();
    for (let i = 0; i < 7; i++) {
      const k = i / 7;
      circle(ctx, x + Math.sin(t * 2 + i) * 6 * k, y + i * 14, 34 - i * 4, `rgba(240,236,246,${0.85 - k * 0.6})`);
    }
    circle(ctx, x - 10, y - 6, 4, '#5a5466');
    circle(ctx, x + 10, y - 6, 4, '#5a5466');
    ctx.strokeStyle = '#5a5466';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y + 6, 6, 0.2, Math.PI - 0.2);
    ctx.stroke();
    // lantern on a long arm
    ctx.strokeStyle = 'rgba(240,236,246,0.9)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(x + 24, y + 10);
    ctx.quadraticCurveTo(x + 60, y + 10, x + 70, y + 40);
    ctx.stroke();
    glow(ctx, x + 70, y + 60, 90, '#FFF1B0', 0.8 + Math.sin(t * 3) * 0.1);
    ctx.fillStyle = '#6a6474';
    ctx.fillRect(x + 58, y + 40, 24, 6);
    ctx.fillStyle = '#FFF1B0';
    ctx.fillRect(x + 60, y + 46, 20, 26);
    ctx.restore();
  }
}
