/**
 * Keyboard + pointer input sampled once per frame.
 * Pointer coordinates are reported in stage space (the 1600×900 logical stage).
 */
export type VirtualButton = 'primary' | 'left' | 'right';

export class Input {
  private down = new Set<string>();
  private pressedThisFrame = new Set<string>();
  private releasedThisFrame = new Set<string>();
  private virtualDown = new Set<VirtualButton>();
  private virtualPressed = new Set<VirtualButton>();

  pointer = { x: 0, y: 0, down: false, pressed: false, released: false, moved: false, inside: false };
  private pendingPointerPress = false;
  private pendingPointerRelease = false;
  /** Set when the user last used the keyboard (vs. pointer) so prompts can adapt. */
  lastDevice: 'keyboard' | 'pointer' = 'keyboard';

  private toStage: (cx: number, cy: number) => { x: number; y: number } = (x, y) => ({ x, y });

  constructor(private target: HTMLCanvasElement) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    target.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointermove', this.onPointerMove);
  }

  setStageMapper(fn: (cx: number, cy: number) => { x: number; y: number }) {
    this.toStage = fn;
  }

  dispose() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    this.target.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointermove', this.onPointerMove);
  }

  /** Keys that the DOM should keep when a button or input has focus. */
  private isFormTarget(e: KeyboardEvent) {
    const el = e.target as HTMLElement | null;
    if (!el || el === document.body) return false;
    const tag = el.tagName;
    return tag === 'BUTTON' || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'A';
  }

  private onKeyDown = (e: KeyboardEvent) => {
    const code = e.code;
    if ((code === 'Space' || code === 'Enter' || code === 'NumpadEnter') && this.isFormTarget(e)) return;
    if (code === 'Space' || code.startsWith('Arrow')) e.preventDefault();
    this.lastDevice = 'keyboard';
    if (!this.down.has(code)) this.pressedThisFrame.add(code);
    this.down.add(code);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.down.delete(e.code);
    this.releasedThisFrame.add(e.code);
  };

  private onBlur = () => {
    this.down.clear();
    this.virtualDown.clear();
    this.pointer.down = false;
  };

  private onPointerDown = (e: PointerEvent) => {
    const p = this.toStage(e.clientX, e.clientY);
    this.pointer.x = p.x;
    this.pointer.y = p.y;
    this.pointer.down = true;
    this.pendingPointerPress = true;
    this.lastDevice = 'pointer';
  };

  private onPointerUp = () => {
    if (this.pointer.down) this.pendingPointerRelease = true;
    this.pointer.down = false;
  };

  private onPointerMove = (e: PointerEvent) => {
    const p = this.toStage(e.clientX, e.clientY);
    this.pointer.x = p.x;
    this.pointer.y = p.y;
    this.pointer.moved = true;
    this.pointer.inside = e.target === this.target;
  };

  setVirtual(btn: VirtualButton, isDown: boolean) {
    if (isDown && !this.virtualDown.has(btn)) this.virtualPressed.add(btn);
    if (isDown) this.virtualDown.add(btn);
    else this.virtualDown.delete(btn);
  }

  /** Call at the start of each frame. */
  beginFrame() {
    this.pointer.pressed = this.pendingPointerPress;
    this.pointer.released = this.pendingPointerRelease;
    this.pendingPointerPress = false;
    this.pendingPointerRelease = false;
  }

  /** Call at the end of each frame. */
  endFrame() {
    this.pressedThisFrame.clear();
    this.releasedThisFrame.clear();
    this.virtualPressed.clear();
    this.pointer.moved = false;
  }

  isDown(...codes: string[]) {
    return codes.some((c) => this.down.has(c));
  }

  pressed(...codes: string[]) {
    return codes.some((c) => this.pressedThisFrame.has(c));
  }

  released(...codes: string[]) {
    return codes.some((c) => this.releasedThisFrame.has(c));
  }

  /** Space / virtual primary button. Pointer is handled separately by each mini-game. */
  primaryDown() {
    return this.down.has('Space') || this.virtualDown.has('primary');
  }

  primaryPressed() {
    return this.pressedThisFrame.has('Space') || this.virtualPressed.has('primary');
  }

  /** Swallow a pointer press so later systems in the same frame ignore it. */
  consumePointer() {
    this.pointer.pressed = false;
  }

  consumeKey(code: string) {
    this.pressedThisFrame.delete(code);
  }

  get axisX() {
    let x = 0;
    if (this.isDown('ArrowLeft', 'KeyA') || this.virtualDown.has('left')) x -= 1;
    if (this.isDown('ArrowRight', 'KeyD') || this.virtualDown.has('right')) x += 1;
    return x;
  }

  get axisY() {
    let y = 0;
    if (this.isDown('ArrowUp', 'KeyW')) y -= 1;
    if (this.isDown('ArrowDown', 'KeyS')) y += 1;
    return y;
  }
}
