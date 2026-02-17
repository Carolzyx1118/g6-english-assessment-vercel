/*
 * QuizLayout: Left sidebar navigation + right content area
 * Scandinavian minimal design with clear section navigation
 */

import { useQuiz } from '@/contexts/QuizContext';

import Sidebar from '@/components/Sidebar';
import SectionContent from '@/components/SectionContent';
import ResultsPage from '@/components/ResultsPage';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';

export default function QuizLayout() {
  const { state } = useQuiz();
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
          <SectionContent />
        </div>
      </main>
    </div>
  );
}
