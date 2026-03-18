import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { ArrowLeft, ChevronDown, ChevronUp, Layers3, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import TeacherToolsLayout from "@/components/TeacherToolsLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  normalizeEnglishTagSystems,
  normalizeSubjectTagSystems,
  type EnglishExamTagSystem,
  type SubjectTagSystem,
} from "@shared/englishQuestionTags";
import {
  PAPER_SUBJECT_LABELS,
  PAPER_SUBJECT_ORDER,
  type PaperSubject,
} from "@/data/papers";
import { useSubjectTagSystems } from "@/hooks/useSubjectTagSystems";

function isPaperSubjectValue(value: unknown): value is PaperSubject {
  return typeof value === "string" && PAPER_SUBJECT_ORDER.includes(value as PaperSubject);
}

function createEmptyEnglishSystem(index: number): EnglishExamTagSystem {
  const suffix = `${Date.now().toString(36)}-${index + 1}`;
  return {
    id: `custom-${suffix}`,
    label: "",
    units: [formatUnitNumber(1)],
    examParts: [],
    abilities: ["词汇", "语法", "阅读理解", "听力理解", "写作"],
    difficulties: ["基础", "中等", "提高"],
    grammarByUnit: {},
  };
}

function createEmptyBasicSystem(subject: Extract<PaperSubject, "math" | "vocabulary">, index: number): SubjectTagSystem {
  const suffix = `${Date.now().toString(36)}-${index + 1}`;
  return {
    id: `${subject}-${suffix}`,
    label: "",
    units: [formatUnitNumber(1)],
    examParts: [],
  };
}

const PART_PREFIX_OPTIONS: Record<PaperSubject, string[]> = {
  english: ["阅读", "听力", "写作", "口语", "语法", "词汇"],
  math: ["选择", "填空", "计算", "应用", "几何", "代数", "统计", "综合"],
  vocabulary: ["词义", "拼写", "词汇运用", "搭配", "词形", "选词填空"],
};

function clampPositiveInt(value: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.round(value));
}

function parseUnitNumber(value: string) {
  const match = value.match(/(\d+)/);
  return clampPositiveInt(match ? Number(match[1]) : 1);
}

function formatUnitNumber(value: number) {
  return `Unit ${clampPositiveInt(value)}`;
}

function getUnitCount(units: string[]) {
  if (units.length === 0) return 1;
  return Math.max(...units.map((unit) => parseUnitNumber(unit)), 1);
}

function buildUnitRange(count: number) {
  return Array.from({ length: clampPositiveInt(count) }, (_, index) => formatUnitNumber(index + 1));
}

function parseExamPart(value: string, fallbackPrefix: string) {
  const partMatch = value.match(/^(.*?)\s*Part\s*(\d+)$/i);
  if (partMatch) {
    return {
      prefix: partMatch[1].trim() || fallbackPrefix,
      number: clampPositiveInt(Number(partMatch[2])),
    };
  }

  const numberMatch = value.match(/(\d+)/);
  if (numberMatch) {
    return {
      prefix: value.replace(numberMatch[0], "").replace(/Part/gi, "").trim() || fallbackPrefix,
      number: clampPositiveInt(Number(numberMatch[0])),
    };
  }

  return {
    prefix: value.trim() || fallbackPrefix,
    number: 1,
  };
}

function formatExamPart(prefix: string, number: number) {
  return `${prefix.trim() || "Part"} Part ${clampPositiveInt(number)}`;
}

export default function TagManager() {
  const search = useSearch();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const subjectFilter = useMemo(() => {
    const value = new URLSearchParams(search).get("subject");
    return isPaperSubjectValue(value) ? value : "english";
  }, [search]);
  const [englishSystems, setEnglishSystems] = useState<EnglishExamTagSystem[]>([]);
  const [basicSystems, setBasicSystems] = useState<SubjectTagSystem[]>([]);
  const [expandedSystemIds, setExpandedSystemIds] = useState<string[]>([]);

  const query = useSubjectTagSystems(subjectFilter);

  const saveEnglishMutation = trpc.papers.saveEnglishTagSystems.useMutation({
    onSuccess: async () => {
      await utils.papers.getEnglishTagSystems.invalidate();
    },
  });
  const saveMathMutation = trpc.papers.saveMathTagSystems.useMutation({
    onSuccess: async () => {
      await utils.papers.getMathTagSystems.invalidate();
    },
  });
  const saveVocabularyMutation = trpc.papers.saveVocabularyTagSystems.useMutation({
    onSuccess: async () => {
      await utils.papers.getVocabularyTagSystems.invalidate();
    },
  });

  useEffect(() => {
    if (!query.data) return;
    if (subjectFilter === "english") {
      setEnglishSystems(query.systems as EnglishExamTagSystem[]);
    } else {
      setBasicSystems(query.systems as SubjectTagSystem[]);
    }
    setExpandedSystemIds([]);
  }, [query.data, subjectFilter]);

  const canSave = useMemo(() => {
    const systems = subjectFilter === "english" ? englishSystems : basicSystems;
    if (systems.length === 0) return false;
    return systems.every((system) => {
      if (!system.label.trim()) return false;
      if (system.units.length === 0) return false;
      if (system.examParts.length === 0) return false;
      return true;
    });
  }, [basicSystems, englishSystems, subjectFilter]);

  const updateSystem = (id: string, updater: (current: EnglishExamTagSystem) => EnglishExamTagSystem) => {
    setEnglishSystems((current) => current.map((system) => (system.id === id ? updater(system) : system)));
  };

  const updateBasicSystem = (id: string, updater: (current: SubjectTagSystem) => SubjectTagSystem) => {
    setBasicSystems((current) => current.map((system) => (system.id === id ? updater(system) : system)));
  };

  const handleSave = async () => {
    try {
      if (subjectFilter === "english") {
        const normalized = normalizeEnglishTagSystems(
          englishSystems.map((system) => ({
            ...system,
            label: system.label.trim(),
            units: [...system.units],
            examParts: [...system.examParts],
          })),
        );

        await saveEnglishMutation.mutateAsync({ systems: normalized });
      } else if (subjectFilter === "math") {
        const normalized = normalizeSubjectTagSystems("math", basicSystems);
        await saveMathMutation.mutateAsync({ systems: normalized });
      } else {
        const normalized = normalizeSubjectTagSystems("vocabulary", basicSystems);
        await saveVocabularyMutation.mutateAsync({ systems: normalized });
      }

      toast.success("标签体系已保存。录题页会直接读取这里的配置。");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败，请稍后重试。");
    }
  };

  const isSaving = saveEnglishMutation.isPending || saveMathMutation.isPending || saveVocabularyMutation.isPending;
  const systems = subjectFilter === "english" ? englishSystems : basicSystems;

  const setUnitsForSystem = (systemId: string, nextUnits: string[]) => {
    if (subjectFilter === "english") {
      updateSystem(systemId, (current) => ({
        ...current,
        units: nextUnits,
        grammarByUnit: Object.fromEntries(
          Object.entries(current.grammarByUnit).filter(([unit]) => nextUnits.includes(unit)),
        ),
      }));
      return;
    }

    updateBasicSystem(systemId, (current) => ({
      ...current,
      units: nextUnits,
    }));
  };

  const setExamPartsForSystem = (systemId: string, nextExamParts: string[]) => {
    if (subjectFilter === "english") {
      updateSystem(systemId, (current) => ({
        ...current,
        examParts: nextExamParts,
      }));
      return;
    }

    updateBasicSystem(systemId, (current) => ({
      ...current,
      examParts: nextExamParts,
    }));
  };

  const toggleSystemExpanded = (systemId: string) => {
    setExpandedSystemIds((current) =>
      current.includes(systemId)
        ? current.filter((id) => id !== systemId)
        : [...current, systemId],
    );
  };

  return (
    <TeacherToolsLayout activeTool="tag-manager" currentSubject={subjectFilter}>
      <div className="min-h-screen bg-[#F6F8FB] px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="space-y-4">
            <div>
              <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700">
                <ArrowLeft className="h-4 w-4" />
                返回老师首页
              </Link>
              <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#1E3A5F]">标签管理</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-500">
                在这里维护不同考试体系下的 Part 和教材单元。保存后，录题页和随机组卷页会直接读取这里的配置。
              </p>
            </div>

            <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <Label className="text-sm font-medium text-slate-700">Subject</Label>
              <select
                className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                value={subjectFilter}
                onChange={(event) => navigate(`/tag-manager?subject=${event.target.value}`)}
              >
                {PAPER_SUBJECT_ORDER.map((subject) => (
                  <option key={subject} value={subject}>
                    {PAPER_SUBJECT_LABELS[subject]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {query.isLoading ? (
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="flex items-center justify-center gap-3 py-16 text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin" />
                正在加载考试体系...
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  <Badge className="rounded-full bg-slate-100 px-3 py-1 text-slate-600 hover:bg-slate-100">
                    {systems.length} 个考试体系
                  </Badge>
                  <Badge className="rounded-full bg-sky-100 px-3 py-1 text-sky-700 hover:bg-sky-100">
                    {PAPER_SUBJECT_LABELS[subjectFilter]} Question Tags
                  </Badge>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="border-slate-200"
                  onClick={() => {
                    if (subjectFilter === "english") {
                      const nextSystem = createEmptyEnglishSystem(englishSystems.length);
                      setEnglishSystems((current) => [...current, nextSystem]);
                      setExpandedSystemIds((current) => (current.includes(nextSystem.id) ? current : [...current, nextSystem.id]));
                    } else {
                      const nextSystem = createEmptyBasicSystem(subjectFilter as "math" | "vocabulary", basicSystems.length);
                      setBasicSystems((current) => [...current, nextSystem]);
                      setExpandedSystemIds((current) => (current.includes(nextSystem.id) ? current : [...current, nextSystem.id]));
                    }
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  新增考试体系
                </Button>
              </div>

              <div className="space-y-4">
                {systems.map((system, index) => (
                  <Card key={system.id} className="border-slate-200 shadow-sm">
                    <CardHeader className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                            <Layers3 className="h-5 w-5" />
                          </div>
                          <div>
                            <CardTitle className="text-lg text-[#1E3A5F] sm:text-xl">{system.label.trim() || `考试体系 ${index + 1}`}</CardTitle>
                            <CardDescription>系统 ID：{system.id}</CardDescription>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            className="border-slate-200"
                            onClick={() => toggleSystemExpanded(system.id)}
                          >
                            {expandedSystemIds.includes(system.id) ? (
                              <ChevronUp className="mr-2 h-4 w-4" />
                            ) : (
                              <ChevronDown className="mr-2 h-4 w-4" />
                            )}
                            {expandedSystemIds.includes(system.id) ? "收起" : "展开"}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                            onClick={() => {
                              setExpandedSystemIds((current) => current.filter((id) => id !== system.id));
                              if (subjectFilter === "english") {
                                setEnglishSystems((current) => current.filter((item) => item.id !== system.id));
                                return;
                              }
                              setBasicSystems((current) => current.filter((item) => item.id !== system.id));
                            }}
                            disabled={systems.length <= 1}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            删除
                          </Button>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Badge className="rounded-full bg-slate-100 px-3 py-1 text-slate-600 hover:bg-slate-100">
                          {getUnitCount(system.units)} 个单元
                        </Badge>
                        <Badge className="rounded-full bg-sky-100 px-3 py-1 text-sky-700 hover:bg-sky-100">
                          {system.examParts.length} 个 Part
                        </Badge>
                      </div>
                    </CardHeader>

                    {expandedSystemIds.includes(system.id) ? (
                      <CardContent className="grid gap-5 lg:grid-cols-2">
                        <div className="space-y-2">
                          <Label>考试体系名称</Label>
                          <Input
                            value={system.label}
                            onChange={(event) => {
                              const nextLabel = event.target.value;
                              if (subjectFilter === "english") {
                                updateSystem(system.id, (current) => ({
                                  ...current,
                                  label: nextLabel,
                                }));
                                return;
                              }
                              updateBasicSystem(system.id, (current) => ({
                                ...current,
                                label: nextLabel,
                              }));
                            }}
                            placeholder={subjectFilter === "english" ? "例如：FCE / B2 First" : "例如：校内同步 / 竞赛数学 / 核心词汇"}
                          />
                          <p className="text-xs text-slate-500">这里的名称会直接显示在录题页和随机组卷页。</p>
                        </div>

                        <div className="space-y-2">
                          <Label>教材单元</Label>
                          <div className="flex flex-wrap items-center gap-3">
                            <div className="inline-flex h-11 min-w-[120px] items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600">
                              Unit 1 -
                            </div>
                            <Input
                              type="number"
                              min={1}
                              step={1}
                              value={getUnitCount(system.units)}
                              onChange={(event) => {
                                setUnitsForSystem(system.id, buildUnitRange(Number(event.target.value || 1)));
                              }}
                              className="w-32 bg-white"
                            />
                            <span className="text-sm text-slate-500">个单元</span>
                          </div>
                        </div>

                        <div className="space-y-2 lg:col-span-2">
                          <Label>考试 Part</Label>
                          <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                            {system.examParts.map((examPart, examPartIndex) => {
                              const defaultPrefix = PART_PREFIX_OPTIONS[subjectFilter][0] || "阅读";
                              const parsedPart = parseExamPart(examPart, defaultPrefix);
                              const partOptions = Array.from(
                                new Set([
                                  ...PART_PREFIX_OPTIONS[subjectFilter],
                                  ...system.examParts.map((currentPart) => parseExamPart(currentPart, defaultPrefix).prefix),
                                ]),
                              );

                              return (
                                <div
                                  key={`${system.id}-part-${examPartIndex}`}
                                  className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-[minmax(0,1fr)_auto_120px_auto]"
                                >
                                  <select
                                    className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"
                                    value={parsedPart.prefix}
                                    onChange={(event) => {
                                      const nextExamParts = [...system.examParts];
                                      nextExamParts[examPartIndex] = formatExamPart(event.target.value, parsedPart.number);
                                      setExamPartsForSystem(system.id, nextExamParts);
                                    }}
                                  >
                                    {partOptions.map((option) => (
                                      <option key={option} value={option}>
                                        {option}
                                      </option>
                                    ))}
                                  </select>

                                  <div className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-600">
                                    Part
                                  </div>

                                  <Input
                                    type="number"
                                    min={1}
                                    step={1}
                                    value={parsedPart.number}
                                    onChange={(event) => {
                                      const nextExamParts = [...system.examParts];
                                      nextExamParts[examPartIndex] = formatExamPart(parsedPart.prefix, Number(event.target.value || 1));
                                      setExamPartsForSystem(system.id, nextExamParts);
                                    }}
                                    className="bg-white"
                                  />

                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="border-red-200 px-3 text-red-600 hover:bg-red-50 hover:text-red-700"
                                    onClick={() => {
                                      const nextExamParts = system.examParts.filter((_, indexToKeep) => indexToKeep !== examPartIndex);
                                      setExamPartsForSystem(system.id, nextExamParts);
                                    }}
                                    disabled={system.examParts.length <= 1}
                                  >
                                    <Trash2 className="mr-1.5 h-4 w-4" />
                                    删除
                                  </Button>
                                </div>
                              );
                            })}

                            <Button
                              type="button"
                              variant="outline"
                              className="border-slate-200 bg-white"
                              onClick={() => {
                                const defaultPrefix = PART_PREFIX_OPTIONS[subjectFilter][0] || "阅读";
                                setExamPartsForSystem(system.id, [...system.examParts, formatExamPart(defaultPrefix, system.examParts.length + 1)]);
                              }}
                            >
                              <Plus className="mr-2 h-4 w-4" />
                              添加 Part
                            </Button>
                          </div>
                          <div className="flex flex-wrap items-end justify-between gap-3">
                            <p className="text-xs text-slate-500">先选分区类型，再调整 Part 后面的数字。</p>
                            <Button
                              type="button"
                              className="h-11 bg-[#1E3A5F] px-5 text-white hover:bg-[#17324F]"
                              onClick={handleSave}
                              disabled={!canSave || isSaving}
                            >
                              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                              保存标签配置
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    ) : null}
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </TeacherToolsLayout>
  );
}
