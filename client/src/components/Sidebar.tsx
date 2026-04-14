import { useQuiz } from '@/contexts/QuizContext';
import { Clock3, ScrollText } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

interface SidebarProps {
  onNavigate?: () => void;
}

function normalizeSummaryText(value?: string) {
  return value?.trim().replace(/\s+/g, ' ').toLowerCase() || '';
}

function isAnsweredValue(value: unknown) {
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value);
  }
  return false;
}

function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export default function Sidebar({ onNavigate }: SidebarProps) {
  const { state, sections, selectedPaper, setCurrentSection, getSectionProgress } = useQuiz();
  const [elapsedSeconds, setElapsedSeconds] = useState(() => (
    state.startTime ? Math.max(0, Math.floor((Date.now() - state.startTime) / 1000)) : 0
  ));
  const overviewTitle = selectedPaper?.subtitle?.trim();
  const overviewBody = selectedPaper?.description?.trim();
  const showOverviewTitle = Boolean(overviewTitle) && normalizeSummaryText(overviewTitle) !== normalizeSummaryText(overviewBody);
  const showOverview = Boolean(overviewBody || showOverviewTitle);
  const currentSection = sections[state.currentSectionIndex];

  useEffect(() => {
    if (!state.startTime || state.submitted) return;

    const tick = () => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - state.startTime!) / 1000)));
    };

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [state.startTime, state.submitted]);

  const questionEntries = useMemo(() => {
    let currentNumber = 1;

    return sections.flatMap((section, sectionIndex) =>
      (section.questions || []).map((question) => {
        const answer = state.answers[`${section.id}:${question.id}`];
        const entry = {
          id: `${section.id}:${question.id}`,
          number: currentNumber,
          sectionIndex,
          sectionTitle: section.title,
          answered: isAnsweredValue(answer),
          current: sectionIndex === state.currentSectionIndex,
        };
        currentNumber += 1;
        return entry;
      }),
    );
  }, [sections, state.answers, state.currentSectionIndex]);

  const totalAnswered = questionEntries.filter((entry) => entry.answered).length;
  const totalQuestions = questionEntries.length;
  const currentProgress = currentSection ? getSectionProgress(currentSection.id) : { answered: 0, total: 0 };

  return (
    <div className="pureon-practice-side">
      <div className="pureon-side-card">
        <h4>计时器 / Timer</h4>
        <div className="pureon-timer">{formatDuration(elapsedSeconds)}</div>
        <div className="pureon-timer-label">ELAPSED</div>
      </div>

      <div className="pureon-side-card">
        <h4>题目导航 / Question Map</h4>
        <div className="pureon-qnav">
          {questionEntries.map((entry) => (
            <button
              key={entry.id}
              type="button"
              data-state={entry.current ? 'current' : entry.answered ? 'done' : 'idle'}
              onClick={() => {
                setCurrentSection(entry.sectionIndex);
                onNavigate?.();
              }}
              title={`${entry.sectionTitle} · Question ${entry.number}`}
            >
              {entry.number}
            </button>
          ))}
        </div>
        <div className="pureon-qnav-meta">
          <div>✓ 已答 {totalAnswered} · ○ 未答 {Math.max(totalQuestions - totalAnswered, 0)}</div>
          {currentSection ? <div>当前部分 · {currentSection.title}</div> : null}
        </div>
      </div>

      <div className="pureon-side-card">
        <h4>本节统计 / Stats</h4>
        <div className="space-y-2 text-[12px] leading-7 text-[var(--pureon-muted)]">
          {currentSection ? (
            <>
              <div>
                当前章节 · <strong className="text-[var(--pureon-teal)]">{currentSection.title}</strong>
              </div>
              <div>
                章节进度 · <strong className="text-[var(--pureon-teal)]">{currentProgress.answered}/{currentProgress.total}</strong>
              </div>
              <div>
                总章节数 · <strong>{sections.length}</strong>
              </div>
              <div>
                当前位置 · <strong>Part {state.currentSectionIndex + 1}</strong>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {showOverview ? (
        <div className="pureon-side-card">
          <h4>试卷说明 / Overview</h4>
          <div className="flex items-start gap-3 text-[12px] leading-7 text-[var(--pureon-muted)]">
            <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center border border-[var(--border)] bg-[var(--pureon-paper)] text-[var(--pureon-teal)]">
              <ScrollText className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              {showOverviewTitle ? (
                <div className="font-semibold text-[var(--pureon-teal)]">{overviewTitle}</div>
              ) : null}
              {overviewBody ? <p>{overviewBody}</p> : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
