import { useState } from 'react';
import { useQuiz, type StudentInfo } from '@/contexts/QuizContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion } from 'framer-motion';
import { ArrowRight, User, GraduationCap } from 'lucide-react';

export default function StudentInfoForm() {
  const { setStudentInfo, startQuiz } = useQuiz();
  const [form, setForm] = useState<StudentInfo>({
    name: '',
    grade: '',
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
    startQuiz();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen bg-gradient-to-br from-[#FAFBFD] via-white to-[#EEF4FF] flex items-center justify-center px-4"
    >
      <div className="w-full max-w-lg">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="text-center mb-8"
        >
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
            Student <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Information</span>
          </h1>
          <p className="mt-3 text-base text-slate-500">
            Please fill in your details before starting the assessment.
          </p>
        </motion.div>

        <motion.form
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl border border-slate-200 shadow-lg p-8 space-y-5"
        >
          {/* Name - Required */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
              <User className="w-4 h-4 text-blue-500" />
              Name <span className="text-red-400">*</span>
            </label>
            <Input
              value={form.name}
              onChange={(e) => {
                setForm(prev => ({ ...prev, name: e.target.value }));
                if (errors.name) setErrors(prev => ({ ...prev, name: undefined }));
              }}
              placeholder="Enter your full name"
              className={`h-12 text-base ${errors.name ? 'border-red-300 focus-visible:ring-red-200' : ''}`}
            />
            {errors.name && (
              <p className="mt-1.5 text-sm text-red-500">{errors.name}</p>
            )}
          </div>

          {/* Grade */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
              <GraduationCap className="w-4 h-4 text-emerald-500" />
              Grade
            </label>
            <Input
              value={form.grade}
              onChange={(e) => setForm(prev => ({ ...prev, grade: e.target.value }))}
              placeholder="e.g. Grade 6, P6"
              className="h-12 text-base"
            />
          </div>

          <div className="pt-3">
            <Button
              type="submit"
              size="lg"
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-6 text-lg rounded-xl shadow-lg shadow-blue-200 hover:shadow-xl hover:shadow-blue-300 transition-all duration-300"
            >
              Start Assessment
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </div>

          <p className="text-xs text-slate-400 text-center">
            Fields marked with <span className="text-red-400">*</span> are required. Other fields are optional.
          </p>
        </motion.form>
      </div>
    </motion.div>
  );
}
