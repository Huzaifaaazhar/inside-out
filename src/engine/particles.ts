import type { Ctx } from './draw';
import { rgba } from './draw';
import { TAU } from './math';

export type ParticleShape = 'dot' | 'spark' | 'star' | 'ring' | 'drop' | 'ember' | 'bubble';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  shape: ParticleShape;
  gravity: number;
  drag: number;
  spin: number;
  rot: number;
  additive: boolean;
}

export interface EmitOptions {
  x: number;
  y: number;
  count?: number;
  color: string | string[];
  shape?: ParticleShape;
  speed?: [number, number];
  angle?: [number, number];
  life?: [number, number];
  size?: [number, number];
  gravity?: number;
  drag?: number;
  spread?: number;
  additive?: boolean;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

export class Particles {
  private list: Particle[] = [];
  max = 900;

  emit(o: EmitOptions) {
    const count = o.count ?? 12;
    for (let i = 0; i < count; i++) {
      if (this.list.length >= this.max) this.list.shift();
      const a = rand(...(o.angle ?? [0, TAU]));
      const s = rand(...(o.speed ?? [40, 160]));
      const life = rand(...(o.life ?? [0.6, 1.2]));
      const spread = o.spread ?? 0;
      this.list.push({
        x: o.x + rand(-spread, spread),
        y: o.y + rand(-spread, spread),
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life,
        maxLife: life,
        size: rand(...(o.size ?? [2, 5])),
        color: Array.isArray(o.color) ? o.color[(Math.random() * o.color.length) | 0] : o.color,
        shape: o.shape ?? 'dot',
        gravity: o.gravity ?? 0,
        drag: o.drag ?? 1.5,
        spin: rand(-4, 4),
        rot: Math.random() * TAU,
        additive: o.additive ?? true,
      });
    }
  }

  clear() {
    this.list.length = 0;
  }

  get count() {
    return this.list.length;
  }

  update(dt: number) {
    const L = this.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const p = L[i];
      p.life -= dt;
      if (p.life <= 0) {
        L.splice(i, 1);
        continue;
      }
      const d = Math.exp(-p.drag * dt);
      p.vx *= d;
      p.vy = p.vy * d + p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
    }
  }

  render(ctx: Ctx) {
    for (const p of this.list) {
      const k = p.life / p.maxLife;
      const a = Math.min(1, k * 1.6);
      ctx.globalCompositeOperation = p.additive ? 'lighter' : 'source-over';
      switch (p.shape) {
        case 'dot': {
          ctx.fillStyle = rgba(p.color, a);
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (0.5 + 0.5 * k), 0, TAU);
          ctx.fill();
          break;
        }
        case 'ember': {
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2.5);
          g.addColorStop(0, rgba('#fff3c4', a));
          g.addColorStop(0.3, rgba(p.color, a * 0.8));
          g.addColorStop(1, rgba(p.color, 0));
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 2.5, 0, TAU);
          ctx.fill();
          break;
        }
        case 'spark': {
          ctx.strokeStyle = rgba(p.color, a);
          ctx.lineWidth = p.size * 0.5;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 0.05, p.y - p.vy * 0.05);
          ctx.stroke();
          break;
        }
        case 'star': {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = rgba(p.color, a);
          const s = p.size * (0.6 + 0.4 * k);
          ctx.beginPath();
          for (let j = 0; j < 8; j++) {
            const r = j % 2 === 0 ? s * 1.6 : s * 0.45;
            const ang = (j / 8) * TAU;
            ctx.lineTo(Math.cos(ang) * r, Math.sin(ang) * r);
          }
          ctx.closePath();
          ctx.fill();
          ctx.restore();
          break;
        }
        case 'ring': {
          ctx.strokeStyle = rgba(p.color, a * 0.9);
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (1 + (1 - k) * 4), 0, TAU);
          ctx.stroke();
          break;
        }
        case 'drop': {
          ctx.fillStyle = rgba(p.color, a);
          ctx.beginPath();
          const s = p.size;
          ctx.moveTo(p.x, p.y - s * 1.8);
          ctx.quadraticCurveTo(p.x + s, p.y, p.x, p.y + s);
          ctx.quadraticCurveTo(p.x - s, p.y, p.x, p.y - s * 1.8);
          ctx.fill();
          break;
        }
        case 'bubble': {
          ctx.strokeStyle = rgba(p.color, a * 0.8);
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, TAU);
          ctx.stroke();
          ctx.fillStyle = rgba('#ffffff', a * 0.5);
          ctx.beginPath();
          ctx.arc(p.x - p.size * 0.35, p.y - p.size * 0.35, p.size * 0.25, 0, TAU);
          ctx.fill();
          break;
        }
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }
}
