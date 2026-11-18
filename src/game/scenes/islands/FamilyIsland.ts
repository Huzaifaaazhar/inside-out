import { STAGE_H, STAGE_W } from '../../../engine/camera';
import type { Ctx } from '../../../engine/draw';
import { circle, ellipse, glow, memoryOrb, roundRect, signText } from '../../../engine/draw';
import { TAU, hash } from '../../../engine/math';
import { useGame } from '../../../state/store';
import { PancakeFlip } from '../../activities';
import { EMOTIONS } from '../../content/emotions';
import { allEntries } from '../../systems/library';
import type { Game } from '../../Game';
import { IslandScene } from './IslandScene';

const HOUSE_X = 1450;
const TREE_X = 880;
const SWING_X = 2020;
const MAIL_X = 2330;
const TABLE_X = 2600;

/** Warm honey dusk, a house with its porch light on, a tree of family photos. */
export class FamilyIsland extends IslandScene {
  readonly id = 'isle-family' as const;
  readonly island = 'family' as const;
  worldW = 2850;
  private swing = 0;
  private swingV = 0;

  constructor(game: Game) {
    super(game);
    const store = () => useGame.getState();
    const say = (t: string, d = 3.4) => this.player.say(t, d);
    this.interactables.push({
      id: 'tree',
      x: TREE_X,
      y: this.floorY - 470,
      range: 170,
      hit: { x: TREE_X - 220, y: 160, w: 440, h: this.floorY - 160 },
      label: () => 'Look at the family photo tree',
      interact: () => {
        const mind = store().mind;
        const mems = allEntries(mind).filter((e) => e.island === 'family');
        const rows = mems.map((e) => {
          const m = mind?.memories[e.id];
          const status = !m ? 'not made yet' : m.status === 'long-term' ? `kept, ${EMOTIONS[m.emotion].name.toLowerCase()}` : m.status === 'core' ? 'core memory' : m.status;
          return `${e.title}: ${status}`;
        });
        store().setInspect({
          kicker: 'Every frame is a family memory',
          title: 'The photo tree',
          body: rows.join('\n'),
          color: '#F4A259',
          extra: 'Empty frames are memories that slipped into The Fading. You can bring them back from Long-Term Memory.',
        });
      },
      abilities: { sadness: () => say('Some frames are empty. Grandpa’s porch is one of them.') },
    });
    this.interactables.push({
      id: 'pancakes',
      x: HOUSE_X + 120,
      y: this.floorY - 330,
      range: 140,
      hit: { x: HOUSE_X + 40, y: this.floorY - 340, w: 170, h: 160 },
      label: () => 'Make Sunday pancakes',
      interact: () =>
        this.startActivity(
          'family-pancakes',
          () => new PancakeFlip(this.game.audio, this.particles),
          { x: HOUSE_X - 380, y: 150, w: 860, h: 500 },
          { deltas: { stats: { family: 5 }, islands: { family: 6 } }, text: 'Sunday pancakes with Dad.' },
          'The stove is cold. Nobody’s been in the kitchen together for days.',
        ),
    });
    this.interactables.push({
      id: 'porch',
      x: HOUSE_X - 120,
      y: this.floorY - 300,
      range: 120,
      label: () => 'Check the porch light',
      interact: () => say(this.stability >= 45 ? 'Always on. It means “come home whenever”.' : 'It keeps flickering. Like it’s not sure anyone’s coming home.'),
      abilities: { fear: () => say('Bulb: fine. Wiring: fine. The flicker is... emotional. That’s worse.') },
    });
    this.interactables.push({
      id: 'swing',
      x: SWING_X,
      y: this.floorY - 260,
      range: 120,
      label: () => 'Push the tyre swing',
      interact: () => {
        this.swingV += 2.4;
        this.game.audio.whoosh(true);
        say({ joy: 'Wheee! Higher!', sadness: 'Dad used to push her on this.', anger: 'HIGHER. No, HIGHER.', fear: 'That rope looks old.', disgust: 'Tyre swings are basically mud with a rope.' }[store().active], 2.6);
      },
    });
    this.interactables.push({
      id: 'mailbox',
      x: MAIL_X,
      y: this.floorY - 170,
      range: 110,
      label: () => 'Open the mailbox',
      interact: () => {
        const f = store().flags;
        const notes = [
          f.familyMission ? 'A café receipt: two hot chocolates, one with extra cream. “Mission complete!” in Dad’s writing.' : null,
          f.repaired ? 'A note on Mum’s good paper: “Thank you for talking to me. Love you more than hockey. (Close call.)”' : null,
          f.recLeague ? 'A rec league welcome letter. Riley’s name is spelled right on the first try.' : null,
          f.slammedDoor && !f.repaired ? 'Nothing but a crumpled flyer. The mailbox feels cold.' : null,
          f.hidingFeelings ? 'A note from Mum, unsent: “I wish you’d tell me how you really are.”' : null,
        ].filter(Boolean) as string[];
        store().say(notes.length ? notes.map((t) => ({ speaker: 'narrator' as const, text: t })) : [{ speaker: 'narrator', text: 'Empty for now. Letters arrive when things happen at home.' }]);
      },
    });
    this.interactables.push({
      id: 'table',
      x: TABLE_X,
      y: this.floorY - 200,
      range: 140,
      label: () => 'Look at the family table',
      interact: () => {
        const f = store().flags;
        say(f.slammedDoor && !f.repaired ? 'One chair is turned away from the table. Nobody has turned it back.' : f.repaired || f.toldParentsTruth ? 'Three chairs, pulled close. Someone left a jigsaw half done.' : 'Three chairs. It’s quiet, but nobody’s upset.', 3.8);
      },
    });
    this.buildCommon();
  }

  protected firstVisitLine() {
    return 'Family Island. It smells like pancakes and Dad’s terrible aftershave.';
  }

  protected islandTick(dt: number) {
    this.swingV += -this.swing * 6 * dt;
    this.swingV *= Math.exp(-0.6 * dt);
    this.swing += this.swingV * dt;
  }

  protected drawSkyLayer(ctx: Ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, STAGE_H);
    g.addColorStop(0, '#5b3f8a');
    g.addColorStop(0.45, '#e58f7a');
    g.addColorStop(0.75, '#ffcf8f');
    g.addColorStop(1, '#ffe8b6');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, STAGE_W, STAGE_H);
    ctx.save();
    this.camera.apply(ctx, 0.1);
    glow(ctx, 1300, 560, 520, '#FFD27A', 0.9);
    circle(ctx, 1300, 560, 120, '#FFE3A0');
    ctx.restore();
    // rolling hills in three layers
    const hills = [
      [0.25, '#c9806a', 520],
      [0.45, '#a8645a', 580],
      [0.7, '#7a4a52', 640],
    ] as const;
    for (const [p, c, base] of hills) {
      ctx.save();
      this.camera.apply(ctx, p);
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(-400, STAGE_H);
      for (let x = -400; x <= this.worldW + 800; x += 80) ctx.lineTo(x, base + Math.sin(x * 0.004 + p * 10) * 50 + Math.sin(x * 0.011) * 18);
      ctx.lineTo(this.worldW + 800, STAGE_H);
      ctx.fill();
      ctx.restore();
    }
    // fireflies
    ctx.save();
    this.camera.apply(ctx, 0.8);
    for (let i = 0; i < 30; i++) {
      const x = hash(i) * this.worldW;
      const y = 300 + hash(i + 7) * 380 + Math.sin(this.time + i) * 10;
      glow(ctx, x, y, 14, '#FFE58A', 0.5 + 0.5 * Math.sin(this.time * 3 + i));
    }
    ctx.restore();
  }

  protected drawWorld(ctx: Ctx) {
    const y = this.floorY;
    const t = this.time;
    const stab = this.stability;
    // the ground: warm grass and a stepping-stone path
    const g = ctx.createLinearGradient(0, y - 20, 0, STAGE_H);
    g.addColorStop(0, '#9cbf5f');
    g.addColorStop(1, '#5f7f3a');
    ctx.fillStyle = g;
    ctx.fillRect(-200, y - 6, this.worldW + 400, STAGE_H);
    for (let x = 60; x < this.worldW; x += 110) ellipse(ctx, x, y + 40 + Math.sin(x) * 8, 40, 12, '#d9c39a');

    // the photo tree
    ctx.fillStyle = '#7a5030';
    ctx.beginPath();
    ctx.moveTo(TREE_X - 40, y);
    ctx.quadraticCurveTo(TREE_X - 20, y - 200, TREE_X - 10, y - 330);
    ctx.lineTo(TREE_X + 14, y - 330);
    ctx.quadraticCurveTo(TREE_X + 24, y - 200, TREE_X + 48, y);
    ctx.fill();
    for (let i = 0; i < 6; i++) circle(ctx, TREE_X + Math.cos(i * 1.1) * 170, y - 420 + Math.sin(i * 1.7) * 90, 110, i % 2 ? '#7fa36b' : '#6a9058');
    const mind = useGame.getState().mind;
    const mems = allEntries(mind).filter((e) => e.island === 'family');
    mems.forEach((e, i) => {
      const fx = TREE_X - 190 + (i % 4) * 125 + (i > 3 ? 60 : 0);
      const fy = y - 520 + Math.floor(i / 4) * 150 + Math.sin(t * 1.5 + i) * 4;
      const m = mind?.memories[e.id];
      const fallen = stab < 30 && i % 2 === 1;
      const py = fallen ? y - 20 : fy;
      ctx.strokeStyle = '#4a3020';
      ctx.lineWidth = 2;
      if (!fallen) {
        ctx.beginPath();
        ctx.moveTo(fx, fy - 70);
        ctx.lineTo(fx, py - 34);
        ctx.stroke();
      }
      ctx.save();
      ctx.translate(fx, py);
      ctx.rotate(fallen ? 1.2 : Math.sin(t + i) * 0.06);
      ctx.fillStyle = '#F4A259';
      roundRect(ctx, -36, -34, 72, 68, 6);
      ctx.fill();
      ctx.fillStyle = '#fff3dc';
      ctx.fillRect(-28, -26, 56, 52);
      if (m && (m.status === 'long-term' || m.status === 'core')) memoryOrb(ctx, 0, 0, 16, EMOTIONS[m.emotion].color, { glowAmt: 0.4 });
      else if (m && m.status === 'faded') memoryOrb(ctx, 0, 0, 16, '#8d8a9e', { faded: 0.8, glowAmt: 0.2 });
      else {
        ctx.strokeStyle = 'rgba(90,60,40,0.4)';
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(-20, -18, 40, 36);
        ctx.setLineDash([]);
      }
      ctx.restore();
    });

    // the house
    const hx = HOUSE_X;
    ctx.fillStyle = '#f2c18a';
    ctx.fillRect(hx - 220, y - 360, 440, 360);
    ctx.fillStyle = '#b5533c';
    ctx.beginPath();
    ctx.moveTo(hx - 260, y - 350);
    ctx.lineTo(hx, y - 520);
    ctx.lineTo(hx + 260, y - 350);
    ctx.fill();
    ctx.fillStyle = '#8a3a2a';
    ctx.fillRect(hx + 120, y - 500, 46, 90);
    // chimney smoke when the kitchen is busy
    if (stab >= 45) for (let i = 0; i < 4; i++) {
      const k = (t * 0.25 + i / 4) % 1;
      circle(ctx, hx + 143 + Math.sin(k * 6) * 14, y - 520 - k * 160, 14 + k * 24, `rgba(240,230,240,${0.4 * (1 - k)})`);
    }
    // door and porch
    ctx.fillStyle = '#7a4030';
    roundRect(ctx, hx - 50, y - 180, 100, 180, [50, 50, 0, 0]);
    ctx.fill();
    const flicker = stab >= 45 ? 1 : Math.sin(t * 23) > -0.1 + (45 - stab) / 60 ? 1 : 0.15;
    glow(ctx, hx - 120, y - 210, 160, '#FFD27A', 0.9 * flicker);
    circle(ctx, hx - 120, y - 210, 12, flicker > 0.5 ? '#FFF1B0' : '#8a7a60');
    // kitchen window (the pancake activity)
    ctx.fillStyle = stab >= 25 ? '#FFE8A0' : '#6a6070';
    roundRect(ctx, hx + 60, y - 300, 130, 100, 8);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6;
    ctx.strokeRect(hx + 60, y - 300, 130, 100);
    if (stab >= 25) {
      glow(ctx, hx + 125, y - 250, 120, '#FFCF33', 0.4);
      for (let i = 0; i < 3; i++) ellipse(ctx, hx + 125, y - 222 - i * 8, 26, 6, '#d4954a');
    }
    signText(ctx, 'Kitchen', hx + 125, y - 320, 18, '#7a4030');
    // upstairs windows
    for (const wx of [-150, 0]) {
      ctx.fillStyle = stab >= 45 ? '#FFE8A0' : '#5a5070';
      ctx.fillRect(hx + wx - 50, y - 320, 80, 70);
    }

    // tyre swing on a second tree
    ctx.fillStyle = '#7a5030';
    ctx.fillRect(SWING_X + 60, y - 380, 30, 380);
    circle(ctx, SWING_X + 40, y - 420, 120, '#7fa36b');
    ctx.save();
    ctx.translate(SWING_X - 20, y - 360);
    ctx.rotate(this.swing * 0.5);
    ctx.strokeStyle = '#3a2a1a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 240);
    ctx.stroke();
    ctx.strokeStyle = '#2a2a3a';
    ctx.lineWidth = 16;
    ctx.beginPath();
    ctx.ellipse(0, 270, 36, 30, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();

    // mailbox
    ctx.fillStyle = '#5a3a2a';
    ctx.fillRect(MAIL_X - 5, y - 130, 10, 130);
    ctx.fillStyle = '#3D6FB6';
    roundRect(ctx, MAIL_X - 40, y - 170, 80, 46, [22, 22, 4, 4]);
    ctx.fill();
    const f = useGame.getState().flags;
    const hasMail = f.familyMission || f.repaired || f.recLeague || f.hidingFeelings;
    ctx.fillStyle = '#E63946';
    ctx.fillRect(MAIL_X + 34, y - 168 + (hasMail ? 0 : 20), 6, 26);

    // family table, with one chair turned away after the argument
    ctx.fillStyle = '#b5845a';
    ctx.fillRect(TABLE_X - 110, y - 120, 220, 14);
    ctx.fillRect(TABLE_X - 100, y - 106, 10, 106);
    ctx.fillRect(TABLE_X + 90, y - 106, 10, 106);
    const turned = f.slammedDoor && !f.repaired;
    const chair = (cx: number, away: boolean) => {
      ctx.save();
      ctx.translate(cx, y);
      if (away) ctx.scale(-1, 1);
      ctx.fillStyle = '#8a5a3a';
      ctx.fillRect(-20, -70, 40, 8);
      ctx.fillRect(-20, -70, 6, 70);
      ctx.fillRect(14, -70, 6, 70);
      ctx.fillRect(14, -150, 6, 80);
      ctx.restore();
    };
    chair(TABLE_X - 150, false);
    chair(TABLE_X + 150, turned);
    chair(TABLE_X, false);
    if (f.repaired || f.toldParentsTruth) for (let i = 0; i < 6; i++) ctx.fillStyle = ['#3D7BFF', '#FFCF33', '#52C46B'][i % 3], ctx.fillRect(TABLE_X - 60 + i * 18, y - 128, 14, 8);
  }
}
