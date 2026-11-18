import { audio } from '../engine/audio';
import { EMOTIONS, EMOTION_ORDER } from '../game/content/emotions';
import { getGame } from '../game/Game';
import type { OpeningScene } from '../game/scenes/OpeningScene';
import { hasSave, useGame } from '../state/store';
import { useState } from 'react';
import { Key } from './icons';

const WORD = 'Headquarters';

export function TitleScreen() {
  const start = useGame((s) => s.start);
  const muted = useGame((s) => s.muted);
  const setMuted = useGame((s) => s.setMuted);
  const continueGame = useGame((s) => s.continueGame);
  const newGame = useGame((s) => s.newGame);
  const [saved] = useState(hasSave);
  const [confirm, setConfirm] = useState(false);
  const begin = (fn: () => void) => {
    audio.unlock();
    audio.setMuted(muted);
    audio.chime(0);
    fn();
  };
  return (
    <main className="title">
      <div className="title__inner">
        <h1 className="title__word" aria-label={WORD}>
          {WORD.split('').map((ch, i) => (
            <span key={i} aria-hidden="true" style={{ ['--c' as string]: EMOTIONS[EMOTION_ORDER[i % 5]].color, ['--i' as string]: i }}>
              {ch}
            </span>
          ))}
        </h1>
        <p className="title__lede">
          Five emotions steer one eleven-year-old through her day. You’re the new operator. Choose who drives, use their abilities, and help Riley make a memory worth keeping.
        </p>
        {saved ? (
          <>
            <button className="title__start" autoFocus onClick={() => begin(continueGame)}>
              Continue
            </button>
            {confirm ? (
              <div className="title__row" role="group" aria-label="Start over?">
                <span>This wipes Riley’s saved days.</span>
                <button className="ghost" onClick={() => begin(newGame)}>
                  Yes, start over
                </button>
                <button className="ghost" onClick={() => setConfirm(false)}>
                  Keep my save
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <button className="title__start" autoFocus onClick={() => begin(start)}>
            Enter Riley’s mind
          </button>
        )}
        <div className="title__row">
          {saved && !confirm && (
            <button className="ghost" onClick={() => setConfirm(true)}>
              Start over
            </button>
          )}
          <button className="ghost" onClick={() => setMuted(!muted)} aria-pressed={!muted}>
            Sound: {muted ? 'off' : 'on'}
          </button>
        </div>
        <p className="title__fine">
          Best with sound and a keyboard; mouse and touch work too. A fan-made game inspired by Pixar’s Inside Out. All art and sound here are drawn and synthesized in code.
        </p>
      </div>
    </main>
  );
}

export function Captions() {
  const caption = useGame((s) => s.caption);
  const skip = () => (getGame()?.scenes.opening as OpeningScene | undefined)?.skip();
  return (
    <>
      <div className="captions" aria-live="polite">
        {caption && <p key={caption}>{caption}</p>}
      </div>
      <button className="skip" onClick={skip}>
        Skip intro <Key>Esc</Key>
      </button>
    </>
  );
}
