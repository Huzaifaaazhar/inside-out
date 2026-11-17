import type { EmotionId } from './emotions';

export type AreaId = 'hq' | 'memory' | 'islands';

export interface AreaDef {
  id: AreaId;
  name: string;
  blurb: string;
}

export const AREAS: Record<AreaId, AreaDef> = {
  hq: { id: 'hq', name: 'Headquarters', blurb: 'Where Riley’s feelings are steered, one choice at a time.' },
  memory: { id: 'memory', name: 'Long-Term Memory', blurb: 'Endless shelves of everything Riley remembers.' },
  islands: { id: 'islands', name: 'Personality Islands', blurb: 'The parts of Riley that make her Riley, powered by core memories.' },
};

/** Areas shown on the mind map that later parts will open. */
export const FUTURE_AREAS = [
  { id: 'daydream', name: 'Daydream Valley', blurb: 'Fog too thick to cross. For now.' },
  { id: 'undercurrent', name: 'The Undercurrent', blurb: 'Something hums down there.' },
  { id: 'station', name: 'Thought Station', blurb: 'The tracks are still being laid.' },
];

export type IslandId = 'family' | 'friendship' | 'honesty' | 'curiosity' | 'silliness';

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
    dark: '',
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
    id: 'honesty',
    name: 'Honesty Island',
    color: '#9AD4FF',
    fuel: ['anger', 'disgust'],
    about: 'The lighthouse that says the true thing, even when it’s awkward.',
    lit: 'The beam sweeps steady across the dark.',
    dark: '',
  },
  {
    id: 'curiosity',
    name: 'Curiosity Island',
    color: '#C79BFF',
    fuel: ['fear', 'joy'],
    about: 'An observatory full of “but why?” Riley’s favourite question.',
    lit: 'The telescope is pointed at something new every night.',
    dark: '',
  },
  {
    id: 'silliness',
    name: 'Silliness Island',
    color: '#FF7FB0',
    fuel: ['joy', 'disgust'],
    about: 'Funny faces, accents, and the dance she only does in the kitchen.',
    lit: 'The bouncy tent never stops wobbling.',
    dark: '',
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

/** Riley's long-term memories on the near shelf in Memory Storage. */
export const LONG_TERM_MEMORIES: MemoryDef[] = [
  { id: 'bike', title: 'First ride without training wheels', emotion: 'joy', text: 'Dad let go and she didn’t notice for half the street.', hidden: 'She did notice. She kept going anyway.' },
  { id: 'storm', title: 'The big thunderstorm', emotion: 'fear', text: 'The lights went out and the whole house shook.', hidden: 'Mum’s hand was there before she even reached for it.' },
  { id: 'olives', title: 'First olive', emotion: 'disgust', text: 'Spat it into a napkin at Aunt Rosa’s. Never again.', hidden: 'Secretly, she tried another one last summer. Still no.' },
  { id: 'sandbox', title: 'The shovel incident', emotion: 'anger', text: 'Marco took her red shovel. She took it back. Loudly.', hidden: 'She gave it to him the next day. He needed one more.' },
  { id: 'goodbye', title: 'Last day at the old school', emotion: 'sadness', text: 'Everyone signed her T-shirt. She hasn’t washed it.', hidden: 'Missing them means they mattered.' },
  { id: 'snowfort', title: 'Snow day fort', emotion: 'joy', text: 'Three rooms, a tunnel, and a door made of a sledge.', hidden: 'It melted by Tuesday. She was fine with that.' },
  { id: 'dentist', title: 'Dentist drill noise', emotion: 'fear', text: 'Brrrrzzzz. Even remembering it is too much.', hidden: 'It was over in four minutes. She got a sticker.' },
  { id: 'spelling', title: 'Lost the spelling bee', emotion: 'sadness', text: '“Necessary.” One C, two S’s. She knows that now.', hidden: 'She cried in the car and then they got ice cream.' },
  { id: 'unfair', title: 'Benched for nothing', emotion: 'anger', text: 'The coach thought she tripped Jess. She didn’t.', hidden: 'Jess told the coach the truth at half time.' },
  { id: 'sprouts', title: 'Grandma’s sprouts', emotion: 'disgust', text: 'Boiled for an hour. The smell lived in the curtains.', hidden: 'Grandma laughed about them too. That part was nice.' },
  { id: 'kitchen', title: 'Kitchen dance party', emotion: 'joy', text: 'Wooden spoon microphone, socks on the tiles.', hidden: 'Mum was laughing so hard she had to sit down.' },
  { id: 'lostdog', title: 'Biscuit ran off', emotion: 'fear', text: 'Gone for an hour. The longest hour ever.', hidden: 'He was at the neighbour’s, eating their biscuits.', faded: true },
  { id: 'phone', title: 'Phone number of the old house', emotion: 'sadness', text: 'She can’t quite remember the last two digits.', hidden: 'It’s okay that some things fade.', faded: true },
  { id: 'jingle', title: 'Toothpaste advert song', emotion: 'disgust', text: 'Still stuck in there somewhere. Why.', hidden: 'She sings it when she’s nervous.', faded: true },
];

/** Core memories Riley already has. They power the islands that are already lit. */
export const STARTING_CORE: MemoryDef[] = [
  { id: 'core-family', title: 'Pancake tower', emotion: 'joy', text: 'Eleven pancakes high on her birthday.', hidden: '', core: true },
  { id: 'core-honesty', title: 'The broken vase', emotion: 'sadness', text: 'She told Mum it was her. Mum hugged her anyway.', hidden: '', core: true },
  { id: 'core-curiosity', title: 'Ants in the garden', emotion: 'fear', text: 'An hour on her stomach watching a whole city.', hidden: '', core: true },
  { id: 'core-silliness', title: 'Spaghetti moustache', emotion: 'disgust', text: 'Dad laughed milk out of his nose.', hidden: '', core: true },
];

export const CORE_ISLAND_LINK: Record<string, IslandId> = {
  'core-family': 'family',
  'core-honesty': 'honesty',
  'core-curiosity': 'curiosity',
  'core-silliness': 'silliness',
  'core-artclub': 'friendship',
};
