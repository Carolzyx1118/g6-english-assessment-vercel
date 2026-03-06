import 'dotenv/config';
import { drizzle } from 'drizzle-orm/mysql2';
import { customPapers } from './drizzle/schema.ts';

const db = drizzle(process.env.DATABASE_URL);

// Audio URLs
const AUDIO_PART1 = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663325188422/EWoFRKnLMqLcQeMt.mp3";
const AUDIO_PART2 = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663325188422/ManjcMNtPUwbqjtt.mp3";
const AUDIO_PART3 = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663325188422/UzVEzbpWtQbJpJjD.mp3";
const AUDIO_PART4 = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663325188422/gLuFGjkjwiaDyAea.mp3";

// Scene/Page images
const PAGE1 = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663325188422/lrOutREYpxKFwQXD.png";
const PAGE2 = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663325188422/camlYOSeHpwrlzcA.png";
const PAGE4 = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663325188422/PpCUoMKTdKkCxRwu.png";
const PAGE5 = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663325188422/mGURYoQFJwRAJYLS.png";
const PAGE6 = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663325188422/WWUgtKRPFADYolVw.png";
const PAGE7 = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663325188422/YRrSSBkDpXfjGBSO.png";
const PAGE8 = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663325188422/ZDVOaLLazklPGWXt.png";
const PAGE9 = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663325188422/VyTtHhYbDldySLjG.png";
const PAGE10 = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663325188422/AxnLDKSOaYvczNzS.png";
const PAGE11 = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663325188422/GhNOORpYubAxOzPR.png";
const PAGE12 = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663325188422/pVIspWPcSLzIBZHZ.png";
const PAGE13 = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663325188422/eLMFeFwQwMnhtWeI.png";
const SPEAKING_IMG = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663325188422/WcpMdSfmIJUKTLwF.jpg";

const sections = [
  // ═══════════════════════════════════════════
  // LISTENING PART 1: Listen and draw lines
  // Match names to people in the park scene
  // Using listening-mcq: each Q asks which person is [name]
  // ═══════════════════════════════════════════
  {
    id: "listening-part1",
    title: "Listening Part 1",
    subtitle: "Listen and draw lines",
    icon: "🎧",
    color: "text-[oklch(0.55_0.16_280)]",
    bgColor: "bg-[oklch(0.95_0.04_280)]",
    description: "Listen and draw lines. There is one example. Look at the picture. Listen to the audio and match each name to the correct person.",
    audioUrl: AUDIO_PART1,
    sceneImageUrl: PAGE1,
    questions: [
      {
        id: 1,
        type: "listening-mcq",
        question: "Where should you draw the line for 'Mark'?",
        options: [
          { label: "a", imageUrl: "", text: "The boy playing chess at the table" },
          { label: "b", imageUrl: "", text: "The boy flying a kite" },
          { label: "c", imageUrl: "", text: "The boy on the skateboard" },
          { label: "d", imageUrl: "", text: "The boy fishing by the pond" }
        ],
        correctAnswer: 0
      },
      {
        id: 2,
        type: "listening-mcq",
        question: "Where should you draw the line for 'Eva'?",
        options: [
          { label: "a", imageUrl: "", text: "The girl playing chess at the table" },
          { label: "b", imageUrl: "", text: "The girl reading a book under the tree" },
          { label: "c", imageUrl: "", text: "The girl with flowers" },
          { label: "d", imageUrl: "", text: "The girl skipping rope" }
        ],
        correctAnswer: 2
      },
      {
        id: 3,
        type: "listening-mcq",
        question: "Where should you draw the line for 'Dan'?",
        options: [
          { label: "a", imageUrl: "", text: "The boy waving on the path" },
          { label: "b", imageUrl: "", text: "The boy on the skateboard" },
          { label: "c", imageUrl: "", text: "The boy fishing by the pond" },
          { label: "d", imageUrl: "", text: "The boy playing chess" }
        ],
        correctAnswer: 0
      },
      {
        id: 4,
        type: "listening-mcq",
        question: "Where should you draw the line for 'Grace'?",
        options: [
          { label: "a", imageUrl: "", text: "The girl reading a book" },
          { label: "b", imageUrl: "", text: "The girl skipping rope" },
          { label: "c", imageUrl: "", text: "The girl playing chess" },
          { label: "d", imageUrl: "", text: "The girl with flowers" }
        ],
        correctAnswer: 1
      },
      {
        id: 5,
        type: "listening-mcq",
        question: "Where should you draw the line for 'Alice'?",
        options: [
          { label: "a", imageUrl: "", text: "The girl playing chess" },
          { label: "b", imageUrl: "", text: "The girl reading a book under the tree" },
          { label: "c", imageUrl: "", text: "The girl with flowers" },
          { label: "d", imageUrl: "", text: "The girl skipping rope" }
        ],
        correctAnswer: 1
      }
    ],
    passage: "",
    wordBank: [],
    grammarPassage: "",
    storyParagraphs: []
  },

  // ═══════════════════════════════════════════
  // LISTENING PART 2: Listen and write a name or number
  // Fill-blank style - students write short answers
  // ═══════════════════════════════════════════
  {
    id: "listening-part2",
    title: "Listening Part 2",
    subtitle: "Listen and write a name or a number",
    icon: "✏️",
    color: "text-[oklch(0.55_0.16_250)]",
    bgColor: "bg-[oklch(0.95_0.04_250)]",
    description: "Read the question. Listen and write a name or a number. There are two examples.",
    audioUrl: AUDIO_PART2,
    sceneImageUrl: PAGE2,
    questions: [
      {
        id: 6,
        type: "open-ended",
        question: "What is Tom's friend's name?",
        answer: "(Listen to the audio for the answer)"
      },
      {
        id: 7,
        type: "open-ended",
        question: "How old is Tom's friend?",
        answer: "(Listen to the audio for the answer)"
      },
      {
        id: 8,
        type: "open-ended",
        question: "How many brothers has Tom's friend got?",
        answer: "(Listen to the audio for the answer)"
      },
      {
        id: 9,
        type: "open-ended",
        question: "How many children are in Tom's class?",
        answer: "(Listen to the audio for the answer)"
      },
      {
        id: 10,
        type: "open-ended",
        question: "What is the name of Tom's teacher? Mrs ___",
        answer: "(Listen to the audio for the answer)"
      }
    ],
    passage: "",
    wordBank: [],
    grammarPassage: "",
    storyParagraphs: []
  },

  // ═══════════════════════════════════════════
  // LISTENING PART 3: Listen and tick the box
  // Picture MCQ with 3 options (A, B, C)
  // ═══════════════════════════════════════════
  {
    id: "listening-part3",
    title: "Listening Part 3",
    subtitle: "Listen and tick the box",
    icon: "☑️",
    color: "text-[oklch(0.55_0.16_310)]",
    bgColor: "bg-[oklch(0.95_0.04_310)]",
    description: "Listen and tick (✓) the box. There is one example. Look at the pictures and choose the correct answer.",
    audioUrl: AUDIO_PART3,
    sceneImageUrl: PAGE4,
    questions: [
      {
        id: 11,
        type: "listening-mcq",
        question: "What is Anna taking to school?",
        options: [
          { label: "A", imageUrl: "", text: "A jacket" },
          { label: "B", imageUrl: "", text: "Some books" },
          { label: "C", imageUrl: "", text: "A jacket and books" }
        ],
        correctAnswer: 0
      },
      {
        id: 12,
        type: "listening-mcq",
        question: "Which is Bill's dad?",
        options: [
          { label: "A", imageUrl: "", text: "The man washing a car" },
          { label: "B", imageUrl: "", text: "The man playing basketball" },
          { label: "C", imageUrl: "", text: "The man painting a wall" }
        ],
        correctAnswer: 0
      },
      {
        id: 13,
        type: "listening-mcq",
        question: "What would Sam like to do?",
        options: [
          { label: "A", imageUrl: "", text: "Play tennis" },
          { label: "B", imageUrl: "", text: "Watch TV (cartoons)" },
          { label: "C", imageUrl: "", text: "Watch TV (farm show)" }
        ],
        correctAnswer: 0
      },
      {
        id: 14,
        type: "listening-mcq",
        question: "Which is Jill's bedroom?",
        options: [
          { label: "A", imageUrl: "", text: "Room with computer" },
          { label: "B", imageUrl: "", text: "Room with big bed" },
          { label: "C", imageUrl: "", text: "Room with small bed and lamp" }
        ],
        correctAnswer: 0
      },
      {
        id: 15,
        type: "listening-mcq",
        question: "Which is Nick's brother?",
        options: [
          { label: "A", imageUrl: "", text: "Boy in green striped shirt" },
          { label: "B", imageUrl: "", text: "Boy eating a burger" },
          { label: "C", imageUrl: "", text: "Boy with a camera" }
        ],
        correctAnswer: 0
      }
    ],
    passage: "",
    wordBank: [],
    grammarPassage: "",
    storyParagraphs: []
  },

  // ═══════════════════════════════════════════
  // LISTENING PART 4: Listen and colour
  // Adapted as listening MCQ for digital format
  // ═══════════════════════════════════════════
  {
    id: "listening-part4",
    title: "Listening Part 4",
    subtitle: "Listen and colour",
    icon: "🎨",
    color: "text-[oklch(0.55_0.16_30)]",
    bgColor: "bg-[oklch(0.95_0.04_30)]",
    description: "Listen and colour. There is one example. Listen to the audio and answer the questions about what colour each item should be.",
    audioUrl: AUDIO_PART4,
    sceneImageUrl: PAGE6,
    questions: [
      {
        id: 16,
        type: "open-ended",
        question: "What colour should you colour the item? (Listen to the audio for instructions)",
        answer: "(Listen to the audio for the answer)"
      },
      {
        id: 17,
        type: "open-ended",
        question: "What colour should you colour the item? (Listen to the audio for instructions)",
        answer: "(Listen to the audio for the answer)"
      },
      {
        id: 18,
        type: "open-ended",
        question: "What colour should you colour the item? (Listen to the audio for instructions)",
        answer: "(Listen to the audio for the answer)"
      },
      {
        id: 19,
        type: "open-ended",
        question: "What colour should you colour the item? (Listen to the audio for instructions)",
        answer: "(Listen to the audio for the answer)"
      },
      {
        id: 20,
        type: "open-ended",
        question: "What colour should you colour the item? (Listen to the audio for instructions)",
        answer: "(Listen to the audio for the answer)"
      }
    ],
    passage: "",
    wordBank: [],
    grammarPassage: "",
    storyParagraphs: []
  },

  // ═══════════════════════════════════════════
  // READING & WRITING PART 1: Look and read (tick/cross)
  // True/False with picture - each Q has image + statement
  // ═══════════════════════════════════════════
  {
    id: "rw-part1",
    title: "Reading & Writing Part 1",
    subtitle: "Look and read. Put a tick or a cross",
    icon: "✅",
    color: "text-[oklch(0.55_0.16_160)]",
    bgColor: "bg-[oklch(0.95_0.04_160)]",
    description: "Look and read. Put a tick (✓) or a cross (✗) in the box. There are two examples.",
    sceneImageUrl: PAGE7,
    questions: [
      {
        id: 21,
        type: "mcq",
        question: "[Image: a train] This is a train.",
        imageUrl: "",
        options: ["✓ (Yes, correct)", "✗ (No, wrong)"],
        correctAnswer: 0
      },
      {
        id: 22,
        type: "mcq",
        question: "[Image: sausages] These are sausages.",
        imageUrl: "",
        options: ["✓ (Yes, correct)", "✗ (No, wrong)"],
        correctAnswer: 0
      },
      {
        id: 23,
        type: "mcq",
        question: "[Image: T-shirts] These are skirts.",
        imageUrl: "",
        options: ["✓ (Yes, correct)", "✗ (No, wrong)"],
        correctAnswer: 1
      },
      {
        id: 24,
        type: "mcq",
        question: "[Image: bookshelf] This is a lamp.",
        imageUrl: "",
        options: ["✓ (Yes, correct)", "✗ (No, wrong)"],
        correctAnswer: 1
      },
      {
        id: 25,
        type: "mcq",
        question: "[Image: watch] This is a watch.",
        imageUrl: "",
        options: ["✓ (Yes, correct)", "✗ (No, wrong)"],
        correctAnswer: 0
      }
    ],
    passage: "",
    wordBank: [],
    grammarPassage: "",
    audioUrl: "",
    storyParagraphs: []
  },

  // ═══════════════════════════════════════════
  // READING & WRITING PART 2: Look and read, write yes/no
  // True/False based on scene picture
  // ═══════════════════════════════════════════
  {
    id: "rw-part2",
    title: "Reading & Writing Part 2",
    subtitle: "Look and read. Write yes or no",
    icon: "👀",
    color: "text-[oklch(0.55_0.16_200)]",
    bgColor: "bg-[oklch(0.95_0.04_200)]",
    description: "Look and read. Write yes or no.",
    sceneImageUrl: PAGE9,
    questions: [
      {
        id: 26,
        type: "mcq",
        question: "Two people are wearing red shorts.",
        options: ["yes", "no"],
        correctAnswer: 0,
        imageUrl: ""
      },
      {
        id: 27,
        type: "mcq",
        question: "The door of the house is closed.",
        options: ["yes", "no"],
        correctAnswer: 1,
        imageUrl: ""
      },
      {
        id: 28,
        type: "mcq",
        question: "The dog has brown ears.",
        options: ["yes", "no"],
        correctAnswer: 0,
        imageUrl: ""
      },
      {
        id: 29,
        type: "mcq",
        question: "The girl in a blue jacket is talking.",
        options: ["yes", "no"],
        correctAnswer: 1,
        imageUrl: ""
      },
      {
        id: 30,
        type: "mcq",
        question: "The man with black hair is driving.",
        options: ["yes", "no"],
        correctAnswer: 0,
        imageUrl: ""
      }
    ],
    passage: "",
    wordBank: [],
    grammarPassage: "",
    audioUrl: "",
    storyParagraphs: []
  },

  // ═══════════════════════════════════════════
  // READING & WRITING PART 3: Spelling (write words from scrambled letters)
  // Using fill-blank (sentence-based mode) with hints
  // ═══════════════════════════════════════════
  {
    id: "rw-part3",
    title: "Reading & Writing Part 3",
    subtitle: "Look at the pictures. Write the words",
    icon: "🔤",
    color: "text-[oklch(0.55_0.16_80)]",
    bgColor: "bg-[oklch(0.95_0.04_80)]",
    description: "Look at the pictures. Look at the letters. Write the words. There is one example.",
    sceneImageUrl: PAGE10,
    questions: [
      {
        id: 31,
        type: "open-ended",
        question: "[Image: pear] Look at the picture. The scrambled letters are: a, r, e, p. Write the word: ____",
        answer: "pear"
      },
      {
        id: 32,
        type: "open-ended",
        question: "[Image: lemon] Look at the picture. The scrambled letters are: e, m, o, n, l. Write the word: _____",
        answer: "lemon"
      },
      {
        id: 33,
        type: "open-ended",
        question: "[Image: orange] Look at the picture. The scrambled letters are: a, g, r, n, e, o. Write the word: ______",
        answer: "orange"
      },
      {
        id: 34,
        type: "open-ended",
        question: "[Image: banana] Look at the picture. The scrambled letters are: a, n, n, a, b, a. Write the word: ______",
        answer: "banana"
      },
      {
        id: 35,
        type: "open-ended",
        question: "[Image: pineapple] Look at the picture. The scrambled letters are: e, p, a, e, n, l, p, p, i. Write the word: _________",
        answer: "pineapple"
      }
    ],
    passage: "",
    wordBank: [],
    grammarPassage: "",
    audioUrl: "",
    storyParagraphs: []
  },

  // ═══════════════════════════════════════════
  // READING & WRITING PART 4: Fill in blanks from word box
  // ═══════════════════════════════════════════
  {
    id: "rw-part4",
    title: "Reading & Writing Part 4",
    subtitle: "Choose a word from the box",
    icon: "📖",
    color: "text-[oklch(0.55_0.16_130)]",
    bgColor: "bg-[oklch(0.95_0.04_130)]",
    description: "Read this. Choose a word from the box. Write the correct word next to numbers 1-5. There is one example.",
    sceneImageUrl: PAGE11,
    questions: [
      {
        id: 36,
        type: "fill-blank",
        question: "In Mark's flat there are chairs next to the table in the ___.",
        correctAnswer: "kitchen"
      },
      {
        id: 37,
        type: "fill-blank",
        question: "Mark's family sit and eat their ___ there.",
        correctAnswer: "dinner"
      },
      {
        id: 38,
        type: "fill-blank",
        question: "Mark sits on his chair and reads his ___,",
        correctAnswer: "book"
      },
      {
        id: 39,
        type: "fill-blank",
        question: "listens to his radio or plays on his ___.",
        correctAnswer: "tablet"
      },
      {
        id: 40,
        type: "fill-blank",
        question: "There's a big red and blue ___ on the floor under his chair.",
        correctAnswer: "rug"
      }
    ],
    passage: "",
    wordBank: [
      { letter: "A", word: "legs" },
      { letter: "B", word: "dinner" },
      { letter: "C", word: "tablet" },
      { letter: "D", word: "book" },
      { letter: "E", word: "arm" },
      { letter: "F", word: "kitchen" },
      { letter: "G", word: "motorbike" },
      { letter: "H", word: "rug" }
    ],
    grammarPassage: "",
    audioUrl: "",
    storyParagraphs: []
  },

  // ═══════════════════════════════════════════
  // READING & WRITING PART 5: Write one-word answers
  // Open-ended with scene pictures
  // ═══════════════════════════════════════════
  {
    id: "rw-part5",
    title: "Reading & Writing Part 5",
    subtitle: "Write one-word answers",
    icon: "🖊️",
    color: "text-[oklch(0.55_0.16_220)]",
    bgColor: "bg-[oklch(0.95_0.04_220)]",
    description: "Look at the pictures and read the questions. Write one-word answers.",
    sceneImageUrl: PAGE12,
    questions: [
      {
        id: 41,
        type: "open-ended",
        question: "Who is wearing a hat? the ___",
        answer: "girl"
      },
      {
        id: 42,
        type: "open-ended",
        question: "How many animals are drinking now?",
        answer: "three"
      },
      {
        id: 43,
        type: "open-ended",
        question: "What is jumping from the tree? a ___",
        answer: "monkey"
      },
      {
        id: 44,
        type: "open-ended",
        question: "Which child is not happy? the ___",
        answer: "girl"
      },
      {
        id: 45,
        type: "open-ended",
        question: "What is the boy doing? smiling and ___",
        answer: "painting"
      }
    ],
    passage: "",
    wordBank: [],
    grammarPassage: "",
    audioUrl: "",
    storyParagraphs: []
  },

  // ═══════════════════════════════════════════
  // SPEAKING: Scene picture description
  // ═══════════════════════════════════════════
  {
    id: "speaking",
    title: "Speaking",
    subtitle: "Scene Picture Description",
    icon: "🗣️",
    color: "text-[oklch(0.55_0.16_350)]",
    bgColor: "bg-[oklch(0.95_0.04_350)]",
    description: "Look at the scene picture. The teacher will ask you questions about it. Describe what you see.",
    sceneImageUrl: SPEAKING_IMG,
    questions: [
      {
        id: 46,
        type: "open-ended",
        question: "What can you see in the picture? Describe the scene.",
        answer: "A supermarket/grocery store scene with a man pushing a stroller with two children, a woman talking on the phone, fruits on display, bread on shelves, flowers, and bottles."
      },
      {
        id: 47,
        type: "open-ended",
        question: "What is the man doing?",
        answer: "The man is pushing a stroller/pram with two children in it. He is carrying a shopping basket."
      },
      {
        id: 48,
        type: "open-ended",
        question: "What fruits can you see?",
        answer: "Pineapples, watermelons, grapes, oranges, and other fruits on the display shelves."
      },
      {
        id: 49,
        type: "open-ended",
        question: "What is the woman doing?",
        answer: "The woman is talking on her phone. She is carrying an orange bag."
      },
      {
        id: 50,
        type: "open-ended",
        question: "How many children are there? What are they doing?",
        answer: "There are two children in the stroller. One child is reaching out with their hand."
      }
    ],
    passage: "",
    wordBank: [],
    grammarPassage: "",
    audioUrl: "",
    storyParagraphs: []
  }
];

const totalQuestions = sections.reduce((sum, s) => sum + s.questions.length, 0);
const hasListening = sections.some(s => s.audioUrl) ? 1 : 0;
const hasWriting = sections.some(s => s.questions.some(q => q.type === "writing")) ? 1 : 0;

async function main() {
  try {
    const [result] = await db.insert(customPapers).values({
      paperId: `custom-g1-english-proficiency-test-${Date.now().toString(36)}`,
      title: "G1 English Proficiency Test",
      subtitle: "Starter Level Assessment",
      description: "A comprehensive English proficiency test for Grade 1 students covering Listening (4 parts), Reading & Writing (5 parts), and Speaking. Based on Cambridge Starters format.",
      icon: "🌟",
      color: "text-blue-600",
      totalQuestions,
      hasListening,
      hasWriting,
      sectionsJson: JSON.stringify(sections),
      readingWordBankJson: null,
      sourceFilesJson: JSON.stringify([
        { name: "Starter测试.pdf", type: "application/pdf" },
        { name: "01.Test1,Part1.mp3", type: "audio/mpeg" },
        { name: "02.Test1,Part2.mp3", type: "audio/mpeg" },
        { name: "03.Test1,Part3.mp3", type: "audio/mpeg" },
        { name: "04.Test1,Part4.mp3", type: "audio/mpeg" },
        { name: "181772773910_.pic_hd.jpg", type: "image/jpeg" }
      ]),
      status: "published",
    }).$returningId();

    console.log(`✅ Paper created successfully!`);
    console.log(`   ID: ${result.id}`);
    console.log(`   Total questions: ${totalQuestions}`);
    console.log(`   Sections: ${sections.length}`);
    console.log(`   Has listening: ${hasListening}`);
    console.log(`   Has writing: ${hasWriting}`);
    
    process.exit(0);
  } catch (err) {
    console.error("❌ Error creating paper:", err);
    process.exit(1);
  }
}

main();
