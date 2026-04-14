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

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {isTeacher ? (
        <TeacherToolsLayout activeTool="home" currentSubject={currentTeacherSubject}>
          <TeacherWorkspaceTopBar />
          <div className={`bg-[var(--background)] ${compactTeacherWorkspaceHome ? 'lg:flex lg:min-h-[calc(100vh-81px)] lg:flex-col' : ''}`}>
            <div className={`relative ${compactTeacherWorkspaceHome ? 'lg:flex flex-1' : ''}`}>
              <div className={`relative overflow-hidden ${heroShellClass}`}>
                <div className="absolute inset-0 bg-gradient-to-br from-[#1E3A5F] via-[#2A4A6F] to-[#1E3A5F]" />
                <div className="absolute inset-0 opacity-5" style={{
                  backgroundImage: 'radial-gradient(circle at 25% 25%, white 1px, transparent 1px), radial-gradient(circle at 75% 75%, white 1px, transparent 1px)',
                  backgroundSize: '40px 40px'
                }} />
                <div className="absolute top-0 right-0 w-96 h-96 bg-[#D4A84B]/10 rounded-full blur-3xl" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#D4A84B]/5 rounded-full blur-3xl" />

                <div className={`max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 relative z-10 ${heroBodySpacingClass}`}>
                  <div className={`grid ${subjectHeroGridClass} ${heroGridOffsetClass}`}>
                    <motion.div
                      initial={{ opacity: 0, x: -30 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.6 }}
                      className={subjectHeroTextClass}
                    >
                      <div className={`inline-flex self-start items-center gap-2 rounded-full border border-[#D4A84B]/25 bg-[#D4A84B]/15 mb-7 px-3 py-1.5 ${compactTeacherWorkspaceHome ? 'lg:-translate-y-2' : ''}`}>
                        <Sparkles className="w-3.5 h-3.5 text-[#D4A84B]" />
                        <span className="text-xs font-medium text-[#D4A84B]">
                          {heroBadgeText}
                        </span>
                      </div>
                      {activeSubjectHeroCopy ? (
                        <div className={heroTitleStackClass} style={heroTitleFontStyle}>
                          <div className={subjectHeroFirstLineClass}>
                            <span className={`block text-white ${subjectHeroResolvedMainTitleClass}`}>
                              Manage
                            </span>
                            <span className={`block text-[#E8C876] ${subjectHeroResolvedMainTitleClass}`}>
                              {heroHighlightText}
                            </span>
                          </div>
                          <h1 className={`${subjectHeroResolvedMainTitleClass} text-white/92`}>
                            {heroTrailingText}
                          </h1>
                        </div>
                      ) : (
                        <div className={heroTitleStackClass} style={heroTitleFontStyle}>
                          <h1 className="font-extrabold tracking-tight text-white leading-[0.98] text-[2.8rem] sm:text-[3.2rem] lg:text-[3.8rem]">
                            Manage
                          </h1>
                          <div className="flex max-w-[820px] flex-wrap items-end gap-x-3 gap-y-0.5 sm:gap-x-4 sm:gap-y-1 font-extrabold tracking-tight">
                            <span className="leading-[0.98] text-[3.35rem] sm:text-[3.9rem] lg:text-[4.55rem] text-[#E8C876]">
                              {heroHighlightText}
                            </span>
                            <span className="leading-[0.98] text-[3rem] sm:text-[3.45rem] lg:text-[4.1rem] text-white/92">
                              {heroTrailingText}
                            </span>
                          </div>
                        </div>
                      )}
                      <p className={`max-w-xl text-white/60 leading-[1.5] ${compactTeacherWorkspaceHome ? 'mt-3 text-base xl:text-lg' : 'mt-5 text-lg'}`}>
                        {heroDescription}
                      </p>
                      {hasSingleSubjectAccess && (
                        <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/75">
                          <span className="text-[#D4A84B]">Access</span>
                          <span>{PAPER_SUBJECT_LABELS[allowedSubjects[0]]} only</span>
                        </div>
                      )}
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, x: 30 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.6, delay: 0.2 }}
                      className={`${subjectHeroImageClass} ${heroImageOffsetClass}`}
                    >
                      {compactTeacherWorkspaceHome ? (
                        <div className="flex max-w-[780px] flex-col gap-3.5 lg:gap-4 lg:ml-auto">
                          {heroWorkspaceSubjects.map((subject, index) => {
                            const config = subjectModuleConfig[subject];

                            return (
                              <motion.button
                                key={subject}
                                type="button"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.4, delay: 0.45 + index * 0.1 }}
                                onClick={() => setSelectedSubject(subject)}
                                className={`group flex min-h-[116px] w-full flex-col rounded-[22px] border bg-gradient-to-r ${config.surface} px-5 py-4 text-left shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl sm:flex-row sm:items-center sm:gap-4`}
                              >
                                <div className="mb-3 flex items-start justify-between gap-4 sm:mb-0 sm:items-center">
                                  <div className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] bg-white shadow-sm ${config.accent}`}>
                                    {config.icon}
                                  </div>
                                  <ArrowRight className="h-[18px] w-[18px] shrink-0 text-slate-300 transition-transform group-hover:translate-x-1 group-hover:text-[#94A3B8] sm:hidden" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <h3 className="text-[1.35rem] font-bold tracking-tight text-[#1E3A5F]">{PAPER_SUBJECT_LABELS[subject]}</h3>
                                  <p className="mt-1.5 max-w-[26rem] text-[12px] leading-[1.75] text-slate-600">
                                    {config.summary}
                                  </p>
                                </div>
                                <div className="mt-4 flex items-center justify-between gap-4 text-[13px] sm:mt-0 sm:min-w-[156px] sm:flex-col sm:items-end sm:justify-center">
                                  <span className="font-semibold text-[#1E3A5F]">{subjectCounts[subject] || 0} paper(s)</span>
                                  <div className="flex items-center gap-2 text-slate-400">
                                    <span>Enter module</span>
                                    <ArrowRight className="hidden h-[18px] w-[18px] shrink-0 transition-transform group-hover:translate-x-1 group-hover:text-[#94A3B8] sm:block" />
                                  </div>
                                </div>
                              </motion.button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="relative mx-auto max-w-[500px] xl:max-w-[540px]">
                          <div className="absolute -inset-4 bg-[#D4A84B]/10 rounded-3xl blur-2xl" />
                          <img
                            src={dashboardHeroImage}
                            alt={dashboardHeroAlt}
                            className="relative w-full rounded-2xl opacity-90"
                          />
                        </div>
                      )}
                    </motion.div>
                  </div>
                </div>
                {!compactTeacherWorkspaceHome && showTeacherSubjectPage && !hasSingleSubjectAccess ? (
                  <div className="pointer-events-none absolute inset-x-0 bottom-20 lg:bottom-24 z-20">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 lg:pl-14 xl:pl-16">
                      <button
                        type="button"
                        onClick={() => setSelectedSubject(null)}
                        className="pointer-events-auto inline-flex items-center gap-3.5 px-1 py-1 text-[15px] font-semibold text-white transition-all hover:-translate-y-0.5 hover:text-white/90 lg:text-base"
                      >
                        <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[#D4A84B]/30 bg-[#D4A84B]/16 text-[#F0C66A] shadow-[0_10px_24px_rgba(10,26,47,0.18)]">
                          <ArrowLeft className="h-[18px] w-[18px]" />
                        </span>
                        <span className="pr-1">Back to Home</span>
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            {!compactTeacherWorkspaceHome ? (
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 pt-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
              >
                {showTeacherModules ? (
                  <>
                    <h2 className="text-2xl font-bold text-[#1E3A5F] mb-2">Choose a Subject Module</h2>
                    <p className="text-slate-500 mb-8">
                      Start by entering a subject, then choose one of the papers inside that module.
                    </p>
                  </>
                ) : showTeacherSubjectPage && activeSubject ? (
                  <>
                    <h2 className="text-2xl font-bold text-[#1E3A5F] mb-2">{PAPER_SUBJECT_LABELS[activeSubject]} Assessments</h2>
                    <p className="text-slate-500 mb-5">
                      Choose a paper inside the {PAPER_SUBJECT_LABELS[activeSubject]} module.
                    </p>
                  </>
                ) : null}
              </motion.div>

              {showTeacherModules ? (
                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {visibleSubjectModules.map((subject, index) => {
                    const config = subjectModuleConfig[subject];
                    return (
                      <motion.button
                        key={subject}
                        type="button"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.45 + index * 0.1 }}
                        onClick={() => setSelectedSubject(subject)}
                        className={`group text-left rounded-3xl border bg-gradient-to-br ${config.surface} p-8 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl`}
                      >
                        <div className={`mb-5 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm ${config.accent}`}>
                          {config.icon}
                        </div>
                        <div className="mb-3 flex items-center justify-between gap-4">
                          <h3 className="text-2xl font-bold text-[#1E3A5F]">{PAPER_SUBJECT_LABELS[subject]}</h3>
                          <ArrowRight className="w-5 h-5 text-slate-400 transition-transform group-hover:translate-x-1 group-hover:text-[#D4A84B]" />
                        </div>
                        <p className="text-sm leading-relaxed text-slate-600">{config.summary}</p>
                        <div className="mt-6 flex items-center justify-between text-sm">
                          <span className="font-semibold text-slate-700">{subjectCounts[subject] || 0} paper(s)</span>
                          <span className="text-slate-400">Enter module</span>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              ) : (
                <>
                  <div className="grid sm:grid-cols-2 gap-6">
                    {filteredPapers.map((paper: Paper, i: number) => {
                      const displaySectionsCount = paper.configuredSectionsCount ?? paper.sections.length;
                      const displayQuestionsCount = paper.configuredQuestionsCount ?? paper.totalQuestions;
                      const paperDisplayIcon = getPaperDisplayIcon(paper);

                      return (
                        <motion.button
                          key={paper.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.4, delay: 0.5 + i * 0.15 }}
                          onClick={() => onSelectPaper(paper.id)}
                          className="group relative text-left rounded-2xl border-2 border-slate-200/80 bg-white p-8 hover:shadow-xl hover:border-[#D4A84B]/40 transition-all duration-300 hover:-translate-y-1"
                        >
                          <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                            <ArrowRight className="w-5 h-5 text-[#D4A84B]" />
                          </div>
                          <div className="flex items-center gap-4 mb-4">
                            <div className={`flex h-14 w-14 items-center justify-center rounded-2xl text-3xl ${paperDisplayIcon.surface}`}>
                              <span className="leading-none">{paperDisplayIcon.glyph}</span>
                            </div>
                            <div>
                              <h3 className="font-[family-name:var(--font-body)] text-lg font-bold tracking-normal text-[#1E3A5F] transition-colors group-hover:text-[#D4A84B]">{paper.title}</h3>
                            </div>
                          </div>
                          <div className="mb-4 flex flex-wrap gap-2">
                            <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                              {PAPER_SUBJECT_LABELS[paper.subject]}
                            </span>
                            <span className="inline-flex items-center rounded-full bg-[#D4A84B]/10 px-3 py-1 text-xs font-semibold text-[#A97C21]">
                              {PAPER_CATEGORY_LABELS[paper.category]}
                            </span>
                            {paper.tags?.slice(0, 2).map((tag) => (
                              <span key={tag} className="inline-flex items-center rounded-full bg-[#1E3A5F]/5 px-3 py-1 text-xs font-medium text-[#1E3A5F]">
                                {tag}
                              </span>
                            ))}
                          </div>
                          <p className="text-sm text-slate-600 leading-relaxed mb-5">{paper.description}</p>
                          <div className="flex flex-wrap gap-3">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1E3A5F]/5 text-[#1E3A5F] text-xs font-semibold">
                              <BookOpen className="w-3.5 h-3.5" />
                              {displaySectionsCount} Sections
                            </span>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#D4A84B]/10 text-[#D4A84B] text-xs font-semibold">
                              <GraduationCap className="w-3.5 h-3.5" />
                              {displayQuestionsCount} Questions
                            </span>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                  {filteredPapers.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 px-6 py-10 text-center text-slate-500">
                      No papers in this subject yet. Add one later and it will appear here automatically.
                    </div>
                  )}
                </>
              )}
              </div>
            ) : null}

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
