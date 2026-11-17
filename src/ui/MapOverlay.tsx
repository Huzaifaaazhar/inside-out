import { useEffect, useRef } from 'react';
import type { AreaId } from '../game/content/world';
import { AREAS, FUTURE_AREAS } from '../game/content/world';
import { useGame } from '../state/store';

interface Node {
  id: string;
  x: number;
  y: number;
  r: number;
  name: string;
  blurb: string;
  color: string;
  area?: AreaId;
  spawn?: number;
}

const NODES: Node[] = [
  { id: 'hq', area: 'hq', x: 480, y: 250, r: 62, name: AREAS.hq.name, blurb: AREAS.hq.blurb, color: '#FFCF33', spawn: 1500 },
  { id: 'memory', area: 'memory', x: 190, y: 360, r: 54, name: AREAS.memory.name, blurb: AREAS.memory.blurb, color: '#A05CF0', spawn: 300 },
  { id: 'islands', area: 'islands', x: 770, y: 360, r: 54, name: AREAS.islands.name, blurb: AREAS.islands.blurb, color: '#3CC6B8', spawn: 300 },
  { id: FUTURE_AREAS[0].id, x: 180, y: 120, r: 40, name: FUTURE_AREAS[0].name, blurb: FUTURE_AREAS[0].blurb, color: '#8c80b8' },
  { id: FUTURE_AREAS[1].id, x: 480, y: 470, r: 40, name: FUTURE_AREAS[1].name, blurb: FUTURE_AREAS[1].blurb, color: '#8c80b8' },
  { id: FUTURE_AREAS[2].id, x: 790, y: 120, r: 40, name: FUTURE_AREAS[2].name, blurb: FUTURE_AREAS[2].blurb, color: '#8c80b8' },
];

const LINKS: [string, string, boolean][] = [
  ['hq', 'memory', true],
  ['hq', 'islands', true],
  ['hq', 'daydream', false],
  ['hq', 'station', false],
  ['memory', 'undercurrent', false],
  ['hq', 'undercurrent', false],
];

/** A hand-drawn map of Riley's mind. Travel by choosing a lit place. */
export function MapOverlay() {
  const open = useGame((s) => s.mapOpen);
  const area = useGame((s) => s.area);
  const doorOpen = useGame((s) => !!s.flags.doorOpen);
  const travel = useGame((s) => s.travel);
  const setMap = useGame((s) => s.setMap);
  const firstRef = useRef<SVGGElement>(null);

  useEffect(() => {
    if (open) firstRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const reachable = (n: Node) => !!n.area && n.area !== area && (n.area !== 'islands' || doorOpen);
  const why = (n: Node) => {
    if (!n.area) return 'Not reachable yet';
    if (n.area === area) return 'You are here';
    if (n.area === 'islands' && !doorOpen) return 'The balcony door in HQ is jammed';
    return 'Travel here';
  };
  const go = (n: Node) => {
    if (!reachable(n) || !n.area) return;
    travel(n.area, 'iris', n.spawn);
  };

  return (
    <div className="scrim" onClick={() => setMap(false)}>
      <div className="sheet map" role="dialog" aria-modal="true" aria-labelledby="map-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="map-title">Riley’s mind</h2>
        <svg viewBox="0 0 960 600" role="group" aria-label="Places in Riley's mind">
          <defs>
            <radialGradient id="mapbg" cx="50%" cy="40%" r="75%">
              <stop offset="0" stopColor="#3a2780" />
              <stop offset="1" stopColor="#120a30" />
            </radialGradient>
            <filter id="fog">
              <feGaussianBlur stdDeviation="8" />
            </filter>
          </defs>
          <rect width="960" height="600" fill="url(#mapbg)" />
          {Array.from({ length: 60 }, (_, i) => (
            <circle key={i} cx={(i * 157) % 960} cy={(i * 89) % 600} r={i % 3 ? 1.2 : 2} fill="#fff8e0" opacity={0.2 + (i % 5) * 0.1} />
          ))}
          {LINKS.map(([a, b, lit]) => {
            const A = NODES.find((n) => n.id === a)!;
            const B = NODES.find((n) => n.id === b)!;
            const mx = (A.x + B.x) / 2;
            const my = (A.y + B.y) / 2 + 40;
            return (
              <path
                key={a + b}
                d={`M${A.x} ${A.y} Q${mx} ${my} ${B.x} ${B.y}`}
                fill="none"
                stroke={lit ? '#E7B76A' : '#6f5bc4'}
                strokeWidth={lit ? 4 : 3}
                strokeDasharray={lit ? '2 10' : '1 12'}
                strokeLinecap="round"
                opacity={lit ? 0.9 : 0.5}
              />
            );
          })}
          {NODES.map((n, i) => {
            const ok = reachable(n);
            const here = n.area === area;
            return (
              <g
                key={n.id}
                ref={i === 0 ? firstRef : undefined}
                className="node"
                role="button"
                tabIndex={0}
                aria-disabled={!ok}
                aria-label={`${n.name}. ${n.blurb} ${why(n)}.`}
                onClick={() => go(n)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    go(n);
                  }
                }}
              >
                {!n.area && <circle cx={n.x} cy={n.y} r={n.r + 26} fill="#b9a7f5" opacity={0.25} filter="url(#fog)" />}
                <circle cx={n.x} cy={n.y} r={n.r + 14} fill={n.color} opacity={n.area ? 0.18 : 0.08} />
                <circle className="ring" cx={n.x} cy={n.y} r={n.r} fill="#241a52" stroke={n.color} strokeWidth={3} />
                <circle cx={n.x - n.r * 0.3} cy={n.y - n.r * 0.3} r={n.r * 0.22} fill="#fff" opacity={n.area ? 0.4 : 0.1} />
                {here && (
                  <g>
                    <circle cx={n.x} cy={n.y} r={n.r + 8} fill="none" stroke="#F3EEFF" strokeWidth={3} strokeDasharray="6 6" />
                    <text x={n.x} y={n.y + 6} textAnchor="middle" fontFamily="Grandstander, Nunito" fontWeight={800} fontSize={17} fill="#FFF1B0">
                      You are here
                    </text>
                  </g>
                )}
                {!here && (
                  <text x={n.x} y={n.y + 6} textAnchor="middle" fontFamily="Grandstander, Nunito" fontWeight={800} fontSize={n.area ? 17 : 14} fill={ok ? '#F3EEFF' : '#8c80b8'}>
                    {n.area ? (ok ? 'Go' : 'Locked') : 'Fog'}
                  </text>
                )}
                <text x={n.x} y={n.y + n.r + 34} textAnchor="middle" fontFamily="Grandstander, Nunito" fontWeight={800} fontSize={20} fill={n.area ? '#F3EEFF' : '#8c80b8'}>
                  {n.name}
                </text>
                <text x={n.x} y={n.y + n.r + 56} textAnchor="middle" fontFamily="Nunito" fontWeight={700} fontSize={14} fill="#b9a7f5">
                  {n.area === 'islands' && !doorOpen ? 'Balcony door is jammed' : n.area ? '' : 'Later'}
                </text>
              </g>
            );
          })}
        </svg>
        <div className="map__legend">
          <p style={{ margin: 0 }}>Choose a lit place to travel there. Foggy places open later.</p>
          <button className="ghost" onClick={() => setMap(false)}>
            Close map
          </button>
        </div>
      </div>
    </div>
  );
}
