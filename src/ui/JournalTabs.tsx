import type { EmotionId } from '../game/content/emotions';
import { EMOTIONS, EMOTION_ORDER } from '../game/content/emotions';
import { ENDINGS, ENDING_ORDER } from '../game/scenario/finale';
import { SCENARIOS } from '../game/scenario/scenarios';
import { getEntry } from '../game/systems/library';
import type { MindState } from '../game/systems/mind';
import { HIDDEN_FEARS, INSIGHTS, LEVEL_PERK, LEVEL_TITLE, MAX_LEVEL, PURPOSE, levelOf, levelProgress } from '../game/systems/progress';
import { useGame } from '../state/store';
import { Portrait } from './Portrait';

/** Riley's week: every day played, what it became, and what followed. */
export function WeekTab({ mind }: { mind: MindState }) {
  const ending = useGame((s) => s.ending);
  const finale = useGame((s) => s.finale);
  const days = [...SCENARIOS].sort((a, b) => a.day - b.day);
  return (
    <ol className="week">
      <li className="week__day" data-done="">
        <span className="week__num">Day 1</span>
        <div>
          <strong>Art club</strong>
          <p className="small">Riley’s first day at a new club, steered from Headquarters.</p>
        </div>
      </li>
      {days.map((sc) => {
        const done = mind.scenariosDone.includes(sc.id);
        const mem = mind.memories[sc.memory.id];
        const log = mind.log.filter((l) => l.day === sc.day && !l.text.startsWith('New memory'));
        return (
          <li key={sc.id} className="week__day" data-done={done ? '' : undefined} data-now={!done && mind.day === sc.day ? '' : undefined}>
            <span className="week__num">Day {sc.day}</span>
            <div>
              <strong>{done || mind.day >= sc.day ? sc.title : 'Still to come'}</strong>
              {done ? (
                <>
                  <p className="small">{sc.summary}</p>
                  {mem && (
                    <p className="week__mem" style={{ ['--c' as string]: EMOTIONS[mem.emotion].color }}>
                      <span className="dot" aria-hidden="true" /> Became “{sc.memory.title}”, mostly {EMOTIONS[mem.emotion].name.toLowerCase()}
                      {mem.swirl.length ? `, with ${mem.swirl.map((e) => EMOTIONS[e].name.toLowerCase()).join(' and ')}` : ''}.
                    </p>
                  )}
                  {log.length > 0 && (
                    <ul className="week__log">
                      {log.slice(-4).map((l, i) => (
                        <li key={i} data-tone={l.tone}>
                          {l.text}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : (
                <p className="small">{mind.day === sc.day ? 'Waiting at the console.' : 'Not played yet.'}</p>
              )}
            </div>
          </li>
        );
      })}
      <li className="week__day" data-done={ending ? '' : undefined} data-now={!ending && mind.day >= 7 ? '' : undefined}>
        <span className="week__num">Day 7</span>
        <div>
          <strong>{ending ? `The turning point: “${ENDINGS[ending.id].title}”` : 'The turning point'}</strong>
          {ending ? (
            <>
              <p className="small">{ENDINGS[ending.id].decision}</p>
              {finale && (
                <p className="small">
                  Voices heard on the final night: {ending.heard.map((e) => EMOTIONS[e].name).join(', ') || 'none'}. {finale.overloads ? `${finale.overloads} time${finale.overloads === 1 ? '' : 's'} one emotion took over.` : 'No emotion took over.'}
                </p>
              )}
            </>
          ) : (
            <p className="small">{mind.day >= 7 ? 'Something big is waiting at the console.' : 'Not yet.'}</p>
          )}
        </div>
      </li>
    </ol>
  );
}

/** Emotions: levels, experience, perks, insights and what each one is for. */
export function EmotionsTab() {
  const progress = useGame((s) => s.progress);
  return (
    <ul className="emolist">
      {EMOTION_ORDER.map((e: EmotionId) => {
        const E = EMOTIONS[e];
        const xp = progress.xp[e];
        const lv = levelOf(xp);
        const p = levelProgress(xp).into;
        const ins = INSIGHTS.filter((i) => i.emotion === e);
        return (
          <li key={e} style={{ ['--c' as string]: E.color }}>
            <div className="emolist__head">
              <Portrait id={e} size={64} animate={false} />
              <div>
                <strong>
                  {E.name} <span className="emolist__lv">Level {lv}: {LEVEL_TITLE[lv - 1]}</span>
                </strong>
                <span className="bar" aria-label={`${Math.round(p * 100)}% to the next level`}>
                  <span style={{ width: `${lv >= MAX_LEVEL ? 100 : p * 100}%`, background: E.color }} />
                </span>
                <span className="small">
                  {xp} experience. {lv >= MAX_LEVEL ? 'Fully grown.' : `Next: ${LEVEL_PERK[lv].toLowerCase()}`}
                </span>
              </div>
            </div>
            <p className="emolist__purpose">{PURPOSE[e]}</p>
            <ul className="emolist__ins">
              {ins.map((i) => {
                const got = progress.insights.includes(i.id);
                return (
                  <li key={i.id} data-got={got ? '' : undefined}>
                    {got ? `“${i.text}”` : 'An undiscovered insight'} <span className="small">· {i.where}</span>
                  </li>
                );
              })}
            </ul>
          </li>
        );
      })}
    </ul>
  );
}

/** Everything found away from Headquarters: hidden fears, tonight's dreams, endings. */
export function DiscoveriesTab({ mind }: { mind: MindState }) {
  const progress = useGame((s) => s.progress);
  const found = ENDING_ORDER.filter((id) => progress.discoveries.includes(`ending-${id}`));
  return (
    <div className="disc">
      <section>
        <h3>Hidden fears · {progress.fears.length} of {HIDDEN_FEARS.length}</h3>
        <p className="small">Found in the Subconscious. Naming a fear makes it smaller.</p>
        <ul className="disc__list">
          {HIDDEN_FEARS.map((f) => {
            const got = progress.fears.includes(f.id);
            return (
              <li key={f.id} data-got={got ? '' : undefined}>
                <strong>{got ? f.title : '???'}</strong>
                <span className="small">{got ? f.text : `Something ${EMOTIONS[f.who].name} could bring to light.`}</span>
              </li>
            );
          })}
        </ul>
      </section>
      <section>
        <h3>Dreams made · {progress.dreams.length}</h3>
        <p className="small">Shot at Dream Productions, dreamed that night.</p>
        {progress.dreams.length ? (
          <ul className="disc__list">
            {[...progress.dreams]
              .sort((a, b) => a.day - b.day)
              .map((d) => (
                <li key={d.day} data-got="" style={{ ['--c' as string]: EMOTIONS[d.mood].color }}>
                  <strong>
                    Night {d.day}: {getEntry(d.setting, mind)?.title ?? 'a memory'}
                  </strong>
                  <span className="small">
                    {EMOTIONS[d.mood].name}-lit, but {d.twist}. A {d.kind} dream.
                  </span>
                </li>
              ))}
          </ul>
        ) : (
          <p className="small">No dreams made yet.</p>
        )}
      </section>
      <section>
        <h3>Places visited · {progress.visited.length}</h3>
        <p className="small">{progress.visited.length ? progress.visited.map((v) => v.replace('isle-', '').replace(/^./, (c) => c.toUpperCase())).join(', ') : 'Nowhere yet.'}</p>
      </section>
      <section>
        <h3>Endings · {found.length} of {ENDING_ORDER.length}</h3>
        <ul className="disc__list">
          {ENDING_ORDER.map((id) => (
            <li key={id} data-got={found.includes(id) ? '' : undefined}>
              <strong>{found.includes(id) ? ENDINGS[id].title : '???'}</strong>
              <span className="small">{found.includes(id) ? ENDINGS[id].summary : 'Not reached yet.'}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
