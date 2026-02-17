// G6 English Proficiency Assessment - Question Data
// Design: Fresh Educational Illustration Style (Scandinavian Minimalism + Playful Education)

export interface MCQQuestion {
  id: number;
  type: 'mcq';
  question: string;
  highlightWord?: string;
  options: string[];
  correctAnswer: number; // index
}

export interface FillBlankQuestion {
  id: number;
  type: 'fill-blank';
  correctAnswer: string;
}

export interface OpenEndedQuestion {
  id: number;
  type: 'open-ended';
  question: string;
  subQuestions?: { label: string; question: string; answer: string }[];
  answer?: string;
}

export interface TrueFalseQuestion {
  id: number;
  type: 'true-false';
  statements: { label: string; statement: string; isTrue: boolean; reason: string }[];
}

export interface TableQuestion {
  id: number;
  type: 'table';
  question: string;
  rows: { situation: string; thought: string; action: string; blankField: 'thought' | 'action'; answer: string }[];
}

export interface ReferenceQuestion {
  id: number;
  type: 'reference';
  question: string;
  items: { word: string; lineRef: string; answer: string }[];
}

export interface OrderQuestion {
  id: number;
  type: 'order';
  question: string;
  events: string[];
  correctOrder: number[];
}

export interface PhraseQuestion {
  id: number;
  type: 'phrase';
  question: string;
  items: { clue: string; answer: string }[];
}

export interface CheckboxQuestion {
  id: number;
  type: 'checkbox';
  question: string;
  options: string[];
  correctAnswers: number[];
}

export interface WritingQuestion {
  id: number;
  type: 'writing';
  topic: string;
  instructions: string;
  wordCount: string;
  prompts: string[];
}

export type Question = MCQQuestion | FillBlankQuestion | OpenEndedQuestion | TrueFalseQuestion | TableQuestion | ReferenceQuestion | OrderQuestion | PhraseQuestion | CheckboxQuestion | WritingQuestion;

export interface Section {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  bgColor: string;
  description: string;
  questions: Question[];
  passage?: string;
  wordBank?: { letter: string; word: string }[];
  grammarPassage?: string;
  imageUrl?: string;
}

export const sections: Section[] = [
  {
    id: 'vocabulary',
    title: 'Part 1: Vocabulary',
    subtitle: 'Choose the Correct Meaning',
    icon: '📖',
    color: 'text-[oklch(0.55_0.16_160)]',
    bgColor: 'bg-[oklch(0.95_0.04_160)]',
    description: 'For each question, choose the option that is closest in meaning to the underlined word.',
    imageUrl: 'https://private-us-east-1.manuscdn.com/sessionFile/EkfYMR94S7iTs27MlKPHhG/sandbox/EXd2rAVuTpleP76sVHRwu5-img-3_1771255546000_na1fn_dm9jYWJ1bGFyeS1zZWN0aW9u.png?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvRWtmWU1SOTRTN2lUczI3TWxLUEhoRy9zYW5kYm94L0VYZDJyQVZ1VHBsZVA3NnNWSFJ3dTUtaW1nLTNfMTc3MTI1NTU0NjAwMF9uYTFmbl9kbTlqWVdKMWJHRnllUzF6WldOMGFXOXUucG5nP3gtb3NzLXByb2Nlc3M9aW1hZ2UvcmVzaXplLHdfMTkyMCxoXzE5MjAvZm9ybWF0LHdlYnAvcXVhbGl0eSxxXzgwIiwiQ29uZGl0aW9uIjp7IkRhdGVMZXNzVGhhbiI6eyJBV1M6RXBvY2hUaW1lIjoxNzk4NzYxNjAwfX19XX0_&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=BZjyS-Isf91S8NuziKshvwAQDj74p44Jac426QEjneZhfzryHD1VaLsCXmrVP01uhxFyEgtCbHEAcoCHJIFJX5DQz~lH0eim~xW3tRp52moK98pbRlJwt81-mEEYib6BszzvHEWQbo3eUL~OgXZg2v5DeBRK4~k2KpUdSxmCREHzC~gzVdwyr0NXEBc~orX7uFxaM1B6YGYBzsZvFzzkdbuzYcWNNkOwS7B8My3TIl8kt9VZW83-d5rCXMPn~c-4lCc~ZhKBRoEU8EFFq-4wRwCmlTXA8wZaoqc5QzzJoIT95Vt3CvA27-5h1D9QDOs0IfzwSYeVkzg0sfEhwB7jpw__',
    questions: [
      { id: 1, type: 'mcq', question: 'She felt ___ when she lost the game.', highlightWord: 'disappointed', options: ['angry', 'unhappy because of an unexpected result', 'excited', 'confused'], correctAnswer: 1 },
      { id: 2, type: 'mcq', question: 'Please ___ me to call my teacher later.', highlightWord: 'remind', options: ['force', 'help someone remember', 'warn', 'advise'], correctAnswer: 1 },
      { id: 3, type: 'mcq', question: 'The street was ___ during rush hour.', highlightWord: 'crowded', options: ['quiet', 'full of people', 'dangerous', 'narrow'], correctAnswer: 1 },
      { id: 4, type: 'mcq', question: 'He made a ___ after thinking carefully.', highlightWord: 'decision', options: ['mistake', 'choice', 'excuse', 'plan'], correctAnswer: 1 },
      { id: 5, type: 'mcq', question: 'The teacher ___ the students to speak up.', highlightWord: 'encouraged', options: ['forced', 'praised', 'gave confidence to', 'reminded'], correctAnswer: 2 },
      { id: 6, type: 'mcq', question: 'This exercise is designed to ___ your writing skills.', highlightWord: 'improve', options: ['test', 'practise', 'make better', 'check'], correctAnswer: 2 },
      { id: 7, type: 'mcq', question: 'There is a clear ___ between the two methods.', highlightWord: 'difference', options: ['connection', 'result', 'contrast', 'similarity'], correctAnswer: 2 },
      { id: 8, type: 'mcq', question: 'He was ___ of the risks involved.', highlightWord: 'aware', options: ['afraid of', 'responsible for', 'conscious of', 'interested in'], correctAnswer: 2 },
      { id: 9, type: 'mcq', question: 'The report was based on reliable ___.', highlightWord: 'evidence', options: ['opinion', 'explanation', 'proof', 'description'], correctAnswer: 2 },
      { id: 10, type: 'mcq', question: 'The policy may have a negative ___ on small businesses.', highlightWord: 'impact', options: ['effect', 'intention', 'limit', 'cause'], correctAnswer: 0 },
      { id: 11, type: 'mcq', question: 'The manager refused to ___ responsibility for the mistake.', highlightWord: 'accept', options: ['deny', 'take', 'explain', 'share'], correctAnswer: 1 },
      { id: 12, type: 'mcq', question: 'Her explanation was ___.', highlightWord: 'convincing', options: ['confusing', 'detailed', 'believable', 'emotional'], correctAnswer: 2 },
      { id: 13, type: 'mcq', question: 'The scientist proposed a new ___.', highlightWord: 'hypothesis', options: ['conclusion', 'theory to be tested', 'discovery', 'observation'], correctAnswer: 1 },
      { id: 14, type: 'mcq', question: 'The committee reached a ___ after long discussion.', highlightWord: 'consensus', options: ['disagreement', 'decision by authority', 'shared agreement', 'compromise'], correctAnswer: 2 },
      { id: 15, type: 'mcq', question: 'He was criticised for his ___.', highlightWord: 'negligence', options: ['carelessness', 'dishonesty', 'delay', 'impatience'], correctAnswer: 0 },
      { id: 16, type: 'mcq', question: 'The plan aims to ___ long-term growth.', highlightWord: 'sustain', options: ['slow down', 'control', 'maintain', 'predict'], correctAnswer: 2 },
      { id: 17, type: 'mcq', question: 'His argument was logically sound but ___.', highlightWord: 'untenable', options: ['unclear', 'difficult to understand', 'impossible to defend', 'unpopular'], correctAnswer: 2 },
      { id: 18, type: 'mcq', question: 'The author adopts an ___ tone throughout the novel.', highlightWord: 'ambiguous', options: ['emotional', 'unclear and open to interpretation', 'aggressive', 'critical'], correctAnswer: 1 },
      { id: 19, type: 'mcq', question: 'The policy was criticised for its ___ flaws.', highlightWord: 'inherent', options: ['hidden', 'avoidable', 'temporary', 'existing as a natural part'], correctAnswer: 3 },
      { id: 20, type: 'mcq', question: 'She delivered a ___ summary of the issue.', highlightWord: 'succinct', options: ['detailed', 'lengthy', 'brief and precise', 'emotional'], correctAnswer: 2 },
    ],
  },
  {
    id: 'grammar',
    title: 'Part 2: Grammar',
    subtitle: 'Fill in the Blanks',
    icon: '✏️',
    color: 'text-[oklch(0.65_0.15_75)]',
    bgColor: 'bg-[oklch(0.95_0.04_75)]',
    description: 'Fill in each blank with the correct word from the word bank. Each word may only be used once.',
    imageUrl: 'https://private-us-east-1.manuscdn.com/sessionFile/EkfYMR94S7iTs27MlKPHhG/sandbox/EXd2rAVuTpleP76sVHRwu5-img-4_1771255546000_na1fn_Z3JhbW1hci1zZWN0aW9u.png?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvRWtmWU1SOTRTN2lUczI3TWxLUEhoRy9zYW5kYm94L0VYZDJyQVZ1VHBsZVA3NnNWSFJ3dTUtaW1nLTRfMTc3MTI1NTU0NjAwMF9uYTFmbl9aM0poYlcxaGNpMXpaV04wYVc5dS5wbmc~eC1vc3MtcHJvY2Vzcz1pbWFnZS9yZXNpemUsd18xOTIwLGhfMTkyMC9mb3JtYXQsd2VicC9xdWFsaXR5LHFfODAiLCJDb25kaXRpb24iOnsiRGF0ZUxlc3NUaGFuIjp7IkFXUzpFcG9jaFRpbWUiOjE3OTg3NjE2MDB9fX1dfQ__&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=mvqSKDSJLTfUNZ55gJuBVmFJwDvC9x-RKfqQedSyL~A08NqeJwybLKKIxViKqBOUb6E5Z~98~a~SUzJ8~Kz0N35c4Hf8teAJc62rn1gepG~OUAp21ZaqLAOTIgwMzdmAK5nFRwp70IHpbbudZJ3pS4I1sJ4YCbnVw5JUAjj9ZvTiaPFQ4DzmdE2aBCXVdZK5-a8t~pE7c~GUt0VwIDN5KGgcLycbEz3G7KbMsHxKirX2WojgXuS0mzedLZP1Hsg8sCqnU~wxIQwEUlkYBWCdcnJ2nr9IpL23tnvEkb9Gxw7OgwbIHOFsNRqYSI0xzM57aJJ9uopgxzDiy8MYx6dEnA__',
    wordBank: [
      { letter: 'A', word: 'although' },
      { letter: 'B', word: 'which' },
      { letter: 'C', word: 'despite' },
      { letter: 'D', word: 'has' },
      { letter: 'E', word: 'whose' },
      { letter: 'F', word: 'being' },
      { letter: 'G', word: 'as' },
      { letter: 'H', word: 'what' },
      { letter: 'I', word: 'it' },
      { letter: 'J', word: 'only' },
      { letter: 'K', word: 'where' },
      { letter: 'L', word: 'whether' },
      { letter: 'M', word: 'while' },
      { letter: 'N', word: 'had' },
    ],
    grammarPassage: `Education plays a vital role in shaping individuals and societies. <b>(21) ___</b> many people believe that academic success depends mainly on intelligence, research shows that motivation and effort are equally important. Students often perform well not <b>(22) ___</b> because they are naturally gifted, but because they develop effective learning habits.

Supportive environments also matter. Families <b>(23) ___</b> attitudes towards education are positive tend to raise children who value learning. In contrast, students may struggle in situations <b>(24) ___</b> encouragement is lacking, even if they have strong potential.

Studies suggest that success in education is closely linked to <b>(25) ___</b> learners believe about their own abilities. Teachers can influence this by recognising effort, <b>(26) ___</b> confidence gradually through constructive feedback. However, real improvement depends on <b>(27) ___</b> students are willing to reflect on mistakes and learn from them.

<b>(28) ___</b> examinations remain an important part of most education systems, they cannot fully measure creativity or critical thinking. A learner <b>(29) ___</b> curiosity is encouraged is more likely to become independent than one who studies only to pass tests.

Ultimately, education is not <b>(30) ___</b> a pathway to employment, but a lifelong process that shapes how people understand the world.`,
    questions: [
      { id: 21, type: 'fill-blank', correctAnswer: 'A' },
      { id: 22, type: 'fill-blank', correctAnswer: 'K' },
      { id: 23, type: 'fill-blank', correctAnswer: 'E' },
      { id: 24, type: 'fill-blank', correctAnswer: 'L' },
      { id: 25, type: 'fill-blank', correctAnswer: 'H' },
      { id: 26, type: 'fill-blank', correctAnswer: 'F' },
      { id: 27, type: 'fill-blank', correctAnswer: 'N' },
      { id: 28, type: 'fill-blank', correctAnswer: 'I' },
      { id: 29, type: 'fill-blank', correctAnswer: 'B' },
      { id: 30, type: 'fill-blank', correctAnswer: 'J' },
    ],
  },
  {
    id: 'reading',
    title: 'Part 3: Reading Comprehension',
    subtitle: 'Read and Answer',
    icon: '📚',
    color: 'text-[oklch(0.50_0.18_255)]',
    bgColor: 'bg-[oklch(0.92_0.05_255)]',
    description: 'Read the passage carefully and answer the questions that follow.',
    imageUrl: 'https://private-us-east-1.manuscdn.com/sessionFile/EkfYMR94S7iTs27MlKPHhG/sandbox/EXd2rAVuTpleP76sVHRwu5-img-5_1771255555000_na1fn_cmVhZGluZy1zZWN0aW9u.png?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvRWtmWU1SOTRTN2lUczI3TWxLUEhoRy9zYW5kYm94L0VYZDJyQVZ1VHBsZVA3NnNWSFJ3dTUtaW1nLTVfMTc3MTI1NTU1NTAwMF9uYTFmbl9jbVZoWkdsdVp5MXpaV04wYVc5dS5wbmc~eC1vc3MtcHJvY2Vzcz1pbWFnZS9yZXNpemUsd18xOTIwLGhfMTkyMC9mb3JtYXQsd2VicC9xdWFsaXR5LHFfODAiLCJDb25kaXRpb24iOnsiRGF0ZUxlc3NUaGFuIjp7IkFXUzpFcG9jaFRpbWUiOjE3OTg3NjE2MDB9fX1dfQ__&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=AwYC4LsxiWVubbD2-PER5-SP1g02Jz6Wi4mNfU9In5zP96pfxPMFrYgj4s27r2PMtE0sBcWgJHXMJQGEc00gt5Hu9GRjRbOoNVFF4MZnUe2uoCSodvAaOnto3yBG3-qcl6Wvajc4BCOS0DL7ARH4PZa03EvmaTxSzWBJXqjcmkP7XJFNwTXEcBQlq02qPIapscDvVKIXN6ER0Ln0-H7ZIgrxEAZkEF3jKJbkyG5Uqsjddo9grQkgIML70lhhduX~wPFm5oBCxuUiNbe6TjgXafCVfWsEr4-Oy4uMutY7K6HwmufSy6cEreEJt-eJ3mMHZfeJFbAuV5trrqso8CMDww__',
    passage: `Yesterday afternoon, Mother took me to the dentist for my annual check-up. After the visit, we decided to stop at a café for a quick drink. It had been a hot, sweltering day, and we were both thirsty. However, while we were inside, the weather changed dramatically. Dark clouds rolled in and it started to pour.

We were completely unprepared — neither of us had brought an umbrella. When we stepped outside, the rain was coming down in sheets. We looked around desperately for a taxi, but every one that passed was already occupied. The few empty ones simply drove past without stopping, their drivers seemingly in a hurry to get somewhere else.

As we stood there, getting wetter by the minute, a kind-looking old man approached us. He was carrying a large, rather nice umbrella. He smiled warmly and said he couldn't help noticing our predicament. He explained that he was "in a bit of a predicament" himself — he had left his wallet at home and had no money for a taxi. He offered to sell us his umbrella for five dollars.

Mother looked at him suspiciously. She had a golden rule: the nicer a man seemed, the more suspicious one should be. She tightened her grip on my hand and drew me closer to her while looking at the man suspiciously. But the rain was getting heavier, and we were already soaked. Eventually, Mother sighed, opened her purse, and gave the man five dollars. He thanked us profusely, handed over the umbrella, and hurried off.

We walked home under the umbrella, and Mother told me she had been cautious but was glad to help someone in need. "Perhaps I was too suspicious," she said thoughtfully.

But then, to our surprise, as we passed a café, we spotted the same old man. He walked into the café, looked around casually, then picked up an umbrella from the umbrella stand near the door and walked out. We watched in astonishment as he approached another woman caught in the rain and began his little speech again. Mother shrieked, "So, that's his little game!"`,
    questions: [
      {
        id: 31,
        type: 'open-ended',
        question: 'Based on paragraph 1, what did the narrator do once a year?',
        answer: 'The narrator went to the dentist for an annual check-up.',
      },
      {
        id: 32,
        type: 'open-ended',
        question: 'Give two reasons why Mother would not be able to get home on time to cook dinner because of the heavy rain.',
        subQuestions: [
          { label: 'a', question: 'Reason 1:', answer: 'It was raining heavily / It had started to pour.' },
          { label: 'b', question: 'Reason 2:', answer: 'There were no taxis available as most of them were occupied.' },
        ],
      },
      {
        id: 33,
        type: 'true-false',
        statements: [
          { label: 'a', statement: 'The narrator and Mother went to the café in the morning.', isTrue: false, reason: 'They went there in the afternoon / "Yesterday afternoon".' },
          { label: 'b', statement: 'It had been raining before the narrator and Mother left the house.', isTrue: false, reason: 'It was a hot, sweltering day when they left the house.' },
          { label: 'c', statement: 'Mother believed that one had to be wary of men who were excessively nice.', isTrue: true, reason: 'Mother had a golden rule that the nicer a man seemed, the more suspicious one should be.' },
        ],
      },
      {
        id: 34,
        type: 'open-ended',
        question: 'The old man said he was "in a bit of a predicament". Explain clearly what the predicament was.',
        answer: 'He had left his wallet at home and had no money to take a taxi home.',
      },
      {
        id: 35,
        type: 'table',
        question: 'Based on the information, complete the following table:',
        rows: [
          { situation: 'The old man offered his umbrella for five dollars.', thought: 'Mother had doubts about the old man\'s intentions.', action: '', blankField: 'action', answer: 'She gave the old man five dollars.' },
          { situation: 'Mother spotted the old man enter the café.', thought: '', action: 'Mother followed him to the café.', blankField: 'thought', answer: 'Mother suspected that the old man might not be telling the truth / doubted his intentions.' },
        ],
      },
      {
        id: 36,
        type: 'open-ended',
        question: 'The narrator asked Mother why she had initially been so suspicious of the man. What had Mother done earlier to make her ask that question?',
        answer: 'Mother tightened her grip on the narrator\'s hand and drew the narrator closer to her while looking at the man suspiciously.',
      },
      {
        id: 37,
        type: 'reference',
        question: 'What do the following words refer to in the passage?',
        items: [
          { word: 'it', lineRef: 'paragraph 1', answer: 'the rain / the weather' },
          { word: 'them', lineRef: 'paragraph 2', answer: 'the taxis' },
          { word: 'she', lineRef: 'last paragraph', answer: 'the woman the old man spoke to' },
        ],
      },
      {
        id: 38,
        type: 'order',
        question: 'Write 1, 2, and 3 to indicate the correct order of events:',
        events: [
          'The narrator and Mother witnessed the old man take an umbrella before walking out of the door.',
          'The narrator noticed that the old man was carrying a nice umbrella.',
          'The narrator and Mother saw a woman with an umbrella.',
        ],
        correctOrder: [2, 1, 3],
      },
      {
        id: 39,
        type: 'phrase',
        question: 'Complete the table by identifying the correct word/phrase from the passage:',
        items: [
          { clue: 'Which three-word phrase tells you that the narrator and Mother did not expect to see the old man again?', answer: 'to our surprise' },
          { clue: 'Which three-word phrase tells you that Mother finally knew the old man had an ulterior motive?', answer: 'his little game' },
        ],
      },
      {
        id: 40,
        type: 'checkbox',
        question: 'Based on the passage, which two of the following words best describe the old man?',
        options: ['devious', 'reliable', 'gullible', 'thoughtful', 'clever', 'honest'],
        correctAnswers: [0, 4],
      },
    ],
  },
  {
    id: 'writing',
    title: 'Part 4: Writing',
    subtitle: 'Composition',
    icon: '✍️',
    color: 'text-[oklch(0.60_0.20_25)]',
    bgColor: 'bg-[oklch(0.95_0.05_25)]',
    description: 'Write a composition on the given topic.',
    imageUrl: 'https://private-us-east-1.manuscdn.com/sessionFile/EkfYMR94S7iTs27MlKPHhG/sandbox/xFjnIMa2TcdacptdSFDCMw-img-1_1771267457000_na1fn_d3JpdGluZy1zZWN0aW9u.png?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvRWtmWU1SOTRTN2lUczI3TWxLUEhoRy9zYW5kYm94L3hGam5JTWEyVGNkYWNwdGRTRkRDTXctaW1nLTFfMTc3MTI2NzQ1NzAwMF9uYTFmbl9kM0pwZEdsdVp5MXpaV04wYVc5dS5wbmc~eC1vc3MtcHJvY2Vzcz1pbWFnZS9yZXNpemUsd18xOTIwLGhfMTkyMC9mb3JtYXQsd2VicC9xdWFsaXR5LHFfODAiLCJDb25kaXRpb24iOnsiRGF0ZUxlc3NUaGFuIjp7IkFXUzpFcG9jaFRpbWUiOjE3OTg3NjE2MDB9fX1dfQ__&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=LJEGISP7BLcX3ICV0u0U0uADpcB7dDy7xrCPj0zDOtYa8mIL8-UwqQZuZMZ0mS8cPDZOeQTDRaKBnTMrlSAm61vpEuvXhACr~OwqCSh64Vr69SGO1iw3LJVADBH0Z3RaXrdWdf1VaXnveBmHVUgu7-PUHYNeC2Qey4tTTsDCVEWKiLsvAtPsghKp6HTe7pq4N-ORaa~Xz0Wkpn108IhnpvfeSYQFtBdvNyS~YUk6nxZ14Z4~htR9HfkXFIoIZwqgJKrNhFCOwbHyhN9c81KvznUTIRZOsOKgsh-GfnW3vpcEAM2htmDdlQYym94lcgT1IUS-mtReAQvUnylmw5SZ7A__',
    questions: [
      {
        id: 41,
        type: 'writing',
        topic: 'An Unexpected Encounter',
        instructions: 'Write about an unexpected encounter that changed the way you looked at someone or something.',
        wordCount: '200-250 words',
        prompts: [
          'where and when the encounter happened',
          'who you met',
          'what happened during the encounter',
          'how your thoughts or feelings changed afterwards',
        ],
      },
    ],
  },
];

// Helper to get total auto-gradable questions count
export function getAutoGradableCount(): number {
  let count = 0;
  for (const section of sections) {
    for (const q of section.questions) {
      if (q.type === 'mcq' || q.type === 'fill-blank' || q.type === 'checkbox') {
        count++;
      }
    }
  }
  return count;
}
