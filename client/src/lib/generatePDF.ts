/**
 * Shared PDF generation utility for admin history page.
 * Generates English-only assessment reports from database records.
 * Shows EVERY question with full details including unanswered ones.
 */
import jsPDF from 'jspdf';
import { getPaperById, type Paper, type Section, type Question } from '@/data/papers';
import { APP_BRAND_TITLE } from '@/lib/branding';
import type {
  AssessmentReportResult,
  SpeakingEvaluationResult,
} from '@shared/assessmentReport';

// ── Type definitions matching the JSON stored in the database ──

type ReadingGradingResult = {
  questionId: string;
  isCorrect: boolean;
  score: number;
  feedback_en: string;
  feedback_cn: string;
  explanation_en: string;
  explanation_cn: string;
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

type ExplanationResult = {
  questionId: number;
  explanation_en: string;
  explanation_cn: string;
  tip_en: string;
  tip_cn: string;
};

export interface PDFData {
  studentName: string;
  studentGrade: string | null;
  paperId: string;
  paperTitle: string;
  totalCorrect: number;
  totalQuestions: number;
  totalTimeSeconds: number | null;
  answersJson: string;
  scoreBySectionJson: string | null;
  sectionTimingsJson: string | null;
  readingResultsJson: string | null;
  writingResultJson: string | null;
  explanationsJson: string | null;
  reportJson: string | null;
  createdAt: Date | string;
}

// ── Represents a single question detail for the PDF ──
interface QuestionDetail {
  questionNum: string;       // e.g. "Q1", "Q5(a)"
  questionText: string;      // The question text
  userAnswer: string;        // Student's answer or "Not Answered"
  correctAnswer: string;     // The correct answer
  isCorrect: boolean;        // Whether the student got it right
  isAnswered: boolean;       // Whether the student answered at all
  explanation?: string;      // AI explanation if available
  tip?: string;              // AI tip if available
}

type PDFAnswerValue = string | number | number[];

function getPDFMCQCorrectIndexes(question: Question & { type: 'mcq' | 'picture-mcq' | 'listening-mcq' }) {
  if (question.correctAnswers && question.correctAnswers.length > 0) {
    return Array.from(new Set(question.correctAnswers));
  }
  return typeof question.correctAnswer === 'number' ? [question.correctAnswer] : [];
}

function getPDFSelectedIndexes(answer: PDFAnswerValue | undefined) {
  if (Array.isArray(answer)) {
    return answer.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  }
  if (typeof answer === 'number' && Number.isFinite(answer)) {
    return [answer];
  }
  return [];
}

function getPDFOptionDisplay(option: string | { label?: string; text?: string } | undefined) {
  if (!option) return '';
  return typeof option === 'string' ? option : option.text || option.label || '';
}

function parsePDFChoiceMap(value: PDFAnswerValue | undefined): Record<string, unknown> {
  try {
    if (typeof value === 'string') {
      return JSON.parse(value) as Record<string, unknown>;
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  } catch {
    // Ignore malformed serialized answers.
  }

  return {};
}

function getPDFChoiceIndex(record: Record<string, unknown>, label: string) {
  const raw = record[label];
  const selectedIndex = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(selectedIndex) ? selectedIndex : undefined;
}

function formatPDFPassageInlinePrompt(prompt: string, item: { label: string; options: string[] }) {
  const blankPrompt = `Blank ${item.label}: ${item.options.join(' / ')}`;
  return prompt ? `${prompt} — ${blankPrompt}` : blankPrompt;
}

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

function titleCaseSectionId(sectionId: string) {
  return sectionId
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function safeParseJSON<T>(json: string | null, fallback: T): T {
  if (!json) return fallback;
  try { return JSON.parse(json) as T; } catch { return fallback; }
}

function isManualWritingReview(result: WritingEvalResult | null | undefined) {
  return Boolean(
    result &&
    (result.reviewMode === 'manual' || result.manualReviewRequired || (result.maxScore === 0 && result.grade === 'Manual Review'))
  );
}

function isManualSpeakingReview(result: SpeakingEvaluationResult | null | undefined) {
  return Boolean(
    result &&
    (result.reviewMode === 'manual' || result.manualReviewRequired || (result.totalPossible === 0 && result.grade === 'Manual Review'))
  );
}

/**
 * Build detailed question info for auto-gradable sections (vocabulary, grammar, listening).
 * This reconstructs the same logic as ResultsPage's detailedResults.
 */
function buildAutoGradableDetails(
  section: Section,
  answers: Record<string, PDFAnswerValue>,
  explanationsMap: Map<number, ExplanationResult>,
): QuestionDetail[] {
  const details: QuestionDetail[] = [];
  for (const q of section.questions) {
    const key = `${section.id}:${q.id}`;
    const userAns = answers[key];
    const isAnswered = userAns !== undefined && userAns !== '' && !(Array.isArray(userAns) && userAns.length === 0);

    if (q.type === 'picture-mcq' || q.type === 'listening-mcq') {
      const selectedIndexes = getPDFSelectedIndexes(userAns);
      const correctIndexes = getPDFMCQCorrectIndexes(q);
      const userText = selectedIndexes.length
        ? selectedIndexes.map((index) => q.options[index]?.text || q.options[index]?.label || `Option ${index + 1}`).join(', ')
        : 'Not Answered';
      const correctText = correctIndexes.length
        ? correctIndexes.map((index) => q.options[index]?.text || q.options[index]?.label || `Option ${index + 1}`).join(', ')
        : (q.options[q.correctAnswer]?.text || q.options[q.correctAnswer]?.label || `Option ${q.correctAnswer + 1}`);
      const isCorrect = JSON.stringify([...selectedIndexes].sort((a, b) => a - b)) === JSON.stringify([...correctIndexes].sort((a, b) => a - b));
      const expl = explanationsMap.get(q.id);
      details.push({
        questionNum: `Q${q.id}`,
        questionText: q.question,
        userAnswer: userText,
        correctAnswer: correctText,
        isCorrect: isAnswered && isCorrect,
        isAnswered,
        explanation: expl?.explanation_en,
        tip: expl?.tip_en,
      });
    } else if (q.type === 'mcq') {
      const expl = explanationsMap.get(q.id);
      const correctIndexes = getPDFMCQCorrectIndexes(q);
      if (correctIndexes.length > 1) {
        const selectedIndexes = getPDFSelectedIndexes(userAns);
        const userText = selectedIndexes.length
          ? selectedIndexes.map((index) => getPDFOptionDisplay(q.options[index])).join(', ')
          : 'Not Answered';
        const correctText = correctIndexes.map((index) => getPDFOptionDisplay(q.options[index])).join(', ');
        const isCorrect = JSON.stringify([...selectedIndexes].sort((a, b) => a - b)) === JSON.stringify([...correctIndexes].sort((a, b) => a - b));
        details.push({
          questionNum: `Q${q.id}`,
          questionText: q.question.replace('___', q.highlightWord || '___'),
          userAnswer: userText,
          correctAnswer: correctText,
          isCorrect: isAnswered && isCorrect,
          isAnswered,
          explanation: expl?.explanation_en,
          tip: expl?.tip_en,
        });
      } else if (typeof q.correctAnswer === 'number') {
        const userIdx = isAnswered ? Number(userAns) : -1;
        const userText = userIdx >= 0 ? q.options[userIdx] : 'Not Answered';
        const isCorrect = userIdx === q.correctAnswer;
        details.push({
          questionNum: `Q${q.id}`,
          questionText: q.question.replace('___', q.highlightWord || '___'),
          userAnswer: userText,
          correctAnswer: q.options[q.correctAnswer],
          isCorrect: isAnswered && isCorrect,
          isAnswered,
          explanation: expl?.explanation_en,
          tip: expl?.tip_en,
        });
      } else {
        // MCQ with string correctAnswer (e.g., yes/no)
        const userIdx = isAnswered ? Number(userAns) : -1;
        const userOptionText = (userIdx >= 0 && q.options[userIdx]) ? q.options[userIdx] : (isAnswered ? String(userAns) : 'Not Answered');
        const isCorrect = userOptionText.trim().toLowerCase() === String(q.correctAnswer).trim().toLowerCase();
        details.push({
          questionNum: `Q${q.id}`,
          questionText: q.question,
          userAnswer: userOptionText,
          correctAnswer: String(q.correctAnswer),
          isCorrect: isAnswered && isCorrect,
          isAnswered,
          explanation: expl?.explanation_en,
          tip: expl?.tip_en,
        });
      }
    } else if (q.type === 'fill-blank') {
      const wordBank = section.wordBank;
      const correctWord = wordBank?.find((w: any) => w.letter === q.correctAnswer);
      const userWord = isAnswered ? wordBank?.find((w: any) => w.letter === String(userAns)) : null;
      const isCorrect = isAnswered && String(userAns).toUpperCase() === q.correctAnswer.toUpperCase();
      const expl = explanationsMap.get(q.id);
      details.push({
        questionNum: `Q${q.id}`,
        questionText: `Fill in blank ${q.id}`,
        userAnswer: isAnswered ? (userWord ? `${userWord.letter} (${userWord.word})` : String(userAns)) : 'Not Answered',
        correctAnswer: correctWord ? `${correctWord.letter} (${correctWord.word})` : q.correctAnswer,
        isCorrect,
        isAnswered,
        explanation: expl?.explanation_en,
        tip: expl?.tip_en,
      });
    } else if (q.type === 'checkbox') {
      const userArr = isAnswered ? (userAns as unknown as number[]) : [];
      const userLabels = Array.isArray(userArr) && userArr.length > 0 ? userArr.map((i: number) => q.options[i]).join(', ') : 'Not Answered';
      const correctLabels = q.correctAnswers.map((i: number) => q.options[i]).join(', ');
      const sorted1 = Array.isArray(userArr) ? [...userArr].sort() : [];
      const sorted2 = [...q.correctAnswers].sort();
      const isCorrect = JSON.stringify(sorted1) === JSON.stringify(sorted2);
      const expl = explanationsMap.get(q.id);
      details.push({
        questionNum: `Q${q.id}`,
        questionText: q.question,
        userAnswer: userLabels,
        correctAnswer: correctLabels,
        isCorrect: isAnswered && isCorrect,
        isAnswered: Array.isArray(userArr) && userArr.length > 0,
        explanation: expl?.explanation_en,
        tip: expl?.tip_en,
      });
    } else if (q.type === 'open-ended') {
      const rawText = typeof userAns === 'string' ? userAns : '';
      const isAudioAnswer = rawText.startsWith('http') || rawText.startsWith('blob');
      details.push({
        questionNum: `Q${q.id}`,
        questionText: q.question,
        userAnswer: isAnswered ? (isAudioAnswer ? 'Audio response submitted' : rawText) : 'Not Answered',
        correctAnswer: q.correctAnswer || 'Teacher review required',
        isCorrect: false,
        isAnswered,
      });
    } else if (q.type === 'passage-inline-word-choice') {
      const parsed = parsePDFChoiceMap(userAns);
      q.items.forEach((item) => {
        const selectedIndex = getPDFChoiceIndex(parsed, item.label);
        const hasAnswer = selectedIndex !== undefined && selectedIndex >= 0;
        const expl = explanationsMap.get(q.id);
        details.push({
          questionNum: `Q${q.id}(${item.label})`,
          questionText: formatPDFPassageInlinePrompt(q.question, item),
          userAnswer: hasAnswer ? item.options[selectedIndex] || 'Not Answered' : 'Not Answered',
          correctAnswer: item.options[item.correctAnswer] || '',
          isCorrect: hasAnswer && selectedIndex === item.correctAnswer,
          isAnswered: hasAnswer,
          explanation: expl?.explanation_en,
          tip: expl?.tip_en,
        });
      });
    }
  }
  return details;
}

/**
 * Build detailed question info for reading section.
 * Reading questions may be AI-graded (open-ended types) or auto-gradable (wordbank-fill, story-fill).
 */
function buildReadingDetails(
  section: Section,
  answers: Record<string, PDFAnswerValue>,
  readingResults: ReadingGradingResult[] | null,
  explanationsMap: Map<number, ExplanationResult>,
): QuestionDetail[] {
  const details: QuestionDetail[] = [];
  const readingMap = new Map<string, ReadingGradingResult>();
  if (readingResults) {
    for (const r of readingResults) readingMap.set(String(r.questionId), r);
  }

  for (const q of section.questions) {
    const key = `${section.id}:${q.id}`;
    const userAns = answers[key];
    const isAnswered = userAns !== undefined && userAns !== '' && !(Array.isArray(userAns) && userAns.length === 0);

    if (q.type === 'wordbank-fill' || q.type === 'story-fill') {
      // These are AI-graded via readingResults
      const rr = readingMap.get(String(q.id));
      const expl = explanationsMap.get(q.id);
      details.push({
        questionNum: `Q${q.id}`,
        questionText: q.question,
        userAnswer: isAnswered ? String(userAns) : 'Not Answered',
        correctAnswer: q.correctAnswer,
        isCorrect: rr ? rr.isCorrect : (isAnswered && String(userAns).trim().toLowerCase() === q.correctAnswer.trim().toLowerCase()),
        isAnswered,
        explanation: rr?.explanation_en || expl?.explanation_en,
        tip: expl?.tip_en,
      });
    } else if (q.type === 'true-false') {
      const parsed: Record<string, boolean> = (() => { try { return typeof userAns === 'string' ? JSON.parse(userAns) : {}; } catch { return {}; } })();
      for (const stmt of q.statements) {
        const subKey = `${q.id}-${stmt.label}`;
        const rr = readingMap.get(subKey);
        const subAnswered = parsed[stmt.label] !== undefined;
        details.push({
          questionNum: `Q${q.id}(${stmt.label})`,
          questionText: `True or False: "${stmt.statement}"`,
          userAnswer: subAnswered ? (parsed[stmt.label] ? 'True' : 'False') : 'Not Answered',
          correctAnswer: stmt.isTrue ? 'True' : 'False',
          isCorrect: rr ? rr.isCorrect : (subAnswered && parsed[stmt.label] === stmt.isTrue),
          isAnswered: subAnswered,
          explanation: rr?.explanation_en,
        });
      }
    } else if (q.type === 'open-ended' && q.subQuestions) {
      const parsed: Record<string, string> = (() => { try { return typeof userAns === 'string' ? JSON.parse(userAns) : {}; } catch { return {}; } })();
      for (const sub of q.subQuestions) {
        const subKey = `${q.id}-${sub.label}`;
        const rr = readingMap.get(subKey);
        const subAnswered = !!parsed[sub.label];
        details.push({
          questionNum: `Q${q.id}(${sub.label})`,
          questionText: `${q.question} — ${sub.question}`,
          userAnswer: subAnswered ? parsed[sub.label] : 'Not Answered',
          correctAnswer: sub.answer,
          isCorrect: rr ? rr.isCorrect : false,
          isAnswered: subAnswered,
          explanation: rr?.explanation_en,
        });
      }
    } else if (q.type === 'open-ended' && !q.subQuestions) {
      const rr = readingMap.get(String(q.id));
      details.push({
        questionNum: `Q${q.id}`,
        questionText: q.question,
        userAnswer: isAnswered ? String(userAns) : 'Not Answered',
        correctAnswer: q.answer || '',
        isCorrect: rr ? rr.isCorrect : false,
        isAnswered,
        explanation: rr?.explanation_en,
      });
    } else if (q.type === 'table') {
      const parsed: Record<string, string> = (() => { try { return typeof userAns === 'string' ? JSON.parse(userAns) : {}; } catch { return {}; } })();
      q.rows.forEach((row: any, i: number) => {
        const label = String.fromCharCode(97 + i);
        const subKey = `${q.id}-${label}`;
        const rr = readingMap.get(subKey);
        const val = parsed[`row${i}`] || parsed[row.blankField + i] || parsed[label] || (typeof parsed === 'object' ? (Object.values(parsed)[i] as string) : undefined);
        const subAnswered = !!val;
        details.push({
          questionNum: `Q${q.id}(${label})`,
          questionText: `Complete the table for: "${row.situation}" — fill in the ${row.blankField}`,
          userAnswer: subAnswered ? val : 'Not Answered',
          correctAnswer: row.answer,
          isCorrect: rr ? rr.isCorrect : false,
          isAnswered: subAnswered,
          explanation: rr?.explanation_en,
        });
      });
    } else if (q.type === 'reference') {
      const parsed: Record<string, string> = (() => { try { return typeof userAns === 'string' ? JSON.parse(userAns) : {}; } catch { return {}; } })();
      q.items.forEach((item: any, i: number) => {
        const label = String.fromCharCode(97 + i);
        const subKey = `${q.id}-${label}`;
        const rr = readingMap.get(subKey);
        const val = parsed[item.word] || parsed[label] || (typeof parsed === 'object' ? (Object.values(parsed)[i] as string) : undefined);
        const subAnswered = !!val;
        details.push({
          questionNum: `Q${q.id}(${label})`,
          questionText: `What does "${item.word}" (${item.lineRef}) refer to?`,
          userAnswer: subAnswered ? val : 'Not Answered',
          correctAnswer: item.answer,
          isCorrect: rr ? rr.isCorrect : false,
          isAnswered: subAnswered,
          explanation: rr?.explanation_en,
        });
      });
    } else if (q.type === 'order') {
      const parsed: Record<string, any> = (() => { try { return typeof userAns === 'string' ? JSON.parse(userAns) : {}; } catch { return {}; } })();
      q.events.forEach((event: string, i: number) => {
        const label = String.fromCharCode(97 + i);
        const subKey = `${q.id}-${label}`;
        const rr = readingMap.get(subKey);
        const val = parsed[label] || parsed[i] || (typeof parsed === 'object' ? (Object.values(parsed)[i] as string) : undefined);
        const subAnswered = !!val;
        details.push({
          questionNum: `Q${q.id}(${label})`,
          questionText: `Order: "${event}"`,
          userAnswer: subAnswered ? String(val) : 'Not Answered',
          correctAnswer: String(q.correctOrder[i]),
          isCorrect: rr ? rr.isCorrect : false,
          isAnswered: subAnswered,
          explanation: rr?.explanation_en,
        });
      });
    } else if (q.type === 'phrase') {
      const parsed: Record<string, any> = (() => { try { return typeof userAns === 'string' ? JSON.parse(userAns) : {}; } catch { return {}; } })();
      q.items.forEach((item: any, i: number) => {
        const label = String.fromCharCode(97 + i);
        const subKey = `${q.id}-${label}`;
        const rr = readingMap.get(subKey);
        const val = parsed[label] || parsed[i] || (typeof parsed === 'object' ? (Object.values(parsed)[i] as string) : undefined);
        const subAnswered = !!val;
        details.push({
          questionNum: `Q${q.id}(${label})`,
          questionText: item.clue,
          userAnswer: subAnswered ? String(val) : 'Not Answered',
          correctAnswer: item.answer,
          isCorrect: rr ? rr.isCorrect : false,
          isAnswered: subAnswered,
          explanation: rr?.explanation_en,
        });
      });
    } else if (q.type === 'checkbox') {
      const userArr = isAnswered ? (userAns as unknown as number[]) : [];
      const userLabels = Array.isArray(userArr) && userArr.length > 0 ? userArr.map((i: number) => q.options[i]).join(', ') : 'Not Answered';
      const correctLabels = q.correctAnswers.map((i: number) => q.options[i]).join(', ');
      const rr = readingMap.get(String(q.id));
      details.push({
        questionNum: `Q${q.id}`,
        questionText: q.question,
        userAnswer: userLabels,
        correctAnswer: correctLabels,
        isCorrect: rr ? rr.isCorrect : false,
        isAnswered: Array.isArray(userArr) && userArr.length > 0,
        explanation: rr?.explanation_en,
      });
    } else if (q.type === 'passage-inline-word-choice') {
      const parsed = parsePDFChoiceMap(userAns);
      q.items.forEach((item) => {
        const selectedIndex = getPDFChoiceIndex(parsed, item.label);
        const rr = readingMap.get(`${q.id}-${item.label}`);
        const hasAnswer = selectedIndex !== undefined && selectedIndex >= 0;
        details.push({
          questionNum: `Q${q.id}(${item.label})`,
          questionText: formatPDFPassageInlinePrompt(q.question, item),
          userAnswer: hasAnswer ? item.options[selectedIndex] || 'Not Answered' : 'Not Answered',
          correctAnswer: item.options[item.correctAnswer] || '',
          isCorrect: rr ? rr.isCorrect : (hasAnswer && selectedIndex === item.correctAnswer),
          isAnswered: hasAnswer,
          explanation: rr?.explanation_en,
        });
      });
    }
  }
  return details;
}

export function generateReportPDF(data: PDFData): void {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const mL = 18;
  const mR = 18;
  const contentW = pageW - mL - mR;
  let y = 0;
  let pageNum = 1;

  // English-only report — use built-in helvetica font
  const setFont = (bold: boolean, _txt?: string) => {
    pdf.setFont('helvetica', bold ? 'bold' : 'normal');
  };

  // ── Color palette ──
  const C = {
    primary: [37, 99, 235] as [number, number, number],
    accent: [109, 40, 217] as [number, number, number],
    success: [22, 163, 74] as [number, number, number],
    successLight: [220, 252, 231] as [number, number, number],
    danger: [220, 38, 38] as [number, number, number],
    dangerLight: [254, 226, 226] as [number, number, number],
    amber: [217, 119, 6] as [number, number, number],
    rose: [225, 29, 72] as [number, number, number],
    roseLight: [255, 228, 230] as [number, number, number],
    text: [30, 41, 59] as [number, number, number],
    textMuted: [100, 116, 139] as [number, number, number],
    bgLight: [248, 250, 252] as [number, number, number],
    border: [226, 232, 240] as [number, number, number],
    notAnswered: [156, 163, 175] as [number, number, number],
    notAnsweredBg: [243, 244, 246] as [number, number, number],
  };
  const sectionColors: Record<string, [number, number, number]> = {
    vocabulary: [16, 185, 129],
    grammar: [245, 158, 11],
    listening: [139, 92, 246],
    reading: [99, 102, 241],
    writing: [225, 29, 72],
  };
  const watermarkText = 'PUREON EDUCATION';

  // ── Helper functions ──
  const addWatermark = () => {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(30);
    pdf.setTextColor(238, 242, 247);
    pdf.text(watermarkText, pageW / 2, pageH / 2, {
      align: 'center',
      angle: -32,
    });
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(11);
    pdf.setTextColor(226, 232, 240);
    pdf.text(APP_BRAND_TITLE, pageW / 2, pageH / 2 + 10, {
      align: 'center',
      angle: -32,
    });
  };

  const addPageFooter = () => {
    pdf.setDrawColor(...C.border);
    pdf.setLineWidth(0.3);
    pdf.line(mL, pageH - 12, pageW - mR, pageH - 12);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(...C.textMuted);
    pdf.text(`Assessment Feedback Report - ${data.paperTitle}`, mL, pageH - 8);
    pdf.text(`Page ${pageNum}`, pageW - mR, pageH - 8, { align: 'right' });
  };

  const checkPage = (need: number) => {
    if (y + need > pageH - 18) {
      addPageFooter();
      pdf.addPage();
      pageNum++;
      y = 15;
      addWatermark();
    }
  };

  const addText = (txt: string, x: number, size: number, bold = false, color: [number, number, number] = C.text, maxW = contentW) => {
    setFont(bold, txt);
    pdf.setFontSize(size);
    pdf.setTextColor(...color);
    const lines = pdf.splitTextToSize(txt, maxW);
    checkPage(lines.length * (size * 0.45) + 2);
    pdf.text(lines, x, y);
    y += lines.length * (size * 0.45) + 1;
  };

  const addGap = (g: number) => { y += g; };

  const drawRect = (x: number, ry: number, w: number, h: number, color: [number, number, number], radius = 0) => {
    pdf.setFillColor(...color);
    if (radius > 0) pdf.roundedRect(x, ry, w, h, radius, radius, 'F');
    else pdf.rect(x, ry, w, h, 'F');
  };

  const addDivider = (color: [number, number, number] = C.border, thick = 0.3) => {
    addGap(4);
    pdf.setDrawColor(...color);
    pdf.setLineWidth(thick);
    pdf.line(mL, y, pageW - mR, y);
    addGap(4);
  };

  const addSectionBanner = (title: string, color: [number, number, number], bgColor: [number, number, number]) => {
    checkPage(14);
    drawRect(mL, y - 2, contentW, 12, bgColor, 3);
    drawRect(mL, y - 2, 3, 12, color, 1);
    setFont(true, title);
    pdf.setFontSize(12);
    pdf.setTextColor(...color);
    pdf.text(title, mL + 7, y + 6);
    y += 14;
  };

  // ── Parse stored JSON data ──
  const answers = safeParseJSON<Record<string, PDFAnswerValue>>(data.answersJson, {});
  const bySection = safeParseJSON<Record<string, { correct: number; total: number }>>(data.scoreBySectionJson, {});
  const sectionTimings = safeParseJSON<Record<string, number>>(data.sectionTimingsJson, {});
  const readingResults = safeParseJSON<ReadingGradingResult[] | null>(data.readingResultsJson, null);
  const writingResult = safeParseJSON<WritingEvalResult | null>(data.writingResultJson, null);
  const explanations = safeParseJSON<ExplanationResult[] | null>(data.explanationsJson, null);
  const report = safeParseJSON<AssessmentReportResult | null>(data.reportJson, null);
  const speakingEvaluation: SpeakingEvaluationResult | null = report?.speakingEvaluation || null;

  // Build explanations lookup map
  const explanationsMap = new Map<number, ExplanationResult>();
  if (explanations) {
    for (const e of explanations) explanationsMap.set(e.questionId, e);
  }

  // Get paper data for question details
  const paper = getPaperById(data.paperId);
  const writingSection = paper?.sections.find((section) => section.questions.some((question) => question.type === 'writing'));
  const writingQuestion = writingSection?.questions.find((question): question is Extract<Question, { type: 'writing' }> => question.type === 'writing');
  const writingAnswerKey = writingSection && writingQuestion ? `${writingSection.id}:${writingQuestion.id}` : null;
  const writingEssay =
    writingAnswerKey && typeof answers[writingAnswerKey] === 'string'
      ? String(answers[writingAnswerKey])
      : '';

  // Calculate total score including automated sections only.
  const readingAIScore = readingResults ? readingResults.reduce((sum, r) => sum + r.score, 0) : 0;
  const readingAITotal = readingResults ? readingResults.length : 0;
  const writingIsManual = isManualWritingReview(writingResult);
  const writingAIScore = writingResult && !writingIsManual ? writingResult.score : 0;
  const writingAITotal = writingResult && !writingIsManual ? writingResult.maxScore : 0;
  const speakingIsManual = isManualSpeakingReview(speakingEvaluation);
  const speakingAIScore = speakingEvaluation && !speakingIsManual ? speakingEvaluation.totalScore : 0;
  const speakingAITotal = speakingEvaluation && !speakingIsManual ? speakingEvaluation.totalPossible : 0;
  const totalScore = data.totalCorrect + readingAIScore + writingAIScore + speakingAIScore;
  const totalPossible = data.totalQuestions + readingAITotal + writingAITotal + speakingAITotal;
  const percentage = totalPossible > 0 ? Math.round((totalScore / totalPossible) * 100) : 0;

  const getGrade = () => {
    if (percentage >= 90) return { grade: 'A', label: 'Excellent!' };
    if (percentage >= 75) return { grade: 'B', label: 'Good Job!' };
    if (percentage >= 60) return { grade: 'C', label: 'Keep Practicing!' };
    return { grade: 'D', label: 'Needs Improvement' };
  };
  const gradeInfo = getGrade();

  const totalTime = data.totalTimeSeconds || 0;
  const minutes = Math.floor(totalTime / 60);
  const seconds = totalTime % 60;

  // ── TITLE BANNER ──
  drawRect(0, 0, pageW, 28, C.primary);
  drawRect(0, 24, pageW, 8, C.accent);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.setTextColor(255, 255, 255);
  pdf.text(report?.reportTitle_en || 'Assessment Feedback Report', pageW / 2, 14, { align: 'center' });
  pdf.setFontSize(9);
  pdf.setTextColor(200, 210, 255);
  const reportDate = new Date(data.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  pdf.text(`${data.paperTitle} · Generated on ${reportDate}`, pageW / 2, 22, { align: 'center' });
  addWatermark();
  y = 38;

  // ── STUDENT INFO ──
  drawRect(mL, y - 2, contentW, 20, C.bgLight, 3);
  drawRect(mL, y - 2, 3, 20, C.primary, 1);
  pdf.setFontSize(10);
  pdf.setTextColor(...C.text);
  const namePrefix = 'Student: ';
  pdf.setFont('helvetica', 'bold');
  pdf.text(namePrefix, mL + 7, y + 5);
  const prefixWidth = pdf.getTextWidth(namePrefix);
  pdf.setFont('helvetica', 'normal');
  pdf.text(data.studentName, mL + 7 + prefixWidth, y + 5);
  if (data.studentGrade) {
    const gradeText = `Grade: ${data.studentGrade}`;
    setFont(false, gradeText);
    pdf.text(gradeText, mL + 90, y + 5);
  }
  pdf.setFont('helvetica', 'bold');
  pdf.text('Assessment:', mL + 7, y + 11);
  pdf.setFont('helvetica', 'normal');
  pdf.text(data.paperTitle, mL + 28, y + 11);
  y += 24;

  // ── SCORE SUMMARY ──
  const cardW = (contentW - 8) / 3;
  const cards = [
    { label: 'Grade', value: gradeInfo.grade, color: C.accent },
    { label: 'Score', value: `${totalScore}/${totalPossible} (${percentage}%)`, color: C.primary },
    { label: 'Time', value: totalTime > 0 ? `${minutes}m ${seconds.toString().padStart(2, '0')}s` : 'N/A', color: C.text },
  ];
  cards.forEach((card, i) => {
    const cx = mL + i * (cardW + 4);
    drawRect(cx, y, cardW, 18, C.bgLight, 3);
    drawRect(cx, y, cardW, 4, card.color, 2);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.setTextColor(...card.color);
    pdf.text(card.value, cx + cardW / 2, y + 11, { align: 'center' });
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.setTextColor(...C.textMuted);
    pdf.text(card.label, cx + cardW / 2, y + 16, { align: 'center' });
  });
  y += 24;
  const manualScoreNotes = [
    writingIsManual ? 'Writing is pending teacher review and is not included in the automatic score.' : null,
    speakingIsManual ? 'Speaking is pending teacher review and is not included in the automatic score.' : null,
  ].filter(Boolean) as string[];
  manualScoreNotes.forEach((note) => {
    addText(note, mL + 2, 8.3, false, C.amber, contentW - 6);
  });
  addDivider();

  // ── SECTION BREAKDOWN ──
  addText('Section Breakdown', mL, 11, true, C.text);
  addGap(2);
  const tableY = y;
  pdf.setFillColor(...C.primary);
  pdf.rect(mL, tableY, contentW, 8, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8.5);
  pdf.setTextColor(255, 255, 255);
  pdf.text('Section', mL + 4, tableY + 5.5);
  pdf.text('Score', mL + contentW - 40, tableY + 5.5, { align: 'center' });
  pdf.text('Time', mL + contentW - 12, tableY + 5.5, { align: 'center' });
  y = tableY + 8;

  // Build section list from bySection + reading + writing
  const sectionKeys = Object.keys(bySection);
  const allSectionIds = [...sectionKeys];
  if (readingResults && !allSectionIds.includes('reading')) allSectionIds.push('reading');
  if (writingResult && !allSectionIds.includes('writing')) allSectionIds.push('writing');
  if (speakingEvaluation) {
    for (const item of speakingEvaluation.evaluations) {
      if (!allSectionIds.includes(item.sectionId)) allSectionIds.push(item.sectionId);
    }
  }

  const sectionOrder = ['vocabulary', 'grammar', 'listening', 'reading', 'writing'];
  const orderedSections = sectionOrder.filter(s => allSectionIds.includes(s));
  allSectionIds.forEach(s => { if (!orderedSections.includes(s)) orderedSections.push(s); });

  orderedSections.forEach((sectionId, idx) => {
    let sCorrect = 0;
    let sTotal = 0;
    if (sectionId === 'reading' && readingResults) {
      sCorrect = readingResults.filter(r => r.isCorrect).length;
      sTotal = readingResults.length;
    } else if (sectionId === 'writing' && writingResult) {
      sCorrect = writingIsManual ? 0 : writingResult.score;
      sTotal = writingIsManual ? 0 : writingResult.maxScore;
    } else if (speakingEvaluation && speakingEvaluation.evaluations.some((item) => item.sectionId === sectionId)) {
      const evaluations = speakingEvaluation.evaluations.filter((item) => item.sectionId === sectionId);
      sCorrect = speakingIsManual ? 0 : evaluations.reduce((sum, item) => sum + item.score, 0);
      sTotal = speakingIsManual ? 0 : evaluations.reduce((sum, item) => sum + item.maxScore, 0);
    } else if (bySection[sectionId]) {
      sCorrect = bySection[sectionId].correct;
      sTotal = bySection[sectionId].total;
    }

    const pct = sTotal > 0 ? Math.round((sCorrect / sTotal) * 100) : 0;
    const sTime = sectionTimings[sectionId] || 0;
    if (idx % 2 === 0) {
      pdf.setFillColor(248, 250, 252);
      pdf.rect(mL, y, contentW, 7, 'F');
    }
    const sc = sectionColors[sectionId] || C.text;
    pdf.setFillColor(...sc);
    pdf.circle(mL + 4, y + 3.5, 1.5, 'F');
    const sectionTitle = paper?.sections.find((section) => section.id === sectionId)?.title || titleCaseSectionId(sectionId);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(...C.text);
    pdf.text(sectionTitle, mL + 9, y + 5);
    const scoreStr =
      (sectionId === 'writing' && writingIsManual) || (speakingIsManual && speakingEvaluation?.evaluations.some((item) => item.sectionId === sectionId))
        ? 'Manual Review'
        : sTotal > 0
          ? `${sCorrect}/${sTotal} (${pct}%)`
          : 'N/A';
    pdf.text(scoreStr, mL + contentW - 40, y + 5, { align: 'center' });
    pdf.text(sTime > 0 ? formatTime(sTime) : '-', mL + contentW - 12, y + 5, { align: 'center' });
    y += 7;
  });
  addGap(4);
  addDivider();

  // ── PROFICIENCY REPORT ──
  if (report) {
    addSectionBanner('Overall Summary', C.accent, [237, 233, 254]);
    checkPage(14);
    drawRect(mL, y - 2, 28, 10, C.accent, 2);
    setFont(true, report.languageLevel);
    pdf.setFontSize(11);
    pdf.setTextColor(255, 255, 255);
    pdf.text(report.languageLevel, mL + 14, y + 4.5, { align: 'center' });
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(...C.textMuted);
    pdf.text('CEFR Level', mL + 32, y + 4.5);
    y += 14;

    addText(report.overallSummary_en || report.summary_en, mL + 2, 9, false, C.text, contentW - 6);
    addGap(3);
    addText('Time Management', mL, 9.5, true, C.text);
    addText(report.timeAnalysis_en, mL + 2, 9, false, C.textMuted, contentW - 6);
    addGap(3);

    if ((report.abilitySnapshot_en || []).length > 0) {
      checkPage(10);
      drawRect(mL, y - 1, contentW, 1, C.primary);
      y += 3;
      addText('Ability Snapshot', mL, 10, true, C.primary);
      (report.abilitySnapshot_en || []).forEach((item) => { addText(`-  ${item}`, mL + 4, 9, false, C.text); });
      addGap(3);
    }

    checkPage(10);
    drawRect(mL, y - 1, contentW, 1, C.success);
    y += 3;
    addText('Strengths', mL, 10, true, C.success);
    (report.strengths_en || []).forEach(s => { addText(`+  ${s}`, mL + 4, 9, false, C.text); });
    addGap(3);

    checkPage(10);
    drawRect(mL, y - 1, contentW, 1, C.amber);
    y += 3;
    addText('Areas for Improvement', mL, 10, true, C.amber);
    (report.weaknesses_en || []).forEach(w => { addText(`-  ${w}`, mL + 4, 9, false, C.text); });
    addGap(3);

    checkPage(10);
    drawRect(mL, y - 1, contentW, 1, C.primary);
    y += 3;
    addText('Recommendations', mL, 10, true, C.primary);
    (report.recommendations_en || []).forEach((r, i) => { addText(`${i + 1}.  ${r}`, mL + 4, 9, false, C.text); });
    addGap(4);

    if ((report.sectionInsights || []).length > 0) {
      addSectionBanner('Section Insights', C.primary, [239, 246, 255]);
      report.sectionInsights.forEach((item) => {
        addText(item.sectionTitle, mL, 9.5, true, C.text);
        addText(item.summary_en, mL + 2, 8.8, false, C.textMuted, contentW - 6);
        addGap(2);
      });
      addGap(2);
    }

    if ((report.studyPlan || []).length > 0) {
      addSectionBanner('Three-Stage Study Plan', C.amber, [255, 247, 237]);
      report.studyPlan.forEach((stage) => {
        checkPage(16);
        drawRect(mL, y - 1, contentW, 8, C.bgLight, 2);
        addText(`${stage.stage_en} - ${stage.focus_en}`, mL + 2, 9.5, true, C.text);
        (stage.actions_en || []).forEach((action, index) => {
          addText(`${index + 1}.  ${action}`, mL + 4, 8.8, false, C.textMuted, contentW - 8);
        });
        addGap(2);
      });
    }

    if (report.parentFeedback_en) {
      addSectionBanner('Parent Feedback', C.rose, [255, 241, 242]);
      addText(report.parentFeedback_en, mL + 2, 9, false, C.text, contentW - 6);
      addGap(3);
    }

    addDivider();
  }

  // ══════════════════════════════════════════════════════════════
  // ── COMPLETE QUESTION DETAILS (ALL QUESTIONS, EVERY SECTION) ──
  // ══════════════════════════════════════════════════════════════
  if (paper) {
    for (const section of paper.sections) {
      if (section.id === 'writing') continue; // Writing handled separately below

      const sc = sectionColors[section.id] || C.primary;
      const sectionTitle = section.id.charAt(0).toUpperCase() + section.id.slice(1);
      addSectionBanner(`${sectionTitle} — Question Details`, sc, [
        Math.min(255, sc[0] + 200),
        Math.min(255, sc[1] + 200),
        Math.min(255, sc[2] + 200),
      ]);

      let details: QuestionDetail[];
      if (section.id === 'reading') {
        details = buildReadingDetails(section, answers, readingResults, explanationsMap);
      } else {
        details = buildAutoGradableDetails(section, answers, explanationsMap);
      }

      if (details.length === 0) {
        addText('No questions found for this section.', mL + 4, 9, false, C.textMuted);
        addGap(4);
        continue;
      }

      for (const detail of details) {
        // Estimate space needed for this question block
        checkPage(28);

        // Question number badge + status indicator
        const statusColor = !detail.isAnswered ? C.notAnswered : detail.isCorrect ? C.success : C.danger;
        const statusBg = !detail.isAnswered ? C.notAnsweredBg : detail.isCorrect ? C.successLight : C.dangerLight;
        const statusLabel = !detail.isAnswered ? 'NOT ANSWERED' : detail.isCorrect ? 'CORRECT' : 'WRONG';

        // Background card for the question
        drawRect(mL, y - 1, contentW, 6, C.bgLight, 2);

        // Question number
        setFont(true);
        pdf.setFontSize(9.5);
        pdf.setTextColor(...C.text);
        pdf.text(detail.questionNum, mL + 4, y + 3);

        // Status badge
        const badgeX = mL + contentW - 30;
        drawRect(badgeX, y - 0.5, 28, 5, statusBg, 2);
        pdf.setFontSize(6.5);
        pdf.setTextColor(...statusColor);
        setFont(true);
        pdf.text(statusLabel, badgeX + 14, y + 2.8, { align: 'center' });

        y += 8;

        // Question text
        addText(detail.questionText, mL + 6, 8.5, false, C.text, contentW - 14);
        addGap(1);

        // Student's answer
        if (detail.isAnswered) {
          const ansColor = detail.isCorrect ? C.success : C.danger;
          setFont(true);
          pdf.setFontSize(8);
          pdf.setTextColor(...C.textMuted);
          pdf.text('Student Answer:', mL + 6, y);
          const labelW = pdf.getTextWidth('Student Answer: ');
          setFont(false, detail.userAnswer);
          pdf.setTextColor(...ansColor);
          const ansLines = pdf.splitTextToSize(detail.userAnswer, contentW - 14 - labelW);
          pdf.text(ansLines, mL + 6 + labelW, y);
          y += ansLines.length * 3.6 + 1;
        } else {
          setFont(true);
          pdf.setFontSize(8);
          pdf.setTextColor(...C.textMuted);
          pdf.text('Student Answer:', mL + 6, y);
          const labelW = pdf.getTextWidth('Student Answer: ');
          setFont(false);
          pdf.setTextColor(...C.notAnswered);
          pdf.text('Not Answered', mL + 6 + labelW, y);
          y += 4;
        }

        // Correct answer
        setFont(true);
        pdf.setFontSize(8);
        pdf.setTextColor(...C.textMuted);
        pdf.text('Correct Answer:', mL + 6, y);
        const correctLabelW = pdf.getTextWidth('Correct Answer: ');
        setFont(false, detail.correctAnswer);
        pdf.setTextColor(...C.success);
        const correctLines = pdf.splitTextToSize(detail.correctAnswer, contentW - 14 - correctLabelW);
        pdf.text(correctLines, mL + 6 + correctLabelW, y);
        y += correctLines.length * 3.6 + 1;

        // Explanation (if available and question was answered wrong — not for unanswered questions)
        if (detail.explanation && detail.isAnswered && !detail.isCorrect) {
          addGap(1);
          addText(`Explanation: ${detail.explanation}`, mL + 6, 8, false, C.textMuted, contentW - 14);
        }

        // Tip (if available, only for answered-wrong questions)
        if (detail.tip && detail.isAnswered && !detail.isCorrect) {
          addText(`Tip: ${detail.tip}`, mL + 6, 8, false, C.amber, contentW - 14);
        }

        addGap(4);

        // Thin separator between questions
        pdf.setDrawColor(...C.border);
        pdf.setLineWidth(0.15);
        pdf.line(mL + 4, y, pageW - mR - 4, y);
        addGap(3);
      }

      addGap(2);
    }
  }

  // ── WRITING EVALUATION ──
  if (writingResult) {
    addSectionBanner(writingIsManual ? 'Writing Review' : 'Writing Evaluation', C.rose, C.roseLight);
    addGap(3);
    if (writingQuestion) {
      addText('Writing Prompt', mL, 10, true, C.text);
      addText(writingQuestion.topic, mL + 2, 9, false, C.text, contentW - 6);
      addGap(1);
      if (writingQuestion.instructions) {
        addText(writingQuestion.instructions, mL + 2, 8.8, false, C.textMuted, contentW - 6);
        addGap(2);
      }
    }

    if (writingEssay) {
      addText('Student Essay', mL, 10, true, C.text);
      addGap(1);
      drawRect(mL, y - 1, contentW, 1, C.border);
      y += 3;
      addText(writingEssay, mL + 2, 9, false, C.text, contentW - 6);
      addGap(4);
    }

    checkPage(14);
    if (writingIsManual) {
      drawRect(mL, y - 2, 40, 10, C.amber, 2);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(255, 255, 255);
      pdf.text('Manual Review', mL + 20, y + 4.5, { align: 'center' });
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(...C.textMuted);
      pdf.text('Teacher Score Pending', mL + 44, y + 4.5);
      y += 14;
    } else {
      drawRect(mL, y - 2, 32, 10, C.rose, 2);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.setTextColor(255, 255, 255);
      pdf.text(`${writingResult.score} / ${writingResult.maxScore}`, mL + 16, y + 4.5, { align: 'center' });
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(...C.textMuted);
      pdf.text('Writing Score', mL + 36, y + 4.5);
      y += 14;
    }

    if (!writingIsManual) {
      addText('Overall Feedback', mL, 10, true, C.text);
      addText(writingResult.overallFeedback_en, mL + 2, 9.5, false, C.textMuted);
      addGap(4);
    }

    if (!writingIsManual && writingResult.grammarErrors.length > 0) {
      addText('Errors Found', mL, 10, true, C.danger);
      addGap(2);
      writingResult.grammarErrors.forEach((err, i) => {
        checkPage(16);
        drawRect(mL + 2, y - 2, contentW - 4, 1, C.dangerLight);
        y += 2;
        addText(`${i + 1}. "${err.original}"`, mL + 4, 9, false, C.danger);
        addText(`   -> "${err.correction}"`, mL + 4, 9, true, C.success);
        addText(`   ${err.explanation_en}`, mL + 6, 8.5, false, C.textMuted, contentW - 14);
        addGap(2);
      });
      addGap(2);
    }

    if (!writingIsManual && writingResult.correctedEssay) {
      addText('Corrected Essay', mL, 10, true, C.text);
      addGap(1);
      checkPage(8);
      drawRect(mL, y - 1, contentW, 1, C.accent);
      y += 3;
      addText(writingResult.correctedEssay, mL + 2, 9, false, C.text, contentW - 6);
      addGap(4);
    }

    const suggestions = writingResult.suggestions_en;
    if (!writingIsManual && suggestions && suggestions.length > 0) {
      checkPage(10);
      drawRect(mL, y - 1, contentW, 1, C.primary);
      y += 3;
      addText('Suggestions for Improvement', mL, 10, true, C.primary);
      suggestions.forEach((s, i) => { addText(`${i + 1}.  ${s}`, mL + 4, 9, false, C.text); });
    }
    addGap(4);
  }

  if (speakingEvaluation && speakingEvaluation.evaluations.length > 0) {
    addSectionBanner(speakingIsManual ? 'Speaking Review' : 'Speaking Evaluation', [14, 165, 233], [240, 249, 255]);
    addText(speakingEvaluation.overallFeedback_en, mL + 2, 9, false, C.text, contentW - 6);
    addGap(3);

    speakingEvaluation.evaluations.forEach((item) => {
      checkPage(34);
      drawRect(mL, y - 1, contentW, 6, C.bgLight, 2);
      setFont(true);
      pdf.setFontSize(9.5);
      pdf.setTextColor(...C.text);
      pdf.text(`${item.sectionTitle} - Q${item.questionId}`, mL + 4, y + 3);
      if (speakingIsManual) {
        drawRect(mL + contentW - 32, y - 0.5, 30, 5, [254, 243, 199], 2);
        pdf.setFontSize(7);
        pdf.setTextColor(180, 83, 9);
        pdf.text('Manual Review', mL + contentW - 17, y + 2.8, { align: 'center' });
      } else {
        drawRect(mL + contentW - 22, y - 0.5, 20, 5, [224, 242, 254], 2);
        pdf.setFontSize(7);
        pdf.setTextColor(3, 105, 161);
        pdf.text(`${item.score}/${item.maxScore}`, mL + contentW - 12, y + 2.8, { align: 'center' });
      }
      y += 8;

      addText(`Prompt: ${item.prompt}`, mL + 6, 8.5, false, C.text, contentW - 14);
      if (speakingIsManual) {
        addText('Teacher review status: Recording submitted. Please listen to the original audio and add a score and comments manually.', mL + 6, 8.3, false, C.textMuted, contentW - 14);
      } else {
        addText(`Transcript: ${item.transcript || 'No transcript available.'}`, mL + 6, 8.5, false, C.textMuted, contentW - 14);
        addText(`Overall Comment: ${item.feedback_en}`, mL + 6, 8.3, false, C.text, contentW - 14);
        addText(`Task Completion: ${item.taskCompletion_en}`, mL + 6, 8.1, false, C.textMuted, contentW - 14);
        addText(`Fluency: ${item.fluency_en}`, mL + 6, 8.1, false, C.textMuted, contentW - 14);
        addText(`Vocabulary: ${item.vocabulary_en}`, mL + 6, 8.1, false, C.textMuted, contentW - 14);
        addText(`Grammar: ${item.grammar_en}`, mL + 6, 8.1, false, C.textMuted, contentW - 14);
        addText(`Pronunciation: ${item.pronunciation_en}`, mL + 6, 8.1, false, C.textMuted, contentW - 14);
      }

      if (item.suggestions_en.length > 0) {
        addText(speakingIsManual ? 'Teacher Checklist' : 'Suggestions', mL + 6, 8.6, true, C.primary);
        item.suggestions_en.forEach((suggestion, index) => {
          addText(`${index + 1}.  ${suggestion}`, mL + 8, 8.1, false, C.textMuted, contentW - 16);
        });
      }

      addGap(3);
      pdf.setDrawColor(...C.border);
      pdf.setLineWidth(0.15);
      pdf.line(mL + 4, y, pageW - mR - 4, y);
      addGap(3);
    });
  }

  // ── FOOTER ──
  addPageFooter();

  // ── Download ──
  const nameSlug = data.studentName ? `_${data.studentName.replace(/\s+/g, '_')}` : '';
  const fileName = `Assessment_Feedback_Report${nameSlug}_${new Date(data.createdAt).toISOString().slice(0, 10)}.pdf`;
  pdf.save(fileName);
}
