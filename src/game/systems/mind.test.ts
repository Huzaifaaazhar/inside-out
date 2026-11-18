import { describe, expect, it } from 'vitest';
import type { EmotionId } from '../content/emotions';
import { EMOTION_ORDER } from '../content/emotions';
import { MEMORY_BY_ID, MEMORY_LIBRARY } from '../content/memories';
import { SCENARIOS } from '../scenario/scenarios';
import type { Mix, MomentLike } from './mind';
import {
  applyDeltas,
  deltaWeight,
  emptyMix,
  initialMind,
  islandTarget,
  leadOf,
  recolorEffect,
  recordChoice,
  resolveMoment,
  runNight,
  schedule,
  stabilityBand,
  touchMemory,
} from './mind';

const fresh = () => initialMind(MEMORY_LIBRARY, { great: 3, artClubDone: true });
const mix = (m: Partial<Mix>): Mix => ({ ...emptyMix(), ...m });

const toy: MomentLike = {
  id: 'toy',
  effects: {
    joy: { stats: { belonging: 1 } },
    sadness: { stats: { family: 1 } },
    anger: { stats: { confidence: 1 } },
    fear: { stats: { confidence: -1 } },
    disgust: { stats: { belonging: -1 } },
  },
  lead: {
    joy: { lines: [{ speaker: 'riley', text: 'joy' }], deltas: { stats: { family: 10 } } },
    sadness: { lines: [{ speaker: 'riley', text: 'sad' }], deltas: { stats: { family: 4 } } },
    anger: { lines: [{ speaker: 'riley', text: 'anger' }] },
    fear: { lines: [{ speaker: 'riley', text: 'fear' }] },
    disgust: { lines: [{ speaker: 'riley', text: 'disgust' }] },
  },
  blends: [{ id: 'both', when: { joy: 1, sadness: 1 }, lines: [{ speaker: 'riley', text: 'both' }], deltas: { stats: { family: 20 } }, flags: ['blended'] }],
};

describe('resolving a moment', () => {
  it('lets the strongest emotion lead, breaking ties toward the operator', () => {
    expect(leadOf(mix({ joy: 2, anger: 1 }))).toBe('joy');
    expect(leadOf(mix({ joy: 1, anger: 1 }), 'anger')).toBe('anger');
  });

  it('uses the lead’s response and adds supporting emotions as colour', () => {
    const r = resolveMoment(toy, mix({ joy: 2, anger: 1 }), 1);
    expect(r.lead).toBe('joy');
    expect(r.lines[0].text).toBe('joy');
    expect(r.lines.some((l) => l.speaker === 'narrator')).toBe(true);
    expect(r.deltas.stats?.family).toBe(10);
  });

  it('applies a specific blend when its combination is present', () => {
    const r = resolveMoment(toy, mix({ joy: 1, sadness: 1 }), 1);
    expect(r.blend).toBe('both');
    expect(r.flags).toContain('blended');
    expect(r.deltas.stats?.family).toBeGreaterThanOrEqual(20);
  });

  it('rewards feeling more than one thing with emotional balance', () => {
    const one = resolveMoment(toy, mix({ anger: 2 }), 1);
    const three = resolveMoment(toy, mix({ anger: 2, fear: 1, disgust: 1 }), 1);
    expect(three.deltas.stats?.balance ?? 0).toBeGreaterThan(one.deltas.stats?.balance ?? 0);
  });

  it('charges every emotion a cost for taking over completely', () => {
    for (const e of EMOTION_ORDER) {
      const r = resolveMoment(toy, mix({ [e]: 3 }), 1);
      expect(r.overload).toBe(true);
      expect(r.deltas.stats?.balance ?? 0).toBeLessThan(0);
    }
  });

  it('scales the lead’s intent by how well its mini-game went', () => {
    const good = resolveMoment(toy, mix({ joy: 2 }), 1);
    const bad = resolveMoment(toy, mix({ joy: 2 }), 0);
    expect(good.deltas.stats!.family!).toBeGreaterThan(bad.deltas.stats!.family!);
    expect(bad.lines.at(-1)?.text).toMatch(/wobblier/);
  });
});

describe('scenario design', () => {
  const moments = SCENARIOS.flatMap((s) => s.moments);
  // score a clear single-emotion lead (two points, no overload) in each moment
  const singles = moments.map((m) => Object.fromEntries(EMOTION_ORDER.map((e) => [e, deltaWeight(resolveMoment(m, mix({ [e]: 2 }), 1).deltas)])) as Record<EmotionId, number>);
  const best = singles.map((row) => EMOTION_ORDER.reduce((a, e) => (row[e] > row[a] ? e : a), EMOTION_ORDER[0]));

  it('has five scenarios with two moments each', () => {
    expect(SCENARIOS).toHaveLength(5);
    for (const s of SCENARIOS) expect(s.moments.length).toBe(2);
  });

  it('makes every emotion the best fit somewhere', () => {
    for (const e of EMOTION_ORDER) expect(best).toContain(e);
  });

  it('never lets one emotion be the best fit everywhere', () => {
    for (const e of EMOTION_ORDER) expect(best.filter((b) => b === e).length).toBeLessThan(moments.length / 2);
  });

  it('gives every emotion at least one moment where it does harm', () => {
    for (const e of EMOTION_ORDER) expect(singles.some((row) => row[e] < 0)).toBe(true);
  });

  it('offers at least one combination per moment, and combinations beat that moment’s best single lead', () => {
    moments.forEach((m, i) => {
      expect(m.blends?.length ?? 0).toBeGreaterThan(0);
      const bestBlend = Math.max(...m.blends!.map((b) => deltaWeight(resolveMoment(m, mix(b.when), 1).deltas)));
      expect(bestBlend).toBeGreaterThanOrEqual(singles[i][best[i]]);
    });
  });

  it('only schedules consequences for days in the future', () => {
    for (const m of moments) {
      const all = [...Object.values(m.lead), ...(m.blends ?? []), ...Object.values(m.overload ?? {})];
      for (const d of all) for (const l of d?.later ?? []) expect(l.inDays).toBeGreaterThan(0);
    }
  });
});

describe('nights and delayed consequences', () => {
  it('fires a pending consequence on its day, not before', () => {
    let s = fresh();
    s = schedule(s, [{ inDays: 2, id: 'x', text: 'later', tone: 'bad', deltas: { stats: { family: -10 } } }]);
    const n1 = runNight(s, MEMORY_LIBRARY, {});
    expect(n1.report.fired).toHaveLength(0);
    const n2 = runNight(n1.state, MEMORY_LIBRARY, n1.flags);
    expect(n2.report.fired.map((f) => f.text)).toContain('later');
    expect(n2.state.pending).toHaveLength(0);
  });

  it('skips a consequence if the situation was repaired first', () => {
    let s = fresh();
    s = schedule(s, [{ inDays: 1, id: 'x', text: 'grudge', tone: 'bad', unlessFlag: 'repaired' }]);
    const n = runNight(s, MEMORY_LIBRARY, { repaired: true });
    expect(n.report.fired).toHaveLength(0);
  });

  it('cools relationships nobody tended to', () => {
    const s = fresh();
    const n = runNight(s, MEMORY_LIBRARY, {});
    expect(n.state.stats.friendship).toBeLessThan(s.stats.friendship);
    const tended = applyDeltas(s, { stats: { friendship: 1 } });
    const n2 = runNight(tended, MEMORY_LIBRARY, {});
    expect(n2.state.stats.friendship).toBe(tended.stats.friendship);
  });

  it('wears Riley out when one emotion leads three times running', () => {
    let s = fresh();
    for (let i = 0; i < 3; i++) s = recordChoice(s, mix({ anger: 2 }), 'anger');
    const n = runNight(s, MEMORY_LIBRARY, {});
    expect(n.report.notes.some((x) => /one-note/.test(x.text))).toBe(true);
  });

  it('moves islands halfway toward where Riley’s life actually is', () => {
    let s = fresh();
    s = applyDeltas(s, { stats: { family: -60 } });
    const target = islandTarget('family', s, MEMORY_LIBRARY);
    const before = s.islands.family;
    const after = runNight(s, MEMORY_LIBRARY, {}).state.islands.family;
    expect(after).toBeLessThan(before);
    expect(Math.abs(after - (before + target) / 2)).toBeLessThanOrEqual(3);
  });
});

describe('memories', () => {
  it('fades unvisited everyday memories, then forgets them; core memories stay', () => {
    let s = fresh();
    // memories start at staggered "last visited" days, so allow a few nights
    let nights = 0;
    while (s.memories.olives.status === 'long-term' && nights < 6) {
      s = runNight(s, MEMORY_LIBRARY, {}).state;
      nights++;
    }
    expect(s.memories.olives.status).toBe('faded');
    expect(nights).toBeLessThanOrEqual(4);
    expect(s.memories['core-family'].status).toBe('core');
    for (let i = 0; i < 2; i++) s = runNight(s, MEMORY_LIBRARY, {}).state;
    expect(s.memories.olives.status).toBe('forgotten');
  });

  it('spreads fading across several nights instead of all at once', () => {
    let s = fresh();
    const perNight: number[] = [];
    for (let i = 0; i < 4; i++) {
      const n = runNight(s, MEMORY_LIBRARY, {});
      perNight.push(n.report.faded.length);
      s = n.state;
    }
    expect(perNight.filter((n) => n > 0).length).toBeGreaterThanOrEqual(2);
  });

  it('keeps a memory when it is revisited', () => {
    let s = fresh();
    s = runNight(s, MEMORY_LIBRARY, {}).state;
    s = touchMemory(s, 'olives');
    s = runNight(s, MEMORY_LIBRARY, {}).state;
    expect(s.memories.olives.status).toBe('long-term');
  });

  it('lets important memories hold their island up, and losing them hurts it', () => {
    const s = fresh();
    const withIt = islandTarget('family', s, MEMORY_LIBRARY);
    const lost = { ...s, memories: { ...s.memories, bike: { ...s.memories.bike, status: 'released' as const } } };
    expect(islandTarget('family', lost, MEMORY_LIBRARY)).toBeLessThan(withIt);
  });

  it('treats painting a memory gold differently depending on whether Riley felt it first', () => {
    const s = fresh();
    const entry = MEMORY_BY_ID.goodbye;
    const rushed = recolorEffect(entry, s.memories.goodbye, 'joy');
    const felt = recolorEffect(entry, { ...s.memories.goodbye, lenses: ['sadness'] }, 'joy');
    expect(rushed.deltas.stats?.balance ?? 0).toBeLessThan(0);
    expect(felt.deltas.stats?.balance ?? 0).toBeGreaterThan(0);
  });
});

describe('stability bands', () => {
  it('maps values to plain words', () => {
    expect(stabilityBand(80)).toBe('thriving');
    expect(stabilityBand(50)).toBe('steady');
    expect(stabilityBand(30)).toBe('shaky');
    expect(stabilityBand(10)).toBe('crumbling');
  });
});
