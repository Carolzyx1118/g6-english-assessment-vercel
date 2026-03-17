import { useQuiz } from '@/contexts/QuizContext';
import { Button } from '@/components/ui/button';
import { PAPER_CATEGORY_LABELS, PAPER_SUBJECT_LABELS, PAPER_SUBJECT_ORDER, type Paper, type PaperSubject, type Section } from '@/data/papers';
import { motion } from 'framer-motion';
import { BookOpen, PenTool, FileText, ArrowRight, Headphones, Pencil, ArrowLeft, GraduationCap, ClipboardList, LogOut, User, Sparkles, Settings2, Languages, Calculator } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'wouter';
import { useLocalAuth } from '@/hooks/useLocalAuth';

const PUREON_LOGO = 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663325188422/bJDnAegOAPWmMppj.png';

const HERO_IMAGE = 'https://private-us-east-1.manuscdn.com/sessionFile/EkfYMR94S7iTs27MlKPHhG/sandbox/EXd2rAVuTpleP76sVHRwu5-img-1_1771255551000_na1fn_aGVyby1iYW5uZXI.png?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvRWtmWU1SOTRTN2lUczI3TWxLUEhoRy9zYW5kYm94L0VYZDJyQVZ1VHBsZVA3NnNWSFJ3dTUtaW1nLTFfMTc3MTI1NTU1MTAwMF9uYTFmbl9hR1Z5YnkxaVlXNXVaWEkucG5nP3gtb3NzLXByb2Nlc3M9aW1hZ2UvcmVzaXplLHdfMTkyMCxoXzE5MjAvZm9ybWF0LHdlYnAvcXVhbGl0eSxxXzgwIiwiQ29uZGl0aW9uIjp7IkRhdGVMZXNzVGhhbiI6eyJBV1M6RXBvY2hUaW1lIjoxNzk4NzYxNjAwfX19XX0_&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=I5fojTC3dYU1azrXcxeOhHGaexKXmznPAcGFS~lV8L7Mg4foEr2gVTG8bWCRAFcNxWpHkpz6nN2LYnhtbkVgpR6LJgFhSgixOlBrFTrn10YhLyMDjFH395DUPFebb3vmNWW4AtScobvWAmQKFCbyRkSCwV2lqQjc6UtGXWp0UNZVGZU93MZ-Lc6Tnjz7Y-~D1BRvpGWq8tZLrE1EeyFCN-2QxJNOaJrlvv0Zqp443MkcRgAiOKhqYi8Jux0MB8ue0LLEMJZ7GIRQOzu1lbf6FHGk5jHn3ctuue-nzVHvjc~hX60cyBA3odGGtWFaxd56S8rofjTUDitaGRwWStBX7A__';
const DASHBOARD_HERO_IMAGE = '/teacher-workspace-hero.svg';
const ENGLISH_DASHBOARD_HERO_IMAGE = '/teacher-english-hero.svg';
const MATH_DASHBOARD_HERO_IMAGE = '/teacher-math-hero.svg';
const VOCABULARY_DASHBOARD_HERO_IMAGE = '/teacher-vocabulary-hero.svg';

function normalizeSummaryText(value?: string) {
  return value?.trim().replace(/\s+/g, ' ').toLowerCase() || '';
}

const sectionIcons: Record<string, React.ReactNode> = {
  vocabulary: <BookOpen className="w-6 h-6" />,
  grammar: <PenTool className="w-6 h-6" />,
  listening: <Headphones className="w-6 h-6" />,
  reading: <FileText className="w-6 h-6" />,
  writing: <Pencil className="w-6 h-6" />,
};

const sectionColors: Record<string, string> = {
  vocabulary: 'from-emerald-50 to-emerald-100/50 border-emerald-200/60 text-emerald-800',
  grammar: 'from-amber-50 to-amber-100/50 border-amber-200/60 text-amber-800',
  listening: 'from-purple-50 to-purple-100/50 border-purple-200/60 text-purple-800',
  reading: 'from-sky-50 to-sky-100/50 border-sky-200/60 text-sky-800',
  writing: 'from-orange-50 to-orange-100/50 border-orange-200/60 text-orange-800',
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
    icon: <BookOpen className="w-7 h-7" />,
    accent: 'text-amber-700',
    surface: 'from-amber-50 to-orange-50 border-amber-200/70',
    summary: 'Word study, meaning match, memorization, and vocabulary drills.',
  },
};

// ========== PUREON BRAND HEADER ==========

function BrandHeader() {
  const { user, isAuthenticated, logout } = useLocalAuth();

  return (
    <div className="bg-[#1E3A5F] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={PUREON_LOGO} alt="璞源教育" className="w-10 h-10 object-contain" />
          <div className="leading-tight">
            <div className="text-sm font-bold tracking-wide">璞源教育</div>
            <div className="text-[10px] text-white/60 tracking-widest">PUREON EDUCATION</div>
          </div>
        </div>
        {isAuthenticated && user && (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-white/80">
              <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
                <User className="w-3.5 h-3.5 text-[#D4A84B]" />
              </div>
              <span className="hidden sm:inline">{user.displayName || user.username}</span>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white/90 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">退出</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ========== PAPER SELECTION PAGE ==========

function PaperSelectionPage({ onSelectPaper }: { onSelectPaper: (paperId: string) => void }) {
  const { papers } = useQuiz();
  const { user, isTeacher } = useLocalAuth();
  const [selectedSubject, setSelectedSubject] = useState<PaperSubject | 'all' | null>('all');
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
  const activeSubject = hasSingleSubjectAccess
    ? allowedSubjects[0]
    : isTeacher
      ? selectedSubject
      : selectedSubject ?? 'all';
  const showTeacherSubjectPage = isTeacher && activeSubject !== null && activeSubject !== 'all';
  const dashboardHeroImage = isTeacher
    ? activeSubject === 'english'
      ? ENGLISH_DASHBOARD_HERO_IMAGE
      : activeSubject === 'math'
        ? MATH_DASHBOARD_HERO_IMAGE
        : activeSubject === 'vocabulary'
          ? VOCABULARY_DASHBOARD_HERO_IMAGE
          : DASHBOARD_HERO_IMAGE
    : DASHBOARD_HERO_IMAGE;
  const dashboardHeroAlt = isTeacher
    ? activeSubject === 'english'
      ? 'English workspace overview'
      : activeSubject === 'math'
        ? 'Math workspace overview'
        : activeSubject === 'vocabulary'
          ? 'Vocabulary workspace overview'
          : 'Teacher workspace overview'
    : 'Teacher workspace overview';
  const visibleSubjectModules = useMemo(
    () => PAPER_SUBJECT_ORDER.filter((subject) => allowedSubjects.includes(subject)),
    [allowedSubjects],
  );
  const filteredPapers = useMemo(
    () => (
      activeSubject === null
        ? []
        : activeSubject === 'all'
          ? visiblePapers
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
      if (selectedSubject === 'all') {
        setSelectedSubject(null);
        return;
      }
      if (selectedSubject && !allowedSubjects.includes(selectedSubject)) {
        setSelectedSubject(null);
      }
      return;
    }

    if (selectedSubject === null) {
      setSelectedSubject('all');
      return;
    }

    if (selectedSubject !== 'all' && !allowedSubjects.includes(selectedSubject)) {
      setSelectedSubject('all');
    }
  }, [allowedSubjects, hasSingleSubjectAccess, isTeacher, selectedSubject]);

  return (
    <div className="min-h-screen bg-[#FAFBFD]">
      <BrandHeader />

      {/* Hero Section with navy gradient */}
      <div className="relative overflow-hidden">
        {/* Navy gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#1E3A5F] via-[#2A4A6F] to-[#1E3A5F]" />
        {/* Subtle pattern overlay */}
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: 'radial-gradient(circle at 25% 25%, white 1px, transparent 1px), radial-gradient(circle at 75% 75%, white 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }} />
        {/* Warm glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#D4A84B]/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#D4A84B]/5 rounded-full blur-3xl" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-20 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#D4A84B]/15 border border-[#D4A84B]/25 mb-6">
                <Sparkles className="w-3.5 h-3.5 text-[#D4A84B]" />
                <span className="text-xs font-medium text-[#D4A84B]">
                  {isTeacher
                    ? 'Teacher Workspace · English / Math / Vocabulary'
                    : 'Assessment Library · English / Math / Vocabulary'}
                </span>
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight">
                {isTeacher ? 'Manage' : 'Assessment'}
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-[#D4A84B] to-[#E8C876]">
                  {isTeacher ? 'Assessments' : 'Categories'}
                </span>
                <span className="block text-white/90">{isTeacher ? 'by Subject' : 'for Every Subject'}</span>
              </h1>
              <p className="mt-6 text-lg text-white/60 leading-relaxed max-w-xl">
                {isTeacher
                  ? 'Open a subject workspace to review papers, update content, manage what students see, and access your history, intake, and paper management tools.'
                  : 'Browse available assessments by subject, then open the paper you want to complete.'}
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
              className="hidden lg:block"
            >
              <div className="relative">
                <div className="absolute -inset-4 bg-[#D4A84B]/10 rounded-3xl blur-2xl" />
                <img
                  src={dashboardHeroImage}
                  alt={dashboardHeroAlt}
                  className="relative w-full rounded-2xl opacity-90"
                />
              </div>
            </motion.div>
          </div>
        </div>

        {/* Curved bottom edge */}
        <div className="absolute bottom-[-1px] left-0 right-0 leading-none">
          <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full block">
            <path d="M0 60L1440 60L1440 0C1440 0 1080 50 720 50C360 50 0 0 0 0L0 60Z" fill="#FAFBFD"/>
          </svg>
        </div>
      </div>

      {/* Paper Selection */}
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
              {!hasSingleSubjectAccess && (
                <button
                  type="button"
                  onClick={() => setSelectedSubject(null)}
                  className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-[#1E3A5F]"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Subject Modules
                </button>
              )}
              <h2 className="text-2xl font-bold text-[#1E3A5F] mb-2">{PAPER_SUBJECT_LABELS[activeSubject]} Assessments</h2>
              <p className="text-slate-500 mb-5">
                Choose a paper inside the {PAPER_SUBJECT_LABELS[activeSubject]} module.
              </p>
              {isTeacher && (activeSubject === 'english' || activeSubject === 'math' || activeSubject === 'vocabulary') && (
                <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-[#1E3A5F]">Teacher Tools</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {activeSubject === 'math'
                          ? 'Manage Math papers, create new multiple-choice parts, and review student records from here.'
                          : activeSubject === 'vocabulary'
                            ? 'Manage vocabulary papers, build spelling and word-completion drills, and review student records from here.'
                          : 'Manage English papers, review student records, and create new assessments from here.'}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <Link href={`/history?subject=${activeSubject}`}>
                        <Button variant="outline" className="gap-2 border-slate-200">
                          <ClipboardList className="w-4 h-4" />
                          View Test History
                        </Button>
                      </Link>
                      <Link href={`/paper-intake?subject=${activeSubject}`}>
                        <Button variant="outline" className="gap-2 border-slate-200">
                          <FileText className="w-4 h-4" />
                          Paper Intake
                        </Button>
                      </Link>
                      <Link href={`/paper-manager?subject=${activeSubject}`}>
                        <Button variant="outline" className="gap-2 border-slate-200">
                          <Settings2 className="w-4 h-4" />
                          Paper Manager
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-[#1E3A5F] mb-2">Choose Your Assessment</h2>
              <p className="text-slate-500 mb-5">
                {hasSingleSubjectAccess
                  ? `This account can enter the ${PAPER_SUBJECT_LABELS[allowedSubjects[0]]} subject page only.`
                  : 'Filter by subject, then select a paper to view its details and start the assessment.'}
              </p>
              {!hasSingleSubjectAccess && (
                <div className="flex flex-wrap gap-3 mb-8">
                  <button
                    type="button"
                    onClick={() => setSelectedSubject('all')}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                      selectedSubject === 'all'
                        ? 'bg-[#1E3A5F] text-white shadow-lg shadow-[#1E3A5F]/15'
                        : 'bg-white text-slate-600 border border-slate-200 hover:border-[#D4A84B]/40 hover:text-[#1E3A5F]'
                    }`}
                  >
                    All Subjects
                    <span className="ml-2 text-xs opacity-70">{papers.length}</span>
                  </button>
                  {allowedSubjects.map((subject) => {
                    const count = papers.filter((paper) => paper.subject === subject).length;
                    return (
                      <button
                        key={subject}
                        type="button"
                        onClick={() => setSelectedSubject(subject)}
                        className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                          selectedSubject === subject
                            ? 'bg-[#D4A84B] text-white shadow-lg shadow-[#D4A84B]/20'
                            : 'bg-white text-slate-600 border border-slate-200 hover:border-[#D4A84B]/40 hover:text-[#1E3A5F]'
                        }`}
                      >
                        {PAPER_SUBJECT_LABELS[subject]}
                        <span className="ml-2 text-xs opacity-70">{count}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
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
              {filteredPapers.map((paper: Paper, i: number) => (
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
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl bg-[#1E3A5F]/5">
                      {paper.icon}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-[#1E3A5F] group-hover:text-[#D4A84B] transition-colors">{paper.title}</h3>
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
                      {paper.sections.length} Sections
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#D4A84B]/10 text-[#D4A84B] text-xs font-semibold">
                      <GraduationCap className="w-3.5 h-3.5" />
                      {paper.totalQuestions} Questions
                    </span>
                  </div>
                </motion.button>
              ))}
            </div>
            {filteredPapers.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 px-6 py-10 text-center text-slate-500">
                No papers in this subject yet. Add one later and it will appear here automatically.
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-slate-200/60 bg-white/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={PUREON_LOGO} alt="璞源教育" className="w-6 h-6 object-contain opacity-50" />
            <span className="text-xs text-slate-400">© 2026 璞源教育 Pureon Education</span>
          </div>
          <span className="text-xs text-slate-400">专注新加坡国际教育</span>
        </div>
      </div>
    </div>
  );
}

// ========== PAPER LANDING PAGE (after selecting a paper) ==========

function PaperLandingPage({ paper, onBack }: { paper: Paper; onBack: () => void }) {
  const { startQuiz } = useQuiz();
  const hasDistinctSubtitle = Boolean(paper.subtitle?.trim())
    && normalizeSummaryText(paper.subtitle) !== normalizeSummaryText(paper.description);

  return (
    <div className="min-h-screen bg-[#FAFBFD]">
      <BrandHeader />

      {/* Header with back button */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1E3A5F] via-[#2A4A6F] to-[#1E3A5F]" />
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: 'radial-gradient(circle at 25% 25%, white 1px, transparent 1px), radial-gradient(circle at 75% 75%, white 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }} />
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#D4A84B]/10 rounded-full blur-3xl" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-20 relative z-10">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white/80 mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Paper Selection
          </button>

          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="flex items-center gap-3 mb-4">
                <span className="text-4xl">{paper.icon}</span>
              </div>
              <div className="mb-4 flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/80">
                  {PAPER_SUBJECT_LABELS[paper.subject]}
                </span>
                <span className="inline-flex items-center rounded-full bg-[#D4A84B]/15 px-3 py-1 text-xs font-semibold text-[#E8C876]">
                  {PAPER_CATEGORY_LABELS[paper.category]}
                </span>
                {paper.tags?.map((tag) => (
                  <span key={tag} className="inline-flex items-center rounded-full bg-white/5 px-3 py-1 text-xs font-medium text-white/60">
                    {tag}
                  </span>
                ))}
              </div>
              <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
                {paper.title}
                {hasDistinctSubtitle ? (
                  <span className="block text-transparent bg-clip-text bg-gradient-to-r from-[#D4A84B] to-[#E8C876] text-2xl sm:text-3xl mt-1">
                    {paper.subtitle}
                  </span>
                ) : null}
              </h1>
              <p className="mt-6 text-lg text-white/60 leading-relaxed max-w-xl">
                {paper.description}
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Button
                  size="lg"
                  onClick={startQuiz}
                  className="bg-gradient-to-r from-[#D4A84B] to-[#C49A3F] hover:from-[#C49A3F] hover:to-[#B48A35] text-white px-8 py-6 text-lg rounded-xl shadow-lg shadow-[#D4A84B]/20 hover:shadow-xl hover:shadow-[#D4A84B]/30 transition-all duration-300"
                >
                  Start Assessment
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </div>
              <div className="mt-8 flex items-center gap-6 text-sm text-white/50">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-[#D4A84B] font-bold text-xs">{paper.sections.length}</div>
                  <span>Sections</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-[#D4A84B] font-bold text-xs">{paper.totalQuestions}</div>
                  <span>Questions</span>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="hidden lg:block"
            >
              <div className="relative">
                <div className="absolute -inset-4 bg-[#D4A84B]/10 rounded-3xl blur-2xl" />
                <img
                  src={HERO_IMAGE}
                  alt="English Learning Illustration"
                  className="relative w-full rounded-2xl opacity-90"
                />
              </div>
            </motion.div>
          </div>
        </div>

        {/* Curved bottom edge */}
        <div className="absolute bottom-[-1px] left-0 right-0 leading-none">
          <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full block">
            <path d="M0 60L1440 60L1440 0C1440 0 1080 50 720 50C360 50 0 0 0 0L0 60Z" fill="#FAFBFD"/>
          </svg>
        </div>
      </div>

      {/* Sections Overview */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <h2 className="text-2xl font-bold text-[#1E3A5F] mb-2">Assessment Sections</h2>
          <p className="text-slate-500 mb-8">Complete each section to get your full proficiency score.</p>
        </motion.div>

        <div className={`grid sm:grid-cols-2 ${paper.sections.length >= 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-' + paper.sections.length} gap-5`}>
          {paper.sections.map((section: Section, i: number) => (
            <motion.div
              key={section.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.5 + i * 0.1 }}
              className={`relative group rounded-xl border bg-gradient-to-br ${sectionColors[section.id] || 'from-slate-50 to-slate-100 border-slate-200 text-slate-700'} p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-1`}
            >
              <div className={`w-12 h-12 rounded-xl ${iconBgColors[section.id] || 'bg-slate-100 text-slate-600'} flex items-center justify-center mb-4`}>
                {sectionIcons[section.id] || <BookOpen className="w-6 h-6" />}
              </div>
              <h3 className="font-bold text-lg mb-1">{section.title}</h3>
              <p className="text-sm opacity-80 mb-3">{section.subtitle}</p>
              <p className="text-sm opacity-70 leading-relaxed line-clamp-2">{section.description}</p>
              <div className="mt-4 text-xs font-medium opacity-60">
                {section.questions.length} question{section.questions.length > 1 ? 's' : ''}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-slate-200/60 bg-white/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={PUREON_LOGO} alt="璞源教育" className="w-6 h-6 object-contain opacity-50" />
            <span className="text-xs text-slate-400">© 2026 璞源教育 Pureon Education</span>
          </div>
          <span className="text-xs text-slate-400">专注新加坡国际教育</span>
        </div>
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
