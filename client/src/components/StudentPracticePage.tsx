import PureonFooter from "@/components/PureonFooter";
import StudentWorkspaceTopBar from "@/components/StudentWorkspaceTopBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuiz } from "@/contexts/QuizContext";
import { PAPER_SUBJECT_LABELS, PAPER_SUBJECT_ORDER, type PaperSubject } from "@/data/papers";
import { useLocalAuth } from "@/hooks/useLocalAuth";
import {
  buildPracticePaperFromCandidates,
  buildPracticeQuestionCandidates,
  estimatePracticeDurationMinutes,
  filterPracticeQuestionCandidates,
  getPracticeDifficultyOptions,
  getPracticeKnowledgeTagOptions,
  getPracticeQuestionPreviewText,
  getPracticeQuestionTypeLabel,
  getPracticeQuestionTypeOptions,
  getPracticeTrackOptions,
  type PracticeFilters,
} from "@/lib/studentPractice";
import { trpc } from "@/lib/trpc";
import { Loader2, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

const QUESTION_LIMIT_OPTIONS = [10, 20, 30];

type PracticeSystemOption = {
  id: string;
  label: string;
  subject: PaperSubject;
  systemMode: "assessment" | "textbook-practice";
};

function formatDifficultyLabel(value: string) {
  if (value === "Basic") return "Basic";
  if (value === "Intermediate") return "Intermediate";
  if (value === "Advanced") return "Advanced";
  return value;
}

export default function StudentPracticePage({
  onBackToTests,
}: {
  onBackToTests: () => void;
}) {
  const [, navigate] = useLocation();
  const { user } = useLocalAuth();
  const { startAdHocPaper } = useQuiz();
  const [searchText, setSearchText] = useState("");
  const [questionLimit, setQuestionLimit] = useState(10);
  const allowedSubjects = useMemo(() => {
    const subjects = (user?.allowedSubjects ?? []).filter((subject): subject is PaperSubject =>
      PAPER_SUBJECT_ORDER.includes(subject as PaperSubject),
    );
    return subjects.length > 0 ? subjects : PAPER_SUBJECT_ORDER;
  }, [user?.allowedSubjects]);
  const initialSubject = allowedSubjects.length === 1 ? allowedSubjects[0] : "all";
  const [filters, setFilters] = useState<PracticeFilters>({
    subject: initialSubject,
    track: "all",
    questionType: "all",
    difficulty: "all",
    knowledgeTags: [],
  });

  useEffect(() => {
    setFilters((current) => ({
      ...current,
      subject: allowedSubjects.length === 1 ? allowedSubjects[0] : current.subject,
    }));
  }, [allowedSubjects]);

  const questionBankQuery = trpc.papers.listQuestionBankPapers.useQuery(undefined, {
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
  const englishTagSystemsQuery = trpc.papers.getEnglishTagSystems.useQuery(undefined, {
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
  const mathTagSystemsQuery = trpc.papers.getMathTagSystems.useQuery(undefined, {
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
  const vocabularyTagSystemsQuery = trpc.papers.getVocabularyTagSystems.useQuery(undefined, {
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const systemOptions = useMemo<PracticeSystemOption[]>(() => {
    const allOptions: PracticeSystemOption[] = [];
    const systemsBySubject: Record<PaperSubject, Array<{ id: string; label: string; published?: boolean; systemMode: "assessment" | "textbook-practice" }>> = {
      english: (englishTagSystemsQuery.data ?? []).map((system) => ({
        id: system.id,
        label: system.label,
        published: system.published,
        systemMode: system.systemMode === "textbook-practice" ? "textbook-practice" : "assessment",
      })),
      math: (mathTagSystemsQuery.data ?? []).map((system) => ({
        id: system.id,
        label: system.label,
        published: system.published,
        systemMode: system.systemMode === "textbook-practice" ? "textbook-practice" : "assessment",
      })),
      vocabulary: (vocabularyTagSystemsQuery.data ?? []).map((system) => ({
        id: system.id,
        label: system.label,
        published: system.published,
        systemMode: system.systemMode === "textbook-practice" ? "textbook-practice" : "assessment",
      })),
    };

    allowedSubjects.forEach((subject) => {
      systemsBySubject[subject]
        .filter((system) => system.published !== false)
        .forEach((system) => {
          allOptions.push({
            id: system.id,
            label: system.label,
            subject,
            systemMode: system.systemMode,
          });
        });
    });

    return allOptions;
  }, [
    allowedSubjects,
    englishTagSystemsQuery.data,
    mathTagSystemsQuery.data,
    vocabularyTagSystemsQuery.data,
  ]);
  const systemLabelById = useMemo(
    () => new Map(systemOptions.map((system) => [system.id, system.label])),
    [systemOptions],
  );
  const visibleTrackIdsBySubject = useMemo(() => ({
    english: new Set(systemOptions.filter((system) => system.subject === "english").map((system) => system.id)),
    math: new Set(systemOptions.filter((system) => system.subject === "math").map((system) => system.id)),
    vocabulary: new Set(systemOptions.filter((system) => system.subject === "vocabulary").map((system) => system.id)),
  }), [systemOptions]);

  const allCandidates = useMemo(
    () => buildPracticeQuestionCandidates(questionBankQuery.data ?? [], allowedSubjects).filter((candidate) => {
      const visibleTracks = visibleTrackIdsBySubject[candidate.subject];
      return visibleTracks.size === 0 || visibleTracks.has(candidate.track);
    }),
    [allowedSubjects, questionBankQuery.data, visibleTrackIdsBySubject],
  );
  const subjectScopedCandidates = useMemo(
    () => allCandidates.filter((candidate) => filters.subject === "all" || candidate.subject === filters.subject),
    [allCandidates, filters.subject],
  );
  const searchFilteredCandidates = useMemo(() => {
    const normalizedQuery = searchText.trim().toLowerCase();
    if (!normalizedQuery) {
      return allCandidates;
    }

    return allCandidates.filter((candidate) => {
      const haystacks = [
        candidate.sourcePaperTitle,
        candidate.sourceSectionTitle,
        candidate.track,
        systemLabelById.get(candidate.track),
        candidate.unit,
        candidate.examPart,
        candidate.ability,
        getPracticeQuestionPreviewText(candidate),
      ].filter(Boolean);

      return haystacks.some((value) => value!.toLowerCase().includes(normalizedQuery));
    });
  }, [allCandidates, searchText, systemLabelById]);
  const filteredCandidates = useMemo(
    () => filterPracticeQuestionCandidates(searchFilteredCandidates, filters),
    [filters, searchFilteredCandidates],
  );
  const trackOptions = useMemo(() => getPracticeTrackOptions(subjectScopedCandidates), [subjectScopedCandidates]);
  const trackScopedCandidates = useMemo(
    () => filterPracticeQuestionCandidates(searchFilteredCandidates, {
      ...filters,
      questionType: "all",
      difficulty: "all",
      knowledgeTags: [],
    }),
    [filters, searchFilteredCandidates],
  );
  const questionTypeOptions = useMemo(() => getPracticeQuestionTypeOptions(trackScopedCandidates), [trackScopedCandidates]);
  const typeScopedCandidates = useMemo(
    () => filterPracticeQuestionCandidates(searchFilteredCandidates, {
      ...filters,
      difficulty: "all",
      knowledgeTags: [],
    }),
    [filters, searchFilteredCandidates],
  );
  const difficultyOptions = useMemo(() => getPracticeDifficultyOptions(typeScopedCandidates), [typeScopedCandidates]);
  const knowledgeOptions = useMemo(
    () => getPracticeKnowledgeTagOptions(
      filterPracticeQuestionCandidates(searchFilteredCandidates, {
        ...filters,
        knowledgeTags: [],
      }),
    ).slice(0, 24),
    [filters, searchFilteredCandidates],
  );

  useEffect(() => {
    if (filters.subject !== "all" && !allowedSubjects.includes(filters.subject)) {
      setFilters((current) => ({ ...current, subject: allowedSubjects.length === 1 ? allowedSubjects[0] : "all" }));
    }
  }, [allowedSubjects, filters.subject]);

  useEffect(() => {
    if (trackOptions.length === 0) {
      if (filters.track !== "all") {
        setFilters((current) => ({ ...current, track: "all" }));
      }
      return;
    }

    if (!trackOptions.includes(filters.track)) {
      setFilters((current) => ({ ...current, track: trackOptions[0] }));
    }
  }, [filters.track, trackOptions]);

  useEffect(() => {
    if (filters.questionType !== "all" && !questionTypeOptions.includes(filters.questionType)) {
      setFilters((current) => ({ ...current, questionType: "all" }));
    }
  }, [filters.questionType, questionTypeOptions]);

  useEffect(() => {
    if (filters.difficulty !== "all" && !difficultyOptions.includes(filters.difficulty)) {
      setFilters((current) => ({ ...current, difficulty: "all" }));
    }
  }, [difficultyOptions, filters.difficulty]);

  const previewCandidates = filteredCandidates.slice(0, Math.min(questionLimit, 8));
  const estimatedMinutes = estimatePracticeDurationMinutes(Math.min(filteredCandidates.length, questionLimit));
  const canStartPractice = filteredCandidates.length > 0;

  const toggleKnowledgeTag = (tag: string) => {
    setFilters((current) => ({
      ...current,
      knowledgeTags: current.knowledgeTags.includes(tag)
        ? current.knowledgeTags.filter((value) => value !== tag)
        : [...current.knowledgeTags, tag],
    }));
  };

  const handleSelectTrack = (track: string) => {
    const matchedSystem = systemOptions.find((system) => system.id === track);
    setFilters((current) => ({
      ...current,
      subject: matchedSystem?.subject ?? current.subject,
      track,
    }));
  };

  const handleStartPractice = () => {
    const selectedCandidates = filteredCandidates.slice(0, questionLimit);
    const resolvedSubject = filters.subject === "all"
      ? selectedCandidates[0]?.subject
      : filters.subject;
    const practicePaper = buildPracticePaperFromCandidates(selectedCandidates, resolvedSubject);

    if (!practicePaper) {
      return;
    }

    startAdHocPaper(practicePaper, {
      name: user?.displayName || user?.username || "Student",
      grade: "",
    });
  };

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <StudentWorkspaceTopBar
        active="practice"
        onHomeClick={onBackToTests}
        onQuestionBankClick={() => undefined}
        onPracticeClick={handleStartPractice}
        onWrongBookClick={() => navigate("/mistake-book")}
      />

      <div className="pureon-container">
        <div className="pureon-page-head">
          <div>
            <div className="pureon-section-eyebrow">Practice Mode · 体系筛题</div>
            <h1 className="pureon-page-title mt-2">刷题模式</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--pureon-muted)]">
              先选考试体系，再按题型、难度和知识点筛题，然后进入一题一题的即时练习。每做完一题就显示答案与解析，做错的题在练习提交后会自动进入错题本。
            </p>
          </div>
          <div className="pureon-page-head-actions">
            <Button
              variant="outline"
              className="border-[var(--pureon-teal)] bg-transparent text-[var(--pureon-teal)] hover:bg-[var(--pureon-teal)] hover:text-[var(--pureon-paper)]"
              onClick={onBackToTests}
            >
              测试模式
            </Button>
            <Button
              className="bg-[var(--pureon-teal)] text-[var(--pureon-paper)] hover:bg-[var(--pureon-ink)]"
              onClick={handleStartPractice}
              disabled={!canStartPractice}
            >
              开始刷题
            </Button>
          </div>
        </div>

        <div className="pureon-stat-grid" data-columns="4">
          <div className="pureon-stat-card" data-accent="teal">
            <div className="pureon-stat-label">筛选结果</div>
            <div className="pureon-stat-value">{filteredCandidates.length}</div>
            <div className="pureon-stat-foot">matched questions</div>
          </div>
          <div className="pureon-stat-card" data-accent="blue">
            <div className="pureon-stat-label">练习题量</div>
            <div className="pureon-stat-value">{Math.min(filteredCandidates.length, questionLimit)}</div>
            <div className="pureon-stat-foot">questions in session</div>
          </div>
          <div className="pureon-stat-card">
            <div className="pureon-stat-label">预计时长</div>
            <div className="pureon-stat-value">{estimatedMinutes}m</div>
            <div className="pureon-stat-foot">instant feedback mode</div>
          </div>
          <div className="pureon-stat-card" data-accent="gold">
            <div className="pureon-stat-label">支持学科</div>
            <div className="pureon-stat-value">{allowedSubjects.length}</div>
            <div className="pureon-stat-foot">account access scope</div>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <div className="space-y-6">
            <div className="pureon-filter-bar">
              <div className="pureon-filter-row">
                <div className="pureon-filter-label">搜索</div>
                <div className="flex flex-1 items-center gap-3">
                  <div className="relative min-w-0 flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--pureon-muted)]" />
                    <Input
                      value={searchText}
                      onChange={(event) => setSearchText(event.target.value)}
                      placeholder="Search system, paper title, prompt..."
                      className="h-12 border-[var(--pureon-rule)] bg-[rgba(245,239,224,0.72)] pl-10 text-[var(--pureon-ink)]"
                    />
                  </div>
                </div>
              </div>

              <div className="pureon-filter-row">
                <div className="pureon-filter-label">考试体系</div>
                <div className="pureon-pill-list">
                  {trackOptions.map((track) => (
                    <button
                      key={track}
                      type="button"
                      className="pureon-pill"
                      data-active={filters.track === track ? "true" : "false"}
                      onClick={() => handleSelectTrack(track)}
                    >
                      {systemLabelById.get(track) || track}
                    </button>
                  ))}
                  {trackOptions.length === 0 ? (
                    <span className="text-sm text-[var(--pureon-muted)]">当前可见题库里还没有可用体系。</span>
                  ) : null}
                </div>
              </div>

              <div className="pureon-filter-row">
                <div className="pureon-filter-label">科目</div>
                <div className="pureon-pill-list">
                  {allowedSubjects.length > 1 ? (
                    <button
                      type="button"
                      className="pureon-pill"
                      data-active={filters.subject === "all" ? "true" : "false"}
                      onClick={() => setFilters((current) => ({ ...current, subject: "all" }))}
                    >
                      全部
                    </button>
                  ) : null}
                  {allowedSubjects.map((subject) => (
                    <button
                      key={subject}
                      type="button"
                      className="pureon-pill"
                      data-active={filters.subject === subject ? "true" : "false"}
                      onClick={() => setFilters((current) => ({ ...current, subject }))}
                    >
                      {PAPER_SUBJECT_LABELS[subject]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pureon-filter-row">
                <div className="pureon-filter-label">题型</div>
                <div className="pureon-pill-list">
                  <button
                    type="button"
                    className="pureon-pill"
                    data-active={filters.questionType === "all" ? "true" : "false"}
                    onClick={() => setFilters((current) => ({ ...current, questionType: "all" }))}
                  >
                    全部
                  </button>
                  {questionTypeOptions.map((questionType) => (
                    <button
                      key={questionType}
                      type="button"
                      className="pureon-pill"
                      data-active={filters.questionType === questionType ? "true" : "false"}
                      onClick={() => setFilters((current) => ({ ...current, questionType }))}
                    >
                      {getPracticeQuestionTypeLabel(questionType)}
                    </button>
                  ))}
                </div>
              </div>

              {difficultyOptions.length > 0 ? (
                <div className="pureon-filter-row">
                  <div className="pureon-filter-label">难度</div>
                  <div className="pureon-pill-list">
                    <button
                      type="button"
                      className="pureon-pill"
                      data-active={filters.difficulty === "all" ? "true" : "false"}
                      onClick={() => setFilters((current) => ({ ...current, difficulty: "all" }))}
                    >
                      全部
                    </button>
                    {difficultyOptions.map((difficulty) => (
                      <button
                        key={difficulty}
                        type="button"
                        className="pureon-pill"
                        data-active={filters.difficulty === difficulty ? "true" : "false"}
                        onClick={() => setFilters((current) => ({ ...current, difficulty }))}
                      >
                        {formatDifficultyLabel(difficulty)}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {knowledgeOptions.length > 0 ? (
                <div className="pureon-filter-row">
                  <div className="pureon-filter-label">知识点</div>
                  <div className="pureon-pill-list">
                    {knowledgeOptions.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        className="pureon-pill"
                        data-active={filters.knowledgeTags.includes(tag) ? "true" : "false"}
                        onClick={() => toggleKnowledgeTag(tag)}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="pureon-card">
              <div className="pureon-card-eyebrow">Question Preview</div>
              <div className="pureon-card-title">匹配题目预览</div>

              {questionBankQuery.isLoading ? (
                <div className="flex min-h-[220px] items-center justify-center text-[var(--pureon-muted)]">
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-5 w-5 animate-spin text-[var(--pureon-teal)]" />
                    <span>Loading question bank...</span>
                  </div>
                </div>
              ) : previewCandidates.length > 0 ? (
                <div className="pureon-list mt-5">
                  {previewCandidates.map((candidate, index) => (
                    <div key={candidate.id} className="pureon-list-item">
                      <div className="pureon-list-num">№{index + 1}</div>
                      <div className="min-w-0">
                        <div className="pureon-list-tags">
                          <span className="pureon-tag">{PAPER_SUBJECT_LABELS[candidate.subject]}</span>
                          <span className="pureon-tag" data-tone="gold">{getPracticeQuestionTypeLabel(candidate.sourceQuestionType)}</span>
                          {candidate.difficulty ? (
                            <span className="pureon-tag" data-tone="green">{formatDifficultyLabel(candidate.difficulty)}</span>
                          ) : null}
                        </div>
                        <div className="text-[1rem] font-semibold text-[var(--pureon-teal)]">{candidate.sourcePaperTitle}</div>
                        <div className="pureon-list-text mt-2">{getPracticeQuestionPreviewText(candidate)}</div>
                      </div>
                      <div className="pureon-list-stats">
                        <strong>{systemLabelById.get(candidate.track) || candidate.track}</strong>
                        <span>{candidate.examPart || candidate.unit || candidate.ability || candidate.sourceSectionTitle}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-5 border border-[var(--pureon-rule)] bg-[rgba(245,239,224,0.52)] p-6 text-sm leading-7 text-[var(--pureon-muted)]">
                  当前筛选下还没有可刷的题目。你可以切换考试体系，或者放宽题型、知识点条件再试。
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="pureon-card">
              <div className="pureon-card-eyebrow">Session Setup</div>
              <div className="pureon-card-title">这次怎么练</div>
              <div className="mt-4 space-y-4 text-sm leading-7 text-[var(--pureon-muted)]">
                <p>刷题模式会把你当前体系和标签筛出的题目拼成一套临时练习卷，一次只做一题，完成后立刻显示答案与解析。</p>
                <p>练习提交后，做错的题会自动进入错题本，和现在的 Mistake Book 共用同一套数据。</p>
                <div className="border border-[var(--pureon-rule)] bg-[rgba(245,239,224,0.5)] p-4">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--pureon-muted)]">题量</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {QUESTION_LIMIT_OPTIONS.map((value) => (
                      <button
                        key={value}
                        type="button"
                        className="pureon-pill"
                        data-active={questionLimit === value ? "true" : "false"}
                        onClick={() => setQuestionLimit(value)}
                      >
                        {value} 题
                      </button>
                    ))}
                    <button
                      type="button"
                      className="pureon-pill"
                      data-active={questionLimit > QUESTION_LIMIT_OPTIONS[QUESTION_LIMIT_OPTIONS.length - 1] ? "true" : "false"}
                      onClick={() => setQuestionLimit(Math.max(filteredCandidates.length, 1))}
                    >
                      全部
                    </button>
                  </div>
                </div>
              </div>
              <Button
                className="mt-5 w-full bg-[var(--pureon-teal)] text-[var(--pureon-paper)] hover:bg-[var(--pureon-ink)]"
                onClick={handleStartPractice}
                disabled={!canStartPractice}
              >
                开始这组练习
              </Button>
            </div>

            <div className="pureon-card">
              <div className="pureon-card-eyebrow">Active Filters</div>
              <div className="pureon-card-title">当前标签</div>
              <div className="pureon-pill-list mt-4">
                {filters.subject !== "all" ? (
                  <span className="pureon-pill" data-active="true">{PAPER_SUBJECT_LABELS[filters.subject]}</span>
                ) : null}
                {filters.track !== "all" ? (
                  <span className="pureon-pill" data-active="true">{systemLabelById.get(filters.track) || filters.track}</span>
                ) : null}
                {filters.questionType !== "all" ? (
                  <span className="pureon-pill" data-active="true">{getPracticeQuestionTypeLabel(filters.questionType)}</span>
                ) : null}
                {filters.difficulty !== "all" ? (
                  <span className="pureon-pill" data-active="true">{formatDifficultyLabel(filters.difficulty)}</span>
                ) : null}
                {filters.knowledgeTags.map((tag) => (
                  <span key={tag} className="pureon-pill" data-active="true">{tag}</span>
                ))}
                {filters.subject === "all" && filters.track === "all" && filters.questionType === "all" && filters.difficulty === "all" && filters.knowledgeTags.length === 0 ? (
                  <span className="text-sm text-[var(--pureon-muted)]">先选一个考试体系，再继续收紧题型、难度和知识点。</span>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <PureonFooter note="刷题模式 / Practice Mode" />
      </div>
    </div>
  );
}
