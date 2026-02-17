import React, { createContext, useContext, useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { sections, type Section } from '@/data/questions';

export interface StudentInfo {
  name: string;
  grade: string;
}

interface QuizState {
  currentSectionIndex: number;
  answers: Record<string, string | number>;
  submitted: boolean;
  startTime: number | null;
  endTime: number | null;
}

interface QuizContextType {
  state: QuizState;
  studentInfo: StudentInfo | null;
  setStudentInfo: (info: StudentInfo) => void;
  currentSection: Section;
  setCurrentSection: (index: number) => void;
  setAnswer: (sectionId: string, questionId: number, answer: string | number) => void;
  getAnswer: (sectionId: string, questionId: number) => string | number | undefined;
  submitQuiz: () => void;
  resetQuiz: () => void;
  startQuiz: () => void;
  isStarted: boolean;
  getScore: () => { correct: number; total: number; bySection: Record<string, { correct: number; total: number }> };
  getSectionProgress: (sectionId: string) => { answered: number; total: number };
  getSectionTimings: () => Record<string, number>;
  getTotalTime: () => number;
}

const QuizContext = createContext<QuizContextType | null>(null);

// Build a composite key for answers: "sectionId:questionId"
function answerKey(sectionId: string, questionId: number): string {
  return `${sectionId}:${questionId}`;
}

export function QuizProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<QuizState>({
    currentSectionIndex: 0,
    answers: {},
    submitted: false,
    startTime: null,
    endTime: null,
  });
  const [isStarted, setIsStarted] = useState(false);
  const [studentInfo, setStudentInfoState] = useState<StudentInfo | null>(null);

  const sectionTimingsRef = useRef<Record<string, number>>({});
  const sectionEnteredAtRef = useRef<number | null>(null);
  const currentSectionIdRef = useRef<string>(sections[0]?.id || '');

  const currentSection = sections[state.currentSectionIndex];

  useEffect(() => {
    if (!isStarted || state.submitted) return;

    const now = Date.now();
    if (sectionEnteredAtRef.current !== null && currentSectionIdRef.current) {
      const elapsed = now - sectionEnteredAtRef.current;
      sectionTimingsRef.current[currentSectionIdRef.current] =
        (sectionTimingsRef.current[currentSectionIdRef.current] || 0) + elapsed;
    }

    currentSectionIdRef.current = currentSection?.id || '';
    sectionEnteredAtRef.current = now;
  }, [state.currentSectionIndex, isStarted, state.submitted]);

  const setStudentInfo = useCallback((info: StudentInfo) => {
    setStudentInfoState(info);
  }, []);

  const setCurrentSection = useCallback((index: number) => {
    setState(prev => ({ ...prev, currentSectionIndex: index }));
  }, []);

  const setAnswer = useCallback((sectionId: string, questionId: number, answer: string | number) => {
    setState(prev => ({
      ...prev,
      answers: { ...prev.answers, [answerKey(sectionId, questionId)]: answer },
    }));
  }, []);

  const getAnswer = useCallback((sectionId: string, questionId: number) => {
    return state.answers[answerKey(sectionId, questionId)];
  }, [state.answers]);

  const submitQuiz = useCallback(() => {
    const now = Date.now();
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
    setStudentInfoState(null);
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
        total++;
        bySection[section.id].total++;
        const answer = state.answers[answerKey(section.id, q.id)];

        if (answer === undefined || answer === '') continue;

        let isCorrect = false;

        if (q.type === 'mcq' || q.type === 'picture-mcq' || q.type === 'listening-mcq') {
          isCorrect = Number(answer) === q.correctAnswer;
        } else if (q.type === 'fill-blank') {
          isCorrect = String(answer).trim().toLowerCase() === q.correctAnswer.trim().toLowerCase();
        } else if (q.type === 'wordbank-fill') {
          isCorrect = String(answer).trim().toLowerCase() === q.correctAnswer.trim().toLowerCase();
        } else if (q.type === 'story-fill') {
          const userAnswer = String(answer).trim().toLowerCase();
          isCorrect = userAnswer === q.correctAnswer.trim().toLowerCase();
          if (!isCorrect && q.acceptableAnswers) {
            isCorrect = q.acceptableAnswers.some(a => userAnswer === a.trim().toLowerCase());
          }
        }

        if (isCorrect) {
          correct++;
          bySection[section.id].correct++;
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
      const answer = state.answers[answerKey(sectionId, q.id)];
      if (answer !== undefined && answer !== '') {
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
    studentInfo,
    setStudentInfo,
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
  }), [state, studentInfo, setStudentInfo, currentSection, setCurrentSection, setAnswer, getAnswer, submitQuiz, resetQuiz, startQuiz, isStarted, getScore, getSectionProgress, getSectionTimings, getTotalTime]);

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
