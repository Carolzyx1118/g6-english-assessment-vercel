export type EnglishExamTagTrack = string;
export type EnglishExamTagEntry = "Textbook Practice" | "Exam Bank" | "教材配套" | "考试题库";
export type EnglishExamTagAbility =
  | "Vocabulary"
  | "Grammar"
  | "Reading"
  | "Listening"
  | "Writing"
  | "Speaking"
  | "词汇"
  | "语法"
  | "阅读理解"
  | "听力理解"
  | "写作"
  | "口语";
export type EnglishExamTagDifficulty = "Basic" | "Intermediate" | "Advanced" | "基础" | "中等" | "提高";

export interface EnglishQuestionTagProfile {
  track: EnglishExamTagTrack;
  entries: EnglishExamTagEntry[];
  unit?: string;
  examPart?: string;
  ability: EnglishExamTagAbility;
  grammarUnit?: string;
  grammarPoints?: string[];
  difficulty?: EnglishExamTagDifficulty;
}

export interface EnglishExamTagSchema {
  label: string;
  units: string[];
  examParts: string[];
  abilities: EnglishExamTagAbility[];
  difficulties: EnglishExamTagDifficulty[];
  grammarByUnit: Record<string, string[]>;
}

export interface TagSystemGeneratedPartConfig {
  examPart: string;
  questionType: string;
  totalQuestions: number;
}

export type TagSystemMode = "assessment" | "textbook-practice";
export type TagSystemPracticeMode = "unit" | "question-type";

export interface TagSystemPracticeRuleConfig {
  id: string;
  filterValue: string;
  totalQuestions: number;
}

export interface TagSystemGeneratedPaperConfig {
  title: string;
  description: string;
  practiceMode: TagSystemPracticeMode;
  parts: TagSystemGeneratedPartConfig[];
  practiceRules: TagSystemPracticeRuleConfig[];
}

export interface EnglishExamTagSystem extends EnglishExamTagSchema {
  id: EnglishExamTagTrack;
  systemMode?: TagSystemMode;
  generatedPaper?: TagSystemGeneratedPaperConfig;
}

export interface EnglishTagSchemaStore {
  version: 1;
  subject: "english";
  systems: EnglishExamTagSystem[];
}

export type ConfigurableTagSubject = "english" | "math" | "vocabulary";

export interface SubjectQuestionTagProfile {
  track: string;
  unit?: string;
  examPart?: string;
}

export interface SubjectTagSystem {
  id: string;
  label: string;
  units: string[];
  examParts: string[];
  systemMode?: TagSystemMode;
  generatedPaper?: TagSystemGeneratedPaperConfig;
}

export interface SubjectTagSchemaStore {
  version: 1;
  subject: Exclude<ConfigurableTagSubject, "english">;
  systems: SubjectTagSystem[];
}

export type EnglishExamTagSchemaMap = Record<EnglishExamTagTrack, EnglishExamTagSchema>;
export type EnglishExamTagSystemInput = Pick<
  EnglishExamTagSystem,
  "id" | "label" | "units" | "examParts" | "systemMode" | "generatedPaper"
> & {
  grammarByUnit?: Record<string, string[]>;
};

const LEGACY_ENGLISH_TAG_ENTRY_MAP: Record<string, "Textbook Practice" | "Exam Bank"> = {
  教材配套: "Textbook Practice",
  考试题库: "Exam Bank",
};

const LEGACY_ENGLISH_TAG_ABILITY_MAP: Record<string, "Vocabulary" | "Grammar" | "Reading" | "Listening" | "Writing" | "Speaking"> = {
  词汇: "Vocabulary",
  语法: "Grammar",
  阅读理解: "Reading",
  听力理解: "Listening",
  写作: "Writing",
  口语: "Speaking",
};

const LEGACY_ENGLISH_TAG_DIFFICULTY_MAP: Record<string, "Basic" | "Intermediate" | "Advanced"> = {
  基础: "Basic",
  中等: "Intermediate",
  提高: "Advanced",
};

export function normalizeEnglishTagEntry(value: string | undefined | null): "Textbook Practice" | "Exam Bank" {
  if (!value) return "Exam Bank";
  return LEGACY_ENGLISH_TAG_ENTRY_MAP[value] ?? (value === "Textbook Practice" ? "Textbook Practice" : "Exam Bank");
}

export function normalizeEnglishTagAbility(value: string | undefined | null): "Vocabulary" | "Grammar" | "Reading" | "Listening" | "Writing" | "Speaking" {
  if (!value) return "Reading";
  return LEGACY_ENGLISH_TAG_ABILITY_MAP[value] ?? (
    value === "Vocabulary"
    || value === "Grammar"
    || value === "Reading"
    || value === "Listening"
    || value === "Writing"
    || value === "Speaking"
      ? value
      : "Reading"
  );
}

export function normalizeEnglishTagDifficulty(value: string | undefined | null): "Basic" | "Intermediate" | "Advanced" | undefined {
  if (!value) return undefined;
  return LEGACY_ENGLISH_TAG_DIFFICULTY_MAP[value] ?? (
    value === "Basic" || value === "Intermediate" || value === "Advanced"
      ? value
      : undefined
  );
}

export function normalizeEnglishQuestionTagProfile(profile: EnglishQuestionTagProfile): EnglishQuestionTagProfile {
  return {
    ...profile,
    entries: Array.from(new Set((profile.entries ?? []).map((entry) => normalizeEnglishTagEntry(entry)))) as EnglishExamTagEntry[],
    ability: normalizeEnglishTagAbility(profile.ability),
    difficulty: normalizeEnglishTagDifficulty(profile.difficulty),
  };
}

export const ENGLISH_TAG_ENTRY_OPTIONS: EnglishExamTagEntry[] = ["Textbook Practice", "Exam Bank"];
export const ENGLISH_TAG_ABILITY_OPTIONS: EnglishExamTagAbility[] = [
  "Vocabulary",
  "Grammar",
  "Reading",
  "Listening",
  "Writing",
  "Speaking",
];
export const ENGLISH_TAG_DIFFICULTY_OPTIONS: EnglishExamTagDifficulty[] = ["Basic", "Intermediate", "Advanced"];
export const DEFAULT_ENGLISH_EXAM_TAG_TRACK = "ket";

const KET_UNITS = Array.from({ length: 14 }, (_, index) => `Unit ${index + 1}`);
const PET_UNITS = Array.from({ length: 12 }, (_, index) => `Unit ${index + 1}`);
const MATH_UNITS = Array.from({ length: 12 }, (_, index) => `Unit ${index + 1}`);
const VOCABULARY_UNITS = Array.from({ length: 12 }, (_, index) => `Unit ${index + 1}`);
const LEGACY_ENGLISH_PART_PREFIX_MAP: Record<string, string> = {
  "阅读": "Reading",
  "阅读理解": "Reading",
  "听力": "Listening",
  "听力理解": "Listening",
  "写作": "Writing",
  "口语": "Speaking",
  "语法": "Grammar",
  "词汇": "Vocabulary",
};

const ENGLISH_GENERATED_QUESTION_TYPE_OPTIONS: Record<string, string[]> = {
  Speaking: ["speaking"],
  Writing: ["writing"],
  Listening: ["mcq", "typed-fill-blank", "true-false", "checkbox", "ordering"],
  Grammar: ["mcq", "typed-fill-blank", "fill-blank", "sentence-reorder", "inline-word-choice"],
  Vocabulary: ["mcq", "fill-blank", "typed-fill-blank", "inline-word-choice", "picture-spelling", "word-completion"],
  Reading: [
    "mcq",
    "passage-mcq",
    "typed-fill-blank",
    "passage-open-ended",
    "true-false",
    "heading-match",
    "checkbox",
    "ordering",
    "sentence-reorder",
    "passage-matching",
    "fill-blank",
    "passage-fill-blank",
    "inline-word-choice",
    "passage-inline-word-choice",
  ],
};

const BASIC_GENERATED_QUESTION_TYPE_OPTIONS: Record<Exclude<ConfigurableTagSubject, "english">, string[]> = {
  math: ["mcq", "typed-fill-blank", "passage-open-ended", "ordering"],
  vocabulary: [
    "mcq",
    "fill-blank",
    "typed-fill-blank",
    "inline-word-choice",
    "passage-inline-word-choice",
    "picture-spelling",
    "word-completion",
    "checkbox",
    "ordering",
  ],
};

function normalizeEnglishExamPartLabel(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;

  const partMatch = trimmed.match(/^(.*?)\s*Part\s*(\d+)$/i);
  if (partMatch) {
    const rawPrefix = partMatch[1].trim();
    const normalizedPrefix = LEGACY_ENGLISH_PART_PREFIX_MAP[rawPrefix] ?? rawPrefix;
    return `${normalizedPrefix} Part ${partMatch[2]}`;
  }

  const normalizedPrefix = LEGACY_ENGLISH_PART_PREFIX_MAP[trimmed];
  return normalizedPrefix ?? trimmed;
}

function getEnglishPartPrefix(examPart: string) {
  const normalized = normalizeEnglishExamPartLabel(examPart);
  const partMatch = normalized.match(/^(.*?)\s*Part\s*\d+$/i);
  return partMatch?.[1]?.trim() || normalized.trim() || "Reading";
}

export function getGeneratedQuestionTypeOptions(
  subject: ConfigurableTagSubject,
  examPart: string,
) {
  if (subject === "english") {
    const prefix = getEnglishPartPrefix(examPart);
    return ENGLISH_GENERATED_QUESTION_TYPE_OPTIONS[prefix] ?? ENGLISH_GENERATED_QUESTION_TYPE_OPTIONS.Reading;
  }

  return BASIC_GENERATED_QUESTION_TYPE_OPTIONS[subject];
}

export function getSubjectQuestionTypeOptions(subject: ConfigurableTagSubject) {
  if (subject === "english") {
    return Array.from(
      new Set(Object.values(ENGLISH_GENERATED_QUESTION_TYPE_OPTIONS).flat()),
    );
  }

  return BASIC_GENERATED_QUESTION_TYPE_OPTIONS[subject];
}

export function getGeneratedPracticeValueOptions(
  subject: ConfigurableTagSubject,
  practiceMode: TagSystemPracticeMode,
  units: string[],
) {
  if (practiceMode === "question-type") {
    return getSubjectQuestionTypeOptions(subject);
  }

  return dedupeStrings(units);
}

export function buildGeneratedPaperConfig(
  subject: ConfigurableTagSubject,
  label: string,
  examParts: string[],
  current?: TagSystemGeneratedPaperConfig,
  systemMode: TagSystemMode = "assessment",
  units: string[] = [],
): TagSystemGeneratedPaperConfig {
  const partMap = new Map((current?.parts ?? []).map((part) => [part.examPart, part]));
  const normalizedParts = examParts.map((examPart) => {
    const existing = partMap.get(examPart);
    const questionTypeOptions = getGeneratedQuestionTypeOptions(subject, examPart);
    return {
      examPart,
      questionType:
        existing?.questionType && questionTypeOptions.includes(existing.questionType)
          ? existing.questionType
          : questionTypeOptions[0],
      totalQuestions: Math.max(0, Number(existing?.totalQuestions ?? 0)),
    } satisfies TagSystemGeneratedPartConfig;
  });

  const normalizedLabel = label.trim() || "Untitled Assessment";
  const practiceMode = current?.practiceMode === "question-type" ? "question-type" : "unit";
  const practiceValueOptions = getGeneratedPracticeValueOptions(subject, practiceMode, units);
  const normalizedPracticeRules = (current?.practiceRules ?? [])
    .map((rule, index) => ({
      id: (rule.id || "").trim() || `${practiceMode}-${index + 1}`,
      filterValue:
        rule.filterValue && practiceValueOptions.includes(rule.filterValue)
          ? rule.filterValue
          : (practiceValueOptions[0] ?? ""),
      totalQuestions: Math.max(0, Number(rule.totalQuestions ?? 0)),
    } satisfies TagSystemPracticeRuleConfig))
    .filter((rule, index, rules) => rules.findIndex((candidate) => candidate.id === rule.id) === index);

  if (normalizedPracticeRules.length === 0) {
    normalizedPracticeRules.push({
      id: `${practiceMode}-1`,
      filterValue: practiceValueOptions[0] ?? "",
      totalQuestions: 0,
    });
  }

  return {
    title:
      current?.title?.trim()
      || (systemMode === "textbook-practice"
        ? `${normalizedLabel} Textbook Practice`
        : `${normalizedLabel} Assessment`),
    description:
      current?.description?.trim()
      || (systemMode === "textbook-practice"
        ? `Build textbook practice papers from tagged ${normalizedLabel} question bank items.`
        : `Build assessment papers from tagged ${normalizedLabel} question bank items.`),
    practiceMode,
    parts: normalizedParts,
    practiceRules: normalizedPracticeRules,
  };
}

export const DEFAULT_ENGLISH_EXAM_TAG_SYSTEMS: EnglishExamTagSystem[] = [
  {
    id: "ket",
    label: "KET / A2 Key",
    systemMode: "assessment",
    units: KET_UNITS,
    examParts: [
      "Reading Part 1",
      "Reading Part 2",
      "Reading Part 3",
      "Reading Part 4",
      "Reading Part 5",
      "Listening Part 1",
      "Listening Part 2",
      "Listening Part 3",
      "Listening Part 4",
      "Listening Part 5",
      "Writing Part 6",
      "Writing Part 7",
    ],
    abilities: ENGLISH_TAG_ABILITY_OPTIONS,
    difficulties: ENGLISH_TAG_DIFFICULTY_OPTIONS,
    grammarByUnit: {
      "Unit 1": ["一般现在时", "频率副词"],
      "Unit 2": ["现在进行时", "have got"],
      "Unit 3": ["可数与不可数名词", "数量表达 how much/many", "a few / a little / a lot of"],
      "Unit 4": ["进行时与一般现在时对比", "too and enough"],
      "Unit 5": ["比较级与最高级", "时间介词 at/in/on"],
      "Unit 6": ["have to 必须", "宾语人称代词"],
      "Unit 7": ["一般过去时", "祈使句"],
      "Unit 8": ["过去进行时", "can/can't could/couldn't"],
      "Unit 9": ["动词接 -ing 或不定式", "将来时多种表达"],
      "Unit 10": ["be going to", "must/mustn't"],
      "Unit 11": ["第一条件句", "不定代词 something/anything/nothing"],
      "Unit 12": ["现在完成时", "should/shouldn't"],
      "Unit 13": ["现在完成时 for/since", "may/might 可能性"],
      "Unit 14": ["被动语态", "现在完成时 just/already/yet"],
    },
    generatedPaper: buildGeneratedPaperConfig("english", "KET / A2 Key", [
      "Reading Part 1",
      "Reading Part 2",
      "Reading Part 3",
      "Reading Part 4",
      "Reading Part 5",
      "Listening Part 1",
      "Listening Part 2",
      "Listening Part 3",
      "Listening Part 4",
      "Listening Part 5",
      "Writing Part 6",
      "Writing Part 7",
    ], undefined, "assessment", KET_UNITS),
  },
  {
    id: "pet",
    label: "PET / B1 Preliminary",
    systemMode: "assessment",
    units: PET_UNITS,
    examParts: [
      "Reading Part 1",
      "Reading Part 2",
      "Reading Part 3",
      "Reading Part 4",
      "Reading Part 5",
      "Reading Part 6",
      "Listening Part 1",
      "Listening Part 2",
      "Listening Part 3",
      "Listening Part 4",
      "Writing Part 1",
      "Writing Part 2",
    ],
    abilities: ENGLISH_TAG_ABILITY_OPTIONS,
    difficulties: ENGLISH_TAG_DIFFICULTY_OPTIONS,
    grammarByUnit: {
      "Unit 1": [
        "时间介词",
        "频率副词",
        "一般现在时与现在进行时",
        "状态动词",
        "数量表达 a few/a bit of/many/much/a lot of/lots of",
        "地点介词",
      ],
      "Unit 2": ["一般过去时", "过去时与过去进行时", "used to", "So do I / Nor/Neither do I"],
      "Unit 3": ["动词接 to 或 -ing"],
      "Unit 4": [
        "比较级与最高级形容词",
        "a bit/a little/slightly/much/far/a lot",
        "not as...as...",
        "big 与 enormous 可分级与不可分级形容词",
      ],
      "Unit 5": [
        "can/could/might/may 能力与可能性",
        "should/shouldn't/ought to/must/mustn't/have to/don't have to 建议义务禁止",
      ],
      "Unit 6": ["现在完成时", "just/already/yet", "since 与 for", "现在完成时与一般过去时对比"],
      "Unit 7": [
        "将来时 will/going to/现在进行时/一般现在时",
        "extremely/fairly/quite/rather/really/very",
        "too and enough",
        "移动介词",
      ],
      "Unit 8": ["零阶条件句", "第一条件句", "第二条件句", "when/if/unless + 现在时/将来时"],
      "Unit 9": ["关系从句 which/that/who/whose/when/where 限定与非限定", "过去完成时"],
      "Unit 10": ["祈使句", "have something done"],
      "Unit 11": ["被动语态 现在时与过去时", "比较级与最高级副词"],
      "Unit 12": ["间接引语与间接命令", "间接疑问句", "间接问句"],
    },
    generatedPaper: buildGeneratedPaperConfig("english", "PET / B1 Preliminary", [
      "Reading Part 1",
      "Reading Part 2",
      "Reading Part 3",
      "Reading Part 4",
      "Reading Part 5",
      "Reading Part 6",
      "Listening Part 1",
      "Listening Part 2",
      "Listening Part 3",
      "Listening Part 4",
      "Writing Part 1",
      "Writing Part 2",
    ], undefined, "assessment", PET_UNITS),
  },
];

export const DEFAULT_MATH_TAG_SYSTEMS: SubjectTagSystem[] = [
  {
    id: "school-math",
    label: "School Math",
    systemMode: "assessment",
    units: MATH_UNITS,
    examParts: ["选择题", "填空题", "应用题"],
    generatedPaper: buildGeneratedPaperConfig("math", "School Math", ["选择题", "填空题", "应用题"], undefined, "assessment", MATH_UNITS),
  },
];

export const DEFAULT_VOCABULARY_TAG_SYSTEMS: SubjectTagSystem[] = [
  {
    id: "core-vocabulary",
    label: "Core Vocabulary",
    systemMode: "assessment",
    units: VOCABULARY_UNITS,
    examParts: ["词义匹配", "拼写", "词汇运用"],
    generatedPaper: buildGeneratedPaperConfig("vocabulary", "Core Vocabulary", ["词义匹配", "拼写", "词汇运用"], undefined, "assessment", VOCABULARY_UNITS),
  },
];

function dedupeStrings(values: string[] | undefined) {
  return Array.from(
    new Set(
      (values ?? [])
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
}

export function englishTagSystemsToMap(
  systems: EnglishExamTagSystem[],
): EnglishExamTagSchemaMap {
  return Object.fromEntries(
    systems.map(({ id, ...schema }) => [id, schema]),
  );
}

export const ENGLISH_EXAM_TAG_SCHEMAS: EnglishExamTagSchemaMap =
  englishTagSystemsToMap(DEFAULT_ENGLISH_EXAM_TAG_SYSTEMS);

export function createDefaultEnglishTagSchemaStore(): EnglishTagSchemaStore {
  return {
    version: 1,
    subject: "english",
    systems: normalizeEnglishTagSystems(DEFAULT_ENGLISH_EXAM_TAG_SYSTEMS),
  };
}

export function normalizeEnglishTagSystems(
  input: EnglishExamTagSystemInput[] | undefined | null,
) {
  const systems = (input ?? [])
    .map((system, index) => {
      const id = (system.id || "").trim() || `system-${index + 1}`;
      const units = dedupeStrings(system.units);
      const examParts = dedupeStrings(dedupeStrings(system.examParts).map(normalizeEnglishExamPartLabel));
      const grammarByUnit = Object.fromEntries(
        Object.entries(system.grammarByUnit ?? {}).map(([unit, points]) => [
          unit,
          dedupeStrings(points),
        ]),
      );

      return {
        id,
        label: (system.label || "").trim() || id,
        systemMode: system.systemMode === "textbook-practice" ? "textbook-practice" : "assessment",
        units,
        examParts,
        abilities: ENGLISH_TAG_ABILITY_OPTIONS,
        difficulties: ENGLISH_TAG_DIFFICULTY_OPTIONS,
        grammarByUnit,
        generatedPaper: buildGeneratedPaperConfig(
          "english",
          (system.label || "").trim() || id,
          examParts,
          system.generatedPaper,
          system.systemMode === "textbook-practice" ? "textbook-practice" : "assessment",
          units,
        ),
      } satisfies EnglishExamTagSystem;
    })
    .filter((system, index, current) => current.findIndex((item) => item.id === system.id) === index);

  return systems.length > 0 ? systems : [...DEFAULT_ENGLISH_EXAM_TAG_SYSTEMS];
}

export function getEnglishExamTagEntries(
  schemas: EnglishExamTagSchemaMap = ENGLISH_EXAM_TAG_SCHEMAS,
) {
  const entries = Object.entries(schemas) as Array<[EnglishExamTagTrack, EnglishExamTagSchema]>;
  return entries.length > 0
    ? entries
    : (Object.entries(ENGLISH_EXAM_TAG_SCHEMAS) as Array<[EnglishExamTagTrack, EnglishExamTagSchema]>);
}

export function getDefaultEnglishExamTagTrack(
  schemas: EnglishExamTagSchemaMap = ENGLISH_EXAM_TAG_SCHEMAS,
) {
  return getEnglishExamTagEntries(schemas)[0]?.[0] ?? DEFAULT_ENGLISH_EXAM_TAG_TRACK;
}

export function getEnglishExamTagSchema(
  track: EnglishExamTagTrack,
  schemas: EnglishExamTagSchemaMap = ENGLISH_EXAM_TAG_SCHEMAS,
) {
  const defaultTrack = getDefaultEnglishExamTagTrack(schemas);
  return (
    schemas[track]
    ?? schemas[defaultTrack]
    ?? ENGLISH_EXAM_TAG_SCHEMAS[DEFAULT_ENGLISH_EXAM_TAG_TRACK]
  );
}

export function getDefaultSubjectTagSystems(
  subject: Exclude<ConfigurableTagSubject, "english">,
) {
  return subject === "math"
    ? [...DEFAULT_MATH_TAG_SYSTEMS]
    : [...DEFAULT_VOCABULARY_TAG_SYSTEMS];
}

export function createDefaultSubjectTagSchemaStore(
  subject: Exclude<ConfigurableTagSubject, "english">,
): SubjectTagSchemaStore {
  return {
    version: 1,
    subject,
    systems: normalizeSubjectTagSystems(subject, getDefaultSubjectTagSystems(subject)),
  };
}

export function normalizeSubjectTagSystems(
  subject: Exclude<ConfigurableTagSubject, "english">,
  input: SubjectTagSystem[] | undefined | null,
) {
  const systems = (input ?? [])
    .map((system, index) => ({
      id: (system.id || "").trim() || `${subject}-system-${index + 1}`,
      label: (system.label || "").trim() || `${subject}-system-${index + 1}`,
      systemMode: system.systemMode === "textbook-practice" ? "textbook-practice" : "assessment",
      units: dedupeStrings(system.units),
      examParts: dedupeStrings(system.examParts),
      generatedPaper: buildGeneratedPaperConfig(
        subject,
        (system.label || "").trim() || `${subject}-system-${index + 1}`,
        dedupeStrings(system.examParts),
        system.generatedPaper,
        system.systemMode === "textbook-practice" ? "textbook-practice" : "assessment",
        dedupeStrings(system.units),
      ),
    } satisfies SubjectTagSystem))
    .filter((system, index, current) => current.findIndex((item) => item.id === system.id) === index);

  return systems.length > 0 ? systems : getDefaultSubjectTagSystems(subject);
}
