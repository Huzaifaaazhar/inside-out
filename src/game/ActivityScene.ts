import { STAGE_H, STAGE_W, view } from '../engine/camera';
import type { Ctx } from '../engine/draw';
import { useGame } from '../state/store';
import type { Activity } from './activities';
import { BraceletWeave } from './activities';
import type { Rect } from './art/screen';
import { WorldScene } from './WorldScene';

/**
 * A walkable scene that can host a framed, in-world activity: the camera frames it,
 * input is routed to it, and the docked panel shows its instructions.
 */
export abstract class ActivityScene extends WorldScene {
  protected activity: Activity | null = null;
  protected activityId = '';
  private lastProgress = -1;

  /** Called when an activity ends; `completed` is false when the player stopped early. */
  protected onActivityDone(_a: Activity, _id: string, _completed: boolean) {}

  protected hostActivity(id: string, a: Activity, rect: Rect) {
    const st = useGame.getState();
    // keep the whole frame inside the world so the camera can centre it
    const z = Math.min((view.w * 0.92) / rect.w, (view.h * 0.64) / rect.h);
    const half = view.w / 2 / z;
    const cx = Math.max(half, Math.min(this.worldW - half, rect.x + rect.w / 2));
    a.rect = { ...rect, x: cx - rect.w / 2 };
    this.player.bark = null;
    this.activity = a;
    this.activityId = id;
    this.locked = true;
    this.lastProgress = -1;
    st.setActivity(id);
    st.setMinigame({ emotion: st.active, title: a.title, instruction: a.instruction, primary: a.primaryLabel, mode: a.mode, progress: 0 });
    this.game.audio.chime(2);
  }

  /** Leave an activity early (from the UI) or when it ends. */
  endActivity(completed: boolean) {
    const st = useGame.getState();
    const a = this.activity;
    const id = this.activityId;
    this.activity = null;
    this.locked = false;
    st.setActivity(null);
    st.setMinigame(null);
    if (a) {
      if (completed) st.gain(st.active, 3);
      this.onActivityDone(a, id, completed);
    }
  }

  exit() {
    super.exit();
    if (this.activity) this.endActivity(false);
  }

  /** Step the hosted activity. Call from `tick`. */
  protected tickActivity(dt: number) {
    const a = this.activity;
    if (!a) return;
    const st = useGame.getState();
    const r = a.rect;
    const input = this.game.input;
    // frame the activity in the space above the docked panel
    const z = Math.min((view.w * 0.92) / r.w, (view.h * 0.64) / r.h);
    this.camera.targetZoom = z;
    this.camera.targetX = r.x + r.w / 2;
    this.camera.targetY = r.y + (STAGE_H / 2 - (STAGE_H - view.h) / 2 - 24) / z;
    const w = this.camera.screenToWorld(input.pointer.x, input.pointer.y);
    const u = (w.x - r.x) / r.w;
    const v = (w.y - r.y) / r.h;
    const blocked = !!st.dialogue || st.menuOpen;
    if (a instanceof BraceletWeave && !blocked) {
      const keys = [
        ['ArrowUp', 'KeyW'],
        ['ArrowRight', 'KeyD'],
        ['ArrowDown', 'KeyS'],
        ['ArrowLeft', 'KeyA'],
      ];
      const hit = keys.findIndex((k) => input.pressed(...k));
      if (hit >= 0) a.arrow = hit;
    }
    a.keys = blocked ? [] : ['Digit1', 'Digit2', 'Digit3', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS'].filter((k) => input.pressed(k));
    a.step(blocked ? 0 : dt, {
      u,
      v,
      inside: u >= 0 && u <= 1 && v >= 0 && v <= 1,
      moved: input.pointer.moved,
      pressed: !blocked && input.pointer.pressed,
      down: !blocked && input.pointer.down,
      primaryPressed: !blocked && input.primaryPressed(),
      primaryDown: !blocked && input.primaryDown(),
      axisX: blocked ? 0 : input.axisX,
      axisY: blocked ? 0 : input.axisY,
    });
    if (Math.abs(a.progress - this.lastProgress) > 0.02) {
      this.lastProgress = a.progress;
      const ui = st.minigame;
      if (ui) st.setMinigame({ ...ui, progress: a.progress });
    }
    if (a.done) this.endActivity(true);
  }

  /** Draw the hosted activity over the world. Call inside the camera transform. */
  protected renderActivity(ctx: Ctx) {
    if (!this.activity) return;
    ctx.fillStyle = 'rgba(10,6,30,0.35)';
    ctx.fillRect(this.camera.x - STAGE_W, -STAGE_H, STAGE_W * 2, STAGE_H * 3);
    this.activity.render(ctx);
  }
}
