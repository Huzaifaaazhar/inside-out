import { useEffect, useRef, useState } from 'react';
import { EMOTIONS } from '../game/content/emotions';
import { AREAS } from '../game/content/world';
import { getGame } from '../game/Game';
import type { WorldScene } from '../game/WorldScene';
import { objectiveText, useGame } from '../state/store';
import { BookIcon, HeartIcon, HelpIcon, Key, MapIcon, PauseIcon, SoundIcon } from './icons';

function Memo() {
  const objective = useGame((s) => s.objective);
  const mind = useGame((s) => s.mind);
  const atConsole = useGame((s) => s.consoleStage !== 'off' || !!s.activity);
  const [fresh, setFresh] = useState(false);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setFresh(true);
    const t = setTimeout(() => setFresh(false), 800);
    return () => clearTimeout(t);
  }, [objective]);
  if (objective === 'meet' || atConsole) return null;
  return (
    <aside className={`memo${fresh ? ' memo--fresh' : ''}`} aria-live="polite">
      <span className="memo__label">{mind ? `Day ${Math.min(mind.day, 7)}` : objective === 'free' ? 'Free play' : 'Right now'}</span>
      {objectiveText({ objective, mind })}
    </aside>
  );
}

function AreaCard() {
  const area = useGame((s) => s.area);
  const [shown, setShown] = useState<string | null>(null);
  const seen = useRef<string | null>(null);
  useEffect(() => {
    if (seen.current === area) return;
    seen.current = area;
    setShown(area);
    const t = setTimeout(() => setShown(null), 3000);
    return () => clearTimeout(t);
  }, [area]);
  if (!shown) return null;
  const a = AREAS[shown as keyof typeof AREAS];
  return (
    <div className="areacard" key={shown} role="status">
      <h2>{a.name}</h2>
      <p>{a.blurb}</p>
    </div>
  );
}

function Toast() {
  const toast = useGame((s) => s.toast);
  if (!toast) return null;
  return (
    <div key={toast.id} className="toast" role="status" style={{ ['--c' as string]: toast.color }}>
      {toast.text}
    </div>
  );
}

function Actions() {
  const prompt = useGame((s) => s.prompt);
  const active = useGame((s) => s.active);
  const E = EMOTIONS[active];
  const scene = () => getGame()?.current as WorldScene | undefined;
  return (
    <div className="actions">
      {prompt && (
        <button className="interactbtn" onClick={() => scene()?.interactNearest?.()}>
          <Key>E</Key>
          {prompt}
        </button>
      )}
      <button
        className="abilitybtn"
        style={{ ['--c' as string]: E.color, ['--light' as string]: E.light, ['--dark' as string]: E.dark }}
        aria-label={`Use ${E.name}'s ability, ${E.ability.name}. ${E.ability.description}`}
        title={E.ability.description}
        onClick={() => scene()?.useAbility?.()}
      >
        {E.ability.name}
        <Key>Q</Key>
      </button>
    </div>
  );
}

export function Hud() {
  const muted = useGame((s) => s.muted);
  const setMuted = useGame((s) => s.setMuted);
  const consoleStage = useGame((s) => s.consoleStage);
  const dialogue = useGame((s) => s.dialogue);
  const prompt = useGame((s) => s.prompt);
  const st = useGame.getState;
  const hasMind = useGame((s) => !!s.mind);
  const activity = useGame((s) => s.activity);
  return (
    <>
      <Memo />
      <div className="rotate-hint" role="note">
        Turn your phone sideways for a bigger view of Riley’s mind.
      </div>
      <AreaCard />
      <Toast />
      <div className="corner">
        {hasMind && (
          <>
            <button className="iconbtn" aria-label="Open the memory journal" title="Memory journal (J)" onClick={() => st().setJournal(true)}>
              <BookIcon />
              <Key>J</Key>
            </button>
            <button className="iconbtn" aria-label="How Riley is doing" title="How Riley’s doing (R)" onClick={() => st().setReport(true)}>
              <HeartIcon />
              <Key>R</Key>
            </button>
          </>
        )}
        <button className="iconbtn" aria-label={muted ? 'Turn sound on' : 'Turn sound off'} title={muted ? 'Sound off' : 'Sound on'} onClick={() => setMuted(!muted)}>
          <SoundIcon muted={muted} />
        </button>
        <button className="iconbtn" aria-label="Controls" title="Controls (H)" onClick={() => st().setHelp(true)}>
          <HelpIcon />
          <Key>H</Key>
        </button>
        <button
          className="iconbtn"
          aria-label="Open the mind map"
          title="Mind map (M)"
          disabled={consoleStage !== 'off'}
          onClick={() => st().setMap(true)}
        >
          <MapIcon />
          <Key>M</Key>
        </button>
        <button className="iconbtn" aria-label="Pause" title="Pause (Esc)" onClick={() => st().setMenu(true)}>
          <PauseIcon />
        </button>
      </div>
      {consoleStage === 'off' && !dialogue && !activity && <Actions />}
      <div className="sr-only" aria-live="polite">
        {prompt ? `Press E to ${prompt.charAt(0).toLowerCase()}${prompt.slice(1)}` : ''}
      </div>
    </>
  );
}
