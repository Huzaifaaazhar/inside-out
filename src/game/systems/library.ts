import type { MemoryEntry } from '../content/memories';
import { MEMORY_BY_ID, MEMORY_LIBRARY } from '../content/memories';
import { SCENARIOS, scenarioMemoryEntry } from '../scenario/scenarios';
import type { MindState } from './mind';

const SCENARIO_MEM_IDS = new Map(SCENARIOS.map((s) => [s.memory.id, s]));

/** Look up any memory: the fixed library or one made by a scenario. */
export function getEntry(id: string, mind: MindState | null): MemoryEntry | undefined {
  const fixed = MEMORY_BY_ID[id];
  if (fixed) return fixed;
  const sc = SCENARIO_MEM_IDS.get(id);
  if (!sc) return undefined;
  const st = mind?.memories[id];
  return scenarioMemoryEntry(sc, st?.emotion ?? 'sadness');
}

/** Every memory Riley has, including ones made by scenarios. */
export function allEntries(mind: MindState | null): MemoryEntry[] {
  const made = SCENARIOS.filter((s) => mind?.memories[s.memory.id]).map((s) => scenarioMemoryEntry(s, mind!.memories[s.memory.id].emotion));
  return [...MEMORY_LIBRARY, ...made];
}

/** Total possible memories, for the journal's count. */
export const TOTAL_MEMORIES = MEMORY_LIBRARY.length + SCENARIOS.length;
