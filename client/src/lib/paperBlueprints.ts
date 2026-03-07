import type { Paper, Question, Section } from "@/data/papers";
import { huazhongPaper } from "@/data/huazhong-paper";
import { widaPaper } from "@/data/wida-paper";
import { normalizeSections } from "@/lib/normalizeSection";

export type QuestionType = Question["type"];

export interface EditableSection extends Section {
  supportedQuestionTypes: QuestionType[];
  blueprintSummary: string;
}

export interface EditablePaper extends Omit<Paper, "sections"> {
  blueprintId: string;
  blueprintLabel: string;
  interpretation: string;
  sections: EditableSection[];
}

export interface PaperBlueprintSection {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  totalQuestions: number;
  supportedQuestionTypes: QuestionType[];
  questionTypeSequence: QuestionType[];
  summary: string;
  features: string[];
}

export interface PaperBlueprint {
  id: string;
  label: string;
  referenceTitle: string;
  interpretation: string;
  classification: string[];
  recommendedFor: string;
  sourcePaper: Paper;
  sections: PaperBlueprintSection[];
}

export interface BlueprintSuggestion {
  blueprintId?: string;
  reason: string;
}

export const QUESTION_TYPE_META: Record<
  QuestionType,
  { label: string; shortLabel: string; description: string }
> = {
  "picture-mcq": {
    label: "Picture MCQ",
    shortLabel: "Picture MCQ",
    description: "图片选项单选题",
  },
  mcq: {
    label: "MCQ",
    shortLabel: "MCQ",
    description: "文字单选题",
  },
  "fill-blank": {
    label: "Fill Blank",
    shortLabel: "Fill Blank",
    description: "填空题",
  },
  "listening-mcq": {
    label: "Listening MCQ",
    shortLabel: "Listening",
    description: "听力图片单选题",
  },
  "wordbank-fill": {
    label: "Word Bank Fill",
    shortLabel: "Word Bank",
    description: "词库填空题",
  },
  "story-fill": {
    label: "Story Fill",
    shortLabel: "Story Fill",
    description: "故事阅读填空题",
  },
  "open-ended": {
    label: "Open Ended",
    shortLabel: "Open Ended",
    description: "开放问答题",
  },
  "true-false": {
    label: "True / False",
    shortLabel: "T/F",
    description: "判断题",
  },
  checkbox: {
    label: "Checkbox",
    shortLabel: "Checkbox",
    description: "多选题",
  },
  writing: {
    label: "Writing",
    shortLabel: "Writing",
    description: "写作题",
  },
  table: {
    label: "Table",
    shortLabel: "Table",
    description: "表格填答题",
  },
  reference: {
    label: "Reference",
    shortLabel: "Reference",
    description: "指代题",
  },
  order: {
    label: "Order",
    shortLabel: "Order",
    description: "排序题",
  },
  phrase: {
    label: "Phrase",
    shortLabel: "Phrase",
    description: "短语定位题",
  },
};

export const ALL_QUESTION_TYPES = Object.keys(QUESTION_TYPE_META) as QuestionType[];

function orderedUniqueQuestionTypes(questions: Question[]): QuestionType[] {
  const seen = new Set<QuestionType>();
  return questions.flatMap((question) => {
    if (seen.has(question.type)) {
      return [];
    }
    seen.add(question.type);
    return [question.type];
  });
}

function buildSectionFeatures(section: Section): string[] {
  const features: string[] = [];
  if (section.audioUrl) features.push("Audio");
  if (section.wordBank?.length) features.push("Word Bank");
  if (section.grammarPassage) features.push("Grammar Passage");
  if (section.passage) features.push("Reading Passage");
  if (section.sceneImageUrl) features.push("Scene Image");
  if (section.wordBankImageUrl) features.push("Word Bank Image");
  if (section.storyParagraphs?.length) features.push("Story Paragraphs");
  if (section.storyImages?.length) features.push("Story Images");
  return features;
}

function buildSectionSummary(section: Section): string {
  const typeLabels = orderedUniqueQuestionTypes(section.questions).map(
    (type) => QUESTION_TYPE_META[type].description
  );
  return `${section.title} 包含 ${section.questions.length} 题，题型有 ${typeLabels.join("、")}`;
}

function buildBlueprint(
  id: string,
  label: string,
  sourcePaper: Paper,
  interpretation: string,
  classification: string[],
  recommendedFor: string
): PaperBlueprint {
  return {
    id,
    label,
    referenceTitle: sourcePaper.title,
    interpretation,
    classification,
    recommendedFor,
    sourcePaper,
    sections: sourcePaper.sections.map((section) => ({
      id: section.id,
      title: section.title,
      subtitle: section.subtitle,
      description: section.description,
      totalQuestions: section.questions.length,
      supportedQuestionTypes: orderedUniqueQuestionTypes(section.questions),
      questionTypeSequence: section.questions.map((question) => question.type),
      summary: buildSectionSummary(section),
      features: buildSectionFeatures(section),
    })),
  };
}

export const paperBlueprints: PaperBlueprint[] = [
  buildBlueprint(
    "g2-3",
    "G2-3 Blueprint",
    widaPaper,
    "G2-3 这套卷是“词汇识图 + 语法选择/填空 + 听力图片题 + 阅读词库/故事填空”的组合，偏基础能力拆分录入。",
    ["图片选择", "语法填空", "听力题", "阅读填空"],
    "适合有图片题、听力题、故事阅读填空的低年级卷型"
  ),
  buildBlueprint(
    "g6",
    "G6 Blueprint",
    huazhongPaper,
    "G6 这套卷是“词义选择 + 语篇语法填空 + 结构化阅读 + 写作”的组合，阅读部分题型最丰富。",
    ["词义单选", "语法完形", "结构化阅读", "写作"],
    "适合无听力、但有阅读综合题和作文的高年级卷型"
  ),
];

export function getBlueprintById(id: string): PaperBlueprint | undefined {
  return paperBlueprints.find((blueprint) => blueprint.id === id);
}

function emptyOption(label: string, withText = true) {
  return {
    label,
    imageUrl: "",
    ...(withText ? { text: "" } : {}),
  };
}

export function createEmptyQuestionByType(type: QuestionType, id: number): Question {
  switch (type) {
    case "picture-mcq":
      return {
        id,
        type,
        question: "",
        options: [
          emptyOption("a"),
          emptyOption("b"),
          emptyOption("c"),
        ],
        correctAnswer: 0,
      };
    case "mcq":
      return {
        id,
        type,
        question: "",
        highlightWord: "",
        options: ["", "", "", ""],
        correctAnswer: 0,
        imageUrl: "",
      };
    case "fill-blank":
      return {
        id,
        type,
        question: "",
        correctAnswer: "",
      };
    case "listening-mcq":
      return {
        id,
        type,
        question: "",
        options: [
          emptyOption("A"),
          emptyOption("B"),
          emptyOption("C"),
        ],
        correctAnswer: 0,
      };
    case "wordbank-fill":
      return {
        id,
        type,
        question: "",
        correctAnswer: "",
      };
    case "story-fill":
      return {
        id,
        type,
        question: "",
        correctAnswer: "",
        acceptableAnswers: [],
      };
    case "open-ended":
      return {
        id,
        type,
        question: "",
        answer: "",
      };
    case "true-false":
      return {
        id,
        type,
        statements: [
          { label: "a", statement: "", isTrue: true, reason: "" },
          { label: "b", statement: "", isTrue: false, reason: "" },
        ],
      };
    case "checkbox":
      return {
        id,
        type,
        question: "",
        options: ["", "", "", ""],
        correctAnswers: [],
      };
    case "writing":
      return {
        id,
        type,
        topic: "",
        instructions: "",
        wordCount: "",
        prompts: ["", "", ""],
      };
    case "table":
      return {
        id,
        type,
        question: "",
        rows: [
          {
            situation: "",
            thought: "",
            action: "",
            blankField: "thought",
            answer: "",
          },
          {
            situation: "",
            thought: "",
            action: "",
            blankField: "action",
            answer: "",
          },
        ],
      };
    case "reference":
      return {
        id,
        type,
        question: "",
        items: [
          { word: "", lineRef: "", answer: "" },
          { word: "", lineRef: "", answer: "" },
        ],
      };
    case "order":
      return {
        id,
        type,
        question: "",
        events: ["", "", ""],
        correctOrder: [1, 2, 3],
      };
    case "phrase":
      return {
        id,
        type,
        question: "",
        items: [
          { clue: "", answer: "" },
          { clue: "", answer: "" },
        ],
      };
  }
}

function cloneEmptyQuestionFromTemplate(question: Question): Question {
  switch (question.type) {
    case "picture-mcq":
      return {
        id: question.id,
        type: question.type,
        question: "",
        options: question.options.map((option, index) =>
          emptyOption(option.label || String.fromCharCode(97 + index))
        ),
        correctAnswer: 0,
      };
    case "mcq":
      return {
        id: question.id,
        type: question.type,
        question: "",
        highlightWord: "",
        options: question.options.map(() => ""),
        correctAnswer: 0,
        imageUrl: "",
      };
    case "fill-blank":
      return {
        id: question.id,
        type: question.type,
        question: question.question ? "" : undefined,
        correctAnswer: "",
      };
    case "listening-mcq":
      return {
        id: question.id,
        type: question.type,
        question: "",
        options: question.options.map((option, index) =>
          emptyOption(option.label || String.fromCharCode(65 + index))
        ),
        correctAnswer: 0,
      };
    case "wordbank-fill":
      return {
        id: question.id,
        type: question.type,
        question: "",
        correctAnswer: "",
      };
    case "story-fill":
      return {
        id: question.id,
        type: question.type,
        question: "",
        correctAnswer: "",
        acceptableAnswers: question.acceptableAnswers?.map(() => "") || [],
      };
    case "open-ended":
      return {
        id: question.id,
        type: question.type,
        question: "",
        answer: question.subQuestions?.length ? undefined : "",
        subQuestions: question.subQuestions?.map((subQuestion, index) => ({
          label: subQuestion.label || String.fromCharCode(97 + index),
          question: "",
          answer: "",
        })),
        imageUrl: "",
      };
    case "true-false":
      return {
        id: question.id,
        type: question.type,
        statements: question.statements.map((statement, index) => ({
          label: statement.label || String.fromCharCode(97 + index),
          statement: "",
          isTrue: true,
          reason: "",
        })),
      };
    case "checkbox":
      return {
        id: question.id,
        type: question.type,
        question: "",
        options: question.options.map(() => ""),
        correctAnswers: [],
      };
    case "writing":
      return {
        id: question.id,
        type: question.type,
        topic: "",
        instructions: "",
        wordCount: "",
        prompts: question.prompts.length ? question.prompts.map(() => "") : [""],
      };
    case "table":
      return {
        id: question.id,
        type: question.type,
        question: "",
        rows: question.rows.map((row) => ({
          situation: "",
          thought: "",
          action: "",
          blankField: row.blankField,
          answer: "",
        })),
      };
    case "reference":
      return {
        id: question.id,
        type: question.type,
        question: "",
        items: question.items.map(() => ({
          word: "",
          lineRef: "",
          answer: "",
        })),
      };
    case "order":
      return {
        id: question.id,
        type: question.type,
        question: "",
        events: question.events.map(() => ""),
        correctOrder: question.correctOrder.map((_, index) => index + 1),
      };
    case "phrase":
      return {
        id: question.id,
        type: question.type,
        question: "",
        items: question.items.map(() => ({
          clue: "",
          answer: "",
        })),
      };
  }
}

function cloneEditableSection(section: Section): EditableSection {
  return {
    ...section,
    questions: section.questions.map((question) =>
      cloneEmptyQuestionFromTemplate(question)
    ),
    passage: section.passage ? "" : undefined,
    wordBank: section.wordBank?.map((item) => ({
      letter: item.letter,
      word: "",
    })),
    grammarPassage: section.grammarPassage ? "" : undefined,
    imageUrl: section.imageUrl ? "" : undefined,
    audioUrl: section.audioUrl ? "" : undefined,
    sceneImageUrl: section.sceneImageUrl ? "" : undefined,
    wordBankImageUrl: section.wordBankImageUrl ? "" : undefined,
    storyImages: section.storyImages?.map(() => "") || undefined,
    storyParagraphs: section.storyParagraphs?.map((paragraph) => ({
      text: "",
      questionIds: [...paragraph.questionIds],
    })),
    supportedQuestionTypes: orderedUniqueQuestionTypes(section.questions),
    blueprintSummary: buildSectionSummary(section),
  };
}

export function createEditablePaperFromBlueprint(blueprintId: string): EditablePaper {
  const blueprint = getBlueprintById(blueprintId);
  if (!blueprint) {
    throw new Error(`Unknown blueprint: ${blueprintId}`);
  }

  const source = blueprint.sourcePaper;

  return {
    id: source.id,
    title: source.title,
    subtitle: source.subtitle,
    description: source.description,
    icon: source.icon,
    color: source.color,
    sections: source.sections.map((section) => cloneEditableSection(section)),
    readingWordBank: source.readingWordBank?.map(() => ({
      word: "",
      imageUrl: "",
    })),
    totalQuestions: source.sections.reduce(
      (sum, section) => sum + section.questions.length,
      0
    ),
    hasListening: source.hasListening,
    hasWriting: source.hasWriting,
    blueprintId: blueprint.id,
    blueprintLabel: blueprint.label,
    interpretation: blueprint.interpretation,
  };
}

export function createEditablePaperFromParsed(parsedPaper: {
  id?: string;
  title?: string;
  subtitle?: string;
  description?: string;
  icon?: string;
  color?: string;
  blueprintLabel?: string;
  interpretation?: string;
  sections?: any[];
  readingWordBank?: { word: string; imageUrl: string }[];
  totalQuestions?: number;
  hasListening?: boolean;
  hasWriting?: boolean;
}): EditablePaper {
  const normalizedSections = normalizeSections(parsedPaper.sections || []);

  return {
    id: parsedPaper.id || "ai-parsed",
    title: parsedPaper.title || "Untitled Paper",
    subtitle: parsedPaper.subtitle || "",
    description: parsedPaper.description || "",
    icon: parsedPaper.icon || "📝",
    color: parsedPaper.color || "text-blue-600",
    sections: normalizedSections.map((section) => ({
      ...section,
      supportedQuestionTypes: orderedUniqueQuestionTypes(section.questions),
      blueprintSummary: buildSectionSummary(section),
    })),
    readingWordBank: parsedPaper.readingWordBank,
    totalQuestions:
      parsedPaper.totalQuestions ||
      normalizedSections.reduce((sum, section) => sum + section.questions.length, 0),
    hasListening:
      parsedPaper.hasListening ??
      normalizedSections.some(
        (section) =>
          !!section.audioUrl ||
          section.questions.some((question) => question.type === "listening-mcq")
      ),
    hasWriting:
      parsedPaper.hasWriting ??
      normalizedSections.some((section) =>
        section.questions.some((question) => question.type === "writing")
      ),
    blueprintId: "ai-parsed",
    blueprintLabel: parsedPaper.blueprintLabel || "AI Parsed Draft",
    interpretation:
      parsedPaper.interpretation ||
      "AI 已根据上传的 PDF/图片先拆题，下面只需要人工校对和修改。",
  };
}

export function stripEditablePaper(paper: EditablePaper): Paper {
  return {
    id: paper.id,
    title: paper.title,
    subtitle: paper.subtitle,
    description: paper.description,
    icon: paper.icon,
    color: paper.color,
    sections: paper.sections.map((section) => {
      const { supportedQuestionTypes, blueprintSummary, ...cleanSection } = section;
      return cleanSection;
    }),
    readingWordBank: paper.readingWordBank,
    totalQuestions: paper.sections.reduce(
      (sum, section) => sum + section.questions.length,
      0
    ),
    hasListening: paper.sections.some(
      (section) =>
        !!section.audioUrl ||
        section.questions.some((question) => question.type === "listening-mcq")
    ),
    hasWriting: paper.sections.some((section) =>
      section.questions.some((question) => question.type === "writing")
    ),
  };
}

export function suggestBlueprint(
  files: Array<{ name: string; type: string }>,
  instructions = ""
): BlueprintSuggestion {
  const combinedText = `${files.map((file) => file.name).join(" ")} ${instructions}`.toLowerCase();
  const audioCount = files.filter((file) => file.type.startsWith("audio/")).length;

  if (
    /g2|g3|g2-3|grade 2|grade 3|wida|listening/.test(combinedText) ||
    audioCount > 0
  ) {
    const hasTextHint =
      /g2|g3|g2-3|grade 2|grade 3|wida|listening/.test(combinedText);
    return {
      blueprintId: "g2-3",
      reason: hasTextHint
        ? "文件名或说明里出现了 G2-3 / WIDA / listening 线索"
        : "检测到了音频素材，这更像 G2-3 的听力卷结构",
    };
  }

  if (
    /g6|grade 6|secondary|composition|huazhong|writing/.test(combinedText)
  ) {
    return {
      blueprintId: "g6",
      reason: "文件名或说明里出现了 G6 / composition / writing 线索",
    };
  }

  return {
    reason: "没有足够强的文件线索，建议手动选择 G2-3 或 G6 蓝图",
  };
}
