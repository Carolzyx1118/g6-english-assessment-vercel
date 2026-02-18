// G2-3 English Proficiency Assessment - Question Data
import type { Section, Paper } from './papers';

// CDN base
const CDN = 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663325188422';

// Audio URL for listening section
const AUDIO_URL = `${CDN}/nobpXqQxSkaKHyNh.mp3`;

const sections: Section[] = [
  // ===== PART 1: VOCABULARY (12 picture MCQ) =====
  {
    id: 'vocabulary',
    title: 'Part 1: Vocabulary',
    subtitle: 'Circle the Correct Answer',
    icon: '📖',
    color: 'text-[oklch(0.55_0.16_160)]',
    bgColor: 'bg-[oklch(0.95_0.04_160)]',
    description: 'Look at the pictures. Choose the correct answer (a, b, or c).',
    questions: [
      {
        id: 1, type: 'picture-mcq',
        question: 'five',
        options: [
          { label: 'a', imageUrl: `${CDN}/XGwEAlUDSgfrGGNj.jpeg`, text: 'four' },
          { label: 'b', imageUrl: `${CDN}/ekljSQtaTMtrdkkq.jpeg`, text: 'five' },
          { label: 'c', imageUrl: `${CDN}/QhTiLdAdgODmlGyi.jpeg`, text: 'six' },
        ],
        correctAnswer: 1,
      },
      {
        id: 2, type: 'picture-mcq',
        question: 'pencil',
        options: [
          { label: 'a', imageUrl: `${CDN}/cdhHHwsPPIOPYZtV.jpeg`, text: 'pencil' },
          { label: 'b', imageUrl: `${CDN}/LyvjoGnKqJILMZfm.jpeg`, text: 'umbrella' },
          { label: 'c', imageUrl: `${CDN}/HedsSvbtNdESoRyQ.jpeg`, text: 'book' },
        ],
        correctAnswer: 0,
      },
      {
        id: 3, type: 'picture-mcq',
        question: 'ball',
        options: [
          { label: 'a', imageUrl: `${CDN}/nyPqLtuKTzpgnOTS.jpeg`, text: 'doll' },
          { label: 'b', imageUrl: `${CDN}/NDXvQiASYECcrYsj.jpeg`, text: 'sailboat' },
          { label: 'c', imageUrl: `${CDN}/NorKIPbyveSeBomK.jpeg`, text: 'ball' },
        ],
        correctAnswer: 2,
      },
      {
        id: 4, type: 'picture-mcq',
        question: 'a big dog',
        options: [
          { label: 'a', imageUrl: `${CDN}/iitGHVmmdcuFWMQs.jpeg` },
          { label: 'b', imageUrl: `${CDN}/eIuaXboGkavikvUT.png` },
          { label: 'c', imageUrl: `${CDN}/WpTlfGDMrxoKodwF.png` },
        ],
        correctAnswer: 2,
      },
      {
        id: 5, type: 'picture-mcq',
        question: 'eyes',
        options: [
          { label: 'a', imageUrl: `${CDN}/yfEbdziFiBbdtFmz.jpeg`, text: 'eyes' },
          { label: 'b', imageUrl: `${CDN}/pkuDVtpgsTNUWlOf.jpeg`, text: 'ears' },
          { label: 'c', imageUrl: `${CDN}/CsSdaXHbWMElJqnH.jpeg`, text: 'nose' },
        ],
        correctAnswer: 0,
      },
      {
        id: 6, type: 'picture-mcq',
        question: "I've got a long tail.",
        options: [
          { label: 'a', imageUrl: `${CDN}/tmUvRUEVgjxhDtBf.jpeg`, text: 'hippo' },
          { label: 'b', imageUrl: `${CDN}/ZyoswcaUIyTHZnCP.jpeg`, text: 'tiger' },
          { label: 'c', imageUrl: `${CDN}/YFLpRPGNnqjOZzid.jpeg`, text: 'snake' },
        ],
        correctAnswer: 2,
      },
      {
        id: 7, type: 'picture-mcq',
        question: 'socks',
        options: [
          { label: 'a', imageUrl: `${CDN}/gxcCZgbVIzNisTps.jpeg`, text: 'shoes' },
          { label: 'b', imageUrl: `${CDN}/AxKgZLnjycKoEotD.jpeg`, text: 'skirt' },
          { label: 'c', imageUrl: `${CDN}/rKCgRMCsZCBTMlPA.jpeg`, text: 'socks' },
        ],
        correctAnswer: 2,
      },
      {
        id: 8, type: 'picture-mcq',
        question: "I can't ride a bike.",
        options: [
          { label: 'a', imageUrl: `${CDN}/HLPKToYFUFZDoerq.jpeg` },
          { label: 'b', imageUrl: `${CDN}/HATraddRFsUUNKri.jpeg` },
          { label: 'c', imageUrl: `${CDN}/whIOczYYFOYbpeqZ.png` },
        ],
        correctAnswer: 0,
      },
      {
        id: 9, type: 'picture-mcq',
        question: 'bedroom',
        options: [
          { label: 'a', imageUrl: `${CDN}/bqZiIRDQEPzeiJbR.jpeg` },
          { label: 'b', imageUrl: `${CDN}/CExuhaVzVIyGeWYm.jpeg` },
          { label: 'c', imageUrl: `${CDN}/azcpvDEBTWhSgMfn.jpeg` },
        ],
        correctAnswer: 1,
      },
      {
        id: 10, type: 'picture-mcq',
        question: 'I like ice cream.',
        options: [
          { label: 'a', imageUrl: `${CDN}/ONUOfkwlilrTjHiI.png` },
          { label: 'b', imageUrl: `${CDN}/qrqzWcjseBTYpSxk.png` },
          { label: 'c', imageUrl: `${CDN}/XZiRjJWGsQbOvnuw.png` },
        ],
        correctAnswer: 2,
      },
      {
        id: 11, type: 'picture-mcq',
        question: 'There is a shop between the hospital and the café.',
        options: [
          { label: 'a', imageUrl: `${CDN}/pBIsMpcMMxLshKDG.jpeg` },
          { label: 'b', imageUrl: `${CDN}/opFogXzRSWHbAcqO.jpeg` },
          { label: 'c', imageUrl: `${CDN}/cggypzYxizEbbTSN.jpeg` },
        ],
        correctAnswer: 2,
      },
      {
        id: 12, type: 'picture-mcq',
        question: "She's getting dressed.",
        options: [
          { label: 'a', imageUrl: `${CDN}/unhPFAYDaiNlvfca.jpeg` },
          { label: 'b', imageUrl: `${CDN}/UsZqbGoiaOSgpvqW.jpeg` },
          { label: 'c', imageUrl: `${CDN}/GiANjMNGmlqXzPlj.jpeg` },
        ],
        correctAnswer: 1,
      },
    ],
  },

  // ===== PART 2: GRAMMAR (8 MCQ + 1 fill-in with 5 sub-questions) =====
  {
    id: 'grammar',
    title: 'Part 2: Grammar',
    subtitle: 'Choose or Fill In',
    icon: '✏️',
    color: 'text-[oklch(0.65_0.15_75)]',
    bgColor: 'bg-[oklch(0.95_0.04_75)]',
    description: 'Look at the pictures and choose the correct sentence, or fill in the blanks with the correct word.',
    questions: [
      {
        id: 1, type: 'mcq',
        question: 'Look at the picture. Choose the correct sentence.',
        imageUrl: `${CDN}/rqJcGIQJFuBuNBhd.png`,
        options: ['He is playing football.', 'He is playing basketball.', 'She is playing football.'],
        correctAnswer: 0,
      },
      {
        id: 2, type: 'mcq',
        question: 'Look at the picture. Choose the correct sentence.',
        imageUrl: `${CDN}/tOrjsfVAbZmFCIlT.png`,
        options: ['He is running quickly.', 'He is running good.', 'He is running quick.'],
        correctAnswer: 0,
      },
      {
        id: 3, type: 'mcq',
        question: 'Look at the picture. Choose the correct sentence.',
        imageUrl: `${CDN}/WuytbXDZWMdgtnPW.png`,
        options: ["It's half past two.", "It's quarter past two.", "It's quarter to two."],
        correctAnswer: 2,
      },
      {
        id: 4, type: 'picture-mcq',
        question: 'There is a shop between the hospital and the café. Choose the correct picture.',
        options: [
          { label: 'a', imageUrl: `${CDN}/DohGexiZsmrcvBCQ.png` },
          { label: 'b', imageUrl: `${CDN}/QukUERZfNmLWFTyd.png` },
          { label: 'c', imageUrl: `${CDN}/xwKWFQLvqIEbEYvb.png` },
        ],
        correctAnswer: 2,
      },
      {
        id: 5, type: 'mcq',
        question: 'Look at the picture. Choose the correct sentence.',
        imageUrl: `${CDN}/ltjpfeDuxRsUhRhs.png`,
        options: ['They are going to catch the bus.', 'They going to catch the bus.', 'They go to catch the bus.'],
        correctAnswer: 0,
      },
      {
        id: 6, type: 'mcq',
        question: 'Look at the picture. Choose the correct sentence.',
        imageUrl: `${CDN}/FGTiiKatCjgOXalG.jpeg`,
        options: ['The first month of the year is January.', 'The first month of the year is July.', 'They go to catch the bus.'],
        correctAnswer: 0,
      },
      {
        id: 7, type: 'mcq',
        question: 'Look at the picture. Choose the correct sentence.',
        imageUrl: `${CDN}/EFYvYtceeykZDELX.png`,
        options: ['They might need their coats.', 'They might to need their coats.', 'They may to need their coats.'],
        correctAnswer: 0,
      },
      {
        id: 8, type: 'mcq',
        question: 'Look at the picture. Choose the correct sentence.',
        imageUrl: `${CDN}/NYOoNKymWvnsBHMH.png`,
        options: ["I'm never eat Italy food before.", 'I never eat Italy food before.', 'I have never eaten Italian food before.'],
        correctAnswer: 2,
      },
      { id: 9, type: 'fill-blank', correctAnswer: 'next to' },
      { id: 10, type: 'fill-blank', correctAnswer: 'in' },
      { id: 11, type: 'fill-blank', correctAnswer: 'on' },
      { id: 12, type: 'fill-blank', correctAnswer: 'under' },
      { id: 13, type: 'fill-blank', correctAnswer: 'next to' },
    ],
    sceneImageUrl: `${CDN}/vNalAIQYvYJkiujn.png`,
    wordBank: [
      { letter: 'A', word: 'next to' },
      { letter: 'B', word: 'on' },
      { letter: 'C', word: 'in' },
      { letter: 'D', word: 'under' },
    ],
    grammarPassage: `Look at the picture and fill in the blanks with the correct word from the word bank.

<b>a.</b> The rubber is ___(9)___ the pencil case.
<b>b.</b> The crayons are ___(10)___ the pencil case.
<b>c.</b> The pencils are ___(11)___ the desk.
<b>d.</b> The pen is ___(12)___ the book.
<b>e.</b> The pencils are ___(13)___ the book.`,
  },

  // ===== PART 3: LISTENING (6 picture MCQ with audio) =====
  {
    id: 'listening',
    title: 'Part 3: Listening',
    subtitle: 'Listen and Choose',
    icon: '🎧',
    color: 'text-[oklch(0.55_0.18_280)]',
    bgColor: 'bg-[oklch(0.92_0.05_280)]',
    description: 'Listen to the audio and choose the correct picture (A, B, or C).',
    audioUrl: AUDIO_URL,
    questions: [
      {
        id: 1, type: 'listening-mcq',
        question: 'What is dad doing?',
        options: [
          { label: 'A', imageUrl: `${CDN}/TyWjontfHLbeqrHO.png`, text: 'Playing guitar' },
          { label: 'B', imageUrl: `${CDN}/DSenjMvtpYbZGfaQ.png`, text: 'Watching TV' },
          { label: 'C', imageUrl: `${CDN}/IZWZmMxmBJbVSbXJ.png`, text: 'Listening to radio' },
        ],
        correctAnswer: 2,
      },
      {
        id: 2, type: 'listening-mcq',
        question: "Which is Anna's sister?",
        options: [
          { label: 'A', imageUrl: `${CDN}/ZILymncsOPlEmMYe.png` },
          { label: 'B', imageUrl: `${CDN}/OunzyKSciwrKkLHf.png` },
          { label: 'C', imageUrl: `${CDN}/AeGXVCeZqbsIZaBz.png` },
        ],
        correctAnswer: 0,
      },
      {
        id: 3, type: 'listening-mcq',
        question: "What is in Sam's school bag?",
        options: [
          { label: 'A', imageUrl: `${CDN}/zDJZAyZkWmntHVNq.png`, text: 'Pencil case' },
          { label: 'B', imageUrl: `${CDN}/yOonVwbOQRKJJPJK.png`, text: 'Tablet' },
          { label: 'C', imageUrl: `${CDN}/wePmzxIRGAyenqie.png`, text: 'Ruler' },
        ],
        correctAnswer: 1,
      },
      {
        id: 4, type: 'listening-mcq',
        question: 'What did Anna do yesterday?',
        options: [
          { label: 'A', imageUrl: `${CDN}/vaHvfUHUmOsRMyHG.png` },
          { label: 'B', imageUrl: `${CDN}/TsRpPhRHhkWsoBcy.png` },
          { label: 'C', imageUrl: `${CDN}/RkLyMWsielunHDOl.png` },
        ],
        correctAnswer: 2,
      },
      {
        id: 5, type: 'listening-mcq',
        question: "What job does Tom's sister have?",
        options: [
          { label: 'A', imageUrl: `${CDN}/kPgudsaJKUQLHZbi.png`, text: 'Ambulance driver' },
          { label: 'B', imageUrl: `${CDN}/OqVmKwKNTDuHYKuM.png`, text: 'Doctor' },
          { label: 'C', imageUrl: `${CDN}/HDcClvLAgGDZmfGU.png`, text: 'Nurse' },
        ],
        correctAnswer: 0,
      },
      {
        id: 6, type: 'listening-mcq',
        question: 'Which toy did Jack buy for his sister?',
        options: [
          { label: 'A', imageUrl: `${CDN}/bkwZnsDSPkKVeSIV.png`, text: 'Clown' },
          { label: 'B', imageUrl: `${CDN}/hrsqlxhkFJMIIYoP.png`, text: 'Doll' },
          { label: 'C', imageUrl: `${CDN}/UJvJgoTQIQkYGuZr.png`, text: 'Panda' },
        ],
        correctAnswer: 0,
      },
    ],
  },

  // ===== PART 4: READING =====
  {
    id: 'reading',
    title: 'Part 4: Reading',
    subtitle: 'Read and Answer',
    icon: '📚',
    color: 'text-[oklch(0.50_0.18_255)]',
    bgColor: 'bg-[oklch(0.92_0.05_255)]',
    description: 'Part 1: Look at the pictures and read the sentences. Choose the correct word. Part 2: Read the story and fill in the blanks.',
    wordBankImageUrl: `${CDN}/xgmyVsWshcOxjsUN.png`,
    storyParagraphs: [
      {
        text: `At the weekend, Jane's mum said, "I want to go shopping. Can you help me, Jane?" "Yes," she said. Jane and her mother took a bus to the town. Jane's mother carried one bag, and Jane carried another. The bus stopped outside a big supermarket, and they went inside. Jane wasn't very happy. She thought shopping was boring.`,
        questionIds: [6, 7, 8],
      },
      {
        text: `Inside the shop, Jane's mother picked up fruit and bread but she couldn't find any rice. Jane found some below the pasta. Her mum was pleased. "Clever girl!" she said. Then Jane's mother wanted a bottle of lemonade. Jane went to look for it. The bottles were in a place difficult to find but Jane climbed on a big box and got one. When she jumped down, she hurt her leg and started to cry.`,
        questionIds: [9, 10, 11, 12],
      },
      {
        text: `Jane's mother bought Jane a strawberry ice cream. She sat down and ate it. She stopped crying, but her leg hurt, and she could only walk very slowly. Jane's mother phoned home, and Jane's father came to the supermarket to drive them home. When they got back, Jane's mother said, "Oh dear! I can't take you shopping again!"`,
        questionIds: [13, 14, 15],
      },
    ],
    questions: [
      { id: 1, type: 'wordbank-fill', question: 'This has lots of green vegetables in it, but you don\'t cook it.', correctAnswer: 'a salad' },
      { id: 2, type: 'wordbank-fill', question: 'You stand under this when you want to wash.', correctAnswer: 'a shower' },
      { id: 3, type: 'wordbank-fill', question: 'This person works outside in the fields.', correctAnswer: 'a farmer' },
      { id: 4, type: 'wordbank-fill', question: 'Some people put milk in this brown drink.', correctAnswer: 'coffee' },
      { id: 5, type: 'wordbank-fill', question: 'This person helps people when their teeth hurt.', correctAnswer: 'a dentist' },
      { id: 6, type: 'story-fill', question: 'Jane carried a ___ for her mother.', correctAnswer: 'bag' },
      { id: 7, type: 'story-fill', question: 'They went shopping in the big ___.', correctAnswer: 'supermarket' },
      { id: 8, type: 'story-fill', question: "Jane didn't enjoy shopping because she thought it was ___.", correctAnswer: 'boring' },
      { id: 9, type: 'story-fill', question: '___ found fruit and bread in the shop.', correctAnswer: "Jane's mother", acceptableAnswers: ["Jane's mum", "Her mother", "Her mum", "Janes mother", "Jane's mom"] },
      { id: 10, type: 'story-fill', question: 'The rice was under ___.', correctAnswer: 'the pasta', acceptableAnswers: ['pasta'] },
      { id: 11, type: 'story-fill', question: 'Jane climbed on a box to get a ___.', correctAnswer: 'bottle of lemonade', acceptableAnswers: ['lemonade', 'bottle'] },
      { id: 12, type: 'story-fill', question: 'Jane started ___ because she hurt her leg when she jumped down.', correctAnswer: 'crying', acceptableAnswers: ['to cry'] },
      { id: 13, type: 'story-fill', question: "Jane's mother gave Jane a ___.", correctAnswer: 'strawberry ice cream', acceptableAnswers: ['ice cream'] },
      { id: 14, type: 'story-fill', question: "Jane couldn't ___ quickly because her leg hurt.", correctAnswer: 'walk' },
      { id: 15, type: 'story-fill', question: '___ took them home in the car.', correctAnswer: "Jane's dad", acceptableAnswers: ["Jane's father", "Her dad", "Her father", "Janes dad", "Jane's dad", "Jane's father"] },
    ],
  },
];

// Helper: reading word bank items for display
const readingWordBank = [
  { word: 'a dentist', imageUrl: `${CDN}/HpVYuiWHGrdpskKj.png` },
  { word: 'a milkshake', imageUrl: `${CDN}/VHAdmbegoiVDkDJD.png` },
  { word: 'coffee', imageUrl: `${CDN}/xcXZVuhWNelGyHSx.png` },
  { word: 'a nurse', imageUrl: `${CDN}/XAdfpbQZgLhntZpB.png` },
  { word: 'a farmer', imageUrl: `${CDN}/ZnObHJdBXVoBoKnU.png` },
  { word: 'a shower', imageUrl: `${CDN}/SQrBlhHjJGLHNFsE.png` },
  { word: 'a lamp', imageUrl: `${CDN}/zMuxHUxUrcfpvIib.png` },
  { word: 'a salad', imageUrl: `${CDN}/KklExYGJRgiJgBdN.png` },
];

export const widaPaper: Paper = {
  id: 'wida',
  title: 'G2-3 English Proficiency Assessment',
  subtitle: 'G2-3 Level',
  description: 'Test your English proficiency across vocabulary, grammar, listening, and reading comprehension. Suitable for Grade 2-3 students.',
  icon: '🌍',
  color: '#4F46E5',
  sections,
  readingWordBank,
  totalQuestions: sections.reduce((sum, s) => sum + s.questions.length, 0),
  hasListening: true,
  hasWriting: false,
};
