import type { EmotionId } from './emotions';

export type AreaId = 'hq' | 'memory' | 'fading' | 'islands' | 'isle-family' | 'isle-friendship' | 'isle-hockey' | 'isle-goofball';

export interface AreaDef {
  id: AreaId;
  name: string;
  blurb: string;
}

export const AREAS: Record<AreaId, AreaDef> = {
  hq: { id: 'hq', name: 'Headquarters', blurb: 'Where Riley’s feelings are steered, one choice at a time.' },
  memory: { id: 'memory', name: 'Long-Term Memory', blurb: 'A tide of shelves holding everything Riley remembers.' },
  fading: { id: 'fading', name: 'The Fading', blurb: 'Where memories go when nobody comes back for them.' },
  islands: { id: 'islands', name: 'Personality Islands', blurb: 'The parts of Riley that make her Riley. Bridges lead out to each one.' },
  'isle-family': { id: 'isle-family', name: 'Family Island', blurb: 'Porch light, pancakes and the people who know her best.' },
  'isle-friendship': { id: 'isle-friendship', name: 'Friendship Island', blurb: 'A boardwalk built one friend at a time.' },
  'isle-hockey': { id: 'isle-hockey', name: 'Hockey Island', blurb: 'Floodlights, cold air and the sound of a puck on ice.' },
  'isle-goofball': { id: 'isle-goofball', name: 'Goofball Island', blurb: 'Where Riley is allowed to be completely ridiculous.' },
};

/** Areas shown on the mind map that later parts will open. */
export const FUTURE_AREAS = [
  { id: 'daydream', name: 'Daydream Valley', blurb: 'Fog too thick to cross. For now.' },
  { id: 'undercurrent', name: 'The Undercurrent', blurb: 'Something hums down there.' },
  { id: 'station', name: 'Thought Station', blurb: 'The tracks are still being laid.' },
];

export type IslandId = 'family' | 'friendship' | 'hockey' | 'goofball' | 'honesty' | 'curiosity';

/** The four islands you can walk onto. */
export const PLAYABLE_ISLANDS: IslandId[] = ['family', 'friendship', 'hockey', 'goofball'];
export const ISLAND_AREA: Partial<Record<IslandId, AreaId>> = {
  family: 'isle-family',
  friendship: 'isle-friendship',
  hockey: 'isle-hockey',
  goofball: 'isle-goofball',
};

export interface IslandDef {
  id: IslandId;
  name: string;
  color: string;
  fuel: EmotionId[];
  about: string;
  lit: string;
  dark: string;
}

export const ISLANDS: IslandDef[] = [
  {
    id: 'family',
    name: 'Family Island',
    color: '#FFB86B',
    fuel: ['joy', 'sadness'],
    about: 'Pancake Sundays, bad puns from Dad, Mum humming in the car.',
    lit: 'Warm and steady. The porch light is always on.',
    dark: 'The porch light flickers. Somebody needs to talk to somebody.',
  },
  {
    id: 'friendship',
    name: 'Friendship Island',
    color: '#3CC6B8',
    fuel: ['joy', 'sadness', 'anger'],
    about: 'Riley moved here three weeks ago. Her old friends are a long way away.',
    lit: 'The Ferris wheel is turning again. Someone new is on it with her.',
    dark: 'Dark since the move. It needs a new core memory to start turning again.',
  },
  {
    id: 'hockey',
    name: 'Hockey Island',
    color: '#7FC8FF',
    fuel: ['anger', 'joy', 'fear'],
    about: 'Every Saturday since she was six. Cold toes, loud bench, best feeling in the world.',
    lit: 'Floodlights on, ice smooth, the crowd stamping their feet.',
    dark: 'The floodlights buzz and the ice has cracks in it.',
  },
  {
    id: 'goofball',
    name: 'Goofball Island',
    color: '#FF7FB0',
    fuel: ['joy', 'disgust'],
    about: 'Funny faces, terrible accents, and the dance she only does in the kitchen.',
    lit: 'The bouncy tent never stops wobbling.',
    dark: 'The tent sags. Nobody’s been silly in a while.',
  },
  {
    id: 'honesty',
    name: 'Honesty Island',
    color: '#9AD4FF',
    fuel: ['anger', 'disgust'],
    about: 'The lighthouse that says the true thing, even when it’s awkward.',
    lit: 'The beam sweeps steady across the dark.',
    dark: 'The beam stutters.',
  },
  {
    id: 'curiosity',
    name: 'Curiosity Island',
    color: '#C79BFF',
    fuel: ['fear', 'joy'],
    about: 'An observatory full of “but why?” Riley’s favourite question.',
    lit: 'The telescope is pointed at something new every night.',
    dark: 'The telescope is pointed at the floor.',
  },
];

export interface MemoryDef {
  id: string;
  title: string;
  emotion: EmotionId;
  text: string;
  /** Revealed by Sadness's Understand ability. */
  hidden: string;
  faded?: boolean;
  core?: boolean;
  swirl?: EmotionId[];
}

/** Core memories Riley already has. They power the islands that are already lit. */
export const STARTING_CORE: MemoryDef[] = [
  { id: 'core-family', title: 'Pancake tower', emotion: 'joy', text: 'Eleven pancakes high on her birthday.', hidden: '', core: true },
  { id: 'core-honesty', title: 'The broken vase', emotion: 'sadness', text: 'She told Mum it was her. Mum hugged her anyway.', hidden: '', core: true },
  { id: 'core-curiosity', title: 'Ants in the garden', emotion: 'fear', text: 'An hour on her stomach watching a whole city.', hidden: '', core: true },
  { id: 'core-goofball', title: 'Spaghetti moustache', emotion: 'disgust', text: 'Dad laughed milk out of his nose.', hidden: '', core: true },
  { id: 'core-hockey', title: 'First goal', emotion: 'joy', text: 'Age seven, top corner, the whole bench jumping.', hidden: '', core: true },
];

export const CORE_ISLAND_LINK: Record<string, IslandId> = {
  'core-family': 'family',
  'core-honesty': 'honesty',
  'core-curiosity': 'curiosity',
  'core-goofball': 'goofball',
  'core-hockey': 'hockey',
  'core-artclub': 'friendship',
};
