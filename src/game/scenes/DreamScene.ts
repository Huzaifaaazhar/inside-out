import { STAGE_H, STAGE_W } from '../../engine/camera';
import type { Ctx } from '../../engine/draw';
import { FONT_DISPLAY, circle, ellipse, glow, memoryOrb, rgba, roundRect, signText, stars } from '../../engine/draw';
import { TAU, clamp, hash } from '../../engine/math';
import { useGame } from '../../state/store';
import { ActivityScene } from '../ActivityScene';
import type { Activity } from '../activities';
import { DreamTake } from '../activities3';
import { renderVignette } from '../art/vignette';
import type { EmotionId } from '../content/emotions';
import { EMOTIONS, EMOTION_ORDER } from '../content/emotions';
import type { Game } from '../Game';
import { allEntries, getEntry } from '../systems/library';
import { Actor } from '../WorldScene';

const FLOOR = 760;
const W = 3700;
const TWISTS = ['everyone is secretly a cat', 'the floor is made of jelly', 'the school is a boat', 'it’s snowing upwards', 'Dad is a giant pancake', 'the hockey puck can talk'];
const STATIONS: { x: number; emotion: EmotionId; name: string; insight: string }[] = [
  { x: 1220, emotion: 'joy', name: 'Lighting desk', insight: 'dream-joy' },
  { x: 1560, emotion: 'sadness', name: 'Rain machine', insight: 'dream-sadness' },
  { x: 1900, emotion: 'anger', name: 'Pyrotechnics bay', insight: 'dream-anger' },
  { x: 2240, emotion: 'fear', name: 'Stunt rig', insight: 'dream-fear' },
  { x: 2580, emotion: 'disgust', name: 'Wardrobe rail', insight: 'dream-disgust' },
];

/**
 * Dream Productions: a studio lot at midnight. Today's memories arrive by tube and are
 * turned into props, sets and lighting for tonight's dream, which you then shoot.
 */
export class DreamScene extends ActivityScene {
  readonly id = 'dreams' as const;
  worldW = W;
  floorY = FLOOR;
  /** Tonight's dream, as it's being put together. */
  private setting: string | null = null;
  private mood: EmotionId = 'joy';
  private twist = TWISTS[0];
  private twistSpin = 0;
  private premiere = 0;
  private rain = 0;
  private boom = 0;
  private lumenTalk = 0;

  constructor(game: Game) {
    super(game);
    this.actors = [new Actor('joy', 260, FLOOR, 17)];
    this.roomLight = 0.08;
    this.build();
  }

  private get day() {
    return useGame.getState().mind?.day ?? 1;
  }

  private shotToday() {
    return useGame.getState().progress.dreams.some((d) => d.day === this.day);
  }

  private recentMemories() {
    const mind = useGame.getState().mind;
    return allEntries(mind)
      .filter((e) => {
        const m = mind?.memories[e.id];
        return m && m.status !== 'released' && m.status !== 'sealed' && m.status !== 'forgotten';
      })
      .sort((a, b) => (mind!.memories[b.id].lastSeen ?? 0) - (mind!.memories[a.id].lastSeen ?? 0))
      .slice(0, 3);
  }

  private build() {
    const store = () => useGame.getState();
    const say = (t: string, d = 3.4) => this.player.say(t, d);
    this.interactables.push({
      id: 'gate',
      x: 170,
      y: FLOOR - 300,
      range: 130,
      label: () => 'Walk back into Imagination Land',
      interact: () => store().travel('imagination', 'iris', 4000),
    });
    this.interactables.push({
      id: 'lumen',
      x: 560,
      y: FLOOR - 300,
      range: 140,
      label: () => 'Talk to Director Lumen',
      interact: () => {
        this.lumenTalk = 4;
        const s = store();
        s.say([
          { speaker: 'lumen', text: 'Ah! An emotion on set! Wonderful. I’m Lumen. I direct Riley’s dreams.' },
          { speaker: 'lumen', text: 'Every night, today’s memories come down the tubes. We turn them into sets, props and lighting.' },
          { speaker: 'lumen', text: 'A worry becomes a monster made of homework. A good day becomes a parade. Dreams are the mind tidying up, with costumes.' },
          { speaker: 'lumen', text: 'Pick a memory at the intake desk, set the mood, spin a twist, then shoot it on Stage 1. Tonight, Riley will dream it.' },
          { speaker: 'fizz', text: 'Bzzt. And try not to set the pyrotechnics off indoors again. Bzzt.' },
        ]);
      },
    });
    this.interactables.push({
      id: 'intake',
      x: 880,
      y: FLOOR - 260,
      range: 130,
      label: () => (this.setting ? `Change tonight’s setting (now: ${getEntry(this.setting, store().mind)?.title})` : 'Choose a memory to dream about'),
      interact: () => {
        const opts = this.recentMemories();
        if (!opts.length) return say('No memories have come down the tube yet today.');
        store().say([{ speaker: 'fizz', text: 'Bzzt. Today’s deliveries. Which one becomes the set?' }], undefined, [
          ...opts.map((e) => ({
            label: e.title,
            run: () => {
              this.setting = e.id;
              this.game.audio.chime(1);
              say(`“${e.title}” goes onto the set. In a dream, it’ll come out... different.`, 3.2);
            },
          })),
          { label: 'Not yet', run: () => undefined },
        ]);
      },
    });
    for (const s of STATIONS) {
      this.interactables.push({
        id: `station-${s.emotion}`,
        x: s.x,
        y: FLOOR - 300,
        range: 120,
        label: () => `${s.name}: set tonight’s mood to ${EMOTIONS[store().active].name}`,
        interact: () => {
          this.mood = store().active;
          this.game.audio.select(this.mood);
          say(`Tonight’s dream will feel like ${EMOTIONS[this.mood].name}.`, 2.6);
        },
        abilities: {
          [s.emotion]: () => {
            if (s.emotion === 'sadness') this.rain = 4;
            if (s.emotion === 'anger') this.boom = 1;
            if (store().findInsight(s.insight)) {
              store().discover(`dream-${s.emotion}`);
              this.game.audio.coreMemory();
            }
            say(
              {
                joy: 'Warm light everywhere! Dreams need hope in them.',
                sadness: 'A little rain on set. It makes the colours softer.',
                anger: 'BOOM. Pyrotechnics say: this matters!',
                fear: 'Harness checked. Twice. A safe stunt is a good stunt.',
                disgust: 'That sequinned banana costume? Nope. She’d never.',
              }[s.emotion],
              3,
            );
          },
        },
      });
    }
    this.interactables.push({
      id: 'twist',
      x: 2920,
      y: FLOOR - 300,
      range: 130,
      label: () => `Spin the plot-twist machine (now: ${this.twist})`,
      interact: () => {
        this.twistSpin = 1.4;
        this.game.audio.whoosh(true);
        this.later(1.4, () => {
          this.twist = TWISTS[Math.floor(Math.random() * TWISTS.length)];
          this.game.audio.pop();
          say(`Plot twist: ${this.twist}.`, 3);
        });
      },
    });
    this.interactables.push({
      id: 'stage',
      x: 3300,
      y: FLOOR - 300,
      range: 160,
      hit: { x: 3150, y: FLOOR - 420, w: 300, h: 420 },
      label: () => (this.shotToday() ? 'Watch tonight’s dream on the premiere screen' : 'Shoot tonight’s dream on Stage 1'),
      interact: () => {
        if (this.shotToday()) {
          this.premiere = 6;
          return say('Tonight’s feature is in the can. Riley will dream it when she sleeps.', 3);
        }
        if (!this.setting) this.setting = this.recentMemories()[0]?.id ?? null;
        if (!this.setting) return say('We need a memory for the set first. Try the intake desk.');
        this.hostActivity('dream-take', new DreamTake(this.game.audio, this.particles), { x: 3300 - 430, y: 150, w: 860, h: 500 });
      },
    });
    this.interactables.push({
      id: 'board',
      x: 1050,
      y: FLOOR - 360,
      range: 90,
      label: () => 'Read the “How a dream is made” board',
      interact: () =>
        store().say([
          { speaker: 'console', text: 'Step one: today’s memories arrive at intake.' },
          { speaker: 'console', text: 'Step two: the strongest feelings choose the lighting.' },
          { speaker: 'console', text: 'Step three: anything left unfinished gets a plot twist, so the mind can play with it safely.' },
          { speaker: 'console', text: 'Step four: shoot it. Step five: Riley wakes up and remembers about a third of it.' },
        ]),
    });
  }

  protected onActivityDone(a: Activity, _id: string, completed: boolean) {
    if (!completed || !this.setting) return;
    const st = useGame.getState();
    const q = a.score;
    const kind = q < 0.4 || (this.mood === 'fear' && q < 0.7) ? 'restless' : q >= 0.7 && this.mood !== 'fear' ? 'sweet' : 'strange';
    st.recordDream({ day: this.day, setting: this.setting, mood: this.mood, twist: this.twist, quality: q, kind });
    st.discover('dream-shot');
    this.premiere = 8;
    this.game.audio.success();
    st.showToast(`Tonight’s dream is ready: ${kind === 'sweet' ? 'a sweet one' : kind === 'strange' ? 'a strange one' : 'a restless one'}. Riley will dream it tonight.`, '#FFCF33');
  }

  enter(spawn?: number) {
    this.actors[0].id = useGame.getState().active;
    super.enter(spawn ?? 300);
    const st = useGame.getState();
    if (!st.flags.dreamsVisited) {
      st.setFlag('dreamsVisited');
      this.later(0.9, () => this.player.say('Dream Productions! So this is where dreams come from.', 3.2));
    }
  }

  protected tick(dt: number) {
    const st = useGame.getState();
    this.player.state.talking = !!st.dialogue && st.dialogue.lines[st.dialogue.index]?.speaker === this.player.id;
    this.twistSpin = Math.max(0, this.twistSpin - dt);
    this.premiere = Math.max(0, this.premiere - dt);
    this.rain = Math.max(0, this.rain - dt);
    this.boom = Math.max(0, this.boom - dt * 0.7);
    this.lumenTalk = Math.max(0, this.lumenTalk - dt);
    if (this.boom > 0.6 && Math.random() < dt * 20) this.particles.emit({ x: 1900 + (Math.random() - 0.5) * 200, y: 200 + Math.random() * 200, count: 20, color: ['#FFCF33', '#F0412D', '#ffffff'], shape: 'spark', speed: [100, 300], life: [0.4, 0.9] });
    this.tickActivity(dt);
  }

  render(ctx: Ctx) {
    const t = this.time;
    const cam = this.camera;
    const g = ctx.createLinearGradient(0, 0, 0, STAGE_H);
    g.addColorStop(0, '#07081f');
    g.addColorStop(0.7, '#1c1a46');
    g.addColorStop(1, '#3a2a5e');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, STAGE_W, STAGE_H);
    stars(ctx, STAGE_W, STAGE_H * 0.6, 140, t, 11);
    // crescent moon
    ctx.save();
    cam.apply(ctx, 0.05);
    glow(ctx, 1200, 160, 180, '#FFF1B0', 0.6);
    circle(ctx, 1200, 160, 54, '#FFF1B0');
    circle(ctx, 1224, 146, 50, '#0d0e2a');
    ctx.restore();

    // distant soundstages
    ctx.save();
    cam.apply(ctx, 0.4);
    for (let i = 0; i < 10; i++) {
      const x = i * 420 - 100;
      const h = 260 + hash(i) * 120;
      ctx.fillStyle = '#16163a';
      ctx.beginPath();
      ctx.moveTo(x, 760);
      ctx.lineTo(x, 760 - h);
      ctx.quadraticCurveTo(x + 160, 760 - h - 80, x + 320, 760 - h);
      ctx.lineTo(x + 320, 760);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,229,138,0.18)';
      ctx.font = `800 28px ${FONT_DISPLAY}`;
      ctx.textAlign = 'center';
      ctx.fillText(String(i + 2), x + 160, 760 - h + 34);
    }
    // sweeping searchlights
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
      const sx = 300 + i * 1000;
      const a = -Math.PI / 2 + Math.sin(t * 0.5 + i * 1.7) * 0.5;
      const lg = ctx.createLinearGradient(sx, 760, sx + Math.cos(a) * 900, 760 + Math.sin(a) * 900);
      lg.addColorStop(0, 'rgba(160,220,255,0.25)');
      lg.addColorStop(1, 'rgba(160,220,255,0)');
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.moveTo(sx, 760);
      ctx.lineTo(sx + Math.cos(a - 0.06) * 900, 760 + Math.sin(a - 0.06) * 900);
      ctx.lineTo(sx + Math.cos(a + 0.06) * 900, 760 + Math.sin(a + 0.06) * 900);
      ctx.fill();
    }
    ctx.restore();

    ctx.save();
    cam.apply(ctx, 1);
    // asphalt lot with painted lines
    ctx.fillStyle = '#26243f';
    ctx.fillRect(-200, FLOOR - 4, W + 400, STAGE_H);
    ctx.fillStyle = 'rgba(255,229,138,0.5)';
    for (let x = 0; x < W; x += 140) ctx.fillRect(x, FLOOR + 50, 70, 6);
    this.drawGate(ctx, 170, t);
    this.drawLumen(ctx, 560, t);
    this.drawIntake(ctx, 880, t);
    this.drawBoard(ctx, 1050);
    for (const s of STATIONS) this.drawStation(ctx, s, t);
    this.drawTwist(ctx, 2920, t);
    this.drawStage(ctx, 3300, t);
    this.drawFizz(ctx, 760, t);
    this.drawActors(ctx);
    this.drawEffects(ctx);
    this.renderActivity(ctx);
    this.particles.render(ctx);
    ctx.restore();

    if (this.rain > 0) {
      ctx.strokeStyle = `rgba(180,210,255,${Math.min(0.6, this.rain / 4)})`;
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 80; i++) {
        const k = (t * 1.4 + hash(i)) % 1;
        const x = hash(i * 3) * STAGE_W;
        ctx.beginPath();
        ctx.moveTo(x, k * STAGE_H);
        ctx.lineTo(x - 4, k * STAGE_H + 16);
        ctx.stroke();
      }
    }
    this.drawMoodLight(ctx);
    ctx.save();
    cam.apply(ctx, 1);
    this.drawBarks(ctx);
    if (!this.activity) this.drawPrompt(ctx);
    ctx.restore();
  }

  private drawGate(ctx: Ctx, x: number, t: number) {
    ctx.fillStyle = '#2b2a52';
    ctx.fillRect(x - 90, FLOOR - 260, 14, 260);
    ctx.fillRect(x + 76, FLOOR - 260, 14, 260);
    ctx.fillStyle = '#1a1636';
    roundRect(ctx, x - 110, FLOOR - 320, 220, 70, 14);
    ctx.fill();
    for (let k = 0; k < 11; k++) circle(ctx, x - 100 + k * 20, FLOOR - 316, 4, (Math.floor(t * 5) + k) % 3 ? '#FFE58A' : '#8a7a40');
    signText(ctx, 'To Imagination Land', x, FLOOR - 285, 16, '#FFE58A');
  }

  private drawLumen(ctx: Ctx, x: number, t: number) {
    // a tall, thin director whose head is an anglepoise lamp
    const talk = this.lumenTalk > 0 ? Math.sin(t * 12) * 0.05 : 0;
    ctx.strokeStyle = '#3a3a5a';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - 14, FLOOR);
    ctx.lineTo(x - 10, FLOOR - 120);
    ctx.moveTo(x + 14, FLOOR);
    ctx.lineTo(x + 10, FLOOR - 120);
    ctx.stroke();
    ctx.fillStyle = '#5a4a8a';
    roundRect(ctx, x - 30, FLOOR - 250, 60, 140, 20);
    ctx.fill();
    ctx.fillStyle = '#FFCF33';
    ctx.fillRect(x - 6, FLOOR - 240, 12, 80);
    // arm with a megaphone
    ctx.strokeStyle = '#5a4a8a';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(x + 24, FLOOR - 230);
    ctx.lineTo(x + 60, FLOOR - 200 - Math.sin(t * 2) * 10);
    ctx.stroke();
    ctx.fillStyle = '#E63946';
    ctx.beginPath();
    ctx.moveTo(x + 60, FLOOR - 210);
    ctx.lineTo(x + 96, FLOOR - 228);
    ctx.lineTo(x + 96, FLOOR - 180);
    ctx.closePath();
    ctx.fill();
    // lamp neck and head
    ctx.strokeStyle = '#9aa0b8';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(x, FLOOR - 250);
    ctx.lineTo(x - 20, FLOOR - 300);
    ctx.lineTo(x + 10, FLOOR - 340);
    ctx.stroke();
    ctx.save();
    ctx.translate(x + 10, FLOOR - 340);
    ctx.rotate(0.5 + talk);
    ctx.fillStyle = '#c8cde0';
    ctx.beginPath();
    ctx.moveTo(-10, -10);
    ctx.lineTo(40, -26);
    ctx.lineTo(40, 26);
    ctx.lineTo(-10, 10);
    ctx.closePath();
    ctx.fill();
    glow(ctx, 50, 0, 120, '#FFF1B0', 0.6);
    circle(ctx, 4, -2, 4, '#1a1636');
    ctx.restore();
    // beret
    ellipse(ctx, x - 4, FLOOR - 352, 20, 7, '#1a1636', -0.3);
    signText(ctx, 'Director Lumen', x, FLOOR - 400, 18, '#FFE58A');
  }

  private drawFizz(ctx: Ctx, x: number, t: number) {
    // a stagehand made of TV static
    const y = FLOOR - 70 + Math.sin(t * 3) * 4;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(x, y, 36, 46, 0, 0, TAU);
    ctx.clip();
    for (let i = 0; i < 60; i++) {
      const v = Math.floor(hash(i + Math.floor(t * 20) * 7) * 255);
      ctx.fillStyle = `rgb(${v},${v},${Math.min(255, v + 30)})`;
      ctx.fillRect(x - 36 + (i % 8) * 9, y - 46 + Math.floor(i / 8) * 12, 9, 12);
    }
    ctx.restore();
    circle(ctx, x - 10, y - 8, 6, '#ffffff');
    circle(ctx, x + 10, y - 8, 6, '#ffffff');
    circle(ctx, x - 10, y - 8, 3, '#1a1636');
    circle(ctx, x + 10, y - 8, 3, '#1a1636');
    ctx.strokeStyle = '#9aa0b8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y - 46);
    ctx.lineTo(x + 14, y - 70);
    ctx.stroke();
    circle(ctx, x + 14, y - 70, 4, '#E63946');
    signText(ctx, 'Fizz', x, y - 90, 15, '#ffffff');
  }

  private drawIntake(ctx: Ctx, x: number, t: number) {
    // pneumatic tubes delivering today's memories
    ctx.fillStyle = 'rgba(160,220,255,0.15)';
    ctx.fillRect(x - 30, 0, 60, FLOOR - 220);
    ctx.strokeStyle = 'rgba(160,220,255,0.6)';
    ctx.lineWidth = 3;
    ctx.strokeRect(x - 30, -10, 60, FLOOR - 210);
    const recent = this.recentMemories();
    recent.forEach((e, i) => {
      const k = (t * 0.25 + i / 3) % 1;
      const m = useGame.getState().mind?.memories[e.id];
      memoryOrb(ctx, x, k * (FLOOR - 240), 16, EMOTIONS[m?.emotion ?? e.emotion].color, { glowAmt: 0.6 });
    });
    ctx.fillStyle = '#3a3560';
    roundRect(ctx, x - 90, FLOOR - 220, 180, 110, 12);
    ctx.fill();
    ctx.fillStyle = '#5a4a8a';
    ctx.fillRect(x - 100, FLOOR - 120, 200, 120);
    if (this.setting) {
      const e = getEntry(this.setting, useGame.getState().mind);
      if (e) memoryOrb(ctx, x, FLOOR - 160, 22, EMOTIONS[e.emotion].color, { t, glowAmt: 1 });
    }
    signText(ctx, 'Memory intake', x, FLOOR - 250, 18, '#7FC8FF');
  }

  private drawBoard(ctx: Ctx, x: number) {
    ctx.fillStyle = '#fff4c2';
    roundRect(ctx, x - 70, FLOOR - 440, 140, 120, 8);
    ctx.fill();
    ctx.fillStyle = '#5a4a20';
    for (let k = 0; k < 5; k++) {
      circle(ctx, x - 52, FLOOR - 418 + k * 20, 5, ['#7FC8FF', '#FFCF33', '#FF7FB0', '#E63946', '#52C46B'][k]);
      ctx.fillRect(x - 40, FLOOR - 420 + k * 20, 90 - (k % 2) * 20, 4);
    }
    ctx.fillStyle = '#7a6a40';
    ctx.fillRect(x - 4, FLOOR - 320, 8, 320);
  }

  private drawStation(ctx: Ctx, s: (typeof STATIONS)[number], t: number) {
    const E = EMOTIONS[s.emotion];
    const x = s.x;
    const found = useGame.getState().progress.insights.includes(s.insight);
    const isMood = this.mood === s.emotion;
    ctx.fillStyle = '#2b2a52';
    roundRect(ctx, x - 90, FLOOR - 200, 180, 200, 14);
    ctx.fill();
    ctx.strokeStyle = E.color;
    ctx.lineWidth = isMood ? 6 : 3;
    ctx.stroke();
    if (isMood) glow(ctx, x, FLOOR - 120, 200, E.color, 0.5);
    switch (s.emotion) {
      case 'joy':
        for (let k = 0; k < 6; k++) {
          ctx.fillStyle = '#3a3560';
          ctx.fillRect(x - 70 + k * 24, FLOOR - 180, 16, 60);
          ctx.fillStyle = E.color;
          ctx.fillRect(x - 70 + k * 24, FLOOR - 140 - Math.sin(t + k) * 20, 16, 10);
        }
        glow(ctx, x, FLOOR - 260, 90, '#FFE58A', 0.7);
        circle(ctx, x, FLOOR - 260, 20, '#FFE58A');
        break;
      case 'sadness':
        ctx.fillStyle = '#5a7ab8';
        roundRect(ctx, x - 60, FLOOR - 300, 120, 40, 10);
        ctx.fill();
        for (let k = 0; k < 6; k++) {
          const dy = ((t * 80 + k * 30) % 100) + FLOOR - 260;
          ctx.fillStyle = 'rgba(180,210,255,0.8)';
          ctx.fillRect(x - 50 + k * 20, dy, 3, 10);
        }
        break;
      case 'anger':
        for (let k = 0; k < 3; k++) {
          ctx.fillStyle = '#5a2a2a';
          roundRect(ctx, x - 60 + k * 44, FLOOR - 260, 32, 60, 6);
          ctx.fill();
          ctx.fillStyle = E.color;
          ctx.fillRect(x - 56 + k * 44, FLOOR - 270, 24, 10);
        }
        break;
      case 'fear':
        ctx.strokeStyle = '#9aa0b8';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(x - 60, FLOOR - 200);
        ctx.lineTo(x - 60, FLOOR - 380);
        ctx.lineTo(x + 60, FLOOR - 380);
        ctx.moveTo(x + 20, FLOOR - 380);
        ctx.lineTo(x + 20 + Math.sin(t * 2) * 10, FLOOR - 260);
        ctx.stroke();
        roundRect(ctx, x + 6 + Math.sin(t * 2) * 10, FLOOR - 262, 28, 22, 6);
        ctx.fillStyle = E.color;
        ctx.fill();
        break;
      case 'disgust':
        ctx.strokeStyle = '#9aa0b8';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(x - 80, FLOOR - 300);
        ctx.lineTo(x + 80, FLOOR - 300);
        ctx.stroke();
        ['#FF7FB0', '#7FC8FF', '#FFE45E', '#52C46B'].forEach((c, k) => {
          ctx.fillStyle = c;
          ctx.beginPath();
          ctx.moveTo(x - 66 + k * 40, FLOOR - 296);
          ctx.lineTo(x - 52 + k * 40 + Math.sin(t + k) * 3, FLOOR - 220);
          ctx.lineTo(x - 80 + k * 40 + Math.sin(t + k) * 3, FLOOR - 220);
          ctx.fill();
        });
        break;
    }
    signText(ctx, s.name, x, FLOOR - (s.emotion === 'fear' ? 410 : 330), 17, found ? E.light : '#d8d4ea');
    if (found) memoryOrb(ctx, x + 70, FLOOR - 30, 9, E.color, { glowAmt: 0.6 });
  }

  private drawTwist(ctx: Ctx, x: number, t: number) {
    ctx.fillStyle = '#3a2a5e';
    roundRect(ctx, x - 80, FLOOR - 260, 160, 260, 20);
    ctx.fill();
    const spin = this.twistSpin > 0 ? t * 20 : t * 0.5;
    for (let k = 0; k < 8; k++) {
      ctx.fillStyle = ['#FF7FB0', '#FFE45E', '#7AE7C7', '#8E5BD9'][k % 4];
      ctx.beginPath();
      ctx.moveTo(x, FLOOR - 170);
      ctx.arc(x, FLOOR - 170, 60, spin + (k / 8) * TAU, spin + ((k + 1) / 8) * TAU);
      ctx.fill();
    }
    circle(ctx, x, FLOOR - 170, 12, '#ffffff');
    signText(ctx, 'Plot twists', x, FLOOR - 290, 17, '#FF7FB0');
  }

  private drawStage(ctx: Ctx, x: number, t: number) {
    // Stage 1 with a premiere screen on its wall
    ctx.fillStyle = '#1f1d44';
    ctx.beginPath();
    ctx.moveTo(x - 200, FLOOR);
    ctx.lineTo(x - 200, FLOOR - 400);
    ctx.quadraticCurveTo(x, FLOOR - 480, x + 200, FLOOR - 400);
    ctx.lineTo(x + 200, FLOOR);
    ctx.fill();
    ctx.fillStyle = '#FFE58A';
    ctx.font = `800 52px ${FONT_DISPLAY}`;
    ctx.textAlign = 'center';
    ctx.fillText('1', x, FLOOR - 400);
    const r = { x: x - 160, y: FLOOR - 370, w: 320, h: 180 };
    ctx.fillStyle = '#000';
    ctx.fillRect(r.x - 6, r.y - 6, r.w + 12, r.h + 12);
    const dream = useGame.getState().progress.dreams.find((d) => d.day === this.day);
    const entry = dream ? getEntry(dream.setting, useGame.getState().mind) : null;
    if (entry && dream) {
      renderVignette(ctx, r, entry.script, t, { lens: dream.mood });
      ctx.fillStyle = 'rgba(12,7,38,0.7)';
      ctx.fillRect(r.x, r.y + r.h - 30, r.w, 30);
      ctx.fillStyle = '#FFE58A';
      ctx.font = `800 14px ${FONT_DISPLAY}`;
      ctx.fillText(`Tonight: ${entry.title}, but ${dream.twist}`, x, r.y + r.h - 12);
      if (this.premiere > 0) glow(ctx, x, r.y + r.h / 2, 260, EMOTIONS[dream.mood].color, clamp(this.premiere / 4, 0, 0.5));
    } else {
      ctx.fillStyle = '#16163a';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = 'rgba(255,229,138,0.6)';
      ctx.font = `800 20px ${FONT_DISPLAY}`;
      ctx.fillText('Tonight’s feature: not shot yet', x, r.y + r.h / 2);
    }
    // the stage door
    ctx.fillStyle = '#3a3560';
    roundRect(ctx, x - 60, FLOOR - 170, 120, 170, [10, 10, 0, 0]);
    ctx.fill();
    ctx.fillStyle = (Math.floor(t * 2) % 2 && !this.shotToday()) ? '#E63946' : '#5a2a2a';
    circle(ctx, x, FLOOR - 190, 10, ctx.fillStyle as string);
    ctx.fillStyle = rgba('#ffffff', 0.7);
    ctx.font = `800 14px ${FONT_DISPLAY}`;
    ctx.fillText(this.shotToday() ? 'In the can' : 'On air soon', x, FLOOR - 140);
    void EMOTION_ORDER;
  }
}
