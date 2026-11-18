import { useEffect, useRef, useState } from 'react';
import type { EmotionId } from '../game/content/emotions';
import { EMOTIONS, EMOTION_ORDER } from '../game/content/emotions';
import { getGame } from '../game/Game';
import { ENDINGS, ENDING_ORDER, PURPOSE_LINE } from '../game/scenario/finale';
import type { HQScene } from '../game/scenes/HQScene';
import { allEntries } from '../game/systems/library';
import { emotionShare } from '../game/systems/mind';
import { PURPOSE } from '../game/systems/progress';
import { useGame } from '../state/store';
import { Portrait } from './Portrait';

const PICK = 3;

/** Day 7, step two: Riley chooses which memories to hold on to before she decides. */
export function ReflectPanel() {
  const mind = useGame((s) => s.mind);
  const [picked, setPicked] = useState<string[]>([]);
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    first.current?.focus();
  }, []);
  if (!mind) return null;
  const entries = allEntries(mind).filter((e) => {
    const m = mind.memories[e.id];
    return m?.discovered && (m.status === 'core' || m.status === 'long-term' || m.status === 'faded');
  });
  const lost = allEntries(mind).filter((e) => ['forgotten', 'released'].includes(mind.memories[e.id]?.status ?? '')).length;
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= PICK ? p : [...p, id]));
  const done = () => (getGame()?.scenes.hq as HQScene | undefined)?.finishReflection(picked);
  const colours = new Set(picked.map((id) => mind.memories[id]?.emotion));
  return (
    <section className="cpanel cpanel--dock reflect" aria-labelledby="reflect-title">
      <div className="cpanel__top">
        <h3 id="reflect-title">What Riley holds on to</h3>
        <span className="cpanel__beat">Step 2 of 4</span>
      </div>
      <p>
        Pick up to {PICK} memories. {lost ? `${lost} faded or let-go memor${lost === 1 ? 'y is' : 'ies are'} out of reach.` : 'Every memory she kept is here.'}
      </p>
      <ul className="reflect__list">
        {entries.map((e, i) => {
          const m = mind.memories[e.id];
          const on = picked.includes(e.id);
          return (
            <li key={e.id}>
              <button
                ref={i === 0 ? first : undefined}
                className="reflect__mem"
                aria-pressed={on}
                disabled={!on && picked.length >= PICK}
                onClick={() => toggle(e.id)}
                style={{ ['--c' as string]: EMOTIONS[m.emotion].color }}
                aria-label={`${e.title}. ${EMOTIONS[m.emotion].name}. ${m.status === 'core' ? 'Core memory.' : ''}${on ? ' Chosen.' : ''}`}
              >
                <span className="reflect__orb" aria-hidden="true" />
                <span className="reflect__title">{e.title}</span>
                <span className="reflect__meta">
                  {EMOTIONS[m.emotion].name}
                  {m.status === 'core' ? ' · core' : m.status === 'faded' ? ' · fading' : ''}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="cpanel__row">
        <button className="primary" onClick={done}>
          {picked.length ? `Remember ${picked.length === 1 ? 'this' : 'these'}` : 'Remember nothing tonight'}
        </button>
        <span className="mix__budget" aria-live="polite">
          {picked.length ? `${picked.length} of ${PICK} chosen · ${colours.size} colour${colours.size === 1 ? '' : 's'}` : 'Each memory carries its colour into the decision.'}
        </span>
      </div>
    </section>
  );
}

/** The last screen: how it ended, why, and what every emotion did. */
export function EndingScreen() {
  const open = useGame((s) => s.endingOpen);
  const ending = useGame((s) => s.ending);
  const mind = useGame((s) => s.mind);
  const progress = useGame((s) => s.progress);
  const hasSnap = useGame((s) => !!s.finaleSnapshot);
  const btn = useRef<HTMLButtonElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const [confirmNew, setConfirmNew] = useState(false);
  useEffect(() => {
    // start at the top of the sheet so the ending's title is the first thing seen and announced
    if (open) title.current?.focus({ preventScroll: false });
  }, [open]);
  if (!open || !ending || !mind) return null;
  const def = ENDINGS[ending.id];
  const share = emotionShare(mind);
  const close = () => useGame.getState().setEndingOpen(false);
  const replay = () => {
    useGame.getState().replayFinale();
    useGame.getState().showToast('The turning point is ready to try again at the console.', '#FFCF33');
  };
  const found = ENDING_ORDER.filter((id) => progress.discoveries.includes(`ending-${id}`));
  const stats: [string, number][] = [
    ['Family', mind.stats.family],
    ['Friendships', mind.stats.friendship],
    ['Confidence', mind.stats.confidence],
    ['Belonging', mind.stats.belonging],
    ['Emotional balance', mind.stats.balance],
  ];
  return (
    <div className="scrim scrim--ending">
      <div className="sheet ending" role="dialog" aria-modal="true" aria-labelledby="ending-title" data-ending={ending.id}>
        <p className="ending__kicker">Riley’s story · Ending</p>
        <h2 id="ending-title" ref={title} tabIndex={-1}>
          {def.title}
        </h2>
        <p className="ending__summary">{def.summary}</p>
        <p className="ending__decision">{def.decision}</p>

        <h3>Every emotion has a purpose</h3>
        <ul className="ending__voices">
          {EMOTION_ORDER.map((e: EmotionId) => {
            const heard = ending.heard.includes(e);
            return (
              <li key={e} data-heard={heard ? '' : undefined} style={{ ['--c' as string]: EMOTIONS[e].color }}>
                <Portrait id={e} size={56} animate={heard} />
                <div>
                  <strong>
                    {EMOTIONS[e].name} <span className="ending__share">{Math.round((share[e] ?? 0) * 100)}% of the week</span>
                  </strong>
                  <span>{heard ? PURPOSE_LINE[e] : `Not heard on the final night. ${PURPOSE[e]}`}</span>
                </div>
              </li>
            );
          })}
        </ul>

        <dl className="ending__stats">
          {stats.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>
                <span className="bar" aria-hidden="true">
                  <span style={{ width: `${v}%` }} />
                </span>
                <span className="small">{Math.round(v)}</span>
              </dd>
            </div>
          ))}
        </dl>

        <p className="ending__found">
          Endings found: {found.length} of {ENDING_ORDER.length}
          {' · '}
          {ENDING_ORDER.map((id) => (found.includes(id) ? ENDINGS[id].title : '???')).join(' · ')}
        </p>
        <p className="small">
          Insights {progress.insights.length} of 15 · Hidden fears {progress.fears.length} of 5 · Dreams made {progress.dreams.length}
        </p>

        <div className="sheet__actions">
          <button ref={btn} className="primary" onClick={close}>
            Keep exploring Riley’s mind
          </button>
          {hasSnap && (
            <button className="ghost" onClick={replay}>
              Try the turning point again
            </button>
          )}
          {!confirmNew ? (
            <button className="ghost" onClick={() => setConfirmNew(true)}>
              Start a new game
            </button>
          ) : (
            <button className="ghost danger" onClick={() => useGame.getState().newGame()}>
              Really start over? This erases the save
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
