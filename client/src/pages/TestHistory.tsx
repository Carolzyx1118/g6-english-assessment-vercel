import { useMemo, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { ArrowLeft, ChevronDown, Loader2, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import TeacherToolsLayout from "@/components/TeacherToolsLayout";
import AssessmentReportPanel from "@/components/AssessmentReportPanel";
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
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PAPER_SUBJECT_LABELS, type PaperSubject } from "@/data/papers";
import { useLocalAuth } from "@/hooks/useLocalAuth";
import { trpc } from "@/lib/trpc";

type HistorySubjectFilter = "all" | PaperSubject;
type DeleteTarget = {
  id: number;
  studentName: string;
  paperTitle: string;
};

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

export default function TestHistory() {
  const search = useSearch();
  const [, navigate] = useLocation();
  const { isTeacher } = useLocalAuth();
  const [keyword, setKeyword] = useState("");
  const [subjectFilter, setSubjectFilter] = useState<HistorySubjectFilter>("all");
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const utils = trpc.useUtils();

  const selectedId = useMemo(() => {
    const value = new URLSearchParams(search).get("id");
    const parsed = value ? Number(value) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [search]);

  const listQuery = trpc.results.list.useQuery(undefined, {
    enabled: isTeacher,
    staleTime: 5_000,
  });

  const detailQuery = trpc.results.getById.useQuery(
    { id: selectedId || 0 },
    {
      enabled: isTeacher && selectedId !== null,
      staleTime: 5_000,
    },
  );

  const deleteMutation = trpc.results.delete.useMutation({
    onSuccess: async (_result, variables) => {
      await utils.results.list.invalidate();
      await utils.results.getById.invalidate();
      if (selectedId === variables.id) {
        navigate("/test-history");
      }
      setDeleteTarget(null);
      toast.success("Test history deleted.");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete test history.");
    },
  });

  const handleDelete = async () => {
    if (!deleteTarget) return;
    deleteMutation.mutate({ id: deleteTarget.id });
  };

  const subjectCounts = useMemo(() => {
    const items = listQuery.data ?? [];
    return {
      all: items.length,
      english: items.filter((item) => item.paperSubject === "english").length,
      math: items.filter((item) => item.paperSubject === "math").length,
      vocabulary: items.filter((item) => item.paperSubject === "vocabulary").length,
    };
  }, [listQuery.data]);

  const filteredHistory = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    const subjectFiltered = (listQuery.data ?? []).filter((item) => {
      if (subjectFilter === "all") return true;
      return item.paperSubject === subjectFilter;
    });

    if (!normalizedKeyword) return subjectFiltered;

    return subjectFiltered.filter((item) => {
      return (
        item.studentName.toLowerCase().includes(normalizedKeyword)
        || item.paperTitle.toLowerCase().includes(normalizedKeyword)
        || String(item.id).includes(normalizedKeyword)
      );
    });
  }, [keyword, listQuery.data, subjectFilter]);

  const historyStats = useMemo(() => {
    const items = listQuery.data ?? [];

    return {
      totalRecords: items.length,
      completedReports: items.filter((item) => item.reportStatus === "completed").length,
      pendingReports: items.filter((item) => item.reportStatus === "pending-review").length,
    };
  }, [listQuery.data]);

  return (
    <TeacherToolsLayout activeTool="test-history">
      <div className="pureon-container">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="pureon-page-head">
            <div>
              <div className="pureon-section-eyebrow">Teacher Tools · Test History</div>
              <h1 className="pureon-page-title mt-2">测试记录</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--pureon-muted)]">
                点击任一保存记录，可以直接在下方展开完整报告，不需要跳到另一张页面。
              </p>
            </div>
            <div className="pureon-page-head-actions">
              <Link
                href="/"
                className="inline-flex items-center gap-2 border border-[var(--pureon-teal)] px-4 py-2 text-sm text-[var(--pureon-teal)] transition-colors hover:bg-[var(--pureon-teal)] hover:text-[var(--pureon-paper)]"
              >
                <ArrowLeft className="h-4 w-4" />
                返回老师首页
              </Link>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-2">
                  <CardDescription>Total History Records</CardDescription>
                  <CardTitle className="text-2xl text-slate-900">{historyStats.totalRecords}</CardTitle>
                </CardHeader>
              </Card>
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-2">
                  <CardDescription>Completed Scoring Reports</CardDescription>
                  <CardTitle className="text-2xl text-[#1E3A5F]">{historyStats.completedReports}</CardTitle>
                </CardHeader>
              </Card>
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-2">
                  <CardDescription>Pending Teacher Review</CardDescription>
                  <CardTitle className="text-2xl text-emerald-700">{historyStats.pendingReports}</CardTitle>
                </CardHeader>
              </Card>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  placeholder="Search by student or paper"
                  className="rounded-2xl border-slate-200 pl-9"
                />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {([
                  { key: "all", label: "All Subjects", count: subjectCounts.all },
                  { key: "english", label: PAPER_SUBJECT_LABELS.english, count: subjectCounts.english },
                  { key: "math", label: PAPER_SUBJECT_LABELS.math, count: subjectCounts.math },
                  { key: "vocabulary", label: PAPER_SUBJECT_LABELS.vocabulary, count: subjectCounts.vocabulary },
                ] as Array<{ key: HistorySubjectFilter; label: string; count: number }>).map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setSubjectFilter(option.key)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                      subjectFilter === option.key
                        ? "bg-[#1E3A5F] text-white shadow-sm"
                        : "border border-slate-200 bg-white text-slate-600 hover:border-[#1E3A5F]/20 hover:text-[#1E3A5F]"
                    }`}
                  >
                    {option.label}
                    <span className="ml-2 text-xs opacity-70">{option.count}</span>
                  </button>
                ))}
              </div>
              <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-400">
                {filteredHistory.length} record{filteredHistory.length === 1 ? "" : "s"}
              </p>
            </div>

            <div className="space-y-3">
              {listQuery.isLoading ? (
                <div className="rounded-[28px] border border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-500 shadow-sm">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-400" />
                  <p className="mt-3">Loading test history...</p>
                </div>
              ) : listQuery.error ? (
                <div className="rounded-[28px] border border-rose-200 bg-rose-50 px-5 py-8 text-center text-sm text-rose-900 shadow-sm">
                  <p className="font-semibold">Unable to load test history.</p>
                  <p className="mt-2 break-words text-rose-800">
                    {listQuery.error.message || "Unknown list query error."}
                  </p>
                </div>
              ) : filteredHistory.length === 0 ? (
                <div className="rounded-[28px] border border-dashed border-slate-300 bg-white px-5 py-8 text-center text-sm text-slate-500 shadow-sm">
                  No saved assessments found.
                </div>
              ) : (
                filteredHistory.map((item) => {
                  const active = item.id === selectedId;
                  const deleting = deleteMutation.variables?.id === item.id && deleteMutation.isPending;
                  return (
                    <div key={item.id} className="space-y-3">
                      {(() => {
                        const statusMeta = item.reportStatus === "completed"
                          ? {
                              label: "Completed Scoring Report",
                              className: "bg-emerald-50 text-emerald-700",
                            }
                          : item.reportStatus === "pending-review"
                            ? {
                                label: "Pending Teacher Review",
                                className: "bg-amber-50 text-amber-700",
                              }
                            : {
                                label: "Raw Record",
                                className: "bg-slate-100 text-slate-500",
                              };

                        return (
                      <div
                        className={`w-full rounded-[28px] border px-5 py-4 text-left shadow-sm transition ${
                          active
                            ? "border-blue-200 bg-white shadow-sm"
                            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <button
                            type="button"
                            onClick={() => navigate(active ? "/test-history" : `/test-history?id=${item.id}`)}
                            className="min-w-0 flex-1 text-left"
                          >
                            <p className="truncate text-lg font-bold tracking-tight text-[#1E3A5F]">{item.studentName}</p>
                            <p className="mt-1 truncate text-sm text-slate-500">{item.paperTitle}</p>
                          </button>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => navigate(active ? "/test-history" : `/test-history?id=${item.id}`)}
                              className="inline-flex h-9 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-slate-700"
                            >
                              <span>{active ? "Hide" : "View"}</span>
                              <ChevronDown
                                className={`h-4 w-4 transition ${active ? "rotate-180" : ""}`}
                              />
                            </button>
                            <Button
                              type="button"
                              variant="softDestructive"
                              disabled={deleting}
                              onClick={() => {
                                setDeleteTarget({
                                  id: item.id,
                                  studentName: item.studentName,
                                  paperTitle: item.paperTitle,
                                });
                              }}
                              className="px-3"
                            >
                              {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                              Delete
                            </Button>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => navigate(active ? "/test-history" : `/test-history?id=${item.id}`)}
                          className="mt-3 flex w-full flex-wrap items-center gap-2 text-left text-xs text-slate-500"
                        >
                          <span>{formatDate(item.createdAt)}</span>
                          <span className={`rounded-full px-3 py-1 font-semibold ${statusMeta.className}`}>
                            {statusMeta.label}
                          </span>
                        </button>
                      </div>
                        );
                      })()}

                      {active ? (
                        detailQuery.isLoading ? (
                          <div className="rounded-[28px] border border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500 shadow-sm">
                            <Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-400" />
                            <p className="mt-3">Loading assessment overview...</p>
                          </div>
                        ) : detailQuery.error ? (
                          <div className="rounded-[28px] border border-rose-200 bg-rose-50 px-6 py-8 text-sm text-rose-900 shadow-sm">
                            <p className="font-semibold">Unable to load this assessment record.</p>
                            <p className="mt-2 break-words text-rose-800">
                              {detailQuery.error.message || "Unknown detail query error."}
                            </p>
                          </div>
                        ) : detailQuery.data?.id === item.id ? (
                          <AssessmentReportPanel
                            record={detailQuery.data}
                            showDownload
                            allowSpeakingManualScoring
                          />
                        ) : (
                          <div className="rounded-[28px] border border-amber-200 bg-amber-50 px-6 py-8 text-sm text-amber-900 shadow-sm">
                            This assessment record is not available anymore.
                          </div>
                        )
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && !deleteMutation.isPending && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this test history entry?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `This will permanently delete the saved record for "${deleteTarget.paperTitle}" (${deleteTarget.studentName}). This action cannot be undone.`
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
    </TeacherToolsLayout>
  );
}
