import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { ArrowLeft, FileSearch, Loader2, Search } from "lucide-react";
import TeacherToolsLayout from "@/components/TeacherToolsLayout";
import AssessmentReportPanel from "@/components/AssessmentReportPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocalAuth } from "@/hooks/useLocalAuth";
import { trpc } from "@/lib/trpc";

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

  useEffect(() => {
    if (!listQuery.data || listQuery.data.length === 0 || selectedId !== null) return;
    navigate(`/test-history?id=${listQuery.data[0].id}`);
  }, [listQuery.data, navigate, selectedId]);

  const filteredHistory = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    if (!normalizedKeyword) return listQuery.data ?? [];

    return (listQuery.data ?? []).filter((item) => {
      return (
        item.studentName.toLowerCase().includes(normalizedKeyword)
        || item.paperTitle.toLowerCase().includes(normalizedKeyword)
        || String(item.id).includes(normalizedKeyword)
      );
    });
  }, [keyword, listQuery.data]);

  return (
    <TeacherToolsLayout activeTool="test-history">
      <div className="min-h-screen bg-[#F6F8FB] px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1500px] space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700">
                <ArrowLeft className="h-4 w-4" />
                Back to teacher home
              </Link>
              <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#1E3A5F]">Test History</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-500">
                Open any saved assessment to review section scores, question-level performance, AI analysis, and download the PDF report again.
              </p>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
            <aside className="space-y-4">
              <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2 text-slate-900">
                  <FileSearch className="h-5 w-5 text-blue-600" />
                  <h2 className="text-lg font-semibold">Saved Assessments</h2>
                </div>
                <div className="relative mt-4">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={keyword}
                    onChange={(event) => setKeyword(event.target.value)}
                    placeholder="Search by student or paper"
                    className="rounded-2xl border-slate-200 pl-9"
                  />
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
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => navigate(`/test-history?id=${item.id}`)}
                        className={`w-full rounded-[28px] border px-5 py-4 text-left shadow-sm transition ${
                          active
                            ? "border-blue-200 bg-blue-50 shadow-blue-100/80"
                            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-base font-semibold text-slate-900">{item.studentName}</p>
                            <p className="mt-1 truncate text-sm text-slate-500">{item.paperTitle}</p>
                          </div>
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                            #{item.id}
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span>{formatDate(item.createdAt)}</span>
                          <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-500">
                            {item.hasReport ? "AI Report" : "Raw Score"}
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </aside>

            <section className="min-w-0">
              {selectedId === null ? (
                <div className="rounded-[32px] border border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500 shadow-sm">
                  Pick a saved assessment to view the full report.
                </div>
              ) : detailQuery.isLoading ? (
                <div className="rounded-[32px] border border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500 shadow-sm">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-400" />
                  <p className="mt-3">Loading assessment record...</p>
                </div>
              ) : detailQuery.error ? (
                <div className="rounded-[32px] border border-rose-200 bg-rose-50 px-6 py-8 text-sm text-rose-900 shadow-sm">
                  <p className="font-semibold">Unable to load this assessment record.</p>
                  <p className="mt-2 break-words text-rose-800">
                    {detailQuery.error.message || "Unknown detail query error."}
                  </p>
                </div>
              ) : detailQuery.data ? (
                <AssessmentReportPanel
                  record={detailQuery.data}
                  showDownload
                  extraHeaderActions={(
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => navigate("/test-history")}
                      className="rounded-full border-white/20 bg-white/10 text-white hover:bg-white/15"
                    >
                      Back to List
                    </Button>
                  )}
                />
              ) : (
                <div className="rounded-[32px] border border-amber-200 bg-amber-50 px-6 py-8 text-sm text-amber-900 shadow-sm">
                  This assessment record is not available anymore.
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </TeacherToolsLayout>
  );
}
