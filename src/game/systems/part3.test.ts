import { describe, expect, it } from 'vitest';
import type { EmotionId } from '../content/emotions';
import { EMOTION_ORDER } from '../content/emotions';
import { MEMORY_LIBRARY } from '../content/memories';
import { FINALE_MEETING, FINALE_NEWS, FINALE_TALK } from '../scenario/finale';
import type { FinaleRecord } from './ending';
import { evenness, scoreEnding, voicesHeard } from './ending';
import type { MindState, Mix } from './mind';
import { applyDeltas, emptyMix, initialMind, recordChoice, resolveMoment, runNight } from './mind';
import { INSIGHTS, LEVELS, abilityRangeBonus, collectInsight, deliveryBonus, emptyProgress, gainXp, levelOf } from './progress';

const fresh = () => initialMind(MEMORY_LIBRARY, { great: 3, artClubDone: true });
const mix = (m: Partial<Mix>): Mix => ({ ...emptyMix(), ...m });
const all = (n: number) => mix(Object.fromEntries(EMOTION_ORDER.map((e) => [e, n])) as Partial<Mix>);

/** A week played by always choosing the same mix. */
function weekOf(m: Mix, lead: EmotionId, deltas: Parameters<typeof applyDeltas>[1] = {}): MindState {
  let s = fresh();
  for (let i = 0; i < 10; i++) s = recordChoice(s, m, lead);
  return applyDeltas(s, deltas);
}

const fin = (mixes: Mix[], reflection: EmotionId[] = [], overloads = 0): FinaleRecord => ({
  mixes,
  reflection: reflection.map((emotion, i) => ({ id: `m${i}`, emotion })),
  overloads,
});

describe('progression', () => {
  it('levels follow the experience thresholds', () => {
    expect(levelOf(0)).toBe(1);
    expect(levelOf(LEVELS[1])).toBe(2);
    expect(levelOf(LEVELS[LEVELS.length - 1] + 100)).toBe(LEVELS.length);
  });

  it('reports a level-up only when a threshold is crossed', () => {
    const p = emptyProgress();
    const a = gainXp(p, 'joy', LEVELS[1] - 1);
    expect(a.levelUp).toBeNull();
    const b = gainXp(a.progress, 'joy', 1);
    expect(b.levelUp).toBe(2);
    expect(b.progress.xp.sadness).toBe(0);
  });

  it('higher levels reach further and land mini-games more easily', () => {
    expect(abilityRangeBonus(1)).toBe(1);
    expect(abilityRangeBonus(5)).toBeGreaterThan(abilityRangeBonus(2));
    expect(deliveryBonus(1)).toBe(0);
    expect(deliveryBonus(5)).toBeGreaterThan(deliveryBonus(3));
  });

  it('insights are collected once and give their emotion experience', () => {
    const id = INSIGHTS[0].id;
    const first = collectInsight(emptyProgress(), id);
    expect(first.isNew).toBe(true);
    expect(first.progress.xp[INSIGHTS[0].emotion]).toBeGreaterThan(0);
    const again = collectInsight(first.progress, id);
    expect(again.isNew).toBe(false);
  });

  it('every emotion has insights in all three new places', () => {
    for (const e of EMOTION_ORDER) {
      for (const tag of ['imag', 'dream', 'sub']) expect(INSIGHTS.some((i) => i.emotion === e && i.id.startsWith(tag))).toBe(true);
    }
  });
});

describe('the sealed memory', () => {
  it('starts sealed and never fades while sealed', () => {
    let s = fresh();
    expect(s.memories['sealed-house'].status).toBe('sealed');
    for (let i = 0; i < 6; i++) s = runNight(s, MEMORY_LIBRARY, {}).state;
    expect(s.memories['sealed-house'].status).toBe('sealed');
  });
});

describe('the turning point', () => {
  it('every phase uses all five emotions somewhere', () => {
    for (const m of [FINALE_NEWS, FINALE_TALK({}), FINALE_MEETING]) {
      for (const e of EMOTION_ORDER) expect(m.lead[e]).toBeDefined();
    }
  });

  it('only a mix with every emotion unlocks the all-voices blend', () => {
    const r = resolveMoment(FINALE_MEETING, mix({ joy: 1, sadness: 2, anger: 1, fear: 1, disgust: 1 }), 1);
    expect(r.flags).toContain('finAllVoices');
    const r2 = resolveMoment(FINALE_MEETING, mix({ joy: 3, sadness: 3 }), 1);
    expect(r2.flags).not.toContain('finAllVoices');
  });

  it('who Riley can call depends on earlier choices', () => {
    expect(FINALE_TALK({ keptInTouch: true }).title).toContain('Dani');
    expect(FINALE_TALK({ keptInTouch: true, daniHurt: true, invitedPriya: true }).title).toContain('Priya');
    expect(FINALE_TALK({}).title).toBe('Alone with it');
  });
});

describe('endings', () => {
  it('evenness is 1 for a perfectly shared week and 0 for a one-emotion week', () => {
    expect(evenness({ joy: 0.2, sadness: 0.2, anger: 0.2, fear: 0.2, disgust: 0.2 })).toBeCloseTo(1);
    expect(evenness({ joy: 1, sadness: 0, anger: 0, fear: 0, disgust: 0 })).toBe(0);
  });

  it('voices count both the final mixes and the remembered colours', () => {
    expect(voicesHeard(fin([mix({ joy: 2 })], ['sadness']))).toEqual(['joy', 'sadness']);
  });

  it('maximum happiness does not win: an all-Joy run ends in avoidance', () => {
    const mind = weekOf(mix({ joy: 3 }), 'joy', { stats: { balance: 20, family: 10, friendship: 10 } });
    const res = scoreEnding(mind, { finJumped: true, finMasked: true }, emptyProgress(), fin([mix({ joy: 3 }), mix({ joy: 3 }), mix({ joy: 3 })], ['joy'], 3), MEMORY_LIBRARY);
    expect(res.ending).toBe('avoidance');
    expect(res.scores.balanced).toBeLessThan(res.scores.avoidance);
  });

  it('a shared, honest finale ends balanced', () => {
    const mind = weekOf(all(1), 'sadness', { stats: { balance: 20 } });
    const res = scoreEnding(mind, { finHonest: true, finReached: true, finAllVoices: true }, emptyProgress(), fin([mix({ joy: 1, sadness: 1, anger: 1, fear: 1 }), mix({ sadness: 1, fear: 1, joy: 1 }), all(1)], ['joy', 'sadness', 'fear']), MEMORY_LIBRARY);
    expect(res.ending).toBe('balanced');
    expect(res.heard).toHaveLength(5);
  });

  it('shutting people out and blowing up ends in isolation', () => {
    const mind = weekOf(mix({ anger: 2, disgust: 2 }), 'anger', { stats: { friendship: -40, family: -40 } });
    const res = scoreEnding(mind, { finWalled: true, finStormed: true, daniHurt: true, angryText: true }, emptyProgress(), fin([mix({ anger: 3 }), mix({ disgust: 3 }), mix({ anger: 3 })], [], 3), MEMORY_LIBRARY);
    expect(res.ending).toBe('isolation');
  });

  it('honesty with Mum and Dad, led by Sadness, ends closer as a family', () => {
    const mind = weekOf(mix({ sadness: 2, fear: 1 }), 'sadness', { stats: { family: 40 } });
    const res = scoreEnding(mind, { toldParentsTruth: true, repaired: true, finHonest: true, familyMission: true }, emptyProgress(), fin([mix({ sadness: 2, fear: 1 }), mix({ sadness: 2 }), mix({ sadness: 3, fear: 2 })], ['sadness']), MEMORY_LIBRARY);
    expect(res.ending).toBe('family');
  });

  it('facing the avoided memory and finding insights ends in self-understanding', () => {
    const mind = weekOf(mix({ sadness: 1, disgust: 1, fear: 1 }), 'disgust', { stats: { confidence: 30 } });
    let progress = emptyProgress();
    for (const i of INSIGHTS) progress = collectInsight(progress, i.id).progress;
    progress = { ...progress, fears: ['fear-forgotten', 'fear-blame', 'fear-hockey', 'fear-belong', 'fear-grandpa'] };
    const res = scoreEnding(mind, { vaultOpened: true, finReached: true }, progress, fin([mix({ disgust: 2, fear: 1 }), mix({ sadness: 2 }), mix({ disgust: 3, anger: 1 })], ['sadness']), MEMORY_LIBRARY);
    expect(res.ending).toBe('self');
  });
});
