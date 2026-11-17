# Headquarters: a game inside Riley's mind

A 2D browser game inspired by Pixar's *Inside Out*. You are the new operator of Riley's emotional Headquarters. Choose which emotion drives, use their abilities, and guide an eleven-year-old through her first day at art club.

This is Part 1, the foundation: the opening sequence, an explorable Headquarters, Long-Term Memory, Personality Islands, the five emotions and a tutorial scenario.

All artwork is original and drawn in code on Canvas 2D: characters, environments, Riley's view and the user-interface art. All sound is synthesized with WebAudio. No film assets, screenshots or audio files are used. The five emotions are original designs. Each one's colour, shape and props come from its role:

| Emotion | Design | Ability (Q) |
|---|---|---|
| Joy | a sun-sprite with amber rays and a tangerine dress | **Bright Side**: turns gloomy things golden and brings back faded memories |
| Sadness | a raindrop in a long scarf and rain boots, with her own little raincloud | **Understand**: reveals the feeling hiding underneath |
| Anger | a small volcano with glowing magma cracks | **Stand Up**: breaks through things that are stuck |
| Fear | a lanky safety enthusiast with a bike helmet, knee pads and a flashlight | **Scan**: finds and marks hazards |
| Disgust | a potted cactus with a flower crown | **Nope**: rejects whatever crosses a line |

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check and production build into dist/
```

## Controls

| Input | Action |
|---|---|
| A / D or ← / → (or click the floor) | Walk |
| 1–5, or the mood dial | Switch emotion: the new one tags in where you stand |
| E (or click an object) | Interact, talk, advance dialogue |
| Q | Use the current emotion's ability on whatever is nearby |
| Space | At the console: use the ability on Riley's moment |
| M | Mind map (travel between areas) |
| H | Controls sheet |
| Esc | Pause, or close whatever is open |

Touch works too: tap the floor to walk, tap objects, and use the on-screen ability and interact buttons.

## What's in Part 1

- **Opening sequence.** A spark becomes a memory, drifts into Riley's head, and the camera falls through thought-clouds into the mind world and on to Headquarters. Skippable.
- **Headquarters.** The central console relights to the selected emotion: button rows, gauge needle, lever glow and the whole room's lighting all change, and the ambient sound shifts to match. Also here: Riley's view on the big screen, the shelves of today's memories, the core memory holder, the recall tube to Long-Term Memory, the Mind Manual, the couch, and the balcony door to Personality Islands.
- **Five emotions.** Each has its own walk (Joy skips, Sadness trudges, Anger stomps and shakes the camera, Fear tiptoes and trembles, Disgust struts). Each also has its own voice babble, selection sting, footsteps, ability sound and effect, plus idle behaviour and reactions to the others' abilities. Talk to them for dialogue that depends on who you're controlling and how far the story has got. Use Sadness's ability on them to hear what they're not saying.
- **Field puzzles that teach each ability.** A dim lamp (Joy), a loose cable (Fear), a dripping bad idea (Disgust), a jammed balcony door (Anger), and hidden feelings in other characters and memories (Sadness). Personality Islands add a crumbling edge (Fear), a boulder (Anger) and a cloud of gossip (Disgust).
- **Tutorial scenario: "First day at art club".** Five moments play out on Riley's screen. For each one, pick who drives and play that emotion's mini-game:
  - Scan: a flashlight search for hazards.
  - Nope: a conveyor of offers to reject or accept.
  - Stand Up: a timing gauge.
  - Understand: hold to listen.
  - Bright Side: brighten the grey thoughts.

  Every emotion works in every moment, with its own outcome dialogue. One emotion fits each moment best, and a hint button says which. The moments add up to a new core memory, swirled with the colours of the emotions you used.
- **Long-Term Memory.** Parallax shelves and spiral towers, 14 memories to inspect, and faded memories that Joy can restore. You'll also meet Mote, a Mind Worker.
- **Personality Islands.** Five floating islands. Friendship Island has been dark since Riley moved, and it lights up when you place the new core memory.
- **Navigation.** In the world: the tube (pneumatic-tube transition) and the balcony (cloud-glide transition). From anywhere: the mind map (thought-bubble iris transition). The map shows areas that later parts will open.
- **Accessibility.** All words and controls are real DOM elements with labels, visible focus and screen-reader announcements. There's a full keyboard path, a reduce-motion setting (it also follows the operating system's setting) and a sound toggle. Layouts work on desktop and on phones in either orientation.

## Architecture

See [`docs/adr/001-architecture.md`](docs/adr/001-architecture.md).

```
src/engine/        loop-agnostic pieces: input, synthesized audio, camera, particles, drawing helpers
src/game/art/      procedural illustration: characters, HQ, mindscape, Riley's view
src/game/content/  data: emotions, areas, islands, memories, dialogue
src/game/scenario/ the art club scenario (data) and the five ability mini-games
src/game/scenes/   Opening, HQ, Memory, Islands; WorldScene is the walkable base class
src/game/Game.ts   canvas, loop, scene switching and transitions
src/state/store.ts Zustand store shared by the canvas world and the React overlay
src/ui/            React overlay: dial, dialogue, console panel, map, sheets, HUD
```

The canvas renders the world. React renders only words and choices. Both talk through one Zustand store: React subscribes with selectors, and the engine reads `getState()` each frame. Adding an area for Part 2 means writing a `WorldScene` subclass and registering it in `Game.ts`. Adding a scenario means adding a data module in the shape of `scenario/artClub.ts`.

For debugging, `window.__game` and `window.__store` are exposed in the browser console.
