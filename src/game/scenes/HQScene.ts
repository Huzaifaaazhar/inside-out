import { STAGE_H } from '../../engine/camera';
import type { Ctx } from '../../engine/draw';
import { memoryOrb } from '../../engine/draw';
import { clamp, damp, easeInOutCubic, lerp } from '../../engine/math';
import { isBlocking, useGame } from '../../state/store';
import {
  CONSOLE_X,
  HQ_FLOOR,
  HQ_W,
  SCREEN,
  drawBackWall,
  drawBadIdea,
  drawBalconyDoor,
  drawCable,
  drawConsole,
  drawCoreHolder,
  drawCouch,
  drawDayShelves,
  drawFloor,
  drawForeground,
  drawLamp,
  drawManual,
  drawRecallTube,
  screenFrame,
} from '../art/hq';
import { drawArtRoom, drawHallway, drawMural } from '../art/screen';
import type { EmotionId } from '../content/emotions';
import { EMOTIONS, EMOTION_ORDER } from '../content/emotions';
import { INTRO, MANUAL_PAGES, NPC_TALK, SHELF_TALK, resolveLines } from '../content/talk';
import type { MemoryDef } from '../content/world';
import type { Game } from '../Game';
import { ART_CLUB, TONE_LABEL } from '../scenario/artClub';
import type { Minigame } from '../scenario/minigames';
import { createMinigame } from '../scenario/minigames';
import { Actor, WorldScene } from '../WorldScene';

const HOMES: Record<EmotionId, number> = { joy: 1560, sadness: 860, anger: 1990, fear: 2330, disgust: 2640 };
const CONSOLE_SLOTS: Record<EmotionId, number> = { joy: 1300, sadness: 1410, anger: 1960, fear: 2080, disgust: 1190 };
const OPERATOR_X = 1585;
const TUBE_X = 260;
const HOLDER_X = 1010;
const MANUAL_X = 1180;
const COUCH_X = 2190;
const LAMP_X = 2420;
const CABLE_X = 2560;
const DOOR_X = 3120;

export class HQScene extends WorldScene {
  readonly id = 'hq' as const;
  worldW = HQ_W;
  floorY = HQ_FLOOR;

  private needle = 0;
  private pulse = 0;
  private engaged = 0;
  private lamp = 0;
  private cableMark = 0;
  private bad = { x: 2780, y: 400, vx: 0, vy: 0, alpha: 1, flying: false };
  private door = 0;
  private doorShake = 0;
  private minigame: Minigame | null = null;
  private consoleMode = false;
  private lastProgress = -1;
  private talkIdx: Record<string, number> = {};
  private orbFx: { phase: 'rise' | 'fly' | 'slot'; t: number; from: [number, number]; to: [number, number]; mem: MemoryDef } | null = null;
  private screenFlash = 0;
  /** Ignore the primary button briefly after "choose" opens, so the key that closed dialogue doesn't fire it. */
  private chooseGrace = 0;
  private screenView: 'hallway' | 'artroom' | 'mural' = 'hallway';

  constructor(game: Game) {
    super(game);
    this.actors = EMOTION_ORDER.map((id, i) => new Actor(id, HOMES[id], HQ_FLOOR, i * 3 + 1));
    this.buildInteractables();
  }

  enter(spawn?: number) {
    super.enter(spawn);
    const st = useGame.getState();
    this.game.audio.setMood(st.active);
    if (st.flags.doorOpen) this.door = 1;
    if (st.flags.lamp) this.lamp = 1;
    if (st.flags.badIdea) this.bad.alpha = 0;
    if (!st.flags.introDone) {
      // stage the team for the welcome
      const lineup: EmotionId[] = ['disgust', 'fear', 'joy', 'sadness', 'anger'];
      lineup.forEach((id, i) => {
        const a = this.actors.find((x) => x.id === id)!;
        a.x = 1320 + i * 110;
        a.targetX = null;
        a.state.facing = 1;
      });
      this.player.x = 1540;
      this.camera.targetX = 1540;
      this.camera.snap();
      this.later(2.8, () => this.runIntro());
    }
  }

  // ─────────────────────────── intro & objectives ───────────────────────────
  private runIntro() {
    const st = useGame.getState();
    if (st.flags.introDone || st.dialogue) return;
    st.say(INTRO, () => {
      const s = useGame.getState();
      s.setFlag('introDone');
      s.setObjective('select');
      for (const a of this.actors) if (a !== this.player) a.targetX = a.homeX;
    });
  }

  // ─────────────────────────── interactables ───────────────────────────
  private buildInteractables() {
    const store = () => useGame.getState();
    const say = (text: string, dur = 3) => this.player.say(text, dur);

    this.interactables.push({
      id: 'tube',
      x: TUBE_X,
      y: HQ_FLOOR - 230,
      range: 120,
      hit: { x: TUBE_X - 100, y: 90, w: 200, h: HQ_FLOOR - 90 },
      label: () => 'Ride the tube to Long-Term Memory',
      interact: () => store().travel('memory', 'tube', 230),
      abilities: {
        fear: () => say('It’s a pneumatic tube. To a place called Long-Term. What could go wrong. Everything.'),
      },
    });

    this.interactables.push({
      id: 'shelves',
      x: 700,
      y: 320,
      range: 190,
      hit: { x: 480, y: 360, w: 440, h: 300 },
      label: () => 'Look at today’s memories',
      interact: () => say(SHELF_TALK[store().active], 3.4),
      abilities: {
        joy: () => {
          say('Shine, little memories, shine!');
          this.particles.emit({ x: 700, y: 520, count: 40, color: ['#FFCF33', '#FFF1B0'], shape: 'star', spread: 200, speed: [20, 120] });
        },
        sadness: () => say('They’re all little bits of today. Even the hard parts belong here.', 3.6),
      },
    });

    this.interactables.push({
      id: 'holder',
      x: HOLDER_X,
      y: HQ_FLOOR - 360,
      range: 150,
      hit: { x: HOLDER_X - 150, y: HQ_FLOOR - 340, w: 300, h: 340 },
      label: () => (store().carrying ? 'Place the core memory' : 'Look at the core memories'),
      interact: () => {
        const s = store();
        if (s.carrying) {
          this.placeCore(s.carrying);
          return;
        }
        const filled = s.coreShelf.filter(Boolean) as MemoryDef[];
        s.setInspect({
          kicker: 'Core memories',
          title: `${filled.length} of 5 islands powered`,
          body: filled.map((m) => `${m.title}: ${m.text}`).join('\n'),
          color: '#FFCF33',
          extra: s.islands.friendship ? undefined : 'One slot is empty. Friendship Island has been dark since Riley moved.',
        });
      },
    });

    this.interactables.push({
      id: 'manual',
      x: MANUAL_X,
      y: HQ_FLOOR - 190,
      range: 90,
      hit: { x: MANUAL_X - 60, y: HQ_FLOOR - 180, w: 120, h: 180 },
      label: () => 'Read the Mind Manual',
      interact: () => store().say(MANUAL_PAGES),
    });

    this.interactables.push({
      id: 'console',
      x: CONSOLE_X - 60,
      y: 470,
      range: 200,
      hit: { x: CONSOLE_X - 360, y: 520, w: 720, h: 250 },
      label: () => {
        const s = store();
        if (!s.flags.introDone) return null;
        return s.flags.scenarioDone ? 'Look through Riley’s eyes' : 'Take the console';
      },
      interact: () => {
        const s = store();
        if (s.flags.scenarioDone) {
          s.say([
            { speaker: 'riley', text: '(Riley is walking home with paint on her sleeve, humming.)' },
            { speaker: s.active, text: EMOTIONS[s.active].tagIn[0] },
            { speaker: 'console', text: 'More of Riley’s day is coming soon.' },
          ]);
          return;
        }
        this.enterConsole();
      },
      abilities: {
        fear: () => say('Console: operational. Screen: suspiciously calm.'),
        anger: () => say('Do NOT stomp near the console. Even I know that.'),
      },
    });

    this.interactables.push({
      id: 'couch',
      x: COUCH_X,
      y: HQ_FLOOR - 140,
      range: 110,
      hit: { x: COUCH_X - 150, y: HQ_FLOOR - 130, w: 300, h: 130 },
      label: () => 'Sit on the couch',
      interact: () => {
        const lines: Record<EmotionId, string> = {
          joy: 'Boing! Best couch. Five stars.',
          sadness: 'I could just... lie here. For a while.',
          anger: 'This cushion has a lump. I will find who did this.',
          fear: 'What if it’s a trap couch?',
          disgust: 'Someone ate crisps on here. I can feel it.',
        };
        const p = this.player;
        p.setPose(p.id === 'sadness' ? 'slump' : p.id === 'joy' ? 'cheer' : 'idle', 1.5);
        say(lines[p.id]);
      },
    });

    this.interactables.push({
      id: 'lamp',
      x: LAMP_X,
      y: HQ_FLOOR - 290,
      range: 120,
      hit: { x: LAMP_X - 60, y: HQ_FLOOR - 290, w: 140, h: 290 },
      label: () => (store().flags.lamp ? 'Admire the lamp' : 'Switch on the lamp'),
      interact: () => {
        if (store().flags.lamp) return say('Cosy. Joy really did that.');
        this.game.audio.tick();
        say('Click. Nothing. HQ has been a bit dim since the move. It needs a brighter touch.', 3.6);
        if (store().active !== 'joy') this.hint('Joy’s Bright Side (Q) lights up things that have gone dim.', 'joy');
      },
      abilities: {
        joy: () => {
          const s = store();
          if (s.flags.lamp) return say('Already glowing! Just like me.');
          s.setFlag('lamp');
          this.game.audio.chime(4);
          this.particles.emit({ x: LAMP_X + 10, y: HQ_FLOOR - 250, count: 50, color: ['#FFCF33', '#FFF1B0', '#ffffff'], shape: 'star', speed: [60, 260] });
          say('Let there be light! And there was light. Because of me.');
          s.showToast('Joy brightened the reading lamp', EMOTIONS.joy.color);
        },
      },
    });

    this.interactables.push({
      id: 'cable',
      x: CABLE_X,
      y: HQ_FLOOR - 30,
      range: 170,
      hit: { x: CABLE_X - 170, y: HQ_FLOOR - 40, w: 340, h: 110 },
      label: () => (store().flags.cable ? null : 'Check the floor'),
      interact: () => {
        if (store().active === 'fear') say('THAT is a trip hazard. Let me scan it properly. Press Q!');
        else {
          say('Just a cable. Probably fine.');
          this.hint('Fear’s Scan (Q) finds hazards other people walk straight past.', 'fear');
        }
      },
      abilities: {
        fear: () => {
          const s = store();
          if (s.flags.cable) return;
          this.cableMark = 0.01;
          say('Hazard detected! Securing... securing...', 2);
          this.later(1.4, () => {
            useGame.getState().setFlag('cable');
            this.game.audio.success();
            this.player.say('Taped down. Nobody trips on my watch.');
            useGame.getState().showToast('Fear made the floor safe', EMOTIONS.fear.color);
          });
        },
      },
    });

    this.interactables.push({
      id: 'badidea',
      x: 2780,
      y: 330,
      range: 200,
      abilityRange: 460,
      hit: { x: 2700, y: 320, w: 160, h: 160 },
      label: () => (store().flags.badIdea ? null : 'Poke the bad idea'),
      interact: () => {
        this.game.audio.pop();
        this.bad.vy = -60;
        if (store().active === 'disgust') say('Ugh. This is beneath me. And yet. Press Q to get rid of it.');
        else {
          say('It’s sticky. And it’s whispering about glue.');
          this.hint('Disgust’s Nope (Q) rejects things that cross a line.', 'disgust');
        }
      },
      abilities: {
        disgust: () => {
          const s = store();
          if (s.flags.badIdea) return;
          s.setFlag('badIdea');
          this.bad.flying = true;
          this.bad.vx = 900;
          this.bad.vy = -500;
          say('Nope. Out. Bye.');
          s.showToast('Disgust rejected a bad idea', EMOTIONS.disgust.color);
        },
        joy: () => say('Glue can be... a fun snack? No. No, it can’t.'),
      },
    });

    this.interactables.push({
      id: 'door',
      x: DOOR_X,
      y: HQ_FLOOR - 350,
      range: 140,
      hit: { x: DOOR_X - 100, y: HQ_FLOOR - 320, w: 200, h: 320 },
      label: () => (store().flags.doorOpen ? 'Go out to Personality Islands' : 'Open the balcony door'),
      interact: () => {
        const s = store();
        if (s.flags.doorOpen) {
          s.travel('islands', 'glide', 260);
          return;
        }
        this.doorShake = 1;
        this.game.audio.thud();
        if (s.active === 'anger') say('Jammed, huh? Stand back. Press Q.');
        else {
          say('It’s jammed! It needs somebody with a bit more... force.');
          this.hint('Anger’s Stand Up (Q) breaks through things that are stuck.', 'anger');
        }
      },
      abilities: {
        anger: () => {
          const s = store();
          if (s.flags.doorOpen) return say('Door’s open. You’re welcome. Again.');
          s.setFlag('doorOpen');
          this.camera.shake(22);
          this.game.audio.thud();
          this.particles.emit({ x: DOOR_X, y: HQ_FLOOR - 150, count: 50, color: ['#F0412D', '#FFB13B'], shape: 'ember', speed: [150, 500] });
          say('BAM. Stuck no more.');
          s.showToast('Anger forced the balcony door open', EMOTIONS.anger.color);
        },
      },
    });

    // talk to the other emotions
    for (const a of this.actors) {
      this.interactables.push({
        id: `npc-${a.id}`,
        x: a.x,
        y: a.headY() - 20,
        range: 100,
        hit: { x: a.x - 50, y: a.headY(), w: 100, h: HQ_FLOOR - a.headY() },
        label: () => (a === this.player || this.consoleMode ? null : `Talk to ${EMOTIONS[a.id].name}`),
        interact: () => this.talkTo(a),
        abilities: {
          sadness: () => {
            if (a === this.player) return;
            a.say(NPC_TALK[a.id].hidden, 4.2);
            a.setPose('slump', 1.5);
          },
          joy: () => {
            if (a === this.player) return;
            a.setPose('cheer', 1.2);
          },
        },
        abilityRange: 260,
        priority: -1,
      });
    }
  }

  private hint(text: string, emotion: EmotionId) {
    this.later(1.2, () => useGame.getState().showToast(`Hint: ${text}`, EMOTIONS[emotion].color));
  }

  private talkTo(a: Actor) {
    const s = useGame.getState();
    const pool = s.flags.scenarioDone ? NPC_TALK[a.id].post : NPC_TALK[a.id].pre;
    const k = `${a.id}-${s.flags.scenarioDone ? 1 : 0}`;
    const idx = this.talkIdx[k] ?? 0;
    this.talkIdx[k] = (idx + 1) % pool.length;
    a.state.facing = this.player.x > a.x ? 1 : -1;
    this.game.audio.voice(a.id);
    s.say(resolveLines(pool[idx], s.active));
  }

  // ─────────────────────────── abilities with crowd reactions ───────────────────────────
  useAbility() {
    super.useAbility();
    const p = this.player;
    for (const a of this.actors) {
      if (a === p || Math.abs(a.x - p.x) > 520) continue;
      if (p.id === 'anger') a.setPose(a.id === 'fear' ? 'scared' : a.id === 'sadness' ? 'slump' : 'idle', 1);
      if (p.id === 'joy' && a.id !== 'disgust') a.setPose(a.id === 'sadness' ? 'idle' : 'cheer', 1);
      if (p.id === 'fear' && a.id === 'fear') a.setPose('scared', 1);
    }
  }

  onEmotionChanged(prev: EmotionId, next: EmotionId) {
    const nextActor = this.actors.find((a) => a.id === next)!;
    const prevActor = this.actors.find((a) => a.id === prev)!;
    const slot = nextActor.homeX;
    super.onEmotionChanged(prev, next);
    if (this.consoleMode) {
      prevActor.homeX = slot;
      prevActor.targetX = slot;
      nextActor.x = OPERATOR_X;
      nextActor.state.facing = 1;
      if (useGame.getState().consoleStage === 'choose') this.updateChooseUI();
    }
  }

  // ─────────────────────────── console & scenario ───────────────────────────
  private enterConsole() {
    const s = useGame.getState();
    this.consoleMode = true;
    this.locked = true;
    this.game.audio.chime(0);
    const p = this.player;
    p.targetX = OPERATOR_X;
    for (const a of this.actors) {
      if (a === p) continue;
      a.homeX = CONSOLE_SLOTS[a.id];
      a.targetX = a.homeX;
    }
    if (s.objective === 'select' || s.objective === 'console') s.setObjective('scenario');
    if (s.beat === 0 && !s.flags.scenarioIntro) {
      s.setConsole('intro');
      s.say(ART_CLUB.intro, () => {
        useGame.getState().setFlag('scenarioIntro');
        this.runSituation();
      });
    } else this.runSituation();
  }

  exitConsole() {
    const s = useGame.getState();
    this.consoleMode = false;
    this.locked = false;
    this.minigame = null;
    s.setMinigame(null);
    s.setConsole('off');
    for (const a of this.actors) {
      a.homeX = HOMES[a.id];
      if (a !== this.player) a.targetX = a.homeX;
    }
  }

  /** Called from the UI's "Step away" button. */
  leaveConsole() {
    if (!this.consoleMode) return;
    const st = useGame.getState().consoleStage;
    if (st !== 'choose') return;
    this.exitConsole();
    this.player.say('We’ll come back to it. Riley can wait a sec.');
  }

  private runSituation() {
    const s = useGame.getState();
    const beat = ART_CLUB.beats[s.beat];
    this.screenView = 'artroom';
    this.screenFlash = 1;
    this.game.audio.whoosh(true);
    s.setConsole('situation');
    s.say(beat.situation, () => {
      this.chooseGrace = 0.35;
      useGame.getState().setConsole('choose');
      this.updateChooseUI();
    });
  }

  private updateChooseUI() {
    const s = useGame.getState();
    const E = EMOTIONS[s.active];
    s.setMinigame({ emotion: s.active, title: ART_CLUB.beats[s.beat].title, instruction: ART_CLUB.beats[s.beat].prompt, primary: `Use ${E.ability.name}`, mode: 'tap', progress: 0 });
  }

  private startMinigame() {
    const s = useGame.getState();
    const beat = ART_CLUB.beats[s.beat];
    const mg = createMinigame(s.active, beat, this.game.audio, this.particles);
    mg.setRect(SCREEN);
    this.minigame = mg;
    this.lastProgress = -1;
    this.game.audio.ability(s.active);
    this.player.setPose('ability', 1.2);
    s.setConsole('minigame');
    s.setMinigame({ emotion: mg.emotion, title: mg.title, instruction: mg.instruction, primary: mg.primaryLabel, mode: mg.mode, progress: 0 });
  }

  private resolveBeat(mg: Minigame) {
    const s = useGame.getState();
    const beat = ART_CLUB.beats[s.beat];
    const out = beat.outcomes[mg.emotion];
    let tone = out.tone;
    if (tone === 'great' && mg.score < 0.5) tone = 'okay';
    s.pushResult({ beatId: beat.id, emotion: mg.emotion, tone, score: mg.score });
    this.minigame = null;
    s.setMinigame(null);
    s.setConsole('outcome');
    s.showToast(TONE_LABEL[tone], tone === 'great' ? '#FFCF33' : tone === 'okay' ? '#B9A7F5' : '#F0412D');
    // the whole team reacts
    for (const a of this.actors) {
      if (tone === 'great') a.setPose(a.id === 'sadness' ? 'idle' : 'cheer', 1.6);
      else if (tone === 'rough') a.setPose(a.id === 'fear' ? 'scared' : a.id === 'sadness' ? 'slump' : 'idle', 1.6);
    }
    if (tone === 'great') this.game.audio.success();
    const lines = [...out.lines];
    if (mg.score < 0.5 && tone !== 'rough') lines.push({ speaker: mg.emotion, text: 'That came out a bit wobbly. Still counts!' });
    if (tone !== 'great') lines.push({ speaker: 'joy', text: `Not bad! Though maybe ${EMOTIONS[beat.best].name} would have fit that moment best.` });
    s.say(lines, () => {
      const st = useGame.getState();
      if (st.beat + 1 < ART_CLUB.beats.length) {
        st.nextBeat();
        this.runSituation();
      } else this.runFinale();
    });
  }

  private runFinale() {
    const s = useGame.getState();
    s.setConsole('finale');
    this.screenView = 'mural';
    this.screenFlash = 1;
    const counts: Partial<Record<EmotionId, number>> = {};
    s.results.forEach((r) => (counts[r.emotion] = (counts[r.emotion] ?? 0) + 1));
    let top: EmotionId = 'joy';
    for (const id of EMOTION_ORDER) if ((counts[id] ?? 0) > (counts[top] ?? 0)) top = id;
    const swirl = EMOTION_ORDER.filter((id) => counts[id]);
    const mem: MemoryDef = {
      id: 'core-artclub',
      title: 'Cloud cat with Priya',
      emotion: top,
      text: 'First day at art club. A new friend, and a cat made of clouds.',
      hidden: '',
      core: true,
      swirl,
    };
    this.game.audio.coreMemory();
    this.orbFx = { phase: 'rise', t: 0, from: [SCREEN.x + SCREEN.w / 2, SCREEN.y + SCREEN.h / 2], to: [this.player.x, this.player.headY() - 50], mem };
    this.later(2.6, () => {
      useGame.getState().say(ART_CLUB.finale, () => {
        const st = useGame.getState();
        st.setCarrying(mem);
        st.setFlag('scenarioDone');
        st.setObjective('shelve');
        this.orbFx = null;
        this.exitConsole();
      });
    });
  }

  private placeCore(mem: MemoryDef) {
    const s = useGame.getState();
    const slotIndex = s.coreShelf.indexOf(null);
    const a = Math.PI * 1.12 + (Math.max(0, slotIndex) / 4) * Math.PI * 0.76;
    const to: [number, number] = [HOLDER_X + Math.cos(a) * 120, HQ_FLOOR - 160 + Math.sin(a) * 120];
    this.orbFx = { phase: 'slot', t: 0, from: [this.player.x, this.player.headY() - 50], to, mem };
    s.setCarrying(null);
    this.game.audio.chime(5);
    this.later(1.1, () => {
      const st = useGame.getState();
      st.placeCore(mem, 'friendship');
      this.orbFx = null;
      this.game.audio.coreMemory();
      this.particles.emit({ x: to[0], y: to[1], count: 80, color: ['#FFCF33', '#3CC6B8', '#ffffff', EMOTIONS[mem.emotion].color], shape: 'star', speed: [80, 400], life: [0.6, 1.5] });
      this.camera.shake(6);
      for (const actor of this.actors) actor.setPose('cheer', 1.8);
      st.setObjective('islands');
      st.say([
        { speaker: 'joy', text: 'It fits! Did you hear that hum? Friendship Island just woke up!' },
        { speaker: 'fear', text: 'The balcony door is the way out to the islands. It’s jammed. For safety reasons. Probably.' },
        { speaker: 'anger', text: 'Jammed doors are my speciality. Pick me and press Q at the door.' },
      ]);
    });
  }

  // ─────────────────────────── frame update ───────────────────────────
  protected tick(dt: number) {
    const st = useGame.getState();
    const input = this.game.input;
    const t = this.time;
    const activeIdx = EMOTION_ORDER.indexOf(st.active);
    this.needle = damp(this.needle, activeIdx, 5, dt);
    this.pulse = damp(this.pulse, 0, 2, dt);
    this.engaged = damp(this.engaged, this.consoleMode ? 1 : 0, 3, dt);
    this.lamp = damp(this.lamp, st.flags.lamp ? 1 : 0, 3, dt);
    this.door = damp(this.door, st.flags.doorOpen ? 1 : 0, 3, dt);
    this.doorShake = damp(this.doorShake, 0, 4, dt);
    this.screenFlash = damp(this.screenFlash, 0, 3, dt);
    if (this.cableMark > 0 && !st.flags.cable) this.cableMark = Math.min(1, this.cableMark + dt * 3);
    if (!st.flags.scenarioDone && st.consoleStage === 'off' && st.beat === 0 && !st.flags.scenarioIntro) this.screenView = 'hallway';
    if (st.flags.scenarioDone && st.consoleStage === 'off') this.screenView = 'mural';

    // the bad idea drifts, or flies out of the window
    const b = this.bad;
    if (b.flying) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.vy += 200 * dt;
      b.alpha = Math.max(0, b.alpha - dt * 0.8);
    } else if (!st.flags.badIdea) {
      b.vy = damp(b.vy, 0, 2, dt);
      b.x = 2780 + Math.sin(t * 0.5) * 60;
      b.y = 400 + Math.sin(t * 1.1) * 20 + b.vy * 0.2;
    }

    // speakers animate while their line is shown
    const speaker = st.dialogue ? st.dialogue.lines[st.dialogue.index]?.speaker : null;
    for (const a of this.actors) {
      a.state.talking = speaker === a.id;
      if (a !== this.player && !this.consoleMode && !st.dialogue) {
        a.wanderT -= dt;
        if (a.wanderT <= 0 && st.flags.introDone) {
          a.wanderT = 3 + Math.random() * 5;
          a.targetX = a.homeX + (Math.random() - 0.5) * 160;
        }
      }
      // look at whoever is talking, or at the screen while operating
      if (!a.state.moving) {
        const speakerActor = speaker ? this.actors.find((x) => x.id === speaker) : null;
        const lookX = speakerActor && speakerActor !== a ? speakerActor.x : this.consoleMode ? CONSOLE_X : a.x + a.state.facing * 100;
        a.state.look = damp(a.state.look, clamp((lookX - a.x) / 200, -1, 1), 4, dt);
        if (Math.abs(lookX - a.x) > 30 && (speakerActor || this.consoleMode)) a.state.facing = lookX > a.x ? 1 : -1;
      }
      // keep the NPC hitboxes on their actors
      const it = this.interactables.find((i) => i.id === `npc-${a.id}`);
      if (it) {
        it.x = a.x;
        it.y = a.headY() - 20;
        it.hit = { x: a.x - 50, y: a.headY(), w: 100, h: HQ_FLOOR - a.headY() };
      }
    }

    if (this.consoleMode) {
      this.camera.targetX = CONSOLE_X;
      this.camera.targetY = 425;
      this.camera.targetZoom = 1.25;
      if (this.player.targetX === null && Math.abs(this.player.x - OPERATOR_X) > 8) this.player.targetX = OPERATOR_X;
      const blocked = isBlocking(st);
      this.chooseGrace = Math.max(0, this.chooseGrace - dt);
      if (st.consoleStage === 'choose' && !blocked && this.chooseGrace <= 0 && input.primaryPressed()) this.startMinigame();
      if (st.consoleStage === 'minigame' && this.minigame) {
        const mg = this.minigame;
        const w = this.camera.screenToWorld(input.pointer.x, input.pointer.y);
        const u = (w.x - SCREEN.x) / SCREEN.w;
        const v = (w.y - SCREEN.y) / SCREEN.h;
        const inside = u >= 0 && u <= 1 && v >= 0 && v <= 1;
        mg.step(blocked ? 0 : dt, {
          u,
          v,
          inside,
          moved: input.pointer.moved,
          pressed: !blocked && input.pointer.pressed,
          down: !blocked && input.pointer.down,
          primaryPressed: !blocked && input.primaryPressed(),
          primaryDown: !blocked && input.primaryDown(),
          axisX: blocked ? 0 : input.axisX,
          axisY: blocked ? 0 : input.axisY,
        });
        this.pulse = Math.max(this.pulse, mg.progress);
        if (Math.abs(mg.progress - this.lastProgress) > 0.02) {
          this.lastProgress = mg.progress;
          const ui = useGame.getState().minigame;
          if (ui) useGame.getState().setMinigame({ ...ui, progress: mg.progress });
        }
        if (mg.done) this.resolveBeat(mg);
      }
    }

    if (this.orbFx) this.orbFx.t += dt;
  }

  // ─────────────────────────── rendering ───────────────────────────
  render(ctx: Ctx) {
    const st = useGame.getState();
    const t = this.time;
    const light = EMOTIONS[st.active].color;

    ctx.save();
    this.camera.apply(ctx, 1);
    drawBackWall(ctx, t, this.camera.x, light, st.islands);
    drawRecallTube(ctx, TUBE_X, t, light);
    const glowing: Record<number, boolean> = {};
    drawDayShelves(ctx, 480, 920, t, glowing);
    drawCoreHolder(ctx, HOLDER_X, t, st.coreShelf, st.carrying ? 1 : 0);
    drawManual(ctx, MANUAL_X, t);
    screenFrame(ctx, light, t, () => {
      const r = SCREEN;
      if (this.screenView === 'hallway') drawHallway(ctx, r, t);
      else if (this.screenView === 'mural') drawMural(ctx, r, t);
      else drawArtRoom(ctx, r, ART_CLUB.beats[Math.min(st.beat, ART_CLUB.beats.length - 1)].screen, t);
      if (this.minigame) this.minigame.render(ctx, r);
      if (this.screenFlash > 0.01) {
        ctx.fillStyle = `rgba(255,255,255,${this.screenFlash * 0.8})`;
        ctx.fillRect(r.x, r.y, r.w, r.h);
      }
    });
    drawCouch(ctx, COUCH_X);
    drawLamp(ctx, LAMP_X, this.lamp, t);
    drawBalconyDoor(ctx, DOOR_X, this.door, t, this.doorShake);
    drawFloor(ctx, light, t);
    drawCable(ctx, CABLE_X, this.cableMark, !!st.flags.cable, t);
    drawConsole(ctx, t, st.active, this.needle, this.pulse, this.engaged);
    this.drawActors(ctx);
    drawBadIdea(ctx, this.bad.x, this.bad.y, t, this.bad.alpha);

    // carried core memory bobs above the operator's head
    if (st.carrying) {
      const p = this.player;
      memoryOrb(ctx, p.x, p.headY() - 50 + Math.sin(t * 3) * 6, 24, EMOTIONS[st.carrying.emotion].color, { t, swirl: st.carrying.swirl?.map((e) => EMOTIONS[e].color) });
    }
    if (this.orbFx) this.drawOrbFx(ctx, this.orbFx);

    this.drawEffects(ctx);
    this.particles.render(ctx);
    ctx.restore();

    ctx.save();
    this.camera.apply(ctx, 1.3);
    drawForeground(ctx, t);
    ctx.restore();

    this.drawMoodLight(ctx);

    ctx.save();
    this.camera.apply(ctx, 1);
    this.drawBarks(ctx);
    if (!this.consoleMode) this.drawPrompt(ctx);
    ctx.restore();
  }

  private drawOrbFx(ctx: Ctx, fx: NonNullable<HQScene['orbFx']>) {
    const col = EMOTIONS[fx.mem.emotion].color;
    const swirl = fx.mem.swirl?.map((e) => EMOTIONS[e].color);
    if (fx.phase === 'rise') {
      // the memory forms on the screen, then floats down to the operator
      const grow = clamp(fx.t / 1.2, 0, 1);
      const fly = easeInOutCubic(clamp((fx.t - 1.4) / 1.1, 0, 1));
      const to: [number, number] = [this.player.x, this.player.headY() - 50];
      const x = lerp(fx.from[0], to[0], fly);
      const y = lerp(fx.from[1], to[1], fly) - Math.sin(fly * Math.PI) * 80;
      memoryOrb(ctx, x, y, 10 + grow * 30 - fly * 6, col, { t: this.time, swirl, glowAmt: 1.5 });
      if (Math.random() < 0.5) this.particles.emit({ x, y, count: 2, color: [col, '#ffffff'], shape: 'star', speed: [20, 80], life: [0.4, 0.8] });
    } else {
      const k = easeInOutCubic(clamp(fx.t / 1.0, 0, 1));
      const x = lerp(fx.from[0], fx.to[0], k);
      const y = lerp(fx.from[1], fx.to[1], k) - Math.sin(k * Math.PI) * 120;
      memoryOrb(ctx, x, y, 24 - k * 4, col, { t: this.time, swirl, glowAmt: 1.4 });
    }
  }

  /** For the DOM overlay: where on the stage the operator stands. */
  get stageCenterY() {
    return STAGE_H / 2;
  }
}
