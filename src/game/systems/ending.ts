/**
 * Which ending Riley reaches. Every outcome is scored from the whole playthrough
 * and the strongest one wins, so no single strategy (least of all "max Joy") guarantees
 * the warmest ending.
 */
import type { EmotionId } from '../content/emotions';
import { EMOTION_ORDER } from '../content/emotions';
import type { MemoryEntry } from '../content/memories';
import type { EndingId } from '../scenario/finale';
import { ENDING_ORDER } from '../scenario/finale';
import type { MindState, Mix } from './mind';
import { emotionShare } from './mind';
import type { Progress } from './progress';

export interface FinaleRecord {
  mixes: Mix[];
  /** Memories Riley brought to the reflection, with the colour they had then. */
  reflection: { id: string; emotion: EmotionId }[];
  overloads: number;
}

/** Which emotions got a say on the final night, through mixes or remembered colours. */
export function voicesHeard(r: FinaleRecord): EmotionId[] {
  const heard = new Set<EmotionId>();
  for (const m of r.mixes) for (const e of EMOTION_ORDER) if (m[e] > 0) heard.add(e);
  for (const m of r.reflection) heard.add(m.emotion);
  return EMOTION_ORDER.filter((e) => heard.has(e));
}

/** 0 when one emotion did everything, 1 when all five shared the work evenly. */
export function evenness(share: Record<EmotionId, number>) {
  let h = 0;
  for (const e of EMOTION_ORDER) if (share[e] > 0) h -= share[e] * Math.log(share[e]);
  return h / Math.log(EMOTION_ORDER.length);
}

export interface EndingScores {
  scores: Record<EndingId, number>;
  ending: EndingId;
  heard: EmotionId[];
}

export function scoreEnding(mind: MindState, flags: Record<string, boolean>, progress: Progress, fin: FinaleRecord, library: MemoryEntry[]): EndingScores {
  const st = mind.stats;
  const share = emotionShare(mind);
  const even = evenness(share);
  const heard = voicesHeard(fin);
  const finalMix = fin.mixes[fin.mixes.length - 1];
  const finAll: Mix = { joy: 0, sadness: 0, anger: 0, fear: 0, disgust: 0 };
  for (const m of fin.mixes) for (const e of EMOTION_ORDER) finAll[e] += m[e];
  const finTotal = EMOTION_ORDER.reduce((s, e) => s + finAll[e], 0) || 1;
  const reflColours = new Set(fin.reflection.map((r) => r.emotion)).size;
  const lostImportant = library.filter((e) => e.significance === 'important' && ['forgotten', 'released'].includes(mind.memories[e.id]?.status ?? '')).length;
  const insights = progress.insights.length;

  const balanced = even * 30 + heard.length * 7 + st.balance * 0.25 + reflColours * 3 + (flags.finAllVoices ? 12 : 0) - fin.overloads * 10;
  const family =
    st.family * 0.55 +
    (flags.repaired || flags.toldParentsTruth ? 12 : 0) +
    (flags.finHonest ? 8 : 0) +
    (finalMix && finalMix.sadness > 0 ? 6 : 0) +
    (flags.familyMission ? 4 : 0) -
    (flags.slammedDoor && !flags.repaired ? 14 : 0) -
    (flags.finStormed ? 10 : 0);
  const self =
    (flags.vaultOpened ? 26 : 0) +
    insights * 1.6 +
    st.confidence * 0.3 +
    (fin.reflection.some((r) => r.emotion === 'sadness') ? 6 : 0) +
    (flags.finReached ? 4 : 0) +
    progress.fears.length * 1.5;
  const avoidance =
    (share.joy ?? 0) * 55 +
    (finAll.joy / finTotal) * 30 +
    (finAll.sadness === 0 && finAll.fear === 0 ? 22 : 0) +
    (flags.hidingFeelings ? 8 : 0) +
    (flags.finMasked ? 12 : 0) +
    (flags.finJumped ? 4 : 0);
  const isolation =
    (100 - (st.friendship + st.family) / 2) * 0.55 +
    fin.overloads * 12 +
    (flags.finWalled ? 16 : 0) +
    (flags.finStormed ? 8 : 0) +
    (flags.daniHurt && !flags.daniRepaired ? 6 : 0) +
    (flags.angryText ? 6 : 0) +
    lostImportant * 4;

  const scores: Record<EndingId, number> = { balanced, family, self, avoidance, isolation };
  let ending: EndingId = 'balanced';
  for (const id of ENDING_ORDER) if (scores[id] > scores[ending]) ending = id;
  return { scores, ending, heard };
}
