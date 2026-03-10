import type { Paper, Section } from './papers';

const LOCAL_ASSET_BASE = '/local-paper-assets/paper-assets';
const LISTENING_AUDIO_URL = 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663325188422/LiBhwFnCzcNfOBcL.mp3';
const WRITING_PART_2_PAGE = `${LOCAL_ASSET_BASE}/pet-writing-part-2-notice.png`;

const LISTENING_OPTION_IMAGES: Record<string, string> = {
  'q1-a': 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663325188422/HZeASSFioTBMYTZH.png',
  'q1-b': 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663325188422/mBgmICSTPpGpNQpJ.png',
  'q1-c': 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663325188422/skaszYIBlePwYfwf.png',
  'q2-a': 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663325188422/bzFqOUtEUWRjsVrO.png',
  'q2-b': 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663325188422/rsQnFNzoxMWRdrWD.png',
  'q2-c': 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663325188422/ccyiCZOMPulfxJkF.png',
  'q3-a': 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663325188422/HgoIkgMXkTmHwSJz.png',
  'q3-b': 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663325188422/lShBRdxjrHBLRuiI.png',
  'q3-c': 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663325188422/nDJQedcrVJUgUYiX.png',
  'q4-a': 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663325188422/TmdTvjnYKyvvxxbG.png',
  'q4-b': 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663325188422/UOIwWrxTjhubwqEW.png',
  'q4-c': 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663325188422/bXyXAVjcJMeNnWZX.png',
  'q5-a': 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663325188422/cHWslIHwqVSxcNgl.png',
  'q5-b': 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663325188422/MMydQfnDSmoETPyG.png',
  'q5-c': 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663325188422/zOcYADVCLceocnOz.png',
  'q6-a': 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663325188422/AQOZubrHknjWXwgd.png',
  'q6-b': 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663325188422/XJxccySQjWsrxRTg.png',
  'q6-c': 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663325188422/vMTrvpTHnlzbYPnj.png',
  'q7-a': 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663325188422/NxYOPQJrKsyZPzGA.png',
  'q7-b': 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663325188422/clrJjENmRDrvXzwH.png',
  'q7-c': 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663325188422/YsguXPUvzbMTpgdT.png',
};

function listeningOptionImage(questionNumber: number, label: 'a' | 'b' | 'c'): string {
  return LISTENING_OPTION_IMAGES[`q${questionNumber}-${label}`] || '';
}

const restaurantOptions = [
  'Marina',
  'Salt and pepper',
  "Michael's",
  'Reds and Company',
  'Clowns',
  'The Cinnamon',
  "O'Neill's",
  'The Blue Boat',
];

const sections: Section[] = [
  {
    id: 'vocabulary-part-1-adjectives',
    title: 'Vocabulary Part 1A',
    subtitle: 'Choose the adjective',
    icon: '📚',
    color: 'text-[oklch(0.55_0.16_160)]',
    bgColor: 'bg-[oklch(0.95_0.04_160)]',
    description: 'Original instruction: Complete the sentences with one adjective from A and one noun from B. Digital step 1: fill in the adjective blanks.',
    wordBank: [
      { letter: 'A', word: 'cosy' },
      { letter: 'B', word: 'crowded' },
      { letter: 'C', word: 'disappointed' },
      { letter: 'D', word: 'worried' },
      { letter: 'E', word: 'freezing' },
      { letter: 'F', word: 'serious' },
      { letter: 'G', word: 'surprised' },
      { letter: 'H', word: 'traditional' },
    ],
    questions: [
      {
        id: 1,
        type: 'fill-blank',
        question: 'I was ___ with my exam results - I was expecting to get better grades.',
        correctAnswer: 'disappointed',
      },
      {
        id: 2,
        type: 'fill-blank',
        question: 'How can you wear a cotton top in this ___ weather?',
        correctAnswer: 'freezing',
      },
      {
        id: 3,
        type: 'fill-blank',
        question: "I was quite ___ to learn that the second largest harbour (after Sydney's) is Poole's, in the UK.",
        correctAnswer: 'surprised',
      },
      {
        id: 4,
        type: 'fill-blank',
        question: 'The beach was ___ with people who were waiting to surf the high waves.',
        correctAnswer: 'crowded',
      },
      {
        id: 5,
        type: 'fill-blank',
        question: 'We rented a ___ house on the coast from which we could enjoy the most beautiful sunsets in the evenings.',
        correctAnswer: 'cosy',
      },
      {
        id: 6,
        type: 'fill-blank',
        question: 'The children performed a ___ dance on stage in front of their teachers and parents.',
        correctAnswer: 'traditional',
      },
      {
        id: 7,
        type: 'fill-blank',
        question: 'Are you ___ about getting married in the desert, riding camels?',
        correctAnswer: 'serious',
      },
      {
        id: 8,
        type: 'fill-blank',
        question: "I was very ___ at one point because I couldn't find my boarding pass, and I thought I would miss my flight.",
        correctAnswer: 'worried',
      },
    ],
  },
  {
    id: 'vocabulary-part-1-nouns',
    title: 'Vocabulary Part 1B',
    subtitle: 'Choose the noun',
    icon: '📚',
    color: 'text-[oklch(0.55_0.16_160)]',
    bgColor: 'bg-[oklch(0.95_0.04_160)]',
    description: 'Original instruction: Complete the sentences with one adjective from A and one noun from B. Digital step 2: fill in the noun blanks.',
    wordBank: [
      { letter: 'A', word: 'pass' },
      { letter: 'B', word: 'grades' },
      { letter: 'C', word: 'harbour' },
      { letter: 'D', word: 'camels' },
      { letter: 'E', word: 'stage' },
      { letter: 'F', word: 'sunsets' },
      { letter: 'G', word: 'top' },
      { letter: 'H', word: 'waves' },
    ],
    questions: [
      {
        id: 9,
        type: 'fill-blank',
        question: 'I was disappointed with my exam results - I was expecting to get better ___.',
        correctAnswer: 'grades',
      },
      {
        id: 10,
        type: 'fill-blank',
        question: 'How can you wear a cotton ___ in this freezing weather?',
        correctAnswer: 'top',
      },
      {
        id: 11,
        type: 'fill-blank',
        question: "I was quite surprised to learn that the second largest ___ (after Sydney's) is Poole's, in the UK.",
        correctAnswer: 'harbour',
      },
      {
        id: 12,
        type: 'fill-blank',
        question: 'The beach was crowded with people who were waiting to surf the high ___.',
        correctAnswer: 'waves',
      },
      {
        id: 13,
        type: 'fill-blank',
        question: 'We rented a cosy house on the coast from which we could enjoy the most beautiful ___ in the evenings.',
        correctAnswer: 'sunsets',
      },
      {
        id: 14,
        type: 'fill-blank',
        question: 'The children performed a traditional dance on ___ in front of their teachers and parents.',
        correctAnswer: 'stage',
      },
      {
        id: 15,
        type: 'fill-blank',
        question: 'Are you serious about getting married in the desert, riding ___?',
        correctAnswer: 'camels',
      },
      {
        id: 16,
        type: 'fill-blank',
        question: "I was very worried at one point because I couldn't find my boarding ___, and I thought I would miss my flight.",
        correctAnswer: 'pass',
      },
    ],
  },
  {
    id: 'vocabulary-part-2',
    title: 'Vocabulary Part 2',
    subtitle: 'Complete the sentences',
    icon: '📚',
    color: 'text-[oklch(0.55_0.16_160)]',
    bgColor: 'bg-[oklch(0.95_0.04_160)]',
    description: 'Complete the sentences with these words.',
    wordBank: [
      { letter: 'A', word: 'achieve' },
      { letter: 'B', word: 'beat' },
      { letter: 'C', word: 'check' },
      { letter: 'D', word: 'feel' },
      { letter: 'E', word: 'land' },
      { letter: 'F', word: 'packed' },
      { letter: 'G', word: 'protect' },
      { letter: 'H', word: 'wear' },
    ],
    questions: [
      {
        id: 17,
        type: 'fill-blank',
        question: 'I was so excited when our team ___ the champions from last year. They played so well.',
        correctAnswer: 'beat',
      },
      {
        id: 18,
        type: 'fill-blank',
        question: "'How many bags are you going to ___ in?' 'None, I only have one piece of hand luggage.'",
        correctAnswer: 'check',
      },
      {
        id: 19,
        type: 'fill-blank',
        question: 'If you want to ___ your goals, you must try very hard and not waste time.',
        correctAnswer: 'achieve',
      },
      {
        id: 20,
        type: 'fill-blank',
        question: 'During breaktime, I always eat the ___ lunch my mum prepares for me.',
        correctAnswer: 'packed',
      },
      {
        id: 21,
        type: 'fill-blank',
        question: 'In an emergency, the plane will ___ on water.',
        correctAnswer: 'land',
      },
      {
        id: 22,
        type: 'fill-blank',
        question: 'She volunteers for a charity which works to ___ the environment.',
        correctAnswer: 'protect',
      },
      {
        id: 23,
        type: 'fill-blank',
        question: 'If you ___ seasick, just look up at the sky and breathe slowly.',
        correctAnswer: 'feel',
      },
      {
        id: 24,
        type: 'fill-blank',
        question: 'Most school children in the UK have to ___ school uniform.',
        correctAnswer: 'wear',
      },
    ],
  },
  {
    id: 'vocabulary-part-3',
    title: 'Vocabulary Part 3',
    subtitle: 'Choose the correct option',
    icon: '📚',
    color: 'text-[oklch(0.55_0.16_160)]',
    bgColor: 'bg-[oklch(0.95_0.04_160)]',
    description: 'Choose the correct options to complete the sentences.',
    questions: [
      {
        id: 25,
        type: 'mcq',
        question: 'What time does your flight take ___?',
        options: ['off', 'on', 'out'],
        correctAnswer: 0,
      },
      {
        id: 26,
        type: 'mcq',
        question: 'Can I put ___ your name as a volunteer for the summer fair this year?',
        options: ['down', 'up', 'away'],
        correctAnswer: 0,
      },
      {
        id: 27,
        type: 'mcq',
        question: 'Are the visitors satisfied ___ the social programme?',
        options: ['of', 'with', 'from'],
        correctAnswer: 1,
      },
      {
        id: 28,
        type: 'mcq',
        question: "She's decided to become a vegetarian, and she's never going to give ___ to her parents.",
        options: ['up', 'over', 'in'],
        correctAnswer: 2,
      },
      {
        id: 29,
        type: 'mcq',
        question: "You haven't handed ___ your homework yet? Mrs Brown will be very angry.",
        options: ['in', 'down', 'up'],
        correctAnswer: 0,
      },
      {
        id: 30,
        type: 'mcq',
        question: "He's so excited ___ the idea of riding a horse!",
        options: ['from', 'by', 'on'],
        correctAnswer: 1,
      },
      {
        id: 31,
        type: 'mcq',
        question: 'I thought I might take ___ a new hobby. What do you think about painting classes?',
        options: ['in', 'up', 'out'],
        correctAnswer: 1,
      },
      {
        id: 32,
        type: 'mcq',
        question: 'My little sister still believes ___ fairies.',
        options: ['in', 'at', 'to'],
        correctAnswer: 0,
      },
    ],
  },
  {
    id: 'grammar-part-1',
    title: 'Grammar Part 1',
    subtitle: 'Verb forms',
    icon: '🧩',
    color: 'text-[oklch(0.58_0.15_80)]',
    bgColor: 'bg-[oklch(0.96_0.03_85)]',
    description: 'Complete the text with the correct form of the verbs in brackets. Type the missing verb form only. Contractions are accepted.',
    questions: [
      {
        id: 33,
        type: 'open-ended',
        question: 'I ___ (always enjoy) travelling to interesting countries and meeting local people.',
        correctAnswer: "'ve always enjoyed/I've always enjoyed/have always enjoyed",
      },
      {
        id: 34,
        type: 'open-ended',
        question: 'But before last summer, I ___ (never realise) that a place so near home would be so beautiful.',
        correctAnswer: "'d never realised/I'd never realised/had never realised/'d never realized/I'd never realized/had never realized",
      },
      {
        id: 35,
        type: 'open-ended',
        question: 'We ___ (drive) all day down the coast, and finally we arrived at the seaside just as the sun was disappearing into the sea.',
        correctAnswer: 'drove',
      },
      {
        id: 36,
        type: 'open-ended',
        question: 'We arrived at the seaside just as the sun ___ (disappear) into the sea.',
        correctAnswer: 'was disappearing',
      },
      {
        id: 37,
        type: 'open-ended',
        question: 'I ___ (never forget) the light, the colours, the summer breeze.',
        correctAnswer: "'ll never forget/I'll never forget/will never forget",
      },
      {
        id: 38,
        type: 'open-ended',
        question: "Now when I ___ (look) at the pictures of those places, I can't help thinking about them.",
        correctAnswer: "'m looking/I'm looking/am looking",
      },
      {
        id: 39,
        type: 'open-ended',
        question: "Now when I look at the pictures of those places, I can't help ___ (think) that maybe we wouldn't want to travel so far.",
        correctAnswer: 'thinking',
      },
      {
        id: 40,
        type: 'open-ended',
        question: "Maybe if we ___ (know) our own countries a bit better, we wouldn't want to travel so far.",
        correctAnswer: 'knew',
      },
    ],
  },
  {
    id: 'grammar-part-2',
    title: 'Grammar Part 2',
    subtitle: 'Choose the correct pair',
    icon: '🧩',
    color: 'text-[oklch(0.58_0.15_80)]',
    bgColor: 'bg-[oklch(0.96_0.03_85)]',
    description: 'Complete the sentences with the correct pair of words.',
    questions: [
      {
        id: 41,
        type: 'mcq',
        question: "Oh no, it ___ - we can't ___ our picnic.",
        options: ['is raining / do', 'is raining / have', 'will rain / do'],
        correctAnswer: 1,
      },
      {
        id: 42,
        type: 'mcq',
        question: 'I remember ___ to that ___ man some time ago.',
        options: ['speak / young Indian', 'speaking / Indian young', 'speaking / young Indian'],
        correctAnswer: 2,
      },
      {
        id: 43,
        type: 'mcq',
        question: "Mum doesn't like the way I ___ my hair - she would prefer it to be ___.",
        options: ['do / shorter', 'make / shorter', 'make / shortest'],
        correctAnswer: 0,
      },
      {
        id: 44,
        type: 'mcq',
        question: 'She ___ a place ___ she can live with her large family.',
        options: ["hasn't yet found / which", "hasn't just found / which", "still hasn't found / where"],
        correctAnswer: 2,
      },
      {
        id: 45,
        type: 'mcq',
        question: "You won't ___ any damage to your computer if you ___ it on and off correctly.",
        options: ['make / will turn', 'do / turn', 'give / turn'],
        correctAnswer: 1,
      },
      {
        id: 46,
        type: 'mcq',
        question: "Our French teacher doesn't let us ___ a dictionary during exams, ___ I think is unfair.",
        options: ['to use / which', 'use / which', 'use / that'],
        correctAnswer: 1,
      },
      {
        id: 47,
        type: 'mcq',
        question: 'Dad said he ___ to persuade my sister ___ me her bike.',
        options: ['would manage / to lend', 'will manage / to lend', 'will manage / lend'],
        correctAnswer: 0,
      },
    ],
  },
  {
    id: 'grammar-part-3',
    title: 'Grammar Part 3',
    subtitle: 'Sentence transformation',
    icon: '🧩',
    color: 'text-[oklch(0.58_0.15_80)]',
    bgColor: 'bg-[oklch(0.96_0.03_85)]',
    description: 'Complete the second sentence so that it means the same as the first using the word given in bold. Write one word in each space. Use contractions where possible. Type only the missing words.',
    questions: [
      {
        id: 48,
        type: 'open-ended',
        question: 'Dad ___ a journalist since he finished university. (use: as)',
        correctAnswer: 'has worked as',
      },
      {
        id: 49,
        type: 'open-ended',
        question: "Our guide told ___ walk on the grass. (use: not)",
        correctAnswer: 'us not to',
      },
      {
        id: 50,
        type: 'open-ended',
        question: "Football training ___ 3 p.m., after the maths lesson finishes. (use: until)",
        correctAnswer: "doesn't start until/does not start until",
      },
      {
        id: 51,
        type: 'open-ended',
        question: 'Anna never ___ a good student. (use: be)',
        correctAnswer: 'used to be',
      },
      {
        id: 52,
        type: 'open-ended',
        question: 'By the time they arrived at the station, the train ___. (use: already)',
        correctAnswer: 'had already left',
      },
      {
        id: 53,
        type: 'open-ended',
        question: "If I wasn't working this afternoon, I ___ with you. (use: go)",
        correctAnswer: "would go shopping/'d go shopping",
      },
      {
        id: 54,
        type: 'open-ended',
        question: "Students ___ return the library books before the summer. (use: have)",
        correctAnswer: "don't have to/do not have to",
      },
    ],
  },
  {
    id: 'vocabulary-and-grammar',
    title: 'Vocabulary and Grammar',
    subtitle: 'Read the text and choose the correct word',
    icon: '📝',
    color: 'text-[oklch(0.57_0.17_285)]',
    bgColor: 'bg-[oklch(0.95_0.04_285)]',
    description: 'Read the text below and choose the correct word for each space. Click a blank in the passage to choose its answer.',
    passage: `The last day of school was finally here. Paolo felt so (1) ___ - for nearly three months there would be no classes to (2) ___, no boring (3) ___ food, no exams to be worried (4) ___ . He was (5) ___ forward to his holiday in South Africa. He (6) ___ any (7) ___ than Egypt before, but that was not a problem. He already imagined himself on a safari jeep (8) ___ pictures of lions and other African (9) ___ .

Laura, his older sister, was a bit (10) ___ about flying so far and meeting dangerous animals. 'Why don't we choose something more relaxing?' she (11) ___ when they (12) ___ their summer holiday, 'We (13) ___ visit a city with lots of museums and (14) ___ buildings, or even better, go to the beach, like we (15) ___ when Paolo and I were younger.'

'If you go to the beach, I (16) ___ come,' said her father.

'I (17) ___ to sit in a traffic (18) ___ on the motorway for three hours like last year,' said her mother. 'Come on, Laura, don't be so scared. I promise you we (19) ___ plenty of time for swimming. And, I almost forgot - I (20) ___ the tickets....'`,
    questions: [
      { id: 55, type: 'mcq', question: 'Gap 1', options: ['annoyed', 'excited', 'anxious'], correctAnswer: 1 },
      { id: 56, type: 'mcq', question: 'Gap 2', options: ['do', 'go', 'attend'], correctAnswer: 2 },
      { id: 57, type: 'mcq', question: 'Gap 3', options: ['canteen', 'hall', 'court'], correctAnswer: 0 },
      { id: 58, type: 'mcq', question: 'Gap 4', options: ['of', 'at', 'about'], correctAnswer: 2 },
      { id: 59, type: 'mcq', question: 'Gap 5', options: ['hoping', 'waiting', 'looking'], correctAnswer: 2 },
      { id: 60, type: 'mcq', question: 'Gap 6', options: ["'d never flown", 'never flew', 'never used to fly'], correctAnswer: 0 },
      { id: 61, type: 'mcq', question: 'Gap 7', options: ['more far', 'further', 'farer'], correctAnswer: 1 },
      { id: 62, type: 'mcq', question: 'Gap 8', options: ['take', 'to take', 'taking'], correctAnswer: 2 },
      { id: 63, type: 'mcq', question: 'Gap 9', options: ['wildlife', 'zoos', 'nature'], correctAnswer: 0 },
      { id: 64, type: 'mcq', question: 'Gap 10', options: ['afraid', 'anxious', 'annoyed'], correctAnswer: 1 },
      { id: 65, type: 'mcq', question: 'Gap 11', options: ["didn't ask", "hadn't asked", 'asked'], correctAnswer: 2 },
      { id: 66, type: 'mcq', question: 'Gap 12', options: ['planned', 'used to plan', 'were planning'], correctAnswer: 2 },
      { id: 67, type: 'mcq', question: 'Gap 13', options: ['could', 'have to', 'shall'], correctAnswer: 0 },
      { id: 68, type: 'mcq', question: 'Gap 14', options: ['historical', 'cultural', 'stylish'], correctAnswer: 0 },
      { id: 69, type: 'mcq', question: 'Gap 15', options: ['used to', 'were used to', 'were using to'], correctAnswer: 0 },
      { id: 70, type: 'mcq', question: 'Gap 16', options: ["wouldn't", "won't", "don't"], correctAnswer: 1 },
      { id: 71, type: 'mcq', question: 'Gap 17', options: ["don't", "won't", "'m not going"], correctAnswer: 2 },
      { id: 72, type: 'mcq', question: 'Gap 18', options: ['roundabout', 'jam', 'station'], correctAnswer: 1 },
      { id: 73, type: 'mcq', question: 'Gap 19', options: ["'ll have", 'have', "'d have"], correctAnswer: 0 },
      { id: 74, type: 'mcq', question: 'Gap 20', options: ["'d already booked", "'ve already booked", 'already booked'], correctAnswer: 1 },
    ],
  },
  {
    id: 'reading-part-2',
    title: 'Reading Part 2',
    subtitle: 'Match the teenagers to the best place',
    icon: '📖',
    color: 'text-[oklch(0.54_0.15_235)]',
    bgColor: 'bg-[oklch(0.95_0.04_235)]',
    description: 'The teenagers below all want to eat out. On the opposite page there are descriptions of eight places to eat. Decide which place would be the most suitable for the following teenagers. For each question, choose the correct answer.',
    passage: `Restaurants & Takeaways

A Marina

There's no better fish restaurant in town than Marina, where you can have your meal in front of the restaurant, next to the sea. At night, a band performs for the restaurant's customers. A bit expensive, but the great food and the wonderful atmosphere are really worth it. Open lunchtimes and evenings, Monday-Saturday.

B Salt and pepper

Salt and pepper is a new and different type of restaurant. If you like your dish, you can ask for the recipe and attend a cookery course to learn how to make it. The menu includes fish, meat and vegetarian dishes. It's located in an area convenient for public transport. Open Mondays to Fridays, until 5 p.m.

C Michael's

This lovely French restaurant is in a lovely countryside spot, but anybody can get here on foot. There's also a train station very close by. Michael's has always been a favourite with groups, who can ask for the discounted menu, which includes meat and fish options. Open lunchtimes and evenings.

D Reds and Company

Reds and Company is in a peaceful location near green fields, so it's perfect after a walk or a bicycle ride. There's a large back garden with tables and lots of space for the bikes. They serve Italian, Spanish and French dishes at a low cost. Open from Friday to Saturday.

E Clowns

Run by a nice French family, this is the best place for a cheap break on a long bike ride. Located in a country park five miles from the city centre, Clowns offers sandwiches or snacks to take away. There is a small garden with a few tables at the back. Open lunchtimes only.

F The Cinnamon

This vegetarian restaurant is very popular with young people who want entertainment while they eat. Every Monday night, there are live music sessions in the main hall. At lunchtime, The Cinnamon offers a special deal to families and large groups. It can be reached by bus. Open every day.

G O'Neill's

This British restaurant uses traditional ingredients in new, original recipes. There are many vegetarian and fish dishes. There's a large room upstairs which can be booked by groups. O'Neill's is in the city centre and very close to several bus stops. Open every evening and lunchtimes only on Saturdays and Sundays. Quite expensive.

H The Blue Boat

This restaurant specialises in fish and seafood, but also offers a large vegetarian choice. It's quite popular with families as there's play equipment in the garden. The Blue Boat is located in a quiet area outside the city, so you need a car to get there. Open from midday to midnight every day.`,
    questions: [
      {
        id: 75,
        type: 'mcq',
        question: "Thomas and his sister, Vicki, enjoy eating French food. Next Friday, they want to go exploring in the woods and then meet their parents for dinner in a restaurant where they can sit outside. It's their mum's birthday, but they can't spend very much.",
        options: restaurantOptions,
        correctAnswer: 3,
      },
      {
        id: 76,
        type: 'mcq',
        question: "Liam's family and some friends would like to have fish for lunch this Saturday. They want somewhere that has special prices for them. They are not going to drive and need a restaurant they can go to by public transport.",
        options: restaurantOptions,
        correctAnswer: 2,
      },
      {
        id: 77,
        type: 'mcq',
        question: "Laura and her brother, Chris, love cycling away from the traffic on Sundays. This Sunday, they are looking for a place where they can eat something quick and inexpensive and then get back on their bikes before the sun sets.",
        options: restaurantOptions,
        correctAnswer: 4,
      },
      {
        id: 78,
        type: 'mcq',
        question: "Rachel loves eating outdoors. Next Monday night, she wants to go out with 20 classmates. They're looking for a restaurant with good food and live music. They don't mind about the prices.",
        options: restaurantOptions,
        correctAnswer: 0,
      },
      {
        id: 79,
        type: 'mcq',
        question: "Pilar and her mum don't eat meat or fish. They eat out together every Wednesday at lunchtime. They like cooking and are always interested in trying out different foods and going to places they've never been to before.",
        options: restaurantOptions,
        correctAnswer: 1,
      },
    ],
  },
  {
    id: 'writing-part-2',
    title: 'Writing Part 2',
    subtitle: 'Choose one task',
    icon: '✍️',
    color: 'text-[oklch(0.6_0.16_15)]',
    bgColor: 'bg-[oklch(0.96_0.03_15)]',
    description: 'Choose one of the questions (1 or 2) in this part. Write your answer in about 100 words.',
    storyImages: [WRITING_PART_2_PAGE],
    questions: [
      {
        id: 80,
        type: 'writing',
        topic: 'Choose ONE writing question',
        instructions: 'Choose one of the questions (1 or 2) in this part. Write your answer in about 100 words.',
        wordCount: 'about 100 words',
        prompts: [
          'Question 1: You see this notice in an international English-language magazine. Write an article about your local environment, the environmental problems it faces, and possible solutions.',
          'Question 2: Your English teacher has asked you to write a story. Begin with "The view of the mountains and forests was amazing, but the freezing temperature was getting uncomfortable."',
        ],
      },
    ],
  },
  {
    id: 'listening-part-1',
    title: 'Listening Part 1',
    subtitle: 'Choose the correct picture',
    icon: '🎧',
    color: 'text-[oklch(0.57_0.17_285)]',
    bgColor: 'bg-[oklch(0.95_0.04_285)]',
    description: 'For each question, choose the correct answer. Listen and choose A, B, or C.',
    audioUrl: LISTENING_AUDIO_URL,
    questions: [
      {
        id: 81,
        type: 'listening-mcq',
        question: 'Which type of film are these friends going to watch?',
        options: [
          { label: 'A', imageUrl: listeningOptionImage(1, 'a'), text: 'A musical / dance film' },
          { label: 'B', imageUrl: listeningOptionImage(1, 'b'), text: 'A detective film' },
          { label: 'C', imageUrl: listeningOptionImage(1, 'c'), text: 'A science-fiction film' },
        ],
        correctAnswer: 1,
      },
      {
        id: 82,
        type: 'listening-mcq',
        question: 'What is in the pie that the boy chooses?',
        options: [
          { label: 'A', imageUrl: listeningOptionImage(2, 'a'), text: 'Beef' },
          { label: 'B', imageUrl: listeningOptionImage(2, 'b'), text: 'Mushroom' },
          { label: 'C', imageUrl: listeningOptionImage(2, 'c'), text: 'Fish' },
        ],
        correctAnswer: 0,
      },
      {
        id: 83,
        type: 'listening-mcq',
        question: 'Where are the family staying this summer?',
        options: [
          { label: 'A', imageUrl: listeningOptionImage(3, 'a'), text: 'In a tent' },
          { label: 'B', imageUrl: listeningOptionImage(3, 'b'), text: 'In a rented house' },
          { label: 'C', imageUrl: listeningOptionImage(3, 'c'), text: 'In a hotel' },
        ],
        correctAnswer: 1,
      },
      {
        id: 84,
        type: 'listening-mcq',
        question: 'What did the boy do most of the time on holiday?',
        options: [
          { label: 'A', imageUrl: listeningOptionImage(4, 'a'), text: 'Cycling' },
          { label: 'B', imageUrl: listeningOptionImage(4, 'b'), text: 'Sightseeing in cities' },
          { label: 'C', imageUrl: listeningOptionImage(4, 'c'), text: 'Wind-surfing' },
        ],
        correctAnswer: 0,
      },
      {
        id: 85,
        type: 'listening-mcq',
        question: "What time is the boy's martial arts class?",
        options: [
          { label: 'A', imageUrl: listeningOptionImage(5, 'a'), text: '4:50' },
          { label: 'B', imageUrl: listeningOptionImage(5, 'b'), text: '5:30' },
          { label: 'C', imageUrl: listeningOptionImage(5, 'c'), text: '5:45' },
        ],
        correctAnswer: 2,
      },
      {
        id: 86,
        type: 'listening-mcq',
        question: 'On which date will the girl have her piano lesson?',
        options: [
          { label: 'A', imageUrl: listeningOptionImage(6, 'a'), text: 'Monday the 6th' },
          { label: 'B', imageUrl: listeningOptionImage(6, 'b'), text: 'Tuesday the 7th' },
          { label: 'C', imageUrl: listeningOptionImage(6, 'c'), text: 'Monday the 13th' },
        ],
        correctAnswer: 1,
      },
      {
        id: 87,
        type: 'listening-mcq',
        question: 'How did the boy get to the station?',
        options: [
          { label: 'A', imageUrl: listeningOptionImage(7, 'a'), text: 'By car' },
          { label: 'B', imageUrl: listeningOptionImage(7, 'b'), text: 'By bus' },
          { label: 'C', imageUrl: listeningOptionImage(7, 'c'), text: 'By bike' },
        ],
        correctAnswer: 0,
      },
    ],
  },
  {
    id: 'speaking-part-1',
    title: 'Speaking Part 1',
    subtitle: 'Complete the dialogue',
    icon: '🗣️',
    color: 'text-[oklch(0.56_0.14_25)]',
    bgColor: 'bg-[oklch(0.96_0.03_20)]',
    description: 'Complete the dialogue with these phrases.',
    wordBank: [
      { letter: 'A', word: 'how about you' },
      { letter: 'B', word: "isn't it" },
      { letter: 'C', word: "I'm not sure about that" },
      { letter: 'D', word: 'really' },
      { letter: 'E', word: "that's interesting" },
      { letter: 'F', word: 'what do you' },
      { letter: 'G', word: 'what kind of' },
      { letter: 'H', word: "you're right" },
    ],
    grammarPassage: `Adam: So, <b>(88) ___</b> think, Olivia? Should the class celebrate the end of term?
Olivia: Yes, definitely. I think we should get together and do something like go to the cinema. <b>(89) ___</b>, Adam?
Adam: Well, I think it would be good to get together. But I think it might be better to relax at someone's house.
Olivia: <b>(90) ___</b>. We are quite a big group. I think our parents would prefer it if we went out!
Adam: <b>(91) ___</b> I hadn't thought about that! I guess it would be more special too. A meal would be good.
Olivia: <b>(92) ___</b> restaurant would you like?
Adam: What about the new Mexican restaurant? A lot of people want to try the food there.
Olivia: Hmmm, <b>(93) ___</b> - what if it isn't very good though? I think it might be better to go somewhere that we know.
Adam: That's a good point. What about Luigi's Italian Bistro then? The atmosphere is fun, <b>(94) ___</b>?
Olivia: Good idea. I think we should speak to Katy. She's a good organiser.
Adam: <b>(95) ___</b>? I mean we can ask her, but it shouldn't be too hard for us.`,
    questions: [
      { id: 88, type: 'fill-blank', correctAnswer: 'F' },
      { id: 89, type: 'fill-blank', correctAnswer: 'A' },
      { id: 90, type: 'fill-blank', correctAnswer: 'C' },
      { id: 91, type: 'fill-blank', correctAnswer: 'H' },
      { id: 92, type: 'fill-blank', correctAnswer: 'G' },
      { id: 93, type: 'fill-blank', correctAnswer: 'E' },
      { id: 94, type: 'fill-blank', correctAnswer: 'B' },
      { id: 95, type: 'fill-blank', correctAnswer: 'D' },
    ],
  },
  {
    id: 'speaking-part-2',
    title: 'Speaking Part 2',
    subtitle: 'Complete the mini-dialogues',
    icon: '🗣️',
    color: 'text-[oklch(0.56_0.14_25)]',
    bgColor: 'bg-[oklch(0.96_0.03_20)]',
    description: 'Complete the mini dialogues with these words.',
    wordBank: [
      { letter: 'A', word: 'believe' },
      { letter: 'B', word: 'better' },
      { letter: 'C', word: 'do you prefer' },
      { letter: 'D', word: 'do you think' },
      { letter: 'E', word: 'I agree' },
      { letter: 'F', word: 'kind of' },
      { letter: 'G', word: 'my favourite' },
      { letter: 'H', word: 'there were' },
    ],
    grammarPassage: `Examiner: What <b>(96) ___</b> food do you prefer?
A: I like most food, but I suppose <b>(97) ___</b> is Italian. I love pasta and pizza.
Examiner: <b>(98) ___</b> eating out with a large group of people or a small one?
B: Oh! That's a hard question. I think it's fun with a big group, but you can have <b>(99) ___</b> conversations when there are fewer people at the table.
Examiner: How did you celebrate the end of last term with your classmates?
A: Let me see. It was close to the holidays so not everyone could come. <b>(100) ___</b> about eight of us and we went to Larry's Diner.
Examiner: <b>(101) ___</b> it's important to celebrate occasions like the end of exams or the end of term?
B: Yes, I do. I <b>(102) ___</b> it's a good opportunity to spend some fun time with people who have had the same experiences as you. What do you think, A?
A: <b>(103) ___</b>. It's a good way to relax and laugh about things that have happened.`,
    questions: [
      { id: 96, type: 'fill-blank', correctAnswer: 'F' },
      { id: 97, type: 'fill-blank', correctAnswer: 'G' },
      { id: 98, type: 'fill-blank', correctAnswer: 'C' },
      { id: 99, type: 'fill-blank', correctAnswer: 'B' },
      { id: 100, type: 'fill-blank', correctAnswer: 'H' },
      { id: 101, type: 'fill-blank', correctAnswer: 'D' },
      { id: 102, type: 'fill-blank', correctAnswer: 'A' },
      { id: 103, type: 'fill-blank', correctAnswer: 'E' },
    ],
  },
  {
    id: 'speaking-part-4',
    title: 'Speaking Part 4',
    subtitle: 'Record your discussion',
    icon: '🗣️',
    color: 'text-[oklch(0.56_0.14_25)]',
    bgColor: 'bg-[oklch(0.96_0.03_20)]',
    description: "Exam task, Part 4 (3 minutes): In Term Test 2, you discussed the kind of food you would have at a special meal to celebrate the end of the school year. Now, I'd like you to talk together about the special meal in more detail.",
    questions: [
      {
        id: 104,
        type: 'open-ended',
        question: "Talk together about the special meal in more detail. Back-up prompts: 1) Where would you have the meal? Would you prefer to eat in a restaurant or at someone's house? 2) What kind of food do you think is suitable for a special meal? 3) How will you pay for this meal? 4) Have you organised something like this before? Was it a success?",
        answer: '',
      },
    ],
  },
];

export const petPaper: Paper = {
  id: 'pet-final-test',
  title: 'PET Final Test',
  subtitle: 'Compact Preliminary for Schools',
  description: 'A full PET-style paper with vocabulary, grammar, reading, writing, listening, and speaking tasks based on the uploaded materials.',
  icon: '🎓',
  color: '#0f766e',
  sections,
  totalQuestions: sections.reduce((sum, section) => sum + section.questions.length, 0),
  hasListening: true,
  hasWriting: true,
};
