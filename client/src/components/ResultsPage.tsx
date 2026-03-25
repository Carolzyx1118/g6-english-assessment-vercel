import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { History, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import AssessmentReportPanel from "@/components/AssessmentReportPanel";
import { Button } from "@/components/ui/button";
import { useQuiz } from "@/contexts/QuizContext";
import { useLocalAuth } from "@/hooks/useLocalAuth";
import {
  buildSubmissionArtifacts,
  getLetterGrade,
  type AssessmentReviewRecord,
} from "@/lib/assessmentReview";
import { sanitizeReportForStorage } from "@/lib/resultStorage";
import { packStoredAssessmentPayloadForResultStorage } from "@/lib/resultStorage";
import { trpc } from "@/lib/trpc";

function getCacheKey(parts: {
  paperId: string;
  studentName: string;
  studentGrade: string;
  endTime: number | null;
}) {
  return `assessment_review_cache_v2:${parts.paperId}:${parts.studentName}:${parts.studentGrade}:${parts.endTime || 0}`;
}

function readCachedReview(key: string) {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as { savedResultId: number | null; record: AssessmentReviewRecord };
  } catch {
    return null;
  }
}

function writeCachedReview(
  key: string,
  value: { savedResultId: number | null; record: AssessmentReviewRecord },
) {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage failures in restricted browsers.
  }
}

function buildFallbackRecord(
  base: Omit<
    AssessmentReviewRecord,
    "createdAt" | "readingResultsJson" | "writingResultJson" | "explanationsJson" | "reportJson"
  >,
): AssessmentReviewRecord {
  return {
    ...base,
    readingResultsJson: null,
    writingResultJson: null,
    explanationsJson: null,
    reportJson: null,
    createdAt: new Date(),
  };
}

export default function ResultsPage() {
  const utils = trpc.useUtils();
  const { isTeacher } = useLocalAuth();
  const {
    selectedPaper,
    studentInfo,
    state,
    getSectionTimings,
    getTotalTime,
    resetQuiz,
  } = useQuiz();
  const [record, setRecord] = useState<AssessmentReviewRecord | null>(null);
  const [savedResultId, setSavedResultId] = useState<number | null>(null);
  const [statusText, setStatusText] = useState("Preparing your report...");
  const [fatalError, setFatalError] = useState<string | null>(null);

  const saveResultMutation = trpc.results.save.useMutation();
  const updateResultMutation = trpc.results.updateAI.useMutation();
  const checkReadingMutation = trpc.grading.checkReadingAnswers.useMutation();
  const explainWrongAnswersMutation = trpc.grading.explainWrongAnswers.useMutation();
  const evaluateWritingMutation = trpc.grading.evaluateWriting.useMutation();
  const evaluateSpeakingMutation = trpc.grading.evaluateSpeaking.useMutation();
  const generateReportMutation = trpc.grading.generateReport.useMutation();

  const cacheKey = useMemo(() => {
    if (!selectedPaper || !studentInfo) return null;
    return getCacheKey({
      paperId: selectedPaper.id,
      studentName: studentInfo.name,
      studentGrade: studentInfo.grade,
      endTime: state.endTime,
    });
  }, [selectedPaper, state.endTime, studentInfo]);

  useEffect(() => {
    if (!selectedPaper || !studentInfo || !state.submitted || !cacheKey) return;

    const cached = readCachedReview(cacheKey);
    if (!cached) return;

    setSavedResultId(cached.savedResultId);
    setRecord(cached.record);
  }, [cacheKey, selectedPaper, state.submitted, studentInfo]);

  useEffect(() => {
    if (!selectedPaper || !studentInfo || !state.submitted || !cacheKey || record) return;

    let cancelled = false;

    const run = async () => {
      const sectionTimings = getSectionTimings();
      const totalTimeSeconds = getTotalTime();
      const answersJson = packStoredAssessmentPayloadForResultStorage(state.answers, selectedPaper);
      const artifacts = buildSubmissionArtifacts(selectedPaper, state.answers);

      const baseRecord = buildFallbackRecord({
        studentName: studentInfo.name,
        studentGrade: studentInfo.grade || null,
        paperId: selectedPaper.id,
        paperTitle: selectedPaper.title,
        totalCorrect: artifacts.objectiveTotals.correct,
        totalQuestions: artifacts.objectiveTotals.total,
        totalTimeSeconds,
        answersJson,
        scoreBySectionJson: JSON.stringify(artifacts.objectiveBySection),
        sectionTimingsJson: JSON.stringify(sectionTimings),
      });

      try {
        setStatusText("Saving assessment...");
        const saveResult = await saveResultMutation.mutateAsync({
          studentName: baseRecord.studentName,
          studentGrade: baseRecord.studentGrade || undefined,
          paperId: baseRecord.paperId,
          paperTitle: baseRecord.paperTitle,
          totalCorrect: baseRecord.totalCorrect,
          totalQuestions: baseRecord.totalQuestions,
          totalTimeSeconds: baseRecord.totalTimeSeconds || undefined,
          answersJson: baseRecord.answersJson,
          scoreBySectionJson: baseRecord.scoreBySectionJson || undefined,
          sectionTimingsJson: baseRecord.sectionTimingsJson || undefined,
        });

        if (cancelled) return;

        const persistedId = saveResult.id ?? null;
        if (persistedId === null) {
          throw new Error("The assessment could not be assigned a history record id.");
        }

        setSavedResultId(persistedId);
        await utils.results.list.invalidate();

        setStatusText("Running AI analysis...");
        const [readingResultSet, explanationResultSet, writingResultSet, speakingResultSet] = await Promise.allSettled([
          artifacts.readingInputs.length > 0
            ? checkReadingMutation.mutateAsync({
                answers: artifacts.readingInputs.map((item) => ({
                  questionId: item.questionId,
                  questionType: item.questionType,
                  questionText: item.questionText,
                  userAnswer: item.userAnswer,
                  correctAnswer: item.correctAnswer,
                  context: item.context,
                })),
              })
            : Promise.resolve([]),
          artifacts.wrongObjectiveAnswers.length > 0
            ? explainWrongAnswersMutation.mutateAsync({
                wrongAnswers: artifacts.wrongObjectiveAnswers,
              })
            : Promise.resolve([]),
          artifacts.writingTask
            ? evaluateWritingMutation.mutateAsync({
                essay: artifacts.writingTask.essay,
                topic: artifacts.writingTask.question.topic || artifacts.writingTask.question.instructions,
                wordCountTarget: artifacts.writingTask.question.wordCount || "No target specified",
              })
            : Promise.resolve(null),
          artifacts.speakingResponses.length > 0
            ? evaluateSpeakingMutation.mutateAsync({
                responses: artifacts.speakingResponses,
              })
            : Promise.resolve(null),
        ]);

        const readingResults = readingResultSet.status === "fulfilled" ? readingResultSet.value : [];
        const explanations = explanationResultSet.status === "fulfilled" ? explanationResultSet.value : [];
        const writingResult = writingResultSet.status === "fulfilled" ? writingResultSet.value : null;
        const speakingResult = speakingResultSet.status === "fulfilled" ? speakingResultSet.value : null;

        if (readingResultSet.status === "rejected" || explanationResultSet.status === "rejected" || writingResultSet.status === "rejected" || speakingResultSet.status === "rejected") {
          toast.error("Part of the AI analysis failed. Showing the report with the available results.");
        }

        const sectionResults = selectedPaper.sections.map((section) => {
          const objectiveScore = artifacts.objectiveBySection[section.id];
          const readingMatches = readingResults.filter((item) => item.questionId.startsWith(`${section.id}::`));
          const speakingMatches = speakingResult?.evaluations.filter((item) => item.sectionId === section.id) || [];
          const hasWriting = artifacts.writingTask?.sectionId === section.id;

          const correct = objectiveScore
            ? objectiveScore.correct
            : readingMatches.length > 0
              ? readingMatches.filter((item) => item.isCorrect).length
              : hasWriting && writingResult
                ? writingResult.score
                : speakingMatches.length > 0
                  ? speakingMatches.reduce((sum, item) => sum + item.score, 0)
                  : 0;
          const total = objectiveScore
            ? objectiveScore.total
            : readingMatches.length > 0
              ? readingMatches.length
              : hasWriting && writingResult
                ? writingResult.maxScore
                : speakingMatches.length > 0
                  ? speakingMatches.reduce((sum, item) => sum + item.maxScore, 0)
                  : 0;

          return {
            sectionId: section.id,
            sectionTitle: section.title,
            correct,
            total,
            timeSeconds: sectionTimings[section.id] || 0,
          };
        });

        const totalScore =
          artifacts.objectiveTotals.correct
          + readingResults.filter((item) => item.isCorrect).length
          + (writingResult?.score || 0)
          + (speakingResult?.totalScore || 0);
        const totalPossible =
          artifacts.objectiveTotals.total
          + readingResults.length
          + (writingResult?.maxScore || 0)
          + (speakingResult?.totalPossible || 0);
        const percentage = totalPossible > 0 ? Math.round((totalScore / totalPossible) * 100) : 0;
        const grade = getLetterGrade(totalScore, totalPossible);

        setStatusText("Generating the final report...");
        const reportResult = await generateReportMutation.mutateAsync({
          paperTitle: selectedPaper.title,
          studentName: studentInfo.name,
          studentGrade: studentInfo.grade,
          totalScore,
          totalPossible,
          percentage,
          grade,
          totalTimeSeconds,
          sectionResults,
          writingSummary: writingResult
            ? {
                score: writingResult.score,
                maxScore: writingResult.maxScore,
                grade: writingResult.grade,
                overallFeedback_en: writingResult.overallFeedback_en,
                overallFeedback_cn: writingResult.overallFeedback_cn,
                suggestions_en: writingResult.suggestions_en,
                suggestions_cn: writingResult.suggestions_cn,
                manualReviewRequired: writingResult.manualReviewRequired,
              }
            : undefined,
          speakingSummary: speakingResult || undefined,
        });

        if (cancelled) return;

        const sanitizedReport = sanitizeReportForStorage(reportResult);
        const nextRecord: AssessmentReviewRecord = {
          ...baseRecord,
          readingResultsJson: readingResults.length > 0 ? JSON.stringify(readingResults) : null,
          writingResultJson: writingResult ? JSON.stringify(writingResult) : null,
          explanationsJson: explanations.length > 0 ? JSON.stringify(explanations) : null,
          reportJson: JSON.stringify(sanitizedReport),
          createdAt: new Date(),
        };

        setRecord(nextRecord);
        writeCachedReview(cacheKey, {
          savedResultId: persistedId,
          record: nextRecord,
        });

        await updateResultMutation.mutateAsync({
          id: persistedId,
          readingResultsJson: nextRecord.readingResultsJson || undefined,
          writingResultJson: nextRecord.writingResultJson || undefined,
          explanationsJson: nextRecord.explanationsJson || undefined,
          reportJson: nextRecord.reportJson || undefined,
        });

        await Promise.all([
          utils.results.list.invalidate(),
          utils.results.getById.invalidate({ id: persistedId }),
        ]);
      } catch (error) {
        if (cancelled) return;

        const message = error instanceof Error ? error.message : "Unable to finish the assessment report.";
        setFatalError(message);
        setRecord(baseRecord);
        toast.error(message);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [
    cacheKey,
    checkReadingMutation,
    evaluateSpeakingMutation,
    evaluateWritingMutation,
    explainWrongAnswersMutation,
    generateReportMutation,
    getSectionTimings,
    getTotalTime,
    record,
    saveResultMutation,
    selectedPaper,
    state.answers,
    state.submitted,
    studentInfo,
    updateResultMutation,
    utils.results.getById,
    utils.results.list,
  ]);

  if (!selectedPaper || !studentInfo) {
    return (
      <div className="min-h-screen bg-[#F6F8FB] px-4 py-12">
        <div className="mx-auto max-w-4xl rounded-[32px] border border-amber-200 bg-amber-50 px-6 py-8 text-sm text-amber-900 shadow-sm">
          Assessment data is missing. Return to the home page and start a new assessment.
        </div>
      </div>
    );
  }

  if (!record) {
    return (
      <div className="min-h-screen bg-[#F6F8FB] px-4 py-12">
        <div className="mx-auto max-w-4xl rounded-[36px] border border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
          <h1 className="mt-6 text-3xl font-bold tracking-tight text-slate-900">
            Assessment Complete
          </h1>
          <p className="mt-3 text-sm text-slate-500">{statusText}</p>
          <p className="mt-1 text-xs text-slate-400">
            We are saving the answers, generating AI analysis, and building the final report.
          </p>
          {fatalError ? (
            <div className="mt-6 rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-900">
              {fatalError}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F8FB] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <AssessmentReportPanel
          record={record}
          showDownload
          extraHeaderActions={(
            <div className="flex flex-wrap items-center gap-2">
              {isTeacher ? (
                <Link href={savedResultId ? `/test-history?id=${savedResultId}` : "/test-history"}>
                  <Button
                    type="button"
                    variant="secondary"
                    className="gap-2 rounded-full border-white/20 bg-white/10 text-white hover:bg-white/15"
                  >
                    <History className="h-4 w-4" />
                    Test History
                  </Button>
                </Link>
              ) : null}
              <Button
                type="button"
                variant="secondary"
                onClick={resetQuiz}
                className="gap-2 rounded-full border-white/20 bg-white/10 text-white hover:bg-white/15"
              >
                <RotateCcw className="h-4 w-4" />
                Start Another Assessment
              </Button>
            </div>
          )}
        />
      </div>
    </div>
  );
}
