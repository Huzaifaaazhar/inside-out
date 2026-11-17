# ADR-001: Canvas scene engine with a shared Zustand store

**Status:** Accepted
**Date:** 2026-11-17

## Context

Part 1 needs a 2D game in the browser: an opening cinematic, three explorable areas,
five animated emotion characters, a scenario with per-emotion mini-games, synthesized
sound and transitions between areas. Later parts will add more areas, scenarios and systems.

Constraints:

- Strictly 2D. No Three.js, WebGL or 3D scene graphs.
- Original artwork only, so everything is drawn in code (no image assets to license or rip).
- Words, choices and controls must stay accessible: keyboard, screen readers, focus and reduced motion.
- The world simulation runs at 60 fps and must not re-render React every frame.

## Decision

1. **Rendering:** a hand-rolled Canvas 2D engine. A fixed logical stage of 1600×900 is
   letterboxed to the window at devicePixelRatio. Each area is a `Scene` with
   `enter / exit / update(dt) / render(ctx)`. A `SceneManager` owns the active scene and
   plays named transitions (`tube`, `glide`, `iris`, `fade`) between scenes.
2. **Shell:** React renders the DOM overlay only: dialogue, the mood dial, the objective
   memo, the map, captions and the menu. These are real buttons with labels and focus rings.
3. **State:** a single Zustand store. React subscribes with selectors; the engine reads
   `getState()` inside the loop and calls actions. That makes the store the one contract
   between the world and the overlay.
4. **Content as data:** emotions, dialogue, memories, islands and scenario beats live in
   plain typed modules (`src/game/content`, `src/game/scenario`). Part 2 adds content
   without touching the engine.
5. **Audio:** synthesized with the WebAudio API (`src/engine/audio.ts`): per-emotion voices,
   footsteps, UI blips and an ambient pad that is retuned to the active emotion.

## Options considered

### A: Canvas 2D engine + React overlay + Zustand (chosen)
| Dimension | Assessment |
|-----------|------------|
| Complexity | Medium: we own the loop, input and transitions |
| Bundle | Small (React + Zustand only) |
| Extensibility | High: scenes and content are data and classes |
| Accessibility | Good: text and controls stay in the DOM |

### B: A 2D framework (Phaser / PixiJS)
**Pros:** batteries included (tweens, scenes, sprite sheets).
**Cons:** PixiJS renders with WebGL, which the brief rules out; Phaser adds ~1 MB, and its
UI layer is drawn on canvas, which is hard to make accessible.

### C: All-DOM/SVG scenes
**Pros:** native accessibility.
**Cons:** hundreds of animated nodes, particles and lighting overlays thrash layout. A game
loop on SVG is slow.

## Consequences

- Easier: adding an area means one `Scene` subclass plus a registration in `scenes/index.ts`.
- Easier: the overlay can be tested and styled like any React app.
- Harder: we maintain our own input, camera and hit-testing.
- Revisit: if Part 2 needs sprite-sheet art, add an image atlas loader to `engine/`.

## Module map

```
src/engine/    loop, input, audio, camera, particles, tween, draw helpers
src/game/art/  procedural illustration: characters, HQ, memory storage, islands
src/game/      content data, scenario data, the Engine class wiring it together
src/game/scenes/ Opening, Headquarters, MemoryStorage, PersonalityIslands, SceneManager
src/state/     Zustand store (single source of truth shared by engine + UI)
src/ui/        React overlay components
```
