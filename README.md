# Headquarters: a game inside Riley's mind

A 2D browser game inspired by Pixar's *Inside Out*. You are the new operator of Riley's emotional Headquarters. Choose which emotion drives, use their abilities, and guide an eleven-year-old through her first day at art club.

Part 1 is the foundation: the opening sequence, an explorable Headquarters, the five emotions and a tutorial scenario. Part 2 adds a week of Riley's life. That means memories you can replay and reinterpret, forgotten memories, four walkable personality islands, five real-life scenarios, and a consequence system that remembers what you chose.

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
npm test           # unit tests for the consequence engine (Vitest)
npm run test:e2e   # full-week browser playthrough; needs `npm run dev` running and Playwright with Chromium
```

Progress saves automatically in the browser. The title screen offers **Continue** or **Start over**.

## Controls

| Input | Action |
|---|---|
| A / D or ← / → (or click the floor) | Walk |
| 1–5, or the mood dial | Switch emotion: the new one tags in where you stand |
| E (or click an object) | Interact, talk, advance dialogue |
| Q | Use the current emotion's ability on whatever is nearby |
| Space | At the console: use the ability on Riley's moment |
| M | Mind map (travel between areas) |
| J | Memory journal |
| R | How Riley's doing (stats, islands, what's happened) |
| 1–5 at the mixer | Add influence to an emotion (Shift + 1–5 removes it); Enter sends it to Riley |
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

## What's in Part 2

### Riley's week
After art club, let Riley sleep at the console. Days 2 to 6 each bring one real-life situation:
- moving and missing home;
- an argument with her parents about hockey;
- the lunch table at a new school;
- losing the big game;
- being left out of a party.

Each one opens with a short animated scene on Riley's screen and has two moments. For each moment you **mix her feelings**: share four influence points across the five emotions, at most three each. The strongest emotion leads and plays its ability's mini-game, and the score decides how well its intent lands. The others colour the response.

There are no right answers:
- Every emotion is the best fit somewhere and does harm somewhere.
- Letting one emotion take over always costs something.
- Combinations, like honest-and-hopeful or hurt-and-firm, unlock their own responses.

Some choices echo days later. A slammed door leaves a picture frame face down in the hall. A promise of Sunday calls turns into a long chat with Dani. A pretend "I've seen that show" gets found out. Anything unresolved arrives overnight in **While Riley sleeps**.

### The consequence engine
It tracks:
- emotional balance;
- family connection;
- friendships;
- confidence;
- sense of belonging;
- the stability of every island;
- which memories hold each island up.

Each night:
- Delayed consequences come due.
- Relationships nobody tended cool off.
- Running on one emotion wears Riley out.
- Unvisited memories fade, then roll into The Fading.
- Islands drift toward the life Riley is actually having.

Islands react visibly: colour drains, cracks spread, lights flicker, debris falls, and activities close when an island crumbles. Each island's heart explains in plain words what's holding it up or dragging it down.

### Memories
- **Long-Term Memory** is restyled as a sea-glass and copper tidal archive.
- Every memory is a glowing orb holding a **replayable animated scene** with a detail to look closer at.
- Watch it through any emotion's **lens**: the scene is regraded and the narration changes.
- **Choose how Riley remembers it**, which recolours the memory and has consequences. Painting a hard memory gold only helps if Sadness has looked at it first.
- Core memories keep their colour, but collect swirls from later events.
- **The Fading** is a grey dune field where forgotten memories drift. Bring them back or let them go. Losing an important one weakens its island.
- The **memory journal** tracks what you've found, each memory's current colour, how it's being kept and which island it belongs to.

### Personality islands
The cliffs now lead by light-bridge to four walkable islands. Each has its own look, animated set pieces, an activity that steadies the island once a day, and objects that tell the story of Riley's choices.

| Island | Look | Activity | Story objects |
|---|---|---|---|
| Family | Honey dusk, house and porch light | Sunday pancakes (timing) | Photo tree of family memories, mailbox notes, the family table |
| Friendship | Turquoise seaside boardwalk | Friendship bracelet (pattern memory) | Ferris wheel, messages in bottles, the bench for two, photo board |
| Hockey | Floodlit rink at night | Penalty shots (aim and timing) | Scoreboard, trophy case, team bench |
| Goofball | Bubblegum funhouse | Bounce house (charge, jump, catch) | Funhouse mirrors, rubber chicken catapult, suspicious cushion, ice-cream cart |

## Architecture

See [`docs/adr/001-architecture.md`](docs/adr/001-architecture.md) and [`docs/adr/002-consequence-engine.md`](docs/adr/002-consequence-engine.md).

```
src/engine/        loop-agnostic pieces: input, synthesized audio, camera, particles, drawing helpers
src/game/art/      procedural illustration: characters, HQ, mindscape, Riley's view
src/game/content/  data: emotions, areas, islands, memory library (scenes + lenses), dialogue
src/game/systems/  the consequence engine (pure, unit-tested) and memory lookup
src/game/art/vignette.ts  animated scenes from Riley's life: places, people, props, lenses
src/game/activities.ts    island activities
src/game/scenario/ the art club scenario, Riley's week (data) and the five ability mini-games
src/game/scenes/   Opening, HQ, Memory, Fading, Islands hub, islands/* (four walkable islands)
src/game/Game.ts   canvas, loop, scene switching and transitions
src/state/store.ts Zustand store shared by the canvas world and the React overlay
src/ui/            React overlay: dial, dialogue, console panel, map, sheets, HUD
```

The canvas renders the world. React renders only words and choices. Both talk through one Zustand store: React subscribes with selectors, and the engine reads `getState()` each frame. Adding an area for Part 2 means writing a `WorldScene` subclass and registering it in `Game.ts`. Adding a scenario means adding a data module in the shape of `scenario/artClub.ts`.

For debugging, `window.__game` and `window.__store` are exposed in the browser console.
