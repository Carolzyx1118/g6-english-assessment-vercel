type ParsedQuestion = Record<string, unknown>;
type ParsedSection = Record<string, unknown>;

type ParseMaterialsInput = {
  textContent?: string;
  answerTextContent?: string;
  imageUrls?: string[];
  pageImageUrls?: string[];
  pdfUrls?: string[];
  audioUrls?: string[];
  instructions?: string;
};

type ExtractedPage = {
  sourceName?: string;
  pageNumber: number;
  text: string;
};

const SECTION_STYLE = {
  vocabulary: {
    icon: "📚",
    color: "text-[oklch(0.55_0.16_160)]",
    bgColor: "bg-[oklch(0.95_0.04_160)]",
  },
  grammar: {
    icon: "🧩",
    color: "text-[oklch(0.58_0.15_80)]",
    bgColor: "bg-[oklch(0.96_0.03_85)]",
  },
  speaking: {
    icon: "🗣️",
    color: "text-[oklch(0.56_0.14_25)]",
    bgColor: "bg-[oklch(0.96_0.03_20)]",
  },
  listening: {
    icon: "🎧",
    color: "text-[oklch(0.57_0.17_285)]",
    bgColor: "bg-[oklch(0.95_0.04_285)]",
  },
  reading: {
    icon: "📖",
    color: "text-[oklch(0.54_0.15_235)]",
    bgColor: "bg-[oklch(0.95_0.04_235)]",
  },
  writing: {
    icon: "✍️",
    color: "text-[oklch(0.6_0.16_15)]",
    bgColor: "bg-[oklch(0.96_0.03_15)]",
  },
} as const;

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function splitExtractedPages(textContent: string): ExtractedPage[] {
  const matches = Array.from(
    textContent.matchAll(
      /---\s+(.+?)\s+\/\s+Page\s+(\d+)\s+---\n([\s\S]*?)(?=\n\n---\s+.+?\s+\/\s+Page\s+\d+\s+---|$)/g
    )
  );

  if (!matches.length) {
    return [
      {
        pageNumber: 1,
        text: normalizeText(textContent),
      },
    ];
  }

  return matches.map((match) => ({
    sourceName: match[1],
    pageNumber: Number(match[2]),
    text: normalizeText(match[3]),
  }));
}

function stripGeneratorHeader(pageText: string): string {
  return normalizeText(
    pageText.replace(
      /^\d+\s+Compact Key for Schools Test Generator[\s\S]*?FINAL TEST\s+Standard\s+/i,
      ""
    )
  );
}

function extractBetween(
  text: string,
  startMarker: string,
  endMarker?: string
): string {
  const startIndex = text.indexOf(startMarker);
  if (startIndex === -1) {
    return "";
  }

  const sliceStart = startIndex + startMarker.length;
  if (!endMarker) {
    return text.slice(sliceStart).trim();
  }

  const endIndex = text.indexOf(endMarker, sliceStart);
  if (endIndex === -1) {
    return text.slice(sliceStart).trim();
  }

  return text.slice(sliceStart, endIndex).trim();
}

function sliceBetweenMarkers(
  text: string,
  startMarker: string,
  endMarker?: string
): string {
  const startIndex = text.indexOf(startMarker);
  if (startIndex === -1) {
    return "";
  }

  if (!endMarker) {
    return text.slice(startIndex).trim();
  }

  const endIndex = text.indexOf(endMarker, startIndex + startMarker.length);
  if (endIndex === -1) {
    return text.slice(startIndex).trim();
  }

  return text.slice(startIndex, endIndex).trim();
}

function findMarker(text: string, marker: number, fromIndex: number): number {
  const pattern = new RegExp(`(?:^|\\s)${marker}\\s`, "g");
  pattern.lastIndex = fromIndex;
  const match = pattern.exec(text);
  return match ? match.index + (match[0].startsWith(" ") ? 1 : 0) : -1;
}

function splitSequentialItems(text: string, total: number): string[] {
  const normalized = normalizeText(text);
  const items: string[] = [];
  let currentStart = findMarker(normalized, 1, 0);

  if (currentStart === -1) {
    return items;
  }

  for (let number = 1; number <= total; number++) {
    const nextStart =
      number < total ? findMarker(normalized, number + 1, currentStart + 1) : -1;
    const raw = normalized
      .slice(currentStart, nextStart === -1 ? normalized.length : nextStart)
      .replace(new RegExp(`^${number}\\s+`), "")
      .trim();

    if (raw) {
      items.push(raw);
    }

    if (nextStart === -1) {
      break;
    }
    currentStart = nextStart;
  }

  return items;
}

function parseLetterOptions(
  block: string,
  labels: string[] = ["A", "B", "C", "D", "E", "F", "G", "H"]
): { stem: string; options: string[] } {
  const firstLabel = labels.find((label) => block.includes(` ${label} `));
  if (!firstLabel) {
    return { stem: normalizeText(block), options: [] };
  }

  const firstIndex = block.indexOf(` ${firstLabel} `);
  const stem = normalizeText(block.slice(0, firstIndex));
  const optionBlock = block.slice(firstIndex + 1);
  const pattern = new RegExp(
    `(?:^|\\s)([${labels.join("")}])\\s+(.+?)(?=(?:\\s[${labels.join("")}]\\s)|$)`,
    "g"
  );
  const options: string[] = [];

  for (const match of Array.from(optionBlock.matchAll(pattern))) {
    options.push(normalizeText(match[2]));
  }

  return { stem, options };
}

function parseWordBank(wordBankText: string): { letter: string; word: string }[] {
  const normalized = normalizeText(wordBankText);
  if (!normalized) {
    return [];
  }

  const merged = normalized
    .replace(/\bdepartment store\b/gi, "department_store")
    .replace(/\bquiz show\b/gi, "quiz_show")
    .replace(/\btraffic lights\b/gi, "traffic_lights");

  return merged
    .split(" ")
    .map((item) => item.replace(/_/g, " ").trim())
    .filter(Boolean)
    .map((word, index) => ({
      letter: String.fromCharCode(65 + index),
      word,
    }));
}

function extractPromptQuestions(text: string): string[] {
  return Array.from(text.matchAll(/([^?]+\?)/g))
    .map((match) => normalizeText(match[1].replace(/^[.·…]+/, "")))
    .filter(Boolean);
}

function normalizeAnswerToken(value: string): string {
  return value
    .replace(/^[-:;,.()[\]]+|[-:;,.()[\]]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isPlausibleAnswerToken(value: string): boolean {
  if (!value || value.length > 40) {
    return false;
  }

  return !/^(page|pages|part|section|question|questions|answer|answers|key|keys|mark|marks|score|scores)$/i.test(
    value
  );
}

export function extractAnswerKeyMap(answerTextContent?: string): Map<number, string> {
  const map = new Map<number, string>();
  if (!answerTextContent) {
    return map;
  }

  const cleaned = answerTextContent
    .replace(/---\s+.+?\s+\/\s+Page\s+\d+\s+---/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const pattern =
    /(?:^|\s)(\d{1,3})[.)、:：-]?\s*([A-H](?:\s*\/\s*[A-H])?|true|false|yes|no|[A-Za-z][A-Za-z'/-]*(?:\s+[A-Za-z][A-Za-z'/-]*){0,3})(?=(?:\s+\d{1,3}[.)、:：-]?\s)|$)/gi;

  for (const match of Array.from(cleaned.matchAll(pattern))) {
    const questionNumber = Number(match[1]);
    const rawAnswer = normalizeAnswerToken(match[2] || "");

    if (!Number.isFinite(questionNumber) || questionNumber < 1) {
      continue;
    }

    if (!isPlausibleAnswerToken(rawAnswer)) {
      continue;
    }

    map.set(questionNumber, rawAnswer);
  }

  return map;
}

function normalizeOptionText(option: unknown): string {
  if (typeof option === "string") {
    return normalizeAnswerToken(option).toLowerCase();
  }

  if (option && typeof option === "object") {
    const record = option as Record<string, unknown>;
    const text = typeof record.text === "string" ? record.text : "";
    const label = typeof record.label === "string" ? record.label : "";
    return normalizeAnswerToken(text || label).toLowerCase();
  }

  return "";
}

function resolveChoiceAnswer(
  question: ParsedQuestion,
  rawAnswer: string
): number | undefined {
  const normalized = normalizeAnswerToken(rawAnswer);
  if (!normalized) {
    return undefined;
  }

  if (/^[A-H]$/i.test(normalized)) {
    const index = normalized.toUpperCase().charCodeAt(0) - 65;
    const options = Array.isArray(question.options) ? question.options : [];
    return index >= 0 && index < options.length ? index : undefined;
  }

  if (/^\d+$/.test(normalized)) {
    const index = Number(normalized) - 1;
    const options = Array.isArray(question.options) ? question.options : [];
    return index >= 0 && index < options.length ? index : undefined;
  }

  if (!Array.isArray(question.options)) {
    return undefined;
  }

  const target = normalized.toLowerCase();
  const optionIndex = question.options.findIndex(
    (option) => normalizeOptionText(option) === target
  );

  return optionIndex >= 0 ? optionIndex : undefined;
}

function resolveFillBlankAnswer(
  rawAnswer: string,
  wordBank: Array<{ letter?: string; word?: string }>
): string {
  const normalized = normalizeAnswerToken(rawAnswer);
  if (!normalized) {
    return "";
  }

  if (!wordBank.length) {
    return normalized;
  }

  if (/^[A-Z]$/i.test(normalized)) {
    const matchedByLetter = wordBank.find(
      (item) => item.letter?.toUpperCase() === normalized.toUpperCase()
    );
    if (matchedByLetter?.word) {
      return matchedByLetter.word;
    }
  }

  const matchedByWord = wordBank.find(
    (item) => normalizeAnswerToken(item.word || "").toLowerCase() === normalized.toLowerCase()
  );

  return matchedByWord?.word || normalized;
}

export function applyAnswerKeyToSections(
  sections: ParsedSection[],
  answerMap: Map<number, string>
): { sections: ParsedSection[]; appliedCount: number } {
  let appliedCount = 0;

  const nextSections = sections.map((section) => {
    const wordBank = Array.isArray(section.wordBank)
      ? (section.wordBank as Array<{ letter?: string; word?: string }>)
      : [];

    const questions = Array.isArray(section.questions)
      ? (section.questions as ParsedQuestion[]).map((question) => {
          const rawAnswer = answerMap.get(Number(question.id));
          if (!rawAnswer || typeof question.type !== "string") {
            return question;
          }

          switch (question.type) {
            case "mcq":
            case "picture-mcq":
            case "listening-mcq": {
              const resolved = resolveChoiceAnswer(question, rawAnswer);
              if (typeof resolved !== "number") {
                return question;
              }
              appliedCount += 1;
              return { ...question, correctAnswer: resolved };
            }

            case "fill-blank":
            case "wordbank-fill":
            case "story-fill": {
              const resolved = resolveFillBlankAnswer(rawAnswer, wordBank);
              if (!resolved) {
                return question;
              }
              appliedCount += 1;
              return { ...question, correctAnswer: resolved };
            }

            default:
              return question;
          }
        })
      : [];

    return {
      ...section,
      questions,
    };
  });

  return { sections: nextSections, appliedCount };
}

function createSection(
  family: keyof typeof SECTION_STYLE,
  id: string,
  title: string,
  subtitle: string,
  description: string,
  questions: ParsedQuestion[],
  extras: Record<string, unknown> = {}
): ParsedSection {
  const style = SECTION_STYLE[family];
  return {
    id,
    title,
    subtitle,
    description,
    questions,
    icon: style.icon,
    color: style.color,
    bgColor: style.bgColor,
    ...extras,
  };
}

function nextQuestionIdFactory() {
  let current = 1;
  return () => current++;
}

function createFallbackSection(
  nextQuestionId: () => number,
  title: string,
  content: string
): ParsedSection {
  return createSection(
    "reading",
    slugify(title) || "imported-section",
    title,
    "Imported content",
    "This block could not be classified cleanly. Please review and adjust manually.",
    [
      {
        id: nextQuestionId(),
        type: "open-ended",
        question: content,
        answer: "",
      },
    ]
  );
}

function parseVocabularySections(text: string, nextQuestionId: () => number): ParsedSection[] {
  const sections: ParsedSection[] = [];
  const part1Heading = "1 Choose the correct option to complete the sentences.";
  const part2Heading = "2 Complete the sentences with these words.";
  const part3Heading = "3 Choose the correct option (A or B) to complete the sentences.";

  const part1 = extractBetween(text, part1Heading, part2Heading);
  const part2 = extractBetween(text, part2Heading, part3Heading);
  const part3 = extractBetween(text, part3Heading);

  if (part1) {
    sections.push(
      createSection(
        "vocabulary",
        "vocabulary-part-1",
        "Vocabulary Part 1",
        "Slash-choice sentence completion",
        "The local parser kept the sentence body and left answers blank for manual review.",
        splitSequentialItems(part1, 8).map((item) => ({
          id: nextQuestionId(),
          type: "fill-blank",
          question: item,
          correctAnswer: "",
        }))
      )
    );
  }

  if (part2) {
    const firstQuestionIndex = findMarker(part2, 1, 0);
    const wordBankText =
      firstQuestionIndex === -1 ? "" : part2.slice(0, firstQuestionIndex).trim();
    const questionText =
      firstQuestionIndex === -1 ? part2 : part2.slice(firstQuestionIndex).trim();

    sections.push(
      createSection(
        "vocabulary",
        "vocabulary-part-2",
        "Vocabulary Part 2",
        "Word bank fill-in",
        "Review the word bank and each sentence. Answers are intentionally blank.",
        splitSequentialItems(questionText, 8).map((item) => ({
          id: nextQuestionId(),
          type: "fill-blank",
          question: item,
          correctAnswer: "",
        })),
        {
          wordBank: parseWordBank(wordBankText),
        }
      )
    );
  }

  if (part3) {
    sections.push(
      createSection(
        "vocabulary",
        "vocabulary-part-3",
        "Vocabulary Part 3",
        "A/B multiple choice",
        "Options were parsed from the PDF text. Please verify every correct answer.",
        splitSequentialItems(part3, 8).map((item) => {
          const { stem, options } = parseLetterOptions(item, ["A", "B"]);
          return {
            id: nextQuestionId(),
            type: "mcq",
            question: stem,
            options: options.length ? options : ["", ""],
            correctAnswer: 0,
            imageUrl: "",
          };
        })
      )
    );
  }

  return sections;
}

function parseGrammarSections(text: string, nextQuestionId: () => number): ParsedSection[] {
  const sections: ParsedSection[] = [];
  const cumulativeHeading = "Cumulative Vocabulary and Grammar";
  const baseGrammar = extractBetween(text, "1 Choose the correct options to complete the text.", cumulativeHeading);
  const cumulative = extractBetween(text, cumulativeHeading);

  const grammarPart2Heading = "2 Put the words in order to make correct sentences.";
  const grammarPart3Heading = "3 Choose the correct option to complete the sentences.";

  const part1 = extractBetween(baseGrammar, "", grammarPart2Heading).trim();
  const part2 = extractBetween(baseGrammar, grammarPart2Heading, grammarPart3Heading);
  const part3 = extractBetween(baseGrammar, grammarPart3Heading);

  if (part1) {
    const blankIds = Array.from(part1.matchAll(/\((\d+)\)/g)).map((match) =>
      Number(match[1])
    );
    sections.push(
      createSection(
        "grammar",
        "grammar-part-1",
        "Grammar Part 1",
        "Passage completion",
        "The source passage is preserved below. Fill in the correct answers during review.",
        blankIds.map((blankId) => ({
          id: nextQuestionId(),
          type: "fill-blank",
          question: `Blank (${blankId}) in the grammar passage`,
          correctAnswer: "",
        })),
        {
          passage: part1,
        }
      )
    );
  }

  if (part2) {
    sections.push(
      createSection(
        "grammar",
        "grammar-part-2",
        "Grammar Part 2",
        "Put the words in order",
        "Sentence reordering prompts were extracted directly from the PDF.",
        splitSequentialItems(part2, 7).map((item) => ({
          id: nextQuestionId(),
          type: "open-ended",
          question: item,
          answer: "",
        }))
      )
    );
  }

  if (part3) {
    sections.push(
      createSection(
        "grammar",
        "grammar-part-3",
        "Grammar Part 3",
        "Slash-choice sentence completion",
        "The local parser preserved each sentence and left the answer blank for manual review.",
        splitSequentialItems(part3, 10).map((item) => ({
          id: nextQuestionId(),
          type: "fill-blank",
          question: item,
          correctAnswer: "",
        }))
      )
    );
  }

  if (cumulative) {
    const partText = extractBetween(cumulative, "Choose the correct options to complete the text.");
    const blankIds = Array.from(partText.matchAll(/\((\d+)\)/g)).map((match) =>
      Number(match[1])
    );
    sections.push(
      createSection(
        "grammar",
        "cumulative-vocabulary-and-grammar",
        "Cumulative Vocabulary and Grammar",
        "Mixed cloze review",
        "The passage was imported as-is. Check every blank and answer manually.",
        blankIds.map((blankId) => ({
          id: nextQuestionId(),
          type: "fill-blank",
          question: `Blank (${blankId}) in the cumulative passage`,
          correctAnswer: "",
        })),
        {
          passage: partText,
        }
      )
    );
  }

  return sections;
}

function parseSpeakingSections(text: string, nextQuestionId: () => number): ParsedSection[] {
  const sections: ParsedSection[] = [];
  const phase1 = extractBetween(text, "Phase 1", "Phase 2");
  const phase2 = extractBetween(text, "Phase 2");

  if (phase1) {
    const prompts = extractPromptQuestions(phase1);
    sections.push(
      createSection(
        "speaking",
        "speaking-phase-1",
        "Speaking Phase 1",
        "Talk together about the pictures",
        "Speaking prompts were imported as open-ended sub-questions.",
        [
          {
            id: nextQuestionId(),
            type: "open-ended",
            question: "Do you like these different hobbies? Say why or why not.",
            subQuestions: prompts.map((prompt, index) => ({
              label: String.fromCharCode(97 + index),
              question: prompt,
              answer: "",
            })),
          },
        ]
      )
    );
  }

  if (phase2) {
    const prompts = extractPromptQuestions(phase2);
    sections.push(
      createSection(
        "speaking",
        "speaking-phase-2",
        "Speaking Phase 2",
        "Extended speaking prompts",
        "Follow-up speaking prompts were imported for manual refinement.",
        [
          {
            id: nextQuestionId(),
            type: "open-ended",
            question: "Answer the follow-up speaking questions.",
            subQuestions: prompts.map((prompt, index) => ({
              label: String.fromCharCode(97 + index),
              question: prompt,
              answer: "",
            })),
          },
        ]
      )
    );
  }

  return sections;
}

function parseListeningSection(text: string, nextQuestionId: () => number): ParsedSection[] {
  const listeningPart = extractBetween(
    text,
    "FT Part 5 For each question, choose the correct answer.",
    "Reading and Writing"
  );

  if (!listeningPart) {
    return [];
  }

  const prompt = normalizeText(
    extractBetween(
      listeningPart,
      "",
      "Example:"
    )
  );
  const peopleStart = listeningPart.indexOf("People Problems");
  const peopleBlock = peopleStart === -1 ? listeningPart : listeningPart.slice(peopleStart);
  const personNames = [1, 2, 3, 4, 5]
    .map((number) => {
      const start = findMarker(peopleBlock, number, 0);
      if (start === -1) {
        return "";
      }
      const firstLabelMatch = peopleBlock
        .slice(start)
        .match(/\s([A-H])\s/);
      if (!firstLabelMatch || typeof firstLabelMatch.index !== "number") {
        return "";
      }
      return normalizeText(
        peopleBlock
          .slice(start, start + firstLabelMatch.index)
          .replace(new RegExp(`^${number}\\s+`), "")
      );
    })
    .filter(Boolean);
  const optionStart = peopleBlock.indexOf("A ");
  const optionBlock = optionStart === -1 ? "" : peopleBlock.slice(optionStart);
  const { options } = parseLetterOptions(optionBlock);
  const normalizedOptions = options.length ? options : ["bad leg", "burn on hand", "cold", "headache"];

  return [
    createSection(
      "listening",
      "listening-part-5",
      "Listening Part 5",
      "Match each person to the correct problem",
      "People and options were extracted locally. Confirm the options and correct answers manually.",
      personNames.map((person) => ({
        id: nextQuestionId(),
        type: "mcq",
        question: `${prompt} ${person}`.trim(),
        options: normalizedOptions,
        correctAnswer: 0,
        imageUrl: "",
      }))
    ),
  ];
}

function parseReadingWritingSections(
  text: string,
  nextQuestionId: () => number
): ParsedSection[] {
  const sections: ParsedSection[] = [];
  const part1 = extractBetween(text, "Part 1 For each question, choose the correct answer.", "Part 6");
  const part6 = extractBetween(text, "Part 6");

  if (part1) {
    const questionStems = [
      extractBetween(part1, "1 ", "2 "),
      extractBetween(part1, "2 ", "3 "),
      extractBetween(part1, "3 ", "4 "),
      extractBetween(
        part1,
        "4 ",
        "A Steven is asking if Jessica has found his folder at school."
      ),
      extractBetween(
        text,
        "Write 25 words or more.",
        "PHOTOGRAPHY COMPETITION"
      ),
      extractBetween(
        text,
        "PHOTOGRAPHY COMPETITION",
        "A Ms Wilson’s chemistry students won’t have any lessons today."
      ),
    ].map((item) => normalizeText(item)).filter(Boolean);

    const optionBlocks = [
      sliceBetweenMarkers(
        text,
        "A Steven is asking if Jessica has found his folder at school.",
        "Why did the coach send the team this email?"
      ),
      sliceBetweenMarkers(
        text,
        "A to help the team feel better",
        "A If you download the first level of the app, it costs 99p."
      ),
      sliceBetweenMarkers(
        text,
        "A If you download the first level of the app, it costs 99p.",
        "A Cora would like to see a film at a different cinema with her friends."
      ),
      sliceBetweenMarkers(
        text,
        "A Cora would like to see a film at a different cinema with her friends.",
        "5 6 Part 6"
      ),
      sliceBetweenMarkers(
        text,
        "A Ms Wilson’s chemistry students won’t have any lessons today.",
        "To win the competition, the photo must be something to do with"
      ),
      sliceBetweenMarkers(text, "A your school life."),
    ];

    const questions = questionStems.map((stem, index) => {
      const { options } = parseLetterOptions(optionBlocks[index] || "", ["A", "B", "C"]);
      return {
        id: nextQuestionId(),
        type: "mcq",
        question: stem,
        options: options.length ? options : ["", "", ""],
        correctAnswer: 0,
        imageUrl: "",
      };
    });

    sections.push(
      createSection(
        "reading",
        "reading-writing-part-1",
        "Reading and Writing Part 1",
        "Choose the correct answer",
        "Notices, messages, and options were parsed from the PDF text.",
        questions
      )
    );
  }

  if (part6) {
    const emailBlock = extractBetween(part6, "Reply Forward", "Write an email to James and answer the questions.");
    const instructionBlock = extractBetween(
      part6,
      "Write an email to James and answer the questions."
    );
    const prompts = extractPromptQuestions(emailBlock);
    const wordCountMatch = instructionBlock.match(/Write\s+(\d+\s+words or more)\./i);

    sections.push(
      createSection(
        "writing",
        "writing-part-6",
        "Writing Part 6",
        "Email response",
        "The email prompt was extracted locally. Check the topic, prompts, and word count.",
        [
          {
            id: nextQuestionId(),
            type: "writing",
            topic: "Email to James",
            instructions: normalizeText(
              `${emailBlock} Write an email to James and answer the questions.`
            ),
            wordCount: wordCountMatch?.[1] || "25 words or more",
            prompts: prompts.length ? prompts : ["Reply to James and answer all questions."],
          },
        ]
      )
    );
  }

  return sections;
}

export function parseMaterialsLocally(input: ParseMaterialsInput) {
  const pages = splitExtractedPages(input.textContent || "").map((page) => ({
    ...page,
    text: stripGeneratorHeader(page.text),
  }));
  const combinedText = pages.map((page) => page.text).join(" ");
  const nextQuestionId = nextQuestionIdFactory();
  let sections: ParsedSection[] = [];

  const vocabularyText = extractBetween(combinedText, "Vocabulary", "Grammar");
  const grammarText = extractBetween(combinedText, "Grammar", "Speaking");
  const speakingText = extractBetween(combinedText, "Speaking", "Listening");
  const listeningText = extractBetween(combinedText, "Listening", "Reading and Writing");
  const readingText = extractBetween(combinedText, "Reading and Writing");

  sections.push(...parseVocabularySections(vocabularyText, nextQuestionId));
  sections.push(...parseGrammarSections(grammarText, nextQuestionId));
  sections.push(...parseSpeakingSections(speakingText, nextQuestionId));
  sections.push(...parseListeningSection(listeningText, nextQuestionId));
  sections.push(...parseReadingWritingSections(readingText, nextQuestionId));

  if (!sections.length) {
    const fallbackSource =
      pages.map((page) => page.text).find(Boolean) ||
      normalizeText(input.textContent || "") ||
      "No text could be extracted from the uploaded materials.";
    sections.push(createFallbackSection(nextQuestionId, "Imported Content", fallbackSource));
  }

  const answerMap = extractAnswerKeyMap(input.answerTextContent);
  const { sections: sectionsWithAnswers, appliedCount } = applyAnswerKeyToSections(
    sections,
    answerMap
  );
  sections = sectionsWithAnswers;

  const sourceName = pages[0]?.sourceName?.replace(/\.pdf$/i, "").trim();
  const derivedTitle =
    sourceName ||
    (/compact key for schools/i.test(combinedText)
      ? "Compact Key for Schools Final Test"
      : "Uploaded Paper Draft");

  return {
    id: "local-parsed",
    title: derivedTitle,
    subtitle: "Locally parsed draft",
    description:
      answerMap.size > 0
        ? `This draft was generated by the local fallback parser. ${appliedCount} answers were auto-filled from the uploaded answer key. Review all sections, question text, remaining answers, and images manually.`
        : "This draft was generated by the local fallback parser. Review all sections, questions, answers, and images manually.",
    icon: "📝",
    color: "text-blue-600",
    sections,
    totalQuestions: sections.reduce(
      (sum, section) => sum + (((section.questions as ParsedQuestion[]) || []).length || 0),
      0
    ),
    hasListening: sections.some((section) => String(section.id).includes("listening")),
    hasWriting: sections.some((section) =>
      ((section.questions as ParsedQuestion[]) || []).some(
        (question) => question.type === "writing"
      )
    ),
    extractedImageAssets: [],
    blueprintLabel: "Free Local Parsed Draft",
    interpretation:
      answerMap.size > 0
        ? `当前草稿由免费本地解析器生成，并尝试从答案 PDF 中回填答案：识别到 ${answerMap.size} 条答案，成功应用 ${appliedCount} 条。请重点校对题型、题干、未命中的答案和图片。`
        : "当前草稿由免费本地解析器根据题目 PDF 文本自动拆出。请重点人工校对题型、题干、答案和图片。",
    parseModeUsed: "local",
    answerKeyDetectedCount: answerMap.size,
    answerKeyAppliedCount: appliedCount,
  };
}
