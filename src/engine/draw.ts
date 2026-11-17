import { TAU } from './math';

export type Ctx = CanvasRenderingContext2D;

export interface RGB {
  r: number;
  g: number;
  b: number;
}

const hexCache = new Map<string, RGB>();
export function hexToRgb(hex: string): RGB {
  const cached = hexCache.get(hex);
  if (cached) return cached;
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  const rgb = { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  hexCache.set(hex, rgb);
  return rgb;
}

export const rgba = (hex: string, a: number) => {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
};

export function mixHex(a: string, b: string, t: number) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  const r = Math.round(A.r + (B.r - A.r) * t);
  const g = Math.round(A.g + (B.g - A.g) * t);
  const bl = Math.round(A.b + (B.b - A.b) * t);
  return `#${((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)}`;
}

export function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number | number[]) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Soft additive glow using a radial gradient (much cheaper than shadowBlur). */
export function glow(ctx: Ctx, x: number, y: number, radius: number, color: string, alpha = 1) {
  if (radius <= 0 || alpha <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
  g.addColorStop(0, rgba(color, 0.55 * alpha));
  g.addColorStop(0.35, rgba(color, 0.22 * alpha));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, TAU);
  ctx.fill();
}

export function circle(ctx: Ctx, x: number, y: number, r: number, fill: string | CanvasGradient) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0, r), 0, TAU);
  ctx.fill();
}

export function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, fill: string | CanvasGradient, rot = 0) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0, rx), Math.max(0, ry), rot, 0, TAU);
  ctx.fill();
}

/** A glossy glass orb, the visual language for memories. */
export function memoryOrb(ctx: Ctx, x: number, y: number, r: number, color: string, opts: { faded?: number; glowAmt?: number; t?: number; swirl?: string[] } = {}) {
  const faded = opts.faded ?? 0;
  const base = faded > 0 ? mixHex(color, '#8d8a9e', faded) : color;
  const glowAmt = (opts.glowAmt ?? 1) * (1 - faded * 0.8);
  glow(ctx, x, y, r * 3.2, base, 0.7 * glowAmt);
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, mixHex(base, '#ffffff', 0.75));
  g.addColorStop(0.45, base);
  g.addColorStop(1, mixHex(base, '#120a30', 0.45));
  circle(ctx, x, y, r, g);
  if (opts.swirl && opts.swirl.length) {
    const t = opts.t ?? 0;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r * 0.92, 0, TAU);
    ctx.clip();
    ctx.lineWidth = r * 0.22;
    ctx.lineCap = 'round';
    opts.swirl.forEach((c, i) => {
      ctx.strokeStyle = rgba(c, 0.75);
      ctx.beginPath();
      const a0 = t * 1.3 + (i * TAU) / opts.swirl!.length;
      ctx.arc(x, y, r * (0.35 + 0.12 * i), a0, a0 + 1.8);
      ctx.stroke();
    });
    ctx.restore();
  }
  // specular highlight
  ellipse(ctx, x - r * 0.32, y - r * 0.42, r * 0.34, r * 0.2, 'rgba(255,255,255,0.75)', -0.5);
  circle(ctx, x + r * 0.42, y + r * 0.38, r * 0.08, 'rgba(255,255,255,0.35)');
}

/** Wrap text into lines for canvas rendering. */
export function wrapText(ctx: Ctx, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

export const FONT_DISPLAY = '"Grandstander", "Nunito", system-ui, sans-serif';
export const FONT_BODY = '"Nunito", system-ui, sans-serif';

/** Hand-lettered sign text with a soft outline. */
export function signText(ctx: Ctx, text: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = 'center') {
  ctx.font = `700 ${size}px ${FONT_DISPLAY}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = size * 0.22;
  ctx.strokeStyle = 'rgba(20,10,50,0.75)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

/** Starfield helper with deterministic placement. */
export function stars(ctx: Ctx, w: number, h: number, count: number, t: number, seed = 1, offsetX = 0, alpha = 1) {
  for (let i = 0; i < count; i++) {
    const sx = ((Math.sin(i * 91.7 + seed) * 0.5 + 0.5) * w * 1.3 - offsetX) % (w * 1.3);
    const x = sx < 0 ? sx + w * 1.3 : sx;
    const y = (Math.sin(i * 47.3 + seed * 3.1) * 0.5 + 0.5) * h;
    const tw = 0.5 + 0.5 * Math.sin(t * (1 + (i % 5) * 0.4) + i);
    const r = 0.6 + (i % 3) * 0.55;
    ctx.fillStyle = `rgba(255,248,230,${(0.25 + 0.65 * tw) * alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }
}
