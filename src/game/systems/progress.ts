/**
 * Emotion progression: every emotion grows with use and has insights to collect,
 * each one a reason that emotion exists. Pure data and functions, saved with the game.
 */
import type { EmotionId } from '../content/emotions';
import { EMOTION_ORDER } from '../content/emotions';

export interface Insight {
  id: string;
  emotion: EmotionId;
  /** The purpose, in Riley's terms. */
  text: string;
  /** Where it's found, as a hint once the area has been visited. */
  where: string;
}

export const INSIGHTS: Insight[] = [
  { id: 'imag-joy', emotion: 'joy', text: 'Noticing what’s good gives you the energy to keep going.', where: 'A grey meadow in Imagination Land' },
  { id: 'imag-sadness', emotion: 'sadness', text: 'Slowing down lets other people reach you.', where: 'Someone hiding in Imagination Land' },
  { id: 'imag-anger', emotion: 'anger', text: 'Some things only change when you push.', where: 'A candy-crusted cave in Imagination Land' },
  { id: 'imag-fear', emotion: 'fear', text: 'Spotting danger early keeps you and others safe.', where: 'An invisible path in Imagination Land' },
  { id: 'imag-disgust', emotion: 'disgust', text: 'Knowing what isn’t you is part of knowing who you are.', where: 'A statue that’s a bit too perfect' },
  { id: 'dream-joy', emotion: 'joy', text: 'Hope is something you can practise, even in your sleep.', where: 'The lighting desk at Dream Productions' },
  { id: 'dream-sadness', emotion: 'sadness', text: 'Letting yourself miss something is how you carry it with you.', where: 'The rain machine at Dream Productions' },
  { id: 'dream-anger', emotion: 'anger', text: 'Anger says “this matters to me”.', where: 'The pyrotechnics bay at Dream Productions' },
  { id: 'dream-fear', emotion: 'fear', text: 'Rehearsing a scary thing makes the real thing smaller.', where: 'The stunt rig at Dream Productions' },
  { id: 'dream-disgust', emotion: 'disgust', text: 'Taste is just knowing what you like out loud.', where: 'The wardrobe rail at Dream Productions' },
  { id: 'sub-joy', emotion: 'joy', text: 'Hope can light up even the deepest places.', where: 'A dark garden in the Subconscious' },
  { id: 'sub-sadness', emotion: 'sadness', text: 'Missing home and liking it here can both be true.', where: 'The murmuring pool in the Subconscious' },
  { id: 'sub-anger', emotion: 'anger', text: 'It’s okay to be angry that something was unfair.', where: 'A chained door in the Subconscious' },
  { id: 'sub-fear', emotion: 'fear', text: 'Naming a fear out loud shrinks it.', where: 'The worry jars in the Subconscious' },
  { id: 'sub-disgust', emotion: 'disgust', text: 'You can say no to rules that were never yours.', where: 'A jar of “shoulds” in the Subconscious' },
];
/** Hidden fears that can be found in the Subconscious. */
export const HIDDEN_FEARS: { id: string; title: string; text: string; who: EmotionId }[] = [
  { id: 'fear-forgotten', title: 'Being forgotten', text: 'That her old friends will stop thinking about her now she’s gone.', who: 'joy' },
  { id: 'fear-blame', title: 'Being the problem', text: 'That Mum and Dad will be let down if she isn’t happy here.', who: 'fear' },
  { id: 'fear-hockey', title: 'Not being good enough', text: 'That she was only good at hockey because it was the old team.', who: 'fear' },
  { id: 'fear-belong', title: 'Never fitting in', text: 'That she should already feel at home, and something is wrong with her because she doesn’t.', who: 'disgust' },
  { id: 'fear-grandpa', title: 'Losing the old songs', text: 'That Grandpa’s Sunday songs only worked in the old kitchen.', who: 'sadness' },
];

export const INSIGHT_BY_ID: Record<string, Insight> = Object.fromEntries(INSIGHTS.map((i) => [i.id, i]));

/** What each emotion is for, shown in the journal and the ending. */
export const PURPOSE: Record<EmotionId, string> = {
  joy: 'Joy finds the good and gives Riley energy to keep trying.',
  sadness: 'Sadness lets Riley slow down, be honest and be comforted.',
  anger: 'Anger tells Riley when something is unfair and helps her stand up.',
  fear: 'Fear spots risks early and keeps Riley safe.',
  disgust: 'Disgust protects Riley’s boundaries and her sense of who she is.',
};

/** Insight needed for each level: 1 to 5. */
export const LEVELS = [0, 15, 40, 80, 130];
export const MAX_LEVEL = LEVELS.length;

export function levelOf(xp: number) {
  let l = 1;
  for (let i = 0; i < LEVELS.length; i++) if (xp >= LEVELS[i]) l = i + 1;
  return l;
}

export function levelProgress(xp: number) {
  const l = levelOf(xp);
  if (l >= MAX_LEVEL) return { level: l, into: 1 };
  const lo = LEVELS[l - 1];
  const hi = LEVELS[l];
  return { level: l, into: (xp - lo) / (hi - lo) };
}

export const LEVEL_TITLE = ['Getting started', 'Trusted', 'Skilled', 'Wise', 'Fully understood'];

/** What a higher level actually does, so progression is felt in play. */
export const LEVEL_PERK = [
  'Starts out able to use its ability.',
  'Its ability reaches a little further.',
  'Its mini-games land a bit more easily.',
  'Its ability reaches much further.',
  'Its mini-games land much more easily.',
];

/** How much further a field ability reaches at a level. */
export const abilityRangeBonus = (level: number) => (level >= 4 ? 1.5 : level >= 2 ? 1.2 : 1);
/** How much a mini-game score is lifted at a level (delivery bonus). */
export const deliveryBonus = (level: number) => (level >= 5 ? 0.2 : level >= 3 ? 0.1 : 0);

export interface DreamRecord {
  day: number;
  setting: string;
  mood: EmotionId;
  twist: string;
  quality: number;
  /** A sweet dream, a strange one, or a restless one. */
  kind: 'sweet' | 'strange' | 'restless';
}

export interface Progress {
  xp: Record<EmotionId, number>;
  insights: string[];
  /** Hidden things found anywhere: imagination sparks, fears, sealed memories. */
  discoveries: string[];
  /** Hidden fears uncovered in the Subconscious. */
  fears: string[];
  dreams: DreamRecord[];
  /** Places Riley's operator has set foot in. */
  visited: string[];
}

export const emptyProgress = (): Progress => ({
  xp: { joy: 0, sadness: 0, anger: 0, fear: 0, disgust: 0 },
  insights: [],
  discoveries: [],
  fears: [],
  dreams: [],
  visited: [],
});

/** Add insight to an emotion; returns the new progress and the level reached if it went up. */
export function gainXp(p: Progress, e: EmotionId, amount: number): { progress: Progress; levelUp: number | null } {
  const before = levelOf(p.xp[e]);
  const xp = { ...p.xp, [e]: p.xp[e] + amount };
  const after = levelOf(xp[e]);
  return { progress: { ...p, xp }, levelUp: after > before ? after : null };
}

export function collectInsight(p: Progress, id: string): { progress: Progress; isNew: boolean } {
  if (p.insights.includes(id) || !INSIGHT_BY_ID[id]) return { progress: p, isNew: false };
  const ins = INSIGHT_BY_ID[id];
  const { progress } = gainXp({ ...p, insights: [...p.insights, id] }, ins.emotion, 10);
  return { progress, isNew: true };
}

export const totalLevel = (p: Progress) => EMOTION_ORDER.reduce((s, e) => s + levelOf(p.xp[e]), 0);
