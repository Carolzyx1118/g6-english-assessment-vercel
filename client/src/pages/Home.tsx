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

export default function Home() {
  const { isStarted } = useQuiz();

  if (!isStarted) {
    return <LandingPage />;
  }

  return <QuizLayout />;
}
