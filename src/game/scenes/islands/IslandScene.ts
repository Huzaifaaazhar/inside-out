import { STAGE_H, STAGE_W, view } from '../../../engine/camera';
import type { Ctx } from '../../../engine/draw';
import { glow, memoryOrb, rgba, roundRect, signText } from '../../../engine/draw';
import { clamp, hash } from '../../../engine/math';
import { useGame } from '../../../state/store';
import type { Activity } from '../../activities';
import type { Rect } from '../../art/screen';
import { EMOTIONS } from '../../content/emotions';
import type { IslandId } from '../../content/world';
import { ISLANDS } from '../../content/world';
import type { Game } from '../../Game';
import type { SceneId } from '../../Scene';
import type { Deltas } from '../../systems/mind';
import { BAND_LABEL, islandTarget, stabilityBand } from '../../systems/mind';
import { allEntries } from '../../systems/library';
import { Actor } from '../../WorldScene';
import { ActivityScene } from '../../ActivityScene';

/** Last stability the player saw on each island, to notice drops between visits. */
const lastSeen: Partial<Record<IslandId, number>> = {};

export const HUB_SPAWN: Record<IslandId, number> = { family: 640, friendship: 1120, hockey: 1600, goofball: 3060, honesty: 2000, curiosity: 2440 };

export abstract class IslandScene extends ActivityScene {
  abstract readonly id: SceneId;
  abstract readonly island: IslandId;
  worldW = 2800;
  floorY = 760;
  private activityReward: { deltas: Deltas; text: string } | null = null;
  protected heartX = 580;

  constructor(game: Game) {
    super(game);
    this.actors = [new Actor('joy', 260, 760, 11)];
    this.roomLight = 0.1;
  }

  get stability() {
    return useGame.getState().mind?.islands[this.island] ?? 60;
  }
  get band() {
    return stabilityBand(this.stability);
  }
  get def() {
    return ISLANDS.find((i) => i.id === this.island)!;
  }

  /** Called by subclasses after setting up their own interactables. */
  protected buildCommon() {
    const store = () => useGame.getState();
    this.interactables.push({
      id: 'bridge',
      x: 170,
      y: this.floorY - 300,
      range: 130,
      hit: { x: 80, y: this.floorY - 300, w: 180, h: 300 },
      label: () => 'Cross the bridge back to the cliffs',
      interact: () => store().travel('islands', 'glide', HUB_SPAWN[this.island]),
    });
    this.interactables.push({
      id: 'heart',
      x: this.heartX,
      y: this.floorY - 250,
      range: 120,
      hit: { x: this.heartX - 70, y: this.floorY - 240, w: 140, h: 240 },
      label: () => `Read the heart of ${this.def.name}`,
      interact: () => this.showHeart(),
      abilities: {
        joy: () => {
          if (store().rewardActivity(`cheer-${this.island}`, { islands: { [this.island]: 2 } }, `Joy cheered up ${this.def.name}.`)) this.player.say('Come on, little island! You’ve got this!', 2.6);
          else this.player.say('I already cheered it on today. It knows.', 2.6);
        },
        sadness: () => this.player.say(this.whyText(), 4.6),
      },
    });
  }

  /** Plain-language reasons for the island's state, from the consequence engine. */
  private whyText() {
    const st = useGame.getState();
    const mind = st.mind;
    if (!mind) return 'It’s quiet here.';
    const ups: string[] = [];
    const downs: string[] = [];
    for (const e of allEntries(mind)) {
      if (e.island !== this.island) continue;
      const m = mind.memories[e.id];
      if (!m) continue;
      if (m.status === 'core') ups.push(`the core memory “${e.title}”`);
      else if (m.status === 'long-term' && e.significance === 'important') ups.push(`“${e.title}”`);
      else if ((m.status === 'forgotten' || m.status === 'released') && e.significance === 'important') downs.push(`losing “${e.title}”`);
    }
    const target = islandTarget(this.island, mind, allEntries(mind));
    const trend = target > this.stability + 3 ? 'It’s getting stronger.' : target < this.stability - 3 ? 'It’s slipping.' : 'It’s holding steady.';
    return `${ups.length ? 'Held up by ' + ups.slice(0, 2).join(' and ') + '. ' : ''}${downs.length ? 'Hurt by ' + downs.join(', ') + '. ' : ''}${trend}`;
  }

  private showHeart() {
    const st = useGame.getState();
    const v = Math.round(this.stability);
    st.setInspect({
      kicker: `${BAND_LABEL[this.band]}: ${v} out of 100`,
      title: this.def.name,
      body: this.band === 'thriving' || this.band === 'steady' ? this.def.lit : this.def.dark,
      color: this.def.color,
      extra: this.whyText(),
    });
  }

  enter(spawn?: number) {
    this.actors[0].id = useGame.getState().active;
    super.enter(spawn ?? 300);
    const prev = lastSeen[this.island];
    const now = this.stability;
    lastSeen[this.island] = now;
    if (prev !== undefined && now < prev - 6) {
      this.later(0.8, () => {
        this.camera.shake(10);
        this.game.audio.thud();
        this.player.setPose('scared', 1.2);
        this.player.say(`${this.def.name} shudders. It’s weaker than last time.`, 3.6);
      });
    } else if (prev !== undefined && now > prev + 6) {
      this.later(0.8, () => this.player.say(`${this.def.name} feels brighter than last time!`, 3.2));
    } else if (prev === undefined) {
      this.later(0.8, () => this.player.say(this.firstVisitLine(), 3.6));
    }
  }


  protected abstract firstVisitLine(): string;

  /** Start an island activity. Crumbling islands can't host them. */
  protected startActivity(id: string, make: () => Activity, rect: Rect, reward: { deltas: Deltas; text: string }, closedLine: string) {
    const st = useGame.getState();
    if (this.band === 'crumbling') {
      st.say([{ speaker: st.active, text: closedLine }, { speaker: 'console', text: `${this.def.name} is crumbling. What happens in Riley’s days is what rebuilds it.` }]);
      return;
    }
    this.activityReward = reward;
    this.hostActivity(id, make(), rect);
  }

  protected onActivityDone(a: Activity, id: string, completed: boolean) {
    const st = useGame.getState();
    if (!completed || !this.activityReward) return;
    const scale = a.score >= 0.5 ? 1 : 0.5;
    const d: Deltas = {
      stats: Object.fromEntries(Object.entries(this.activityReward.deltas.stats ?? {}).map(([k, v]) => [k, Math.round((v ?? 0) * scale)])),
      islands: Object.fromEntries(Object.entries(this.activityReward.deltas.islands ?? {}).map(([k, v]) => [k, Math.round((v ?? 0) * scale)])),
    };
    const paid = st.rewardActivity(id, d, this.activityReward.text);
    if (paid) st.showToast(`${this.activityReward.text} ${this.def.name} feels steadier.`, this.def.color);
    else st.showToast('Just for fun this time. Activities steady an island once a day.', this.def.color);
    this.player.setPose('cheer', 1.2);
  }

  protected tick(dt: number) {
    const st = useGame.getState();
    this.player.state.talking = !!st.dialogue && st.dialogue.lines[st.dialogue.index]?.speaker === this.player.id;
    if (this.band === 'crumbling' && Math.random() < dt * 2) {
      const x = this.camera.x + (Math.random() - 0.5) * view.w;
      this.particles.emit({ x, y: -20, count: 1, color: ['#5a4a6a', '#3a2f50'], shape: 'dot', speed: [40, 80], angle: [Math.PI * 0.45, Math.PI * 0.55], gravity: 500, life: [2, 3], size: [3, 7], additive: false });
      if (Math.random() < 0.08) this.camera.shake(3);
    }
    this.tickActivity(dt);
    this.islandTick(dt);
  }

  protected islandTick(_dt: number) {}

  // ───────────────────────────── shared drawing ─────────────────────────────

  protected abstract drawSkyLayer(ctx: Ctx): void;
  protected abstract drawWorld(ctx: Ctx): void;
  protected drawFront(_ctx: Ctx) {}

  render(ctx: Ctx) {
    this.drawSkyLayer(ctx);
    ctx.save();
    this.camera.apply(ctx, 1);
    this.drawWorld(ctx);
    this.drawBridge(ctx);
    this.drawHeart(ctx);
    this.drawCracks(ctx);
    this.drawActors(ctx);
    this.drawEffects(ctx);
    this.renderActivity(ctx);
    this.particles.render(ctx);
    ctx.restore();
    ctx.save();
    this.camera.apply(ctx, 1.3);
    this.drawFront(ctx);
    ctx.restore();
    this.drawDrain(ctx);
    this.drawMoodLight(ctx);
    ctx.save();
    this.camera.apply(ctx, 1);
    this.drawBarks(ctx);
    if (!this.activity) this.drawPrompt(ctx);
    ctx.restore();
  }

  /** A shaky island loses its colour. */
  private drawDrain(ctx: Ctx) {
    const a = clamp((55 - this.stability) / 55, 0, 0.75);
    if (a <= 0.01) return;
    ctx.save();
    ctx.globalCompositeOperation = 'saturation';
    ctx.fillStyle = `rgba(128,128,128,${a})`;
    ctx.fillRect(0, 0, STAGE_W, STAGE_H);
    ctx.restore();
  }

  private drawCracks(ctx: Ctx) {
    const s = this.stability;
    if (s >= 45) return;
    const n = Math.round((45 - s) / 4);
    ctx.strokeStyle = 'rgba(15,8,30,0.6)';
    ctx.lineWidth = 3;
    for (let i = 0; i < n; i++) {
      const x = 300 + hash(i * 7.3) * (this.worldW - 500);
      ctx.beginPath();
      ctx.moveTo(x, this.floorY + 4);
      ctx.lineTo(x + 14, this.floorY + 30);
      ctx.lineTo(x - 6, this.floorY + 60);
      ctx.lineTo(x + 10, this.floorY + 110);
      ctx.stroke();
    }
  }

  private drawBridge(ctx: Ctx) {
    const x = 170;
    const y = this.floorY;
    ctx.strokeStyle = rgba(this.def.color, 0.8);
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(x - 160, y - 30);
    ctx.quadraticCurveTo(x - 60, y + 10, x + 40, y - 6);
    ctx.stroke();
    glow(ctx, x - 40, y - 20, 120, this.def.color, 0.5);
    ctx.fillStyle = '#2a1f5c';
    roundRect(ctx, x - 70, y - 220, 14, 220, 6);
    ctx.fill();
    roundRect(ctx, x + 56, y - 220, 14, 220, 6);
    ctx.fill();
    ctx.fillStyle = this.def.color;
    roundRect(ctx, x - 80, y - 240, 160, 34, 17);
    ctx.fill();
    signText(ctx, 'To the cliffs', x, y - 223, 18, '#21164f');
  }

  private drawHeart(ctx: Ctx) {
    const x = this.heartX;
    const y = this.floorY;
    const st = useGame.getState();
    const core = Object.entries(st.mind?.memories ?? {}).find(([id, m]) => m.status === 'core' && allEntries(st.mind).find((e) => e.id === id)?.island === this.island);
    ctx.fillStyle = '#2a1f5c';
    ctx.beginPath();
    ctx.moveTo(x - 50, y);
    ctx.quadraticCurveTo(x - 24, y - 90, x - 20, y - 150);
    ctx.lineTo(x + 20, y - 150);
    ctx.quadraticCurveTo(x + 24, y - 90, x + 50, y);
    ctx.fill();
    ctx.strokeStyle = '#E7B76A';
    ctx.lineWidth = 4;
    ctx.stroke();
    const k = clamp(this.stability / 100, 0, 1);
    glow(ctx, x, y - 190, 120 + 80 * k, this.def.color, 0.3 + k * 0.7);
    if (core) memoryOrb(ctx, x, y - 190 + Math.sin(this.time * 2) * 4, 30, EMOTIONS[core[1].emotion].color, { t: this.time, swirl: core[1].swirl.map((e) => EMOTIONS[e].color), glowAmt: 0.4 + k });
    else memoryOrb(ctx, x, y - 190, 26, '#8d8a9e', { faded: 0.8 });
    // stability ring
    ctx.strokeStyle = rgba('#000000', 0.25);
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(x, y - 190, 46, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = this.def.color;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(x, y - 190, 46, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2);
    ctx.stroke();
  }
}
