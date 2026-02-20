import { useQuiz } from '@/contexts/QuizContext';
import { Button } from '@/components/ui/button';
import type { Paper, Section } from '@/data/papers';
import { motion } from 'framer-motion';
import { BookOpen, PenTool, FileText, ArrowRight, Headphones, Pencil, ArrowLeft, GraduationCap, ClipboardList } from 'lucide-react';
import { useState } from 'react';
import StudentInfoForm from '@/components/StudentInfoForm';
import { Link } from 'wouter';

const HERO_IMAGE = 'https://private-us-east-1.manuscdn.com/sessionFile/EkfYMR94S7iTs27MlKPHhG/sandbox/EXd2rAVuTpleP76sVHRwu5-img-1_1771255551000_na1fn_aGVyby1iYW5uZXI.png?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvRWtmWU1SOTRTN2lUczI3TWxLUEhoRy9zYW5kYm94L0VYZDJyQVZ1VHBsZVA3NnNWSFJ3dTUtaW1nLTFfMTc3MTI1NTU1MTAwMF9uYTFmbl9hR1Z5YnkxaVlXNXVaWEkucG5nP3gtb3NzLXByb2Nlc3M9aW1hZ2UvcmVzaXplLHdfMTkyMCxoXzE5MjAvZm9ybWF0LHdlYnAvcXVhbGl0eSxxXzgwIiwiQ29uZGl0aW9uIjp7IkRhdGVMZXNzVGhhbiI6eyJBV1M6RXBvY2hUaW1lIjoxNzk4NzYxNjAwfX19XX0_&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=I5fojTC3dYU1azrXcxeOhHGaexKXmznPAcGFS~lV8L7Mg4foEr2gVTG8bWCRAFcNxWpHkpz6nN2LYnhtbkVgpR6LJgFhSgixOlBrFTrn10YhLyMDjFH395DUPFebb3vmNWW4AtScobvWAmQKFCbyRkSCwV2lqQjc6UtGXWp0UNZVGZU93MZ-Lc6Tnjz7Y-~D1BRvpGWq8tZLrE1EeyFCN-2QxJNOaJrlvv0Zqp443MkcRgAiOKhqYi8Jux0MB8ue0LLEMJZ7GIRQOzu1lbf6FHGk5jHn3ctuue-nzVHvjc~hX60cyBA3odGGtWFaxd56S8rofjTUDitaGRwWStBX7A__';

const sectionIcons: Record<string, React.ReactNode> = {
  vocabulary: <BookOpen className="w-6 h-6" />,
  grammar: <PenTool className="w-6 h-6" />,
  listening: <Headphones className="w-6 h-6" />,
  reading: <FileText className="w-6 h-6" />,
  writing: <Pencil className="w-6 h-6" />,
};

const sectionColors: Record<string, string> = {
  vocabulary: 'from-emerald-50 to-emerald-100 border-emerald-200 text-emerald-700',
  grammar: 'from-amber-50 to-amber-100 border-amber-200 text-amber-700',
  listening: 'from-purple-50 to-purple-100 border-purple-200 text-purple-700',
  reading: 'from-indigo-50 to-indigo-100 border-indigo-200 text-indigo-700',
  writing: 'from-orange-50 to-orange-100 border-orange-200 text-orange-700',
};

const iconBgColors: Record<string, string> = {
  vocabulary: 'bg-emerald-100 text-emerald-600',
  grammar: 'bg-amber-100 text-amber-600',
  listening: 'bg-purple-100 text-purple-600',
  reading: 'bg-indigo-100 text-indigo-600',
  writing: 'bg-orange-100 text-orange-600',
};

// ========== PAPER SELECTION PAGE ==========

function PaperSelectionPage({ onSelectPaper }: { onSelectPaper: (paperId: string) => void }) {
  const { papers } = useQuiz();

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FAFBFD] via-white to-[#EEF4FF]">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-50/80 to-transparent z-0" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-16 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 leading-tight">
                English
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                  Proficiency Assessment
                </span>
              </h1>
              <p className="mt-6 text-lg text-slate-600 leading-relaxed max-w-xl">
                Choose an assessment paper to begin. Each paper tests different aspects of English proficiency with unique question formats and difficulty levels.
              </p>
              <div className="mt-6">
                <Link href="/history">
                  <Button variant="outline" className="gap-2 text-slate-600 hover:text-blue-700 hover:border-blue-300">
                    <ClipboardList className="w-4 h-4" />
                    View Test History
                  </Button>
                </Link>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="hidden lg:block"
            >
              <div className="relative">
                <div className="absolute -inset-4 bg-gradient-to-r from-blue-200 to-indigo-200 rounded-3xl blur-2xl opacity-30" />
                <img
                  src={HERO_IMAGE}
                  alt="English Learning Illustration"
                  className="relative w-full rounded-2xl"
                />
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Paper Selection */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Choose Your Assessment</h2>
          <p className="text-slate-500 mb-8">Select a paper to view its details and start the assessment.</p>
        </motion.div>

        <div className="grid sm:grid-cols-2 gap-6">
          {papers.map((paper: Paper, i: number) => (
            <motion.button
              key={paper.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.5 + i * 0.15 }}
              onClick={() => onSelectPaper(paper.id)}
              className="group relative text-left rounded-2xl border-2 border-slate-200 bg-white p-8 hover:shadow-xl hover:border-blue-300 transition-all duration-300 hover:-translate-y-1"
            >
              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <ArrowRight className="w-5 h-5 text-blue-500" />
              </div>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl" style={{ backgroundColor: paper.color + '15', color: paper.color }}>
                  {paper.icon}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-800 group-hover:text-blue-700 transition-colors">{paper.title}</h3>

                </div>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed mb-5">{paper.description}</p>
              <div className="flex flex-wrap gap-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold">
                  <BookOpen className="w-3.5 h-3.5" />
                  {paper.sections.length} Sections
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold">
                  <GraduationCap className="w-3.5 h-3.5" />
                  {paper.totalQuestions} Questions
                </span>

              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ========== PAPER LANDING PAGE (after selecting a paper) ==========

function PaperLandingPage({ paper, onBack }: { paper: Paper; onBack: () => void }) {
  const [showInfoForm, setShowInfoForm] = useState(false);

  if (showInfoForm) {
    return <StudentInfoForm />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FAFBFD] via-white to-[#EEF4FF]">
      {/* Header with back button */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-50/80 to-transparent z-0" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16 relative z-10">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-6 transition-colors"
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
              <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight">
                {paper.title}
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 text-2xl sm:text-3xl mt-1">
                  {paper.subtitle}
                </span>
              </h1>
              <p className="mt-6 text-lg text-slate-600 leading-relaxed max-w-xl">
                {paper.description}
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Button
                  size="lg"
                  onClick={() => setShowInfoForm(true)}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-8 py-6 text-lg rounded-xl shadow-lg shadow-blue-200 hover:shadow-xl hover:shadow-blue-300 transition-all duration-300"
                >
                  Start Assessment
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </div>
              <div className="mt-8 flex items-center gap-6 text-sm text-slate-500">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-xs">{paper.sections.length}</div>
                  <span>Sections</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 font-bold text-xs">{paper.totalQuestions}</div>
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
                <div className="absolute -inset-4 bg-gradient-to-r from-blue-200 to-indigo-200 rounded-3xl blur-2xl opacity-30" />
                <img
                  src={HERO_IMAGE}
                  alt="English Learning Illustration"
                  className="relative w-full rounded-2xl"
                />
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Sections Overview */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Assessment Sections</h2>
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
