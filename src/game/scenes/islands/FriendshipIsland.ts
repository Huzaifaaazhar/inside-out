import { STAGE_H, STAGE_W } from '../../../engine/camera';
import type { Ctx } from '../../../engine/draw';
import { circle, ellipse, glow, mixHex, roundRect, signText } from '../../../engine/draw';
import { TAU, hash } from '../../../engine/math';
import { useGame } from '../../../state/store';
import { BraceletWeave } from '../../activities';
import { drawPerson } from '../../art/vignette';
import type { Game } from '../../Game';
import { IslandScene } from './IslandScene';

const STALL_X = 700;
const WHEEL_X = 1220;
const BOTTLES_X = 1760;
const BENCH_X = 2140;
const BOARD_X = 2500;

/** A turquoise seaside boardwalk at golden hour: Ferris wheel, bunting and bottles on the sand. */
export class FriendshipIsland extends IslandScene {
  readonly id = 'isle-friendship' as const;
  readonly island = 'friendship' as const;
  worldW = 2800;
  private wheel = 0;

  constructor(game: Game) {
    super(game);
    const store = () => useGame.getState();
    const say = (t: string, d = 3.4) => this.player.say(t, d);
    this.interactables.push({
      id: 'stall',
      x: STALL_X,
      y: this.floorY - 300,
      range: 140,
      hit: { x: STALL_X - 130, y: this.floorY - 300, w: 260, h: 300 },
      label: () => 'Weave a friendship bracelet',
      interact: () =>
        this.startActivity(
          'friendship-bracelet',
          () => new BraceletWeave(this.game.audio, this.particles),
          { x: STALL_X - 380, y: 150, w: 860, h: 500 },
          { deltas: { stats: { friendship: 5, belonging: 2 }, islands: { friendship: 6 } }, text: 'Riley made a bracelet for a friend.' },
          'The stall’s shutters are down. The thread box is empty.',
        ),
    });
    this.interactables.push({
      id: 'wheel',
      x: WHEEL_X,
      y: this.floorY - 520,
      range: 170,
      label: () => 'Look up at the Ferris wheel',
      interact: () => say(this.stability >= 45 ? 'It’s turning! Every car is someone who matters to her.' : 'It’s stopped. Nobody’s riding it.'),
      abilities: { fear: () => say('It is very high. Fun for other people.') },
    });
    this.interactables.push({
      id: 'bottles',
      x: BOTTLES_X,
      y: this.floorY - 120,
      range: 150,
      label: () => 'Read the messages in bottles',
      interact: () => {
        const f = store().flags;
        const msgs = [
          f.sundayCalls ? 'From Dani: “Sunday call! Bring snacks. Virtually.”' : null,
          f.keptInTouch && !f.sundayCalls ? 'From Dani: “Miss you. Kayla says hi. She means it.”' : null,
          f.daniHurt && !f.daniRepaired ? 'A bottle with no message in it. Just sand.' : null,
          f.daniRepaired ? 'From Dani: “They don’t know you yet. They will.”' : null,
          f.priyaPlan ? 'From Priya: “Tomorrow: park, sketchbooks, crisps.”' : null,
        ].filter(Boolean) as string[];
        store().say(msgs.length ? msgs.map((t) => ({ speaker: 'narrator' as const, text: t })) : [{ speaker: 'narrator', text: 'The bottles are empty. Messages wash up when Riley reaches out to someone.' }]);
      },
    });
    this.interactables.push({
      id: 'bench',
      x: BENCH_X,
      y: this.floorY - 200,
      range: 140,
      label: () => 'Sit on the bench for two',
      interact: () => {
        const f = store().flags;
        if (f.priyaTable || f.invitedPriya || f.priyaPlan) say('Priya’s side of the bench has paint on it. Of course it does.');
        else say('Half the bench is empty. It’s waiting for someone.');
      },
    });
    this.interactables.push({
      id: 'board',
      x: BOARD_X,
      y: this.floorY - 300,
      range: 140,
      label: () => 'Look at the photo board',
      interact: () => {
        const f = store().flags;
        const mind = store().mind;
        const pics = [
          'An old team photo from the hometown rink.',
          f.scenarioDone ? 'Riley and Priya with paint on their faces, holding up a cloud cat.' : null,
          f.sleepover ? 'Three blurry faces lit by a TV at 1am.' : null,
          mind?.memories['sc-excluded'] ? (f.priyaPlan ? 'A park bench, two sketchbooks. Better than any party.' : 'A gap where a party photo would have gone.') : null,
          f.angryText ? 'A screenshot someone pinned up. Riley wishes she could take it down.' : null,
        ].filter(Boolean) as string[];
        store().say(pics.map((t) => ({ speaker: 'narrator' as const, text: t })));
      },
    });
    this.buildCommon();
  }

  protected firstVisitLine() {
    return 'Friendship Island! A whole boardwalk, built one friend at a time.';
  }

  protected islandTick(dt: number) {
    this.wheel += dt * (this.stability >= 45 ? 0.35 : this.stability >= 25 ? 0.08 : 0);
  }

  protected drawSkyLayer(ctx: Ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, STAGE_H);
    g.addColorStop(0, '#2fb5c8');
    g.addColorStop(0.55, '#ffd29a');
    g.addColorStop(1, '#ffb38a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, STAGE_W, STAGE_H);
    ctx.save();
    this.camera.apply(ctx, 0.08);
    glow(ctx, 600, 470, 380, '#FFE58A', 0.9);
    circle(ctx, 600, 470, 70, '#FFF1B0');
    ctx.restore();
    // the sea, with moving wave lines
    ctx.save();
    this.camera.apply(ctx, 0.35);
    const sg = ctx.createLinearGradient(0, 470, 0, STAGE_H);
    sg.addColorStop(0, '#3CC6B8');
    sg.addColorStop(1, '#1f7f88');
    ctx.fillStyle = sg;
    ctx.fillRect(-600, 480, this.worldW + 1600, STAGE_H);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 3;
    for (let r = 0; r < 6; r++) {
      ctx.beginPath();
      for (let x = -600; x < this.worldW + 1000; x += 40) ctx.lineTo(x, 500 + r * 40 + Math.sin(x * 0.02 + this.time * 1.5 + r) * 5);
      ctx.stroke();
    }
    // gulls
    for (let i = 0; i < 5; i++) {
      const gx = ((this.time * 30 + i * 400) % (this.worldW + 800)) - 400;
      const gy = 180 + i * 40 + Math.sin(this.time * 2 + i) * 10;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(gx - 14, gy);
      ctx.quadraticCurveTo(gx - 7, gy - 8, gx, gy);
      ctx.quadraticCurveTo(gx + 7, gy - 8, gx + 14, gy);
      ctx.stroke();
    }
    ctx.restore();
  }

  protected drawWorld(ctx: Ctx) {
    const y = this.floorY;
    const t = this.time;
    const stab = this.stability;
    // sand in front, boardwalk planks on top
    ctx.fillStyle = '#f2d39a';
    ctx.fillRect(-200, y + 10, this.worldW + 400, STAGE_H);
    ctx.fillStyle = '#c99b6d';
    ctx.fillRect(-200, y - 12, this.worldW + 400, 24);
    const missing = stab < 45 ? Math.round((45 - stab) / 3) : 0;
    for (let x = 0; x < this.worldW; x += 46) {
      const gone = missing > 0 && hash(x * 0.37) < missing / 20;
      ctx.fillStyle = gone ? 'rgba(30,20,50,0.6)' : x % 92 ? '#b5845a' : '#a87648';
      ctx.fillRect(x, y - 12, 42, 22);
    }
    for (let x = 30; x < this.worldW; x += 200) ctx.fillRect(x, y + 10, 14, 90);

    // bunting
    ctx.strokeStyle = '#7a5030';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x <= this.worldW; x += 20) ctx.lineTo(x, 120 + Math.sin(x * 0.006) * 40);
    ctx.stroke();
    for (let x = 20; x < this.worldW; x += 60) {
      const by = 122 + Math.sin(x * 0.006) * 40;
      ctx.fillStyle = stab >= 25 ? ['#FF7A6B', '#3CC6B8', '#FFCF33', '#A05CF0'][(x / 60) % 4 | 0] : '#8a8098';
      ctx.beginPath();
      ctx.moveTo(x - 14, by);
      ctx.lineTo(x + 14, by);
      ctx.lineTo(x, by + 26 + Math.sin(t * 3 + x) * 3);
      ctx.fill();
    }

    // bracelet stall
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(STALL_X - 120, y - 240, 240, 230);
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i % 2 ? '#FF7A6B' : '#ffffff';
      ctx.beginPath();
      ctx.moveTo(STALL_X - 140 + i * 47, y - 240);
      ctx.lineTo(STALL_X - 140 + (i + 1) * 47, y - 240);
      ctx.lineTo(STALL_X - 140 + (i + 0.5) * 47, y - 290);
      ctx.fill();
    }
    if (stab >= 25) {
      for (let i = 0; i < 7; i++) {
        ctx.strokeStyle = ['#3CC6B8', '#FF7A6B', '#FFCF33', '#A05CF0'][i % 4];
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(STALL_X - 90 + i * 30, y - 170, 12, 0, TAU);
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = '#8a8098';
      ctx.fillRect(STALL_X - 110, y - 230, 220, 160);
    }
    signText(ctx, 'Bracelets', STALL_X, y - 310, 22, '#1f7f88');

    // Ferris wheel
    const cx = WHEEL_X;
    const cy = y - 340;
    const R = 250;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(cx - 140, y);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx + 140, y);
    ctx.stroke();
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.stroke();
    const cols = ['#FF7A6B', '#3CC6B8', '#FFCF33', '#A05CF0', '#52C46B', '#3D7BFF', '#FF7FB0', '#F4A259'];
    for (let i = 0; i < 8; i++) {
      const a = this.wheel + (i / 8) * TAU;
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
      ctx.stroke();
      const px = cx + Math.cos(a) * R;
      const py = cy + Math.sin(a) * R;
      const c = stab >= 45 ? cols[i] : mixHex(cols[i], '#8a8098', 0.7);
      roundRect(ctx, px - 26, py, 52, 40, 10);
      ctx.fillStyle = c;
      ctx.fill();
      if (stab >= 45) glow(ctx, px, py + 20, 50, c, 0.4);
    }
    circle(ctx, cx, cy, 20, '#ffffff');

    // bottles washed up on the sand
    const f = useGame.getState().flags;
    const nBottles = (f.keptInTouch ? 2 : 0) + (f.sundayCalls ? 1 : 0) + (f.daniRepaired ? 1 : 0) + (f.priyaPlan ? 1 : 0);
    for (let i = 0; i < Math.max(1, nBottles); i++) {
      ctx.save();
      ctx.translate(BOTTLES_X - 80 + i * 44, y + 70 + Math.sin(t * 2 + i) * 2);
      ctx.rotate(-0.6 + i * 0.3);
      ctx.fillStyle = nBottles ? 'rgba(160,230,220,0.85)' : 'rgba(160,160,170,0.6)';
      roundRect(ctx, -10, -26, 20, 40, 6);
      ctx.fill();
      ctx.fillStyle = '#8a5a2a';
      ctx.fillRect(-5, -34, 10, 9);
      if (nBottles) {
        ctx.fillStyle = '#fff4c2';
        ctx.fillRect(-4, -18, 8, 22);
      }
      ctx.restore();
    }

    // the bench for two
    ctx.fillStyle = '#5a7ab8';
    roundRect(ctx, BENCH_X - 110, y - 90, 220, 18, 6);
    ctx.fill();
    roundRect(ctx, BENCH_X - 110, y - 150, 220, 16, 6);
    ctx.fill();
    ctx.fillRect(BENCH_X - 100, y - 72, 10, 72);
    ctx.fillRect(BENCH_X + 90, y - 72, 10, 72);
    if (f.priyaTable || f.invitedPriya || f.priyaPlan) {
      drawPerson(ctx, 'priya', BENCH_X + 50, y - 10, 540, 'sit', -1, 'happy', t, 2);
      ctx.fillStyle = '#FF7A6B';
      circle(ctx, BENCH_X + 10, y - 96, 6, '#FF7A6B');
    }

    // photo board
    ctx.fillStyle = '#c99b6d';
    ctx.fillRect(BOARD_X - 5, y - 200, 10, 200);
    ctx.fillStyle = '#e9d9b5';
    roundRect(ctx, BOARD_X - 120, y - 360, 240, 170, 8);
    ctx.fill();
    const photos = [true, !!f.scenarioDone, !!f.sleepover, !!f.priyaPlan, !!f.angryText];
    photos.forEach((on, i) => {
      if (!on) return;
      ctx.save();
      ctx.translate(BOARD_X - 80 + (i % 3) * 78, y - 320 + Math.floor(i / 3) * 76);
      ctx.rotate((i % 2 ? 1 : -1) * 0.08);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-30, -26, 60, 54);
      ctx.fillStyle = [ '#7fc2ff', '#FFCF33', '#3a3a7a', '#7cc276', '#E63946'][i];
      ctx.fillRect(-24, -20, 48, 34);
      circle(ctx, 0, -32, 4, '#E63946');
      ctx.restore();
    });
  }

  protected drawFront(ctx: Ctx) {
    for (let i = 0; i < 8; i++) {
      const x = i * 520 + 80;
      ctx.fillStyle = 'rgba(30,60,60,0.75)';
      ctx.beginPath();
      ctx.moveTo(x, 1000);
      ctx.quadraticCurveTo(x + 40, 860, x + 20, 800);
      ctx.quadraticCurveTo(x + 60, 860, x + 90, 1000);
      ctx.fill();
      ellipse(ctx, x + 200, 960, 160, 50, 'rgba(242,211,154,0.9)');
    }
  }
}
