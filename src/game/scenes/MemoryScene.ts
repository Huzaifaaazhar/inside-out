import { STAGE_H, STAGE_W } from '../../engine/camera';
import type { Ctx } from '../../engine/draw';
import { circle, ellipse, glow, memoryOrb, mixHex, rgba, roundRect, signText } from '../../engine/draw';
import { TAU, damp, hash } from '../../engine/math';
import { useGame } from '../../state/store';
import { drawMote } from '../art/characters';
import { EMOTIONS } from '../content/emotions';
import type { MemoryEntry } from '../content/memories';
import { MEMORY_LIBRARY } from '../content/memories';
import type { Game } from '../Game';
import { allEntries } from '../systems/library';
import type { Interactable } from '../WorldScene';
import { Actor, WorldScene } from '../WorldScene';

const FLOOR = 780;
const COLORS = ['#FFCF33', '#3D7BFF', '#F0412D', '#A05CF0', '#52C46B'];
const START_X = 600;
const GAP = 190;

interface Shelved {
  entry: MemoryEntry;
  x: number;
  y: number;
  pulse: number;
}

/** What the scene needs to know about a memory, whether or not Part 2 has started. */
function memView(id: string, entry: MemoryEntry) {
  const st = useGame.getState();
  const m = st.mind?.memories[id];
  if (m) return { status: m.status, emotion: m.emotion, swirl: m.swirl };
  const status = entry.start === 'faded' && st.restored[id] ? 'long-term' : entry.start;
  return { status, emotion: entry.emotion, swirl: entry.swirl ?? [] };
}

/**
 * Long-Term Memory: a tidal archive. Sea-glass sky, copper shelves, bubbles of light rising.
 * Deliberately nothing like the plum-and-brass of Headquarters.
 */
export class MemoryScene extends WorldScene {
  readonly id = 'memory' as const;
  worldW = 3600;
  floorY = FLOOR;
  private orbs: Shelved[] = [];
  private sig = '';
  private mote = { x: 1750, dir: 1 as 1 | -1, sweeping: true, talkT: 0, dance: 0 };
  private memInteractables: Interactable[] = [];

  constructor(game: Game) {
    super(game);
    this.actors = [new Actor('joy', 260, FLOOR, 4)];
    this.roomLight = 0.12;
    this.buildStatic();
  }

  enter(spawn?: number) {
    this.actors[0].id = useGame.getState().active;
    this.layout();
    super.enter(spawn);
    const st = useGame.getState();
    if (!st.flags.memoryVisited) {
      st.setFlag('memoryVisited');
      this.later(0.8, () =>
        this.player.say(
          {
            joy: 'Long-Term Memory! Every single thing Riley remembers.',
            sadness: 'So many memories. Some of them are fading.',
            anger: 'Who organised this? There’s no labels!',
            fear: 'It goes on forever. FOREVER. Don’t get lost.',
            disgust: 'Smells like the seaside. Old seaside.',
          }[st.active],
          3.4,
        ),
      );
    }
  }

  /** Lay memories out on the shelves. Recent ones from scenarios sit nearest the tube. */
  private layout() {
    const st = useGame.getState();
    const all = st.mind ? allEntries(st.mind) : MEMORY_LIBRARY;
    const visible = all.filter((e) => {
      const v = memView(e.id, e);
      return v.status === 'long-term' || v.status === 'faded';
    });
    visible.sort((a, b) => (b.id.startsWith('sc-') ? 1 : 0) - (a.id.startsWith('sc-') ? 1 : 0));
    const sig = visible.map((e) => e.id + memView(e.id, e).status).join('|');
    if (sig === this.sig) return;
    this.sig = sig;
    const prev = new Map(this.orbs.map((o) => [o.entry.id, o.pulse]));
    this.orbs = visible.map((entry, i) => ({ entry, x: START_X + i * GAP, y: i % 2 ? 470 : 600, pulse: prev.get(entry.id) ?? 0 }));
    this.worldW = Math.max(2600, START_X + visible.length * GAP + 700);
    this.camera.setWorld(this.worldW, STAGE_H);
    this.interactables = this.interactables.filter((i) => !this.memInteractables.includes(i));
    this.memInteractables = this.orbs.map((o) => this.memoryInteractable(o));
    this.interactables.push(...this.memInteractables);
    const fading = this.interactables.find((i) => i.id === 'to-fading');
    if (fading) {
      fading.x = this.worldW - 260;
      fading.hit = { x: this.worldW - 400, y: 300, w: 300, h: FLOOR - 300 };
    }
  }

  private isFaded(o: Shelved) {
    return memView(o.entry.id, o.entry).status === 'faded';
  }

  private memoryInteractable(o: Shelved): Interactable {
    const store = () => useGame.getState();
    return {
      id: `mem-${o.entry.id}`,
      x: o.x,
      y: o.y - 40,
      range: 95,
      abilityRange: 140,
      hit: { x: o.x - 40, y: o.y - 40, w: 80, h: 80 },
      label: () => (this.isFaded(o) ? 'Replay a faded memory' : `Replay “${o.entry.title}”`),
      interact: () => {
        o.pulse = 1;
        this.game.audio.chime(['joy', 'sadness', 'anger', 'fear', 'disgust'].indexOf(memView(o.entry.id, o.entry).emotion) * 2 - 4);
        store().setTheatre(o.entry.id);
      },
      abilities: {
        joy: () => {
          o.pulse = 1;
          if (!this.isFaded(o)) return this.player.say('Already bright! Like me.', 2.4);
          if (store().mind) store().recallMemory(o.entry.id);
          else store().restore(o.entry.id);
          this.game.audio.chime(7);
          this.particles.emit({ x: o.x, y: o.y, count: 50, color: [EMOTIONS[o.entry.emotion].color, '#ffffff', '#FFF1B0'], shape: 'star', speed: [60, 260] });
          this.player.say(`It’s back! “${o.entry.title}.”`, 3);
          store().showToast('Joy brought back a faded memory', EMOTIONS.joy.color);
        },
        sadness: () => {
          o.pulse = 1;
          this.player.say(this.isFaded(o) ? 'It’s okay that some things fade. But this one might still matter.' : o.entry.hidden, 4);
        },
        fear: () => this.player.say(o.entry.emotion === 'fear' ? 'Don’t touch that one. It still scares me.' : 'Scanned it. No hazards in this memory. Suspicious.', 3),
      },
    };
  }

  private buildStatic() {
    const store = () => useGame.getState();
    this.interactables.push({
      id: 'tube',
      x: 200,
      y: FLOOR - 260,
      range: 130,
      hit: { x: 90, y: 100, w: 220, h: FLOOR - 100 },
      label: () => 'Ride the tube back to Headquarters',
      interact: () => store().travel('hq', 'tube', 400),
    });
    this.interactables.push({
      id: 'mote',
      x: this.mote.x,
      y: FLOOR - 110,
      range: 120,
      abilityRange: 260,
      hit: { x: this.mote.x - 60, y: FLOOR - 100, w: 120, h: 100 },
      label: () => 'Talk to Mote',
      interact: () => {
        const s = store();
        this.mote.sweeping = false;
        const fadedLeft = this.orbs.filter((o) => this.isFaded(o)).length;
        s.say(
          [
            { speaker: 'mote', text: 'Oh! An emotion, all the way down here! I’m Mote. I keep the shelves tidy.' },
            { speaker: 'mote', text: 'Memories nobody visits go grey. After a couple of nights, they roll down the slope into The Fading.' },
            fadedLeft > 0
              ? { speaker: 'mote', text: `There are ${fadedLeft} faded ones on these shelves. A replay or a bit of Joy keeps them here.` }
              : { speaker: 'mote', text: 'Nothing’s fading on this stretch right now. Lovely and bright.' },
            { speaker: 'mote', text: 'And if you look at a memory with a different emotion, sometimes it changes colour. Memories are funny like that.' },
          ],
          () => {
            this.mote.sweeping = true;
          },
        );
      },
      abilities: {
        sadness: () => {
          this.mote.talkT = 4;
          this.player.say('Mote sweeps alone all day. He thinks nobody remembers the people who tidy up.', 4.2);
        },
        joy: () => {
          this.mote.dance = 2;
          this.player.say('Mote! Dance break!');
        },
        anger: () => this.player.say('Sorry, little guy. I wasn’t yelling at YOU.'),
      },
    });
    this.interactables.push({
      id: 'to-fading',
      x: this.worldW - 260,
      y: FLOOR - 220,
      range: 150,
      hit: { x: this.worldW - 400, y: 300, w: 300, h: FLOOR - 300 },
      label: () => 'Walk down the slope into The Fading',
      interact: () => store().travel('fading', 'glide', 200),
    });
  }

  protected tick(dt: number) {
    const st = useGame.getState();
    this.layout();
    const m = this.mote;
    m.dance = Math.max(0, m.dance - dt);
    m.talkT = Math.max(0, m.talkT - dt);
    if (m.sweeping && !st.dialogue) {
      m.x += m.dir * 40 * dt;
      if (m.x > 1950) m.dir = -1;
      if (m.x < 1500) m.dir = 1;
    }
    const it = this.interactables.find((i) => i.id === 'mote');
    if (it) {
      it.x = m.x;
      it.hit = { x: m.x - 60, y: FLOOR - 100, w: 120, h: 100 };
    }
    for (const o of this.orbs) o.pulse = damp(o.pulse, 0, 2, dt);
    this.player.state.talking = !!st.dialogue && st.dialogue.lines[st.dialogue.index]?.speaker === this.player.id;
    if (Math.random() < dt * 6) this.particles.emit({ x: this.camera.x + (Math.random() - 0.5) * STAGE_W, y: FLOOR + 40, count: 1, color: ['#9FE8E0', '#ffffff'], shape: 'bubble', speed: [30, 60], angle: [-Math.PI * 0.55, -Math.PI * 0.45], drag: 0.2, life: [3, 5], size: [3, 7] });
  }

  render(ctx: Ctx) {
    const t = this.time;
    const cam = this.camera;
    const st = useGame.getState();

    // sea-glass dusk
    const g = ctx.createLinearGradient(0, 0, 0, STAGE_H);
    g.addColorStop(0, '#0b2e36');
    g.addColorStop(0.5, '#1f6f7a');
    g.addColorStop(0.85, '#f2b880');
    g.addColorStop(1, '#f7e6c4');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, STAGE_W, STAGE_H);
    // light rays from above, like sun through water
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++) {
      const x = ((i * 330 - cam.x * 0.05) % (STAGE_W + 300)) - 150 + Math.sin(t * 0.3 + i) * 30;
      const rg = ctx.createLinearGradient(x, 0, x + 120, STAGE_H);
      rg.addColorStop(0, 'rgba(159,232,224,0.14)');
      rg.addColorStop(1, 'rgba(159,232,224,0)');
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 70, 0);
      ctx.lineTo(x + 260, STAGE_H);
      ctx.lineTo(x + 120, STAGE_H);
      ctx.fill();
    }
    ctx.restore();

    // far: rolling dunes of shelves, like waves of memory
    ctx.save();
    cam.apply(ctx, 0.2);
    for (let row = 0; row < 3; row++) {
      ctx.fillStyle = mixHex('#14525c', '#0b2e36', row * 0.3);
      ctx.beginPath();
      ctx.moveTo(-400, STAGE_H);
      for (let x = -400; x < this.worldW + 1200; x += 60) ctx.lineTo(x, 470 + row * 60 + Math.sin(x * 0.004 + row * 2 + t * 0.15) * 40);
      ctx.lineTo(this.worldW + 1200, STAGE_H);
      ctx.fill();
      for (let x = -400; x < this.worldW + 1200; x += 26) {
        if (hash(x + row * 99) < 0.5) continue;
        const yy = 480 + row * 60 + Math.sin(x * 0.004 + row * 2 + t * 0.15) * 40;
        circle(ctx, x, yy, 2.5, rgba(COLORS[Math.floor(hash(x * 1.3 + row) * 5)], 0.5 + 0.4 * Math.sin(t * 2 + x)));
      }
    }
    ctx.restore();

    // mid: copper-ringed shelf towers
    ctx.save();
    cam.apply(ctx, 0.55);
    for (let i = 0; i < 9; i++) this.tower(ctx, 260 + i * 520, 860, 0.9 + hash(i * 3) * 0.35, t);
    ctx.restore();

    ctx.save();
    cam.apply(ctx, 1);
    this.drawNearShelves(ctx, t);
    this.drawTube(ctx, 200, t);
    this.drawSlope(ctx, this.worldW - 260, t);
    this.drawWalkway(ctx, t);
    drawMote(ctx, this.mote.x, FLOOR, t, this.mote.sweeping && !st.dialogue, this.mote.dir, !!st.dialogue && st.dialogue.lines[st.dialogue.index]?.speaker === 'mote');
    if (this.mote.dance > 0) this.particles.emit({ x: this.mote.x, y: FLOOR - 70, count: 1, color: ['#F7B8D8', '#FFCF33'], shape: 'star', speed: [40, 120], life: [0.4, 0.8] });
    if (this.mote.talkT > 0) glow(ctx, this.mote.x, FLOOR - 40, 140, '#3D7BFF', 0.4 * Math.min(1, this.mote.talkT));
    this.drawActors(ctx);
    this.drawEffects(ctx);
    this.particles.render(ctx);
    ctx.restore();

    // near: seaweed-like silhouettes
    ctx.save();
    cam.apply(ctx, 1.35);
    for (let i = 0; i < 12; i++) {
      const x = i * 480 + 100;
      ctx.strokeStyle = 'rgba(8,36,40,0.85)';
      ctx.lineWidth = 18;
      ctx.lineCap = 'round';
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.moveTo(x + k * 26, 1000);
        ctx.quadraticCurveTo(x + k * 26 + Math.sin(t + i + k) * 30, 900, x + k * 20 + Math.sin(t * 1.2 + k) * 20, 800 + k * 30);
        ctx.stroke();
      }
    }
    ctx.restore();

    this.drawMoodLight(ctx);
    ctx.save();
    cam.apply(ctx, 1);
    this.drawBarks(ctx);
    this.drawPrompt(ctx);
    ctx.restore();
  }

  private tower(ctx: Ctx, x: number, base: number, s: number, t: number) {
    const h = 560 * s;
    ctx.fillStyle = '#0f3f48';
    ctx.beginPath();
    ctx.moveTo(x - 70 * s, base);
    ctx.lineTo(x - 40 * s, base - h);
    ctx.lineTo(x + 40 * s, base - h);
    ctx.lineTo(x + 70 * s, base);
    ctx.fill();
    ctx.strokeStyle = 'rgba(184,115,51,0.7)';
    ctx.lineWidth = 3 * s;
    for (let r = 1; r < 12; r++) {
      const yk = r / 12;
      const rx = (70 - 30 * yk) * s + 4;
      ctx.beginPath();
      ctx.ellipse(x, base - yk * h, rx, rx * 0.22, 0, 0, Math.PI);
      ctx.stroke();
    }
    for (let k = 0; k < 30; k++) {
      const yk = k / 30;
      const a = yk * TAU * 3 + t * 0.2;
      if (Math.sin(a) < 0) continue;
      circle(ctx, x + Math.cos(a) * (70 - 30 * yk) * s, base - yk * h, 3.4 * s, rgba(COLORS[k % 5], 0.5 + 0.5 * Math.sin(t * 2 + k)));
    }
  }

  private drawNearShelves(ctx: Ctx, t: number) {
    const x0 = 420;
    const x1 = this.worldW - 520;
    // sea-glass back panel and copper shelves
    ctx.fillStyle = 'rgba(31,111,122,0.35)';
    roundRect(ctx, x0 - 20, 360, x1 - x0 + 40, FLOOR - 360, 30);
    ctx.fill();
    for (const row of [420, 540, 660]) {
      ctx.fillStyle = '#8a4f22';
      roundRect(ctx, x0, row + 26, x1 - x0, 16, 8);
      ctx.fill();
      ctx.fillStyle = '#d9925a';
      ctx.fillRect(x0, row + 26, x1 - x0, 3);
    }
    for (let x = x0; x <= x1; x += 300) {
      ctx.fillStyle = '#6b3d1a';
      roundRect(ctx, x - 8, 360, 16, FLOOR - 360, 8);
      ctx.fill();
    }
    // background filler memories
    for (let row = 0; row < 3; row++) {
      const y = 420 + row * 120 + 4;
      for (let x = x0 + 30; x < x1; x += 44) {
        if (this.orbs.some((o) => Math.abs(o.x - x) < 34 && Math.abs(o.y - y) < 70)) continue;
        const h = hash(x * 0.1 + row * 31);
        if (h < 0.3) continue;
        memoryOrb(ctx, x, y, 13, COLORS[Math.floor(h * 97) % 5], { glowAmt: 0.2, faded: h > 0.9 ? 0.85 : 0 });
      }
    }
    // Riley's real memories
    for (const o of this.orbs) {
      const v = memView(o.entry.id, o.entry);
      const faded = v.status === 'faded' ? 0.9 : 0;
      const near = Math.abs(this.player.x - o.x) < 95;
      const r = 24 + o.pulse * 6 + (near ? 3 : 0);
      if (o.entry.id.startsWith('sc-')) {
        ctx.fillStyle = 'rgba(255,241,176,0.25)';
        roundRect(ctx, o.x - 40, o.y - 44, 80, 88, 20);
        ctx.fill();
      }
      memoryOrb(ctx, o.x, o.y + Math.sin(t * 2 + o.x) * 2, r, EMOTIONS[v.emotion].color, {
        faded,
        glowAmt: 0.8 + o.pulse + (near ? 0.4 : 0),
        t,
        swirl: v.swirl.length ? v.swirl.map((e) => EMOTIONS[e].color) : undefined,
      });
      if (near) {
        ctx.strokeStyle = rgba('#F3EEFF', 0.7);
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 5]);
        ctx.beginPath();
        ctx.arc(o.x, o.y, r + 9, 0, TAU);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    if (this.orbs.some((o) => o.entry.id.startsWith('sc-'))) signText(ctx, 'Recent days', START_X + 40, 330, 20, '#FFF1B0');
  }

  private drawTube(ctx: Ctx, x: number, t: number) {
    glow(ctx, x, FLOOR - 200, 240, '#9FE8E0', 0.5);
    const g = ctx.createLinearGradient(x - 70, 0, x + 70, 0);
    g.addColorStop(0, 'rgba(159,232,224,0.4)');
    g.addColorStop(0.5, 'rgba(159,232,224,0.06)');
    g.addColorStop(1, 'rgba(159,232,224,0.35)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 70, -20, 140, FLOOR - 140);
    for (let i = 0; i < 4; i++) {
      const k = (t * 0.3 + i / 4) % 1;
      memoryOrb(ctx, x + Math.sin(k * 9 + i) * 16, -20 + k * (FLOOR - 150), 12, COLORS[i], { glowAmt: 0.5 });
    }
    ctx.fillStyle = '#6b3d1a';
    roundRect(ctx, x - 100, FLOOR - 170, 200, 170, [90, 90, 0, 0]);
    ctx.fill();
    ctx.strokeStyle = '#d9925a';
    ctx.lineWidth = 6;
    ctx.stroke();
    const dg = ctx.createRadialGradient(x, FLOOR - 80, 10, x, FLOOR - 80, 120);
    dg.addColorStop(0, 'rgba(255,240,200,0.9)');
    dg.addColorStop(1, 'rgba(159,232,224,0.2)');
    ctx.fillStyle = dg;
    roundRect(ctx, x - 82, FLOOR - 152, 164, 152, [80, 80, 0, 0]);
    ctx.fill();
    signText(ctx, 'To Headquarters', x, FLOOR - 200, 22, '#FFF1B0');
  }

  /** The slope at the far end, down to The Fading. */
  private drawSlope(ctx: Ctx, x: number, t: number) {
    for (let i = 0; i < 6; i++) {
      const gr = ctx.createRadialGradient(x + Math.sin(t * 0.3 + i) * 60, FLOOR - 200 - i * 60, 10, x, FLOOR - 200 - i * 60, 300);
      gr.addColorStop(0, 'rgba(210,205,220,0.25)');
      gr.addColorStop(1, 'rgba(210,205,220,0)');
      ctx.fillStyle = gr;
      ctx.fillRect(x - 400, FLOOR - 600, 800, 600);
    }
    ctx.fillStyle = '#a8a2b4';
    ctx.beginPath();
    ctx.moveTo(x - 160, FLOOR);
    ctx.quadraticCurveTo(x + 40, FLOOR - 10, x + 300, FLOOR + 120);
    ctx.lineTo(x - 160, FLOOR + 120);
    ctx.fill();
    for (let i = 0; i < 5; i++) {
      const k = (t * 0.1 + i / 5) % 1;
      memoryOrb(ctx, x - 100 + k * 340, FLOOR - 8 + k * 110, 9, '#8d8a9e', { faded: 0.9, glowAmt: 0.2 });
    }
    signText(ctx, 'The Fading', x, FLOOR - 300, 26, '#E6E1EC');
    signText(ctx, 'forgotten memories roll down here', x, FLOOR - 266, 16, '#cfc8dc');
  }

  private drawWalkway(ctx: Ctx, t: number) {
    const g = ctx.createLinearGradient(0, FLOOR, 0, 900);
    g.addColorStop(0, '#e9c79a');
    g.addColorStop(0.15, '#c99b6d');
    g.addColorStop(1, '#5a3a24');
    ctx.fillStyle = g;
    ctx.fillRect(0, FLOOR, this.worldW, 900 - FLOOR);
    // caustic ripples of light on the sand
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let x = 0; x < this.worldW; x += 90) {
      const a = 0.08 + 0.06 * Math.sin(t * 1.5 + x * 0.05);
      ellipse(ctx, x + Math.sin(t + x) * 10, FLOOR + 30 + (x % 3) * 10, 40, 6, `rgba(255,250,220,${a})`);
    }
    ctx.restore();
  }
}
