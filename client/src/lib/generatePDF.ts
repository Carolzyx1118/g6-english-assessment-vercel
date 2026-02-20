/**
 * Shared PDF generation utility for admin history page.
 * Generates English-only assessment reports from database records.
 */
import jsPDF from 'jspdf';

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
};

type ExplanationResult = {
  questionId: number;
  explanation_en: string;
  explanation_cn: string;
  tip_en: string;
  tip_cn: string;
};

type ReportResult = {
  languageLevel: string;
  summary_en: string;
  summary_cn: string;
  strengths_en: string[];
  strengths_cn: string[];
  weaknesses_en: string[];
  weaknesses_cn: string[];
  recommendations_en: string[];
  recommendations_cn: string[];
  timeAnalysis_en: string;
  timeAnalysis_cn: string;
};

export interface PDFData {
  studentName: string;
  studentGrade: string | null;
  paperTitle: string;
  totalCorrect: number;
  totalQuestions: number;
  totalTimeSeconds: number | null;
  scoreBySectionJson: string | null;
  sectionTimingsJson: string | null;
  readingResultsJson: string | null;
  writingResultJson: string | null;
  explanationsJson: string | null;
  reportJson: string | null;
  createdAt: Date | string;
}

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

function safeParseJSON<T>(json: string | null, fallback: T): T {
  if (!json) return fallback;
  try { return JSON.parse(json) as T; } catch { return fallback; }
}

export async function generateReportPDF(data: PDFData): Promise<void> {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const mL = 18;
  const mR = 18;
  const contentW = pageW - mL - mR;
  let y = 0;
  let pageNum = 1;

  // Load Chinese font for CJK support (student names may be Chinese)
  let hasCJKFont = false;
  try {
    const { CJK_FONT_BASE64 } = await import('@/lib/cjk-font-base64');
    pdf.addFileToVFS('DroidSansCJK.ttf', CJK_FONT_BASE64);
    pdf.addFont('DroidSansCJK.ttf', 'DroidSans', 'normal');
    hasCJKFont = true;
  } catch (e) {
    console.warn('[PDF] Failed to load CJK font:', e);
  }

  const hasChinese = (s: string) => /[\u4e00-\u9fff\u3400-\u4dbf]/.test(s);
  const setFont = (bold: boolean, txt?: string) => {
    if (hasCJKFont && txt && hasChinese(txt)) {
      pdf.setFont('DroidSans', 'normal');
    } else {
      pdf.setFont('helvetica', bold ? 'bold' : 'normal');
    }
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
  };
  const sectionColors: Record<string, [number, number, number]> = {
    vocabulary: [16, 185, 129],
    grammar: [245, 158, 11],
    listening: [139, 92, 246],
    reading: [99, 102, 241],
    writing: [225, 29, 72],
  };

  // ── Helper functions ──
  const addPageFooter = () => {
    pdf.setDrawColor(...C.border);
    pdf.setLineWidth(0.3);
    pdf.line(mL, pageH - 12, pageW - mR, pageH - 12);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(...C.textMuted);
    pdf.text(`${data.paperTitle} - Assessment Report`, mL, pageH - 8);
    pdf.text(`Page ${pageNum}`, pageW - mR, pageH - 8, { align: 'right' });
  };

  const checkPage = (need: number) => {
    if (y + need > pageH - 18) {
      addPageFooter();
      pdf.addPage();
      pageNum++;
      y = 15;
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
  const bySection = safeParseJSON<Record<string, { correct: number; total: number }>>(data.scoreBySectionJson, {});
  const sectionTimings = safeParseJSON<Record<string, number>>(data.sectionTimingsJson, {});
  const readingResults = safeParseJSON<ReadingGradingResult[] | null>(data.readingResultsJson, null);
  const writingResult = safeParseJSON<WritingEvalResult | null>(data.writingResultJson, null);
  const explanations = safeParseJSON<ExplanationResult[] | null>(data.explanationsJson, null);
  const report = safeParseJSON<ReportResult | null>(data.reportJson, null);

  // Calculate total score including AI-graded sections
  const readingAIScore = readingResults ? readingResults.reduce((sum, r) => sum + r.score, 0) : 0;
  const readingAITotal = readingResults ? readingResults.length : 0;
  const writingAIScore = writingResult ? writingResult.score : 0;
  const writingAITotal = writingResult ? writingResult.maxScore : 0;
  const totalScore = data.totalCorrect + readingAIScore + writingAIScore;
  const totalPossible = data.totalQuestions + readingAITotal + writingAITotal;
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
  pdf.text(data.paperTitle, pageW / 2, 14, { align: 'center' });
  pdf.setFontSize(9);
  pdf.setTextColor(200, 210, 255);
  const reportDate = new Date(data.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  pdf.text(`Report generated on ${reportDate}`, pageW / 2, 22, { align: 'center' });
  y = 38;

  // ── STUDENT INFO ──
  drawRect(mL, y - 2, contentW, 14, C.bgLight, 3);
  drawRect(mL, y - 2, 3, 14, C.primary, 1);
  pdf.setFontSize(10);
  pdf.setTextColor(...C.text);
  const namePrefix = 'Student: ';
  pdf.setFont('helvetica', 'bold');
  pdf.text(namePrefix, mL + 7, y + 5);
  const prefixWidth = pdf.getTextWidth(namePrefix);
  if (hasCJKFont && hasChinese(data.studentName)) {
    pdf.setFont('DroidSans', 'normal');
  }
  pdf.text(data.studentName, mL + 7 + prefixWidth, y + 5);
  if (data.studentGrade) {
    const gradeText = `Grade: ${data.studentGrade}`;
    setFont(false, gradeText);
    pdf.text(gradeText, mL + 90, y + 5);
  }
  y += 18;

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

  // Preferred order
  const sectionOrder = ['vocabulary', 'grammar', 'listening', 'reading', 'writing'];
  const orderedSections = sectionOrder.filter(s => allSectionIds.includes(s));
  // Add any remaining sections not in the preferred order
  allSectionIds.forEach(s => { if (!orderedSections.includes(s)) orderedSections.push(s); });

  orderedSections.forEach((sectionId, idx) => {
    let sCorrect = 0;
    let sTotal = 0;
    if (sectionId === 'reading' && readingResults) {
      sCorrect = readingResults.filter(r => r.isCorrect).length;
      sTotal = readingResults.length;
    } else if (sectionId === 'writing' && writingResult) {
      sCorrect = writingResult.score;
      sTotal = writingResult.maxScore;
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
    const sectionTitle = sectionId.charAt(0).toUpperCase() + sectionId.slice(1);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(...C.text);
    pdf.text(sectionTitle, mL + 9, y + 5);
    const scoreStr = sTotal > 0 ? `${sCorrect}/${sTotal} (${pct}%)` : 'N/A';
    pdf.text(scoreStr, mL + contentW - 40, y + 5, { align: 'center' });
    pdf.text(sTime > 0 ? formatTime(sTime) : '-', mL + contentW - 12, y + 5, { align: 'center' });
    y += 7;
  });
  addGap(4);
  addDivider();

  // ── PROFICIENCY REPORT ──
  if (report) {
    addSectionBanner('Proficiency Report', C.accent, [237, 233, 254]);
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

    addText(report.summary_en, mL + 2, 9, false, C.text, contentW - 6);
    addGap(3);
    addText('Time Management', mL, 9.5, true, C.text);
    addText(report.timeAnalysis_en, mL + 2, 9, false, C.textMuted, contentW - 6);
    addGap(3);

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
    addDivider();
  }

  // ── READING WRONG ANSWERS ──
  if (readingResults) {
    const wrongReading = readingResults.filter(r => !r.isCorrect);
    if (wrongReading.length > 0) {
      addSectionBanner('Wrong Answers - Reading Comprehension', C.danger, C.dangerLight);
      addGap(3);

      for (const r of wrongReading) {
        checkPage(20);
        drawRect(mL, y - 2, contentW, 14, C.bgLight, 2);
        addText(`Q${r.questionId}`, mL + 4, 9.5, true, C.text, contentW - 10);
        addGap(1);
        addText(`> ${r.feedback_en}`, mL + 6, 8.5, false, C.textMuted, contentW - 14);
        addText(`> ${r.explanation_en}`, mL + 6, 8.5, false, C.textMuted, contentW - 14);
        addGap(4);
      }
      addDivider();
    }
  }

  // ── WRONG ANSWERS WITH EXPLANATIONS ──
  if (explanations && explanations.length > 0) {
    addSectionBanner('Wrong Answers & Explanations', C.danger, C.dangerLight);
    addGap(3);

    for (const expl of explanations) {
      checkPage(20);
      drawRect(mL, y - 2, contentW, 14, C.bgLight, 2);
      addText(`Q${expl.questionId}`, mL + 4, 9.5, true, C.text, contentW - 10);
      addGap(1);
      addText(`> ${expl.explanation_en}`, mL + 6, 8.5, false, C.textMuted, contentW - 14);
      addText(`Tip: ${expl.tip_en}`, mL + 6, 8.5, false, C.amber, contentW - 14);
      addGap(4);
    }
    addDivider();
  }

  // ── WRITING EVALUATION ──
  if (writingResult) {
    addSectionBanner('Writing Evaluation', C.rose, C.roseLight);
    addGap(3);
    checkPage(14);
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

    addText('Overall Feedback', mL, 10, true, C.text);
    addText(writingResult.overallFeedback_en, mL + 2, 9.5, false, C.textMuted);
    addGap(4);

    if (writingResult.grammarErrors.length > 0) {
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

    if (writingResult.correctedEssay) {
      addText('Corrected Essay', mL, 10, true, C.text);
      addGap(1);
      checkPage(8);
      drawRect(mL, y - 1, contentW, 1, C.accent);
      y += 3;
      addText(writingResult.correctedEssay, mL + 2, 9, false, C.text, contentW - 6);
      addGap(4);
    }

    const suggestions = writingResult.suggestions_en;
    if (suggestions && suggestions.length > 0) {
      checkPage(10);
      drawRect(mL, y - 1, contentW, 1, C.primary);
      y += 3;
      addText('Suggestions for Improvement', mL, 10, true, C.primary);
      suggestions.forEach((s, i) => { addText(`${i + 1}.  ${s}`, mL + 4, 9, false, C.text); });
    }
    addGap(4);
  }

  // ── FOOTER ──
  addPageFooter();

  // ── Download ──
  const nameSlug = data.studentName ? `_${data.studentName.replace(/\s+/g, '_')}` : '';
  const fileName = `${data.paperTitle}_Report${nameSlug}_${new Date(data.createdAt).toISOString().slice(0, 10)}.pdf`;
  const pdfBlob = pdf.output('blob');
  const blobUrl = URL.createObjectURL(pdfBlob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
}
