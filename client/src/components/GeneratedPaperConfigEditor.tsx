import type {
  ManualPaperGenerationConfig,
  ManualPaperGenerationRule,
  ManualPaperGenerationSection,
  ManualQuestionType,
  ManualSectionType,
} from "@shared/manualPaperBlueprint";
import {
  MANUAL_QUESTION_TYPE_LABELS,
  MANUAL_SECTION_TYPE_LABELS,
} from "@shared/manualPaperBlueprint";
import {
  ENGLISH_TAG_ABILITY_OPTIONS,
  ENGLISH_TAG_DIFFICULTY_OPTIONS,
  ENGLISH_TAG_ENTRY_OPTIONS,
  getEnglishExamTagSchema,
  type EnglishExamTagAbility,
  type EnglishExamTagDifficulty,
  type EnglishExamTagEntry,
  type EnglishExamTagTrack,
} from "@shared/englishQuestionTags";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useEnglishTagSchemas } from "@/hooks/useEnglishTagSchemas";
import { Plus, Trash2 } from "lucide-react";

function createLocalId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `generated_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function createRule(defaultTrack: EnglishExamTagTrack): ManualPaperGenerationRule {
  return {
    id: createLocalId(),
    label: "新规则",
    weight: 1,
    filters: {
      track: defaultTrack,
      entries: [],
      abilities: [],
      grammarPoints: [],
      difficulties: [],
    },
  };
}

function createSection(defaultTrack: EnglishExamTagTrack): ManualPaperGenerationSection {
  return {
    id: createLocalId(),
    title: "新题型分区",
    sectionType: "reading",
    instructions: "",
    totalQuestions: 5,
    rules: [createRule(defaultTrack)],
  };
}

function toggleArrayValue<T extends string>(values: T[] | undefined, value: T) {
  const current = values ?? [];
  return current.includes(value)
    ? current.filter((item) => item !== value)
    : [...current, value];
}

const ENGLISH_GENERATION_SECTION_TYPES: ManualSectionType[] = [
  "reading",
  "listening",
  "writing",
  "grammar",
  "vocabulary",
];

const ENGLISH_GENERATION_QUESTION_TYPES: ManualQuestionType[] = [
  "mcq",
  "fill-blank",
  "passage-fill-blank",
  "passage-mcq",
  "typed-fill-blank",
  "passage-open-ended",
  "writing",
  "true-false",
  "heading-match",
  "checkbox",
  "ordering",
  "sentence-reorder",
  "inline-word-choice",
  "passage-inline-word-choice",
  "picture-spelling",
  "word-completion",
  "passage-matching",
];

export interface GeneratedSourcePaperOption {
  paperId: string;
  title: string;
  totalQuestions: number;
  hiddenFromStudentSelection?: boolean;
}

interface GeneratedPaperConfigEditorProps {
  value: ManualPaperGenerationConfig | undefined;
  sourcePapers: GeneratedSourcePaperOption[];
  previewWarnings: string[];
  onChange: (next: ManualPaperGenerationConfig) => void;
}

export default function GeneratedPaperConfigEditor({
  value,
  sourcePapers,
  previewWarnings,
  onChange,
}: GeneratedPaperConfigEditorProps) {
  const { schemas, schemaEntries, defaultTrack } = useEnglishTagSchemas();
  const config = value ?? { sourcePaperIds: [], sections: [createSection(defaultTrack)] };

  const updateConfig = (updater: (current: ManualPaperGenerationConfig) => ManualPaperGenerationConfig) => {
    onChange(updater(config));
  };

  const updateSection = (
    sectionId: string,
    updater: (section: ManualPaperGenerationSection) => ManualPaperGenerationSection,
  ) => {
    updateConfig((current) => ({
      ...current,
      sections: current.sections.map((section) => (
        section.id === sectionId ? updater(section) : section
      )),
    }));
  };

  const updateRule = (
    sectionId: string,
    ruleId: string,
    updater: (rule: ManualPaperGenerationRule) => ManualPaperGenerationRule,
  ) => {
    updateSection(sectionId, (section) => ({
      ...section,
      rules: section.rules.map((rule) => (rule.id === ruleId ? updater(rule) : rule)),
    }));
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-slate-900">随机组卷设置</h3>
          <p className="text-sm text-slate-500">
            学生进入这张卷子时，系统会从已发布并打好标签的英语题库卷中随机抽题生成新试卷。
          </p>
        </div>

        <div className="mt-5 space-y-3">
          <Label>题库来源</Label>
          {sourcePapers.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {sourcePapers.map((paper) => {
                const checked = (config.sourcePaperIds ?? []).includes(paper.paperId);
                return (
                  <label
                    key={paper.paperId}
                    className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        updateConfig((current) => ({
                          ...current,
                          sourcePaperIds: toggleArrayValue(current.sourcePaperIds, paper.paperId),
                        }));
                      }}
                    />
                    <span>
                      <span className="block font-medium text-slate-900">{paper.title}</span>
                      <span className="text-xs text-slate-500">
                        {paper.totalQuestions} 题{paper.hiddenFromStudentSelection ? " · 题库专用" : ""}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-500">
              还没有可用的已发布英语题库卷。先去录题并发布至少一张英语卷，再回来设置随机组卷。
            </p>
          )}
          <p className="text-xs text-slate-500">
            如果一个来源都不勾选，系统会默认使用所有已发布的固定英语卷。
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {config.sections.map((section, sectionIndex) => (
          <div key={section.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h4 className="text-base font-semibold text-slate-900">{`组卷分区 ${sectionIndex + 1}`}</h4>
                <p className="text-sm text-slate-500">每个分区代表学生卷子里的一个 section。</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                className="h-auto px-2 py-1 text-xs text-red-500"
                onClick={() => {
                  updateConfig((current) => ({
                    ...current,
                    sections: current.sections.filter((item) => item.id !== section.id),
                  }));
                }}
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" />
                删除分区
              </Button>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>分区标题</Label>
                <Input
                  value={section.title}
                  onChange={(event) => updateSection(section.id, (current) => ({ ...current, title: event.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Section 类型</Label>
                <select
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                  value={section.sectionType}
                  onChange={(event) => updateSection(section.id, (current) => ({
                    ...current,
                    sectionType: event.target.value as ManualSectionType,
                  }))}
                >
                  {ENGLISH_GENERATION_SECTION_TYPES.map((option) => (
                    <option key={option} value={option}>{MANUAL_SECTION_TYPE_LABELS[option]}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label>目标题量</Label>
                <Input
                  type="number"
                  min={1}
                  value={section.totalQuestions}
                  onChange={(event) => updateSection(section.id, (current) => ({
                    ...current,
                    totalQuestions: Math.max(1, Number(event.target.value) || 1),
                  }))}
                />
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <Label>本分区统一说明（可选）</Label>
              <Textarea
                rows={3}
                value={section.instructions || ""}
                onChange={(event) => updateSection(section.id, (current) => ({
                  ...current,
                  instructions: event.target.value,
                }))}
                placeholder="例如：Read the passage carefully and answer all questions."
              />
            </div>

            <div className="mt-5 space-y-4">
              {section.rules.map((rule, ruleIndex) => {
                const track = rule.filters.track || defaultTrack;
                const schema = getEnglishExamTagSchema(track, schemas);
                const grammarUnit = rule.filters.grammarUnit || rule.filters.unit;
                const grammarOptions = grammarUnit ? (schema.grammarByUnit[grammarUnit] ?? []) : [];
                const usesGrammar = rule.filters.abilities?.includes("语法") ?? false;

                return (
                  <div key={rule.id} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{`规则 ${ruleIndex + 1}`}</p>
                        <p className="text-xs text-slate-500">按权重分配题量，再从匹配标签里随机抽题。</p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-auto px-2 py-1 text-xs text-red-500"
                        onClick={() => updateSection(section.id, (current) => ({
                          ...current,
                          rules: current.rules.filter((item) => item.id !== rule.id),
                        }))}
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5" />
                        删除规则
                      </Button>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>规则名称</Label>
                        <Input
                          value={rule.label}
                          onChange={(event) => updateRule(section.id, rule.id, (current) => ({
                            ...current,
                            label: event.target.value,
                          }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>权重</Label>
                        <Input
                          type="number"
                          min={1}
                          value={rule.weight}
                          onChange={(event) => updateRule(section.id, rule.id, (current) => ({
                            ...current,
                            weight: Math.max(1, Number(event.target.value) || 1),
                          }))}
                        />
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-3">
                      <div className="space-y-2">
                        <Label>考试体系</Label>
                        <select
                          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                          value={track}
                          onChange={(event) => updateRule(section.id, rule.id, (current) => ({
                            ...current,
                            filters: {
                              ...current.filters,
                              track: event.target.value as EnglishExamTagTrack,
                              unit: undefined,
                              examPart: undefined,
                              grammarUnit: undefined,
                              grammarPoints: [],
                            },
                          }))}
                        >
                          {schemaEntries.map(([trackId, trackSchema]) => (
                            <option key={trackId} value={trackId}>{trackSchema.label}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <Label>教材单元</Label>
                        <select
                          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                          value={rule.filters.unit || ""}
                          onChange={(event) => updateRule(section.id, rule.id, (current) => ({
                            ...current,
                            filters: {
                              ...current.filters,
                              unit: event.target.value || undefined,
                              grammarUnit: usesGrammar ? (event.target.value || current.filters.grammarUnit) : current.filters.grammarUnit,
                              grammarPoints: usesGrammar && event.target.value && current.filters.grammarUnit !== event.target.value
                                ? []
                                : current.filters.grammarPoints,
                            },
                          }))}
                        >
                          <option value="">不限</option>
                          {schema.units.map((unit) => (
                            <option key={unit} value={unit}>{unit}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <Label>考试 Part</Label>
                        <select
                          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                          value={rule.filters.examPart || ""}
                          onChange={(event) => updateRule(section.id, rule.id, (current) => ({
                            ...current,
                            filters: {
                              ...current.filters,
                              examPart: event.target.value || undefined,
                            },
                          }))}
                        >
                          <option value="">不限</option>
                          {schema.examParts.map((part) => (
                            <option key={part} value={part}>{part}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2">
                      <Label>入口</Label>
                      <div className="flex flex-wrap gap-2">
                        {ENGLISH_TAG_ENTRY_OPTIONS.map((entry) => {
                          const checked = rule.filters.entries?.includes(entry) ?? false;
                          return (
                            <label key={entry} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => updateRule(section.id, rule.id, (current) => ({
                                  ...current,
                                  filters: {
                                    ...current.filters,
                                    entries: toggleArrayValue(current.filters.entries as EnglishExamTagEntry[] | undefined, entry),
                                  },
                                }))}
                              />
                              <span>{entry}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div className="mt-4 space-y-2">
                      <Label>类型</Label>
                      <div className="flex flex-wrap gap-2">
                        {ENGLISH_TAG_ABILITY_OPTIONS.map((ability) => {
                          const checked = rule.filters.abilities?.includes(ability) ?? false;
                          return (
                            <label key={ability} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => updateRule(section.id, rule.id, (current) => ({
                                  ...current,
                                  filters: {
                                    ...current.filters,
                                    abilities: toggleArrayValue(current.filters.abilities as EnglishExamTagAbility[] | undefined, ability),
                                    grammarPoints: ability === "语法" || !checked ? current.filters.grammarPoints : [],
                                    difficulties: ability === "语法" || !checked ? current.filters.difficulties : [],
                                  },
                                }))}
                              />
                              <span>{ability}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div className="mt-4 space-y-2">
                      <Label>题型（可选）</Label>
                      <div className="flex flex-wrap gap-2">
                        {ENGLISH_GENERATION_QUESTION_TYPES.map((questionType) => {
                          const checked = rule.filters.questionTypes?.includes(questionType) ?? false;
                          return (
                            <label key={questionType} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => updateRule(section.id, rule.id, (current) => ({
                                  ...current,
                                  filters: {
                                    ...current.filters,
                                    questionTypes: toggleArrayValue(current.filters.questionTypes, questionType),
                                  },
                                }))}
                              />
                              <span>{MANUAL_QUESTION_TYPE_LABELS[questionType]}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {usesGrammar ? (
                      <div className="mt-4 space-y-4 rounded-xl border border-amber-100 bg-white p-4">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label>语法所属单元</Label>
                            <select
                              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                              value={grammarUnit || ""}
                              onChange={(event) => updateRule(section.id, rule.id, (current) => ({
                                ...current,
                                filters: {
                                  ...current.filters,
                                  grammarUnit: event.target.value || undefined,
                                  grammarPoints: [],
                                },
                              }))}
                            >
                              <option value="">不限</option>
                              {schema.units.map((unit) => (
                                <option key={unit} value={unit}>{unit}</option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-2">
                            <Label>难度</Label>
                            <div className="flex flex-wrap gap-2">
                              {ENGLISH_TAG_DIFFICULTY_OPTIONS.map((difficulty) => {
                                const checked = rule.filters.difficulties?.includes(difficulty) ?? false;
                                return (
                                  <label key={difficulty} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => updateRule(section.id, rule.id, (current) => ({
                                        ...current,
                                        filters: {
                                          ...current.filters,
                                          difficulties: toggleArrayValue(current.filters.difficulties as EnglishExamTagDifficulty[] | undefined, difficulty),
                                        },
                                      }))}
                                    />
                                    <span>{difficulty}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>语法知识点</Label>
                          {grammarOptions.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {grammarOptions.map((point) => {
                                const checked = rule.filters.grammarPoints?.includes(point) ?? false;
                                return (
                                  <label key={point} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => updateRule(section.id, rule.id, (current) => ({
                                        ...current,
                                        filters: {
                                          ...current.filters,
                                          grammarPoints: toggleArrayValue(current.filters.grammarPoints, point),
                                        },
                                      }))}
                                    />
                                    <span>{point}</span>
                                  </label>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-xs text-slate-500">先选择语法所属单元。</p>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}

              <Button
                type="button"
                variant="outline"
                className="border-dashed"
                onClick={() => updateSection(section.id, (current) => ({
                  ...current,
                  rules: [...current.rules, createRule(defaultTrack)],
                }))}
              >
                <Plus className="mr-2 h-4 w-4" />
                添加规则
              </Button>
            </div>
          </div>
        ))}

        <Button
          type="button"
          variant="outline"
          className="border-dashed"
        onClick={() => updateConfig((current) => ({
          ...current,
          sections: [...current.sections, createSection(defaultTrack)],
        }))}
      >
          <Plus className="mr-2 h-4 w-4" />
          添加组卷分区
        </Button>
      </div>

      {previewWarnings.length > 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">预览提醒</p>
          <ul className="mt-2 space-y-1 text-sm text-amber-800">
            {previewWarnings.map((warning) => (
              <li key={warning}>• {warning}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
