import { useQuiz } from '@/contexts/QuizContext';
import type {
  MCQQuestion, PictureMCQ, FillBlankQuestion, ListeningMCQ,
  WordBankFillIn, StoryFillIn, OpenEndedQuestion, TrueFalseQuestion,
  TableQuestion, ReferenceQuestion, OrderQuestion, PhraseQuestion,
  CheckboxQuestion, WritingQuestion, Question, Section, SentenceReorderQuestion,
  InlineWordChoiceQuestion, PassageInlineWordChoiceQuestion, Paper, ManualQuestionBlock,
  PictureSpellingQuestion, WordCompletionQuestion
} from '@/data/papers';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Send, AlertTriangle, GripVertical, Play, Pause, Volume2 } from 'lucide-react';
import DragDropFillBlank from '@/components/DragDropFillBlank';
import AudioRecorder from '@/components/AudioRecorder';
import { renderTextWithFractions } from '@/lib/renderTextWithFractions';
import {
  buildWordCompletionAnswer,
  getPictureSpellingCharacters,
  getWordCompletionFilledLetters,
  parseWordPattern,
} from '@/lib/vocabularyWordHelpers';
import { useState, useCallback, useRef, useEffect } from 'react';

type SelectableAnswer = number | number[] | undefined;
const PROMPT_TEXT_CLASS = 'whitespace-pre-wrap break-words text-base text-slate-700 leading-relaxed';
const PROMPT_HEADING_CLASS = 'whitespace-pre-wrap break-words text-base font-medium text-slate-700 leading-relaxed';

function getCorrectIndexes(question: MCQQuestion | PictureMCQ | ListeningMCQ) {
  if (question.correctAnswers && question.correctAnswers.length > 0) {
    return Array.from(new Set(question.correctAnswers));
  }
  return typeof question.correctAnswer === 'number' ? [question.correctAnswer] : [];
}

function getSelectionLimit(question: MCQQuestion | PictureMCQ | ListeningMCQ) {
  const correctIndexes = getCorrectIndexes(question);
  const optionCount = question.options.length;
  const requestedLimit = question.selectionLimit ?? Math.max(correctIndexes.length, 1);
  return Math.max(1, Math.min(requestedLimit, optionCount));
}

function isMultiSelectQuestion(question: MCQQuestion | PictureMCQ | ListeningMCQ) {
  return getSelectionLimit(question) > 1 || getCorrectIndexes(question).length > 1;
}

function normalizeSelectableAnswer(answer: SelectableAnswer) {
  if (Array.isArray(answer)) {
    return answer.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  }
  if (typeof answer === 'number' && Number.isFinite(answer)) {
    return [answer];
  }
  return [];
}

function toggleSelectableAnswer(
  current: SelectableAnswer,
  index: number,
  limit: number,
  multiSelect: boolean,
) {
  if (!multiSelect) {
    return index;
  }

  const selected = normalizeSelectableAnswer(current);
  if (selected.includes(index)) {
    return selected.filter((value) => value !== index);
  }
  if (selected.length >= limit) {
    return selected;
  }
  return [...selected, index];
}

function parseSerializedAnswerRecord(value: unknown): Record<string, unknown> {
  try {
    if (typeof value === 'string') {
      return JSON.parse(value) as Record<string, unknown>;
    }
    if (value && typeof value === 'object') {
      return value as Record<string, unknown>;
    }
  } catch {
    // Ignore malformed serialized answers and fall back to an empty record.
  }

  return {};
}

function getSerializedAnswerIndex(record: Record<string, unknown>, label: string) {
  const raw = record[label];
  const selectedIndex = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(selectedIndex) ? selectedIndex : undefined;
}

function renderInlineWordChoiceParts(
  item: { sentenceText?: string; beforeText: string; afterText: string },
  renderBlank: () => React.ReactNode,
) {
  const sentenceText = item.sentenceText;

  if (typeof sentenceText === 'string' && sentenceText.includes('___')) {
    const parts = sentenceText.split(/___/g);
    return parts.map((part, partIndex) => (
      <span key={`${item.beforeText}-${item.afterText}-${partIndex}`}>
        {part}
        {partIndex < parts.length - 1 ? renderBlank() : null}
      </span>
    ));
  }

  return (
    <>
      <span>{item.beforeText}</span>
      {item.beforeText ? ' ' : ''}
      {renderBlank()}
      {item.afterText ? ` ${item.afterText}` : ''}
    </>
  );
}

function stripDuplicatedOptionPrefix(value: string, label: string) {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return value.replace(new RegExp(`^${escapedLabel}[\\.)]\\s*`, 'i'), '').trim();
}

// ========== PICTURE MCQ (WIDA Vocabulary & Grammar) ==========

function PictureMCQCard({ q, answer, onAnswer }: { q: PictureMCQ; answer?: SelectableAnswer; onAnswer: (v: number | number[]) => void }) {
  const multiSelect = isMultiSelectQuestion(q);
  const selectionLimit = getSelectionLimit(q);
  const selected = normalizeSelectableAnswer(answer);

  return (
    <div className="space-y-4">
      <p className={PROMPT_TEXT_CLASS}>
        <span className="font-bold text-slate-500 mr-2">Q{q.id}.</span>
        <span className="font-semibold text-slate-800">"{q.question}"</span>
        {multiSelect ? <span className="ml-2 text-xs text-slate-400">(Select {selectionLimit})</span> : null}
      </p>
      <div className="grid grid-cols-3 gap-3">
        {q.options.map((opt, i) => {
          const isSelected = selected.includes(i);
          return (
            <button
              key={i}
              onClick={() => onAnswer(toggleSelectableAnswer(answer, i, selectionLimit, multiSelect))}
              className={`
                flex flex-col items-stretch p-3 rounded-xl border-2 transition-all duration-200
                ${isSelected
                  ? 'border-blue-400 bg-blue-50 shadow-md ring-2 ring-blue-200'
                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm'
                }
              `}
            >
              <div className="mb-2 flex items-start gap-2">
                <span className={`
                  flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold
                  ${isSelected ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500'}
                `}>
                  {opt.label}
                </span>
                {opt.text ? (
                  <span className={`flex-1 pt-0.5 text-left text-xs leading-snug sm:text-sm ${isSelected ? 'text-blue-700 font-medium' : 'text-slate-500'}`}>
                    {opt.text}
                  </span>
                ) : null}
              </div>
              {opt.imageUrl ? (
                <img
                  src={opt.imageUrl}
                  alt={opt.text || `Option ${opt.label}`}
                  className="h-24 w-full rounded-lg object-contain sm:h-32"
                  loading="lazy"
                />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ========== TEXT MCQ (Both papers) ==========

function MCQQuestionCard({ q, answer, onAnswer }: { q: MCQQuestion; answer?: SelectableAnswer; onAnswer: (v: number | number[]) => void }) {
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

  const multiSelect = isMultiSelectQuestion(q);
  const selectionLimit = getSelectionLimit(q);
  const selected = normalizeSelectableAnswer(answer);

  return (
    <div className="space-y-4">
      <p className={PROMPT_TEXT_CLASS}>
        <span className="font-bold text-slate-500 mr-2">Q{q.id}.</span>
        {renderQuestion()}
        {multiSelect ? <span className="ml-2 text-xs text-slate-400">(Select {selectionLimit})</span> : null}
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
          const isSelected = selected.includes(i);
          const letter = String.fromCharCode(97 + i);
          const displayText = stripDuplicatedOptionPrefix(opt, String.fromCharCode(65 + i));
          return (
            <button
              key={i}
              onClick={() => onAnswer(toggleSelectableAnswer(answer, i, selectionLimit, multiSelect))}
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
                {displayText}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ========== LISTENING MCQ (WIDA) ==========

function ListeningMCQCard({ q, answer, onAnswer }: { q: ListeningMCQ; answer?: SelectableAnswer; onAnswer: (v: number | number[]) => void }) {
  const multiSelect = isMultiSelectQuestion(q);
  const selectionLimit = getSelectionLimit(q);
  const selected = normalizeSelectableAnswer(answer);

  return (
    <div className="space-y-4">
      <p className={PROMPT_TEXT_CLASS}>
        <span className="font-bold text-slate-500 mr-2">Q{q.id}.</span>
        <span className="font-semibold text-slate-800">{q.question}</span>
        {multiSelect ? <span className="ml-2 text-xs text-slate-400">(Select {selectionLimit})</span> : null}
      </p>
      <div className="grid grid-cols-3 gap-3">
        {q.options.map((opt, i) => {
          const isSelected = selected.includes(i);
          return (
            <button
              key={i}
              onClick={() => onAnswer(toggleSelectableAnswer(answer, i, selectionLimit, multiSelect))}
              className={`
                flex flex-col items-stretch p-3 rounded-xl border-2 transition-all duration-200
                ${isSelected
                  ? 'border-purple-400 bg-purple-50 shadow-md ring-2 ring-purple-200'
                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm'
                }
              `}
            >
              <div className="mb-2 flex items-start gap-2">
                <span className={`
                  flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold
                  ${isSelected ? 'bg-purple-500 text-white' : 'bg-slate-100 text-slate-500'}
                `}>
                  {opt.label}
                </span>
                {opt.text ? (
                  <span className={`flex-1 pt-0.5 text-left text-xs leading-snug sm:text-sm ${isSelected ? 'text-purple-700 font-medium' : 'text-slate-500'}`}>
                    {opt.text}
                  </span>
                ) : null}
              </div>
              {opt.imageUrl ? (
                <img
                  src={opt.imageUrl}
                  alt={opt.text || `Option ${opt.label}`}
                  className="h-24 w-full rounded-lg object-contain sm:h-32"
                  loading="lazy"
                />
              ) : null}
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
      <p className={PROMPT_TEXT_CLASS}>
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
      <p className={PROMPT_TEXT_CLASS}>
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

function StandaloneFillBlankCard({
  q,
  section,
  answer,
  onAnswer,
}: {
  q: FillBlankQuestion;
  section: Section;
  answer?: string;
  onAnswer: (v: string) => void;
}) {
  const prompt = q.question || `Question ${q.id}: ___`;
  const parts = prompt.split('___');
  const hasInlineBlank = parts.length > 1;
  const isMathShortAnswer = section.sectionType === 'math-short-answer' || section.sectionType === 'math-application';

  if (isMathShortAnswer) {
    const mathPrompt = prompt.replace(/\s*___\s*/g, ' ').trim() || `Question ${q.id}`;

    return (
      <div className="rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm">
        <div className="min-h-[180px]">
          <p className={PROMPT_TEXT_CLASS}>
            <span className="font-bold text-slate-500 mr-2">Q{q.id}.</span>
            {renderTextWithFractions(mathPrompt, `math-short-answer-${q.id}`)}
          </p>
        </div>
        <div className="mt-4 flex justify-end">
          <input
            type="text"
            value={typeof answer === 'string' ? answer : ''}
            onChange={(e) => onAnswer(e.target.value)}
            className="h-12 w-40 rounded-md border-2 border-slate-300 bg-white px-3 text-center text-base font-semibold text-slate-700 shadow-sm transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            placeholder="Answer"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className={PROMPT_TEXT_CLASS}>
        <span className="font-bold text-slate-500 mr-2">Q{q.id}.</span>
        {hasInlineBlank ? (
          parts.map((part, index) => (
            <span key={index}>
              {part}
              {index < parts.length - 1 && (
                <input
                  type="text"
                  value={typeof answer === 'string' ? answer : ''}
                  onChange={(e) => onAnswer(e.target.value)}
                  className="inline-block w-40 mx-1 px-2 py-0.5 rounded-lg border-2 border-dashed border-blue-300 bg-blue-50/50 text-blue-700 font-medium text-center focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="..."
                />
              )}
            </span>
          ))
        ) : (
          prompt
        )}
      </p>
      {!hasInlineBlank && (
        <input
          type="text"
          value={typeof answer === 'string' ? answer : ''}
          onChange={(e) => onAnswer(e.target.value)}
          className="w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-base text-slate-700 transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          placeholder="Type your answer here..."
        />
      )}
    </div>
  );
}

function PictureSpellingCard({
  q,
  answer,
  onAnswer,
}: {
  q: PictureSpellingQuestion;
  answer?: string;
  onAnswer: (v: string) => void;
}) {
  const slotCount = Math.max(1, getPictureSpellingCharacters(q.correctAnswer).length || getPictureSpellingCharacters(answer || '').length);
  const currentChars = Array.from((answer || '').replace(/\s+/g, ''));

  return (
    <div className="rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
      <div className="space-y-5">
        <div className="flex flex-col gap-5 md:flex-row md:items-center">
          <div className="flex h-44 w-full items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 md:w-48">
            {q.imageUrl ? (
              <img src={q.imageUrl} alt={q.question || `Picture spelling ${q.id}`} className="h-full w-full object-contain" />
            ) : (
              <span className="px-4 text-center text-sm text-slate-400">No image</span>
            )}
          </div>
          <div className="flex-1 space-y-4">
            <p className={PROMPT_TEXT_CLASS}>
              <span className="font-bold text-slate-500 mr-2">Q{q.id}.</span>
              {q.question?.trim() || 'Spell the word that matches the picture.'}
            </p>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: slotCount }, (_, index) => (
                <input
                  key={`${q.id}-spelling-${index}`}
                  type="text"
                  inputMode="text"
                  maxLength={1}
                  value={currentChars[index] || ''}
                  onChange={(event) => {
                    const nextChars = Array.from({ length: slotCount }, (_, charIndex) => (
                      charIndex === index ? event.target.value.slice(-1) : (currentChars[charIndex] || '')
                    ));
                    onAnswer(nextChars.join(''));
                  }}
                  className="h-12 w-11 rounded-lg border-2 border-slate-300 bg-white text-center text-lg font-semibold uppercase text-slate-700 shadow-sm transition-all focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function WordCompletionCard({
  q,
  answer,
  onAnswer,
}: {
  q: WordCompletionQuestion;
  answer?: string;
  onAnswer: (v: string) => void;
}) {
  const tokens = parseWordPattern(q.wordPattern || '');
  const currentLetters = getWordCompletionFilledLetters(q.wordPattern || '', answer || '');
  let blankIndex = 0;

  return (
    <div className="rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
      <div className="space-y-4">
        {q.imageUrl ? (
          <div className="flex h-44 w-full items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
            <img src={q.imageUrl} alt={q.question || `Word completion ${q.id}`} className="h-full w-full object-contain" />
          </div>
        ) : null}
        <p className={PROMPT_TEXT_CLASS}>
          <span className="font-bold text-slate-500 mr-2">Q{q.id}.</span>
          {q.question?.trim() || 'Complete the word.'}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {tokens.length > 0 ? tokens.map((token, tokenIndex) => {
            if (token.kind === 'blank') {
              const inputIndex = blankIndex;
              blankIndex += 1;
              return (
                <input
                  key={`${q.id}-completion-${tokenIndex}`}
                  type="text"
                  inputMode="text"
                  maxLength={1}
                  value={currentLetters[inputIndex] || ''}
                  onChange={(event) => {
                    const nextLetters = Array.from({ length: currentLetters.length || tokens.filter((item) => item.kind === 'blank').length }, (_, index) => (
                      index === inputIndex ? event.target.value.slice(-1) : (currentLetters[index] || '')
                    ));
                    onAnswer(buildWordCompletionAnswer(q.wordPattern || '', nextLetters));
                  }}
                  className="h-12 w-11 rounded-lg border-2 border-slate-300 bg-white text-center text-lg font-semibold uppercase text-slate-700 shadow-sm transition-all focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                />
              );
            }

            return (
              <span
                key={`${q.id}-completion-text-${tokenIndex}`}
                className={`inline-flex h-12 items-center justify-center text-lg font-semibold text-slate-700 ${
                  /\s/.test(token.value) ? 'min-w-[12px]' : 'min-w-[18px]'
                }`}
              >
                {token.value}
              </span>
            );
          }) : (
            <span className="text-sm text-slate-400">No pattern set</span>
          )}
        </div>
      </div>
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
      <div key={`q${q.id}-prompt`} className={PROMPT_TEXT_CLASS}>
        <span className="font-bold text-slate-500 mr-2">Q{q.id}.</span>
        {q.question}
      </div>,
      ...normalizedSubs.map((sub, idx) => (
        <div key={`q${q.id}-sub-${idx}`} className="ml-4 space-y-2">
            <label className="block whitespace-pre-wrap break-words text-base font-medium text-slate-600">{sub.label}) {sub.question}</label>
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
      <p className={PROMPT_TEXT_CLASS}>
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

// ========== SPEAKING (Audio Recording) ==========

function SpeakingCard({ q, sectionId, answer, onAnswer }: { q: OpenEndedQuestion; sectionId: string; answer?: string; onAnswer: (v: string) => void }) {
  if (q.subQuestions && q.subQuestions.length > 0) {
    const parsed = (() => {
      try { return typeof answer === 'string' ? JSON.parse(answer) : (answer || {}); } catch { return {}; }
    })();

    const normalizedSubs = q.subQuestions.map((sub, idx) => {
      if (typeof sub === 'string') {
        return { label: sub || String.fromCharCode(97 + idx), question: '', answer: '' };
      }
      return { label: sub.label || String.fromCharCode(97 + idx), question: sub.question || '', answer: sub.answer || '' };
    });

    return (
      <div className="space-y-4">
        <div className="text-base whitespace-pre-wrap break-words text-slate-700">
          <span className="font-bold text-slate-500 mr-2">Q{q.id}.</span>
          {q.question}
        </div>
        {normalizedSubs.map((sub, idx) => (
          <div key={`q${q.id}-sub-${idx}`} className="ml-4 space-y-2">
            <label className="block whitespace-pre-wrap break-words text-base font-medium text-slate-600">{sub.label}) {sub.question}</label>
            <AudioRecorder
              questionId={q.id * 100 + idx}
              sectionId={sectionId}
              savedUrl={parsed[sub.label] || undefined}
              onRecorded={(url) => {
                const newVal = { ...parsed, [sub.label]: url };
                onAnswer(JSON.stringify(newVal));
              }}
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="whitespace-pre-wrap break-words text-base text-slate-700">
        <span className="font-bold text-slate-500 mr-2">Q{q.id}.</span>
        {q.question}
      </p>
      {q.imageUrl && (
        <div className="flex justify-center">
          <img
            src={q.imageUrl}
            alt={q.question || `Speaking prompt ${q.id}`}
            className="max-h-56 w-full object-contain rounded-xl border border-slate-200 bg-white"
            loading="lazy"
          />
        </div>
      )}
      <AudioRecorder
        questionId={q.id}
        sectionId={sectionId}
        savedUrl={typeof answer === 'string' && answer.startsWith('http') ? answer : undefined}
        onRecorded={onAnswer}
      />
    </div>
  );
}

// ========== TRUE/FALSE (HuaZhong) ==========

function TrueFalseCard({ q, answer, onAnswer }: { q: TrueFalseQuestion; answer?: string; onAnswer: (v: string) => void }) {
  const parsed = (() => {
    try { return typeof answer === 'string' ? JSON.parse(answer) : {}; } catch { return {}; }
  })();

  const choices = q.choices && q.choices.length > 0 ? q.choices : ['True', 'False', 'Not Given'];

  const update = (label: string, field: string, value: string) => {
    const newVal = { ...parsed, [label]: { ...(parsed[label] || {}), [field]: value } };
    onAnswer(JSON.stringify(newVal));
  };

  const items = [
    <div key={`q${q.id}-prompt`} className={PROMPT_HEADING_CLASS}>
      <span className="font-bold text-slate-500 mr-2">Q{q.id}.</span>
      {q.question || 'State whether each statement is True, False, or Not Given.'}
    </div>,
    ...q.statements.map((s, idx) => (
      <div key={`q${q.id}-stmt-${idx}`} className="ml-2 p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
        <p className={PROMPT_TEXT_CLASS}><span className="font-bold">{s.label})</span> {s.statement}</p>
        <div className="flex gap-3">
          {choices.map((tf) => (
            <button
              key={tf}
              onClick={() => update(s.label, 'tf', tf)}
              className={`
                px-4 py-1.5 rounded-lg border-2 text-base font-medium transition-all
                ${parsed[s.label]?.tf === tf
                  ? tf === 'True'
                    ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                    : tf === 'False'
                      ? 'border-red-400 bg-red-50 text-red-700'
                      : 'border-amber-400 bg-amber-50 text-amber-700'
                  : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }
              `}
            >
              {tf}
            </button>
          ))}
        </div>
        {q.requiresReason && (
          <textarea
            value={parsed[s.label]?.reason || ''}
            onChange={(e) => update(s.label, 'reason', e.target.value)}
            className="w-full p-2.5 rounded-lg border-2 border-slate-200 focus:border-blue-400 text-base text-slate-700 resize-none"
            rows={2}
            placeholder="Give your reason..."
          />
        )}
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
        <div className={PROMPT_HEADING_CLASS}>
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
      <div className={PROMPT_HEADING_CLASS}>
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
      <div className={PROMPT_HEADING_CLASS}>
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
    <div key={`q${q.id}-prompt`} className={PROMPT_HEADING_CLASS}>
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
            {q.events.map((_, index) => (
              <option key={index} value={String(index + 1)}>
                {index + 1}
              </option>
            ))}
          </select>
          <span className="whitespace-pre-wrap break-words text-base text-slate-600">{event}</span>
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
      <div className={PROMPT_HEADING_CLASS}>
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
            <p className="whitespace-pre-wrap break-words text-base text-slate-600">{String.fromCharCode(97 + i)}) {item.clue || ''}</p>
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

function SentenceReorderCard({ q, answer, onAnswer }: { q: SentenceReorderQuestion; answer?: string; onAnswer: (v: string) => void }) {
  const parsed = (() => {
    try { return typeof answer === 'string' ? JSON.parse(answer) : {}; } catch { return {}; }
  })() as Record<string, unknown>;

  const splitTokens = (value: string) => {
    const slashTokens = value.split('/').map((part) => part.trim()).filter(Boolean);
    if (slashTokens.length > 1) return slashTokens;
    const wordTokens = value.trim().split(/\s+/).filter(Boolean);
    return wordTokens.length > 0 ? wordTokens : [];
  };

  const getStoredTokens = (label: string, fallbackTokens: string[]) => {
    const raw = parsed[label];
    if (Array.isArray(raw)) {
      const tokens = raw.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
      return tokens.length > 0 ? tokens : fallbackTokens;
    }
    if (typeof raw === 'string' && raw.trim()) {
      const slashTokens = splitTokens(raw);
      if (slashTokens.length > 1) return slashTokens;
      const wordTokens = raw.trim().split(/\s+/).filter(Boolean);
      return wordTokens.length > 0 ? wordTokens : fallbackTokens;
    }
    return fallbackTokens;
  };

  const persistTokens = (label: string, tokens: string[]) => {
    const next = { ...parsed, [label]: tokens };
    onAnswer(JSON.stringify(next));
  };

  const moveToken = (tokens: string[], fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || fromIndex < 0 || fromIndex >= tokens.length) return tokens;
    const next = [...tokens];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    return next;
  };

  return (
    <div className="space-y-4">
      <div className={PROMPT_HEADING_CLASS}>
        <span className="font-bold text-slate-500 mr-2">Q{q.id}.</span>
        {q.question}
      </div>
      <div className="rounded-xl border border-lime-200 bg-lime-50/60 p-4">
        <h3 className="mb-1 text-sm font-bold uppercase tracking-wider text-lime-700">Drag To Reorder</h3>
        <p className="text-sm text-slate-600">Drag the word blocks until each sentence is in the correct order.</p>
      </div>
      <div className="space-y-4">
        {q.items.map((item) => {
          const baseTokens = splitTokens(item.scrambledWords);
          const orderedTokens = getStoredTokens(item.label, baseTokens);
          return (
          <div key={item.label} className="rounded-xl border border-lime-100 bg-lime-50/30 p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-lime-200 text-xs font-bold text-lime-900">
                {item.label}
              </span>
              <div className="flex-1 space-y-3">
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-lime-700">Word Blocks</span>
                    <button
                      type="button"
                      onClick={() => persistTokens(item.label, baseTokens)}
                      className="text-xs font-medium text-slate-500 transition-colors hover:text-slate-700"
                    >
                      Reset Order
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {orderedTokens.map((token, index) => (
                      <button
                        key={`${token}-${index}`}
                        type="button"
                        draggable
                        onDragStart={(event) => {
                          event.dataTransfer.effectAllowed = 'move';
                          event.dataTransfer.setData('text/plain', JSON.stringify({ label: item.label, index }));
                        }}
                        onDragOver={(event) => {
                          event.preventDefault();
                          event.dataTransfer.dropEffect = 'move';
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          try {
                            const payload = JSON.parse(event.dataTransfer.getData('text/plain')) as { label?: string; index?: number };
                            if (payload.label !== item.label || typeof payload.index !== 'number') return;
                            persistTokens(item.label, moveToken(orderedTokens, payload.index, index));
                          } catch {
                            // Ignore malformed drag payloads.
                          }
                        }}
                        className="inline-flex cursor-grab items-center gap-1.5 rounded-full border border-lime-200 bg-lime-50 px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-lime-300 hover:bg-lime-100 active:cursor-grabbing"
                      >
                        <GripVertical className="h-3.5 w-3.5 text-lime-600" />
                        {token}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )})}
      </div>
    </div>
  );
}

function InlineWordChoiceCard({ q, answer, onAnswer }: { q: InlineWordChoiceQuestion; answer?: string; onAnswer: (v: string) => void }) {
  const parsed = parseSerializedAnswerRecord(answer);

  const setChoice = (label: string, choiceIndex: number) => {
    onAnswer(JSON.stringify({
      ...parsed,
      [label]: choiceIndex,
    }));
  };

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        {q.items.map((item) => {
          const selectedIndex = getSerializedAnswerIndex(parsed, item.label);

          return (
            <div key={item.label} className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-4">
              <div className="text-base leading-relaxed text-slate-700">
                <span className="mr-3 inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-200 text-xs font-bold text-emerald-900">
                  {item.label}
                </span>
                {renderInlineWordChoiceParts(item, () => (
                  <>
                    {item.options.map((option, optionIndex) => {
                      const isSelected = selectedIndex === optionIndex;
                      return (
                        <button
                          key={`${item.label}-${optionIndex}`}
                          type="button"
                          onClick={() => setChoice(item.label, optionIndex)}
                          className={`mx-1 inline-flex rounded-full border px-3 py-1.5 text-sm font-medium transition-all ${
                            isSelected
                              ? 'border-emerald-400 bg-emerald-100 text-emerald-800 shadow-sm'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:bg-emerald-50'
                          }`}
                        >
                          {option}
                        </button>
                      );
                    })}
                  </>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PassageInlineWordChoiceCard({
  q,
  answer,
  onAnswer,
}: {
  q: PassageInlineWordChoiceQuestion;
  answer?: string;
  onAnswer: (v: string) => void;
}) {
  const parsed = parseSerializedAnswerRecord(answer);

  const setChoice = (label: string, choiceIndex: number) => {
    onAnswer(JSON.stringify({
      ...parsed,
      [label]: choiceIndex,
    }));
  };

  const paragraphs = q.passageText.split('\n');
  let blankIndex = 0;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-4">
        <div className="space-y-4">
          {paragraphs.map((paragraph, paragraphIndex) => {
            if (!paragraph.trim()) {
              return <div key={`passage-space-${paragraphIndex}`} className="h-3" />;
            }

            const parts = paragraph.split(/___/g);

            return (
              <p key={`passage-paragraph-${paragraphIndex}`} className="text-base leading-8 text-slate-700">
                {parts.map((part, partIndex) => {
                  const item = partIndex < parts.length - 1 ? q.items[blankIndex++] : undefined;
                  const selectedIndex = item ? getSerializedAnswerIndex(parsed, item.label) : undefined;

                  return (
                    <span key={`passage-segment-${paragraphIndex}-${partIndex}`}>
                      {part}
                      {item ? (
                        <span className="mx-1 inline-flex flex-wrap items-center gap-1 align-middle">
                          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-emerald-200 px-2 text-[10px] font-bold text-emerald-900">
                            {item.label}
                          </span>
                          {item.options.map((option, optionIndex) => {
                            const isSelected = selectedIndex === optionIndex;
                            return (
                              <button
                                key={`${item.label}-${optionIndex}`}
                                type="button"
                                onClick={() => setChoice(item.label, optionIndex)}
                                className={`inline-flex rounded-full border px-3 py-1 text-sm font-medium transition-all ${
                                  isSelected
                                    ? 'border-emerald-400 bg-emerald-100 text-emerald-800 shadow-sm'
                                    : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:bg-emerald-50'
                                }`}
                              >
                                {option}
                              </button>
                            );
                          })}
                        </span>
                      ) : partIndex < parts.length - 1 ? (
                        <span className="mx-1 inline-flex rounded-md border border-dashed border-slate-300 px-2 py-1 text-xs text-slate-400">
                          ___
                        </span>
                      ) : null}
                    </span>
                  );
                })}
              </p>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ========== CHECKBOX (HuaZhong) ==========

function CheckboxCard({ q, answer, onAnswer }: { q: CheckboxQuestion; answer?: number[]; onAnswer: (v: number[]) => void }) {
  const selected = answer || [];
  const selectionLimit = q.selectionLimit ?? Math.max(q.correctAnswers.length, 2);

  const toggle = (index: number) => {
    if (selected.includes(index)) {
      onAnswer(selected.filter(i => i !== index));
    } else if (selected.length < selectionLimit) {
      onAnswer([...selected, index]);
    }
  };

  return (
    <div className="space-y-4">
      <div key={`q${q.id}-prompt`} className={PROMPT_TEXT_CLASS}>
        <span className="font-bold text-slate-500 mr-2">Q{q.id}.</span>
        {q.question} <span className="text-xs text-slate-400">(Select {selectionLimit})</span>
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
        <p className="whitespace-pre-wrap break-words text-base text-slate-600 mb-3">{q.instructions}</p>
        <p className="text-base text-slate-500 mb-2">You may include:</p>
        <ul className="list-disc list-inside text-base text-slate-500 space-y-1">
          {q.prompts.map((p, i) => (
            <li key={i} className="whitespace-pre-wrap break-words">{p}</li>
          ))}
        </ul>
        <p className="mt-3 text-xs font-medium text-slate-400">Word count: {q.wordCount}</p>
      </div>
      {q.imageUrl && (
        <div className="flex justify-center">
          <img
            src={q.imageUrl}
            alt={q.topic}
            className="max-h-72 object-contain rounded-xl border border-slate-200 bg-white"
            loading="lazy"
          />
        </div>
      )}
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

function ReadingPassageBlock({ passage }: { passage: string }) {
  const paragraphs = passage.split('\n\n').filter(Boolean);

  return (
    <div className="mb-8 p-5 rounded-xl bg-blue-50/50 border border-blue-200">
      <h3 className="font-bold text-sm text-blue-700 mb-3 uppercase tracking-wider">Reading Passage</h3>
      <div className="space-y-3">
        {paragraphs.map((paragraph, index) => {
          const optionHeading = paragraph.match(/^([A-H])\s+(.+)$/);
          if (optionHeading) {
            return (
              <div
                key={index}
                className="flex items-center gap-3 rounded-xl bg-white border border-blue-200 px-4 py-3 shadow-sm"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                  {optionHeading[1]}
                </span>
                <span className="text-base font-semibold text-slate-800">{optionHeading[2]}</span>
              </div>
            );
          }

          return (
            <p key={index} className={PROMPT_TEXT_CLASS}>
              {paragraph}
            </p>
          );
        })}
      </div>
    </div>
  );
}

function InlineClozeMCQSection({
  section,
  sectionId,
  questions,
  getAnswer,
  setAnswer,
}: {
  section: Section;
  sectionId: string;
  questions: MCQQuestion[];
  getAnswer: (sectionId: string, id: number) => string | number | number[] | undefined;
  setAnswer: (sectionId: string, id: number, value: number) => void;
}) {
  const gapEntries = questions
    .map((question) => {
      const match = question.question.match(/(\d+)/);
      const gapNumber = match ? Number.parseInt(match[1], 10) : null;
      return gapNumber ? { gapNumber, question } : null;
    })
    .filter((item): item is { gapNumber: number; question: MCQQuestion } => item !== null);

  const gapMap = new Map(gapEntries.map((entry) => [entry.gapNumber, entry.question]));
  const [selectedGap, setSelectedGap] = useState<number | null>(gapEntries[0]?.gapNumber ?? null);
  const activeQuestion = selectedGap ? gapMap.get(selectedGap) : undefined;

  const renderGap = (gapNumber: number) => {
    const question = gapMap.get(gapNumber);
    if (!question) {
      return <span className="font-semibold text-slate-500">{`(${gapNumber}) ___`}</span>;
    }

    const rawAnswer = getAnswer(sectionId, question.id);
    const answerIndex = typeof rawAnswer === 'number' ? rawAnswer : Number.parseInt(String(rawAnswer ?? ''), 10);
    const selectedOption = Number.isFinite(answerIndex) && answerIndex >= 0 ? question.options[answerIndex] : '';
    const isActive = selectedGap === gapNumber;

    return (
      <button
        type="button"
        onClick={() => setSelectedGap(gapNumber)}
        className={`
          inline-flex items-center min-w-[72px] justify-center rounded-lg border-2 border-dashed px-2 py-1 text-sm font-medium transition-all
          ${selectedOption
            ? 'border-blue-400 bg-blue-50 text-blue-700'
            : isActive
              ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
              : 'border-slate-300 bg-white text-slate-500 hover:border-slate-400'
          }
        `}
      >
        {selectedOption || `(${gapNumber}) ___`}
      </button>
    );
  };

  const renderParagraph = (paragraph: string, index: number) => {
    const parts = paragraph.split(/(\(\d+\) ___)/g);
    return (
      <p key={index} className="whitespace-pre-wrap break-words text-base text-slate-700 leading-[2.2]">
        {parts.map((part, partIndex) => {
          const match = part.match(/\((\d+)\) ___/);
          if (!match) {
            return <span key={`${index}-${partIndex}`}>{part}</span>;
          }

          const gapNumber = Number.parseInt(match[1], 10);
          return <span key={`${index}-${partIndex}`}>{renderGap(gapNumber)}</span>;
        })}
      </p>
    );
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4">
        <h3 className="mb-2 font-bold text-indigo-700">Interactive Cloze</h3>
        <p className="text-sm text-slate-600">Click any blank in the passage, then choose one of the three options below.</p>
      </div>

      {section.passage && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 font-bold text-sm uppercase tracking-wider text-indigo-700">Passage</div>
          <div className="space-y-3">
            {section.passage.split('\n\n').filter(Boolean).map(renderParagraph)}
          </div>
        </div>
      )}

      {activeQuestion && (
        <div className="rounded-xl border border-indigo-200 bg-white p-5 shadow-sm">
          <div className="mb-2 text-sm font-bold uppercase tracking-wider text-indigo-700">
            Gap {selectedGap}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {activeQuestion.options.map((option, optionIndex) => {
              const isSelected = getAnswer(sectionId, activeQuestion.id) === optionIndex;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setAnswer(sectionId, activeQuestion.id, optionIndex)}
                  className={`
                    rounded-xl border-2 p-3 text-left text-base transition-all
                    ${isSelected
                      ? 'border-indigo-400 bg-indigo-50 text-indigo-700 shadow-sm'
                      : 'border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                    }
                  `}
                >
                  <span className="mr-2 font-bold text-slate-400">{String.fromCharCode(65 + optionIndex)}</span>
                  {option}
                </button>
              );
            })}
          </div>
        </div>
      )}
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
  getAnswer: (sectionId: string, id: number) => string | number | number[] | undefined;
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
                    <p className={PROMPT_TEXT_CLASS}>
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

function QuestionRenderer({ question, section, sectionId, answer, onAnswer }: {
  question: Question;
  section: Section;
  sectionId: string;
  answer: any;
  onAnswer: (v: any) => void;
}) {
  switch (question.type) {
    case 'mcq':
      return (
        <MCQQuestionCard
          q={question}
          answer={typeof answer === 'number' || Array.isArray(answer) ? answer : undefined}
          onAnswer={onAnswer}
        />
      );
    case 'picture-mcq':
      return (
        <PictureMCQCard
          q={question}
          answer={typeof answer === 'number' || Array.isArray(answer) ? answer : undefined}
          onAnswer={onAnswer}
        />
      );
    case 'listening-mcq':
      return (
        <ListeningMCQCard
          q={question}
          answer={typeof answer === 'number' || Array.isArray(answer) ? answer : undefined}
          onAnswer={onAnswer}
        />
      );
    case 'open-ended':
      if (question.responseMode === 'audio' || section.sectionType === 'speaking' || sectionId.toLowerCase().includes('speaking')) {
        return <SpeakingCard q={question} sectionId={sectionId} answer={answer} onAnswer={onAnswer} />;
      }
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
    case 'sentence-reorder':
      return <SentenceReorderCard q={question} answer={answer} onAnswer={onAnswer} />;
    case 'inline-word-choice':
      return <InlineWordChoiceCard q={question} answer={answer} onAnswer={onAnswer} />;
    case 'passage-inline-word-choice':
      return <PassageInlineWordChoiceCard q={question} answer={answer} onAnswer={onAnswer} />;
    case 'checkbox':
      return <CheckboxCard q={question} answer={answer as number[]} onAnswer={onAnswer} />;
    case 'writing':
      return <WritingCard q={question} answer={answer} onAnswer={onAnswer} />;
    case 'fill-blank':
      if (section.wordBank && section.wordBank.length > 0) {
        return null;
      }
      return <StandaloneFillBlankCard q={question} section={section} answer={typeof answer === 'string' ? answer : undefined} onAnswer={onAnswer} />;
    case 'picture-spelling':
      return <PictureSpellingCard q={question} answer={typeof answer === 'string' ? answer : undefined} onAnswer={onAnswer} />;
    case 'word-completion':
      return <WordCompletionCard q={question} answer={typeof answer === 'string' ? answer : undefined} onAnswer={onAnswer} />;
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

function MatchingDescriptionsBlock({ items }: { items: NonNullable<Section['matchingDescriptions']> }) {
  const hasDescriptions = items.some((item) => Boolean(item.text?.trim()));

  const getCardWidth = (item: NonNullable<Section['matchingDescriptions']>[number]) => {
    const nameLength = item.name.trim().length;
    const textLength = item.text?.trim().length ?? 0;
    const totalLength = nameLength + textLength;

    if (!hasDescriptions) {
      if (nameLength <= 8) return 'min(100%, 180px)';
      if (nameLength <= 14) return 'min(100%, 220px)';
      if (nameLength <= 22) return 'min(100%, 280px)';
      return 'min(100%, 340px)';
    }

    if (totalLength <= 36) return 'min(100%, 300px)';
    if (totalLength <= 72) return 'min(100%, 380px)';
    if (totalLength <= 120) return 'min(100%, 460px)';
    return 'min(100%, 560px)';
  };

  return (
    <div className="mb-8 rounded-xl border border-blue-200 bg-blue-50/50 p-5">
      <h3 className="mb-3 font-bold text-sm uppercase tracking-wider text-blue-700">Matching Options</h3>
      <div className="flex flex-wrap gap-3">
        {items.map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-blue-200 bg-white px-4 py-3 shadow-sm"
            style={{ width: getCardWidth(item) }}
          >
            <div className={`flex items-center gap-3 ${item.text ? 'mb-1' : ''}`}>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                {item.label.toUpperCase()}
              </span>
              <span className="whitespace-pre-wrap break-words text-base font-semibold text-slate-800">
                {stripDuplicatedOptionPrefix(item.name || 'Untitled option', item.label)}
              </span>
            </div>
            {item.text && (
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-600">{item.text}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ========== MAIN SECTION CONTENT ==========

function SectionQuestionBody({
  section,
  answerSectionId,
  selectedPaper,
  getAnswer,
  setAnswer,
}: {
  section: Section;
  answerSectionId: string;
  selectedPaper: Paper | null;
  getAnswer: (sectionId: string, questionId: number) => string | number | number[] | undefined;
  setAnswer: (sectionId: string, questionId: number, value: any) => void;
}) {
  const questions = Array.isArray(section?.questions) ? section.questions : [];
  const hasFillBlank = questions.some(q => q.type === 'fill-blank');
  const hasGrammarPassage = !!section.grammarPassage;
  const hasWordBank = !!section.wordBank;
  const isWIDAGrammar = hasFillBlank && hasWordBank && !hasGrammarPassage;
  const isHuaZhongGrammar = hasFillBlank && hasWordBank && hasGrammarPassage;
  const isWIDAReading = questions.some(q => q.type === 'wordbank-fill' || q.type === 'story-fill');
  const hasPassageInlineWordChoice = questions.some(q => q.type === 'passage-inline-word-choice');
  const isHuaZhongReading = !!section.passage && !hasPassageInlineWordChoice;
  const isPETInlineCloze = section.id === 'vocabulary-and-grammar' || section.inlineCloze === true;
  const isListeningSection = !!section.audioUrl;
  const usesDragDropFillBlank = hasFillBlank && hasWordBank;
  const regularQuestions = usesDragDropFillBlank
    ? questions.filter(q => q.type !== 'fill-blank')
    : questions;
  const visibleQuestions = (isWIDAGrammar || isHuaZhongGrammar) ? regularQuestions : questions;

  return (
    <>
      {section.storyImages && section.storyImages.length > 0 ? (
        <div className="mb-6 space-y-4">
          {section.storyImages.map((imgUrl: string, idx: number) => (
            <div key={idx} className="rounded-xl overflow-hidden border border-slate-200 shadow-sm">
              <img
                src={imgUrl}
                alt={`${section.title} reference ${idx + 1}`}
                className="w-full object-contain max-h-[500px] bg-white"
              />
            </div>
          ))}
        </div>
      ) : section.sceneImageUrl ? (
        <div className="mb-6 rounded-xl overflow-hidden border border-slate-200 shadow-sm">
          <img
            src={section.sceneImageUrl}
            alt={`${section.title} reference`}
            className="w-full object-contain max-h-[500px] bg-white"
          />
        </div>
      ) : null}

      {isListeningSection && section.audioUrl && (
        <AudioPlayer audioUrl={section.audioUrl} />
      )}

      {isWIDAReading ? (
        <WIDAReadingSection
          section={section}
          sectionId={answerSectionId}
          getAnswer={getAnswer}
          setAnswer={setAnswer}
          readingWordBank={selectedPaper?.readingWordBank || []}
        />
      ) : isPETInlineCloze ? (
        <InlineClozeMCQSection
          section={section}
          sectionId={answerSectionId}
          questions={questions.filter((q): q is MCQQuestion => q.type === 'mcq')}
          getAnswer={getAnswer}
          setAnswer={(sectionId, id, value) => setAnswer(sectionId, id, value)}
        />
      ) : (
        <>
          {isHuaZhongReading && (
            <ReadingPassageBlock passage={section.passage!} />
          )}

          {section.matchingDescriptions && section.matchingDescriptions.length > 0 && (
            <MatchingDescriptionsBlock items={section.matchingDescriptions} />
          )}

          {section.sectionType === 'speaking' && section.taskDescription && (
            <div className="rounded-xl border border-sky-100 bg-sky-50/40 p-4">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-sky-700">Task Description</p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                {section.taskDescription}
              </p>
            </div>
          )}

          {(isWIDAGrammar || isHuaZhongGrammar) && (
            <DragDropFillBlank
              questions={questions.filter(q => q.type === 'fill-blank') as FillBlankQuestion[]}
              wordBank={section.wordBank!}
              grammarPassage={section.grammarPassage}
              sceneImageUrl={section.sceneImageUrl}
              sectionId={answerSectionId}
              getAnswer={getAnswer}
              setAnswer={setAnswer}
            />
          )}

          <div className="space-y-6">
            {visibleQuestions.map((q) => {
              const answer = getAnswer(answerSectionId, q.id);
              return (
                <div key={q.id} className="p-5 rounded-xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                  <QuestionRenderer
                    question={q}
                    section={section}
                    sectionId={answerSectionId}
                    answer={answer}
                    onAnswer={(v) => setAnswer(answerSectionId, q.id, v)}
                  />
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}

export default function SectionContent() {
  const { state, currentSection, sections, selectedPaper, setCurrentSection, setAnswer, getAnswer } = useQuiz();
  const section = currentSection;
  const isLastSection = state.currentSectionIndex === sections.length - 1;
  const questionMap = new Map((Array.isArray(section?.questions) ? section.questions : []).map((question) => [question.id, question]));
  const manualBlocks = section.manualBlocks ?? [];

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

        {manualBlocks.length > 0 ? (
          <div className="space-y-8">
            {manualBlocks.map((block: ManualQuestionBlock) => {
              const blockQuestions = block.questionIds
                .map((questionId) => questionMap.get(questionId))
                .filter((question): question is Question => Boolean(question));
              const blockSection: Section = {
                ...section,
                id: `${section.id}::${block.id}`,
                subtitle: block.instructions || '',
                description: block.instructions || '',
                taskDescription: block.taskDescription,
                questions: blockQuestions,
                passage: block.passage,
                wordBank: block.wordBank,
                grammarPassage: block.grammarPassage,
                audioUrl: block.audioUrl,
                sceneImageUrl: block.sceneImageUrl,
                inlineCloze: block.inlineCloze,
                matchingDescriptions: block.matchingDescriptions,
                manualBlocks: undefined,
              };

              return (
                <div key={block.id} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 shadow-sm">
                  <div className="mb-5 flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-base font-bold text-slate-700 shadow-sm ring-1 ring-slate-200">
                      {block.displayNumber}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-bold text-slate-800">{`Question ${block.displayNumber}`}</h3>
                        {block.questionType ? (
                          <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            {block.questionType.replace(/-/g, ' ')}
                          </span>
                        ) : null}
                      </div>
                      {block.instructions ? (
                        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-500">
                          {block.instructions}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <SectionQuestionBody
                    section={blockSection}
                    answerSectionId={section.id}
                    selectedPaper={selectedPaper}
                    getAnswer={getAnswer}
                    setAnswer={setAnswer}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <SectionQuestionBody
            section={section}
            answerSectionId={section.id}
            selectedPaper={selectedPaper}
            getAnswer={getAnswer}
            setAnswer={setAnswer}
          />
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
