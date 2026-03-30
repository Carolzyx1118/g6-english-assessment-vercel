import { useMemo, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  Copy,
  Eye,
  EyeOff,
  FileText,
  Headphones,
  Layers3,
  Loader2,
  Pencil,
  Search,
  Settings2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import TeacherToolsLayout from "@/components/TeacherToolsLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useLocalAuth } from "@/hooks/useLocalAuth";
import { trpc } from "@/lib/trpc";
import {
  PAPER_CATEGORY_LABELS,
  PAPER_SUBJECT_LABELS,
  PAPER_SUBJECT_ORDER,
  type PaperCategory,
  type PaperSubject,
} from "@/data/papers";
import { buildTagSystemPapers } from "@/lib/tagSystemPapers";
import type { ManualPaperBlueprint } from "@shared/manualPaperBlueprint";
import {
  type EnglishExamTagSystem,
  type SubjectTagSystem,
} from "@shared/englishQuestionTags";

function formatDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString("en-SG", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatGenerationWarningSectionLabel(label: string) {
  const trimmed = label.trim();
  const partMatch = trimmed.match(/^Part\s+(\d+)$/i);
  if (partMatch) {
    return `第 ${partMatch[1]} 部分`;
  }
  return trimmed;
}

function localizeGenerationWarning(warning: string) {
  const trimmed = warning.trim();

  if (trimmed === "This generated paper has no section rules yet.") {
    return "这份自动组卷试卷还没有配置任何组卷规则。";
  }

  if (trimmed === "No eligible source papers were found for this generated paper.") {
    return "这份自动组卷试卷没有找到可用的题源试卷。";
  }

  const ruleMatch = trimmed.match(/^(.+?): rule "(.+)" needed (\d+) question\(s\), but only (\d+) matched\.$/);
  if (ruleMatch) {
    const [, sectionLabel, ruleLabel, neededCount, matchedCount] = ruleMatch;
    return `${formatGenerationWarningSectionLabel(sectionLabel)}：规则“${ruleLabel}”需要 ${neededCount} 题，但目前只匹配到 ${matchedCount} 题。`;
  }

  const assembledMatch = trimmed.match(/^(.+?): only assembled (\d+)\/(\d+) question\(s\)\.$/);
  if (assembledMatch) {
    const [, sectionLabel, assembledCount, targetCount] = assembledMatch;
    return `${formatGenerationWarningSectionLabel(sectionLabel)}：当前只成功组出了 ${assembledCount}/${targetCount} 题。`;
  }

  return trimmed;
}

type ManualManagedPaper = {
  kind: "manual";
  key: string;
  manualId: number;
  paperId: string;
  title: string;
  description: string;
  subject: PaperSubject;
  category: PaperCategory;
  published: boolean;
  totalQuestions: number;
  hasListening: boolean;
  hasWriting: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
};

type SystemManagedPaper = {
  kind: "system";
  key: string;
  subject: PaperSubject;
  systemId: string;
  title: string;
  description: string;
  category: PaperCategory;
  published: boolean;
  totalQuestions: number;
  totalSections: number;
  generationWarnings: string[];
};

type ManagedPaper = ManualManagedPaper | SystemManagedPaper;

type DeleteTarget =
  | { kind: "manual"; key: string; title: string; manualId: number }
  | { kind: "system"; key: string; title: string; subject: PaperSubject; systemId: string };

export default function PaperManager() {
  const search = useSearch();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const { isTeacher } = useLocalAuth();
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [pendingPaperKey, setPendingPaperKey] = useState<string | null>(null);
  const [expandedWarningKey, setExpandedWarningKey] = useState<string | null>(null);
  const [keyword, setKeyword] = useState("");

  const subjectFilter = useMemo(() => {
    const value = new URLSearchParams(search).get("subject");
    return value === "english" || value === "math" || value === "vocabulary"
      ? (value as PaperSubject)
      : null;
  }, [search]);

  const canManagePapers = isTeacher;

  const manualPapersQuery = trpc.papers.listAllManualPapers.useQuery(undefined, {
    enabled: canManagePapers,
    staleTime: 5_000,
  });
  const questionBankPapersQuery = trpc.papers.listQuestionBankPapers.useQuery(undefined, {
    enabled: canManagePapers,
    staleTime: 5_000,
  });
  const englishSystemsQuery = trpc.papers.getEnglishTagSystems.useQuery(undefined, {
    enabled: canManagePapers,
    staleTime: 5_000,
  });
  const mathSystemsQuery = trpc.papers.getMathTagSystems.useQuery(undefined, {
    enabled: canManagePapers,
    staleTime: 5_000,
  });
  const vocabularySystemsQuery = trpc.papers.getVocabularyTagSystems.useQuery(undefined, {
    enabled: canManagePapers,
    staleTime: 5_000,
  });

  const publishMutation = trpc.papers.setManualPaperPublished.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.papers.listAllManualPapers.invalidate(),
        utils.papers.listManualPapers.invalidate(),
        utils.papers.listQuestionBankPapers.invalidate(),
      ]);
    },
  });
  const deleteMutation = trpc.papers.deleteManualPaper.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.papers.listAllManualPapers.invalidate(),
        utils.papers.listManualPapers.invalidate(),
        utils.papers.listQuestionBankPapers.invalidate(),
      ]);
    },
  });
  const duplicateMutation = trpc.papers.duplicateManualPaper.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.papers.listAllManualPapers.invalidate(),
        utils.papers.listManualPapers.invalidate(),
        utils.papers.listQuestionBankPapers.invalidate(),
      ]);
    },
  });
  const saveEnglishSystemsMutation = trpc.papers.saveEnglishTagSystems.useMutation({
    onSuccess: async () => {
      await utils.papers.getEnglishTagSystems.invalidate();
    },
  });
  const saveMathSystemsMutation = trpc.papers.saveMathTagSystems.useMutation({
    onSuccess: async () => {
      await utils.papers.getMathTagSystems.invalidate();
    },
  });
  const saveVocabularySystemsMutation = trpc.papers.saveVocabularyTagSystems.useMutation({
    onSuccess: async () => {
      await utils.papers.getVocabularyTagSystems.invalidate();
    },
  });

  const systemsBySubject = useMemo(
    () => ({
      english: englishSystemsQuery.data ?? [],
      math: mathSystemsQuery.data ?? [],
      vocabulary: vocabularySystemsQuery.data ?? [],
    }),
    [englishSystemsQuery.data, mathSystemsQuery.data, vocabularySystemsQuery.data],
  );

  const questionBankSourceBySubject = useMemo(() => {
    return (questionBankPapersQuery.data ?? [])
      .flatMap((paper) => {
        try {
          const subject = paper.subject === "math" || paper.subject === "vocabulary"
            ? paper.subject
            : "english";
          const blueprint = JSON.parse(paper.blueprintJson) as ManualPaperBlueprint;
          return [{
            subject,
            paperId: paper.paperId,
            title: paper.title,
            blueprint,
          }];
        } catch {
          return [];
        }
      })
      .reduce<Record<PaperSubject, Array<{ paperId: string; title: string; blueprint: ManualPaperBlueprint }>>>(
        (accumulator, paper) => {
          const subject = paper.subject as PaperSubject;
          accumulator[subject].push({
            paperId: paper.paperId,
            title: paper.title,
            blueprint: paper.blueprint,
          });
          return accumulator;
        },
        {
          english: [],
          math: [],
          vocabulary: [],
        },
      );
  }, [questionBankPapersQuery.data]);

  const managedPapers = useMemo<ManagedPaper[]>(() => {
    const manualPapers: ManagedPaper[] = (manualPapersQuery.data ?? [])
      .filter((paper) => paper.buildMode === "fixed" && paper.visibilityMode !== "question-bank")
      .map((paper) => ({
        kind: "manual",
        key: `manual-${paper.id}`,
        manualId: paper.id,
        paperId: paper.paperId,
        title: paper.title,
        description: paper.description || "",
        subject: paper.subject === "math" || paper.subject === "vocabulary" ? paper.subject : "english",
        category: (paper.category as PaperCategory) || "assessment",
        published: paper.published,
        totalQuestions: paper.totalQuestions,
        hasListening: paper.hasListening,
        hasWriting: paper.hasWriting,
        createdAt: paper.createdAt,
        updatedAt: paper.updatedAt,
      }));

    const systemPapers: ManagedPaper[] = (["english", "math", "vocabulary"] as PaperSubject[]).flatMap((subject) => {
      const systems = systemsBySubject[subject];
      const builtPapers = buildTagSystemPapers(
        subject,
        systems,
        questionBankSourceBySubject[subject],
        { includeHidden: true },
      );

      return systems.map((system, index) => {
        const paper = builtPapers[index];
        return {
          kind: "system",
          key: `system-${subject}-${system.id}`,
          subject,
          systemId: system.id,
          title: paper?.title || system.generatedPaper?.title?.trim() || system.label,
          description: paper?.description || system.generatedPaper?.description?.trim() || "",
          category: paper?.category || (system.systemMode === "textbook-practice" ? "practice" : "assessment"),
          published: system.published !== false,
          totalQuestions: paper?.configuredQuestionsCount ?? paper?.totalQuestions ?? 0,
          totalSections: paper?.configuredSectionsCount ?? 0,
          generationWarnings: paper?.generationWarnings ?? [],
        } satisfies SystemManagedPaper;
      });
    });

    return [...systemPapers, ...manualPapers];
  }, [
    manualPapersQuery.data,
    questionBankSourceBySubject,
    systemsBySubject,
  ]);

  const filteredBySubjectPapers = useMemo(() => {
    if (!subjectFilter) return managedPapers;
    return managedPapers.filter((paper) => paper.subject === subjectFilter);
  }, [managedPapers, subjectFilter]);

  const summary = useMemo(() => {
    return {
      total: managedPapers.length,
      published: managedPapers.filter((paper) => paper.published).length,
      unpublished: managedPapers.filter((paper) => !paper.published).length,
    };
  }, [managedPapers]);

  const subjectCounts = useMemo(() => {
    return {
      all: managedPapers.length,
      english: managedPapers.filter((paper) => paper.subject === "english").length,
      math: managedPapers.filter((paper) => paper.subject === "math").length,
      vocabulary: managedPapers.filter((paper) => paper.subject === "vocabulary").length,
    };
  }, [managedPapers]);

  const filteredSubjectSummary = useMemo(() => {
    return {
      published: filteredBySubjectPapers.filter((paper) => paper.published).length,
      unpublished: filteredBySubjectPapers.filter((paper) => !paper.published).length,
    };
  }, [filteredBySubjectPapers]);

  const filteredManagedPapers = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    if (!normalizedKeyword) return filteredBySubjectPapers;

    return filteredBySubjectPapers.filter((paper) => {
      const subjectLabel = PAPER_SUBJECT_LABELS[paper.subject].toLowerCase();
      const categoryLabel = PAPER_CATEGORY_LABELS[paper.category].toLowerCase();
      const primaryId = paper.kind === "manual" ? paper.paperId : paper.systemId;

      return (
        paper.title.toLowerCase().includes(normalizedKeyword)
        || paper.description.toLowerCase().includes(normalizedKeyword)
        || primaryId.toLowerCase().includes(normalizedKeyword)
        || subjectLabel.includes(normalizedKeyword)
        || categoryLabel.includes(normalizedKeyword)
      );
    });
  }, [filteredBySubjectPapers, keyword]);

  const isLoading = manualPapersQuery.isLoading
    || questionBankPapersQuery.isLoading
    || englishSystemsQuery.isLoading
    || mathSystemsQuery.isLoading
    || vocabularySystemsQuery.isLoading;

  const persistSystems = async (
    subject: PaperSubject,
    nextSystems: EnglishExamTagSystem[] | SubjectTagSystem[],
  ) => {
    if (subject === "english") {
      await saveEnglishSystemsMutation.mutateAsync({
        systems: nextSystems as EnglishExamTagSystem[],
      });
      await utils.papers.getEnglishTagSystems.invalidate();
      return;
    }

    if (subject === "math") {
      await saveMathSystemsMutation.mutateAsync({
        systems: nextSystems as SubjectTagSystem[],
      });
      await utils.papers.getMathTagSystems.invalidate();
      return;
    }

    await saveVocabularySystemsMutation.mutateAsync({
      systems: nextSystems as SubjectTagSystem[],
    });
    await utils.papers.getVocabularyTagSystems.invalidate();
  };

  const handleTogglePublished = async (paper: ManagedPaper, nextPublished: boolean) => {
    try {
      setPendingPaperKey(paper.key);

      if (paper.kind === "manual") {
        await publishMutation.mutateAsync({ id: paper.manualId, published: nextPublished });
      } else {
        const systems = systemsBySubject[paper.subject];
        const nextSystems = systems.map((system) => (
          system.id === paper.systemId ? { ...system, published: nextPublished } : system
        ));
        await persistSystems(paper.subject, nextSystems);
      }

      toast.success(`${paper.title} ${nextPublished ? "is now visible to students." : "is now hidden from students."}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update visibility.");
    } finally {
      setPendingPaperKey(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      setPendingPaperKey(deleteTarget.key);

      if (deleteTarget.kind === "manual") {
        await deleteMutation.mutateAsync({ id: deleteTarget.manualId });
      } else {
        const systems = systemsBySubject[deleteTarget.subject];
        const nextSystems = systems.filter((system) => system.id !== deleteTarget.systemId);
        await persistSystems(deleteTarget.subject, nextSystems);
      }

      toast.success(`${deleteTarget.title} deleted.`);
      setDeleteTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete paper.");
    } finally {
      setPendingPaperKey(null);
    }
  };

  const handleDuplicate = async (paper: ManualManagedPaper) => {
    try {
      setPendingPaperKey(paper.key);
      await duplicateMutation.mutateAsync({ id: paper.manualId });
      toast.success(`${paper.title} duplicated as a draft copy.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to duplicate paper.");
    } finally {
      setPendingPaperKey(null);
    }
  };

  if (!canManagePapers) {
    return (
      <TeacherToolsLayout activeTool="paper-manager" currentSubject={subjectFilter}>
        <div className="min-h-screen bg-[#F6F8FB] px-4 py-10 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700">
              <ArrowLeft className="h-4 w-4" />
              Back to Assessments
            </Link>

            <Card className="mt-6 border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle>Paper Manager</CardTitle>
                <CardDescription>This page is available to admins only.</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-600">
                  Your current account does not have permission to manage student-facing papers.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </TeacherToolsLayout>
    );
  }

  return (
    <TeacherToolsLayout activeTool="paper-manager" currentSubject={subjectFilter}>
      <div className="min-h-screen bg-[#F6F8FB] px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <div>
            <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700">
              <ArrowLeft className="h-4 w-4" />
              Back to Assessments
            </Link>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#1E3A5F]">
              Paper Manager
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-500">
              Manage the papers students can actually see. Question-bank containers are handled separately in Question Bank.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription>Total Student Papers</CardDescription>
                <CardTitle className="text-2xl">{summary.total}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription>{PAPER_SUBJECT_LABELS.english} Papers</CardDescription>
                <CardTitle className="text-2xl text-[#1E3A5F]">{subjectCounts.english}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription>{PAPER_SUBJECT_LABELS.math} Papers</CardDescription>
                <CardTitle className="text-2xl text-emerald-700">{subjectCounts.math}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription>{PAPER_SUBJECT_LABELS.vocabulary} Papers</CardDescription>
                <CardTitle className="text-2xl text-amber-700">{subjectCounts.vocabulary}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="Search papers, IDs, or descriptions"
                className="rounded-2xl border-slate-200 pl-9"
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {([
                { key: "all", label: "All Subjects", count: subjectCounts.all },
                ...PAPER_SUBJECT_ORDER.map((subject) => ({
                  key: subject,
                  label: PAPER_SUBJECT_LABELS[subject],
                  count: subjectCounts[subject],
                })),
              ] as Array<{ key: "all" | PaperSubject; label: string; count: number }>).map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => navigate(option.key === "all" ? "/paper-manager" : `/paper-manager?subject=${option.key}`)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                    (subjectFilter ?? "all") === option.key
                      ? "bg-[#1E3A5F] text-white shadow-sm"
                      : "border border-slate-200 bg-white text-slate-600 hover:border-[#1E3A5F]/20 hover:text-[#1E3A5F]"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-400">
              {filteredManagedPapers.length} paper{filteredManagedPapers.length === 1 ? "" : "s"}
            </p>
          </div>
          {isLoading ? (
                <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-sm text-slate-500">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading student papers...
                </div>
              ) : filteredManagedPapers.length > 0 ? (
                filteredManagedPapers.map((paper) => {
                  const isPending = pendingPaperKey === paper.key;
                  const subjectLabel = PAPER_SUBJECT_LABELS[paper.subject];
                  const categoryLabel = PAPER_CATEGORY_LABELS[paper.category];

                  return (
                    <div key={paper.key} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
                      <div className="flex items-start gap-6">
                        <div className="min-w-0 flex-1 space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="font-[family-name:var(--font-body)] text-lg font-extrabold tracking-normal text-[#1E3A5F]">{paper.title}</h2>
                            <Badge variant={paper.published ? "default" : "outline"}>
                              {paper.published ? "Published" : "Hidden"}
                            </Badge>
                            <Badge variant="secondary">{subjectLabel}</Badge>
                            <Badge variant="outline">{categoryLabel}</Badge>
                            {paper.kind === "system" && <Badge variant="outline">Paper Generator</Badge>}
                          </div>
                          <p className="text-sm text-slate-500">{paper.description || "No description."}</p>
                          <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                            {paper.kind === "manual" ? (
                              <>
                                <span>Paper ID: {paper.paperId}</span>
                                <span>{paper.totalQuestions} questions</span>
                                <span>Created {formatDate(paper.createdAt)}</span>
                                <span>Updated {formatDate(paper.updatedAt)}</span>
                                {paper.hasListening && (
                                  <span className="inline-flex items-center gap-1">
                                    <Headphones className="h-3.5 w-3.5" />
                                    Listening
                                  </span>
                                )}
                                {paper.hasWriting && (
                                  <span className="inline-flex items-center gap-1">
                                    <FileText className="h-3.5 w-3.5" />
                                    Writing
                                  </span>
                                )}
                              </>
                            ) : (
                              <>
                                <div className="w-full space-y-2">
                                  <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
                                    <span>Paper ID: {paper.systemId}</span>
                                    <span>{paper.totalSections} configured parts</span>
                                    <span>{paper.totalQuestions} configured questions</span>
                                  </div>
                                  {paper.generationWarnings.length > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => setExpandedWarningKey((current) => current === paper.key ? null : paper.key)}
                                      className="inline-flex items-center gap-1.5 text-amber-600 transition hover:text-amber-700"
                                    >
                                      <AlertTriangle className="h-3.5 w-3.5" />
                                      <span>
                                        {paper.generationWarnings.length} generation warning{paper.generationWarnings.length === 1 ? "" : "s"}
                                      </span>
                                      <ChevronDown
                                        className={`h-3.5 w-3.5 transition ${expandedWarningKey === paper.key ? "rotate-180" : ""}`}
                                      />
                                    </button>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                          {paper.kind === "system" && paper.generationWarnings.length > 0 && expandedWarningKey === paper.key ? (
                            <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
                              <div className="flex items-start gap-3">
                                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-semibold text-amber-900">组卷提醒</p>
                                  <p className="mt-1 text-xs leading-5 text-amber-700">
                                    这份自动组卷试卷目前有 {paper.generationWarnings.length} 条规则没有完全满足。
                                  </p>
                                  <div className="mt-3 space-y-2">
                                    {paper.generationWarnings.map((warning, index) => (
                                      <div
                                        key={`${paper.key}-warning-${index}`}
                                        className="rounded-xl border border-amber-200/80 bg-white/85 px-3 py-2"
                                      >
                                        <p className="text-sm leading-6 text-amber-950">{localizeGenerationWarning(warning)}</p>
                                        <p className="mt-1 break-words text-xs leading-5 text-amber-700/80">{warning}</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : null}
                        </div>

                        <div className="shrink-0 flex flex-wrap items-center justify-end gap-4 self-start">
                          {paper.kind === "manual" ? (
                            <>
                              <Link href={`/paper-intake?edit=${encodeURIComponent(paper.paperId)}&subject=${paper.subject}`}>
                                <Button type="button" variant="outline" disabled={isPending} className="border-slate-200">
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Edit
                                </Button>
                              </Link>

                              <Button
                                type="button"
                                variant="outline"
                                disabled={isPending}
                                onClick={() => handleDuplicate(paper)}
                                className="border-slate-200"
                              >
                                {isPending && duplicateMutation.isPending ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <Copy className="mr-2 h-4 w-4" />
                                )}
                                Duplicate
                              </Button>
                            </>
                          ) : (
                            <Link href={`/tag-manager?subject=${paper.subject}`}>
                              <Button type="button" variant="outline" disabled={isPending} className="border-slate-200">
                                <Settings2 className="mr-2 h-4 w-4" />
                                Edit Generator
                              </Button>
                            </Link>
                          )}

                          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2">
                            {paper.published ? (
                              <Eye className="h-4 w-4 text-emerald-600" />
                            ) : (
                              <EyeOff className="h-4 w-4 text-amber-600" />
                            )}
                            <span className="text-sm text-slate-600">Visible to students</span>
                            <Switch
                              checked={paper.published}
                              disabled={isPending}
                              onCheckedChange={(checked) => handleTogglePublished(paper, checked)}
                            />
                          </div>

                          <Button
                            type="button"
                            variant="outline"
                            className="border-red-200 bg-white text-red-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700"
                            disabled={isPending}
                            onClick={() => setDeleteTarget(
                              paper.kind === "manual"
                                ? {
                                    kind: "manual",
                                    key: paper.key,
                                    title: paper.title,
                                    manualId: paper.manualId,
                                  }
                                : {
                                    kind: "system",
                                    key: paper.key,
                                    title: paper.title,
                                    subject: paper.subject,
                                    systemId: paper.systemId,
                                  },
                            )}
                          >
                            {isPending && deleteTarget?.key === paper.key ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="mr-2 h-4 w-4" />
                            )}
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })
          ) : (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                  {keyword.trim()
                    ? "No papers match this search."
                    : (subjectFilter
                      ? `No ${PAPER_SUBJECT_LABELS[subjectFilter]} student-facing papers yet. Add one from Paper Generator or Question Intake first.`
                      : "No student-facing papers yet. Add one from Paper Generator or Question Intake first.")}
                </div>
          )}
        </div>

        <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this paper?</AlertDialogTitle>
              <AlertDialogDescription>
                {deleteTarget
                  ? `This will permanently delete "${deleteTarget.title}". Students will no longer be able to access it, and this action cannot be undone.`
                  : "This action cannot be undone."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={Boolean(pendingPaperKey)}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={Boolean(pendingPaperKey)}
                className="bg-red-600 hover:bg-red-700"
              >
                {pendingPaperKey ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TeacherToolsLayout>
  );
}
