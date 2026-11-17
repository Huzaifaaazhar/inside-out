import { useRef, useState } from 'react';
import { EMOTIONS } from '../game/content/emotions';
import { getGame } from '../game/Game';
import { ART_CLUB } from '../game/scenario/artClub';
import type { HQScene } from '../game/scenes/HQScene';
import { useGame } from '../state/store';
import { Key } from './icons';

/** A button that drives the engine's "primary" input: tap or hold, by pointer or keyboard. */
function PrimaryButton({ label, mode }: { label: string; mode: 'tap' | 'hold' }) {
  const [held, setHeld] = useState(false);
  const timer = useRef<number>(0);
  const set = (down: boolean) => {
    setHeld(down);
    getGame()?.input.setVirtual('primary', down);
  };
  const tap = () => {
    set(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => set(false), 60);
  };
  return (
    <button
      className="primary"
      data-held={held}
      autoFocus
      onPointerDown={(e) => {
        e.preventDefault();
        if (mode === 'hold') set(true);
        else tap();
      }}
      onPointerUp={() => mode === 'hold' && set(false)}
      onPointerLeave={() => mode === 'hold' && held && set(false)}
      onKeyDown={(e) => {
        if (e.code !== 'Space' && e.code !== 'Enter') return;
        e.preventDefault();
        if (e.repeat) return;
        if (mode === 'hold') set(true);
        else tap();
      }}
      onKeyUp={(e) => {
        if ((e.code === 'Space' || e.code === 'Enter') && mode === 'hold') set(false);
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {label}
      <Key>Space</Key>
    </button>
  );
}

export function ConsolePanel() {
  const stage = useGame((s) => s.consoleStage);
  const dialogue = useGame((s) => s.dialogue);
  const beatIdx = useGame((s) => s.beat);
  const results = useGame((s) => s.results);
  const active = useGame((s) => s.active);
  const mg = useGame((s) => s.minigame);
  const [hint, setHint] = useState<number | null>(null);
  if (dialogue || (stage !== 'choose' && stage !== 'minigame')) return null;
  const beat = ART_CLUB.beats[beatIdx];
  const E = EMOTIONS[active];

  const dots = (
    <div className="beats" aria-label={`Moment ${beatIdx + 1} of ${ART_CLUB.beats.length}`}>
      {ART_CLUB.beats.map((b, i) => {
        const r = results[i];
        return <span key={b.id} data-done={r ? '' : undefined} data-now={i === beatIdx ? '' : undefined} style={r ? { ['--c' as string]: EMOTIONS[r.emotion].color } : undefined} />;
      })}
    </div>
  );

  if (stage === 'choose') {
    return (
      <section className="cpanel" aria-label="Console" style={{ ['--accent' as string]: E.color, ['--light' as string]: E.light }}>
        <div className="cpanel__top">
          <h3>{beat.title}</h3>
          {dots}
        </div>
        <p>{beat.prompt}</p>
        <p style={{ fontSize: 16, color: 'var(--lilac)' }}>
          Who should drive? Pick an emotion on the dial (1–5), then use their ability. Right now that’s {E.name}: {E.ability.description}
        </p>
        {hint === beatIdx && <div className="cpanel__hint">{beat.hint}</div>}
        <div className="cpanel__row">
          <PrimaryButton key={`choose-${active}`} label={`Use ${E.ability.name}`} mode="tap" />
          {hint !== beatIdx && (
            <button className="ghost" onClick={() => setHint(beatIdx)}>
              Show a hint
            </button>
          )}
          <button className="ghost" onClick={() => (getGame()?.scenes.hq as HQScene).leaveConsole()}>
            Step away from the console
          </button>
        </div>
      </section>
    );
  }

  if (!mg) return null;
  const ME = EMOTIONS[mg.emotion];
  return (
    <section className="cpanel" aria-label={`${ME.ability.name} mini-game`} style={{ ['--accent' as string]: ME.color, ['--light' as string]: ME.light }}>
      <div className="cpanel__top">
        <h3>{mg.title}</h3>
        {dots}
      </div>
      <p>{mg.instruction}</p>
      <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(mg.progress * 100)} aria-label="Progress">
        <div style={{ width: `${Math.round(mg.progress * 100)}%` }} />
      </div>
      {mg.mode !== 'none' && mg.primary && (
        <div className="cpanel__row">
          <PrimaryButton key={`mg-${mg.emotion}`} label={mg.primary} mode={mg.mode} />
        </div>
      )}
    </section>
  );
}
