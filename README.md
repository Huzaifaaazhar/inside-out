# Headquarters: a game inside Riley's mind

A 2D browser game inspired by Pixar's *Inside Out*. You are the new operator of Riley's emotional Headquarters. Choose which emotion drives, use their abilities, and guide an eleven-year-old through her first day at art club.

Part 1 is the foundation: the opening sequence, an explorable Headquarters, the five emotions and a tutorial scenario. Part 2 adds a week of Riley's life. That means memories you can replay and reinterpret, forgotten memories, four walkable personality islands, five real-life scenarios, and a consequence system that remembers what you chose. Part 3 completes the mind. It adds Imagination Land, Dream Productions and the Subconscious, emotion progression, the Mind Atlas, a Day 7 turning point with five endings shaped by everything you did, original music, and full save, pause and touch support.

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
npm test           # unit tests: consequence engine, progression, endings (Vitest)
npm run test:e2e   # whole-game browser playthrough (desktop + phones); needs `npm run dev` running and Playwright with Chromium
```

Progress saves automatically in the browser. The title screen offers **Continue** or **Start over**. The pause menu can save on demand, return to the title or start a new game.

## Controls

| Input | Action |
|---|---|
| A / D or ← / → (or click the floor) | Walk |
| 1–5, or the mood dial | Switch emotion: the new one tags in where you stand |
| E (or click an object) | Interact, talk, advance dialogue |
| Q | Use the current emotion's ability on whatever is nearby |
| Space | At the console: use the ability on Riley's moment |
| M | Mind Atlas (think your way back to any place you've visited) |
| J | Journal: memories, Riley's week, emotion levels, discoveries |
| R | How Riley's doing (stats, islands, what's happened) |
| 1–5 at the mixer | Add influence to an emotion (Shift + 1–5 removes it); Enter sends it to Riley |
| H | Controls sheet |
| Esc | Pause, or close whatever is open |

Touch works too: hold the arrow pads (or tap the floor) to walk, tap objects, and use the on-screen ability and interact buttons.

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

## What's in Part 3

### Three deeper places, reached on foot
New places are found by walking there first. After that, the Mind Atlas can take you back.

| Place | How to get there | What makes it different |
|---|---|---|
| **Imagination Land** | Ride the daydream ribbon at the far end of the island cliffs | Thick ink outlines, candy colours and a sky that changes its mind. The Kaleidoscope Tower switches the land between *Daydream*, *Upside-down* and *Everything giant*, and every 40–60 seconds the land rearranges itself without asking. |
| **Dream Productions** | Cross the Gap of Nothing at the far side of Imagination Land | A studio lot at midnight with searchlights. Today's memories come down an intake tube and become tonight's dream. |
| **The Subconscious** | Take the dark stairwell at the far end of The Fading | A cave where your emotion's light is the only light. Joy carries a wide glow, Fear a small jittery one, Anger a flickering one. |

**Imagination Land** has a hidden secret for each emotion:
- Joy brings colour back to a grey meadow.
- Sadness finds Puff, a shy rain-cloud hiding behind a giant teacup.
- Anger cracks a candy crust over a cave.
- Fear scans for invisible steps up to a ledge.
- Disgust sees through the "Perfect Riley" statue.

You'll also meet Wobble, a jelly-cube architect, a trail of doodlebugs that follow you, and Nimbus the cloud-whale. **The Gap of Nothing** is a playable challenge: a fog bank swallows the path, and you build an imagined bridge by matching five silhouettes before the fog closes in.

**Dream Productions** shows how the day becomes a dream:
1. Director Lumen, a lamp-headed director, and Fizz, a stagehand made of TV static, explain the process.
2. Pick one of today's memories at the intake desk.
3. Set the mood at one of five production stations: lighting, rain machine, pyrotechnics, stunt rig or wardrobe. Each station also teaches its own emotion an insight.
4. Spin the plot-twist machine.
5. Shoot the dream on Stage 1, a three-lane cue challenge.

The result is *sweet*, *strange* or *restless*, depending on how well the shoot went and what mood you chose. It plays on the premiere screen and changes Riley's night. The night report says what she dreamed.

**The Subconscious** holds a short mission: Riley has been avoiding a memory, and it's locked behind the Closed Door. Bram and Bolt, two sleepy stone guards, explain what the door needs:
- a tear: Sadness sits with the murmuring pool;
- a named worry: Fear reads the worry jars;
- a broken chain: Anger snaps "it doesn't matter".

Along the way:
- Joy lights a dark garden.
- Disgust throws out a jar of "shoulds".
- The Hush, a soft shadow made of everything Riley didn't say, shies away from Joy until someone sits with it.
- Echo bells replay choices from earlier in the week.

Five **hidden fears** are found by bringing the right light to the right place. The door opens onto *The empty old house*, a sealed memory that then joins Long-Term Memory.

### The turning point (Day 7)
After the week, Mum's old job offers to take the family back home. The finale has four steps:
1. **The news**: a mix at the console.
2. **What Riley holds on to**: choose up to three memories. Their current colours and each emotion's reading of them become part of her answer. Memories that faded or were let go are out of reach. The memory from the Subconscious is only here if you opened the door.
3. **Who she talks to**: this depends on earlier choices. It's Dani if Riley kept in touch, Priya if she made that friendship, or nobody.
4. **The family meeting**: a bigger budget of six influence points, so every voice can be heard. One blend needs all five emotions at once.

There are five endings, scored from the whole playthrough:

| Ending | Reached by |
|---|---|
| **All of her** (balanced emotional understanding) | Sharing the work across emotions all week, hearing every voice on the final night, and no takeovers |
| **Closer** (stronger family connection) | Honesty with Mum and Dad, repairing arguments, and Sadness being heard at the meeting |
| **Both can be true** (improved self-understanding) | Opening the Closed Door, collecting insights and naming hidden fears |
| **Fine. Everything's fine.** (avoidance of difficult feelings) | Leaning on Joy, masking, and keeping Sadness and Fear quiet |
| **On her own** (emotional isolation) | Shutting people out, takeovers, and letting friendships and important memories go |

Maximum happiness does not win: an all-Joy run ends in avoidance. The ending screen gives each emotion's share of the week and what it was for. It also tracks which endings you've found and lets you replay the turning point from a snapshot.

### Game systems
- **Progression.** Every ability use, lens, mix and activity gives that emotion experience. Five levels each. Higher levels make abilities reach further and help mini-game results land. Fifteen **insights** are scattered through the three new places, one per emotion per place.
- **Journal** (J), with four tabs:
  - Memories;
  - Riley's week: each day, the memory it became, and what followed;
  - Emotions: levels, perks, insights and purpose;
  - Discoveries: hidden fears, dreams, places and endings.
- **Mind Atlas** (M). A living model of the mind drawn on canvas, with the islands, HQ tower, shelves and the deep below. Unvisited places are fogged and say how to find them.
- **Pause menu** (Esc):
  - save now, with the last-saved time;
  - music and sound-effect volume;
  - mute;
  - reduce motion;
  - save and return to the title;
  - start a new game, with confirmation.
- **Saving.** Progress saves automatically in `localStorage` on every change and is stamped on every area change. Older saves are migrated.
- **Original music.** A generative score is synthesized live, with its own track for each area, the title and the finale, and crossfades between them.
- **Touch.** Hold-to-walk pads appear on touch screens, alongside tap-to-walk and the on-screen ability and interact buttons.
- **Loading.** A boot screen holds until the fonts the canvas uses are ready.

## Architecture

See [`docs/adr/001-architecture.md`](docs/adr/001-architecture.md), [`docs/adr/002-consequence-engine.md`](docs/adr/002-consequence-engine.md) and [`docs/adr/003-complete-mind.md`](docs/adr/003-complete-mind.md).

```
src/engine/        loop-agnostic pieces: input, synthesized audio and generative music, camera, particles, drawing helpers
src/game/art/      procedural illustration: characters, HQ, mindscape, Riley's view
src/game/content/  data: emotions, areas, islands, memory library (scenes + lenses), dialogue
src/game/systems/  pure, unit-tested rules: consequences, progression, ending scoring, memory lookup
src/game/art/vignette.ts  animated scenes from Riley's life: places, people, props, lenses
src/game/activities*.ts   island activities, the bridge challenge and the dream shoot
src/game/ActivityScene.ts a walkable scene that can host a framed activity
src/game/scenario/ the art club scenario, Riley's week, the Day 7 finale and endings (data), and the five ability mini-games
src/game/scenes/   Opening, HQ, Memory, Fading, Islands hub, islands/*, Imagination, Dream Productions, Subconscious
src/game/Game.ts   canvas, loop, scene switching and transitions
src/state/store.ts Zustand store shared by the canvas world and the React overlay
src/ui/            React overlay: dial, dialogue, console panel, Mind Atlas, journal, finale and ending, sheets, HUD
```

The canvas renders the world. React renders only words and choices. Both talk through one Zustand store: React subscribes with selectors, and the engine reads `getState()` each frame. Adding an area for Part 2 means writing a `WorldScene` subclass and registering it in `Game.ts`. Adding a scenario means adding a data module in the shape of `scenario/artClub.ts`.

For debugging, `window.__game` and `window.__store` are exposed in the browser console.
