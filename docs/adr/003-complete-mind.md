# ADR-003: Completing the mind — new places, progression and endings

**Status:** Accepted
**Date:** 2026-11-18

## Context

Part 3 had to add three environments (Imagination Land, Dream Productions, the Subconscious), a finale that brings every system together, and the "whole game" systems: saving, journal, progression, map, pause, audio and touch. The constraints from Parts 1 and 2 still held:

- Canvas for the world and React for words and choices.
- One Zustand store.
- A pure consequence engine.
- No asset files.

The main risks were:

- three more scenes copying each other's activity-hosting code;
- a finale that could be "won" by maximising one number;
- a map that feels like a website menu.

## Decisions

### 1. `ActivityScene`: one way to host an activity in the world
The island scenes had their own code to frame an activity, route input to it and dock its panel. That code moved into an abstract `ActivityScene extends WorldScene`, with an `onActivityDone` hook. Islands, Imagination Land (bridge challenge) and Dream Productions (dream shoot) all use it. The frame is clamped inside the world so the camera can always centre it.

### 2. Places are connected on foot first; the atlas only remembers
Each new place has a physical entrance in an existing scene:

- the daydream ribbon on the island cliffs;
- the studio gate past the Gap of Nothing;
- the stairwell at the end of The Fading.

The Mind Atlas lets you travel only to places in `progress.visited`, plus the Part 1 and 2 areas. Unvisited places show fog and the route to find them. Exploring therefore stays the way you discover places, and the atlas is part of the world rather than a sidebar.

### 3. Progress is separate from the mind
`progress` (XP, insights, discoveries, fears, dreams, visited) sits next to `mind` in the store, not inside it. The mind is Riley's state, and the finale snapshots and restores it for replays. Progress belongs to the player and carries across a replay. Levels feed back into play through two small, legible bonuses: a longer ability reach and a delivery bonus on mini-game scores. Neither can decide an outcome on its own.

### 4. Endings are scored, and the strongest wins
`scoreEnding` is a pure function of the mind, flags, progress and the finale record. Each of the five endings has its own score, and the highest one is the ending:

| Ending | Rewards |
|---|---|
| Balanced | Evenness of emotion use (normalised entropy), voices heard, reflection colours, the all-voices blend; minus takeovers |
| Family | Family stat and honesty and repair flags; minus unrepaired fights |
| Self | The opened vault, insights and named fears |
| Avoidance | Joy's share and masking; also rises when Sadness and Fear were silent on the final night |
| Isolation | Low connection, takeovers, walling off, and lost important memories |

Unit tests check that an all-Joy run lands on avoidance, and that each other ending is reachable.

### 5. The finale reuses the scenario machinery
The finale reuses the scenario machinery. The news, the call and the meeting are ordinary `MomentDef`s, so they use the same resolver, blends, overloads and mini-games as the week. Two things are new:

- A `MixInfo` store field lets the console set the mixer's title, steps and budget. The meeting has six points instead of four.
- A `reflect` console stage, where the player chooses memories. Their current colours count as "voices heard".

`FINALE_TALK(flags)` is a function, so who answers depends on earlier choices.

### 6. Music is generated, not stored
A `Music` engine schedules bass, pad, arpeggio and melody voices with WebAudio, a little ahead of time. Each track is a small data record: tempo, root, chords, scale, timbre and swing. Every area has a track. Scene changes crossfade, and the console switches to the finale track during Day 7. Music and sound effects have separate gain buses, controlled by the pause-menu sliders and saved.

## Consequences

- New areas are cheap to add: one `ActivityScene` or `WorldScene` subclass, plus an `AreaId`, a track and an atlas entry.
- The ending logic is testable without a browser. The trade-off is that its weights need tuning when content changes. `part3.test.ts` holds one representative playthrough per ending to catch regressions.
- The save shape grew. `merge` fills defaults for older saves and migrates the old `p2-done` objective to `p3-final`, so Part 2 saves continue straight into Day 7.
