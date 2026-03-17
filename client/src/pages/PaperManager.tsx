import { useMemo, useState } from "react";
import { Link, useSearch } from "wouter";
import { ArrowLeft, Copy, Eye, EyeOff, FileText, Headphones, Loader2, Pencil, PencilRuler, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useLocalAuth } from "@/hooks/useLocalAuth";
import TeacherToolsLayout from "@/components/TeacherToolsLayout";
import { PAPER_CATEGORY_LABELS, PAPER_SUBJECT_LABELS, type PaperCategory, type PaperSubject } from "@/data/papers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

export default function PaperManager() {
  const search = useSearch();
  const utils = trpc.useUtils();
  const { isTeacher } = useLocalAuth();
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; title: string } | null>(null);
  const [pendingPaperId, setPendingPaperId] = useState<number | null>(null);
  const subjectFilter = useMemo(() => {
    const value = new URLSearchParams(search).get("subject");
    return value === "english" || value === "math" || value === "vocabulary"
      ? (value as PaperSubject)
      : null;
  }, [search]);

  const canManageManualPapers = isTeacher;
  const listQuery = trpc.papers.listAllManualPapers.useQuery(undefined, {
    enabled: canManageManualPapers,
    staleTime: 5_000,
  });

  const publishMutation = trpc.papers.setManualPaperPublished.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.papers.listAllManualPapers.invalidate(),
        utils.papers.listManualPapers.invalidate(),
      ]);
    },
  });

  const deleteMutation = trpc.papers.deleteManualPaper.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.papers.listAllManualPapers.invalidate(),
        utils.papers.listManualPapers.invalidate(),
      ]);
    },
  });

  const duplicateMutation = trpc.papers.duplicateManualPaper.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.papers.listAllManualPapers.invalidate(),
        utils.papers.listManualPapers.invalidate(),
      ]);
    },
  });

  const filteredPapers = useMemo(() => {
    const papers = listQuery.data ?? [];
    if (!subjectFilter) return papers;
    return papers.filter((paper) => paper.subject === subjectFilter);
  }, [listQuery.data, subjectFilter]);

  const summary = useMemo(() => {
    const papers = filteredPapers;
    return {
      total: papers.length,
      published: papers.filter((paper) => paper.published).length,
      unpublished: papers.filter((paper) => !paper.published).length,
    };
  }, [filteredPapers]);

  const handleTogglePublished = async (id: number, title: string, nextPublished: boolean) => {
    try {
      setPendingPaperId(id);
      await publishMutation.mutateAsync({ id, published: nextPublished });
      toast.success(`${title} ${nextPublished ? "published" : "unpublished"}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update paper status.");
    } finally {
      setPendingPaperId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      setPendingPaperId(deleteTarget.id);
      await deleteMutation.mutateAsync({ id: deleteTarget.id });
      toast.success(`${deleteTarget.title} deleted.`);
      setDeleteTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete paper.");
    } finally {
      setPendingPaperId(null);
    }
  };

  const handleDuplicate = async (id: number, title: string) => {
    try {
      setPendingPaperId(id);
      await duplicateMutation.mutateAsync({ id });
      toast.success(`${title} duplicated as a draft copy.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to duplicate paper.");
    } finally {
      setPendingPaperId(null);
    }
  };

  if (!canManageManualPapers) {
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
                  Your current account does not have permission to manage manual papers.
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
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700">
              <ArrowLeft className="h-4 w-4" />
              Back to Assessments
            </Link>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#1E3A5F]">
              {subjectFilter ? `${PAPER_SUBJECT_LABELS[subjectFilter]} Paper Manager` : "Paper Manager"}
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-500">
              {subjectFilter
                ? `Manage manually created ${PAPER_SUBJECT_LABELS[subjectFilter]} papers. You can unpublish a paper to hide it from students, or delete it permanently.`
                : "Manage manually created papers. You can unpublish a paper to hide it from students, or delete it permanently."}
            </p>
          </div>

          <div className="flex gap-3">
            <Link href={`/paper-intake?subject=${subjectFilter || "english"}`}>
              <Button variant="outline" className="border-slate-200">
                <PencilRuler className="mr-2 h-4 w-4" />
                New Paper
              </Button>
            </Link>
            {(subjectFilter === "english" || subjectFilter === null) && (
              <Link href="/paper-composer?subject=english">
                <Button variant="outline" className="border-slate-200">
                  <Pencil className="mr-2 h-4 w-4" />
                  Add Generated Paper
                </Button>
              </Link>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription>Total Manual Papers</CardDescription>
              <CardTitle className="text-2xl">{summary.total}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription>Published</CardDescription>
              <CardTitle className="text-2xl text-emerald-700">{summary.published}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription>Drafts</CardDescription>
              <CardTitle className="text-2xl text-amber-700">{summary.unpublished}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>Manual Papers</CardTitle>
            <CardDescription>
              Published papers appear on the student assessment selection page. Drafts stay in storage but remain hidden until you publish them.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {listQuery.isLoading ? (
              <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-sm text-slate-500">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading manual papers...
              </div>
            ) : filteredPapers.length > 0 ? (
              filteredPapers.map((paper) => {
                const isPending = pendingPaperId === paper.id;
                const subjectLabel = PAPER_SUBJECT_LABELS[(paper.subject as PaperSubject) || "english"] || paper.subject;
                const categoryLabel = PAPER_CATEGORY_LABELS[(paper.category as PaperCategory) || "assessment"] || paper.category;

                return (
                  <div
                    key={paper.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-lg font-semibold text-slate-800">{paper.title}</h2>
                          <Badge variant={paper.published ? "default" : "outline"}>
                            {paper.published ? "Published" : "Draft"}
                          </Badge>
                          <Badge variant="secondary">{subjectLabel}</Badge>
                          <Badge variant="outline">{categoryLabel}</Badge>
                        </div>
                        <p className="text-sm text-slate-500">{paper.description || "No description."}</p>
                        <div className="flex flex-wrap gap-4 text-xs text-slate-500">
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
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-4">
                        <Link
                          href={
                            paper.buildMode === "generated"
                              ? `/paper-composer?edit=${encodeURIComponent(paper.paperId)}&subject=${paper.subject}`
                              : `/paper-intake?edit=${encodeURIComponent(paper.paperId)}&subject=${paper.subject}`
                          }
                        >
                          <Button
                            type="button"
                            variant="outline"
                            disabled={isPending}
                            className="border-slate-200"
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </Button>
                        </Link>

                        <Button
                          type="button"
                          variant="outline"
                          disabled={isPending}
                          onClick={() => handleDuplicate(paper.id, paper.title)}
                          className="border-slate-200"
                        >
                          {isPending && duplicateMutation.isPending ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Copy className="mr-2 h-4 w-4" />
                          )}
                          Duplicate
                        </Button>

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
                            onCheckedChange={(checked) => handleTogglePublished(paper.id, paper.title, checked)}
                          />
                        </div>

                        <Button
                          type="button"
                          variant="destructive"
                          disabled={isPending}
                          onClick={() => setDeleteTarget({ id: paper.id, title: paper.title })}
                        >
                          {isPending && deleteTarget?.id === paper.id ? (
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
                  ? `No ${PAPER_SUBJECT_LABELS[subjectFilter]} papers yet. Create one from the Paper Builder first.`
                  : "No manual papers yet. Create one from the Paper Builder first."}
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
              <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="bg-red-600 hover:bg-red-700"
              >
                {deleteMutation.isPending ? (
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
