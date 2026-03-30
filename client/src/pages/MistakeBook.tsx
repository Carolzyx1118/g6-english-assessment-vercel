import { useEffect, useMemo, useState } from "react";
import { BookOpen, CheckCircle2, Home, Loader2, LogOut, Search, Sparkles, User } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuiz } from "@/contexts/QuizContext";
import { PAPER_SUBJECT_LABELS, PAPER_SUBJECT_ORDER, type PaperSubject } from "@/data/papers";
import { useLocalAuth } from "@/hooks/useLocalAuth";
import { buildMistakeNotebook } from "@/lib/mistakeNotebook";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

const PUREON_LOGO = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663325188422/bJDnAegOAPWmMppj.png";
const MASTERED_STORAGE_PREFIX = "student_mistake_book_mastered_v1";

type ReviewStatusFilter = "all" | "reviewing" | "mastered";

const REVIEW_STATUS_OPTIONS: Array<{ key: ReviewStatusFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "reviewing", label: "Reviewing" },
  { key: "mastered", label: "Mastered" },
];

function getMasteredStorageKey(username: string) {
  return `${MASTERED_STORAGE_PREFIX}:${username}`;
}

function readMasteredKeys(username: string | undefined) {
  if (!username || typeof window === "undefined") {
    return {} as Record<string, true>;
  }

  try {
    const raw = window.localStorage.getItem(getMasteredStorageKey(username));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(([, value]) => value === true),
    ) as Record<string, true>;
  } catch {
    return {};
  }
}

function writeMasteredKeys(username: string | undefined, value: Record<string, true>) {
  if (!username || typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(getMasteredStorageKey(username), JSON.stringify(value));
  } catch {
    // ignore storage failures
  }
}

function formatLatestSeenAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Recently";
  }

  return new Intl.DateTimeFormat("en-SG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function MistakeBookTopBar() {
  const [, navigate] = useLocation();
  const { user, logout } = useLocalAuth();

  return (
    <div className="border-b border-slate-200/70 bg-white/92 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-2.5 sm:px-6 lg:min-h-[76px] lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm">
            <img src={PUREON_LOGO} alt="璞源教育" className="h-6.5 w-6.5 object-contain" />
          </div>
          <div className="min-w-0 space-y-1">
            <div className="text-base font-bold leading-none text-[#1E3A5F]">璞源教育</div>
            <div className="text-[10px] uppercase leading-none tracking-[0.24em] text-slate-400">PUREON EDUCATION</div>
          </div>
        </div>
        <div className="flex items-center gap-3 self-start lg:self-auto">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm text-slate-500 transition-colors hover:border-slate-300 hover:text-[#1E3A5F]"
          >
            <Home className="h-4 w-4" />
            <span>Assessments</span>
          </button>
          {user ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm text-slate-500">
              <div className="flex h-4 w-4 items-center justify-center text-[#D4A84B]">
                <User className="h-4 w-4" />
              </div>
              <span className="font-medium text-[#1E3A5F]">{user.displayName || user.username}</span>
            </div>
          ) : null}
          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm text-slate-500 transition-colors hover:border-slate-300 hover:text-[#1E3A5F]"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign out</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MistakeBook() {
  const [, navigate] = useLocation();
  const { isTeacher, loading: authLoading, user } = useLocalAuth();
  const { papers, resetQuiz, selectPaper } = useQuiz();
  const resultsQuery = trpc.results.listMine.useQuery(undefined, {
    enabled: !authLoading && !isTeacher,
    refetchOnWindowFocus: false,
  });
  const [searchText, setSearchText] = useState("");
  const [selectedSubject, setSelectedSubject] = useState<PaperSubject | "all">("all");
  const [statusFilter, setStatusFilter] = useState<ReviewStatusFilter>("reviewing");
  const [masteredKeys, setMasteredKeys] = useState<Record<string, true>>({});
  const [hasLoadedMasteredKeys, setHasLoadedMasteredKeys] = useState(false);

  useEffect(() => {
    setMasteredKeys(readMasteredKeys(user?.username));
    setHasLoadedMasteredKeys(true);
  }, [user?.username]);

  useEffect(() => {
    if (!hasLoadedMasteredKeys) {
      return;
    }
    writeMasteredKeys(user?.username, masteredKeys);
  }, [hasLoadedMasteredKeys, masteredKeys, user?.username]);

  const notebookItems = useMemo(
    () => buildMistakeNotebook(resultsQuery.data ?? []),
    [resultsQuery.data],
  );
  const availablePaperIds = useMemo(
    () => new Set(papers.map((paper) => paper.id)),
    [papers],
  );

  const counts = useMemo(() => {
    const reviewing = notebookItems.filter((item) => !masteredKeys[item.key]).length;
    const mastered = notebookItems.filter((item) => masteredKeys[item.key]).length;
    return {
      total: notebookItems.length,
      reviewing,
      mastered,
    };
  }, [masteredKeys, notebookItems]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = searchText.trim().toLowerCase();

    return notebookItems.filter((item) => {
      if (selectedSubject !== "all" && item.paperSubject !== selectedSubject) {
        return false;
      }

      const isMastered = Boolean(masteredKeys[item.key]);
      if (statusFilter === "reviewing" && isMastered) {
        return false;
      }
      if (statusFilter === "mastered" && !isMastered) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const haystacks = [
        item.paperTitle,
        item.sectionTitle,
        item.questionNum,
        item.questionText,
        item.userAnswer,
        item.correctAnswer,
      ];

      return haystacks.some((value) => value.toLowerCase().includes(normalizedQuery));
    });
  }, [masteredKeys, notebookItems, searchText, selectedSubject, statusFilter]);

  const handleToggleMastered = (key: string) => {
    setMasteredKeys((current) => {
      if (current[key]) {
        const next = { ...current };
        delete next[key];
        return next;
      }

      return {
        ...current,
        [key]: true,
      };
    });
  };

  const handleOpenPaper = (paperId: string) => {
    if (!availablePaperIds.has(paperId)) {
      return;
    }

    resetQuiz();
    selectPaper(paperId);
    navigate("/");
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#FAFBFD]">
        <MistakeBookTopBar />
        <div className="flex min-h-[calc(100vh-76px)] items-center justify-center">
          <div className="flex items-center gap-3 text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin text-[#1E3A5F]" />
            <span>Loading your mistake book...</span>
          </div>
        </div>
      </div>
    );
  }

  if (isTeacher) {
    return (
      <div className="min-h-screen bg-[#FAFBFD]">
        <MistakeBookTopBar />
        <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm">
            <h1 className="text-3xl font-bold tracking-tight text-[#1E3A5F]">Mistake Book is for student accounts</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-500">
              Teacher accounts already review full reports in Test History. Switch to a student account to open the wrong-question notebook.
            </p>
            <Button className="mt-6 rounded-full bg-[#1E3A5F] px-5" onClick={() => navigate("/")}>
              Back to Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFBFD]">
      <MistakeBookTopBar />

      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1E3A5F] via-[#2A4A6F] to-[#1E3A5F]" />
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage:
              "radial-gradient(circle at 25% 25%, white 1px, transparent 1px), radial-gradient(circle at 75% 75%, white 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-[#D4A84B]/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-64 w-64 rounded-full bg-[#D4A84B]/5 blur-3xl" />

        <div className="relative z-10 mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,0.95fr)] lg:items-center lg:px-8 lg:py-16">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#D4A84B]/25 bg-[#D4A84B]/15 px-3 py-1.5">
              <Sparkles className="h-3.5 w-3.5 text-[#D4A84B]" />
              <span className="text-xs font-medium text-[#D4A84B]">Student Review Space</span>
            </div>
            <h1 className="mt-6 text-[3rem] font-extrabold leading-[0.98] tracking-tight text-white sm:text-[3.45rem] lg:text-[4.05rem]">
              My Mistake
              <span className="block text-[#E8C876]">Book</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-[1.6] text-white/65">
              Every wrong answer you submit is saved here. Review the correct idea, mark questions you have mastered, and reopen the original paper whenever you want another try.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                label: "Collected Mistakes",
                value: counts.total,
                accent: "text-[#1E3A5F]",
                surface: "from-white to-[#F7F3E8]",
                border: "border-[#E8D39F]/60",
                icon: <BookOpen className="h-5 w-5" />,
              },
              {
                label: "Reviewing Now",
                value: counts.reviewing,
                accent: "text-emerald-700",
                surface: "from-white to-emerald-50",
                border: "border-emerald-200/80",
                icon: <Sparkles className="h-5 w-5" />,
              },
              {
                label: "Mastered",
                value: counts.mastered,
                accent: "text-sky-700",
                surface: "from-white to-sky-50",
                border: "border-sky-200/80",
                icon: <CheckCircle2 className="h-5 w-5" />,
              },
            ].map((card) => (
              <div
                key={card.label}
                className={cn(
                  "rounded-[26px] border bg-gradient-to-br p-5 shadow-sm",
                  card.surface,
                  card.border,
                )}
              >
                <div className={cn("inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white shadow-sm", card.accent)}>
                  {card.icon}
                </div>
                <div className="mt-5 text-sm font-semibold text-slate-500">{card.label}</div>
                <div className={cn("mt-2 text-4xl font-extrabold tracking-tight", card.accent)}>{card.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Search by paper, question, or answer"
                className="h-14 rounded-full border-slate-200 pl-12 text-base"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Subject</span>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedSubject("all")}
                  className={cn(
                    "rounded-full border px-4 py-2 text-sm font-semibold transition-colors",
                    selectedSubject === "all"
                      ? "border-[#1E3A5F] bg-[#1E3A5F] text-white"
                      : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-[#1E3A5F]",
                  )}
                >
                  All Subjects
                </button>
                {PAPER_SUBJECT_ORDER.map((subject) => (
                  <button
                    key={subject}
                    type="button"
                    onClick={() => setSelectedSubject(subject)}
                    className={cn(
                      "rounded-full border px-4 py-2 text-sm font-semibold transition-colors",
                      selectedSubject === subject
                        ? "border-[#1E3A5F] bg-[#1E3A5F] text-white"
                        : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-[#1E3A5F]",
                    )}
                  >
                    {PAPER_SUBJECT_LABELS[subject]}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Status</span>
              <div className="flex flex-wrap gap-3">
                {REVIEW_STATUS_OPTIONS.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setStatusFilter(option.key as ReviewStatusFilter)}
                    className={cn(
                      "rounded-full border px-4 py-2 text-sm font-semibold transition-colors",
                      statusFilter === option.key
                        ? "border-[#D4A84B]/60 bg-[#FFF8E7] text-[#A97C21]"
                        : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-[#1E3A5F]",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {resultsQuery.isLoading ? (
          <div className="flex min-h-[220px] items-center justify-center text-slate-500">
            <div className="flex items-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-[#1E3A5F]" />
              <span>Loading your mistake book...</span>
            </div>
          </div>
        ) : resultsQuery.error ? (
          <div className="mt-6 rounded-[28px] border border-rose-200 bg-rose-50 px-6 py-5 text-rose-700">
            Unable to load your mistake book right now. Please refresh and try again.
          </div>
        ) : notebookItems.length === 0 ? (
          <div className="mt-6 rounded-[30px] border border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-[#1E3A5F]/6 text-[#1E3A5F]">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h2 className="mt-5 text-2xl font-bold tracking-tight text-[#1E3A5F]">No collected mistakes yet</h2>
            <p className="mx-auto mt-3 max-w-2xl text-base leading-7 text-slate-500">
              Once you finish papers, any objective questions you get wrong will appear here automatically.
            </p>
            <Button className="mt-6 rounded-full bg-[#1E3A5F] px-5" onClick={() => navigate("/")}>
              Go to Assessments
            </Button>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="mt-6 rounded-[30px] border border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
            <h2 className="text-2xl font-bold tracking-tight text-[#1E3A5F]">No mistakes match this view</h2>
            <p className="mx-auto mt-3 max-w-2xl text-base leading-7 text-slate-500">
              Try another subject, switch the status filter, or search with fewer keywords.
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {filteredItems.map((item) => {
              const isMastered = Boolean(masteredKeys[item.key]);
              const paperAvailable = availablePaperIds.has(item.paperId);

              return (
                <div key={item.key} className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
                  <div className="flex flex-col gap-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          {item.paperSubject ? (
                            <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                              {PAPER_SUBJECT_LABELS[item.paperSubject]}
                            </span>
                          ) : null}
                          <span className="inline-flex items-center rounded-full bg-[#FFF8E7] px-3 py-1 text-xs font-semibold text-[#A97C21]">
                            Mistake x{item.mistakeCount}
                          </span>
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
                              isMastered
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-sky-50 text-sky-700",
                            )}
                          >
                            {isMastered ? "Mastered" : "Reviewing"}
                          </span>
                        </div>
                        <div className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
                          {item.paperTitle} · {item.sectionTitle}
                        </div>
                        <h2 className="mt-3 text-2xl font-bold tracking-tight text-[#1E3A5F]">
                          {item.questionNum} · {item.questionText}
                        </h2>
                      </div>
                      <div className="text-sm text-slate-500 lg:text-right">
                        <div className="font-semibold text-slate-700">Last seen</div>
                        <div className="mt-1">{formatLatestSeenAt(item.latestSeenAt)}</div>
                      </div>
                    </div>

                    {item.context ? (
                      <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Question Context</div>
                        <p className="mt-2 text-sm leading-7 text-slate-600">{item.context}</p>
                      </div>
                    ) : null}

                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-5 py-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-500">Your Answer</div>
                        <p className="mt-2 text-base font-semibold leading-7 text-rose-700">{item.userAnswer}</p>
                      </div>
                      <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-5 py-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600">Correct Answer</div>
                        <p className="mt-2 text-base font-semibold leading-7 text-emerald-700">{item.correctAnswer}</p>
                      </div>
                    </div>

                    {item.explanationEn || item.tipEn ? (
                      <div className="rounded-[24px] border border-amber-200 bg-[#FFF8E7] px-5 py-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#A97C21]">Review Tip</div>
                        <p className="mt-2 text-sm leading-7 text-slate-700">
                          {item.explanationEn || item.tipEn}
                        </p>
                      </div>
                    ) : null}

                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        type="button"
                        className="rounded-full bg-[#1E3A5F] px-5"
                        onClick={() => handleOpenPaper(item.paperId)}
                        disabled={!paperAvailable}
                      >
                        Open Original Paper
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-full px-5"
                        onClick={() => handleToggleMastered(item.key)}
                      >
                        {isMastered ? "Move Back to Reviewing" : "Mark as Mastered"}
                      </Button>
                      {!paperAvailable ? (
                        <span className="text-sm text-slate-400">
                          This paper is no longer available in your current student library.
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
