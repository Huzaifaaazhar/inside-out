import { useEffect, useRef, useState } from 'react';
import { EMOTIONS, EMOTION_ORDER } from '../game/content/emotions';
import { useGame } from '../state/store';
import { Key } from './icons';

function useAutoFocus<T extends HTMLElement>(open: boolean) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (open) ref.current?.focus();
  }, [open]);
  return ref;
}

/** Details for a memory, an island or the core memory holder. */
export function InspectCard() {
  const card = useGame((s) => s.inspect);
  const close = () => useGame.getState().setInspect(null);
  const btn = useAutoFocus<HTMLButtonElement>(!!card);
  if (!card) return null;
  return (
    <div className="scrim" onClick={close}>
      <div
        className="sheet sheet--card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="card-title"
        style={{ ['--c' as string]: card.color }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="orb" aria-hidden="true" />
        {card.kicker && <div className="sheet__kicker">{card.kicker}</div>}
        <h2 id="card-title">{card.title}</h2>
        <p>{card.body}</p>
        {card.extra && <p className="sheet__extra">{card.extra}</p>}
        <div className="sheet__actions">
          <button ref={btn} className="primary" style={{ ['--accent' as string]: card.color }} onClick={close}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export function HelpSheet() {
  const open = useGame((s) => s.helpOpen);
  const close = () => useGame.getState().setHelp(false);
  const btn = useAutoFocus<HTMLButtonElement>(open);
  if (!open) return null;
  return (
    <div className="scrim" onClick={close}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="help-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="help-title">Controls</h2>
        <dl className="controls">
          <dt>
            <Key>A</Key>
            <Key>D</Key> or <Key>←</Key>
            <Key>→</Key>
          </dt>
          <dd>Walk. You can also click or tap the floor, or hold the arrow pads on a touch screen.</dd>
          <dt>
            <Key>1</Key>–<Key>5</Key>
          </dt>
          <dd>Switch emotion. Or tap an orb on the mood dial.</dd>
          <dt>
            <Key>E</Key>
          </dt>
          <dd>Interact, talk, or move dialogue along. Clicking things works too.</dd>
          <dt>
            <Key>Q</Key>
          </dt>
          <dd>Use the current emotion’s ability on whatever is nearby.</dd>
          <dt>
            <Key>Space</Key>
          </dt>
          <dd>At the console: use the ability on Riley’s moment.</dd>
          <dt>
            <Key>M</Key>
          </dt>
          <dd>Open the Mind Atlas and think your way to anywhere you’ve been.</dd>
          <dt>
            <Key>Esc</Key>
          </dt>
          <dd>Pause (save, volume, restart), or close whatever is open.</dd>
          <dt>
            <Key>J</Key> <Key>R</Key>
          </dt>
          <dd>Riley’s journal (memories, her week, emotion levels, discoveries) and how she’s doing.</dd>
        </dl>
        <h2 style={{ fontSize: 22, marginTop: 18 }}>Who does what</h2>
        <dl className="controls">
          {EMOTION_ORDER.map((id) => (
            <div key={id} style={{ display: 'contents' }}>
              <dt style={{ color: EMOTIONS[id].color, fontFamily: 'var(--font-display)', fontWeight: 800 }}>{EMOTIONS[id].name}</dt>
              <dd>
                <strong>{EMOTIONS[id].ability.name}.</strong> {EMOTIONS[id].ability.description}
              </dd>
            </div>
          ))}
        </dl>
        <div className="sheet__actions">
          <button ref={btn} className="primary" onClick={close}>
            Back to the game
          </button>
        </div>
      </div>
    </div>
  );
}

function ago(t: number | null) {
  if (!t) return 'not yet this session';
  const sec = Math.round((Date.now() - t) / 1000);
  if (sec < 10) return 'just now';
  if (sec < 60) return `${sec} seconds ago`;
  const min = Math.round(sec / 60);
  return `${min} minute${min === 1 ? '' : 's'} ago`;
}

export function PauseMenu() {
  const open = useGame((s) => s.menuOpen);
  const muted = useGame((s) => s.muted);
  const reduced = useGame((s) => s.reducedMotion);
  const music = useGame((s) => s.musicVolume);
  const sfx = useGame((s) => s.sfxVolume);
  const lastSaved = useGame((s) => s.lastSaved);
  const s = useGame.getState;
  const btn = useAutoFocus<HTMLButtonElement>(open);
  const [confirm, setConfirm] = useState(false);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!open) return;
    setConfirm(false);
    const id = window.setInterval(() => tick((n) => n + 1), 5000);
    return () => window.clearInterval(id);
  }, [open]);
  if (!open) return null;
  const close = () => s().setMenu(false);
  return (
    <div className="scrim" onClick={close}>
      <div className="sheet pause" role="dialog" aria-modal="true" aria-labelledby="pause-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="pause-title">Paused</h2>
        <p>Riley’s mind will wait for you. Progress saves by itself on this device; last saved {ago(lastSaved)}.</p>
        <div className="menu-list">
          <button ref={btn} onClick={close}>
            Resume <span className="state">Esc</span>
          </button>
          <button
            onClick={() => {
              s().markSaved();
              s().showToast('Game saved on this device.', '#FFCF33');
            }}
          >
            Save now <span className="state">{ago(lastSaved)}</span>
          </button>
          <button
            onClick={() => {
              close();
              s().setHelp(true);
            }}
          >
            Controls
          </button>
        </div>
        <div className="sliders">
          <label>
            <span>Music</span>
            <input type="range" min={0} max={1} step={0.05} value={music} onChange={(e) => s().setVolumes(Number(e.target.value), sfx)} aria-valuetext={`${Math.round(music * 100)}%`} />
            <output>{Math.round(music * 100)}%</output>
          </label>
          <label>
            <span>Sound effects</span>
            <input type="range" min={0} max={1} step={0.05} value={sfx} onChange={(e) => s().setVolumes(music, Number(e.target.value))} aria-valuetext={`${Math.round(sfx * 100)}%`} />
            <output>{Math.round(sfx * 100)}%</output>
          </label>
        </div>
        <div className="menu-list">
          <button onClick={() => s().setMuted(!muted)} aria-pressed={!muted}>
            All sound <span className="state">{muted ? 'Off' : 'On'}</span>
          </button>
          <button onClick={() => s().setReducedMotion(!reduced)} aria-pressed={reduced}>
            Reduce motion <span className="state">{reduced ? 'On' : 'Off'}</span>
          </button>
          <button
            onClick={() => {
              s().markSaved();
              useGame.setState({ menuOpen: false, phase: 'title' });
            }}
          >
            Save and return to the title
          </button>
          {confirm ? (
            <button className="danger" onClick={() => s().newGame()}>
              Yes, erase the save and start a new game
            </button>
          ) : (
            <button onClick={() => setConfirm(true)}>Start a new game</button>
          )}
        </div>
      </div>
    </div>
  );
}
