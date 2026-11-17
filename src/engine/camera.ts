import { clamp, damp } from './math';
import type { Ctx } from './draw';

export const STAGE_W = 1600;
export const STAGE_H = 900;

/** The part of the stage actually visible on screen (narrower on cropped, portrait screens). */
export const view = { w: STAGE_W, h: STAGE_H };

/**
 * Side-scrolling camera. `x,y` is the world point at the centre of the stage.
 * Parallax layers are drawn by calling `apply(ctx, factor)`.
 */
export class Camera {
  x = STAGE_W / 2;
  y = STAGE_H / 2;
  zoom = 1;
  targetX = this.x;
  targetY = this.y;
  targetZoom = 1;
  shakeAmt = 0;
  private shakeX = 0;
  private shakeY = 0;
  worldW = STAGE_W;
  worldH = STAGE_H;
  followRate = 4;
  zoomRate = 3;

  setWorld(w: number, h: number) {
    this.worldW = w;
    this.worldH = h;
  }

  snap() {
    this.x = this.targetX;
    this.y = this.targetY;
    this.zoom = this.targetZoom;
    this.clampToWorld();
  }

  shake(amount: number) {
    this.shakeAmt = Math.max(this.shakeAmt, amount);
  }

  update(dt: number, reducedMotion = false) {
    this.x = damp(this.x, this.targetX, this.followRate, dt);
    this.y = damp(this.y, this.targetY, this.followRate, dt);
    this.zoom = damp(this.zoom, this.targetZoom, this.zoomRate, dt);
    this.clampToWorld();
    if (this.shakeAmt > 0.01 && !reducedMotion) {
      this.shakeX = (Math.random() * 2 - 1) * this.shakeAmt;
      this.shakeY = (Math.random() * 2 - 1) * this.shakeAmt;
      this.shakeAmt = damp(this.shakeAmt, 0, 8, dt);
    } else {
      this.shakeX = this.shakeY = 0;
      this.shakeAmt = 0;
    }
  }

  private clampToWorld() {
    const halfW = view.w / 2 / this.zoom;
    const halfH = view.h / 2 / this.zoom;
    this.x = this.worldW <= halfW * 2 ? this.worldW / 2 : clamp(this.x, halfW, this.worldW - halfW);
    this.y = this.worldH <= halfH * 2 ? this.worldH / 2 : clamp(this.y, halfH, this.worldH - halfH);
  }

  /** Apply the camera transform with a parallax factor (1 = world layer, 0 = fixed to screen). */
  apply(ctx: Ctx, parallax = 1) {
    ctx.translate(STAGE_W / 2 + this.shakeX * parallax, STAGE_H / 2 + this.shakeY * parallax);
    const z = 1 + (this.zoom - 1) * parallax;
    ctx.scale(z, z);
    ctx.translate(-this.x * parallax - (STAGE_W / 2) * (1 - parallax), -this.y * parallax - (STAGE_H / 2) * (1 - parallax));
  }

  screenToWorld(sx: number, sy: number) {
    return {
      x: (sx - STAGE_W / 2) / this.zoom + this.x,
      y: (sy - STAGE_H / 2) / this.zoom + this.y,
    };
  }

  worldToScreen(wx: number, wy: number) {
    return {
      x: (wx - this.x) * this.zoom + STAGE_W / 2,
      y: (wy - this.y) * this.zoom + STAGE_H / 2,
    };
  }
}
