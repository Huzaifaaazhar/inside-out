import { create } from 'zustand';
import type { EmotionId } from '../game/content/emotions';
import type { AreaId, IslandId, MemoryDef } from '../game/content/world';
import { STARTING_CORE } from '../game/content/world';
import type { Line, Tone } from '../game/scenario/artClub';

export type Phase = 'title' | 'opening' | 'playing';
export type Objective = 'meet' | 'select' | 'console' | 'scenario' | 'shelve' | 'islands' | 'free';
export type ConsoleStage = 'off' | 'intro' | 'situation' | 'choose' | 'minigame' | 'outcome' | 'finale';
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
  free: 'Explore Riley’s mind. Try every emotion’s ability (Q) on things you find',
};

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

  start: () => void;
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
  coreShelf: [STARTING_CORE[0], STARTING_CORE[1], null, STARTING_CORE[2], STARTING_CORE[3]] as (MemoryDef | null)[],
  carrying: null,
  islands: { family: true, friendship: false, honesty: true, curiosity: true, silliness: true } as Record<IslandId, boolean>,
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
});

export const useGame = create<GameState>()((set, get) => ({
  ...initial(),
  muted: false,
  reducedMotion: !!prefersReduced,

  start: () => set({ phase: 'opening' }),
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
}));

/** True when an overlay should pause world input. */
export const isBlocking = (s: GameState) => !!(s.dialogue || s.mapOpen || s.menuOpen || s.helpOpen || s.inspect || s.transitioning);
