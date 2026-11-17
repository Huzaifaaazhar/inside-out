import type { EmotionId, SpeakerId } from '../content/emotions';

export interface Line {
  speaker: SpeakerId;
  text: string;
}

export type Tone = 'great' | 'okay' | 'rough';

export interface Outcome {
  tone: Tone;
  lines: Line[];
}

/** What Riley's view shows on the big HQ screen for a beat. */
export interface ScreenSetup {
  theo: 'none' | 'painting' | 'offering' | 'shouting' | 'sheepish';
  priya: 'none' | 'painting' | 'quiet' | 'smiling';
  teacher: boolean;
  jar: boolean;
  catSketch: boolean;
  cloudCat: boolean;
  smudge: boolean;
}

export interface Beat {
  id: string;
  title: string;
  /** One-line prompt shown while the player chooses who drives. */
  prompt: string;
  best: EmotionId;
  hint: string;
  situation: Line[];
  screen: ScreenSetup;
  /** Mini-game flavour per ability. Coordinates are 0..1 inside the screen. */
  fear: { hazards: { x: number; y: number; label: string }[] };
  disgust: { items: { label: string; bad: boolean }[] };
  anger: { line: string };
  sadness: { thought: string };
  joy: { clouds: { gloom: string; bright: string }[] };
  outcomes: Record<EmotionId, Outcome>;
}

const base: ScreenSetup = { theo: 'painting', priya: 'painting', teacher: true, jar: false, catSketch: false, cloudCat: false, smudge: false };

export const ART_CLUB: { title: string; intro: Line[]; beats: Beat[]; finale: Line[] } = {
  title: 'First day at art club',
  intro: [
    { speaker: 'joy', text: 'Okay, team! Riley is about to walk into art club for the very first time.' },
    { speaker: 'fear', text: 'New room. New kids. New smells. What could possibly go wrong? Everything. Everything could.' },
    { speaker: 'joy', text: 'Operator, this is where you come in. Each moment, you pick who drives. Then they use their ability on the console.' },
    { speaker: 'sadness', text: "There isn't one right answer. But some of us fit some moments better." },
  ],
  beats: [
    {
      id: 'doorway',
      title: 'The doorway',
      prompt: 'Riley is in the doorway. The room is busy and cluttered.',
      best: 'fear',
      hint: 'Fear is good at spotting trouble before it happens.',
      situation: [
        { speaker: 'riley', text: '(Okay. Art club. Room 14B. Everyone’s already painting.)' },
        { speaker: 'teacher', text: 'Come on in! Grab any spot you like.' },
        { speaker: 'disgust', text: 'Every surface in there is sticky. I can tell from here.' },
      ],
      screen: { ...base, jar: true },
      fear: {
        hazards: [
          { x: 0.16, y: 0.66, label: 'Wobbly paint jar' },
          { x: 0.62, y: 0.88, label: 'Wet floor' },
          { x: 0.86, y: 0.7, label: 'Stool leg' },
        ],
      },
      disgust: {
        items: [
          { label: 'Sticky stool', bad: true },
          { label: 'Clean seat by the window', bad: false },
          { label: 'Puddle of turps', bad: true },
          { label: 'Wave hello', bad: false },
        ],
      },
      anger: { line: 'Make way, new kid coming through!' },
      sadness: { thought: 'Everyone else knows where to sit.' },
      joy: {
        clouds: [
          { gloom: 'Strangers', bright: 'Future friends' },
          { gloom: 'Messy', bright: 'Colourful' },
          { gloom: 'Late', bright: 'Grand entrance' },
          { gloom: 'Smelly', bright: 'Smells like art' },
        ],
      },
      outcomes: {
        fear: {
          tone: 'great',
          lines: [
            { speaker: 'fear', text: 'Jar: wobbly. Floor: wet. Stool: ankle-eater. Navigating...' },
            { speaker: 'riley', text: '(Riley steps around the lot and slides into a seat. Smooth.)' },
            { speaker: 'teacher', text: 'Nice moves. Careful of that jar, it’s been on the edge all week.' },
          ],
        },
        joy: {
          tone: 'okay',
          lines: [
            { speaker: 'riley', text: 'Hi everyone! (Big wave. Her elbow catches the paint jar. She catches it. Mostly.)' },
            { speaker: 'joy', text: 'Totally meant to do that. Juggling! We juggle now.' },
          ],
        },
        sadness: {
          tone: 'okay',
          lines: [
            { speaker: 'riley', text: '(Riley hovers by the door, unsure.)' },
            { speaker: 'teacher', text: 'Hey, it’s okay. First days are weird. There’s a spot right here.' },
            { speaker: 'sadness', text: 'She noticed us. That was kind.' },
          ],
        },
        anger: {
          tone: 'rough',
          lines: [
            { speaker: 'riley', text: '(Riley marches in like she owns the place. The jar wobbles. A stool scrapes.)' },
            { speaker: 'theo', text: 'Whoa. Okay. Hi?' },
            { speaker: 'anger', text: 'What? I made an entrance.' },
          ],
        },
        disgust: {
          tone: 'okay',
          lines: [
            { speaker: 'riley', text: '(Riley skips the sticky stool and picks the clean seat by the window.)' },
            { speaker: 'disgust', text: 'Good light. No goo. You’re welcome.' },
          ],
        },
      },
    },
    {
      id: 'swap',
      title: 'The swap',
      prompt: 'Theo wants Riley to finish his drawing for him.',
      best: 'disgust',
      hint: 'Disgust knows where the line is.',
      situation: [
        { speaker: 'theo', text: 'Psst. New kid. Finish my volcano and I’ll give you my pudding cup.' },
        { speaker: 'theo', text: 'Also can you copy my maths homework later? You look smart.' },
        { speaker: 'joy', text: 'He likes us! ...Does he like us?' },
      ],
      screen: { ...base, theo: 'offering' },
      fear: {
        hazards: [
          { x: 0.38, y: 0.55, label: 'Pudding bribe' },
          { x: 0.5, y: 0.78, label: 'His homework' },
          { x: 0.22, y: 0.35, label: 'Teacher watching' },
        ],
      },
      disgust: {
        items: [
          { label: 'Finish his drawing', bad: true },
          { label: 'Lend him a brush', bad: false },
          { label: 'Copy his homework', bad: true },
          { label: 'Pudding bribe', bad: true },
          { label: 'Tell him your name', bad: false },
        ],
      },
      anger: { line: 'Do your own volcano!' },
      sadness: { thought: 'He’s scared he can’t draw.' },
      joy: {
        clouds: [
          { gloom: 'Used', bright: 'Noticed' },
          { gloom: 'Awkward', bright: 'Funny' },
          { gloom: 'Pressure', bright: 'A chat' },
        ],
      },
      outcomes: {
        disgust: {
          tone: 'great',
          lines: [
            { speaker: 'riley', text: 'Nope. You can borrow my good brush, though. I’m Riley.' },
            { speaker: 'theo', text: 'Fair. I’m Theo. The pudding was expired anyway.' },
            { speaker: 'disgust', text: 'A boundary AND a brush. Elegant.' },
          ],
        },
        anger: {
          tone: 'okay',
          lines: [
            { speaker: 'riley', text: 'Do your own volcano!' },
            { speaker: 'theo', text: 'Okay, okay! Jeez.' },
            { speaker: 'anger', text: 'Clear message. Maybe a little loud.' },
          ],
        },
        joy: {
          tone: 'rough',
          lines: [
            { speaker: 'riley', text: 'Sure! I love volcanoes! (Riley is now drawing two pictures.)' },
            { speaker: 'disgust', text: 'We are not his art servant. Note that for next time.' },
          ],
        },
        fear: {
          tone: 'okay',
          lines: [
            { speaker: 'riley', text: 'Um, I don’t think Ms. Okafor would like that.' },
            { speaker: 'theo', text: 'Ugh, fine. You’re probably right.' },
          ],
        },
        sadness: {
          tone: 'okay',
          lines: [
            { speaker: 'riley', text: 'Do you not like drawing volcanoes?' },
            { speaker: 'theo', text: '...They always come out looking like sad hats.' },
            { speaker: 'sadness', text: 'He just needed someone to ask.' },
          ],
        },
      },
    },
    {
      id: 'idea',
      title: 'The idea',
      prompt: 'Theo just shouted Riley’s idea as his own.',
      best: 'anger',
      hint: 'Anger stands up when something isn’t fair.',
      situation: [
        { speaker: 'teacher', text: 'Group project! We’re painting a mural. Any ideas?' },
        { speaker: 'riley', text: '(whispering) What about a giant cat made of clouds?' },
        { speaker: 'theo', text: 'MS. OKAFOR! I’ve got one! A cloud cat!' },
        { speaker: 'anger', text: 'Excuse me?! That was OUR cat!' },
      ],
      screen: { ...base, theo: 'shouting', catSketch: true },
      fear: {
        hazards: [
          { x: 0.33, y: 0.42, label: 'Theo, mid-shout' },
          { x: 0.55, y: 0.7, label: 'Riley’s sketch' },
          { x: 0.8, y: 0.38, label: 'Whole class looking' },
        ],
      },
      disgust: {
        items: [
          { label: 'Let it slide', bad: true },
          { label: 'Say “that was my idea”', bad: false },
          { label: 'Sulk all lesson', bad: true },
          { label: 'Show the sketch', bad: false },
        ],
      },
      anger: { line: 'Actually, that was my idea.' },
      sadness: { thought: 'He wanted to be the one with a good idea.' },
      joy: {
        clouds: [
          { gloom: 'Stolen', bright: 'Popular idea' },
          { gloom: 'Invisible', bright: 'Worth stealing' },
          { gloom: 'Unfair', bright: 'Prove it' },
        ],
      },
      outcomes: {
        anger: {
          tone: 'great',
          lines: [
            { speaker: 'riley', text: 'Actually, that was my idea. I drew it here.' },
            { speaker: 'theo', text: '...Yeah. It was hers. Sorry. It’s just really good.' },
            { speaker: 'teacher', text: 'Then Riley leads the cloud cat. Thanks for speaking up.' },
            { speaker: 'anger', text: 'Firm. Fair. Nobody got set on fire. Personal best.' },
          ],
        },
        disgust: {
          tone: 'okay',
          lines: [
            { speaker: 'riley', text: 'Um. Wow. That’s literally what I just said.' },
            { speaker: 'theo', text: 'Okay, okay, it was hers.' },
          ],
        },
        joy: {
          tone: 'rough',
          lines: [
            { speaker: 'riley', text: '(Riley smiles and says nothing. Theo gets a gold star.)' },
            { speaker: 'anger', text: 'A GOLD STAR. For OUR CAT.' },
            { speaker: 'joy', text: 'At least the cat is happening?' },
          ],
        },
        fear: {
          tone: 'rough',
          lines: [
            { speaker: 'riley', text: '(Riley sinks lower in her chair. Better not make a fuss.)' },
            { speaker: 'fear', text: 'No conflict. Totally safe. Why do I feel worse?' },
          ],
        },
        sadness: {
          tone: 'okay',
          lines: [
            { speaker: 'riley', text: 'That... kind of hurt. It was my idea.' },
            { speaker: 'theo', text: 'Oh. Sorry. You’re right. You should do it.' },
          ],
        },
      },
    },
    {
      id: 'quiet',
      title: 'The quiet corner',
      prompt: 'Priya’s painting got smudged. She hasn’t said anything.',
      best: 'sadness',
      hint: 'Sadness can tell what someone is really feeling.',
      situation: [
        { speaker: 'riley', text: '(The girl next to Riley, Priya, is staring at a big smudge across her painting.)' },
        { speaker: 'priya', text: 'It’s fine. It’s whatever.' },
        { speaker: 'fear', text: 'Is it fine? It doesn’t look fine. I can never tell!' },
      ],
      screen: { ...base, theo: 'sheepish', priya: 'quiet', smudge: true },
      fear: {
        hazards: [
          { x: 0.68, y: 0.6, label: 'The smudge' },
          { x: 0.74, y: 0.36, label: 'Wobbly chin' },
          { x: 0.45, y: 0.82, label: 'Spilled water' },
        ],
      },
      disgust: {
        items: [
          { label: 'Ignore her', bad: true },
          { label: 'Ask if she’s okay', bad: false },
          { label: '“It looks bad”', bad: true },
          { label: 'Sit with her', bad: false },
        ],
      },
      anger: { line: 'Who smudged it?! I’ll find them!' },
      sadness: { thought: 'I worked on it all week. And I’m new too.' },
      joy: {
        clouds: [
          { gloom: 'Ruined', bright: 'Happy accident' },
          { gloom: 'Alone', bright: 'Two new kids' },
          { gloom: 'Smudge', bright: 'Storm cloud!' },
        ],
      },
      outcomes: {
        sadness: {
          tone: 'great',
          lines: [
            { speaker: 'riley', text: 'You worked really hard on that. That stinks.' },
            { speaker: 'priya', text: '...Yeah. All week. And I only started here last month.' },
            { speaker: 'riley', text: 'I started today. So you’re basically the expert.' },
            { speaker: 'priya', text: '(She laughs. Just a little.)' },
            { speaker: 'sadness', text: 'Sometimes you just need someone to sit in it with you.' },
          ],
        },
        joy: {
          tone: 'okay',
          lines: [
            { speaker: 'riley', text: 'Ooh, it looks like a storm cloud now! That’s cool!' },
            { speaker: 'priya', text: 'It’s... supposed to be a horse.' },
            { speaker: 'joy', text: 'A storm horse! ...Too soon?' },
          ],
        },
        anger: {
          tone: 'rough',
          lines: [
            { speaker: 'riley', text: 'Who did this?! Theo?!' },
            { speaker: 'theo', text: 'It was an accident! I said sorry!' },
            { speaker: 'priya', text: 'It’s fine, just... stop.' },
          ],
        },
        fear: {
          tone: 'okay',
          lines: [
            { speaker: 'riley', text: 'Do you want a paper towel? Before it dries?' },
            { speaker: 'priya', text: 'Oh. Yeah. Thanks.' },
          ],
        },
        disgust: {
          tone: 'okay',
          lines: [
            { speaker: 'riley', text: 'Ugh, that smudge is SO not your fault.' },
            { speaker: 'priya', text: 'Thanks. It’s still annoying.' },
          ],
        },
      },
    },
    {
      id: 'together',
      title: 'Together',
      prompt: 'Priya asks if Riley wants to paint the cloud cat together.',
      best: 'joy',
      hint: 'Joy turns a moment into something golden.',
      situation: [
        { speaker: 'priya', text: 'Hey. Do you want to paint the cloud cat together? I can do the whiskers.' },
        { speaker: 'joy', text: 'Oh. Oh! This is it. This is the moment.' },
        { speaker: 'fear', text: 'What if we paint the cat wrong? What if the cat is bad?' },
      ],
      screen: { ...base, theo: 'painting', priya: 'smiling', cloudCat: true },
      fear: {
        hazards: [
          { x: 0.5, y: 0.4, label: 'Paint splash zone' },
          { x: 0.3, y: 0.75, label: 'Tipping water pot' },
          { x: 0.75, y: 0.75, label: 'Dripping brush' },
        ],
      },
      disgust: {
        items: [
          { label: 'Paint together', bad: false },
          { label: '“I work alone”', bad: true },
          { label: 'Share the good blue', bad: false },
          { label: 'Hog the cat', bad: true },
        ],
      },
      anger: { line: 'Let’s make the BIGGEST cat this school has ever seen!' },
      sadness: { thought: 'I hope she wants to be friends.' },
      joy: {
        clouds: [
          { gloom: 'New town', bright: 'New friend' },
          { gloom: 'Nervous', bright: 'Excited' },
          { gloom: 'Smudged', bright: 'Storm cat!' },
          { gloom: 'Alone', bright: 'Together' },
          { gloom: 'Messy', bright: 'Masterpiece' },
        ],
      },
      outcomes: {
        joy: {
          tone: 'great',
          lines: [
            { speaker: 'riley', text: 'YES. I’ll do the cloud-fluff. You do whiskers. Theo can do the sky.' },
            { speaker: 'priya', text: 'Theo, you’re on sky duty!' },
            { speaker: 'theo', text: 'Finally, a job I can’t mess up.' },
            { speaker: 'joy', text: 'Everybody, look. Look what’s happening.' },
          ],
        },
        sadness: {
          tone: 'okay',
          lines: [
            { speaker: 'riley', text: 'I’d really like that. I’ve missed painting with someone.' },
            { speaker: 'priya', text: 'Me too.' },
          ],
        },
        anger: {
          tone: 'okay',
          lines: [
            { speaker: 'riley', text: 'Let’s make it ENORMOUS!' },
            { speaker: 'priya', text: 'Wall-sized! Yes!' },
          ],
        },
        fear: {
          tone: 'okay',
          lines: [
            { speaker: 'riley', text: 'Okay! Let’s put newspaper down first, though.' },
            { speaker: 'priya', text: 'Smart. Ms. Okafor will love you.' },
          ],
        },
        disgust: {
          tone: 'okay',
          lines: [
            { speaker: 'riley', text: 'Only if we use the good brushes. Not the crunchy ones.' },
            { speaker: 'priya', text: 'Obviously. The crunchy ones are criminal.' },
          ],
        },
      },
    },
  ],
  finale: [
    { speaker: 'joy', text: 'Everyone, look! A new core memory!' },
    { speaker: 'sadness', text: 'It has a little bit of all of us in it.' },
    { speaker: 'anger', text: 'Mostly me, obviously.' },
    { speaker: 'joy', text: 'Operator, carry it to the core memory holder. It’s on the left, past the shelves.' },
  ],
};

export const TONE_LABEL: Record<Tone, string> = {
  great: 'Perfect fit',
  okay: 'It worked out',
  rough: 'A bit bumpy',
};
