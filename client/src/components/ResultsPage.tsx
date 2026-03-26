import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import {
  CheckCircle2,
  FileSearch,
  History,
  Home,
  Loader2,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { toast } from "sonner";
import type { Paper } from "@/data/papers";
import { Button } from "@/components/ui/button";
import { useQuiz } from "@/contexts/QuizContext";
import { useLocalAuth } from "@/hooks/useLocalAuth";
import {
  buildSubmissionArtifacts,
  getLetterGrade,
  type AssessmentReviewRecord,
} from "@/lib/assessmentReview";
import {
  packStoredAssessmentPayloadForResultStorage,
  sanitizeReportForStorage,
} from "@/lib/resultStorage";
import {
  readLatestSavedResultId,
  writeLatestSavedResultId,
} from "@/lib/latestSavedResultId";
import { removeMatchingPendingTestResults } from "@/lib/pendingTestResults";
import { readSubmittedAssessmentSnapshot } from "@/lib/submittedAssessmentSnapshot";
import { trpc } from "@/lib/trpc";

type SubmissionContext = {
  paper: Paper;
  studentInfo: {
    name: string;
    grade: string;
  };
  answers: Record<string, unknown>;
  sectionTimings: Record<string, number>;
  endTime: number | null;
  totalTimeSeconds: number;
};

function summarizeSectionTaskTypes(section: Paper["sections"][number]) {
  const taskTypes = new Set<string>();

  if (section.passage) taskTypes.add("shared-passage");
  if (section.wordBank?.length) taskTypes.add("word-bank");
  if (section.sceneImageUrl) taskTypes.add("scene-image");
  if (section.matchingDescriptions?.length) taskTypes.add("matching");

  section.questions.forEach((question) => {
    taskTypes.add(question.type);

    if ("imageUrl" in question && typeof question.imageUrl === "string" && question.imageUrl.trim()) {
      taskTypes.add("question-image");
    }

    if ((question.type === "picture-mcq" || question.type === "listening-mcq") && question.options.some((option) => option.imageUrl?.trim())) {
      taskTypes.add("option-images");
    }

    if (question.type === "open-ended" && question.subQuestions?.length) {
      taskTypes.add("open-ended-sub");
    }
  });

  return Array.from(taskTypes);
}

function clampProgress(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

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

function getSnapshotTotalTimeSeconds(snapshot: ReturnType<typeof readSubmittedAssessmentSnapshot>) {
  if (!snapshot) return 0;
  if (snapshot.startTime && snapshot.endTime) {
    return Math.max(0, Math.round((snapshot.endTime - snapshot.startTime) / 1000));
  }
  return 0;
}

function buildProgressSteps(progressValue: number, fatalError: string | null, hasRecord: boolean) {
  return [
    {
      key: "upload",
      label: "Upload Answers",
      description: "Saving this attempt into test history.",
      done: progressValue >= 30 || hasRecord,
      active: !fatalError && progressValue < 30,
    },
    {
      key: "ai",
      label: "AI Scoring",
      description: "Checking passage open-ended, writing, and speaking.",
      done: progressValue >= 72 || hasRecord,
      active: !fatalError && progressValue >= 30 && progressValue < 72,
    },
    {
      key: "report",
      label: "Build Report",
      description: "Preparing the teacher review summary and history entry.",
      done: hasRecord || progressValue >= 100,
      active: !fatalError && progressValue >= 72 && !hasRecord,
    },
  ];
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
  const [statusTitle, setStatusTitle] = useState("Assessment Completed!");
  const [statusText, setStatusText] = useState("Preparing your submission...");
  const [progressValue, setProgressValue] = useState(10);
  const [fatalError, setFatalError] = useState<string | null>(null);

  const saveResultMutation = trpc.results.save.useMutation();
  const updateResultMutation = trpc.results.updateAI.useMutation();
  const checkReadingMutation = trpc.grading.checkReadingAnswers.useMutation();
  const explainWrongAnswersMutation = trpc.grading.explainWrongAnswers.useMutation();
  const evaluateWritingMutation = trpc.grading.evaluateWriting.useMutation();
  const evaluateSpeakingMutation = trpc.grading.evaluateSpeaking.useMutation();
  const generateReportMutation = trpc.grading.generateReport.useMutation();

  const saveResultRef = useRef(saveResultMutation);
  saveResultRef.current = saveResultMutation;
  const updateResultRef = useRef(updateResultMutation);
  updateResultRef.current = updateResultMutation;
  const checkReadingRef = useRef(checkReadingMutation);
  checkReadingRef.current = checkReadingMutation;
  const explainWrongRef = useRef(explainWrongAnswersMutation);
  explainWrongRef.current = explainWrongAnswersMutation;
  const evaluateWritingRef = useRef(evaluateWritingMutation);
  evaluateWritingRef.current = evaluateWritingMutation;
  const evaluateSpeakingRef = useRef(evaluateSpeakingMutation);
  evaluateSpeakingRef.current = evaluateSpeakingMutation;
  const generateReportRef = useRef(generateReportMutation);
  generateReportRef.current = generateReportMutation;
  const utilsRef = useRef(utils);
  utilsRef.current = utils;

  const submittedSnapshot = useMemo(
    () => readSubmittedAssessmentSnapshot(),
    [selectedPaper?.id, state.endTime, state.submitted, studentInfo?.name],
  );

  const submission = useMemo<SubmissionContext | null>(() => {
    if (selectedPaper && studentInfo && state.submitted) {
      return {
        paper: selectedPaper,
        studentInfo: {
          name: studentInfo.name,
          grade: studentInfo.grade,
        },
        answers: state.answers,
        sectionTimings: getSectionTimings(),
        endTime: state.endTime,
        totalTimeSeconds: getTotalTime(),
      };
    }

    if (!submittedSnapshot) return null;

    return {
      paper: submittedSnapshot.paper,
      studentInfo: submittedSnapshot.studentInfo,
      answers: submittedSnapshot.answers,
      sectionTimings: submittedSnapshot.sectionTimings,
      endTime: submittedSnapshot.endTime,
      totalTimeSeconds: getSnapshotTotalTimeSeconds(submittedSnapshot),
    };
  }, [
    getSectionTimings,
    getTotalTime,
    selectedPaper,
    state.answers,
    state.endTime,
    state.submitted,
    studentInfo,
    submittedSnapshot,
  ]);

  const cacheKey = useMemo(() => {
    if (!submission) return null;
    return getCacheKey({
      paperId: submission.paper.id,
      studentName: submission.studentInfo.name,
      studentGrade: submission.studentInfo.grade,
      endTime: submission.endTime,
    });
  }, [submission]);

  const latestSavedResultId = useMemo(
    () => savedResultId ?? readLatestSavedResultId(),
    [savedResultId],
  );

  useEffect(() => {
    if (!cacheKey || record) return;

    const cached = readCachedReview(cacheKey);
    if (!cached) return;

    setSavedResultId(cached.savedResultId);
    if (cached.savedResultId) {
      writeLatestSavedResultId(cached.savedResultId);
    }
    setRecord(cached.record);
    setStatusText("Upload complete. The report is ready in test history.");
    setProgressValue(100);
  }, [cacheKey, record]);

  useEffect(() => {
    if (!submission || !cacheKey || record) return;

    let cancelled = false;

    const run = async () => {
      const answersJson = packStoredAssessmentPayloadForResultStorage(submission.answers, submission.paper);
      const artifacts = buildSubmissionArtifacts(submission.paper, submission.answers);
      const baseRecord = buildFallbackRecord({
        studentName: submission.studentInfo.name,
        studentGrade: submission.studentInfo.grade || null,
        paperId: submission.paper.id,
        paperTitle: submission.paper.title,
        totalCorrect: artifacts.objectiveTotals.correct,
        totalQuestions: artifacts.objectiveTotals.total,
        totalTimeSeconds: submission.totalTimeSeconds,
        answersJson,
        scoreBySectionJson: JSON.stringify(artifacts.objectiveBySection),
        sectionTimingsJson: JSON.stringify(submission.sectionTimings),
      });

      try {
        setStatusTitle("Assessment Completed!");
        setStatusText("Uploading your answers to test history...");
        setProgressValue(24);

        const savePayload = {
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
        };

        const saveResult = await saveResultRef.current.mutateAsync(savePayload);

        if (cancelled) return;

        const persistedId = saveResult.id ?? null;
        if (persistedId === null) {
          throw new Error("The assessment could not be assigned a history record id.");
        }

        removeMatchingPendingTestResults(savePayload);
        setSavedResultId(persistedId);
        writeLatestSavedResultId(persistedId);
        setProgressValue(38);
        await utilsRef.current.results.list.invalidate();

        setStatusText("Running AI scoring for open-ended responses, writing, and speaking...");
        setProgressValue(58);

        const [readingResultSet, explanationResultSet, writingResultSet, speakingResultSet] = await Promise.allSettled([
          artifacts.readingInputs.length > 0
            ? checkReadingRef.current.mutateAsync({
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
            ? explainWrongRef.current.mutateAsync({
                wrongAnswers: artifacts.wrongObjectiveAnswers,
              })
            : Promise.resolve([]),
          artifacts.writingTask
            ? evaluateWritingRef.current.mutateAsync({
                essay: artifacts.writingTask.essay,
                topic: artifacts.writingTask.question.topic || artifacts.writingTask.question.instructions,
                wordCountTarget: artifacts.writingTask.question.wordCount || "No target specified",
              })
            : Promise.resolve(null),
          artifacts.speakingResponses.length > 0
            ? evaluateSpeakingRef.current.mutateAsync({
                responses: artifacts.speakingResponses,
              })
            : Promise.resolve(null),
        ]);

        const readingResults = readingResultSet.status === "fulfilled" ? readingResultSet.value : [];
        const explanations = explanationResultSet.status === "fulfilled" ? explanationResultSet.value : [];
        const writingResult = writingResultSet.status === "fulfilled" ? writingResultSet.value : null;
        const speakingResult = speakingResultSet.status === "fulfilled" ? speakingResultSet.value : null;

        if (
          readingResultSet.status === "rejected"
          || explanationResultSet.status === "rejected"
          || writingResultSet.status === "rejected"
          || speakingResultSet.status === "rejected"
        ) {
          toast.error("Part of the AI analysis failed. The attempt is still saved in test history.");
        }

        setStatusText("Building the final teacher report...");
        setProgressValue(82);

        const sectionResults = submission.paper.sections.map((section) => {
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
            timeSeconds: submission.sectionTimings[section.id] || 0,
            taskTypes: summarizeSectionTaskTypes(section),
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

        const reportResult = await generateReportRef.current.mutateAsync({
          paperTitle: submission.paper.title,
          studentName: submission.studentInfo.name,
          studentGrade: submission.studentInfo.grade,
          totalScore,
          totalPossible,
          percentage,
          grade,
          totalTimeSeconds: submission.totalTimeSeconds,
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
        setStatusText("Upload complete. Your full report is now available in test history.");
        setProgressValue(100);
        writeCachedReview(cacheKey, {
          savedResultId: persistedId,
          record: nextRecord,
        });

        await updateResultRef.current.mutateAsync({
          id: persistedId,
          readingResultsJson: nextRecord.readingResultsJson || undefined,
          writingResultJson: nextRecord.writingResultJson || undefined,
          explanationsJson: nextRecord.explanationsJson || undefined,
          reportJson: nextRecord.reportJson || undefined,
        });

        await Promise.all([
          utilsRef.current.results.list.invalidate(),
          utilsRef.current.results.getById.invalidate({ id: persistedId }),
        ]);
      } catch (error) {
        if (cancelled) return;

        const message = error instanceof Error ? error.message : "Unable to finish the assessment report.";
        setFatalError(message);
        setStatusTitle("Upload Interrupted");
        setStatusText("This attempt could not finish uploading. You can return home and try again.");
        setProgressValue((current) => clampProgress(Math.max(current, 32)));
        toast.error(message);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    cacheKey,
    record,
    submission,
  ]);

  const displayStudentName = record?.studentName || submission?.studentInfo.name || "Student";
  const displayPaperTitle = record?.paperTitle || submission?.paper.title || "Assessment";
  const displayProgress = hasNumber(progressValue) ? clampProgress(progressValue) : 0;
  const progressSteps = buildProgressSteps(displayProgress, fatalError, Boolean(record));

  if (!submission && !record) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(125,211,252,0.22),_transparent_38%),linear-gradient(180deg,#f8fbff_0%,#eef4ff_100%)] px-4 py-12">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-[8%] top-16 h-36 w-36 rounded-full bg-[#B9E6FF]/50 blur-3xl" />
          <div className="absolute right-[10%] top-24 h-44 w-44 rounded-full bg-[#FFE4B8]/45 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="rounded-[36px] border border-white/70 bg-white/88 p-8 shadow-[0_30px_80px_rgba(15,23,42,0.12)] backdrop-blur"
          >
            <div className="flex items-center gap-3 text-[#1E3A5F]">
              <div className="rounded-full bg-[#E0F2FE] p-3">
                <Home className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">Assessment Page Couldn&apos;t Be Restored</h1>
                <p className="mt-1 text-sm text-slate-500">
                  This tab no longer has the live assessment context. Use the buttons below to continue.
                </p>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              {isTeacher && latestSavedResultId ? (
                <Link href={`/test-history?id=${latestSavedResultId}`}>
                  <Button type="button" className="gap-2 rounded-full bg-[#1E3A5F] hover:bg-[#16314F]">
                    <History className="h-4 w-4" />
                    Open Latest Test History
                  </Button>
                </Link>
              ) : null}
              <Button type="button" variant="outline" onClick={resetQuiz} className="gap-2 rounded-full">
                <Home className="h-4 w-4" />
                Return Home
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(125,211,252,0.18),_transparent_35%),linear-gradient(180deg,#f7fbff_0%,#eef4ff_100%)] px-4 py-10 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0">
        <motion.div
          className="absolute left-[6%] top-12 h-48 w-48 rounded-full bg-[#C9F1FF]/60 blur-3xl"
          animate={{ y: [0, 16, 0] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute right-[10%] top-16 h-52 w-52 rounded-full bg-[#FFE8C8]/55 blur-3xl"
          animate={{ y: [0, -18, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-10 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-[#DDE7FF]/60 blur-3xl"
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <div className="relative mx-auto max-w-5xl">
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="overflow-hidden rounded-[40px] border border-white/75 bg-white/88 shadow-[0_30px_90px_rgba(15,23,42,0.12)] backdrop-blur"
        >
          <div className="relative overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.28),_transparent_34%),linear-gradient(135deg,#10213a_0%,#1d4ed8_100%)] px-6 py-10 text-white sm:px-10">
            <div className="absolute right-8 top-8 opacity-25">
              <WandSparkles className="h-24 w-24" />
            </div>
            <div className="relative flex flex-wrap items-start justify-between gap-6">
              <div className="max-w-2xl">
                <motion.div
                  initial={{ scale: 0.92, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1, duration: 0.35 }}
                  className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-blue-50"
                >
                  {record ? <CheckCircle2 className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                  {record ? "Upload Complete" : "Assessment Completed"}
                </motion.div>
                <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-5xl">
                  {statusTitle}
                </h1>
                <p className="mt-4 max-w-2xl text-base leading-7 text-blue-100 sm:text-lg">
                  {record
                    ? `Everything for ${displayStudentName}'s assessment has been uploaded. You can return home or open test history to review the full report.`
                    : "Your answers are being uploaded and processed. Please keep this page open until the upload bar reaches 100%."}
                </p>
              </div>

              <div className="min-w-[220px] rounded-[28px] border border-white/15 bg-white/10 px-5 py-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-100">Assessment</p>
                <p className="mt-2 text-xl font-bold text-white">{displayPaperTitle}</p>
                <p className="mt-2 text-sm text-blue-100">
                  {displayStudentName}
                  {latestSavedResultId ? ` · History #${latestSavedResultId}` : ""}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-8 px-6 py-8 sm:px-10">
            <div className="rounded-[30px] border border-slate-200 bg-slate-50/90 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {fatalError ? "Upload status" : "Processing status"}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">{statusText}</p>
                </div>
                <div className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">
                  {displayProgress}%
                </div>
              </div>

              <div className="mt-5 h-4 overflow-hidden rounded-full bg-white shadow-inner">
                <motion.div
                  className={`h-full rounded-full ${
                    fatalError
                      ? "bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500"
                      : "bg-gradient-to-r from-emerald-400 via-sky-500 to-indigo-500"
                  }`}
                  initial={{ width: "0%" }}
                  animate={{ width: `${displayProgress}%` }}
                  transition={{ duration: 0.45, ease: "easeOut" }}
                />
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              {progressSteps.map((step, index) => {
                const icon = step.done
                  ? <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  : step.active
                    ? <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                    : <span className="text-sm font-bold text-slate-400">0{index + 1}</span>;

                return (
                  <motion.div
                    key={step.key}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + index * 0.08, duration: 0.35 }}
                    className={`rounded-[28px] border p-5 ${
                      step.done
                        ? "border-emerald-200 bg-emerald-50/80"
                        : step.active
                          ? "border-blue-200 bg-blue-50/85"
                          : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm">
                        {icon}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{step.label}</p>
                        <p className="mt-1 text-sm text-slate-500">{step.description}</p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {fatalError ? (
              <div className="rounded-[28px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm leading-7 text-rose-900">
                {fatalError}
              </div>
            ) : null}

            <div className="rounded-[30px] border border-slate-200 bg-white p-6">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-[#E0F2FE] p-3 text-[#0F6CBD]">
                  <FileSearch className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-slate-900">What happens next</h2>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    This page handles the upload and AI processing only. The detailed analysis, every part score,
                    question-by-question review, passage open-ended grading, writing evaluation, speaking evaluation,
                    and PDF download all live in <span className="font-semibold text-slate-900">Teacher Tools → Test History</span>.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                {isTeacher && latestSavedResultId ? (
                  <Link href={`/test-history?id=${latestSavedResultId}`}>
                    <Button type="button" className="gap-2 rounded-full bg-[#1E3A5F] hover:bg-[#16314F]">
                      <History className="h-4 w-4" />
                      Open Test History
                    </Button>
                  </Link>
                ) : null}

                <Button
                  type="button"
                  variant="outline"
                  onClick={resetQuiz}
                  disabled={!record && !fatalError}
                  className="gap-2 rounded-full"
                >
                  <Home className="h-4 w-4" />
                  Return Home
                </Button>

                {!record && !fatalError ? (
                  <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Waiting for upload to finish
                  </div>
                ) : null}
              </div>

              {record ? (
                <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  Upload finished. You can safely leave this page.
                </div>
              ) : null}
            </div>
          </div>
        </motion.section>
      </div>
    </div>
  );
}

function hasNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
