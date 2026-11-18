import { useEffect, useRef, useState } from 'react';
import { audio } from '../engine/audio';
import { renderVignette } from '../game/art/vignette';
import type { EmotionId } from '../game/content/emotions';
import { EMOTIONS, EMOTION_ORDER } from '../game/content/emotions';
import { ISLANDS } from '../game/content/world';
import { getEntry } from '../game/systems/library';
import { useGame } from '../state/store';

const W = 960;
const H = 540;

const SIG_LABEL = { core: 'Core memory', important: 'Important memory', everyday: 'Everyday memory' } as const;
const STATUS_LABEL = { core: 'Core', 'long-term': 'Kept in Long-Term Memory', faded: 'Fading', forgotten: 'Forgotten', released: 'Let go' } as const;

/** Replay a memory, look at it through each emotion, and decide how Riley keeps it. */
export function MemoryTheatre() {
  const id = useGame((s) => s.theatre);
  const mind = useGame((s) => s.mind);
  const setTheatre = useGame((s) => s.setTheatre);
  const visit = useGame((s) => s.visitMemory);
  const viewLens = useGame((s) => s.viewLens);
  const recolor = useGame((s) => s.recolor);
  const recall = useGame((s) => s.recallMemory);
  const release = useGame((s) => s.releaseMemory);
  const reduced = useGame((s) => s.reducedMotion);
  const [lens, setLens] = useState<EmotionId | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [seenLocal, setSeenLocal] = useState<EmotionId[]>([]);
  const canvas = useRef<HTMLCanvasElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const entry = id ? getEntry(id, mind) : undefined;
  const ms = id ? mind?.memories[id] : undefined;
  const status = ms?.status ?? entry?.start ?? 'long-term';
  const fade = status === 'forgotten' ? 0.85 : status === 'faded' ? 0.6 : 0;
  const lensRef = useRef(lens);
  lensRef.current = lens;
  const fadeRef = useRef(fade);
  fadeRef.current = fade;

  // a replay counts as a visit: it keeps the memory from fading
  useEffect(() => {
    if (!id) return;
    setLens(null);
    setDetailOpen(false);
    setSeenLocal([]);
    const st = useGame.getState().mind?.memories[id]?.status;
    if (st && st !== 'forgotten' && st !== 'released') visit(id);
    closeRef.current?.focus();
  }, [id, visit]);

  useEffect(() => {
    const cv = canvas.current;
    if (!cv || !entry) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = W * dpr;
    cv.height = H * dpr;
    const ctx = cv.getContext('2d')!;
    let raf = 0;
    const start = performance.now();
    const draw = (now: number) => {
      const t = (now - start) / 1000;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      renderVignette(ctx, { x: 0, y: 0, w: W, h: H }, entry.script, reduced ? Math.min(t, entry.script.dur * 0.6) : t, { lens: lensRef.current, fade: fadeRef.current, captions: true });
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [entry, reduced]);

  if (!id || !entry) return null;
  const colour = ms?.emotion ?? entry.emotion;
  const seen = ms ? ms.lenses : seenLocal;
  const island = ISLANDS.find((i) => i.id === entry.island);
  const close = () => setTheatre(null);
  const pickLens = (e: EmotionId | null) => {
    setLens(e);
    setDetailOpen(false);
    if (e) {
      audio.voice(e);
      if (mind) viewLens(id, e);
      else if (!seenLocal.includes(e)) setSeenLocal([...seenLocal, e]);
    }
  };
  const caption = detailOpen ? entry.detail.text : lens ? entry.lens[lens] : status === 'forgotten' ? 'Blurry and grey. Only the outline is left.' : entry.text;
  const canRecolor = !!mind && status !== 'core' && status !== 'forgotten' && status !== 'released';

  return (
    <div className="scrim" onClick={close}>
      <div className="theatre" role="dialog" aria-modal="true" aria-labelledby="theatre-title" style={{ ['--c' as string]: EMOTIONS[colour].color }} onClick={(e) => e.stopPropagation()}>
        <header className="theatre__head">
          <div className="orb-dot" aria-hidden="true" style={{ ['--c' as string]: EMOTIONS[colour].color }} />
          <div>
            <h2 id="theatre-title">{status === 'forgotten' ? 'A forgotten memory' : entry.title}</h2>
            <p className="theatre__meta">
              {entry.when}. {SIG_LABEL[entry.significance]}
              {island ? `, held on ${island.name}` : ''}.{status !== 'core' ? ` ${STATUS_LABEL[status as keyof typeof STATUS_LABEL]}.` : ''}
            </p>
          </div>
          <button ref={closeRef} className="ghost" onClick={close}>
            Close
          </button>
        </header>
        <div className="theatre__screen">
          <canvas ref={canvas} aria-label={`${entry.title}: ${entry.text}`} role="img" />
          {status !== 'forgotten' && (
            <button
              className="hotspot"
              style={{ left: `${entry.detail.x * 100}%`, top: `${entry.detail.y * 100}%` }}
              aria-label={`Look closer: ${entry.detail.label}`}
              data-found={ms?.detail || detailOpen ? '' : undefined}
              onClick={() => {
                setDetailOpen(true);
                audio.chime(2);
                if (mind) visit(id, { detail: true });
              }}
            >
              <span aria-hidden="true" />
            </button>
          )}
        </div>
        <p className="theatre__caption" aria-live="polite" style={{ ['--c' as string]: lens ? EMOTIONS[lens].color : 'var(--glass)' }}>
          {lens && !detailOpen ? <strong>{EMOTIONS[lens].name}: </strong> : detailOpen ? <strong>{entry.detail.label}: </strong> : null}
          {caption}
        </p>
        <div className="lenses" role="group" aria-label="See it through an emotion">
          <button className="lens lens--plain" aria-pressed={lens === null} onClick={() => pickLens(null)}>
            As remembered
          </button>
          {EMOTION_ORDER.map((e) => (
            <button
              key={e}
              className="lens"
              aria-pressed={lens === e}
              style={{ ['--c' as string]: EMOTIONS[e].color, ['--light' as string]: EMOTIONS[e].light }}
              onClick={() => pickLens(e)}
            >
              <span className="lens__glass" aria-hidden="true" />
              {EMOTIONS[e].name}
              {seen.includes(e) && <span className="sr-only"> (seen)</span>}
            </button>
          ))}
        </div>
        {(status === 'forgotten' || status === 'faded') && mind && (
          <div className="theatre__actions">
            <button
              className="primary"
              style={{ ['--accent' as string]: EMOTIONS.joy.color }}
              onClick={() => {
                recall(id);
                audio.chime(5);
              }}
            >
              Bring it back to Long-Term Memory
            </button>
            {status === 'forgotten' && (
              <button
                className="ghost"
                onClick={() => {
                  release(id);
                  close();
                }}
              >
                Let it go
              </button>
            )}
            <span className="theatre__note">{entry.significance === 'important' ? `This one helps hold up ${island?.name ?? 'an island'}.` : 'An everyday memory. Letting it go frees up a little room.'}</span>
          </div>
        )}
        {canRecolor && (
          <div className="theatre__recolor">
            <span>Remember it as:</span>
            {EMOTION_ORDER.filter((e) => seen.includes(e)).map((e) => (
              <button key={e} className="chip" aria-pressed={colour === e} disabled={colour === e} style={{ ['--c' as string]: EMOTIONS[e].color }} onClick={() => recolor(id, e)}>
                {EMOTIONS[e].name}
              </button>
            ))}
            {!seen.length && <em>Look through an emotion’s lens first.</em>}
          </div>
        )}
        {status === 'core' && <p className="theatre__note">Core memories hold an island up. Their colour can’t be changed, but they can collect new swirls from what happens later.</p>}
        {!mind && <p className="theatre__note">Riley’s memory journal starts on her next day. Let her sleep at the console in Headquarters.</p>}
      </div>
    </div>
  );
}
