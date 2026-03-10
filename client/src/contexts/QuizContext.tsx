import { createContext, useContext, useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { PAPER_SUBJECT_ORDER, papers as staticPapers, type Paper, type PaperSubject, type Section, type Question } from '@/data/papers';
import { useLocalAuth } from '@/hooks/useLocalAuth';
import { trpc } from '@/lib/trpc';
import { blueprintToPaper } from '@shared/blueprintToPaper';
import type { ManualPaperBlueprint } from '@shared/manualPaperBlueprint';

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

interface PersistedQuizSession {
  version: 1;
  username: string;
  selectedPaperId: string | null;
  state: QuizState;
  isStarted: boolean;
  studentInfo: StudentInfo | null;
}

interface QuizContextType {
  state: QuizState;
  studentInfo: StudentInfo | null;
  setStudentInfo: (info: StudentInfo) => void;
  // Paper selection
  selectedPaper: Paper | null;
  selectPaper: (paperId: string) => void;
  papers: Paper[];
  // Current section
  currentSection: Section;
  sections: Section[];
  setCurrentSection: (index: number) => void;
  setAnswer: (sectionId: string, questionId: number, answer: string | number) => void;
  getAnswer: (sectionId: string, questionId: number) => string | number | undefined;
  submitQuiz: () => void;
  resetQuiz: () => void;
  startQuiz: () => void;
  isStarted: boolean;
  isRestoringSession: boolean;
  getScore: () => { correct: number; total: number; bySection: Record<string, { correct: number; total: number }> };
  getSectionProgress: (sectionId: string) => { answered: number; total: number };
  getSectionTimings: () => Record<string, number>;
  getTotalTime: () => number;
}

const QuizContext = createContext<QuizContextType | null>(null);
const QUIZ_SESSION_STORAGE_KEY = 'pureon_assessment_quiz_session_v1';

function createInitialQuizState(): QuizState {
  return {
    currentSectionIndex: 0,
    answers: {},
    submitted: false,
    startTime: null,
    endTime: null,
  };
}

function hasMeaningfulQuizState(session: {
  selectedPaperId: string | null;
  studentInfo: StudentInfo | null;
  state: QuizState;
  isStarted: boolean;
}) {
  return Boolean(
    session.selectedPaperId ||
    session.isStarted ||
    session.studentInfo ||
    session.state.submitted ||
    session.state.startTime ||
    session.state.endTime ||
    Object.keys(session.state.answers).length,
  );
}

function readPersistedQuizSession(): PersistedQuizSession | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(QUIZ_SESSION_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<PersistedQuizSession>;
    if (parsed.version !== 1 || typeof parsed.username !== 'string') return null;

    return {
      version: 1,
      username: parsed.username,
      selectedPaperId: typeof parsed.selectedPaperId === 'string' ? parsed.selectedPaperId : null,
      state: {
        currentSectionIndex: typeof parsed.state?.currentSectionIndex === 'number' ? parsed.state.currentSectionIndex : 0,
        answers: parsed.state?.answers && typeof parsed.state.answers === 'object' ? parsed.state.answers : {},
        submitted: Boolean(parsed.state?.submitted),
        startTime: typeof parsed.state?.startTime === 'number' ? parsed.state.startTime : null,
        endTime: typeof parsed.state?.endTime === 'number' ? parsed.state.endTime : null,
      },
      isStarted: Boolean(parsed.isStarted),
      studentInfo: parsed.studentInfo && typeof parsed.studentInfo === 'object'
        ? {
            name: typeof parsed.studentInfo.name === 'string' ? parsed.studentInfo.name : '',
            grade: typeof parsed.studentInfo.grade === 'string' ? parsed.studentInfo.grade : '',
          }
        : null,
    };
  } catch {
    return null;
  }
}

function writePersistedQuizSession(session: PersistedQuizSession) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(QUIZ_SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // ignore storage failures in private mode or restricted browsers
  }
}

function clearPersistedQuizSession() {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.removeItem(QUIZ_SESSION_STORAGE_KEY);
  } catch {
    // ignore
  }
}

function answerKey(sectionId: string, questionId: number): string {
  return `${sectionId}:${questionId}`;
}

export function QuizProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useLocalAuth();
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null);
  const [state, setState] = useState<QuizState>(createInitialQuizState);
  const [isStarted, setIsStarted] = useState(false);
  const [studentInfo, setStudentInfoState] = useState<StudentInfo | null>(null);
  const [isRestoringSession, setIsRestoringSession] = useState(true);

  const sectionTimingsRef = useRef<Record<string, number>>({});
  const sectionEnteredAtRef = useRef<number | null>(null);
  const currentSectionIdRef = useRef<string>('');
  const restoredSessionOwnerRef = useRef<string | null>(null);
  const allowedSubjects = useMemo(() => {
    const subjects = (user?.allowedSubjects ?? []).filter((subject): subject is PaperSubject =>
      PAPER_SUBJECT_ORDER.includes(subject as PaperSubject),
    );

    return subjects.length > 0 ? subjects : PAPER_SUBJECT_ORDER;
  }, [user?.allowedSubjects]);
  // Fetch manual papers from database
  const { data: manualPapersData } = trpc.papers.listManualPapers.useQuery(undefined, {
    staleTime: 30_000,
  });

  const allPapers = useMemo(() => {
    const filteredStatic = staticPapers.filter((paper) => allowedSubjects.includes(paper.subject));

    // Convert manual papers from DB into Paper format
    const manualPapers: Paper[] = (manualPapersData ?? []).map((mp) => {
      try {
        const subject = PAPER_SUBJECT_ORDER.includes(mp.subject as PaperSubject)
          ? (mp.subject as PaperSubject)
          : "english";
        if (!allowedSubjects.includes(subject)) {
          return null;
        }

        const blueprint: ManualPaperBlueprint = JSON.parse(mp.blueprintJson);
        const converted = blueprintToPaper(blueprint, {
          subject,
          category: mp.category,
        });
        return {
          ...converted,
          id: mp.paperId,
          subject,
          category: (mp.category || 'assessment') as any,
          sections: converted.sections as unknown as Section[],
        } as Paper;
      } catch {
        return null;
      }
    }).filter((p): p is Paper => p !== null);

    return [...filteredStatic, ...manualPapers];
  }, [allowedSubjects, manualPapersData]);

  const currentSections = selectedPaper?.sections || [];
  const currentSection = currentSections[state.currentSectionIndex] || currentSections[0];

  useEffect(() => {
    if (authLoading) {
      setIsRestoringSession(true);
      return;
    }

    const restoreOwner = user?.username ?? '__guest__';
    if (restoredSessionOwnerRef.current !== restoreOwner) {
      setIsRestoringSession(true);
    }
  }, [authLoading, user?.username]);

  useEffect(() => {
    if (authLoading) return;

    const restoreOwner = user?.username ?? '__guest__';
    if (restoredSessionOwnerRef.current === restoreOwner) return;
    restoredSessionOwnerRef.current = restoreOwner;

    if (!user?.username) {
      setIsRestoringSession(false);
      return;
    }

    const persisted = readPersistedQuizSession();
    if (!persisted || persisted.username !== user.username) {
      if (persisted && persisted.username !== user.username) {
        clearPersistedQuizSession();
      }
      setIsRestoringSession(false);
      return;
    }

    const restoredPaper = persisted.selectedPaperId
      ? allPapers.find((paper) => paper.id === persisted.selectedPaperId)
      : null;
    const maxSectionIndex = restoredPaper ? Math.max(restoredPaper.sections.length - 1, 0) : 0;
    const restoredState: QuizState = {
      currentSectionIndex: Math.min(Math.max(persisted.state.currentSectionIndex, 0), maxSectionIndex),
      answers: persisted.state.answers,
      submitted: persisted.state.submitted,
      startTime: persisted.state.startTime,
      endTime: persisted.state.endTime,
    };

    setSelectedPaper(restoredPaper ?? null);
    setState(restoredState);
    setStudentInfoState(persisted.studentInfo);
    setIsStarted(Boolean(restoredPaper && (persisted.isStarted || persisted.state.submitted)));
    currentSectionIdRef.current = restoredPaper?.sections[restoredState.currentSectionIndex]?.id || restoredPaper?.sections[0]?.id || '';
    sectionEnteredAtRef.current = restoredPaper && !persisted.state.submitted && (persisted.isStarted || persisted.state.submitted)
      ? Date.now()
      : null;
    setIsRestoringSession(false);
  }, [allPapers, authLoading, user?.username]);

  useEffect(() => {
    if (authLoading || isRestoringSession) return;

    if (!user?.username) {
      clearPersistedQuizSession();
      return;
    }

    const session: PersistedQuizSession = {
      version: 1,
      username: user.username,
      selectedPaperId: selectedPaper?.id ?? null,
      state,
      isStarted,
      studentInfo,
    };

    if (!hasMeaningfulQuizState(session)) {
      clearPersistedQuizSession();
      return;
    }

    writePersistedQuizSession(session);
  }, [authLoading, isRestoringSession, user?.username, selectedPaper?.id, state, isStarted, studentInfo]);

  useEffect(() => {
    if (!selectedPaper) return;

    const stillAllowed = allPapers.some((paper) => paper.id === selectedPaper.id);
    if (stillAllowed) return;

    setSelectedPaper(null);
    setIsStarted(false);
    setStudentInfoState(null);
    sectionTimingsRef.current = {};
    sectionEnteredAtRef.current = null;
    currentSectionIdRef.current = '';
    clearPersistedQuizSession();
    setState(createInitialQuizState());
  }, [allPapers, selectedPaper]);

  useEffect(() => {
    if (!isStarted || state.submitted || !selectedPaper) return;

    const now = Date.now();
    if (sectionEnteredAtRef.current !== null && currentSectionIdRef.current) {
      const elapsed = now - sectionEnteredAtRef.current;
      sectionTimingsRef.current[currentSectionIdRef.current] =
        (sectionTimingsRef.current[currentSectionIdRef.current] || 0) + elapsed;
    }

    currentSectionIdRef.current = currentSection?.id || '';
    sectionEnteredAtRef.current = now;
  }, [state.currentSectionIndex, isStarted, state.submitted, selectedPaper]);

  const selectPaper = useCallback((paperId: string) => {
    if (!paperId) {
      setSelectedPaper(null);
      return;
    }
    const paper = allPapers.find(p => p.id === paperId);
    if (paper) {
      setSelectedPaper(paper);
      currentSectionIdRef.current = paper.sections[0]?.id || '';
    }
  }, [allPapers]);

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
    setSelectedPaper(null);
    setStudentInfoState(null);
    sectionTimingsRef.current = {};
    sectionEnteredAtRef.current = null;
    currentSectionIdRef.current = '';
    clearPersistedQuizSession();
    setState(createInitialQuizState());
  }, []);

  const startQuiz = useCallback(() => {
    setIsStarted(true);
    const now = Date.now();
    sectionEnteredAtRef.current = now;
    currentSectionIdRef.current = currentSections[0]?.id || '';
    setState(prev => ({ ...prev, startTime: now }));
  }, [currentSections]);

  const getScore = useCallback(() => {
    let correct = 0;
    let total = 0;
    const bySection: Record<string, { correct: number; total: number }> = {};

    for (const section of currentSections) {
      bySection[section.id] = { correct: 0, total: 0 };
      for (const q of section.questions) {
        total++;
        bySection[section.id].total++;
        const answer = state.answers[answerKey(section.id, q.id)];

        if (answer === undefined || answer === '') continue;

        let isCorrect = false;

        if (q.type === 'mcq' || q.type === 'picture-mcq' || q.type === 'listening-mcq') {
          // Handle both numeric index and string correctAnswer (e.g. yes/no MCQ)
          if (typeof q.correctAnswer === 'number') {
            isCorrect = Number(answer) === q.correctAnswer;
          } else {
            // Answer is stored as index (number), convert to option text for comparison
            const ansIdx = Number(answer);
            const rawOpt = (!isNaN(ansIdx) && q.options && q.options[ansIdx]) ? q.options[ansIdx] : null;
            const userOptionText = rawOpt ? (typeof rawOpt === 'string' ? rawOpt : (rawOpt.text || rawOpt.label || '')) : String(answer);
            isCorrect = userOptionText.trim().toLowerCase() === String(q.correctAnswer).trim().toLowerCase();
          }
        } else if (q.type === 'fill-blank') {
          isCorrect = String(answer).trim().toLowerCase() === q.correctAnswer.trim().toLowerCase();
        } else if (q.type === 'wordbank-fill') {
          isCorrect = String(answer).trim().toLowerCase() === q.correctAnswer.trim().toLowerCase();
        } else if (q.type === 'story-fill') {
          const userAnswer = String(answer).trim().toLowerCase();
          isCorrect = userAnswer === q.correctAnswer.trim().toLowerCase();
          if (!isCorrect && q.acceptableAnswers) {
            isCorrect = q.acceptableAnswers.some((a: string) => userAnswer === a.trim().toLowerCase());
          }
        } else if (q.type === 'open-ended') {
          // open-ended with a correctAnswer: compare text (supports / for multiple acceptable answers)
          if (q.correctAnswer) {
            const userAnswer = String(answer).trim().toLowerCase();
            const acceptables = String(q.correctAnswer).split('/').map((a: string) => a.trim().toLowerCase());
            isCorrect = acceptables.includes(userAnswer);
          }
          // Speaking (no correctAnswer) is excluded from auto-scoring
        } else if (q.type === 'true-false') {
          // true-false scoring: compare JSON answers
          try {
            const userAnswers = typeof answer === 'string' ? JSON.parse(answer) : answer;
            if (q.statements) {
              let allCorrect = true;
              for (const stmt of q.statements) {
                if (userAnswers[stmt.label] !== stmt.isTrue) allCorrect = false;
              }
              isCorrect = allCorrect;
            }
          } catch { /* skip */ }
        } else if (q.type === 'checkbox') {
          // Checkbox scoring handled separately
        }

        if (isCorrect) {
          correct++;
          bySection[section.id].correct++;
        }
      }
    }

    return { correct, total, bySection };
  }, [state.answers, currentSections]);

  const getSectionProgress = useCallback((sectionId: string) => {
    const section = currentSections.find((s: Section) => s.id === sectionId);
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
  }, [state.answers, currentSections]);

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
    selectedPaper,
    selectPaper,
    papers: allPapers,
    currentSection,
    sections: currentSections,
    setCurrentSection,
    setAnswer,
    getAnswer,
    submitQuiz,
    resetQuiz,
    startQuiz,
    isStarted,
    isRestoringSession,
    getScore,
    getSectionProgress,
    getSectionTimings,
    getTotalTime,
  }), [state, studentInfo, setStudentInfo, selectedPaper, selectPaper, allPapers, currentSection, currentSections, setCurrentSection, setAnswer, getAnswer, submitQuiz, resetQuiz, startQuiz, isStarted, isRestoringSession, getScore, getSectionProgress, getSectionTimings, getTotalTime]);

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
