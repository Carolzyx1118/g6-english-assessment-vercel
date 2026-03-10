/*
 * Design: Fresh Educational Illustration Style
 * - Plus Jakarta Sans for headings, Nunito for body
 * - Ocean blue (#2563EB), mint green (#D1FAE5), amber (#F59E0B) palette
 * - Left sidebar navigation + right content area
 * - Encouraging feedback with animations
 */

import { useQuiz } from '@/contexts/QuizContext';
import LandingPage from '@/components/LandingPage';
import QuizLayout from '@/components/QuizLayout';
import { Loader2 } from 'lucide-react';

export default function Home() {
  const { isStarted, isRestoringSession } = useQuiz();

  if (isRestoringSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFBFD]">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin text-[#1E3A5F]" />
          <p className="text-sm">Restoring your assessment...</p>
        </div>
      </div>
    );
  }

  if (!isStarted) {
    return <LandingPage />;
  }

  return <QuizLayout />;
}
