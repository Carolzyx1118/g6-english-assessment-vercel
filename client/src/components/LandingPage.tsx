import { useQuiz } from '@/contexts/QuizContext';
import PureonFooter from '@/components/PureonFooter';
import { PureonBrand } from '@/components/PureonBrand';
import StudentWorkspaceTopBar from '@/components/StudentWorkspaceTopBar';
import { Button } from '@/components/ui/button';
import StudentInfoForm from '@/components/StudentInfoForm';
import { PAPER_CATEGORY_LABELS, PAPER_SUBJECT_LABELS, PAPER_SUBJECT_ORDER, type Paper, type PaperSubject, type Section } from '@/data/papers';
import { motion } from 'framer-motion';
import { BookOpen, PenTool, FileText, ArrowRight, Headphones, Pencil, ArrowLeft, GraduationCap, LogOut, Sparkles, Languages, Calculator, BookText } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useLocalAuth } from '@/hooks/useLocalAuth';
import { getPaperReadinessMessage, isPaperReadyToStart } from '@/lib/paperReadiness';
import TeacherToolsLayout from '@/components/TeacherToolsLayout';

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

const subjectModuleConfig: Record<PaperSubject, { icon: React.ReactNode; accent: string; surface: string; summary: string }> = {
  english: {
    icon: <Languages className="w-7 h-7" />,
    accent: 'text-sky-700',
    surface: 'from-sky-50 to-indigo-50 border-sky-200/70',
    summary: 'Reading, writing, speaking, grammar, and vocabulary assessments.',
  },
  math: {
    icon: <Calculator className="w-7 h-7" />,
    accent: 'text-emerald-700',
    surface: 'from-emerald-50 to-teal-50 border-emerald-200/70',
    summary: 'Problem solving, calculation, reasoning, and future math papers.',
  },
  vocabulary: {
    icon: <BookText className="w-7 h-7" />,
    accent: 'text-amber-700',
    surface: 'from-amber-50 to-orange-50 border-amber-200/70',
    summary: 'Word study, meaning match, memorization, and vocabulary drills.',
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

function PaperSelectionPage({ onSelectPaper }: { onSelectPaper: (paperId: string) => void }) {
  const { papers } = useQuiz();
  const { user, isTeacher } = useLocalAuth();
  const [, navigate] = useLocation();
  const [selectedSubject, setSelectedSubject] = useState<PaperSubject | null>(null);
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
  const subjectCounts = useMemo(
    () => Object.fromEntries(
      visibleSubjectModules.map((subject) => [subject, visiblePapers.filter((paper) => paper.subject === subject).length]),
    ) as Record<PaperSubject, number>,
    [visiblePapers, visibleSubjectModules],
  );
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
  const studentTotalQuestions = useMemo(
    () => visiblePapers.reduce((sum, paper) => sum + (paper.configuredQuestionsCount ?? paper.totalQuestions), 0),
    [visiblePapers],
  );
  const studentTotalSections = useMemo(
    () => visiblePapers.reduce((sum, paper) => sum + (paper.configuredSectionsCount ?? paper.sections.length), 0),
    [visiblePapers],
  );
  const studentRecentPapers = useMemo(
    () => (showStudentModules ? visiblePapers : filteredPapers).slice(0, 4),
    [filteredPapers, showStudentModules, visiblePapers],
  );
  const studentPrimaryActionPaper = (activeSubject ? filteredPapers[0] : visiblePapers[0]) ?? null;
  const studentPageTitle = showStudentModules
    ? '学习概览'
    : activeSubject
      ? `${PAPER_SUBJECT_LABELS[activeSubject]}题库`
      : '我的题库';
  const studentPageEyebrow = showStudentModules
    ? `Good afternoon, ${user?.displayName || user?.username || 'Student'}`
    : `Question Bank · ${activeSubject ? PAPER_SUBJECT_LABELS[activeSubject] : 'All Subjects'}`;
  const studentPageDescription = showStudentModules
    ? '从你可见的学科与试卷中选择一份开始练习，或先浏览错题与最近活动。'
    : '按学科筛选试卷后开始一套完整练习。';
  const teacherPrimarySubject = currentTeacherSubject ?? visibleSubjectModules[0] ?? allowedSubjects[0] ?? 'english';
  const teacherPagePapers = currentTeacherSubject ? filteredPapers : visiblePapers;
  const teacherTotalQuestions = useMemo(
    () => visiblePapers.reduce((sum, paper) => sum + (paper.configuredQuestionsCount ?? paper.totalQuestions), 0),
    [visiblePapers],
  );
  const teacherTotalSections = useMemo(
    () => visiblePapers.reduce((sum, paper) => sum + (paper.configuredSectionsCount ?? paper.sections.length), 0),
    [visiblePapers],
  );
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

            <div className="pureon-stat-grid" data-columns="4">
              <div className="pureon-stat-card" data-accent="teal">
                <div className="pureon-stat-label">{showTeacherModules ? '学科模块' : '当前试卷'}</div>
                <div className="pureon-stat-value">
                  {showTeacherModules ? visibleSubjectModules.length : teacherPagePapers.length}
                </div>
                <div className="pureon-stat-foot">
                  {showTeacherModules ? '可进入的学科数量' : '当前模块里的试卷数量'}
                </div>
              </div>
              <div className="pureon-stat-card" data-accent="blue">
                <div className="pureon-stat-label">题量覆盖</div>
                <div className="pureon-stat-value">
                  {showTeacherModules ? teacherTotalQuestions : teacherCurrentQuestions}
                </div>
                <div className="pureon-stat-foot">questions in workspace</div>
              </div>
              <div className="pureon-stat-card">
                <div className="pureon-stat-label">章节总数</div>
                <div className="pureon-stat-value">
                  {showTeacherModules ? teacherTotalSections : teacherCurrentSections}
                </div>
                <div className="pureon-stat-foot">configured sections</div>
              </div>
              <div className="pureon-stat-card" data-accent={teacherDraftCount > 0 ? 'red' : 'teal'}>
                <div className="pureon-stat-label">{showTeacherModules ? '待完善试卷' : '可直接使用'}</div>
                <div className="pureon-stat-value">
                  {showTeacherModules ? teacherDraftCount : teacherReadyCount}
                </div>
                <div className="pureon-stat-foot">
                  {showTeacherModules ? '需要继续补内容的卷子' : '可直接开始练习的卷子'}
                </div>
              </div>
            </div>

            {showTeacherModules ? (
              <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1.1fr)]">
                <div className="space-y-6">
                  <div className="pureon-card">
                    <div className="pureon-card-eyebrow">Workspace Summary</div>
                    <div className="pureon-card-title">模块总览</div>
                    <div className="mt-4 space-y-3 text-sm leading-7 text-[var(--pureon-muted)]">
                      <p>老师端现在统一进入后台工作台，不再用学生侧的大片 hero 结构。</p>
                      <p>按学科进入后，可以继续管理题目录入、题库、试卷与测试记录，整体视觉跟你发来的后台 HTML 统一。</p>
                      {hasSingleSubjectAccess ? (
                        <p>
                          当前账号锁定在 <strong className="text-[var(--pureon-teal)]">{PAPER_SUBJECT_LABELS[teacherPrimarySubject]}</strong> 学科。
                        </p>
                      ) : null}
                    </div>
                    <div className="pureon-activity-list mt-5">
                      {heroWorkspaceSubjects.map((subject) => (
                        <button
                          key={`teacher-summary-${subject}`}
                          type="button"
                          onClick={() => setSelectedSubject(subject)}
                          className="pureon-activity-item text-left"
                        >
                          <span className="pureon-activity-dot" />
                          <div className="min-w-0">
                            <div className="text-sm text-[var(--pureon-ink)]">{PAPER_SUBJECT_LABELS[subject]}</div>
                            <div className="pureon-activity-meta">{subjectModuleConfig[subject].summary}</div>
                          </div>
                          <div className="pureon-activity-score">{subjectCounts[subject] || 0}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pureon-card">
                    <div className="pureon-card-eyebrow">Quick Actions</div>
                    <div className="pureon-card-title">常用入口</div>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <Button
                        variant="outline"
                        className="justify-start border-[var(--pureon-rule)] bg-transparent text-[var(--pureon-teal)] hover:bg-[rgba(201,164,97,0.08)]"
                        onClick={() => navigate(`/paper-intake?subject=${teacherPrimarySubject}`)}
                      >
                        录入新题
                      </Button>
                      <Button
                        variant="outline"
                        className="justify-start border-[var(--pureon-rule)] bg-transparent text-[var(--pureon-teal)] hover:bg-[rgba(201,164,97,0.08)]"
                        onClick={() => navigate(`/tag-manager?subject=${teacherPrimarySubject}`)}
                      >
                        管理组卷
                      </Button>
                      <Button
                        variant="outline"
                        className="justify-start border-[var(--pureon-rule)] bg-transparent text-[var(--pureon-teal)] hover:bg-[rgba(201,164,97,0.08)]"
                        onClick={() => navigate("/question-bank")}
                      >
                        打开题库
                      </Button>
                      <Button
                        variant="outline"
                        className="justify-start border-[var(--pureon-rule)] bg-transparent text-[var(--pureon-teal)] hover:bg-[rgba(201,164,97,0.08)]"
                        onClick={() => navigate("/test-history")}
                      >
                        查看记录
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {heroWorkspaceSubjects.map((subject, index) => {
                    const config = subjectModuleConfig[subject];

                    return (
                      <motion.button
                        key={subject}
                        type="button"
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25, delay: 0.06 * index }}
                        onClick={() => setSelectedSubject(subject)}
                        className={`group flex min-h-[132px] w-full items-center gap-4 border bg-gradient-to-r ${config.surface} px-5 py-5 text-left shadow-[0_20px_40px_-30px_rgba(45,74,62,0.35)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_48px_-28px_rgba(45,74,62,0.42)]`}
                      >
                        <div className={`inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] border border-white/70 bg-white/85 shadow-sm ${config.accent}`}>
                          {config.icon}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[1.15rem] font-semibold text-[#1E3A5F]">{PAPER_SUBJECT_LABELS[subject]}</div>
                          <div className="mt-2 text-sm leading-7 text-slate-600">{config.summary}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-[family-name:var(--font-display)] text-[1.05rem] text-[#1E3A5F]">
                            {subjectCounts[subject] || 0} paper(s)
                          </div>
                          <div className="mt-3 inline-flex items-center gap-2 text-sm text-slate-400 transition-colors group-hover:text-[#1E3A5F]">
                            <span>Enter module</span>
                            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                          </div>
                        </div>
                      </motion.button>
                    );
                  })}
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
            active={showStudentModules ? 'home' : 'filter'}
            onHomeClick={() => setSelectedSubject(null)}
            onQuestionBankClick={() => {
              if (showStudentModules) {
                setSelectedSubject(visibleSubjectModules[0] ?? null);
              }
            }}
            onPracticeClick={() => {
              if (studentPrimaryActionPaper) {
                onSelectPaper(studentPrimaryActionPaper.id);
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
                      onSelectPaper(studentPrimaryActionPaper.id);
                      return;
                    }
                    if (visibleSubjectModules[0]) {
                      setSelectedSubject(visibleSubjectModules[0]);
                    }
                  }}
                  disabled={!studentPrimaryActionPaper && visibleSubjectModules.length === 0}
                >
                  开始练习
                </Button>
              </div>
            </div>

            <div className="pureon-stat-grid" data-columns="4">
              <div className="pureon-stat-card" data-accent="teal">
                <div className="pureon-stat-label">可用试卷</div>
                <div className="pureon-stat-value">{visiblePapers.length}</div>
                <div className="pureon-stat-foot">已开放练习入口</div>
              </div>
              <div className="pureon-stat-card" data-accent="blue">
                <div className="pureon-stat-label">覆盖题量</div>
                <div className="pureon-stat-value">{studentTotalQuestions}</div>
                <div className="pureon-stat-foot">累计题目 / questions</div>
              </div>
              <div className="pureon-stat-card">
                <div className="pureon-stat-label">学科数</div>
                <div className="pureon-stat-value">{visibleSubjectModules.length}</div>
                <div className="pureon-stat-foot">当前账号可见科目</div>
              </div>
              <div className="pureon-stat-card" data-accent="red">
                <div className="pureon-stat-label">章节总数</div>
                <div className="pureon-stat-value">{studentTotalSections}</div>
                <div className="pureon-stat-foot">sections in all papers</div>
              </div>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,0.95fr)]">
              <div>
                <div className="pureon-filter-bar">
                  <div className="pureon-filter-row">
                    <div className="pureon-filter-label">筛选</div>
                    <div className="pureon-pill-list">
                      <button
                        type="button"
                        className="pureon-pill"
                        data-active={showStudentModules ? 'true' : 'false'}
                        onClick={() => setSelectedSubject(null)}
                      >
                        全部 {visiblePapers.length}
                      </button>
                      {visibleSubjectModules.map((subject) => (
                        <button
                          key={subject}
                          type="button"
                          className="pureon-pill"
                          data-active={activeSubject === subject ? 'true' : 'false'}
                          onClick={() => setSelectedSubject(subject)}
                        >
                          {PAPER_SUBJECT_LABELS[subject]} {subjectCounts[subject] || 0}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="pureon-filter-row">
                    <div className="pureon-filter-label">说明</div>
                    <div className="text-sm leading-7 text-[var(--pureon-muted)]">
                      {showStudentModules
                        ? '先按学科缩小范围，再进入一份完整试卷。'
                        : '当前列表已经按学科过滤，点击任一试卷即可直接进入练习。'}
                    </div>
                  </div>
                </div>

                {studentPagePapers.length > 0 ? (
                  <div className="pureon-list">
                    {studentPagePapers.map((paper, index) => {
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
                              {paperSummary || 'Open this paper to review sections and begin practice.'}
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
                    <div className="pureon-card-title">这个筛选下还没有试卷</div>
                    <p className="mt-3 text-sm leading-7 text-[var(--pureon-muted)]">
                      你可以切换到其他学科，或者返回总览页查看全部可见练习。
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="pureon-card">
                  <div className="pureon-card-eyebrow">Recent Activity</div>
                  <div className="pureon-card-title">最近可练习内容</div>
                  <div className="pureon-activity-list mt-4">
                    {studentRecentPapers.map((paper, index) => {
                      const displayQuestionsCount = paper.configuredQuestionsCount ?? paper.totalQuestions;
                      return (
                        <button
                          key={`student-activity-${paper.id}`}
                          type="button"
                          onClick={() => onSelectPaper(paper.id)}
                          className="pureon-activity-item text-left"
                        >
                          <span className="pureon-activity-dot" />
                          <div className="min-w-0">
                            <div className="truncate text-sm text-[var(--pureon-ink)]">{paper.title}</div>
                            <div className="pureon-activity-meta">
                              {PAPER_SUBJECT_LABELS[paper.subject]} · {paper.sections.length} parts
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
                      当前账号可进入 {visibleSubjectModules.length} 个学科模块，并查看 {visiblePapers.length} 份练习试卷。
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
              开始练习
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
                  进入后会先填写学生信息，再按 section 顺序完成整份练习。
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
                <p>练习过程支持逐题切换、右侧题号导航和统一提交结果。</p>
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
                  进入这份试卷
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

  if (selectedPaper) {
    return <PaperLandingPage paper={selectedPaper} onBack={() => selectPaper('')} />;
  }

  return <PaperSelectionPage onSelectPaper={selectPaper} />;
}
