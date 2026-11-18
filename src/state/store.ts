import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { EmotionId } from '../game/content/emotions';
import type { AreaId, IslandId, MemoryDef } from '../game/content/world';
import { STARTING_CORE } from '../game/content/world';
import type { Line, Tone } from '../game/scenario/artClub';
import { MEMORY_BY_ID } from '../game/content/memories';
import { SCENARIOS, SCENARIO_BY_DAY, LAST_DAY } from '../game/scenario/scenarios';
import type { Deltas, MemState, Mix, MindState, NightReport, Resolution } from '../game/systems/mind';
import { applyDeltas, emptyMix, initialMind, MAX_PIPS_PER_EMOTION, mixTotal, PIP_BUDGET, recolorEffect, recordChoice, runNight, schedule, touchMemory } from '../game/systems/mind';
import { allEntries, getEntry } from '../game/systems/library';

export type Phase = 'title' | 'opening' | 'playing';
export type Objective = 'meet' | 'select' | 'console' | 'scenario' | 'shelve' | 'islands' | 'free' | 'p2-day' | 'p2-explore' | 'p2-done';
export type ConsoleStage = 'off' | 'intro' | 'situation' | 'choose' | 'minigame' | 'outcome' | 'finale' | 'cinematic' | 'mix';
export type TransitionKind = 'tube' | 'glide' | 'iris' | 'fade';

export interface DialogueChoice {
  label: string;
  run: () => void;
}

export interface DialogueState {
  id: number;
  lines: Line[];
  index: number;
  onDone?: () => void;
  choices?: DialogueChoice[];
}

export interface BeatResult {
  beatId: string;
  emotion: EmotionId;
  tone: Tone;
  score: number;
}

export interface InspectCard {
  title: string;
  body: string;
  color: string;
  kicker?: string;
  extra?: string;
}

export interface MinigameUI {
  emotion: EmotionId;
  title: string;
  instruction: string;
  primary?: string;
  /** 'tap' fires once; 'hold' reports press and release. */
  mode: 'tap' | 'hold' | 'none';
  progress: number;
}

export interface Toast {
  id: number;
  text: string;
  color: string;
}

export const OBJECTIVE_TEXT: Record<Objective, string> = {
  meet: 'Meet the team',
  select: 'Pick an emotion to control: press 1–5 or tap the mood dial',
  console: 'Walk to the console in the middle of HQ and press E',
  scenario: 'Guide Riley through her first day at art club',
  shelve: 'Carry the new core memory to the holder on the left of HQ',
  islands: 'See what it powers. Personality Islands are through the balcony door on the right',
  free: 'Explore Riley’s mind. When you’re ready, let Riley sleep at the console',
  'p2-day': 'Today’s moment is waiting at the console',
  'p2-explore': 'Visit memories and islands, then let Riley sleep at the console',
  'p2-done': 'Every day is played. Keep exploring how Riley’s mind turned out',
};

export interface ScenarioRun {
  id: string;
  moment: number;
  results: { momentId: string; lead: EmotionId; blend: string | null; overload: boolean; mix: Mix }[];
}

/** The memo text, which needs today's scenario for Part 2. */
export function objectiveText(s: { objective: Objective; mind: MindState | null }) {
  if (s.objective === 'p2-day' && s.mind) {
    const sc = SCENARIO_BY_DAY[s.mind.day];
    if (sc) return `Day ${s.mind.day}: “${sc.title}” is waiting at the console`;
  }
  return OBJECTIVE_TEXT[s.objective];
}

interface GameState {
  phase: Phase;
  area: AreaId;
  active: EmotionId;
  objective: Objective;
  dialogue: DialogueState | null;
  prompt: string | null;
  consoleStage: ConsoleStage;
  beat: number;
  results: BeatResult[];
  coreShelf: (MemoryDef | null)[];
  carrying: MemoryDef | null;
  islands: Record<IslandId, boolean>;
  flags: Record<string, boolean>;
  restored: Record<string, boolean>;
  mapOpen: boolean;
  menuOpen: boolean;
  helpOpen: boolean;
  inspect: InspectCard | null;
  minigame: MinigameUI | null;
  caption: string | null;
  toast: Toast | null;
  pendingTravel: { area: AreaId; via: TransitionKind; spawn?: number } | null;
  transitioning: boolean;
  muted: boolean;
  reducedMotion: boolean;
  /** Part 2: the persistent consequence engine state. */
  mind: MindState | null;
  mix: Mix;
  scenario: ScenarioRun | null;
  nightReport: NightReport | null;
  theatre: string | null;
  journalOpen: boolean;
  reportOpen: boolean;
  activity: string | null;

  start: () => void;
  continueGame: () => void;
  newGame: () => void;
  startPart2: () => void;
  addPip: (e: EmotionId, delta: number) => void;
  clearMix: () => void;
  beginScenario: (id: string) => void;
  commitMoment: (momentId: string, r: Resolution, mix: Mix) => void;
  finishScenario: () => { id: string; emotion: EmotionId } | null;
  sleep: () => void;
  dismissNight: () => void;
  applyMind: (d: Deltas) => void;
  visitMemory: (id: string, patch?: Partial<MemState>) => void;
  viewLens: (id: string, e: EmotionId) => void;
  recolor: (id: string, to: EmotionId) => void;
  recallMemory: (id: string) => void;
  releaseMemory: (id: string) => void;
  rewardActivity: (id: string, d: Deltas, text: string) => boolean;
  setTheatre: (id: string | null) => void;
  setJournal: (open: boolean) => void;
  setReport: (open: boolean) => void;
  setActivity: (id: string | null) => void;
  finishOpening: () => void;
  setActive: (id: EmotionId) => void;
  say: (lines: Line[], onDone?: () => void, choices?: DialogueChoice[]) => void;
  advance: () => void;
  setPrompt: (p: string | null) => void;
  setObjective: (o: Objective) => void;
  setFlag: (k: string, v?: boolean) => void;
  travel: (area: AreaId, via?: TransitionKind, spawn?: number) => void;
  setConsole: (stage: ConsoleStage) => void;
  pushResult: (r: BeatResult) => void;
  nextBeat: () => void;
  setCarrying: (m: MemoryDef | null) => void;
  placeCore: (m: MemoryDef, island: IslandId) => void;
  restore: (id: string) => void;
  setMap: (open: boolean) => void;
  setMenu: (open: boolean) => void;
  setHelp: (open: boolean) => void;
  setInspect: (c: InspectCard | null) => void;
  setMinigame: (m: MinigameUI | null) => void;
  setCaption: (c: string | null) => void;
  showToast: (text: string, color?: string) => void;
  setMuted: (m: boolean) => void;
  setReducedMotion: (r: boolean) => void;
  reset: () => void;
}

let dialogueId = 0;
let toastId = 0;

const prefersReduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const initial = () => ({
  phase: 'title' as Phase,
  area: 'hq' as AreaId,
  active: 'joy' as EmotionId,
  objective: 'meet' as Objective,
  dialogue: null,
  prompt: null,
  consoleStage: 'off' as ConsoleStage,
  beat: 0,
  results: [] as BeatResult[],
  coreShelf: [STARTING_CORE[0], STARTING_CORE[1], null, STARTING_CORE[2], STARTING_CORE[3], STARTING_CORE[4]] as (MemoryDef | null)[],
  carrying: null,
  islands: { family: true, friendship: false, hockey: true, goofball: true, honesty: true, curiosity: true } as Record<IslandId, boolean>,
  flags: {} as Record<string, boolean>,
  restored: {} as Record<string, boolean>,
  mapOpen: false,
  menuOpen: false,
  helpOpen: false,
  inspect: null,
  minigame: null,
  caption: null,
  toast: null,
  pendingTravel: null,
  transitioning: false,
  mind: null as MindState | null,
  mix: emptyMix(),
  scenario: null as ScenarioRun | null,
  nightReport: null as NightReport | null,
  theatre: null as string | null,
  journalOpen: false,
  reportOpen: false,
  activity: null as string | null,
});

const SAVE_KEY = 'riley-mind-save-v2';
export const hasSave = () => {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return !!raw && raw.includes('"introDone":true');
  } catch {
    return false;
  }
};

export const useGame = create<GameState>()(
  persist(
    (set, get) => ({
  ...initial(),
  muted: false,
  reducedMotion: !!prefersReduced,

  start: () => set({ phase: 'opening' }),
  continueGame: () => set({ phase: 'playing', caption: null }),
  newGame: () => {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      /* storage unavailable: nothing to clear */
    }
    set({ ...initial(), phase: 'opening' });
  },

  startPart2: () => {
    if (get().mind) return;
    const great = get().results.filter((r) => r.tone === 'great').length;
    const mind = initialMind(Object.values(MEMORY_BY_ID), { great, artClubDone: !!get().flags.scenarioDone });
    set({ mind, objective: 'p2-day' });
  },
  addPip: (e, delta) => {
    const mix = { ...get().mix };
    const next = Math.max(0, Math.min(MAX_PIPS_PER_EMOTION, mix[e] + delta));
    if (delta > 0 && mixTotal(mix) >= PIP_BUDGET) return;
    mix[e] = next;
    set({ mix });
  },
  clearMix: () => set({ mix: emptyMix() }),
  beginScenario: (id) => set({ scenario: { id, moment: 0, results: [] }, mix: emptyMix() }),
  commitMoment: (momentId, r, mix) => {
    const s = get();
    if (!s.mind || !s.scenario) return;
    let mind = applyDeltas(s.mind, r.deltas);
    mind = recordChoice(mind, mix, r.lead);
    mind = schedule(mind, r.later);
    const flags = { ...s.flags };
    for (const f of r.flags) flags[f] = true;
    set({
      mind,
      flags,
      mix: emptyMix(),
      scenario: { ...s.scenario, moment: s.scenario.moment + 1, results: [...s.scenario.results, { momentId, lead: r.lead, blend: r.blend, overload: r.overload, mix }] },
    });
  },
  finishScenario: () => {
    const s = get();
    if (!s.mind || !s.scenario) return null;
    const sc = SCENARIOS.find((x) => x.id === s.scenario!.id)!;
    // the memory takes the colour of whoever led most, swirled with everyone who helped
    const tally: Partial<Record<EmotionId, number>> = {};
    const used = new Set<EmotionId>();
    for (const r of s.scenario.results) {
      tally[r.lead] = (tally[r.lead] ?? 0) + 2;
      for (const [e, w] of Object.entries(r.mix) as [EmotionId, number][]) if (w > 0) {
        used.add(e);
        tally[e] = (tally[e] ?? 0) + w;
      }
    }
    const emotion = (Object.entries(tally) as [EmotionId, number][]).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'sadness';
    const memState: MemState = { emotion, swirl: [...used].filter((e) => e !== emotion), discovered: true, lenses: [], detail: false, revisits: 0, lastSeen: s.mind.day, status: 'long-term', recolors: 0 };
    const mind: MindState = {
      ...s.mind,
      memories: { ...s.mind.memories, [sc.memory.id]: memState },
      scenariosDone: [...s.mind.scenariosDone, sc.id],
      log: [...s.mind.log, { day: s.mind.day, text: `New memory: “${sc.memory.title}”.`, tone: 'mixed' as const }],
    };
    set({ mind, scenario: null, objective: 'p2-explore' });
    return { id: sc.memory.id, emotion };
  },
  sleep: () => {
    const s = get();
    if (!s.mind) return;
    const { state, report, flags } = runNight(s.mind, allEntries(s.mind), s.flags);
    const done = state.day > LAST_DAY;
    set({ mind: state, flags, nightReport: report, objective: done ? 'p2-done' : 'p2-day' });
  },
  dismissNight: () => set({ nightReport: null }),
  applyMind: (d) => {
    const m = get().mind;
    if (m) set({ mind: applyDeltas(m, d) });
  },
  visitMemory: (id, patch) => {
    const m = get().mind;
    if (!m) return;
    const cur = m.memories[id];
    set({ mind: touchMemory(m, id, { revisits: (cur?.revisits ?? 0) + 1, ...(patch ?? {}) }) });
  },
  viewLens: (id, e) => {
    const m = get().mind;
    const cur = m?.memories[id];
    if (!m || !cur || cur.lenses.includes(e)) return;
    set({ mind: { ...m, memories: { ...m.memories, [id]: { ...cur, lenses: [...cur.lenses, e] } } } });
  },
  recolor: (id, to) => {
    const m = get().mind;
    const cur = m?.memories[id];
    const entry = getEntry(id, m ?? null);
    if (!m || !cur || !entry || cur.emotion === to || cur.status === 'core') return;
    const eff = recolorEffect(entry, cur, to);
    let mind = applyDeltas(m, eff.deltas);
    const swirl = cur.swirl.includes(cur.emotion) ? cur.swirl : [...cur.swirl, cur.emotion].slice(-3);
    mind = { ...mind, memories: { ...mind.memories, [id]: { ...cur, emotion: to, swirl: swirl.filter((e) => e !== to), recolors: cur.recolors + 1, lastSeen: m.day } }, log: [...mind.log, { day: m.day, text: eff.text, tone: eff.tone }] };
    set({ mind });
    get().showToast(eff.text, '#F3EEFF');
  },
  recallMemory: (id) => {
    const m = get().mind;
    const cur = m?.memories[id];
    const entry = getEntry(id, m ?? null);
    if (!m || !cur || !entry) return;
    let mind = touchMemory(m, id, { status: 'long-term' });
    if (entry.significance === 'important' && entry.island) mind = applyDeltas(mind, { islands: { [entry.island]: 4 } });
    mind = { ...mind, log: [...mind.log, { day: m.day, text: `“${entry.title}” was brought back from The Fading.`, tone: 'good' as const }] };
    set({ mind });
  },
  releaseMemory: (id) => {
    const m = get().mind;
    const cur = m?.memories[id];
    const entry = getEntry(id, m ?? null);
    if (!m || !cur || !entry) return;
    const d: Deltas = entry.significance === 'important' && entry.island ? { stats: { balance: 1 }, islands: { [entry.island]: -6 } } : { stats: { balance: 2 } };
    let mind = applyDeltas(m, d);
    mind = {
      ...mind,
      memories: { ...mind.memories, [id]: { ...cur, status: 'released' } },
      log: [...mind.log, { day: m.day, text: entry.significance === 'important' ? `Riley let go of “${entry.title}”. Something on ${entry.island ? entry.island + ' island' : 'an island'} felt it.` : `Riley let go of “${entry.title}”. There’s a bit more room now.`, tone: entry.significance === 'important' ? 'bad' : 'good' }],
    };
    set({ mind });
  },
  rewardActivity: (id, d, text) => {
    const m = get().mind;
    if (!m) return false;
    if (m.activityDay[id] === m.day) return false;
    let mind = applyDeltas(m, d);
    mind = { ...mind, activityDay: { ...mind.activityDay, [id]: m.day }, log: [...mind.log, { day: m.day, text, tone: 'good' as const }] };
    set({ mind });
    return true;
  },
  setTheatre: (id) => set({ theatre: id }),
  setJournal: (open) => set({ journalOpen: open }),
  setReport: (open) => set({ reportOpen: open }),
  setActivity: (id) => set({ activity: id }),
  finishOpening: () => set({ phase: 'playing', caption: null, area: 'hq' }),

  setActive: (id) => {
    if (get().active === id) return;
    set({ active: id });
    if (get().objective === 'select') set({ objective: 'console' });
  },

  say: (lines, onDone, choices) => {
    if (!lines.length) {
      onDone?.();
      return;
    }
    set({ dialogue: { id: ++dialogueId, lines, index: 0, onDone, choices } });
  },

  advance: () => {
    const d = get().dialogue;
    if (!d) return;
    if (d.index < d.lines.length - 1) {
      set({ dialogue: { ...d, index: d.index + 1 } });
      return;
    }
    if (d.choices && d.choices.length) return; // a choice must be made
    set({ dialogue: null });
    d.onDone?.();
  },

  setPrompt: (p) => {
    if (get().prompt !== p) set({ prompt: p });
  },
  setObjective: (o) => set({ objective: o }),
  setFlag: (k, v = true) => set({ flags: { ...get().flags, [k]: v } }),
  travel: (area, via = 'iris', spawn) => {
    if (get().transitioning) return;
    set({ pendingTravel: { area, via: get().reducedMotion ? 'fade' : via, spawn }, mapOpen: false, inspect: null });
  },
  setConsole: (stage) => set({ consoleStage: stage }),
  pushResult: (r) => set({ results: [...get().results, r] }),
  nextBeat: () => set({ beat: get().beat + 1 }),
  setCarrying: (m) => set({ carrying: m }),
  placeCore: (m, island) => {
    const shelf = [...get().coreShelf];
    const empty = shelf.indexOf(null);
    if (empty >= 0) shelf[empty] = m;
    set({ coreShelf: shelf, carrying: null, islands: { ...get().islands, [island]: true } });
  },
  restore: (id) => set({ restored: { ...get().restored, [id]: true } }),
  setMap: (open) => set({ mapOpen: open }),
  setMenu: (open) => set({ menuOpen: open }),
  setHelp: (open) => set({ helpOpen: open }),
  setInspect: (c) => set({ inspect: c }),
  setMinigame: (m) => set({ minigame: m }),
  setCaption: (c) => set({ caption: c }),
  showToast: (text, color = '#F3EEFF') => set({ toast: { id: ++toastId, text, color } }),
  setMuted: (m) => set({ muted: m }),
  setReducedMotion: (r) => set({ reducedMotion: r }),
  reset: () => set({ ...initial(), phase: 'opening' }),
    }),
    {
      name: SAVE_KEY,
      version: 2,
      storage: createJSONStorage(() => localStorage),
      // only durable progress is saved; overlays, dialogue and callbacks are not
      partialize: (s) => ({
        area: s.area,
        active: s.active,
        objective: s.objective,
        beat: s.beat,
        results: s.results,
        coreShelf: s.coreShelf,
        carrying: s.carrying,
        islands: s.islands,
        flags: s.flags,
        restored: s.restored,
        muted: s.muted,
        reducedMotion: s.reducedMotion,
        mind: s.mind,
      }),
    },
  ),
);

/** True when an overlay should pause world input. */
export const isBlocking = (s: GameState) =>
  !!(s.dialogue || s.mapOpen || s.menuOpen || s.helpOpen || s.inspect || s.transitioning || s.theatre || s.journalOpen || s.reportOpen || s.nightReport);

export type GameStore = GameState;
