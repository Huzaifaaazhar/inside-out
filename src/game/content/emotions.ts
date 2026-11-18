export type EmotionId = 'joy' | 'sadness' | 'anger' | 'fear' | 'disgust';

export const EMOTION_ORDER: EmotionId[] = ['joy', 'sadness', 'anger', 'fear', 'disgust'];

export interface EmotionDef {
  id: EmotionId;
  name: string;
  color: string;
  light: string;
  dark: string;
  /** What this emotion is for, in one line. */
  role: string;
  ability: { name: string; verb: string; description: string };
  /** Walking speed in world px/s. Personality shows in how they move. */
  speed: number;
  /** Shown on the mood dial and used in the help sheet. */
  key: string;
  /** Spoken when they take control. */
  tagIn: string[];
  /** Said when their field ability finds nothing to act on. */
  abilityIdle: string[];
}

export const EMOTIONS: Record<EmotionId, EmotionDef> = {
  joy: {
    id: 'joy',
    name: 'Joy',
    color: '#FFCF33',
    light: '#FFF1B0',
    dark: '#C98A00',
    role: 'Optimism. Finds the bright side of whatever happens.',
    ability: {
      name: 'Bright Side',
      verb: 'Brighten',
      description: 'Turn a gloomy thought golden. Faded things light up again.',
    },
    speed: 330,
    key: '1',
    tagIn: ["My turn! Let's make today sparkle.", 'Ooh, ooh, I have ideas!', 'Hello, console, my old friend!'],
    abilityIdle: ['Sparkles! Nothing gloomy here though.', 'Everything here is already pretty great.'],
  },
  sadness: {
    id: 'sadness',
    name: 'Sadness',
    color: '#3D7BFF',
    light: '#BBD2FF',
    dark: '#1E3E9C',
    role: 'Empathy. Understands what someone is really feeling.',
    ability: {
      name: 'Understand',
      verb: 'Listen',
      description: 'Slow down and listen. Reveals the feeling hiding underneath.',
    },
    speed: 150,
    key: '2',
    tagIn: ['Oh. Okay. I can try.', "I'll be gentle with it.", "I think someone needs listening to."],
    abilityIdle: ["Nobody's hiding a feeling here. I checked.", "It's quiet. That's okay too."],
  },
  anger: {
    id: 'anger',
    name: 'Anger',
    color: '#F0412D',
    light: '#FFB4A6',
    dark: '#8F1A10',
    role: 'Standing up. Pushes back when something is unfair.',
    ability: {
      name: 'Stand Up',
      verb: 'Stomp',
      description: 'Push back hard. Breaks through things that are stuck.',
    },
    speed: 250,
    key: '3',
    tagIn: ['Finally. Somebody with a spine.', 'Step aside. I got this.', 'Who touched my chair?'],
    abilityIdle: ['Nothing to push around here. Shame.', "I'm not mad. I'm just... warming up."],
  },
  fear: {
    id: 'fear',
    name: 'Fear',
    color: '#A05CF0',
    light: '#DDC4FF',
    dark: '#55259C',
    role: 'Caution. Spots risks before they become problems.',
    ability: {
      name: 'Scan',
      verb: 'Scan',
      description: 'Sweep the area for hazards. Hidden dangers get marked.',
    },
    speed: 300,
    key: '4',
    tagIn: ['Okay okay okay. Safety first.', "I've prepared a list of everything that could go wrong.", 'Is it hot in here? It feels risky.'],
    abilityIdle: ['All clear. Suspiciously clear.', 'No hazards. Which is exactly what a hazard would want me to think.'],
  },
  disgust: {
    id: 'disgust',
    name: 'Disgust',
    color: '#52C46B',
    light: '#C2F0CC',
    dark: '#1F7A35',
    role: 'Boundaries. Says no to what is not okay.',
    ability: {
      name: 'Nope',
      verb: 'Reject',
      description: 'Flick away anything that crosses a line. Keeps Riley in her lane.',
    },
    speed: 270,
    key: '5',
    tagIn: ["Fine. I'll do it properly.", 'Move. You have no taste.', 'Let me handle this with some style.'],
    abilityIdle: ["There's nothing here worth rejecting. Rare.", 'Ugh. Not even anything gross. Boring.'],
  },
};

export type SpeakerId = EmotionId | 'riley' | 'mote' | 'priya' | 'theo' | 'teacher' | 'narrator' | 'console' | 'mum' | 'dad' | 'dani' | 'coach' | 'kidA' | 'kidB' | 'kidC' | 'wisp';

export const SPEAKERS: Record<SpeakerId, { name: string; color: string }> = {
  joy: { name: 'Joy', color: EMOTIONS.joy.color },
  sadness: { name: 'Sadness', color: EMOTIONS.sadness.color },
  anger: { name: 'Anger', color: EMOTIONS.anger.color },
  fear: { name: 'Fear', color: EMOTIONS.fear.color },
  disgust: { name: 'Disgust', color: EMOTIONS.disgust.color },
  riley: { name: 'Riley', color: '#FF9F6B' },
  mote: { name: 'Mote', color: '#F7B8D8' },
  priya: { name: 'Priya', color: '#3CC6B8' },
  theo: { name: 'Theo', color: '#FF8A3D' },
  teacher: { name: 'Ms. Okafor', color: '#E9D27A' },
  narrator: { name: '', color: '#B9A7F5' },
  console: { name: 'Console', color: '#E7B76A' },
  mum: { name: 'Mum', color: '#4FA98A' },
  dad: { name: 'Dad', color: '#3D6FB6' },
  dani: { name: 'Dani', color: '#9B6BDB' },
  coach: { name: 'Coach Ruiz', color: '#E63946' },
  kidA: { name: 'Maya', color: '#F7B32B' },
  kidB: { name: 'Jade', color: '#E8516A' },
  kidC: { name: 'Sam', color: '#52C46B' },
  wisp: { name: 'Wisp', color: '#C8C2D6' },
};
