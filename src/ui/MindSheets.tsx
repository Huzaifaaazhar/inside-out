import { useEffect, useRef, useState } from 'react';
import { EMOTIONS, EMOTION_ORDER } from '../game/content/emotions';
import type { IslandId } from '../game/content/world';
import { ISLANDS } from '../game/content/world';
import { getGame } from '../game/Game';
import { SCENARIO_BY_DAY } from '../game/scenario/scenarios';
import type { ActivityScene } from '../game/ActivityScene';
import { DiscoveriesTab, EmotionsTab, WeekTab } from './JournalTabs';
import { TOTAL_MEMORIES, allEntries } from '../game/systems/library';
import type { MemStatus, StatKey } from '../game/systems/mind';
import { BAND_LABEL, STAT_KEYS, STAT_LABEL, emotionShare, stabilityBand } from '../game/systems/mind';
import { useGame } from '../state/store';
import { PrimaryButton } from './ConsolePanel';

const useFocus = <T extends HTMLElement>(open: boolean) => {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (open) ref.current?.focus();
  }, [open]);
  return ref;
};

const word = (v: number) => (v >= 75 ? 'Strong' : v >= 55 ? 'Good' : v >= 35 ? 'Wobbly' : 'Low');

// ───────────────────────────── memory journal ─────────────────────────────

type Filter = 'all' | 'kept' | 'fading' | 'forgotten' | 'core';
const FILTERS: { id: Filter; label: string; match: (s?: MemStatus) => boolean }[] = [
  { id: 'all', label: 'All', match: () => true },
  { id: 'core', label: 'Core', match: (s) => s === 'core' },
  { id: 'kept', label: 'Kept', match: (s) => s === 'long-term' },
  { id: 'fading', label: 'Fading', match: (s) => s === 'faded' },
  { id: 'forgotten', label: 'Forgotten', match: (s) => s === 'forgotten' || s === 'released' },
];

/** Every memory Riley has, on painted shelves, grouped by how it's being kept. */
export function Journal() {
  const open = useGame((s) => s.journalOpen);
  const mind = useGame((s) => s.mind);
  const setJournal = useGame((s) => s.setJournal);
  const setTheatre = useGame((s) => s.setTheatre);
  const [filter, setFilter] = useState<Filter>('all');
  const [tab, setTab] = useState<'memories' | 'week' | 'emotions' | 'found'>('memories');
  const btn = useFocus<HTMLButtonElement>(open);
  if (!open || !mind) return null;
  const entries = allEntries(mind);
  const found = entries.filter((e) => mind.memories[e.id]?.discovered);
  const f = FILTERS.find((x) => x.id === filter)!;
  const shown = entries.filter((e) => f.match(mind.memories[e.id]?.status));
  const colours = EMOTION_ORDER.map((e) => ({ e, n: found.filter((m) => mind.memories[m.id]?.emotion === e && mind.memories[m.id]?.status !== 'released').length }));
  const top = [...colours].sort((a, b) => b.n - a.n)[0];
  const close = () => setJournal(false);
  return (
    <div className="scrim" onClick={close}>
      <div className="sheet journal" role="dialog" aria-modal="true" aria-labelledby="journal-title" onClick={(e) => e.stopPropagation()}>
        <div className="journal__head">
          <div>
            <h2 id="journal-title">Riley’s journal</h2>
            <p>
              {found.length} of {TOTAL_MEMORIES} memories found. {top.n ? `Right now Riley’s memories are mostly ${EMOTIONS[top.e].name.toLowerCase()}.` : ''}
            </p>
          </div>
          <button ref={btn} className="ghost" onClick={close}>
            Close
          </button>
        </div>
        <div className="tabs tabs--big" role="tablist" aria-label="Journal sections">
          {(
            [
              ['memories', 'Memories'],
              ['week', 'Riley’s week'],
              ['emotions', 'Emotions'],
              ['found', 'Discoveries'],
            ] as const
          ).map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </div>
        {tab === 'week' && <WeekTab mind={mind} />}
        {tab === 'emotions' && <EmotionsTab />}
        {tab === 'found' && <DiscoveriesTab mind={mind} />}
        {tab === 'memories' && (
          <>
        <div className="journal__colours" aria-label="Memories by colour">
          {colours.map(({ e, n }) => (
            <span key={e} className="chip chip--static" style={{ ['--c' as string]: EMOTIONS[e].color }}>
              {EMOTIONS[e].name} {n}
            </span>
          ))}
        </div>
        <div className="tabs" role="tablist" aria-label="Filter memories">
          {FILTERS.map((x) => (
            <button key={x.id} role="tab" aria-selected={filter === x.id} onClick={() => setFilter(x.id)}>
              {x.label}
            </button>
          ))}
        </div>
        <ul className="shelf">
          {shown.map((e) => {
            const m = mind.memories[e.id];
            const known = !!m?.discovered;
            const status = m?.status ?? 'long-term';
            const isl = ISLANDS.find((i) => i.id === e.island);
            return (
              <li key={e.id}>
                <button
                  className="jar"
                  disabled={!known || status === 'released'}
                  data-status={status}
                  data-sig={e.significance}
                  style={{ ['--c' as string]: EMOTIONS[m?.emotion ?? e.emotion].color }}
                  onClick={() => setTheatre(e.id)}
                  aria-label={known ? `${e.title}. ${EMOTIONS[m!.emotion].name}. ${status}. ${e.significance}.` : 'A memory not found yet'}
                >
                  <span className="jar__orb" aria-hidden="true">
                    {!known && '?'}
                  </span>
                  <span className="jar__title">{known ? e.title : 'Not found yet'}</span>
                  <span className="jar__meta">
                    {known ? `${status === 'long-term' ? 'Kept' : status === 'released' ? 'Let go' : status[0].toUpperCase() + status.slice(1)}${isl ? `, ${isl.name.replace(' Island', '')}` : ''}` : e.when}
                  </span>
                  {known && m!.lenses.length > 0 && <span className="jar__lenses">{m!.lenses.length} of 5 views</span>}
                </button>
              </li>
            );
          })}
          {!shown.length && <li className="shelf__empty">Nothing here right now.</li>}
        </ul>
        <p className="journal__hint">Replay a memory to find it. Memories you don’t revisit fade after a few nights and drift into The Fading.</p>
          </>
        )}
      </div>
    </div>
  );
}

// ───────────────────────────── how Riley's doing ─────────────────────────────

export function MindReport() {
  const open = useGame((s) => s.reportOpen);
  const mind = useGame((s) => s.mind);
  const setReport = useGame((s) => s.setReport);
  const btn = useFocus<HTMLButtonElement>(open);
  if (!open || !mind) return null;
  const share = emotionShare(mind);
  const anyUse = EMOTION_ORDER.some((e) => mind.emotionUse[e] > 0);
  const entries = allEntries(mind);
  const close = () => setReport(false);
  return (
    <div className="scrim" onClick={close}>
      <div className="sheet report" role="dialog" aria-modal="true" aria-labelledby="report-title" onClick={(e) => e.stopPropagation()}>
        <div className="journal__head">
          <div>
            <h2 id="report-title">How Riley’s doing</h2>
            <p>Day {Math.min(mind.day, 6)}. {mind.pending.length ? `${mind.pending.length} thing${mind.pending.length > 1 ? 's' : ''} from earlier days ${mind.pending.length > 1 ? 'are' : 'is'} still echoing.` : 'Nothing from earlier days is waiting to catch up with her.'}</p>
          </div>
          <button ref={btn} className="ghost" onClick={close}>
            Close
          </button>
        </div>
        <section aria-labelledby="r-stats">
          <h3 id="r-stats">Inside</h3>
          <dl className="meters">
            {STAT_KEYS.map((k: StatKey) => (
              <div key={k} className="meter">
                <dt>{STAT_LABEL[k]}</dt>
                <dd>
                  <span className="bar" aria-hidden="true">
                    <span style={{ width: `${mind.stats[k]}%` }} />
                  </span>
                  <span className="meter__word">
                    {word(mind.stats[k])} <small>{mind.stats[k]}</small>
                  </span>
                </dd>
              </div>
            ))}
          </dl>
        </section>
        <section aria-labelledby="r-who">
          <h3 id="r-who">Who’s been driving</h3>
          {anyUse ? (
            <>
              <div className="sharebar" role="img" aria-label={EMOTION_ORDER.map((e) => `${EMOTIONS[e].name} ${Math.round(share[e] * 100)}%`).join(', ')}>
                {EMOTION_ORDER.map((e) => (
                  <span key={e} style={{ flexGrow: share[e] || 0.0001, background: EMOTIONS[e].color }} />
                ))}
              </div>
              <p className="small">{EMOTION_ORDER.filter((e) => share[e] > 0).map((e) => `${EMOTIONS[e].name} ${Math.round(share[e] * 100)}%`).join(', ')}</p>
            </>
          ) : (
            <p className="small">No decisions yet. Mix the emotions at the console to start.</p>
          )}
        </section>
        <section aria-labelledby="r-islands">
          <h3 id="r-islands">Personality islands</h3>
          <ul className="islandlist">
            {ISLANDS.map((d) => {
              const v = mind.islands[d.id as IslandId];
              const linked = entries.filter((e) => e.island === d.id && e.significance !== 'everyday');
              return (
                <li key={d.id} style={{ ['--c' as string]: d.color }}>
                  <div className="islandlist__row">
                    <strong>{d.name}</strong>
                    <span>
                      {BAND_LABEL[stabilityBand(v)]} <small>{v}</small>
                    </span>
                  </div>
                  <span className="bar" aria-hidden="true">
                    <span style={{ width: `${v}%`, background: d.color }} />
                  </span>
                  {linked.length > 0 && (
                    <p className="small">
                      {linked
                        .map((e) => {
                          const m = mind.memories[e.id];
                          const st = !m ? 'not made yet' : m.status === 'long-term' ? 'kept' : m.status;
                          return `${e.title} (${st})`;
                        })
                        .join(', ')}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
        <section aria-labelledby="r-log">
          <h3 id="r-log">What’s happened</h3>
          <ol className="log">
            {[...mind.log].reverse().slice(0, 10).map((l, i) => (
              <li key={i} data-tone={l.tone}>
                <span className="log__day">Day {l.day}</span> {l.text}
              </li>
            ))}
            {!mind.log.length && <li>Nothing yet. Riley’s days start at the console.</li>}
          </ol>
        </section>
      </div>
    </div>
  );
}

// ───────────────────────────── overnight ─────────────────────────────

export function NightReport() {
  const r = useGame((s) => s.nightReport);
  const dismiss = useGame((s) => s.dismissNight);
  const btn = useFocus<HTMLButtonElement>(!!r);
  if (!r) return null;
  const next = SCENARIO_BY_DAY[r.day];
  const changed = STAT_KEYS.filter((k) => r.statAfter[k] !== r.statBefore[k]);
  const wake = () => {
    dismiss();
    const s = useGame.getState();
    if (next) s.showToast(`Day ${r.day}: ${next.title}`, '#FFE58A');
    else {
      s.showToast('Day 7: something big is coming. Explore the deeper parts of Riley’s mind, then take the console.', '#FFE58A');
      s.setReport(true);
    }
    getGame()?.audio.chime(0);
  };
  return (
    <div className="scrim scrim--night">
      <div className="sheet night" role="dialog" aria-modal="true" aria-labelledby="night-title">
        <h2 id="night-title">While Riley sleeps</h2>
        <p className="night__lede">The day’s memories roll down the tubes. Things settle. Some things catch up.</p>
        {r.fired.length > 0 && (
          <section>
            <h3>Things that caught up with her</h3>
            <ul className="log">
              {r.fired.map((f, i) => (
                <li key={i} data-tone={f.tone}>
                  {f.text}
                </li>
              ))}
            </ul>
          </section>
        )}
        {r.notes.length > 0 && (
          <section>
            <h3>How the day sat with her</h3>
            <ul className="log">
              {r.notes.map((f, i) => (
                <li key={i} data-tone={f.tone}>
                  {f.text}
                </li>
              ))}
            </ul>
          </section>
        )}
        {(r.faded.length > 0 || r.forgotten.length > 0) && (
          <section>
            <h3>Memories slipping</h3>
            <ul className="log">
              {r.faded.map((t) => (
                <li key={t} data-tone="mixed">
                  “{t}” is starting to fade. Replay it to keep it.
                </li>
              ))}
              {r.forgotten.map((t) => (
                <li key={t} data-tone="bad">
                  “{t}” rolled down into The Fading.
                </li>
              ))}
            </ul>
          </section>
        )}
        {r.islandChanges.length > 0 && (
          <section>
            <h3>Islands shifted</h3>
            <ul className="log">
              {r.islandChanges.map((c) => {
                const d = ISLANDS.find((i) => i.id === c.id)!;
                return (
                  <li key={c.id} data-tone={c.to > c.from ? 'good' : 'bad'}>
                    {d.name} {c.to > c.from ? 'grew steadier' : 'weakened'} ({c.from} to {c.to}).{' '}
                    {stabilityBand(c.from) === stabilityBand(c.to)
                      ? `Still ${BAND_LABEL[stabilityBand(c.to)].toLowerCase()}.`
                      : `Now ${BAND_LABEL[stabilityBand(c.to)].toLowerCase()}.`}
                  </li>
                );
              })}
            </ul>
          </section>
        )}
        {changed.length > 0 && (
          <p className="small">
            {changed.map((k) => `${STAT_LABEL[k]} ${r.statAfter[k] > r.statBefore[k] ? 'up' : 'down'} ${Math.abs(r.statAfter[k] - r.statBefore[k])}`).join('. ')}.
          </p>
        )}
        <div className="sheet__actions">
          <button ref={btn} className="primary" onClick={wake}>
            {next ? `Wake up for day ${r.day}` : 'See how it all turned out'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────── island activities ─────────────────────────────

export function ActivityPanel() {
  const activity = useGame((s) => s.activity);
  const mg = useGame((s) => s.minigame);
  const dialogue = useGame((s) => s.dialogue);
  if (!activity || !mg || dialogue) return null;
  return (
    <section className="cpanel cpanel--dock" aria-label={mg.title} style={{ ['--accent' as string]: EMOTIONS[mg.emotion].color }}>
      <div className="cpanel__top">
        <h3>{mg.title}</h3>
      </div>
      <p>{mg.instruction}</p>
      <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(mg.progress * 100)} aria-label="Progress">
        <div style={{ width: `${Math.round(mg.progress * 100)}%` }} />
      </div>
      <div className="cpanel__row">
        {mg.primary && mg.mode !== 'none' && <PrimaryButton key={activity} label={mg.primary} mode={mg.mode} />}
        <button className="ghost" onClick={() => (getGame()?.current as ActivityScene | undefined)?.endActivity?.(false)}>
          Stop
        </button>
      </div>
    </section>
  );
}
