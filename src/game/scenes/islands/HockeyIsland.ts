import { STAGE_H, STAGE_W } from '../../../engine/camera';
import type { Ctx } from '../../../engine/draw';
import { FONT_DISPLAY, circle, ellipse, glow, roundRect, signText, stars } from '../../../engine/draw';
import { hash } from '../../../engine/math';
import { useGame } from '../../../state/store';
import { PenaltyShots } from '../../activities';
import { drawProp } from '../../art/vignette';
import type { Game } from '../../Game';
import { IslandScene } from './IslandScene';

const RINK_X = 1250;
const SCORE_X = 1820;
const TROPHY_X = 2200;
const BENCH_X = 2560;

/** Navy night, floodlights and fresh ice. */
export class HockeyIsland extends IslandScene {
  readonly id = 'isle-hockey' as const;
  readonly island = 'hockey' as const;
  worldW = 2850;

  constructor(game: Game) {
    super(game);
    const store = () => useGame.getState();
    const say = (t: string, d = 3.4) => this.player.say(t, d);
    this.interactables.push({
      id: 'rink',
      x: RINK_X,
      y: this.floorY - 260,
      range: 220,
      hit: { x: RINK_X - 300, y: this.floorY - 260, w: 600, h: 260 },
      label: () => 'Take penalty shots',
      interact: () =>
        this.startActivity(
          'hockey-shots',
          () => new PenaltyShots(this.game.audio, this.particles),
          { x: RINK_X - 430, y: 150, w: 860, h: 500 },
          { deltas: { stats: { confidence: 5 }, islands: { hockey: 6 } }, text: 'Riley practised her shot.' },
          'The ice is cracked right across the middle. Nobody can skate on that.',
        ),
      abilities: { anger: () => say('Fire in the belly. Puck in the net. That’s the plan.') },
    });
    this.interactables.push({
      id: 'scoreboard',
      x: SCORE_X,
      y: this.floorY - 420,
      range: 150,
      label: () => 'Read the scoreboard',
      interact: () => {
        const played = !!store().mind?.memories['sc-game'];
        say(played ? 'Home 2, Visitors 3. Ten seconds from a tie. The post is still on the replay screen.' : 'Nil-nil. Waiting for the next game.', 3.8);
      },
    });
    this.interactables.push({
      id: 'trophies',
      x: TROPHY_X,
      y: this.floorY - 300,
      range: 140,
      label: () => 'Look in the trophy case',
      interact: () => {
        const f = store().flags;
        store().say(
          [
            { speaker: 'narrator', text: 'Under-8 champions. Most Improved, age nine. A puck signed by the whole old team.' },
            f.benched ? { speaker: 'narrator', text: 'The glass has a crack in it now, right across the Most Improved plaque.' } : null,
            f.recLeague ? { speaker: 'narrator', text: 'A brand new rec league jersey hangs above the case. Number 11.' } : null,
          ].filter(Boolean) as { speaker: 'narrator'; text: string }[],
        );
      },
    });
    this.interactables.push({
      id: 'bench',
      x: BENCH_X,
      y: this.floorY - 160,
      range: 130,
      label: () => 'Check the team bench',
      interact: () => {
        const f = store().flags;
        say(f.quitTalk ? 'Her skates are here, laces tangled. Like she just walked away from them.' : f.teamHug ? 'Tape, water bottles and a note: “Team hug Tuesday. Mandatory.”' : 'Spare tape and a lost glove. The usual.', 3.6);
      },
      abilities: { sadness: () => say('Losing together is still together.') },
    });
    this.buildCommon();
  }

  protected firstVisitLine() {
    return 'Hockey Island. Cold air, bright lights, the best sound in the world.';
  }

  protected drawSkyLayer(ctx: Ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, STAGE_H);
    g.addColorStop(0, '#0a1430');
    g.addColorStop(1, '#22365e');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, STAGE_W, STAGE_H);
    stars(ctx, STAGE_W, STAGE_H * 0.5, 120, this.time, 4);
    // the arena roof and crowd silhouettes far away
    ctx.save();
    this.camera.apply(ctx, 0.4);
    ctx.fillStyle = '#14213D';
    ctx.beginPath();
    ctx.moveTo(-500, 520);
    ctx.quadraticCurveTo(this.worldW / 2, 200, this.worldW + 900, 520);
    ctx.lineTo(this.worldW + 900, STAGE_H);
    ctx.lineTo(-500, STAGE_H);
    ctx.fill();
    for (let row = 0; row < 3; row++)
      for (let i = 0; i < 70; i++) {
        const x = -400 + i * 60 + (row % 2) * 30;
        const bob = this.stability >= 45 ? Math.sin(this.time * 5 + i + row) * 3 : 0;
        circle(ctx, x, 470 + row * 34 + bob, 12, ['#E63946', '#ffffff', '#3D7BFF', '#f2c29b'][(i + row) % 4]);
      }
    ctx.restore();
  }

  protected drawWorld(ctx: Ctx) {
    const y = this.floorY;
    const t = this.time;
    const stab = this.stability;
    // floodlights: they buzz and flicker when the island is shaky
    for (const lx of [500, 1250, 2000, 2650]) {
      const on = stab >= 45 || Math.sin(t * 17 + lx) > -0.2 + (45 - stab) / 50;
      ctx.fillStyle = '#5C6B80';
      ctx.fillRect(lx - 6, 80, 12, y - 80);
      ctx.fillStyle = '#2a3550';
      roundRect(ctx, lx - 50, 60, 100, 40, 8);
      ctx.fill();
      if (on) {
        for (let k = 0; k < 4; k++) circle(ctx, lx - 36 + k * 24, 80, 8, '#ffffff');
        const bg = ctx.createLinearGradient(0, 90, 0, y);
        bg.addColorStop(0, 'rgba(255,255,255,0.22)');
        bg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.moveTo(lx - 50, 90);
        ctx.lineTo(lx + 50, 90);
        ctx.lineTo(lx + 260, y);
        ctx.lineTo(lx - 260, y);
        ctx.fill();
      }
    }
    // ground: rubber matting, then the rink
    ctx.fillStyle = '#2a2f45';
    ctx.fillRect(-200, y - 6, this.worldW + 400, STAGE_H);
    const ix = RINK_X - 360;
    const iw = 720;
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, ix - 16, y - 180, iw + 32, 196, 60);
    ctx.fill();
    const ig = ctx.createLinearGradient(0, y - 160, 0, y);
    ig.addColorStop(0, '#E8F4FF');
    ig.addColorStop(1, '#b9d8f0');
    ctx.fillStyle = ig;
    roundRect(ctx, ix, y - 160, iw, 160, 50);
    ctx.fill();
    ctx.strokeStyle = '#E63946';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(RINK_X, y - 160);
    ctx.lineTo(RINK_X, y);
    ctx.stroke();
    ctx.strokeStyle = '#3D7BFF';
    ctx.beginPath();
    ctx.ellipse(RINK_X, y - 80, 50, 26, 0, 0, Math.PI * 2);
    ctx.stroke();
    // sheen sweeping across the ice
    const sx = ix + ((t * 120) % (iw + 200)) - 100;
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(sx, y - 158, 30, 156);
    // cracks when the island struggles
    if (stab < 45) {
      ctx.strokeStyle = 'rgba(30,50,90,0.6)';
      ctx.lineWidth = 2.5;
      for (let i = 0; i < Math.round((45 - stab) / 5); i++) {
        const cx = ix + 60 + hash(i * 3.7) * (iw - 120);
        ctx.beginPath();
        ctx.moveTo(cx, y - 150);
        ctx.lineTo(cx + 20, y - 100);
        ctx.lineTo(cx - 10, y - 60);
        ctx.lineTo(cx + 16, y - 10);
        ctx.stroke();
      }
    }
    // goal
    ctx.strokeStyle = '#E63946';
    ctx.lineWidth = 6;
    ctx.strokeRect(ix + iw - 120, y - 140, 80, 70);
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 1;
    for (let k = 1; k < 6; k++) {
      ctx.beginPath();
      ctx.moveTo(ix + iw - 120 + k * 13, y - 140);
      ctx.lineTo(ix + iw - 120 + k * 13, y - 70);
      ctx.stroke();
    }
    ellipse(ctx, RINK_X - 60 + Math.sin(t * 2) * 120, y - 40, 10, 4, '#111');
    signText(ctx, 'Penalty shots', RINK_X, y - 210, 22, '#7FC8FF');

    // scoreboard
    ctx.fillStyle = '#5C6B80';
    ctx.fillRect(SCORE_X - 6, y - 300, 12, 300);
    ctx.fillStyle = '#111';
    roundRect(ctx, SCORE_X - 130, y - 470, 260, 150, 12);
    ctx.fill();
    const played = !!useGame.getState().mind?.memories['sc-game'];
    const flick = stab >= 25 || Math.sin(t * 13) > 0;
    ctx.fillStyle = flick ? '#E63946' : '#3a1a1a';
    ctx.font = `800 52px ${FONT_DISPLAY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(played ? '2 : 3' : '0 : 0', SCORE_X, y - 400);
    ctx.font = `700 18px ${FONT_DISPLAY}`;
    ctx.fillStyle = '#FFCF33';
    ctx.fillText('HOME   VISITORS', SCORE_X, y - 350);

    // trophy case
    ctx.fillStyle = '#3a2b52';
    roundRect(ctx, TROPHY_X - 110, y - 330, 220, 330, 10);
    ctx.fill();
    ctx.fillStyle = 'rgba(180,220,255,0.18)';
    ctx.fillRect(TROPHY_X - 96, y - 316, 192, 280);
    for (let s = 0; s < 3; s++) {
      ctx.fillStyle = '#5C6B80';
      ctx.fillRect(TROPHY_X - 96, y - 236 + s * 90, 192, 6);
    }
    drawProp(ctx, 'trophy', TROPHY_X - 50, y - 240, 1.4, t);
    drawProp(ctx, 'trophy', TROPHY_X + 40, y - 240, 1.1, t);
    drawProp(ctx, 'puck', TROPHY_X, y - 154, 2, t);
    const f = useGame.getState().flags;
    if (f.benched) {
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(TROPHY_X - 90, y - 300);
      ctx.lineTo(TROPHY_X - 20, y - 220);
      ctx.lineTo(TROPHY_X + 10, y - 260);
      ctx.lineTo(TROPHY_X + 80, y - 120);
      ctx.stroke();
    }
    if (f.recLeague) {
      ctx.fillStyle = '#3D7BFF';
      roundRect(ctx, TROPHY_X - 40, y - 400, 80, 60, 10);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = `800 26px ${FONT_DISPLAY}`;
      ctx.fillText('11', TROPHY_X, y - 368);
    }

    // team bench
    ctx.fillStyle = '#E63946';
    roundRect(ctx, BENCH_X - 130, y - 80, 260, 20, 6);
    ctx.fill();
    ctx.fillStyle = '#5C6B80';
    ctx.fillRect(BENCH_X - 120, y - 60, 10, 60);
    ctx.fillRect(BENCH_X + 110, y - 60, 10, 60);
    if (f.quitTalk) {
      // skates left behind
      for (const sx2 of [-30, 20]) {
        ctx.fillStyle = '#ffffff';
        roundRect(ctx, BENCH_X + sx2, y - 120, 36, 36, 8);
        ctx.fill();
        ctx.fillStyle = '#cfd8e3';
        ctx.fillRect(BENCH_X + sx2 - 4, y - 84, 44, 4);
      }
    } else {
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = ['#3D7BFF', '#E63946'][i % 2];
        roundRect(ctx, BENCH_X - 100 + i * 52, y - 110, 18, 30, 4);
        ctx.fill();
      }
    }
    if (stab >= 45) glow(ctx, RINK_X, y - 100, 420, '#7FC8FF', 0.25);
  }
}
