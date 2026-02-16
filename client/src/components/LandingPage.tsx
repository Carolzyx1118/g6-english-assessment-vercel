import { useQuiz } from '@/contexts/QuizContext';
import { Button } from '@/components/ui/button';
import { sections } from '@/data/questions';
import { motion } from 'framer-motion';
import { BookOpen, Headphones, PenTool, FileText, ArrowRight } from 'lucide-react';

const HERO_IMAGE = 'https://private-us-east-1.manuscdn.com/sessionFile/EkfYMR94S7iTs27MlKPHhG/sandbox/EXd2rAVuTpleP76sVHRwu5-img-1_1771255551000_na1fn_aGVyby1iYW5uZXI.png?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvRWtmWU1SOTRTN2lUczI3TWxLUEhoRy9zYW5kYm94L0VYZDJyQVZ1VHBsZVA3NnNWSFJ3dTUtaW1nLTFfMTc3MTI1NTU1MTAwMF9uYTFmbl9hR1Z5YnkxaVlXNXVaWEkucG5nP3gtb3NzLXByb2Nlc3M9aW1hZ2UvcmVzaXplLHdfMTkyMCxoXzE5MjAvZm9ybWF0LHdlYnAvcXVhbGl0eSxxXzgwIiwiQ29uZGl0aW9uIjp7IkRhdGVMZXNzVGhhbiI6eyJBV1M6RXBvY2hUaW1lIjoxNzk4NzYxNjAwfX19XX0_&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=I5fojTC3dYU1azrXcxeOhHGaexKXmznPAcGFS~lV8L7Mg4foEr2gVTG8bWCRAFcNxWpHkpz6nN2LYnhtbkVgpR6LJgFhSgixOlBrFTrn10YhLyMDjFH395DUPFebb3vmNWW4AtScobvWAmQKFCbyRkSCwV2lqQjc6UtGXWp0UNZVGZU93MZ-Lc6Tnjz7Y-~D1BRvpGWq8tZLrE1EeyFCN-2QxJNOaJrlvv0Zqp443MkcRgAiOKhqYi8Jux0MB8ue0LLEMJZ7GIRQOzu1lbf6FHGk5jHn3ctuue-nzVHvjc~hX60cyBA3odGGtWFaxd56S8rofjTUDitaGRwWStBX7A__';

const sectionIcons: Record<string, React.ReactNode> = {
  listening: <Headphones className="w-6 h-6" />,
  vocabulary: <BookOpen className="w-6 h-6" />,
  grammar: <PenTool className="w-6 h-6" />,
  reading: <FileText className="w-6 h-6" />,
  writing: <PenTool className="w-6 h-6" />,
};

const sectionColors: Record<string, string> = {
  listening: 'from-blue-50 to-blue-100 border-blue-200 text-blue-700',
  vocabulary: 'from-emerald-50 to-emerald-100 border-emerald-200 text-emerald-700',
  grammar: 'from-amber-50 to-amber-100 border-amber-200 text-amber-700',
  reading: 'from-indigo-50 to-indigo-100 border-indigo-200 text-indigo-700',
  writing: 'from-rose-50 to-rose-100 border-rose-200 text-rose-700',
};

const iconBgColors: Record<string, string> = {
  listening: 'bg-blue-100 text-blue-600',
  vocabulary: 'bg-emerald-100 text-emerald-600',
  grammar: 'bg-amber-100 text-amber-600',
  reading: 'bg-indigo-100 text-indigo-600',
  writing: 'bg-rose-100 text-rose-600',
};

export default function LandingPage() {
  const { startQuiz } = useQuiz();

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FAFBFD] via-white to-[#EEF4FF]">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-50/80 to-transparent z-0" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-16 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Text */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-sm font-medium mb-6">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                HCI Secondary 1 Entrance
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 leading-tight">
                G6 English
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                  Proficiency Assessment
                </span>
              </h1>
              <p className="mt-6 text-lg text-slate-600 leading-relaxed max-w-xl">
                Test your English proficiency across listening, vocabulary, grammar, reading comprehension, and writing. Complete all sections to receive your assessment results.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Button
                  size="lg"
                  onClick={startQuiz}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-8 py-6 text-lg rounded-xl shadow-lg shadow-blue-200 hover:shadow-xl hover:shadow-blue-300 transition-all duration-300"
                >
                  Start Assessment
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </div>
              <div className="mt-8 flex items-center gap-6 text-sm text-slate-500">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-xs">5</div>
                  <span>Sections</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 font-bold text-xs">46</div>
                  <span>Questions</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 font-bold text-xs">
                    <Headphones className="w-4 h-4" />
                  </div>
                  <span>Audio</span>
                </div>
              </div>
            </motion.div>

            {/* Right: Hero Image */}
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

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {sections.map((section, i) => (
            <motion.div
              key={section.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.5 + i * 0.1 }}
              className={`relative group rounded-xl border bg-gradient-to-br ${sectionColors[section.id]} p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-1`}
            >
              <div className={`w-12 h-12 rounded-xl ${iconBgColors[section.id]} flex items-center justify-center mb-4`}>
                {sectionIcons[section.id]}
              </div>
              <h3 className="font-bold text-lg mb-1">{section.title}</h3>
              <p className="text-sm opacity-80 mb-3">{section.subtitle}</p>
              <p className="text-sm opacity-70 leading-relaxed">{section.description}</p>
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
