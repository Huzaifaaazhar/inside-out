import { useEffect, useMemo, useRef, useState } from 'react';
import type { Ctx } from '../engine/draw';
import { FONT_DISPLAY, circle, ellipse, glow, memoryOrb, rgba, roundRect, stars } from '../engine/draw';
import { TAU, hash } from '../engine/math';
import { cloudBank, drawHQTower, drawIsland } from '../game/art/mindscape';
import type { AreaId, IslandId } from '../game/content/world';
import { AREAS } from '../game/content/world';
import { HIDDEN_FEARS, INSIGHTS } from '../game/systems/progress';
import { useGame } from '../state/store';

/** The atlas is drawn on a 1600×900 board, like the game stage, and scaled to fit. */
const BW = 1600;
const BH = 900;

interface Place {
  area: AreaId;
  x: number;
  y: number;
  color: string;
  spawn?: number;
  /** How to find this place on foot, if it hasn't been visited yet. */
  route: string;
  island?: IslandId;
}

const PLACES: Place[] = [
  { area: 'hq', x: 800, y: 300, color: '#FFCF33', spawn: 1500, route: 'Headquarters is always open.' },
  { area: 'memory', x: 430, y: 560, color: '#1f9fa8', spawn: 300, route: 'Take the tube in Headquarters.' },
  { area: 'fading', x: 330, y: 740, color: '#b9b4c4', spawn: 300, route: 'Walk to the far end of Long-Term Memory and go down.' },
  { area: 'subconscious', x: 640, y: 830, color: '#6E79B8', spawn: 300, route: 'Find the dark stairwell at the far end of The Fading.' },
  { area: 'islands', x: 1120, y: 560, color: '#3CC6B8', spawn: 300, route: 'Open the balcony door in Headquarters.' },
  { area: 'isle-family', x: 990, y: 700, color: '#F4A259', spawn: 320, route: 'Cross the bridge from the cliff path.', island: 'family' },
  { area: 'isle-friendship', x: 1140, y: 760, color: '#3CC6B8', spawn: 320, route: 'Cross the bridge from the cliff path.', island: 'friendship' },
  { area: 'isle-hockey', x: 1300, y: 720, color: '#7FC8FF', spawn: 320, route: 'Cross the bridge from the cliff path.', island: 'hockey' },
  { area: 'isle-goofball', x: 1430, y: 620, color: '#FF7FB0', spawn: 320, route: 'Cross the bridge past the boulder.', island: 'goofball' },
  { area: 'imagination', x: 330, y: 230, color: '#FF7FB0', spawn: 300, route: 'Ride the daydream ribbon at the far end of the island cliffs.' },
  { area: 'dreams', x: 1290, y: 190, color: '#FFE58A', spawn: 300, route: 'Cross the Gap of Nothing at the far side of Imagination Land.' },
];

const LINKS: [AreaId, AreaId][] = [
  ['hq', 'memory'],
  ['memory', 'fading'],
  ['fading', 'subconscious'],
  ['hq', 'islands'],
  ['islands', 'isle-family'],
  ['islands', 'isle-friendship'],
  ['islands', 'isle-hockey'],
  ['islands', 'isle-goofball'],
  ['islands', 'imagination'],
  ['imagination', 'dreams'],
];

/** Which areas count towards a place's discoveries in the journal. */
const AREA_TAG: Partial<Record<AreaId, string>> = { imagination: 'imag', dreams: 'dream', subconscious: 'sub' };

function usePlaceState() {
  const area = useGame((s) => s.area);
  const doorOpen = useGame((s) => !!s.flags.doorOpen);
  const hasMind = useGame((s) => !!s.mind);
  const visited = useGame((s) => s.progress.visited);
  const islands = useGame((s) => s.mind?.islands);
  return useMemo(() => {
    const basic = (a: AreaId) => a === 'hq' || a === 'memory' || a === 'fading';
    const unlocked = (p: Place): { ok: boolean; why: string } => {
      if (p.area === area) return { ok: false, why: 'You are here' };
      if (basic(p.area)) return { ok: true, why: '' };
      if ((p.area === 'islands' || p.island) && !doorOpen) return { ok: false, why: 'The balcony door in Headquarters is jammed.' };
      if (p.area === 'islands' || p.island) return { ok: true, why: '' };
      if (!hasMind) return { ok: false, why: 'Riley needs a few more days before this part of her mind opens up.' };
      if (!visited.includes(p.area)) return { ok: false, why: p.route };
      return { ok: true, why: '' };
    };
    return { area, unlocked, visited, islands };
  }, [area, doorOpen, hasMind, visited, islands]);
}

/**
 * The Mind Atlas: a living model of Riley's mind projected from the HQ console.
 * You can think your way back to anywhere you've already been; new places must be found on foot.
 */
export function MindAtlas() {
  const open = useGame((s) => s.mapOpen);
  if (!open) return null;
  return <AtlasInner />;
}

function AtlasInner() {
  const setMap = useGame((s) => s.setMap);
  const travel = useGame((s) => s.travel);
  const progress = useGame((s) => s.progress);
  const fears = progress.fears.length;
  const { area, unlocked, islands } = usePlaceState();
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [sel, setSel] = useState<AreaId>(area as AreaId);
  const [box, setBox] = useState({ s: 1, x: 0, y: 0 });
  const focusRef = useRef<HTMLButtonElement>(null);
  const selRef = useRef(sel);
  selRef.current = sel;

  useEffect(() => {
    focusRef.current?.focus();
  }, []);

  // fit the board into the window
  useEffect(() => {
    const fit = () => {
      const el = wrap.current;
      if (!el) return;
      const w = el.clientWidth;
      const h = el.clientHeight;
      const s = Math.min(w / BW, h / BH) * (h > w ? 1.35 : 1);
      setBox({ s, x: (w - BW * s) / 2, y: (h - BH * s) / 2 });
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  // animated board
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    let raf = 0;
    const t0 = performance.now();
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = c.clientWidth;
      const h = c.clientHeight;
      if (c.width !== Math.round(w * dpr)) {
        c.width = Math.round(w * dpr);
        c.height = Math.round(h * dpr);
      }
      const t = (performance.now() - t0) / 1000;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#0c0726';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.setTransform(dpr * box.s, 0, 0, dpr * box.s, dpr * box.x, dpr * box.y);
      drawBoard(ctx, t, selRef.current, unlocked, islands);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [box, unlocked, islands]);

  const place = PLACES.find((p) => p.area === sel) ?? PLACES[0];
  const u = unlocked(place);
  const tag = AREA_TAG[place.area];
  const found = tag ? progress.insights.filter((i) => i.startsWith(tag)).length : 0;
  const total = tag ? INSIGHTS.filter((i) => i.id.startsWith(tag)).length : 0;
  const go = (p: Place) => {
    if (!unlocked(p).ok) return;
    travel(p.area, 'iris', p.spawn);
  };

  return (
    <div className="atlas" role="dialog" aria-modal="true" aria-labelledby="atlas-title">
      <div className="atlas__board" ref={wrap}>
        <canvas ref={canvas} className="atlas__canvas" aria-hidden="true" />
        {PLACES.map((p, i) => {
          const st = unlocked(p);
          const here = p.area === area;
          const small = !!p.island;
          return (
            <button
              key={p.area}
              ref={p.area === sel || (i === 0 && !PLACES.some((q) => q.area === sel)) ? focusRef : undefined}
              className={`atlas__spot${here ? ' is-here' : ''}${st.ok ? '' : ' is-locked'}${sel === p.area ? ' is-sel' : ''}${small ? ' is-small' : ''}`}
              style={{ left: box.x + p.x * box.s, top: box.y + p.y * box.s, ['--c' as string]: p.color }}
              aria-label={`${AREAS[p.area].name}. ${here ? 'You are here.' : st.ok ? 'Travel here.' : st.why}`}
              onFocus={() => setSel(p.area)}
              onMouseEnter={() => setSel(p.area)}
              onClick={() => (sel === p.area ? go(p) : setSel(p.area))}
              onDoubleClick={() => go(p)}
            >
              <span className="atlas__label">{small ? AREAS[p.area].name.replace(' Island', '') : AREAS[p.area].name}</span>
            </button>
          );
        })}
      </div>
      <header className="atlas__head">
        <h2 id="atlas-title">Mind Atlas</h2>
        <p>Think your way to anywhere you’ve already been. New places have to be found on foot.</p>
      </header>
      <aside className="atlas__card" style={{ ['--c' as string]: place.color }} aria-live="polite">
        <h3>{AREAS[place.area].name}</h3>
        <p>{AREAS[place.area].blurb}</p>
        {tag && (
          <p className="atlas__meta">
            Insights found here: {found} / {total}
            {place.area === 'subconscious' ? ` · Hidden fears: ${fears} / ${HIDDEN_FEARS.length}` : ''}
          </p>
        )}
        {!u.ok && place.area !== area && <p className="atlas__why">{u.why}</p>}
        <div className="atlas__actions">
          {place.area === area ? (
            <span className="atlas__here">You are here</span>
          ) : (
            <button className="primary" disabled={!u.ok} onClick={() => go(place)}>
              {u.ok ? 'Travel here' : 'Not reachable yet'}
            </button>
          )}
          <button className="ghost" onClick={() => setMap(false)}>
            Close (M)
          </button>
        </div>
      </aside>
    </div>
  );
}

function drawBoard(ctx: Ctx, t: number, sel: AreaId, unlocked: (p: Place) => { ok: boolean }, islands?: Record<string, number>) {
  // night sky with a soft nebula
  const g = ctx.createRadialGradient(800, 380, 60, 800, 450, 900);
  g.addColorStop(0, '#3a2780');
  g.addColorStop(1, '#0c0726');
  ctx.fillStyle = g;
  ctx.fillRect(-400, -400, BW + 800, BH + 800);
  stars(ctx, BW, BH, 160, t, 4);
  // the deep: a dark well under everything
  const deep = ctx.createLinearGradient(0, 640, 0, 900);
  deep.addColorStop(0, 'rgba(12,17,48,0)');
  deep.addColorStop(1, 'rgba(5,6,26,0.95)');
  ctx.fillStyle = deep;
  ctx.fillRect(-400, 640, BW + 800, 700);
  for (let i = 0; i < 5; i++) cloudBank(ctx, -100 + i * 380, 470 + hash(i) * 40, 360, '#5d49a8', 0.25, i);

  // threads between places
  for (const [a, b] of LINKS) {
    const A = PLACES.find((p) => p.area === a)!;
    const B = PLACES.find((p) => p.area === b)!;
    const ok = unlocked(B).ok || unlocked(A).ok;
    ctx.strokeStyle = ok ? 'rgba(231,183,106,0.8)' : 'rgba(111,91,196,0.45)';
    ctx.lineWidth = ok ? 4 : 3;
    ctx.setLineDash(ok ? [2, 12] : [1, 14]);
    ctx.lineDashOffset = -t * 14;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(A.x, A.y);
    ctx.quadraticCurveTo((A.x + B.x) / 2, (A.y + B.y) / 2 + 50, B.x, B.y);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  for (const p of PLACES) {
    const ok = unlocked(p).ok;
    const isSel = p.area === sel;
    const lit = ok || isSel ? 1 : 0.35;
    ctx.save();
    ctx.globalAlpha = lit;
    if (isSel) glow(ctx, p.x, p.y, 170, p.color, 0.45 + Math.sin(t * 3) * 0.08);
    drawPlace(ctx, p, t, islands);
    ctx.restore();
    if (!ok && p.area !== sel) {
      // fog over places not reached yet
      for (let k = 0; k < 4; k++) circle(ctx, p.x + Math.sin(t * 0.4 + k * 2) * 30 + (k - 1.5) * 26, p.y + Math.cos(t * 0.3 + k) * 10, 46, 'rgba(185,167,245,0.07)');
    }
  }
}

function drawPlace(ctx: Ctx, p: Place, t: number, islands?: Record<string, number>) {
  const { x, y } = p;
  switch (p.area) {
    case 'hq':
      drawHQTower(ctx, x, y + 150, 0.36, t);
      break;
    case 'memory':
      for (let k = 0; k < 4; k++) {
        ctx.fillStyle = k % 2 ? '#1a6f78' : '#1f9fa8';
        roundRect(ctx, x - 110 + k * 12, y - 40 + k * 22, 220 - k * 24, 14, 6);
        ctx.fill();
        for (let j = 0; j < 7 - k; j++) memoryOrb(ctx, x - 92 + k * 12 + j * 28, y - 50 + k * 22, 8, ['#FFCF33', '#3D7BFF', '#F0412D', '#A05CF0', '#52C46B'][(j + k) % 5], { glowAmt: 0.3 });
      }
      break;
    case 'fading':
      for (let k = 0; k < 3; k++) ellipse(ctx, x - 60 + k * 60, y + 10 + Math.sin(k) * 6, 80, 22, k % 2 ? '#a59fb4' : '#c8c1d0');
      memoryOrb(ctx, x + Math.sin(t) * 20, y - 30, 12, '#8c80b8', { faded: 0.8 });
      break;
    case 'subconscious':
      ctx.fillStyle = '#121a3e';
      ctx.beginPath();
      ctx.arc(x, y + 30, 110, Math.PI, TAU);
      ctx.fill();
      glow(ctx, x, y, 60, '#6E79B8', 0.4);
      for (const ex of [-14, 14]) ellipse(ctx, x + ex, y - 10, 5, 8 * (Math.sin(t * 0.9) > 0.95 ? 0.2 : 1), '#e6e9ff');
      break;
    case 'islands':
      ctx.fillStyle = '#5b4a9a';
      ctx.beginPath();
      ctx.moveTo(x - 140, y + 20);
      ctx.quadraticCurveTo(x, y - 20, x + 140, y + 20);
      ctx.lineTo(x + 120, y + 60);
      ctx.lineTo(x - 120, y + 60);
      ctx.fill();
      for (let k = 0; k < 5; k++) glow(ctx, x - 110 + k * 55, y + 4, 18, '#FFCF33', 0.6);
      break;
    case 'imagination': {
      const cols = ['#FF7FB0', '#FFE45E', '#7AE7C7', '#8E5BD9'];
      for (let k = 0; k < 5; k++) cloudBank(ctx, x - 120 + k * 50, y + 30 + Math.sin(k) * 10, 120, cols[k % 4], 0.85, k + 3, 40);
      ctx.save();
      ctx.translate(x, y - 30);
      ctx.rotate(t * 0.4);
      for (let k = 0; k < 6; k++) {
        ctx.fillStyle = cols[k % 4];
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, 34, (k / 6) * TAU, ((k + 1) / 6) * TAU);
        ctx.fill();
      }
      ctx.restore();
      break;
    }
    case 'dreams':
      glow(ctx, x + 60, y - 40, 70, '#FFF1B0', 0.6);
      circle(ctx, x + 60, y - 40, 22, '#FFF1B0');
      circle(ctx, x + 70, y - 46, 20, '#1c1a46');
      for (let k = 0; k < 3; k++) {
        ctx.fillStyle = '#2b2a52';
        ctx.beginPath();
        ctx.moveTo(x - 110 + k * 80, y + 40);
        ctx.lineTo(x - 110 + k * 80, y - 10);
        ctx.quadraticCurveTo(x - 75 + k * 80, y - 40, x - 40 + k * 80, y - 10);
        ctx.lineTo(x - 40 + k * 80, y + 40);
        ctx.fill();
      }
      ctx.strokeStyle = rgba('#A0DCFF', 0.4);
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(x - 60, y + 40);
      ctx.lineTo(x - 60 + Math.sin(t) * 90, y - 140);
      ctx.stroke();
      ctx.fillStyle = '#FFE58A';
      ctx.font = `800 16px ${FONT_DISPLAY}`;
      ctx.textAlign = 'center';
      ctx.fillText('1', x - 75, y + 10);
      break;
    default:
      if (p.island) {
        const stab = islands?.[p.island];
        drawIsland(ctx, p.island, x, y - 30, 0.42, t, stab === undefined ? 1 : Math.max(0.15, Math.min(1, (stab - 15) / 55)));
      }
  }
}
