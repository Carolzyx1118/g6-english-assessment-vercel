/*
 * QuizLayout: Left sidebar navigation + right content area
 * Scandinavian minimal design with clear section navigation
 */

import { useQuiz } from '@/contexts/QuizContext';

import Sidebar from '@/components/Sidebar';
import SectionContent from '@/components/SectionContent';
import ResultsPage from '@/components/ResultsPage';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { AlertTriangle, LogOut, Menu, X } from 'lucide-react';

export default function QuizLayout() {
  const { state, resetQuiz } = useQuiz();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

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
          <div className="mb-6 flex justify-end pt-10 lg:pt-0">
            {showExitConfirm ? (
              <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-amber-50/90 p-4 shadow-sm">
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
                          setShowExitConfirm(false);
                          setSidebarOpen(false);
                          resetQuiz();
                        }}
                      >
                        Exit Test
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowExitConfirm(false)}
                      >
                        Continue Test
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowExitConfirm(true)}
                className="gap-2 border-red-200 text-red-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700"
              >
                <LogOut className="h-4 w-4" />
                Exit Test
              </Button>
            )}
          </div>
          <SectionContent />
        </div>
      </main>
    </div>
  );
}
