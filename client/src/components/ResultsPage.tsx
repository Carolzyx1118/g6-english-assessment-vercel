import { useQuiz } from '@/contexts/QuizContext';
import type { Question, Section } from '@/data/papers';
import { trpc } from '@/lib/trpc';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy, RotateCcw, CheckCircle2, XCircle, BookOpen,
  PenTool, FileText, Loader2, Sparkles, Lightbulb,
  Clock, ChevronDown, ChevronUp, Globe,
  Headphones, AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEffect, useState, useRef, useMemo } from 'react';
import { useLocalAuth } from '@/hooks/useLocalAuth';
import { APP_BRAND_SUBTITLE, APP_BRAND_TITLE } from '@/lib/branding';
import { isAudioAnswerValue } from '@/lib/audioStorage';
import { normalizeVocabularyAnswer } from '@/lib/vocabularyWordHelpers';
import type {
  AssessmentReportResult,
  SpeakingEvaluationResult,
} from '@shared/assessmentReport';

const sectionMetaMap: Record<string, { icon: React.ReactNode; gradient: string; bg: string }> = {
  vocabulary: { icon: <BookOpen className="w-5 h-5" />, gradient: 'from-emerald-500 to-emerald-600', bg: 'bg-emerald-50' },
  grammar: { icon: <PenTool className="w-5 h-5" />, gradient: 'from-amber-500 to-amber-600', bg: 'bg-amber-50' },
  listening: { icon: <Headphones className="w-5 h-5" />, gradient: 'from-purple-500 to-purple-600', bg: 'bg-purple-50' },
  reading: { icon: <FileText className="w-5 h-5" />, gradient: 'from-indigo-500 to-indigo-600', bg: 'bg-indigo-50' },
  writing: { icon: <PenTool className="w-5 h-5" />, gradient: 'from-rose-500 to-rose-600', bg: 'bg-rose-50' },
  rw: { icon: <FileText className="w-5 h-5" />, gradient: 'from-teal-500 to-teal-600', bg: 'bg-teal-50' },
  speaking: { icon: <Globe className="w-5 h-5" />, gradient: 'from-sky-500 to-sky-600', bg: 'bg-sky-50' },
};

// Helper to resolve section meta by prefix matching (e.g., 'listening-part1' → 'listening')
function getSectionMeta(sectionId: string) {
  if (sectionMetaMap[sectionId]) return sectionMetaMap[sectionId];
  for (const key of Object.keys(sectionMetaMap)) {
    if (sectionId.startsWith(key)) return sectionMetaMap[key];
  }
  return { icon: <BookOpen className="w-5 h-5" />, gradient: 'from-slate-500 to-slate-600', bg: 'bg-slate-50' };
}

// Backward-compatible proxy for sectionMeta[id] usage
const sectionMeta = new Proxy({} as Record<string, { icon: React.ReactNode; gradient: string; bg: string }>, {
  get: (_target, prop: string) => getSectionMeta(prop),
});

type Lang = 'en' | 'cn';
type ReadingGradingResult = { questionId: string; isCorrect: boolean; score: number; feedback_en: string; feedback_cn: string; explanation_en: string; explanation_cn: string };
type WritingEvalResult = {
  score: number; maxScore: number; grade: string;
  overallFeedback_en: string; overallFeedback_cn: string;
  grammarErrors: { original: string; correction: string; explanation_en: string; explanation_cn: string }[];
  correctedEssay: string;
  annotatedEssay: string;
  suggestions_en: string[]; suggestions_cn: string[];
  reviewMode?: 'ai' | 'manual';
  manualReviewRequired?: boolean;
};
type ExplanationResult = { questionId: number; explanation_en: string; explanation_cn: string; tip_en: string; tip_cn: string };
type ReviewOption = {
  label: string;
  text: string;
  isCorrect: boolean;
  isSelected: boolean;
};
type ReviewQuestion = {
  id: number;
  question: string;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  context?: string;
  options?: ReviewOption[];
};
type SpeakingResponseInput = {
  sectionId: string;
  sectionTitle: string;
  questionId: number;
  prompt: string;
  audioUrl: string;
};

function extractSpeakingAudioUrls(value: unknown): string[] {
  if (typeof value === 'string') {
    if (isAudioAnswerValue(value)) return [value];
    if ((value.startsWith('{') || value.startsWith('[')) && value.length > 1) {
      try {
        return extractSpeakingAudioUrls(JSON.parse(value));
      } catch {
        return [];
      }
    }
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => extractSpeakingAudioUrls(entry));
  }

  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).flatMap((entry) => extractSpeakingAudioUrls(entry));
  }

  return [];
}

function normalizeTrueFalseChoice(value: unknown): 'True' | 'False' | 'Not Given' | undefined {
  if (value === true) return 'True';
  if (value === false) return 'False';
  if (typeof value !== 'string') return undefined;

  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') return 'True';
  if (normalized === 'false') return 'False';
  if (normalized === 'not given' || normalized === 'not-given' || normalized === 'not_given') {
    return 'Not Given';
  }

  return undefined;
}

function getExpectedTrueFalseChoice(statement: {
  isTrue?: boolean;
  correctChoice?: 'True' | 'False' | 'Not Given';
}) {
  if (statement.correctChoice) return statement.correctChoice;
  if (statement.isTrue === true) return 'True';
  if (statement.isTrue === false) return 'False';
  return 'Not Given';
}

function normalizeSentenceAnswer(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\s+([?.!,;:])/g, '$1');
}

function sentenceReorderAnswerToString(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .join(' ');
  }
  return typeof value === 'string' ? value : '';
}

function parseSerializedChoiceMap(value: unknown): Record<string, unknown> {
  try {
    if (typeof value === 'string') {
      return JSON.parse(value) as Record<string, unknown>;
    }
    if (value && typeof value === 'object') {
      return value as Record<string, unknown>;
    }
  } catch {
    // Ignore malformed serialized answers.
  }

  return {};
}

function getSerializedChoiceIndex(record: Record<string, unknown>, label: string) {
  const raw = record[label];
  const selectedIndex = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(selectedIndex) ? selectedIndex : undefined;
}

function formatPassageInlineWordChoicePrompt(
  prompt: string,
  item: { label: string; options: string[] },
) {
  const blankPrompt = `Blank ${item.label}: ${item.options.join(' / ')}`;
  return prompt ? `${prompt} — ${blankPrompt}` : blankPrompt;
}

function formatInlineWordChoicePrompt(
  item: { sentenceText?: string; beforeText: string; afterText: string; options: string[] },
) {
  if (typeof item.sentenceText === 'string' && item.sentenceText.trim()) {
    return item.sentenceText;
  }
  return `${item.beforeText} ${item.options.join(' / ')} ${item.afterText}`.trim();
}

function getMCQCorrectIndexes(question: Question & { type: 'mcq' | 'picture-mcq' | 'listening-mcq' }) {
  if (question.correctAnswers && question.correctAnswers.length > 0) {
    return Array.from(new Set(question.correctAnswers));
  }
  return typeof question.correctAnswer === 'number' ? [question.correctAnswer] : [];
}

function getMCQSelectedIndexes(answer: unknown) {
  if (Array.isArray(answer)) {
    return answer.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  }
  if (typeof answer === 'number' && Number.isFinite(answer)) {
    return [answer];
  }
  return [];
}

function getMCQOptionDisplay(option: string | { label?: string; text?: string } | undefined) {
  if (!option) return '';
  return typeof option === 'string' ? option : option.text || option.label || '';
}

function getReviewOptionLabel(index: number, option: string | { label?: string; text?: string } | undefined) {
  if (option && typeof option !== 'string' && option.label) return option.label;
  return String.fromCharCode(65 + index);
}

function buildReviewOptions(
  rawOptions: Array<string | { label?: string; text?: string }>,
  selectedIndexes: number[],
  correctIndexes: number[],
): ReviewOption[] {
  return rawOptions.map((option, index) => ({
    label: getReviewOptionLabel(index, option),
    text: getMCQOptionDisplay(option),
    isCorrect: correctIndexes.includes(index),
    isSelected: selectedIndexes.includes(index),
  }));
}

function buildWordBankReviewOptions(
  wordBank: Array<{ letter: string; word: string }> | undefined,
  selectedLetter: string | undefined,
  correctLetter: string | undefined,
): ReviewOption[] {
  return (wordBank || []).map((entry) => ({
    label: entry.letter,
    text: entry.word,
    isCorrect: entry.letter.toLowerCase() === String(correctLetter || '').toLowerCase(),
    isSelected: entry.letter.toLowerCase() === String(selectedLetter || '').toLowerCase(),
  }));
}

function ReviewOptionsList({ options, lang }: { options: ReviewOption[]; lang: Lang }) {
  if (options.length === 0) return null;

  return (
    <div className="mt-3 rounded-lg bg-slate-50 border border-slate-200 p-3">
      <p className="text-xs font-semibold text-slate-500 mb-2">{lang === 'en' ? 'Options' : '选项'}</p>
      <ul className="space-y-2">
        {options.map((option) => (
          <li key={`${option.label}-${option.text}`} className="rounded-md bg-white border border-slate-200 px-3 py-2 text-sm text-slate-700">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="font-semibold text-slate-600 mr-2">{option.label}.</span>
                <span>{option.text}</span>
              </div>
              <div className="shrink-0 flex flex-wrap justify-end gap-1.5">
                {option.isSelected && (
                  <span className="inline-flex items-center rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
                    {lang === 'en' ? 'Selected' : '已选'}
                  </span>
                )}
                {option.isCorrect && (
                  <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                    {lang === 'en' ? 'Correct' : '正确项'}
                  </span>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Parse annotated essay for writing section
function parseAnnotatedEssay(text: string): { type: 'text' | 'error'; content: string; correction?: string; explanation?: string }[] {
  const segments: { type: 'text' | 'error'; content: string; correction?: string; explanation?: string }[] = [];
  const regex = /\[ERR:(.*?)\|COR:(.*?)(?:\|EXP:(.*?))?\]/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) segments.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    segments.push({ type: 'error', content: match[1], correction: match[2], explanation: match[3] });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) segments.push({ type: 'text', content: text.slice(lastIndex) });
  return segments;
}

// Error annotation tooltip for writing
function ErrorAnnotation({ content, correction, explanation }: { content: string; correction?: string; explanation?: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-block group">
      <span onClick={() => setShow(!show)} onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}
        className="bg-red-100 text-red-700 px-1 rounded cursor-pointer border-b-2 border-red-300 hover:bg-red-200 transition-colors">
        {content}
      </span>
      {show && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-slate-800 text-white text-sm rounded-lg shadow-xl z-50">
          {correction && <span className="block text-emerald-300 font-medium mb-1">Correction: {correction}</span>}
          {explanation && <span className="block text-slate-300">{explanation}</span>}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
        </span>
      )}
    </span>
  );
}

function CollapsibleExplanation({ explanation, tip, lang }: { explanation: string; tip: string; lang: Lang }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="mt-2">
      <button onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors">
        <Lightbulb className="w-4 h-4" />
        {isOpen ? (lang === 'en' ? 'Hide Explanation' : '收起解析') : (lang === 'en' ? 'View Explanation' : '查看解析')}
        {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="mt-2 p-4 rounded-lg bg-blue-50 border border-blue-200">
              <p className="text-sm text-slate-700 leading-relaxed mb-2">{explanation}</p>
              <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 p-3 rounded-md border border-amber-200">
                <Lightbulb className="w-4 h-4 mt-0.5 shrink-0" />
                <span className="font-medium">{tip}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

function isManualWritingReview(result: WritingEvalResult | null | undefined) {
  return Boolean(
    result &&
    (result.manualReviewRequired || (result.reviewMode === 'manual' && result.maxScore === 0 && result.grade === 'Manual Review'))
  );
}

function isManualSpeakingReview(result: SpeakingEvaluationResult | null | undefined) {
  return Boolean(
    result &&
    (result.manualReviewRequired || (result.reviewMode === 'manual' && result.totalPossible === 0 && result.grade === 'Manual Review'))
  );
}

interface ReadingSubItem {
  id: string; parentId: number; label: string;
  questionText: string; userAnswer: string; correctAnswer: string; questionType: string;
  context?: string;
  options?: ReviewOption[];
}

export default function ResultsPage() {
  const { getScore, resetQuiz, state, getAnswer, getSectionTimings, getTotalTime, studentInfo, sections, selectedPaper } = useQuiz();
  const { user } = useLocalAuth();
  const { correct, total, bySection } = getScore();

  const totalTime = getTotalTime();
  const sectionTimings = getSectionTimings();
  const minutes = Math.floor(totalTime / 60);
  const seconds = totalTime % 60;

  const lang: Lang = 'en';

  const isWritingLikeSection = (section: Section) =>
    section.id === 'writing' ||
    section.sectionType === 'writing' ||
    section.questions.some((q) => q.type === 'writing');

  const isSpeakingLikeSection = (section: Section) =>
    section.id === 'speaking' ||
    section.id.startsWith('speaking') ||
    section.sectionType === 'speaking' ||
    section.questions.some((q) => q.type === 'open-ended' && 'responseMode' in q && q.responseMode === 'audio');

  // Review states
  const [readingResults, setReadingResults] = useState<ReadingGradingResult[] | null>(null);
  const [writingResult, setWritingResult] = useState<WritingEvalResult | null>(null);
  const [speakingResult, setSpeakingResult] = useState<SpeakingEvaluationResult | null>(null);
  const [reportResult, setReportResult] = useState<AssessmentReportResult | null>(null);
  const [explanations, setExplanations] = useState<ExplanationResult[] | null>(null);
  const [isGradingReading, setIsGradingReading] = useState(false);
  const [isGradingWriting, setIsGradingWriting] = useState(false);
  const [isGradingSpeaking, setIsGradingSpeaking] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [isLoadingExplanations, setIsLoadingExplanations] = useState(false);
  const [readingError, setReadingError] = useState<string | null>(null);
  const [writingError, setWritingError] = useState<string | null>(null);
  const [speakingError, setSpeakingError] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const hasStartedGrading = useRef(false);
  const hasRequestedReport = useRef(false);

  const [writingTab, setWritingTab] = useState<'annotated' | 'corrected' | 'errors'>('annotated');

  const checkReadingMutation = trpc.grading.checkReadingAnswers.useMutation();
  const evaluateWritingMutation = trpc.grading.evaluateWriting.useMutation();
  const evaluateSpeakingMutation = trpc.grading.evaluateSpeaking.useMutation();
  const explainMutation = trpc.grading.explainWrongAnswers.useMutation();
  const generateReportMutation = trpc.grading.generateReport.useMutation();

  // Auto-save to database
  const saveResultMutation = trpc.results.save.useMutation();
  const updateAIMutation = trpc.results.updateAI.useMutation();
  const savedResultId = useRef<number | null>(null);
  const hasSavedInitial = useRef(false);

  // Build reading sub-items - handles BOTH WIDA (wordbank-fill, story-fill) and HuaZhong (true-false, open-ended, table, reference, order, phrase, checkbox)
  const readingSubItems = useMemo((): ReadingSubItem[] => {
    const readingSection = sections.find(s => s.id === 'reading');
    if (!readingSection) return [];
    const items: ReadingSubItem[] = [];
    for (const q of readingSection.questions) {
      const userAns = getAnswer('reading', q.id);
      if (q.type === 'wordbank-fill' || q.type === 'story-fill') {
        items.push({ id: `${q.id}`, parentId: q.id, label: `Q${q.id}`,
          questionText: q.question, userAnswer: typeof userAns === 'string' ? userAns : 'Not answered',
          correctAnswer: q.correctAnswer, questionType: q.type });
      } else if (q.type === 'true-false') {
        const parsed = (() => { try { return typeof userAns === 'string' ? JSON.parse(userAns) : {}; } catch { return {}; } })();
        for (const stmt of q.statements) {
          const raw = parsed[stmt.label];
          const userChoice = normalizeTrueFalseChoice(raw && typeof raw === 'object' ? raw.tf : raw);
          const correctChoice = getExpectedTrueFalseChoice(stmt);
          const choiceOptions = ['True', 'False', 'Not Given'];
          const selectedIndexes = userChoice ? [choiceOptions.indexOf(userChoice)].filter((value) => value >= 0) : [];
          const correctIndexes = [choiceOptions.indexOf(correctChoice)].filter((value) => value >= 0);
          items.push({ id: `${q.id}-${stmt.label}`, parentId: q.id, label: `Q${q.id}(${stmt.label})`,
            questionText: `True or False: "${stmt.statement}"`,
            userAnswer: userChoice || 'Not answered',
            correctAnswer: correctChoice, questionType: 'true-false-sub',
            options: buildReviewOptions(choiceOptions, selectedIndexes, correctIndexes) });
        }
      } else if (q.type === 'open-ended' && q.subQuestions) {
        const parsed = (() => { try { return typeof userAns === 'string' ? JSON.parse(userAns) : {}; } catch { return {}; } })();
        for (const sub of q.subQuestions) {
          items.push({ id: `${q.id}-${sub.label}`, parentId: q.id, label: `Q${q.id}(${sub.label})`,
            questionText: `${q.question} — ${sub.question}`,
            userAnswer: parsed[sub.label] || 'Not answered', correctAnswer: sub.answer, questionType: 'open-ended-sub' });
        }
      } else if (q.type === 'open-ended' && !q.subQuestions) {
        items.push({ id: `${q.id}`, parentId: q.id, label: `Q${q.id}`,
          questionText: q.question, userAnswer: typeof userAns === 'string' ? userAns : 'Not answered',
          correctAnswer: q.answer || '', questionType: 'open-ended' });
      } else if (q.type === 'table') {
        const parsed = (() => { try { return typeof userAns === 'string' ? JSON.parse(userAns) : {}; } catch { return {}; } })();
        q.rows.forEach((row: any, i: number) => {
          const label = String.fromCharCode(97 + i);
          items.push({ id: `${q.id}-${label}`, parentId: q.id, label: `Q${q.id}(${label})`,
            questionText: `Complete the table for: "${row.situation}" — fill in the ${row.blankField}`,
            userAnswer: parsed[`row${i}`] || parsed[row.blankField + i] || parsed[label] || (typeof parsed === 'object' ? (Object.values(parsed)[i] as string || 'Not answered') : 'Not answered'),
            correctAnswer: row.answer, questionType: 'table-sub' });
        });
      } else if (q.type === 'reference') {
        const parsed = (() => { try { return typeof userAns === 'string' ? JSON.parse(userAns) : {}; } catch { return {}; } })();
        q.items.forEach((item: any, i: number) => {
          const label = String.fromCharCode(97 + i);
          items.push({ id: `${q.id}-${label}`, parentId: q.id, label: `Q${q.id}(${label})`,
            questionText: `What does "${item.word}" (${item.lineRef}) refer to?`,
            userAnswer: parsed[item.word] || parsed[label] || (typeof parsed === 'object' ? (Object.values(parsed)[i] as string || 'Not answered') : 'Not answered'),
            correctAnswer: item.answer, questionType: 'reference-sub' });
        });
      } else if (q.type === 'order') {
        const parsed = (() => { try { return typeof userAns === 'string' ? JSON.parse(userAns) : {}; } catch { return {}; } })();
        q.events.forEach((event: string, i: number) => {
          const label = String.fromCharCode(97 + i);
          items.push({ id: `${q.id}-${label}`, parentId: q.id, label: `Q${q.id}(${label})`,
            questionText: `Order: "${event}"`,
            userAnswer: parsed[label] || parsed[i] || (typeof parsed === 'object' ? (Object.values(parsed)[i] as string || 'Not answered') : 'Not answered'),
            correctAnswer: String(q.correctOrder[i]), questionType: 'order-sub' });
        });
      } else if (q.type === 'phrase') {
        const parsed = (() => { try { return typeof userAns === 'string' ? JSON.parse(userAns) : {}; } catch { return {}; } })();
        q.items.forEach((item: any, i: number) => {
          const label = String.fromCharCode(97 + i);
          items.push({ id: `${q.id}-${label}`, parentId: q.id, label: `Q${q.id}(${label})`,
            questionText: item.clue,
            userAnswer: parsed[label] || parsed[i] || (typeof parsed === 'object' ? (Object.values(parsed)[i] as string || 'Not answered') : 'Not answered'),
            correctAnswer: item.answer, questionType: 'phrase-sub' });
        });
      } else if (q.type === 'checkbox') {
        const userArr = userAns as number[] | undefined;
        items.push({ id: `${q.id}`, parentId: q.id, label: `Q${q.id}`,
          questionText: q.question,
          userAnswer: userArr && userArr.length ? userArr.map((i: number) => getMCQOptionDisplay(q.options[i])).join(', ') : 'Not answered',
          correctAnswer: q.correctAnswers.map((i: number) => getMCQOptionDisplay(q.options[i])).join(', '), questionType: 'checkbox',
          options: buildReviewOptions(q.options, userArr || [], q.correctAnswers) });
      } else if (q.type === 'sentence-reorder') {
        const parsed = (() => { try { return typeof userAns === 'string' ? JSON.parse(userAns) : {}; } catch { return {}; } })();
        q.items.forEach((item) => {
          const userValue = sentenceReorderAnswerToString(parsed[item.label]);
          items.push({
            id: `${q.id}-${item.label}`,
            parentId: q.id,
            label: `Q${q.id}(${item.label})`,
            questionText: item.scrambledWords,
            userAnswer: userValue || 'Not answered',
            correctAnswer: item.correctAnswer,
            questionType: 'sentence-reorder-sub',
          });
        });
      } else if (q.type === 'inline-word-choice') {
        const parsed = parseSerializedChoiceMap(userAns);
        q.items.forEach((item) => {
          const selectedIndex = getSerializedChoiceIndex(parsed, item.label);
          const hasAnswer = selectedIndex !== undefined && selectedIndex >= 0;
          items.push({
            id: `${q.id}-${item.label}`,
            parentId: q.id,
            label: `Q${q.id}(${item.label})`,
            questionText: formatInlineWordChoicePrompt(item),
            userAnswer: hasAnswer ? item.options[selectedIndex] || 'Not answered' : 'Not answered',
            correctAnswer: item.options[item.correctAnswer] || '',
            questionType: 'inline-word-choice-sub',
            options: buildReviewOptions(item.options, hasAnswer ? [selectedIndex] : [], [item.correctAnswer]),
          });
        });
      } else if (q.type === 'passage-inline-word-choice') {
        const parsed = parseSerializedChoiceMap(userAns);
        q.items.forEach((item) => {
          const selectedIndex = getSerializedChoiceIndex(parsed, item.label);
          const hasAnswer = selectedIndex !== undefined && selectedIndex >= 0;
          items.push({
            id: `${q.id}-${item.label}`,
            parentId: q.id,
            label: `Q${q.id}(${item.label})`,
            questionText: formatPassageInlineWordChoicePrompt(q.question, item),
            userAnswer: hasAnswer ? item.options[selectedIndex] || 'Not answered' : 'Not answered',
            correctAnswer: item.options[item.correctAnswer] || '',
            questionType: 'passage-inline-word-choice-sub',
            options: buildReviewOptions(item.options, hasAnswer ? [selectedIndex] : [], [item.correctAnswer]),
          });
        });
      } else if (q.type === 'picture-spelling' || q.type === 'word-completion') {
        items.push({
          id: `${q.id}`,
          parentId: q.id,
          label: `Q${q.id}`,
          questionText: q.question || `Vocabulary question ${q.id}`,
          userAnswer: typeof userAns === 'string' && userAns.trim() ? userAns : 'Not answered',
          correctAnswer: q.correctAnswer,
          questionType: q.type,
        });
      }
    }
    return items;
  }, [getAnswer, sections]);

  const writingSubmission = useMemo(() => {
    const writingSection = sections.find(isWritingLikeSection);
    if (!writingSection) return null;

    const writingQ = writingSection.questions.find((q): q is Extract<Question, { type: 'writing' }> => q.type === 'writing');
    if (!writingQ) return null;

    const essay = getAnswer('writing', writingQ.id);
    return {
      sectionId: writingSection.id,
      sectionTitle: writingSection.title,
      question: writingQ,
      essay: typeof essay === 'string' ? essay : '',
    };
  }, [getAnswer, sections]);

  const speakingResponses = useMemo((): SpeakingResponseInput[] => {
    const responses: SpeakingResponseInput[] = [];
    const seen = new Set<string>();

    for (const section of sections) {
      if (!isSpeakingLikeSection(section)) continue;

      for (const question of section.questions) {
        const answer = getAnswer(section.id, question.id);
        const audioUrls = extractSpeakingAudioUrls(answer);
        if (audioUrls.length === 0) continue;

        const prompt =
          question.type === 'open-ended'
            ? question.question
            : section.taskDescription || section.description || section.title;

        audioUrls.forEach((audioUrl) => {
          if (seen.has(audioUrl)) return;
          seen.add(audioUrl);
          responses.push({
            sectionId: section.id,
            sectionTitle: section.title,
            questionId: question.id,
            prompt,
            audioUrl,
          });
        });
      }
    }

    return responses;
  }, [getAnswer, sections]);

  // Detailed answer review for auto-gradable sections (vocabulary, grammar, listening)
  const detailedResults = useMemo(() => {
    const results: { sectionId: string; sectionTitle: string; questions: ReviewQuestion[] }[] = [];
    for (const section of sections) {
      if (section.id === 'reading' || isWritingLikeSection(section) || isSpeakingLikeSection(section)) continue;
      const sectionResults: ReviewQuestion[] = [];
      for (const q of section.questions) {
        if (q.type === 'picture-mcq' || q.type === 'listening-mcq') {
          const userAns = getAnswer(section.id, q.id);
          const selectedIndexes = getMCQSelectedIndexes(userAns);
          const correctIndexes = getMCQCorrectIndexes(q);
          const userText = selectedIndexes.length
            ? selectedIndexes.map((index) => q.options[index]?.text || q.options[index]?.label).filter(Boolean).join(', ')
            : 'Not answered';
          const correctText = correctIndexes.length
            ? correctIndexes.map((index) => q.options[index]?.text || q.options[index]?.label).filter(Boolean).join(', ')
            : (q.options[q.correctAnswer]?.text || q.options[q.correctAnswer]?.label);
          sectionResults.push({ id: q.id, question: q.question, userAnswer: userText, correctAnswer: correctText,
            isCorrect: JSON.stringify([...selectedIndexes].sort((a, b) => a - b)) === JSON.stringify([...correctIndexes].sort((a, b) => a - b)),
            options: buildReviewOptions(q.options, selectedIndexes, correctIndexes),
            context: correctIndexes.length > 1
              ? `The correct answers are: ${correctText}.`
              : `The correct answer is option ${q.options[q.correctAnswer]?.label}: ${correctText}.` });
        } else if (q.type === 'mcq') {
          const userAns = getAnswer(section.id, q.id);
          const correctIndexes = getMCQCorrectIndexes(q);
          if (correctIndexes.length > 1) {
            const selectedIndexes = getMCQSelectedIndexes(userAns);
            const userText = selectedIndexes.length
              ? selectedIndexes.map((index) => getMCQOptionDisplay(q.options[index])).filter(Boolean).join(', ')
              : 'Not answered';
            const correctText = correctIndexes.map((index) => getMCQOptionDisplay(q.options[index])).filter(Boolean).join(', ');
            sectionResults.push({ id: q.id, question: q.question.replace('___', q.highlightWord || '___'),
              userAnswer: userText,
              correctAnswer: correctText,
              isCorrect: JSON.stringify([...selectedIndexes].sort((a, b) => a - b)) === JSON.stringify([...correctIndexes].sort((a, b) => a - b)),
              options: buildReviewOptions(q.options, selectedIndexes, correctIndexes),
              context: q.highlightWord ? `The word "${q.highlightWord}" is tested.` : undefined });
          } else if (typeof q.correctAnswer === 'number') {
            // Standard MCQ with numeric index answer
            const userIdx = userAns !== undefined ? Number(userAns) : -1;
            sectionResults.push({ id: q.id, question: q.question.replace('___', q.highlightWord || '___'),
              userAnswer: userIdx >= 0 ? getMCQOptionDisplay(q.options[userIdx]) : 'Not answered',
              correctAnswer: getMCQOptionDisplay(q.options[q.correctAnswer]), isCorrect: userIdx === q.correctAnswer,
              options: buildReviewOptions(q.options, userIdx >= 0 ? [userIdx] : [], [q.correctAnswer]),
              context: q.highlightWord ? `The word "${q.highlightWord}" is tested.` : undefined });
          } else {
            // MCQ with string answer (e.g., yes/no) - answer stored as index, convert to option text
            const userIdx = userAns !== undefined ? Number(userAns) : -1;
            const rawOpt: any = (userIdx >= 0 && q.options && q.options[userIdx]) ? q.options[userIdx] : null;
            const userText = rawOpt ? (typeof rawOpt === 'string' ? rawOpt : (rawOpt.text || rawOpt.label || '')) : (userAns !== undefined && userAns !== '' ? String(userAns) : 'Not answered');
            const isCorrect = userText !== 'Not answered' && userText.trim().toLowerCase() === String(q.correctAnswer).trim().toLowerCase();
            const correctIndexes = q.options
              .map((option, index) => ({ option, index }))
              .filter(({ option }) => getMCQOptionDisplay(option).trim().toLowerCase() === String(q.correctAnswer).trim().toLowerCase())
              .map(({ index }) => index);
            sectionResults.push({ id: q.id, question: q.question,
              userAnswer: userText, correctAnswer: String(q.correctAnswer), isCorrect,
              options: buildReviewOptions(q.options, userIdx >= 0 ? [userIdx] : [], correctIndexes) });
          }
        } else if (q.type === 'fill-blank') {
          const userAns = getAnswer(section.id, q.id);
          const wordBank = section.wordBank;
          const correctLetterEntry = wordBank?.find((w: any) => w.letter.toLowerCase() === q.correctAnswer.toLowerCase());
          const userLetterEntry = wordBank?.find((w: any) => w.letter.toLowerCase() === String(userAns || '').toLowerCase());

          if (correctLetterEntry) {
            sectionResults.push({ id: q.id, question: q.question || `Fill in blank ${q.id}`,
              userAnswer: userLetterEntry ? `${userLetterEntry.letter} ${userLetterEntry.word}` : (userAns ? String(userAns) : 'Not answered'),
              correctAnswer: `${correctLetterEntry.letter} ${correctLetterEntry.word}`,
              isCorrect: String(userAns).trim().toUpperCase() === q.correctAnswer.trim().toUpperCase(),
              options: buildWordBankReviewOptions(wordBank, typeof userAns === 'string' ? userAns : undefined, q.correctAnswer),
              context: `Grammar fill-in-the-blank. The correct word is "${correctLetterEntry.word}".` });
          } else {
            sectionResults.push({ id: q.id, question: q.question || `Fill in blank ${q.id}`,
              userAnswer: userAns ? String(userAns) : 'Not answered',
              correctAnswer: q.correctAnswer,
              isCorrect: String(userAns).trim().toLowerCase() === q.correctAnswer.trim().toLowerCase(),
              context: 'Type the correct word or phrase directly into the blank.' });
          }
        } else if (q.type === 'picture-spelling' || q.type === 'word-completion') {
          const userAns = getAnswer(section.id, q.id);
          const userValue = typeof userAns === 'string' && userAns.trim() ? userAns : 'Not answered';
          sectionResults.push({
            id: q.id,
            question: q.question || `Vocabulary question ${q.id}`,
            userAnswer: userValue,
            correctAnswer: q.correctAnswer,
            isCorrect: userValue !== 'Not answered' && normalizeVocabularyAnswer(userValue) === normalizeVocabularyAnswer(q.correctAnswer),
            context: q.type === 'picture-spelling'
              ? 'Spell the word that matches the picture.'
              : 'Complete the missing letters to form the correct word.',
          });
        } else if (q.type === 'open-ended') {
          const userAns = getAnswer(section.id, q.id);
          const userText = userAns !== undefined && userAns !== '' ? String(userAns) : 'Not answered';
          // Speaking questions (no correctAnswer) - show as submitted
          if (!q.correctAnswer) {
            const isAudioUrl = extractSpeakingAudioUrls(userAns).length > 0;
            sectionResults.push({ id: q.id, question: q.question,
              userAnswer: isAudioUrl ? 'Audio recorded' : userText,
              correctAnswer: 'Manual grading required', isCorrect: false,
              context: 'Speaking/open-ended question - requires manual review.' });
          } else {
            // Open-ended with correctAnswer (supports / for multiple acceptable answers)
            const acceptables = String(q.correctAnswer).split('/').map(a => a.trim().toLowerCase());
            const isCorrect = userText !== 'Not answered' && acceptables.includes(userText.trim().toLowerCase());
            sectionResults.push({ id: q.id, question: q.question,
              userAnswer: userText,
              correctAnswer: q.correctAnswer,
              isCorrect,
              context: acceptables.length > 1 ? `Acceptable answers: ${acceptables.join(', ')}` : undefined });
          }
        } else if (q.type === 'true-false') {
          const userAns = getAnswer(section.id, q.id);
          if (q.statements) {
            const parsed = (() => { try { return typeof userAns === 'string' ? JSON.parse(userAns) : (userAns || {}); } catch { return {}; } })();
            for (const stmt of q.statements) {
              const raw = parsed[stmt.label];
              const userChoice = normalizeTrueFalseChoice(raw && typeof raw === 'object' ? raw.tf : raw);
              const correctChoice = getExpectedTrueFalseChoice(stmt);
              const userDisplay = userChoice ? `${userChoice}${userChoice === 'True' ? ' (\u2713)' : userChoice === 'False' ? ' (\u2717)' : ''}` : 'Not answered';
              const correctDisplay = `${correctChoice}${correctChoice === 'True' ? ' (\u2713)' : correctChoice === 'False' ? ' (\u2717)' : ''}`;
              const choiceOptions = ['True', 'False', 'Not Given'];
              const selectedIndexes = userChoice ? [choiceOptions.indexOf(userChoice)].filter((value) => value >= 0) : [];
              const correctIndexes = [choiceOptions.indexOf(correctChoice)].filter((value) => value >= 0);
              sectionResults.push({ id: q.id, question: stmt.statement,
                userAnswer: userDisplay, correctAnswer: correctDisplay,
                isCorrect: userChoice === correctChoice,
                options: buildReviewOptions(choiceOptions, selectedIndexes, correctIndexes) });
            }
          }
        } else if (q.type === 'checkbox') {
          const userAns = getAnswer(section.id, q.id) as number[] | undefined;
          const userLabels = userAns && userAns.length ? userAns.map((i: number) => getMCQOptionDisplay(q.options[i])).join(', ') : 'Not answered';
          const correctLabels = q.correctAnswers.map((i: number) => getMCQOptionDisplay(q.options[i])).join(', ');
          const sorted1 = userAns ? [...userAns].sort() : [];
          const sorted2 = [...q.correctAnswers].sort();
          sectionResults.push({ id: q.id, question: q.question, userAnswer: userLabels,
            correctAnswer: correctLabels, isCorrect: JSON.stringify(sorted1) === JSON.stringify(sorted2),
            options: buildReviewOptions(q.options, userAns || [], q.correctAnswers) });
        } else if (q.type === 'order') {
          const userAns = getAnswer(section.id, q.id);
          const parsed = (() => { try { return typeof userAns === 'string' ? JSON.parse(userAns) : {}; } catch { return {}; } })();
          const userLabels = q.events.map((event, index) => `${event}: ${parsed[index] || '—'}`).join(' | ');
          const correctLabels = q.events.map((event, index) => `${event}: ${q.correctOrder[index]}`).join(' | ');
          const isCorrect = q.correctOrder.every((expected, index) => String(parsed[index] ?? '') === String(expected));
          sectionResults.push({ id: q.id, question: q.question, userAnswer: userLabels, correctAnswer: correctLabels, isCorrect });
        } else if (q.type === 'sentence-reorder') {
          const userAns = getAnswer(section.id, q.id);
          const parsed = (() => { try { return typeof userAns === 'string' ? JSON.parse(userAns) : {}; } catch { return {}; } })();
          q.items.forEach((item) => {
            const userValue = sentenceReorderAnswerToString(parsed[item.label]);
            sectionResults.push({
              id: q.id,
              question: item.scrambledWords,
              userAnswer: userValue || 'Not answered',
              correctAnswer: item.correctAnswer,
              isCorrect: userValue !== '' && normalizeSentenceAnswer(userValue) === normalizeSentenceAnswer(item.correctAnswer),
            });
          });
        } else if (q.type === 'inline-word-choice') {
          const userAns = getAnswer(section.id, q.id);
          const parsed = parseSerializedChoiceMap(userAns);
          q.items.forEach((item) => {
            const selectedIndex = getSerializedChoiceIndex(parsed, item.label);
            const hasAnswer = selectedIndex !== undefined && selectedIndex >= 0;
            const userValue = hasAnswer ? item.options[selectedIndex] || 'Not answered' : 'Not answered';
            const correctValue = item.options[item.correctAnswer] || '';
            sectionResults.push({
              id: q.id,
              question: formatInlineWordChoicePrompt(item),
              userAnswer: userValue,
              correctAnswer: correctValue,
              isCorrect: hasAnswer && selectedIndex === item.correctAnswer,
              options: buildReviewOptions(item.options, hasAnswer ? [selectedIndex] : [], [item.correctAnswer]),
            });
          });
        } else if (q.type === 'passage-inline-word-choice') {
          const userAns = getAnswer(section.id, q.id);
          const parsed = parseSerializedChoiceMap(userAns);
          q.items.forEach((item) => {
            const selectedIndex = getSerializedChoiceIndex(parsed, item.label);
            const hasAnswer = selectedIndex !== undefined && selectedIndex >= 0;
            const userValue = hasAnswer ? item.options[selectedIndex] || 'Not answered' : 'Not answered';
            const correctValue = item.options[item.correctAnswer] || '';
            sectionResults.push({
              id: q.id,
              question: formatPassageInlineWordChoicePrompt(q.question, item),
              userAnswer: userValue,
              correctAnswer: correctValue,
              isCorrect: hasAnswer && selectedIndex === item.correctAnswer,
              options: buildReviewOptions(item.options, hasAnswer ? [selectedIndex] : [], [item.correctAnswer]),
            });
          });
        }
      }
      if (sectionResults.length > 0) results.push({ sectionId: section.id, sectionTitle: section.title, questions: sectionResults });
    }
    return results;
  }, [getAnswer, sections]);

  const recordedStudentName = useMemo(
    () => user?.displayName?.trim() || user?.username || studentInfo?.name || 'Unknown',
    [studentInfo?.name, user?.displayName, user?.username],
  );
  const recordedStudentGrade = useMemo(
    () => studentInfo?.grade?.trim() || undefined,
    [studentInfo?.grade],
  );

  // Save initial result state, then request reading checks and review placeholders.
  // Auto-save initial results to database
  useEffect(() => {
    if (hasSavedInitial.current) return;
    hasSavedInitial.current = true;
    saveResultMutation.mutate({
      studentName: recordedStudentName,
      studentGrade: recordedStudentGrade,
      paperId: selectedPaper?.id || 'unknown',
      paperTitle: selectedPaper?.title || 'Assessment',
      totalCorrect: correct,
      totalQuestions: total,
      totalTimeSeconds: totalTime || undefined,
      answersJson: JSON.stringify(state.answers),
      scoreBySectionJson: JSON.stringify(bySection),
      sectionTimingsJson: JSON.stringify(sectionTimings),
    }, {
      onSuccess: (data) => {
        savedResultId.current = data.id ?? null;
        console.log('[Results] Saved to database with id:', data.id);
      },
      onError: (err) => console.error('[Results] Failed to save:', err),
    });
  }, [bySection, correct, recordedStudentGrade, recordedStudentName, saveResultMutation, sectionTimings, selectedPaper?.id, selectedPaper?.title, state.answers, total, totalTime]);

  // Update AI results in database when they become available
  useEffect(() => {
    if (!savedResultId.current) return;
    const updates: Record<string, string> = {};
    if (readingResults) updates.readingResultsJson = JSON.stringify(readingResults);
    if (writingResult) updates.writingResultJson = JSON.stringify(writingResult);
    if (explanations) updates.explanationsJson = JSON.stringify(explanations);
    if (reportResult) updates.reportJson = JSON.stringify(reportResult);
    if (Object.keys(updates).length > 0) {
      updateAIMutation.mutate({ id: savedResultId.current, ...updates });
    }
  }, [readingResults, writingResult, explanations, reportResult, updateAIMutation]);

  useEffect(() => {
    if (hasStartedGrading.current) return;
    hasStartedGrading.current = true;
    if (readingSubItems.length > 0) {
      const readingAnswers = readingSubItems.map(item => ({
        questionId: item.id, questionType: item.questionType,
        questionText: item.questionText, userAnswer: item.userAnswer, correctAnswer: item.correctAnswer,
      }));
      setIsGradingReading(true);
      checkReadingMutation.mutate({ answers: readingAnswers }, {
        onSuccess: (data) => { setReadingResults(data); setIsGradingReading(false); },
        onError: () => { setReadingError('Failed to check reading answers.'); setIsGradingReading(false); },
      });
    }
    if (writingSubmission && writingSubmission.essay.trim().length > 10) {
      setIsGradingWriting(true);
      evaluateWritingMutation.mutate(
        {
          essay: writingSubmission.essay,
          topic: writingSubmission.question.topic,
          wordCountTarget: writingSubmission.question.wordCount,
        },
        {
          onSuccess: (data) => { setWritingResult(data); setIsGradingWriting(false); },
          onError: () => { setWritingError('Failed to evaluate writing.'); setIsGradingWriting(false); },
        }
      );
    }

    if (speakingResponses.length > 0) {
      setIsGradingSpeaking(true);
      evaluateSpeakingMutation.mutate(
        { responses: speakingResponses },
        {
          onSuccess: (data) => { setSpeakingResult(data); setIsGradingSpeaking(false); },
          onError: () => { setSpeakingError('Failed to evaluate speaking.'); setIsGradingSpeaking(false); },
        }
      );
    }
  }, [checkReadingMutation, evaluateSpeakingMutation, evaluateWritingMutation, getAnswer, readingSubItems, sections, speakingResponses, writingSubmission]);

  // Trigger explanations for wrong answers
  useEffect(() => {
    if (isGradingReading || isGradingWriting) return;
    if (explanations !== null || isLoadingExplanations) return;
    const wrongAnswers: { questionId: number; sectionType: string; questionText: string; userAnswer: string; correctAnswer: string; context?: string }[] = [];
    for (const section of detailedResults) {
      for (const q of section.questions) {
        if (!q.isCorrect && q.userAnswer !== 'Not answered') {
          wrongAnswers.push({ questionId: q.id, sectionType: section.sectionId, questionText: q.question,
            userAnswer: q.userAnswer, correctAnswer: q.correctAnswer, context: q.context });
        }
      }
    }
    if (wrongAnswers.length > 0) {
      setIsLoadingExplanations(true);
      explainMutation.mutate({ wrongAnswers }, {
        onSuccess: (data) => { setExplanations(data); setIsLoadingExplanations(false); },
        onError: () => { setExplanations([]); setIsLoadingExplanations(false); },
      });
    } else { setExplanations([]); }
  }, [isGradingReading, isGradingWriting, detailedResults, explanations, isLoadingExplanations]);

  // Calculate total score
  const readingAIScore = readingResults ? readingResults.reduce((sum, r) => sum + r.score, 0) : 0;
  const readingAITotal = readingResults ? readingResults.length : 0;
  const writingIsManual = isManualWritingReview(writingResult);
  const writingAIScore = writingResult && !writingIsManual ? writingResult.score : 0;
  const writingAITotal = writingResult && !writingIsManual ? writingResult.maxScore : 0;
  const speakingIsManual = isManualSpeakingReview(speakingResult);
  const speakingUsesTeacherReview = Boolean(speakingResult?.reviewMode === 'manual');
  const speakingAIScore = speakingResult && !speakingIsManual ? speakingResult.totalScore : 0;
  const speakingAITotal = speakingResult && !speakingIsManual ? speakingResult.totalPossible : 0;
  const totalScore = correct + readingAIScore + writingAIScore + speakingAIScore;
  const totalPossible = total + readingAITotal + writingAITotal + speakingAITotal;
  const percentage = totalPossible > 0 ? Math.round((totalScore / totalPossible) * 100) : 0;
  const manualScoreNotes = [
    writingIsManual ? (lang === 'en' ? 'Writing is pending teacher review and is not included in the automatic score.' : '作文正在等待老师人工批改，当前未计入自动总分。') : null,
    speakingIsManual ? (lang === 'en' ? 'Speaking is pending teacher review and is not included in the automatic score.' : '口语正在等待老师人工批改，当前未计入自动总分。') : null,
  ].filter(Boolean) as string[];

  const getGrade = () => {
    if (percentage >= 90) return { grade: 'A', color: 'text-emerald-600', label: 'Excellent!', label_cn: '优秀！' };
    if (percentage >= 75) return { grade: 'B', color: 'text-blue-600', label: 'Good Job!', label_cn: '做得不错！' };
    if (percentage >= 60) return { grade: 'C', color: 'text-amber-600', label: 'Keep Practicing!', label_cn: '继续加油！' };
    return { grade: 'D', color: 'text-red-500', label: 'Needs Improvement', label_cn: '需要提高' };
  };
  const gradeInfo = getGrade();
  const isStillGrading = isGradingReading || isGradingWriting || isGradingSpeaking || isGeneratingReport;

  useEffect(() => {
    if (hasRequestedReport.current) return;

    const shouldGradeReading = readingSubItems.length > 0;
    const shouldGradeWriting = Boolean(writingSubmission && writingSubmission.essay.trim().length > 10);
    const shouldGradeSpeaking = speakingResponses.length > 0;

    const readingReady = !shouldGradeReading || readingResults !== null || readingError !== null;
    const writingReady = !shouldGradeWriting || writingResult !== null || writingError !== null;
    const speakingReady = !shouldGradeSpeaking || speakingResult !== null || speakingError !== null;

    if (!readingReady || !writingReady || !speakingReady) return;

    hasRequestedReport.current = true;
    setIsGeneratingReport(true);

    const sectionResults = sections.map((section) => {
      if (section.id === 'reading') {
        return {
          sectionId: section.id,
          sectionTitle: section.title,
          correct: readingResults ? readingResults.reduce((sum, item) => sum + item.score, 0) : 0,
          total: readingResults ? readingResults.length : readingSubItems.length,
          timeSeconds: sectionTimings[section.id] || 0,
        };
      }

      if (isWritingLikeSection(section)) {
        return {
          sectionId: section.id,
          sectionTitle: section.title,
          correct: writingResult && !writingIsManual ? writingResult.score : 0,
          total: writingResult && !writingIsManual ? writingResult.maxScore : 0,
          timeSeconds: sectionTimings[section.id] || 0,
        };
      }

      if (isSpeakingLikeSection(section)) {
        const evaluations = speakingResult?.evaluations.filter((item) => item.sectionId === section.id) || [];
        return {
          sectionId: section.id,
          sectionTitle: section.title,
          correct: speakingIsManual ? 0 : evaluations.reduce((sum, item) => sum + item.score, 0),
          total: speakingIsManual ? 0 : evaluations.reduce((sum, item) => sum + item.maxScore, 0),
          timeSeconds: sectionTimings[section.id] || 0,
        };
      }

      return {
        sectionId: section.id,
        sectionTitle: section.title,
        correct: bySection[section.id]?.correct || 0,
        total: bySection[section.id]?.total || 0,
        timeSeconds: sectionTimings[section.id] || 0,
      };
    });

    generateReportMutation.mutate(
      {
        paperTitle: selectedPaper?.title || 'Assessment',
        studentName: recordedStudentName,
        studentGrade: recordedStudentGrade,
        totalScore,
        totalPossible,
        percentage,
        grade: gradeInfo.grade,
        totalTimeSeconds: totalTime,
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
              manualReviewRequired: writingIsManual,
            }
          : undefined,
        speakingSummary: speakingResult
          ? {
              ...speakingResult,
              manualReviewRequired: speakingIsManual,
            }
          : undefined,
      },
      {
        onSuccess: (data) => { setReportResult(data); setIsGeneratingReport(false); },
        onError: () => { setReportError('Failed to generate report.'); setIsGeneratingReport(false); },
      }
    );
  }, [
    bySection,
    generateReportMutation,
    gradeInfo.grade,
    percentage,
    readingError,
    readingResults,
    readingSubItems.length,
    recordedStudentGrade,
    recordedStudentName,
    sections,
    sectionTimings,
    selectedPaper?.title,
    speakingError,
    speakingIsManual,
    speakingResponses.length,
    speakingResult,
    totalScore,
    totalPossible,
    totalTime,
    writingIsManual,
    writingError,
    writingResult,
    writingSubmission,
  ]);

  const getExplanation = (questionId: number): ExplanationResult | undefined => explanations?.find(e => e.questionId === questionId);
  const getReadingResult = (subItemId: string): ReadingGradingResult | undefined => readingResults?.find(r => r.questionId === subItemId);

  const annotatedSegments = useMemo(() => {
    if (!writingResult?.annotatedEssay) return [];
    return parseAnnotatedEssay(writingResult.annotatedEssay);
  }, [writingResult]);

  // Paper name for display
  const paperName = selectedPaper?.title || 'Assessment';

  // PDF download removed from student view - only available in admin history page


  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FAFBFD] via-white to-[#EEF4FF]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Score Card */}
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }} className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-500 text-white mb-6 shadow-lg shadow-amber-200">
            <Trophy className="w-10 h-10" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-800 mb-2">
            {lang === 'en' ? 'Assessment Complete!' : '测评完成！'}
          </h1>
          {isStillGrading ? (
            <div className="flex items-center justify-center gap-2 text-blue-600">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-base">{lang === 'en' ? 'Finalizing your results...' : '正在整理你的测评结果...'}</span>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-slate-500 text-base">{lang === 'en' ? gradeInfo.label : gradeInfo.label_cn}</p>
              {manualScoreNotes.map((note) => (
                <p key={note} className="text-sm text-amber-600">
                  {note}
                </p>
              ))}
            </div>
          )}
          <p className="text-sm text-slate-400 mt-2">{paperName}</p>
        </motion.div>

        {/* Student Info */}
        {(recordedStudentName !== 'Unknown' || recordedStudentGrade) && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15 }} className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mb-6 text-sm text-slate-500">
            <span className="font-semibold text-slate-700">{recordedStudentName}</span>
            {recordedStudentGrade && <span>{lang === 'en' ? 'Grade' : '年级'}: {recordedStudentGrade}</span>}
            <span>{lang === 'en' ? 'Paper' : '测评'}: {paperName}</span>
          </motion.div>
        )}

        {/* Score Display */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }} className="bg-white rounded-2xl border border-slate-200 shadow-lg p-8 mb-8">
          <div className="grid sm:grid-cols-3 gap-6 text-center">
            <div>
              <div className={`text-5xl font-extrabold ${isStillGrading ? 'text-slate-300' : gradeInfo.color} mb-1`}>
                {isStillGrading ? '...' : gradeInfo.grade}
              </div>
              <div className="text-base text-slate-400 font-medium">{lang === 'en' ? 'Grade' : '等级'}</div>
            </div>
            <div>
              <div className="text-5xl font-extrabold text-slate-800 mb-1">
                {isStillGrading ? <span className="text-3xl text-slate-400">{lang === 'en' ? 'Grading...' : '评分中...'}</span>
                  : <>{totalScore}<span className="text-2xl text-slate-400">/{totalPossible}</span></>}
              </div>
              <div className="text-base text-slate-400 font-medium">
                {isStillGrading ? (lang === 'en' ? 'Please wait' : '请稍候') : `${lang === 'en' ? 'Score' : '分数'} (${percentage}%)`}
              </div>
            </div>
            <div>
              <div className="text-5xl font-extrabold text-slate-800 mb-1">
                {minutes}<span className="text-2xl text-slate-400">:{seconds.toString().padStart(2, '0')}</span>
              </div>
              <div className="text-base text-slate-400 font-medium">{lang === 'en' ? 'Time Taken' : '用时'}</div>
            </div>
          </div>
        </motion.div>

        {/* Section Scores */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }} className="bg-white rounded-2xl border border-slate-200 shadow-lg p-6 mb-8">
          <h2 className="font-bold text-lg text-slate-800 mb-4">{lang === 'en' ? 'Section Scores' : '各部分成绩'}</h2>
          <div className="space-y-3">
            {sections.map((section) => {
              const sectionScore = bySection[section.id];
              const sTime = sectionTimings[section.id] || 0;
              const timeStr = sTime > 0 ? formatTime(sTime) : '';

              // Reading section (rule-based auto check)
              if (section.id === 'reading') {
                if (isGradingReading) {
                  return (
                    <div key={section.id} className={`flex items-center gap-4 p-3 rounded-xl ${sectionMeta[section.id]?.bg}`}>
                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${sectionMeta[section.id]?.gradient} text-white flex items-center justify-center`}>{sectionMeta[section.id]?.icon}</div>
                      <div className="flex-1">
                        <div className="font-semibold text-base text-slate-700">{section.title}</div>
                        <div className="flex items-center gap-2 text-sm text-blue-500"><Loader2 className="w-3 h-3 animate-spin" />{lang === 'en' ? 'Checking answers...' : '正在检查答案...'}</div>
                      </div>
                    </div>
                  );
                }
                if (readingResults) {
                  const rCorrect = readingResults.filter(r => r.isCorrect).length;
                  const rTotal = readingResults.length;
                  const pct = rTotal > 0 ? Math.round((rCorrect / rTotal) * 100) : 0;
                  return (
                    <div key={section.id} className={`flex items-center gap-4 p-3 rounded-xl ${sectionMeta[section.id]?.bg}`}>
                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${sectionMeta[section.id]?.gradient} text-white flex items-center justify-center`}>{sectionMeta[section.id]?.icon}</div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-base text-slate-700 flex items-center gap-1">{section.title}<CheckCircle2 className="w-3.5 h-3.5 text-indigo-500" /></span>
                          <div className="flex items-center gap-3">
                            {timeStr && <span className="text-sm text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3" />{timeStr}</span>}
                            <span className="text-base font-bold text-slate-600">{rCorrect}/{rTotal}</span>
                          </div>
                        </div>
                        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, delay: 0.5 }} className={`h-full rounded-full bg-gradient-to-r ${sectionMeta[section.id]?.gradient}`} />
                        </div>
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={section.id} className={`flex items-center gap-4 p-3 rounded-xl ${sectionMeta[section.id]?.bg}`}>
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${sectionMeta[section.id]?.gradient} text-white flex items-center justify-center`}>{sectionMeta[section.id]?.icon}</div>
                    <div className="flex-1">
                      <div className="font-semibold text-base text-slate-700">{section.title}</div>
                      <div className="text-sm text-red-400">{readingError || (lang === 'en' ? 'Grading failed' : '评分失败')}</div>
                    </div>
                  </div>
                );
              }

              // Writing section (AI evaluated, HuaZhong only)
              if (isWritingLikeSection(section)) {
                if (isGradingWriting) {
                  return (
                    <div key={section.id} className={`flex items-center gap-4 p-3 rounded-xl ${sectionMeta[section.id]?.bg}`}>
                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${sectionMeta[section.id]?.gradient} text-white flex items-center justify-center`}>{sectionMeta[section.id]?.icon}</div>
                      <div className="flex-1">
                        <div className="font-semibold text-base text-slate-700">{section.title}</div>
                        <div className="flex items-center gap-2 text-sm text-blue-500"><Loader2 className="w-3 h-3 animate-spin" />{lang === 'en' ? 'Preparing teacher review...' : '正在准备人工批改...'}</div>
                      </div>
                    </div>
                  );
                }
                if (writingResult) {
                  if (writingIsManual) {
                    return (
                      <div key={section.id} className={`flex items-center gap-4 p-3 rounded-xl ${sectionMeta[section.id]?.bg}`}>
                        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${sectionMeta[section.id]?.gradient} text-white flex items-center justify-center`}>{sectionMeta[section.id]?.icon}</div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-base text-slate-700 flex items-center gap-2">
                              {section.title}
                              <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                            </span>
                            <div className="flex items-center gap-3">
                              {timeStr && <span className="text-sm text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3" />{timeStr}</span>}
                              <span className="text-sm font-semibold text-amber-600">
                                {lang === 'en' ? 'Manual Review' : '人工批改'}
                              </span>
                            </div>
                          </div>
                          <p className="text-sm text-slate-500 leading-relaxed">
                            {lang === 'en'
                              ? 'Teacher scoring is required for this writing section.'
                              : '本写作部分需要老师人工评分。'}
                          </p>
                        </div>
                      </div>
                    );
                  }
                  const pct = Math.round((writingResult.score / writingResult.maxScore) * 100);
                  return (
                    <div key={section.id} className={`flex items-center gap-4 p-3 rounded-xl ${sectionMeta[section.id]?.bg}`}>
                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${sectionMeta[section.id]?.gradient} text-white flex items-center justify-center`}>{sectionMeta[section.id]?.icon}</div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-base text-slate-700 flex items-center gap-1">{section.title}<Sparkles className="w-3.5 h-3.5 text-rose-500" /></span>
                          <div className="flex items-center gap-3">
                            {timeStr && <span className="text-sm text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3" />{timeStr}</span>}
                            <span className="text-base font-bold text-slate-600">{writingResult.score}/{writingResult.maxScore}</span>
                          </div>
                        </div>
                        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, delay: 0.5 }} className={`h-full rounded-full bg-gradient-to-r ${sectionMeta[section.id]?.gradient}`} />
                        </div>
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={section.id} className={`flex items-center gap-4 p-3 rounded-xl ${sectionMeta[section.id]?.bg}`}>
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${sectionMeta[section.id]?.gradient} text-white flex items-center justify-center`}>{sectionMeta[section.id]?.icon}</div>
                    <div className="flex-1">
                      <div className="font-semibold text-base text-slate-700">{section.title}</div>
                      <div className="text-sm text-red-400">{writingError || (lang === 'en' ? 'No essay submitted' : '未提交作文')}</div>
                    </div>
                  </div>
                );
              }

              if (isSpeakingLikeSection(section)) {
                if (isGradingSpeaking) {
                  return (
                    <div key={section.id} className={`flex items-center gap-4 p-3 rounded-xl ${sectionMeta[section.id]?.bg || 'bg-slate-50'}`}>
                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${sectionMeta[section.id]?.gradient} text-white flex items-center justify-center`}>{sectionMeta[section.id]?.icon}</div>
                      <div className="flex-1">
                        <div className="font-semibold text-base text-slate-700">{section.title}</div>
                        <div className="flex items-center gap-2 text-sm text-blue-500"><Loader2 className="w-3 h-3 animate-spin" />{lang === 'en' ? 'Preparing teacher review...' : '正在准备人工批改...'}</div>
                      </div>
                    </div>
                  );
                }

                const evaluations = speakingResult?.evaluations.filter((item) => item.sectionId === section.id) || [];
                if (speakingIsManual && evaluations.length > 0) {
                  return (
                    <div key={section.id} className={`flex items-center gap-4 p-3 rounded-xl ${sectionMeta[section.id]?.bg || 'bg-slate-50'}`}>
                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${sectionMeta[section.id]?.gradient} text-white flex items-center justify-center`}>{sectionMeta[section.id]?.icon}</div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-base text-slate-700 flex items-center gap-2">
                            {section.title}
                            <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                          </span>
                          <div className="flex items-center gap-3">
                            {timeStr && <span className="text-sm text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3" />{timeStr}</span>}
                            <span className="text-sm font-semibold text-amber-600">
                              {lang === 'en' ? 'Manual Review' : '人工批改'}
                            </span>
                          </div>
                        </div>
                        <p className="text-sm text-slate-500 leading-relaxed">
                          {lang === 'en'
                            ? 'Teacher scoring is required for this speaking section.'
                            : '本口语部分需要老师人工评分。'}
                        </p>
                      </div>
                    </div>
                  );
                }
                if (evaluations.length > 0) {
                  const sectionScore = evaluations.reduce((sum, item) => sum + item.score, 0);
                  const sectionTotal = evaluations.reduce((sum, item) => sum + item.maxScore, 0);
                  const pct = sectionTotal > 0 ? Math.round((sectionScore / sectionTotal) * 100) : 0;
                  return (
                    <div key={section.id} className={`flex items-center gap-4 p-3 rounded-xl ${sectionMeta[section.id]?.bg || 'bg-slate-50'}`}>
                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${sectionMeta[section.id]?.gradient} text-white flex items-center justify-center`}>{sectionMeta[section.id]?.icon}</div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-base text-slate-700 flex items-center gap-1">{section.title}<Sparkles className="w-3.5 h-3.5 text-sky-500" /></span>
                          <div className="flex items-center gap-3">
                            {timeStr && <span className="text-sm text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3" />{timeStr}</span>}
                            <span className="text-base font-bold text-slate-600">{sectionScore}/{sectionTotal}</span>
                          </div>
                        </div>
                        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, delay: 0.5 }} className={`h-full rounded-full bg-gradient-to-r ${sectionMeta[section.id]?.gradient}`} />
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={section.id} className={`flex items-center gap-4 p-3 rounded-xl ${sectionMeta[section.id]?.bg || 'bg-slate-50'}`}>
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${sectionMeta[section.id]?.gradient} text-white flex items-center justify-center`}>{sectionMeta[section.id]?.icon}</div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-base text-slate-700">{section.title}</span>
                        <span className="text-sm text-red-400 font-medium">{speakingError || (lang === 'en' ? 'No speaking response submitted' : '未提交口语作答')}</span>
                      </div>
                    </div>
                  </div>
                );
              }

              // Regular sections
              if (!sectionScore || sectionScore.total === 0) return null;
              const pct = Math.round((sectionScore.correct / sectionScore.total) * 100);
              return (
                <div key={section.id} className={`flex items-center gap-4 p-3 rounded-xl ${sectionMeta[section.id]?.bg || 'bg-slate-50'}`}>
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${sectionMeta[section.id]?.gradient} text-white flex items-center justify-center`}>{sectionMeta[section.id]?.icon}</div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-base text-slate-700">{section.title}</span>
                      <div className="flex items-center gap-3">
                        {timeStr && <span className="text-sm text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3" />{timeStr}</span>}
                        <span className="text-base font-bold text-slate-600">{sectionScore.correct}/{sectionScore.total}</span>
                      </div>
                    </div>
                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, delay: 0.5 }} className={`h-full rounded-full bg-gradient-to-r ${sectionMeta[section.id]?.gradient}`} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Answer Review - Auto-graded sections */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.4 }} className="space-y-6 mb-8">
          <h2 className="font-bold text-lg text-slate-800">{lang === 'en' ? 'Answer Review' : '答案回顾'}</h2>
          {detailedResults.map((section) => {
            const sectionScore = bySection[section.sectionId];
            const scoreText = sectionScore ? `${sectionScore.correct} out of ${sectionScore.total}` : '';
            return (
              <div key={section.sectionId} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className={`px-5 py-3 ${sectionMeta[section.sectionId]?.bg || 'bg-slate-50'} border-b border-slate-200 flex items-center justify-between`}>
                  <h3 className="font-bold text-base text-slate-700">{section.sectionTitle}</h3>
                  {scoreText && <span className="text-base font-bold text-slate-600">{scoreText}</span>}
                </div>
                <div className="divide-y divide-slate-100">
                  {section.questions.map((q) => {
                    const expl = getExplanation(q.id);
                    return (
                      <div key={q.id} className="px-5 py-4">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5">
                            {q.isCorrect ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <XCircle className="w-5 h-5 text-red-400" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-slate-600 mb-1">
                              <span className="font-bold text-slate-500">Q{q.id}.</span> {q.question}
                            </p>
                            {q.context && (
                              <p className="text-xs text-slate-400 mb-2">{q.context}</p>
                            )}
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                              <span className={q.isCorrect ? 'text-emerald-600' : 'text-red-500'}>
                                {lang === 'en' ? 'Your answer' : '你的答案'}: <span className="font-medium">{q.userAnswer}</span>
                              </span>
                              {!q.isCorrect && (
                                <span className="text-emerald-600">
                                  {lang === 'en' ? 'Correct' : '正确答案'}: <span className="font-medium">{q.correctAnswer}</span>
                                </span>
                              )}
                            </div>
                            {q.options && q.options.length > 0 && <ReviewOptionsList options={q.options} lang={lang} />}
                            {!q.isCorrect && expl && (
                              <CollapsibleExplanation
                                explanation={lang === 'en' ? expl.explanation_en : expl.explanation_cn}
                                tip={lang === 'en' ? expl.tip_en : expl.tip_cn}
                                lang={lang}
                              />
                            )}
                            {!q.isCorrect && !expl && isLoadingExplanations && (
                              <div className="mt-2 flex items-center gap-1.5 text-sm text-blue-500">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                {lang === 'en' ? 'Generating explanation...' : '正在生成解析...'}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </motion.div>

        {/* Reading Comprehension Review */}
        {(readingResults || isGradingReading) && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.5 }} className="mb-8">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 bg-indigo-50 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base text-slate-700">{lang === 'en' ? 'Reading Comprehension' : '阅读理解'}</h3>
                  <CheckCircle2 className="w-4 h-4 text-indigo-500" />
                  <span className="text-sm text-indigo-500 font-medium">{lang === 'en' ? 'Automatically Checked' : '自动检查'}</span>
                </div>
                {readingResults && (
                  <span className="text-base font-bold text-slate-600">
                    {readingResults.filter(r => r.isCorrect).length} out of {readingResults.length}
                  </span>
                )}
              </div>
              {isGradingReading ? (
                <div className="p-8 text-center">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-500 mx-auto mb-3" />
                  <p className="text-base text-slate-500">{lang === 'en' ? 'Checking your reading answers...' : '正在检查阅读理解答案...'}</p>
                </div>
              ) : readingResults ? (
                <div className="divide-y divide-slate-100">
                  {readingSubItems.filter((item) => getReadingResult(item.id)).map((item) => {
                    const result = getReadingResult(item.id)!;
                    return (
                      <div key={item.id} className="px-5 py-4">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5">
                            {result.isCorrect ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <XCircle className="w-5 h-5 text-red-400" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-base font-medium text-slate-700">{item.label}</p>
                              <span className={`text-base font-bold ${result.isCorrect ? 'text-emerald-500' : 'text-red-400'}`}>{result.score}/1</span>
                            </div>
                            <p className="text-sm text-slate-500 mb-1">{item.questionText}</p>
                            {item.context && (
                              <p className="text-xs text-slate-400 mb-2">{item.context}</p>
                            )}
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                              <span className={result.isCorrect ? 'text-emerald-600' : 'text-red-500'}>
                                {lang === 'en' ? 'Your answer' : '你的答案'}: <span className="font-medium">{item.userAnswer}</span>
                              </span>
                              {!result.isCorrect && (
                                <span className="text-emerald-600">
                                  {lang === 'en' ? 'Correct' : '正确答案'}: <span className="font-medium">{item.correctAnswer}</span>
                                </span>
                              )}
                            </div>
                            {item.options && item.options.length > 0 && <ReviewOptionsList options={item.options} lang={lang} />}
                            <p className="text-sm text-slate-400 mt-1">{lang === 'en' ? result.feedback_en : result.feedback_cn}</p>
                            {!result.isCorrect && (lang === 'en' ? result.explanation_en : result.explanation_cn) && (
                              <CollapsibleExplanation
                                explanation={lang === 'en' ? result.explanation_en : result.explanation_cn}
                                tip={lang === 'en' ? "Re-read the relevant paragraph carefully and look for key phrases." : "仔细重读相关段落，寻找关键短语。"}
                                lang={lang}
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-5 text-center text-base text-red-400">{readingError || (lang === 'en' ? 'Grading failed' : '评分失败')}</div>
              )}
            </div>
          </motion.div>
        )}

        {/* AI Writing Evaluation (HuaZhong only) */}
        {writingResult && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.6 }} className="mb-8">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
              <div className="px-5 py-3 bg-rose-50 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base text-slate-700">{lang === 'en' ? 'Writing Review' : '写作批改'}</h3>
                  {writingIsManual ? <AlertCircle className="w-4 h-4 text-amber-500" /> : <Sparkles className="w-4 h-4 text-rose-500" />}
                  <span className={`text-sm font-medium ${writingIsManual ? 'text-amber-600' : 'text-rose-500'}`}>
                    {writingIsManual ? (lang === 'en' ? 'Teacher Review Required' : '需要老师人工批改') : (lang === 'en' ? 'Automated Review' : '自动评估')}
                  </span>
                </div>
                {!writingIsManual && (
                  <span className="text-base font-bold text-slate-600">{writingResult.score} out of {writingResult.maxScore}</span>
                )}
              </div>

	              <div className="p-6 space-y-6">
	                {!writingIsManual && (
	                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
	                    <h4 className="font-semibold text-base text-slate-700 mb-2">{lang === 'en' ? 'Overall Feedback' : '总体反馈'}</h4>
	                    <p className="text-base text-slate-600 leading-relaxed">{lang === 'en' ? writingResult.overallFeedback_en : writingResult.overallFeedback_cn}</p>
	                  </div>
	                )}

                {writingIsManual ? (
                  <div>
                    {writingSubmission?.essay?.trim() ? (
                      <>
                        <h4 className="font-semibold text-base text-slate-700 mb-2">{lang === 'en' ? 'Student Essay' : '学生作文'}</h4>
                        <div className="p-5 rounded-xl bg-amber-50/50 border border-amber-200 text-base text-slate-700 leading-[2] whitespace-pre-wrap">
                          {writingSubmission.essay}
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-slate-500">{lang === 'en' ? 'No essay text was submitted.' : '未提交作文内容。'}</p>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
                      <button onClick={() => setWritingTab('annotated')}
                        className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-all ${writingTab === 'annotated' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                        {lang === 'en' ? 'Annotated Original' : '原文标注'}
                      </button>
                      <button onClick={() => setWritingTab('corrected')}
                        className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-all ${writingTab === 'corrected' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                        {lang === 'en' ? 'Corrected Version' : '修正版本'}
                      </button>
                      <button onClick={() => setWritingTab('errors')}
                        className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-all ${writingTab === 'errors' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                        {lang === 'en' ? `Error List (${writingResult.grammarErrors.length})` : `错误列表 (${writingResult.grammarErrors.length})`}
                      </button>
                    </div>

                    {writingTab === 'annotated' && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <h4 className="font-semibold text-base text-slate-700">{lang === 'en' ? 'Your Essay with Inline Corrections' : '原文标注纠错'}</h4>
                          <span className="text-sm text-slate-400">{lang === 'en' ? '(hover/click errors for details)' : '(悬停/点击错误查看详情)'}</span>
                        </div>
                        <div className="p-5 rounded-xl bg-amber-50/50 border border-amber-200 text-base text-slate-700 leading-[2] whitespace-pre-wrap">
                          {annotatedSegments.length > 0 ? (
                            annotatedSegments.map((seg, i) =>
                              seg.type === 'text' ? <span key={i}>{seg.content}</span> : (
                                <ErrorAnnotation key={i} content={seg.content} correction={seg.correction} explanation={seg.explanation} />
                              )
                            )
                          ) : (
                            <span className="text-slate-400 italic">{lang === 'en' ? 'No annotated version available.' : '暂无标注版本。'}</span>
                          )}
                        </div>
                        <div className="mt-3 flex items-center gap-4 text-sm text-slate-400">
                          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-red-100 rounded border border-red-300" />{lang === 'en' ? 'Original (error)' : '原文（错误）'}</span>
                          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-emerald-100 rounded border border-emerald-300" />{lang === 'en' ? 'Correction' : '修正'}</span>
                        </div>
                      </div>
                    )}

                    {writingTab === 'corrected' && writingResult.correctedEssay && (
                      <div>
                        <h4 className="font-semibold text-base text-slate-700 mb-2">{lang === 'en' ? 'Corrected Version' : '修正版本'}</h4>
                        <div className="p-5 rounded-xl bg-emerald-50 border border-emerald-200 text-base text-slate-700 leading-[2] whitespace-pre-wrap">
                          {writingResult.correctedEssay}
                        </div>
                      </div>
                    )}

                    {writingTab === 'errors' && writingResult.grammarErrors.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-base text-slate-700 mb-3 flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-red-400" />
                          {lang === 'en' ? `Grammar & Spelling Errors (${writingResult.grammarErrors.length})` : `语法和拼写错误 (${writingResult.grammarErrors.length})`}
                        </h4>
                        <div className="space-y-2">
                          {writingResult.grammarErrors.map((err, i) => (
                            <div key={i} className="p-3 rounded-lg bg-red-50 border border-red-200">
                              <div className="flex items-start gap-2 text-sm">
                                <span className="text-red-500 line-through">{err.original}</span>
                                <span className="text-slate-400 shrink-0">&rarr;</span>
                                <span className="text-emerald-600 font-medium">{err.correction}</span>
                              </div>
                              <p className="text-sm text-slate-500 mt-1">{lang === 'en' ? err.explanation_en : err.explanation_cn}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

	                {!writingIsManual && ((lang === 'en' ? writingResult.suggestions_en : writingResult.suggestions_cn) || []).length > 0 && (
	                  <div>
	                    <h4 className="font-semibold text-base text-slate-700 mb-3">{lang === 'en' ? 'Suggestions for Improvement' : '改进建议'}</h4>
	                    <ul className="space-y-2">
                      {(lang === 'en' ? writingResult.suggestions_en : writingResult.suggestions_cn).map((s, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                          <span className="text-blue-500 font-bold mt-0.5">{i + 1}.</span>{s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {(speakingResult || isGradingSpeaking) && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.65 }} className="mb-8">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
              <div className="px-5 py-3 bg-sky-50 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base text-slate-700">{lang === 'en' ? 'Speaking Review' : '口语批改'}</h3>
                  {speakingUsesTeacherReview ? <AlertCircle className="w-4 h-4 text-amber-500" /> : <Sparkles className="w-4 h-4 text-sky-500" />}
                  <span className={`text-sm font-medium ${speakingUsesTeacherReview ? 'text-amber-600' : 'text-sky-500'}`}>
                    {speakingIsManual
                      ? (lang === 'en' ? 'Teacher Review Required' : '需要老师人工批改')
                      : speakingUsesTeacherReview
                        ? (lang === 'en' ? 'Teacher Review' : '老师评分')
                        : (lang === 'en' ? 'Automated Review' : '自动评估')}
                  </span>
                </div>
                {speakingResult && !speakingIsManual && (
                  <span className="text-base font-bold text-slate-600">{speakingResult.totalScore} {lang === 'en' ? 'out of' : '/'} {speakingResult.totalPossible}</span>
                )}
              </div>

              {isGradingSpeaking ? (
                <div className="p-8 text-center">
                  <Loader2 className="w-6 h-6 animate-spin text-sky-500 mx-auto mb-3" />
                  <p className="text-base text-slate-500">{lang === 'en' ? 'Preparing speaking for teacher review...' : '正在整理口语作答，准备人工批改...'}</p>
                </div>
              ) : speakingResult ? (
                <div className="p-6 space-y-6">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <h4 className="font-semibold text-base text-slate-700 mb-2">{lang === 'en' ? 'Overall Feedback' : '总体反馈'}</h4>
                    <p className="text-base text-slate-600 leading-relaxed">{lang === 'en' ? speakingResult.overallFeedback_en : speakingResult.overallFeedback_cn}</p>
                  </div>

                  {speakingResult.evaluations.map((item) => (
                    <div key={`${item.sectionId}:${item.questionId}`} className="rounded-xl border border-slate-200 overflow-hidden">
                      <div className="px-5 py-3 bg-sky-50/80 border-b border-slate-200 flex items-center justify-between">
                        <div>
                          <h4 className="font-semibold text-slate-700">{item.sectionTitle} · Q{item.questionId}</h4>
                          <p className="text-sm text-slate-500 mt-1">{item.prompt}</p>
                        </div>
                        {speakingIsManual ? (
                          <span className="text-sm font-semibold text-amber-600">{lang === 'en' ? 'Manual Review' : '人工批改'}</span>
                        ) : (
                          <span className="text-base font-bold text-slate-700">{item.score}/{item.maxScore}</span>
                        )}
                      </div>

                      <div className="p-5 space-y-4">
                        {speakingIsManual ? (
                          <>
                            <div className="rounded-lg bg-amber-50/70 border border-amber-200 p-4">
                              <p className="text-sm font-semibold text-slate-700 mb-1">{lang === 'en' ? 'Teacher Review Status' : '人工批改状态'}</p>
                              <p className="text-sm text-slate-600">
                                {lang === 'en'
                                  ? 'The recording has been submitted. A teacher should listen to the original audio and add a score and comments manually.'
                                  : '录音已提交。老师需要收听原始音频，并人工补充分数和评语。'}
                              </p>
                            </div>

                            {((lang === 'en' ? item.suggestions_en : item.suggestions_cn) || []).length > 0 && (
                              <div>
                                <p className="text-sm font-semibold text-slate-700 mb-2">{lang === 'en' ? 'Teacher Checklist' : '老师批改提示'}</p>
                                <ul className="space-y-1.5">
                                  {(lang === 'en' ? item.suggestions_en : item.suggestions_cn).map((suggestion, index) => (
                                    <li key={index} className="text-sm text-slate-600 flex items-start gap-2">
                                      <span className="text-sky-500 font-bold mt-0.5">{index + 1}.</span>
                                      <span>{suggestion}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </>
                        ) : speakingUsesTeacherReview ? (
                          <>
                            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                              <p className="text-sm font-semibold text-slate-700 mb-1">{lang === 'en' ? 'Teacher Comment' : '老师评语'}</p>
                              <p className="text-sm text-slate-600">
                                {lang === 'en' ? item.feedback_en : item.feedback_cn}
                              </p>
                            </div>

                            {((lang === 'en' ? item.suggestions_en : item.suggestions_cn) || []).length > 0 && (
                              <div>
                                <p className="text-sm font-semibold text-slate-700 mb-2">{lang === 'en' ? 'Improvement Suggestions' : '改进建议'}</p>
                                <ul className="space-y-1.5">
                                  {(lang === 'en' ? item.suggestions_en : item.suggestions_cn).map((suggestion, index) => (
                                    <li key={index} className="text-sm text-slate-600 flex items-start gap-2">
                                      <span className="text-sky-500 font-bold mt-0.5">{index + 1}.</span>
                                      <span>{suggestion}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            <div>
                              <p className="text-sm font-semibold text-slate-600 mb-1">{lang === 'en' ? 'Transcript' : '转写内容'}</p>
                              <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-sm text-slate-700 whitespace-pre-wrap">{item.transcript || (lang === 'en' ? 'No transcript available.' : '暂无转写内容。')}</div>
                            </div>

                            <div className="grid md:grid-cols-2 gap-3">
                              <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                                <p className="text-sm font-semibold text-slate-700 mb-1">{lang === 'en' ? 'Task Completion' : '任务完成度'}</p>
                                <p className="text-sm text-slate-600">{lang === 'en' ? item.taskCompletion_en : item.taskCompletion_cn}</p>
                              </div>
                              <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                                <p className="text-sm font-semibold text-slate-700 mb-1">{lang === 'en' ? 'Fluency' : '流利度'}</p>
                                <p className="text-sm text-slate-600">{lang === 'en' ? item.fluency_en : item.fluency_cn}</p>
                              </div>
                              <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                                <p className="text-sm font-semibold text-slate-700 mb-1">{lang === 'en' ? 'Vocabulary' : '词汇'}</p>
                                <p className="text-sm text-slate-600">{lang === 'en' ? item.vocabulary_en : item.vocabulary_cn}</p>
                              </div>
                              <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                                <p className="text-sm font-semibold text-slate-700 mb-1">{lang === 'en' ? 'Grammar' : '语法'}</p>
                                <p className="text-sm text-slate-600">{lang === 'en' ? item.grammar_en : item.grammar_cn}</p>
                              </div>
                              <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 md:col-span-2">
                                <p className="text-sm font-semibold text-slate-700 mb-1">{lang === 'en' ? 'Pronunciation / Clarity' : '发音 / 清晰度'}</p>
                                <p className="text-sm text-slate-600">{lang === 'en' ? item.pronunciation_en : item.pronunciation_cn}</p>
                              </div>
                            </div>

                            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                              <p className="text-sm font-semibold text-slate-700 mb-1">{lang === 'en' ? 'Overall Comment' : '整体点评'}</p>
                              <p className="text-sm text-slate-600">{lang === 'en' ? item.feedback_en : item.feedback_cn}</p>
                            </div>

                            {((lang === 'en' ? item.suggestions_en : item.suggestions_cn) || []).length > 0 && (
                              <div>
                                <p className="text-sm font-semibold text-slate-700 mb-2">{lang === 'en' ? 'Suggestions' : '改进建议'}</p>
                                <ul className="space-y-1.5">
                                  {(lang === 'en' ? item.suggestions_en : item.suggestions_cn).map((suggestion, index) => (
                                    <li key={index} className="text-sm text-slate-600 flex items-start gap-2">
                                      <span className="text-sky-500 font-bold mt-0.5">{index + 1}.</span>
                                      <span>{suggestion}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-5 text-center text-base text-red-400">{speakingError || (lang === 'en' ? 'Speaking review unavailable' : '口语批改信息不可用')}</div>
              )}
            </div>
          </motion.div>
        )}

        {(reportResult || isGeneratingReport || reportError) && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.7 }} className="mb-8">
            <div className="relative bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden"
              >
                <div className="select-none whitespace-nowrap text-[52px] sm:text-[88px] font-black tracking-[0.2em] text-slate-100/80 rotate-[-24deg]">
                  {APP_BRAND_SUBTITLE} · PUREON EDUCATION
                </div>
              </div>
              <div className="relative z-10">
                <div className="px-5 py-3 bg-blue-50/95 border-b border-slate-200">
                  <div>
                    <h3 className="font-bold text-base text-slate-700">{reportResult?.reportTitle_en || 'Assessment Feedback Report'}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{APP_BRAND_TITLE} · {APP_BRAND_SUBTITLE}</p>
                  </div>
                </div>

                {isGeneratingReport ? (
                  <div className="p-8 text-center">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-500 mx-auto mb-3" />
                    <p className="text-base text-slate-500">{lang === 'en' ? 'Preparing the final report...' : '正在整理最终报告...'}</p>
                  </div>
                ) : reportResult ? (
                  <div className="p-6 space-y-6">
                    <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
                      <h4 className="font-semibold text-base text-slate-700 mb-2">{lang === 'en' ? 'Overall Summary' : '整体情况总结'}</h4>
                      <p className="text-base text-slate-600 leading-relaxed">{lang === 'en' ? reportResult.overallSummary_en : reportResult.overallSummary_cn}</p>
                    </div>

                    {((lang === 'en' ? reportResult.abilitySnapshot_en : reportResult.abilitySnapshot_cn) || []).length > 0 && (
                      <div>
                        <h4 className="font-semibold text-base text-slate-700 mb-3">{lang === 'en' ? 'Ability Snapshot' : '能力概括'}</h4>
                        <div className="flex flex-wrap gap-2">
                          {(lang === 'en' ? reportResult.abilitySnapshot_en : reportResult.abilitySnapshot_cn).map((item, index) => (
                            <span key={index} className="px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 text-sm border border-blue-100">{item}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4">
                        <h4 className="font-semibold text-base text-slate-700 mb-3">{lang === 'en' ? 'Current Strengths' : '当前优势'}</h4>
                        <ul className="space-y-2">
                          {(lang === 'en' ? reportResult.strengths_en : reportResult.strengths_cn).map((item, index) => (
                            <li key={index} className="text-sm text-slate-600 flex items-start gap-2">
                              <span className="text-emerald-600 font-bold mt-0.5">{index + 1}.</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
                        <h4 className="font-semibold text-base text-slate-700 mb-3">{lang === 'en' ? 'Priority Areas' : '优先提升方向'}</h4>
                        <ul className="space-y-2">
                          {(lang === 'en' ? reportResult.weaknesses_en : reportResult.weaknesses_cn).map((item, index) => (
                            <li key={index} className="text-sm text-slate-600 flex items-start gap-2">
                              <span className="text-amber-600 font-bold mt-0.5">{index + 1}.</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
                      <div className="rounded-xl bg-blue-50 border border-blue-200 p-4">
                        <h4 className="font-semibold text-base text-slate-700 mb-3">{lang === 'en' ? 'Core Improvement Directions' : '核心提升方向'}</h4>
                        <ul className="space-y-2">
                          {(lang === 'en' ? reportResult.recommendations_en : reportResult.recommendations_cn).map((item, index) => (
                            <li key={index} className="text-sm text-slate-600 flex items-start gap-2">
                              <span className="text-blue-600 font-bold mt-0.5">{index + 1}.</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
                        <h4 className="font-semibold text-base text-slate-700 mb-2">{lang === 'en' ? 'Time Analysis' : '时间分析'}</h4>
                        <p className="text-sm text-slate-600 leading-relaxed">{lang === 'en' ? reportResult.timeAnalysis_en : reportResult.timeAnalysis_cn}</p>
                      </div>
                    </div>

                    {reportResult.sectionInsights.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-base text-slate-700 mb-3">{lang === 'en' ? 'Section Insights' : '分项能力分析'}</h4>
                        <div className="space-y-3">
                          {reportResult.sectionInsights.map((item) => (
                            <div key={item.sectionId} className="rounded-lg bg-slate-50 border border-slate-200 p-4">
                              <p className="font-medium text-slate-700 mb-1">{item.sectionTitle}</p>
                              <p className="text-sm text-slate-600">{lang === 'en' ? item.summary_en : item.summary_cn}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {reportResult.studyPlan.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-base text-slate-700 mb-3">{lang === 'en' ? 'Three-Stage Study Plan' : '三阶段学习规划'}</h4>
                        <div className="space-y-3">
                          {reportResult.studyPlan.map((stage, index) => (
                            <div key={index} className="rounded-lg border border-slate-200 overflow-hidden">
                              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                                <p className="font-medium text-slate-700">{lang === 'en' ? stage.stage_en : stage.stage_cn} · {lang === 'en' ? stage.focus_en : stage.focus_cn}</p>
                              </div>
                              <ul className="p-4 space-y-2">
                                {(lang === 'en' ? stage.actions_en : stage.actions_cn).map((action, actionIndex) => (
                                  <li key={actionIndex} className="text-sm text-slate-600 flex items-start gap-2">
                                    <span className="text-blue-500 font-bold mt-0.5">{actionIndex + 1}.</span>
                                    <span>{action}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
                      <h4 className="font-semibold text-base text-slate-700 mb-2">{lang === 'en' ? 'Parent Feedback' : '给家长的反馈'}</h4>
                      <p className="text-base text-slate-600 leading-relaxed">{lang === 'en' ? reportResult.parentFeedback_en : reportResult.parentFeedback_cn}</p>
                    </div>
                  </div>
                ) : (
                  <div className="p-5 text-center text-base text-red-400">{reportError || (lang === 'en' ? 'Report preparation failed' : '报告整理失败')}</div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Retry Button */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.8 }} className="text-center">
          <Button onClick={resetQuiz} size="lg"
            className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 px-8 py-6 text-lg rounded-xl shadow-lg shadow-blue-200">
            <RotateCcw className="w-5 h-5" />
            {lang === 'en' ? 'Try Again' : '再试一次'}
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
