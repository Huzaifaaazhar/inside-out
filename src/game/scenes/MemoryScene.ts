import { STAGE_H, STAGE_W } from '../../engine/camera';
import type { Ctx } from '../../engine/draw';
import { circle, ellipse, glow, memoryOrb, mixHex, rgba, roundRect, signText } from '../../engine/draw';
import { TAU, damp, hash } from '../../engine/math';
import { useGame } from '../../state/store';
import { drawMote } from '../art/characters';
import { cloudBank, drawMemoryRidges, drawSky } from '../art/mindscape';
import { EMOTIONS } from '../content/emotions';
import type { MemoryDef } from '../content/world';
import { LONG_TERM_MEMORIES } from '../content/world';
import type { Game } from '../Game';
import { Actor, WorldScene } from '../WorldScene';

const W = 3700;
const FLOOR = 780;
const COLORS = ['#FFCF33', '#3D7BFF', '#F0412D', '#A05CF0', '#52C46B'];

interface Shelved {
  mem: MemoryDef;
  x: number;
  y: number;
  pulse: number;
}

export class MemoryScene extends WorldScene {
  readonly id = 'memory' as const;
  worldW = W;
  floorY = FLOOR;
  private orbs: Shelved[];
  private mote = { x: 1750, dir: 1 as 1 | -1, sweeping: true, talkT: 0, dance: 0 };

  constructor(game: Game) {
    super(game);
    this.actors = [new Actor('joy', 260, FLOOR, 4)];
    this.orbs = LONG_TERM_MEMORIES.map((mem, i) => ({ mem, x: 560 + i * 200, y: i % 2 ? 470 : 600, pulse: 0 }));
    this.build();
  }

  enter(spawn?: number) {
    this.actors[0].id = useGame.getState().active;
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
            disgust: 'Smells like old library. Not the good kind.',
          }[st.active],
          3.4,
        ),
      );
    }
  }

  private isFaded(m: MemoryDef) {
    return !!m.faded && !useGame.getState().restored[m.id];
  }

  private build() {
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

    for (const o of this.orbs) {
      this.interactables.push({
        id: `mem-${o.mem.id}`,
        x: o.x,
        y: o.y - 40,
        range: 95,
        abilityRange: 140,
        hit: { x: o.x - 40, y: o.y - 40, w: 80, h: 80 },
        label: () => (this.isFaded(o.mem) ? 'Look at a faded memory' : `Look at “${o.mem.title}”`),
        interact: () => {
          o.pulse = 1;
          this.game.audio.chime(['joy', 'sadness', 'anger', 'fear', 'disgust'].indexOf(o.mem.emotion) * 2 - 4);
          if (this.isFaded(o.mem)) {
            store().setInspect({
              kicker: 'Faded memory',
              title: 'Too faded to make out',
              body: 'Grey and blurry. Mote will sweep it away soon unless someone brightens it.',
              color: '#8d8a9e',
              extra: 'Try Joy’s Bright Side (Q) right next to it.',
            });
            return;
          }
          const E = EMOTIONS[o.mem.emotion];
          store().setInspect({
            kicker: `A ${E.name.toLowerCase()} memory`,
            title: o.mem.title,
            body: o.mem.text,
            color: E.color,
            extra: store().active === 'sadness' ? `Underneath: ${o.mem.hidden}` : 'Sadness can hear what’s underneath (Q).',
          });
        },
        abilities: {
          joy: () => {
            if (!this.isFaded(o.mem)) {
              o.pulse = 1;
              return;
            }
            store().restore(o.mem.id);
            o.pulse = 1;
            this.game.audio.chime(7);
            this.particles.emit({ x: o.x, y: o.y, count: 50, color: [EMOTIONS[o.mem.emotion].color, '#ffffff', '#FFF1B0'], shape: 'star', speed: [60, 260] });
            this.player.say(`It’s back! “${o.mem.title}.”`, 3);
            store().showToast('Joy brought back a faded memory', EMOTIONS.joy.color);
          },
          sadness: () => {
            if (this.isFaded(o.mem)) {
              this.player.say('It’s okay that some things fade. But this one might still matter.', 3.6);
              return;
            }
            o.pulse = 1;
            this.player.say(o.mem.hidden, 4);
          },
          fear: () => {
            this.player.say(o.mem.emotion === 'fear' ? 'Don’t touch that one. It still scares me.' : 'Scanned it. No hazards in this memory. Suspicious.', 3);
          },
        },
      });
    }

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
        const fadedLeft = this.orbs.filter((o) => this.isFaded(o.mem)).length;
        s.say(
          [
            { speaker: 'mote', text: 'Oh! An emotion, all the way down here! I’m Mote. I keep the shelves tidy.' },
            { speaker: 'mote', text: 'When memories fade to grey, I sweep them off to make room. It’s nothing personal.' },
            fadedLeft > 0
              ? { speaker: 'mote', text: `There are ${fadedLeft} faded ones on this stretch. If someone cheerful brightened them, I’d leave them be.` }
              : { speaker: 'mote', text: 'You brightened every faded one on this stretch! Riley gets to keep them. That’s nice.' },
            { speaker: s.active, text: s.active === 'disgust' ? 'Does this broom ever get washed?' : s.active === 'fear' ? 'Is sweeping... dangerous?' : 'Thanks for looking after them, Mote.' },
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
        anger: () => {
          this.mote.dance = 0;
          this.player.say('Sorry, little guy. I wasn’t yelling at YOU.');
        },
      },
    });

    this.interactables.push({
      id: 'undercurrent',
      x: 3500,
      y: FLOOR - 220,
      range: 150,
      hit: { x: 3380, y: 300, w: 300, h: FLOOR - 300 },
      label: () => 'Peer into the fog',
      interact: () =>
        store().say([
          { speaker: store().active, text: 'The shelves just... stop. There’s fog, and something humming underneath.' },
          { speaker: 'console', text: 'The Undercurrent. The way down isn’t open yet.' },
        ]),
    });
  }

  protected tick(dt: number) {
    const st = useGame.getState();
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
  }

  render(ctx: Ctx) {
    const t = this.time;
    const cam = this.camera;
    const st = useGame.getState();

    // sky (fixed) and far spiral towers
    drawSky(ctx, 0, 0, STAGE_W, STAGE_H, t, '#A05CF0', 0.8);
    ctx.save();
    cam.apply(ctx, 0.15);
    for (let i = 0; i < 9; i++) this.spiral(ctx, 200 + i * 420, 680, 0.55 + hash(i) * 0.35, t, 0.75);
    ctx.restore();
    ctx.save();
    cam.apply(ctx, 0.35);
    drawMemoryRidges(ctx, -200, 520, W * 0.6 + 1600, 240, t, 0.55);
    ctx.restore();
    ctx.save();
    cam.apply(ctx, 0.6);
    for (let i = 0; i < 8; i++) this.spiral(ctx, 300 + i * 520, 820, 1.1 + hash(i * 3) * 0.3, t, 0.35);
    cloudBank(ctx, -400, 760, W + 800, '#5b4aa6', 0.6, 2);
    ctx.restore();

    ctx.save();
    cam.apply(ctx, 1);
    this.drawNearShelves(ctx, t, st.restored);
    this.drawTube(ctx, 200, t);
    this.drawFog(ctx, 3500, t);
    this.drawWalkway(ctx, t);
    drawMote(ctx, this.mote.x, FLOOR, t, this.mote.sweeping && !st.dialogue, this.mote.dir, !!st.dialogue && st.dialogue.lines[st.dialogue.index]?.speaker === 'mote');
    if (this.mote.dance > 0) this.particles.emit({ x: this.mote.x, y: FLOOR - 70, count: 1, color: ['#F7B8D8', '#FFCF33'], shape: 'star', speed: [40, 120], life: [0.4, 0.8] });
    if (this.mote.talkT > 0) glow(ctx, this.mote.x, FLOOR - 40, 140, '#3D7BFF', 0.4 * Math.min(1, this.mote.talkT));
    this.drawActors(ctx);
    this.drawEffects(ctx);
    this.particles.render(ctx);
    ctx.restore();

    ctx.save();
    cam.apply(ctx, 1.35);
    for (let i = 0; i < 10; i++) {
      const x = i * 560 + 100;
      ellipse(ctx, x, 940, 180, 70, 'rgba(10,5,32,0.85)');
      memoryOrb(ctx, x + 60, 880, 12, COLORS[i % 5], { glowAmt: 0.3 });
    }
    ctx.restore();

    this.drawMoodLight(ctx);
    ctx.save();
    cam.apply(ctx, 1);
    this.drawBarks(ctx);
    this.drawPrompt(ctx);
    ctx.restore();
  }

  /** A distant tower of shelves spiralling upward, dotted with memories. */
  private spiral(ctx: Ctx, x: number, base: number, s: number, t: number, depth: number) {
    const h = 520 * s;
    const col = mixHex('#4a3a8a', '#1a1040', depth);
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(x - 60 * s, base);
    ctx.lineTo(x - 30 * s, base - h);
    ctx.lineTo(x + 30 * s, base - h);
    ctx.lineTo(x + 60 * s, base);
    ctx.fill();
    // shelf rings wrapping the tower
    ctx.strokeStyle = mixHex(col, '#E7B76A', 0.35 * (1 - depth));
    ctx.lineWidth = 2.5 * s;
    for (let r = 1; r < 14; r++) {
      const yk = r / 14;
      const rx = (60 - 30 * yk) * s + 4;
      ctx.beginPath();
      ctx.ellipse(x, base - yk * h, rx, rx * 0.22, 0, 0, Math.PI);
      ctx.stroke();
    }
    for (let k = 0; k < 40; k++) {
      const yk = k / 40;
      const a = yk * TAU * 4 + t * 0.2;
      const rx = (60 - 30 * yk) * s;
      const px = x + Math.cos(a) * rx;
      const py = base - yk * h;
      if (Math.sin(a) < 0) continue;
      circle(ctx, px, py, 3.2 * s, rgba(COLORS[k % 5], (0.5 + 0.5 * Math.sin(t * 2 + k)) * (1 - depth * 0.5)));
    }
  }

  private drawNearShelves(ctx: Ctx, t: number, restored: Record<string, boolean>) {
    // tall curving shelf wall
    const x0 = 380;
    const x1 = 3300;
    for (const row of [420, 540, 660]) {
      ctx.fillStyle = '#4b3a8e';
      roundRect(ctx, x0, row + 26, x1 - x0, 16, 8);
      ctx.fill();
      ctx.fillStyle = 'rgba(231,183,106,0.6)';
      ctx.fillRect(x0, row + 26, x1 - x0, 3);
    }
    // uprights
    for (let x = x0; x <= x1; x += 300) {
      ctx.fillStyle = '#3a2b72';
      roundRect(ctx, x - 8, 360, 16, FLOOR - 360, 8);
      ctx.fill();
    }
    // background filler orbs on every row
    for (let row = 0; row < 3; row++) {
      const y = 420 + row * 120 + 4;
      for (let x = x0 + 30; x < x1; x += 44) {
        if (this.orbs.some((o) => Math.abs(o.x - x) < 34 && Math.abs(o.y - y) < 70)) continue;
        const h = hash(x * 0.1 + row * 31);
        if (h < 0.25) continue;
        memoryOrb(ctx, x, y, 14, COLORS[Math.floor(h * 97) % 5], { glowAmt: 0.25, faded: h > 0.9 ? 0.85 : 0 });
      }
    }
    // the interactive memories, larger and labelled by glow
    for (const o of this.orbs) {
      const faded = o.mem.faded && !restored[o.mem.id] ? 0.9 : 0;
      const near = Math.abs(this.player.x - o.x) < 95;
      const r = 22 + o.pulse * 6 + (near ? 2 : 0);
      memoryOrb(ctx, o.x, o.y + Math.sin(t * 2 + o.x) * 2, r, EMOTIONS[o.mem.emotion].color, { faded, glowAmt: 0.8 + o.pulse + (near ? 0.4 : 0), t });
      if (near) {
        ctx.strokeStyle = rgba('#F3EEFF', 0.6);
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 5]);
        ctx.beginPath();
        ctx.arc(o.x, o.y, r + 9, 0, TAU);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  private drawTube(ctx: Ctx, x: number, t: number) {
    glow(ctx, x, FLOOR - 200, 240, '#B9A7F5', 0.5);
    const g = ctx.createLinearGradient(x - 70, 0, x + 70, 0);
    g.addColorStop(0, 'rgba(185,167,245,0.4)');
    g.addColorStop(0.5, 'rgba(185,167,245,0.06)');
    g.addColorStop(1, 'rgba(185,167,245,0.35)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 70, -20, 140, FLOOR - 140);
    for (let i = 0; i < 4; i++) {
      const k = (t * 0.3 + i / 4) % 1;
      memoryOrb(ctx, x + Math.sin(k * 9 + i) * 16, -20 + k * (FLOOR - 150), 12, COLORS[i], { glowAmt: 0.5 });
    }
    ctx.fillStyle = '#251a55';
    roundRect(ctx, x - 100, FLOOR - 170, 200, 170, [90, 90, 0, 0]);
    ctx.fill();
    ctx.strokeStyle = '#E7B76A';
    ctx.lineWidth = 6;
    ctx.stroke();
    const dg = ctx.createRadialGradient(x, FLOOR - 80, 10, x, FLOOR - 80, 120);
    dg.addColorStop(0, 'rgba(255,240,180,0.85)');
    dg.addColorStop(1, 'rgba(255,207,51,0.15)');
    ctx.fillStyle = dg;
    roundRect(ctx, x - 82, FLOOR - 152, 164, 152, [80, 80, 0, 0]);
    ctx.fill();
    signText(ctx, 'To Headquarters', x, FLOOR - 200, 22, '#FFF1B0');
  }

  private drawFog(ctx: Ctx, x: number, t: number) {
    for (let i = 0; i < 6; i++) {
      const g = ctx.createRadialGradient(x + Math.sin(t * 0.3 + i) * 60, FLOOR - 200 - i * 60, 10, x, FLOOR - 200 - i * 60, 300);
      g.addColorStop(0, 'rgba(200,190,240,0.25)');
      g.addColorStop(1, 'rgba(200,190,240,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - 400, FLOOR - 600, 800, 600);
    }
    // a rope barrier and sign
    ctx.strokeStyle = '#E7B76A';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(x - 120, FLOOR - 70);
    ctx.quadraticCurveTo(x, FLOOR - 30, x + 120, FLOOR - 70);
    ctx.stroke();
    ctx.fillStyle = '#3a2b72';
    ctx.fillRect(x - 126, FLOOR - 90, 12, 90);
    ctx.fillRect(x + 114, FLOOR - 90, 12, 90);
    signText(ctx, 'The Undercurrent', x, FLOOR - 300, 26, '#DDC4FF');
    signText(ctx, 'not open yet', x, FLOOR - 266, 18, '#B9A7F5');
  }

  private drawWalkway(ctx: Ctx, t: number) {
    const g = ctx.createLinearGradient(0, FLOOR, 0, 900);
    g.addColorStop(0, '#6b58b4');
    g.addColorStop(0.1, '#3d2d78');
    g.addColorStop(1, '#170F3B');
    ctx.fillStyle = g;
    ctx.fillRect(0, FLOOR, W, 900 - FLOOR);
    for (let x = 0; x < W; x += 120) {
      const lit = 0.2 + 0.15 * Math.sin(t * 2 + x * 0.01);
      ctx.fillStyle = rgba('#B9A7F5', lit);
      roundRect(ctx, x + 10, FLOOR + 14, 100, 8, 4);
      ctx.fill();
    }
  }
}
