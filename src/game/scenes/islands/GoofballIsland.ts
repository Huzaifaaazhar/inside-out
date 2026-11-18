import { STAGE_H, STAGE_W } from '../../../engine/camera';
import type { Ctx } from '../../../engine/draw';
import { circle, ellipse, glow, mixHex, roundRect, signText } from '../../../engine/draw';
import { TAU, clamp, hash } from '../../../engine/math';
import { useGame } from '../../../state/store';
import { BounceHouse } from '../../activities';
import { defaultCharState, drawEmotion } from '../../art/characters';
import type { EmotionId } from '../../content/emotions';
import type { Game } from '../../Game';
import { IslandScene } from './IslandScene';

const TENT_X = 1000;
const MIRROR_X = 1560;
const CHICKEN_X = 2000;
const CUSHION_X = 2330;
const CART_X = 2620;

const MIRROR_LINES: Record<EmotionId, string> = {
  joy: 'In the mirror, Joy is ten feet tall and mostly smile.',
  sadness: 'The mirror makes Sadness very wide and very cosy. She doesn’t mind.',
  anger: 'Anger’s reflection is tiny. He is furious about it.',
  fear: 'Fear’s reflection has extra legs. Fear has left the area.',
  disgust: 'The mirror gives Disgust a chin like a boot. She will be writing a complaint.',
};

/** A bubblegum funhouse where everything wobbles. */
export class GoofballIsland extends IslandScene {
  readonly id = 'isle-goofball' as const;
  readonly island = 'goofball' as const;
  worldW = 2850;
  private chicken: { t: number } | null = null;
  private cushion = 0;
  private mirrorState = defaultCharState(3);

  constructor(game: Game) {
    super(game);
    const store = () => useGame.getState();
    const say = (t: string, d = 3.4) => this.player.say(t, d);
    this.interactables.push({
      id: 'tent',
      x: TENT_X,
      y: this.floorY - 360,
      range: 200,
      hit: { x: TENT_X - 230, y: this.floorY - 400, w: 460, h: 400 },
      label: () => 'Jump in the bounce house',
      interact: () =>
        this.startActivity(
          'goofball-bounce',
          () => new BounceHouse(this.game.audio, this.particles),
          { x: TENT_X - 430, y: 150, w: 860, h: 500 },
          { deltas: { stats: { balance: 5 }, islands: { goofball: 6 } }, text: 'Riley was gloriously silly.' },
          'The bounce house has gone completely flat. Nobody’s been silly in days.',
        ),
    });
    this.interactables.push({
      id: 'mirror',
      x: MIRROR_X,
      y: this.floorY - 380,
      range: 160,
      label: () => 'Look in the funhouse mirror',
      interact: () => {
        this.game.audio.blip(0.6);
        say(MIRROR_LINES[store().active], 3.6);
      },
    });
    this.interactables.push({
      id: 'chicken',
      x: CHICKEN_X,
      y: this.floorY - 220,
      range: 130,
      label: () => 'Fire the rubber chicken catapult',
      interact: () => {
        if (this.chicken) return;
        this.chicken = { t: 0 };
        this.game.audio.whoosh(true);
        this.later(0.5, () => this.game.audio.tone({ freq: 900, to: 300, type: 'square', dur: 0.4, vol: 0.06 }));
      },
      abilities: { disgust: () => say('That chicken has been everywhere. Everywhere.') },
    });
    this.interactables.push({
      id: 'cushion',
      x: CUSHION_X,
      y: this.floorY - 120,
      range: 120,
      label: () => 'Sit on the suspicious cushion',
      interact: () => {
        this.cushion = 1;
        this.game.audio.tone({ freq: 120, to: 70, type: 'sawtooth', dur: 0.6, vol: 0.12, filter: 500 });
        this.player.setPose(store().active === 'fear' ? 'scared' : 'cheer', 1.2);
        say({ joy: 'HAHAHA. Classic.', sadness: '...That was me. Sorry.', anger: 'WHO PUT THAT THERE.', fear: 'What was that noise? What WAS that?', disgust: 'Absolutely not. Absolutely not.' }[store().active], 2.6);
      },
    });
    this.interactables.push({
      id: 'cart',
      x: CART_X,
      y: this.floorY - 260,
      range: 130,
      label: () => 'Order from the ice-cream cart',
      interact: () => {
        const flavours = ['pickle ripple', 'sock fudge', 'ketchup sorbet', 'regular vanilla (suspicious)'];
        say(`Today’s flavour: ${flavours[Math.floor(this.time) % flavours.length]}.`, 3);
      },
      abilities: {
        disgust: () => {
          say('Pickle ripple? NOPE. Flicked it into the sea.');
          this.particles.emit({ x: CART_X, y: this.floorY - 260, count: 18, color: ['#7cc276', '#52C46B'], shape: 'bubble' });
        },
        joy: () => say('Every flavour sounds amazing. Even sock fudge. Especially sock fudge.'),
      },
    });
    this.buildCommon();
  }

  protected firstVisitLine() {
    return 'Goofball Island! Where Riley is allowed to be completely ridiculous.';
  }

  protected islandTick(dt: number) {
    if (this.chicken) {
      this.chicken.t += dt;
      if (this.chicken.t > 2.2) this.chicken = null;
    }
    this.cushion = Math.max(0, this.cushion - dt * 1.5);
    this.mirrorState.t += dt;
  }

  private get wobble() {
    return clamp(this.stability / 70, 0.15, 1);
  }

  protected drawSkyLayer(ctx: Ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, STAGE_H);
    g.addColorStop(0, '#8E5BD9');
    g.addColorStop(0.6, '#FF9AC4');
    g.addColorStop(1, '#FFE45E');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, STAGE_W, STAGE_H);
    // giant floating balloons and spinning lollipops
    ctx.save();
    this.camera.apply(ctx, 0.3);
    for (let i = 0; i < 12; i++) {
      const x = i * 330 - 200;
      const y = 200 + hash(i) * 260 + Math.sin(this.time * 0.8 + i) * 20 * this.wobble;
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y + 50);
      ctx.lineTo(x + Math.sin(this.time + i) * 10, y + 160);
      ctx.stroke();
      ellipse(ctx, x, y, 38, 48, ['#7AE7C7', '#FFE45E', '#FF7FB0', '#ffffff'][i % 4]);
    }
    ctx.restore();
    ctx.save();
    this.camera.apply(ctx, 0.6);
    for (let i = 0; i < 6; i++) {
      const x = i * 620 + 100;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x - 6, 420, 12, 400);
      ctx.save();
      ctx.translate(x, 400);
      ctx.rotate(this.time * 0.6 * this.wobble + i);
      for (let k = 0; k < 6; k++) {
        ctx.fillStyle = k % 2 ? '#FF7FB0' : '#ffffff';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, 90, (k / 6) * TAU, ((k + 1) / 6) * TAU);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
  }

  protected drawWorld(ctx: Ctx) {
    const y = this.floorY;
    const t = this.time;
    const w = this.wobble;
    // checkerboard candy floor
    for (let x = -200; x < this.worldW + 200; x += 60) {
      for (let r = 0; r < 3; r++) {
        ctx.fillStyle = (x / 60 + r) % 2 ? '#ffffff' : '#FF7FB0';
        ctx.fillRect(x, y + r * 50 - 6, 60, 50);
      }
    }
    ctx.fillStyle = '#8E5BD9';
    ctx.fillRect(-200, y - 10, this.worldW + 400, 10);

    // bounce tent, deflating as the island weakens
    const sag = 1 - clamp(this.stability / 60, 0, 1);
    const tx = TENT_X;
    const top = y - 380 + sag * 220;
    const bob = Math.sin(t * 3) * 10 * w;
    for (let i = -4; i <= 4; i++) {
      ctx.fillStyle = i % 2 ? '#FFE45E' : '#FF7FB0';
      ctx.beginPath();
      ctx.moveTo(tx + i * 50 - 25, y);
      ctx.quadraticCurveTo(tx + i * 30, top + 100 + Math.abs(i) * 30 + bob, tx + bob * 0.3, top + bob);
      ctx.quadraticCurveTo(tx + i * 30 + 10, top + 100 + Math.abs(i) * 30 + bob, tx + i * 50 + 25, y);
      ctx.fill();
    }
    circle(ctx, tx + bob * 0.3, top + bob - 16, 18, '#7AE7C7');
    signText(ctx, 'Bounce house', tx, top - 50, 24, '#8E5BD9');

    // funhouse mirrors with a wavy reflection of whoever is looking
    for (let k = 0; k < 3; k++) {
      const mx = MIRROR_X - 140 + k * 140;
      ctx.fillStyle = '#8E5BD9';
      roundRect(ctx, mx - 60, y - 400, 120, 390, 60);
      ctx.fill();
      const mg = ctx.createLinearGradient(mx - 50, 0, mx + 50, 0);
      mg.addColorStop(0, '#d8f4ff');
      mg.addColorStop(0.5, '#ffffff');
      mg.addColorStop(1, '#c8e8ff');
      ctx.fillStyle = mg;
      roundRect(ctx, mx - 48, y - 388, 96, 366, 48);
      ctx.fill();
      const p = this.player;
      if (Math.abs(p.x - MIRROR_X) < 320) {
        ctx.save();
        roundRect(ctx, mx - 48, y - 388, 96, 366, 48);
        ctx.clip();
        const sx = [0.7, 1.6, 1][k];
        const sy = [1.6, 0.7, 1.3][k];
        ctx.translate(mx, y - 40);
        ctx.scale(sx * 0.9, sy * 0.9 * (1 + Math.sin(t * 3 + k) * 0.05));
        this.mirrorState.facing = -1;
        drawEmotion(ctx, p.id, 0, 0, this.mirrorState, 1);
        ctx.restore();
      }
    }

    // rubber chicken catapult
    const cx = CHICKEN_X;
    ctx.fillStyle = '#7a5030';
    ctx.fillRect(cx - 60, y - 40, 120, 30);
    const arm = this.chicken ? Math.min(1, this.chicken.t * 6) : 0;
    ctx.save();
    ctx.translate(cx - 40, y - 40);
    ctx.rotate(-0.2 - arm * 1.2);
    ctx.fillStyle = '#8a5a3a';
    ctx.fillRect(0, -8, 140, 14);
    ctx.restore();
    if (this.chicken) {
      const k = this.chicken.t / 2.2;
      const chx = cx + k * 900;
      const chy = y - 120 - Math.sin(k * Math.PI) * 520;
      ctx.save();
      ctx.translate(chx, chy);
      ctx.rotate(this.chicken.t * 12);
      ellipse(ctx, 0, 0, 30, 14, '#FFE45E');
      circle(ctx, 30, -6, 10, '#FFE45E');
      ctx.fillStyle = '#E63946';
      ctx.fillRect(34, -18, 6, 8);
      ctx.restore();
    } else {
      ellipse(ctx, cx + 70, y - 70, 30, 14, '#FFE45E');
      circle(ctx, cx + 100, y - 76, 10, '#FFE45E');
    }

    // the cushion
    const puff = 1 + this.cushion * 0.4;
    ellipse(ctx, CUSHION_X, y - 26, 60 * puff, 26 / puff, '#E8516A');
    ellipse(ctx, CUSHION_X + 54 * puff, y - 26, 12, 8, '#c03a52');
    if (this.cushion > 0) for (let i = 0; i < 3; i++) circle(ctx, CUSHION_X + 80 + i * 20 + (1 - this.cushion) * 40, y - 40 - i * 10, 8 * this.cushion, 'rgba(200,220,180,0.6)');

    // ice-cream cart with a striped umbrella
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, CART_X - 90, y - 170, 180, 120, 14);
    ctx.fill();
    circle(ctx, CART_X - 60, y - 34, 26, '#8E5BD9');
    circle(ctx, CART_X + 60, y - 34, 26, '#8E5BD9');
    ctx.fillStyle = '#7a5030';
    ctx.fillRect(CART_X - 4, y - 360, 8, 190);
    for (let k = 0; k < 8; k++) {
      ctx.fillStyle = k % 2 ? '#7AE7C7' : '#ffffff';
      ctx.beginPath();
      ctx.moveTo(CART_X, y - 370);
      ctx.arc(CART_X, y - 300, 130, Math.PI + (k / 8) * Math.PI, Math.PI + ((k + 1) / 8) * Math.PI);
      ctx.fill();
    }
    for (let k = 0; k < 4; k++) circle(ctx, CART_X - 60 + k * 40, y - 140, 16, mixHex(['#FFE45E', '#7cc276', '#FF7FB0', '#ffffff'][k], '#ffffff', 0.2));
    if (this.stability >= 45) glow(ctx, TENT_X, y - 200, 400, '#FF7FB0', 0.25);
  }
}
