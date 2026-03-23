import { useMemo, useState } from "react";
import { Link, useSearch } from "wouter";
import {
  ArrowLeft,
  Copy,
  Eye,
  EyeOff,
  FileText,
  Headphones,
  Layers3,
  Loader2,
  Pencil,
  Settings2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import TeacherToolsLayout from "@/components/TeacherToolsLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  const utils = trpc.useUtils();
  const { isTeacher } = useLocalAuth();
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [pendingPaperKey, setPendingPaperKey] = useState<string | null>(null);

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

    const combined = [...systemPapers, ...manualPapers];
    if (!subjectFilter) return combined;
    return combined.filter((paper) => paper.subject === subjectFilter);
  }, [
    manualPapersQuery.data,
    questionBankSourceBySubject,
    subjectFilter,
    systemsBySubject,
  ]);

  const summary = useMemo(() => {
    return {
      total: managedPapers.length,
      published: managedPapers.filter((paper) => paper.published).length,
      unpublished: managedPapers.filter((paper) => !paper.published).length,
    };
  }, [managedPapers]);

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
              {subjectFilter ? `${PAPER_SUBJECT_LABELS[subjectFilter]} Paper Manager` : "Paper Manager"}
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-500">
              Manage the papers students can actually see. Question-bank containers are handled separately in Question Bank.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription>Total Student Papers</CardDescription>
                <CardTitle className="text-2xl">{summary.total}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription>Visible to Students</CardDescription>
                <CardTitle className="text-2xl text-emerald-700">{summary.published}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription>Hidden</CardDescription>
                <CardTitle className="text-2xl text-amber-700">{summary.unpublished}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle>Student Papers</CardTitle>
              <CardDescription>
                Toggle visibility, delete obsolete papers, or jump into Paper Generator / Question Intake to edit content.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading ? (
                <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-sm text-slate-500">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading student papers...
                </div>
              ) : managedPapers.length > 0 ? (
                managedPapers.map((paper) => {
                  const isPending = pendingPaperKey === paper.key;
                  const subjectLabel = PAPER_SUBJECT_LABELS[paper.subject];
                  const categoryLabel = PAPER_CATEGORY_LABELS[paper.category];

                  return (
                    <div key={paper.key} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-lg font-semibold text-slate-800">{paper.title}</h2>
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
                                <span>System ID: {paper.systemId}</span>
                                <span>{paper.totalSections} configured parts</span>
                                <span>{paper.totalQuestions} configured questions</span>
                                {paper.generationWarnings.length > 0 && (
                                  <span className="text-amber-600">
                                    {paper.generationWarnings.length} generation warning{paper.generationWarnings.length > 1 ? "s" : ""}
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-4">
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
                            variant="destructive"
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
                  {subjectFilter
                    ? `No ${PAPER_SUBJECT_LABELS[subjectFilter]} student-facing papers yet. Add one from Paper Generator or Question Intake first.`
                    : "No student-facing papers yet. Add one from Paper Generator or Question Intake first."}
                </div>
              )}
            </CardContent>
          </Card>
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
