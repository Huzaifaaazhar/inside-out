import { STAGE_H, STAGE_W, view } from '../engine/camera';
import type { Ctx } from '../engine/draw';
import { FONT_BODY, FONT_DISPLAY, glow, rgba, roundRect, wrapText } from '../engine/draw';
import { TAU, clamp, damp, easeOutCubic } from '../engine/math';
import { isBlocking, useGame } from '../state/store';
import type { CharState, Pose } from './art/characters';
import { HEAD_Y, defaultCharState, drawEmotion } from './art/characters';
import type { EmotionId } from './content/emotions';
import { EMOTIONS } from './content/emotions';
import { Scene } from './Scene';

const pick = <T,>(arr: T[]) => arr[(Math.random() * arr.length) | 0];

export class Actor {
  state: CharState;
  targetX: number | null = null;
  homeX: number;
  bark: { text: string; t: number; dur: number } | null = null;
  private poseTimer = 0;
  private lastStep = 0;
  wanderT = 2 + Math.random() * 4;
  speedMul = 1;

  constructor(public id: EmotionId, public x: number, public y: number, seed = 0) {
    this.state = defaultCharState(seed);
    this.homeX = x;
  }

  get speed() {
    return EMOTIONS[this.id].speed * this.speedMul;
  }

  setPose(p: Pose, dur = 1.2) {
    this.state.pose = p;
    this.state.poseT = 0;
    this.poseTimer = dur;
  }

  say(text: string, dur = 3.2) {
    this.bark = { text, t: 0, dur };
  }

  /** Move by input axis (-1..1). Returns true when a footstep should sound. */
  update(dt: number, axis: number, bounds: [number, number]) {
    const s = this.state;
    s.t += dt;
    s.poseT += dt;
    if (this.poseTimer > 0) {
      this.poseTimer -= dt;
      if (this.poseTimer <= 0) s.pose = 'idle';
    }
    if (this.bark) {
      this.bark.t += dt;
      if (this.bark.t > this.bark.dur) this.bark = null;
    }
    let vx = 0;
    if (axis !== 0) {
      vx = axis * this.speed;
      this.targetX = null;
    } else if (this.targetX !== null) {
      const dx = this.targetX - this.x;
      if (Math.abs(dx) < 6) this.targetX = null;
      else vx = Math.sign(dx) * Math.min(this.speed, Math.abs(dx) * 6);
    }
    this.x = clamp(this.x + vx * dt, bounds[0], bounds[1]);
    s.moving = Math.abs(vx) > 5;
    if (s.moving) {
      s.facing = vx > 0 ? 1 : -1;
      s.walk += (dt * Math.abs(vx)) / (this.id === 'fear' ? 22 : this.id === 'sadness' ? 18 : 26);
    } else {
      s.walk = damp(s.walk, Math.round(s.walk / Math.PI) * Math.PI, 10, dt);
    }
    s.look = damp(s.look, s.moving ? s.facing * 0.6 : s.look, 6, dt);
    const stepIndex = Math.floor(s.walk / Math.PI);
    const stepped = s.moving && stepIndex !== this.lastStep;
    this.lastStep = stepIndex;
    return stepped;
  }

  draw(ctx: Ctx, scale = 1) {
    drawEmotion(ctx, this.id, this.x, this.y, this.state, scale);
  }

  headY(scale = 1) {
    return this.y + HEAD_Y[this.id] * scale;
  }
}

export interface Interactable {
  id: string;
  x: number;
  y: number;
  /** How close (horizontally) the player must be. */
  range: number;
  /** Click/tap box in world space. */
  hit?: { x: number; y: number; w: number; h: number };
  /** Text after the key hint, e.g. "Talk to Sadness". Return null to hide. */
  label: () => string | null;
  interact: () => void;
  /** Per-emotion field ability reactions. */
  abilities?: Partial<Record<EmotionId, () => void>>;
  abilityRange?: number;
  /** Higher wins when several things react to the same ability. Objects beat crowd reactions. */
  priority?: number;
}

type EffectKind = 'burst' | 'ripple' | 'scan' | 'swipe' | 'shock';
interface Effect {
  kind: EffectKind;
  x: number;
  y: number;
  t: number;
  dur: number;
  color: string;
  dir: 1 | -1;
}

/**
 * Base for walkable side-scrolling areas: the player avatar is the active emotion.
 */
export abstract class WorldScene extends Scene {
  abstract worldW: number;
  floorY = 760;
  actors: Actor[] = [];
  interactables: Interactable[] = [];
  nearest: Interactable | null = null;
  private pendingInteract: Interactable | null = null;
  private timers: { t: number; fn: () => void }[] = [];
  private effects: Effect[] = [];
  private abilityCooldown = 0;
  /** Swallows input for a moment after an overlay closes, so one key press never does two things. */
  private unblockGrace = 0;
  /** Set by subclasses (e.g. the console) to freeze free movement. */
  locked = false;
  /** Scene-specific ambient light colour mixed with the active emotion. */
  roomLight = 0.16;
  actorScale = 1;

  get player(): Actor {
    const id = useGame.getState().active;
    return this.actors.find((a) => a.id === id) ?? this.actors[0];
  }

  later(t: number, fn: () => void) {
    this.timers.push({ t, fn });
  }

  enter(spawn?: number) {
    this.camera.setWorld(this.worldW, STAGE_H);
    if (spawn !== undefined) this.player.x = spawn;
    this.player.targetX = null;
    this.camera.targetX = this.player.x;
    this.camera.targetY = STAGE_H / 2;
    this.camera.snap();
  }

  exit() {
    this.pendingInteract = null;
    useGame.getState().setPrompt(null);
  }

  /** Swap the controlled emotion in place, with a little poof. */
  onEmotionChanged(prev: EmotionId, next: EmotionId) {
    const prevActor = this.actors.find((a) => a.id === prev);
    const nextActor = this.actors.find((a) => a.id === next);
    if (prevActor && nextActor) {
      // HQ: both exist. The newcomer tags in at the operator's spot.
      const x = prevActor.x;
      nextActor.x = x;
      nextActor.targetX = null;
      nextActor.state.facing = prevActor.state.facing;
      prevActor.x = x - 46 * prevActor.state.facing;
      prevActor.targetX = prevActor.homeX;
    } else if (prevActor && !nextActor) {
      // Other areas: only the operator is here, so they become someone else.
      prevActor.id = next;
    }
    const p = this.player;
    p.setPose(next === 'fear' ? 'scared' : next === 'sadness' ? 'slump' : 'cheer', 0.9);
    p.say(pick(EMOTIONS[next].tagIn), 2.6);
    this.particles.emit({ x: p.x, y: p.y - 70, count: 26, color: [EMOTIONS[next].color, EMOTIONS[next].light], shape: 'star', speed: [60, 220], life: [0.5, 1] });
    this.particles.emit({ x: p.x, y: p.y - 70, count: 1, color: EMOTIONS[next].color, shape: 'ring', speed: [0, 0], life: [0.6, 0.6], size: [30, 30] });
  }

  /** Emotion-specific field ability (Q). */
  useAbility() {
    if (this.abilityCooldown > 0) return;
    this.abilityCooldown = 1.1;
    const p = this.player;
    const id = p.id;
    const E = EMOTIONS[id];
    p.setPose(id === 'fear' ? 'ability' : 'ability', 1.3);
    this.game.audio.ability(id);
    const fx: Record<EmotionId, EffectKind> = { joy: 'burst', sadness: 'ripple', anger: 'shock', fear: 'scan', disgust: 'swipe' };
    this.effects.push({ kind: fx[id], x: p.x, y: p.y - 60, t: 0, dur: id === 'sadness' ? 2 : 1.1, color: E.color, dir: p.state.facing });
    switch (id) {
      case 'joy':
        this.particles.emit({ x: p.x, y: p.y - 100, count: 50, color: ['#FFCF33', '#FFF1B0', '#ffffff'], shape: 'star', speed: [120, 420], life: [0.6, 1.4], gravity: 120 });
        break;
      case 'sadness':
        this.particles.emit({ x: p.x, y: p.y - 140, count: 26, color: ['#3D7BFF', '#BBD2FF'], shape: 'drop', speed: [20, 70], angle: [Math.PI * 0.3, Math.PI * 0.7], life: [1.2, 2.2], gravity: 60, spread: 60, additive: false });
        break;
      case 'anger':
        this.camera.shake(14);
        this.particles.emit({ x: p.x, y: p.y - 10, count: 40, color: ['#F0412D', '#FFB13B', '#FFE07A'], shape: 'ember', speed: [200, 520], angle: [Math.PI, TAU], life: [0.4, 0.9], gravity: 600 });
        break;
      case 'fear':
        this.particles.emit({ x: p.x, y: p.y - 150, count: 14, color: ['#A05CF0', '#DDC4FF'], shape: 'spark', speed: [200, 400], life: [0.3, 0.6] });
        break;
      case 'disgust':
        this.particles.emit({ x: p.x + p.state.facing * 60, y: p.y - 90, count: 24, color: ['#52C46B', '#C2F0CC'], shape: 'bubble', speed: [100, 260], angle: p.state.facing > 0 ? [-0.6, 0.6] : [Math.PI - 0.6, Math.PI + 0.6], life: [0.6, 1.2], size: [4, 9] });
        break;
    }
    // find something to act on
    let best: Interactable | null = null;
    let bestD = Infinity;
    let bestP = -Infinity;
    for (const it of this.interactables) {
      const fn = it.abilities?.[id];
      if (!fn) continue;
      const d = Math.abs(it.x - p.x);
      const pr = it.priority ?? 0;
      if (d <= (it.abilityRange ?? 420) && (pr > bestP || (pr === bestP && d < bestD))) {
        best = it;
        bestD = d;
        bestP = pr;
      }
    }
    if (best) {
      const fn = best.abilities![id]!;
      this.later(0.4, fn);
    } else {
      this.later(0.5, () => p.say(pick(E.abilityIdle), 2.8));
    }
  }

  /** For the on-screen Interact button. */
  interactNearest() {
    if (this.nearest) this.interactWith(this.nearest);
  }

  protected interactWith(it: Interactable) {
    this.game.audio.blip();
    const p = this.player;
    p.state.facing = it.x >= p.x ? 1 : -1;
    it.interact();
  }

  /** Subclasses can override to add per-frame logic. */
  protected tick(_dt: number) {}

  update(dt: number) {
    this.time += dt;
    this.abilityCooldown = Math.max(0, this.abilityCooldown - dt);
    for (let i = this.timers.length - 1; i >= 0; i--) {
      const tm = this.timers[i];
      tm.t -= dt;
      if (tm.t <= 0) {
        this.timers.splice(i, 1);
        tm.fn();
      }
    }
    const st = useGame.getState();
    const blocked = isBlocking(st) || this.locked || st.phase !== 'playing';
    const input = this.game.input;
    const p = this.player;
    if (blocked) this.unblockGrace = 0.2;
    else this.unblockGrace = Math.max(0, this.unblockGrace - dt);

    let axis = 0;
    if (!blocked) {
      axis = input.axisX;
    }
    if (!blocked && this.unblockGrace <= 0) {
      if (input.pointer.pressed) {
        const w = this.camera.screenToWorld(input.pointer.x, input.pointer.y);
        const hitIt = this.interactables.find((it) => it.hit && it.label() && w.x >= it.hit.x && w.x <= it.hit.x + it.hit.w && w.y >= it.hit.y && w.y <= it.hit.y + it.hit.h);
        if (hitIt) {
          if (Math.abs(hitIt.x - p.x) <= hitIt.range) {
            this.interactWith(hitIt);
          } else {
            this.pendingInteract = hitIt;
            p.targetX = hitIt.x + (p.x < hitIt.x ? -hitIt.range * 0.6 : hitIt.range * 0.6);
          }
        } else {
          this.pendingInteract = null;
          p.targetX = clamp(w.x, 60, this.worldW - 60);
        }
      }
      if (axis !== 0) this.pendingInteract = null;
      if (input.pressed('KeyE', 'Enter', 'NumpadEnter') && this.nearest) {
        this.interactWith(this.nearest);
      }
      if (input.pressed('KeyQ')) this.useAbility();
    }

    for (const a of this.actors) {
      const isPlayer = a === p;
      const stepped = a.update(dt, isPlayer ? axis : 0, [60, this.worldW - 60]);
      if (stepped && isPlayer) {
        this.game.audio.footstep(a.id);
        if (a.id === 'anger') this.camera.shake(2.5);
        if (a.id === 'joy' && Math.random() < 0.5) this.particles.emit({ x: a.x, y: a.y - 4, count: 3, color: '#FFF1B0', shape: 'star', speed: [20, 60], angle: [Math.PI, TAU], life: [0.3, 0.6], size: [1.5, 3] });
      }
    }

    // nearest interactable
    let near: Interactable | null = null;
    let nd = Infinity;
    for (const it of this.interactables) {
      if (!it.label()) continue;
      const d = Math.abs(it.x - p.x);
      if (d <= it.range && d < nd) {
        near = it;
        nd = d;
      }
    }
    this.nearest = blocked ? null : near;
    st.setPrompt(this.nearest ? this.nearest.label() : null);

    if (this.pendingInteract && !blocked && p.targetX === null) {
      const it = this.pendingInteract;
      this.pendingInteract = null;
      if (Math.abs(it.x - p.x) <= it.range + 4) this.interactWith(it);
    }

    this.tick(dt);

    if (!this.locked) {
      this.camera.targetX = p.x + p.state.facing * Math.min(90, view.w * 0.06);
      this.camera.targetY = STAGE_H / 2;
      this.camera.targetZoom = 1;
    }
    this.camera.update(dt, st.reducedMotion);
    this.particles.update(dt);
    for (let i = this.effects.length - 1; i >= 0; i--) {
      this.effects[i].t += dt;
      if (this.effects[i].t > this.effects[i].dur) this.effects.splice(i, 1);
    }
  }

  // ───────────────────────────── rendering helpers ─────────────────────────────

  protected drawActors(ctx: Ctx) {
    const p = this.player;
    const sorted = [...this.actors].sort((a, b) => (a === p ? 1 : 0) - (b === p ? 1 : 0));
    for (const a of sorted) {
      a.state.highlight = damp(a.state.highlight, a === p ? 1 : 0, 6, 1 / 60);
      a.draw(ctx, this.actorScale);
    }
  }

  protected drawEffects(ctx: Ctx) {
    for (const e of this.effects) {
      const k = e.t / e.dur;
      const ek = easeOutCubic(k);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      switch (e.kind) {
        case 'burst': {
          glow(ctx, e.x, e.y, 380 * ek, e.color, 1 - k);
          ctx.strokeStyle = rgba(e.color, 1 - k);
          ctx.lineWidth = 8 * (1 - k);
          ctx.beginPath();
          ctx.arc(e.x, e.y, 420 * ek, 0, TAU);
          ctx.stroke();
          break;
        }
        case 'shock': {
          ctx.strokeStyle = rgba(e.color, 1 - k);
          ctx.lineWidth = 14 * (1 - k);
          ctx.beginPath();
          ctx.ellipse(e.x, e.y + 60, 460 * ek, 60 * ek, 0, 0, TAU);
          ctx.stroke();
          glow(ctx, e.x, e.y + 40, 200 * (1 - k * 0.5), '#FFB13B', 1 - k);
          break;
        }
        case 'ripple': {
          for (let i = 0; i < 3; i++) {
            const kk = clamp(k * 1.4 - i * 0.2, 0, 1);
            ctx.strokeStyle = rgba(e.color, 0.7 * (1 - kk));
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.ellipse(e.x, e.y + 60, 420 * easeOutCubic(kk), 70 * easeOutCubic(kk), 0, 0, TAU);
            ctx.stroke();
          }
          glow(ctx, e.x, e.y - 20, 240, e.color, 0.6 * (1 - k));
          break;
        }
        case 'scan': {
          // a radar cone sweeping ahead
          const r = 460 * ek;
          const a0 = e.dir > 0 ? -0.6 : Math.PI - 0.6;
          const sweep = a0 + (Math.sin(k * Math.PI * 2) * 0.5 + 0.5) * 1.2;
          const g = ctx.createRadialGradient(e.x, e.y - 80, 0, e.x, e.y - 80, r);
          g.addColorStop(0, rgba(e.color, 0.5 * (1 - k)));
          g.addColorStop(1, rgba(e.color, 0));
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(e.x, e.y - 80);
          ctx.arc(e.x, e.y - 80, r, sweep - 0.25, sweep + 0.25);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = rgba(e.color, 0.6 * (1 - k));
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 10]);
          ctx.beginPath();
          ctx.arc(e.x, e.y - 80, r, 0, TAU);
          ctx.stroke();
          ctx.setLineDash([]);
          break;
        }
        case 'swipe': {
          const cx = e.x + e.dir * 280 * ek;
          ctx.strokeStyle = rgba(e.color, 0.9 * (1 - k));
          ctx.lineWidth = 18 * (1 - k) + 2;
          ctx.lineCap = 'round';
          ctx.beginPath();
          if (e.dir > 0) ctx.arc(cx - 80, e.y - 20, 120, -0.9, 0.9);
          else ctx.arc(cx + 80, e.y - 20, 120, Math.PI - 0.9, Math.PI + 0.9);
          ctx.stroke();
          break;
        }
      }
      ctx.restore();
    }
  }

  /** Speech-bubble barks above actors, drawn in world space. */
  protected drawBarks(ctx: Ctx) {
    for (const a of this.actors) {
      if (!a.bark) continue;
      this.drawBubble(ctx, a.x, a.headY(this.actorScale) - 22, a.bark.text, EMOTIONS[a.id].color, a.bark.t, a.bark.dur);
    }
  }

  protected drawBubble(ctx: Ctx, x: number, y: number, text: string, color: string, t: number, dur: number) {
    const appear = clamp(t / 0.18, 0, 1);
    const fade = clamp((dur - t) / 0.3, 0, 1);
    const a = Math.min(appear, fade);
    if (a <= 0) return;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font = `700 19px ${FONT_BODY}`;
    const lines = wrapText(ctx, text, 280);
    const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 32;
    const h = lines.length * 24 + 20;
    const bx = clamp(x - w / 2, this.camera.x - view.w / 2 / this.camera.zoom + 10, this.camera.x + view.w / 2 / this.camera.zoom - w - 10);
    const by = y - h - 14 + (1 - easeOutCubic(appear)) * 10;
    ctx.fillStyle = 'rgba(14,8,44,0.35)';
    roundRect(ctx, bx + 3, by + 5, w, h, 16);
    ctx.fill();
    ctx.fillStyle = '#FBF8FF';
    roundRect(ctx, bx, by, w, h, 16);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.stroke();
    // tail
    ctx.fillStyle = '#FBF8FF';
    ctx.beginPath();
    const tx = clamp(x, bx + 20, bx + w - 20);
    ctx.moveTo(tx - 10, by + h - 1);
    ctx.lineTo(tx, by + h + 14);
    ctx.lineTo(tx + 10, by + h - 1);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(tx - 10, by + h);
    ctx.lineTo(tx, by + h + 14);
    ctx.lineTo(tx + 10, by + h);
    ctx.stroke();
    ctx.fillStyle = '#21164f';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    lines.forEach((l, i) => ctx.fillText(l, bx + 16, by + 11 + i * 24));
    ctx.restore();
  }

  /** The floating key-hint near the focused interactable. */
  protected drawPrompt(ctx: Ctx) {
    const it = this.nearest;
    if (!it) return;
    const label = it.label();
    if (!label) return;
    const bob = Math.sin(this.time * 4) * 3;
    const x = it.x;
    const y = it.y - 20 + bob;
    const keyboard = this.game.input.lastDevice === 'keyboard';
    ctx.save();
    ctx.font = `700 18px ${FONT_BODY}`;
    const tw = ctx.measureText(label).width;
    const kw = keyboard ? 30 : 0;
    const w = tw + kw + 34;
    const viewL = this.camera.x - view.w / 2 / this.camera.zoom + 12;
    const viewR = this.camera.x + view.w / 2 / this.camera.zoom - 12;
    const bx = clamp(x - w / 2, viewL, viewR - w);
    ctx.fillStyle = 'rgba(14,8,44,0.82)';
    roundRect(ctx, bx, y - 40, w, 40, 20);
    ctx.fill();
    ctx.strokeStyle = rgba(EMOTIONS[useGame.getState().active].color, 0.9);
    ctx.lineWidth = 2;
    ctx.stroke();
    if (keyboard) {
      ctx.fillStyle = '#F3EEFF';
      roundRect(ctx, bx + 10, y - 32, 26, 24, 6);
      ctx.fill();
      ctx.fillStyle = '#21164f';
      ctx.font = `800 15px ${FONT_DISPLAY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('E', bx + 23, y - 19);
    }
    ctx.font = `700 18px ${FONT_BODY}`;
    ctx.fillStyle = '#F3EEFF';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, bx + 17 + kw, y - 20);
    ctx.restore();
  }

  /** Re-light the whole scene in the active emotion's colour. */
  protected drawMoodLight(ctx: Ctx) {
    const st = useGame.getState();
    const col = EMOTIONS[st.active].color;
    ctx.save();
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = rgba(col, this.roomLight * 2.2);
    ctx.fillRect(0, 0, STAGE_W, STAGE_H);
    ctx.globalCompositeOperation = 'source-over';
    const g = ctx.createRadialGradient(STAGE_W / 2, STAGE_H * 0.55, 100, STAGE_W / 2, STAGE_H / 2, STAGE_W * 0.75);
    g.addColorStop(0, 'rgba(8,4,28,0)');
    g.addColorStop(1, 'rgba(8,4,28,0.6)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, STAGE_W, STAGE_H);
    ctx.restore();
  }
}
