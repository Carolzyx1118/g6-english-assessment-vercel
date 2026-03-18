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
import { trpc } from "@/lib/trpc";
import { MANUAL_QUESTION_TYPE_LABELS } from "@shared/manualPaperBlueprint";
import {
  buildGeneratedPaperConfig,
  getGeneratedQuestionTypeOptions,
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
    generatedPaper: { title: "", description: "", parts: [] },
  };
}

function createEmptyBasicSystem(subject: Extract<PaperSubject, "math" | "vocabulary">, index: number): SubjectTagSystem {
  const suffix = `${Date.now().toString(36)}-${index + 1}`;
  return {
    id: `${subject}-${suffix}`,
    label: "",
    units: [formatUnitNumber(1)],
    examParts: [],
    generatedPaper: { title: "", description: "", parts: [] },
  };
}

const PART_PREFIX_OPTIONS: Record<PaperSubject, string[]> = {
  english: ["Reading", "Listening", "Writing", "Speaking", "Grammar", "Vocabulary"],
  math: ["Multiple Choice", "Fill in the Blank", "Calculation", "Word Problem", "Geometry", "Algebra", "Statistics", "Mixed Practice"],
  vocabulary: ["Meaning", "Spelling", "Usage", "Collocation", "Word Form", "Cloze"],
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

      toast.success("Tag systems saved. Paper intake and tag-based paper setup now use the updated settings.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save tag systems.");
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
        generatedPaper: buildGeneratedPaperConfig("english", current.label, nextExamParts, current.generatedPaper),
      }));
      return;
    }

    updateBasicSystem(systemId, (current) => ({
      ...current,
      examParts: nextExamParts,
      generatedPaper: buildGeneratedPaperConfig(subjectFilter as "math" | "vocabulary", current.label, nextExamParts, current.generatedPaper),
    }));
  };

  const updateGeneratedPaper = (
    systemId: string,
    updater: (current: NonNullable<EnglishExamTagSystem["generatedPaper"]>) => NonNullable<EnglishExamTagSystem["generatedPaper"]>,
  ) => {
    if (subjectFilter === "english") {
      updateSystem(systemId, (current) => ({
        ...current,
        generatedPaper: updater(buildGeneratedPaperConfig("english", current.label, current.examParts, current.generatedPaper)),
      }));
      return;
    }

    updateBasicSystem(systemId, (current) => ({
      ...current,
      generatedPaper: updater(
        buildGeneratedPaperConfig(subjectFilter as "math" | "vocabulary", current.label, current.examParts, current.generatedPaper),
      ),
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
                Back to Teacher Home
              </Link>
              <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#1E3A5F]">Tag Manager</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-500">
                Manage exam systems, parts, unit ranges, and random paper setup here. Paper intake and tag-based paper setup will read these settings directly.
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
                Loading exam systems...
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  <Badge className="rounded-full bg-slate-100 px-3 py-1 text-slate-600 hover:bg-slate-100">
                    {systems.length} exam systems
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
                  Add Exam System
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
                            <CardTitle className="text-base text-[#1E3A5F] sm:text-lg">{system.label.trim() || `Exam System ${index + 1}`}</CardTitle>
                            <CardDescription className="text-xs sm:text-sm">System ID: {system.id}</CardDescription>
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
                            {expandedSystemIds.includes(system.id) ? "Collapse" : "Expand"}
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
                            Delete
                          </Button>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Badge className="rounded-full bg-slate-100 px-3 py-1 text-slate-600 hover:bg-slate-100">
                          {getUnitCount(system.units)} Units
                        </Badge>
                        <Badge className="rounded-full bg-sky-100 px-3 py-1 text-sky-700 hover:bg-sky-100">
                          {system.examParts.length} Parts
                        </Badge>
                      </div>
                    </CardHeader>

                    {expandedSystemIds.includes(system.id) ? (
                      <CardContent className="grid gap-5 lg:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Exam System Name</Label>
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
                            placeholder={subjectFilter === "english" ? "e.g. FCE / B2 First" : "e.g. School Sync / Competition Math / Core Vocabulary"}
                          />
                          <p className="text-xs text-slate-500">This name appears directly in paper intake and tag-based paper setup.</p>
                        </div>

                        <div className="space-y-2">
                          <Label>Unit Range</Label>
                          <div className="flex flex-wrap items-center gap-3">
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
                            <span className="text-sm text-slate-500">units from Unit 1</span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Paper Name</Label>
                          <Input
                            value={buildGeneratedPaperConfig(subjectFilter, system.label, system.examParts, system.generatedPaper).title}
                            onChange={(event) =>
                              updateGeneratedPaper(system.id, (current) => ({
                                ...current,
                                title: event.target.value,
                              }))
                            }
                            placeholder="e.g. KET Random Assessment"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Description</Label>
                          <Input
                            value={buildGeneratedPaperConfig(subjectFilter, system.label, system.examParts, system.generatedPaper).description}
                            onChange={(event) =>
                              updateGeneratedPaper(system.id, (current) => ({
                                ...current,
                                description: event.target.value,
                              }))
                            }
                            placeholder="Describe what this random paper is for."
                          />
                        </div>

                        <div className="space-y-2 lg:col-span-2">
                          <Label>Exam Parts</Label>
                          <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                            {system.examParts.map((examPart, examPartIndex) => {
                              const defaultPrefix = PART_PREFIX_OPTIONS[subjectFilter][0] || "Reading";
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
                                    Delete
                                  </Button>
                                </div>
                              );
                            })}

                            <Button
                              type="button"
                              variant="outline"
                              className="border-slate-200 bg-white"
                              onClick={() => {
                                const defaultPrefix = PART_PREFIX_OPTIONS[subjectFilter][0] || "Reading";
                                setExamPartsForSystem(system.id, [...system.examParts, formatExamPart(defaultPrefix, system.examParts.length + 1)]);
                              }}
                            >
                              <Plus className="mr-2 h-4 w-4" />
                              Add Part
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-2 lg:col-span-2">
                          <Label>Random Paper Setup</Label>
                          <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                            {buildGeneratedPaperConfig(subjectFilter, system.label, system.examParts, system.generatedPaper).parts.map((partConfig, partIndex) => {
                              const questionTypeOptions = getGeneratedQuestionTypeOptions(subjectFilter, partConfig.examPart);

                              return (
                                <div
                                  key={`${system.id}-generated-${partConfig.examPart}-${partIndex}`}
                                  className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_120px]"
                                >
                                  <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                                    {partConfig.examPart}
                                  </div>

                                  <select
                                    className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"
                                    value={partConfig.questionType}
                                    onChange={(event) =>
                                      updateGeneratedPaper(system.id, (current) => ({
                                        ...current,
                                        parts: current.parts.map((item) =>
                                          item.examPart === partConfig.examPart
                                            ? { ...item, questionType: event.target.value }
                                            : item,
                                        ),
                                      }))
                                    }
                                  >
                                    {questionTypeOptions.map((option) => (
                                      <option key={option} value={option}>
                                        {MANUAL_QUESTION_TYPE_LABELS[option as keyof typeof MANUAL_QUESTION_TYPE_LABELS] ?? option}
                                      </option>
                                    ))}
                                  </select>

                                  <Input
                                    type="number"
                                    min={0}
                                    step={1}
                                    value={partConfig.totalQuestions}
                                    onChange={(event) =>
                                      updateGeneratedPaper(system.id, (current) => ({
                                        ...current,
                                        parts: current.parts.map((item) =>
                                          item.examPart === partConfig.examPart
                                            ? { ...item, totalQuestions: Math.max(0, Number(event.target.value) || 0) }
                                            : item,
                                        ),
                                      }))
                                    }
                                    className="bg-white text-center"
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-end justify-between gap-3 lg:col-span-2">
                          <p className="text-xs text-slate-500">Choose the part type first, then adjust the part number.</p>
                          <Button
                            type="button"
                            className="h-11 bg-[#1E3A5F] px-5 text-white hover:bg-[#17324F]"
                            onClick={handleSave}
                            disabled={!canSave || isSaving}
                          >
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Save Tag Configuration
                          </Button>
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
