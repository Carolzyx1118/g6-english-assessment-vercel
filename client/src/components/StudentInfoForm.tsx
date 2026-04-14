import { useState } from 'react';
import { useQuiz, type StudentInfo } from '@/contexts/QuizContext';
import PureonFooter from '@/components/PureonFooter';
import StudentWorkspaceTopBar from '@/components/StudentWorkspaceTopBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion } from 'framer-motion';
import { ArrowRight, ArrowLeft, User, GraduationCap } from 'lucide-react';

interface StudentInfoFormProps {
  onBack?: () => void;
}

export default function StudentInfoForm({ onBack }: StudentInfoFormProps) {
  const { studentInfo, setStudentInfo, startQuiz, resetQuiz, isStarted } = useQuiz();
  const [form, setForm] = useState<StudentInfo>({
    name: studentInfo?.name ?? '',
    grade: studentInfo?.grade ?? '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof StudentInfo, string>>>({});

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof StudentInfo, string>> = {};
    if (!form.name.trim()) {
      newErrors.name = 'Please enter your name';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setStudentInfo(form);
    if (!isStarted) {
      startQuiz(form);
    }
  };

  return (
    <div className="pureon-page-shell">
      <StudentWorkspaceTopBar
        active="practice"
        onHomeClick={onBack ?? resetQuiz}
        onQuestionBankClick={onBack ?? resetQuiz}
      />

      <div className="pureon-container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="pureon-page-head">
            <div>
              <div className="pureon-section-eyebrow">Before You Begin · 开始前</div>
              <h1 className="pureon-page-title mt-2">填写学生信息</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--pureon-muted)]">
                开始练习前确认你的姓名和年级信息，提交后会直接进入答题流程。
              </p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
            <motion.div
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35, delay: 0.1 }}
              className="relative overflow-hidden border border-[rgba(201,164,97,0.35)] bg-[var(--pureon-teal)] px-8 py-10 text-[var(--pureon-paper)] shadow-[0_30px_80px_-30px_rgba(45,74,62,0.35)]"
            >
              <div className="absolute right-[-3rem] top-[-2rem] h-44 w-44 rounded-full bg-[rgba(201,164,97,0.12)] blur-3xl" />
              <div className="absolute bottom-[-4rem] left-[-2rem] h-40 w-40 rounded-full bg-[rgba(43,88,118,0.2)] blur-3xl" />
              <div className="relative">
                <div className="inline-flex h-16 w-16 items-center justify-center rounded-full border border-[rgba(201,164,97,0.35)] bg-[rgba(245,239,224,0.08)] text-[var(--pureon-gold)]">
                  <User className="h-7 w-7" />
                </div>
                <h2 className="mt-8 font-[family-name:var(--font-body)] text-[2rem] font-semibold tracking-[0.18em] text-[var(--pureon-paper)]">
                  学生档案
                </h2>
                <div className="mt-2 font-[family-name:var(--font-display)] text-[0.78rem] uppercase tracking-[0.32em] text-[var(--pureon-gold-soft)]">
                  Student Identification
                </div>
                <div className="mt-8 border-l-2 border-[var(--pureon-gold)] pl-4 text-sm leading-8 text-[rgba(245,239,224,0.78)]">
                  玉不琢，不成器；人不学，不知道。<br />
                  Before the assessment begins, record the student identity clearly and keep the work traceable.
                </div>
                <div className="mt-10 grid gap-4 sm:grid-cols-2">
                  <div className="border border-[rgba(201,164,97,0.25)] bg-[rgba(245,239,224,0.04)] px-4 py-4">
                    <div className="font-[family-name:var(--font-display)] text-[0.68rem] uppercase tracking-[0.18em] text-[rgba(245,239,224,0.62)]">
                      Required
                    </div>
                    <div className="mt-2 text-sm text-[var(--pureon-paper)]">姓名为必填项</div>
                  </div>
                  <div className="border border-[rgba(201,164,97,0.25)] bg-[rgba(245,239,224,0.04)] px-4 py-4">
                    <div className="font-[family-name:var(--font-display)] text-[0.68rem] uppercase tracking-[0.18em] text-[rgba(245,239,224,0.62)]">
                      Optional
                    </div>
                    <div className="mt-2 text-sm text-[var(--pureon-paper)]">年级可选填</div>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.form
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35, delay: 0.15 }}
              onSubmit={handleSubmit}
              className="pureon-panel space-y-6 px-8 py-10"
            >
              <div>
                <div className="pureon-section-eyebrow">Student Form</div>
                <h2 className="mt-2 font-[family-name:var(--font-body)] text-[1.6rem] font-semibold tracking-[0.08em] text-[var(--pureon-teal)]">
                  录入基础信息
                </h2>
                <p className="mt-3 text-sm leading-7 text-[var(--pureon-muted)]">
                  填完后会继续进入当前试卷；如果你已经开始过，本页会作为继续作答入口。
                </p>
              </div>

              <div>
                <label className="mb-3 flex items-center gap-2 font-[family-name:var(--font-display)] text-[0.72rem] uppercase tracking-[0.22em] text-[var(--pureon-muted)]">
                  <User className="h-4 w-4 text-[var(--pureon-teal)]" />
                  姓名 / Name <span className="text-[var(--pureon-red)]">*</span>
                </label>
                <Input
                  value={form.name}
                  onChange={(e) => {
                    setForm(prev => ({ ...prev, name: e.target.value }));
                    if (errors.name) setErrors(prev => ({ ...prev, name: undefined }));
                  }}
                  placeholder="Enter your full name"
                  className={`h-12 rounded-none border-x-0 border-t-0 border-b bg-transparent px-0 text-base shadow-none focus-visible:ring-0 ${
                    errors.name
                      ? 'border-[var(--pureon-red)]'
                      : 'border-[var(--pureon-rule)] focus-visible:border-[var(--pureon-teal)]'
                  }`}
                />
                {errors.name ? (
                  <p className="mt-2 text-sm text-[var(--pureon-red)]">{errors.name}</p>
                ) : null}
              </div>

              <div>
                <label className="mb-3 flex items-center gap-2 font-[family-name:var(--font-display)] text-[0.72rem] uppercase tracking-[0.22em] text-[var(--pureon-muted)]">
                  <GraduationCap className="h-4 w-4 text-[var(--pureon-gold)]" />
                  年级 / Grade
                </label>
                <Input
                  value={form.grade}
                  onChange={(e) => setForm(prev => ({ ...prev, grade: e.target.value }))}
                  placeholder="e.g. Grade 6, P6"
                  className="h-12 rounded-none border-x-0 border-t-0 border-b border-[var(--pureon-rule)] bg-transparent px-0 text-base shadow-none focus-visible:border-[var(--pureon-teal)] focus-visible:ring-0"
                />
              </div>

              <div className="border border-dashed border-[rgba(201,164,97,0.7)] bg-[rgba(201,164,97,0.05)] px-4 py-4 text-sm leading-7 text-[var(--pureon-muted)]">
                带 <span className="text-[var(--pureon-red)]">*</span> 的字段为必填。其余信息只用于结果页展示，不影响开始答题。
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onBack ?? resetQuiz}
                  className="border-[var(--pureon-teal)] bg-transparent text-[var(--pureon-teal)] hover:bg-[var(--pureon-teal)] hover:text-[var(--pureon-paper)] sm:flex-1"
                >
                  <ArrowLeft className="h-4 w-4" />
                  {onBack ? '返回试卷' : '返回首页'}
                </Button>
                <Button
                  type="submit"
                  className="bg-[var(--pureon-teal)] text-[var(--pureon-paper)] hover:bg-[var(--pureon-ink)] sm:flex-1"
                >
                  {isStarted ? '继续练习' : '开始练习'}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </motion.form>
          </div>

          <PureonFooter note="Student Information / 学生信息" />
        </motion.div>
      </div>
    </div>
  );
}
