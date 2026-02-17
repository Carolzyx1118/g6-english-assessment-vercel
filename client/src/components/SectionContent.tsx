import { useQuiz } from '@/contexts/QuizContext';
import { sections, readingWordBank } from '@/data/questions';
import type { MCQQuestion, PictureMCQ, FillBlankQuestion, ListeningMCQ, WordBankFillIn, StoryFillIn, Question } from '@/data/questions';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Send, AlertTriangle, GripVertical, Play, Pause, Volume2 } from 'lucide-react';
import { useState, useCallback, useRef, useEffect } from 'react';

// ========== PICTURE MCQ (Vocabulary & Grammar Q4) ==========

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

// ========== TEXT MCQ (Grammar Q1-Q8) ==========

function MCQQuestionCard({ q, answer, onAnswer }: { q: MCQQuestion; answer?: number; onAnswer: (v: number) => void }) {
  return (
    <div className="space-y-4">
      <p className="text-base text-slate-700 leading-relaxed">
        <span className="font-bold text-slate-500 mr-2">Q{q.id}.</span>
        {q.question}
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

// ========== LISTENING MCQ (with picture options) ==========

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

// ========== WORD BANK FILL-IN (Reading Part 1) ==========

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

// ========== STORY FILL-IN (Reading Part 2) ==========

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

// ========== DRAG & DROP WORD BANK (Grammar Q9 fill-in) ==========

function DragDropGrammarSection({
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
  getAnswer: (sectionId: string, id: number) => string | number | undefined;
  setAnswer: (sectionId: string, id: number, v: string) => void;
}) {
  const [draggedWord, setDraggedWord] = useState<{ letter: string; word: string } | null>(null);
  const [selectedWord, setSelectedWord] = useState<{ letter: string; word: string } | null>(null);

  const usedWords = new Set<string>();
  questions.forEach(q => {
    const ans = getAnswer(sectionId, q.id);
    if (ans && typeof ans === 'string') usedWords.add(ans);
  });

  const handleDragStart = (e: React.DragEvent, item: { letter: string; word: string }) => {
    setDraggedWord(item);
    e.dataTransfer.setData('text/plain', item.word);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
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
    if (usedWords.has(item.word) && !questions.some(q => getAnswer(sectionId, q.id) === item.word)) return;
    setSelectedWord(item);
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

  const blanks = [
    { id: questions[0]?.id, label: 'a', text: 'The rubber is ___ the pencil case.' },
    { id: questions[1]?.id, label: 'b', text: 'The crayons are ___ the pencil case.' },
    { id: questions[2]?.id, label: 'c', text: 'The pencils are ___ the desk.' },
    { id: questions[3]?.id, label: 'd', text: 'The pen is ___ the book.' },
    { id: questions[4]?.id, label: 'e', text: 'The pencils are ___ the book.' },
  ];

  return (
    <div className="space-y-6 mb-8">
      {/* Scene Image */}
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
      <div className="p-5 rounded-xl bg-amber-50/50 border border-amber-200">
        <h3 className="font-bold text-sm text-amber-700 mb-3 uppercase tracking-wider">
          Word Bank
          <span className="ml-2 text-xs font-normal text-amber-500 normal-case">
            (Drag words to blanks, or click to select)
          </span>
        </h3>
        <div className="flex flex-wrap gap-2">
          {wordBank.map(({ letter, word }) => {
            const isUsed = usedWords.has(word);
            const isSelected = selectedWord?.word === word;
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
                {word}
              </div>
            );
          })}
        </div>
      </div>

      {/* Fill-in blanks */}
      <div className="p-5 rounded-xl bg-white border border-slate-200 space-y-4">
        <h3 className="font-bold text-sm text-amber-700 mb-3 uppercase tracking-wider">Fill in the blanks</h3>
        {blanks.map((blank) => {
          if (!blank.id) return null;
          const answer = getAnswer(sectionId, blank.id);
          const answerWord = answer && typeof answer === 'string' ? answer : null;

          const parts = blank.text.split('___');
          return (
            <div key={blank.id} className="flex items-center gap-2 text-base text-slate-700">
              <span className="font-bold text-slate-500 w-6">{blank.label})</span>
              <span>{parts[0]}</span>
              <span
                className={`
                  inline-flex items-center min-w-[100px] px-3 py-1 rounded-lg border-2 border-dashed
                  transition-all duration-200 cursor-pointer
                  ${answerWord
                    ? 'border-amber-400 bg-amber-50 text-amber-700 font-semibold'
                    : draggedWord || selectedWord
                      ? 'border-blue-400 bg-blue-50 animate-pulse'
                      : 'border-slate-300 bg-slate-50 text-slate-400'
                  }
                `}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, blank.id)}
                onClick={() => {
                  if (answerWord) {
                    handleRemoveWord(blank.id);
                  } else {
                    handleBlankClick(blank.id);
                  }
                }}
              >
                {answerWord ? (
                  <span className="flex items-center gap-1">
                    {answerWord}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRemoveWord(blank.id); }}
                      className="ml-1 w-4 h-4 rounded-full bg-amber-200 text-amber-600 flex items-center justify-center text-xs hover:bg-amber-300"
                    >
                      ×
                    </button>
                  </span>
                ) : (
                  <span className="text-xs">___</span>
                )}
              </span>
              <span>{parts[1]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ========== READING SECTION (Part 1 word bank + Part 2 story) ==========

function ReadingSection({
  section,
  sectionId,
  getAnswer,
  setAnswer,
}: {
  section: typeof sections[0];
  sectionId: string;
  getAnswer: (sectionId: string, id: number) => string | number | undefined;
  setAnswer: (sectionId: string, id: number, v: string) => void;
}) {
  const wordBankQuestions = section.questions.filter(q => q.type === 'wordbank-fill') as WordBankFillIn[];
  const storyQuestions = section.questions.filter(q => q.type === 'story-fill') as StoryFillIn[];

  return (
    <div className="space-y-8">
      {/* Part 1: Word Bank Fill-in */}
      <div>
        <div className="mb-4 p-4 rounded-xl bg-blue-50/50 border border-blue-200">
          <h3 className="font-bold text-blue-700 mb-2">Part 1: Look and Read</h3>
          <p className="text-sm text-slate-600 mb-3">Choose the correct word from the word bank for each description.</p>
          {section.wordBankImageUrl && (
            <div className="flex justify-center">
              <img
                src={section.wordBankImageUrl}
                alt="Word bank items"
                className="max-h-32 object-contain rounded-lg"
                loading="lazy"
              />
            </div>
          )}
        </div>
        <div className="space-y-4">
          {wordBankQuestions.map((q) => {
            const answer = getAnswer(sectionId, q.id);
            return (
              <div key={q.id} className="p-5 rounded-xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                <WordBankFillInCard
                  q={q}
                  answer={typeof answer === 'string' ? answer : undefined}
                  onAnswer={(v) => setAnswer(sectionId, q.id, v)}
                  wordBankItems={readingWordBank}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Part 2: Story Comprehension */}
      <div>
        <div className="mb-4 p-4 rounded-xl bg-emerald-50/50 border border-emerald-200">
          <h3 className="font-bold text-emerald-700 mb-2">Part 2: Read the Story</h3>
          <p className="text-sm text-slate-600">Read the story about Jane and fill in the blanks with 1-3 words.</p>
        </div>

        {section.storyParagraphs?.map((para, pIdx) => (
          <div key={pIdx} className="mb-6">
            {/* Story paragraph */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 mb-3">
              <p className="text-base text-slate-700 leading-relaxed italic">{para.text}</p>
            </div>
            {/* Questions for this paragraph */}
            <div className="space-y-3 ml-4">
              {para.questionIds.map(qId => {
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

// ========== MAIN SECTION CONTENT ==========

export default function SectionContent() {
  const { state, currentSection, setCurrentSection, setAnswer, getAnswer } = useQuiz();
  const section = currentSection;
  const isLastSection = state.currentSectionIndex === sections.length - 1;

  const isGrammarSection = section.wordBank && section.questions.some(q => q.type === 'fill-blank');
  const isReadingSection = section.id === 'reading';
  const isListeningSection = section.id === 'listening';

  const fillBlankQuestions = section.questions.filter(q => q.type === 'fill-blank') as FillBlankQuestion[];
  const mcqQuestions = section.questions.filter(q => q.type === 'mcq' || q.type === 'picture-mcq');

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
          <div className={`p-5 rounded-2xl ${section.bgColor} mb-6`}>
            <div className="flex items-center gap-3">
              <span className="text-3xl">{section.icon}</span>
              <div>
                <h2 className={`text-xl font-bold ${section.color}`}>{section.title}</h2>
                <p className="text-sm text-slate-500">{section.subtitle}</p>
              </div>
            </div>
          </div>
          <p className="text-sm text-slate-500 leading-relaxed">{section.description}</p>
        </div>

        {/* Listening Audio Player */}
        {isListeningSection && section.audioUrl && (
          <AudioPlayer audioUrl={section.audioUrl} />
        )}

        {/* Reading Section (special layout) */}
        {isReadingSection ? (
          <ReadingSection
            section={section}
            sectionId={section.id}
            getAnswer={getAnswer}
            setAnswer={setAnswer}
          />
        ) : (
          <>
            {/* Grammar fill-in-blank with drag & drop */}
            {isGrammarSection && (
              <DragDropGrammarSection
                questions={fillBlankQuestions}
                wordBank={section.wordBank!}
                sceneImageUrl={section.sceneImageUrl}
                sectionId={section.id}
                getAnswer={getAnswer}
                setAnswer={setAnswer}
              />
            )}

            {/* Regular questions (MCQ, PictureMCQ, ListeningMCQ) */}
            <div className="space-y-6">
              {(isGrammarSection ? mcqQuestions : section.questions).map((q) => {
                const answer = getAnswer(section.id, q.id);
                return (
                  <div key={q.id} className="p-5 rounded-xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                    {q.type === 'picture-mcq' && (
                      <PictureMCQCard
                        q={q}
                        answer={typeof answer === 'number' ? answer : undefined}
                        onAnswer={(v) => setAnswer(section.id, q.id, v)}
                      />
                    )}
                    {q.type === 'mcq' && (
                      <MCQQuestionCard
                        q={q}
                        answer={typeof answer === 'number' ? answer : undefined}
                        onAnswer={(v) => setAnswer(section.id, q.id, v)}
                      />
                    )}
                    {q.type === 'listening-mcq' && (
                      <ListeningMCQCard
                        q={q}
                        answer={typeof answer === 'number' ? answer : undefined}
                        onAnswer={(v) => setAnswer(section.id, q.id, v)}
                      />
                    )}
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
