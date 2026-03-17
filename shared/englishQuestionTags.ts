export type EnglishExamTagTrack = "ket" | "pet";
export type EnglishExamTagEntry = "教材配套" | "考试题库";
export type EnglishExamTagAbility =
  | "词汇"
  | "语法"
  | "阅读理解"
  | "听力理解"
  | "写作";
export type EnglishExamTagDifficulty = "基础" | "中等" | "提高";

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

export const ENGLISH_TAG_ENTRY_OPTIONS: EnglishExamTagEntry[] = ["教材配套", "考试题库"];
export const ENGLISH_TAG_ABILITY_OPTIONS: EnglishExamTagAbility[] = [
  "词汇",
  "语法",
  "阅读理解",
  "听力理解",
  "写作",
];
export const ENGLISH_TAG_DIFFICULTY_OPTIONS: EnglishExamTagDifficulty[] = ["基础", "中等", "提高"];

const KET_UNITS = Array.from({ length: 14 }, (_, index) => `Unit ${index + 1}`);
const PET_UNITS = Array.from({ length: 12 }, (_, index) => `Unit ${index + 1}`);

export const ENGLISH_EXAM_TAG_SCHEMAS: Record<EnglishExamTagTrack, EnglishExamTagSchema> = {
  ket: {
    label: "KET / A2 Key",
    units: KET_UNITS,
    examParts: [
      "阅读 Part 1",
      "阅读 Part 2",
      "阅读 Part 3",
      "阅读 Part 4",
      "阅读 Part 5",
      "听力 Part 1",
      "听力 Part 2",
      "听力 Part 3",
      "听力 Part 4",
      "听力 Part 5",
      "写作 Part 6",
      "写作 Part 7",
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
  },
  pet: {
    label: "PET / B1 Preliminary",
    units: PET_UNITS,
    examParts: [
      "阅读 Part 1",
      "阅读 Part 2",
      "阅读 Part 3",
      "阅读 Part 4",
      "阅读 Part 5",
      "阅读 Part 6",
      "听力 Part 1",
      "听力 Part 2",
      "听力 Part 3",
      "听力 Part 4",
      "写作 Part 1",
      "写作 Part 2",
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
  },
};

export function getEnglishExamTagSchema(track: EnglishExamTagTrack) {
  return ENGLISH_EXAM_TAG_SCHEMAS[track];
}
