import PureonFooter from "@/components/PureonFooter";
import StudentWorkspaceTopBar from "@/components/StudentWorkspaceTopBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuiz } from "@/contexts/QuizContext";
import { PAPER_SUBJECT_LABELS, PAPER_SUBJECT_ORDER, type PaperSubject } from "@/data/papers";
import { useLocalAuth } from "@/hooks/useLocalAuth";
import { buildMistakeNotebook } from "@/lib/mistakeNotebook";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, Loader2, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

const MASTERED_STORAGE_PREFIX = "student_mistake_book_mastered_v1";

type ReviewStatusFilter = "all" | "reviewing" | "mastered";

const REVIEW_STATUS_OPTIONS: Array<{ key: ReviewStatusFilter; label: string }> = [
  { key: "all", label: "全部" },
  { key: "reviewing", label: "未掌握" },
  { key: "mastered", label: "已掌握" },
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
    if (!hasLoadedMasteredKeys) return;
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

  const topSection = useMemo(() => {
    const frequency = new Map<string, number>();
    notebookItems.forEach((item) => {
      const key = item.sectionTitle || "Unknown";
      frequency.set(key, (frequency.get(key) || 0) + item.mistakeCount);
    });

    let best = "—";
    let max = 0;
    frequency.forEach((count, title) => {
      if (count > max) {
        max = count;
        best = title;
      }
    });

    return { title: best, count: max };
  }, [notebookItems]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = searchText.trim().toLowerCase();

    return notebookItems.filter((item) => {
      if (selectedSubject !== "all" && item.paperSubject !== selectedSubject) {
        return false;
      }

      const isMastered = Boolean(masteredKeys[item.key]);
      if (statusFilter === "reviewing" && isMastered) return false;
      if (statusFilter === "mastered" && !isMastered) return false;

      if (!normalizedQuery) return true;

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
      <div className="min-h-screen bg-[var(--background)]">
        <StudentWorkspaceTopBar active="wrong" onHomeClick={() => navigate("/")} onPracticeClick={() => navigate("/")} />
        <div className="pureon-container">
          <div className="flex min-h-[260px] items-center justify-center text-[var(--pureon-muted)]">
            <div className="flex items-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-[var(--pureon-teal)]" />
              <span>Loading your mistake book...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isTeacher) {
    return (
      <div className="min-h-screen bg-[var(--background)]">
        <StudentWorkspaceTopBar active="wrong" onHomeClick={() => navigate("/")} />
        <div className="pureon-container">
          <div className="pureon-card max-w-3xl">
            <div className="pureon-card-title">Mistake Book is for student accounts</div>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--pureon-muted)]">
              Teacher accounts review full submissions in Test History. Switch to a student account to open the wrong-question notebook.
            </p>
            <Button
              className="mt-6 bg-[var(--pureon-teal)] text-[var(--pureon-paper)] hover:bg-[var(--pureon-ink)]"
              onClick={() => navigate("/")}
            >
              Back to Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <StudentWorkspaceTopBar
        active="wrong"
        onHomeClick={() => navigate("/")}
        onQuestionBankClick={() => navigate("/")}
        onPracticeClick={() => navigate("/")}
      />

      <div className="pureon-container">
        <div className="pureon-page-head">
          <div>
            <div className="pureon-section-eyebrow">Wrong Question Book · 共 {counts.total} 题待复习</div>
            <h1 className="pureon-page-title mt-2">我的错题本</h1>
          </div>
          <div className="pureon-page-head-actions">
            <Button
              variant="outline"
              className="border-[var(--pureon-teal)] bg-transparent text-[var(--pureon-teal)] hover:bg-[var(--pureon-teal)] hover:text-[var(--pureon-paper)]"
              onClick={() => navigate("/")}
            >
              返回试卷
            </Button>
            <Button
              className="bg-[var(--pureon-teal)] text-[var(--pureon-paper)] hover:bg-[var(--pureon-ink)]"
              onClick={() => {
                const next = filteredItems.find((item) => availablePaperIds.has(item.paperId));
                if (next) handleOpenPaper(next.paperId);
              }}
              disabled={!filteredItems.some((item) => availablePaperIds.has(item.paperId))}
            >
              一键重做
            </Button>
          </div>
        </div>

        <div className="pureon-stat-grid" data-columns="3">
          <div className="pureon-stat-card" data-accent="red">
            <div className="pureon-stat-label">累计错题</div>
            <div className="pureon-stat-value">{counts.total}</div>
            <div className="pureon-stat-foot">当前记录题目数量</div>
          </div>
          <div className="pureon-stat-card" data-accent="teal">
            <div className="pureon-stat-label">已掌握 / 已订正</div>
            <div className="pureon-stat-value">{counts.mastered}</div>
            <div className="pureon-stat-foot">
              完成率 {counts.total > 0 ? Math.round((counts.mastered / counts.total) * 100) : 0}%
            </div>
          </div>
          <div className="pureon-stat-card">
            <div className="pureon-stat-label">易错知识点 TOP</div>
            <div className="mt-3 text-lg font-semibold text-[var(--pureon-teal)]">{topSection.title}</div>
            <div className="pureon-stat-foot">{topSection.count > 0 ? `错 ${topSection.count} 次` : '暂无统计'}</div>
          </div>
        </div>

        <div className="mt-6 pureon-filter-bar">
          <div className="pureon-filter-row">
            <div className="pureon-filter-label">搜索</div>
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--pureon-muted)]" />
              <Input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="按试卷、题号或答案搜索"
                className="h-11 border-[var(--border)] bg-[var(--pureon-paper)] pl-10"
              />
            </div>
          </div>

          <div className="pureon-filter-row">
            <div className="pureon-filter-label">状态</div>
            <div className="pureon-pill-list">
              {REVIEW_STATUS_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  className="pureon-pill"
                  data-active={statusFilter === option.key ? "true" : "false"}
                  onClick={() => setStatusFilter(option.key)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="pureon-filter-row">
            <div className="pureon-filter-label">学科</div>
            <div className="pureon-pill-list">
              <button
                type="button"
                className="pureon-pill"
                data-active={selectedSubject === "all" ? "true" : "false"}
                onClick={() => setSelectedSubject("all")}
              >
                全部 {counts.total}
              </button>
              {PAPER_SUBJECT_ORDER.map((subject) => (
                <button
                  key={subject}
                  type="button"
                  className="pureon-pill"
                  data-active={selectedSubject === subject ? "true" : "false"}
                  onClick={() => setSelectedSubject(subject)}
                >
                  {PAPER_SUBJECT_LABELS[subject]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {resultsQuery.isLoading ? (
          <div className="flex min-h-[220px] items-center justify-center text-[var(--pureon-muted)]">
            <div className="flex items-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-[var(--pureon-teal)]" />
              <span>Loading your mistake book...</span>
            </div>
          </div>
        ) : resultsQuery.error ? (
          <div className="pureon-card mt-6 border-[var(--pureon-red)] bg-[rgba(168,50,50,0.05)] text-[var(--pureon-red)]">
            Unable to load your mistake book right now. Please refresh and try again.
          </div>
        ) : notebookItems.length === 0 ? (
          <div className="pureon-card mt-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center border border-[var(--border)] bg-[var(--pureon-paper)] text-[var(--pureon-teal)]">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div className="pureon-card-title mt-5">No collected mistakes yet</div>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-[var(--pureon-muted)]">
              完成试卷后，做错的客观题会自动进入这里，方便后续复习和重做。
            </p>
            <Button
              className="mt-6 bg-[var(--pureon-teal)] text-[var(--pureon-paper)] hover:bg-[var(--pureon-ink)]"
              onClick={() => navigate("/")}
            >
              Go to Assessments
            </Button>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="pureon-card mt-6 text-center">
            <div className="pureon-card-title">没有符合当前筛选条件的错题</div>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-[var(--pureon-muted)]">
              可以切换状态、学科或减少搜索关键词。
            </p>
          </div>
        ) : (
          <div className="mt-6 pureon-table-wrap">
            <table className="pureon-table">
              <thead>
                <tr>
                  <th style={{ width: "60px" }}>№</th>
                  <th>题目摘要</th>
                  <th>科目</th>
                  <th>知识点</th>
                  <th>错误次数</th>
                  <th>最近一次</th>
                  <th>状态</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item, index) => {
                  const isMastered = Boolean(masteredKeys[item.key]);
                  const paperAvailable = availablePaperIds.has(item.paperId);

                  return (
                    <tr key={item.key}>
                      <td>{String(index + 1).padStart(2, "0")}</td>
                      <td>
                        <div className="max-w-[26rem]">
                          <div className="font-medium text-[var(--pureon-teal)]">{item.questionNum}</div>
                          <div className="mt-1 line-clamp-2">{item.questionText}</div>
                        </div>
                      </td>
                      <td>{item.paperSubject ? (PAPER_SUBJECT_LABELS[item.paperSubject] || item.paperSubject) : "—"}</td>
                      <td>{item.sectionTitle}</td>
                      <td>
                        <span className={item.mistakeCount > 1 ? "font-semibold text-[var(--pureon-red)]" : ""}>
                          {item.mistakeCount} 次
                        </span>
                      </td>
                      <td>{formatLatestSeenAt(item.latestSeenAt)}</td>
                      <td>
                        <button
                          type="button"
                          className="bg-transparent"
                          onClick={() => handleToggleMastered(item.key)}
                        >
                          <span className="pureon-badge" data-tone={isMastered ? "green" : "gold"}>
                            {isMastered ? "已掌握" : "复习中"}
                          </span>
                        </button>
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() => handleOpenPaper(item.paperId)}
                          disabled={!paperAvailable}
                          className="text-[12px] text-[var(--pureon-teal)] disabled:text-[var(--pureon-muted)]"
                        >
                          重做 →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PureonFooter note="错题复盘 / Wrong Book" />
    </div>
  );
}
