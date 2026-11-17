import { useEffect, useRef } from 'react';
import { defaultCharState, drawEmotion, drawMote } from '../game/art/characters';
import type { EmotionId, SpeakerId } from '../game/content/emotions';
import { EMOTION_ORDER } from '../game/content/emotions';

/** Distance from the feet to the middle of each face, in character units. */
const HEAD_CENTRE: Record<EmotionId, number> = { joy: 126, sadness: 84, anger: 76, fear: 156, disgust: 116 };

const isEmotion = (s: string): s is EmotionId => (EMOTION_ORDER as string[]).includes(s);

/**
 * A small live canvas of a character's head. It animates (blinks, talks) only while `animate` is on.
 */
export function Portrait({ id, size = 112, talking = false, animate = true }: { id: SpeakerId; size?: number; talking?: boolean; animate?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const talkingRef = useRef(talking);
  talkingRef.current = talking;

  useEffect(() => {
    const cv = ref.current;
    if (!cv || (!isEmotion(id) && id !== 'mote')) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = size * dpr;
    cv.height = size * dpr;
    const ctx = cv.getContext('2d')!;
    const st = defaultCharState(EMOTION_ORDER.indexOf(id as EmotionId) + 2);
    let raf = 0;
    let last = performance.now();
    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      st.t += dt;
      st.talking = talkingRef.current;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (id === 'mote') {
        ctx.translate(size / 2, size * 0.86);
        ctx.scale(size / 80, size / 80);
        drawMote(ctx, 0, 0, st.t, false, 1, st.talking);
      } else {
        const e = id as EmotionId;
        const scale = size / 72;
        // put the centre of the face slightly below the middle of the frame
        drawEmotion(ctx, e, size / 2, size * 0.58 + HEAD_CENTRE[e] * scale, st, scale);
      }
      if (animate) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [id, size, animate]);

  if (!isEmotion(id) && id !== 'mote') return null;
  return <canvas ref={ref} aria-hidden="true" style={{ width: size, height: size }} />;
}
