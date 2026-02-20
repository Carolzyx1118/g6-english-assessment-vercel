import { trpc } from '@/lib/trpc';
import { useState } from 'react';
import { Link } from 'wouter';
import { ArrowLeft, Trash2, Calendar, Clock, Award, User, BookOpen, ChevronDown, ChevronUp, Lock, ShieldCheck, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { generateReportPDF, type PDFData } from '@/lib/generatePDF';

const HISTORY_PASSWORD = import.meta.env.VITE_HISTORY_PASSWORD || '';

type Lang = 'en' | 'cn';

function PasswordGate({ onUnlock }: { onUnlock: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [shaking, setShaking] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === HISTORY_PASSWORD) {
      sessionStorage.setItem('history_unlocked', 'true');
      onUnlock();
    } else {
      setError(true);
      setShaking(true);
      setTimeout(() => setShaking(false), 500);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`bg-white rounded-2xl shadow-lg border border-slate-200 p-8 w-full max-w-sm ${shaking ? 'animate-[shake_0.5s_ease-in-out]' : ''}`}
      >
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mb-4">
            <Lock className="w-8 h-8 text-blue-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-800">Access Protected</h2>
          <p className="text-sm text-slate-500 mt-1 text-center">Enter password to view test history</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(false); }}
              placeholder="Enter password"
              className={`w-full px-4 py-3 rounded-lg border-2 text-center text-lg tracking-widest transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300 ${
                error ? 'border-red-400 bg-red-50' : 'border-slate-200 bg-slate-50 focus:border-blue-400'
              }`}
              autoFocus
            />
            {error && (
              <p className="text-sm text-red-500 mt-2 text-center">Incorrect password, please try again</p>
            )}
          </div>
          <Button type="submit" className="w-full gap-2" size="lg">
            <ShieldCheck className="w-4 h-4" />
            Unlock
          </Button>
        </form>
        <div className="mt-4 text-center">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-1.5 text-slate-500">
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Home
            </Button>
          </Link>
        </div>
      </motion.div>
    </div>
  );
}

export default function History() {
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem('history_unlocked') === 'true');

  if (!unlocked) {
    return <PasswordGate onUnlock={() => setUnlocked(true)} />;
  }

  return <HistoryContent />;
}

function HistoryContent() {
  const { data: results, isLoading, refetch } = trpc.results.list.useQuery();
  const deleteMutation = trpc.results.delete.useMutation({
    onSuccess: () => refetch(),
  });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [lang, setLang] = useState<Lang>('en');
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const { data: detail } = trpc.results.getById.useQuery(
    { id: selectedId! },
    { enabled: selectedId !== null }
  );

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleDateString('zh-CN', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const formatTime = (seconds: number | null) => {
    if (!seconds) return '--';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s.toString().padStart(2, '0')}s`;
  };

  const getGradeInfo = (correct: number, total: number) => {
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    if (pct >= 90) return { grade: 'A', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
    if (pct >= 75) return { grade: 'B', color: 'bg-blue-100 text-blue-700 border-blue-200' };
    if (pct >= 60) return { grade: 'C', color: 'bg-amber-100 text-amber-700 border-amber-200' };
    return { grade: 'D', color: 'bg-red-100 text-red-700 border-red-200' };
  };

  const handleDownloadPDF = async (recordId: number) => {
    setDownloadingId(recordId);
    try {
      // Fetch the full record from the API
      // We need to use the detail if it's already loaded, otherwise we'll use the trpc client directly
      const fullRecord = selectedId === recordId && detail ? detail : null;
      if (!fullRecord) {
        // We need to expand this record first to load its data
        setSelectedId(recordId);
        // Wait a bit for the query to load
        setTimeout(async () => {
          setDownloadingId(null);
        }, 500);
        return;
      }

      const pdfData: PDFData = {
        studentName: fullRecord.studentName,
        studentGrade: fullRecord.studentGrade,
        paperTitle: fullRecord.paperTitle,
        totalCorrect: fullRecord.totalCorrect,
        totalQuestions: fullRecord.totalQuestions,
        totalTimeSeconds: fullRecord.totalTimeSeconds,
        scoreBySectionJson: fullRecord.scoreBySectionJson,
        sectionTimingsJson: fullRecord.sectionTimingsJson,
        readingResultsJson: fullRecord.readingResultsJson,
        writingResultJson: fullRecord.writingResultJson,
        explanationsJson: fullRecord.explanationsJson,
        reportJson: fullRecord.reportJson,
        createdAt: fullRecord.createdAt,
      };

      await generateReportPDF(pdfData);
    } catch (err) {
      console.error('[History] PDF download failed:', err);
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-slate-200/60 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2 text-slate-600 hover:text-slate-900">
              <ArrowLeft className="w-4 h-4" />
              {lang === 'en' ? 'Back to Home' : '返回首页'}
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-slate-800">
              {lang === 'en' ? '📋 Test History' : '📋 测试历史'}
            </h1>
            <p className="text-sm text-slate-500">
              {lang === 'en' ? 'View all past assessment results' : '查看所有历史测试成绩'}
            </p>
          </div>
          <button onClick={() => setLang(lang === 'en' ? 'cn' : 'en')}
            className="px-3 py-1.5 rounded-full bg-violet-100 text-violet-700 text-sm font-medium hover:bg-violet-200 transition">
            {lang === 'en' ? '中文' : 'EN'}
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            <p className="text-slate-500">{lang === 'en' ? 'Loading results...' : '加载中...'}</p>
          </div>
        ) : !results || results.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <BookOpen className="w-16 h-16 text-slate-300" />
            <p className="text-lg text-slate-400 font-medium">
              {lang === 'en' ? 'No test results yet' : '暂无测试记录'}
            </p>
            <Link href="/">
              <Button variant="default" className="gap-2">
                {lang === 'en' ? 'Take an Assessment' : '开始测试'}
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-slate-500">
                {lang === 'en' ? `${results.length} record(s)` : `共 ${results.length} 条记录`}
              </p>
            </div>

            {/* Results list */}
            {[...results].reverse().map((r) => {
              const gradeInfo = getGradeInfo(r.totalCorrect, r.totalQuestions);
              const pct = r.totalQuestions > 0 ? Math.round((r.totalCorrect / r.totalQuestions) * 100) : 0;
              const isExpanded = selectedId === r.id;

              return (
                <motion.div key={r.id}
                  layout
                  className="bg-white rounded-xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                  {/* Summary row */}
                  <div className="p-4 sm:p-5 cursor-pointer" onClick={() => setSelectedId(isExpanded ? null : r.id)}>
                    <div className="flex items-center gap-4">
                      {/* Grade badge */}
                      <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-2xl font-bold border ${gradeInfo.color}`}>
                        {gradeInfo.grade}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-slate-800 truncate">{r.paperTitle}</h3>
                          {r.hasReport && (
                            <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">
                              {lang === 'en' ? 'AI Report' : 'AI报告'}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-slate-500 flex-wrap">
                          <span className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5" />
                            {r.studentName}
                            {r.studentGrade && <span className="text-slate-400">({r.studentGrade})</span>}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {formatDate(r.createdAt)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {formatTime(r.totalTimeSeconds)}
                          </span>
                        </div>
                      </div>

                      {/* Score */}
                      <div className="text-right flex items-center gap-3">
                        <div>
                          <div className="text-lg font-bold text-slate-800">
                            {r.totalCorrect}/{r.totalQuestions}
                          </div>
                          <div className="text-sm text-slate-500">{pct}%</div>
                        </div>
                        {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  <AnimatePresence>
                    {isExpanded && detail && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="border-t border-slate-100">
                        <div className="p-5 space-y-5">
                          {/* Section scores */}
                          {detail.scoreBySectionJson && (
                            <div>
                              <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                                <Award className="w-4 h-4 text-amber-500" />
                                {lang === 'en' ? 'Score Breakdown' : '分数明细'}
                              </h4>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {Object.entries(JSON.parse(detail.scoreBySectionJson) as Record<string, { correct: number; total: number }>).map(([key, val]) => (
                                  <div key={key} className="bg-slate-50 rounded-lg p-3 text-center border border-slate-100">
                                    <div className="text-xs text-slate-500 capitalize mb-1">{key}</div>
                                    <div className="text-lg font-bold text-slate-800">{val.correct}/{val.total}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* AI Report summary */}
                          {detail.reportJson && (() => {
                            try {
                              const rpt = JSON.parse(detail.reportJson);
                              return (
                                <div>
                                  <h4 className="text-sm font-semibold text-slate-700 mb-3">
                                    {lang === 'en' ? '🤖 AI Proficiency Report' : '🤖 AI能力报告'}
                                  </h4>
                                  <div className="bg-gradient-to-r from-violet-50 to-blue-50 rounded-lg p-4 border border-violet-100">
                                    <div className="flex items-center gap-3 mb-3">
                                      <span className="px-3 py-1 rounded-full bg-violet-200 text-violet-800 font-bold text-sm">
                                        {rpt.languageLevel}
                                      </span>
                                    </div>
                                    <p className="text-sm text-slate-700 leading-relaxed">
                                      {lang === 'en' ? rpt.summary_en : rpt.summary_cn}
                                    </p>
                                    {((lang === 'en' ? rpt.strengths_en : rpt.strengths_cn) || []).length > 0 && (
                                      <div className="mt-3">
                                        <p className="text-xs font-semibold text-emerald-700 mb-1">
                                          {lang === 'en' ? 'Strengths:' : '优势：'}
                                        </p>
                                        <ul className="text-sm text-slate-600 space-y-1">
                                          {((lang === 'en' ? rpt.strengths_en : rpt.strengths_cn) || []).map((s: string, i: number) => (
                                            <li key={i} className="flex items-start gap-1.5">
                                              <span className="text-emerald-500 mt-0.5">✓</span> {s}
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                    {((lang === 'en' ? rpt.weaknesses_en : rpt.weaknesses_cn) || []).length > 0 && (
                                      <div className="mt-3">
                                        <p className="text-xs font-semibold text-amber-700 mb-1">
                                          {lang === 'en' ? 'Areas to Improve:' : '待提高：'}
                                        </p>
                                        <ul className="text-sm text-slate-600 space-y-1">
                                          {((lang === 'en' ? rpt.weaknesses_en : rpt.weaknesses_cn) || []).map((s: string, i: number) => (
                                            <li key={i} className="flex items-start gap-1.5">
                                              <span className="text-amber-500 mt-0.5">△</span> {s}
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            } catch { return null; }
                          })()}

                          {/* Actions */}
                          <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
                            {/* Download PDF button */}
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200"
                              disabled={downloadingId === r.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownloadPDF(r.id);
                              }}
                            >
                              {downloadingId === r.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Download className="w-3.5 h-3.5" />
                              )}
                              {lang === 'en' ? 'Download PDF' : '下载PDF报告'}
                            </Button>

                            {/* Delete button */}
                            {confirmDeleteId === r.id ? (
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-red-600">
                                  {lang === 'en' ? 'Confirm delete?' : '确认删除？'}
                                </span>
                                <Button size="sm" variant="destructive"
                                  onClick={(e) => { e.stopPropagation(); deleteMutation.mutate({ id: r.id }); setConfirmDeleteId(null); setSelectedId(null); }}>
                                  {lang === 'en' ? 'Yes, Delete' : '确认'}
                                </Button>
                                <Button size="sm" variant="ghost"
                                  onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }}>
                                  {lang === 'en' ? 'Cancel' : '取消'}
                                </Button>
                              </div>
                            ) : (
                              <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700 hover:bg-red-50 gap-1.5"
                                onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(r.id); }}>
                                <Trash2 className="w-3.5 h-3.5" />
                                {lang === 'en' ? 'Delete' : '删除'}
                              </Button>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
