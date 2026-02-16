import { useQuiz } from '@/contexts/QuizContext';
import { sections } from '@/data/questions';
import { BookOpen, Headphones, PenTool, FileText, CheckCircle2, Circle, AlertTriangle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useState } from 'react';

const sectionIcons: Record<string, React.ReactNode> = {
  listening: <Headphones className="w-4 h-4" />,
  vocabulary: <BookOpen className="w-4 h-4" />,
  grammar: <PenTool className="w-4 h-4" />,
  reading: <FileText className="w-4 h-4" />,
  writing: <PenTool className="w-4 h-4" />,
};

const activeColors: Record<string, string> = {
  listening: 'bg-blue-50 border-blue-300 text-blue-700',
  vocabulary: 'bg-emerald-50 border-emerald-300 text-emerald-700',
  grammar: 'bg-amber-50 border-amber-300 text-amber-700',
  reading: 'bg-indigo-50 border-indigo-300 text-indigo-700',
  writing: 'bg-rose-50 border-rose-300 text-rose-700',
};

const progressColors: Record<string, string> = {
  listening: '[&>div]:bg-blue-500',
  vocabulary: '[&>div]:bg-emerald-500',
  grammar: '[&>div]:bg-amber-500',
  reading: '[&>div]:bg-indigo-500',
  writing: '[&>div]:bg-rose-500',
};

interface SidebarProps {
  onNavigate: () => void;
}

function SubmitSection() {
  const { submitQuiz, getSectionProgress } = useQuiz();
  const [showConfirm, setShowConfirm] = useState(false);

  const totalAnswered = sections.reduce((sum, s) => sum + getSectionProgress(s.id).answered, 0);
  const totalQuestions = sections.reduce((sum, s) => sum + getSectionProgress(s.id).total, 0);
  const unanswered = totalQuestions - totalAnswered;

  return (
    <div className="p-4 border-t border-slate-100">
      {showConfirm && (
        <div className="mb-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm">
          {unanswered > 0 && (
            <div className="flex items-start gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <span className="text-amber-700">
                You have <span className="font-bold">{unanswered}</span> unanswered question{unanswered > 1 ? 's' : ''}.
              </span>
            </div>
          )}
          <p className="text-slate-600 mb-3">Are you sure you want to submit?</p>
          <div className="flex gap-2">
            <button
              onClick={() => { submitQuiz(); setShowConfirm(false); }}
              className="flex-1 py-2 px-3 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors"
            >
              Yes, Submit
            </button>
            <button
              onClick={() => setShowConfirm(false)}
              className="flex-1 py-2 px-3 rounded-lg bg-white border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {!showConfirm && (
        <button
          onClick={() => setShowConfirm(true)}
          className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold text-sm hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-200 hover:shadow-xl transition-all duration-300"
        >
          Submit Assessment
        </button>
      )}
    </div>
  );
}

export default function Sidebar({ onNavigate }: SidebarProps) {
  const { state, setCurrentSection, getSectionProgress, submitQuiz } = useQuiz();

  const totalAnswered = sections.reduce((sum, s) => {
    const p = getSectionProgress(s.id);
    return sum + p.answered;
  }, 0);
  const totalQuestions = sections.reduce((sum, s) => {
    const p = getSectionProgress(s.id);
    return sum + p.total;
  }, 0);
  const overallProgress = totalQuestions > 0 ? (totalAnswered / totalQuestions) * 100 : 0;

  return (
    <div className="w-72 h-screen bg-white border-r border-slate-200 flex flex-col shadow-sm">
      {/* Header */}
      <div className="p-5 border-b border-slate-100">
        <h1 className="font-extrabold text-lg text-slate-800 leading-tight">
          G6 English
          <span className="block text-blue-600 text-sm font-bold">Proficiency Assessment</span>
        </h1>
      </div>

      {/* Overall Progress */}
      <div className="px-5 py-4 border-b border-slate-100">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Overall Progress</span>
          <span className="text-xs font-bold text-slate-700">{totalAnswered}/{totalQuestions}</span>
        </div>
        <Progress value={overallProgress} className="h-2 bg-slate-100 [&>div]:bg-gradient-to-r [&>div]:from-blue-500 [&>div]:to-indigo-500" />
      </div>

      {/* Section Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {sections.map((section, index) => {
          const isActive = state.currentSectionIndex === index;
          const progress = getSectionProgress(section.id);
          const isComplete = progress.answered === progress.total && progress.total > 0;

          return (
            <button
              key={section.id}
              onClick={() => {
                setCurrentSection(index);
                onNavigate();
              }}
              className={`
                w-full text-left rounded-xl p-3 border transition-all duration-200
                ${isActive
                  ? activeColors[section.id]
                  : 'border-transparent hover:bg-slate-50 text-slate-600 hover:text-slate-800'
                }
              `}
            >
              <div className="flex items-center gap-3">
                <div className={`
                  w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0
                  ${isActive ? 'bg-white/60' : 'bg-slate-100'}
                `}>
                  {sectionIcons[section.id]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold truncate">{section.title}</span>
                    {isComplete && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Progress
                      value={progress.total > 0 ? (progress.answered / progress.total) * 100 : 0}
                      className={`h-1 flex-1 bg-slate-200/60 ${progressColors[section.id]}`}
                    />
                    <span className="text-[10px] font-medium text-slate-400 flex-shrink-0">
                      {progress.answered}/{progress.total}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </nav>

      {/* Submit Button */}
      <SubmitSection />
    </div>
  );
}
