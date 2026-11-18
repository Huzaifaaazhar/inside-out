# ADR-002: A pure, persistent consequence engine

**Status:** Accepted
**Date:** 2026-11-18

## Context

Part 2 asks for decisions whose consequences appear later. It asks that no single emotion always be the best choice, and that the game avoid a right-or-wrong quiz. It also tracks seven things: emotional balance, family, friendships, confidence, belonging, island stability and memory associations. Progress has to survive a reload.

## Decision

All rules live in `src/game/systems/mind.ts` as pure functions over a plain `MindState` object:

- **`resolveMoment(moment, mix, delivery)`** turns an influence mix (up to 4 points, at most 3 per emotion) into lines, deltas, flags and delayed consequences:
  - Every point of every emotion pushes the stats its own way.
  - The strongest emotion picks the response. Specific combinations ("blends") override it.
  - An emotion with 3 points and no help "takes over". Every emotion pays a cost for taking over.
  - Feeling two or three things at once earns emotional balance.
  - The lead emotion's mini-game score scales how strongly its intent lands.
- **`runNight(state)`** advances a day:
  - Delayed consequences come due, unless a flag says the situation was repaired.
  - Relationships nobody tended cool off.
  - Leading with the same emotion three times running wears Riley out.
  - Unvisited memories fade, then are forgotten.
  - Each island drifts halfway toward a target computed from the stats and the memories tied to it.
- **`recolorEffect`** makes re-remembering a memory meaningful. Painting a hard memory gold after looking at it through Sadness helps. Doing it without that look is suppression, and costs balance.

The Zustand store calls these functions and persists durable progress with `zustand/middleware`'s `persist`. Overlays, dialogue and callbacks are excluded from the save.

## Options considered

| Option | Pros | Cons |
|---|---|---|
| **Pure functions + store (chosen)** | Unit-testable without a browser; one place for rules; trivially serialisable | Store actions must remember to call the engine |
| Rules inside scenes | Fewer files | Untestable; rules scattered across canvas code |
| Scripted branching tree per scenario | Precise authoring | Explodes combinatorially with five-way mixes; no shared balance rules |

## Consequences

- Scenario content is data (`scenario/scenarios.ts`): per-emotion effects, lead responses, blends, overloads and delayed consequences. The unit tests check the design constraints against the real data:
  - every emotion is the best single lead somewhere;
  - no emotion is best in half the moments or more;
  - every emotion does harm somewhere;
  - a blend always matches or beats that moment's best single lead.
- Saves are versioned (`riley-mind-save-v2`). A future shape change needs a `migrate` function.
- Part 3 can add scenarios, islands or stats without touching scenes.
