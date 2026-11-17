import type { EmotionId, SpeakerId } from './emotions';
import type { Line } from '../scenario/artClub';

/** 'self' is replaced by whoever the player is currently controlling. */
export type TalkLine = { speaker: SpeakerId | 'self'; text: string };

export const resolveLines = (lines: TalkLine[], self: EmotionId): Line[] =>
  lines.map((l) => ({ speaker: l.speaker === 'self' ? self : l.speaker, text: l.text }));

export const INTRO: Line[] = [
  { speaker: 'joy', text: 'There you are! Welcome to Headquarters, Operator.' },
  { speaker: 'joy', text: 'This is the inside of Riley’s mind. Everything she feels gets steered from right here.' },
  { speaker: 'sadness', text: 'Hi. I’m Sadness. I help Riley understand how people feel. Including herself.' },
  { speaker: 'anger', text: 'Anger. I make sure nobody walks all over her. Nice to meet you. I guess.' },
  { speaker: 'fear', text: 'Fear! Hello! I keep Riley safe from hazards. And risks. And most things, honestly.' },
  { speaker: 'disgust', text: 'Disgust. I keep her away from anything gross, unfair or tacky. It is a full-time job.' },
  { speaker: 'joy', text: 'And I’m Joy! I help her find the good stuff.' },
  { speaker: 'joy', text: 'Switch between us any time with keys 1 to 5, or the mood dial at the bottom. Whoever’s glowing is who you control.' },
  { speaker: 'joy', text: 'Walk with A and D or the arrow keys, or just click the floor. Press E to interact, and Q to use your emotion’s ability.' },
  { speaker: 'joy', text: 'Riley’s first day at art club is about to start. Pick someone, then head to the console in the middle!' },
];

export const NPC_TALK: Record<EmotionId, { pre: TalkLine[][]; post: TalkLine[][]; hidden: string }> = {
  joy: {
    pre: [
      [
        { speaker: 'joy', text: 'Art club! New friends! Paint! I have a really good feeling about today.' },
        { speaker: 'self', text: 'You have a good feeling about every day.' },
        { speaker: 'joy', text: 'And I’m right about sixty percent of the time!' },
      ],
      [{ speaker: 'joy', text: 'Tip: the console works best when the right one of us is driving. But everyone gets a turn.' }],
    ],
    post: [
      [{ speaker: 'joy', text: 'Did you SEE that cat? Riley has a friend! Friendship Island is going to be so happy.' }],
      [{ speaker: 'joy', text: 'Have you tried everyone’s abilities around HQ? There’s a lamp I’ve been dying to fix.' }],
    ],
    hidden: 'Joy is scared that if she stops smiling, everything else will fall apart.',
  },
  sadness: {
    pre: [
      [
        { speaker: 'sadness', text: 'I keep thinking about Riley’s old friends. They’re probably having lunch right now.' },
        { speaker: 'sadness', text: 'Sorry. I know today is supposed to be exciting.' },
      ],
      [{ speaker: 'sadness', text: 'When someone goes quiet, it doesn’t always mean they’re fine. That’s my area.' }],
    ],
    post: [
      [{ speaker: 'sadness', text: 'Priya was new too. I’m glad we noticed.' }],
      [{ speaker: 'sadness', text: 'Some memories in Long-Term are fading. Not all of that is bad. Some of it is a bit sad, though.' }],
    ],
    hidden: 'Sadness worries she only ever gets in the way. She doesn’t.',
  },
  anger: {
    pre: [
      [
        { speaker: 'anger', text: 'New school, new kids. If anyone tries something, I’m ready.' },
        { speaker: 'self', text: 'Nobody’s tried anything.' },
        { speaker: 'anger', text: 'YET.' },
      ],
      [{ speaker: 'anger', text: 'That balcony door has been jammed for a week. Nobody asks me to fix things. I could fix things.' }],
    ],
    post: [
      [{ speaker: 'anger', text: '“Actually, that was my idea.” Chills. That’s the stuff.' }],
      [{ speaker: 'anger', text: 'Standing up for yourself isn’t yelling. Mostly. I’m working on it.' }],
    ],
    hidden: 'Anger gets loud because he’s worried nobody will stand up for Riley if he doesn’t.',
  },
  fear: {
    pre: [
      [
        { speaker: 'fear', text: 'I’ve made a list of everything that could go wrong at art club.' },
        { speaker: 'fear', text: 'It’s forty pages. Single spaced. Want to read it?' },
      ],
      [{ speaker: 'fear', text: 'There’s a cable on the floor over there that is just BEGGING to trip someone.' }],
    ],
    post: [
      [{ speaker: 'fear', text: 'We survived! Nobody fell. Nobody spilled. I’m going to lie down.' }],
      [{ speaker: 'fear', text: 'Careful near the cliff edge at Personality Islands. I put up signs. In my mind.' }],
    ],
    hidden: 'Fear secretly wonders if he’s actually useful, or just annoying.',
  },
  disgust: {
    pre: [
      [
        { speaker: 'disgust', text: 'Have you seen the art room carpet? Don’t. Save yourself.' },
        { speaker: 'self', text: 'It can’t be that bad.' },
        { speaker: 'disgust', text: 'There is a crayon fossil in it.' },
      ],
      [{ speaker: 'disgust', text: 'And someone let a bad idea float around HQ. Ugh. It’s dripping on the floor.' }],
    ],
    post: [
      [{ speaker: 'disgust', text: 'We said no to Theo and kept a friend. That’s called having standards. Look it up.' }],
      [{ speaker: 'disgust', text: 'Boundaries are just good taste, applied to people.' }],
    ],
    hidden: 'Disgust acts too cool to care, but she cares a LOT about Riley fitting in.',
  },
};

export const MANUAL_PAGES: Line[] = [
  { speaker: 'console', text: 'Mind Manual, page 1: The operator chooses which emotion drives. Keys 1 to 5 or the mood dial.' },
  { speaker: 'console', text: 'Page 2: Each emotion has an ability (Q). Joy brightens. Sadness listens. Anger breaks through. Fear scans. Disgust rejects.' },
  { speaker: 'console', text: 'Page 3: Big moments become core memories. Core memories power Personality Islands.' },
  { speaker: 'console', text: 'Page 4: Long-Term Memory stores everything else. Faded memories can sometimes be brightened again.' },
  { speaker: 'console', text: 'Page 5: Press M for the mind map. Press Esc to pause. Press H for controls.' },
];

export const SHELF_TALK: Record<EmotionId, string> = {
  joy: 'Today’s memories! Look at all that yellow. Well, mostly yellow.',
  sadness: 'Some of these are already turning a little blue. That’s okay.',
  anger: 'Who keeps putting red ones on the top shelf? ...Oh. Me.',
  fear: 'If one of these rolls off, it’s gone forever. Nobody breathe.',
  disgust: 'At least they’re colour-coordinated.',
};
