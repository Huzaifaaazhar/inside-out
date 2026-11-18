import type { VignetteScript } from '../art/vignette';
import type { EmotionId } from '../content/emotions';
import type { MemoryEntry } from '../content/memories';
import type { IslandId } from '../content/world';
import type { Deltas, LeadDef, MomentLike } from '../systems/mind';
import type { Line } from './artClub';

export type Flags = Record<string, boolean>;

import type { Flavor } from './minigames';

export interface MomentDef extends MomentLike {
  title: string;
  prompt: string;
  situation: (f: Flags) => Line[];
  screen: VignetteScript;
  game: Flavor;
}

export interface ScenarioDef {
  id: string;
  day: number;
  title: string;
  /** Shown on the console and in the journal. */
  summary: string;
  islands: IslandId[];
  intro: VignetteScript;
  /** Short lines after the opening scene; can react to earlier choices. */
  afterIntro: (f: Flags) => Line[];
  moments: MomentDef[];
  memory: Omit<MemoryEntry, 'emotion' | 'start' | 'script' | 'hidden'> & { script: VignetteScript };
}

const H = (x: number, y: number, label: string) => ({ x, y, label });
const flavor = (fear: [string, string, string], disgust: [string, boolean][], anger: string, sadness: string, joy: [string, string][]): Flavor => ({
  fear: { hazards: [H(0.25, 0.55, fear[0]), H(0.55, 0.4, fear[1]), H(0.8, 0.7, fear[2])] },
  disgust: { items: disgust.map(([label, bad]) => ({ label, bad })) },
  anger: { line: anger },
  sadness: { thought: sadness },
  joy: { clouds: joy.map(([gloom, bright]) => ({ gloom, bright })) },
});
const L = (speaker: Line['speaker'], text: string): Line => ({ speaker, text });
const lead = (lines: Line[], deltas?: Deltas, extra: Partial<LeadDef> = {}): LeadDef => ({ lines, deltas, ...extra });
const fx = (o: Partial<Record<'balance' | 'family' | 'friendship' | 'confidence' | 'belonging', number>>, islands?: Partial<Record<IslandId, number>>): Deltas => ({ stats: o, islands });

export const SCENARIOS: ScenarioDef[] = [
  // ─────────────────────────── Day 2: missing home ───────────────────────────
  {
    id: 'move',
    day: 2,
    title: 'Missing home',
    summary: 'A video call with her best friend from the old town, then dinner in a house that still smells of boxes.',
    islands: ['friendship', 'family'],
    intro: {
      kit: 'street',
      dur: 11,
      actors: [
        { who: 'riley', keys: [[0, 0.1, 'walk', 1, 'calm'], [5, 0.48, 'stand', 1, 'sad'], [8, 0.48, 'phone', 1, 'calm']] },
        { who: 'dad', keys: [[0, 0.9, 'hold', -1, 'calm'], [5, 0.75, 'hold', -1, 'happy']] },
      ],
      props: [{ what: 'box', keys: [[0, 0.82, 0.86, 1.2]] }],
      captions: [
        { t: 0, text: 'The new street. Steep hills, no snow, nobody she knows.' },
        { t: 5, text: 'Dad’s still carrying boxes in. Week five.' },
        { t: 8, text: 'Her phone buzzes. It’s Dani.' },
      ],
    },
    afterIntro: () => [L('joy', 'Dani! Our Dani! Okay, everyone, big smiles.'), L('sadness', 'I miss her so much it’s like a stomach ache.')],
    moments: [
      {
        id: 'move-call',
        title: 'The video call',
        prompt: 'Dani says she’s best friends with Kayla now. They made the team together.',
        situation: () => [L('dani', 'So, um, Kayla and me made the travel team! We sit together on the bus now.'), L('dani', 'You’d love it. I mean... you would have.')],
        screen: { kit: 'phone', dur: 6, actors: [{ who: 'riley', keys: [[0, 0.26, 'stand', 1, 'sad']] }, { who: 'dani', keys: [[0, 0.74, 'wave', -1, 'happy']] }] },
        effects: {
          joy: fx({ friendship: 1, balance: -1 }),
          sadness: fx({ friendship: 2, confidence: -1 }),
          anger: fx({ friendship: -2, confidence: 1 }),
          fear: fx({ friendship: -1, confidence: -1 }),
          disgust: fx({ friendship: -1, belonging: -1 }),
        },
        lead: {
          joy: lead([L('riley', 'That’s amazing! Seriously! Tell Kayla hi!'), L('dani', 'Really? Okay! Cool. Cool cool.')], fx({ friendship: 2, balance: -3 }), {
            later: [{ inDays: 2, id: 'move-mask', tone: 'bad', text: 'Riley never said she was sad about Kayla. It sits in her chest like a stone.', deltas: fx({ balance: -4 }) }],
          }),
          sadness: lead([L('riley', 'That’s great. I’m happy for you. I just... really miss you.'), L('dani', 'I miss you too. It’s weird without you. Kayla doesn’t get my jokes.')], fx({ friendship: 7 }, { friendship: 4 }), { flags: ['keptInTouch'] }),
          anger: lead([L('riley', 'Wow. Took you five whole weeks to replace me.'), L('dani', '...That’s not fair. I’ve gotta go.')], fx({ friendship: -6, confidence: 2 }, { friendship: -5 }), {
            flags: ['daniHurt'],
            later: [{ inDays: 2, id: 'move-silent', tone: 'bad', unlessFlag: 'daniRepaired', text: 'Dani hasn’t replied to Riley’s last three messages.', deltas: fx({ friendship: -5 }, { friendship: -6 }) }],
          }),
          fear: lead([L('riley', 'Oh, um, my connection is bad, I think I have to go. Bye!'), L('dani', 'Wait, Riley...')], fx({ friendship: -3, confidence: -2 })),
          disgust: lead([L('riley', 'Kayla? The girl who eats her hair? Okay.'), L('dani', 'She doesn’t do that any more. Anyway.')], fx({ friendship: -3, confidence: 1 })),
        },
        blends: [
          {
            id: 'bittersweet',
            when: { sadness: 1, joy: 1 },
            lines: [L('riley', 'I’m really happy for you. And it’s also kind of hard to hear. Both.'), L('dani', 'Yeah. Both. Call me every Sunday? Promise?'), L('riley', 'Promise.')],
            deltas: fx({ friendship: 9, balance: 2 }, { friendship: 6 }),
            flags: ['keptInTouch', 'sundayCalls'],
            later: [{ inDays: 2, id: 'move-sunday', tone: 'good', text: 'Sunday call with Dani. They talked for an hour about nothing.', deltas: fx({ friendship: 4, belonging: 2 }, { friendship: 4 }), memory: { id: 'goodbye', addSwirl: 'joy' } }],
          },
          {
            id: 'honest-hurt',
            when: { sadness: 1, anger: 1 },
            lines: [L('riley', 'Honestly? That stings. I know it’s not your fault, but it stings.'), L('dani', 'Okay. Thanks for telling me. I’d feel the same.')],
            deltas: fx({ friendship: 6, confidence: 2 }, { friendship: 3 }),
            flags: ['keptInTouch'],
          },
        ],
        overload: {
          anger: lead([L('riley', 'Fine. Have fun with your NEW best friend.'), L('narrator', '(Riley hangs up first.)')], fx({ friendship: -6 }, { friendship: -8 }), {
            flags: ['daniHurt'],
            later: [{ inDays: 1, id: 'move-blocked', tone: 'bad', unlessFlag: 'daniRepaired', text: 'Dani took the friendship bracelet photo off her profile.', deltas: fx({ friendship: -4, belonging: -2 }, { friendship: -6 }), memory: { id: 'goodbye', emotion: 'anger' } }],
          }),
          joy: lead([L('riley', 'Kayla! The BEST! Everything’s the BEST here too!'), L('narrator', '(Dani squints at her. She knows Riley too well.)')], fx({ friendship: -1 })),
        },
        game: flavor(
          ['Kayla in the background', 'Dani’s new team jacket', 'Riley’s wobbly chin'],
          [['Pretend it doesn’t matter', true], ['Say you miss her', false], ['Hang up fast', true], ['Ask about the team', false]],
          'Wait, you replaced me already?',
          'She doesn’t want Riley to feel replaced.',
          [['Replaced', 'Still friends'], ['Far away', 'One call away'], ['Left behind', 'Growing up']],
        ),
      },
      {
        id: 'move-dinner',
        title: 'Dinner question',
        prompt: 'Mum asks, gently, how Riley is finding the new city. Dad stops chewing to listen.',
        situation: (f) => [
          L('mum', 'So. Honestly. How are you liking it here, love?'),
          ...(f.keptInTouch ? [L('sadness', 'We were honest with Dani. Maybe we can be honest here too.')] : [L('fear', 'Say “fine”. Everyone loves “fine”.')]),
        ],
        screen: {
          kit: 'kitchen',
          dur: 6,
          night: true,
          actors: [
            { who: 'mum', keys: [[0, 0.3, 'sit', 1, 'calm']] },
            { who: 'riley', keys: [[0, 0.56, 'sit', -1, 'calm']] },
            { who: 'dad', keys: [[0, 0.82, 'eat', -1, 'calm']] },
          ],
        },
        effects: {
          joy: fx({ family: 1, confidence: 1 }),
          sadness: fx({ family: 2, confidence: -1 }),
          anger: fx({ family: -2 }),
          fear: fx({ family: -1, balance: -1 }),
          disgust: fx({ family: -1, belonging: -1 }),
        },
        lead: {
          joy: lead([L('riley', 'Art club is really good. I made a friend, Priya. We painted a cat out of clouds.'), L('dad', 'A cloud cat! I need to see this cat.')], fx({ family: 6, confidence: 3 }, { family: 4 })),
          sadness: lead([L('riley', 'It’s hard. I miss everyone. I miss snow.'), L('mum', 'Oh, sweetheart. Me too, honestly.')], fx({ family: 5, confidence: -2 }, { family: 3 }), { flags: ['toldParentsTruth'] }),
          anger: lead([L('riley', 'How do you THINK I’m liking it? You didn’t ask before we moved.'), L('dad', 'Riley...')], fx({ family: -6, confidence: 1 }, { family: -5 }), { flags: ['dinnerSnap'] }),
          fear: lead([L('riley', 'Fine. It’s fine. Can I go upstairs?'), L('mum', '...Sure, love.')], fx({ family: -3 }), {
            flags: ['hidingFeelings'],
            later: [{ inDays: 1, id: 'move-fine', tone: 'bad', text: 'Mum keeps glancing at Riley at breakfast. “Fine” didn’t convince anyone.', deltas: fx({ family: -3 }, { family: -3 }) }],
          }),
          disgust: lead([L('riley', 'The school smells like soup. The bus smells like soup. Everything here smells like soup.'), L('dad', 'Ha! That’s, um... very specific.')], fx({ family: 1, belonging: -2 })),
        },
        blends: [
          {
            id: 'honest-hope',
            when: { sadness: 1, joy: 1 },
            lines: [L('riley', 'Some of it’s really hard. I miss home. But art club was good. Really good.'), L('mum', 'Thank you for telling us both halves.'), L('dad', 'Saturday: we find the best hot chocolate in this city. Family mission.')],
            deltas: fx({ family: 9, balance: 2, belonging: 2 }, { family: 6 }),
            flags: ['toldParentsTruth', 'familyMission'],
            later: [{ inDays: 1, id: 'move-mission', tone: 'good', text: 'Hot chocolate mission: the café on the hill wins. Dad got cream on his glasses.', deltas: fx({ family: 3, belonging: 3 }, { family: 4, goofball: 3 }) }],
          },
          {
            id: 'fear-sad',
            when: { fear: 1, sadness: 1 },
            lines: [L('riley', 'I’m worried I won’t ever fit in here.'), L('mum', 'That’s a real worry. Let’s think about it together.')],
            deltas: fx({ family: 6, confidence: 1 }, { family: 3 }),
            flags: ['toldParentsTruth'],
          },
        ],
        overload: {
          anger: lead([L('riley', 'I HATE it here and it’s YOUR fault!'), L('narrator', '(Her chair scrapes. Her door slams.)')], fx({ family: -6 }, { family: -10 }), { flags: ['dinnerSnap', 'slammedDoor'] }),
          sadness: lead([L('narrator', '(Riley cries into her pasta. Nobody knows what to say.)')], fx({ family: 2 })),
        },
        game: flavor(
          ['Mum’s worried face', 'Dad’s fork, stopped', 'The question itself'],
          [['Say “fine” and leave', true], ['Mention art club', false], ['Blame them for moving', true], ['Say it’s hard', false]],
          'You didn’t even ask me before we moved!',
          'Mum is worried she made the wrong choice.',
          [['Strange city', 'New places'], ['Lonely', 'Priya'], ['No snow', 'Hot chocolate']],
        ),
      },
    ],
    memory: {
      id: 'sc-move',
      title: 'Dinner in the new house',
      text: 'The first real conversation about the move.',
      island: 'family',
      significance: 'important',
      when: 'Week five in the new city',
      script: {
        kit: 'kitchen',
        dur: 7,
        night: true,
        actors: [
          { who: 'mum', keys: [[0, 0.3, 'sit', 1, 'calm']] },
          { who: 'riley', keys: [[0, 0.56, 'sit', -1, 'calm']] },
          { who: 'dad', keys: [[0, 0.82, 'eat', -1, 'happy']] },
        ],
        captions: [{ t: 0, text: '“So. Honestly. How are you liking it here?”' }],
      },
      lens: {
        joy: 'Dad’s hot chocolate plan. A family mission!',
        sadness: 'Saying it out loud made it real. And lighter.',
        anger: 'Nobody asked her before they moved. Still true.',
        fear: 'What if she said the wrong thing?',
        disgust: 'Everything here smells like soup.',
      },
      detail: { label: 'The empty boxes', text: 'Three boxes still say “Riley’s room”.', x: 0.1, y: 0.8 },
    },
  },

  // ─────────────────────────── Day 3: the argument ───────────────────────────
  {
    id: 'argument',
    day: 3,
    title: 'The argument',
    summary: 'Hockey tryouts are on Saturday. Her parents say not this season.',
    islands: ['family', 'hockey'],
    intro: {
      kit: 'livingroom',
      dur: 11,
      actors: [
        { who: 'riley', keys: [[0, 0.1, 'run', 1, 'happy'], [3, 0.42, 'hold', 1, 'happy'], [7, 0.42, 'stand', 1, 'shock']] },
        { who: 'dad', keys: [[0, 0.7, 'sit', -1, 'calm'], [5, 0.7, 'sit', -1, 'sad']] },
        { who: 'mum', keys: [[0, 0.86, 'stand', -1, 'calm'], [5, 0.86, 'arms', -1, 'sad']] },
      ],
      props: [{ what: 'flyer', keys: [[0, 0.16, 0.6], [3, 0.47, 0.58]] }],
      captions: [
        { t: 0, text: 'Hockey tryouts. Saturday. Riley found the flyer.' },
        { t: 5, text: '“Not this season, love. Money’s tight with the move.”' },
      ],
    },
    afterIntro: (f) => [
      ...(f.dinnerSnap ? [L('fear', 'They’re still upset about dinner. This is going to be bad.')] : []),
      ...(f.toldParentsTruth ? [L('sadness', 'They know how hard it’s been. Maybe they’ll listen.')] : []),
      L('anger', 'Not. This. Season?!'),
    ],
    moments: [
      {
        id: 'arg-no',
        title: '“Not this season”',
        prompt: 'Dad says the fees are too much right now. Riley’s whole body goes hot.',
        situation: () => [L('dad', 'I know it’s a big deal. Maybe next year, once we’re settled.'), L('riley', '(Next YEAR?)')],
        screen: { kit: 'livingroom', dur: 6, actors: [{ who: 'riley', keys: [[0, 0.42, 'stand', 1, 'angry']] }, { who: 'dad', keys: [[0, 0.7, 'sit', -1, 'sad']] }, { who: 'mum', keys: [[0, 0.86, 'arms', -1, 'calm']] }] },
        effects: {
          joy: fx({ family: 1, confidence: -1 }),
          sadness: fx({ family: 1, confidence: -1 }),
          anger: fx({ confidence: 2, family: -1 }),
          fear: fx({ confidence: -2 }),
          disgust: fx({ family: -1, confidence: 1 }),
        },
        lead: {
          joy: lead([L('riley', 'Okay! Next year! No problem!'), L('narrator', '(It is a problem.)')], fx({ family: 1, confidence: -3, balance: -3 }), {
            later: [{ inDays: 2, id: 'arg-swallowed', tone: 'bad', text: 'Riley walked past the rink on the way home and didn’t say why she went quiet.', deltas: fx({ confidence: -3 }, { hockey: -5 }) }],
          }),
          sadness: lead([L('riley', 'Hockey is the only thing that still feels like home.'), L('mum', 'Oh. I... didn’t know it was that big.')], fx({ family: 4 }, { hockey: 2 })),
          anger: lead([L('riley', 'That’s not fair. Can we at least talk about it properly? I’d help pay.'), L('dad', '...That’s fair. Let’s talk.')], fx({ confidence: 5, family: 3 }, { hockey: 5 }), { flags: ['negotiated'] }),
          fear: lead([L('riley', 'Okay. Sorry. Never mind.'), L('narrator', '(She goes to her room and stares at the ceiling.)')], fx({ confidence: -4 }, { hockey: -4 })),
          disgust: lead([L('riley', 'Wow. Great. So we moved here for this.'), L('mum', 'That’s not fair, Riley.')], fx({ family: -4, confidence: 1 }, { family: -3 })),
        },
        blends: [
          {
            id: 'heard',
            when: { anger: 1, sadness: 1 },
            lines: [L('riley', 'I’m angry, and I’m also really sad. Hockey’s the only thing that feels like me here.'), L('dad', 'Okay. That changes things. Let us look at the numbers again tonight.')],
            deltas: fx({ family: 6, confidence: 4 }, { hockey: 6, family: 4 }),
            flags: ['negotiated', 'heard'],
          },
          {
            id: 'careful-ask',
            when: { fear: 1, anger: 1 },
            lines: [L('riley', 'Could we find a cheaper league? I checked, there’s one at the rec centre.'), L('mum', 'You checked? Okay. That’s a plan.')],
            deltas: fx({ confidence: 4, family: 4 }, { hockey: 5 }),
            flags: ['negotiated', 'recLeague'],
          },
        ],
        overload: {
          anger: lead([L('riley', 'YOU RUINED EVERYTHING!'), L('narrator', '(SLAM. A picture frame falls off the wall.)')], fx({ family: -6 }, { family: -12, hockey: -3 }), {
            flags: ['slammedDoor'],
            later: [{ inDays: 1, id: 'arg-frame', tone: 'bad', unlessFlag: 'repaired', text: 'The fallen picture frame is still face down on the hall floor. Nobody has picked it up.', deltas: fx({ family: -4 }, { family: -6 }), memory: { id: 'core-family', addSwirl: 'anger' } }],
          }),
          fear: lead([L('narrator', '(Riley says nothing at all. Not tonight, not tomorrow.)')], fx({ confidence: -2 }, { hockey: -4 }), { flags: ['hidingFeelings'] }),
        },
        game: flavor(
          ['Dad’s tired eyes', 'The bills on the table', 'Her own fists'],
          [['Slam the door', true], ['Say why it matters', false], ['Sulk for a week', true], ['Offer to help pay', false]],
          'That’s not fair. Can we talk about it properly?',
          'Dad hates saying no. He looks awful about it.',
          [['Never', 'Not yet'], ['Unfair', 'Worth asking'], ['Stuck', 'Options']],
        ),
      },
      {
        id: 'arg-door',
        title: 'A knock at the door',
        prompt: 'Later. Mum knocks on Riley’s door and sits on the end of her bed.',
        situation: (f) => [
          L('mum', f.slammedDoor ? 'Can I come in? I think we both said things.' : 'Hey. Can I sit for a minute?'),
          ...(f.negotiated ? [L('mum', 'Dad’s on the computer looking at leagues. No promises.')] : []),
        ],
        screen: { kit: 'bedroom', dur: 6, night: true, actors: [{ who: 'riley', keys: [[0, 0.74, 'sit', -1, 'sad']] }, { who: 'mum', keys: [[0, 0.5, 'sit', 1, 'calm']] }] },
        effects: {
          joy: fx({ family: 1 }),
          sadness: fx({ family: 2 }),
          anger: fx({ family: -1, confidence: 1 }),
          fear: fx({ family: -1 }),
          disgust: fx({ family: -2 }),
        },
        lead: {
          joy: lead([L('riley', 'I’m okay! Really. Want to see my cloud cat drawing?'), L('mum', 'I’d love to. But you can tell me if you’re not okay too.')], fx({ family: 3 }, { family: 2, goofball: 2 })),
          sadness: lead([L('riley', 'I’m sorry I yelled. I just feel like I lost everything at once.'), L('mum', 'Come here.'), L('narrator', '(A long hug. The kind that fixes the evening.)')], fx({ family: 9 }, { family: 7 }), { flags: ['repaired'] }),
          anger: lead([L('riley', 'I’m still mad. I’m allowed to be mad.'), L('mum', 'You are. I’ll be here when you’re ready.')], fx({ family: 1, confidence: 2 })),
          fear: lead([L('riley', 'Are you and Dad mad at me?'), L('mum', 'No. Never mad at you for having feelings.')], fx({ family: 4, confidence: -1 }, { family: 2 })),
          disgust: lead([L('riley', 'Can you just... go? Please.'), L('mum', '...Okay.')], fx({ family: -5 }, { family: -5 }), {
            later: [{ inDays: 1, id: 'arg-cold', tone: 'bad', unlessFlag: 'repaired', text: 'Breakfast is very quiet. Everyone is extremely polite.', deltas: fx({ family: -3, belonging: -2 }, { family: -4 }) }],
          }),
        },
        blends: [
          {
            id: 'repair',
            when: { sadness: 1, joy: 1 },
            lines: [L('riley', 'I’m sorry. I’m still sad about hockey. But I love you guys.'), L('mum', 'We love you too. Dad found a rec league, by the way. Cheaper. Tryouts are Saturday.'), L('joy', 'WHAT.')],
            deltas: fx({ family: 10, confidence: 3 }, { family: 8, hockey: 8 }),
            flags: ['repaired', 'recLeague'],
            later: [{ inDays: 1, id: 'arg-tryout', tone: 'good', text: 'Rec league tryouts: Riley made the team. Dad cheered so loud the coach looked over.', deltas: fx({ confidence: 4, belonging: 3 }, { hockey: 6 }) }],
          },
          {
            id: 'firm-and-kind',
            when: { anger: 1, sadness: 1 },
            lines: [L('riley', 'I was too loud. But I still think it was unfair.'), L('mum', 'Both of those can be true. Thank you.')],
            deltas: fx({ family: 7, confidence: 3 }, { family: 5 }),
            flags: ['repaired'],
          },
        ],
        overload: {
          disgust: lead([L('riley', 'Ugh. Don’t. Just don’t.'), L('narrator', '(Mum leaves. The door clicks shut very quietly.)')], fx({ family: -4 }, { family: -6 })),
          sadness: lead([L('narrator', '(Riley cries until she falls asleep. Mum stays, stroking her hair.)')], fx({ family: 4, confidence: -2 })),
        },
        game: flavor(
          ['Mum’s hand on the duvet', 'The fallen frame', 'Tomorrow morning'],
          [['Pretend to be asleep', true], ['Say sorry', false], ['Tell her to leave', true], ['Explain how it feels', false]],
          'I’m still mad, and I’m allowed to be!',
          'Mum hated saying no. She cried in the car.',
          [['Ruined', 'Repairable'], ['Alone', 'Mum’s here'], ['No hockey', 'Maybe hockey']],
        ),
      },
    ],
    memory: {
      id: 'sc-argument',
      title: 'The tryouts talk',
      text: 'The night hockey nearly ended.',
      island: 'family',
      significance: 'important',
      when: 'Week five, Thursday night',
      script: { kit: 'bedroom', dur: 7, night: true, actors: [{ who: 'riley', keys: [[0, 0.74, 'sit', -1, 'sad'], [4, 0.66, 'hug', -1, 'calm']] }, { who: 'mum', keys: [[0, 0.5, 'sit', 1, 'calm'], [4, 0.56, 'hug', 1, 'calm']] }], captions: [{ t: 0, text: 'A knock. Mum sits on the end of the bed.' }] },
      lens: {
        joy: 'There might be a league! There might be hockey!',
        sadness: 'The night she said how much she’d lost.',
        anger: 'It WAS unfair. She was right to say so.',
        fear: 'She thought they’d be angry forever.',
        disgust: 'She was a bit dramatic. Mortifying, honestly.',
      },
      detail: { label: 'The flyer', text: 'Folded into a tiny square under her pillow.', x: 0.82, y: 0.62 },
    },
  },

  // ─────────────────────────── Day 4: the lunch table ───────────────────────────
  {
    id: 'lunch',
    day: 4,
    title: 'The lunch table',
    summary: 'A full cafeteria and a tray in her hands. Where does the new kid sit?',
    islands: ['friendship'],
    intro: {
      kit: 'cafeteria',
      dur: 10,
      actors: [
        { who: 'riley', keys: [[0, 0.05, 'walk', 1, 'calm'], [4, 0.46, 'hold', 1, 'scared'], [10, 0.46, 'hold', 1, 'scared']] },
        { who: 'kidA', keys: [[0, 0.2, 'sit', 1, 'happy']] },
        { who: 'kidB', keys: [[0, 0.3, 'sit', -1, 'happy']] },
        { who: 'priya', keys: [[0, 0.7, 'sit', 1, 'calm'], [6, 0.7, 'wave', -1, 'happy']] },
        { who: 'theo', keys: [[0, 0.86, 'eat', -1, 'happy']] },
      ],
      props: [{ what: 'tray', keys: [[0, 0.08, 0.62], [4, 0.49, 0.6]] }],
      captions: [
        { t: 0, text: 'Lunch. Two hundred kids. Four hundred eyes.' },
        { t: 4, text: 'Maya’s table is the loud one. Priya is at the art kids’ table.' },
      ],
    },
    afterIntro: (f) => [
      ...(f.keptInTouch ? [L('joy', 'Dani said to just pick the friendliest face. Easy!')] : []),
      L('fear', 'Every table is a decision. Every decision is a test.'),
    ],
    moments: [
      {
        id: 'lunch-seat',
        title: 'Where to sit',
        prompt: 'Maya’s table is popular. Priya’s table is quieter. There’s also the library.',
        situation: () => [L('riley', '(Don’t stand here too long. Standing here too long is worse than anything.)')],
        screen: { kit: 'cafeteria', dur: 6, actors: [{ who: 'kidA', keys: [[0, 0.2, 'sit', 1, 'happy']] }, { who: 'kidB', keys: [[0, 0.3, 'sit', -1, 'happy']] }, { who: 'riley', keys: [[0, 0.48, 'hold', 1, 'scared']] }, { who: 'priya', keys: [[0, 0.72, 'wave', -1, 'happy']] }] },
        effects: {
          joy: fx({ belonging: 2, confidence: 1 }),
          sadness: fx({ belonging: -1 }),
          anger: fx({ belonging: -1, confidence: 1 }),
          fear: fx({ belonging: 1, confidence: -1 }),
          disgust: fx({ belonging: -2 }),
        },
        lead: {
          joy: lead([L('riley', '(She plonks down at Maya’s table.) Hi! I’m Riley!'), L('kidA', 'Oh. Um. Hi? We kind of save these seats.')], fx({ belonging: -1, confidence: 2 }), { flags: ['mayaTable'] }),
          sadness: lead([L('narrator', '(Riley eats a sandwich in the library, next to the atlas section.)')], fx({ belonging: -5, friendship: -2 }, { friendship: -3 })),
          anger: lead([L('riley', 'Is anyone actually sitting there, or is that bag sitting there?'), L('kidB', 'Okay, okay, jeez. Sit.')], fx({ belonging: 2, confidence: 3 })),
          fear: lead([L('riley', '(She checks every table, then walks straight to Priya.) Is this seat taken?'), L('priya', 'It is now. Hi!')], fx({ belonging: 6, friendship: 5 }, { friendship: 5 }), { flags: ['priyaTable'] }),
          disgust: lead([L('riley', '(Maya’s table is throwing grapes. Absolutely not.) She sits at the end of an empty table.')], fx({ belonging: -3, confidence: 1 })),
        },
        blends: [
          {
            id: 'brave-choice',
            when: { fear: 1, joy: 1 },
            lines: [L('riley', 'Priya! Can I sit with you? I brought extra crackers. As payment.'), L('priya', 'Crackers accepted. Theo, budge up.')],
            deltas: fx({ belonging: 8, friendship: 6, confidence: 2 }, { friendship: 6 }),
            flags: ['priyaTable'],
          },
        ],
        overload: {
          fear: lead([L('narrator', '(Riley walks one full lap of the cafeteria and then hides in the toilets until the bell.)')], fx({ belonging: -6 }, { friendship: -5 })),
          joy: lead([L('riley', 'HI EVERYONE! I’M NEW! WHO WANTS TO BE FRIENDS?'), L('narrator', '(Silence. A fork drops.)')], fx({ belonging: -4 })),
        },
        game: flavor(
          ['Maya’s saved seats', 'The flying grapes', 'That empty table'],
          [['Hide in the toilets', true], ['Sit with Priya', false], ['Stand there forever', true], ['Ask “is this free?”', false]],
          'Is that bag saving a seat, or just sitting there?',
          'Priya keeps glancing over, hoping she’ll come.',
          [['Watched', 'Noticed'], ['Nowhere', 'Priya’s table'], ['Awkward', 'Brave']],
        ),
      },
      {
        id: 'lunch-show',
        title: 'The show everyone watches',
        prompt: 'The whole table is talking about a show Riley has never seen. Someone asks what she thinks.',
        situation: (f) => [L(f.priyaTable ? 'theo' : 'kidA', 'Okay, but who is the BEST in season two? Riley? Riley, who?'), L('riley', '(She has never seen a single episode.)')],
        screen: { kit: 'cafeteria', dur: 6, actors: [{ who: 'riley', keys: [[0, 0.42, 'sit', 1, 'shock']] }, { who: 'theo', keys: [[0, 0.62, 'point', -1, 'happy']] }, { who: 'kidA', keys: [[0, 0.82, 'sit', -1, 'happy']] }] },
        effects: {
          joy: fx({ belonging: 1, balance: -1 }),
          sadness: fx({ belonging: 1, confidence: -1 }),
          anger: fx({ belonging: -1 }),
          fear: fx({ confidence: -1 }),
          disgust: fx({ confidence: 1, belonging: 1 }),
        },
        lead: {
          joy: lead([L('riley', 'Oh, totally, the... main one. With the hair.'), L('theo', 'They’re ALL main ones. With hair.')], fx({ belonging: 2, balance: -2 }), {
            later: [{ inDays: 2, id: 'lunch-caught', tone: 'bad', text: 'Theo quoted the show at Riley and she just nodded. He worked it out. “You’ve never seen it, have you?”', deltas: fx({ belonging: -4, confidence: -2 }, { friendship: -3 }) }],
          }),
          sadness: lead([L('riley', 'I’ve never seen it. We didn’t have that channel at my old house.'), L('priya', 'Wait, then you HAVE to come watch it at mine.')], fx({ belonging: 5, friendship: 4 }, { friendship: 4 }), { flags: ['invitedPriya'] }),
          anger: lead([L('riley', 'Why does everyone have to like the same show?'), L('theo', 'Whoa. It’s just a show.')], fx({ belonging: -3, confidence: 1 })),
          fear: lead([L('riley', '(She suddenly needs the toilet. Very urgently.)')], fx({ belonging: -2, confidence: -2 })),
          disgust: lead([L('riley', 'I’ve never seen it. But I HAVE heard the theme song, and it’s a crime.'), L('theo', 'HA! It IS a crime!'), L('priya', 'It’s so bad. I love it.')], fx({ belonging: 7, confidence: 4 }, { friendship: 5, goofball: 3 })),
        },
        blends: [
          {
            id: 'honest-funny',
            when: { sadness: 1, disgust: 1 },
            lines: [L('riley', 'Confession: never seen it. Also, that theme song should be illegal.'), L('theo', 'Sleepover marathon. You, me, Priya. We’ll fix you.')],
            deltas: fx({ belonging: 9, friendship: 6 }, { friendship: 6, goofball: 3 }),
            flags: ['invitedPriya', 'sleepover'],
            later: [{ inDays: 2, id: 'lunch-sleepover', tone: 'good', text: 'Sleepover at Priya’s: three episodes, one popcorn fire alarm, zero regrets.', deltas: fx({ friendship: 5, belonging: 4 }, { friendship: 6, goofball: 4 }) }],
          },
        ],
        overload: {
          disgust: lead([L('riley', 'That show is for babies. Honestly.'), L('narrator', '(The whole table goes quiet.)')], fx({ belonging: -6 }, { friendship: -4 })),
          joy: lead([L('riley', 'I LOVE IT! Season two! The hair one!'), L('narrator', '(Everyone stares.)')], fx({ belonging: -2, balance: -2 })),
        },
        game: flavor(
          ['Theo’s raised eyebrow', 'The quiz question', 'Being found out'],
          [['Pretend you’ve seen it', true], ['Admit you haven’t', false], ['Call it babyish', true], ['Ask what it’s about', false]],
          'Why does everyone have to like the same thing?',
          'Priya didn’t have the channel either, at first.',
          [['Clueless', 'Curious'], ['Outsider', 'New fan'], ['Embarrassed', 'Honest']],
        ),
      },
    ],
    memory: {
      id: 'sc-lunch',
      title: 'The lunch table',
      text: 'Choosing where to sit, on a Tuesday.',
      island: 'friendship',
      significance: 'important',
      when: 'Week six',
      script: { kit: 'cafeteria', dur: 7, actors: [{ who: 'riley', keys: [[0, 0.1, 'hold', 1, 'scared'], [4, 0.5, 'sit', 1, 'happy']] }, { who: 'priya', keys: [[0, 0.66, 'sit', -1, 'happy']] }, { who: 'theo', keys: [[0, 0.84, 'eat', -1, 'happy']] }], captions: [{ t: 0, text: 'A tray, a room full of strangers.' }] },
      lens: {
        joy: 'Crackers, jokes and a table that saves her a seat now.',
        sadness: 'The library atlas section. Just in case.',
        anger: 'Saved seats are a scam.',
        fear: 'The longest walk in the world: from the till to a table.',
        disgust: 'Grape-throwing is not a personality.',
      },
      detail: { label: 'The tray', text: 'Fish fingers. A strong choice under pressure.', x: 0.2, y: 0.6 },
    },
  },

  // ─────────────────────────── Day 5: the big game ───────────────────────────
  {
    id: 'game',
    day: 5,
    title: 'The big game',
    summary: 'Last minute, one goal down, and the puck lands on Riley’s stick.',
    islands: ['hockey', 'family'],
    intro: {
      kit: 'rink',
      dur: 11,
      actors: [
        { who: 'riley', keys: [[0, 0.2, 'skate', 1, 'calm'], [5, 0.7, 'shoot', 1, 'calm'], [7, 0.74, 'stand', 1, 'shock'], [11, 0.74, 'slump', 1, 'sad']] },
        { who: 'kidC', keys: [[0, 0.86, 'skate', -1, 'calm'], [5, 0.84, 'skate', -1, 'calm'], [7, 0.84, 'cheer', -1, 'happy']] },
      ],
      props: [{ what: 'puck', keys: [[0, 0.26, 0.86], [5, 0.74, 0.86], [6, 0.98, 0.7], [11, 0.98, 0.7]] }],
      captions: [
        { t: 0, text: 'Ten seconds left. One goal down.' },
        { t: 5, text: 'She shoots...' },
        { t: 6.4, text: 'Off the post. The buzzer goes.' },
      ],
    },
    afterIntro: (f) => [
      ...(f.recLeague ? [L('joy', 'First game with the new team. We were SO close.')] : [L('sadness', 'School team game. The only hockey we’ve got.')]),
      L('anger', 'THE POST. The actual metal POST.'),
    ],
    moments: [
      {
        id: 'game-buzzer',
        title: 'After the buzzer',
        prompt: 'The other team is celebrating. Riley’s team skates slowly toward her.',
        situation: () => [L('kidC', 'Hey. That was a good shot. It was so close.'), L('riley', '(It wasn’t good enough.)')],
        screen: { kit: 'rink', dur: 6, actors: [{ who: 'riley', keys: [[0, 0.5, 'slump', 1, 'sad']] }, { who: 'kidC', keys: [[0, 0.68, 'skate', -1, 'calm']] }, { who: 'coach', keys: [[0, 0.12, 'stand', 1, 'calm']] }] },
        effects: {
          joy: fx({ belonging: 1, confidence: 1, balance: -1 }),
          sadness: fx({ belonging: 2, confidence: -1 }),
          anger: fx({ confidence: 1, belonging: -2 }),
          fear: fx({ confidence: -2 }),
          disgust: fx({ belonging: -1 }),
        },
        lead: {
          joy: lead([L('riley', 'Good game, everyone! We’ll get them next time!'), L('kidC', '...Yeah! Next time!')], fx({ belonging: 3, balance: -2 }), {
            later: [{ inDays: 1, id: 'game-bottled', tone: 'bad', text: 'Riley cried in the shower about the post. Nobody knew. She told everyone she was fine.', deltas: fx({ balance: -3 }) }],
          }),
          sadness: lead([L('narrator', '(Riley’s eyes fill up behind her visor.)'), L('kidC', 'Hey. Hey. Team hug, come on.'), L('narrator', '(The whole team piles in.)')], fx({ belonging: 7 }, { hockey: 5 }), { flags: ['teamHug'] }),
          anger: lead([L('riley', '(She whacks her stick on the ice.)'), L('coach', 'Riley. Bench. Now.')], fx({ belonging: -4, confidence: -1 }, { hockey: -5 }), { flags: ['benched'] }),
          fear: lead([L('riley', 'It was my fault. I lost it. Sorry. Sorry.'), L('kidC', 'It wasn’t just you...')], fx({ confidence: -4 }, { hockey: -3 })),
          disgust: lead([L('riley', 'The ice on that side was terrible. Who resurfaced it, a toddler?'), L('kidC', 'Ha. Kind of true.')], fx({ confidence: 2, belonging: 1 })),
        },
        blends: [
          {
            id: 'proud-sad',
            when: { sadness: 1, joy: 1 },
            lines: [L('riley', 'I really wanted that one. But we played so well.'), L('coach', 'That shot was the right shot. Posts happen. Proud of you.')],
            deltas: fx({ belonging: 8, confidence: 5 }, { hockey: 8 }),
            flags: ['teamHug'],
          },
          {
            id: 'fired-up',
            when: { anger: 1, sadness: 1 },
            lines: [L('riley', 'That hurts so much. I want a rematch.'), L('kidC', 'Same. Extra practice Tuesday?')],
            deltas: fx({ confidence: 6, belonging: 5 }, { hockey: 7 }),
            later: [{ inDays: 1, id: 'game-practice', tone: 'good', text: 'Extra practice: Riley hit the top corner six times in a row.', deltas: fx({ confidence: 4 }, { hockey: 5 }) }],
          },
        ],
        overload: {
          anger: lead([L('narrator', '(Riley snaps her stick over the crossbar. The rink goes silent.)'), L('coach', 'You’re sitting out next game.')], fx({ belonging: -4 }, { hockey: -10 }), {
            flags: ['benched'],
            later: [{ inDays: 1, id: 'game-sitout', tone: 'bad', text: 'Riley watched next game from the bench. The broken stick is in the garage.', deltas: fx({ confidence: -4 }, { hockey: -6 }), memory: { id: 'core-hockey', addSwirl: 'anger' } }],
          }),
          sadness: lead([L('narrator', '(Riley sits on the ice and won’t get up. The Zamboni has to wait.)')], fx({ confidence: -3 }, { hockey: -3 })),
        },
        game: flavor(
          ['The goalpost', 'The other team’s celebration', 'Riley’s stick'],
          [['Smash the stick', true], ['Join the team hug', false], ['Blame the ice', true], ['Shake hands', false]],
          'THE POST! THE ACTUAL POST!',
          'Her teammates feel it too. Nobody blames her.',
          [['Lost', 'So close'], ['My fault', 'Team game'], ['The post', 'Great shot']],
        ),
      },
      {
        id: 'game-car',
        title: 'The drive home',
        prompt: 'Dad drives. The radio’s off. He keeps looking over.',
        situation: (f) => [L('dad', f.slammedDoor && !f.repaired ? 'I, um. I came. I wanted to see you play.' : 'You were brilliant out there. You know that, right?')],
        screen: { kit: 'car', dur: 6, night: true, actors: [{ who: 'dad', keys: [[0, 0.23, 'sit', 1, 'calm']] }, { who: 'riley', keys: [[0, 0.71, 'sit', -1, 'sad']] }] },
        effects: {
          joy: fx({ family: 1, confidence: 1 }),
          sadness: fx({ family: 2 }),
          anger: fx({ family: -1, confidence: 1 }),
          fear: fx({ confidence: -1 }),
          disgust: fx({ family: -1 }),
        },
        lead: {
          joy: lead([L('riley', 'We scored two! Two! Against the best team!'), L('dad', 'Two! And that pass in the second period, wow.')], fx({ family: 5, confidence: 4 }, { hockey: 4, family: 3 })),
          sadness: lead([L('riley', 'I let everyone down.'), L('dad', 'You didn’t. Want me to tell you about the time I scored on my own goal?')], fx({ family: 5 }, { family: 3 })),
          anger: lead([L('riley', 'Can we just NOT talk about it?'), L('dad', 'Okay. Okay.')], fx({ family: -2 })),
          fear: lead([L('riley', 'Maybe I should quit. Before I lose another one.'), L('dad', 'Hey. No. Let’s not decide anything tonight.')], fx({ confidence: -4 }, { hockey: -6 })),
          disgust: lead([L('riley', 'Can we get fries? Losing deserves fries.'), L('dad', 'Losing absolutely deserves fries.')], fx({ family: 4 }, { goofball: 4 })),
        },
        blends: [
          {
            id: 'fries-and-truth',
            when: { sadness: 1, disgust: 1 },
            lines: [L('riley', 'I’m really sad. Also I demand fries.'), L('dad', 'Sad fries. Coming right up.')],
            deltas: fx({ family: 8, balance: 2 }, { family: 5, goofball: 5 }),
          },
          {
            id: 'bright-after-rain',
            when: { sadness: 1, joy: 1 },
            lines: [L('riley', 'It hurts. But I still love it. I want to keep playing.'), L('dad', 'That’s the most hockey thing you’ve ever said.')],
            deltas: fx({ family: 7, confidence: 5 }, { hockey: 8, family: 4 }),
          },
        ],
        overload: {
          fear: lead([L('riley', 'I’m done. I’m quitting hockey.'), L('narrator', '(Dad doesn’t say anything. Neither does she.)')], fx({ confidence: -5 }, { hockey: -12 }), {
            flags: ['quitTalk'],
            later: [{ inDays: 1, id: 'game-quit', tone: 'bad', text: 'Riley’s skates are still in the boot of the car. She hasn’t taken them out.', deltas: fx({ confidence: -3 }, { hockey: -6 }), memory: { id: 'skates', emotion: 'sadness' } }],
          }),
          anger: lead([L('narrator', '(Riley stares out of the window the whole way. Arms folded. Jaw tight.)')], fx({ family: -3 }, { family: -3 })),
        },
        game: flavor(
          ['Dad’s careful face', 'Quitting talk', 'The empty radio'],
          [['Say you’ll quit', true], ['Tell Dad how it felt', false], ['Silent treatment', true], ['Ask for fries', false]],
          'Can we not talk about it?!',
          'Dad loved watching her play tonight.',
          [['Failure', 'Close game'], ['Quit', 'Try again'], ['Alone', 'Dad came']],
        ),
      },
    ],
    memory: {
      id: 'sc-game',
      title: 'The post',
      text: 'Ten seconds left. Off the post.',
      island: 'hockey',
      significance: 'important',
      when: 'Week six, Saturday',
      script: {
        kit: 'rink',
        dur: 7,
        actors: [{ who: 'riley', keys: [[0, 0.3, 'skate', 1, 'calm'], [3, 0.7, 'shoot', 1, 'calm'], [4.5, 0.74, 'slump', 1, 'sad']] }],
        props: [{ what: 'puck', keys: [[0, 0.36, 0.86], [3, 0.74, 0.86], [4, 0.95, 0.72], [7, 0.95, 0.72]] }],
        captions: [{ t: 0, text: 'Ten seconds.' }, { t: 4, text: 'Clang.' }],
      },
      lens: {
        joy: 'The best shot of her life. The post just didn’t know it.',
        sadness: 'So close. So, so close.',
        anger: 'THE POST.',
        fear: 'What if she always misses when it matters?',
        disgust: 'The ice on that side was a disgrace.',
      },
      detail: { label: 'The post', text: 'There’s a tiny dent where the puck hit.', x: 0.92, y: 0.72 },
    },
  },

  // ─────────────────────────── Day 6: left out ───────────────────────────
  {
    id: 'excluded',
    day: 6,
    title: 'Left out',
    summary: 'A party photo in the class group chat. Everyone’s there. Riley wasn’t invited.',
    islands: ['friendship', 'goofball'],
    intro: {
      kit: 'bedroom',
      dur: 10,
      night: true,
      actors: [{ who: 'riley', keys: [[0, 0.74, 'phone', -1, 'happy'], [4, 0.74, 'phone', -1, 'shock'], [7, 0.74, 'slump', -1, 'sad']] }],
      props: [{ what: 'phoneProp', keys: [[0, 0.4, 0.5, 2.2, 0, 0], [4, 0.4, 0.5, 2.2, 0, 1], [10, 0.4, 0.5, 2.2, 0, 1]] }],
      captions: [
        { t: 0, text: 'Saturday night. Her phone buzzes.' },
        { t: 4, text: 'A photo from Maya’s party. The whole class. Cake, balloons.' },
        { t: 7, text: 'She wasn’t invited.' },
      ],
    },
    afterIntro: (f) => [
      ...(f.sleepover || f.invitedPriya ? [L('joy', 'Wait! Priya isn’t in the photo either.')] : []),
      ...(f.keptInTouch ? [L('sadness', 'We could tell Dani. She always gets it.')] : []),
      L('disgust', 'A party. Without us. The audacity.'),
    ],
    moments: [
      {
        id: 'ex-photo',
        title: 'The photo',
        prompt: 'The photo sits in the group chat. People are adding party emojis.',
        situation: () => [L('riley', '(She zooms in. Theo’s there. Even Theo.)')],
        screen: { kit: 'bedroom', dur: 6, night: true, actors: [{ who: 'riley', keys: [[0, 0.74, 'phone', -1, 'sad']] }], props: [{ what: 'phoneProp', keys: [[0, 0.4, 0.5, 2.2]] }] },
        effects: {
          joy: fx({ balance: -1, belonging: 1 }),
          sadness: fx({ confidence: -1, family: 1 }),
          anger: fx({ confidence: 1, friendship: -1 }),
          fear: fx({ confidence: -1 }),
          disgust: fx({ confidence: 1, belonging: -1 }),
        },
        lead: {
          joy: lead([L('riley', '(She types “looks fun!!” and adds three hearts.)')], fx({ belonging: 1, balance: -3 })),
          sadness: lead([L('narrator', '(Riley cries quietly. Mum hears and comes in.)'), L('mum', 'Oh, love. Do you want to tell me?')], fx({ family: 5, confidence: -1 }, { family: 4 })),
          anger: lead([L('riley', 'That really stung. I’m allowed to be annoyed about it.'), L('narrator', '(She writes it all down in her notebook instead of the chat. Then she feels lighter.)')], fx({ confidence: 5, balance: 2 })),
          fear: lead([L('riley', '(Did she do something wrong? Is it the show? Is it the lunch thing? Is it her?)')], fx({ confidence: -5, belonging: -3 })),
          disgust: lead([L('riley', 'Balloons. In this economy.'), L('narrator', '(She puts her phone face-down. Their loss.)')], fx({ confidence: 3, belonging: -1 })),
        },
        blends: [
          {
            id: 'reach-out',
            when: { sadness: 1, joy: 1 },
            lines: [L('riley', '(She texts Priya instead.) Hey, want to do something tomorrow?'), L('priya', 'YES. Also I wasn’t invited either. Their loss.')],
            deltas: fx({ friendship: 8, belonging: 4 }, { friendship: 6 }),
            flags: ['priyaPlan'],
          },
          {
            id: 'call-dani',
            when: { sadness: 1, fear: 1 },
            lines: [L('riley', '(She calls Dani.) Is it weird that I feel so left out?'), L('dani', 'Not weird. They don’t know you yet. They will.')],
            deltas: fx({ friendship: 6, confidence: 3 }, { friendship: 5 }),
            flags: ['keptInTouch', 'daniRepaired'],
          },
        ],
        overload: {
          anger: lead([L('riley', '(She types “thanks for the invite NOT” and hits send before anyone can stop her.)')], fx({ friendship: -3, belonging: -6 }, { friendship: -6 }), {
            flags: ['angryText'],
            later: [{ inDays: 1, id: 'ex-text', tone: 'bad', text: 'Someone screenshotted Riley’s message. Now it’s in three other group chats.', deltas: fx({ belonging: -5, confidence: -3 }, { friendship: -5 }) }],
          }),
          fear: lead([L('narrator', '(Riley lies awake until two in the morning replaying every conversation she’s ever had.)')], fx({ confidence: -4, balance: -2 })),
        },
        game: flavor(
          ['The send button', 'The party emojis', 'Who else is missing'],
          [['Send an angry reply', true], ['Put the phone down', false], ['Pretend it looks fun', true], ['Text Priya', false]],
          'That stung. I’m allowed to be annoyed!',
          'She’s scared she’ll never be invited to anything here.',
          [['Left out', 'Not their loss'], ['Nobody', 'Priya'], ['Forgotten', 'New here']],
        ),
      },
      {
        id: 'ex-monday',
        title: 'Monday morning',
        prompt: 'Maya waves at Riley in the corridor like nothing happened.',
        situation: (f) => [L('kidA', 'Hey Riley! Love your hoodie.'), ...(f.angryText ? [L('fear', 'She’s seen the message. Everyone’s seen the message.')] : [])],
        screen: { kit: 'hallway', dur: 6, actors: [{ who: 'kidA', keys: [[0, 0.62, 'wave', -1, 'happy']] }, { who: 'kidB', keys: [[0, 0.78, 'stand', -1, 'calm']] }, { who: 'riley', keys: [[0, 0.32, 'stand', 1, 'calm']] }] },
        effects: {
          joy: fx({ belonging: 1 }),
          sadness: fx({ friendship: 1, confidence: -1 }),
          anger: fx({ confidence: 1, belonging: -1 }),
          fear: fx({ confidence: -1 }),
          disgust: fx({ confidence: 1 }),
        },
        lead: {
          joy: lead([L('riley', 'Thanks! Did you have a good party?'), L('kidA', 'Oh. Um, yeah. It was small, honestly. Sorry, I didn’t think...')], fx({ belonging: 3, confidence: 1 })),
          sadness: lead([L('riley', 'It kind of hurt, seeing the photo.'), L('kidA', 'Oh. I’m really sorry. My mum only let me invite ten people.')], fx({ belonging: 4, friendship: 2, confidence: 1 })),
          anger: lead([L('riley', 'Oh, NOW you notice me?'), L('kidA', 'Okay, wow. Bye then.')], fx({ belonging: -4, confidence: 2 })),
          fear: lead([L('riley', '(She mumbles “thanks” and walks really fast in the wrong direction.)')], fx({ confidence: -3 })),
          disgust: lead([L('riley', 'Thanks. (She keeps walking, straight to Priya.) Morning!'), L('priya', 'Morning! Sit with me in maths?')], fx({ confidence: 4, friendship: 5 }, { friendship: 5 })),
        },
        blends: [
          {
            id: 'grace',
            when: { sadness: 1, disgust: 1 },
            lines: [L('riley', 'Thanks. Honestly, it stung a bit not being invited. But it’s fine.'), L('kidA', 'That’s fair. Next time, okay? For real.')],
            deltas: fx({ belonging: 6, confidence: 4 }, { friendship: 4 }),
          },
          {
            id: 'easy-joy',
            when: { joy: 1, disgust: 1 },
            lines: [L('riley', 'Thanks! It’s my favourite. Got to go, Priya’s saving me a seat.'), L('narrator', '(She doesn’t chase them. She doesn’t need to.)')],
            deltas: fx({ confidence: 5, belonging: 3, friendship: 3 }, { friendship: 4, goofball: 3 }),
          },
        ],
        overload: {
          disgust: lead([L('riley', '(She looks Maya up and down and walks off without a word.)')], fx({ belonging: -5 }, { friendship: -3 })),
          joy: lead([L('riley', 'Thanks! I love YOUR hoodie! I love everything! Let’s be best friends!'), L('kidA', '...Okay?')], fx({ belonging: -1, balance: -2 })),
        },
        game: flavor(
          ['Maya’s smile', 'The other girls watching', 'Saying too much'],
          [['Pretend nothing happened', true], ['Say it stung', false], ['Snap at her', true], ['Go and find Priya', false]],
          'Oh, NOW you notice me?',
          'Maya didn’t mean to leave anyone out.',
          [['Not invited', 'Next time'], ['Awkward', 'Honest'], ['Alone', 'Priya’s seat']],
        ),
      },
    ],
    memory: {
      id: 'sc-excluded',
      title: 'The party photo',
      text: 'Everyone in one picture. Except her.',
      island: 'friendship',
      significance: 'important',
      when: 'Week six, Saturday night',
      script: { kit: 'bedroom', dur: 7, night: true, actors: [{ who: 'riley', keys: [[0, 0.74, 'phone', -1, 'sad']] }], props: [{ what: 'phoneProp', keys: [[0, 0.4, 0.5, 2.2]] }], captions: [{ t: 0, text: 'Balloons. Cake. Everyone.' }] },
      lens: {
        joy: 'Priya wasn’t there either. Their loss, both of them.',
        sadness: 'Being left out hurts even when it’s nobody’s fault.',
        anger: 'It WAS rude. She was allowed to be annoyed.',
        fear: 'What if it happens every time?',
        disgust: 'Balloons in this economy.',
      },
      detail: { label: 'The photo', text: 'Theo is making a face like he wants to leave.', x: 0.4, y: 0.45 },
    },
  },
];

export const SCENARIO_BY_DAY: Record<number, ScenarioDef> = Object.fromEntries(SCENARIOS.map((s) => [s.day, s]));
export const LAST_DAY = Math.max(...SCENARIOS.map((s) => s.day));

/** Scenario memories become full memory entries once they're made. */
export function scenarioMemoryEntry(sc: ScenarioDef, emotion: EmotionId): MemoryEntry {
  return { ...sc.memory, emotion, start: 'long-term', hidden: sc.memory.lens.sadness, script: sc.memory.script };
}
