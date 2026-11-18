import { Camera } from '../engine/camera';
import type { Ctx } from '../engine/draw';
import { Particles } from '../engine/particles';
import type { EmotionId } from './content/emotions';
import type { Game } from './Game';

import type { AreaId } from './content/world';

export type SceneId = 'opening' | AreaId;

export abstract class Scene {
  camera = new Camera();
  particles = new Particles();
  time = 0;

  constructor(public game: Game) {}

  abstract readonly id: SceneId;

  /** Called when the scene becomes active. `spawn` is an optional x position. */
  enter(_spawn?: number): void {}
  exit(): void {}
  onEmotionChanged(_prev: EmotionId, _next: EmotionId): void {}

  abstract update(dt: number): void;
  abstract render(ctx: Ctx): void;
}
