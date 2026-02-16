import { useQuiz } from '@/contexts/QuizContext';
import { sections } from '@/data/questions';
import { motion } from 'framer-motion';
import { Trophy, RotateCcw, CheckCircle2, XCircle, BookOpen, Headphones, PenTool, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

const sectionMeta: Record<string, { icon: React.ReactNode; gradient: string; bg: string }> = {
  listening: { icon: <Headphones className="w-5 h-5" />, gradient: 'from-blue-500 to-blue-600', bg: 'bg-blue-50' },
  vocabulary: { icon: <BookOpen className="w-5 h-5" />, gradient: 'from-emerald-500 to-emerald-600', bg: 'bg-emerald-50' },
  grammar: { icon: <PenTool className="w-5 h-5" />, gradient: 'from-amber-500 to-amber-600', bg: 'bg-amber-50' },
  reading: { icon: <FileText className="w-5 h-5" />, gradient: 'from-indigo-500 to-indigo-600', bg: 'bg-indigo-50' },
  writing: { icon: <PenTool className="w-5 h-5" />, gradient: 'from-rose-500 to-rose-600', bg: 'bg-rose-50' },
};

export default function ResultsPage() {
  const { getScore, resetQuiz, state, getAnswer } = useQuiz();
  const { correct, total, bySection } = getScore();
  const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;

  const timeTaken = state.startTime && state.endTime
    ? Math.round((state.endTime - state.startTime) / 1000)
    : 0;
  const minutes = Math.floor(timeTaken / 60);
  const seconds = timeTaken % 60;

  const getGrade = () => {
    if (percentage >= 90) return { grade: 'A', color: 'text-emerald-600', label: 'Excellent!' };
    if (percentage >= 75) return { grade: 'B', color: 'text-blue-600', label: 'Good Job!' };
    if (percentage >= 60) return { grade: 'C', color: 'text-amber-600', label: 'Keep Practicing!' };
    return { grade: 'D', color: 'text-red-500', label: 'Needs Improvement' };
  };

  const gradeInfo = getGrade();

  // Detailed answer review for auto-gradable sections
  const getDetailedResults = () => {
    const results: { sectionId: string; sectionTitle: string; questions: { id: number; question: string; userAnswer: string; correctAnswer: string; isCorrect: boolean }[] }[] = [];

    for (const section of sections) {
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
          <p className="text-slate-500 text-lg">{gradeInfo.label}</p>
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
              <div className={`text-5xl font-extrabold ${gradeInfo.color} mb-1`}>{gradeInfo.grade}</div>
              <div className="text-sm text-slate-400 font-medium">Grade</div>
            </div>
            <div>
              <div className="text-5xl font-extrabold text-slate-800 mb-1">
                {correct}<span className="text-2xl text-slate-400">/{total}</span>
              </div>
              <div className="text-sm text-slate-400 font-medium">Score ({percentage}%)</div>
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
              if (!sectionScore || sectionScore.total === 0) return (
                <div key={section.id} className={`flex items-center gap-4 p-3 rounded-xl ${sectionMeta[section.id]?.bg || 'bg-slate-50'}`}>
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${sectionMeta[section.id]?.gradient} text-white flex items-center justify-center`}>
                    {sectionMeta[section.id]?.icon}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-sm text-slate-700">{section.title}</div>
                    <div className="text-xs text-slate-400">Manual grading required</div>
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

        {/* Detailed Answer Review */}
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

        {/* Retry Button */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.6 }}
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
