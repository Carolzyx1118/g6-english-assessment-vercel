/**
 * PassageMCQPreview.tsx
 *
 * Interactive passage-MCQ preview component (PET-style cloze).
 * Renders a passage with numbered blanks — clicking a blank opens a popover
 * showing the MCQ options for that specific blank. Selecting an option fills
 * the blank inline.
 */

import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { ManualPassageMCQQuestion } from "@shared/manualPaperBlueprint";

interface PassageMCQPreviewProps {
  passageText: string;
  questions: ManualPassageMCQQuestion[];
  sceneImageUrl?: string;
}

export default function PassageMCQPreview({
  passageText,
  questions,
  sceneImageUrl,
}: PassageMCQPreviewProps) {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [openBlank, setOpenBlank] = useState<number | null>(null);

  // Split the passage around ___ markers
  const parts = passageText.split(/___/);

  const answerKey = questions.map((q, i) => ({
    id: i + 1,
    answer: q.correctAnswer
      ? q.options.find((o) => o.label === q.correctAnswer)?.text || q.correctAnswer
      : "Not set",
  }));

  return (
    <div className="space-y-4">
      {sceneImageUrl && (
        <div className="flex justify-center rounded-2xl border border-slate-200 bg-white p-3">
          <img src={sceneImageUrl} alt="Scene" className="max-h-60 w-full object-contain" />
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Click each blank to choose an answer
        </p>
        <div className="text-sm leading-7 text-slate-800">
          {parts.map((part, index) => {
            const blankIndex = index; // 0-based blank number (blank appears AFTER this part)
            const isLastPart = index === parts.length - 1;

            return (
              <span key={index}>
                {/* Render the text part */}
                <span className="whitespace-pre-wrap">{part}</span>

                {/* Render the blank (not after the last part) */}
                {!isLastPart && (
                  <BlankSlot
                    blankNumber={blankIndex + 1}
                    question={questions[blankIndex]}
                    selectedAnswer={answers[blankIndex + 1]}
                    isOpen={openBlank === blankIndex + 1}
                    onOpenChange={(open) => setOpenBlank(open ? blankIndex + 1 : null)}
                    onSelect={(label) => {
                      setAnswers((prev) => ({ ...prev, [blankIndex + 1]: label }));
                      setOpenBlank(null);
                    }}
                  />
                )}
              </span>
            );
          })}
        </div>
      </div>

      {/* Answer key */}
      <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Answer Key</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {answerKey.map((item) => (
            <span
              key={item.id}
              className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-medium text-emerald-700"
            >
              {item.id}. {item.answer}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function BlankSlot({
  blankNumber,
  question,
  selectedAnswer,
  isOpen,
  onOpenChange,
  onSelect,
}: {
  blankNumber: number;
  question?: ManualPassageMCQQuestion;
  selectedAnswer?: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (label: string) => void;
}) {
  const selectedOption = question?.options.find((o) => o.label === selectedAnswer);

  return (
    <Popover open={isOpen} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`
            mx-1 inline-flex items-center gap-1 rounded-lg border-2 px-2.5 py-0.5 text-sm font-medium
            transition-all duration-150 cursor-pointer
            ${
              selectedAnswer
                ? "border-[#1E3A5F] bg-[#1E3A5F]/5 text-[#1E3A5F] hover:bg-[#1E3A5F]/10"
                : "border-dashed border-[#D4A84B] bg-amber-50 text-amber-700 hover:bg-amber-100"
            }
          `}
        >
          <span className="text-xs font-bold text-slate-400">({blankNumber})</span>
          {selectedOption ? (
            <span>
              {selectedAnswer}. {selectedOption.text}
            </span>
          ) : (
            <span className="text-amber-600">___</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto min-w-[200px] max-w-[300px] p-2" align="start">
        <p className="mb-2 px-2 text-xs font-semibold text-slate-500">
          Blank {blankNumber} — Choose one:
        </p>
        {question && question.options.length > 0 ? (
          <div className="space-y-1">
            {question.options.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => onSelect(option.label)}
                className={`
                  flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors
                  ${
                    selectedAnswer === option.label
                      ? "bg-[#1E3A5F] text-white font-medium"
                      : "hover:bg-slate-100 text-slate-700"
                  }
                `}
              >
                <span
                  className={`
                    flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold
                    ${
                      selectedAnswer === option.label
                        ? "bg-white text-[#1E3A5F]"
                        : "bg-slate-200 text-slate-600"
                    }
                  `}
                >
                  {option.label}
                </span>
                <span>{option.text || "—"}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="px-2 py-3 text-xs text-slate-400">No options defined yet.</p>
        )}
      </PopoverContent>
    </Popover>
  );
}
