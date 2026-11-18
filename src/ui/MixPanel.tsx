import { useEffect } from 'react';
import type { EmotionId } from '../game/content/emotions';
import { EMOTIONS, EMOTION_ORDER } from '../game/content/emotions';
import { getGame } from '../game/Game';
import { SCENARIOS } from '../game/scenario/scenarios';
import type { HQScene } from '../game/scenes/HQScene';
import { MAX_PIPS_PER_EMOTION, PIP_BUDGET, leadOf, mixTotal } from '../game/systems/mind';
import type { Mix } from '../game/systems/mind';
import { useGame } from '../state/store';
import { Key } from './icons';
import { Portrait } from './Portrait';

/** How each emotion tends to colour a response, in plain words. */
const TENDENCY: Record<EmotionId, string> = {
  joy: 'look for the bright side',
  sadness: 'say how she really feels',
  anger: 'stand up for herself',
  fear: 'play it safe',
  disgust: 'draw a line',
};

export function forecast(mix: Mix, prefer: EmotionId): string {
  const total = mixTotal(mix);
  if (!total) return 'Give some emotions influence to see how Riley might respond.';
  const lead = leadOf(mix, prefer);
  const others = EMOTION_ORDER.filter((e) => e !== lead && mix[e] > 0);
  if (mix[lead] >= MAX_PIPS_PER_EMOTION && others.length === 0) return `${EMOTIONS[lead].name} will take over completely. Riley will ${TENDENCY[lead]}, with nothing to balance it.`;
  if (!others.length) return `Riley will mostly ${TENDENCY[lead]}.`;
  return `Riley will mostly ${TENDENCY[lead]}, and also ${others.map((e) => TENDENCY[e]).join(' and ')}.`;
}

export function MixPanel() {
  const mix = useGame((s) => s.mix);
  const active = useGame((s) => s.active);
  const addPip = useGame((s) => s.addPip);
  const run = useGame((s) => s.scenario);
  const total = mixTotal(mix);
  const left = PIP_BUDGET - total;
  const sc = SCENARIOS.find((x) => x.id === run?.id);
  const moment = sc?.moments[run?.moment ?? 0];
  const lead = leadOf(mix, active);
  const send = () => (getGame()?.scenes.hq as HQScene | undefined)?.commitMix();

  // 1–5 add influence, Shift + 1–5 removes it, Enter sends
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const num = /^(?:Digit|Numpad)([1-5])$/.exec(e.code);
      if (num) {
        e.preventDefault();
        addPip(EMOTION_ORDER[Number(num[1]) - 1], e.shiftKey ? -1 : 1);
        getGame()?.audio.blip(1 + Number(num[1]) * 0.08);
      }
      if ((e.code === 'Enter' || e.code === 'Space') && (e.target as HTMLElement)?.tagName !== 'BUTTON') {
        e.preventDefault();
        getGame()?.input.consumeKey(e.code);
        send();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [addPip]);

  if (!sc || !moment) return null;
  return (
    <section className="cpanel cpanel--dock mix" aria-label="Mix Riley's feelings" style={{ ['--accent' as string]: total ? EMOTIONS[lead].color : 'var(--brass)' }}>
      <div className="cpanel__top">
        <h3>{moment.title}</h3>
        <div className="beats" aria-label={`Moment ${run!.moment + 1} of ${sc.moments.length}`}>
          {sc.moments.map((m, i) => (
            <span key={m.id} data-done={i < run!.moment ? '' : undefined} data-now={i === run!.moment ? '' : undefined} style={i < run!.moment ? { ['--c' as string]: EMOTIONS[run!.results[i].lead].color } : undefined} />
          ))}
        </div>
      </div>
      <p>{moment.prompt}</p>
      <div className="mix__levers" role="group" aria-label={`Influence: ${left} of ${PIP_BUDGET} left`}>
        {EMOTION_ORDER.map((id, i) => {
          const E = EMOTIONS[id];
          const v = mix[id];
          return (
            <div key={id} className="lever" style={{ ['--c' as string]: E.color, ['--light' as string]: E.light }} data-on={v > 0 ? '' : undefined}>
              <div className="lever__face">
                <Portrait id={id} size={44} animate={v > 0} />
              </div>
              <div className="lever__name">{E.name}</div>
              <div className="lever__pips" aria-hidden="true">
                {Array.from({ length: MAX_PIPS_PER_EMOTION }, (_, k) => (
                  <span key={k} data-lit={k < v ? '' : undefined} />
                ))}
              </div>
              <div className="lever__btns">
                <button aria-label={`Less ${E.name}`} disabled={v === 0} onClick={() => addPip(id, -1)}>
                  −
                </button>
                <button aria-label={`More ${E.name}. Now ${v}.`} disabled={v >= MAX_PIPS_PER_EMOTION || left === 0} onClick={() => addPip(id, 1)}>
                  +
                </button>
              </div>
              <span className="lever__key" aria-hidden="true">
                {i + 1}
              </span>
            </div>
          );
        })}
      </div>
      <p className="mix__forecast" aria-live="polite">
        {forecast(mix, active)}
      </p>
      <div className="cpanel__row">
        <button className="primary" disabled={total === 0} onClick={send} style={{ ['--light' as string]: total ? EMOTIONS[lead].light : '#fff' }}>
          Send to Riley <Key>Enter</Key>
        </button>
        <span className="mix__budget">
          {left} of {PIP_BUDGET} influence left. {total ? `${EMOTIONS[lead].name} leads and plays their ability.` : ''}
        </span>
      </div>
    </section>
  );
}
