import { useQuiz } from '@/contexts/QuizContext';
import type {
  MCQQuestion, PictureMCQ, FillBlankQuestion, ListeningMCQ,
  WordBankFillIn, StoryFillIn, OpenEndedQuestion, TrueFalseQuestion,
  TableQuestion, ReferenceQuestion, OrderQuestion, PhraseQuestion,
  CheckboxQuestion, WritingQuestion, Question, Section
} from '@/data/papers';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Send, AlertTriangle, GripVertical, Play, Pause, Volume2 } from 'lucide-react';
import DragDropFillBlank from '@/components/DragDropFillBlank';
import { useState, useCallback, useRef, useEffect } from 'react';

// ========== PICTURE MCQ (WIDA Vocabulary & Grammar) ==========

function PictureMCQCard({ q, answer, onAnswer }: { q: PictureMCQ; answer?: number; onAnswer: (v: number) => void }) {
  return (
    <div className="space-y-4">
      <p className="text-base text-slate-700 leading-relaxed">
        <span className="font-bold text-slate-500 mr-2">Q{q.id}.</span>
        <span className="font-semibold text-slate-800">"{q.question}"</span>
      </p>
      <div className="grid grid-cols-3 gap-3">
        {q.options.map((opt, i) => {
          const isSelected = answer !== undefined && answer === i;
          return (
            <button
              key={i}
              onClick={() => onAnswer(i)}
              className={`
                relative flex flex-col items-center p-3 rounded-xl border-2 transition-all duration-200
                ${isSelected
                  ? 'border-blue-400 bg-blue-50 shadow-md ring-2 ring-blue-200'
                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm'
                }
              `}
            >
              <span className={`
                absolute top-2 left-2 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                ${isSelected ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500'}
              `}>
                {opt.label}
              </span>
              <img
                src={opt.imageUrl}
                alt={opt.text || `Option ${opt.label}`}
                className="w-full h-24 sm:h-32 object-contain rounded-lg mb-2"
                loading="lazy"
              />
              {opt.text && (
                <span className={`text-xs sm:text-sm text-center ${isSelected ? 'text-blue-700 font-medium' : 'text-slate-500'}`}>
                  {opt.text}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ========== TEXT MCQ (Both papers) ==========

function MCQQuestionCard({ q, answer, onAnswer }: { q: MCQQuestion; answer?: number; onAnswer: (v: number) => void }) {
  // Render question with highlightWord bolded if present
  const renderQuestion = () => {
    if (q.highlightWord) {
      const parts = q.question.split('___');
      if (parts.length === 2) {
        return (
          <>
            {parts[0]}<span className="font-bold text-slate-900 underline decoration-2 decoration-blue-400 underline-offset-2">{q.highlightWord}</span>{parts[1]}
          </>
        );
      }
    }
    return q.question;
  };

  return (
    <div className="space-y-4">
      <p className="text-base text-slate-700 leading-relaxed">
        <span className="font-bold text-slate-500 mr-2">Q{q.id}.</span>
        {renderQuestion()}
      </p>
      {q.imageUrl && (
        <div className="flex justify-center">
          <img
            src={q.imageUrl}
            alt="Question illustration"
            className="max-h-40 object-contain rounded-xl border border-slate-200"
            loading="lazy"
          />
        </div>
      )}
      <div className="grid gap-2.5">
        {q.options.map((opt, i) => {
          const isSelected = answer !== undefined && answer === i;
          const letter = String.fromCharCode(97 + i);
          return (
            <button
              key={i}
              onClick={() => onAnswer(i)}
              className={`
                w-full text-left p-3.5 rounded-xl border-2 transition-all duration-200
                flex items-center gap-3
                ${isSelected
                  ? 'border-blue-400 bg-blue-50 shadow-sm'
                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }
              `}
            >
              <span className={`
                w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0
                ${isSelected ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500'}
              `}>
                {letter}
              </span>
              <span className={`text-base ${isSelected ? 'text-blue-700 font-medium' : 'text-slate-600'}`}>
                {opt}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ========== LISTENING MCQ (WIDA) ==========

function ListeningMCQCard({ q, answer, onAnswer }: { q: ListeningMCQ; answer?: number; onAnswer: (v: number) => void }) {
  return (
    <div className="space-y-4">
      <p className="text-base text-slate-700 leading-relaxed">
        <span className="font-bold text-slate-500 mr-2">Q{q.id}.</span>
        <span className="font-semibold text-slate-800">{q.question}</span>
      </p>
      <div className="grid grid-cols-3 gap-3">
        {q.options.map((opt, i) => {
          const isSelected = answer !== undefined && answer === i;
          return (
            <button
              key={i}
              onClick={() => onAnswer(i)}
              className={`
                relative flex flex-col items-center p-3 rounded-xl border-2 transition-all duration-200
                ${isSelected
                  ? 'border-purple-400 bg-purple-50 shadow-md ring-2 ring-purple-200'
                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm'
                }
              `}
            >
              <span className={`
                absolute top-2 left-2 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                ${isSelected ? 'bg-purple-500 text-white' : 'bg-slate-100 text-slate-500'}
              `}>
                {opt.label}
              </span>
              <img
                src={opt.imageUrl}
                alt={opt.text || `Option ${opt.label}`}
                className="w-full h-24 sm:h-32 object-contain rounded-lg mb-2"
                loading="lazy"
              />
              {opt.text && (
                <span className={`text-xs sm:text-sm text-center ${isSelected ? 'text-purple-700 font-medium' : 'text-slate-500'}`}>
                  {opt.text}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ========== AUDIO PLAYER ==========

function AudioPlayer({ audioUrl }: { audioUrl: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200">
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        onEnded={() => setIsPlaying(false)}
      />
      <div className="flex items-center gap-4">
        <button
          onClick={togglePlay}
          className="w-12 h-12 rounded-full bg-purple-500 hover:bg-purple-600 text-white flex items-center justify-center shadow-lg transition-all"
        >
          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Volume2 className="w-4 h-4 text-purple-500" />
            <span className="text-sm font-medium text-purple-700">Listening Audio</span>
          </div>
          <div className="relative h-2 bg-purple-200 rounded-full overflow-hidden">
            <div
              className="absolute h-full bg-purple-500 rounded-full transition-all"
              style={{ width: duration ? `${(currentTime / duration) * 100}%` : '0%' }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-xs text-purple-500">{formatTime(currentTime)}</span>
            <span className="text-xs text-purple-500">{formatTime(duration)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ========== WORD BANK FILL-IN (WIDA Reading Part 1) ==========

function WordBankFillInCard({ q, answer, onAnswer, wordBankItems }: {
  q: WordBankFillIn;
  answer?: string;
  onAnswer: (v: string) => void;
  wordBankItems: { word: string; imageUrl: string }[];
}) {
  return (
    <div className="space-y-4">
      <p className="text-base text-slate-700 leading-relaxed">
        <span className="font-bold text-slate-500 mr-2">Q{q.id}.</span>
        {q.question}
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {wordBankItems.map((item) => {
          const isSelected = answer === item.word;
          return (
            <button
              key={item.word}
              onClick={() => onAnswer(item.word)}
              className={`
                flex flex-col items-center p-2 rounded-xl border-2 transition-all duration-200
                ${isSelected
                  ? 'border-blue-400 bg-blue-50 shadow-md ring-2 ring-blue-200'
                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }
              `}
            >
              <img
                src={item.imageUrl}
                alt={item.word}
                className="w-16 h-16 object-contain rounded-lg mb-1"
                loading="lazy"
              />
              <span className={`text-xs sm:text-sm font-medium text-center ${isSelected ? 'text-blue-700' : 'text-slate-600'}`}>
                {item.word}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ========== STORY FILL-IN (WIDA Reading Part 2) ==========

function StoryFillInCard({ q, answer, onAnswer }: { q: StoryFillIn; answer?: string; onAnswer: (v: string) => void }) {
  return (
    <div className="space-y-3">
      <p className="text-base text-slate-700 leading-relaxed">
        <span className="font-bold text-slate-500 mr-2">Q{q.id}.</span>
        {q.question.split('___').map((part, i, arr) => (
          <span key={i}>
            {part}
            {i < arr.length - 1 && (
              <input
                type="text"
                value={typeof answer === 'string' ? answer : ''}
                onChange={(e) => onAnswer(e.target.value)}
                className="inline-block w-40 mx-1 px-2 py-0.5 rounded-lg border-2 border-dashed border-blue-300 bg-blue-50/50 text-blue-700 font-medium text-center focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="..."
              />
            )}
          </span>
        ))}
      </p>
    </div>
  );
}

// ========== OPEN-ENDED (HuaZhong) ==========

function OpenEndedCard({ q, answer, onAnswer }: { q: OpenEndedQuestion; answer?: string; onAnswer: (v: string) => void }) {
  if (q.subQuestions && q.subQuestions.length > 0) {
    const parsed = (() => {
      try { return typeof answer === 'string' ? JSON.parse(answer) : (answer || {}); } catch { return {}; }
    })();

    // Normalize subQuestions: handle both string[] and {label, question, answer}[] formats
    const normalizedSubs = q.subQuestions.map((sub, idx) => {
      if (typeof sub === 'string') {
        return { label: sub || String.fromCharCode(97 + idx), question: '', answer: '' };
      }
      return { label: sub.label || String.fromCharCode(97 + idx), question: sub.question || '', answer: sub.answer || '' };
    });

    const subItems = [
      <div key={`q${q.id}-prompt`} className="text-base text-slate-700">
        <span className="font-bold text-slate-500 mr-2">Q{q.id}.</span>
        {q.question}
      </div>,
      ...normalizedSubs.map((sub, idx) => (
        <div key={`q${q.id}-sub-${idx}`} className="ml-4 space-y-2">
            <label className="text-base font-medium text-slate-600">{sub.label}) {sub.question}</label>
            <textarea
              value={parsed[sub.label] || ''}
              onChange={(e) => {
                const newVal = { ...parsed, [sub.label]: e.target.value };
                onAnswer(JSON.stringify(newVal));
              }}
              className="w-full p-3 rounded-xl border-2 border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 text-base text-slate-700 resize-none transition-all"
              rows={2}
              placeholder="Type your answer here..."
            />
          </div>
      )),
    ];
    return <div className="space-y-4">{subItems}</div>;
  }

  return (
    <div className="space-y-3">
      <p className="text-base text-slate-700">
        <span className="font-bold text-slate-500 mr-2">Q{q.id}.</span>
        {q.question}
      </p>
      <textarea
        value={typeof answer === 'string' ? answer : ''}
        onChange={(e) => onAnswer(e.target.value)}
        className="w-full p-3 rounded-xl border-2 border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 text-base text-slate-700 resize-none transition-all"
        rows={3}
        placeholder="Type your answer here..."
      />
    </div>
  );
}

// ========== TRUE/FALSE (HuaZhong) ==========

function TrueFalseCard({ q, answer, onAnswer }: { q: TrueFalseQuestion; answer?: string; onAnswer: (v: string) => void }) {
  const parsed = (() => {
    try { return typeof answer === 'string' ? JSON.parse(answer) : {}; } catch { return {}; }
  })();

  const update = (label: string, field: string, value: string) => {
    const newVal = { ...parsed, [label]: { ...(parsed[label] || {}), [field]: value } };
    onAnswer(JSON.stringify(newVal));
  };

  const items = [
    <div key={`q${q.id}-prompt`} className="text-base text-slate-700 font-medium">
      <span className="font-bold text-slate-500 mr-2">Q{q.id}.</span>
      State whether each statement is True or False, then give one reason.
    </div>,
    ...q.statements.map((s, idx) => (
      <div key={`q${q.id}-stmt-${idx}`} className="ml-2 p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
        <p className="text-base text-slate-700"><span className="font-bold">{s.label})</span> {s.statement}</p>
        <div className="flex gap-3">
          {['True', 'False'].map((tf) => (
            <button
              key={tf}
              onClick={() => update(s.label, 'tf', tf)}
              className={`
                px-4 py-1.5 rounded-lg border-2 text-base font-medium transition-all
                ${parsed[s.label]?.tf === tf
                  ? tf === 'True' ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-red-400 bg-red-50 text-red-700'
                  : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }
              `}
            >
              {tf}
            </button>
          ))}
        </div>
        <textarea
          value={parsed[s.label]?.reason || ''}
          onChange={(e) => update(s.label, 'reason', e.target.value)}
          className="w-full p-2.5 rounded-lg border-2 border-slate-200 focus:border-blue-400 text-base text-slate-700 resize-none"
          rows={2}
          placeholder="Give your reason..."
        />
      </div>
    )),
  ];

  return <div className="space-y-4">{items}</div>;
}

// ========== TABLE QUESTION (HuaZhong) ==========

function TableQuestionCard({ q, answer, onAnswer }: { q: TableQuestion; answer?: string; onAnswer: (v: string) => void }) {
  const parsed = (() => {
    try { return typeof answer === 'string' ? JSON.parse(answer) : {}; } catch { return {}; }
  })();

  // Guard: if rows is empty or not an array, show a fallback
  if (!q.rows || !Array.isArray(q.rows) || q.rows.length === 0) {
    return (
      <div className="space-y-4">
        <div className="text-base text-slate-700 font-medium">
          <span className="font-bold text-slate-500 mr-2">Q{q.id}.</span>
          {q.question}
        </div>
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
          Table data is not available for this question.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-base text-slate-700 font-medium">
        <span className="font-bold text-slate-500 mr-2">Q{q.id}.</span>
        {q.question}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-base border-collapse">
          <thead>
            <tr className="bg-slate-100">
              <th className="p-3 text-left font-semibold text-slate-600 border border-slate-200">Situation</th>
              <th className="p-3 text-left font-semibold text-slate-600 border border-slate-200">What was thought</th>
              <th className="p-3 text-left font-semibold text-slate-600 border border-slate-200">What was done</th>
            </tr>
          </thead>
          <tbody>
            {q.rows.map((row, i) => (
              <tr key={i}>
                <td className="p-3 border border-slate-200 text-slate-600">{row.situation || ''}</td>
                <td className="p-3 border border-slate-200">
                  {row.blankField === 'thought' ? (
                    <textarea
                      value={parsed[i]?.thought || ''}
                      onChange={(e) => {
                        const newVal = { ...parsed, [i]: { ...(parsed[i] || {}), thought: e.target.value } };
                        onAnswer(JSON.stringify(newVal));
                      }}
                      className="w-full p-2 rounded-lg border border-slate-200 focus:border-blue-400 text-base resize-none"
                      rows={2}
                      placeholder="Your answer..."
                    />
                  ) : (
                    <span className="text-slate-600">{row.thought || ''}</span>
                  )}
                </td>
                <td className="p-3 border border-slate-200">
                  {row.blankField === 'action' ? (
                    <textarea
                      value={parsed[i]?.action || ''}
                      onChange={(e) => {
                        const newVal = { ...parsed, [i]: { ...(parsed[i] || {}), action: e.target.value } };
                        onAnswer(JSON.stringify(newVal));
                      }}
                      className="w-full p-2 rounded-lg border border-slate-200 focus:border-blue-400 text-base resize-none"
                      rows={2}
                      placeholder="Your answer..."
                    />
                  ) : (
                    <span className="text-slate-600">{row.action || ''}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ========== REFERENCE (HuaZhong) ==========

function ReferenceCard({ q, answer, onAnswer }: { q: ReferenceQuestion; answer?: string; onAnswer: (v: string) => void }) {
  const parsed = (() => {
    try { return typeof answer === 'string' ? JSON.parse(answer) : {}; } catch { return {}; }
  })();

  const safeItems = Array.isArray(q.items) ? q.items : [];

  return (
    <div className="space-y-4">
      <div className="text-base text-slate-700 font-medium">
        <span className="font-bold text-slate-500 mr-2">Q{q.id}.</span>
        {q.question}
      </div>
      {safeItems.length === 0 ? (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
          Reference items are not available for this question.
        </div>
      ) : (
        safeItems.map((item, i) => (
          <div key={i} className="ml-2 flex items-center gap-3">
            <span className="text-base font-medium text-slate-500 w-32 flex-shrink-0">
              <span className="font-bold">"{item.word || ''}"</span>{item.lineRef ? ` (${item.lineRef})` : ''}
            </span>
            <input
              type="text"
              value={parsed[i] || ''}
              onChange={(e) => {
                const newVal = { ...parsed, [i]: e.target.value };
                onAnswer(JSON.stringify(newVal));
              }}
              className="flex-1 p-2.5 rounded-lg border-2 border-slate-200 focus:border-blue-400 text-base text-slate-700"
              placeholder="refers to..."
            />
          </div>
        ))
      )}
    </div>
  );
}

// ========== ORDER (HuaZhong) ==========

function OrderCard({ q, answer, onAnswer }: { q: OrderQuestion; answer?: string; onAnswer: (v: string) => void }) {
  const parsed = (() => {
    try { return typeof answer === 'string' ? JSON.parse(answer) : {}; } catch { return {}; }
  })();

  const items = [
    <div key={`q${q.id}-prompt`} className="text-base text-slate-700 font-medium">
      <span className="font-bold text-slate-500 mr-2">Q{q.id}.</span>
      {q.question}
    </div>,
    ...q.events.map((event, i) => (
        <div key={i} className="ml-2 flex items-center gap-3">
          <select
            value={parsed[i] || ''}
            onChange={(e) => {
              const newVal = { ...parsed, [i]: e.target.value };
              onAnswer(JSON.stringify(newVal));
            }}
            className="w-16 p-2 rounded-lg border-2 border-slate-200 focus:border-blue-400 text-base font-bold text-center"
          >
            <option value="">—</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
          </select>
          <span className="text-base text-slate-600">{event}</span>
        </div>
    )),
  ];
  return <div className="space-y-4">{items}</div>;
}

// ========== PHRASE (HuaZhong) ==========

function PhraseCard({ q, answer, onAnswer }: { q: PhraseQuestion; answer?: string; onAnswer: (v: string) => void }) {
  const parsed = (() => {
    try { return typeof answer === 'string' ? JSON.parse(answer) : {}; } catch { return {}; }
  })();

  const safeItems = Array.isArray(q.items) ? q.items : [];

  return (
    <div className="space-y-4">
      <div className="text-base text-slate-700 font-medium">
        <span className="font-bold text-slate-500 mr-2">Q{q.id}.</span>
        {q.question}
      </div>
      {safeItems.length === 0 ? (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
          Phrase items are not available for this question.
        </div>
      ) : (
        safeItems.map((item, i) => (
          <div key={i} className="ml-2 space-y-2">
            <p className="text-base text-slate-600">{String.fromCharCode(97 + i)}) {item.clue || ''}</p>
            <input
              type="text"
              value={parsed[i] || ''}
              onChange={(e) => {
                const newVal = { ...parsed, [i]: e.target.value };
                onAnswer(JSON.stringify(newVal));
              }}
              className="w-full p-2.5 rounded-lg border-2 border-slate-200 focus:border-blue-400 text-base text-slate-700"
              placeholder="Type the phrase..."
            />
          </div>
        ))
      )}
    </div>
  );
}

// ========== CHECKBOX (HuaZhong) ==========

function CheckboxCard({ q, answer, onAnswer }: { q: CheckboxQuestion; answer?: number[]; onAnswer: (v: number[]) => void }) {
  const selected = answer || [];

  const toggle = (index: number) => {
    if (selected.includes(index)) {
      onAnswer(selected.filter(i => i !== index));
    } else if (selected.length < 2) {
      onAnswer([...selected, index]);
    }
  };

  return (
    <div className="space-y-4">
      <div key={`q${q.id}-prompt`} className="text-base text-slate-700">
        <span className="font-bold text-slate-500 mr-2">Q{q.id}.</span>
        {q.question} <span className="text-xs text-slate-400">(Select two)</span>
      </div>
      <div key={`q${q.id}-options`} className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {q.options.map((opt, i) => {
          const isSelected = selected.includes(i);
          return (
            <button
              key={i}
              onClick={() => toggle(i)}
              className={`
                p-3 rounded-xl border-2 text-base font-medium transition-all duration-200
                ${isSelected
                  ? 'border-blue-400 bg-blue-50 text-blue-700 shadow-sm'
                  : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                }
              `}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ========== WRITING (HuaZhong) ==========

function WritingCard({ q, answer, onAnswer }: { q: WritingQuestion; answer?: string; onAnswer: (v: string) => void }) {
  const wordCount = typeof answer === 'string' ? answer.trim().split(/\s+/).filter(Boolean).length : 0;

  return (
    <div className="space-y-4">
      <div className="p-5 rounded-xl bg-gradient-to-br from-rose-50 to-amber-50 border border-rose-200">
        <h3 className="font-bold text-lg text-slate-800 mb-2">Topic: {q.topic}</h3>
        <p className="text-base text-slate-600 mb-3">{q.instructions}</p>
        <p className="text-base text-slate-500 mb-2">You may include:</p>
        <ul className="list-disc list-inside text-base text-slate-500 space-y-1">
          {q.prompts.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
        <p className="mt-3 text-xs font-medium text-slate-400">Word count: {q.wordCount}</p>
      </div>
      <div className="relative">
        <textarea
          value={typeof answer === 'string' ? answer : ''}
          onChange={(e) => onAnswer(e.target.value)}
          className="w-full p-4 rounded-xl border-2 border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 text-base text-slate-700 resize-none transition-all leading-relaxed"
          rows={12}
          placeholder="Write your composition here..."
        />
        <div className={`absolute bottom-3 right-3 text-xs font-medium px-2 py-1 rounded-md ${
          wordCount >= 200 && wordCount <= 250 ? 'bg-emerald-100 text-emerald-600' :
          wordCount > 250 ? 'bg-amber-100 text-amber-600' :
          'bg-slate-100 text-slate-400'
        }`}>
          {wordCount} words
        </div>
      </div>
    </div>
  );
}

// WIDADragDropGrammarSection and HuaZhongDragDropGrammarSection have been
// replaced by the unified DragDropFillBlank component in DragDropFillBlank.tsx

// ========== DRAG & DROP WORD BANK (HuaZhong Grammar - passage-based) ==========

// (HuaZhongDragDropGrammarSection removed - now using unified DragDropFillBlank)

// ========== READING SECTION (WIDA - word bank + story) ==========

function WIDAReadingSection({
  section,
  sectionId,
  getAnswer,
  setAnswer,
  readingWordBank,
}: {
  section: Section;
  sectionId: string;
  getAnswer: (sectionId: string, id: number) => string | number | undefined;
  setAnswer: (sectionId: string, id: number, v: string) => void;
  readingWordBank: { word: string; imageUrl: string }[];
}) {
  const sectionQuestions = Array.isArray(section?.questions) ? section.questions : [];
  const wordBankQuestions = sectionQuestions.filter((q: Question) => q.type === 'wordbank-fill') as WordBankFillIn[];
  const storyQuestions = sectionQuestions.filter((q: Question) => q.type === 'story-fill') as StoryFillIn[];

  // Track which words have been used (assigned to a question)
  const usedWords = new Set<string>();
  wordBankQuestions.forEach(q => {
    const ans = getAnswer(sectionId, q.id);
    if (ans && typeof ans === 'string') usedWords.add(ans);
  });

  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);

  const handleImageDragStart = (e: React.DragEvent, word: string) => {
    setDraggedItem(word);
    e.dataTransfer.setData('text/plain', word);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleImageDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleImageDrop = (e: React.DragEvent, questionId: number) => {
    e.preventDefault();
    const word = e.dataTransfer.getData('text/plain');
    if (word) {
      setAnswer(sectionId, questionId, word);
    }
    setDraggedItem(null);
  };

  const handleImageClick = (word: string) => {
    if (usedWords.has(word)) return;
    setSelectedItem(prev => prev === word ? null : word);
  };

  const handleDropTargetClick = (questionId: number) => {
    if (selectedItem) {
      setAnswer(sectionId, questionId, selectedItem);
      setSelectedItem(null);
    }
  };

  const handleRemoveAnswer = (questionId: number) => {
    setAnswer(sectionId, questionId, '');
  };

  // Global question number offset for reading Part 1
  // Vocab: 12, Grammar MCQ: 8, Grammar fill: 5, Listening: 6 = 31
  const globalOffset = 31;

  return (
    <div className="space-y-8">
      <div>
        <div className="mb-4 p-4 rounded-xl bg-blue-50/50 border border-blue-200">
          <h3 className="font-bold text-blue-700 mb-2">Part 1: Look and Read</h3>
          <p className="text-sm text-slate-600">Drag the correct image to match each description, or click an image then click a description.</p>
        </div>

        {/* Draggable Image Bank */}
        <div className="p-5 rounded-xl bg-indigo-50/50 border border-indigo-200 mb-6">
          <h3 className="font-bold text-sm text-indigo-700 mb-3 uppercase tracking-wider">
            Word Bank
            <span className="ml-2 text-xs font-normal text-indigo-400 normal-case">
              (Drag images to descriptions, or click to select)
            </span>
          </h3>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
            {readingWordBank.map((item) => {
              const isUsed = usedWords.has(item.word);
              const isSelected = selectedItem === item.word;
              return (
                <div
                  key={item.word}
                  draggable={!isUsed}
                  onDragStart={(e) => handleImageDragStart(e, item.word)}
                  onDragEnd={() => setDraggedItem(null)}
                  onClick={() => handleImageClick(item.word)}
                  className={`
                    flex flex-col items-center p-2 rounded-xl border-2 transition-all duration-200
                    ${isUsed
                      ? 'border-slate-200 bg-slate-100 opacity-40 cursor-not-allowed'
                      : isSelected
                        ? 'border-blue-400 bg-blue-50 shadow-md ring-2 ring-blue-200 cursor-pointer'
                        : 'border-indigo-200 bg-white cursor-grab hover:border-indigo-400 hover:shadow-sm active:cursor-grabbing'
                    }
                  `}
                >
                  <img
                    src={item.imageUrl}
                    alt={item.word}
                    className={`w-14 h-14 sm:w-16 sm:h-16 object-contain rounded-lg mb-1 ${isUsed ? 'grayscale' : ''}`}
                    loading="lazy"
                  />
                  <span className={`text-[10px] sm:text-xs font-medium text-center leading-tight ${isUsed ? 'text-slate-400 line-through' : isSelected ? 'text-blue-700' : 'text-slate-600'}`}>
                    {item.word}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Description Drop Targets */}
        <div className="space-y-4">
          {wordBankQuestions.map((q) => {
            const answer = getAnswer(sectionId, q.id);
            const answerStr = typeof answer === 'string' ? answer : undefined;
            const matchedItem = answerStr ? readingWordBank.find(item => item.word === answerStr) : null;

            return (
              <div
                key={q.id}
                className={`p-5 rounded-xl border-2 transition-all duration-200 ${
                  matchedItem
                    ? 'border-emerald-300 bg-emerald-50/50'
                    : draggedItem || selectedItem
                      ? 'border-blue-300 bg-blue-50/30 border-dashed'
                      : 'border-slate-200 bg-white'
                } shadow-sm hover:shadow-md`}
                onDragOver={handleImageDragOver}
                onDrop={(e) => handleImageDrop(e, q.id)}
                onClick={() => {
                  if (matchedItem) return;
                  handleDropTargetClick(q.id);
                }}
              >
                <div className="flex items-center gap-4">
                  {/* Drop zone for image */}
                  <div
                    className={`flex-shrink-0 w-20 h-20 rounded-xl border-2 border-dashed flex items-center justify-center transition-all duration-200 ${
                      matchedItem
                        ? 'border-emerald-400 bg-white'
                        : draggedItem || selectedItem
                          ? 'border-blue-400 bg-blue-50 animate-pulse'
                          : 'border-slate-300 bg-slate-50'
                    }`}
                  >
                    {matchedItem ? (
                      <div className="relative">
                        <img
                          src={matchedItem.imageUrl}
                          alt={matchedItem.word}
                          className="w-16 h-16 object-contain rounded-lg"
                        />
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRemoveAnswer(q.id); }}
                          className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-400 text-white flex items-center justify-center text-xs hover:bg-red-500 shadow-sm"
                        >
                          x
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">Drop here</span>
                    )}
                  </div>

                  {/* Question text */}
                  <div className="flex-1">
                    <p className="text-base text-slate-700 leading-relaxed">
                      <span className="font-bold text-slate-500 mr-2">Q{globalOffset + q.id}.</span>
                      {q.question}
                    </p>
                    {matchedItem && (
                      <p className="text-sm text-emerald-600 font-medium mt-1">
                        Answer: {matchedItem.word}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <div className="mb-4 p-4 rounded-xl bg-emerald-50/50 border border-emerald-200">
          <h3 className="font-bold text-emerald-700 mb-2">Part 2: Read the Story</h3>
          <p className="text-sm text-slate-600">Read the story about Jane and fill in the blanks with 1-3 words.</p>
        </div>

        {section.storyParagraphs?.map((para: { text: string; questionIds: number[] }, pIdx: number) => (
          <div key={pIdx} className="mb-6">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 mb-3">
              <p className="text-base text-slate-700 leading-relaxed italic">{para.text}</p>
            </div>
            <div className="space-y-3 ml-4">
              {para.questionIds.map((qId: number) => {
                const q = storyQuestions.find(sq => sq.id === qId);
                if (!q) return null;
                const answer = getAnswer(sectionId, q.id);
                return (
                  <div key={q.id} className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
                    <StoryFillInCard
                      q={q}
                      answer={typeof answer === 'string' ? answer : undefined}
                      onAnswer={(v) => setAnswer(sectionId, q.id, v)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ========== UNIVERSAL QUESTION RENDERER ==========

function QuestionRenderer({ question, sectionId, answer, onAnswer }: {
  question: Question;
  sectionId: string;
  answer: any;
  onAnswer: (v: any) => void;
}) {
  switch (question.type) {
    case 'mcq':
      return <MCQQuestionCard q={question} answer={typeof answer === 'number' ? answer : undefined} onAnswer={onAnswer} />;
    case 'picture-mcq':
      return <PictureMCQCard q={question} answer={typeof answer === 'number' ? answer : undefined} onAnswer={onAnswer} />;
    case 'listening-mcq':
      return <ListeningMCQCard q={question} answer={typeof answer === 'number' ? answer : undefined} onAnswer={onAnswer} />;
    case 'open-ended':
      return <OpenEndedCard q={question} answer={answer} onAnswer={onAnswer} />;
    case 'true-false':
      return <TrueFalseCard q={question} answer={answer} onAnswer={onAnswer} />;
    case 'table':
      return <TableQuestionCard q={question} answer={answer} onAnswer={onAnswer} />;
    case 'reference':
      return <ReferenceCard q={question} answer={answer} onAnswer={onAnswer} />;
    case 'order':
      return <OrderCard q={question} answer={answer} onAnswer={onAnswer} />;
    case 'phrase':
      return <PhraseCard q={question} answer={answer} onAnswer={onAnswer} />;
    case 'checkbox':
      return <CheckboxCard q={question} answer={answer as number[]} onAnswer={onAnswer} />;
    case 'writing':
      return <WritingCard q={question} answer={answer} onAnswer={onAnswer} />;
    case 'fill-blank':
      // fill-blank is handled by DragDropGrammarSection, not individually
      return null;
    default:
      return null;
  }
}

// ========== SUBMIT CONFIRMATION DIALOG ==========

function SubmitConfirmation() {
  const { submitQuiz, getSectionProgress } = useQuiz();
  const [showConfirm, setShowConfirm] = useState(false);

  const { sections } = useQuiz();
  const totalAnswered = sections.reduce((sum: number, s: { id: string }) => sum + getSectionProgress(s.id).answered, 0);
  const totalQuestions = sections.reduce((sum: number, s: { id: string }) => sum + getSectionProgress(s.id).total, 0);
  const unanswered = totalQuestions - totalAnswered;

  if (showConfirm) {
    return (
      <div className="mt-6 p-5 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200">
        {unanswered > 0 && (
          <div className="flex items-start gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
            <span className="text-sm text-amber-700">
              You have <span className="font-bold">{unanswered}</span> unanswered question{unanswered > 1 ? 's' : ''}.
            </span>
          </div>
        )}
        <p className="text-sm text-slate-600 mb-4">Are you sure you want to submit your assessment? This action cannot be undone.</p>
        <div className="flex gap-3">
          <Button
            onClick={() => { submitQuiz(); setShowConfirm(false); }}
            className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
          >
            <Send className="w-4 h-4 mr-2" />
            Yes, Submit
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowConfirm(false)}
            className="flex-1"
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Button
      onClick={() => setShowConfirm(true)}
      size="lg"
      className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-200 hover:shadow-xl transition-all duration-300 gap-2" style={{width: '180px'}}
    >
      <Send className="w-5 h-5" />
      Submit Assessment
    </Button>
  );
}

// ========== MAIN SECTION CONTENT ==========

export default function SectionContent() {
  const { state, currentSection, sections, selectedPaper, setCurrentSection, setAnswer, getAnswer } = useQuiz();
  const section = currentSection;
  const isLastSection = state.currentSectionIndex === sections.length - 1;

  // Guard: ensure section.questions is always a valid array
  const questions = Array.isArray(section?.questions) ? section.questions : [];

  // Determine section characteristics
  const hasFillBlank = questions.some(q => q.type === 'fill-blank');
  const hasGrammarPassage = !!section.grammarPassage;
  const hasWordBank = !!section.wordBank;
  const isWIDAGrammar = hasFillBlank && hasWordBank && !hasGrammarPassage;
  const isHuaZhongGrammar = hasFillBlank && hasWordBank && hasGrammarPassage;
  const isWIDAReading = questions.some(q => q.type === 'wordbank-fill' || q.type === 'story-fill');
  const isHuaZhongReading = !!section.passage;
  const isListeningSection = !!section.audioUrl;

  // Questions that are NOT fill-blank (those are handled by DragDrop sections)
  const regularQuestions = questions.filter(q => q.type !== 'fill-blank');

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={section.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.3 }}
      >
        {/* Section Header */}
        <div className="mb-8">
          {section.imageUrl && (
            <div className="relative h-40 sm:h-48 rounded-2xl overflow-hidden mb-6">
              <img
                src={section.imageUrl}
                alt={section.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
              <div className="absolute bottom-4 left-5">
                <span className="text-3xl mr-3">{section.icon}</span>
                <span className="text-white font-bold text-xl drop-shadow-lg">{section.title}</span>
              </div>
            </div>
          )}
          {!section.imageUrl && (
            <div className={`p-5 rounded-2xl ${section.bgColor} mb-6`}>
              <div className="flex items-center gap-3">
                <span className="text-3xl">{section.icon}</span>
                <div>
                  <h2 className={`text-xl font-bold ${section.color}`}>{section.title}</h2>
                  {section.subtitle && <p className="text-sm text-slate-500">{section.subtitle}</p>}
                </div>
              </div>
            </div>
          )}
          <p className="text-sm text-slate-500 leading-relaxed">{section.description}</p>
        </div>

        {/* Scene/Reference Image */}
        {section.sceneImageUrl && (
          <div className="mb-6 rounded-xl overflow-hidden border border-slate-200 shadow-sm">
            <img
              src={section.sceneImageUrl}
              alt={`${section.title} reference`}
              className="w-full object-contain max-h-[500px] bg-white"
            />
          </div>
        )}

        {/* Listening Audio Player */}
        {isListeningSection && section.audioUrl && (
          <AudioPlayer audioUrl={section.audioUrl} />
        )}

        {/* WIDA Reading Section (special layout) */}
        {isWIDAReading ? (
          <WIDAReadingSection
            section={section}
            sectionId={section.id}
            getAnswer={getAnswer}
            setAnswer={setAnswer}
            readingWordBank={selectedPaper?.readingWordBank || []}
          />
        ) : (
          <>
            {/* HuaZhong Reading Passage */}
            {isHuaZhongReading && (
              <div className="mb-8 p-5 rounded-xl bg-blue-50/50 border border-blue-200">
                <h3 className="font-bold text-sm text-blue-700 mb-3 uppercase tracking-wider">Reading Passage</h3>
                <div className="text-base text-slate-700 leading-relaxed space-y-3">
                  {section.passage!.split('\n\n').map((para, i) => (
                    <p key={i}>{para}</p>
                  ))}
                </div>
              </div>
            )}

            {/* Unified drag & drop fill-in-blank (handles both sentence and passage modes) */}
            {(isWIDAGrammar || isHuaZhongGrammar) && (
              <DragDropFillBlank
                questions={questions.filter(q => q.type === 'fill-blank') as FillBlankQuestion[]}
                wordBank={section.wordBank!}
                grammarPassage={section.grammarPassage}
                sceneImageUrl={section.sceneImageUrl}
                sectionId={section.id}
                getAnswer={getAnswer}
                setAnswer={setAnswer}
              />
            )}

            {/* Regular questions (MCQ, PictureMCQ, ListeningMCQ, OpenEnded, TrueFalse, etc.) */}
            <div className="space-y-6">
              {((isWIDAGrammar || isHuaZhongGrammar) ? regularQuestions : questions).filter(q => q.type !== 'fill-blank').map((q) => {
                const answer = getAnswer(section.id, q.id);
                return (
                  <div key={q.id} className="p-5 rounded-xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                    <QuestionRenderer
                      question={q}
                      sectionId={section.id}
                      answer={answer}
                      onAnswer={(v) => setAnswer(section.id, q.id, v)}
                    />
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Navigation */}
        <div className="mt-10 flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => setCurrentSection(state.currentSectionIndex - 1)}
            disabled={state.currentSectionIndex === 0}
            className="gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous Section
          </Button>

          {isLastSection ? (
            <SubmitConfirmation />
          ) : (
            <Button
              onClick={() => setCurrentSection(state.currentSectionIndex + 1)}
              disabled={isLastSection}
              className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
            >
              Next Section
              <ChevronRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
