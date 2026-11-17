import { STAGE_H, STAGE_W } from '../../engine/camera';
import type { Ctx } from '../../engine/draw';
import { FONT_DISPLAY, circle, ellipse, glow, mixHex, rgba, roundRect, signText } from '../../engine/draw';
import { TAU, damp, hash } from '../../engine/math';
import { useGame } from '../../state/store';
import { cloudBank, drawIsland, drawSky, lightBridge } from '../art/mindscape';
import { EMOTIONS } from '../content/emotions';
import type { IslandId } from '../content/world';
import { ISLANDS } from '../content/world';
import type { Game } from '../Game';
import { Actor, WorldScene } from '../WorldScene';

const W = 3400;
const FLOOR = 780;
const PARALLAX = 0.55;
const VIEW: Record<IslandId, number> = { family: 700, friendship: 1260, honesty: 1820, curiosity: 2360, silliness: 3000 };
const ISLAND_Y: Record<IslandId, number> = { family: 470, friendship: 400, honesty: 450, curiosity: 420, silliness: 470 };
const EDGE_X = 2080;
const BOULDER_X = 2700;
const GOSSIP_X = 1820;
const DOOR_X = 150;

/** World x on the island layer that lines up with viewpoint `vx` when the camera is centred there. */
const layerX = (vx: number) => STAGE_W / 2 + (vx - STAGE_W / 2) * PARALLAX;

export class IslandsScene extends WorldScene {
  readonly id = 'islands' as const;
  worldW = W;
  floorY = FLOOR;
  private lit: Record<IslandId, number> = { family: 1, friendship: 0, honesty: 1, curiosity: 1, silliness: 1 };
  private celebrating = 0;
  private boulder = 1;
  private gossip = { alpha: 1, x: GOSSIP_X, y: 300, vy: 0, flying: false };
  private edgeWarned = false;
  private edgeMark = 0;
  private panTo: number | null = null;

  constructor(game: Game) {
    super(game);
    this.actors = [new Actor('joy', 260, FLOOR, 9)];
    this.roomLight = 0.1;
    this.build();
  }

  enter(spawn?: number) {
    this.actors[0].id = useGame.getState().active;
    super.enter(spawn);
    const st = useGame.getState();
    for (const i of ISLANDS) this.lit[i.id] = st.islands[i.id] && (i.id !== 'friendship' || st.flags.friendshipCelebrated) ? 1 : 0;
    this.boulder = st.flags.boulder ? 0 : 1;
    if (st.flags.gossip) this.gossip.alpha = 0;
    if (st.flags.edgeMarked) this.edgeMark = 1;
    if (st.islands.friendship && !st.flags.friendshipCelebrated) {
      this.later(1.0, () => this.celebrateFriendship());
    } else if (!st.flags.islandsVisited) {
      this.later(0.8, () => this.player.say('Personality Islands! The parts of Riley that make her Riley.', 3.4));
    }
    useGame.getState().setFlag('islandsVisited');
  }

  private celebrateFriendship() {
    this.locked = true;
    this.panTo = VIEW.friendship;
    this.player.targetX = VIEW.friendship - 80;
    this.later(1.4, () => {
      this.celebrating = 0.001;
      this.game.audio.coreMemory();
      this.later(2.4, () => {
        const s = useGame.getState();
        s.setFlag('friendshipCelebrated');
        s.say(
          [
            { speaker: s.active, text: 'Look! Friendship Island! It’s turning again!' },
            { speaker: s.active, text: 'One good afternoon with Priya and the whole thing lit up.' },
            { speaker: 'console', text: 'Part 1 complete. Riley’s mind is yours to explore. Every island, shelf and corner reacts to each emotion.' },
          ],
          () => {
            this.locked = false;
            this.panTo = null;
            useGame.getState().setObjective('free');
          },
        );
      });
    });
  }

  private build() {
    const store = () => useGame.getState();
    this.interactables.push({
      id: 'door',
      x: DOOR_X,
      y: FLOOR - 330,
      range: 120,
      hit: { x: DOOR_X - 90, y: FLOOR - 310, w: 180, h: 310 },
      label: () => 'Head back inside to Headquarters',
      interact: () => store().travel('hq', 'glide', 2980),
    });

    for (const def of ISLANDS) {
      this.interactables.push({
        id: `island-${def.id}`,
        x: VIEW[def.id],
        y: FLOOR - 130,
        range: 130,
        hit: { x: VIEW[def.id] - 60, y: FLOOR - 130, w: 120, h: 130 },
        label: () => `Look out at ${def.name}`,
        interact: () => {
          const s = store();
          const on = s.islands[def.id];
          s.setInspect({
            kicker: on ? 'Powered by a core memory' : 'Dark',
            title: def.name,
            body: def.about,
            color: def.color,
            extra: `${on ? def.lit : def.dark} Fuelled most by ${def.fuel.map((f) => EMOTIONS[f].name).join(', ')}.`,
          });
        },
        abilities: {
          joy: () => {
            const on = store().islands[def.id];
            this.player.say(on ? `Go, ${def.name}! Woo!` : 'Sparkles won’t do it. It needs a real core memory.', 3);
          },
          sadness: () => {
            if (def.id === 'friendship') this.player.say(store().islands.friendship ? 'It’s brighter because she let herself miss her old friends AND make a new one.' : 'It went dark because she misses her old friends. That’s allowed.', 4.2);
            else this.player.say(`${def.name} feels steady. Like a hug that’s been there a long time.`, 3.4);
          },
          fear: () => this.player.say(def.id === 'curiosity' ? 'Curiosity always wants to look closer. At things that might bite.' : 'Those bridges look very thin.', 3.2),
        },
      });
    }

    this.interactables.push({
      id: 'edge',
      x: EDGE_X,
      y: FLOOR - 60,
      range: 120,
      hit: { x: EDGE_X - 120, y: FLOOR - 80, w: 240, h: 100 },
      label: () => (store().flags.edgeMarked ? null : 'Look at the cliff edge'),
      interact: () => {
        this.player.say(store().active === 'fear' ? 'Cracks! Lots of cracks! Scan it, scan it! (Q)' : 'The edge looks a bit... crumbly?', 3);
        if (store().active !== 'fear') useGame.getState().showToast('Hint: Fear’s Scan (Q) marks hazards so nobody steps there.', EMOTIONS.fear.color);
      },
      abilities: {
        fear: () => {
          if (store().flags.edgeMarked) return;
          store().setFlag('edgeMarked');
          this.game.audio.success();
          this.player.say('Crumbling edge. Marked. Coned off. Mentally laminated.', 3.2);
          store().showToast('Fear marked a crumbling edge', EMOTIONS.fear.color);
        },
      },
    });

    this.interactables.push({
      id: 'boulder',
      x: BOULDER_X - 60,
      y: FLOOR - 200,
      range: 140,
      hit: { x: BOULDER_X - 110, y: FLOOR - 190, w: 220, h: 190 },
      label: () => (store().flags.boulder ? null : 'Push the boulder'),
      interact: () => {
        this.game.audio.thud();
        this.camera.shake(3);
        this.player.say(store().active === 'anger' ? 'A rock. In MY way. Press Q.' : 'It won’t budge. It’d take real force.', 3);
        if (store().active !== 'anger') useGame.getState().showToast('Hint: Anger’s Stand Up (Q) breaks through things that are stuck.', EMOTIONS.anger.color);
      },
      abilities: {
        anger: () => {
          if (store().flags.boulder) return;
          store().setFlag('boulder');
          this.camera.shake(24);
          this.game.audio.thud();
          this.particles.emit({ x: BOULDER_X, y: FLOOR - 90, count: 60, color: ['#6b58b4', '#3a2b72', '#F0412D', '#FFB13B'], shape: 'ember', speed: [200, 600], gravity: 900, life: [0.5, 1.2] });
          this.player.say('Path. Cleared. Silliness Island, here we come.', 3);
          store().showToast('Anger smashed the boulder', EMOTIONS.anger.color);
        },
      },
    });

    this.interactables.push({
      id: 'gossip',
      x: GOSSIP_X + 120,
      y: 270,
      range: 220,
      abilityRange: 420,
      hit: { x: GOSSIP_X + 30, y: 220, w: 200, h: 140 },
      label: () => (store().flags.gossip ? null : 'Listen to the whispering cloud'),
      interact: () => {
        this.player.say('“Psst, did you hear what Jess said about...” Hm. That doesn’t feel very honest Island-y.', 4);
        if (store().active !== 'disgust') useGame.getState().showToast('Hint: Disgust’s Nope (Q) rejects things that aren’t okay.', EMOTIONS.disgust.color);
      },
      abilities: {
        disgust: () => {
          if (store().flags.gossip) return;
          store().setFlag('gossip');
          this.gossip.flying = true;
          this.gossip.vy = -400;
          this.player.say('Gossip? Near Honesty Island? Absolutely not.', 3);
          store().showToast('Disgust rejected some gossip', EMOTIONS.disgust.color);
        },
        sadness: () => this.player.say('Whoever started that is probably feeling left out.', 3.4),
      },
    });
  }

  protected tick(dt: number) {
    const st = useGame.getState();
    for (const i of ISLANDS) {
      const target = i.id === 'friendship' ? (st.flags.friendshipCelebrated || this.celebrating > 0 ? 1 : 0) : st.islands[i.id] ? 1 : 0;
      this.lit[i.id] = damp(this.lit[i.id], target, i.id === 'friendship' ? 0.9 : 4, dt);
    }
    if (this.celebrating > 0) {
      this.celebrating += dt;
      if (this.celebrating < 3 && Math.random() < 0.6) {
        this.particles.emit({ x: VIEW.friendship + (Math.random() - 0.5) * 600, y: 300 + Math.random() * 200, count: 2, color: ['#3CC6B8', '#FFCF33', '#ffffff'], shape: 'star', speed: [20, 120], life: [0.6, 1.4] });
      }
    }
    this.boulder = damp(this.boulder, st.flags.boulder ? 0 : 1, 6, dt);
    this.edgeMark = damp(this.edgeMark, st.flags.edgeMarked ? 1 : 0, 4, dt);
    const g = this.gossip;
    if (g.flying) {
      g.y += g.vy * dt;
      g.x += 300 * dt;
      g.alpha = Math.max(0, g.alpha - dt);
    } else if (!st.flags.gossip) {
      g.x = GOSSIP_X + 120 + Math.sin(this.time * 0.6) * 40;
      g.y = 290 + Math.sin(this.time * 1.3) * 14;
    }

    // the boulder blocks the path until it's gone
    const p = this.player;
    if (!st.flags.boulder && p.x > BOULDER_X - 110) {
      p.x = BOULDER_X - 110;
      p.targetX = null;
    }
    // crumbling edge warning
    if (!st.flags.edgeMarked && !this.edgeWarned && Math.abs(p.x - EDGE_X) < 60) {
      this.edgeWarned = true;
      this.camera.shake(5);
      this.game.audio.thud();
      this.particles.emit({ x: EDGE_X, y: FLOOR - 4, count: 16, color: ['#4a3a8a', '#6b58b4'], shape: 'dot', speed: [40, 120], angle: [0, Math.PI], gravity: 600, additive: false });
      p.setPose('scared', 1);
      p.say('Whoa! The edge just crumbled a bit!', 2.6);
    }
    p.state.talking = !!st.dialogue && st.dialogue.lines[st.dialogue.index]?.speaker === p.id;

    if (this.panTo !== null) {
      this.camera.targetX = this.panTo;
      this.camera.targetY = STAGE_H / 2;
    }
  }

  render(ctx: Ctx) {
    const t = this.time;
    const cam = this.camera;
    const st = useGame.getState();
    drawSky(ctx, 0, 0, STAGE_W, STAGE_H, t, '#3CC6B8', 0.85);

    // far clouds
    ctx.save();
    cam.apply(ctx, 0.2);
    for (let i = 0; i < 6; i++) cloudBank(ctx, -300 + i * 700, 640 + hash(i) * 60, 500, '#5d49a8', 0.45, i);
    ctx.restore();

    // islands layer
    ctx.save();
    cam.apply(ctx, PARALLAX);
    for (const def of ISLANDS) {
      const ix = layerX(VIEW[def.id]);
      const iy = ISLAND_Y[def.id];
      const lit = this.lit[def.id];
      // light-thread bridges reach back toward the cliff
      if (lit > 0.02) lightBridge(ctx, ix, iy + 10, ix + 80, STAGE_H + 60, def.color, t, lit);
      drawIsland(ctx, def.id, ix, iy, 0.95, t, lit);
      ctx.font = `700 22px ${FONT_DISPLAY}`;
      signText(ctx, def.name, ix, iy + 150, 22, lit > 0.5 ? mixHex('#F3EEFF', def.color, 0.4) : '#8c80b8');
    }
    if (this.celebrating > 0 && this.celebrating < 3) {
      const k = this.celebrating / 3;
      const ix = layerX(VIEW.friendship);
      ctx.strokeStyle = rgba('#3CC6B8', 1 - k);
      ctx.lineWidth = 10 * (1 - k);
      ctx.beginPath();
      ctx.arc(ix, ISLAND_Y.friendship - 60, 80 + k * 600, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();

    // near clouds below the cliff
    ctx.save();
    cam.apply(ctx, 0.8);
    for (let i = 0; i < 8; i++) cloudBank(ctx, -200 + i * 560, 830, 480, '#9a84e6', 0.55, i + 20);
    ctx.restore();

    // the cliff path
    ctx.save();
    cam.apply(ctx, 1);
    this.drawCliff(ctx, t);
    this.drawDoor(ctx, DOOR_X, t);
    this.drawBoulder(ctx, t);
    this.drawGossip(ctx, t);
    for (const def of ISLANDS) this.drawViewpoint(ctx, VIEW[def.id], def.color, st.islands[def.id], t);
    this.drawActors(ctx);
    this.drawEffects(ctx);
    this.particles.render(ctx);
    ctx.restore();

    ctx.save();
    cam.apply(ctx, 1.4);
    for (let i = 0; i < 10; i++) ellipse(ctx, i * 480 + 60, 960, 220, 90, 'rgba(10,5,32,0.9)');
    ctx.restore();

    this.drawMoodLight(ctx);
    ctx.save();
    cam.apply(ctx, 1);
    this.drawBarks(ctx);
    this.drawPrompt(ctx);
    ctx.restore();
  }

  private drawCliff(ctx: Ctx, t: number) {
    // path surface
    ctx.fillStyle = '#5b4a9a';
    ctx.beginPath();
    ctx.moveTo(0, FLOOR - 14);
    for (let x = 0; x <= W; x += 80) ctx.lineTo(x, FLOOR - 14 + Math.sin(x * 0.02) * 3);
    ctx.lineTo(W, 900);
    ctx.lineTo(0, 900);
    ctx.fill();
    const g = ctx.createLinearGradient(0, FLOOR, 0, 900);
    g.addColorStop(0, '#3d2d78');
    g.addColorStop(1, '#120a30');
    ctx.fillStyle = g;
    ctx.fillRect(0, FLOOR + 8, W, 900 - FLOOR);
    // rocky texture
    for (let i = 0; i < 80; i++) {
      const x = hash(i * 3.1) * W;
      const y = FLOOR + 20 + hash(i * 7.7) * 100;
      ellipse(ctx, x, y, 30 + hash(i) * 40, 8 + hash(i * 2) * 8, 'rgba(10,5,32,0.25)');
    }
    // railing posts with lanterns along the back edge
    for (let x = 80; x < W; x += 180) {
      if (Math.abs(x - EDGE_X) < 120) continue;
      ctx.fillStyle = '#2a1f5c';
      roundRect(ctx, x - 5, FLOOR - 70, 10, 60, 4);
      ctx.fill();
      glow(ctx, x, FLOOR - 76, 40, '#FFCF33', 0.5 + 0.2 * Math.sin(t * 2 + x));
      circle(ctx, x, FLOOR - 76, 6, '#FFE58A');
    }
    ctx.strokeStyle = '#2a1f5c';
    ctx.lineWidth = 4;
    ctx.beginPath();
    let pen = false;
    for (let x = 80; x < W; x += 180) {
      if (Math.abs(x - EDGE_X) < 120) {
        pen = false;
        continue;
      }
      if (!pen) ctx.moveTo(x, FLOOR - 56);
      else ctx.lineTo(x, FLOOR - 56);
      pen = true;
    }
    ctx.stroke();
    // the crumbling stretch
    ctx.strokeStyle = 'rgba(10,5,32,0.7)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 5; i++) {
      const x = EDGE_X - 80 + i * 40;
      ctx.beginPath();
      ctx.moveTo(x, FLOOR - 14);
      ctx.lineTo(x + 8, FLOOR + 6);
      ctx.lineTo(x - 4, FLOOR + 22);
      ctx.stroke();
    }
    if (this.edgeMark > 0.01) {
      ctx.save();
      ctx.globalAlpha = this.edgeMark;
      for (let i = 0; i < 4; i++) {
        const x = EDGE_X - 90 + i * 60;
        ctx.fillStyle = EMOTIONS.fear.color;
        ctx.beginPath();
        ctx.moveTo(x, FLOOR - 60);
        ctx.lineTo(x - 14, FLOOR - 12);
        ctx.lineTo(x + 14, FLOOR - 12);
        ctx.fill();
        ctx.fillStyle = '#F3EEFF';
        ctx.fillRect(x - 9, FLOOR - 36, 18, 6);
      }
      signText(ctx, 'Crumbly. Keep back!', EDGE_X, FLOOR - 100, 20, EMOTIONS.fear.light);
      ctx.restore();
    }
  }

  private drawViewpoint(ctx: Ctx, x: number, color: string, on: boolean, t: number) {
    // a small telescope-post at each lookout
    ctx.fillStyle = '#2a1f5c';
    roundRect(ctx, x - 6, FLOOR - 100, 12, 90, 5);
    ctx.fill();
    ctx.save();
    ctx.translate(x, FLOOR - 100);
    ctx.rotate(-0.4);
    ctx.fillStyle = '#E7B76A';
    roundRect(ctx, -10, -10, 46, 18, 7);
    ctx.fill();
    ctx.restore();
    if (on) glow(ctx, x, FLOOR - 110, 60, color, 0.5 + 0.2 * Math.sin(t * 3));
    ellipse(ctx, x, FLOOR - 4, 50, 8, rgba(color, on ? 0.5 : 0.15));
  }

  private drawDoor(ctx: Ctx, x: number, t: number) {
    ctx.fillStyle = '#251a55';
    roundRect(ctx, x - 100, FLOOR - 320, 200, 320, [100, 100, 0, 0]);
    ctx.fill();
    const g = ctx.createRadialGradient(x, FLOOR - 120, 10, x, FLOOR - 120, 180);
    g.addColorStop(0, 'rgba(255,230,150,0.95)');
    g.addColorStop(1, 'rgba(255,190,80,0.3)');
    ctx.fillStyle = g;
    roundRect(ctx, x - 82, FLOOR - 300, 164, 300, [84, 84, 0, 0]);
    ctx.fill();
    ctx.strokeStyle = '#E7B76A';
    ctx.lineWidth = 7;
    roundRect(ctx, x - 100, FLOOR - 320, 200, 320, [100, 100, 0, 0]);
    ctx.stroke();
    glow(ctx, x, FLOOR - 140, 220, '#FFCF33', 0.35 + 0.05 * Math.sin(t * 2));
    signText(ctx, 'Headquarters', x, FLOOR - 352, 22, '#FFF1B0');
  }

  private drawBoulder(ctx: Ctx, t: number) {
    if (this.boulder < 0.02) return;
    ctx.save();
    ctx.globalAlpha = this.boulder;
    const x = BOULDER_X;
    const y = FLOOR - 10;
    const s = 0.6 + this.boulder * 0.4;
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.fillStyle = '#4a3a8a';
    ctx.beginPath();
    ctx.moveTo(-110, 0);
    ctx.quadraticCurveTo(-120, -120, -40, -170);
    ctx.quadraticCurveTo(40, -200, 100, -130);
    ctx.quadraticCurveTo(140, -60, 110, 0);
    ctx.fill();
    ctx.fillStyle = '#5e4ca6';
    ctx.beginPath();
    ctx.ellipse(-30, -120, 50, 30, -0.4, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(10,5,32,0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-20, -160);
    ctx.lineTo(0, -100);
    ctx.lineTo(-30, -50);
    ctx.stroke();
    ctx.restore();
    void t;
  }

  private drawGossip(ctx: Ctx, t: number) {
    const g = this.gossip;
    if (g.alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = g.alpha;
    glow(ctx, g.x, g.y, 140, '#8b86a0', 0.5);
    ctx.fillStyle = '#9c96b4';
    ctx.beginPath();
    [
      [-60, 10, 36],
      [-20, -14, 44],
      [30, -4, 40],
      [64, 12, 28],
      [0, 20, 40],
    ].forEach(([px, py, pr]) => {
      ctx.moveTo(g.x + px + pr, g.y + py);
      ctx.arc(g.x + px, g.y + py + Math.sin(t * 2 + px) * 3, pr, 0, TAU);
    });
    ctx.fill();
    ctx.fillStyle = '#2a2640';
    ctx.font = `800 18px ${FONT_DISPLAY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('psst... did you', g.x, g.y);
    ctx.fillText('hear about...', g.x, g.y + 22);
    ctx.restore();
  }
}
