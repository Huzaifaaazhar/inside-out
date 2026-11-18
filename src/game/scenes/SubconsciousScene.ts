import { STAGE_H, STAGE_W } from '../../engine/camera';
import type { Ctx } from '../../engine/draw';
import { FONT_DISPLAY, circle, ellipse, glow, memoryOrb, rgba, roundRect, signText } from '../../engine/draw';
import { TAU, clamp, hash } from '../../engine/math';
import { useGame } from '../../state/store';
import type { EmotionId } from '../content/emotions';
import { EMOTIONS } from '../content/emotions';
import type { Game } from '../Game';
import { HIDDEN_FEARS } from '../systems/progress';
import { Actor, WorldScene } from '../WorldScene';

const FLOOR = 770;
const W = 3700;
const VAULT_X = 3350;
const LANTERN: Record<EmotionId, number> = { joy: 360, sadness: 250, anger: 280, fear: 190, disgust: 260 };
const KEYS: { flag: string; emotion: EmotionId; name: string }[] = [
  { flag: 'subKeySad', emotion: 'sadness', name: 'Tear key' },
  { flag: 'subKeyFear', emotion: 'fear', name: 'Worry key' },
  { flag: 'subChain', emotion: 'anger', name: 'Broken chain' },
];

/** Echoes of earlier choices, heard as bells in the dark. */
const ECHOES: { flag: string; text: string }[] = [
  { flag: 'toldParentsTruth', text: '“I miss home, okay?” She said it out loud. The bell rings warm.' },
  { flag: 'hidingFeelings', text: '“I’m fine.” She said it so many times it started to echo.' },
  { flag: 'daniHurt', text: 'A message to Dani, unsent. Still sitting in the drafts.' },
  { flag: 'keptInTouch', text: 'Dani’s laugh on a video call, a bit crackly, completely real.' },
  { flag: 'angryText', text: 'A text typed too fast. The bell rings sharp.' },
  { flag: 'invitedPriya', text: '“Want to sit with us?” Priya’s face when she said yes.' },
  { flag: 'benched', text: 'The bench was cold. She remembers exactly how cold.' },
  { flag: 'negotiated', text: '“Can we find a way that works for both of us?” Coach nodded.' },
  { flag: 'slammedDoor', text: 'A door slamming, still rattling somewhere down here.' },
  { flag: 'repaired', text: '“Sorry.” Small word. Big bell.' },
];

/**
 * The Subconscious: a cave under The Fading where Riley keeps what she isn't ready to look at.
 * It's dark down here, and each emotion carries a different-sized light.
 */
export class SubconsciousScene extends WorldScene {
  readonly id = 'subconscious' as const;
  worldW = W;
  floorY = FLOOR;
  private dark: HTMLCanvasElement | null = null;
  private garden = 0;
  private poolTalk = 0;
  private vaultOpen = 0;
  private hushX = 2250;
  private hushShy = 0;
  private bell = -1;
  private bellT = 0;
  private snore = 0;
  private reveal: { x: number; t: number; color: string }[] = [];

  constructor(game: Game) {
    super(game);
    this.actors = [new Actor('joy', 220, FLOOR, 21)];
    this.roomLight = 0.04;
    this.build();
  }

  private flag(k: string) {
    return !!useGame.getState().flags[k];
  }

  private keysHeld() {
    return KEYS.filter((k) => this.flag(k.flag)).length;
  }

  private findFear(id: string, x: number) {
    const st = useGame.getState();
    const f = HIDDEN_FEARS.find((h) => h.id === id);
    if (!f || !st.addFear(id)) return false;
    this.reveal.push({ x, t: 3, color: '#A05CF0' });
    st.showToast(`Hidden fear found: ${f.title}. “${f.text}”`, '#B9A7F5');
    st.gain(f.who, 4);
    this.game.audio.chime(2);
    return true;
  }

  private insight(id: string, emotion: EmotionId) {
    const st = useGame.getState();
    if (st.findInsight(id)) {
      st.discover(id);
      st.gain(emotion, 5);
      this.game.audio.coreMemory();
    }
  }

  private build() {
    const store = () => useGame.getState();
    const say = (t: string, d = 3.6) => this.player.say(t, d);
    this.interactables.push({
      id: 'up',
      x: 160,
      y: FLOOR - 260,
      range: 130,
      hit: { x: 60, y: FLOOR - 420, w: 220, h: 420 },
      label: () => 'Climb the stairs back up to The Fading',
      interact: () => store().travel('fading', 'glide', 2820),
    });
    this.interactables.push({
      id: 'guards',
      x: 560,
      y: FLOOR - 200,
      range: 150,
      label: () => 'Talk to the sleepy stone guards',
      interact: () => {
        const k = this.keysHeld();
        store().say([
          { speaker: 'bram', text: 'Hnnh? Visitors? Nobody visits. That’s the whole point of down here.' },
          { speaker: 'bolt', text: 'We guard the Closed Door. Riley put something behind it on moving day and asked us not to let her see it.' },
          { speaker: 'bram', text: 'It isn’t scary. It’s just... big. Things get bigger when you don’t look at them.' },
          { speaker: 'bolt', text: k >= 3 ? 'You’ve got all three. The door will listen to you now.' : `The door needs three things: a tear, a named worry, and a broken chain. You have ${k}.` },
          { speaker: store().active, text: store().active === 'fear' ? 'We could also just... leave it closed? Forever? Just an option.' : store().active === 'joy' ? 'Maybe it’s something good that got lost!' : 'Okay. Let’s go and look.' },
        ]);
      },
      abilities: {
        anger: () => {
          this.snore = 0;
          this.camera.shake(6);
          say('WAKE UP! ...Okay, they’re awake. And grumpy. Like me.');
        },
        sadness: () => {
          this.snore = 6;
          say('I hummed them a lullaby. They look so peaceful.');
        },
      },
    });
    this.interactables.push({
      id: 'bells',
      x: 900,
      y: FLOOR - 320,
      range: 150,
      hit: { x: 800, y: FLOOR - 460, w: 200, h: 360 },
      label: () => 'Ring an echo bell',
      interact: () => {
        const f = store().flags;
        const heard = ECHOES.filter((e) => f[e.flag]);
        this.bell = Math.floor(Math.random() * 3);
        this.bellT = 2;
        this.game.audio.chime(3 + this.bell);
        if (!heard.length) return say('The bell rings, but there’s no echo yet. Riley hasn’t made many big choices.');
        const e = heard[Math.floor(Math.random() * heard.length)];
        store().say([{ speaker: 'narrator', text: e.text }, { speaker: store().active, text: 'Everything she chooses ends up down here, ringing quietly.' }]);
      },
      abilities: { sadness: () => say('Each bell is a choice that still matters to her. Even the small ones.') },
    });
    this.interactables.push({
      id: 'ice',
      x: 1080,
      y: FLOOR - 40,
      range: 110,
      abilityRange: 220,
      label: () => 'Look at the crack in the frozen floor',
      interact: () => say(this.hasFear('fear-hockey') ? 'A hockey puck frozen in the ice. Number 9.' : 'Ice. Something small and round is stuck underneath.'),
      abilities: {
        fear: () => {
          if (this.findFear('fear-hockey', 1080)) say('A frozen puck! She’s scared she was only good because of the old team.');
          else say('Scanning again: still a puck. Still frozen. Still worried.');
        },
      },
    });
    this.interactables.push({
      id: 'garden',
      x: 1300,
      y: FLOOR - 140,
      range: 160,
      label: () => (this.flag('subGarden') ? 'Walk through the glowing garden' : 'Feel your way through the dark garden'),
      interact: () => say(this.flag('subGarden') ? 'The glow-bulbs are still lit. They hum when you pass.' : 'Plants you can only feel. Soft leaves, all closed up tight.'),
      abilities: {
        joy: () => {
          if (this.flag('subGarden')) return say('Shine on, little bulbs!');
          store().setFlag('subGarden');
          this.garden = 0.01;
          this.particles.emit({ x: 1300, y: FLOOR - 80, count: 70, color: ['#FFE45E', '#B4F7E0', '#ffffff'], shape: 'star', spread: 200, speed: [40, 200] });
          this.insight('sub-joy', 'joy');
          this.findFear('fear-forgotten', 1300);
          say('They light up! And there, in the roots: she’s scared her old friends will forget her.', 4.2);
        },
      },
    });
    this.interactables.push({
      id: 'pool',
      x: 1650,
      y: FLOOR - 60,
      range: 150,
      label: () => 'Listen to the murmuring pool',
      interact: () => {
        this.poolTalk = 4;
        say(this.flag('subKeySad') ? 'The pool is quiet now. It said what it needed to.' : 'Murmurs. Too quiet to make out. You’d have to really sit with it.');
      },
      abilities: {
        sadness: () => {
          this.poolTalk = 6;
          if (this.flag('subKeySad')) return say('I’ll sit a while anyway.');
          store().setFlag('subKeySad');
          this.insight('sub-sadness', 'sadness');
          this.particles.emit({ x: 1650, y: FLOOR - 70, count: 24, color: ['#3D7BFF', '#BBD2FF'], shape: 'drop', spread: 80, speed: [30, 120] });
          store().say([
            { speaker: 'narrator', text: 'Sadness sits down by the water. After a while, the murmuring becomes words.' },
            { speaker: 'narrator', text: '“I miss my room. I miss the way the old stairs creaked. I like it here a bit, and I feel bad about that.”' },
            { speaker: 'sadness', text: 'Both of those can be true at the same time. That’s allowed.' },
            { speaker: 'narrator', text: 'A single tear-shaped key rises out of the pool.' },
          ]);
        },
      },
    });
    this.interactables.push({
      id: 'jars',
      x: 1980,
      y: FLOOR - 260,
      range: 150,
      label: () => 'Look at the shelf of worry jars',
      interact: () => say(this.flag('subKeyFear') ? 'One jar is open. The worry inside looks much smaller now.' : 'Dozens of jars, all rattling. Each one has a worry inside, but the labels are blank.'),
      abilities: {
        fear: () => {
          if (this.flag('subKeyFear')) return say('All labelled. Alphabetically. You’re welcome.');
          store().setFlag('subKeyFear');
          this.insight('sub-fear', 'fear');
          this.findFear('fear-blame', 1980);
          store().say([
            { speaker: 'fear', text: 'Scanning... the loudest jar. Let me read the label I’m writing on it.' },
            { speaker: 'fear', text: '“If I’m not happy here, Mum and Dad will think the move was a mistake. And it’ll be my fault.”' },
            { speaker: 'fear', text: 'Oh. Saying it out loud makes it... smaller? It actually fits in the jar now.' },
            { speaker: 'narrator', text: 'A key falls out of the empty jar with a tiny clink.' },
          ]);
        },
      },
    });
    this.interactables.push({
      id: 'hush',
      x: this.hushX,
      y: FLOOR - 240,
      range: 140,
      label: () => 'Approach The Hush',
      interact: () => {
        const a = store().active;
        if (a === 'joy' && !this.flag('subHushMet')) {
          this.hushShy = 3;
          return say('It shrank away from me. Maybe I’m too bright for it right now.');
        }
        store().setFlag('subHushMet');
        store().say([
          { speaker: 'narrator', text: 'The Hush is a big, soft shadow with two pale, blinking eyes. It doesn’t speak so much as sigh.' },
          { speaker: 'hush', text: '...I’m made of everything Riley didn’t say. “I miss it.” “I’m scared.” “That wasn’t fair.”' },
          { speaker: 'hush', text: '...I get bigger when she’s quiet. I don’t want to be big. I just want to be heard.' },
          { speaker: a, text: a === 'anger' ? 'Then let’s say it. LOUD. Or, you know, at a normal volume.' : a === 'disgust' ? 'Honestly? Keeping all this in is the grossest thing down here.' : 'We hear you. Let’s open the door together.' },
        ]);
        store().gain(a, 2);
      },
      abilities: {
        sadness: () => {
          store().setFlag('subHushMet');
          say('I sat next to The Hush. It got a little smaller. It didn’t need fixing, just company.', 4);
        },
      },
    });
    this.interactables.push({
      id: 'shoulds',
      x: 2560,
      y: FLOOR - 220,
      range: 150,
      label: () => 'Read the jar of “shoulds”',
      interact: () =>
        store().say([
          { speaker: 'narrator', text: 'A heavy jar stuffed with paper slips. Each one starts with “should”.' },
          { speaker: 'narrator', text: '“I should be happy all the time.” “I should already have friends.” “I should be over it by now.”' },
          { speaker: store().active, text: store().active === 'disgust' ? 'Who wrote these? Because they have TERRIBLE taste.' : 'These are heavy. Somebody should do something about them.' },
        ]),
      abilities: {
        disgust: () => {
          if (this.flag('subShoulds')) return say('Still empty. Still fabulous.');
          store().setFlag('subShoulds');
          this.insight('sub-disgust', 'disgust');
          this.findFear('fear-belong', 2560);
          this.particles.emit({ x: 2560, y: FLOOR - 260, count: 40, color: ['#fff4c2', '#C2F0CC'], shape: 'dot', speed: [80, 260] });
          say('Nope, nope, and absolutely not. These rules were never hers. Out they go.', 4);
        },
      },
    });
    this.interactables.push({
      id: 'musicbox',
      x: 2840,
      y: FLOOR - 70,
      range: 110,
      abilityRange: 220,
      label: () => 'Pick up the tiny music box',
      interact: () => {
        this.game.audio.chime(6);
        say(this.hasFear('fear-grandpa') ? 'Grandpa’s Sunday song. It still plays fine down here.' : 'A tinny tune. It sounds like Sunday afternoons somewhere else.');
      },
      abilities: {
        sadness: () => {
          if (this.findFear('fear-grandpa', 2840)) say('She’s scared Grandpa’s songs only worked in the old kitchen. They don’t. Songs travel.', 4.2);
          else say('Still playing. Songs travel.');
        },
      },
    });
    this.interactables.push({
      id: 'chain',
      x: 3060,
      y: FLOOR - 260,
      range: 150,
      label: () => (this.flag('subChain') ? 'Look at the broken chain' : 'Pull on the heavy chain'),
      interact: () => say(this.flag('subChain') ? 'Snapped clean through. Felt good.' : 'A chain made of “it doesn’t matter”s, wrapped around a post. It won’t budge.'),
      abilities: {
        anger: () => {
          if (this.flag('subChain')) return say('Already broken. I could break it more?');
          store().setFlag('subChain');
          this.camera.shake(18);
          this.insight('sub-anger', 'anger');
          this.particles.emit({ x: 3060, y: FLOOR - 260, count: 50, color: ['#F0412D', '#FFB13B', '#FFE07A'], shape: 'ember', speed: [200, 480] });
          store().say([
            { speaker: 'anger', text: 'It DOES matter! Moving was hard and nobody asked her! That was UNFAIR!' },
            { speaker: 'anger', text: '...Huh. Saying it didn’t break anything except the chain.' },
          ]);
        },
      },
    });
    this.interactables.push({
      id: 'vault',
      x: VAULT_X,
      y: FLOOR - 300,
      range: 170,
      hit: { x: VAULT_X - 150, y: FLOOR - 460, w: 300, h: 460 },
      label: () => (this.flag('vaultOpened') ? 'Look at the memory behind the open door' : `The Closed Door (${this.keysHeld()} of 3 keys)`),
      interact: () => {
        const st = store();
        if (this.flag('vaultOpened')) return st.setTheatre('sealed-house');
        const missing = KEYS.filter((k) => !this.flag(k.flag));
        if (missing.length) {
          return st.say([
            { speaker: 'narrator', text: 'A round door, taller than the cave. It’s warm to the touch, like it’s been waiting.' },
            { speaker: 'narrator', text: `Three keyholes. ${missing.map((k) => `The ${k.name.toLowerCase()} hole is empty: it needs ${EMOTIONS[k.emotion].name}.`).join(' ')}` },
          ]);
        }
        st.say(
          [
            { speaker: 'narrator', text: 'The tear key. The worry key. The broken chain falls away. The Closed Door swings open.' },
            { speaker: 'narrator', text: 'Inside is a single memory orb, blue and quiet: an empty living room, and pencil marks on a wall.' },
            { speaker: 'sadness', text: 'It’s the old house. The last time she walked through it.' },
            { speaker: 'fear', text: 'She hid it because she thought if she liked it here, this one would stop counting.' },
            { speaker: 'anger', text: 'And she was mad nobody asked her about moving. That’s in here too.' },
            { speaker: 'disgust', text: 'And she kept telling herself she “should” be over it. Please.' },
            { speaker: 'joy', text: 'But look. Eight years of birthdays on one wall. That’s not a sad memory. Well. It’s not ONLY a sad memory.' },
          ],
          () => {
            const s2 = useGame.getState();
            s2.setFlag('vaultOpened');
            s2.unsealMemory('sealed-house');
            s2.discover('vault');
            (['joy', 'sadness', 'anger', 'fear', 'disgust'] as EmotionId[]).forEach((e) => s2.gain(e, 3));
            this.vaultOpen = 0.01;
            this.game.audio.coreMemory();
            s2.showToast('Riley faced the memory she was avoiding. “The empty old house” is back in Long-Term Memory.', '#3D7BFF');
            this.later(1.2, () => s2.setTheatre('sealed-house'));
          },
        );
      },
    });
  }

  private hasFear(id: string) {
    return useGame.getState().progress.fears.includes(id);
  }

  enter(spawn?: number) {
    this.actors[0].id = useGame.getState().active;
    super.enter(spawn ?? 300);
    this.game.audio.setAmbience(0.35);
    if (this.flag('subGarden')) this.garden = 1;
    if (this.flag('vaultOpened')) this.vaultOpen = 1;
    const st = useGame.getState();
    if (!st.flags.subVisited) {
      st.setFlag('subVisited');
      this.later(0.8, () =>
        st.say([
          { speaker: st.active, text: 'It’s so dark down here. The Subconscious. This is where Riley keeps the stuff she doesn’t want to think about.' },
          { speaker: 'narrator', text: 'Your light is the only light. Each emotion carries a different-sized glow, and some things only show up for the right one.' },
        ]),
      );
    }
  }

  exit() {
    super.exit();
    this.game.audio.setAmbience(1);
  }

  protected tick(dt: number) {
    const st = useGame.getState();
    this.player.state.talking = !!st.dialogue && st.dialogue.lines[st.dialogue.index]?.speaker === this.player.id;
    if (this.garden > 0 && this.garden < 1) this.garden = Math.min(1, this.garden + dt * 0.6);
    if (this.vaultOpen > 0 && this.vaultOpen < 1) this.vaultOpen = Math.min(1, this.vaultOpen + dt * 0.4);
    this.poolTalk = Math.max(0, this.poolTalk - dt);
    this.hushShy = Math.max(0, this.hushShy - dt);
    this.bellT = Math.max(0, this.bellT - dt);
    this.snore = Math.max(0, this.snore - dt);
    for (const r of this.reveal) r.t -= dt;
    this.reveal = this.reveal.filter((r) => r.t > 0);
    // The Hush drifts and keeps a polite distance from Joy until it's been met
    const away = st.active === 'joy' && !st.flags.subHushMet && Math.abs(this.player.x - this.hushX) < 260 ? Math.sign(this.hushX - this.player.x) * 120 : 0;
    const target = 2250 + Math.sin(this.time * 0.4) * 50 + away;
    this.hushX += (target - this.hushX) * Math.min(1, dt * 1.5);
    const h = this.interactables.find((i) => i.id === 'hush');
    if (h) h.x = this.hushX;
    if (Math.random() < dt * 3) this.particles.emit({ x: this.camera.x + (Math.random() - 0.5) * 1600, y: FLOOR - Math.random() * 500, count: 1, color: ['#6E79B8', '#B9A7F5'], shape: 'dot', speed: [5, 20], life: [2, 4], size: [1, 3], gravity: -10 });
  }

  render(ctx: Ctx) {
    const t = this.time;
    const cam = this.camera;
    const g = ctx.createLinearGradient(0, 0, 0, STAGE_H);
    g.addColorStop(0, '#05061a');
    g.addColorStop(1, '#121a3e');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, STAGE_W, STAGE_H);

    // far cave wall: stalactites and faint rock strata
    ctx.save();
    cam.apply(ctx, 0.35);
    ctx.fillStyle = '#0c1130';
    for (let i = 0; i < 30; i++) {
      const x = i * 160 - 200;
      const h = 120 + hash(i * 4) * 220;
      ctx.beginPath();
      ctx.moveTo(x, -10);
      ctx.lineTo(x + 70, h);
      ctx.lineTo(x + 140, -10);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(110,121,184,0.12)';
    ctx.lineWidth = 3;
    for (let k = 0; k < 5; k++) {
      ctx.beginPath();
      for (let x = -200; x < W; x += 60) ctx.lineTo(x, 380 + k * 70 + Math.sin(x * 0.004 + k) * 24);
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    cam.apply(ctx, 1);
    // stone floor
    ctx.fillStyle = '#1a2148';
    ctx.beginPath();
    ctx.moveTo(-200, STAGE_H);
    for (let x = -200; x <= W + 200; x += 40) ctx.lineTo(x, FLOOR - 4 + Math.sin(x * 0.02) * 4);
    ctx.lineTo(W + 200, STAGE_H);
    ctx.fill();
    this.drawStairs(ctx, 160);
    this.drawGuards(ctx, 560, t);
    this.drawBells(ctx, 900, t);
    this.drawIce(ctx, 1080, t);
    this.drawGarden(ctx, 1300, t);
    this.drawPool(ctx, 1650, t);
    this.drawJars(ctx, 1980, t);
    this.drawHush(ctx, this.hushX, t);
    this.drawShoulds(ctx, 2560, t);
    this.drawMusicBox(ctx, 2840, t);
    this.drawChain(ctx, 3060, t);
    this.drawVault(ctx, VAULT_X, t);
    this.drawActors(ctx);
    this.drawEffects(ctx);
    this.particles.render(ctx);
    ctx.restore();

    this.drawDarkness(ctx);
    ctx.save();
    cam.apply(ctx, 1);
    this.drawLabels(ctx);
    ctx.restore();
    this.drawKeys(ctx);
    this.drawMoodLight(ctx);
    ctx.save();
    cam.apply(ctx, 1);
    this.drawBarks(ctx);
    this.drawPrompt(ctx);
    ctx.restore();
  }

  private toScreen(x: number, y: number) {
    const c = this.camera;
    return { x: (x - c.x) * c.zoom + STAGE_W / 2, y: (y - c.y) * c.zoom + STAGE_H / 2 };
  }

  /** Darkness with holes cut out for the lantern and anything that glows by itself. */
  private drawDarkness(ctx: Ctx) {
    if (!this.dark) {
      this.dark = document.createElement('canvas');
      this.dark.width = STAGE_W / 2;
      this.dark.height = STAGE_H / 2;
    }
    const d = this.dark.getContext('2d')!;
    d.setTransform(0.5, 0, 0, 0.5, 0, 0);
    d.globalCompositeOperation = 'source-over';
    d.clearRect(0, 0, STAGE_W, STAGE_H);
    d.fillStyle = 'rgba(3,4,16,0.86)';
    d.fillRect(0, 0, STAGE_W, STAGE_H);
    d.globalCompositeOperation = 'destination-out';
    const hole = (x: number, y: number, r: number, a = 1) => {
      const p = this.toScreen(x, y);
      const gr = d.createRadialGradient(p.x, p.y, r * 0.2, p.x, p.y, r);
      gr.addColorStop(0, `rgba(0,0,0,${a})`);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      d.fillStyle = gr;
      d.fillRect(p.x - r, p.y - r, r * 2, r * 2);
    };
    const st = useGame.getState();
    const a = st.active;
    const flicker = a === 'anger' ? Math.sin(this.time * 17) * 20 + Math.sin(this.time * 7) * 14 : a === 'fear' ? Math.sin(this.time * 9) * 10 : 0;
    const p = this.player;
    hole(p.x, p.y - 80, LANTERN[a] + flicker);
    hole(160, FLOOR - 250, 260, 0.8); // light spilling down the stairs
    if (this.garden > 0) hole(1300, FLOOR - 100, 300 * this.garden, 0.9);
    if (this.vaultOpen > 0) hole(VAULT_X, FLOOR - 230, 380 * this.vaultOpen, 0.95);
    if (this.flag('subKeySad')) hole(1650, FLOOR - 60, 160, 0.6);
    if (this.bellT > 0) hole(900, FLOOR - 340, 200 * this.bellT * 0.5, 0.8);
    hole(this.hushX, FLOOR - 220, 90, 0.35); // the Hush's eyes glow faintly
    for (const r of this.reveal) hole(r.x, FLOOR - 120, 260 * Math.min(1, r.t), 0.9);
    for (const e of this.effects) if (e.kind === 'scan') hole(e.x + 300 * e.dir * (e.t / e.dur), e.y, 220, 0.9);
    ctx.drawImage(this.dark, 0, 0, STAGE_W, STAGE_H);
    // a coloured rim to the lantern so each emotion's light feels different
    const sp = this.toScreen(p.x, p.y - 80);
    glow(ctx, sp.x, sp.y, LANTERN[a] * 0.9, EMOTIONS[a].color, 0.12);
  }

  /** Landmark names float above the dark so the cave can be navigated; nearer ones read brighter. */
  private drawLabels(ctx: Ctx) {
    const marks: [string, number, number, string][] = [
      ['Up to The Fading', 160, FLOOR - 450, '#cfc8dc'],
      ['Bram & Bolt', 560, FLOOR - 250, '#a7b0d6'],
      ['Echo bells', 900, FLOOR - 500, '#B9A7F5'],
      ['Dark garden', 1300, FLOOR - 220, '#B4F7E0'],
      ['Murmuring pool', 1650, FLOOR - 120, '#BBD2FF'],
      ['Worry jars', 1980, FLOOR - 360, '#C9A6F5'],
      ['The Hush', this.hushX, FLOOR - 330 * (this.flag('subHushMet') ? 0.85 : 1), '#8C93B8'],
      [this.flag('subShoulds') ? 'Empty (good)' : '“Shoulds”', 2560, FLOOR - 240, '#C2F0CC'],
      [this.flag('subChain') ? 'Broken chain' : '“It doesn’t matter”', 3060, FLOOR - 450, '#d8d4ea'],
      ['The Closed Door', VAULT_X, FLOOR - 480, '#B9A7F5'],
    ];
    const px = this.player.x;
    for (const [text, x, y, col] of marks) {
      ctx.globalAlpha = clamp(1 - (Math.abs(x - px) - 250) / 900, 0.4, 1);
      signText(ctx, text, x, y, 16, col);
    }
    ctx.globalAlpha = 1;
  }

  private drawKeys(ctx: Ctx) {
    const x0 = STAGE_W / 2 - 150;
    const y = 70;
    ctx.fillStyle = 'rgba(12,7,38,0.6)';
    roundRect(ctx, x0, y - 28, 300, 56, 28);
    ctx.fill();
    ctx.fillStyle = '#d8d4ea';
    ctx.font = `800 15px ${FONT_DISPLAY}`;
    ctx.textAlign = 'left';
    ctx.fillText(this.flag('vaultOpened') ? 'Door opened' : 'Closed Door', x0 + 22, y + 5);
    KEYS.forEach((k, i) => {
      const got = this.flag(k.flag) || this.flag('vaultOpened');
      const cx = x0 + 170 + i * 42;
      circle(ctx, cx, y, 15, got ? EMOTIONS[k.emotion].color : 'rgba(255,255,255,0.08)');
      ctx.strokeStyle = EMOTIONS[k.emotion].color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, y, 15, 0, TAU);
      ctx.stroke();
    });
  }

  private drawStairs(ctx: Ctx, x: number) {
    for (let k = 0; k < 9; k++) {
      ctx.fillStyle = k % 2 ? '#2a3260' : '#232a55';
      ctx.fillRect(x - 100 + k * 8, FLOOR - (k + 1) * 46, 200 - k * 16, 46);
    }
    ctx.fillStyle = 'rgba(220,220,240,0.25)';
    ctx.fillRect(x - 40, 0, 80, FLOOR - 414);
    
  }

  private drawGuards(ctx: Ctx, x: number, t: number) {
    const sleepy = this.snore > 0 || Math.sin(t * 0.3) > -0.6;
    for (const [i, dx] of [[0, -80], [1, 80]] as const) {
      const bx = x + dx;
      const breathe = Math.sin(t * 1.2 + i) * 3;
      ctx.fillStyle = i ? '#4a5280' : '#3e4672';
      ctx.beginPath();
      ctx.moveTo(bx - 70, FLOOR);
      ctx.quadraticCurveTo(bx - 80, FLOOR - 170 - breathe, bx, FLOOR - 190 - breathe);
      ctx.quadraticCurveTo(bx + 80, FLOOR - 170 - breathe, bx + 70, FLOOR);
      ctx.fill();
      // moss caps
      ellipse(ctx, bx, FLOOR - 186 - breathe, 46, 14, '#3f7a5c');
      // faces: closed eyes when sleepy
      ctx.strokeStyle = '#1a1f3e';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      for (const ex of [-20, 20]) {
        ctx.beginPath();
        if (sleepy) ctx.arc(bx + ex, FLOOR - 120 - breathe, 9, 0.2, Math.PI - 0.2);
        else ctx.arc(bx + ex, FLOOR - 120 - breathe, 7, 0, TAU);
        ctx.stroke();
      }
      ellipse(ctx, bx, FLOOR - 88 - breathe, 12, sleepy ? 4 : 8, '#1a1f3e');
      if (sleepy) {
        ctx.fillStyle = 'rgba(207,200,220,0.7)';
        ctx.font = `800 ${18 + ((t * 0.7 + i * 0.5) % 1) * 12}px ${FONT_DISPLAY}`;
        ctx.textAlign = 'center';
        ctx.fillText('z', bx + 50 + ((t * 0.7 + i * 0.5) % 1) * 30, FLOOR - 200 - ((t * 0.7 + i * 0.5) % 1) * 60);
      }
    }
    
  }

  private drawBells(ctx: Ctx, x: number, t: number) {
    ctx.strokeStyle = '#4a5280';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(x - 110, FLOOR - 470);
    ctx.lineTo(x + 110, FLOOR - 470);
    ctx.stroke();
    for (let i = 0; i < 3; i++) {
      const bx = x - 70 + i * 70;
      const swing = this.bell === i && this.bellT > 0 ? Math.sin(t * 14) * 0.4 * (this.bellT / 2) : Math.sin(t * 0.8 + i) * 0.04;
      ctx.save();
      ctx.translate(bx, FLOOR - 470);
      ctx.rotate(swing);
      ctx.strokeStyle = '#6E79B8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, 60 + i * 30);
      ctx.stroke();
      ctx.translate(0, 60 + i * 30);
      ctx.fillStyle = ['#8C93B8', '#B9A7F5', '#7FC8FF'][i];
      ctx.beginPath();
      ctx.moveTo(-22, 50);
      ctx.quadraticCurveTo(-22, 0, 0, 0);
      ctx.quadraticCurveTo(22, 0, 22, 50);
      ctx.closePath();
      ctx.fill();
      circle(ctx, 0, 54, 6, '#2a3260');
      if (this.bell === i && this.bellT > 0) {
        ctx.strokeStyle = rgba('#B9A7F5', this.bellT / 2);
        ctx.lineWidth = 3;
        for (let k = 0; k < 3; k++) {
          ctx.beginPath();
          ctx.arc(0, 30, 30 + k * 26 + (2 - this.bellT) * 40, 0, TAU);
          ctx.stroke();
        }
      }
      ctx.restore();
    }
    
  }

  private drawIce(ctx: Ctx, x: number, t: number) {
    ctx.fillStyle = 'rgba(160,210,255,0.25)';
    ctx.beginPath();
    ctx.ellipse(x, FLOOR + 6, 110, 18, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(200,230,255,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 80, FLOOR + 2);
    ctx.lineTo(x - 20, FLOOR + 10);
    ctx.lineTo(x + 10, FLOOR - 2);
    ctx.lineTo(x + 70, FLOOR + 8);
    ctx.stroke();
    ellipse(ctx, x + 5, FLOOR + 6, 18, 6, '#111');
    if (this.hasFear('fear-hockey')) glow(ctx, x, FLOOR, 60 + Math.sin(t * 2) * 6, '#A05CF0', 0.4);
  }

  private drawGarden(ctx: Ctx, x: number, t: number) {
    for (let i = 0; i < 14; i++) {
      const px = x - 200 + i * 30 + hash(i) * 10;
      const h = 60 + hash(i * 7) * 90;
      ctx.strokeStyle = '#2f5a4c';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(px, FLOOR);
      ctx.quadraticCurveTo(px + Math.sin(t + i) * 10, FLOOR - h / 2, px + Math.sin(t * 0.7 + i) * 6, FLOOR - h);
      ctx.stroke();
      const lit = this.garden * clamp(1 - i / 20, 0.4, 1);
      const col = ['#FFE45E', '#B4F7E0', '#FF7FB0'][i % 3];
      if (lit > 0) glow(ctx, px, FLOOR - h, 28 * lit, col, 0.6 * lit);
      circle(ctx, px, FLOOR - h, 9, lit > 0 ? col : '#24304f');
    }
  }

  private drawPool(ctx: Ctx, x: number, t: number) {
    const gr = ctx.createRadialGradient(x, FLOOR + 6, 10, x, FLOOR + 6, 170);
    gr.addColorStop(0, '#3D7BFF');
    gr.addColorStop(1, '#0d1638');
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.ellipse(x, FLOOR + 6, 170, 26, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(187,210,255,0.5)';
    ctx.lineWidth = 2;
    for (let k = 0; k < 3; k++) {
      const r = ((t * 30 + k * 50) % 150) + 10;
      ctx.globalAlpha = 1 - r / 160;
      ctx.beginPath();
      ctx.ellipse(x, FLOOR + 6, r, r * 0.15, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    if (this.poolTalk > 0) {
      ctx.fillStyle = `rgba(187,210,255,${Math.min(0.8, this.poolTalk / 3)})`;
      ctx.font = `italic 600 16px ${FONT_DISPLAY}`;
      ctx.textAlign = 'center';
      const words = ['miss', 'home', 'stairs', 'okay?', 'both', 'true'];
      words.forEach((w, i) => ctx.fillText(w, x - 120 + i * 48, FLOOR - 40 - Math.sin(t * 2 + i) * 12 - i * 4));
    }
    if (this.flag('subKeySad')) memoryOrb(ctx, x, FLOOR - 80 + Math.sin(t * 1.5) * 6, 10, '#3D7BFF', { glowAmt: 0.8 });
  }

  private drawJars(ctx: Ctx, x: number, t: number) {
    ctx.fillStyle = '#2a3260';
    ctx.fillRect(x - 140, FLOOR - 200, 280, 12);
    ctx.fillRect(x - 140, FLOOR - 330, 280, 12);
    ctx.fillRect(x - 136, FLOOR - 330, 10, 330);
    ctx.fillRect(x + 126, FLOOR - 330, 10, 330);
    for (let row = 0; row < 2; row++) {
      for (let i = 0; i < 5; i++) {
        const jx = x - 104 + i * 52;
        const jy = FLOOR - 200 - row * 130;
        const rattle = Math.sin(t * (8 + i) + row) * (this.flag('subKeyFear') && row === 0 && i === 2 ? 0 : 1.6);
        ctx.save();
        ctx.translate(jx + rattle, jy);
        ctx.fillStyle = 'rgba(180,200,255,0.18)';
        roundRect(ctx, -18, -56, 36, 56, 8);
        ctx.fill();
        ctx.strokeStyle = 'rgba(180,200,255,0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#6E79B8';
        ctx.fillRect(-20, -62, 40, 8);
        const empty = this.flag('subKeyFear') && row === 0 && i === 2;
        if (!empty) circle(ctx, 0, -24, 8 + Math.sin(t * 3 + i) * 2, rgba('#A05CF0', 0.7));
        if (this.flag('subKeyFear')) {
          ctx.fillStyle = '#fff4c2';
          ctx.fillRect(-14, -40, 28, 10);
        }
        ctx.restore();
      }
    }
    
  }

  private drawHush(ctx: Ctx, x: number, t: number) {
    const shy = this.hushShy > 0 ? 0.75 : 1;
    const met = this.flag('subHushMet');
    const s = (met ? 0.85 : 1) * shy;
    const y = FLOOR;
    ctx.save();
    ctx.globalAlpha = 0.85;
    const gr = ctx.createLinearGradient(x, y - 300 * s, x, y);
    gr.addColorStop(0, '#2b3470');
    gr.addColorStop(1, 'rgba(20,26,62,0.2)');
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.moveTo(x - 120 * s, y);
    for (let k = 0; k <= 12; k++) {
      const a = Math.PI + (k / 12) * Math.PI;
      const r = (130 + Math.sin(t * 1.5 + k) * 8) * s;
      ctx.lineTo(x + Math.cos(a) * r, y - 120 * s + Math.sin(a) * r * 1.4);
    }
    ctx.lineTo(x + 120 * s, y);
    ctx.fill();
    ctx.restore();
    const blink = Math.sin(t * 0.9) > 0.96 ? 0.15 : 1;
    for (const ex of [-28, 28]) {
      glow(ctx, x + ex * s, y - 220 * s, 26, '#cfd6ff', 0.4);
      ellipse(ctx, x + ex * s, y - 220 * s, 10 * s, 14 * s * blink, '#e6e9ff');
    }
    
  }

  private drawShoulds(ctx: Ctx, x: number, t: number) {
    const done = this.flag('subShoulds');
    ctx.fillStyle = 'rgba(200,220,200,0.18)';
    roundRect(ctx, x - 60, FLOOR - 200, 120, 200, 18);
    ctx.fill();
    ctx.strokeStyle = 'rgba(194,240,204,0.5)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#52C46B';
    ctx.fillRect(x - 64, FLOOR - 214, 128, 18);
    if (!done) {
      for (let i = 0; i < 18; i++) {
        ctx.save();
        ctx.translate(x - 40 + (i % 5) * 20, FLOOR - 20 - Math.floor(i / 5) * 40);
        ctx.rotate(hash(i) - 0.5 + Math.sin(t + i) * 0.05);
        ctx.fillStyle = '#fff4c2';
        ctx.fillRect(-14, -8, 28, 16);
        ctx.restore();
      }
    }
    
  }

  private drawMusicBox(ctx: Ctx, x: number, t: number) {
    ctx.fillStyle = '#7a4a2a';
    roundRect(ctx, x - 26, FLOOR - 36, 52, 36, 6);
    ctx.fill();
    ctx.fillStyle = '#a06a3a';
    ctx.save();
    ctx.translate(x - 26, FLOOR - 36);
    ctx.rotate(-0.5);
    ctx.fillRect(0, -6, 52, 6);
    ctx.restore();
    ctx.fillStyle = 'rgba(255,229,138,0.7)';
    ctx.font = `800 18px ${FONT_DISPLAY}`;
    ctx.textAlign = 'center';
    ctx.fillText('♪', x + Math.sin(t * 2) * 10, FLOOR - 60 - ((t * 20) % 40));
  }

  private drawChain(ctx: Ctx, x: number, t: number) {
    ctx.fillStyle = '#2a3260';
    ctx.fillRect(x - 14, FLOOR - 420, 28, 420);
    const broken = this.flag('subChain');
    ctx.strokeStyle = broken ? '#6a4a4a' : '#9aa0b8';
    ctx.lineWidth = 6;
    for (let k = 0; k < 9; k++) {
      const yy = FLOOR - 380 + k * 34;
      const off = broken ? (k > 4 ? 40 + k * 6 : -20 - k * 3) : Math.sin(t + k) * 2;
      ctx.beginPath();
      ctx.ellipse(x + off, yy, 26, 12, broken ? k * 0.3 : 0.1, 0, TAU);
      ctx.stroke();
    }
    
  }

  private drawVault(ctx: Ctx, x: number, t: number) {
    const o = this.vaultOpen;
    ctx.fillStyle = '#20285a';
    ctx.beginPath();
    ctx.arc(x, FLOOR - 230, 230, Math.PI, TAU);
    ctx.lineTo(x + 230, FLOOR);
    ctx.lineTo(x - 230, FLOOR);
    ctx.fill();
    // the door itself swings aside
    const doorX = x - 170 * o;
    ctx.save();
    ctx.translate(doorX, FLOOR - 200);
    ctx.scale(1 - o * 0.7, 1);
    ctx.fillStyle = '#3a4272';
    ctx.beginPath();
    ctx.arc(0, 0, 180, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#6E79B8';
    ctx.lineWidth = 8;
    ctx.stroke();
    KEYS.forEach((k, i) => {
      const got = this.flag(k.flag) || this.flag('vaultOpened');
      const kx = -70 + i * 70;
      circle(ctx, kx, 0, 22, got ? EMOTIONS[k.emotion].color : '#141a3e');
      if (got) glow(ctx, kx, 0, 46, EMOTIONS[k.emotion].color, 0.5 + Math.sin(t * 3 + i) * 0.1);
    });
    ctx.restore();
    if (o > 0) {
      glow(ctx, x, FLOOR - 220, 260 * o, '#3D7BFF', 0.6 * o);
      memoryOrb(ctx, x, FLOOR - 220 + Math.sin(t * 1.4) * 8, 46 * o, '#3D7BFF', { t, glowAmt: 1 });
    }
    
  }
}
