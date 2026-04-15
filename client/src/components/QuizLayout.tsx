import PureonFooter from '@/components/PureonFooter';
import ResultsPage from '@/components/ResultsPage';
import SectionContent from '@/components/SectionContent';
import Sidebar from '@/components/Sidebar';
import StudentWorkspaceTopBar from '@/components/StudentWorkspaceTopBar';
import { Button } from '@/components/ui/button';
import { useQuiz } from '@/contexts/QuizContext';
import { PAPER_SUBJECT_LABELS, type OpenEndedQuestion, type Question, type Section, type WritingQuestion } from '@/data/papers';
import {
  buildAssessmentReviewModel,
  buildSubmissionArtifacts,
  type ReadingGradingResult,
  type WritingEvaluationResult,
} from '@/lib/assessmentReview';
import { packStoredAssessmentPayloadForResultStorage } from '@/lib/resultStorage';
import { AlertTriangle, Loader2, LogOut, Send } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { trpc } from '@/lib/trpc';

type PracticeAiFeedbackEntry = {
  answerHash: string;
  status: 'loading' | 'ready' | 'error';
  readingResults?: ReadingGradingResult[];
  writingResult?: WritingEvaluationResult | null;
  error?: string;
};

function parseAnswerRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }

  return {};
}

function serializePracticeAnswer(value: unknown) {
  if (typeof value === 'string') {
    return value;
  }

  if (value === undefined) {
    return '';
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function isAiFeedbackQuestion(question: Question | undefined | null) {
  if (!question) return false;
  if (question.type === 'writing') return true;
  return question.type === 'open-ended' && question.responseMode !== 'audio';
}

function buildOpenEndedPracticeInputs(
  section: Section,
  question: OpenEndedQuestion,
  rawAnswer: unknown,
) {
  if (question.subQuestions && question.subQuestions.length > 0) {
    const parsed = parseAnswerRecord(rawAnswer);
    return question.subQuestions.map((subQuestion) => ({
      questionId: `${section.id}::${question.id}-${subQuestion.label}`,
      questionType: 'open-ended-sub',
      questionText: `${question.question} ${subQuestion.label}) ${subQuestion.question}`.trim(),
      userAnswer: typeof parsed[subQuestion.label] === 'string' ? String(parsed[subQuestion.label]) : '',
      correctAnswer: subQuestion.answer,
      context: section.passage,
    }));
  }

  return [{
    questionId: `${section.id}::${question.id}`,
    questionType: 'open-ended',
    questionText: question.question,
    userAnswer: typeof rawAnswer === 'string' ? rawAnswer : '',
    correctAnswer: question.answer || question.correctAnswer || '',
    context: section.passage,
  }];
}

function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export default function QuizLayout() {
  const { state, resetQuiz, submitQuiz, sections, selectedPaper, getSectionProgress, getSectionTimings, setCurrentSection } = useQuiz();
  const [activeConfirm, setActiveConfirm] = useState<'exit' | 'submit' | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(() => (
    state.startTime ? Math.max(0, Math.floor((Date.now() - state.startTime) / 1000)) : 0
  ));
  const [practiceAiFeedback, setPracticeAiFeedback] = useState<Record<string, PracticeAiFeedbackEntry>>({});
  const checkReadingMutation = trpc.grading.checkReadingAnswers.useMutation();
  const evaluateWritingMutation = trpc.grading.evaluateWriting.useMutation();

  const totalAnswered = sections.reduce((sum, section) => sum + getSectionProgress(section.id).answered, 0);
  const totalQuestions = sections.reduce((sum, section) => sum + getSectionProgress(section.id).total, 0);
  const unanswered = totalQuestions - totalAnswered;
  const progressPercent = sections.length > 0 ? ((state.currentSectionIndex + 1) / sections.length) * 100 : 0;
  const currentSection = sections[state.currentSectionIndex];
  const currentPracticeQuestion = currentSection?.questions[0];
  const currentPracticeAnswerKey = currentSection && currentPracticeQuestion
    ? `${currentSection.id}:${currentPracticeQuestion.id}`
    : '';
  const currentPracticeAnswer = currentPracticeAnswerKey ? state.answers[currentPracticeAnswerKey] : undefined;
  const currentPracticeAnswerHash = serializePracticeAnswer(currentPracticeAnswer);
  const instantPracticeMode = Boolean(selectedPaper?.instantFeedbackMode);
  const isLastPracticeQuestion = state.currentSectionIndex >= sections.length - 1;
  const requiresPracticeAi = instantPracticeMode && isAiFeedbackQuestion(currentPracticeQuestion);
  const currentPracticeAiEntry = currentSection ? practiceAiFeedback[currentSection.id] : undefined;
  const currentPracticeAiMatchesAnswer = currentPracticeAiEntry?.answerHash === currentPracticeAnswerHash;
  const currentPracticeAiLoading = requiresPracticeAi && currentPracticeAiMatchesAnswer && currentPracticeAiEntry?.status === 'loading';
  const currentPracticeAiReady = requiresPracticeAi && currentPracticeAiMatchesAnswer && currentPracticeAiEntry?.status === 'ready';
  const currentPracticeAiError = requiresPracticeAi && currentPracticeAiMatchesAnswer && currentPracticeAiEntry?.status === 'error'
    ? currentPracticeAiEntry.error || 'AI feedback is temporarily unavailable.'
    : null;
  const aggregatedPracticeReadingResults = useMemo(
    () => Object.values(practiceAiFeedback).flatMap((entry) => entry.readingResults ?? []),
    [practiceAiFeedback],
  );
  const currentPracticeWritingResult = currentPracticeQuestion?.type === 'writing' && currentPracticeAiReady
    ? currentPracticeAiEntry?.writingResult ?? null
    : null;

  const practiceReviewModel = useMemo(() => {
    if (!instantPracticeMode || !selectedPaper) {
      return null;
    }

    const artifacts = buildSubmissionArtifacts(selectedPaper, state.answers);
    return buildAssessmentReviewModel({
      studentName: 'Student',
      studentGrade: null,
      paperId: selectedPaper.id,
      paperTitle: selectedPaper.title,
      totalCorrect: artifacts.objectiveTotals.correct,
      totalQuestions: artifacts.objectiveTotals.total,
      totalTimeSeconds: elapsedSeconds,
      answersJson: packStoredAssessmentPayloadForResultStorage(state.answers, selectedPaper),
      scoreBySectionJson: JSON.stringify(artifacts.objectiveBySection),
      sectionTimingsJson: JSON.stringify(getSectionTimings()),
      readingResultsJson: aggregatedPracticeReadingResults.length > 0 ? JSON.stringify(aggregatedPracticeReadingResults) : null,
      writingResultJson: currentPracticeWritingResult ? JSON.stringify(currentPracticeWritingResult) : null,
      explanationsJson: null,
      reportJson: null,
      createdAt: new Date().toISOString(),
    });
  }, [
    aggregatedPracticeReadingResults,
    currentPracticeWritingResult,
    elapsedSeconds,
    getSectionTimings,
    instantPracticeMode,
    selectedPaper,
    state.answers,
  ]);
  const currentPracticeSectionReview = instantPracticeMode
    ? practiceReviewModel?.sections[state.currentSectionIndex] || null
    : null;
  const currentPracticeDetails = currentPracticeSectionReview?.details || [];
  const isCurrentPracticeQuestionAnswered = currentPracticeDetails.length > 0
    ? currentPracticeDetails.every((detail) => detail.isAnswered)
    : (currentSection ? getSectionProgress(currentSection.id).answered > 0 : false);
  const canShowPracticeFeedback = requiresPracticeAi
    ? currentPracticeAiReady
    : isCurrentPracticeQuestionAnswered;

  const evaluateCurrentPracticeQuestion = async () => {
    if (!currentSection || !currentPracticeQuestion || !requiresPracticeAi || !isCurrentPracticeQuestionAnswered) {
      return;
    }

    const sectionId = currentSection.id;
    const answerHash = currentPracticeAnswerHash;
    setPracticeAiFeedback((current) => ({
      ...current,
      [sectionId]: {
        answerHash,
        status: 'loading',
      },
    }));

    try {
      if (currentPracticeQuestion.type === 'writing') {
        const question = currentPracticeQuestion as WritingQuestion;
        const writingResult = await evaluateWritingMutation.mutateAsync({
          essay: typeof currentPracticeAnswer === 'string' ? currentPracticeAnswer : '',
          topic: question.topic || question.instructions || 'Writing Task',
          wordCountTarget: question.wordCount || 'No target specified',
        });

        setPracticeAiFeedback((current) => ({
          ...current,
          [sectionId]: {
            answerHash,
            status: 'ready',
            writingResult,
          },
        }));
        return;
      }

      const question = currentPracticeQuestion as OpenEndedQuestion;
      const readingResults = await checkReadingMutation.mutateAsync({
        answers: buildOpenEndedPracticeInputs(currentSection, question, currentPracticeAnswer),
      });

      setPracticeAiFeedback((current) => ({
        ...current,
        [sectionId]: {
          answerHash,
          status: 'ready',
          readingResults,
        },
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI feedback is temporarily unavailable.';
      setPracticeAiFeedback((current) => ({
        ...current,
        [sectionId]: {
          answerHash,
          status: 'error',
          error: message,
        },
      }));
    }
  };

  const handleAdvancePractice = () => {
    if (!instantPracticeMode || !isCurrentPracticeQuestionAnswered) {
      return;
    }

    if (requiresPracticeAi && !currentPracticeAiReady) {
      void evaluateCurrentPracticeQuestion();
      return;
    }

    if (isLastPracticeQuestion) {
      submitQuiz();
      return;
    }

    setCurrentSection(state.currentSectionIndex + 1);
  };

  useEffect(() => {
    setActiveConfirm(null);
  }, [state.currentSectionIndex]);

  useEffect(() => {
    if (!state.startTime || state.submitted) return;

    const tick = () => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - state.startTime!) / 1000)));
    };

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [state.startTime, state.submitted]);

  if (state.submitted) {
    return <ResultsPage />;
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <StudentWorkspaceTopBar
        active="practice"
        onHomeClick={() => setActiveConfirm('exit')}
      />

      <div className="pureon-container">
        <div className="pureon-page-head">
          <div>
            <div className="pureon-section-eyebrow">
              Practice Mode · {selectedPaper ? PAPER_SUBJECT_LABELS[selectedPaper.subject] : 'Assessment'}
            </div>
            <h1 className="pureon-page-title mt-2">{selectedPaper?.title || currentSection?.title || 'Practice'}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--pureon-muted)]">
              {currentSection?.description || 'Work through each part in order, then submit for grading and review.'}
            </p>
          </div>
          <div className="pureon-page-head-actions">
            <Button
              variant="outline"
              onClick={() => setActiveConfirm('exit')}
              className="border-[var(--pureon-red)] bg-transparent text-[var(--pureon-red)] hover:bg-[var(--pureon-red)] hover:text-[var(--pureon-paper)]"
            >
              <LogOut className="h-4 w-4" />
              退出练习
            </Button>
            <Button
              onClick={() => setActiveConfirm('submit')}
              className="bg-[var(--pureon-teal)] text-[var(--pureon-paper)] hover:bg-[var(--pureon-ink)]"
            >
              <Send className="h-4 w-4" />
              提交交卷
            </Button>
          </div>
        </div>

        {activeConfirm ? (
          <div className="mb-6 border border-[var(--pureon-gold)] bg-[rgba(201,164,97,0.08)] p-5">
            {activeConfirm === 'exit' ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--pureon-gold)]" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-[var(--pureon-teal)]">退出当前练习？</div>
                  <p className="mt-1 text-sm leading-7 text-[var(--pureon-muted)]">
                    退出后会清空这次作答并返回试卷选择页。
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        setActiveConfirm(null);
                        resetQuiz();
                      }}
                    >
                      确认退出
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-[var(--pureon-teal)] bg-transparent text-[var(--pureon-teal)] hover:bg-[var(--pureon-teal)] hover:text-[var(--pureon-paper)]"
                      onClick={() => setActiveConfirm(null)}
                    >
                      继续作答
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--pureon-gold)]" />
                <div className="min-w-0 flex-1">
                  {unanswered > 0 ? (
                    <div className="text-sm leading-7 text-[var(--pureon-muted)]">
                      你还有 <strong className="text-[var(--pureon-red)]">{unanswered}</strong> 题未作答。
                    </div>
                  ) : null}
                  <p className="text-sm leading-7 text-[var(--pureon-muted)]">
                    确认提交后将进入评分与报告页面，当前作答不可撤销。
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      onClick={() => {
                        submitQuiz();
                        setActiveConfirm(null);
                      }}
                      className="bg-[var(--pureon-teal)] text-[var(--pureon-paper)] hover:bg-[var(--pureon-ink)]"
                    >
                      <Send className="h-4 w-4" />
                      确认提交
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-[var(--pureon-teal)] bg-transparent text-[var(--pureon-teal)] hover:bg-[var(--pureon-teal)] hover:text-[var(--pureon-paper)]"
                      onClick={() => setActiveConfirm(null)}
                    >
                      返回作答
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : null}

        <div className="pureon-practice-layout">
          <div className="pureon-practice-main">
            <div className="pureon-practice-progress">
            <div className="pureon-progress-text">
                <strong>{instantPracticeMode ? `第 ${state.currentSectionIndex + 1} 题` : `第 ${state.currentSectionIndex + 1} 部分`}</strong>
                {' / '}
                共 {sections.length} {instantPracticeMode ? '题' : '部分'}
              </div>
              <div className="pureon-progress-track">
                <span style={{ width: `${progressPercent}%` }} />
              </div>
              <div className="pureon-progress-text">
                已用 <strong>{formatDuration(elapsedSeconds)}</strong>
              </div>
            </div>
            <SectionContent />
            {instantPracticeMode ? (
              <div className="mt-6 border border-[var(--pureon-rule)] bg-[rgba(245,239,224,0.62)] p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.2em] text-[var(--pureon-gold)]">
                      答案与解析 / Answer & Explanation
                    </div>
                    <h2 className="mt-2 text-xl font-semibold text-[var(--pureon-teal)]">
                      {!isCurrentPracticeQuestionAnswered
                        ? '完成本题后会显示反馈'
                        : requiresPracticeAi
                          ? currentPracticeAiReady
                            ? 'AI 反馈已生成'
                            : currentPracticeAiLoading
                              ? 'AI 正在生成解析'
                              : '生成当前题的 AI 反馈'
                          : '本题反馈已更新'}
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm leading-7 text-[var(--pureon-muted)]">
                      {!isCurrentPracticeQuestionAnswered
                        ? '刷题模式下，客观题会直接显示答案；开放题和写作题点击按钮后会生成 AI 参考答案与反馈。'
                        : requiresPracticeAi
                          ? currentPracticeAiReady
                            ? '你可以先看 AI 参考答案与点评，再进入下一题。'
                            : '当前题需要先生成 AI 反馈，再进入下一题。'
                          : '你可以先对照答案和解析，再进入下一题。最终提交后，做错的题会进入错题本。'}
                    </p>
                  </div>
                  <Button
                    onClick={handleAdvancePractice}
                    disabled={!isCurrentPracticeQuestionAnswered || currentPracticeAiLoading}
                    className="bg-[var(--pureon-teal)] text-[var(--pureon-paper)] hover:bg-[var(--pureon-ink)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {currentPracticeAiLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        AI 解析生成中
                      </>
                    ) : !isCurrentPracticeQuestionAnswered ? (
                      '先完成作答'
                    ) : requiresPracticeAi && !currentPracticeAiReady ? (
                      currentPracticeAiError ? '重试 AI 解析' : '生成 AI 解析'
                    ) : isLastPracticeQuestion ? (
                      '完成本次练习'
                    ) : (
                      '下一题'
                    )}
                  </Button>
                </div>

                {currentPracticeAiError ? (
                  <div className="mt-5 border border-[var(--pureon-gold)] bg-[rgba(201,164,97,0.08)] p-4 text-sm leading-7 text-[var(--pureon-muted)]">
                    {currentPracticeAiError}
                  </div>
                ) : null}

                {canShowPracticeFeedback && currentPracticeQuestion?.type === 'writing' && currentPracticeWritingResult ? (
                  <div className="mt-5 space-y-4">
                    <div className="border border-[var(--pureon-rule)] bg-[var(--pureon-paper)] p-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="pureon-tag" data-tone="gold">Writing</span>
                        <span className="pureon-tag" data-tone="green">Score {currentPracticeWritingResult.score}/{currentPracticeWritingResult.maxScore}</span>
                        <span className="pureon-tag">{currentPracticeWritingResult.grade}</span>
                      </div>
                      <div className="mt-4 text-sm leading-7 text-[var(--pureon-ink)]">
                        {currentPracticeWritingResult.overallFeedback_cn || currentPracticeWritingResult.overallFeedback_en}
                      </div>
                      {currentPracticeWritingResult.suggestions_cn?.length || currentPracticeWritingResult.suggestions_en?.length ? (
                        <div className="mt-4 border border-dashed border-[var(--pureon-gold)] bg-[rgba(245,239,224,0.52)] p-4">
                          <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--pureon-gold)]">改进建议</div>
                          <div className="mt-2 space-y-2 text-sm leading-7 text-[var(--pureon-muted)]">
                            {(currentPracticeWritingResult.suggestions_cn?.length
                              ? currentPracticeWritingResult.suggestions_cn
                              : currentPracticeWritingResult.suggestions_en || []
                            ).slice(0, 4).map((item, index) => (
                              <p key={`writing-suggestion-${index}`}>{item}</p>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      {currentPracticeWritingResult.correctedEssay ? (
                        <div className="mt-4 border border-[var(--pureon-rule)] bg-[rgba(245,239,224,0.42)] p-4">
                          <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--pureon-muted)]">参考修订稿</div>
                          <div className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[var(--pureon-ink)]">
                            {currentPracticeWritingResult.correctedEssay}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {canShowPracticeFeedback && currentPracticeQuestion?.type !== 'writing' && currentPracticeDetails.length > 0 ? (
                  <div className="mt-5 space-y-4">
                    {currentPracticeDetails.map((detail) => (
                      <div
                        key={detail.id}
                        className={`border p-4 ${
                          detail.isCorrect
                            ? 'border-emerald-200 bg-emerald-50/50'
                            : 'border-[var(--pureon-gold)] bg-[rgba(201,164,97,0.08)]'
                        }`}
                      >
                        <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[var(--pureon-muted)]">
                          <span>{detail.questionNum}</span>
                          <span>·</span>
                          <span>{detail.isCorrect ? 'Correct' : 'Review Needed'}</span>
                        </div>
                        <div className="mt-3 text-sm leading-7 text-[var(--pureon-ink)]">
                          {detail.questionText}
                        </div>
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          <div className="border border-[var(--pureon-rule)] bg-[var(--pureon-paper)] p-3">
                            <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--pureon-muted)]">你的答案</div>
                            <div className="mt-2 text-sm leading-7 text-[var(--pureon-ink)]">{detail.userAnswer || '未作答'}</div>
                          </div>
                          <div className="border border-[var(--pureon-rule)] bg-[var(--pureon-paper)] p-3">
                            <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--pureon-muted)]">正确答案</div>
                            <div className="mt-2 text-sm leading-7 font-semibold text-[var(--pureon-teal)]">{detail.correctAnswer || '—'}</div>
                          </div>
                        </div>
                        <div className="mt-4 border border-dashed border-[var(--pureon-gold)] bg-[var(--pureon-paper)] p-4">
                          <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--pureon-gold)]">解析</div>
                          <div className="mt-2 text-sm leading-7 text-[var(--pureon-ink)]">
                            {detail.explanationCn || detail.explanationEn || (
                              detail.isCorrect
                                ? '本题答对了，可以直接进入下一题继续练习。'
                                : `正确答案是 ${detail.correctAnswer || '—'}。当前题目暂未提供详细解析。`
                            )}
                          </div>
                          {detail.tipCn || detail.tipEn ? (
                            <div className="mt-3 text-sm leading-7 text-[var(--pureon-muted)]">
                              提示：{detail.tipCn || detail.tipEn}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <Sidebar />
        </div>
      </div>

      <PureonFooter note="练习模式 / Practice Mode" />
    </div>
  );
}
