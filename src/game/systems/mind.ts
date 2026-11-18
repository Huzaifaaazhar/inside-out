/**
 * The consequence engine. Pure functions over plain data so it can be unit-tested
 * and persisted. Nothing in here touches the canvas, React or the store.
 */
import type { EmotionId } from '../content/emotions';
import { EMOTION_ORDER } from '../content/emotions';
import type { MemoryEntry } from '../content/memories';
import type { IslandId } from '../content/world';
import type { Line } from '../scenario/artClub';

export type StatKey = 'balance' | 'family' | 'friendship' | 'confidence' | 'belonging';
export const STAT_KEYS: StatKey[] = ['balance', 'family', 'friendship', 'confidence', 'belonging'];
export const STAT_LABEL: Record<StatKey, string> = {
  balance: 'Emotional balance',
  family: 'Family connection',
  friendship: 'Friendships',
  confidence: 'Confidence',
  belonging: 'Sense of belonging',
};
export type Stats = Record<StatKey, number>;
export type Mix = Record<EmotionId, number>;
export type IslandStability = Record<IslandId, number>;

export interface Deltas {
  stats?: Partial<Stats>;
  islands?: Partial<IslandStability>;
}

export type MemStatus = 'core' | 'long-term' | 'faded' | 'forgotten' | 'released';
export interface MemState {
  emotion: EmotionId;
  swirl: EmotionId[];
  discovered: boolean;
  lenses: EmotionId[];
  detail: boolean;
  revisits: number;
  lastSeen: number;
  status: MemStatus;
  recolors: number;
}

export type Tone = 'good' | 'bad' | 'mixed';
export interface LaterDef {
  inDays: number;
  id: string;
  text: string;
  tone: Tone;
  deltas?: Deltas;
  flags?: string[];
  /** Only fires if this flag is (still) unset when it comes due. */
  unlessFlag?: string;
  memory?: { id: string; emotion?: EmotionId; addSwirl?: EmotionId; status?: MemStatus };
}
export interface Pending extends Omit<LaterDef, 'inDays'> {
  day: number;
}
export interface LogEntry {
  day: number;
  text: string;
  tone: Tone;
}

export interface MindState {
  day: number;
  stats: Stats;
  islands: IslandStability;
  /** Total influence points spent per emotion, for balance and drift. */
  emotionUse: Record<EmotionId, number>;
  leadHistory: EmotionId[];
  memories: Record<string, MemState>;
  pending: Pending[];
  log: LogEntry[];
  scenariosDone: string[];
  /** Day an activity last paid out, keyed by activity id. */
  activityDay: Record<string, number>;
  /** Islands someone did something kind for today (staves off neglect). */
  tended: Partial<Record<StatKey, number>>;
}

export const MAX_PIPS_PER_EMOTION = 3;
export const PIP_BUDGET = 4;
export const clamp100 = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

export const emptyMix = (): Mix => ({ joy: 0, sadness: 0, anger: 0, fear: 0, disgust: 0 });

// ───────────────────────────── setup ─────────────────────────────

export function initialMemories(library: MemoryEntry[], day = 1): Record<string, MemState> {
  const out: Record<string, MemState> = {};
  library.forEach((e, i) => {
    out[e.id] = {
      emotion: e.emotion,
      swirl: e.swirl ?? [],
      discovered: e.start === 'core',
      lenses: [],
      detail: false,
      revisits: 0,
      // Riley thought about some of these more recently than others
      lastSeen: e.start === 'long-term' ? day + (i % 3) : day,
      status: e.start,
      recolors: 0,
    };
  });
  return out;
}

/** Part 1's art club day leaves a mark on where Part 2 starts. */
export function initialMind(library: MemoryEntry[], part1: { great: number; artClubDone: boolean }): MindState {
  const bonus = Math.min(10, part1.great * 2);
  return {
    day: 2,
    stats: {
      balance: 55,
      family: 62,
      friendship: 34 + (part1.artClubDone ? 14 : 0) + Math.round(bonus / 2),
      confidence: 48 + Math.round(bonus / 2),
      belonging: 30 + (part1.artClubDone ? 10 : 0),
    },
    islands: { family: 72, friendship: part1.artClubDone ? 52 : 30, hockey: 66, goofball: 60, honesty: 66, curiosity: 70 },
    emotionUse: { joy: 0, sadness: 0, anger: 0, fear: 0, disgust: 0 },
    leadHistory: [],
    memories: initialMemories(library, 2),
    pending: [],
    log: [],
    scenariosDone: [],
    activityDay: {},
    tended: {},
  };
}

// ───────────────────────────── deltas ─────────────────────────────

export function addDeltas(a: Deltas, b: Deltas, scale = 1): Deltas {
  const stats: Partial<Stats> = { ...(a.stats ?? {}) };
  for (const [k, v] of Object.entries(b.stats ?? {}) as [StatKey, number][]) stats[k] = (stats[k] ?? 0) + v * scale;
  const islands: Partial<IslandStability> = { ...(a.islands ?? {}) };
  for (const [k, v] of Object.entries(b.islands ?? {}) as [IslandId, number][]) islands[k] = (islands[k] ?? 0) + v * scale;
  return { stats, islands };
}

export function roundDeltas(d: Deltas): Deltas {
  const r = <K extends string>(o?: Partial<Record<K, number>>) => {
    const out: Partial<Record<K, number>> = {};
    for (const [k, v] of Object.entries(o ?? {}) as [K, number][]) {
      const n = Math.round(v);
      if (n !== 0) out[k] = n;
    }
    return out;
  };
  return { stats: r(d.stats), islands: r(d.islands) };
}

export function applyDeltas(s: MindState, d: Deltas): MindState {
  const stats = { ...s.stats };
  const tended = { ...s.tended };
  for (const [k, v] of Object.entries(d.stats ?? {}) as [StatKey, number][]) {
    stats[k] = clamp100(stats[k] + v);
    if (v > 0) tended[k] = s.day;
  }
  const islands = { ...s.islands };
  for (const [k, v] of Object.entries(d.islands ?? {}) as [IslandId, number][]) islands[k] = clamp100(islands[k] + v);
  return { ...s, stats, islands, tended };
}

/** Score used by tests and the night report: how good a set of deltas is overall. */
export function deltaWeight(d: Deltas) {
  let sum = 0;
  for (const v of Object.values(d.stats ?? {})) sum += v ?? 0;
  for (const v of Object.values(d.islands ?? {})) sum += (v ?? 0) * 0.5;
  return sum;
}

// ───────────────────────────── moments ─────────────────────────────

export interface LeadDef {
  lines: Line[];
  deltas?: Deltas;
  flags?: string[];
  later?: LaterDef[];
}

export interface BlendDef {
  id: string;
  /** Minimum influence per emotion for this combination to apply. */
  when: Partial<Mix>;
  lines: Line[];
  deltas?: Deltas;
  flags?: string[];
  later?: LaterDef[];
}

export interface MomentLike {
  id: string;
  /** What one point of each emotion's influence does in this situation. */
  effects: Record<EmotionId, Deltas>;
  lead: Record<EmotionId, LeadDef>;
  blends?: BlendDef[];
  /** What happens if one emotion is allowed to take over completely. */
  overload?: Partial<Record<EmotionId, LeadDef>>;
}

export interface Resolution {
  lead: EmotionId;
  blend: string | null;
  overload: boolean;
  lines: Line[];
  deltas: Deltas;
  flags: string[];
  later: LaterDef[];
  distinct: number;
}

/** Generic penalties when a single emotion runs the show. Every emotion has a cost. */
export const OVERLOAD_COST: Record<EmotionId, Deltas> = {
  joy: { stats: { balance: -6, belonging: -2 } },
  sadness: { stats: { balance: -6, confidence: -3 } },
  anger: { stats: { balance: -6, family: -3, friendship: -2 } },
  fear: { stats: { balance: -6, confidence: -4 } },
  disgust: { stats: { balance: -6, belonging: -3 } },
};

/** How a supporting emotion colours Riley's response, whatever the situation. */
export const SUPPORT_LINE: Record<EmotionId, string> = {
  joy: '(She finds a small smile in it anyway.)',
  sadness: '(Her voice goes soft for a second.)',
  anger: '(There’s an edge in it she doesn’t hide.)',
  fear: '(She checks their face before going on.)',
  disgust: '(She doesn’t pretend to like it.)',
};

export function leadOf(mix: Mix, prefer?: EmotionId): EmotionId {
  let best: EmotionId = EMOTION_ORDER[0];
  let bw = -1;
  for (const e of EMOTION_ORDER) {
    const w = mix[e];
    if (w > bw || (w === bw && e === prefer)) {
      best = e;
      bw = w;
    }
  }
  return best;
}

export const mixTotal = (mix: Mix) => EMOTION_ORDER.reduce((s, e) => s + mix[e], 0);
export const mixDistinct = (mix: Mix) => EMOTION_ORDER.filter((e) => mix[e] > 0).length;

/**
 * Resolve one moment. `delivery` (0..1) is how well the lead emotion's mini-game went:
 * it scales how strongly the lead's intent lands, never the side effects of the mix.
 */
export function resolveMoment(moment: MomentLike, mix: Mix, delivery: number, prefer?: EmotionId): Resolution {
  const lead = leadOf(mix, prefer);
  const distinct = mixDistinct(mix);
  let deltas: Deltas = {};
  // every point of influence pushes things its own way
  for (const e of EMOTION_ORDER) if (mix[e] > 0) deltas = addDeltas(deltas, moment.effects[e], mix[e]);
  const overload = mix[lead] >= MAX_PIPS_PER_EMOTION && distinct === 1;
  const blend = moment.blends?.find((b) => (Object.entries(b.when) as [EmotionId, number][]).every(([e, min]) => mix[e] >= min)) ?? null;

  let lines: Line[];
  let flags: string[] = [];
  let later: LaterDef[] = [];
  const deliveryScale = 0.6 + 0.4 * Math.max(0, Math.min(1, delivery));
  if (overload) {
    const o = moment.overload?.[lead] ?? moment.lead[lead];
    lines = [...o.lines];
    deltas = addDeltas(deltas, o.deltas ?? {});
    deltas = addDeltas(deltas, OVERLOAD_COST[lead]);
    flags = [...(o.flags ?? [])];
    later = [...(o.later ?? [])];
  } else if (blend) {
    lines = [...blend.lines];
    deltas = addDeltas(deltas, blend.deltas ?? {}, deliveryScale);
    flags = [...(blend.flags ?? [])];
    later = [...(blend.later ?? [])];
  } else {
    const L = moment.lead[lead];
    lines = [...L.lines];
    deltas = addDeltas(deltas, L.deltas ?? {}, deliveryScale);
    flags = [...(L.flags ?? [])];
    later = [...(L.later ?? [])];
  }
  if (!overload) {
    // supporting emotions colour the delivery
    const supporters = EMOTION_ORDER.filter((e) => e !== lead && mix[e] > 0).slice(0, 2);
    for (const s of supporters) lines.push({ speaker: 'narrator', text: SUPPORT_LINE[s] });
  }
  // feeling more than one thing at once is healthy
  if (distinct >= 2) deltas = addDeltas(deltas, { stats: { balance: 3 } });
  if (distinct >= 3) deltas = addDeltas(deltas, { stats: { balance: 2 } });
  if (delivery < 0.5) lines.push({ speaker: lead, text: 'That came out wobblier than I meant it to.' });
  return { lead, blend: overload ? null : (blend?.id ?? null), overload, lines, deltas: roundDeltas(deltas), flags, later, distinct };
}

export function recordChoice(s: MindState, mix: Mix, lead: EmotionId): MindState {
  const emotionUse = { ...s.emotionUse };
  for (const e of EMOTION_ORDER) emotionUse[e] += mix[e];
  return { ...s, emotionUse, leadHistory: [...s.leadHistory, lead].slice(-8) };
}

export function schedule(s: MindState, later: LaterDef[]): MindState {
  const add = later.map(({ inDays, ...rest }) => ({ ...rest, day: s.day + inDays }));
  return { ...s, pending: [...s.pending.filter((p) => !add.some((a) => a.id === p.id)), ...add] };
}

/** The share of all influence each emotion has had, for the report. */
export function emotionShare(s: MindState): Record<EmotionId, number> {
  const total = EMOTION_ORDER.reduce((a, e) => a + s.emotionUse[e], 0) || 1;
  return Object.fromEntries(EMOTION_ORDER.map((e) => [e, s.emotionUse[e] / total])) as Record<EmotionId, number>;
}

// ───────────────────────────── memories ─────────────────────────────

export function memoryIsland(entry: MemoryEntry | undefined) {
  return entry?.island;
}

/** What it means for Riley to remember something differently. */
export function recolorEffect(entry: MemoryEntry, ms: MemState, to: EmotionId): { deltas: Deltas; text: string; tone: Tone } {
  const from = ms.emotion;
  const isl = entry.island;
  const islands = (v: number): Partial<IslandStability> => (isl ? { [isl]: v } : {});
  const understood = ms.lenses.includes('sadness');
  if (to === 'joy' && from !== 'joy') {
    if (understood)
      return { deltas: { stats: { balance: 2, belonging: 1 }, islands: islands(3) }, text: `Riley let herself feel the hard part of “${entry.title}”, and now she remembers the good in it too.`, tone: 'good' };
    return { deltas: { stats: { balance: -3 }, islands: islands(1) }, text: `Riley painted over “${entry.title}” in gold without looking at what hurt. It won’t quite stay that colour.`, tone: 'mixed' };
  }
  if (to === 'sadness')
    return { deltas: { stats: { balance: 1, confidence: -1, ...(isl === 'family' ? { family: 2 } : isl === 'friendship' ? { friendship: 2 } : {}) }, islands: islands(1) }, text: `“${entry.title}” is blue now. Missing something means it mattered.`, tone: 'mixed' };
  if (to === 'anger') return { deltas: { stats: { confidence: 2, balance: -1 }, islands: islands(-3) }, text: `Riley remembers “${entry.title}” as unfair now. She feels stronger, and a bit prickly about it.`, tone: 'mixed' };
  if (to === 'fear') return { deltas: { stats: { confidence: -2, balance: -1 }, islands: islands(-2) }, text: `“${entry.title}” feels risky to think about now.`, tone: 'bad' };
  if (to === 'disgust') return { deltas: { stats: { confidence: 1, belonging: -1 }, islands: islands(-1) }, text: `Riley has decided “${entry.title}” was a bit embarrassing, actually.`, tone: 'mixed' };
  return { deltas: {}, text: '', tone: 'mixed' };
}

/** Days without a visit before a memory starts to fade. */
export const FADE_AFTER: Record<'important' | 'everyday', number> = { everyday: 2, important: 4 };

// ───────────────────────────── islands ─────────────────────────────

export function islandTarget(id: IslandId, s: MindState, library: MemoryEntry[]): number {
  const st = s.stats;
  let base: number;
  switch (id) {
    case 'family':
      base = st.family;
      break;
    case 'friendship':
      base = st.friendship * 0.75 + st.belonging * 0.25;
      break;
    case 'hockey':
      base = st.confidence * 0.6 + st.belonging * 0.4;
      break;
    case 'goofball':
      base = st.balance * 0.6 + st.confidence * 0.2 + st.family * 0.2;
      break;
    case 'honesty':
      base = st.balance * 0.5 + st.family * 0.5;
      break;
    case 'curiosity':
      base = st.confidence * 0.5 + st.balance * 0.5;
      break;
  }
  // memories tied to the island hold it up, or let it down when they're lost
  for (const e of library) {
    if (e.island !== id) continue;
    const m = s.memories[e.id];
    if (!m) continue;
    if (m.status === 'core') base += 10;
    else if (m.status === 'long-term' && e.significance === 'important') base += 3;
    else if (m.status === 'forgotten' && e.significance === 'important') base -= 6;
    else if (m.status === 'released' && e.significance === 'important') base -= 10;
  }
  return clamp100(base);
}

export type StabilityBand = 'thriving' | 'steady' | 'shaky' | 'crumbling';
export function stabilityBand(v: number): StabilityBand {
  if (v >= 70) return 'thriving';
  if (v >= 45) return 'steady';
  if (v >= 25) return 'shaky';
  return 'crumbling';
}
export const BAND_LABEL: Record<StabilityBand, string> = { thriving: 'Thriving', steady: 'Steady', shaky: 'Shaky', crumbling: 'Crumbling' };

// ───────────────────────────── nights ─────────────────────────────

export interface NightReport {
  day: number;
  fired: LogEntry[];
  faded: string[];
  forgotten: string[];
  islandChanges: { id: IslandId; from: number; to: number }[];
  statBefore: Stats;
  statAfter: Stats;
  notes: LogEntry[];
}

/**
 * While Riley sleeps: delayed consequences arrive, memories fade, and islands drift
 * toward what her days have actually been like.
 */
export function runNight(input: MindState, library: MemoryEntry[], flags: Record<string, boolean>): { state: MindState; report: NightReport; flags: Record<string, boolean> } {
  let s: MindState = { ...input, day: input.day + 1 };
  const nextFlags = { ...flags };
  const report: NightReport = { day: s.day, fired: [], faded: [], forgotten: [], islandChanges: [], statBefore: { ...input.stats }, statAfter: input.stats, notes: [] };

  // 1. delayed consequences
  const due = s.pending.filter((p) => p.day <= s.day);
  s = { ...s, pending: s.pending.filter((p) => p.day > s.day) };
  for (const p of due) {
    if (p.unlessFlag && nextFlags[p.unlessFlag]) continue;
    if (p.deltas) s = applyDeltas(s, p.deltas);
    for (const f of p.flags ?? []) nextFlags[f] = true;
    if (p.memory) {
      const cur = s.memories[p.memory.id];
      if (cur) {
        const swirl = p.memory.addSwirl && !cur.swirl.includes(p.memory.addSwirl) ? [...cur.swirl, p.memory.addSwirl] : cur.swirl;
        s = { ...s, memories: { ...s.memories, [p.memory.id]: { ...cur, emotion: p.memory.emotion ?? cur.emotion, swirl, status: p.memory.status ?? cur.status } } };
      }
    }
    report.fired.push({ day: s.day, text: p.text, tone: p.tone });
  }

  // 2. neglect: relationships nobody tended for a day cool off a little
  const neglect: [StatKey, number, string][] = [
    ['friendship', 3, 'Nobody reached out to a friend today. Friendship cooled a little.'],
    ['family', 2, 'Riley kept to herself at home today.'],
  ];
  for (const [k, amt, text] of neglect) {
    if ((s.tended[k] ?? 0) < input.day) {
      s = applyDeltas(s, { stats: { [k]: -amt } });
      report.notes.push({ day: s.day, text, tone: 'bad' });
    }
  }

  // 3. one emotion running everything wears Riley out
  const last = s.leadHistory.slice(-3);
  if (last.length === 3 && last.every((e) => e === last[0])) {
    s = applyDeltas(s, { stats: { balance: -6 } });
    report.notes.push({ day: s.day, text: `The last three big moments were all led by the same emotion. Riley feels a bit one-note.`, tone: 'bad' });
  } else if (last.length === 3 && new Set(last).size === 3) {
    s = applyDeltas(s, { stats: { balance: 2 } });
    report.notes.push({ day: s.day, text: 'Different feelings took the lead each time. Riley feels more like herself.', tone: 'good' });
  }

  // 4. memories fade when nobody visits them
  const memories = { ...s.memories };
  for (const e of library) {
    const m = memories[e.id];
    if (!m || e.significance === 'core' || m.status === 'core' || m.status === 'released') continue;
    const limit = FADE_AFTER[e.significance === 'important' ? 'important' : 'everyday'];
    const age = s.day - m.lastSeen;
    if (m.status === 'long-term' && age >= limit) {
      memories[e.id] = { ...m, status: 'faded' };
      report.faded.push(e.title);
    } else if (m.status === 'faded' && age >= limit + 2) {
      memories[e.id] = { ...m, status: 'forgotten' };
      report.forgotten.push(e.title);
    }
  }
  s = { ...s, memories };

  // 5. islands drift halfway toward where her life actually is
  const islands = { ...s.islands };
  for (const id of Object.keys(islands) as IslandId[]) {
    const target = islandTarget(id, s, library);
    const next = clamp100(islands[id] + (target - islands[id]) * 0.5);
    if (Math.abs(next - islands[id]) >= 3) report.islandChanges.push({ id, from: islands[id], to: next });
    islands[id] = next;
  }
  s = { ...s, islands, tended: {} };
  report.statAfter = { ...s.stats };
  s = { ...s, log: [...s.log, ...report.fired, ...report.notes].slice(-40) };
  return { state: s, report, flags: nextFlags };
}

/** Visiting a memory keeps it from fading. */
export function touchMemory(s: MindState, id: string, patch: Partial<MemState> = {}): MindState {
  const m = s.memories[id];
  if (!m) return s;
  const status = m.status === 'faded' && patch.status === undefined ? m.status : (patch.status ?? m.status);
  return { ...s, memories: { ...s.memories, [id]: { ...m, ...patch, status, discovered: true, lastSeen: s.day } } };
}
