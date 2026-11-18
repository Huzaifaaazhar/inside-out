import type { VignetteScript } from '../art/vignette';
import type { EmotionId } from '../content/emotions';
import type { IslandId } from '../content/world';
import type { Deltas, LeadDef } from '../systems/mind';
import type { Line } from './artClub';
import type { Flags, MomentDef } from './scenarios';
import type { Flavor } from './minigames';

const L = (speaker: Line['speaker'], text: string): Line => ({ speaker, text });
const lead = (lines: Line[], deltas?: Deltas, extra: Partial<LeadDef> = {}): LeadDef => ({ lines, deltas, ...extra });
const fx = (o: Partial<Record<'balance' | 'family' | 'friendship' | 'confidence' | 'belonging', number>>, islands?: Partial<Record<IslandId, number>>): Deltas => ({ stats: o, islands });
const flavor = (fear: [string, string, string], disgust: [string, boolean][], anger: string, sadness: string, joy: [string, string][]): Flavor => ({
  fear: { hazards: [{ x: 0.25, y: 0.55, label: fear[0] }, { x: 0.55, y: 0.4, label: fear[1] }, { x: 0.8, y: 0.7, label: fear[2] }] },
  disgust: { items: disgust.map(([label, bad]) => ({ label, bad })) },
  anger: { line: anger },
  sadness: { thought: sadness },
  joy: { clouds: joy.map(([gloom, bright]) => ({ gloom, bright })) },
});

export const FINALE_DAY = 7;

export const FINALE_INTRO: VignetteScript = {
  kit: 'kitchen',
  dur: 13,
  night: true,
  actors: [
    { who: 'mum', keys: [[0, 0.3, 'sit', 1, 'calm'], [5, 0.3, 'sit', 1, 'sad']] },
    { who: 'dad', keys: [[0, 0.82, 'sit', -1, 'calm']] },
    { who: 'riley', keys: [[0, 0.08, 'walk', 1, 'happy'], [3, 0.56, 'sit', -1, 'happy'], [8, 0.56, 'sit', -1, 'shock']] },
  ],
  props: [{ what: 'note', keys: [[0, 0.44, 0.62, 1.4]] }],
  captions: [
    { t: 0, text: 'Seven weeks in the new city. A Sunday dinner.' },
    { t: 4, text: '“Riley, love. My old work called. They want me back.”' },
    { t: 8, text: '“We could move home in the summer. If we all want to.”' },
  ],
};

/** Phase one: the news. */
export const FINALE_NEWS: MomentDef = {
  id: 'fin-news',
  title: 'The news',
  prompt: 'Mum and Dad say the family could move back home. They want to know what Riley thinks.',
  situation: () => [
    L('dad', 'Nothing’s decided. We’re asking you first this time.'),
    L('joy', 'Home! Snow! Dani!'),
    L('fear', 'But we JUST learned where the toilets are at school.'),
    L('sadness', 'And Priya. And the cloud cat.'),
    L('anger', 'NOW they ask us?'),
    L('disgust', 'Everybody calm down. This is a big one.'),
  ],
  screen: {
    kit: 'kitchen',
    dur: 6,
    night: true,
    actors: [
      { who: 'mum', keys: [[0, 0.3, 'sit', 1, 'calm']] },
      { who: 'riley', keys: [[0, 0.56, 'sit', -1, 'shock']] },
      { who: 'dad', keys: [[0, 0.82, 'sit', -1, 'calm']] },
    ],
  },
  effects: {
    joy: fx({ family: 1, balance: -1 }),
    sadness: fx({ family: 2 }),
    anger: fx({ confidence: 1, family: -1 }),
    fear: fx({ confidence: -1 }),
    disgust: fx({ confidence: 1 }),
  },
  lead: {
    joy: lead([L('riley', 'YES. Let’s go home! Right? That’s good? It’s good.'), L('mum', 'You don’t have to decide tonight, love.')], fx({ balance: -2 }), { flags: ['finJumped'] }),
    sadness: lead([L('riley', 'I don’t know. I miss home. But I think I’d miss here now too.'), L('dad', 'That’s... a really grown-up answer.')], fx({ family: 4 }), { flags: ['finHonest'] }),
    anger: lead([L('riley', 'So you moved me, and now you might move me AGAIN?'), L('mum', 'I know. That’s why we’re asking.')], fx({ confidence: 2, family: -2 })),
    fear: lead([L('riley', 'What if we go back and it’s different there too?'), L('dad', 'It might be. That’s a real worry.')], fx({ family: 2 })),
    disgust: lead([L('riley', 'Can I think about it without everyone staring at me?'), L('mum', 'Of course. Sorry.')], fx({ confidence: 2 })),
  },
  blends: [
    {
      id: 'fin-both',
      when: { sadness: 1, joy: 1 },
      lines: [L('riley', 'Part of me is jumping up and down. Part of me feels sick. Both parts are me.'), L('mum', 'Then we’ll listen to both parts.')],
      deltas: fx({ family: 5, balance: 2 }),
      flags: ['finHonest'],
    },
    {
      id: 'fin-fair',
      when: { anger: 1, fear: 1 },
      lines: [L('riley', 'I’m scared AND it feels unfair that it keeps changing. I need a real say this time.'), L('dad', 'You’ve got one. A real one.')],
      deltas: fx({ family: 4, confidence: 3 }),
      flags: ['finHonest'],
    },
  ],
  overload: {
    joy: lead([L('riley', 'Home home home! I’ll start packing!'), L('narrator', '(Nobody mentions Priya. Riley doesn’t either.)')], fx({ balance: -3 }), { flags: ['finJumped'] }),
    anger: lead([L('riley', 'You never ask me ANYTHING until it’s already happening!'), L('narrator', '(She leaves the table.)')], fx({ family: -5 }), { flags: ['finStormed'] }),
  },
  game: flavor(
    ['Mum’s hopeful face', 'Dad’s careful voice', 'The whole future'],
    [['Pretend you don’t care', true], ['Say it’s complicated', false], ['Storm off', true], ['Ask for time', false]],
    'You never ask me until it’s already happening!',
    'Mum is scared of making the wrong choice twice.',
    [['Moving again', 'A real choice'], ['Torn', 'Both matter'], ['Scary', 'Asked first']],
  ),
};

/** Phase three: someone to talk to. Who's there depends on earlier choices. */
export const FINALE_TALK = (f: Flags): MomentDef => {
  const who: 'dani' | 'priya' | 'nobody' = f.keptInTouch && !f.daniHurt ? 'dani' : f.priyaTable || f.invitedPriya || f.priyaPlan || f.sleepover ? 'priya' : 'nobody';
  const friend = who === 'dani' ? 'Dani' : 'Priya';
  return {
    id: 'fin-talk',
    title: who === 'nobody' ? 'Alone with it' : `Talking to ${friend}`,
    prompt: who === 'nobody' ? 'Riley sits on her bed. There’s nobody she feels she can call.' : `${friend} answers on the first ring.`,
    situation: () =>
      who === 'dani'
        ? [L('dani', 'Wait, you might come BACK? Riley! That’s huge!'), L('dani', 'But, um. You sound weird. Are you okay?')]
        : who === 'priya'
          ? [L('priya', 'You might move away? But we were going to do the mural extension!'), L('priya', 'Sorry. That’s about me. How are YOU?')]
          : [L('narrator', '(Riley scrolls through her contacts and doesn’t press anything.)'), L('sadness', 'I wish we’d kept in touch with someone.')],
    screen:
      who === 'nobody'
        ? { kit: 'bedroom', dur: 6, night: true, actors: [{ who: 'riley', keys: [[0, 0.74, 'sit', -1, 'sad']] }] }
        : { kit: 'phone', dur: 6, actors: [{ who: 'riley', keys: [[0, 0.26, 'phone', 1, 'calm']] }, { who: who === 'dani' ? 'dani' : 'priya', keys: [[0, 0.74, 'wave', -1, 'happy']] }] },
    effects: {
      joy: fx({ friendship: 1 }),
      sadness: fx({ friendship: who === 'nobody' ? 0 : 2, confidence: who === 'nobody' ? -1 : 0 }),
      anger: fx({ friendship: -1 }),
      fear: fx({ confidence: -1 }),
      disgust: fx({ friendship: -1, confidence: 1 }),
    },
    lead: {
      joy: lead(who === 'nobody' ? [L('riley', '(She tells herself it’s fine. It’s all fine.)')] : [L('riley', 'It’s exciting! Probably! Anyway, how was your day?')], fx({ balance: -2 }), { flags: ['finMasked'] }),
      sadness: lead(
        who === 'nobody' ? [L('narrator', '(Riley cries a little. Then she texts Mum, who’s downstairs: “can you come up?”)'), L('mum', 'I’m here.')] : [L('riley', 'I’m not okay. I don’t know what I want.'), L(who === 'dani' ? 'dani' : 'priya', 'You don’t have to know yet. I’m here either way.')],
        who === 'nobody' ? fx({ family: 5 }) : fx({ friendship: 6 }),
        { flags: ['finReached'] },
      ),
      anger: lead(who === 'nobody' ? [L('riley', '(She throws her pillow at the wall. It doesn’t help much.)')] : [L('riley', 'Why does everyone keep moving me around like a chess piece?'), L(who === 'dani' ? 'dani' : 'priya', 'That sounds really frustrating.')], fx({ confidence: 2 })),
      fear: lead(who === 'nobody' ? [L('riley', '(She lies awake making lists of what could go wrong either way.)')] : [L('riley', 'What if I choose wrong and everyone’s stuck with it?'), L(who === 'dani' ? 'dani' : 'priya', 'Then you figure it out together. That’s what families do.')], fx({ confidence: -1 })),
      disgust: lead(who === 'nobody' ? [L('riley', '(She decides she doesn’t need anyone. Which is not true.)')] : [L('riley', 'Can we talk about literally anything else?'), L(who === 'dani' ? 'dani' : 'priya', '...Sure. Okay.')], fx({ friendship: -2 }), { flags: who === 'nobody' ? ['finWalled'] : [] }),
    },
    blends: [
      {
        id: 'fin-heard',
        when: { sadness: 1, fear: 1 },
        lines:
          who === 'nobody'
            ? [L('riley', '(She opens her door.) Mum? Can we talk? I’m scared.'), L('mum', 'Always.')]
            : [L('riley', 'I’m scared of losing you if I stay, and losing here if I go.'), L(who === 'dani' ? 'dani' : 'priya', 'You won’t lose me. Promise. Ask me again in ten years.')],
        deltas: who === 'nobody' ? fx({ family: 7, balance: 2 }) : fx({ friendship: 7, balance: 2 }),
        flags: ['finReached'],
      },
      {
        id: 'fin-laugh',
        when: { joy: 1, sadness: 1 },
        lines: [L('riley', who === 'nobody' ? '(She looks at the cloud cat drawing on her wall and laughs, then cries, then laughs again.)' : 'This is the worst. Tell me something stupid so I can laugh?'), L(who === 'dani' ? 'dani' : who === 'priya' ? 'priya' : 'narrator', who === 'nobody' ? '(It helps.)' : 'Theo ate a crayon today. A whole one.')],
        deltas: fx({ balance: 3, friendship: who === 'nobody' ? 0 : 4 }),
        flags: ['finReached'],
      },
    ],
    overload: {
      disgust: lead([L('narrator', '(Riley shuts everyone out. Her phone stays face down all night.)')], fx({ friendship: -4 }), { flags: ['finWalled'] }),
      joy: lead([L('riley', 'Everything is GREAT. Seriously. Bye!')], fx({ balance: -3 }), { flags: ['finMasked'] }),
    },
    game: flavor(
      ['The silence', 'The decision', 'Saying too much'],
      [['Say everything’s fine', true], ['Say you’re scared', false], ['Shut them out', true], ['Ask them to listen', false]],
      'Why does everyone keep moving me around?',
      'She doesn’t want to lose anyone.',
      [['Torn', 'Cared about'], ['Lost', 'Not alone'], ['Stuck', 'Thinking']],
    ),
  };
};

/** Phase four: the family meeting. A bigger budget: every voice can be heard. */
export const FINALE_MEETING: MomentDef = {
  id: 'fin-meeting',
  title: 'The family meeting',
  prompt: 'Next morning. Mum, Dad, Riley and three cups of hot chocolate. Riley gets to say what she really feels.',
  situation: (f) => [
    L('mum', 'Okay. No wrong answers. Tell us everything, the messy bits too.'),
    ...(f.repaired || f.toldParentsTruth ? [L('dad', 'You’ve been really honest with us lately. It’s helped.')] : []),
    ...(f.slammedDoor && !f.repaired ? [L('fear', 'Last time we talked like this, a door got slammed.')] : []),
  ],
  screen: {
    kit: 'livingroom',
    dur: 6,
    actors: [
      { who: 'mum', keys: [[0, 0.22, 'sit', 1, 'calm']] },
      { who: 'riley', keys: [[0, 0.5, 'stand', 1, 'calm']] },
      { who: 'dad', keys: [[0, 0.78, 'sit', -1, 'calm']] },
    ],
  },
  effects: {
    joy: fx({ family: 1, confidence: 1 }),
    sadness: fx({ family: 2 }),
    anger: fx({ confidence: 2 }),
    fear: fx({ family: 1 }),
    disgust: fx({ confidence: 1, belonging: 1 }),
  },
  lead: {
    joy: lead([L('riley', 'Honestly? I think it’d be fun either way!'), L('mum', 'Okay... but what do you WANT, love?')], fx({ balance: -1 })),
    sadness: lead([L('riley', 'I miss home every day. But I’d miss Priya and art club and the rink now too.'), L('dad', 'Thank you. That’s exactly what we needed to hear.')], fx({ family: 5 })),
    anger: lead([L('riley', 'I want a real vote. Not “we’ve decided, how do you feel”.'), L('mum', 'You’ve got one. That’s fair.')], fx({ confidence: 4, family: 1 })),
    fear: lead([L('riley', 'Can we not rush it? Can we try staying till summer and then decide?'), L('dad', 'That’s sensible. Very sensible.')], fx({ family: 3 })),
    disgust: lead([L('riley', 'I’m not the girl who moves every year. I want to choose where I belong.'), L('mum', 'Then help us choose.')], fx({ confidence: 4, belonging: 2 })),
  },
  blends: [
    {
      id: 'fin-everyone',
      when: { joy: 1, sadness: 1, anger: 1, fear: 1, disgust: 1 },
      lines: [
        L('riley', 'Okay. All of it. I’m excited about home. I’m sad about leaving here. I’m a bit mad it keeps changing. I’m scared of choosing wrong. And I know who I am in both places.'),
        L('mum', '...Wow.'),
        L('dad', 'That might be the bravest thing anyone’s said at this table.'),
      ],
      deltas: fx({ family: 8, balance: 6, confidence: 4 }),
      flags: ['finAllVoices'],
    },
    {
      id: 'fin-heart',
      when: { sadness: 2, joy: 1 },
      lines: [L('riley', 'I love home. I’m starting to love here. I don’t want to lose either. Can we find a way to keep both?'), L('mum', 'Summers back home. Weekends here. Let’s make it work.')],
      deltas: fx({ family: 8, balance: 3 }),
    },
    {
      id: 'fin-voice',
      when: { anger: 1, sadness: 1, disgust: 1 },
      lines: [L('riley', 'It hurt being moved without a say. I want to stay, and I want you to really hear why.'), L('dad', 'We hear you. We’re sorry we didn’t ask the first time.')],
      deltas: fx({ family: 6, confidence: 5 }),
    },
  ],
  overload: {
    joy: lead([L('riley', 'Whatever you guys want! Seriously! I’m fine with anything!'), L('narrator', '(Mum and Dad look at each other. They don’t believe her.)')], fx({ family: -3, balance: -3 }), { flags: ['finMasked'] }),
    anger: lead([L('riley', 'It doesn’t matter what I say anyway!'), L('narrator', '(The meeting ends early.)')], fx({ family: -6 }), { flags: ['finStormed'] }),
    fear: lead([L('riley', 'I don’t know. I can’t. You decide.'), L('narrator', '(She stares at her hot chocolate until it goes cold.)')], fx({ confidence: -4 })),
    sadness: lead([L('narrator', '(Riley cries and can’t find the words. Mum holds her hand.)')], fx({ family: 3, confidence: -2 })),
    disgust: lead([L('riley', 'This whole conversation is pointless.'), L('narrator', '(Nobody finishes their hot chocolate.)')], fx({ family: -4 }), { flags: ['finWalled'] }),
  },
  game: flavor(
    ['The words that matter', 'Leaving something out', 'Saying too much'],
    [['Say “whatever you want”', true], ['Say what you’d miss', false], ['Refuse to talk', true], ['Ask for a real vote', false]],
    'I want a real vote this time!',
    'She’s afraid her feelings will make it harder for everyone.',
    [['Torn in two', 'Room for both'], ['Moving again', 'Our choice'], ['Too much', 'Honest']],
  ),
};

export const FINALE_MEETING_BUDGET = 6;

// ───────────────────────────── endings ─────────────────────────────

export type EndingId = 'balanced' | 'family' | 'self' | 'avoidance' | 'isolation';

export interface EndingDef {
  id: EndingId;
  title: string;
  /** One sentence that names what happened, in plain words. */
  summary: string;
  epilogue: Line[];
  decision: string;
  scene: VignetteScript;
}

export const ENDINGS: Record<EndingId, EndingDef> = {
  balanced: {
    id: 'balanced',
    title: 'All of her',
    summary: 'Riley let every feeling have its say, and together they helped her understand what she really wanted.',
    decision: 'The family stays, with summers back home. Riley helped make the plan.',
    epilogue: [
      L('joy', 'We did it. All of us. At the same time.'),
      L('sadness', 'Nobody had to be quiet so somebody else could be loud.'),
      L('anger', 'She got a real say. That’s all I ever wanted.'),
      L('fear', 'And we thought it through. Carefully. Very carefully.'),
      L('disgust', 'And she knows who she is. In both places.'),
    ],
    scene: {
      kit: 'park',
      dur: 10,
      fx: 'sparkle',
      actors: [
        { who: 'mum', keys: [[0, 0.2, 'walk', 1, 'happy'], [5, 0.35, 'stand', 1, 'happy']] },
        { who: 'riley', keys: [[0, 0.35, 'walk', 1, 'happy'], [5, 0.5, 'cheer', 1, 'happy']] },
        { who: 'dad', keys: [[0, 0.5, 'walk', 1, 'happy'], [5, 0.65, 'wave', 1, 'happy']] },
        { who: 'priya', keys: [[0, 0.95, 'wave', -1, 'happy']] },
      ],
      captions: [{ t: 0, text: 'Seven weeks in. A new city that’s starting to feel like hers.' }],
    },
  },
  family: {
    id: 'family',
    title: 'Closer',
    summary: 'Riley told her parents the truth, the hard parts included, and the three of them came out of it closer.',
    decision: 'They decide together to stay through summer and choose again as a family.',
    epilogue: [
      L('sadness', 'She let them see how hard it’s been. They didn’t look away.'),
      L('joy', 'Pancake Sundays are back on. In the new kitchen.'),
      L('fear', 'Every big decision now goes to a family meeting. With snacks.'),
    ],
    scene: {
      kit: 'kitchen',
      dur: 9,
      actors: [
        { who: 'dad', keys: [[0, 0.3, 'hold', 1, 'happy']] },
        { who: 'riley', keys: [[0, 0.52, 'hug', -1, 'happy']] },
        { who: 'mum', keys: [[0, 0.62, 'hug', -1, 'happy']] },
      ],
      props: [{ what: 'pancakes', n: 7, keys: [[0, 0.4, 0.66, 1.3]] }],
      captions: [{ t: 0, text: 'The first pancake Sunday in the new house.' }],
    },
  },
  self: {
    id: 'self',
    title: 'Both can be true',
    summary: 'Riley faced the feeling she’d been avoiding, and found she could miss home and belong here at the same time.',
    decision: 'Riley asks for time to decide. Her parents give it to her, gladly.',
    epilogue: [
      L('sadness', 'Missing home doesn’t mean she can’t like it here.'),
      L('fear', 'Naming the scary thing made it smaller. Good to know.'),
      L('disgust', 'She knows what’s hers. That’s style, that is.'),
      L('anger', 'And nobody gets to decide that for her.'),
    ],
    scene: {
      kit: 'bedroom',
      dur: 9,
      actors: [{ who: 'riley', keys: [[0, 0.3, 'walk', 1, 'calm'], [4, 0.5, 'hold', 1, 'happy']] }],
      props: [
        { what: 'photo', keys: [[0, 0.62, 0.5, 1.6]] },
        { what: 'tshirt', keys: [[0, 0.78, 0.5, 1.2]] },
      ],
      captions: [{ t: 0, text: 'The old team photo goes up next to the cloud cat.' }],
    },
  },
  avoidance: {
    id: 'avoidance',
    title: 'Fine. Everything’s fine.',
    summary: 'Riley kept smiling and pushed the hard feelings down. The decision got made around her, and the feelings are still waiting.',
    decision: 'Her parents choose for her. Riley says she’s fine with it. She isn’t sure she is.',
    epilogue: [
      L('joy', 'I kept her happy. That was the job. ...Wasn’t it?'),
      L('sadness', 'I never got a turn. The feelings didn’t go away. They’re just quieter.'),
      L('joy', 'Next time, Sadness drives for a bit. I mean it.'),
    ],
    scene: {
      kit: 'bedroom',
      dur: 9,
      night: true,
      actors: [{ who: 'riley', keys: [[0, 0.7, 'sit', -1, 'calm']] }],
      props: [{ what: 'box', keys: [[0, 0.3, 0.86, 1.2]] }],
      captions: [{ t: 0, text: '“I’m fine.” She says it to the ceiling, three times.' }],
    },
  },
  isolation: {
    id: 'isolation',
    title: 'On her own',
    summary: 'Riley shut people out when it mattered most. Nobody stopped caring, but she felt alone with it all.',
    decision: 'The decision is put on hold. Riley spends the week in her room.',
    epilogue: [
      L('anger', 'Turns out pushing everyone away is easy. Getting them back is the hard bit.'),
      L('disgust', 'We were so busy guarding the door, we forgot to open it.'),
      L('sadness', 'Tomorrow, let’s text Priya. Or Dani. Or knock on Mum’s door. Someone.'),
    ],
    scene: {
      kit: 'bedroom',
      dur: 9,
      night: true,
      fx: 'rain',
      actors: [{ who: 'riley', keys: [[0, 0.74, 'slump', -1, 'sad']] }],
      captions: [{ t: 0, text: 'Her phone buzzes twice. She doesn’t look.' }],
    },
  },
};

export const ENDING_ORDER: EndingId[] = ['balanced', 'family', 'self', 'avoidance', 'isolation'];

export const PURPOSE_LINE: Record<EmotionId, string> = {
  joy: 'Joy kept hope alive.',
  sadness: 'Sadness made room for honesty and comfort.',
  anger: 'Anger made sure Riley got a fair say.',
  fear: 'Fear made her think it through.',
  disgust: 'Disgust protected who she is.',
};
