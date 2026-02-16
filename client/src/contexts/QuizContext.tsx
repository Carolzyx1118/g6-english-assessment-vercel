import React, { createContext, useContext, useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { sections, type Section } from '@/data/questions';

interface QuizState {
  currentSectionIndex: number;
  answers: Record<number, string | string[] | number[]>;
  submitted: boolean;
  startTime: number | null;
  endTime: number | null;
}

interface SectionTiming {
  sectionId: string;
  startTime: number;
  totalTime: number; // accumulated ms
}

interface QuizContextType {
  state: QuizState;
  currentSection: Section;
  setCurrentSection: (index: number) => void;
  setAnswer: (questionId: number, answer: string | string[] | number[]) => void;
  getAnswer: (questionId: number) => string | string[] | number[] | undefined;
  submitQuiz: () => void;
  resetQuiz: () => void;
  startQuiz: () => void;
  isStarted: boolean;
  getScore: () => { correct: number; total: number; bySection: Record<string, { correct: number; total: number }> };
  getSectionProgress: (sectionId: string) => { answered: number; total: number };
  getSectionTimings: () => Record<string, number>; // sectionId -> seconds
  getTotalTime: () => number; // total seconds
}

const QuizContext = createContext<QuizContextType | null>(null);

export function QuizProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<QuizState>({
    currentSectionIndex: 0,
    answers: {},
    submitted: false,
    startTime: null,
    endTime: null,
  });
  const [isStarted, setIsStarted] = useState(false);

  // Per-section timing
  const sectionTimingsRef = useRef<Record<string, number>>({}); // sectionId -> accumulated ms
  const sectionEnteredAtRef = useRef<number | null>(null);
  const currentSectionIdRef = useRef<string>(sections[0]?.id || '');

  const currentSection = sections[state.currentSectionIndex];

  // Track section timing when section changes
  useEffect(() => {
    if (!isStarted || state.submitted) return;

    const now = Date.now();
    // Accumulate time for previous section
    if (sectionEnteredAtRef.current !== null && currentSectionIdRef.current) {
      const elapsed = now - sectionEnteredAtRef.current;
      sectionTimingsRef.current[currentSectionIdRef.current] =
        (sectionTimingsRef.current[currentSectionIdRef.current] || 0) + elapsed;
    }

    // Start timing new section
    currentSectionIdRef.current = currentSection?.id || '';
    sectionEnteredAtRef.current = now;
  }, [state.currentSectionIndex, isStarted, state.submitted]);

  const setCurrentSection = useCallback((index: number) => {
    setState(prev => ({ ...prev, currentSectionIndex: index }));
  }, []);

  const setAnswer = useCallback((questionId: number, answer: string | string[] | number[]) => {
    setState(prev => ({
      ...prev,
      answers: { ...prev.answers, [questionId]: answer },
    }));
  }, []);

  const getAnswer = useCallback((questionId: number) => {
    return state.answers[questionId];
  }, [state.answers]);

  const submitQuiz = useCallback(() => {
    const now = Date.now();
    // Finalize timing for current section
    if (sectionEnteredAtRef.current !== null && currentSectionIdRef.current) {
      const elapsed = now - sectionEnteredAtRef.current;
      sectionTimingsRef.current[currentSectionIdRef.current] =
        (sectionTimingsRef.current[currentSectionIdRef.current] || 0) + elapsed;
      sectionEnteredAtRef.current = null;
    }
    setState(prev => ({ ...prev, submitted: true, endTime: now }));
  }, []);

  const resetQuiz = useCallback(() => {
    setIsStarted(false);
    sectionTimingsRef.current = {};
    sectionEnteredAtRef.current = null;
    currentSectionIdRef.current = sections[0]?.id || '';
    setState({
      currentSectionIndex: 0,
      answers: {},
      submitted: false,
      startTime: null,
      endTime: null,
    });
  }, []);

  const startQuiz = useCallback(() => {
    setIsStarted(true);
    const now = Date.now();
    sectionEnteredAtRef.current = now;
    currentSectionIdRef.current = sections[0]?.id || '';
    setState(prev => ({ ...prev, startTime: now }));
  }, []);

  const getScore = useCallback(() => {
    let correct = 0;
    let total = 0;
    const bySection: Record<string, { correct: number; total: number }> = {};

    for (const section of sections) {
      bySection[section.id] = { correct: 0, total: 0 };
      for (const q of section.questions) {
        if (q.type === 'mcq' || q.type === 'listening-mcq') {
          total++;
          bySection[section.id].total++;
          const answer = state.answers[q.id];
          if (answer !== undefined && Number(answer) === q.correctAnswer) {
            correct++;
            bySection[section.id].correct++;
          }
        } else if (q.type === 'fill-blank') {
          total++;
          bySection[section.id].total++;
          const answer = state.answers[q.id];
          if (answer !== undefined && String(answer).toUpperCase() === q.correctAnswer.toUpperCase()) {
            correct++;
            bySection[section.id].correct++;
          }
        } else if (q.type === 'checkbox') {
          total++;
          bySection[section.id].total++;
          const answer = state.answers[q.id] as number[] | undefined;
          if (answer && Array.isArray(answer)) {
            const sorted1 = [...answer].sort();
            const sorted2 = [...q.correctAnswers].sort();
            if (JSON.stringify(sorted1) === JSON.stringify(sorted2)) {
              correct++;
              bySection[section.id].correct++;
            }
          }
        }
      }
    }

    return { correct, total, bySection };
  }, [state.answers]);

  const getSectionProgress = useCallback((sectionId: string) => {
    const section = sections.find(s => s.id === sectionId);
    if (!section) return { answered: 0, total: 0 };
    
    let answered = 0;
    const total = section.questions.length;
    
    for (const q of section.questions) {
      const answer = state.answers[q.id];
      if (answer !== undefined && answer !== '' && !(Array.isArray(answer) && answer.length === 0)) {
        answered++;
      }
    }
    
    return { answered, total };
  }, [state.answers]);

  const getSectionTimings = useCallback(() => {
    const result: Record<string, number> = {};
    for (const [sectionId, ms] of Object.entries(sectionTimingsRef.current)) {
      result[sectionId] = Math.round(ms / 1000);
    }
    return result;
  }, []);

  const getTotalTime = useCallback(() => {
    if (state.startTime && state.endTime) {
      return Math.round((state.endTime - state.startTime) / 1000);
    }
    return 0;
  }, [state.startTime, state.endTime]);

  const value = useMemo(() => ({
    state,
    currentSection,
    setCurrentSection,
    setAnswer,
    getAnswer,
    submitQuiz,
    resetQuiz,
    startQuiz,
    isStarted,
    getScore,
    getSectionProgress,
    getSectionTimings,
    getTotalTime,
  }), [state, currentSection, setCurrentSection, setAnswer, getAnswer, submitQuiz, resetQuiz, startQuiz, isStarted, getScore, getSectionProgress, getSectionTimings, getTotalTime]);

  return (
    <QuizContext.Provider value={value}>
      {children}
    </QuizContext.Provider>
  );
}

export function useQuiz() {
  const context = useContext(QuizContext);
  if (!context) throw new Error('useQuiz must be used within QuizProvider');
  return context;
}
