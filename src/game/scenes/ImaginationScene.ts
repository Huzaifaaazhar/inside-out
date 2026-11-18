import { STAGE_H, STAGE_W } from '../../engine/camera';
import type { Ctx } from '../../engine/draw';
import { FONT_DISPLAY, circle, ellipse, glow, memoryOrb, mixHex, rgba, roundRect, signText } from '../../engine/draw';
import { TAU, clamp, hash } from '../../engine/math';
import { useGame } from '../../state/store';
import { ActivityScene } from '../ActivityScene';
import type { Activity } from '../activities';
import { BridgeBuilder } from '../activities3';
import { EMOTIONS } from '../content/emotions';
import type { Game } from '../Game';
import { Actor } from '../WorldScene';

const FLOOR = 760;
const W = 4300;
const INK = '#2b1846';
const GAP_X = 2360;
const GAP_W = 300;

type Whim = 'daydream' | 'upside' | 'giant';
const WHIM_NAME: Record<Whim, string> = { daydream: 'Daydream', upside: 'Upside-down', giant: 'Everything giant' };

/**
 * Imagination Land: thick outlines, flat candy colours, a sky that keeps changing its mind.
 * Its own rule: the land rearranges itself, and the Kaleidoscope Tower lets you choose how.
 */
export class ImaginationScene extends ActivityScene {
  readonly id = 'imagination' as const;
  worldW = W;
  floorY = FLOOR;
  private whim: Whim = 'daydream';
  private whimT = 0;
  private whimFlash = 0;
  private nextWhim = 45;
  private bloom = 0;
  private puffOut = 0;
  private crust = 1;
  private steps = 0;
  private statue = 1;
  private doodles: { x: number; y: number; vx: number; seed: number }[] = [];
  private followers = false;
  private climb: { t: number } | null = null;

  constructor(game: Game) {
    super(game);
    this.actors = [new Actor('joy', 260, FLOOR, 13)];
    this.roomLight = 0.08;
    for (let i = 0; i < 4; i++) this.doodles.push({ x: 1600 + i * 30, y: FLOOR - 10, vx: 0, seed: i * 1.9 });
    this.build();
  }

  private flag(k: string) {
    return !!useGame.getState().flags[k];
  }

  private findSpark(id: string, insight: string, line: string) {
    const st = useGame.getState();
    if (st.discover(id)) st.gain(EMOTIONS[insight.split('-')[1] as keyof typeof EMOTIONS]?.id ?? st.active, 5);
    st.findInsight(insight);
    this.game.audio.coreMemory();
    this.player.say(line, 3.6);
  }

  private build() {
    const store = () => useGame.getState();
    const say = (t: string, d = 3.4) => this.player.say(t, d);
    this.interactables.push({
      id: 'gate',
      x: 160,
      y: FLOOR - 320,
      range: 130,
      hit: { x: 60, y: FLOOR - 320, w: 200, h: 320 },
      label: () => 'Ride the ribbon back to the cliffs',
      interact: () => store().travel('islands', 'glide', 3420),
    });
    this.interactables.push({
      id: 'wobble',
      x: 560,
      y: FLOOR - 220,
      range: 130,
      label: () => 'Talk to Wobble',
      interact: () => {
        const s = store();
        s.say([
          { speaker: 'console', text: 'Wobble, a jelly cube with a pencil behind one ear, jiggles hello.' },
          { speaker: 'console', text: '“Welcome to Imagination Land! Everything Riley ever made up lives here, and it keeps making itself up.”' },
          { speaker: 'console', text: '“The Kaleidoscope Tower lets you change how the land thinks. And sometimes it changes on its own. Hold on to your hat.”' },
          { speaker: 'console', text: s.flags.imagBridge ? '“You built a bridge out of pure imagination! Dream Productions is just past it.”' : '“The Gap of Nothing is up ahead. You’ll have to imagine your way across.”' },
          { speaker: 'console', text: '“Oh, and things here hide from the wrong kind of looking. Try every emotion’s ability.”' },
          { speaker: s.active, text: s.active === 'disgust' ? 'You have a pencil. In your jelly.' : s.active === 'fear' ? 'Is the land going to change while I’m standing on it?' : 'This place is amazing.' },
        ]);
      },
    });
    // hidden: the grey meadow (Joy)
    this.interactables.push({
      id: 'meadow',
      x: 950,
      y: FLOOR - 140,
      range: 160,
      label: () => (this.flag('imagMeadow') ? 'Smell the flowers' : 'Look at the grey meadow'),
      interact: () => say(this.flag('imagMeadow') ? 'They smell like birthday cake and wet crayons.' : 'Every flower is grey and drooping. Like someone forgot to imagine the colour in.'),
      abilities: {
        joy: () => {
          if (this.flag('imagMeadow')) return say('Still blooming. They like me.');
          store().setFlag('imagMeadow');
          this.particles.emit({ x: 950, y: FLOOR - 60, count: 80, color: ['#FFE45E', '#FF7FB0', '#7AE7C7', '#ffffff'], shape: 'star', spread: 160, speed: [60, 260] });
          this.findSpark('spark-meadow', 'imag-joy', 'Colour everywhere! Joy can make things grow back.');
        },
      },
    });
    this.interactables.push({
      id: 'tower',
      x: 1320,
      y: FLOOR - 480,
      range: 150,
      hit: { x: 1220, y: FLOOR - 520, w: 200, h: 520 },
      label: () => `Turn the Kaleidoscope Tower (now: ${WHIM_NAME[this.whim]})`,
      interact: () => this.setWhim(this.whim === 'daydream' ? 'upside' : this.whim === 'upside' ? 'giant' : 'daydream', true),
      abilities: { fear: () => say('The tower controls REALITY. Just a heads up.') },
    });
    this.interactables.push({
      id: 'doodles',
      x: 1680,
      y: FLOOR - 80,
      range: 140,
      label: () => (this.followers ? 'Tell the doodlebugs to wait here' : 'Say hello to the doodlebugs'),
      interact: () => {
        this.followers = !this.followers;
        this.game.audio.blip(1.6);
        say(this.followers ? 'The doodlebugs scribble after you, giggling.' : 'The doodlebugs sit down in a wobbly line.', 2.8);
      },
      abilities: { joy: () => say('Doodlebug dance party!'), disgust: () => say('Those are just scribbles with legs. Adorable scribbles.') },
    });
    // hidden: Puff, a shy rain-cloud (Sadness)
    this.interactables.push({
      id: 'puff',
      x: 2030,
      y: FLOOR - 200,
      range: 150,
      label: () => (this.flag('imagPuff') ? 'Talk to Puff' : 'Look behind the giant teacup'),
      interact: () => {
        if (this.flag('imagPuff'))
          store().say([
            { speaker: 'console', text: 'Puff drizzles happily. “Riley made me up on a rainy day when she was five. Then she got busy.”' },
            { speaker: 'console', text: '“It’s okay. I like being remembered a little bit.”' },
          ]);
        else say(store().active === 'sadness' ? 'Someone’s hiding. Let me try listening (Q).' : 'Something ducked behind the teacup. It looked shy.', 3);
      },
      abilities: {
        sadness: () => {
          if (this.flag('imagPuff')) return say('Puff is doing much better now.');
          store().setFlag('imagPuff');
          this.puffOut = 0.01;
          this.findSpark('spark-puff', 'imag-sadness', 'A little rain-cloud called Puff. They just needed someone to slow down.');
        },
        joy: () => say(this.flag('imagPuff') ? 'Hi Puff!' : 'It hid even more when I sparkled at it. Hmm.'),
      },
    });
    this.interactables.push({
      id: 'gap',
      x: GAP_X - 70,
      y: FLOOR - 260,
      range: 140,
      label: () => (this.flag('imagBridge') ? 'Admire the imagined bridge' : 'Imagine a bridge across the Gap of Nothing'),
      interact: () => {
        if (this.flag('imagBridge')) return say('It’s held together by imagination and three spoons.');
        this.hostActivity('imagination-bridge', new BridgeBuilder(this.game.audio, this.particles), { x: GAP_X - 430 + GAP_W / 2, y: 140, w: 860, h: 520 });
      },
    });
    // hidden: candy crust (Anger)
    this.interactables.push({
      id: 'crust',
      x: 2820,
      y: FLOOR - 230,
      range: 140,
      label: () => (this.flag('imagCave') ? 'Peek into the candy cave' : 'Knock on the candy crust'),
      interact: () => {
        this.game.audio.thud();
        say(this.flag('imagCave') ? 'It’s full of glowing gumdrops.' : 'Rock-hard candy. Something glows behind it. It needs a real push.', 3);
      },
      abilities: {
        anger: () => {
          if (this.flag('imagCave')) return;
          store().setFlag('imagCave');
          this.camera.shake(18);
          this.particles.emit({ x: 2820, y: FLOOR - 160, count: 70, color: ['#FF7FB0', '#FFE45E', '#ffffff'], shape: 'ember', speed: [200, 520], gravity: 700 });
          this.findSpark('spark-cave', 'imag-anger', 'CRUNCH. Some things only change when you push.');
        },
      },
    });
    // hidden: the invisible steps (Fear)
    this.interactables.push({
      id: 'steps',
      x: 3180,
      y: FLOOR - 160,
      range: 150,
      label: () => (this.flag('imagSteps') ? (this.flag('imagLedge') ? 'Look up at the ledge' : 'Climb the hidden steps') : 'Look at the empty air'),
      interact: () => {
        if (!this.flag('imagSteps')) return say('There’s a sparkle high up on that ledge, but no way up. Unless...', 3);
        if (this.flag('imagLedge')) return say('Great view from up there.');
        this.climb = { t: 0 };
        this.locked = true;
      },
      abilities: {
        fear: () => {
          if (this.flag('imagSteps')) return say('Steps: still there. Still invisible-ish. Still terrifying.');
          store().setFlag('imagSteps');
          this.game.audio.success();
          say('Scanning... there ARE steps! Invisible ones! Careful. Very careful.', 3);
        },
      },
    });
    // hidden: the too-perfect statue (Disgust)
    this.interactables.push({
      id: 'statue',
      x: 3560,
      y: FLOOR - 300,
      range: 150,
      label: () => (this.flag('imagStatue') ? 'Look at the real drawing' : 'Look at the shiny statue'),
      interact: () => say(this.flag('imagStatue') ? 'A messy crayon Riley with paint on her hoodie. Much better.' : '“Perfect Riley”: always smiling, never sad, holding a trophy. It doesn’t look like her at all.', 3.6),
      abilities: {
        disgust: () => {
          if (this.flag('imagStatue')) return;
          store().setFlag('imagStatue');
          this.particles.emit({ x: 3560, y: FLOOR - 220, count: 60, color: ['#d8d0e8', '#ffffff', '#52C46B'], shape: 'dot', speed: [100, 360], gravity: 500 });
          this.findSpark('spark-statue', 'imag-disgust', 'Nope. That’s not her. The real Riley is messier, and better.');
        },
        joy: () => say(this.flag('imagStatue') ? 'I love the real one.' : 'It’s so... shiny. Is that what I think she should be? Yikes.'),
      },
    });
    this.interactables.push({
      id: 'whale',
      x: 3860,
      y: FLOOR - 420,
      range: 180,
      label: () => 'Wave at Nimbus the cloud-whale',
      interact: () => {
        this.game.audio.tone({ freq: 160, to: 90, type: 'sine', dur: 1.4, vol: 0.12, vibrato: 6 });
        say('Nimbus sings a long, low cloud-song. It sounds like a hug.', 3.2);
      },
    });
    this.interactables.push({
      id: 'studio',
      x: 4150,
      y: FLOOR - 300,
      range: 140,
      hit: { x: 4060, y: FLOOR - 340, w: 200, h: 340 },
      label: () => 'Walk onto the Dream Productions lot',
      interact: () => store().travel('dreams', 'iris', 220),
    });
  }

  protected onActivityDone(a: Activity, _id: string, completed: boolean) {
    if (!completed) return;
    const st = useGame.getState();
    if (a.score >= 0.6) {
      st.setFlag('imagBridge');
      st.discover('imag-bridge');
      this.game.audio.coreMemory();
      this.particles.emit({ x: GAP_X + GAP_W / 2, y: FLOOR - 40, count: 90, color: ['#7AE7C7', '#FFE45E', '#FF7FB0'], shape: 'star', speed: [80, 360] });
      st.showToast('A bridge of pure imagination. The way to Dream Productions is open.', '#7AE7C7');
    } else st.showToast('The fog swallowed too much of it. Try imagining again.', '#cfc8dc');
  }

  private setWhim(w: Whim, byHand: boolean) {
    this.whim = w;
    this.whimT = 0;
    this.whimFlash = 1;
    this.nextWhim = 40 + Math.random() * 20;
    this.game.audio.whoosh(w !== 'daydream');
    this.game.audio.chime(w === 'upside' ? 6 : w === 'giant' ? -5 : 2);
    this.camera.shake(6);
    const st = useGame.getState();
    st.discover(`whim-${w}`);
    if (!byHand) st.showToast(`Imagination Land rearranged itself: ${WHIM_NAME[w]}!`, '#FF7FB0');
    else this.player.say({ daydream: 'Back to normal. Imagination-normal.', upside: 'The sky is DOWN there now!', giant: 'Why is that flower the size of a house?!' }[w], 2.8);
  }

  enter(spawn?: number) {
    this.actors[0].id = useGame.getState().active;
    super.enter(spawn ?? 300);
    const st = useGame.getState();
    if (!st.flags.imagVisited) {
      st.setFlag('imagVisited');
      this.later(0.9, () => this.player.say('Imagination Land! Nothing here sits still. Not even the sky.', 3.6));
    }
  }

  protected tick(dt: number) {
    const st = useGame.getState();
    this.player.state.talking = !!st.dialogue && st.dialogue.lines[st.dialogue.index]?.speaker === this.player.id;
    this.whimT += dt;
    this.whimFlash = Math.max(0, this.whimFlash - dt * 1.4);
    if (!this.activity && !st.dialogue) {
      this.nextWhim -= dt;
      if (this.nextWhim <= 0) this.setWhim((['daydream', 'upside', 'giant'] as Whim[]).filter((w) => w !== this.whim)[Math.floor(Math.random() * 2)], false);
    }
    this.bloom += ((this.flag('imagMeadow') ? 1 : 0) - this.bloom) * Math.min(1, dt * 2);
    if (this.puffOut > 0) this.puffOut = Math.min(1, this.puffOut + dt);
    else if (this.flag('imagPuff')) this.puffOut = 1;
    this.crust += ((this.flag('imagCave') ? 0 : 1) - this.crust) * Math.min(1, dt * 3);
    this.steps += ((this.flag('imagSteps') ? 1 : 0) - this.steps) * Math.min(1, dt * 2);
    this.statue += ((this.flag('imagStatue') ? 0 : 1) - this.statue) * Math.min(1, dt * 2);
    // the gap stops you until the bridge is imagined
    const p = this.player;
    if (!this.flag('imagBridge') && p.x > GAP_X - 20) {
      p.x = GAP_X - 20;
      p.targetX = null;
      if (!this.activity && Math.random() < dt * 0.6) p.say('Nothing but fog. I need a bridge.', 2);
    }
    // climbing the invisible steps
    if (this.climb) {
      this.climb.t += dt;
      const k = clamp(this.climb.t / 2, 0, 1);
      p.y = FLOOR - Math.sin(k * Math.PI) * 280;
      if (this.climb.t > 1 && !this.flag('imagLedge')) {
        st.setFlag('imagLedge');
        this.findSpark('spark-ledge', 'imag-fear', 'Made it! Being careful is how we got up here.');
      }
      if (this.climb.t > 2) {
        p.y = FLOOR;
        this.climb = null;
        this.locked = false;
      }
    }
    // doodlebugs follow or mill about
    this.doodles.forEach((d, i) => {
      const target = this.followers ? p.x - p.state.facing * (60 + i * 34) : 1640 + i * 34 + Math.sin(this.time + i) * 20;
      d.vx += (target - d.x) * dt * 4;
      d.vx *= Math.exp(-dt * 4);
      d.x += d.vx * dt;
      d.y = FLOOR - 8 - Math.abs(Math.sin(this.time * 8 + d.seed)) * 10;
    });
    this.tickActivity(dt);
  }

  // ───────────────────────────── drawing ─────────────────────────────

  private skyColors(): [string, string, string] {
    const h = (this.time * 0.03) % 1;
    const palettes: [string, string, string][] = [
      ['#b9a7f5', '#ffc7e6', '#fff1b0'],
      ['#9ee6d6', '#c9b6ef', '#ffd6a5'],
      ['#ffb3c7', '#ffe3a3', '#b9f0e0'],
    ];
    const i = Math.floor(h * 3);
    const f = h * 3 - i;
    const a = palettes[i];
    const b = palettes[(i + 1) % 3];
    return [mixHex(a[0], b[0], f), mixHex(a[1], b[1], f), mixHex(a[2], b[2], f)];
  }

  render(ctx: Ctx) {
    const t = this.time;
    const cam = this.camera;
    const upside = this.whim === 'upside';
    const giant = this.whim === 'giant' ? 1.6 : 1;
    const [c0, c1, c2] = this.skyColors();
    const g = ctx.createLinearGradient(0, 0, 0, STAGE_H);
    g.addColorStop(0, upside ? c2 : c0);
    g.addColorStop(0.55, c1);
    g.addColorStop(1, upside ? c0 : c2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, STAGE_W, STAGE_H);

    // floating geometry, outlined thickly: the visual language of this place
    ctx.save();
    cam.apply(ctx, 0.25);
    for (let i = 0; i < 26; i++) {
      const x = hash(i * 3.1) * (W * 0.5 + 1600) - 200;
      const baseY = 120 + hash(i * 7.7) * 380;
      const y = upside ? STAGE_H - baseY : baseY;
      const s = (18 + hash(i) * 30) * giant;
      ctx.save();
      ctx.translate(x, y + Math.sin(t * 0.8 + i) * 14);
      ctx.rotate(t * 0.3 * (i % 2 ? 1 : -1) + i);
      ctx.fillStyle = ['#FF7FB0', '#7AE7C7', '#FFE45E', '#8E5BD9', '#ffffff'][i % 5];
      ctx.strokeStyle = INK;
      ctx.lineWidth = 4;
      ctx.beginPath();
      if (i % 3 === 0) ctx.rect(-s / 2, -s / 2, s, s);
      else if (i % 3 === 1) {
        ctx.moveTo(0, -s / 2);
        ctx.lineTo(s / 2, s / 2);
        ctx.lineTo(-s / 2, s / 2);
        ctx.closePath();
      } else ctx.arc(0, 0, s / 2, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();

    // checkerboard hills
    ctx.save();
    cam.apply(ctx, 0.5);
    for (let i = 0; i < 12; i++) {
      const hx = i * 520 - 300;
      const hy = upside ? 150 : 640;
      const r = 300;
      ctx.save();
      ctx.beginPath();
      if (upside) ctx.arc(hx, hy - 120, r, 0, Math.PI);
      else ctx.arc(hx, hy + 120, r, Math.PI, 0);
      ctx.closePath();
      ctx.clip();
      for (let gx = -r; gx < r; gx += 50)
        for (let gy = -r; gy < r; gy += 50) {
          ctx.fillStyle = (Math.floor(gx / 50) + Math.floor(gy / 50)) % 2 ? '#9ee6d6' : '#c9f5ea';
          ctx.fillRect(hx + gx, hy + gy, 50, 50);
        }
      ctx.restore();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 5;
      ctx.beginPath();
      if (upside) ctx.arc(hx, hy - 120, r, 0, Math.PI);
      else ctx.arc(hx, hy + 120, r, Math.PI, 0);
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    cam.apply(ctx, 1);
    this.drawGround(ctx, t);
    this.drawUpsideTrees(ctx, t, giant);
    this.drawGate(ctx, 160, t);
    this.drawWobble(ctx, 560, t);
    this.drawMeadow(ctx, 950, t, giant);
    this.drawTower(ctx, 1320, t);
    this.drawPuff(ctx, 2030, t);
    this.drawGap(ctx, t);
    this.drawCrust(ctx, 2820, t);
    this.drawSteps(ctx, 3180, t);
    this.drawStatue(ctx, 3560, t);
    this.drawWhale(ctx, 3860, t);
    this.drawStudioGate(ctx, 4150, t);
    this.drawThinkingFlowers(ctx, t, giant);
    for (const d of this.doodles) this.drawDoodle(ctx, d.x, d.y, t, d.seed);
    this.drawActors(ctx);
    this.drawEffects(ctx);
    this.renderActivity(ctx);
    this.particles.render(ctx);
    ctx.restore();

    if (this.whimFlash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${this.whimFlash * 0.7})`;
      ctx.fillRect(0, 0, STAGE_W, STAGE_H);
    }
    this.drawMoodLight(ctx);
    ctx.save();
    cam.apply(ctx, 1);
    this.drawBarks(ctx);
    if (!this.activity) this.drawPrompt(ctx);
    ctx.restore();
  }

  private outline(ctx: Ctx, w = 5) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = w;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  private drawGround(ctx: Ctx, t: number) {
    // a wavy, stripy candy ground
    for (let x = -100; x < W + 100; x += 80) {
      ctx.fillStyle = (x / 80) % 2 ? '#FFB3D1' : '#FFD9E8';
      ctx.beginPath();
      ctx.moveTo(x, FLOOR + Math.sin(x * 0.01 + t) * 4);
      ctx.lineTo(x + 80, FLOOR + Math.sin((x + 80) * 0.01 + t) * 4);
      ctx.lineTo(x + 80, STAGE_H + 20);
      ctx.lineTo(x, STAGE_H + 20);
      ctx.fill();
    }
    ctx.beginPath();
    for (let x = -100; x < W + 100; x += 20) ctx.lineTo(x, FLOOR + Math.sin(x * 0.01 + t) * 4);
    this.outline(ctx, 6);
  }

  private drawUpsideTrees(ctx: Ctx, t: number, giant: number) {
    for (let i = 0; i < 9; i++) {
      const x = 400 + i * 470;
      const top = 70 + Math.sin(t * 0.6 + i) * 10;
      // a floating island with a tree hanging beneath it
      ctx.fillStyle = '#c9b6ef';
      ctx.beginPath();
      ctx.ellipse(x, top, 70 * giant, 22, 0, 0, TAU);
      ctx.fill();
      this.outline(ctx, 4);
      ctx.fillStyle = '#8E5BD9';
      ctx.fillRect(x - 6, top + 18, 12, 70 * giant);
      ctx.beginPath();
      ctx.arc(x, top + 18 + 90 * giant, 46 * giant, 0, TAU);
      ctx.fillStyle = i % 2 ? '#7AE7C7' : '#FFE45E';
      ctx.fill();
      this.outline(ctx, 4);
      for (let s = 0; s < 6; s++) circle(ctx, x + Math.cos(s) * 30 * giant, top + 18 + 90 * giant + Math.sin(s * 1.7) * 30 * giant, 5, '#ffffff');
    }
  }

  private drawThinkingFlowers(ctx: Ctx, t: number, giant: number) {
    // flowers with faces that turn to watch you go by
    const p = this.player;
    for (let i = 0; i < 14; i++) {
      const x = 260 + i * 300 + (i % 2) * 90;
      if (Math.abs(x - GAP_X - GAP_W / 2) < GAP_W / 2 + 40) continue;
      const h = (70 + (i % 3) * 30) * giant;
      const look = clamp((p.x - x) / 300, -1, 1);
      ctx.strokeStyle = '#2a9d6a';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(x, FLOOR);
      ctx.quadraticCurveTo(x + Math.sin(t + i) * 10, FLOOR - h / 2, x, FLOOR - h);
      ctx.stroke();
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * TAU + t * 0.4;
        ellipse(ctx, x + Math.cos(a) * 18 * giant, FLOOR - h + Math.sin(a) * 18 * giant, 11 * giant, 7 * giant, ['#FF7FB0', '#FFE45E', '#8E5BD9'][i % 3], a);
      }
      circle(ctx, x, FLOOR - h, 13 * giant, '#fff7d6');
      circle(ctx, x - 4 * giant + look * 3, FLOOR - h - 2, 2.5 * giant, INK);
      circle(ctx, x + 4 * giant + look * 3, FLOOR - h - 2, 2.5 * giant, INK);
    }
  }

  private drawGate(ctx: Ctx, x: number, t: number) {
    // an arch made of a looping ribbon
    for (let k = 0; k < 5; k++) {
      ctx.strokeStyle = ['#FF7FB0', '#FFE45E', '#7AE7C7', '#8E5BD9', '#7FC8FF'][k];
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.arc(x, FLOOR, 140 - k * 12, Math.PI, 0);
      ctx.stroke();
    }
    signText(ctx, 'To the cliffs', x, FLOOR - 170 + Math.sin(t * 2) * 4, 20, '#ffffff');
  }

  private drawWobble(ctx: Ctx, x: number, t: number) {
    const squish = 1 + Math.sin(t * 5) * 0.06;
    ctx.save();
    ctx.translate(x, FLOOR);
    ctx.scale(1 / squish, squish);
    ellipse(ctx, 0, 0, 60, 10, 'rgba(43,24,70,0.2)');
    ctx.fillStyle = 'rgba(122,231,199,0.75)';
    roundRect(ctx, -54, -120, 108, 120, 26);
    ctx.fill();
    this.outline(ctx, 5);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    roundRect(ctx, -40, -108, 28, 50, 12);
    ctx.fill();
    circle(ctx, -16, -70, 7, INK);
    circle(ctx, 16, -70, 7, INK);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, -52, 12, 0.2, Math.PI - 0.2);
    ctx.stroke();
    // the pencil
    ctx.save();
    ctx.translate(40, -110);
    ctx.rotate(0.6);
    ctx.fillStyle = '#FFE45E';
    ctx.fillRect(-4, -30, 8, 44);
    ctx.fillStyle = '#f2c29b';
    ctx.beginPath();
    ctx.moveTo(-4, 14);
    ctx.lineTo(4, 14);
    ctx.lineTo(0, 24);
    ctx.fill();
    ctx.restore();
    ctx.restore();
    signText(ctx, 'Wobble', x, FLOOR - 160, 18, '#ffffff');
  }

  private drawMeadow(ctx: Ctx, x: number, t: number, giant: number) {
    const b = this.bloom;
    for (let i = 0; i < 18; i++) {
      const fx = x - 170 + i * 20;
      const h = (40 + hash(i) * 40) * giant;
      const droop = (1 - b) * 0.9;
      const col = mixHex('#9a96a8', ['#FF7FB0', '#FFE45E', '#7AE7C7', '#8E5BD9'][i % 4], b);
      ctx.strokeStyle = mixHex('#7a7686', '#2a9d6a', b);
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(fx, FLOOR);
      const tipX = fx + Math.sin(droop) * h * 0.6 + Math.sin(t * 2 + i) * 3 * b;
      const tipY = FLOOR - Math.cos(droop) * h;
      ctx.quadraticCurveTo(fx, FLOOR - h * 0.7, tipX, tipY);
      ctx.stroke();
      circle(ctx, tipX, tipY, 9 * giant * (0.7 + 0.3 * b), col);
    }
    if (b > 0.1) glow(ctx, x, FLOOR - 60, 220, '#FFE45E', b * 0.5);
  }

  private drawTower(ctx: Ctx, x: number, t: number) {
    const rot = t * (this.whim === 'daydream' ? 0.4 : 1.2);
    ctx.fillStyle = '#8E5BD9';
    ctx.beginPath();
    ctx.moveTo(x - 60, FLOOR);
    ctx.lineTo(x - 30, FLOOR - 420);
    ctx.lineTo(x + 30, FLOOR - 420);
    ctx.lineTo(x + 60, FLOOR);
    ctx.closePath();
    ctx.fill();
    this.outline(ctx, 5);
    for (let k = 0; k < 6; k++) {
      ctx.fillStyle = ['#FFE45E', '#7AE7C7', '#FF7FB0'][k % 3];
      ctx.fillRect(x - 40 + k * 2, FLOOR - 80 - k * 60, 80 - k * 4, 18);
    }
    // the kaleidoscope eye at the top
    const cx = x;
    const cy = FLOOR - 470;
    for (let k = 0; k < 8; k++) {
      ctx.fillStyle = ['#FF7FB0', '#FFE45E', '#7AE7C7', '#8E5BD9'][k % 4];
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, 60, rot + (k / 8) * TAU, rot + ((k + 1) / 8) * TAU);
      ctx.closePath();
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(cx, cy, 60, 0, TAU);
    this.outline(ctx, 6);
    glow(ctx, cx, cy, 120, '#ffffff', 0.4 + Math.sin(t * 3) * 0.1);
    signText(ctx, WHIM_NAME[this.whim], x, FLOOR - 560, 18, '#ffffff');
  }

  private drawPuff(ctx: Ctx, x: number, t: number) {
    // a giant teacup to hide behind
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(x - 110, FLOOR - 180);
    ctx.lineTo(x + 110, FLOOR - 180);
    ctx.quadraticCurveTo(x + 100, FLOOR, x, FLOOR);
    ctx.quadraticCurveTo(x - 100, FLOOR, x - 110, FLOOR - 180);
    ctx.fill();
    this.outline(ctx, 5);
    ctx.beginPath();
    ctx.arc(x + 120, FLOOR - 110, 36, -Math.PI / 2, Math.PI / 2);
    this.outline(ctx, 10);
    for (let k = 0; k < 5; k++) circle(ctx, x - 60 + k * 30, FLOOR - 120, 8, '#FF7FB0');
    const out = this.puffOut;
    const px = x + 60 + out * 110;
    const py = FLOOR - 180 - out * 60 + Math.sin(t * 2) * 6;
    if (out <= 0) {
      // only a tail peeks out
      ellipse(ctx, x + 112, FLOOR - 170 + Math.sin(t * 3) * 4, 14, 10, '#aab4d8');
      return;
    }
    for (let k = 0; k < 5; k++) circle(ctx, px - 30 + k * 15, py, 22, '#c3cdee');
    circle(ctx, px - 8, py - 6, 4, INK);
    circle(ctx, px + 10, py - 6, 4, INK);
    ctx.strokeStyle = 'rgba(160,190,255,0.8)';
    ctx.lineWidth = 2;
    for (let k = 0; k < 4; k++) {
      const dy = ((t * 60 + k * 12) % 40) + py + 20;
      ctx.beginPath();
      ctx.moveTo(px - 20 + k * 12, dy);
      ctx.lineTo(px - 22 + k * 12, dy + 6);
      ctx.stroke();
    }
    signText(ctx, 'Puff', px, py - 46, 16, '#ffffff');
  }

  private drawGap(ctx: Ctx, t: number) {
    // the Gap of Nothing: fog and blank paper
    ctx.save();
    ctx.fillStyle = '#f4f1ff';
    ctx.fillRect(GAP_X, FLOOR - 8, GAP_W, STAGE_H);
    for (let i = 0; i < 8; i++) {
      const fg = ctx.createRadialGradient(GAP_X + GAP_W / 2 + Math.sin(t * 0.5 + i) * 60, FLOOR + 40 - i * 30, 10, GAP_X + GAP_W / 2, FLOOR, 260);
      fg.addColorStop(0, 'rgba(230,226,244,0.55)');
      fg.addColorStop(1, 'rgba(230,226,244,0)');
      ctx.fillStyle = fg;
      ctx.fillRect(GAP_X - 120, FLOOR - 300, GAP_W + 240, 500);
    }
    ctx.restore();
    if (this.flag('imagBridge')) {
      // a bridge built out of imagined things: arches, spoons, piano keys
      for (let k = 0; k < 6; k++) {
        const bx = GAP_X + k * 50;
        ctx.fillStyle = ['#FFE45E', '#7AE7C7', '#FF7FB0'][k % 3];
        ctx.beginPath();
        ctx.roundRect(bx, FLOOR - 10, 52, 18, 6);
        ctx.fill();
        this.outline(ctx, 3);
      }
      ctx.strokeStyle = '#8E5BD9';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(GAP_X + GAP_W / 2, FLOOR + 60, 160, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    }
    signText(ctx, this.flag('imagBridge') ? 'The imagined bridge' : 'The Gap of Nothing', GAP_X + GAP_W / 2, FLOOR - 230, 22, INK);
  }

  private drawCrust(ctx: Ctx, x: number, t: number) {
    // a cave in a candy hill
    ctx.fillStyle = '#FFB3D1';
    ctx.beginPath();
    ctx.arc(x, FLOOR, 200, Math.PI, 0);
    ctx.fill();
    this.outline(ctx, 5);
    ctx.fillStyle = '#4a2a6a';
    ctx.beginPath();
    ctx.arc(x, FLOOR, 90, Math.PI, 0);
    ctx.fill();
    if (this.crust < 0.95) {
      for (let k = 0; k < 6; k++) glow(ctx, x - 50 + k * 20, FLOOR - 20 - (k % 2) * 30, 24, ['#FFE45E', '#7AE7C7', '#FF7FB0'][k % 3], 0.9);
      memoryOrb(ctx, x, FLOOR - 50 + Math.sin(t * 2) * 4, 16, '#FFE45E', { glowAmt: 1 - this.crust });
    }
    if (this.crust > 0.02) {
      ctx.save();
      ctx.globalAlpha = this.crust;
      ctx.fillStyle = '#e8d6ff';
      ctx.beginPath();
      ctx.arc(x, FLOOR, 92, Math.PI, 0);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      for (let k = 0; k < 6; k++) {
        ctx.beginPath();
        ctx.moveTo(x - 70 + k * 28, FLOOR - 20);
        ctx.lineTo(x - 60 + k * 28, FLOOR - 60);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  private drawSteps(ctx: Ctx, x: number, t: number) {
    // a high ledge with a sparkle, and steps you can only see once you've looked carefully
    ctx.fillStyle = '#c9b6ef';
    ctx.beginPath();
    ctx.roundRect(x + 60, FLOOR - 320, 220, 40, 14);
    ctx.fill();
    this.outline(ctx, 4);
    if (!this.flag('imagLedge')) memoryOrb(ctx, x + 170, FLOOR - 350 + Math.sin(t * 2) * 5, 14, '#A05CF0', { glowAmt: 1 });
    for (let k = 0; k < 5; k++) {
      ctx.save();
      ctx.globalAlpha = 0.08 + this.steps * 0.85;
      ctx.fillStyle = '#DDC4FF';
      ctx.beginPath();
      ctx.roundRect(x - 120 + k * 46, FLOOR - 50 - k * 56, 70, 18, 8);
      ctx.fill();
      if (this.steps > 0.3) this.outline(ctx, 3);
      ctx.restore();
    }
  }

  private drawStatue(ctx: Ctx, x: number, t: number) {
    // plinth
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - 70, FLOOR - 70, 140, 70);
    ctx.beginPath();
    ctx.rect(x - 70, FLOOR - 70, 140, 70);
    this.outline(ctx, 4);
    if (this.statue > 0.02) {
      ctx.save();
      ctx.globalAlpha = this.statue;
      const shine = ctx.createLinearGradient(x - 60, 0, x + 60, 0);
      shine.addColorStop(0, '#c9c3da');
      shine.addColorStop(0.5, '#ffffff');
      shine.addColorStop(1, '#b4adc8');
      ctx.fillStyle = shine;
      roundRect(ctx, x - 30, FLOOR - 250, 60, 180, 20);
      ctx.fill();
      circle(ctx, x, FLOOR - 280, 34, '#eeeaf7');
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, FLOOR - 278, 16, 0.2, Math.PI - 0.2);
      ctx.stroke();
      ctx.fillStyle = '#F2C14E';
      ctx.fillRect(x + 26, FLOOR - 220, 22, 30);
      glow(ctx, x, FLOOR - 200, 140, '#ffffff', 0.4 + Math.sin(t * 4) * 0.15);
      signText(ctx, 'Perfect Riley', x, FLOOR - 340, 16, INK);
      ctx.restore();
    }
    if (this.statue < 0.98) {
      ctx.save();
      ctx.globalAlpha = 1 - this.statue;
      // the real one: a messy crayon drawing on paper
      ctx.fillStyle = '#fffdf2';
      ctx.fillRect(x - 70, FLOOR - 260, 140, 180);
      ctx.strokeStyle = '#FF8A5B';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(x - 20, FLOOR - 120);
      ctx.lineTo(x - 26, FLOOR - 180);
      ctx.lineTo(x + 26, FLOOR - 182);
      ctx.lineTo(x + 20, FLOOR - 118);
      ctx.stroke();
      ctx.strokeStyle = '#5a3418';
      ctx.beginPath();
      ctx.arc(x, FLOOR - 208, 22, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = '#3D7BFF';
      ctx.beginPath();
      ctx.moveTo(x - 30, FLOOR - 160);
      ctx.lineTo(x - 10, FLOOR - 150);
      ctx.stroke();
      signText(ctx, 'Real Riley', x, FLOOR - 290, 16, INK);
      ctx.restore();
    }
  }

  private drawWhale(ctx: Ctx, x: number, t: number) {
    const y = FLOOR - 470 + Math.sin(t * 0.7) * 20;
    for (let k = 0; k < 7; k++) circle(ctx, x - 120 + k * 40, y + Math.sin(k) * 10, 50 - Math.abs(k - 3) * 6, '#ffffff');
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(x + 150, y);
    ctx.quadraticCurveTo(x + 210, y - 60 + Math.sin(t * 2) * 10, x + 240, y - 40);
    ctx.quadraticCurveTo(x + 210, y - 10, x + 240, y + 20);
    ctx.quadraticCurveTo(x + 200, y + 20, x + 150, y + 10);
    ctx.fill();
    circle(ctx, x - 100, y - 10, 6, INK);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x - 90, y + 14, 14, 0.3, Math.PI - 0.3);
    ctx.stroke();
    glow(ctx, x, y, 200, '#ffffff', 0.25);
    signText(ctx, 'Nimbus', x, y - 80, 16, INK);
  }

  private drawStudioGate(ctx: Ctx, x: number, t: number) {
    // searchlights from the studio lot beyond
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const off of [-1, 1]) {
      const a = -Math.PI / 2 + off * 0.3 + Math.sin(t * 0.8 + off) * 0.35;
      const lg = ctx.createLinearGradient(x, FLOOR, x + Math.cos(a) * 700, FLOOR + Math.sin(a) * 700);
      lg.addColorStop(0, 'rgba(255,240,180,0.35)');
      lg.addColorStop(1, 'rgba(255,240,180,0)');
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.moveTo(x + off * 60, FLOOR - 200);
      ctx.lineTo(x + off * 60 + Math.cos(a - 0.08) * 700, FLOOR - 200 + Math.sin(a - 0.08) * 700);
      ctx.lineTo(x + off * 60 + Math.cos(a + 0.08) * 700, FLOOR - 200 + Math.sin(a + 0.08) * 700);
      ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = '#1a1636';
    ctx.beginPath();
    ctx.roundRect(x - 100, FLOOR - 300, 200, 300, [20, 20, 0, 0]);
    ctx.fill();
    this.outline(ctx, 5);
    ctx.fillStyle = '#FFCF33';
    for (let k = 0; k < 10; k++) circle(ctx, x - 90 + k * 20, FLOOR - 290, 4 + (Math.floor(t * 4 + k) % 2), '#FFE58A');
    ctx.font = `800 22px ${FONT_DISPLAY}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFE58A';
    ctx.fillText('DREAM', x, FLOOR - 240);
    ctx.fillText('PRODUCTIONS', x, FLOOR - 212);
    ctx.fillStyle = rgba('#FFE58A', 0.3);
    ctx.fillRect(x - 60, FLOOR - 180, 120, 180);
  }

  private drawDoodle(ctx: Ctx, x: number, y: number, t: number, seed: number) {
    ctx.strokeStyle = ['#8E5BD9', '#FF7FB0', '#2a9d6a', '#3D7BFF'][Math.floor(seed) % 4];
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let k = 0; k < 18; k++) {
      const a = k * 0.9 + t * 6 + seed;
      ctx.lineTo(x + Math.cos(a) * (10 + (k % 3) * 2), y - 16 + Math.sin(a * 1.3) * 10);
    }
    ctx.stroke();
    circle(ctx, x - 4, y - 18, 2, INK);
    circle(ctx, x + 4, y - 18, 2, INK);
    ctx.beginPath();
    ctx.moveTo(x - 6, y - 4);
    ctx.lineTo(x - 9, y + 4);
    ctx.moveTo(x + 6, y - 4);
    ctx.lineTo(x + 9, y + 4);
    ctx.stroke();
  }
}
