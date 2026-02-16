import { useQuiz } from '@/contexts/QuizContext';
import { sections } from '@/data/questions';
import { trpc } from '@/lib/trpc';
import { motion } from 'framer-motion';
import { Trophy, RotateCcw, CheckCircle2, XCircle, BookOpen, Headphones, PenTool, FileText, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEffect, useState, useRef } from 'react';

const sectionMeta: Record<string, { icon: React.ReactNode; gradient: string; bg: string }> = {
  listening: { icon: <Headphones className="w-5 h-5" />, gradient: 'from-blue-500 to-blue-600', bg: 'bg-blue-50' },
  vocabulary: { icon: <BookOpen className="w-5 h-5" />, gradient: 'from-emerald-500 to-emerald-600', bg: 'bg-emerald-50' },
  grammar: { icon: <PenTool className="w-5 h-5" />, gradient: 'from-amber-500 to-amber-600', bg: 'bg-amber-50' },
  reading: { icon: <FileText className="w-5 h-5" />, gradient: 'from-indigo-500 to-indigo-600', bg: 'bg-indigo-50' },
  writing: { icon: <PenTool className="w-5 h-5" />, gradient: 'from-rose-500 to-rose-600', bg: 'bg-rose-50' },
};

type ReadingGradingResult = { questionId: number; isCorrect: boolean; score: number; feedback: string };
type WritingEvalResult = {
  score: number;
  maxScore: number;
  grade: string;
  overallFeedback: string;
  grammarErrors: { original: string; correction: string; explanation: string }[];
  suggestions: string[];
  correctedEssay: string;
};

export default function ResultsPage() {
  const { getScore, resetQuiz, state, getAnswer } = useQuiz();
  const { correct, total, bySection } = getScore();

  const timeTaken = state.startTime && state.endTime
    ? Math.round((state.endTime - state.startTime) / 1000)
    : 0;
  const minutes = Math.floor(timeTaken / 60);
  const seconds = timeTaken % 60;

  // AI Grading states
  const [readingResults, setReadingResults] = useState<ReadingGradingResult[] | null>(null);
  const [writingResult, setWritingResult] = useState<WritingEvalResult | null>(null);
  const [isGradingReading, setIsGradingReading] = useState(false);
  const [isGradingWriting, setIsGradingWriting] = useState(false);
  const [readingError, setReadingError] = useState<string | null>(null);
  const [writingError, setWritingError] = useState<string | null>(null);
  const hasStartedGrading = useRef(false);

  const checkReadingMutation = trpc.grading.checkReadingAnswers.useMutation();
  const evaluateWritingMutation = trpc.grading.evaluateWriting.useMutation();

  // Auto-trigger AI grading on mount
  useEffect(() => {
    if (hasStartedGrading.current) return;
    hasStartedGrading.current = true;

    // Grade reading comprehension answers
    const readingSection = sections.find(s => s.id === 'reading');
    if (readingSection) {
      const readingAnswers: { questionId: number; questionType: string; questionText: string; userAnswer: string; correctAnswer: string }[] = [];

      for (const q of readingSection.questions) {
        const userAns = getAnswer(q.id);
        let questionText = '';
        let correctAnswer = '';
        let userAnswer = '';

        if (q.type === 'true-false') {
          questionText = 'True/False statements';
          const parsed = (() => { try { return typeof userAns === 'string' ? JSON.parse(userAns) : {}; } catch { return {}; } })();
          userAnswer = JSON.stringify(parsed);
          correctAnswer = JSON.stringify(q.statements.map(s => ({ label: s.label, isTrue: s.isTrue, reason: s.reason })));
        } else if (q.type === 'table') {
          questionText = q.question;
          const parsed = (() => { try { return typeof userAns === 'string' ? JSON.parse(userAns) : {}; } catch { return {}; } })();
          userAnswer = JSON.stringify(parsed);
          correctAnswer = JSON.stringify(q.rows.map(r => ({ situation: r.situation, [r.blankField]: r.answer })));
        } else if (q.type === 'reference') {
          questionText = q.question;
          const parsed = (() => { try { return typeof userAns === 'string' ? JSON.parse(userAns) : {}; } catch { return {}; } })();
          userAnswer = JSON.stringify(parsed);
          correctAnswer = JSON.stringify(q.items.map(item => ({ word: item.word, answer: item.answer })));
        } else if (q.type === 'order') {
          questionText = q.question;
          const parsed = (() => { try { return typeof userAns === 'string' ? JSON.parse(userAns) : {}; } catch { return {}; } })();
          userAnswer = JSON.stringify(parsed);
          correctAnswer = JSON.stringify(q.correctOrder);
        } else if (q.type === 'phrase') {
          questionText = q.question;
          const parsed = (() => { try { return typeof userAns === 'string' ? JSON.parse(userAns) : {}; } catch { return {}; } })();
          userAnswer = JSON.stringify(parsed);
          correctAnswer = JSON.stringify(q.items.map(item => item.answer));
        } else if (q.type === 'open-ended') {
          questionText = q.question;
          userAnswer = typeof userAns === 'string' ? userAns : '';
          if (q.subQuestions) {
            correctAnswer = JSON.stringify(q.subQuestions.map(s => ({ label: s.label, answer: s.answer })));
          } else {
            correctAnswer = q.answer || '';
          }
        } else if (q.type === 'checkbox') {
          questionText = q.question;
          const userArr = userAns as number[] | undefined;
          userAnswer = userArr ? userArr.map(i => q.options[i]).join(', ') : '';
          correctAnswer = q.correctAnswers.map(i => q.options[i]).join(', ');
        }

        if (questionText) {
          readingAnswers.push({
            questionId: q.id,
            questionType: q.type,
            questionText,
            userAnswer,
            correctAnswer,
          });
        }
      }

      if (readingAnswers.length > 0) {
        setIsGradingReading(true);
        checkReadingMutation.mutate(
          { answers: readingAnswers },
          {
            onSuccess: (data) => {
              setReadingResults(data);
              setIsGradingReading(false);
            },
            onError: (err) => {
              setReadingError('Failed to grade reading answers. Please try again.');
              setIsGradingReading(false);
            },
          }
        );
      }
    }

    // Grade writing
    const writingSection = sections.find(s => s.id === 'writing');
    if (writingSection) {
      const writingQ = writingSection.questions.find(q => q.type === 'writing');
      if (writingQ && writingQ.type === 'writing') {
        const essay = getAnswer(writingQ.id);
        if (essay && typeof essay === 'string' && essay.trim().length > 10) {
          setIsGradingWriting(true);
          evaluateWritingMutation.mutate(
            { essay, topic: writingQ.topic, wordCountTarget: writingQ.wordCount },
            {
              onSuccess: (data) => {
                setWritingResult(data);
                setIsGradingWriting(false);
              },
              onError: (err) => {
                setWritingError('Failed to evaluate writing. Please try again.');
                setIsGradingWriting(false);
              },
            }
          );
        }
      }
    }
  }, []);

  // Calculate total score including AI grading
  const readingAIScore = readingResults ? readingResults.reduce((sum, r) => sum + r.score, 0) : 0;
  const readingAITotal = readingResults ? readingResults.length : 0;
  const writingAIScore = writingResult ? writingResult.score : 0;
  const writingAITotal = writingResult ? writingResult.maxScore : 20;

  const totalScore = correct + readingAIScore + writingAIScore;
  const totalPossible = total + readingAITotal + writingAITotal;
  const percentage = totalPossible > 0 ? Math.round((totalScore / totalPossible) * 100) : 0;

  const getGrade = () => {
    if (percentage >= 90) return { grade: 'A', color: 'text-emerald-600', label: 'Excellent!' };
    if (percentage >= 75) return { grade: 'B', color: 'text-blue-600', label: 'Good Job!' };
    if (percentage >= 60) return { grade: 'C', color: 'text-amber-600', label: 'Keep Practicing!' };
    return { grade: 'D', color: 'text-red-500', label: 'Needs Improvement' };
  };

  const gradeInfo = getGrade();
  const isStillGrading = isGradingReading || isGradingWriting;

  // Detailed answer review for auto-gradable sections
  const getDetailedResults = () => {
    const results: { sectionId: string; sectionTitle: string; questions: { id: number; question: string; userAnswer: string; correctAnswer: string; isCorrect: boolean }[] }[] = [];

    for (const section of sections) {
      if (section.id === 'reading' || section.id === 'writing') continue; // handled by AI

      const sectionResults: { id: number; question: string; userAnswer: string; correctAnswer: string; isCorrect: boolean }[] = [];

      for (const q of section.questions) {
        if (q.type === 'mcq') {
          const userAns = getAnswer(q.id);
          const userIdx = userAns !== undefined ? Number(userAns) : -1;
          sectionResults.push({
            id: q.id,
            question: q.question.replace('___', q.highlightWord || '___'),
            userAnswer: userIdx >= 0 ? q.options[userIdx] : 'Not answered',
            correctAnswer: q.options[q.correctAnswer],
            isCorrect: userIdx === q.correctAnswer,
          });
        } else if (q.type === 'listening-mcq') {
          const userAns = getAnswer(q.id);
          const userIdx = userAns !== undefined ? Number(userAns) : -1;
          sectionResults.push({
            id: q.id,
            question: q.question,
            userAnswer: userIdx >= 0 ? q.options[userIdx] : 'Not answered',
            correctAnswer: q.options[q.correctAnswer],
            isCorrect: userIdx === q.correctAnswer,
          });
        } else if (q.type === 'fill-blank') {
          const userAns = getAnswer(q.id);
          const wordBank = section.wordBank;
          const correctWord = wordBank?.find(w => w.letter === q.correctAnswer);
          const userWord = wordBank?.find(w => w.letter === String(userAns));
          sectionResults.push({
            id: q.id,
            question: `Blank (${q.id})`,
            userAnswer: userWord ? `${userWord.letter}) ${userWord.word}` : (userAns ? String(userAns) : 'Not answered'),
            correctAnswer: correctWord ? `${correctWord.letter}) ${correctWord.word}` : q.correctAnswer,
            isCorrect: String(userAns).toUpperCase() === q.correctAnswer.toUpperCase(),
          });
        } else if (q.type === 'checkbox') {
          const userAns = getAnswer(q.id) as number[] | undefined;
          const userLabels = userAns ? userAns.map(i => q.options[i]).join(', ') : 'Not answered';
          const correctLabels = q.correctAnswers.map(i => q.options[i]).join(', ');
          const sorted1 = userAns ? [...userAns].sort() : [];
          const sorted2 = [...q.correctAnswers].sort();
          sectionResults.push({
            id: q.id,
            question: q.question,
            userAnswer: userLabels,
            correctAnswer: correctLabels,
            isCorrect: JSON.stringify(sorted1) === JSON.stringify(sorted2),
          });
        }
      }

      if (sectionResults.length > 0) {
        results.push({ sectionId: section.id, sectionTitle: section.title, questions: sectionResults });
      }
    }

    return results;
  };

  const detailedResults = getDetailedResults();

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FAFBFD] via-white to-[#EEF4FF]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Score Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-500 text-white mb-6 shadow-lg shadow-amber-200">
            <Trophy className="w-10 h-10" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-800 mb-2">Assessment Complete!</h1>
          {isStillGrading ? (
            <div className="flex items-center justify-center gap-2 text-blue-600">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-lg">AI is grading your answers...</span>
            </div>
          ) : (
            <p className="text-slate-500 text-lg">{gradeInfo.label}</p>
          )}
        </motion.div>

        {/* Score Display */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="bg-white rounded-2xl border border-slate-200 shadow-lg p-8 mb-8"
        >
          <div className="grid sm:grid-cols-3 gap-6 text-center">
            <div>
              <div className={`text-5xl font-extrabold ${isStillGrading ? 'text-slate-300' : gradeInfo.color} mb-1`}>
                {isStillGrading ? '...' : gradeInfo.grade}
              </div>
              <div className="text-sm text-slate-400 font-medium">Grade</div>
            </div>
            <div>
              <div className="text-5xl font-extrabold text-slate-800 mb-1">
                {isStillGrading ? (
                  <span className="text-3xl text-slate-400">Grading...</span>
                ) : (
                  <>{totalScore}<span className="text-2xl text-slate-400">/{totalPossible}</span></>
                )}
              </div>
              <div className="text-sm text-slate-400 font-medium">
                {isStillGrading ? 'Please wait' : `Score (${percentage}%)`}
              </div>
            </div>
            <div>
              <div className="text-5xl font-extrabold text-slate-800 mb-1">
                {minutes}<span className="text-2xl text-slate-400">:{seconds.toString().padStart(2, '0')}</span>
              </div>
              <div className="text-sm text-slate-400 font-medium">Time Taken</div>
            </div>
          </div>
        </motion.div>

        {/* Section Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="bg-white rounded-2xl border border-slate-200 shadow-lg p-6 mb-8"
        >
          <h2 className="font-bold text-lg text-slate-800 mb-4">Section Breakdown</h2>
          <div className="space-y-3">
            {sections.map((section) => {
              const sectionScore = bySection[section.id];

              // Reading section - use AI results
              if (section.id === 'reading') {
                if (isGradingReading) {
                  return (
                    <div key={section.id} className={`flex items-center gap-4 p-3 rounded-xl ${sectionMeta[section.id]?.bg}`}>
                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${sectionMeta[section.id]?.gradient} text-white flex items-center justify-center`}>
                        {sectionMeta[section.id]?.icon}
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-sm text-slate-700">{section.title}</div>
                        <div className="flex items-center gap-2 text-xs text-blue-500">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          AI grading in progress...
                        </div>
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
                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${sectionMeta[section.id]?.gradient} text-white flex items-center justify-center`}>
                        {sectionMeta[section.id]?.icon}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-sm text-slate-700 flex items-center gap-1">
                            {section.title}
                            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                          </span>
                          <span className="text-sm font-bold text-slate-600">{rCorrect}/{rTotal}</span>
                        </div>
                        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.8, delay: 0.5 }}
                            className={`h-full rounded-full bg-gradient-to-r ${sectionMeta[section.id]?.gradient}`}
                          />
                        </div>
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={section.id} className={`flex items-center gap-4 p-3 rounded-xl ${sectionMeta[section.id]?.bg}`}>
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${sectionMeta[section.id]?.gradient} text-white flex items-center justify-center`}>
                      {sectionMeta[section.id]?.icon}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-sm text-slate-700">{section.title}</div>
                      <div className="text-xs text-red-400">{readingError || 'Grading failed'}</div>
                    </div>
                  </div>
                );
              }

              // Writing section - use AI results
              if (section.id === 'writing') {
                if (isGradingWriting) {
                  return (
                    <div key={section.id} className={`flex items-center gap-4 p-3 rounded-xl ${sectionMeta[section.id]?.bg}`}>
                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${sectionMeta[section.id]?.gradient} text-white flex items-center justify-center`}>
                        {sectionMeta[section.id]?.icon}
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-sm text-slate-700">{section.title}</div>
                        <div className="flex items-center gap-2 text-xs text-blue-500">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          AI evaluating your essay...
                        </div>
                      </div>
                    </div>
                  );
                }
                if (writingResult) {
                  const pct = Math.round((writingResult.score / writingResult.maxScore) * 100);
                  return (
                    <div key={section.id} className={`flex items-center gap-4 p-3 rounded-xl ${sectionMeta[section.id]?.bg}`}>
                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${sectionMeta[section.id]?.gradient} text-white flex items-center justify-center`}>
                        {sectionMeta[section.id]?.icon}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-sm text-slate-700 flex items-center gap-1">
                            {section.title}
                            <Sparkles className="w-3.5 h-3.5 text-rose-500" />
                          </span>
                          <span className="text-sm font-bold text-slate-600">{writingResult.score}/{writingResult.maxScore}</span>
                        </div>
                        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.8, delay: 0.5 }}
                            className={`h-full rounded-full bg-gradient-to-r ${sectionMeta[section.id]?.gradient}`}
                          />
                        </div>
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={section.id} className={`flex items-center gap-4 p-3 rounded-xl ${sectionMeta[section.id]?.bg}`}>
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${sectionMeta[section.id]?.gradient} text-white flex items-center justify-center`}>
                      {sectionMeta[section.id]?.icon}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-sm text-slate-700">{section.title}</div>
                      <div className="text-xs text-red-400">{writingError || 'No essay submitted'}</div>
                    </div>
                  </div>
                );
              }

              // Other sections - standard scoring
              if (!sectionScore || sectionScore.total === 0) return (
                <div key={section.id} className={`flex items-center gap-4 p-3 rounded-xl ${sectionMeta[section.id]?.bg || 'bg-slate-50'}`}>
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${sectionMeta[section.id]?.gradient} text-white flex items-center justify-center`}>
                    {sectionMeta[section.id]?.icon}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-sm text-slate-700">{section.title}</div>
                    <div className="text-xs text-slate-400">No auto-gradable questions</div>
                  </div>
                </div>
              );

              const pct = Math.round((sectionScore.correct / sectionScore.total) * 100);
              return (
                <div key={section.id} className={`flex items-center gap-4 p-3 rounded-xl ${sectionMeta[section.id]?.bg || 'bg-slate-50'}`}>
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${sectionMeta[section.id]?.gradient} text-white flex items-center justify-center`}>
                    {sectionMeta[section.id]?.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sm text-slate-700">{section.title}</span>
                      <span className="text-sm font-bold text-slate-600">{sectionScore.correct}/{sectionScore.total}</span>
                    </div>
                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, delay: 0.5 }}
                        className={`h-full rounded-full bg-gradient-to-r ${sectionMeta[section.id]?.gradient}`}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Standard Answer Review (Listening, Vocabulary, Grammar) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="space-y-6 mb-8"
        >
          <h2 className="font-bold text-lg text-slate-800">Answer Review</h2>
          {detailedResults.map((section) => (
            <div key={section.sectionId} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className={`px-5 py-3 ${sectionMeta[section.sectionId]?.bg || 'bg-slate-50'} border-b border-slate-200`}>
                <h3 className="font-bold text-sm text-slate-700">{section.sectionTitle}</h3>
              </div>
              <div className="divide-y divide-slate-100">
                {section.questions.map((q) => (
                  <div key={q.id} className="px-5 py-3 flex items-start gap-3">
                    <div className="mt-0.5">
                      {q.isCorrect ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-600 mb-1">
                        <span className="font-bold text-slate-500">Q{q.id}.</span> {q.question}
                      </p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                        <span className={q.isCorrect ? 'text-emerald-600' : 'text-red-500'}>
                          Your answer: <span className="font-medium">{q.userAnswer}</span>
                        </span>
                        {!q.isCorrect && (
                          <span className="text-emerald-600">
                            Correct: <span className="font-medium">{q.correctAnswer}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </motion.div>

        {/* AI Reading Comprehension Review */}
        {readingResults && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="mb-8"
          >
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 bg-indigo-50 border-b border-slate-200 flex items-center gap-2">
                <h3 className="font-bold text-sm text-slate-700">Part 3: Reading Comprehension</h3>
                <Sparkles className="w-4 h-4 text-indigo-500" />
                <span className="text-xs text-indigo-500 font-medium">AI Graded</span>
              </div>
              <div className="divide-y divide-slate-100">
                {readingResults.map((r) => (
                  <div key={r.questionId} className="px-5 py-4 flex items-start gap-3">
                    <div className="mt-0.5">
                      {r.isCorrect ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 mb-1">Q{r.questionId}</p>
                      <p className="text-xs text-slate-500">{r.feedback}</p>
                    </div>
                    <div className={`text-sm font-bold ${r.isCorrect ? 'text-emerald-500' : 'text-red-400'}`}>
                      {r.score}/1
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* AI Writing Evaluation */}
        {writingResult && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="mb-8"
          >
            <div className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
              <div className="px-5 py-3 bg-rose-50 border-b border-slate-200 flex items-center gap-2">
                <h3 className="font-bold text-sm text-slate-700">Part 4: Writing Evaluation</h3>
                <Sparkles className="w-4 h-4 text-rose-500" />
                <span className="text-xs text-rose-500 font-medium">AI Evaluated</span>
              </div>

              <div className="p-6 space-y-6">
                {/* Score & Grade */}
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <div className="text-4xl font-extrabold text-slate-800">{writingResult.score}</div>
                    <div className="text-xs text-slate-400">out of {writingResult.maxScore}</div>
                  </div>
                  <div className={`text-3xl font-extrabold ${
                    writingResult.grade === 'A' ? 'text-emerald-600' :
                    writingResult.grade === 'B' ? 'text-blue-600' :
                    writingResult.grade === 'C' ? 'text-amber-600' : 'text-red-500'
                  }`}>
                    Grade {writingResult.grade}
                  </div>
                </div>

                {/* Overall Feedback */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <h4 className="font-semibold text-sm text-slate-700 mb-2">Overall Feedback</h4>
                  <p className="text-sm text-slate-600 leading-relaxed">{writingResult.overallFeedback}</p>
                </div>

                {/* Grammar Errors */}
                {writingResult.grammarErrors.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-sm text-slate-700 mb-3 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-400" />
                      Grammar & Spelling Errors ({writingResult.grammarErrors.length})
                    </h4>
                    <div className="space-y-2">
                      {writingResult.grammarErrors.map((err, i) => (
                        <div key={i} className="p-3 rounded-lg bg-red-50 border border-red-200">
                          <div className="flex items-start gap-2 text-sm">
                            <span className="text-red-500 line-through">{err.original}</span>
                            <span className="text-slate-400">→</span>
                            <span className="text-emerald-600 font-medium">{err.correction}</span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">{err.explanation}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Suggestions */}
                {writingResult.suggestions.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-sm text-slate-700 mb-3">Suggestions for Improvement</h4>
                    <ul className="space-y-2">
                      {writingResult.suggestions.map((s, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                          <span className="text-blue-500 font-bold mt-0.5">{i + 1}.</span>
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Corrected Essay */}
                {writingResult.correctedEssay && (
                  <div>
                    <h4 className="font-semibold text-sm text-slate-700 mb-2">Corrected Version</h4>
                    <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                      {writingResult.correctedEssay}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Retry Button */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.7 }}
          className="text-center"
        >
          <Button
            onClick={resetQuiz}
            size="lg"
            className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 px-8 py-6 text-lg rounded-xl shadow-lg shadow-blue-200"
          >
            <RotateCcw className="w-5 h-5" />
            Try Again
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
