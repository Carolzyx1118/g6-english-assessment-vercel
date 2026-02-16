import { useQuiz } from '@/contexts/QuizContext';
import { sections } from '@/data/questions';
import { trpc } from '@/lib/trpc';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy, RotateCcw, CheckCircle2, XCircle, BookOpen, Headphones,
  PenTool, FileText, Loader2, Sparkles, AlertCircle, Lightbulb,
  Clock, Target, TrendingUp, ChevronDown, ChevronUp, Globe,
  Download, Languages,
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Button } from '@/components/ui/button';
import { useEffect, useState, useRef, useMemo, useCallback } from 'react';

const sectionMeta: Record<string, { icon: React.ReactNode; gradient: string; bg: string }> = {
  listening: { icon: <Headphones className="w-5 h-5" />, gradient: 'from-blue-500 to-blue-600', bg: 'bg-blue-50' },
  vocabulary: { icon: <BookOpen className="w-5 h-5" />, gradient: 'from-emerald-500 to-emerald-600', bg: 'bg-emerald-50' },
  grammar: { icon: <PenTool className="w-5 h-5" />, gradient: 'from-amber-500 to-amber-600', bg: 'bg-amber-50' },
  reading: { icon: <FileText className="w-5 h-5" />, gradient: 'from-indigo-500 to-indigo-600', bg: 'bg-indigo-50' },
  writing: { icon: <PenTool className="w-5 h-5" />, gradient: 'from-rose-500 to-rose-600', bg: 'bg-rose-50' },
};

// Bilingual types
type Lang = 'en' | 'cn';
type ReadingGradingResult = { questionId: string; isCorrect: boolean; score: number; feedback_en: string; feedback_cn: string; explanation_en: string; explanation_cn: string };
type WritingEvalResult = {
  score: number; maxScore: number; grade: string;
  overallFeedback_en: string; overallFeedback_cn: string;
  grammarErrors: { original: string; correction: string; explanation_en: string; explanation_cn: string }[];
  suggestions_en: string[]; suggestions_cn: string[];
  correctedEssay: string; annotatedEssay: string;
};
type ExplanationResult = { questionId: number; explanation_en: string; explanation_cn: string; tip_en: string; tip_cn: string };
type ReportResult = {
  languageLevel: string;
  summary_en: string; summary_cn: string;
  strengths_en: string[]; strengths_cn: string[];
  weaknesses_en: string[]; weaknesses_cn: string[];
  recommendations_en: string[]; recommendations_cn: string[];
  timeAnalysis_en: string; timeAnalysis_cn: string;
};

// Parse annotated essay into segments
function parseAnnotatedEssay(annotated: string): { type: 'text' | 'error'; content: string; correction?: string; explanation?: string }[] {
  const segments: { type: 'text' | 'error'; content: string; correction?: string; explanation?: string }[] = [];
  const regex = /\[\[ERROR:(.*?)\|\|(.*?)\|\|(.*?)\]\]/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(annotated)) !== null) {
    if (match.index > lastIndex) segments.push({ type: 'text', content: annotated.slice(lastIndex, match.index) });
    segments.push({ type: 'error', content: match[1], correction: match[2], explanation: match[3] });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < annotated.length) segments.push({ type: 'text', content: annotated.slice(lastIndex) });
  return segments;
}

// Inline error annotation component
function ErrorAnnotation({ content, correction, explanation }: { content: string; correction?: string; explanation?: string }) {
  const [showTooltip, setShowTooltip] = useState(false);
  return (
    <span className="relative inline">
      <span className="relative cursor-pointer group"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={() => setShowTooltip(!showTooltip)}
      >
        <span className="bg-red-100 text-red-600 line-through decoration-red-400 decoration-2 px-0.5 rounded">{content}</span>
        <span className="bg-emerald-100 text-emerald-700 font-medium px-0.5 rounded ml-0.5 not-italic">{correction}</span>
        {showTooltip && explanation && (
          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800 text-white text-sm rounded-lg shadow-lg whitespace-normal w-72 z-50 text-left">
            {explanation}
            <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
          </span>
        )}
      </span>
    </span>
  );
}

// Collapsible explanation with bilingual support
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

// Sub-question item for reading section
interface ReadingSubItem {
  id: string;
  parentId: number;
  label: string;
  questionText: string;
  userAnswer: string;
  correctAnswer: string;
  questionType: string;
}

// Language toggle button
function LangToggle({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  return (
    <button
      onClick={() => setLang(lang === 'en' ? 'cn' : 'en')}
      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-violet-100 to-blue-100 hover:from-violet-200 hover:to-blue-200 text-sm font-semibold text-violet-700 transition-all shadow-sm border border-violet-200"
    >
      <Languages className="w-4 h-4" />
      {lang === 'en' ? '切换中文' : 'Switch to English'}
    </button>
  );
}

export default function ResultsPage() {
  const { getScore, resetQuiz, state, getAnswer, getSectionTimings, getTotalTime } = useQuiz();
  const { correct, total, bySection } = getScore();

  const totalTime = getTotalTime();
  const sectionTimings = getSectionTimings();
  const minutes = Math.floor(totalTime / 60);
  const seconds = totalTime % 60;

  // Language state
  const [lang, setLang] = useState<Lang>('en');

  // AI Grading states
  const [readingResults, setReadingResults] = useState<ReadingGradingResult[] | null>(null);
  const [writingResult, setWritingResult] = useState<WritingEvalResult | null>(null);
  const [explanations, setExplanations] = useState<ExplanationResult[] | null>(null);
  const [report, setReport] = useState<ReportResult | null>(null);
  const [isGradingReading, setIsGradingReading] = useState(false);
  const [isGradingWriting, setIsGradingWriting] = useState(false);
  const [isLoadingExplanations, setIsLoadingExplanations] = useState(false);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [readingError, setReadingError] = useState<string | null>(null);
  const [writingError, setWritingError] = useState<string | null>(null);
  const hasStartedGrading = useRef(false);

  const [writingTab, setWritingTab] = useState<'annotated' | 'corrected' | 'errors'>('annotated');

  const checkReadingMutation = trpc.grading.checkReadingAnswers.useMutation();
  const evaluateWritingMutation = trpc.grading.evaluateWriting.useMutation();
  const explainMutation = trpc.grading.explainWrongAnswers.useMutation();
  const reportMutation = trpc.grading.generateReport.useMutation();

  // Build reading sub-items
  const readingSubItems = useMemo((): ReadingSubItem[] => {
    const readingSection = sections.find(s => s.id === 'reading');
    if (!readingSection) return [];
    const items: ReadingSubItem[] = [];
    for (const q of readingSection.questions) {
      const userAns = getAnswer(q.id);
      if (q.type === 'true-false') {
        const parsed = (() => { try { return typeof userAns === 'string' ? JSON.parse(userAns) : {}; } catch { return {}; } })();
        for (const stmt of q.statements) {
          items.push({ id: `${q.id}-${stmt.label}`, parentId: q.id, label: `Q${q.id}(${stmt.label})`,
            questionText: `True or False: "${stmt.statement}"`,
            userAnswer: parsed[stmt.label] !== undefined ? (parsed[stmt.label] ? 'True' : 'False') : 'Not answered',
            correctAnswer: stmt.isTrue ? 'True' : 'False', questionType: 'true-false-sub' });
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
        q.rows.forEach((row, i) => {
          const label = String.fromCharCode(97 + i);
          items.push({ id: `${q.id}-${label}`, parentId: q.id, label: `Q${q.id}(${label})`,
            questionText: `Complete the table for: "${row.situation}" — fill in the ${row.blankField}`,
            userAnswer: parsed[`row${i}`] || parsed[row.blankField + i] || parsed[label] || (typeof parsed === 'object' ? (Object.values(parsed)[i] as string || 'Not answered') : 'Not answered'),
            correctAnswer: row.answer, questionType: 'table-sub' });
        });
      } else if (q.type === 'reference') {
        const parsed = (() => { try { return typeof userAns === 'string' ? JSON.parse(userAns) : {}; } catch { return {}; } })();
        q.items.forEach((item, i) => {
          const label = String.fromCharCode(97 + i);
          items.push({ id: `${q.id}-${label}`, parentId: q.id, label: `Q${q.id}(${label})`,
            questionText: `What does "${item.word}" (${item.lineRef}) refer to?`,
            userAnswer: parsed[item.word] || parsed[label] || (typeof parsed === 'object' ? (Object.values(parsed)[i] as string || 'Not answered') : 'Not answered'),
            correctAnswer: item.answer, questionType: 'reference-sub' });
        });
      } else if (q.type === 'order') {
        const parsed = (() => { try { return typeof userAns === 'string' ? JSON.parse(userAns) : {}; } catch { return {}; } })();
        q.events.forEach((event, i) => {
          const label = String.fromCharCode(97 + i);
          items.push({ id: `${q.id}-${label}`, parentId: q.id, label: `Q${q.id}(${label})`,
            questionText: `Order: "${event}"`,
            userAnswer: parsed[label] || parsed[i] || (typeof parsed === 'object' ? (Object.values(parsed)[i] as string || 'Not answered') : 'Not answered'),
            correctAnswer: String(q.correctOrder[i]), questionType: 'order-sub' });
        });
      } else if (q.type === 'phrase') {
        const parsed = (() => { try { return typeof userAns === 'string' ? JSON.parse(userAns) : {}; } catch { return {}; } })();
        q.items.forEach((item, i) => {
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
          userAnswer: userArr ? userArr.map(i => q.options[i]).join(', ') : 'Not answered',
          correctAnswer: q.correctAnswers.map(i => q.options[i]).join(', '), questionType: 'checkbox' });
      }
    }
    return items;
  }, [getAnswer]);

  // Detailed answer review for auto-gradable sections
  const detailedResults = useMemo(() => {
    const results: { sectionId: string; sectionTitle: string; questions: { id: number; question: string; userAnswer: string; correctAnswer: string; isCorrect: boolean; context?: string }[] }[] = [];
    for (const section of sections) {
      if (section.id === 'reading' || section.id === 'writing') continue;
      const sectionResults: { id: number; question: string; userAnswer: string; correctAnswer: string; isCorrect: boolean; context?: string }[] = [];
      for (const q of section.questions) {
        if (q.type === 'mcq') {
          const userAns = getAnswer(q.id);
          const userIdx = userAns !== undefined ? Number(userAns) : -1;
          sectionResults.push({ id: q.id, question: q.question.replace('___', q.highlightWord || '___'),
            userAnswer: userIdx >= 0 ? q.options[userIdx] : 'Not answered',
            correctAnswer: q.options[q.correctAnswer], isCorrect: userIdx === q.correctAnswer,
            context: `The word "${q.highlightWord}" means "${q.options[q.correctAnswer]}".` });
        } else if (q.type === 'listening-mcq') {
          const userAns = getAnswer(q.id);
          const userIdx = userAns !== undefined ? Number(userAns) : -1;
          sectionResults.push({ id: q.id, question: q.question,
            userAnswer: userIdx >= 0 ? q.options[userIdx] : 'Not answered',
            correctAnswer: q.options[q.correctAnswer], isCorrect: userIdx === q.correctAnswer,
            context: `Listening question about: ${q.question}` });
        } else if (q.type === 'fill-blank') {
          const userAns = getAnswer(q.id);
          const wordBank = section.wordBank;
          const correctWord = wordBank?.find(w => w.letter === q.correctAnswer);
          const userWord = wordBank?.find(w => w.letter === String(userAns));
          sectionResults.push({ id: q.id, question: `Blank (${q.id})`,
            userAnswer: userWord ? `${userWord.letter}) ${userWord.word}` : (userAns ? String(userAns) : 'Not answered'),
            correctAnswer: correctWord ? `${correctWord.letter}) ${correctWord.word}` : q.correctAnswer,
            isCorrect: String(userAns).toUpperCase() === q.correctAnswer.toUpperCase(),
            context: `Grammar fill-in-the-blank. The correct word is "${correctWord?.word}".` });
        } else if (q.type === 'checkbox') {
          const userAns = getAnswer(q.id) as number[] | undefined;
          const userLabels = userAns ? userAns.map(i => q.options[i]).join(', ') : 'Not answered';
          const correctLabels = q.correctAnswers.map(i => q.options[i]).join(', ');
          const sorted1 = userAns ? [...userAns].sort() : [];
          const sorted2 = [...q.correctAnswers].sort();
          sectionResults.push({ id: q.id, question: q.question, userAnswer: userLabels,
            correctAnswer: correctLabels, isCorrect: JSON.stringify(sorted1) === JSON.stringify(sorted2) });
        }
      }
      if (sectionResults.length > 0) results.push({ sectionId: section.id, sectionTitle: section.title, questions: sectionResults });
    }
    return results;
  }, [getAnswer]);

  // Send reading sub-items to AI for grading
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
        onError: () => { setReadingError('Failed to grade reading answers.'); setIsGradingReading(false); },
      });
    }
    const writingSection = sections.find(s => s.id === 'writing');
    if (writingSection) {
      const writingQ = writingSection.questions.find(q => q.type === 'writing');
      if (writingQ && writingQ.type === 'writing') {
        const essay = getAnswer(writingQ.id);
        if (essay && typeof essay === 'string' && essay.trim().length > 10) {
          setIsGradingWriting(true);
          evaluateWritingMutation.mutate({ essay, topic: writingQ.topic, wordCountTarget: writingQ.wordCount }, {
            onSuccess: (data) => { setWritingResult(data); setIsGradingWriting(false); },
            onError: () => { setWritingError('Failed to evaluate writing.'); setIsGradingWriting(false); },
          });
        }
      }
    }
  }, []);

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
    } else {
      setExplanations([]);
    }
  }, [isGradingReading, isGradingWriting, detailedResults, explanations, isLoadingExplanations]);

  // Calculate total score
  const readingAIScore = readingResults ? readingResults.reduce((sum, r) => sum + r.score, 0) : 0;
  const readingAITotal = readingResults ? readingResults.length : 0;
  const writingAIScore = writingResult ? writingResult.score : 0;
  const writingAITotal = writingResult ? writingResult.maxScore : 20;
  const totalScore = correct + readingAIScore + writingAIScore;
  const totalPossible = total + readingAITotal + writingAITotal;
  const percentage = totalPossible > 0 ? Math.round((totalScore / totalPossible) * 100) : 0;

  const getGrade = () => {
    if (percentage >= 90) return { grade: 'A', color: 'text-emerald-600', label: 'Excellent!', label_cn: '优秀！' };
    if (percentage >= 75) return { grade: 'B', color: 'text-blue-600', label: 'Good Job!', label_cn: '做得不错！' };
    if (percentage >= 60) return { grade: 'C', color: 'text-amber-600', label: 'Keep Practicing!', label_cn: '继续加油！' };
    return { grade: 'D', color: 'text-red-500', label: 'Needs Improvement', label_cn: '需要提高' };
  };
  const gradeInfo = getGrade();
  const isStillGrading = isGradingReading || isGradingWriting;

  // Trigger report generation
  useEffect(() => {
    if (isStillGrading) return;
    if (report !== null || isLoadingReport) return;
    const sectionResults = sections.map(s => {
      let sCorrect = 0; let sTotal = 0;
      if (s.id === 'reading' && readingResults) { sCorrect = readingResults.filter(r => r.isCorrect).length; sTotal = readingResults.length; }
      else if (s.id !== 'writing' && s.id !== 'reading') { const bs = bySection[s.id]; if (bs) { sCorrect = bs.correct; sTotal = bs.total; } }
      return { sectionId: s.id, sectionTitle: s.title, correct: sCorrect, total: sTotal, timeSeconds: sectionTimings[s.id] || 0 };
    }).filter(s => s.sectionId !== 'writing');
    setIsLoadingReport(true);
    reportMutation.mutate({
      totalScore, totalPossible, percentage, grade: gradeInfo.grade, totalTimeSeconds: totalTime, sectionResults,
      writingScore: writingResult?.score, writingMaxScore: writingResult?.maxScore, writingGrade: writingResult?.grade,
    }, {
      onSuccess: (data) => { setReport(data); setIsLoadingReport(false); },
      onError: () => { setIsLoadingReport(false); },
    });
  }, [isStillGrading, report, isLoadingReport]);

  const getExplanation = (questionId: number): ExplanationResult | undefined => explanations?.find(e => e.questionId === questionId);
  const getReadingResult = (subItemId: string): ReadingGradingResult | undefined => readingResults?.find(r => r.questionId === subItemId);

  const annotatedSegments = useMemo(() => {
    if (!writingResult?.annotatedEssay) return [];
    return parseAnnotatedEssay(writingResult.annotatedEssay);
  }, [writingResult]);

  // Download report as PDF
  const reportRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = useCallback(async () => {
    if (!reportRef.current) return;
    setIsDownloading(true);
    try {
      // Temporarily expand all collapsed explanations for PDF capture
      const collapsedEls = reportRef.current.querySelectorAll('[data-collapsed="true"]');
      collapsedEls.forEach(el => {
        (el as HTMLElement).style.display = 'block';
        (el as HTMLElement).style.height = 'auto';
        (el as HTMLElement).style.opacity = '1';
      });

      // html2canvas doesn't support oklch() colors from Tailwind CSS 4.
      // Convert all oklch computed styles to rgb inline styles before capture.
      const allEls = reportRef.current.querySelectorAll('*');
      const originalStyles: { el: HTMLElement; props: Record<string, string> }[] = [];
      const colorProps = ['color', 'background-color', 'border-color', 'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color', 'outline-color', 'box-shadow'];

      allEls.forEach(node => {
        const el = node as HTMLElement;
        const computed = getComputedStyle(el);
        const saved: Record<string, string> = {};
        let hasOklch = false;

        colorProps.forEach(prop => {
          const val = computed.getPropertyValue(prop);
          if (val && val.includes('oklch')) {
            hasOklch = true;
            saved[prop] = el.style.getPropertyValue(prop);
            // Create a temporary element to convert oklch to rgb
            const temp = document.createElement('div');
            temp.style.color = val;
            document.body.appendChild(temp);
            const rgb = getComputedStyle(temp).color;
            document.body.removeChild(temp);
            el.style.setProperty(prop, rgb);
          }
        });

        if (hasOklch) {
          originalStyles.push({ el, props: saved });
        }
      });

      // Also convert oklch CSS variables on the root reportRef element
      const rootEl = reportRef.current;
      const rootComputed = getComputedStyle(rootEl);
      const savedRootBg = rootEl.style.backgroundColor;
      const rootBg = rootComputed.backgroundColor;
      if (rootBg && rootBg.includes('oklch')) {
        const temp = document.createElement('div');
        temp.style.color = rootBg;
        document.body.appendChild(temp);
        rootEl.style.backgroundColor = getComputedStyle(temp).color;
        document.body.removeChild(temp);
      }

      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#FAFBFD',
        windowWidth: 900,
      });

      // Restore all original styles
      rootEl.style.backgroundColor = savedRootBg;
      originalStyles.forEach(({ el, props }) => {
        Object.entries(props).forEach(([prop, val]) => {
          if (val) {
            el.style.setProperty(prop, val);
          } else {
            el.style.removeProperty(prop);
          }
        });
      });

      // Restore collapsed elements
      collapsedEls.forEach(el => {
        (el as HTMLElement).style.display = '';
        (el as HTMLElement).style.height = '';
        (el as HTMLElement).style.opacity = '';
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const margin = 8;
      const contentWidth = pdfWidth - margin * 2;
      const imgAspect = canvas.height / canvas.width;
      const contentHeight = contentWidth * imgAspect;

      // Split into pages if content is taller than one page
      const pageContentHeight = pdfHeight - margin * 2;
      let remainingHeight = contentHeight;
      let sourceY = 0;
      let page = 0;

      while (remainingHeight > 0) {
        if (page > 0) pdf.addPage();
        const sliceHeight = Math.min(remainingHeight, pageContentHeight);
        const sourceSliceHeight = (sliceHeight / contentHeight) * canvas.height;

        // Create a slice canvas for this page
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = sourceSliceHeight;
        const sliceCtx = sliceCanvas.getContext('2d');
        if (sliceCtx) {
          sliceCtx.fillStyle = '#FAFBFD';
          sliceCtx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
          sliceCtx.drawImage(
            canvas,
            0, sourceY, canvas.width, sourceSliceHeight,
            0, 0, sliceCanvas.width, sourceSliceHeight
          );
        }

        const sliceData = sliceCanvas.toDataURL('image/jpeg', 0.95);
        pdf.addImage(sliceData, 'JPEG', margin, margin, contentWidth, sliceHeight);

        sourceY += sourceSliceHeight;
        remainingHeight -= pageContentHeight;
        page++;
      }

      pdf.save(`G6_Assessment_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error('PDF generation failed:', err);
    } finally {
      setIsDownloading(false);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FAFBFD] via-white to-[#EEF4FF]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        {/* Top Controls: Language Toggle + Download */}
        <div className="flex items-center justify-end gap-3 mb-6">
          <LangToggle lang={lang} setLang={setLang} />
          <Button
            onClick={handleDownload}
            variant="outline"
            size="sm"
            disabled={isStillGrading || isLoadingReport || isDownloading}
            className="gap-1.5 border-slate-300 text-slate-600 hover:bg-slate-50"
          >
            {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {isDownloading ? (lang === 'en' ? 'Generating PDF...' : '生成PDF中...') : (lang === 'en' ? 'Download PDF' : '下载PDF')}
          </Button>
        </div>

        <div ref={reportRef}>
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
              <span className="text-base">{lang === 'en' ? 'AI is grading your answers...' : 'AI 正在批改你的答案...'}</span>
            </div>
          ) : (
            <p className="text-slate-500 text-base">{lang === 'en' ? gradeInfo.label : gradeInfo.label_cn}</p>
          )}
        </motion.div>

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

        {/* Proficiency Report */}
        {(report || isLoadingReport) && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.25 }} className="mb-8">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
              <div className="px-6 py-4 bg-gradient-to-r from-violet-50 to-blue-50 border-b border-slate-200 flex items-center gap-2">
                <Globe className="w-5 h-5 text-violet-600" />
                <h3 className="font-bold text-lg text-slate-700">{lang === 'en' ? 'Proficiency Report' : '能力评估报告'}</h3>
                <Sparkles className="w-5 h-5 text-violet-500" />
              </div>

              {isLoadingReport ? (
                <div className="p-8 text-center">
                  <Loader2 className="w-6 h-6 animate-spin text-violet-500 mx-auto mb-3" />
                  <p className="text-base text-slate-500">{lang === 'en' ? 'Generating your proficiency report...' : '正在生成能力评估报告...'}</p>
                </div>
              ) : report ? (
                <div className="p-6 space-y-5">
                  {/* CEFR Level */}
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-violet-500 to-blue-500 text-white flex items-center justify-center shadow-lg shadow-violet-200">
                      <span className="text-2xl font-extrabold">{report.languageLevel}</span>
                    </div>
                    <div>
                      <div className="text-base font-bold text-slate-700">{lang === 'en' ? 'CEFR Language Level' : 'CEFR 语言等级'}</div>
                      <p className="text-sm text-slate-500 mt-0.5">{lang === 'en' ? 'Common European Framework of Reference' : '欧洲语言共同参考框架'}</p>
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="p-4 rounded-xl bg-violet-50 border border-violet-200">
                    <p className="text-base text-slate-700 leading-relaxed">{lang === 'en' ? report.summary_en : report.summary_cn}</p>
                  </div>

                  {/* Time Analysis */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <h4 className="font-semibold text-base text-slate-700 mb-2 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-slate-500" />
                      {lang === 'en' ? 'Time Management' : '时间管理'}
                    </h4>
                    <p className="text-base text-slate-600 leading-relaxed">{lang === 'en' ? report.timeAnalysis_en : report.timeAnalysis_cn}</p>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                      <h4 className="font-semibold text-base text-emerald-700 mb-3 flex items-center gap-2">
                        <Target className="w-4 h-4" />
                        {lang === 'en' ? 'Strengths' : '优势'}
                      </h4>
                      <ul className="space-y-2">
                        {(lang === 'en' ? report.strengths_en : report.strengths_cn).map((s, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-1 shrink-0" />{s}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                      <h4 className="font-semibold text-base text-amber-700 mb-3 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        {lang === 'en' ? 'Areas for Improvement' : '待提高'}
                      </h4>
                      <ul className="space-y-2">
                        {(lang === 'en' ? report.weaknesses_en : report.weaknesses_cn).map((w, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                            <XCircle className="w-4 h-4 text-amber-500 mt-1 shrink-0" />{w}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
                    <h4 className="font-semibold text-base text-blue-700 mb-3 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      {lang === 'en' ? 'Study Recommendations' : '学习建议'}
                    </h4>
                    <ul className="space-y-2">
                      {(lang === 'en' ? report.recommendations_en : report.recommendations_cn).map((r, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                          <span className="text-blue-500 font-bold mt-0.5 shrink-0">{i + 1}.</span>{r}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : null}
            </div>
          </motion.div>
        )}

        {/* Section Breakdown */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }} className="bg-white rounded-2xl border border-slate-200 shadow-lg p-6 mb-8">
          <h2 className="font-bold text-lg text-slate-800 mb-4">{lang === 'en' ? 'Section Breakdown' : '各部分成绩'}</h2>
          <div className="space-y-3">
            {sections.map((section) => {
              const sectionScore = bySection[section.id];
              const sTime = sectionTimings[section.id] || 0;
              const timeStr = sTime > 0 ? formatTime(sTime) : '';

              if (section.id === 'reading') {
                if (isGradingReading) {
                  return (
                    <div key={section.id} className={`flex items-center gap-4 p-3 rounded-xl ${sectionMeta[section.id]?.bg}`}>
                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${sectionMeta[section.id]?.gradient} text-white flex items-center justify-center`}>{sectionMeta[section.id]?.icon}</div>
                      <div className="flex-1">
                        <div className="font-semibold text-base text-slate-700">{section.title}</div>
                        <div className="flex items-center gap-2 text-sm text-blue-500"><Loader2 className="w-3 h-3 animate-spin" />{lang === 'en' ? 'AI grading...' : 'AI 评分中...'}</div>
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
                          <span className="font-semibold text-base text-slate-700 flex items-center gap-1">{section.title}<Sparkles className="w-3.5 h-3.5 text-indigo-500" /></span>
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

              if (section.id === 'writing') {
                if (isGradingWriting) {
                  return (
                    <div key={section.id} className={`flex items-center gap-4 p-3 rounded-xl ${sectionMeta[section.id]?.bg}`}>
                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${sectionMeta[section.id]?.gradient} text-white flex items-center justify-center`}>{sectionMeta[section.id]?.icon}</div>
                      <div className="flex-1">
                        <div className="font-semibold text-base text-slate-700">{section.title}</div>
                        <div className="flex items-center gap-2 text-sm text-blue-500"><Loader2 className="w-3 h-3 animate-spin" />{lang === 'en' ? 'AI evaluating...' : 'AI 评估中...'}</div>
                      </div>
                    </div>
                  );
                }
                if (writingResult) {
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

        {/* AI Reading Comprehension Review */}
        {(readingResults || isGradingReading) && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.5 }} className="mb-8">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 bg-indigo-50 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base text-slate-700">Part 4: {lang === 'en' ? 'Reading Comprehension' : '阅读理解'}</h3>
                  <Sparkles className="w-4 h-4 text-indigo-500" />
                  <span className="text-sm text-indigo-500 font-medium">{lang === 'en' ? 'AI Graded' : 'AI 评分'}</span>
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
                  <p className="text-base text-slate-500">{lang === 'en' ? 'AI is grading your reading answers...' : 'AI 正在批改阅读理解...'}</p>
                </div>
              ) : readingResults ? (
                <div className="divide-y divide-slate-100">
                  {readingSubItems.map((item) => {
                    const result = getReadingResult(item.id);
                    if (!result) return null;
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

        {/* AI Writing Evaluation */}
        {writingResult && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.6 }} className="mb-8">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
              <div className="px-5 py-3 bg-rose-50 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base text-slate-700">Part 5: {lang === 'en' ? 'Writing Evaluation' : '写作评估'}</h3>
                  <Sparkles className="w-4 h-4 text-rose-500" />
                  <span className="text-sm text-rose-500 font-medium">{lang === 'en' ? 'AI Evaluated' : 'AI 评估'}</span>
                </div>
                <span className="text-base font-bold text-slate-600">{writingResult.score} out of {writingResult.maxScore}</span>
              </div>

              <div className="p-6 space-y-6">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <h4 className="font-semibold text-base text-slate-700 mb-2">{lang === 'en' ? 'Overall Feedback' : '总体反馈'}</h4>
                  <p className="text-base text-slate-600 leading-relaxed">{lang === 'en' ? writingResult.overallFeedback_en : writingResult.overallFeedback_cn}</p>
                </div>

                {/* Tab Navigation */}
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

                {/* Annotated Original */}
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

                {/* Corrected Version */}
                {writingTab === 'corrected' && writingResult.correctedEssay && (
                  <div>
                    <h4 className="font-semibold text-base text-slate-700 mb-2">{lang === 'en' ? 'Corrected Version' : '修正版本'}</h4>
                    <div className="p-5 rounded-xl bg-emerald-50 border border-emerald-200 text-base text-slate-700 leading-[2] whitespace-pre-wrap">
                      {writingResult.correctedEssay}
                    </div>
                  </div>
                )}

                {/* Error List */}
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
                            <span className="text-slate-400 shrink-0">→</span>
                            <span className="text-emerald-600 font-medium">{err.correction}</span>
                          </div>
                          <p className="text-sm text-slate-500 mt-1">{lang === 'en' ? err.explanation_en : err.explanation_cn}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Suggestions */}
                {((lang === 'en' ? writingResult.suggestions_en : writingResult.suggestions_cn) || []).length > 0 && (
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

        </div>{/* end reportRef */}

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
