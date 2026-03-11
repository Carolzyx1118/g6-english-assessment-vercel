/**
 * DragDropFillBlank.tsx
 * 
 * Unified drag-and-drop fill-in-the-blank component.
 * Handles TWO modes:
 * 
 * 1. PASSAGE MODE (when grammarPassage is provided):
 *    - Shows a passage with inline blanks like <b>(21) ___</b>
 *    - User drags word bank letters (A, B, C...) into blanks
 *    - Each word can only be used once
 *    - Answer stored as the LETTER (e.g., "A")
 * 
 * 2. SENTENCE MODE (when no grammarPassage, questions have individual sentences):
 *    - Shows individual sentences with ___ blanks
 *    - User drags word bank words into blanks
 *    - Words can be reused (same word may fit multiple blanks)
 *    - Answer stored as the WORD itself (e.g., "next to")
 */

import { useState } from 'react';
import { GripVertical } from 'lucide-react';
import type { FillBlankQuestion } from '@/data/papers';

interface DragDropFillBlankProps {
  questions: FillBlankQuestion[];
  wordBank: { letter: string; word: string }[];
  grammarPassage?: string;
  sceneImageUrl?: string;
  sectionId: string;
  getAnswer: (sectionId: string, id: number) => string | number | number[] | undefined;
  setAnswer: (sectionId: string, id: number, v: string) => void;
}

export default function DragDropFillBlank({
  questions,
  wordBank,
  grammarPassage,
  sceneImageUrl,
  sectionId,
  getAnswer,
  setAnswer,
}: DragDropFillBlankProps) {
  const isPassageMode = !!grammarPassage;

  if (isPassageMode) {
    return (
      <PassageModeFillBlank
        questions={questions}
        wordBank={wordBank}
        grammarPassage={grammarPassage!}
        sceneImageUrl={sceneImageUrl}
        sectionId={sectionId}
        getAnswer={getAnswer}
        setAnswer={setAnswer}
      />
    );
  }

  return (
    <SentenceModeFillBlank
      questions={questions}
      wordBank={wordBank}
      sceneImageUrl={sceneImageUrl}
      sectionId={sectionId}
      getAnswer={getAnswer}
      setAnswer={setAnswer}
    />
  );
}

// ===================================================================
// PASSAGE MODE: grammarPassage with inline blanks, answers are letters
// ===================================================================

function PassageModeFillBlank({
  questions,
  wordBank,
  grammarPassage,
  sceneImageUrl,
  sectionId,
  getAnswer,
  setAnswer,
}: {
  questions: FillBlankQuestion[];
  wordBank: { letter: string; word: string }[];
  grammarPassage: string;
  sceneImageUrl?: string;
  sectionId: string;
  getAnswer: (sectionId: string, id: number) => string | number | number[] | undefined;
  setAnswer: (sectionId: string, id: number, v: string) => void;
}) {
  const [draggedWord, setDraggedWord] = useState<{ letter: string; word: string } | null>(null);
  const [selectedWord, setSelectedWord] = useState<{ letter: string; word: string } | null>(null);
  const isDialogueLayout = sectionId.startsWith('speaking-part-');

  // Track which letters are used (each word can only be used once in passage mode)
  const usedLetters = new Set<string>();
  questions.forEach(q => {
    const ans = getAnswer(sectionId, q.id);
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
      setAnswer(sectionId, questionId, letter);
    }
    setDraggedWord(null);
  };

  const handleWordClick = (item: { letter: string; word: string }) => {
    if (usedLetters.has(item.letter)) return;
    setSelectedWord(prev => prev?.letter === item.letter ? null : item);
  };

  const handleBlankClick = (questionId: number) => {
    if (selectedWord) {
      setAnswer(sectionId, questionId, selectedWord.letter);
      setSelectedWord(null);
    }
  };

  const handleRemoveWord = (questionId: number) => {
    setAnswer(sectionId, questionId, '');
  };

  const renderBlank = (questionId: number, key: string) => {
    const answer = getAnswer(sectionId, questionId);
    const answerWord = answer && typeof answer === 'string' ? wordBank.find((w) => w.letter === answer) : null;

    return (
      <span
        key={key}
        className={`
          inline-flex items-center min-w-[72px] mx-1 px-2 py-0.5 rounded-lg border-2 border-dashed
          transition-all duration-200 cursor-pointer align-baseline
          ${answerWord
            ? 'border-amber-400 bg-amber-50 text-amber-700 font-semibold'
            : draggedWord || selectedWord
              ? 'border-blue-400 bg-blue-50'
              : 'border-slate-300 bg-slate-50 text-slate-400'
          }
        `}
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, questionId)}
        onClick={() => {
          if (answerWord) {
            handleRemoveWord(questionId);
          } else {
            handleBlankClick(questionId);
          }
        }}
      >
        <span className="text-xs font-bold text-slate-400 mr-1">({questionId})</span>
        {answerWord ? (
          <span className="flex items-center gap-1">
            {answerWord.word}
            <button
              onClick={(e) => { e.stopPropagation(); handleRemoveWord(questionId); }}
              className="ml-1 w-4 h-4 rounded-full bg-amber-200 text-amber-600 flex items-center justify-center text-xs hover:bg-amber-300"
            >
              x
            </button>
          </span>
        ) : (
          <span className="text-xs">___</span>
        )}
      </span>
    );
  };

  const renderLineContent = (text: string, keyPrefix: string) => {
    const parts = text.split(/(<b>\(\d+\) ___<\/b>)/g);
    return parts.map((part, index) => {
      const match = part.match(/<b>\((\d+)\) ___<\/b>/);
      if (!match) {
        return <span key={`${keyPrefix}-${index}`} dangerouslySetInnerHTML={{ __html: part }} />;
      }
      const questionId = parseInt(match[1], 10);
      return renderBlank(questionId, `${keyPrefix}-${index}`);
    });
  };

  return (
    <div className="space-y-6">
      {sceneImageUrl && (
        <div className="flex justify-center">
          <img
            src={sceneImageUrl}
            alt="Scene for fill-in-the-blank"
            className="max-h-56 object-contain rounded-xl border border-slate-200 shadow-sm"
            loading="lazy"
          />
        </div>
      )}

      {/* Word Bank */}
      <div className="p-5 rounded-xl bg-amber-50/50 border border-amber-200" style={{ marginBottom: '10px' }}>
        <h3 className="font-bold text-sm text-amber-700 mb-3 uppercase tracking-wider">
          Word Bank
          <span className="ml-2 text-xs font-normal text-amber-500 normal-case">
            (Drag words to blanks, or click to select — each word used once)
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
                onClick={() => !isUsed && handleWordClick({ letter, word })}
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
      <div className="p-5 rounded-xl bg-white border border-slate-200" style={{ marginBottom: '30px' }}>
        <h3 className="font-bold text-sm text-amber-700 mb-3 uppercase tracking-wider">
          {isDialogueLayout ? 'Dialogue' : 'Passage'}
        </h3>
        {isDialogueLayout ? (
          <div className="space-y-3">
            {grammarPassage
              .split('\n')
              .map((line) => line.trim())
              .filter(Boolean)
              .map((line, lineIndex) => {
                const match = line.match(/^([^:]+):\s*(.*)$/);
                if (!match) {
                  return (
                    <div key={lineIndex} className="text-base text-slate-700 leading-[2.1]">
                      {renderLineContent(line, `dialogue-${lineIndex}`)}
                    </div>
                  );
                }

                const [, speaker, content] = match;
                return (
                  <div key={lineIndex} className="grid grid-cols-[88px_minmax(0,1fr)] gap-3 items-start">
                    <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm font-semibold text-amber-700 text-center">
                      {speaker}
                    </div>
                    <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-base text-slate-700 leading-[2.1]">
                      {renderLineContent(content, `dialogue-${lineIndex}`)}
                    </div>
                  </div>
                );
              })}
          </div>
        ) : (
          <div className="text-base text-slate-700 leading-[2.2] space-y-3">
            {grammarPassage.split('\n\n').map((paragraph, pIdx) => (
              <p key={pIdx}>{renderLineContent(paragraph, `paragraph-${pIdx}`)}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ===================================================================
// SENTENCE MODE: individual sentences with blanks, answers are words
// ===================================================================

function SentenceModeFillBlank({
  questions,
  wordBank,
  sceneImageUrl,
  sectionId,
  getAnswer,
  setAnswer,
}: {
  questions: FillBlankQuestion[];
  wordBank: { letter: string; word: string }[];
  sceneImageUrl?: string;
  sectionId: string;
  getAnswer: (sectionId: string, id: number) => string | number | number[] | undefined;
  setAnswer: (sectionId: string, id: number, v: string) => void;
}) {
  const [draggedWord, setDraggedWord] = useState<{ letter: string; word: string } | null>(null);
  const [selectedWord, setSelectedWord] = useState<{ letter: string; word: string } | null>(null);

  // In sentence mode, words can be reused

  const handleDragStart = (e: React.DragEvent, item: { letter: string; word: string }) => {
    setDraggedWord(item);
    e.dataTransfer.setData('text/plain', item.word);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e: React.DragEvent, questionId: number) => {
    e.preventDefault();
    const word = e.dataTransfer.getData('text/plain');
    if (word) {
      setAnswer(sectionId, questionId, word);
    }
    setDraggedWord(null);
  };

  const handleWordClick = (item: { letter: string; word: string }) => {
    setSelectedWord(prev => prev?.word === item.word ? null : item);
  };

  const handleBlankClick = (questionId: number) => {
    if (selectedWord) {
      setAnswer(sectionId, questionId, selectedWord.word);
      setSelectedWord(null);
    }
  };

  const handleRemoveWord = (questionId: number) => {
    setAnswer(sectionId, questionId, '');
  };

  // Build blanks from questions
  const blanks = questions.map((q) => ({
    id: q.id,
    text: q.question || `Question ${q.id}: ___`,
  }));

  const renderSentenceParts = (
    text: string,
    blankId: number,
    answerWord: string | null,
  ) => {
    const parts = text.split('___');
    const blankNode = (
      <span
        key={`blank-${blankId}`}
        className={`
          inline-flex max-w-full items-center align-baseline mx-1 min-w-[72px] px-3 py-1 rounded-lg border-2 border-dashed
          transition-all duration-200 cursor-pointer
          ${answerWord
            ? 'border-amber-400 bg-amber-50 text-amber-700 font-semibold'
            : draggedWord || selectedWord
              ? 'border-blue-400 bg-blue-50 animate-pulse'
              : 'border-slate-300 bg-slate-50 text-slate-400'
          }
        `}
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, blankId)}
        onClick={() => {
          if (answerWord) {
            handleRemoveWord(blankId);
          } else {
            handleBlankClick(blankId);
          }
        }}
      >
        {answerWord ? (
          <span className="flex items-center gap-1">
            {answerWord}
            <button
              onClick={(e) => { e.stopPropagation(); handleRemoveWord(blankId); }}
              className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-200 text-xs text-amber-600 hover:bg-amber-300"
            >
              x
            </button>
          </span>
        ) : (
          <span className="text-xs">___</span>
        )}
      </span>
    );

    return parts.flatMap((part, index) => (
      index < parts.length - 1
        ? [
            <span key={`text-${blankId}-${index}`}>{part}</span>,
            blankNode,
          ]
        : [<span key={`text-${blankId}-${index}`}>{part}</span>]
    ));
  };

  return (
    <div className="space-y-6 mb-8">
      {/* Word Bank */}
      <div className="p-5 rounded-xl bg-amber-50/50 border border-amber-200">
        <h3 className="font-bold text-sm text-amber-700 mb-3 uppercase tracking-wider">
          Word Bank
          <span className="ml-2 text-xs font-normal text-amber-500 normal-case">
            (Drag words to blanks — words can be reused)
          </span>
        </h3>
        <div className="flex flex-wrap gap-2">
          {wordBank.map(({ letter, word }) => {
            const isSelected = selectedWord?.word === word;
            return (
              <div
                key={letter}
                draggable
                onDragStart={(e) => handleDragStart(e, { letter, word })}
                onDragEnd={() => setDraggedWord(null)}
                onClick={() => handleWordClick({ letter, word })}
                className={`
                  flex items-center gap-1.5 px-3 py-2 rounded-lg border-2 text-base font-medium transition-all duration-200
                  ${isSelected
                    ? 'border-blue-400 bg-blue-50 text-blue-700 shadow-md cursor-pointer ring-2 ring-blue-200'
                    : 'border-amber-200 bg-white text-slate-700 cursor-grab hover:border-amber-400 hover:shadow-sm active:cursor-grabbing'
                  }
                `}
              >
                <GripVertical className="w-3 h-3 text-slate-400" />
                {word}
              </div>
            );
          })}
        </div>
      </div>

      {/* Individual sentence blanks */}
      <div className="p-5 rounded-xl bg-white border border-slate-200 space-y-4">
        <h3 className="font-bold text-sm text-amber-700 mb-3 uppercase tracking-wider">Fill in the blanks</h3>
        {blanks.map((blank) => {
          if (!blank.id) return null;
          const answer = getAnswer(sectionId, blank.id);
          const answerWord = answer && typeof answer === 'string' ? answer : null;
          return (
            <div key={blank.id} className="text-base leading-[2.2] text-slate-700">
              <span className="mr-2 inline-block font-bold text-slate-500 align-baseline">{`Q${blank.id}.`}</span>
              {renderSentenceParts(blank.text, blank.id, answerWord)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
