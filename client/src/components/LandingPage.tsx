import { useQuiz } from '@/contexts/QuizContext';
import PureonFooter from '@/components/PureonFooter';
import { PureonBrand } from '@/components/PureonBrand';
import StudentWorkspaceTopBar from '@/components/StudentWorkspaceTopBar';
import { Button } from '@/components/ui/button';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import StudentInfoForm from '@/components/StudentInfoForm';
import StudentPracticePage from '@/components/StudentPracticePage';
import { PAPER_CATEGORY_LABELS, PAPER_SUBJECT_LABELS, PAPER_SUBJECT_ORDER, type Paper, type PaperSubject, type Section } from '@/data/papers';
import { motion } from 'framer-motion';
import { BookOpen, PenTool, FileText, ArrowRight, Headphones, Pencil, ArrowLeft, GraduationCap, LogOut, Sparkles, Languages, Calculator, BookText } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, XAxis } from 'recharts';
import { Link, useLocation } from 'wouter';
import { useLocalAuth } from '@/hooks/useLocalAuth';
import { trpc } from '@/lib/trpc';
import { getPaperReadinessMessage, isPaperReadyToStart } from '@/lib/paperReadiness';
import { buildTagSystemPapers } from '@/lib/tagSystemPapers';
import type { EnglishExamTagSystem, SubjectTagSystem } from '@shared/englishQuestionTags';
import TeacherToolsLayout from '@/components/TeacherToolsLayout';
import type { ManualPaperBlueprint } from '@shared/manualPaperBlueprint';

const DASHBOARD_HERO_IMAGE = '/teacher-workspace-hero.svg';
const ENGLISH_DASHBOARD_HERO_IMAGE = '/teacher-english-hero.svg';
const MATH_DASHBOARD_HERO_IMAGE = '/teacher-math-hero.svg';
const VOCABULARY_DASHBOARD_HERO_IMAGE = '/teacher-vocabulary-hero.svg';

const paperIconPools: Record<PaperSubject, Array<{ glyph: string; surface: string }>> = {
  english: [
    { glyph: '📘', surface: 'bg-[#E8F1FB]' },
    { glyph: '📗', surface: 'bg-[#EDF7EE]' },
    { glyph: '📕', surface: 'bg-[#FCEEEE]' },
    { glyph: '🎧', surface: 'bg-[#EFF1FF]' },
    { glyph: '📝', surface: 'bg-[#FFF5E6]' },
    { glyph: '🗣️', surface: 'bg-[#F5EEFF]' },
  ],
  math: [
    { glyph: '🧮', surface: 'bg-[#EAF8F4]' },
    { glyph: '📐', surface: 'bg-[#EEF7FB]' },
    { glyph: '📏', surface: 'bg-[#F1F8EC]' },
    { glyph: '📊', surface: 'bg-[#FFF5E8]' },
    { glyph: '📈', surface: 'bg-[#EEF4FF]' },
    { glyph: '🔢', surface: 'bg-[#F2F7FF]' },
  ],
  vocabulary: [
    { glyph: '📚', surface: 'bg-[#FFF6E8]' },
    { glyph: '📖', surface: 'bg-[#FFF1E8]' },
    { glyph: '🔤', surface: 'bg-[#EEF6FF]' },
    { glyph: '📝', surface: 'bg-[#FFF0F0]' },
    { glyph: '🏷️', surface: 'bg-[#FFF8E1]' },
    { glyph: '🗂️', surface: 'bg-[#EEF8F0]' },
  ],
};

function getStableIconIndex(seed: string, length: number) {
  let hash = 0;
  for (const char of seed) {
    hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
  }
  return length > 0 ? hash % length : 0;
}

function getPaperDisplayIcon(paper: Paper) {
  const pool = paperIconPools[paper.subject];
  if (!pool || pool.length === 0) {
    return {
      glyph: paper.icon || '📘',
      surface: 'bg-[#1E3A5F]/5',
    };
  }

  return pool[getStableIconIndex(`${paper.subject}:${paper.id}:${paper.title}`, pool.length)];
}

function getPaperHeroImage(subject: PaperSubject) {
  if (subject === 'english') return ENGLISH_DASHBOARD_HERO_IMAGE;
  if (subject === 'math') return MATH_DASHBOARD_HERO_IMAGE;
  if (subject === 'vocabulary') return VOCABULARY_DASHBOARD_HERO_IMAGE;
  return DASHBOARD_HERO_IMAGE;
}

function getPaperHeroAlt(subject: PaperSubject) {
  if (subject === 'english') return 'English Learning Illustration';
  if (subject === 'math') return 'Math Learning Illustration';
  if (subject === 'vocabulary') return 'Vocabulary Learning Illustration';
  return 'Learning Illustration';
}

function normalizeSummaryText(value?: string) {
  return value?.trim().replace(/\s+/g, ' ').toLowerCase() || '';
}

function formatDashboardDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleDateString('en-SG', {
    month: 'short',
    day: 'numeric',
  });
}

const sectionIcons: Record<string, React.ReactNode> = {
  vocabulary: <BookText className="w-6 h-6" />,
  grammar: <PenTool className="w-6 h-6" />,
  listening: <Headphones className="w-6 h-6" />,
  reading: <FileText className="w-6 h-6" />,
  writing: <Pencil className="w-6 h-6" />,
};

const iconBgColors: Record<string, string> = {
  vocabulary: 'bg-emerald-100 text-emerald-700',
  grammar: 'bg-amber-100 text-amber-700',
  listening: 'bg-purple-100 text-purple-700',
  reading: 'bg-sky-100 text-sky-700',
  writing: 'bg-orange-100 text-orange-700',
};

const subjectModuleConfig: Record<PaperSubject, { icon: React.ReactNode; focus: string[] }> = {
  english: {
    icon: <Languages className="w-7 h-7" />,
    focus: ['Reading', 'Writing', 'Speaking'],
  },
  math: {
    icon: <Calculator className="w-7 h-7" />,
    focus: ['Calculation', 'Reasoning', 'Application'],
  },
  vocabulary: {
    icon: <BookText className="w-7 h-7" />,
    focus: ['Meaning', 'Memory', 'Drills'],
  },
};

const subjectHeroCopy: Record<PaperSubject, { badge: string; highlight: string; description: string }> = {
  english: {
    badge: "Teacher Workspace · English",
    highlight: "English",
    description: "Review reading, writing, speaking, grammar, and vocabulary papers from one focused English workspace.",
  },
  math: {
    badge: "Teacher Workspace · Math",
    highlight: "Math",
    description: "Review problem solving, calculation, reasoning, and future math papers from one focused math workspace.",
  },
  vocabulary: {
    badge: "Teacher Workspace · Vocabulary",
    highlight: "Vocabulary",
    description: "Review word study, meaning match, memorization, and vocabulary drills from one focused vocabulary workspace.",
  },
};

type StudentTagSystemConfig = EnglishExamTagSystem | SubjectTagSystem;

type StudentQuestionBankSource = {
  paperId: string;
  title: string;
  blueprint: ManualPaperBlueprint;
};

const teacherCoverageChartConfig = {
  ready: {
    label: 'Ready',
    color: 'var(--pureon-teal)',
  },
  draft: {
    label: 'Draft',
    color: 'var(--pureon-gold)',
  },
} satisfies ChartConfig;

const teacherTrendChartConfig = {
  submissions: {
    label: 'Submissions',
    color: 'var(--pureon-blue)',
  },
} satisfies ChartConfig;

const teacherReportStatusChartConfig = {
  completed: {
    label: 'Completed',
    color: 'var(--pureon-teal)',
  },
  pending: {
    label: 'Pending',
    color: 'var(--pureon-gold)',
  },
  raw: {
    label: 'Raw',
    color: 'var(--pureon-muted)',
  },
} satisfies ChartConfig;

function TeacherWorkspaceTopBar() {
  const { user, isAuthenticated, isTeacher, logout } = useLocalAuth();
  const [location] = useLocation();
  const displayName = user?.displayName || user?.username || "";

  return (
    <div className="pureon-topbar">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:min-h-[84px] lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <PureonBrand />
        {isAuthenticated && user ? (
          <div className="flex items-center gap-3 self-start lg:self-auto">
            {!isTeacher ? (
              <Link
                href="/mistake-book"
                className={`inline-flex items-center gap-2 border px-4 py-2 text-[13px] transition-colors ${
                  location === "/mistake-book"
                    ? "border-[var(--pureon-teal)] bg-[var(--pureon-teal)] text-[var(--pureon-paper)]"
                    : "border-[var(--pureon-rule)] bg-transparent text-[var(--pureon-muted)] hover:border-[var(--pureon-teal)] hover:text-[var(--pureon-teal)]"
                }`}
              >
                <BookOpen className="h-4 w-4" />
                <span>Mistake Book</span>
              </Link>
            ) : null}
            <div className="inline-flex items-center gap-3 border border-[var(--pureon-rule)] bg-[rgba(245,239,224,0.7)] px-3 py-2 text-[13px] text-[var(--pureon-muted)]">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--pureon-gold),var(--pureon-blue))] font-[family-name:var(--font-display)] text-[11px] font-semibold text-[var(--pureon-paper)]">
                {displayName.slice(0, 2).toUpperCase()}
              </div>
              <span className="font-[family-name:var(--font-body)] text-[var(--pureon-teal)]">{displayName}</span>
            </div>
            <button
              onClick={logout}
              className="inline-flex items-center gap-2 border border-[var(--pureon-rule)] bg-transparent px-4 py-2 text-[13px] text-[var(--pureon-muted)] transition-colors hover:border-[var(--pureon-teal)] hover:text-[var(--pureon-teal)]"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign out</span>
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ========== PAPER SELECTION PAGE ==========

function PaperSelectionPage({
  onSelectPaper,
  studentMode = 'test',
  onStudentModeChange,
}: {
  onSelectPaper: (paperId: string) => void;
  studentMode?: 'test' | 'practice';
  onStudentModeChange?: (mode: 'test' | 'practice') => void;
}) {
  const { papers, previewPaper } = useQuiz();
  const { user, isTeacher } = useLocalAuth();
  const [, navigate] = useLocation();
  const [selectedSubject, setSelectedSubject] = useState<PaperSubject | null>(null);
  const questionBankQuery = trpc.papers.listQuestionBankPapers.useQuery(undefined, {
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    enabled: !isTeacher,
  });
  const englishTagSystemsQuery = trpc.papers.getEnglishTagSystems.useQuery(undefined, {
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    enabled: !isTeacher,
  });
  const mathTagSystemsQuery = trpc.papers.getMathTagSystems.useQuery(undefined, {
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    enabled: !isTeacher,
  });
  const vocabularyTagSystemsQuery = trpc.papers.getVocabularyTagSystems.useQuery(undefined, {
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    enabled: !isTeacher,
  });
  const visiblePapers = useMemo(
    () => papers.filter((paper) => !paper.hiddenFromStudentSelection),
    [papers],
  );
  const allowedSubjects = useMemo(() => {
    const subjects = (user?.allowedSubjects ?? []).filter((subject): subject is PaperSubject =>
      PAPER_SUBJECT_ORDER.includes(subject as PaperSubject),
    );

    return subjects.length > 0 ? subjects : PAPER_SUBJECT_ORDER;
  }, [user?.allowedSubjects]);
  const hasSingleSubjectAccess = allowedSubjects.length === 1;
  const showTeacherModules = isTeacher && !hasSingleSubjectAccess && selectedSubject === null;
  const showStudentModules = !isTeacher && !hasSingleSubjectAccess && selectedSubject === null;
  const activeSubject = hasSingleSubjectAccess ? allowedSubjects[0] : selectedSubject;
  const showTeacherSubjectPage = isTeacher && activeSubject !== null;
  const dashboardHeroImage = activeSubject ? getPaperHeroImage(activeSubject) : DASHBOARD_HERO_IMAGE;
  const dashboardHeroAlt = activeSubject
    ? `${PAPER_SUBJECT_LABELS[activeSubject]} workspace overview`
    : isTeacher
      ? 'Teacher workspace overview'
      : 'Student workspace overview';
  const visibleSubjectModules = useMemo(
    () => PAPER_SUBJECT_ORDER.filter((subject) => allowedSubjects.includes(subject)),
    [allowedSubjects],
  );
  const filteredPapers = useMemo(
    () => (
      activeSubject === null
        ? []
        : visiblePapers.filter((paper) => paper.subject === activeSubject)
    ),
    [visiblePapers, activeSubject],
  );
  const tagSystemsBySubject = useMemo<Record<PaperSubject, StudentTagSystemConfig[]>>(
    () => ({
      english: englishTagSystemsQuery.data ?? [],
      math: mathTagSystemsQuery.data ?? [],
      vocabulary: vocabularyTagSystemsQuery.data ?? [],
    }),
    [
      englishTagSystemsQuery.data,
      mathTagSystemsQuery.data,
      vocabularyTagSystemsQuery.data,
    ],
  );
  const questionBankSourceBySubject = useMemo<Record<PaperSubject, StudentQuestionBankSource[]>>(
    () => (
      (questionBankQuery.data ?? []).reduce<Record<PaperSubject, StudentQuestionBankSource[]>>((accumulator, paper) => {
        const subject = PAPER_SUBJECT_ORDER.includes(paper.subject as PaperSubject)
          ? (paper.subject as PaperSubject)
          : null;
        if (!subject || !allowedSubjects.includes(subject)) {
          return accumulator;
        }

        try {
          accumulator[subject].push({
            paperId: paper.paperId,
            title: paper.title,
            blueprint: JSON.parse(paper.blueprintJson) as ManualPaperBlueprint,
          });
        } catch {
          return accumulator;
        }

        return accumulator;
      }, {
        english: [],
        math: [],
        vocabulary: [],
      })
    ),
    [allowedSubjects, questionBankQuery.data],
  );
  const assessmentSystemConfigByPaperId = useMemo(() => {
    const configMap = new Map<string, StudentTagSystemConfig>();
    (Object.entries(tagSystemsBySubject) as Array<[PaperSubject, StudentTagSystemConfig[]]>).forEach(([subject, systems]) => {
      systems
        .filter((system) => system.published !== false && system.systemMode === 'assessment')
        .forEach((system) => {
          configMap.set(`tag-system-${subject}-${system.id}`, system);
        });
    });
    return configMap;
  }, [tagSystemsBySubject]);
  useEffect(() => {
    if (hasSingleSubjectAccess) {
      setSelectedSubject(allowedSubjects[0]);
      return;
    }

    if (isTeacher) {
      if (selectedSubject && !allowedSubjects.includes(selectedSubject)) {
        setSelectedSubject(null);
      }
      return;
    }

    if (selectedSubject && !allowedSubjects.includes(selectedSubject)) {
      setSelectedSubject(null);
    }
  }, [allowedSubjects, hasSingleSubjectAccess, isTeacher, selectedSubject]);
  const handleStudentPaperSelect = (paper: Paper) => {
    const systemConfig = assessmentSystemConfigByPaperId.get(paper.id);
    if (systemConfig && paper.category === 'assessment' && paper.isGeneratedPaper) {
      const regeneratedPaper = buildTagSystemPapers(
        paper.subject,
        [systemConfig],
        questionBankSourceBySubject[paper.subject],
      )[0];

      previewPaper({
        ...(regeneratedPaper || paper),
        isEphemeralPaper: true,
      });
      return;
    }

    onSelectPaper(paper.id);
  };

  const currentTeacherSubject = showTeacherSubjectPage && activeSubject
    ? activeSubject
    : null;
  const compactTeacherWorkspaceHome = showTeacherModules;
  const heroWorkspaceSubjects = useMemo(() => {
    const priority: PaperSubject[] = ['vocabulary', 'english', 'math'];
    return priority.filter((subject) => visibleSubjectModules.includes(subject));
  }, [visibleSubjectModules]);
  const activeSubjectHeroCopy = currentTeacherSubject
    ? subjectHeroCopy[currentTeacherSubject]
    : null;
  const heroBadgeText = activeSubjectHeroCopy?.badge ?? 'Teacher Workspace · English / Math / Vocabulary';
  const heroHighlightText = activeSubjectHeroCopy?.highlight ?? 'Assessments';
  const heroTrailingText = activeSubjectHeroCopy ? 'Assessments' : 'by Subject';
  const heroDescription = activeSubjectHeroCopy?.description
    ?? 'Open a subject workspace to review papers, update content, manage what students see, and access your intake, question bank, and paper management tools.';
  const heroTitleFontStyle = { fontFamily: '"Helvetica Neue", Arial, sans-serif' } as const;
  const subjectHeroMainTitleClass = "font-extrabold tracking-tight leading-[0.98] text-[3rem] sm:text-[3.45rem] lg:text-[4.05rem]";
  const vocabularyHeroMainTitleClass = "font-extrabold tracking-[-0.015em] leading-[0.98] text-[3rem] sm:text-[3.45rem] lg:text-[3.82rem] xl:text-[3.95rem]";
  const heroTitleStackClass = "mt-2 space-y-0 sm:mt-3 sm:space-y-1";
  const isVocabularySubjectHero = currentTeacherSubject === 'vocabulary';
  const shouldCenterSubjectHero = showTeacherSubjectPage && !compactTeacherWorkspaceHome;
  const heroShellClass = compactTeacherWorkspaceHome
    ? 'lg:flex lg:min-h-full lg:w-full lg:items-center'
    : shouldCenterSubjectHero
      ? 'lg:flex lg:min-h-[560px] lg:items-center'
      : '';
  const heroBodySpacingClass = compactTeacherWorkspaceHome
    ? 'py-8 lg:py-10'
    : shouldCenterSubjectHero
      ? 'py-12 lg:py-16'
      : 'pt-12 pb-20';
  const heroGridOffsetClass = shouldCenterSubjectHero ? '-translate-y-5 sm:-translate-y-6 lg:-translate-y-7' : '';
  const heroImageOffsetClass = shouldCenterSubjectHero ? 'lg:translate-y-5' : '';
  const subjectHeroGridClass = compactTeacherWorkspaceHome
    ? 'items-center gap-7 lg:grid-cols-[minmax(0,0.9fr)_minmax(460px,0.96fr)]'
    : isVocabularySubjectHero
      ? 'items-start gap-8 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:items-center'
      : 'items-start gap-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-center';
  const subjectHeroTextClass = compactTeacherWorkspaceHome
    ? 'flex flex-col justify-center'
    : activeSubjectHeroCopy
      ? `lg:flex lg:min-h-full lg:flex-col lg:justify-center ${isVocabularySubjectHero ? 'lg:pl-4 lg:pr-4 xl:pl-6 xl:pr-6' : 'lg:pl-6 lg:pr-4 xl:pl-8'}`
      : undefined;
  const subjectHeroImageClass = compactTeacherWorkspaceHome
    ? 'mt-8 lg:mt-0 lg:self-center'
    : `hidden lg:flex lg:min-h-full lg:items-center lg:justify-end ${isVocabularySubjectHero ? 'lg:pl-1' : 'lg:pl-4'}`;
  const subjectHeroResolvedMainTitleClass = isVocabularySubjectHero ? vocabularyHeroMainTitleClass : subjectHeroMainTitleClass;
  const subjectHeroFirstLineClass = isVocabularySubjectHero
    ? 'flex flex-wrap items-baseline gap-x-3 gap-y-2 sm:gap-x-4 lg:flex-nowrap'
    : 'flex flex-wrap items-baseline gap-x-3 gap-y-2 sm:gap-x-4';
  const studentPagePapers = showStudentModules ? visiblePapers : filteredPapers;
  const studentAssessmentPapers = useMemo(
    () => studentPagePapers.filter((paper) => paper.isGeneratedPaper && paper.category === 'assessment'),
    [studentPagePapers],
  );
  const studentDirectPapers = useMemo(
    () => studentPagePapers.filter((paper) => !(paper.isGeneratedPaper && paper.category === 'assessment')),
    [studentPagePapers],
  );
  const studentTotalQuestions = useMemo(
    () => studentAssessmentPapers.reduce((sum, paper) => sum + (paper.configuredQuestionsCount ?? paper.totalQuestions), 0),
    [studentAssessmentPapers],
  );
  const studentRecentPapers = useMemo(
    () => [...studentAssessmentPapers, ...studentDirectPapers].slice(0, 4),
    [studentAssessmentPapers, studentDirectPapers],
  );
  const studentPrimaryActionPaper = (studentAssessmentPapers[0] ?? studentDirectPapers[0]) ?? null;
  const studentPageTitle = showStudentModules
    ? '测试模式'
    : activeSubject
      ? `${PAPER_SUBJECT_LABELS[activeSubject]}测试`
      : '我的测试';
  const studentPageEyebrow = showStudentModules
    ? `Test Mode · ${user?.displayName || user?.username || 'Student'}`
    : `Assessment Systems · ${activeSubject ? PAPER_SUBJECT_LABELS[activeSubject] : 'All Subjects'}`;
  const studentPageDescription = showStudentModules
    ? '测试模式会按老师配置的组卷体系随机生成整份试卷；如果老师单独分发了试卷，也会在这里一起显示。'
    : '先选学科，再从组卷体系里随机生成一套测试。';
  const teacherPrimarySubject = currentTeacherSubject ?? visibleSubjectModules[0] ?? allowedSubjects[0] ?? 'english';
  const teacherResultsQuery = trpc.results.list.useQuery(undefined, {
    enabled: isTeacher,
    staleTime: 30_000,
  });
  const teacherPagePapers = currentTeacherSubject ? filteredPapers : visiblePapers;
  const teacherCurrentQuestions = useMemo(
    () => teacherPagePapers.reduce((sum, paper) => sum + (paper.configuredQuestionsCount ?? paper.totalQuestions), 0),
    [teacherPagePapers],
  );
  const teacherCurrentSections = useMemo(
    () => teacherPagePapers.reduce((sum, paper) => sum + (paper.configuredSectionsCount ?? paper.sections.length), 0),
    [teacherPagePapers],
  );
  const teacherReadyCount = useMemo(
    () => visiblePapers.filter((paper) => isPaperReadyToStart(paper)).length,
    [visiblePapers],
  );
  const teacherDraftCount = Math.max(visiblePapers.length - teacherReadyCount, 0);
  const teacherSubjectOverview = useMemo(
    () => heroWorkspaceSubjects.map((subject) => {
      const papersForSubject = visiblePapers.filter((paper) => paper.subject === subject);
      const readyCount = papersForSubject.filter((paper) => isPaperReadyToStart(paper)).length;
      const draftCount = Math.max(papersForSubject.length - readyCount, 0);
      const sectionsCount = papersForSubject.reduce(
        (sum, paper) => sum + (paper.configuredSectionsCount ?? paper.sections.length),
        0,
      );
      const questionsCount = papersForSubject.reduce(
        (sum, paper) => sum + (paper.configuredQuestionsCount ?? paper.totalQuestions),
        0,
      );

      return {
        subject,
        papersCount: papersForSubject.length,
        readyCount,
        draftCount,
        sectionsCount,
        questionsCount,
      };
    }),
    [heroWorkspaceSubjects, visiblePapers],
  );
  const teacherResults = useMemo(
    () => (teacherResultsQuery.data ?? [])
      .filter((item) => !item.paperSubject || allowedSubjects.includes(item.paperSubject as PaperSubject))
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()),
    [allowedSubjects, teacherResultsQuery.data],
  );
  const teacherReadyRate = visiblePapers.length > 0
    ? Math.round((teacherReadyCount / visiblePapers.length) * 100)
    : 0;
  const teacherAverageScore = useMemo(() => {
    const scorableResults = teacherResults.filter((item) => item.totalQuestions > 0);
    if (scorableResults.length === 0) {
      return 0;
    }

    const totalPercentage = scorableResults.reduce((sum, item) => (
      sum + ((item.totalCorrect / item.totalQuestions) * 100)
    ), 0);

    return Math.round(totalPercentage / scorableResults.length);
  }, [teacherResults]);
  const teacherRecentSubmissionCount = useMemo(() => {
    const sevenDaysAgo = Date.now() - (6 * 24 * 60 * 60 * 1000);
    return teacherResults.filter((item) => new Date(item.createdAt).getTime() >= sevenDaysAgo).length;
  }, [teacherResults]);
  const teacherResultsBySubject = useMemo(() => {
    const counts: Record<PaperSubject, number> = {
      english: 0,
      math: 0,
      vocabulary: 0,
    };

    teacherResults.forEach((item) => {
      if (PAPER_SUBJECT_ORDER.includes(item.paperSubject as PaperSubject)) {
        counts[item.paperSubject as PaperSubject] += 1;
      }
    });

    return counts;
  }, [teacherResults]);
  const teacherCoverageChartData = useMemo(
    () => teacherSubjectOverview.map((item) => ({
      subject: PAPER_SUBJECT_LABELS[item.subject],
      ready: item.readyCount,
      draft: item.draftCount,
      papers: item.papersCount,
      questions: item.questionsCount,
      submissions: teacherResultsBySubject[item.subject],
    })),
    [teacherResultsBySubject, teacherSubjectOverview],
  );
  const teacherSubmissionTrend = useMemo(() => {
    return Array.from({ length: 7 }, (_, offset) => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (6 - offset));

      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const dayResults = teacherResults.filter((item) => {
        const createdAt = new Date(item.createdAt).getTime();
        return createdAt >= date.getTime() && createdAt < nextDate.getTime();
      });

      return {
        label: date.toLocaleDateString('en-SG', { month: 'short', day: 'numeric' }),
        submissions: dayResults.length,
      };
    });
  }, [teacherResults]);
  const teacherTrendHasData = teacherSubmissionTrend.some((item) => item.submissions > 0);
  const teacherReportStatusData = useMemo(() => {
    const completed = teacherResults.filter((item) => item.reportStatus === 'completed').length;
    const pending = teacherResults.filter((item) => item.reportStatus === 'pending-review').length;
    const raw = teacherResults.length - completed - pending;

    return [
      { key: 'completed', label: 'Completed', value: completed, fill: 'var(--color-completed)' },
      { key: 'pending', label: 'Pending', value: pending, fill: 'var(--color-pending)' },
      { key: 'raw', label: 'Raw', value: Math.max(raw, 0), fill: 'var(--color-raw)' },
    ];
  }, [teacherResults]);
  const teacherReportStatusTotal = teacherReportStatusData.reduce((sum, item) => sum + item.value, 0);
  const teacherRecentResults = teacherResults.slice(0, 5);
  const teacherMostActiveSubject = useMemo(() => {
    const entries = Object.entries(teacherResultsBySubject) as Array<[PaperSubject, number]>;
    const topEntry = entries.sort((left, right) => right[1] - left[1])[0];
    return topEntry && topEntry[1] > 0 ? PAPER_SUBJECT_LABELS[topEntry[0]] : 'No results yet';
  }, [teacherResultsBySubject]);
  const teacherPageTitle = showTeacherModules
    ? '教师工作台'
    : `${currentTeacherSubject ? PAPER_SUBJECT_LABELS[currentTeacherSubject] : '学科'}模块`;
  const teacherPageEyebrow = showTeacherModules
    ? 'Admin Dashboard · Teacher Workspace'
    : `${currentTeacherSubject ? PAPER_SUBJECT_LABELS[currentTeacherSubject] : 'Subject'} Workspace`;
  const teacherPageDescription = showTeacherModules
    ? '按学科进入工作模块，统一管理题目录入、题库、试卷和测试记录。整体视觉与后台稿保持同一套纸张档案风格。'
    : `查看 ${currentTeacherSubject ? PAPER_SUBJECT_LABELS[currentTeacherSubject] : '当前学科'} 下的试卷入口，并进入录题、题库与试卷管理工具。`;

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {isTeacher ? (
        <TeacherToolsLayout activeTool="home" currentSubject={currentTeacherSubject}>
          <div className="pureon-container">
            <div className="pureon-page-head">
              <div>
                <div className="pureon-section-eyebrow">{teacherPageEyebrow}</div>
                <h1 className="pureon-page-title mt-2">{teacherPageTitle}</h1>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--pureon-muted)]">
                  {teacherPageDescription}
                </p>
              </div>
              <div className="pureon-page-head-actions">
                {!showTeacherModules && !hasSingleSubjectAccess ? (
                  <Button
                    variant="outline"
                    className="border-[var(--pureon-teal)] bg-transparent text-[var(--pureon-teal)] hover:bg-[var(--pureon-teal)] hover:text-[var(--pureon-paper)]"
                    onClick={() => setSelectedSubject(null)}
                  >
                    返回总览
                  </Button>
                ) : null}
                <Button
                  variant="outline"
                  className="border-[var(--pureon-teal)] bg-transparent text-[var(--pureon-teal)] hover:bg-[var(--pureon-teal)] hover:text-[var(--pureon-paper)]"
                  onClick={() => navigate(`/paper-intake?subject=${teacherPrimarySubject}`)}
                >
                  题目录入
                </Button>
                <Button
                  className="bg-[var(--pureon-teal)] text-[var(--pureon-paper)] hover:bg-[var(--pureon-ink)]"
                  onClick={() => navigate(showTeacherModules ? "/question-bank" : "/paper-manager")}
                >
                  {showTeacherModules ? '查看题库' : '试卷管理'}
                </Button>
              </div>
            </div>

            {!showTeacherModules ? (
              <div className="pureon-stat-grid" data-columns="4">
                <div className="pureon-stat-card" data-accent="teal">
                  <div className="pureon-stat-label">当前试卷</div>
                  <div className="pureon-stat-value">{teacherPagePapers.length}</div>
                  <div className="pureon-stat-foot">当前模块里的试卷数量</div>
                </div>
                <div className="pureon-stat-card" data-accent="gold">
                  <div className="pureon-stat-label">题量覆盖</div>
                  <div className="pureon-stat-value">{teacherCurrentQuestions}</div>
                  <div className="pureon-stat-foot">questions in workspace</div>
                </div>
                <div className="pureon-stat-card" data-accent="blue">
                  <div className="pureon-stat-label">章节总数</div>
                  <div className="pureon-stat-value">{teacherCurrentSections}</div>
                  <div className="pureon-stat-foot">configured sections</div>
                </div>
                <div className="pureon-stat-card" data-accent={teacherDraftCount > 0 ? 'red' : 'teal'}>
                  <div className="pureon-stat-label">可直接使用</div>
                  <div className="pureon-stat-value">{teacherReadyCount}</div>
                  <div className="pureon-stat-foot">可直接开始练习的卷子</div>
                </div>
              </div>
            ) : null}

            {showTeacherModules ? (
              <div className="mt-6 space-y-6">
                <div className="pureon-stat-grid" data-columns="4">
                  <div className="pureon-stat-card" data-accent="teal">
                    <div className="pureon-stat-label">学科模块</div>
                    <div className="pureon-stat-value">{visibleSubjectModules.length}</div>
                    <div className="pureon-stat-foot">active workspaces</div>
                  </div>
                  <div className="pureon-stat-card" data-accent="blue">
                    <div className="pureon-stat-label">就绪比例</div>
                    <div className="pureon-stat-value">{teacherReadyRate}%</div>
                    <div className="pureon-stat-foot">{teacherReadyCount} / {visiblePapers.length} ready papers</div>
                  </div>
                  <div className="pureon-stat-card" data-accent="gold">
                    <div className="pureon-stat-label">近 7 天提交</div>
                    <div className="pureon-stat-value">{teacherRecentSubmissionCount}</div>
                    <div className="pureon-stat-foot">saved test records</div>
                  </div>
                  <div className="pureon-stat-card" data-accent="red">
                    <div className="pureon-stat-label">平均得分</div>
                    <div className="pureon-stat-value">{teacherAverageScore}%</div>
                    <div className="pureon-stat-foot">across saved submissions</div>
                  </div>
                </div>

                <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)] xl:items-start">
                  <div className="pureon-card">
                    <div className="pureon-card-eyebrow">Workspace Health</div>
                    <div className="pureon-card-title">学科覆盖与就绪情况</div>
                    <p className="mt-3 text-sm leading-7 text-[var(--pureon-muted)]">
                      把试卷覆盖、提交节奏和批改状态收在一个主视图里，先看哪里 ready 足够，哪里还在堆 draft。
                    </p>
                    <div className="mt-5 rounded-[28px] border border-[var(--pureon-rule)] bg-[rgba(245,239,224,0.42)] p-5">
                      <ChartContainer config={teacherCoverageChartConfig} className="h-[260px] w-full aspect-auto">
                        <BarChart data={teacherCoverageChartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                          <CartesianGrid vertical={false} strokeDasharray="3 3" />
                          <XAxis
                            dataKey="subject"
                            tickLine={false}
                            axisLine={false}
                            tickMargin={10}
                          />
                          <ChartTooltip
                            cursor={false}
                            content={<ChartTooltipContent indicator="line" />}
                          />
                          <Bar dataKey="ready" stackId="papers" fill="var(--color-ready)" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="draft" stackId="papers" fill="var(--color-draft)" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ChartContainer>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <div className="rounded-[22px] border border-[var(--pureon-rule)] bg-[rgba(245,239,224,0.42)] p-4">
                        <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--pureon-muted)]">Most Active Subject</div>
                        <div className="mt-2 font-[family-name:var(--font-body)] text-lg font-semibold text-[var(--pureon-teal)]">
                          {teacherMostActiveSubject}
                        </div>
                        <div className="mt-2 text-xs leading-6 text-[var(--pureon-muted)]">按最近提交记录统计当前最活跃模块。</div>
                      </div>
                      <div className="rounded-[22px] border border-[var(--pureon-rule)] bg-[rgba(245,239,224,0.42)] p-4">
                        <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--pureon-muted)]">Question Coverage</div>
                        <div className="mt-2 font-[family-name:var(--font-body)] text-lg font-semibold text-[var(--pureon-teal)]">
                          {visiblePapers.reduce((sum, paper) => sum + (paper.configuredQuestionsCount ?? paper.totalQuestions), 0)}
                        </div>
                        <div className="mt-2 text-xs leading-6 text-[var(--pureon-muted)]">当前老师工作台可调度的总题量。</div>
                      </div>
                      <div className="rounded-[22px] border border-[var(--pureon-rule)] bg-[rgba(245,239,224,0.42)] p-4">
                        <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--pureon-muted)]">Draft Queue</div>
                        <div className="mt-2 font-[family-name:var(--font-body)] text-lg font-semibold text-[var(--pureon-teal)]">
                          {teacherDraftCount}
                        </div>
                        <div className="mt-2 text-xs leading-6 text-[var(--pureon-muted)]">还需要继续补题或调整规则的试卷数。</div>
                      </div>
                    </div>
                  </div>

                  <div className="pureon-card">
                    <div className="pureon-card-eyebrow">Workspace Pulse</div>
                    <div className="pureon-card-title">提交与批改</div>
                    <div className="mt-5 space-y-4">
                      <div className="rounded-[24px] border border-[var(--pureon-rule)] bg-[rgba(245,239,224,0.42)] p-4">
                        <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--pureon-muted)]">Submission Trend</div>
                        <div className="mt-2 text-base font-semibold text-[var(--pureon-teal)]">最近 7 天提交走势</div>
                        {teacherTrendHasData ? (
                          <ChartContainer config={teacherTrendChartConfig} className="mt-4 h-[200px] w-full aspect-auto">
                            <LineChart data={teacherSubmissionTrend} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
                              <CartesianGrid vertical={false} strokeDasharray="3 3" />
                              <XAxis
                                dataKey="label"
                                tickLine={false}
                                axisLine={false}
                                tickMargin={10}
                              />
                              <ChartTooltip
                                cursor={false}
                                content={<ChartTooltipContent indicator="line" />}
                              />
                              <Line
                                type="monotone"
                                dataKey="submissions"
                                stroke="var(--color-submissions)"
                                strokeWidth={2.5}
                                dot={{ fill: 'var(--color-submissions)', r: 3 }}
                                activeDot={{ r: 4 }}
                              />
                            </LineChart>
                          </ChartContainer>
                        ) : (
                          <div className="mt-4 border border-dashed border-[var(--pureon-rule)] bg-[rgba(245,239,224,0.3)] px-4 py-7 text-sm leading-7 text-[var(--pureon-muted)]">
                            还没有可展示的提交趋势。等学生开始做题后，这里会显示最近一周的提交节奏。
                          </div>
                        )}
                      </div>

                      <div className="rounded-[24px] border border-[var(--pureon-rule)] bg-[rgba(245,239,224,0.42)] p-4">
                        <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--pureon-muted)]">Report Mix</div>
                        <div className="mt-2 text-base font-semibold text-[var(--pureon-teal)]">批改状态分布</div>
                        <div className="mt-4 grid gap-5 sm:grid-cols-[160px_minmax(0,1fr)] sm:items-center">
                          {teacherReportStatusTotal > 0 ? (
                            <ChartContainer config={teacherReportStatusChartConfig} className="mx-auto h-[160px] w-full max-w-[160px] aspect-square">
                              <PieChart>
                                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                                <Pie
                                  data={teacherReportStatusData}
                                  dataKey="value"
                                  nameKey="label"
                                  innerRadius={42}
                                  outerRadius={64}
                                  strokeWidth={2}
                                >
                                  {teacherReportStatusData.map((item) => (
                                    <Cell key={item.key} fill={item.fill} />
                                  ))}
                                </Pie>
                              </PieChart>
                            </ChartContainer>
                          ) : (
                            <div className="mx-auto flex h-[160px] w-[160px] items-center justify-center border border-dashed border-[var(--pureon-rule)] text-center text-sm text-[var(--pureon-muted)]">
                              No results
                            </div>
                          )}
                          <div className="space-y-3">
                            {teacherReportStatusData.map((item) => (
                              <div key={item.key} className="flex items-center justify-between gap-3 border-b border-dashed border-[rgba(200,189,160,0.62)] pb-3 last:border-b-0 last:pb-0">
                                <div className="flex items-center gap-3">
                                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.fill }} />
                                  <span className="text-sm text-[var(--pureon-muted)]">{item.label}</span>
                                </div>
                                <strong className="font-[family-name:var(--font-display)] text-[1rem] text-[var(--pureon-teal)]">{item.value}</strong>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)] xl:items-start">
                  <div className="space-y-6">
                    <div className="pureon-card">
                      <div className="pureon-card-eyebrow">Queue</div>
                      <div className="pureon-card-title">当前队列</div>
                      <p className="mt-3 text-sm leading-7 text-[var(--pureon-muted)]">
                        按学科看 ready / draft 比例，先点开需要补内容最多的模块。
                      </p>
                      <div className="pureon-queue-list mt-5">
                        {teacherSubjectOverview.map((item) => (
                          <button
                            key={`teacher-queue-${item.subject}`}
                            type="button"
                            onClick={() => setSelectedSubject(item.subject)}
                            className="pureon-queue-item text-left"
                          >
                            <div>
                              <div className="text-sm font-semibold text-[var(--pureon-teal)]">
                                {PAPER_SUBJECT_LABELS[item.subject]}
                              </div>
                              <div className="pureon-activity-meta">
                                {item.papersCount} 份试卷 · {item.sectionsCount} 个章节
                              </div>
                            </div>
                            <div className="pureon-queue-meta">
                              <span>{item.readyCount} ready</span>
                              <strong>{item.draftCount} draft</strong>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="pureon-card">
                      <div className="pureon-card-eyebrow">Recent Results</div>
                      <div className="pureon-card-title">最近提交记录</div>
                      {teacherResultsQuery.isLoading ? (
                        <div className="mt-5 text-sm text-[var(--pureon-muted)]">Loading recent submissions...</div>
                      ) : teacherRecentResults.length > 0 ? (
                        <div className="pureon-activity-list mt-5">
                          {teacherRecentResults.map((item) => {
                            const percentage = item.totalQuestions > 0
                              ? Math.round((item.totalCorrect / item.totalQuestions) * 100)
                              : 0;

                            return (
                              <button
                                key={`teacher-result-${item.id}`}
                                type="button"
                                onClick={() => navigate(`/test-history?id=${item.id}`)}
                                className="pureon-activity-item w-full text-left"
                              >
                                <span className="pureon-activity-dot" />
                                <div className="min-w-0">
                                  <div className="truncate text-sm text-[var(--pureon-ink)]">
                                    {item.studentName} · {item.paperTitle}
                                  </div>
                                  <div className="pureon-activity-meta">
                                    {PAPER_SUBJECT_ORDER.includes(item.paperSubject as PaperSubject)
                                      ? PAPER_SUBJECT_LABELS[item.paperSubject as PaperSubject]
                                      : 'Unknown Subject'}
                                    {' · '}
                                    {formatDashboardDate(item.createdAt)}
                                  </div>
                                </div>
                                <div className="pureon-activity-score">{percentage}%</div>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="mt-5 border border-dashed border-[var(--pureon-rule)] bg-[rgba(245,239,224,0.4)] px-4 py-6 text-sm leading-7 text-[var(--pureon-muted)]">
                          还没有学生提交记录。等第一次测试保存后，这里会开始显示最近结果。
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pureon-card">
                    <div className="pureon-card-eyebrow">Subject Modules</div>
                    <div className="pureon-card-title">进入学科模块</div>
                    <p className="mt-3 text-sm leading-7 text-[var(--pureon-muted)]">
                      学科模块作为主入口放在右侧，点击后直接进入对应工作区，不再和队列信息抢视觉层级。
                    </p>
                    <div className="pureon-module-grid pureon-module-grid--stack mt-6">
                      {teacherSubjectOverview.map((item, index) => {
                        const subject = item.subject;
                        const config = subjectModuleConfig[subject];

                        return (
                          <motion.button
                            key={subject}
                            type="button"
                            initial={{ opacity: 0, y: 14 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.25, delay: 0.06 * index }}
                            onClick={() => setSelectedSubject(subject)}
                            data-subject={subject}
                            className="group pureon-module-card pureon-module-card--compact flex min-h-[148px] w-full items-start gap-3 px-4 py-4 text-left transition-all duration-300 hover:-translate-y-1"
                          >
                            <div className="pureon-module-icon inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px]">
                              {config.icon}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="pureon-module-title text-[1.02rem] font-semibold">{PAPER_SUBJECT_LABELS[subject]}</div>
                                <span className="pureon-tag" data-tone={item.draftCount > 0 ? 'gold' : 'green'}>
                                  {item.draftCount > 0 ? `${item.draftCount} draft` : 'ready'}
                                </span>
                              </div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {config.focus.map((focus) => (
                                  <span key={`${subject}-${focus}`} className="pureon-tag pureon-module-focus">
                                    {focus}
                                  </span>
                                ))}
                              </div>
                              <div className="pureon-module-stats pureon-module-stats--compact mt-3">
                                <div className="pureon-module-stat">
                                  <span>试卷</span>
                                  <strong>{item.papersCount}</strong>
                                </div>
                                <div className="pureon-module-stat">
                                  <span>章节</span>
                                  <strong>{item.sectionsCount}</strong>
                                </div>
                                <div className="pureon-module-stat">
                                  <span>题量</span>
                                  <strong>{item.questionsCount}</strong>
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="pureon-module-status font-[family-name:var(--font-display)] text-[0.8rem] uppercase tracking-[0.12em]">
                                {item.readyCount} ready
                              </div>
                              <div className="pureon-module-action mt-2 inline-flex items-center gap-2 text-[0.9rem] transition-colors">
                                <span>Enter module</span>
                                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                              </div>
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,0.9fr)]">
                <div className="space-y-6">
                  <div className="pureon-filter-bar">
                    <div className="pureon-filter-row">
                      <div className="pureon-filter-label">模块</div>
                      <div className="pureon-pill-list">
                        <span className="pureon-pill" data-active="true">
                          {currentTeacherSubject ? PAPER_SUBJECT_LABELS[currentTeacherSubject] : 'Current Subject'}
                        </span>
                        <span className="pureon-pill">
                          {teacherPagePapers.length} papers
                        </span>
                        <span className="pureon-pill">
                          {teacherCurrentQuestions} questions
                        </span>
                      </div>
                    </div>
                    <div className="pureon-filter-row">
                      <div className="pureon-filter-label">说明</div>
                      <div className="text-sm leading-7 text-[var(--pureon-muted)]">
                        点击任一试卷可以直接预览；右侧保留当前学科的工具入口，方便继续去录题、题库或试卷管理页。
                      </div>
                    </div>
                  </div>

                  {filteredPapers.length > 0 ? (
                    <div className="pureon-list">
                      {filteredPapers.map((paper, index) => {
                        const displaySectionsCount = paper.configuredSectionsCount ?? paper.sections.length;
                        const displayQuestionsCount = paper.configuredQuestionsCount ?? paper.totalQuestions;
                        const isReady = isPaperReadyToStart(paper);

                        return (
                          <motion.button
                            key={paper.id}
                            type="button"
                            onClick={() => onSelectPaper(paper.id)}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.25, delay: 0.05 * index }}
                            className="pureon-list-item text-left"
                          >
                            <div className="pureon-list-num">{String(index + 1).padStart(2, '0')}</div>
                            <div className="min-w-0">
                              <div className="pureon-list-tags">
                                <span className="pureon-tag">{PAPER_SUBJECT_LABELS[paper.subject]}</span>
                                <span className="pureon-tag" data-tone="gold">{PAPER_CATEGORY_LABELS[paper.category]}</span>
                                <span className="pureon-tag" data-tone={isReady ? 'green' : 'red'}>
                                  {isReady ? 'Ready' : 'Draft'}
                                </span>
                              </div>
                              <div className="text-[1rem] font-semibold text-[var(--pureon-teal)]">{paper.title}</div>
                              <div className="pureon-list-text mt-2">
                                {paper.description || 'Open this paper to preview sections and continue management.'}
                              </div>
                            </div>
                            <div className="pureon-list-stats">
                              <strong>{displayQuestionsCount}Q</strong>
                              <span>{displaySectionsCount} sections</span>
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="pureon-card text-center">
                      <div className="pureon-card-title">当前模块还没有试卷</div>
                      <p className="mt-3 text-sm leading-7 text-[var(--pureon-muted)]">
                        先去题目录入或组卷体系页补内容，新的试卷会自动出现在这里。
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="pureon-card">
                    <div className="pureon-card-eyebrow">Subject Tools</div>
                    <div className="pureon-card-title">模块工具</div>
                    <div className="mt-5 grid gap-3">
                      <Button
                        variant="outline"
                        className="justify-start border-[var(--pureon-rule)] bg-transparent text-[var(--pureon-teal)] hover:bg-[rgba(201,164,97,0.08)]"
                        onClick={() => navigate(`/paper-intake?subject=${teacherPrimarySubject}`)}
                      >
                        继续录题
                      </Button>
                      <Button
                        variant="outline"
                        className="justify-start border-[var(--pureon-rule)] bg-transparent text-[var(--pureon-teal)] hover:bg-[rgba(201,164,97,0.08)]"
                        onClick={() => navigate(`/tag-manager?subject=${teacherPrimarySubject}`)}
                      >
                        编辑组卷体系
                      </Button>
                      <Button
                        variant="outline"
                        className="justify-start border-[var(--pureon-rule)] bg-transparent text-[var(--pureon-teal)] hover:bg-[rgba(201,164,97,0.08)]"
                        onClick={() => navigate("/question-bank")}
                      >
                        查看题库
                      </Button>
                      <Button
                        variant="outline"
                        className="justify-start border-[var(--pureon-rule)] bg-transparent text-[var(--pureon-teal)] hover:bg-[rgba(201,164,97,0.08)]"
                        onClick={() => navigate("/paper-manager")}
                      >
                        管理试卷
                      </Button>
                    </div>
                  </div>

                  <div className="pureon-card">
                    <div className="pureon-card-eyebrow">Coverage</div>
                    <div className="pureon-card-title">当前模块概览</div>
                    <div className="mt-4 space-y-3 text-sm leading-7 text-[var(--pureon-muted)]">
                      <p>
                        当前模块共有 <strong className="text-[var(--pureon-teal)]">{teacherPagePapers.length}</strong> 份试卷，
                        覆盖 <strong className="text-[var(--pureon-teal)]">{teacherCurrentSections}</strong> 个章节。
                      </p>
                      <p>
                        已经可以直接练习的卷子有 <strong className="text-[var(--pureon-teal)]">{teacherReadyCount}</strong> 份，
                        其余可继续完善后再开放。
                      </p>
                    </div>
                    <div className="pureon-activity-list mt-5">
                      {filteredPapers.slice(0, 4).map((paper) => (
                        <button
                          key={`teacher-paper-${paper.id}`}
                          type="button"
                          onClick={() => onSelectPaper(paper.id)}
                          className="pureon-activity-item text-left"
                        >
                          <span className="pureon-activity-dot" />
                          <div className="min-w-0">
                            <div className="truncate text-sm text-[var(--pureon-ink)]">{paper.title}</div>
                            <div className="pureon-activity-meta">
                              {paper.sections.length} parts · {(paper.configuredQuestionsCount ?? paper.totalQuestions)} questions
                            </div>
                          </div>
                          <div className="pureon-activity-score">{isPaperReadyToStart(paper) ? 'Ready' : 'Draft'}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <PureonFooter note="Teacher Workspace" />
          </div>
        </TeacherToolsLayout>
      ) : (
        <div className="min-h-screen bg-[var(--background)]">
          <StudentWorkspaceTopBar
            active={showStudentModules ? 'home' : studentMode === 'practice' ? 'practice' : 'filter'}
            onHomeClick={() => setSelectedSubject(null)}
            onQuestionBankClick={() => {
              if (showStudentModules) {
                setSelectedSubject(visibleSubjectModules[0] ?? null);
              }
            }}
            onPracticeClick={() => {
              if (onStudentModeChange) {
                onStudentModeChange('practice');
                return;
              }
              if (studentPrimaryActionPaper) {
                handleStudentPaperSelect(studentPrimaryActionPaper);
                return;
              }
              if (visibleSubjectModules[0]) {
                setSelectedSubject(visibleSubjectModules[0]);
              }
            }}
            onWrongBookClick={() => navigate('/mistake-book')}
          />

          <div className="pureon-container">
            <div className="pureon-page-head">
              <div>
                <div className="pureon-section-eyebrow">{studentPageEyebrow}</div>
                <h1 className="pureon-page-title mt-2">{studentPageTitle}</h1>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--pureon-muted)]">
                  {studentPageDescription}
                </p>
                {!isTeacher ? (
                  <div className="pureon-pill-list mt-5">
                    <button
                      type="button"
                      className="pureon-pill"
                      data-active={studentMode === 'test' ? 'true' : 'false'}
                      onClick={() => onStudentModeChange?.('test')}
                    >
                      测试模式
                    </button>
                    <button
                      type="button"
                      className="pureon-pill"
                      data-active={studentMode === 'practice' ? 'true' : 'false'}
                      onClick={() => onStudentModeChange?.('practice')}
                    >
                      刷题模式
                    </button>
                  </div>
                ) : null}
              </div>
              <div className="pureon-page-head-actions">
                {!showStudentModules ? (
                  <Button
                    variant="outline"
                    className="border-[var(--pureon-teal)] bg-transparent text-[var(--pureon-teal)] hover:bg-[var(--pureon-teal)] hover:text-[var(--pureon-paper)]"
                    onClick={() => setSelectedSubject(null)}
                  >
                    返回主页
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="border-[var(--pureon-teal)] bg-transparent text-[var(--pureon-teal)] hover:bg-[var(--pureon-teal)] hover:text-[var(--pureon-paper)]"
                    onClick={() => navigate('/mistake-book')}
                  >
                    打开错题本
                  </Button>
                )}
                <Button
                  className="bg-[var(--pureon-teal)] text-[var(--pureon-paper)] hover:bg-[var(--pureon-ink)]"
                  onClick={() => {
                    if (studentPrimaryActionPaper) {
                      handleStudentPaperSelect(studentPrimaryActionPaper);
                      return;
                    }
                    if (visibleSubjectModules[0]) {
                      setSelectedSubject(visibleSubjectModules[0]);
                    }
                  }}
                  disabled={!studentPrimaryActionPaper && visibleSubjectModules.length === 0}
                >
                  开始测试
                </Button>
              </div>
            </div>

            <div className="pureon-stat-grid" data-columns="4">
              <div className="pureon-stat-card" data-accent="teal">
                <div className="pureon-stat-label">考试体系</div>
                <div className="pureon-stat-value">{studentAssessmentPapers.length}</div>
                <div className="pureon-stat-foot">published systems</div>
              </div>
              <div className="pureon-stat-card" data-accent="blue">
                <div className="pureon-stat-label">随机题量</div>
                <div className="pureon-stat-value">{studentTotalQuestions}</div>
                <div className="pureon-stat-foot">configured questions</div>
              </div>
              <div className="pureon-stat-card">
                <div className="pureon-stat-label">补充试卷</div>
                <div className="pureon-stat-value">{studentDirectPapers.length}</div>
                <div className="pureon-stat-foot">teacher assigned / fixed</div>
              </div>
              <div className="pureon-stat-card" data-accent="red">
                <div className="pureon-stat-label">学科数</div>
                <div className="pureon-stat-value">{visibleSubjectModules.length}</div>
                <div className="pureon-stat-foot">当前账号可见科目</div>
              </div>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,0.95fr)]">
              <div>
                <div className="pureon-filter-bar">
                  <div className="pureon-filter-row">
                    <div className="pureon-filter-label">学科</div>
                    <div className="pureon-pill-list">
                      {!hasSingleSubjectAccess ? (
                        <button
                          type="button"
                          className="pureon-pill"
                          data-active={showStudentModules ? 'true' : 'false'}
                          onClick={() => setSelectedSubject(null)}
                        >
                          全部 {studentAssessmentPapers.length}
                        </button>
                      ) : null}
                      {visibleSubjectModules.map((subject) => (
                        <button
                          key={subject}
                          type="button"
                          className="pureon-pill"
                          data-active={activeSubject === subject ? 'true' : 'false'}
                          onClick={() => setSelectedSubject(subject)}
                        >
                          {PAPER_SUBJECT_LABELS[subject]} {studentAssessmentPapers.filter((paper) => paper.subject === subject).length}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="pureon-filter-row">
                    <div className="pureon-filter-label">说明</div>
                    <div className="text-sm leading-7 text-[var(--pureon-muted)]">
                      {showStudentModules
                        ? '上面是老师发布的组卷体系，点击后会按 part 数量和题型即时随机生成一张测试卷。'
                        : '当前列表已经按学科过滤，点击任一体系都会重新随机生成一张测试卷。'}
                    </div>
                  </div>
                </div>

                {studentAssessmentPapers.length > 0 ? (
                  <div className="space-y-6">
                    <div className="pureon-card">
                      <div className="pureon-card-eyebrow">Assessment Systems</div>
                      <div className="pureon-card-title">按组卷体系随机生成</div>
                      <div className="pureon-list mt-5">
                        {studentAssessmentPapers.map((paper, index) => {
                          const displaySectionsCount = paper.configuredSectionsCount ?? paper.sections.length;
                          const displayQuestionsCount = paper.configuredQuestionsCount ?? paper.totalQuestions;
                          const isReady = isPaperReadyToStart(paper);
                          const hasPaperSubtitle = Boolean(paper.subtitle?.trim())
                            && normalizeSummaryText(paper.subtitle) !== normalizeSummaryText(paper.description);
                          const paperSummary = hasPaperSubtitle && paper.subtitle?.trim()
                            ? `${paper.subtitle.trim()} · ${paper.description}`
                            : paper.description;

                          return (
                            <motion.button
                              key={paper.id}
                              type="button"
                              onClick={() => handleStudentPaperSelect(paper)}
                              initial={{ opacity: 0, y: 12 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.25, delay: 0.05 * index }}
                              className="pureon-list-item text-left"
                            >
                              <div className="pureon-list-num">№{index + 1}</div>
                              <div className="min-w-0">
                                <div className="pureon-list-tags">
                                  <span className="pureon-tag">{PAPER_SUBJECT_LABELS[paper.subject]}</span>
                                  <span className="pureon-tag" data-tone="gold">随机组卷</span>
                                  <span className="pureon-tag" data-tone={isReady ? 'green' : 'red'}>
                                    {isReady ? 'Ready' : 'Draft'}
                                  </span>
                                </div>
                                <div className="text-[1rem] font-semibold text-[var(--pureon-teal)]">{paper.title}</div>
                                <div className="pureon-list-text mt-2">
                                  {paperSummary || 'Open this system to generate a full assessment paper.'}
                                </div>
                              </div>
                              <div className="pureon-list-stats">
                                <strong>{displayQuestionsCount}Q</strong>
                                <span>{displaySectionsCount} parts</span>
                              </div>
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>

                    {studentDirectPapers.length > 0 ? (
                      <div className="pureon-card">
                        <div className="pureon-card-eyebrow">Assigned Papers</div>
                        <div className="pureon-card-title">老师单独发来的试卷</div>
                        <div className="pureon-list mt-5">
                          {studentDirectPapers.map((paper, index) => {
                            const displaySectionsCount = paper.configuredSectionsCount ?? paper.sections.length;
                            const displayQuestionsCount = paper.configuredQuestionsCount ?? paper.totalQuestions;
                            const isReady = isPaperReadyToStart(paper);

                            return (
                              <motion.button
                                key={`direct-${paper.id}`}
                                type="button"
                                onClick={() => onSelectPaper(paper.id)}
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.25, delay: 0.05 * index }}
                                className="pureon-list-item text-left"
                              >
                                <div className="pureon-list-num">{String(index + 1).padStart(2, '0')}</div>
                                <div className="min-w-0">
                                  <div className="pureon-list-tags">
                                    <span className="pureon-tag">{PAPER_SUBJECT_LABELS[paper.subject]}</span>
                                    <span className="pureon-tag" data-tone="gold">{PAPER_CATEGORY_LABELS[paper.category]}</span>
                                    <span className="pureon-tag" data-tone={isReady ? 'green' : 'red'}>
                                      {isReady ? 'Ready' : 'Draft'}
                                    </span>
                                  </div>
                                  <div className="text-[1rem] font-semibold text-[var(--pureon-teal)]">{paper.title}</div>
                                  <div className="pureon-list-text mt-2">
                                    {paper.description || 'Open this paper to preview sections and start the assigned test.'}
                                  </div>
                                </div>
                                <div className="pureon-list-stats">
                                  <strong>{displayQuestionsCount}Q</strong>
                                  <span>{displaySectionsCount} sections</span>
                                </div>
                              </motion.button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : studentDirectPapers.length > 0 ? (
                  <div className="pureon-card">
                    <div className="pureon-card-eyebrow">Assigned Papers</div>
                    <div className="pureon-card-title">老师单独发来的试卷</div>
                    <div className="pureon-list mt-5">
                      {studentDirectPapers.map((paper, index) => {
                        const displaySectionsCount = paper.configuredSectionsCount ?? paper.sections.length;
                        const displayQuestionsCount = paper.configuredQuestionsCount ?? paper.totalQuestions;
                        const isReady = isPaperReadyToStart(paper);

                        return (
                          <motion.button
                            key={`direct-fallback-${paper.id}`}
                            type="button"
                            onClick={() => onSelectPaper(paper.id)}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.25, delay: 0.05 * index }}
                            className="pureon-list-item text-left"
                          >
                            <div className="pureon-list-num">№{index + 1}</div>
                            <div className="min-w-0">
                              <div className="pureon-list-tags">
                                <span className="pureon-tag">{PAPER_SUBJECT_LABELS[paper.subject]}</span>
                                <span className="pureon-tag" data-tone="gold">{PAPER_CATEGORY_LABELS[paper.category]}</span>
                                <span className="pureon-tag" data-tone={isReady ? 'green' : 'red'}>
                                  {isReady ? 'Ready' : 'Draft'}
                                </span>
                              </div>
                              <div className="text-[1rem] font-semibold text-[var(--pureon-teal)]">{paper.title}</div>
                              <div className="pureon-list-text mt-2">
                                {paper.description || 'Open this paper to preview sections and start the assigned test.'}
                              </div>
                            </div>
                            <div className="pureon-list-stats">
                              <strong>{displayQuestionsCount}Q</strong>
                              <span>{displaySectionsCount} sections</span>
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="pureon-card text-center">
                    <div className="pureon-card-title">这个筛选下还没有可用测试</div>
                    <p className="mt-3 text-sm leading-7 text-[var(--pureon-muted)]">
                      你可以切换到其他学科，或者等老师先发布一套组卷体系。
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="pureon-card">
                  <div className="pureon-card-eyebrow">Recent Activity</div>
                  <div className="pureon-card-title">最近可进入的测试</div>
                  <div className="pureon-activity-list mt-4">
                    {studentRecentPapers.map((paper, index) => {
                      const displayQuestionsCount = paper.configuredQuestionsCount ?? paper.totalQuestions;
                      return (
                        <button
                          key={`student-activity-${paper.id}`}
                          type="button"
                          onClick={() => handleStudentPaperSelect(paper)}
                          className="pureon-activity-item text-left"
                        >
                          <span className="pureon-activity-dot" />
                          <div className="min-w-0">
                            <div className="truncate text-sm text-[var(--pureon-ink)]">{paper.title}</div>
                            <div className="pureon-activity-meta">
                              {PAPER_SUBJECT_LABELS[paper.subject]} · {(paper.configuredSectionsCount ?? paper.sections.length)} parts
                            </div>
                          </div>
                          <div className="pureon-activity-score">{displayQuestionsCount}Q</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pureon-card">
                  <div className="pureon-card-eyebrow">Access</div>
                  <div className="pureon-card-title">账号可见范围</div>
                  <div className="mt-4 space-y-3 text-sm leading-7 text-[var(--pureon-muted)]">
                    <p>
                      当前账号可进入 {visibleSubjectModules.length} 个学科模块，并使用 {studentAssessmentPapers.length} 个已发布测试体系。
                    </p>
                    {hasSingleSubjectAccess ? (
                      <p>
                        你当前锁定在 <strong className="text-[var(--pureon-teal)]">{PAPER_SUBJECT_LABELS[allowedSubjects[0]]}</strong> 学科。
                      </p>
                    ) : (
                      <div className="pureon-pill-list">
                        {visibleSubjectModules.map((subject) => (
                          <button
                            key={`student-access-${subject}`}
                            type="button"
                            className="pureon-pill"
                            data-tone="gold"
                            data-active={activeSubject === subject ? 'true' : 'false'}
                            onClick={() => setSelectedSubject(subject)}
                          >
                            {PAPER_SUBJECT_LABELS[subject]}
                          </button>
                        ))}
                      </div>
                    )}
                    <Button
                      variant="outline"
                      className="border-[var(--pureon-teal)] bg-transparent text-[var(--pureon-teal)] hover:bg-[var(--pureon-teal)] hover:text-[var(--pureon-paper)]"
                      onClick={() => navigate('/mistake-book')}
                    >
                      查看错题本
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <PureonFooter note="玉璞含光" />
        </div>
      )}
    </div>
  );
}

// ========== PAPER LANDING PAGE (after selecting a paper) ==========

function PaperLandingPage({ paper, onBack }: { paper: Paper; onBack: () => void }) {
  const [showStudentInfoForm, setShowStudentInfoForm] = useState(false);
  const hasDistinctSubtitle = Boolean(paper.subtitle?.trim())
    && normalizeSummaryText(paper.subtitle) !== normalizeSummaryText(paper.description);
  const isReadyToStart = isPaperReadyToStart(paper);
  const isAssessmentPaper = paper.category === 'assessment';
  const startLabel = paper.category === 'assessment' ? '开始测试' : '开始练习';
  const enterLabel = paper.category === 'assessment' ? '进入这份测试' : '进入这份试卷';
  const displaySectionsCount = paper.configuredSectionsCount ?? paper.sections.length;
  const displayQuestionsCount = paper.configuredQuestionsCount ?? paper.totalQuestions;
  const readinessMessage = getPaperReadinessMessage(paper);
  const heroImage = getPaperHeroImage(paper.subject);
  const heroAlt = getPaperHeroAlt(paper.subject);
  const paperDisplayIcon = getPaperDisplayIcon(paper);

  if (showStudentInfoForm) {
    return <StudentInfoForm onBack={() => setShowStudentInfoForm(false)} />;
  }

  return (
    <div className="pureon-page-shell">
      <StudentWorkspaceTopBar
        active="filter"
        onHomeClick={onBack}
        onQuestionBankClick={onBack}
      />

      <div className="pureon-container">
        <div className="pureon-page-head">
          <div>
            <div className="pureon-section-eyebrow">Paper Preview · 试卷预览</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="pureon-tag">{PAPER_SUBJECT_LABELS[paper.subject]}</span>
              <span className="pureon-tag" data-tone="gold">{PAPER_CATEGORY_LABELS[paper.category]}</span>
              <span className="pureon-tag" data-tone={isReadyToStart ? 'green' : 'red'}>
                {isReadyToStart ? 'Ready' : 'Draft'}
              </span>
            </div>
            <h1 className="pureon-page-title mt-4">{paper.title}</h1>
            {hasDistinctSubtitle ? (
              <p className="mt-2 text-base font-semibold tracking-[0.08em] text-[var(--pureon-gold)] sm:text-lg">
                {paper.subtitle}
              </p>
            ) : null}
            <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--pureon-muted)]">
              {paper.description}
            </p>
          </div>
          <div className="pureon-page-head-actions">
            <Button
              variant="outline"
              className="border-[var(--pureon-teal)] bg-transparent text-[var(--pureon-teal)] hover:bg-[var(--pureon-teal)] hover:text-[var(--pureon-paper)]"
              onClick={onBack}
            >
              <ArrowLeft className="h-4 w-4" />
              返回题库
            </Button>
            <Button
              onClick={() => setShowStudentInfoForm(true)}
              disabled={!isReadyToStart}
              className="bg-[var(--pureon-teal)] text-[var(--pureon-paper)] hover:bg-[var(--pureon-ink)]"
            >
              {startLabel}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="pureon-stat-grid" data-columns="4">
          <div className="pureon-stat-card" data-accent="teal">
            <div className="pureon-stat-label">章节数</div>
            <div className="pureon-stat-value">{displaySectionsCount}</div>
            <div className="pureon-stat-foot">assessment sections</div>
          </div>
          <div className="pureon-stat-card" data-accent="blue">
            <div className="pureon-stat-label">题目总数</div>
            <div className="pureon-stat-value">{displayQuestionsCount}</div>
            <div className="pureon-stat-foot">configured questions</div>
          </div>
          <div className="pureon-stat-card">
            <div className="pureon-stat-label">卷类</div>
            <div className="pureon-stat-value text-[1.75rem] sm:text-[2.2rem]">{PAPER_CATEGORY_LABELS[paper.category]}</div>
            <div className="pureon-stat-foot">paper category</div>
          </div>
          <div className="pureon-stat-card" data-accent={isReadyToStart ? 'teal' : 'red'}>
            <div className="pureon-stat-label">状态</div>
            <div className="pureon-stat-value text-[1.8rem] sm:text-[2.2rem]">
              {isReadyToStart ? 'Ready' : 'Draft'}
            </div>
            <div className="pureon-stat-foot">
              {isReadyToStart ? '可以直接进入练习' : '需要先补全试卷内容'}
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,0.95fr)]">
          <div className="space-y-6">
            <div className="pureon-filter-bar">
              <div className="pureon-filter-row">
                <div className="pureon-filter-label">标签</div>
                <div className="pureon-pill-list">
                  {(paper.tags?.length ? paper.tags : ['Pureon Paper']).map((tag) => (
                    <span key={tag} className="pureon-pill" data-active="false">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <div className="pureon-filter-row">
                <div className="pureon-filter-label">说明</div>
                <div className="text-sm leading-7 text-[var(--pureon-muted)]">
                  进入后会先填写学生信息，再按 section 顺序完成整份{isAssessmentPaper ? '测试' : '练习'}。
                </div>
              </div>
              {!isReadyToStart ? (
                <div className="pureon-filter-row">
                  <div className="pureon-filter-label">状态</div>
                  <div className="text-sm leading-7 text-[var(--pureon-red)]">
                    {readinessMessage}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="pureon-card">
              <div className="pureon-card-eyebrow">Assessment Sections</div>
              <div className="pureon-card-title">章节安排</div>
              <div className="pureon-list mt-5">
                {paper.sections.map((section: Section, index: number) => (
                  <motion.div
                    key={section.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: 0.06 * index }}
                    className="pureon-list-item"
                  >
                    <div className="pureon-list-num">{String(index + 1).padStart(2, '0')}</div>
                    <div className="min-w-0">
                      <div className="pureon-list-tags">
                        <span className="pureon-tag">{section.title}</span>
                        <span className="pureon-tag" data-tone="gold">{section.subtitle || 'Section Overview'}</span>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center border ${iconBgColors[section.id] || 'border-[var(--pureon-rule)] bg-[var(--pureon-paper-2)] text-[var(--pureon-teal)]'}`}>
                          {sectionIcons[section.id] || <BookOpen className="h-5 w-5" />}
                        </div>
                        <div className="min-w-0">
                          <div className="text-[1rem] font-semibold text-[var(--pureon-teal)]">{section.title}</div>
                          <div className="pureon-list-text mt-2">
                            {section.description || section.subtitle || 'Open this section to review questions and complete the assessment.'}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="pureon-list-stats">
                      <strong>{section.questions.length}Q</strong>
                      <span>{section.subtitle || 'Section'}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="pureon-card">
              <div className="pureon-card-eyebrow">Paper Illustration</div>
              <div className="pureon-card-title">试卷概览</div>
              <div className="relative mt-5 overflow-hidden border border-[var(--pureon-rule)] bg-[rgba(237,229,208,0.5)] p-4">
                <div className="absolute right-4 top-4 flex h-14 w-14 items-center justify-center border border-[var(--pureon-rule)] bg-[var(--pureon-paper)] text-3xl shadow-sm">
                  <span className="leading-none">{paperDisplayIcon.glyph}</span>
                </div>
                <img
                  src={heroImage}
                  alt={heroAlt}
                  className="w-full rounded-[2px] border border-[rgba(200,189,160,0.7)] bg-[var(--pureon-paper)]"
                />
              </div>
            </div>

            <div className="pureon-card">
              <div className="pureon-card-eyebrow">Start Guide</div>
              <div className="pureon-card-title">开始前须知</div>
              <div className="mt-4 space-y-3 text-sm leading-7 text-[var(--pureon-muted)]">
                <p>进入试卷后会先填写学生姓名与年级，再正式开始答题。</p>
                <p>{isAssessmentPaper ? '测试' : '练习'}过程支持逐题切换、右侧题号导航和统一提交结果。</p>
                <p>
                  当前试卷包含 <strong className="text-[var(--pureon-teal)]">{displaySectionsCount}</strong> 个章节，
                  共 <strong className="text-[var(--pureon-teal)]">{displayQuestionsCount}</strong> 题。
                </p>
              </div>
              <div className="mt-5">
                <Button
                  className="w-full bg-[var(--pureon-teal)] text-[var(--pureon-paper)] hover:bg-[var(--pureon-ink)]"
                  onClick={() => setShowStudentInfoForm(true)}
                  disabled={!isReadyToStart}
                >
                  {enterLabel}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        <PureonFooter note="试卷预览 / Paper Preview" />
      </div>
    </div>
  );
}

// ========== MAIN LANDING PAGE ==========

export default function LandingPage() {
  const { selectedPaper, selectPaper } = useQuiz();
  const { isTeacher } = useLocalAuth();
  const [studentMode, setStudentMode] = useState<'test' | 'practice'>('test');

  if (selectedPaper) {
    return <PaperLandingPage paper={selectedPaper} onBack={() => selectPaper('')} />;
  }

  if (!isTeacher && studentMode === 'practice') {
    return <StudentPracticePage onBackToTests={() => setStudentMode('test')} />;
  }

  return (
    <PaperSelectionPage
      onSelectPaper={selectPaper}
      studentMode={studentMode}
      onStudentModeChange={setStudentMode}
    />
  );
}
