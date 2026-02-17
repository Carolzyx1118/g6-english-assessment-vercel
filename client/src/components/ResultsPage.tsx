import { useQuiz } from '@/contexts/QuizContext';
import { sections, type Question } from '@/data/questions';
import { trpc } from '@/lib/trpc';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy, RotateCcw, CheckCircle2, XCircle, BookOpen,
  PenTool, FileText, Loader2, Sparkles, Lightbulb,
  Clock, ChevronDown, ChevronUp, Globe,
  Download, Languages, Headphones,
} from 'lucide-react';
import jsPDF from 'jspdf';
import { Button } from '@/components/ui/button';
import { useEffect, useState, useRef, useMemo, useCallback } from 'react';

const sectionMeta: Record<string, { icon: React.ReactNode; gradient: string; bg: string }> = {
  vocabulary: { icon: <BookOpen className="w-5 h-5" />, gradient: 'from-emerald-500 to-emerald-600', bg: 'bg-emerald-50' },
  grammar: { icon: <PenTool className="w-5 h-5" />, gradient: 'from-amber-500 to-amber-600', bg: 'bg-amber-50' },
  listening: { icon: <Headphones className="w-5 h-5" />, gradient: 'from-purple-500 to-purple-600', bg: 'bg-purple-50' },
  reading: { icon: <FileText className="w-5 h-5" />, gradient: 'from-indigo-500 to-indigo-600', bg: 'bg-indigo-50' },
};

type Lang = 'en' | 'cn';
type ReadingGradingResult = { questionId: string; isCorrect: boolean; score: number; feedback_en: string; feedback_cn: string; explanation_en: string; explanation_cn: string };
type ExplanationResult = { questionId: number; explanation_en: string; explanation_cn: string; tip_en: string; tip_cn: string };
type ReportResult = {
  languageLevel: string;
  summary_en: string; summary_cn: string;
  strengths_en: string[]; strengths_cn: string[];
  weaknesses_en: string[]; weaknesses_cn: string[];
  recommendations_en: string[]; recommendations_cn: string[];
  timeAnalysis_en: string; timeAnalysis_cn: string;
};

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

// Sub-question item for reading section (wordbank-fill and story-fill)
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
  const { getScore, resetQuiz, state, getAnswer, getSectionTimings, getTotalTime, studentInfo } = useQuiz();
  const { correct, total, bySection } = getScore();

  const totalTime = getTotalTime();
  const sectionTimings = getSectionTimings();
  const minutes = Math.floor(totalTime / 60);
  const seconds = totalTime % 60;

  const [lang, setLang] = useState<Lang>('en');

  // AI Grading states
  const [readingResults, setReadingResults] = useState<ReadingGradingResult[] | null>(null);
  const [explanations, setExplanations] = useState<ExplanationResult[] | null>(null);
  const [report, setReport] = useState<ReportResult | null>(null);
  const [isGradingReading, setIsGradingReading] = useState(false);
  const [isLoadingExplanations, setIsLoadingExplanations] = useState(false);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [readingError, setReadingError] = useState<string | null>(null);
  const hasStartedGrading = useRef(false);

  const checkReadingMutation = trpc.grading.checkReadingAnswers.useMutation();
  const explainMutation = trpc.grading.explainWrongAnswers.useMutation();
  const reportMutation = trpc.grading.generateReport.useMutation();

  // Build reading sub-items from wordbank-fill and story-fill questions
  const readingSubItems = useMemo((): ReadingSubItem[] => {
    const readingSection = sections.find(s => s.id === 'reading');
    if (!readingSection) return [];
    const items: ReadingSubItem[] = [];
    for (const q of readingSection.questions) {
      if (q.type === 'wordbank-fill' || q.type === 'story-fill') {
        const userAns = getAnswer('reading', q.id);
        items.push({
          id: `${q.id}`,
          parentId: q.id,
          label: `Q${q.id}`,
          questionText: q.question,
          userAnswer: typeof userAns === 'string' ? userAns : 'Not answered',
          correctAnswer: q.correctAnswer,
          questionType: q.type,
        });
      }
    }
    return items;
  }, [getAnswer]);

  // Detailed answer review for auto-gradable sections (vocabulary, grammar, listening)
  const detailedResults = useMemo(() => {
    const results: { sectionId: string; sectionTitle: string; questions: { id: number; question: string; userAnswer: string; correctAnswer: string; isCorrect: boolean; context?: string }[] }[] = [];
    for (const section of sections) {
      if (section.id === 'reading') continue; // reading is AI-graded
      const sectionResults: { id: number; question: string; userAnswer: string; correctAnswer: string; isCorrect: boolean; context?: string }[] = [];
      for (const q of section.questions) {
        if (q.type === 'picture-mcq' || q.type === 'listening-mcq') {
          const userAns = getAnswer(section.id, q.id);
          const userIdx = userAns !== undefined ? Number(userAns) : -1;
          const userLabel = userIdx >= 0 ? q.options[userIdx]?.label || 'N/A' : 'Not answered';
          const correctLabel = q.options[q.correctAnswer]?.label || 'N/A';
          const userText = userIdx >= 0 ? (q.options[userIdx]?.text || q.options[userIdx]?.label) : 'Not answered';
          const correctText = q.options[q.correctAnswer]?.text || q.options[q.correctAnswer]?.label;
          sectionResults.push({
            id: q.id,
            question: q.question,
            userAnswer: userText,
            correctAnswer: correctText,
            isCorrect: userIdx === q.correctAnswer,
            context: `The correct answer is option ${correctLabel}: ${correctText}.`,
          });
        } else if (q.type === 'mcq') {
          const userAns = getAnswer(section.id, q.id);
          const userIdx = userAns !== undefined ? Number(userAns) : -1;
          sectionResults.push({
            id: q.id,
            question: q.question,
            userAnswer: userIdx >= 0 ? q.options[userIdx] : 'Not answered',
            correctAnswer: q.options[q.correctAnswer],
            isCorrect: userIdx === q.correctAnswer,
            context: q.highlightWord ? `The word "${q.highlightWord}" is tested.` : undefined,
          });
        } else if (q.type === 'fill-blank') {
          const userAns = getAnswer(section.id, q.id);
          const wordBank = section.wordBank;
          const correctWord = wordBank?.find(w => w.letter === q.correctAnswer);
          const userWord = wordBank?.find(w => w.letter === String(userAns));
          sectionResults.push({
            id: q.id,
            question: `Fill in blank ${q.id}`,
            userAnswer: userWord ? `${userWord.letter}) ${userWord.word}` : (userAns ? String(userAns) : 'Not answered'),
            correctAnswer: correctWord ? `${correctWord.letter}) ${correctWord.word}` : q.correctAnswer,
            isCorrect: String(userAns).toUpperCase() === q.correctAnswer.toUpperCase(),
            context: `Grammar fill-in-the-blank. The correct word is "${correctWord?.word}".`,
          });
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
  }, []);

  // Trigger explanations for wrong answers
  useEffect(() => {
    if (isGradingReading) return;
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
  }, [isGradingReading, detailedResults, explanations, isLoadingExplanations]);

  // Calculate total score
  const readingAIScore = readingResults ? readingResults.reduce((sum, r) => sum + r.score, 0) : 0;
  const readingAITotal = readingResults ? readingResults.length : 0;
  const totalScore = correct + readingAIScore;
  const totalPossible = total + readingAITotal;
  const percentage = totalPossible > 0 ? Math.round((totalScore / totalPossible) * 100) : 0;

  const getGrade = () => {
    if (percentage >= 90) return { grade: 'A', color: 'text-emerald-600', label: 'Excellent!', label_cn: '优秀！' };
    if (percentage >= 75) return { grade: 'B', color: 'text-blue-600', label: 'Good Job!', label_cn: '做得不错！' };
    if (percentage >= 60) return { grade: 'C', color: 'text-amber-600', label: 'Keep Practicing!', label_cn: '继续加油！' };
    return { grade: 'D', color: 'text-red-500', label: 'Needs Improvement', label_cn: '需要提高' };
  };
  const gradeInfo = getGrade();
  const isStillGrading = isGradingReading;

  // Trigger report generation
  useEffect(() => {
    if (isStillGrading) return;
    if (report !== null || isLoadingReport) return;
    const sectionResults = sections.map(s => {
      let sCorrect = 0; let sTotal = 0;
      if (s.id === 'reading' && readingResults) {
        sCorrect = readingResults.filter(r => r.isCorrect).length;
        sTotal = readingResults.length;
      } else {
        const bs = bySection[s.id];
        if (bs) { sCorrect = bs.correct; sTotal = bs.total; }
      }
      return { sectionId: s.id, sectionTitle: s.title, correct: sCorrect, total: sTotal, timeSeconds: sectionTimings[s.id] || 0 };
    });
    setIsLoadingReport(true);
    reportMutation.mutate({
      totalScore, totalPossible, percentage, grade: gradeInfo.grade, totalTimeSeconds: totalTime, sectionResults,
    }, {
      onSuccess: (data) => { setReport(data); setIsLoadingReport(false); },
      onError: () => { setIsLoadingReport(false); },
    });
  }, [isStillGrading, report, isLoadingReport]);

  const getExplanation = (questionId: number): ExplanationResult | undefined => explanations?.find(e => e.questionId === questionId);
  const getReadingResult = (subItemId: string): ReadingGradingResult | undefined => readingResults?.find(r => r.questionId === subItemId);

  // Download report as PDF
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = useCallback(() => {
    setIsDownloading(true);
    try {
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const mL = 18;
      const mR = 18;
      const contentW = pageW - mL - mR;
      let y = 0;
      let pageNum = 1;

      const C = {
        primary: [37, 99, 235] as [number, number, number],
        primaryLight: [239, 246, 255] as [number, number, number],
        accent: [99, 102, 241] as [number, number, number],
        accentLight: [238, 242, 255] as [number, number, number],
        success: [22, 163, 74] as [number, number, number],
        successLight: [220, 252, 231] as [number, number, number],
        danger: [220, 38, 38] as [number, number, number],
        dangerLight: [254, 226, 226] as [number, number, number],
        amber: [217, 119, 6] as [number, number, number],
        amberLight: [254, 243, 199] as [number, number, number],
        text: [30, 41, 59] as [number, number, number],
        textMuted: [100, 116, 139] as [number, number, number],
        textLight: [148, 163, 184] as [number, number, number],
        border: [226, 232, 240] as [number, number, number],
        bgLight: [248, 250, 252] as [number, number, number],
        white: [255, 255, 255] as [number, number, number],
      };

      const addPageFooter = () => {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7.5);
        pdf.setTextColor(...C.textLight);
        pdf.text('WIDA English Proficiency Assessment Report', mL, pageH - 8);
        pdf.text(`Page ${pageNum}`, pageW - mR, pageH - 8, { align: 'right' });
        pdf.setDrawColor(...C.border);
        pdf.setLineWidth(0.2);
        pdf.line(mL, pageH - 12, pageW - mR, pageH - 12);
      };

      const newPage = () => { addPageFooter(); pdf.addPage(); pageNum++; y = 18; };
      const checkPage = (need: number) => { if (y + need > pageH - 18) { newPage(); } };

      const drawRect = (x: number, yPos: number, w: number, h: number, color: [number, number, number], radius = 0) => {
        pdf.setFillColor(...color);
        if (radius > 0) pdf.roundedRect(x, yPos, w, h, radius, radius, 'F');
        else pdf.rect(x, yPos, w, h, 'F');
      };

      const addText = (text: string, x: number, size = 10, bold = false, color: [number, number, number] = C.text, maxWidth = contentW - (x - mL)) => {
        pdf.setFont('helvetica', bold ? 'bold' : 'normal');
        pdf.setFontSize(size);
        pdf.setTextColor(...color);
        const lines = pdf.splitTextToSize(text, maxWidth);
        for (const line of lines) {
          checkPage(size * 0.45 + 1.5);
          pdf.text(line, x, y);
          y += size * 0.45 + 1.5;
        }
      };

      const addGap = (h = 4) => { y += h; };

      const addDivider = (color: [number, number, number] = C.border, thick = 0.3) => {
        checkPage(6); addGap(3);
        pdf.setDrawColor(...color); pdf.setLineWidth(thick);
        pdf.line(mL, y, pageW - mR, y); y += 4;
      };

      const addSectionBanner = (title: string, color: [number, number, number], bgColor: [number, number, number]) => {
        checkPage(16); addGap(4);
        drawRect(mL, y - 4, contentW, 12, bgColor, 2);
        drawRect(mL, y - 4, 3, 12, color, 1);
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(12); pdf.setTextColor(...color);
        pdf.text(title, mL + 7, y + 3.5); y += 12;
      };

      // ══ PAGE 1: COVER HEADER ══
      drawRect(0, 0, pageW, 52, C.primary);
      drawRect(0, 42, pageW, 10, [30, 85, 220]);
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(22); pdf.setTextColor(255, 255, 255);
      pdf.text('WIDA English Proficiency', mL, 22);
      pdf.text('Assessment Report', mL, 32);
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.setTextColor(200, 220, 255);
      pdf.text(new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), mL, 46);
      y = 60;

      // Student Info Card
      if (studentInfo) {
        drawRect(mL, y, contentW, studentInfo.grade ? 22 : 16, C.bgLight, 3);
        drawRect(mL, y, 3, studentInfo.grade ? 22 : 16, C.accent, 1);
        addText(studentInfo.name, mL + 8, 13, true, C.text);
        if (studentInfo.grade) {
          addText(`${lang === 'en' ? 'Grade' : '\u5e74\u7ea7'}: ${studentInfo.grade}`, mL + 8, 9.5, false, C.textMuted);
        }
        y += 4;
      }
      addGap(4);

      // ══ SCORE SUMMARY CARD ══
      checkPage(45);
      const cardY = y;
      drawRect(mL, cardY, contentW, 40, C.white, 3);
      pdf.setDrawColor(...C.border); pdf.setLineWidth(0.3);
      pdf.roundedRect(mL, cardY, contentW, 40, 3, 3, 'S');
      const colW = contentW / 3;

      const gradeColor = percentage >= 80 ? C.success : percentage >= 60 ? C.amber : C.danger;
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(28); pdf.setTextColor(...gradeColor);
      pdf.text(gradeInfo.grade, mL + colW * 0.5, cardY + 20, { align: 'center' });
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(...C.textMuted);
      pdf.text(lang === 'en' ? 'GRADE' : '\u7b49\u7ea7', mL + colW * 0.5, cardY + 28, { align: 'center' });

      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(24); pdf.setTextColor(...C.text);
      pdf.text(`${totalScore}`, mL + colW * 1.5 - 4, cardY + 18, { align: 'center' });
      pdf.setFontSize(14); pdf.setTextColor(...C.textMuted);
      pdf.text(`/ ${totalPossible}`, mL + colW * 1.5 + 12, cardY + 18, { align: 'center' });
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8);
      pdf.text(`${lang === 'en' ? 'SCORE' : '\u5206\u6570'} (${percentage}%)`, mL + colW * 1.5, cardY + 28, { align: 'center' });

      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(24); pdf.setTextColor(...C.text);
      pdf.text(`${minutes}:${seconds.toString().padStart(2, '0')}`, mL + colW * 2.5, cardY + 18, { align: 'center' });
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(...C.textMuted);
      pdf.text(lang === 'en' ? 'TIME' : '\u7528\u65f6', mL + colW * 2.5, cardY + 28, { align: 'center' });

      pdf.setDrawColor(...C.border); pdf.setLineWidth(0.2);
      pdf.line(mL + colW, cardY + 8, mL + colW, cardY + 32);
      pdf.line(mL + colW * 2, cardY + 8, mL + colW * 2, cardY + 32);
      y = cardY + 46;

      pdf.setFont('helvetica', 'italic'); pdf.setFontSize(9); pdf.setTextColor(...C.textMuted);
      pdf.text(lang === 'en' ? gradeInfo.label : gradeInfo.label_cn, pageW / 2, y, { align: 'center' });
      y += 8;
      addDivider();

      // ══ SECTION BREAKDOWN TABLE ══
      addSectionBanner(lang === 'en' ? 'Section Breakdown' : '\u5404\u90e8\u5206\u6210\u7ee9', C.accent, C.accentLight);
      addGap(2);

      const tableX = mL;
      const col1 = contentW * 0.45;
      const col2 = contentW * 0.2;
      const col3 = contentW * 0.15;
      const col4 = contentW * 0.2;

      checkPage(10);
      drawRect(tableX, y - 3, contentW, 8, C.bgLight);
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8); pdf.setTextColor(...C.textMuted);
      pdf.text(lang === 'en' ? 'SECTION' : '\u90e8\u5206', tableX + 3, y + 1.5);
      pdf.text(lang === 'en' ? 'SCORE' : '\u5f97\u5206', tableX + col1 + 3, y + 1.5);
      pdf.text('%', tableX + col1 + col2 + 3, y + 1.5);
      pdf.text(lang === 'en' ? 'TIME' : '\u65f6\u95f4', tableX + col1 + col2 + col3 + 3, y + 1.5);
      y += 8;

      const sectionColors: Record<string, [number, number, number]> = {
        vocabulary: [16, 185, 129],
        grammar: [245, 158, 11],
        listening: [168, 85, 247],
        reading: [99, 102, 241],
      };

      sections.forEach((section, idx) => {
        checkPage(10);
        const sTime = sectionTimings[section.id] || 0;
        const timeStr = sTime > 0 ? formatTime(sTime) : 'N/A';
        let scoreStr = '';
        let pctVal = 0;

        if (section.id === 'reading' && readingResults) {
          const rc = readingResults.filter(r => r.isCorrect).length;
          scoreStr = `${rc} / ${readingResults.length}`;
          pctVal = readingResults.length > 0 ? Math.round(rc / readingResults.length * 100) : 0;
        } else {
          const bs = bySection[section.id];
          if (bs) {
            scoreStr = `${bs.correct} / ${bs.total}`;
            pctVal = bs.total > 0 ? Math.round(bs.correct / bs.total * 100) : 0;
          }
        }

        if (idx % 2 === 0) drawRect(tableX, y - 3, contentW, 9, C.bgLight);
        const dotColor = sectionColors[section.id] || C.text;
        pdf.setFillColor(...dotColor); pdf.circle(tableX + 4, y + 0.5, 1.5, 'F');
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.setTextColor(...C.text);
        pdf.text(section.title, tableX + 9, y + 1.5);
        pdf.setFont('helvetica', 'bold');
        pdf.text(scoreStr, tableX + col1 + 3, y + 1.5);
        const pctColor = pctVal >= 80 ? C.success : pctVal >= 60 ? C.amber : C.danger;
        pdf.setTextColor(...pctColor);
        pdf.text(`${pctVal}%`, tableX + col1 + col2 + 3, y + 1.5);
        pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...C.textMuted);
        pdf.text(timeStr, tableX + col1 + col2 + col3 + 3, y + 1.5);
        y += 9;
      });

      addGap(4); addDivider();

      // ══ PROFICIENCY REPORT ══
      if (report) {
        addSectionBanner(lang === 'en' ? 'Proficiency Report' : '\u80fd\u529b\u8bc4\u4f30\u62a5\u544a', C.accent, C.accentLight);
        addGap(3);

        checkPage(14);
        drawRect(mL, y - 2, 28, 10, C.accent, 2);
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(12); pdf.setTextColor(255, 255, 255);
        pdf.text(report.languageLevel, mL + 14, y + 4.5, { align: 'center' });
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.setTextColor(...C.textMuted);
        pdf.text(lang === 'en' ? 'CEFR Level' : 'CEFR \u7b49\u7ea7', mL + 32, y + 4.5);
        y += 14;

        addText(lang === 'en' ? 'Summary' : '\u603b\u7ed3', mL, 10, true, C.text);
        addText(lang === 'en' ? report.summary_en : report.summary_cn, mL + 2, 9.5, false, C.textMuted);
        addGap(3);

        addText(lang === 'en' ? 'Time Management' : '\u65f6\u95f4\u7ba1\u7406', mL, 10, true, C.text);
        addText(lang === 'en' ? report.timeAnalysis_en : report.timeAnalysis_cn, mL + 2, 9.5, false, C.textMuted);
        addGap(3);

        checkPage(10); drawRect(mL, y - 1, contentW, 1, C.success); y += 3;
        addText(lang === 'en' ? 'Strengths' : '\u4f18\u52bf', mL, 10, true, C.success);
        (lang === 'en' ? report.strengths_en : report.strengths_cn).forEach(s => { addText(`+  ${s}`, mL + 4, 9, false, C.text); });
        addGap(3);

        checkPage(10); drawRect(mL, y - 1, contentW, 1, C.amber); y += 3;
        addText(lang === 'en' ? 'Areas for Improvement' : '\u5f85\u63d0\u9ad8', mL, 10, true, C.amber);
        (lang === 'en' ? report.weaknesses_en : report.weaknesses_cn).forEach(w => { addText(`-  ${w}`, mL + 4, 9, false, C.text); });
        addGap(3);

        checkPage(10); drawRect(mL, y - 1, contentW, 1, C.primary); y += 3;
        addText(lang === 'en' ? 'Recommendations' : '\u5b66\u4e60\u5efa\u8bae', mL, 10, true, C.primary);
        (lang === 'en' ? report.recommendations_en : report.recommendations_cn).forEach((r, i) => { addText(`${i + 1}.  ${r}`, mL + 4, 9, false, C.text); });
        addGap(4); addDivider();
      }

      // ══ WRONG ANSWERS & EXPLANATIONS ══
      const hasWrongAnswers = detailedResults.some(s => s.questions.some(q => !q.isCorrect)) ||
        (readingResults && readingSubItems.some(item => { const r = getReadingResult(item.id); return r && !r.isCorrect; }));

      if (hasWrongAnswers) {
        addSectionBanner(lang === 'en' ? 'Wrong Answers & Explanations' : '\u9519\u9898\u4e0e\u89e3\u6790', C.danger, C.dangerLight);
        addGap(3);

        for (const section of detailedResults) {
          const wrongQs = section.questions.filter(q => !q.isCorrect);
          if (wrongQs.length === 0) continue;

          checkPage(10);
          pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10); pdf.setTextColor(...C.text);
          pdf.setFillColor(...(sectionColors[section.sectionId] || C.text));
          pdf.circle(mL + 2, y + 1.5, 1.5, 'F');
          pdf.text(section.sectionTitle, mL + 7, y + 2); y += 8;

          for (const q of wrongQs) {
            checkPage(25);
            const qLines = pdf.splitTextToSize(`Q${q.id}: ${q.question}`, contentW - 10);
            const cardH = 18 + qLines.length * 4.5;
            drawRect(mL, y - 2, contentW, Math.max(cardH, 28), C.bgLight, 2);

            addText(`Q${q.id}: ${q.question}`, mL + 4, 9.5, true, C.text, contentW - 10);
            addGap(1);

            pdf.setFillColor(...C.dangerLight);
            pdf.roundedRect(mL + 4, y - 2.5, contentW - 10, 7, 1, 1, 'F');
            addText(`X  ${lang === 'en' ? 'Your answer' : '\u4f60\u7684\u7b54\u6848'}: ${q.userAnswer}`, mL + 7, 9, false, C.danger, contentW - 16);
            addGap(1);

            pdf.setFillColor(...C.successLight);
            pdf.roundedRect(mL + 4, y - 2.5, contentW - 10, 7, 1, 1, 'F');
            addText(`>>  ${lang === 'en' ? 'Correct answer' : '\u6b63\u786e\u7b54\u6848'}: ${q.correctAnswer}`, mL + 7, 9, false, C.success, contentW - 16);
            addGap(1);

            const expl = getExplanation(q.id);
            if (expl) {
              addText(`> ${lang === 'en' ? expl.explanation_en : expl.explanation_cn}`, mL + 6, 8.5, false, C.textMuted, contentW - 14);
              addText(`Tip: ${lang === 'en' ? expl.tip_en : expl.tip_cn}`, mL + 6, 8.5, false, C.amber, contentW - 14);
            }
            addGap(5);
          }
          addGap(3);
        }

        // Reading wrong answers
        if (readingResults) {
          const wrongReading = readingSubItems.filter(item => { const r = getReadingResult(item.id); return r && !r.isCorrect; });
          if (wrongReading.length > 0) {
            checkPage(10);
            pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10); pdf.setTextColor(...C.text);
            pdf.setFillColor(...sectionColors.reading);
            pdf.circle(mL + 2, y + 1.5, 1.5, 'F');
            pdf.text(lang === 'en' ? 'Part 4: Reading Comprehension' : 'Part 4: \u9605\u8bfb\u7406\u89e3', mL + 7, y + 2); y += 8;

            for (const item of wrongReading) {
              const r = getReadingResult(item.id);
              if (!r) continue;
              checkPage(25);
              const qLines2 = pdf.splitTextToSize(`${item.label}: ${item.questionText}`, contentW - 10);
              const cardH2 = 18 + qLines2.length * 4.5;
              drawRect(mL, y - 2, contentW, Math.max(cardH2, 28), C.bgLight, 2);

              addText(`${item.label}: ${item.questionText}`, mL + 4, 9.5, true, C.text, contentW - 10);
              addGap(1);

              pdf.setFillColor(...C.dangerLight);
              pdf.roundedRect(mL + 4, y - 2.5, contentW - 10, 7, 1, 1, 'F');
              addText(`X  ${lang === 'en' ? 'Your answer' : '\u4f60\u7684\u7b54\u6848'}: ${item.userAnswer}`, mL + 7, 9, false, C.danger, contentW - 16);
              addGap(1);

              pdf.setFillColor(...C.successLight);
              pdf.roundedRect(mL + 4, y - 2.5, contentW - 10, 7, 1, 1, 'F');
              addText(`>>  ${lang === 'en' ? 'Correct answer' : '\u6b63\u786e\u7b54\u6848'}: ${item.correctAnswer}`, mL + 7, 9, false, C.success, contentW - 16);
              addGap(1);

              addText(`> ${lang === 'en' ? r.feedback_en : r.feedback_cn}`, mL + 6, 8.5, false, C.textMuted, contentW - 14);
              addText(`> ${lang === 'en' ? r.explanation_en : r.explanation_cn}`, mL + 6, 8.5, false, C.textMuted, contentW - 14);
              addGap(5);
            }
          }
        }
        addDivider();
      }

      // Final page footer
      addPageFooter();

      const nameSlug = studentInfo?.name ? `_${studentInfo.name.replace(/\s+/g, '_')}` : '';
      pdf.save(`WIDA_Assessment_Report${nameSlug}_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error('PDF generation failed:', err);
    } finally {
      setIsDownloading(false);
    }
  }, [lang, report, detailedResults, readingResults, explanations, readingSubItems,
      totalScore, totalPossible, percentage, gradeInfo, minutes, seconds, bySection, sectionTimings, studentInfo]);

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

        {/* Student Info */}
        {studentInfo && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15 }} className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mb-6 text-sm text-slate-500">
            <span className="font-semibold text-slate-700">{studentInfo.name}</span>
            {studentInfo.grade && <span>{lang === 'en' ? 'Grade' : '年级'}: {studentInfo.grade}</span>}
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
                    <p className="text-sm text-slate-600">{lang === 'en' ? report.timeAnalysis_en : report.timeAnalysis_cn}</p>
                  </div>

                  {/* Strengths */}
                  <div>
                    <h4 className="font-semibold text-base text-emerald-700 mb-2">{lang === 'en' ? 'Strengths' : '优势'}</h4>
                    <ul className="space-y-1">
                      {(lang === 'en' ? report.strengths_en : report.strengths_cn).map((s, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />{s}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Weaknesses */}
                  <div>
                    <h4 className="font-semibold text-base text-amber-700 mb-2">{lang === 'en' ? 'Areas for Improvement' : '待提高'}</h4>
                    <ul className="space-y-1">
                      {(lang === 'en' ? report.weaknesses_en : report.weaknesses_cn).map((w, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                          <XCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />{w}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Recommendations */}
                  <div>
                    <h4 className="font-semibold text-base text-blue-700 mb-2">{lang === 'en' ? 'Recommendations' : '学习建议'}</h4>
                    <ul className="space-y-1">
                      {(lang === 'en' ? report.recommendations_en : report.recommendations_cn).map((r, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                          <span className="text-blue-500 font-bold mt-0.5">{i + 1}.</span>{r}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : null}
            </div>
          </motion.div>
        )}

        {/* Section Scores */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }} className="bg-white rounded-2xl border border-slate-200 shadow-lg p-6 mb-8">
          <h2 className="font-bold text-lg text-slate-800 mb-4">{lang === 'en' ? 'Section Scores' : '各部分成绩'}</h2>
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
