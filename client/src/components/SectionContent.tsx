import { useQuiz } from '@/contexts/QuizContext';
import { sections, AUDIO_URL } from '@/data/questions';
import type { MCQQuestion, FillBlankQuestion, OpenEndedQuestion, TrueFalseQuestion, TableQuestion, ReferenceQuestion, OrderQuestion, PhraseQuestion, CheckboxQuestion, ListeningMCQ, WritingQuestion, Question } from '@/data/questions';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Volume2, Play, Pause, Send, AlertTriangle, GripVertical } from 'lucide-react';
import { useRef, useState, useCallback } from 'react';

function MCQQuestionCard({ q, answer, onAnswer }: { q: MCQQuestion; answer?: string; onAnswer: (v: string) => void }) {
  return (
    <div className="space-y-4">
      <p className="text-base text-slate-700 leading-relaxed">
        <span className="font-bold text-slate-500 mr-2">Q{q.id}.</span>
        {q.question.split('___').map((part, i, arr) => (
          <span key={i}>
            {part}
            {i < arr.length - 1 && (
              <span className="font-bold text-blue-600 underline decoration-blue-300 decoration-2 underline-offset-2 mx-1">
                {q.highlightWord}
              </span>
            )}
          </span>
        ))}
      </p>
      <div className="grid gap-2.5">
        {q.options.map((opt, i) => {
          const isSelected = answer !== undefined && Number(answer) === i;
          const letter = String.fromCharCode(65 + i);
          return (
            <button
              key={i}
              onClick={() => onAnswer(String(i))}
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

function ListeningMCQCard({ q, answer, onAnswer }: { q: ListeningMCQ; answer?: string; onAnswer: (v: string) => void }) {
  return (
    <div className="space-y-4">
      <p className="text-base text-slate-700 leading-relaxed">
        <span className="font-bold text-slate-500 mr-2">Q{q.id - 100}.</span>
        {q.question}
        {q.audioTimestamp && (
          <span className="ml-2 text-xs text-blue-500 font-mono bg-blue-50 px-2 py-0.5 rounded">
            {q.audioTimestamp}
          </span>
        )}
      </p>
      <div className="grid gap-2.5">
        {q.options.map((opt, i) => {
          const isSelected = answer !== undefined && Number(answer) === i;
          const letter = String.fromCharCode(65 + i);
          return (
            <button
              key={i}
              onClick={() => onAnswer(String(i))}
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

// ========== DRAG & DROP WORD BANK ==========

function DragDropGrammarSection({
  questions,
  wordBank,
  grammarPassage,
  getAnswer,
  setAnswer,
}: {
  questions: FillBlankQuestion[];
  wordBank: { letter: string; word: string }[];
  grammarPassage: string;
  getAnswer: (id: number) => string | string[] | number[] | undefined;
  setAnswer: (id: number, v: string) => void;
}) {
  const [draggedWord, setDraggedWord] = useState<{ letter: string; word: string } | null>(null);

  // Get all used letters
  const usedLetters = new Set<string>();
  questions.forEach(q => {
    const ans = getAnswer(q.id);
    if (ans && typeof ans === 'string') usedLetters.add(ans);
  });

  const handleDragStart = (e: React.DragEvent, item: { letter: string; word: string }) => {
    setDraggedWord(item);
    e.dataTransfer.setData('text/plain', item.letter);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, questionId: number) => {
    e.preventDefault();
    const letter = e.dataTransfer.getData('text/plain');
    if (letter) {
      // If this blank already has a word, free it
      const currentAnswer = getAnswer(questionId);
      if (currentAnswer && typeof currentAnswer === 'string') {
        // The old word is freed automatically since we just overwrite
      }
      setAnswer(questionId, letter);
    }
    setDraggedWord(null);
  };

  const handleRemoveWord = (questionId: number) => {
    setAnswer(questionId, '');
  };

  // Also support click-to-fill: click a word, then click a blank
  const [selectedWord, setSelectedWord] = useState<{ letter: string; word: string } | null>(null);

  const handleWordClick = (item: { letter: string; word: string }) => {
    if (usedLetters.has(item.letter)) return; // already used
    setSelectedWord(item);
  };

  const handleBlankClick = (questionId: number) => {
    if (selectedWord) {
      setAnswer(questionId, selectedWord.letter);
      setSelectedWord(null);
    }
  };

  // Render passage with interactive blanks
  const renderPassageWithBlanks = () => {
    // Split passage by blank markers like <b>(21) ___</b>
    const parts = grammarPassage.split(/(<b>\(\d+\) ___<\/b>)/g);
    return parts.map((part, i) => {
      const match = part.match(/<b>\((\d+)\) ___<\/b>/);
      if (match) {
        const qId = parseInt(match[1]);
        const answer = getAnswer(qId);
        const answerWord = answer && typeof answer === 'string' ? wordBank.find(w => w.letter === answer) : null;

        return (
          <span
            key={i}
            className={`
              inline-flex items-center min-w-[100px] mx-1 px-2 py-0.5 rounded-lg border-2 border-dashed
              transition-all duration-200 cursor-pointer align-baseline
              ${answerWord
                ? 'border-amber-400 bg-amber-50 text-amber-700 font-semibold'
                : draggedWord || selectedWord
                  ? 'border-blue-400 bg-blue-50 animate-pulse'
                  : 'border-slate-300 bg-slate-50 text-slate-400'
              }
            `}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, qId)}
            onClick={() => {
              if (answerWord) {
                handleRemoveWord(qId);
              } else {
                handleBlankClick(qId);
              }
            }}
          >
            <span className="text-xs font-bold text-slate-400 mr-1">({qId})</span>
            {answerWord ? (
              <span className="flex items-center gap-1">
                {answerWord.word}
                <button
                  onClick={(e) => { e.stopPropagation(); handleRemoveWord(qId); }}
                  className="ml-1 w-4 h-4 rounded-full bg-amber-200 text-amber-600 flex items-center justify-center text-xs hover:bg-amber-300"
                >
                  ×
                </button>
              </span>
            ) : (
              <span className="text-xs">___</span>
            )}
          </span>
        );
      }
      // Regular text - render as HTML
      return <span key={i} dangerouslySetInnerHTML={{ __html: part }} />;
    });
  };

  return (
    <div className="space-y-6">
      {/* Word Bank - Draggable */}
      <div className="p-5 rounded-xl bg-amber-50/50 border border-amber-200">
        <h3 className="font-bold text-sm text-amber-700 mb-3 uppercase tracking-wider">
          Word Bank
          <span className="ml-2 text-xs font-normal text-amber-500 normal-case">
            (Drag words to blanks, or click to select)
          </span>
        </h3>
        <div className="flex flex-wrap gap-2">
          {wordBank.map(({ letter, word }) => {
            const isUsed = usedLetters.has(letter);
            const isSelected = selectedWord?.letter === letter;
            return (
              <div
                key={letter}
                draggable={!isUsed}
                onDragStart={(e) => handleDragStart(e, { letter, word })}
                onDragEnd={() => setDraggedWord(null)}
                onClick={() => handleWordClick({ letter, word })}
                className={`
                  flex items-center gap-1.5 px-3 py-2 rounded-lg border-2 text-base font-medium transition-all duration-200
                  ${isUsed
                    ? 'border-slate-200 bg-slate-100 text-slate-300 cursor-not-allowed line-through opacity-50'
                    : isSelected
                      ? 'border-blue-400 bg-blue-50 text-blue-700 shadow-md cursor-pointer ring-2 ring-blue-200'
                      : 'border-amber-200 bg-white text-slate-700 cursor-grab hover:border-amber-400 hover:shadow-sm active:cursor-grabbing'
                  }
                `}
              >
                {!isUsed && <GripVertical className="w-3 h-3 text-slate-400" />}
                <span className="font-bold text-amber-600">{letter}</span> {word}
              </div>
            );
          })}
        </div>
      </div>

      {/* Passage with inline blanks */}
      <div className="p-5 rounded-xl bg-white border border-slate-200">
        <h3 className="font-bold text-sm text-amber-700 mb-3 uppercase tracking-wider">Passage</h3>
        <div className="text-base text-slate-700 leading-[2.2] space-y-3">
          {grammarPassage.split('\n\n').map((paragraph, pIdx) => (
            <p key={pIdx}>
              {(() => {
                const parts = paragraph.split(/(<b>\(\d+\) ___<\/b>)/g);
                return parts.map((part, i) => {
                  const match = part.match(/<b>\((\d+)\) ___<\/b>/);
                  if (match) {
                    const qId = parseInt(match[1]);
                    const answer = getAnswer(qId);
                    const answerWord = answer && typeof answer === 'string' ? wordBank.find(w => w.letter === answer) : null;

                    return (
                      <span
                        key={`${pIdx}-${i}`}
                        className={`
                          inline-flex items-center min-w-[90px] mx-1 px-2 py-0.5 rounded-lg border-2 border-dashed
                          transition-all duration-200 cursor-pointer align-baseline
                          ${answerWord
                            ? 'border-amber-400 bg-amber-50 text-amber-700 font-semibold'
                            : draggedWord || selectedWord
                              ? 'border-blue-400 bg-blue-50'
                              : 'border-slate-300 bg-slate-50 text-slate-400'
                          }
                        `}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, qId)}
                        onClick={() => {
                          if (answerWord) {
                            handleRemoveWord(qId);
                          } else {
                            handleBlankClick(qId);
                          }
                        }}
                      >
                        <span className="text-xs font-bold text-slate-400 mr-1">({qId})</span>
                        {answerWord ? (
                          <span className="flex items-center gap-1">
                            {answerWord.word}
                            <button
                              onClick={(e) => { e.stopPropagation(); handleRemoveWord(qId); }}
                              className="ml-1 w-4 h-4 rounded-full bg-amber-200 text-amber-600 flex items-center justify-center text-xs hover:bg-amber-300"
                            >
                              ×
                            </button>
                          </span>
                        ) : (
                          <span className="text-xs">___</span>
                        )}
                      </span>
                    );
                  }
                  return <span key={`${pIdx}-${i}`} dangerouslySetInnerHTML={{ __html: part }} />;
                });
              })()}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

function OpenEndedCard({ q, answer, onAnswer }: { q: OpenEndedQuestion; answer?: string; onAnswer: (v: string) => void }) {
  if (q.subQuestions) {
    const parsed = (() => {
      try { return typeof answer === 'string' ? JSON.parse(answer) : (answer || {}); } catch { return {}; }
    })();

    return (
      <div className="space-y-4">
        <p className="text-base text-slate-700">
          <span className="font-bold text-slate-500 mr-2">Q{q.id}.</span>
          {q.question}
        </p>
        {q.subQuestions.map((sub) => (
          <div key={sub.label} className="ml-4 space-y-2">
            <label className="text-sm font-medium text-slate-600">{sub.label}) {sub.question}</label>
            <textarea
              value={parsed[sub.label] || ''}
              onChange={(e) => {
                const newVal = { ...parsed, [sub.label]: e.target.value };
                onAnswer(JSON.stringify(newVal));
              }}
              className="w-full p-3 rounded-xl border-2 border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 text-sm text-slate-700 resize-none transition-all"
              rows={2}
              placeholder="Type your answer here..."
            />
          </div>
        ))}
      </div>
    );
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
        className="w-full p-3 rounded-xl border-2 border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 text-sm text-slate-700 resize-none transition-all"
        rows={3}
        placeholder="Type your answer here..."
      />
    </div>
  );
}

function TrueFalseCard({ q, answer, onAnswer }: { q: TrueFalseQuestion; answer?: string; onAnswer: (v: string) => void }) {
  const parsed = (() => {
    try { return typeof answer === 'string' ? JSON.parse(answer) : {}; } catch { return {}; }
  })();

  const update = (label: string, field: string, value: string) => {
    const newVal = { ...parsed, [label]: { ...(parsed[label] || {}), [field]: value } };
    onAnswer(JSON.stringify(newVal));
  };

  return (
    <div className="space-y-4">
      <p className="text-base text-slate-700 font-medium">
        <span className="font-bold text-slate-500 mr-2">Q{q.id}.</span>
        State whether each statement is True or False, then give one reason.
      </p>
      {q.statements.map((s) => (
        <div key={s.label} className="ml-2 p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
          <p className="text-sm text-slate-700"><span className="font-bold">{s.label})</span> {s.statement}</p>
          <div className="flex gap-3">
            {['True', 'False'].map((tf) => (
              <button
                key={tf}
                onClick={() => update(s.label, 'tf', tf)}
                className={`
                  px-4 py-1.5 rounded-lg border-2 text-sm font-medium transition-all
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
            className="w-full p-2.5 rounded-lg border-2 border-slate-200 focus:border-blue-400 text-sm text-slate-700 resize-none"
            rows={2}
            placeholder="Give your reason..."
          />
        </div>
      ))}
    </div>
  );
}

function TableQuestionCard({ q, answer, onAnswer }: { q: TableQuestion; answer?: string; onAnswer: (v: string) => void }) {
  const parsed = (() => {
    try { return typeof answer === 'string' ? JSON.parse(answer) : {}; } catch { return {}; }
  })();

  return (
    <div className="space-y-4">
      <p className="text-base text-slate-700 font-medium">
        <span className="font-bold text-slate-500 mr-2">Q{q.id}.</span>
        {q.question}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-100">
              <th className="p-3 text-left font-semibold text-slate-600 border border-slate-200">Situation</th>
              <th className="p-3 text-left font-semibold text-slate-600 border border-slate-200">What Mother thought</th>
              <th className="p-3 text-left font-semibold text-slate-600 border border-slate-200">What Mother did</th>
            </tr>
          </thead>
          <tbody>
            {q.rows.map((row, i) => (
              <tr key={i}>
                <td className="p-3 border border-slate-200 text-slate-600">{row.situation}</td>
                <td className="p-3 border border-slate-200">
                  {row.blankField === 'thought' ? (
                    <textarea
                      value={parsed[i]?.thought || ''}
                      onChange={(e) => {
                        const newVal = { ...parsed, [i]: { ...(parsed[i] || {}), thought: e.target.value } };
                        onAnswer(JSON.stringify(newVal));
                      }}
                      className="w-full p-2 rounded-lg border border-slate-200 focus:border-blue-400 text-sm resize-none"
                      rows={2}
                      placeholder="Your answer..."
                    />
                  ) : (
                    <span className="text-slate-600">{row.thought}</span>
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
                      className="w-full p-2 rounded-lg border border-slate-200 focus:border-blue-400 text-sm resize-none"
                      rows={2}
                      placeholder="Your answer..."
                    />
                  ) : (
                    <span className="text-slate-600">{row.action}</span>
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

function ReferenceCard({ q, answer, onAnswer }: { q: ReferenceQuestion; answer?: string; onAnswer: (v: string) => void }) {
  const parsed = (() => {
    try { return typeof answer === 'string' ? JSON.parse(answer) : {}; } catch { return {}; }
  })();

  return (
    <div className="space-y-4">
      <p className="text-base text-slate-700 font-medium">
        <span className="font-bold text-slate-500 mr-2">Q{q.id}.</span>
        {q.question}
      </p>
      {q.items.map((item, i) => (
        <div key={i} className="ml-2 flex items-center gap-3">
          <span className="text-sm font-medium text-slate-500 w-32 flex-shrink-0">
            <span className="font-bold">"{item.word}"</span> ({item.lineRef})
          </span>
          <input
            type="text"
            value={parsed[i] || ''}
            onChange={(e) => {
              const newVal = { ...parsed, [i]: e.target.value };
              onAnswer(JSON.stringify(newVal));
            }}
            className="flex-1 p-2.5 rounded-lg border-2 border-slate-200 focus:border-blue-400 text-sm text-slate-700"
            placeholder="refers to..."
          />
        </div>
      ))}
    </div>
  );
}

function OrderCard({ q, answer, onAnswer }: { q: OrderQuestion; answer?: string; onAnswer: (v: string) => void }) {
  const parsed = (() => {
    try { return typeof answer === 'string' ? JSON.parse(answer) : {}; } catch { return {}; }
  })();

  return (
    <div className="space-y-4">
      <p className="text-base text-slate-700 font-medium">
        <span className="font-bold text-slate-500 mr-2">Q{q.id}.</span>
        {q.question}
      </p>
      {q.events.map((event, i) => (
        <div key={i} className="ml-2 flex items-center gap-3">
          <select
            value={parsed[i] || ''}
            onChange={(e) => {
              const newVal = { ...parsed, [i]: e.target.value };
              onAnswer(JSON.stringify(newVal));
            }}
            className="w-16 p-2 rounded-lg border-2 border-slate-200 focus:border-blue-400 text-sm font-bold text-center"
          >
            <option value="">—</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
          </select>
          <span className="text-sm text-slate-600">{event}</span>
        </div>
      ))}
    </div>
  );
}

function PhraseCard({ q, answer, onAnswer }: { q: PhraseQuestion; answer?: string; onAnswer: (v: string) => void }) {
  const parsed = (() => {
    try { return typeof answer === 'string' ? JSON.parse(answer) : {}; } catch { return {}; }
  })();

  return (
    <div className="space-y-4">
      <p className="text-base text-slate-700 font-medium">
        <span className="font-bold text-slate-500 mr-2">Q{q.id}.</span>
        {q.question}
      </p>
      {q.items.map((item, i) => (
        <div key={i} className="ml-2 space-y-2">
          <p className="text-sm text-slate-600">{String.fromCharCode(97 + i)}) {item.clue}</p>
          <input
            type="text"
            value={parsed[i] || ''}
            onChange={(e) => {
              const newVal = { ...parsed, [i]: e.target.value };
              onAnswer(JSON.stringify(newVal));
            }}
            className="w-full p-2.5 rounded-lg border-2 border-slate-200 focus:border-blue-400 text-sm text-slate-700"
            placeholder="Type the phrase..."
          />
        </div>
      ))}
    </div>
  );
}

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
      <p className="text-base text-slate-700">
        <span className="font-bold text-slate-500 mr-2">Q{q.id}.</span>
        {q.question} <span className="text-xs text-slate-400">(Select two)</span>
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {q.options.map((opt, i) => {
          const isSelected = selected.includes(i);
          return (
            <button
              key={i}
              onClick={() => toggle(i)}
              className={`
                p-3 rounded-xl border-2 text-sm font-medium transition-all duration-200
                ${isSelected
                  ? 'border-blue-400 bg-blue-50 text-blue-700 shadow-sm'
                  : 'border-slate-200 text-slate-600 hover:border-slate-300'
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

function WritingCard({ q, answer, onAnswer }: { q: WritingQuestion; answer?: string; onAnswer: (v: string) => void }) {
  const wordCount = typeof answer === 'string' ? answer.trim().split(/\s+/).filter(Boolean).length : 0;

  return (
    <div className="space-y-4">
      <div className="p-5 rounded-xl bg-gradient-to-br from-rose-50 to-amber-50 border border-rose-200">
        <h3 className="font-bold text-lg text-slate-800 mb-2">Topic: {q.topic}</h3>
        <p className="text-sm text-slate-600 mb-3">{q.instructions}</p>
        <p className="text-sm text-slate-500 mb-2">You may include:</p>
        <ul className="list-disc list-inside text-sm text-slate-500 space-y-1">
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
          className="w-full p-4 rounded-xl border-2 border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 text-sm text-slate-700 resize-none transition-all leading-relaxed"
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

function AudioPlayer() {
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

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200">
      <audio
        ref={audioRef}
        src={AUDIO_URL}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        onEnded={() => setIsPlaying(false)}
      />
      <div className="flex items-center gap-4">
        <button
          onClick={togglePlay}
          className="w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-lg shadow-blue-200 transition-all"
        >
          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Volume2 className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-semibold text-blue-700">Listening Audio</span>
          </div>
          <div
            className="relative h-2 bg-blue-200 rounded-full overflow-hidden cursor-pointer"
            onClick={(e) => {
              if (!audioRef.current || duration === 0) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const pct = x / rect.width;
              audioRef.current.currentTime = pct * duration;
            }}
          >
            <div
              className="absolute inset-y-0 left-0 bg-blue-500 rounded-full transition-all"
              style={{ width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%' }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-xs text-blue-400 font-mono">{formatTime(currentTime)}</span>
            <span className="text-xs text-blue-400 font-mono">{formatTime(duration)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuestionRenderer({ question, answer, onAnswer, wordBank }: {
  question: Question;
  answer: any;
  onAnswer: (v: any) => void;
  wordBank?: { letter: string; word: string }[];
}) {
  switch (question.type) {
    case 'mcq':
      return <MCQQuestionCard q={question} answer={answer} onAnswer={onAnswer} />;
    case 'listening-mcq':
      return <ListeningMCQCard q={question} answer={answer} onAnswer={onAnswer} />;
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

  const totalAnswered = sections.reduce((sum, s) => sum + getSectionProgress(s.id).answered, 0);
  const totalQuestions = sections.reduce((sum, s) => sum + getSectionProgress(s.id).total, 0);
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

export default function SectionContent() {
  const { state, currentSection, setCurrentSection, setAnswer, getAnswer } = useQuiz();
  const section = currentSection;
  const isLastSection = state.currentSectionIndex === sections.length - 1;

  // Check if this section is grammar (has fill-blank questions with wordBank)
  const isGrammarSection = section.grammarPassage && section.wordBank;
  const fillBlankQuestions = section.questions.filter(q => q.type === 'fill-blank') as FillBlankQuestion[];
  const nonFillBlankQuestions = section.questions.filter(q => q.type !== 'fill-blank');

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
                  <p className="text-sm text-slate-500">{section.subtitle}</p>
                </div>
              </div>
            </div>
          )}
          <p className="text-sm text-slate-500 leading-relaxed">{section.description}</p>
        </div>

        {/* Audio Player for Listening Section */}
        {section.id === 'listening' && (
          <div className="mb-8">
            <AudioPlayer />
          </div>
        )}

        {/* Grammar Section with Drag & Drop */}
        {isGrammarSection && (
          <DragDropGrammarSection
            questions={fillBlankQuestions}
            wordBank={section.wordBank!}
            grammarPassage={section.grammarPassage!}
            getAnswer={getAnswer}
            setAnswer={setAnswer}
          />
        )}

        {/* Reading Passage */}
        {section.passage && (
          <div className="mb-8 p-5 rounded-xl bg-blue-50/50 border border-blue-200">
            <h3 className="font-bold text-sm text-blue-700 mb-3 uppercase tracking-wider">Reading Passage</h3>
            <div className="text-base text-slate-700 leading-relaxed space-y-3">
              {section.passage.split('\n\n').map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          </div>
        )}

        {/* Questions (non-fill-blank for grammar, all for others) */}
        <div className="space-y-6">
          {(isGrammarSection ? nonFillBlankQuestions : section.questions).map((q) => (
            <div key={q.id} className="p-5 rounded-xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <QuestionRenderer
                question={q}
                answer={getAnswer(q.id)}
                onAnswer={(v) => setAnswer(q.id, v)}
                wordBank={section.wordBank}
              />
            </div>
          ))}
        </div>

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
              disabled={state.currentSectionIndex === sections.length - 1}
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
