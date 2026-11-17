import { useCallback, useEffect, useRef, useState } from 'react';
import { audio } from '../engine/audio';
import { SPEAKERS } from '../game/content/emotions';
import { getGame } from '../game/Game';
import { useGame } from '../state/store';
import { NextIcon } from './icons';
import { Portrait } from './Portrait';

const CHAR_MS = 22;

export function DialogueBox() {
  const d = useGame((s) => s.dialogue);
  const advance = useGame((s) => s.advance);
  const reduced = useGame((s) => s.reducedMotion);
  const atConsole = useGame((s) => s.consoleStage !== 'off');
  const line = d ? d.lines[d.index] : null;
  const [shown, setShown] = useState(0);
  const openedAt = useRef(0);
  const btnRef = useRef<HTMLButtonElement>(null);
  const text = line?.text ?? '';
  const done = shown >= text.length;

  // restart the typewriter for every new line
  useEffect(() => {
    if (!line) return;
    openedAt.current = performance.now();
    setShown(reduced ? text.length : 0);
    btnRef.current?.focus({ preventScroll: true });
  }, [d?.id, d?.index]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!line || done) return;
    const id = window.setInterval(() => {
      setShown((n) => {
        const next = Math.min(text.length, n + 1);
        if (next % 3 === 0 && text[next - 1] !== ' ') audio.voice(line.speaker);
        return next;
      });
    }, CHAR_MS);
    return () => window.clearInterval(id);
  }, [line, done, text]);

  const onAdvance = useCallback(() => {
    // ignore the tail of a key press that opened this line
    if (performance.now() - openedAt.current < 220) return;
    if (!done) {
      setShown(text.length);
      return;
    }
    audio.blip(1.2);
    advance();
  }, [done, text.length, advance]);

  // E advances too, without also triggering the world's interact on the same press
  useEffect(() => {
    if (!d) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const onButton = target && target.tagName === 'BUTTON';
      if (e.code === 'KeyE' || ((e.code === 'Space' || e.code === 'Enter') && !onButton)) {
        e.preventDefault();
        getGame()?.input.consumeKey(e.code);
        if (!e.repeat) onAdvance();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [d, onAdvance]);

  if (!d || !line) return null;
  const sp = SPEAKERS[line.speaker];
  const narrator = line.speaker === 'narrator' || line.speaker === 'console';
  const emotionPortrait = ['joy', 'sadness', 'anger', 'fear', 'disgust', 'mote'].includes(line.speaker);
  return (
    <section
      className={`dialogue${narrator ? ' dialogue--narrator' : ''}${atConsole ? '' : ' dialogue--top'}`}
      style={{ ['--c' as string]: sp.color }}
      aria-label="Dialogue"
      onClick={onAdvance}
    >
      <div className="dialogue__portrait" aria-hidden="true">
        {emotionPortrait ? <Portrait key={line.speaker} id={line.speaker} size={112} talking={!done} /> : narrator ? '✦' : sp.name.charAt(0)}
      </div>
      <div className="dialogue__bubble">
        {sp.name && <div className="dialogue__name">{sp.name}</div>}
        <p className="dialogue__text" aria-live="polite">
          <span>{text.slice(0, shown)}</span>
          <span style={{ opacity: 0 }} aria-hidden="true">
            {text.slice(shown)}
          </span>
        </p>
        {d.choices && d.index === d.lines.length - 1 && done ? (
          <div className="cpanel__row" style={{ marginTop: 12 }}>
            {d.choices.map((c) => (
              <button key={c.label} className="ghost" onClick={(e) => (e.stopPropagation(), useGame.setState({ dialogue: null }), c.run())}>
                {c.label}
              </button>
            ))}
          </div>
        ) : (
          <button
            ref={btnRef}
            className="dialogue__next"
            style={{ border: 0, background: 'none', padding: 4 }}
            onClick={(e) => {
              e.stopPropagation();
              onAdvance();
            }}
          >
            {done ? (d.index < d.lines.length - 1 ? 'Next' : 'Close') : 'Skip'}
            <NextIcon />
          </button>
        )}
      </div>
    </section>
  );
}
