/*
 * QuizLayout: Left sidebar navigation + right content area
 * Scandinavian minimal design with clear section navigation
 */

import { useQuiz } from '@/contexts/QuizContext';

import Sidebar from '@/components/Sidebar';
import SectionContent from '@/components/SectionContent';
import ResultsPage from '@/components/ResultsPage';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';
import { AlertTriangle, LogOut, Menu, Send, X } from 'lucide-react';

export default function QuizLayout() {
  const { state, resetQuiz, submitQuiz, sections, getSectionProgress } = useQuiz();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeConfirm, setActiveConfirm] = useState<'exit' | 'submit' | null>(null);

  const isLastSection = state.currentSectionIndex === sections.length - 1;
  const totalAnswered = sections.reduce((sum, section) => sum + getSectionProgress(section.id).answered, 0);
  const totalQuestions = sections.reduce((sum, section) => sum + getSectionProgress(section.id).total, 0);
  const unanswered = totalQuestions - totalAnswered;

  useEffect(() => {
    setActiveConfirm(null);
  }, [state.currentSectionIndex]);

  if (state.submitted) {
    return <ResultsPage />;
  }

  return (
    <div className="min-h-screen bg-[#FAFBFD] flex">
      {/* Mobile menu button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 w-10 h-10 rounded-xl bg-white shadow-md border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors"
      >
        {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/20 z-30"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed lg:sticky top-0 left-0 h-screen z-40
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <Sidebar onNavigate={() => setSidebarOpen(false)} />
      </div>

      {/* Main Content */}
      <main className="flex-1 min-h-screen overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
          <div className="mb-6 pt-10 lg:pt-0">
            <div className="flex flex-wrap items-center justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setActiveConfirm('exit')}
                className="h-12 min-w-[190px] gap-2 border-red-200 text-base text-red-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700"
              >
                <LogOut className="h-5 w-5" />
                Exit Test
              </Button>

              {isLastSection ? (
                <Button
                  onClick={() => setActiveConfirm('submit')}
                  className="h-12 min-w-[190px] gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-base shadow-lg shadow-blue-200 transition-all duration-300 hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl"
                >
                  <Send className="h-5 w-5" />
                  Submit Assessment
                </Button>
              ) : null}
            </div>

            {activeConfirm === 'exit' ? (
              <div className="mt-4 ml-auto w-full max-w-xl rounded-2xl border border-amber-200 bg-amber-50/90 p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-amber-900">Exit this assessment?</p>
                    <p className="mt-1 text-sm text-amber-800">
                      Your current answers and progress will be cleared, and you will return to the paper selection page.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          setActiveConfirm(null);
                          setSidebarOpen(false);
                          resetQuiz();
                        }}
                      >
                        Exit Test
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setActiveConfirm(null)}
                      >
                        Continue Test
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {activeConfirm === 'submit' ? (
              <div className="mt-4 ml-auto w-full max-w-xl rounded-2xl border border-amber-200 bg-amber-50/90 p-4 shadow-sm">
                {unanswered > 0 ? (
                  <div className="mb-3 flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500" />
                    <span className="text-sm text-amber-700">
                      You have <span className="font-bold">{unanswered}</span> unanswered question{unanswered > 1 ? 's' : ''}.
                    </span>
                  </div>
                ) : null}
                <p className="text-sm text-slate-600">
                  Are you sure you want to submit your assessment? This action cannot be undone.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    onClick={() => {
                      submitQuiz();
                      setActiveConfirm(null);
                    }}
                    className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                  >
                    <Send className="h-4 w-4" />
                    Yes, Submit
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setActiveConfirm(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
          <SectionContent />
        </div>
      </main>
    </div>
  );
}
