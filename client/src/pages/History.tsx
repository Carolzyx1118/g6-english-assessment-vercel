import { trpc } from '@/lib/trpc';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'wouter';
import {
  ArrowLeft,
  Trash2,
  Calendar,
  Clock,
  Award,
  User,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Download,
  Loader2,
  Mic,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { motion, AnimatePresence } from 'framer-motion';
import { generateReportPDF, type PDFData } from '@/lib/generatePDF';
import {
  getPaperById,
  type Paper,
  type PaperCategory,
  PAPER_SUBJECT_ORDER,
  type PaperSubject,
  type Question,
  type Section,
} from '@/data/papers';
import { blueprintToPaper } from '@shared/blueprintToPaper';
import type { ManualPaperBlueprint } from '@shared/manualPaperBlueprint';
import type {
  AssessmentReportResult,
  SpeakingEvaluationResult,
  SpeakingQuestionEvaluation,
} from '@shared/assessmentReport';

type Lang = 'en' | 'cn';

type ReadingGradingResult = {
  questionId: string;
  isCorrect: boolean;
  score: number;
};

type WritingEvalResult = {
  score: number;
  maxScore: number;
  grade: string;
  overallFeedback_en: string;
  overallFeedback_cn: string;
  grammarErrors: { original: string; correction: string; explanation_en: string; explanation_cn: string }[];
  correctedEssay: string;
  annotatedEssay: string;
  suggestions_en: string[];
  suggestions_cn: string[];
  reviewMode?: 'ai' | 'manual';
  manualReviewRequired?: boolean;
};

type WritingSubmission = {
  sectionId: string;
  sectionTitle: string;
  topic: string;
  instructions: string;
  wordCount: string;
  essay: string;
};

type HistorySpeakingResponse = {
  label: string;
  sectionId: string;
  sectionTitle: string;
  questionId: number;
  prompt: string;
  audioUrl: string;
};

type TeacherWritingDraft = {
  score: string;
  maxScore: string;
  feedback: string;
  suggestions: string;
};

type TeacherSpeakingItemDraft = HistorySpeakingResponse & {
  score: string;
  maxScore: string;
  feedback: string;
  suggestions: string;
};

type TeacherSpeakingDraft = {
  overallFeedback: string;
  items: TeacherSpeakingItemDraft[];
};

function safeParseJSON<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

function answerKey(sectionId: string, questionId: number) {
  return `${sectionId}:${questionId}`;
}

function isUrlLike(value: string) {
  return value.startsWith('http://') || value.startsWith('https://') || value.startsWith('blob:');
}

function isLikelyAudioUrl(value: string) {
  return (
    isUrlLike(value) &&
    (/(\.webm|\.mp3|\.mpeg|\.mp4|\.m4a|\.wav|\.ogg|\.aac)(\?|$)/i.test(value) ||
      /(?:^|\/)(speaking|audio)[-_./]/i.test(value) ||
      /[?&](?:filename|fileName)=.*(\.webm|\.mp3|\.mpeg|\.mp4|\.m4a|\.wav|\.ogg|\.aac)/i.test(value))
  );
}

function extractAudioUrls(value: unknown): string[] {
  if (typeof value === 'string') {
    if (isLikelyAudioUrl(value)) return [value];
    if ((value.startsWith('{') || value.startsWith('[')) && value.length > 1) {
      try {
        return extractAudioUrls(JSON.parse(value));
      } catch {
        return [];
      }
    }
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => extractAudioUrls(entry));
  }

  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).flatMap((entry) => extractAudioUrls(entry));
  }

  return [];
}

function getAudioSourceType(audioUrl: string) {
  const normalized = audioUrl.toLowerCase();
  if (normalized.includes('.mp3') || normalized.includes('.mpeg')) return 'audio/mpeg';
  if (normalized.includes('.wav')) return 'audio/wav';
  if (normalized.includes('.ogg')) return 'audio/ogg';
  if (normalized.includes('.m4a') || normalized.includes('.aac') || normalized.includes('.mp4')) return 'audio/mp4';
  return 'audio/webm';
}

function formatSectionLabel(sectionId: string) {
  return sectionId
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getGradeInfo(correct: number, total: number) {
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  if (pct >= 90) return { grade: 'A', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
  if (pct >= 75) return { grade: 'B', color: 'bg-blue-100 text-blue-700 border-blue-200' };
  if (pct >= 60) return { grade: 'C', color: 'bg-amber-100 text-amber-700 border-amber-200' };
  return { grade: 'D', color: 'bg-red-100 text-red-700 border-red-200' };
}

function getGradeLetter(score: number, total: number) {
  return getGradeInfo(score, total).grade;
}

function splitSuggestions(value: string) {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

function isWritingLikeSection(section: Section) {
  return (
    section.id === 'writing' ||
    section.id.startsWith('writing') ||
    section.sectionType === 'writing' ||
    section.questions.some((question) => question.type === 'writing')
  );
}

function isSpeakingLikeSection(section: Section) {
  return (
    section.id === 'speaking' ||
    section.id.startsWith('speaking') ||
    section.sectionType === 'speaking' ||
    section.questions.some((question) => {
      if (question.type !== 'open-ended') return false;
      return question.responseMode === 'audio';
    })
  );
}

function toHistoryPaper(raw: {
  paperId: string;
  subject: string;
  category: string;
  blueprintJson: string;
}): Paper | undefined {
  try {
    const subject = PAPER_SUBJECT_ORDER.includes(raw.subject as PaperSubject)
      ? (raw.subject as PaperSubject)
      : 'english';
    const blueprint: ManualPaperBlueprint = JSON.parse(raw.blueprintJson);
    const converted = blueprintToPaper(blueprint, {
      subject,
      category: raw.category,
    });
    return {
      ...converted,
      id: raw.paperId,
      subject,
      category: (raw.category || 'assessment') as PaperCategory,
      sections: converted.sections as unknown as Section[],
    };
  } catch {
    return undefined;
  }
}

function extractWritingSubmission(paper: Paper | undefined, answers: Record<string, unknown>): WritingSubmission | null {
  if (!paper) return null;

  const writingSection = paper.sections.find(isWritingLikeSection);
  if (!writingSection) return null;

  const writingQuestion = writingSection.questions.find(
    (question): question is Extract<Question, { type: 'writing' }> => question.type === 'writing',
  );
  if (!writingQuestion) return null;

  const essay = answers[answerKey(writingSection.id, writingQuestion.id)];
  return {
    sectionId: writingSection.id,
    sectionTitle: writingSection.title,
    topic: writingQuestion.topic,
    instructions: writingQuestion.instructions,
    wordCount: writingQuestion.wordCount,
    essay: typeof essay === 'string' ? essay : '',
  };
}

function extractSpeakingResponses(paper: Paper | undefined, answers: Record<string, unknown>): HistorySpeakingResponse[] {
  const responses: HistorySpeakingResponse[] = [];
  const seen = new Set<string>();

  const addResponse = (response: HistorySpeakingResponse) => {
    if (seen.has(response.audioUrl)) return;
    seen.add(response.audioUrl);
    responses.push(response);
  };

  if (paper) {
    for (const section of paper.sections) {
      if (!isSpeakingLikeSection(section)) continue;

      for (const question of section.questions) {
        const answer = answers[answerKey(section.id, question.id)];
        const audioUrls = extractAudioUrls(answer);
        if (audioUrls.length === 0) continue;
        const prompt =
          'question' in question && typeof question.question === 'string'
            ? question.question
            : section.taskDescription || section.description || section.title;

        audioUrls.forEach((audioUrl, audioIndex) => {
          addResponse({
            label: audioUrls.length > 1 ? `Q${question.id} (${audioIndex + 1})` : `Q${question.id}`,
            sectionId: section.id,
            sectionTitle: section.title,
            questionId: question.id,
            prompt,
            audioUrl,
          });
        });
      }
    }
  }

  if (responses.length > 0) return responses;

  const fallback: HistorySpeakingResponse[] = [];
  const fallbackSeen = new Set<string>();
  for (const [key, value] of Object.entries(answers)) {
    const audioUrls = extractAudioUrls(value);
    if (audioUrls.length === 0) continue;

    const numericId = Number(key.replace(/\D/g, '')) || 0;
    audioUrls.forEach((audioUrl, audioIndex) => {
      if (fallbackSeen.has(audioUrl)) return;
      fallbackSeen.add(audioUrl);
      fallback.push({
        label: audioUrls.length > 1 ? `Q${numericId || key} (${audioIndex + 1})` : `Q${numericId || key}`,
        sectionId: 'speaking',
        sectionTitle: 'Speaking',
        questionId: numericId,
        prompt: audioUrls.length > 1 ? `Speaking response ${numericId || key} (${audioIndex + 1})` : `Speaking response ${numericId || key}`,
        audioUrl,
      });
    });
  }

  return fallback;
}

function buildWritingDraft(result: WritingEvalResult | null): TeacherWritingDraft {
  return {
    score: result && result.maxScore > 0 ? String(result.score) : '',
    maxScore: result && result.maxScore > 0 ? String(result.maxScore) : '',
    feedback: result?.overallFeedback_en || '',
    suggestions: (result?.suggestions_en || []).join('\n'),
  };
}

function buildSpeakingDraft(
  responses: HistorySpeakingResponse[],
  evaluation: SpeakingEvaluationResult | null,
): TeacherSpeakingDraft {
  return {
    overallFeedback: evaluation?.overallFeedback_en || '',
    items: responses.map((response) => {
      const existing = evaluation?.evaluations.find(
        (item) => item.sectionId === response.sectionId && item.questionId === response.questionId,
      );
      return {
        ...response,
        score: existing && existing.maxScore > 0 ? String(existing.score) : '',
        maxScore: existing && existing.maxScore > 0 ? String(existing.maxScore) : '',
        feedback: existing?.feedback_en || '',
        suggestions: (existing?.suggestions_en || []).join('\n'),
      };
    }),
  };
}

function buildTeacherWritingResult(draft: TeacherWritingDraft): WritingEvalResult {
  const score = Number(draft.score);
  const maxScore = Number(draft.maxScore);
  const suggestions = splitSuggestions(draft.suggestions);
  const feedback = draft.feedback.trim();

  return {
    score,
    maxScore,
    grade: getGradeLetter(score, maxScore),
    overallFeedback_en: feedback,
    overallFeedback_cn: feedback,
    grammarErrors: [],
    correctedEssay: '',
    annotatedEssay: '',
    suggestions_en: suggestions,
    suggestions_cn: suggestions,
    reviewMode: 'manual',
    manualReviewRequired: false,
  };
}

function buildTeacherSpeakingEvaluation(draft: TeacherSpeakingDraft): SpeakingEvaluationResult {
  const evaluations: SpeakingQuestionEvaluation[] = draft.items.map((item) => {
    const score = Number(item.score);
    const maxScore = Number(item.maxScore);
    const feedback = item.feedback.trim();
    const feedbackEn = feedback || 'Teacher reviewed this speaking response manually.';
    const feedbackCn = feedback || '老师已完成这道口语题的人工评分。';
    const suggestions = splitSuggestions(item.suggestions);

    return {
      sectionId: item.sectionId,
      sectionTitle: item.sectionTitle,
      questionId: item.questionId,
      prompt: item.prompt,
      audioUrl: item.audioUrl,
      transcript: '',
      score,
      maxScore,
      grade: getGradeLetter(score, maxScore),
      feedback_en: feedbackEn,
      feedback_cn: feedbackCn,
      taskCompletion_en: feedbackEn,
      taskCompletion_cn: feedbackCn,
      fluency_en: feedbackEn,
      fluency_cn: feedbackCn,
      vocabulary_en: feedbackEn,
      vocabulary_cn: feedbackCn,
      grammar_en: feedbackEn,
      grammar_cn: feedbackCn,
      pronunciation_en: feedbackEn,
      pronunciation_cn: feedbackCn,
      suggestions_en: suggestions,
      suggestions_cn: suggestions,
      reviewMode: 'manual',
      manualReviewRequired: false,
    };
  });

  const totalScore = evaluations.reduce((sum, item) => sum + item.score, 0);
  const totalPossible = evaluations.reduce((sum, item) => sum + item.maxScore, 0);
  const overallFeedback = draft.overallFeedback.trim();
  const overallFeedbackEn = overallFeedback || `Teacher completed a manual speaking review for ${evaluations.length} response(s).`;
  const overallFeedbackCn = overallFeedback || `老师已完成 ${evaluations.length} 道口语作答的人工评分。`;

  return {
    totalScore,
    totalPossible,
    grade: getGradeLetter(totalScore, totalPossible),
    overallFeedback_en: overallFeedbackEn,
    overallFeedback_cn: overallFeedbackCn,
    evaluations,
    reviewMode: 'manual',
    manualReviewRequired: false,
  };
}

function formatDate(date: Date | string) {
  const d = new Date(date);
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatTime(seconds: number | null) {
  if (!seconds) return '--';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

export default function History() {
  return <HistoryContent />;
}

function HistoryContent() {
  const { data: results, isLoading, refetch } = trpc.results.list.useQuery();
  const deleteMutation = trpc.results.delete.useMutation({
    onSuccess: () => refetch(),
  });
  const updateAIMutation = trpc.results.updateAI.useMutation();
  const generateReportMutation = trpc.grading.generateReport.useMutation();

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [lang, setLang] = useState<Lang>('en');
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [writingDraft, setWritingDraft] = useState<TeacherWritingDraft | null>(null);
  const [speakingDraft, setSpeakingDraft] = useState<TeacherSpeakingDraft | null>(null);
  const [teacherReviewError, setTeacherReviewError] = useState<string | null>(null);
  const [teacherReviewSuccess, setTeacherReviewSuccess] = useState<string | null>(null);

  const { data: detail, refetch: refetchDetail } = trpc.results.getById.useQuery(
    { id: selectedId! },
    { enabled: selectedId !== null },
  );

  const staticPaper = useMemo(
    () => (detail?.paperId ? getPaperById(detail.paperId) : undefined),
    [detail?.paperId],
  );

  const manualPaperDetailQuery = trpc.papers.getManualPaperDetail.useQuery(
    { paperId: detail?.paperId || '' },
    {
      enabled: Boolean(detail?.paperId && !staticPaper),
      staleTime: 30_000,
    },
  );

  const paper = useMemo(() => {
    if (staticPaper) return staticPaper;
    if (!manualPaperDetailQuery.data) return undefined;
    return toHistoryPaper(manualPaperDetailQuery.data);
  }, [manualPaperDetailQuery.data, staticPaper]);

  const answers = useMemo(
    () => safeParseJSON<Record<string, unknown>>(detail?.answersJson, {}),
    [detail?.answersJson],
  );
  const bySection = useMemo(
    () => safeParseJSON<Record<string, { correct: number; total: number }>>(detail?.scoreBySectionJson, {}),
    [detail?.scoreBySectionJson],
  );
  const sectionTimings = useMemo(
    () => safeParseJSON<Record<string, number>>(detail?.sectionTimingsJson, {}),
    [detail?.sectionTimingsJson],
  );
  const readingResults = useMemo(
    () => safeParseJSON<ReadingGradingResult[] | null>(detail?.readingResultsJson, null),
    [detail?.readingResultsJson],
  );
  const writingResult = useMemo(
    () => safeParseJSON<WritingEvalResult | null>(detail?.writingResultJson, null),
    [detail?.writingResultJson],
  );
  const report = useMemo(
    () => safeParseJSON<AssessmentReportResult | null>(detail?.reportJson, null),
    [detail?.reportJson],
  );
  const speakingEvaluation = report?.speakingEvaluation ?? null;

  const writingSubmission = useMemo(
    () => extractWritingSubmission(paper, answers),
    [answers, paper],
  );
  const speakingResponses = useMemo(
    () => extractSpeakingResponses(paper, answers),
    [answers, paper],
  );
  const hasSpeakingSection = useMemo(
    () => paper?.sections.some(isSpeakingLikeSection) ?? false,
    [paper],
  );

  const writingResetKey = `${detail?.id ?? 'none'}:${detail?.writingResultJson ?? 'none'}:${writingSubmission?.essay ?? 'none'}`;
  const speakingResetKey = JSON.stringify({
    id: detail?.id ?? null,
    report: detail?.reportJson ?? null,
    responses: speakingResponses.map((item) => ({
      sectionId: item.sectionId,
      questionId: item.questionId,
      audioUrl: item.audioUrl,
    })),
  });

  useEffect(() => {
    setTeacherReviewError(null);
    setTeacherReviewSuccess(null);
    setWritingDraft(writingSubmission ? buildWritingDraft(writingResult) : null);
  }, [writingResetKey, writingSubmission, writingResult]);

  useEffect(() => {
    setTeacherReviewError(null);
    setTeacherReviewSuccess(null);
    setSpeakingDraft(speakingResponses.length > 0 ? buildSpeakingDraft(speakingResponses, speakingEvaluation) : null);
  }, [speakingResetKey, speakingEvaluation, speakingResponses]);

  const handleDownloadPDF = async (fullRecord: NonNullable<typeof detail>) => {
    setDownloadingId(fullRecord.id);
    try {
      const pdfData: PDFData = {
        studentName: fullRecord.studentName,
        studentGrade: fullRecord.studentGrade,
        paperId: fullRecord.paperId,
        paperTitle: fullRecord.paperTitle,
        totalCorrect: fullRecord.totalCorrect,
        totalQuestions: fullRecord.totalQuestions,
        totalTimeSeconds: fullRecord.totalTimeSeconds,
        answersJson: fullRecord.answersJson,
        scoreBySectionJson: fullRecord.scoreBySectionJson,
        sectionTimingsJson: fullRecord.sectionTimingsJson,
        readingResultsJson: fullRecord.readingResultsJson,
        writingResultJson: fullRecord.writingResultJson,
        explanationsJson: fullRecord.explanationsJson,
        reportJson: fullRecord.reportJson,
        createdAt: fullRecord.createdAt,
      };

      await generateReportPDF(pdfData, 'cn');
    } catch (err) {
      console.error('[History] PDF download failed:', err);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleTeacherReport = async () => {
    if (!detail) return;

    setTeacherReviewError(null);
    setTeacherReviewSuccess(null);

    let nextWritingResult: WritingEvalResult | undefined;
    if (writingSubmission && writingDraft) {
      const score = Number(writingDraft.score);
      const maxScore = Number(writingDraft.maxScore);
      if (!Number.isFinite(score) || !Number.isFinite(maxScore) || maxScore <= 0 || score < 0 || score > maxScore) {
        setTeacherReviewError(lang === 'en' ? 'Please enter a valid writing score and full score.' : '请先填写有效的作文得分和满分。');
        return;
      }
      if (!writingDraft.feedback.trim()) {
        setTeacherReviewError(lang === 'en' ? 'Please add a writing teacher comment before generating the report.' : '生成报告前请先填写作文老师评语。');
        return;
      }
      nextWritingResult = buildTeacherWritingResult(writingDraft);
    }

    let nextSpeakingEvaluation: SpeakingEvaluationResult | undefined;
    if (speakingResponses.length > 0 && speakingDraft) {
      for (const item of speakingDraft.items) {
        const score = Number(item.score);
        const maxScore = Number(item.maxScore);
        if (!Number.isFinite(score) || !Number.isFinite(maxScore) || maxScore <= 0 || score < 0 || score > maxScore) {
          setTeacherReviewError(lang === 'en' ? `Please enter a valid score for ${item.label}.` : `请先为 ${item.label} 填写有效分数。`);
          return;
        }
        if (!item.feedback.trim()) {
          setTeacherReviewError(lang === 'en' ? `Please add a teacher comment for ${item.label}.` : `请先为 ${item.label} 填写老师评语。`);
          return;
        }
      }
      nextSpeakingEvaluation = buildTeacherSpeakingEvaluation(speakingDraft);
    }

    const readingScore = readingResults ? readingResults.reduce((sum, item) => sum + item.score, 0) : 0;
    const readingTotal = readingResults ? readingResults.length : 0;
    const writingScore = nextWritingResult?.score ?? 0;
    const writingTotal = nextWritingResult?.maxScore ?? 0;
    const speakingScore = nextSpeakingEvaluation?.totalScore ?? 0;
    const speakingTotal = nextSpeakingEvaluation?.totalPossible ?? 0;
    const totalScore = detail.totalCorrect + readingScore + writingScore + speakingScore;
    const totalPossible = detail.totalQuestions + readingTotal + writingTotal + speakingTotal;
    const percentage = totalPossible > 0 ? Math.round((totalScore / totalPossible) * 100) : 0;
    const grade = getGradeLetter(totalScore, totalPossible);

    const sectionSources = paper?.sections ?? Object.keys(bySection).map((sectionId) => ({
      id: sectionId,
      title: formatSectionLabel(sectionId),
    }));

    const sectionResults = sectionSources.map((section) => {
      const sectionId = section.id;
      const sectionTitle = section.title;

      if (sectionId === 'reading' || (typeof (section as Section).sectionType === 'string' && (section as Section).sectionType === 'reading')) {
        return {
          sectionId,
          sectionTitle,
          correct: readingScore,
          total: readingTotal,
          timeSeconds: sectionTimings[sectionId] || 0,
        };
      }

      if (paper && isWritingLikeSection(section as Section)) {
        return {
          sectionId,
          sectionTitle,
          correct: nextWritingResult?.score ?? 0,
          total: nextWritingResult?.maxScore ?? 0,
          timeSeconds: sectionTimings[sectionId] || 0,
        };
      }

      if (paper && isSpeakingLikeSection(section as Section)) {
        const evaluations = nextSpeakingEvaluation?.evaluations.filter((item) => item.sectionId === sectionId) || [];
        return {
          sectionId,
          sectionTitle,
          correct: evaluations.reduce((sum, item) => sum + item.score, 0),
          total: evaluations.reduce((sum, item) => sum + item.maxScore, 0),
          timeSeconds: sectionTimings[sectionId] || 0,
        };
      }

      return {
        sectionId,
        sectionTitle,
        correct: bySection[sectionId]?.correct || 0,
        total: bySection[sectionId]?.total || 0,
        timeSeconds: sectionTimings[sectionId] || 0,
      };
    });

    if (nextWritingResult && !sectionResults.some((item) => item.sectionId === writingSubmission?.sectionId)) {
      sectionResults.push({
        sectionId: writingSubmission?.sectionId || 'writing',
        sectionTitle: writingSubmission?.sectionTitle || 'Writing',
        correct: nextWritingResult.score,
        total: nextWritingResult.maxScore,
        timeSeconds: sectionTimings[writingSubmission?.sectionId || 'writing'] || 0,
      });
    }

    if (nextSpeakingEvaluation) {
      const speakingSections = Array.from(new Set(nextSpeakingEvaluation.evaluations.map((item) => item.sectionId)));
      for (const sectionId of speakingSections) {
        if (sectionResults.some((item) => item.sectionId === sectionId)) continue;
        const evaluations = nextSpeakingEvaluation.evaluations.filter((item) => item.sectionId === sectionId);
        sectionResults.push({
          sectionId,
          sectionTitle: evaluations[0]?.sectionTitle || formatSectionLabel(sectionId),
          correct: evaluations.reduce((sum, item) => sum + item.score, 0),
          total: evaluations.reduce((sum, item) => sum + item.maxScore, 0),
          timeSeconds: sectionTimings[sectionId] || 0,
        });
      }
    }

    try {
      const nextReport = await generateReportMutation.mutateAsync({
        paperTitle: detail.paperTitle,
        studentName: detail.studentName,
        studentGrade: detail.studentGrade || undefined,
        totalScore,
        totalPossible,
        percentage,
        grade,
        totalTimeSeconds: detail.totalTimeSeconds || 0,
        sectionResults,
        writingSummary: nextWritingResult
          ? {
              score: nextWritingResult.score,
              maxScore: nextWritingResult.maxScore,
              grade: nextWritingResult.grade,
              overallFeedback_en: nextWritingResult.overallFeedback_en,
              overallFeedback_cn: nextWritingResult.overallFeedback_cn,
              suggestions_en: nextWritingResult.suggestions_en,
              suggestions_cn: nextWritingResult.suggestions_cn,
              manualReviewRequired: nextWritingResult.manualReviewRequired,
            }
          : undefined,
        speakingSummary: nextSpeakingEvaluation,
      });

      await updateAIMutation.mutateAsync({
        id: detail.id,
        ...(nextWritingResult ? { writingResultJson: JSON.stringify(nextWritingResult) } : {}),
        reportJson: JSON.stringify(nextReport),
      });

      await Promise.all([refetch(), refetchDetail()]);
      setTeacherReviewSuccess(lang === 'en' ? 'Teacher scores saved and report regenerated.' : '老师评分已保存，报告已重新生成。');
    } catch (error) {
      console.error('[History] Failed to save teacher review:', error);
      setTeacherReviewError(lang === 'en' ? 'Failed to save teacher scores or generate the report.' : '保存老师评分或生成报告失败。');
    }
  };

  const isSubmittingTeacherReview = generateReportMutation.isPending || updateAIMutation.isPending;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-slate-200/60 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2 text-slate-600 hover:text-slate-900">
              <ArrowLeft className="w-4 h-4" />
              {lang === 'en' ? 'Back to Home' : '返回首页'}
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-slate-800">
              {lang === 'en' ? '📋 Test History' : '📋 测试历史'}
            </h1>
            <p className="text-sm text-slate-500">
              {lang === 'en' ? 'View all past assessment results' : '查看所有历史测试成绩'}
            </p>
          </div>
          <button
            onClick={() => setLang(lang === 'en' ? 'cn' : 'en')}
            className="px-3 py-1.5 rounded-full bg-violet-100 text-violet-700 text-sm font-medium hover:bg-violet-200 transition"
          >
            {lang === 'en' ? '中文' : 'EN'}
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            <p className="text-slate-500">{lang === 'en' ? 'Loading results...' : '加载中...'}</p>
          </div>
        ) : !results || results.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <BookOpen className="w-16 h-16 text-slate-300" />
            <p className="text-lg text-slate-400 font-medium">
              {lang === 'en' ? 'No test results yet' : '暂无测试记录'}
            </p>
            <Link href="/">
              <Button variant="default" className="gap-2">
                {lang === 'en' ? 'Take an Assessment' : '开始测试'}
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-slate-500">
                {lang === 'en' ? `${results.length} record(s)` : `共 ${results.length} 条记录`}
              </p>
            </div>

            {[...results].reverse().map((r) => {
              const gradeInfo = getGradeInfo(r.totalCorrect, r.totalQuestions);
              const pct = r.totalQuestions > 0 ? Math.round((r.totalCorrect / r.totalQuestions) * 100) : 0;
              const isExpanded = selectedId === r.id;
              const currentDetail = isExpanded && detail?.id === r.id ? detail : null;

              return (
                <motion.div
                  key={r.id}
                  layout
                  className="bg-white rounded-xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                >
                  <div className="p-4 sm:p-5 cursor-pointer" onClick={() => setSelectedId(isExpanded ? null : r.id)}>
                    <div className="flex items-center gap-4">
                      <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-2xl font-bold border ${gradeInfo.color}`}>
                        {gradeInfo.grade}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-slate-800 truncate">{r.paperTitle}</h3>
                          {r.hasReport && (
                            <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">
                              {lang === 'en' ? 'Report Ready' : '报告已生成'}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-slate-500 flex-wrap">
                          <span className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5" />
                            {r.studentName}
                            {r.studentGrade && <span className="text-slate-400">({r.studentGrade})</span>}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {formatDate(r.createdAt)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {formatTime(r.totalTimeSeconds)}
                          </span>
                        </div>
                      </div>

                      <div className="text-right flex items-center gap-3">
                        <div>
                          <div className="text-lg font-bold text-slate-800">
                            {r.totalCorrect}/{r.totalQuestions}
                          </div>
                          <div className="text-sm text-slate-500">{pct}%</div>
                        </div>
                        {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                      </div>
                    </div>
                  </div>

                  <AnimatePresence>
                    {isExpanded && currentDetail && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="border-t border-slate-100"
                      >
                        <div className="p-5 space-y-5">
                          {currentDetail.scoreBySectionJson && (
                            <div>
                              <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                                <Award className="w-4 h-4 text-amber-500" />
                                {lang === 'en' ? 'Score Breakdown' : '分数明细'}
                              </h4>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {Object.entries(bySection).map(([key, value]) => (
                                  <div key={key} className="bg-slate-50 rounded-lg p-3 text-center border border-slate-100">
                                    <div className="text-xs text-slate-500 capitalize mb-1">{key}</div>
                                    <div className="text-lg font-bold text-slate-800">{value.correct}/{value.total}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {(writingSubmission || speakingResponses.length > 0) && (
                            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 space-y-5">
                              <div className="flex items-center justify-between gap-4 flex-wrap">
                                <div>
                                  <h4 className="text-sm font-semibold text-slate-800">
                                    {lang === 'en' ? 'Teacher Scoring Workspace' : '老师评分区'}
                                  </h4>
                                  <p className="text-sm text-slate-500 mt-1">
                                    {lang === 'en'
                                      ? 'Score writing and speaking here, then regenerate the report.'
                                      : '在这里完成作文和口语人工评分，然后重新生成报告。'}
                                  </p>
                                </div>
                                <Button
                                  size="sm"
                                  className="gap-1.5"
                                  disabled={isSubmittingTeacherReview}
                                  onClick={handleTeacherReport}
                                >
                                  {isSubmittingTeacherReview ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <FileText className="w-3.5 h-3.5" />
                                  )}
                                  {currentDetail.reportJson
                                    ? (lang === 'en' ? 'Update Report' : '更新报告')
                                    : (lang === 'en' ? 'Save Scores & Generate Report' : '保存评分并生成报告')}
                                </Button>
                              </div>

                              {teacherReviewError && (
                                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                  {teacherReviewError}
                                </div>
                              )}

                              {teacherReviewSuccess && (
                                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                                  {teacherReviewSuccess}
                                </div>
                              )}

                              {writingSubmission && writingDraft && (
                                <div className="rounded-xl border border-rose-200 bg-white p-4 space-y-4">
                                  <div className="flex items-center gap-2 text-rose-700">
                                    <FileText className="w-4 h-4" />
                                    <h5 className="font-semibold">{lang === 'en' ? 'Writing Review' : '作文评分'}</h5>
                                  </div>

                                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2">
                                    <p className="text-sm font-semibold text-slate-700">{writingSubmission.topic}</p>
                                    {writingSubmission.instructions && (
                                      <p className="text-sm text-slate-500">{writingSubmission.instructions}</p>
                                    )}
                                    {writingSubmission.wordCount && (
                                      <p className="text-xs text-slate-400">
                                        {lang === 'en' ? 'Target length:' : '目标字数：'} {writingSubmission.wordCount}
                                      </p>
                                    )}
                                    <div className="pt-2 border-t border-slate-200">
                                      <p className="text-xs font-semibold text-slate-500 mb-2">
                                        {lang === 'en' ? 'Student Essay' : '学生作文'}
                                      </p>
                                      <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                                        {writingSubmission.essay || (lang === 'en' ? 'No writing response submitted.' : '未提交作文内容。')}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                      <p className="text-xs font-semibold text-slate-500 mb-1.5">
                                        {lang === 'en' ? 'Writing Score' : '作文得分'}
                                      </p>
                                      <Input
                                        type="number"
                                        min="0"
                                        value={writingDraft.score}
                                        onChange={(event) => setWritingDraft((prev) => prev ? { ...prev, score: event.target.value } : prev)}
                                        placeholder={lang === 'en' ? 'e.g. 16' : '例如 16'}
                                      />
                                    </div>
                                    <div>
                                      <p className="text-xs font-semibold text-slate-500 mb-1.5">
                                        {lang === 'en' ? 'Full Score' : '满分'}
                                      </p>
                                      <Input
                                        type="number"
                                        min="1"
                                        value={writingDraft.maxScore}
                                        onChange={(event) => setWritingDraft((prev) => prev ? { ...prev, maxScore: event.target.value } : prev)}
                                        placeholder={lang === 'en' ? 'e.g. 20' : '例如 20'}
                                      />
                                    </div>
                                  </div>

                                  <div>
                                    <p className="text-xs font-semibold text-slate-500 mb-1.5">
                                      {lang === 'en' ? 'Teacher Comment' : '老师评语'}
                                    </p>
                                    <Textarea
                                      value={writingDraft.feedback}
                                      onChange={(event) => setWritingDraft((prev) => prev ? { ...prev, feedback: event.target.value } : prev)}
                                      placeholder={lang === 'en' ? 'Add a writing comment for the report and PDF.' : '填写作文评语，这段会进入报告和 PDF。'}
                                      className="min-h-24"
                                    />
                                  </div>

                                  <div>
                                    <p className="text-xs font-semibold text-slate-500 mb-1.5">
                                      {lang === 'en' ? 'Improvement Suggestions' : '改进建议'}
                                    </p>
                                    <Textarea
                                      value={writingDraft.suggestions}
                                      onChange={(event) => setWritingDraft((prev) => prev ? { ...prev, suggestions: event.target.value } : prev)}
                                      placeholder={lang === 'en' ? 'One suggestion per line.' : '每行写一条建议。'}
                                      className="min-h-20"
                                    />
                                  </div>
                                </div>
                              )}

                              {speakingDraft && speakingDraft.items.length > 0 && (
                                <div className="rounded-xl border border-sky-200 bg-white p-4 space-y-4">
                                  <div className="flex items-center gap-2 text-sky-700">
                                    <Mic className="w-4 h-4" />
                                    <h5 className="font-semibold">{lang === 'en' ? 'Speaking Review' : '口语评分'}</h5>
                                  </div>

                                  <div>
                                    <p className="text-xs font-semibold text-slate-500 mb-1.5">
                                      {lang === 'en' ? 'Overall Speaking Comment' : '口语总评'}
                                    </p>
                                    <Textarea
                                      value={speakingDraft.overallFeedback}
                                      onChange={(event) => setSpeakingDraft((prev) => prev ? { ...prev, overallFeedback: event.target.value } : prev)}
                                      placeholder={lang === 'en' ? 'Add a short overall note for the speaking section.' : '填写口语总评。'}
                                      className="min-h-20"
                                    />
                                  </div>

                                  <div className="space-y-4">
                                    {speakingDraft.items.map((item, index) => (
                                      <div key={`${item.sectionId}-${item.questionId}-${index}`} className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
                                        <div className="flex items-center justify-between gap-3 flex-wrap">
                                          <div>
                                            <p className="text-sm font-semibold text-slate-700">{item.label}</p>
                                            <p className="text-sm text-slate-500">{item.prompt}</p>
                                          </div>
                                          <audio controls preload="none" className="h-10 max-w-full">
                                            <source src={item.audioUrl} type={getAudioSourceType(item.audioUrl)} />
                                            Your browser does not support audio playback.
                                          </audio>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                          <div>
                                            <p className="text-xs font-semibold text-slate-500 mb-1.5">
                                              {lang === 'en' ? 'Question Score' : '本题得分'}
                                            </p>
                                            <Input
                                              type="number"
                                              min="0"
                                              value={item.score}
                                              onChange={(event) => {
                                                const value = event.target.value;
                                                setSpeakingDraft((prev) => {
                                                  if (!prev) return prev;
                                                  return {
                                                    ...prev,
                                                    items: prev.items.map((entry, entryIndex) =>
                                                      entryIndex === index ? { ...entry, score: value } : entry,
                                                    ),
                                                  };
                                                });
                                              }}
                                              placeholder={lang === 'en' ? 'e.g. 4' : '例如 4'}
                                            />
                                          </div>
                                          <div>
                                            <p className="text-xs font-semibold text-slate-500 mb-1.5">
                                              {lang === 'en' ? 'Full Score' : '满分'}
                                            </p>
                                            <Input
                                              type="number"
                                              min="1"
                                              value={item.maxScore}
                                              onChange={(event) => {
                                                const value = event.target.value;
                                                setSpeakingDraft((prev) => {
                                                  if (!prev) return prev;
                                                  return {
                                                    ...prev,
                                                    items: prev.items.map((entry, entryIndex) =>
                                                      entryIndex === index ? { ...entry, maxScore: value } : entry,
                                                    ),
                                                  };
                                                });
                                              }}
                                              placeholder={lang === 'en' ? 'e.g. 5' : '例如 5'}
                                            />
                                          </div>
                                        </div>

                                        <div>
                                          <p className="text-xs font-semibold text-slate-500 mb-1.5">
                                            {lang === 'en' ? 'Teacher Comment' : '老师评语'}
                                          </p>
                                          <Textarea
                                            value={item.feedback}
                                            onChange={(event) => {
                                              const value = event.target.value;
                                              setSpeakingDraft((prev) => {
                                                if (!prev) return prev;
                                                return {
                                                  ...prev,
                                                  items: prev.items.map((entry, entryIndex) =>
                                                    entryIndex === index ? { ...entry, feedback: value } : entry,
                                                  ),
                                                };
                                              });
                                            }}
                                            placeholder={lang === 'en' ? 'Comment on fluency, vocabulary, grammar, pronunciation, and task response.' : '填写本题评语，例如流利度、词汇、语法、发音和任务完成度。'}
                                            className="min-h-24"
                                          />
                                        </div>

                                        <div>
                                          <p className="text-xs font-semibold text-slate-500 mb-1.5">
                                            {lang === 'en' ? 'Improvement Suggestions' : '改进建议'}
                                          </p>
                                          <Textarea
                                            value={item.suggestions}
                                            onChange={(event) => {
                                              const value = event.target.value;
                                              setSpeakingDraft((prev) => {
                                                if (!prev) return prev;
                                                return {
                                                  ...prev,
                                                  items: prev.items.map((entry, entryIndex) =>
                                                    entryIndex === index ? { ...entry, suggestions: value } : entry,
                                                  ),
                                                };
                                              });
                                            }}
                                            placeholder={lang === 'en' ? 'One suggestion per line.' : '每行写一条建议。'}
                                            className="min-h-20"
                                          />
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {hasSpeakingSection && (!speakingDraft || speakingDraft.items.length === 0) && (
                                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
                                  {lang === 'en'
                                    ? 'This record includes a speaking section, but no saved speaking recording was detected yet.'
                                    : '这条考试记录包含口语部分，但目前还没有识别到已保存的口语录音。'}
                                </div>
                              )}
                            </div>
                          )}

                          {report && (
                            <div>
                              <h4 className="text-sm font-semibold text-slate-700 mb-3">
                                {lang === 'en' ? (report.reportTitle_en || 'Assessment Feedback Report') : (report.reportTitle_cn || '测评反馈报告')}
                              </h4>
                              <div className="bg-gradient-to-r from-violet-50 to-blue-50 rounded-lg p-4 border border-violet-100">
                                <div className="flex items-center gap-3 mb-3">
                                  <span className="px-3 py-1 rounded-full bg-violet-200 text-violet-800 font-bold text-sm">
                                    {report.languageLevel}
                                  </span>
                                </div>
                                <p className="text-sm text-slate-700 leading-relaxed">
                                  {lang === 'en' ? (report.overallSummary_en || report.summary_en) : (report.overallSummary_cn || report.summary_cn)}
                                </p>
                                {((lang === 'en' ? report.abilitySnapshot_en : report.abilitySnapshot_cn) || []).length > 0 && (
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {((lang === 'en' ? report.abilitySnapshot_en : report.abilitySnapshot_cn) || []).map((item, index) => (
                                      <span key={index} className="px-2 py-0.5 rounded-full text-xs bg-white/80 text-blue-700 border border-blue-100">
                                        {item}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                {((lang === 'en' ? report.strengths_en : report.strengths_cn) || []).length > 0 && (
                                  <div className="mt-3">
                                    <p className="text-xs font-semibold text-emerald-700 mb-1">
                                      {lang === 'en' ? 'Strengths:' : '优势：'}
                                    </p>
                                    <ul className="text-sm text-slate-600 space-y-1">
                                      {((lang === 'en' ? report.strengths_en : report.strengths_cn) || []).map((item, index) => (
                                        <li key={index} className="flex items-start gap-1.5">
                                          <span className="text-emerald-500 mt-0.5">✓</span> {item}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                {((lang === 'en' ? report.weaknesses_en : report.weaknesses_cn) || []).length > 0 && (
                                  <div className="mt-3">
                                    <p className="text-xs font-semibold text-amber-700 mb-1">
                                      {lang === 'en' ? 'Areas to Improve:' : '待提高：'}
                                    </p>
                                    <ul className="text-sm text-slate-600 space-y-1">
                                      {((lang === 'en' ? report.weaknesses_en : report.weaknesses_cn) || []).map((item, index) => (
                                        <li key={index} className="flex items-start gap-1.5">
                                          <span className="text-amber-500 mt-0.5">△</span> {item}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                {(lang === 'en' ? report.parentFeedback_en : report.parentFeedback_cn) && (
                                  <div className="mt-3 pt-3 border-t border-violet-100">
                                    <p className="text-xs font-semibold text-slate-700 mb-1">
                                      {lang === 'en' ? 'Parent Note:' : '家长反馈：'}
                                    </p>
                                    <p className="text-sm text-slate-600 leading-relaxed">
                                      {lang === 'en' ? report.parentFeedback_en : report.parentFeedback_cn}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          <div className="flex items-center gap-3 pt-2 border-t border-slate-100 flex-wrap">
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200"
                              disabled={downloadingId === r.id}
                              onClick={(event) => {
                                event.stopPropagation();
                                if (currentDetail) handleDownloadPDF(currentDetail);
                              }}
                            >
                              {downloadingId === r.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Download className="w-3.5 h-3.5" />
                              )}
                              {lang === 'en' ? 'Download PDF' : '下载PDF报告'}
                            </Button>

                            {confirmDeleteId === r.id ? (
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm text-red-600">
                                  {lang === 'en' ? 'Confirm delete?' : '确认删除？'}
                                </span>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    deleteMutation.mutate({ id: r.id });
                                    setConfirmDeleteId(null);
                                    setSelectedId(null);
                                  }}
                                >
                                  {lang === 'en' ? 'Yes, Delete' : '确认'}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setConfirmDeleteId(null);
                                  }}
                                >
                                  {lang === 'en' ? 'Cancel' : '取消'}
                                </Button>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-500 hover:text-red-700 hover:bg-red-50 gap-1.5"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setConfirmDeleteId(r.id);
                                }}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                {lang === 'en' ? 'Delete' : '删除'}
                              </Button>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
