import PureonFooter from '@/components/PureonFooter';
import ResultsPage from '@/components/ResultsPage';
import SectionContent from '@/components/SectionContent';
import Sidebar from '@/components/Sidebar';
import StudentWorkspaceTopBar from '@/components/StudentWorkspaceTopBar';
import { Button } from '@/components/ui/button';
import { useQuiz } from '@/contexts/QuizContext';
import { PAPER_SUBJECT_LABELS } from '@/data/papers';
import { AlertTriangle, LogOut, Send } from 'lucide-react';
import { useEffect, useState } from 'react';

function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export default function QuizLayout() {
  const { state, resetQuiz, submitQuiz, sections, selectedPaper, getSectionProgress } = useQuiz();
  const [activeConfirm, setActiveConfirm] = useState<'exit' | 'submit' | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(() => (
    state.startTime ? Math.max(0, Math.floor((Date.now() - state.startTime) / 1000)) : 0
  ));

  const totalAnswered = sections.reduce((sum, section) => sum + getSectionProgress(section.id).answered, 0);
  const totalQuestions = sections.reduce((sum, section) => sum + getSectionProgress(section.id).total, 0);
  const unanswered = totalQuestions - totalAnswered;
  const progressPercent = sections.length > 0 ? ((state.currentSectionIndex + 1) / sections.length) * 100 : 0;
  const currentSection = sections[state.currentSectionIndex];

  useEffect(() => {
    setActiveConfirm(null);
  }, [state.currentSectionIndex]);

  useEffect(() => {
    if (!state.startTime || state.submitted) return;

    const tick = () => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - state.startTime!) / 1000)));
    };

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [state.startTime, state.submitted]);

  if (state.submitted) {
    return <ResultsPage />;
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <StudentWorkspaceTopBar
        active="practice"
        onHomeClick={() => setActiveConfirm('exit')}
      />

      <div className="pureon-container">
        <div className="pureon-page-head">
          <div>
            <div className="pureon-section-eyebrow">
              Practice Mode · {selectedPaper ? PAPER_SUBJECT_LABELS[selectedPaper.subject] : 'Assessment'}
            </div>
            <h1 className="pureon-page-title mt-2">{selectedPaper?.title || currentSection?.title || 'Practice'}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--pureon-muted)]">
              {currentSection?.description || 'Work through each part in order, then submit for grading and review.'}
            </p>
          </div>
          <div className="pureon-page-head-actions">
            <Button
              variant="outline"
              onClick={() => setActiveConfirm('exit')}
              className="border-[var(--pureon-red)] bg-transparent text-[var(--pureon-red)] hover:bg-[var(--pureon-red)] hover:text-[var(--pureon-paper)]"
            >
              <LogOut className="h-4 w-4" />
              退出练习
            </Button>
            <Button
              onClick={() => setActiveConfirm('submit')}
              className="bg-[var(--pureon-teal)] text-[var(--pureon-paper)] hover:bg-[var(--pureon-ink)]"
            >
              <Send className="h-4 w-4" />
              提交交卷
            </Button>
          </div>
        </div>

        {activeConfirm ? (
          <div className="mb-6 border border-[var(--pureon-gold)] bg-[rgba(201,164,97,0.08)] p-5">
            {activeConfirm === 'exit' ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--pureon-gold)]" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-[var(--pureon-teal)]">退出当前练习？</div>
                  <p className="mt-1 text-sm leading-7 text-[var(--pureon-muted)]">
                    退出后会清空这次作答并返回试卷选择页。
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        setActiveConfirm(null);
                        resetQuiz();
                      }}
                    >
                      确认退出
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-[var(--pureon-teal)] bg-transparent text-[var(--pureon-teal)] hover:bg-[var(--pureon-teal)] hover:text-[var(--pureon-paper)]"
                      onClick={() => setActiveConfirm(null)}
                    >
                      继续作答
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--pureon-gold)]" />
                <div className="min-w-0 flex-1">
                  {unanswered > 0 ? (
                    <div className="text-sm leading-7 text-[var(--pureon-muted)]">
                      你还有 <strong className="text-[var(--pureon-red)]">{unanswered}</strong> 题未作答。
                    </div>
                  ) : null}
                  <p className="text-sm leading-7 text-[var(--pureon-muted)]">
                    确认提交后将进入评分与报告页面，当前作答不可撤销。
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      onClick={() => {
                        submitQuiz();
                        setActiveConfirm(null);
                      }}
                      className="bg-[var(--pureon-teal)] text-[var(--pureon-paper)] hover:bg-[var(--pureon-ink)]"
                    >
                      <Send className="h-4 w-4" />
                      确认提交
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-[var(--pureon-teal)] bg-transparent text-[var(--pureon-teal)] hover:bg-[var(--pureon-teal)] hover:text-[var(--pureon-paper)]"
                      onClick={() => setActiveConfirm(null)}
                    >
                      返回作答
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : null}

        <div className="pureon-practice-layout">
          <div className="pureon-practice-main">
            <div className="pureon-practice-progress">
              <div className="pureon-progress-text">
                <strong>第 {state.currentSectionIndex + 1} 部分</strong> / 共 {sections.length} 部分
              </div>
              <div className="pureon-progress-track">
                <span style={{ width: `${progressPercent}%` }} />
              </div>
              <div className="pureon-progress-text">
                已用 <strong>{formatDuration(elapsedSeconds)}</strong>
              </div>
            </div>
            <SectionContent />
          </div>

          <Sidebar />
        </div>
      </div>

      <PureonFooter note="练习模式 / Practice Mode" />
    </div>
  );
}
