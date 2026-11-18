import { EMOTIONS, EMOTION_ORDER } from '../game/content/emotions';
import { useGame } from '../state/store';
import { Portrait } from './Portrait';

export const canSwitch = (s: ReturnType<typeof useGame.getState>) =>
  s.phase === 'playing' && !s.dialogue && !s.transitioning && !s.activity && !s.theatre && (s.consoleStage === 'off' || s.consoleStage === 'choose');

/** Five emotion orbs on a curved brass rail. The selected one rises and glows. */
export function MoodDial() {
  const active = useGame((s) => s.active);
  const allowed = useGame(canSwitch);
  const setActive = useGame((s) => s.setActive);
  const E = EMOTIONS[active];
  const focused = useGame((s) => !!s.activity || s.consoleStage === 'cinematic' || s.consoleStage === 'mix' || s.consoleStage === 'minigame' || s.consoleStage === 'reflect' || s.consoleStage === 'ending' || s.endingOpen);
  if (focused) return null;
  return (
    <nav className="dial" aria-label="Choose an emotion to control">
      <div className="dial__name" aria-live="polite">
        {E.name}
        <small>{E.ability.name}</small>
      </div>
      <div className="dial__arc" role="group">
        {EMOTION_ORDER.map((id, i) => {
          const D = EMOTIONS[id];
          const on = id === active;
          return (
            <button
              key={id}
              className="orbbtn"
              aria-pressed={on}
              aria-label={`${D.name}: ${D.role} Ability: ${D.ability.name}. Key ${i + 1}.`}
              title={`${D.name} (${i + 1})`}
              disabled={!allowed && !on}
              style={{ ['--c' as string]: D.color, ['--light' as string]: D.light, ['--dark' as string]: D.dark }}
              onClick={() => allowed && setActive(id)}
            >
              <Portrait id={id} size={on ? 74 : 56} animate={on} />
              <span className="num" aria-hidden="true">
                {i + 1}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
