import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Check, FilePlus2, ImagePlus, Link2, Loader2, Music, PenLine, Plus, SquarePen, Trash2, Volume2 } from "lucide-react";
import type { FillBlankQuestion } from "@/data/papers";
import DragDropFillBlank from "@/components/DragDropFillBlank";
import {
  compressImage,
  createSquareImageDataUrl,
  fileToBase64,
  formatFileSize,
  validateAudioFile,
  validateImageFile,
} from "@/lib/imageUtils";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type {
  ManualAudioFile,
  ManualFillBlankQuestion,
  ManualMCQOption,
  ManualMCQQuestion,
  ManualMatchingDescription,
  ManualOptionImage,
  ManualPaperBlueprint,
  ManualPassageFillBlankQuestion,
  ManualPassageMCQOption,
  ManualPassageMCQQuestion,
  ManualPassageMatchingQuestion,
  ManualQuestion,
  ManualQuestionType,
  ManualSection,
  ManualSectionType,
  ManualSubsection,
  ManualTypedFillBlankQuestion,
  ManualPassageOpenEndedQuestion,
  ManualWritingQuestion,
  ManualWordBankItem,
} from "@shared/manualPaperBlueprint";
import {
  MANUAL_QUESTION_TYPE_LABELS,
  MANUAL_QUESTION_TYPE_OPTIONS,
  MANUAL_SECTION_TYPE_LABELS,
} from "@shared/manualPaperBlueprint";
import { toast } from "sonner";
import PassageMCQPreview from "@/components/PassageMCQPreview";

const DEFAULT_SECTION_TYPE: ManualSectionType = "reading";
const DEFAULT_QUESTION_TYPE: ManualQuestionType = "mcq";
const DEFAULT_WORD_BANK_SIZE = 4;

function createLocalId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `manual_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getOptionLabel(index: number) {
  return String.fromCharCode(65 + index);
}

function relabelOptions(options: ManualMCQOption[]) {
  return options.map((option, optionIndex) => ({
    ...option,
    label: getOptionLabel(optionIndex),
  }));
}

function relabelWordBank(wordBank: ManualWordBankItem[]) {
  return wordBank.map((item, itemIndex) => ({
    ...item,
    letter: getOptionLabel(itemIndex),
  }));
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function createOption(index: number): ManualMCQOption {
  return {
    id: createLocalId(),
    label: getOptionLabel(index),
    text: "",
  };
}

function createMCQQuestion(): ManualMCQQuestion {
  return {
    id: createLocalId(),
    type: "mcq",
    prompt: "",
    options: [createOption(0), createOption(1), createOption(2)],
    correctAnswer: "A",
  };
}

function createWordBankItem(index: number): ManualWordBankItem {
  return {
    id: createLocalId(),
    letter: getOptionLabel(index),
    word: "",
  };
}

function createFillBlankQuestion(correctAnswerWordBankId: string): ManualFillBlankQuestion {
  return {
    id: createLocalId(),
    type: "fill-blank",
    prompt: "",
    correctAnswerWordBankId,
  };
}

function createPassageFillBlankQuestion(correctAnswerWordBankId: string): ManualPassageFillBlankQuestion {
  return {
    id: createLocalId(),
    type: "passage-fill-blank",
    prompt: "",
    correctAnswerWordBankId,
  };
}

function createTypedFillBlankQuestion(): ManualTypedFillBlankQuestion {
  return {
    id: createLocalId(),
    type: "typed-fill-blank",
    prompt: "",
    correctAnswer: "",
  };
}

function createPassageOpenEndedQuestion(): ManualPassageOpenEndedQuestion {
  return {
    id: createLocalId(),
    type: "passage-open-ended",
    prompt: "",
    referenceAnswer: "",
  };
}

function createWritingQuestion(): ManualWritingQuestion {
  return {
    id: createLocalId(),
    type: "writing",
    prompt: "",
  };
}

function createMatchingDescription(index: number): ManualMatchingDescription {
  return {
    id: createLocalId(),
    label: getOptionLabel(index),
    name: "",
    text: "",
  };
}

function createPassageMatchingQuestion(): ManualPassageMatchingQuestion {
  return {
    id: createLocalId(),
    type: "passage-matching",
    prompt: "",
    correctAnswer: "A",
  };
}

function createPassageMCQOption(index: number): ManualPassageMCQOption {
  return {
    id: createLocalId(),
    label: getOptionLabel(index),
    text: "",
  };
}

function createPassageMCQQuestion(blankNumber: number): ManualPassageMCQQuestion {
  return {
    id: createLocalId(),
    type: "passage-mcq",
    prompt: `Blank ${blankNumber}`,
    options: [createPassageMCQOption(0), createPassageMCQOption(1), createPassageMCQOption(2)],
    correctAnswer: "A",
  };
}

/** Returns true for question types that use a word bank */
function isWordBankSubsectionType(questionType: ManualQuestionType) {
  return questionType === "fill-blank" || questionType === "passage-fill-blank";
}

function createSubsection(questionType: ManualQuestionType = DEFAULT_QUESTION_TYPE): ManualSubsection {
  if (questionType === "fill-blank") {
    const wordBank = relabelWordBank(
      Array.from({ length: DEFAULT_WORD_BANK_SIZE }, (_, index) => createWordBankItem(index)),
    );

    return {
      id: createLocalId(),
      title: "",
      instructions: "",
      questionType,
      wordBank,
      questions: [createFillBlankQuestion(wordBank[0]?.id || "")],
    };
  }

  if (questionType === "passage-fill-blank") {
    const wordBank = relabelWordBank(
      Array.from({ length: DEFAULT_WORD_BANK_SIZE }, (_, index) => createWordBankItem(index)),
    );

    return {
      id: createLocalId(),
      title: "",
      instructions: "",
      questionType,
      wordBank,
      passageText: "",
      questions: [],
    };
  }

  if (questionType === "passage-mcq") {
    return {
      id: createLocalId(),
      title: "",
      instructions: "",
      questionType,
      passageText: "",
      questions: [],
    };
  }

  if (questionType === "typed-fill-blank") {
    return {
      id: createLocalId(),
      title: "",
      instructions: "",
      questionType,
      questions: [createTypedFillBlankQuestion()],
    };
  }

  if (questionType === "passage-open-ended") {
    return {
      id: createLocalId(),
      title: "",
      instructions: "",
      questionType,
      passageText: "",
      questions: [createPassageOpenEndedQuestion()],
    };
  }

  if (questionType === "writing") {
    return {
      id: createLocalId(),
      title: "",
      instructions: "",
      questionType,
      questions: [createWritingQuestion()],
    };
  }

  if (questionType === "passage-matching") {
    return {
      id: createLocalId(),
      title: "",
      instructions: "",
      questionType,
      matchingDescriptions: Array.from({ length: 5 }, (_, i) => createMatchingDescription(i)),
      questions: [createPassageMatchingQuestion()],
    };
  }

  return {
    id: createLocalId(),
    title: "",
    instructions: "",
    questionType,
    questions: [createMCQQuestion()],
  };
}

function createSection(sectionType: ManualSectionType = DEFAULT_SECTION_TYPE): ManualSection {
  return {
    id: createLocalId(),
    sectionType,
    subsections: [createSubsection()],
  };
}

function isManualMCQQuestion(question: ManualQuestion): question is ManualMCQQuestion {
  return question.type === "mcq";
}

function isManualFillBlankQuestion(question: ManualQuestion): question is ManualFillBlankQuestion {
  return question.type === "fill-blank";
}

function isManualPassageFillBlankQuestion(question: ManualQuestion): question is ManualPassageFillBlankQuestion {
  return question.type === "passage-fill-blank";
}

function isAnyFillBlankQuestion(question: ManualQuestion): question is ManualFillBlankQuestion | ManualPassageFillBlankQuestion {
  return question.type === "fill-blank" || question.type === "passage-fill-blank";
}

function isManualPassageMCQQuestion(question: ManualQuestion): question is ManualPassageMCQQuestion {
  return question.type === "passage-mcq";
}

function isManualTypedFillBlankQuestion(question: ManualQuestion): question is ManualTypedFillBlankQuestion {
  return question.type === "typed-fill-blank";
}

function isManualPassageOpenEndedQuestion(question: ManualQuestion): question is ManualPassageOpenEndedQuestion {
  return question.type === "passage-open-ended";
}

function isManualWritingQuestion(question: ManualQuestion): question is ManualWritingQuestion {
  return question.type === "writing";
}

function isManualPassageMatchingQuestion(question: ManualQuestion): question is ManualPassageMatchingQuestion {
  return question.type === "passage-matching";
}

/** Returns true for question types that use a passage */
function isPassageSubsectionType(questionType: ManualQuestionType) {
  return questionType === "passage-fill-blank" || questionType === "passage-mcq" || questionType === "passage-open-ended";
}

function buildBlueprint(
  paperSeed: string,
  createdAt: string,
  title: string,
  description: string,
  sections: ManualSection[],
): ManualPaperBlueprint {
  return {
    id: title
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || `paper-${paperSeed}`,
    title: title.trim(),
    description: description.trim(),
    sections: sections.map((section, sectionIndex) => ({
      ...section,
      partLabel: `Part ${sectionIndex + 1}`,
      subsections: section.subsections.map((subsection) => {
        if (isWordBankSubsectionType(subsection.questionType)) {
          return {
            ...subsection,
            wordBank: relabelWordBank(subsection.wordBank ?? []),
            questions: subsection.questions.filter(isAnyFillBlankQuestion),
          };
        }

        if (subsection.questionType === "passage-mcq") {
          return {
            ...subsection,
            questions: subsection.questions.filter(isManualPassageMCQQuestion).map((question) => ({
              ...question,
              options: relabelOptions(question.options as ManualMCQOption[]) as unknown as ManualPassageMCQOption[],
            })),
          };
        }

        if (subsection.questionType === "typed-fill-blank") {
          return {
            ...subsection,
            questions: subsection.questions.filter(isManualTypedFillBlankQuestion),
          };
        }

        if (subsection.questionType === "passage-open-ended") {
          return {
            ...subsection,
            questions: subsection.questions.filter(isManualPassageOpenEndedQuestion),
          };
        }

        if (subsection.questionType === "writing") {
          return {
            ...subsection,
            questions: subsection.questions.filter(isManualWritingQuestion),
          };
        }

        if (subsection.questionType === "passage-matching") {
          return {
            ...subsection,
            matchingDescriptions: (subsection.matchingDescriptions ?? []).map((desc, i) => ({
              ...desc,
              label: getOptionLabel(i),
            })),
            questions: subsection.questions.filter(isManualPassageMatchingQuestion),
          };
        }

        return {
          ...subsection,
          questions: subsection.questions.filter(isManualMCQQuestion).map((question) => ({
            ...question,
            options: relabelOptions(question.options),
          })),
        };
      }),
    })),
    createdAt,
  };
}

function buildFillBlankPreviewPassage(questions: ManualFillBlankQuestion[]) {
  return questions
    .map((question, questionIndex) => {
      const safePrompt = escapeHtml(question.prompt.trim() || `Sentence ${questionIndex + 1}`);

      if (safePrompt.includes("___")) {
        return safePrompt.replace("___", `<b>(${questionIndex + 1}) ___</b>`);
      }

      return `${safePrompt} <b>(${questionIndex + 1}) ___</b>`;
    })
    .join("\n\n");
}

/**
 * Build a passage preview for passage-fill-blank type.
 * The passage text contains ___ markers which we number sequentially.
 */
function buildPassageFillBlankPreviewPassage(passageText: string) {
  let blankIndex = 0;
  return escapeHtml(passageText).replace(/___/g, () => {
    blankIndex++;
    return `<b>(${blankIndex}) ___</b>`;
  });
}

/** Count the number of ___ blanks in a passage */
function countPassageBlanks(passageText: string): number {
  return (passageText.match(/___/g) || []).length;
}

function getCorrectWord(wordBank: ManualWordBankItem[] | undefined, wordBankId: string) {
  return wordBank?.find((item) => item.id === wordBankId)?.word || "";
}

function FillBlankSubsectionPreview({ subsection }: { subsection: ManualSubsection }) {
  const [answers, setAnswers] = useState<Record<number, string>>({});

  const wordBank = subsection.wordBank ?? [];
  const questions = useMemo(
    () => subsection.questions.filter(isManualFillBlankQuestion),
    [subsection.questions],
  );

  const previewQuestions = useMemo<FillBlankQuestion[]>(
    () =>
      questions.map((question, questionIndex) => ({
        id: questionIndex + 1,
        type: "fill-blank",
        question: question.prompt,
        correctAnswer: getCorrectWord(wordBank, question.correctAnswerWordBankId),
      })),
    [questions, wordBank],
  );

  const answerKey = useMemo(
    () =>
      questions.map((question, questionIndex) => ({
        id: questionIndex + 1,
        answer: getCorrectWord(wordBank, question.correctAnswerWordBankId) || "Not set",
      })),
    [questions, wordBank],
  );

  if (!questions.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-500">
        Add at least one blank to preview this question block.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DragDropFillBlank
        questions={previewQuestions}
        wordBank={wordBank.map((item) => ({ letter: item.letter, word: item.word || "Untitled word" }))}
        grammarPassage={buildFillBlankPreviewPassage(questions)}
        sceneImageUrl={subsection.sceneImage?.previewUrl || subsection.sceneImage?.dataUrl}
        sectionId={`manual-fillblank-preview-${subsection.id}`}
        getAnswer={(_, id) => answers[id]}
        setAnswer={(_, id, value) => {
          setAnswers((prev) => ({
            ...prev,
            [id]: value,
          }));
        }}
      />

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

function PassageFillBlankSubsectionPreview({ subsection }: { subsection: ManualSubsection }) {
  const [answers, setAnswers] = useState<Record<number, string>>({});

  const wordBank = subsection.wordBank ?? [];
  const passageText = subsection.passageText ?? "";
  const blankCount = countPassageBlanks(passageText);
  const questions = useMemo(
    () => subsection.questions.filter(isManualPassageFillBlankQuestion),
    [subsection.questions],
  );

  const previewQuestions = useMemo<FillBlankQuestion[]>(
    () =>
      Array.from({ length: blankCount }, (_, i) => ({
        id: i + 1,
        type: "fill-blank" as const,
        question: "",
        correctAnswer: questions[i]
          ? getCorrectWord(wordBank, questions[i].correctAnswerWordBankId)
          : "",
      })),
    [blankCount, questions, wordBank],
  );

  const answerKey = useMemo(
    () =>
      Array.from({ length: blankCount }, (_, i) => ({
        id: i + 1,
        answer: questions[i]
          ? getCorrectWord(wordBank, questions[i].correctAnswerWordBankId) || "Not set"
          : "Not set",
      })),
    [blankCount, questions, wordBank],
  );

  if (!passageText.trim()) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-500">
        Enter the passage text with ___ blanks to preview this question block.
      </div>
    );
  }

  if (blankCount === 0) {
    return (
      <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 px-4 py-6 text-sm text-amber-700">
        The passage does not contain any ___ blanks. Add ___ where you want blanks to appear.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DragDropFillBlank
        questions={previewQuestions}
        wordBank={wordBank.map((item) => ({ letter: item.letter, word: item.word || "Untitled word" }))}
        grammarPassage={buildPassageFillBlankPreviewPassage(passageText)}
        sceneImageUrl={subsection.sceneImage?.previewUrl || subsection.sceneImage?.dataUrl}
        sectionId={`manual-passage-fillblank-preview-${subsection.id}`}
        getAnswer={(_, id) => answers[id]}
        setAnswer={(_, id, value) => {
          setAnswers((prev) => ({
            ...prev,
            [id]: value,
          }));
        }}
      />

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

export default function PaperIntake() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const uploadFileMutation = trpc.papers.uploadFile.useMutation();
  const saveManualPaperMutation = trpc.papers.saveManualPaper.useMutation();
  const [paperSeed] = useState(() => createLocalId());
  const [createdAt] = useState(() => new Date().toISOString());
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sections, setSections] = useState<ManualSection[]>([createSection()]);
  const [isSaved, setIsSaved] = useState(false);

  const blueprint = useMemo(
    () => buildBlueprint(paperSeed, createdAt, title, description, sections),
    [createdAt, description, paperSeed, sections, title],
  );

  const getDurableAssetUrl = (value?: string) => {
    if (!value) return undefined;
    if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("/")) {
      return value;
    }
    return undefined;
  };

  /** Persist durable asset URLs when available, otherwise keep embedded data for reliability. */
  const prepareBlueprintForSave = (bp: ManualPaperBlueprint): ManualPaperBlueprint => {
    const stripImage = (img?: ManualOptionImage): ManualOptionImage | undefined => {
      if (!img) return undefined;
      const durableUrl = getDurableAssetUrl(img.previewUrl) ?? getDurableAssetUrl(img.dataUrl);
      return {
        ...img,
        dataUrl: durableUrl ?? img.dataUrl,
        previewUrl: durableUrl,
      };
    };
    const stripAudio = (audio?: ManualAudioFile): ManualAudioFile | undefined => {
      if (!audio) return undefined;
      const durableUrl = getDurableAssetUrl(audio.previewUrl) ?? getDurableAssetUrl(audio.dataUrl);
      return {
        ...audio,
        dataUrl: durableUrl ?? audio.dataUrl,
        previewUrl: durableUrl,
      };
    };
    return {
      ...bp,
      sections: bp.sections.map((section) => ({
        ...section,
        subsections: section.subsections.map((sub) => ({
          ...sub,
          sceneImage: stripImage(sub.sceneImage),
          audio: stripAudio(sub.audio),
          questions: sub.questions.map((q) => {
            if (q.type === "mcq") {
              return { ...q, options: q.options.map((opt) => ({ ...opt, image: stripImage(opt.image) })) };
            }
            if (q.type === "writing" && (q as ManualWritingQuestion).image) {
              return { ...q, image: stripImage((q as ManualWritingQuestion).image) };
            }
            return q;
          }),
        })),
      })),
    };
  };

  const updateSection = (sectionId: string, updater: (section: ManualSection) => ManualSection) => {
    setSections((prev) => prev.map((section) => (section.id === sectionId ? updater(section) : section)));
  };

  const updateSubsection = (
    sectionId: string,
    subsectionId: string,
    updater: (subsection: ManualSubsection) => ManualSubsection,
  ) => {
    updateSection(sectionId, (section) => ({
      ...section,
      subsections: section.subsections.map((subsection) => (
        subsection.id === subsectionId ? updater(subsection) : subsection
      )),
    }));
  };

  const updateQuestion = (
    sectionId: string,
    subsectionId: string,
    questionId: string,
    updater: (question: ManualQuestion) => ManualQuestion,
  ) => {
    updateSubsection(sectionId, subsectionId, (subsection) => ({
      ...subsection,
      questions: subsection.questions.map((question) => (
        question.id === questionId ? updater(question) : question
      )),
    }));
  };

  const updateMCQQuestion = (
    sectionId: string,
    subsectionId: string,
    questionId: string,
    updater: (question: ManualMCQQuestion) => ManualMCQQuestion,
  ) => {
    updateQuestion(sectionId, subsectionId, questionId, (question) => (
      isManualMCQQuestion(question) ? updater(question) : question
    ));
  };

  const updateFillBlankQuestion = (
    sectionId: string,
    subsectionId: string,
    questionId: string,
    updater: (question: ManualFillBlankQuestion) => ManualFillBlankQuestion,
  ) => {
    updateQuestion(sectionId, subsectionId, questionId, (question) => (
      isManualFillBlankQuestion(question) ? updater(question) : question
    ));
  };

  const updatePassageFillBlankQuestion = (
    sectionId: string,
    subsectionId: string,
    questionId: string,
    updater: (question: ManualPassageFillBlankQuestion) => ManualPassageFillBlankQuestion,
  ) => {
    updateQuestion(sectionId, subsectionId, questionId, (question) => (
      isManualPassageFillBlankQuestion(question) ? updater(question) : question
    ));
  };

  const updatePassageMCQQuestion = (
    sectionId: string,
    subsectionId: string,
    questionId: string,
    updater: (question: ManualPassageMCQQuestion) => ManualPassageMCQQuestion,
  ) => {
    updateQuestion(sectionId, subsectionId, questionId, (question) => (
      isManualPassageMCQQuestion(question) ? updater(question) : question
    ));
  };

  const updateTypedFillBlankQuestion = (
    sectionId: string,
    subsectionId: string,
    questionId: string,
    updater: (question: ManualTypedFillBlankQuestion) => ManualTypedFillBlankQuestion,
  ) => {
    updateQuestion(sectionId, subsectionId, questionId, (question) => (
      isManualTypedFillBlankQuestion(question) ? updater(question) : question
    ));
  };

  const updatePassageOpenEndedQuestion = (
    sectionId: string,
    subsectionId: string,
    questionId: string,
    updater: (question: ManualPassageOpenEndedQuestion) => ManualPassageOpenEndedQuestion,
  ) => {
    updateQuestion(sectionId, subsectionId, questionId, (question) => (
      isManualPassageOpenEndedQuestion(question) ? updater(question) : question
    ));
  };

  const updateWritingQuestion = (
    sectionId: string,
    subsectionId: string,
    questionId: string,
    updater: (question: ManualWritingQuestion) => ManualWritingQuestion,
  ) => {
    updateQuestion(sectionId, subsectionId, questionId, (question) => (
      isManualWritingQuestion(question) ? updater(question) : question
    ));
  };

  const updatePassageMatchingQuestion = (
    sectionId: string,
    subsectionId: string,
    questionId: string,
    updater: (question: ManualPassageMatchingQuestion) => ManualPassageMatchingQuestion,
  ) => {
    updateQuestion(sectionId, subsectionId, questionId, (question) => (
      isManualPassageMatchingQuestion(question) ? updater(question) : question
    ));
  };

  const addMatchingDescription = (sectionId: string, subsectionId: string) => {
    updateSubsection(sectionId, subsectionId, (subsection) => {
      const descriptions = subsection.matchingDescriptions ?? [];
      return {
        ...subsection,
        matchingDescriptions: [
          ...descriptions,
          createMatchingDescription(descriptions.length),
        ],
      };
    });
  };

  const removeMatchingDescription = (sectionId: string, subsectionId: string, descriptionId: string) => {
    updateSubsection(sectionId, subsectionId, (subsection) => {
      const descriptions = subsection.matchingDescriptions ?? [];
      if (descriptions.length <= 2) return subsection;
      const nextDescriptions = descriptions
        .filter((d) => d.id !== descriptionId)
        .map((d, i) => ({ ...d, label: getOptionLabel(i) }));
      // Update any question correctAnswers that referenced the removed label
      const removedLabel = descriptions.find((d) => d.id === descriptionId)?.label || "";
      return {
        ...subsection,
        matchingDescriptions: nextDescriptions,
        questions: subsection.questions.map((q) => {
          if (!isManualPassageMatchingQuestion(q)) return q;
          if (q.correctAnswer === removedLabel) {
            return { ...q, correctAnswer: nextDescriptions[0]?.label || "A" };
          }
          return q;
        }),
      };
    });
  };

  const updateMatchingDescription = (
    sectionId: string,
    subsectionId: string,
    descriptionId: string,
    updater: (desc: ManualMatchingDescription) => ManualMatchingDescription,
  ) => {
    updateSubsection(sectionId, subsectionId, (subsection) => ({
      ...subsection,
      matchingDescriptions: (subsection.matchingDescriptions ?? []).map((d) =>
        d.id === descriptionId ? updater(d) : d,
      ),
    }));
  };

  const handleWritingImageUpload = async (
    sectionId: string,
    subsectionId: string,
    questionId: string,
    file: File | undefined,
  ) => {
    if (!file) return;

    const validationError = validateImageFile(file);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    try {
      const compressedFile = await compressImage(file, "scene");
      const fileBase64 = await fileToBase64(compressedFile);
      const dataUrl = `data:${compressedFile.type};base64,${fileBase64}`;
      let previewUrl = URL.createObjectURL(compressedFile);

      try {
        const uploaded = await uploadFileMutation.mutateAsync({
          fileName: `writing-${compressedFile.name.replace(/\s+/g, "-").toLowerCase()}`,
          contentType: compressedFile.type,
          fileBase64,
        });
        previewUrl = uploaded.url;
      } catch {
        // Fall back to the in-browser preview URL when upload is unavailable.
      }

      updateWritingQuestion(sectionId, subsectionId, questionId, (question) => ({
        ...question,
        image: {
          dataUrl,
          previewUrl,
          fileName: compressedFile.name,
          mimeType: compressedFile.type,
          size: compressedFile.size,
        },
      }));

      toast.success("Writing prompt image updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to process image");
    }
  };

  const addSection = () => {
    setSections((prev) => [...prev, createSection()]);
  };

  const removeSection = (sectionId: string) => {
    setSections((prev) => (prev.length > 1 ? prev.filter((section) => section.id !== sectionId) : prev));
  };

  const addSubsection = (sectionId: string) => {
    updateSection(sectionId, (section) => ({
      ...section,
      subsections: [...section.subsections, createSubsection()],
    }));
  };

  const removeSubsection = (sectionId: string, subsectionId: string) => {
    updateSection(sectionId, (section) => ({
      ...section,
      subsections:
        section.subsections.length > 1
          ? section.subsections.filter((subsection) => subsection.id !== subsectionId)
          : section.subsections,
    }));
  };

  const changeSubsectionQuestionType = (
    sectionId: string,
    subsectionId: string,
    nextQuestionType: ManualQuestionType,
  ) => {
    updateSubsection(sectionId, subsectionId, (subsection) => {
      if (subsection.questionType === nextQuestionType) {
        return subsection;
      }

      const nextSubsection = createSubsection(nextQuestionType);

      return {
        ...subsection,
        questionType: nextQuestionType,
        wordBank: nextSubsection.wordBank,
        questions: nextSubsection.questions,
        passageText: nextSubsection.passageText,
        matchingDescriptions: nextSubsection.matchingDescriptions,
      };
    });
  };

  const addQuestion = (sectionId: string, subsectionId: string) => {
    updateSubsection(sectionId, subsectionId, (subsection) => {
      if (subsection.questionType === "fill-blank") {
        return {
          ...subsection,
          questions: [
            ...subsection.questions.filter(isManualFillBlankQuestion),
            createFillBlankQuestion(subsection.wordBank?.[0]?.id || ""),
          ],
        };
      }

      if (subsection.questionType === "passage-fill-blank") {
        return {
          ...subsection,
          questions: [
            ...subsection.questions.filter(isManualPassageFillBlankQuestion),
            createPassageFillBlankQuestion(subsection.wordBank?.[0]?.id || ""),
          ],
        };
      }

      if (subsection.questionType === "typed-fill-blank") {
        return {
          ...subsection,
          questions: [
            ...subsection.questions.filter(isManualTypedFillBlankQuestion),
            createTypedFillBlankQuestion(),
          ],
        };
      }

      if (subsection.questionType === "passage-open-ended") {
        return {
          ...subsection,
          questions: [
            ...subsection.questions.filter(isManualPassageOpenEndedQuestion),
            createPassageOpenEndedQuestion(),
          ],
        };
      }

      // Writing type: typically only 1 question per subsection, but allow adding more
      if (subsection.questionType === "writing") {
        return {
          ...subsection,
          questions: [
            ...subsection.questions.filter(isManualWritingQuestion),
            createWritingQuestion(),
          ],
        };
      }

      if (subsection.questionType === "passage-matching") {
        return {
          ...subsection,
          questions: [
            ...subsection.questions.filter(isManualPassageMatchingQuestion),
            createPassageMatchingQuestion(),
          ],
        };
      }

      return {
        ...subsection,
        questions: [...subsection.questions.filter(isManualMCQQuestion), createMCQQuestion()],
      };
    });
  };

  const removeQuestion = (sectionId: string, subsectionId: string, questionId: string) => {
    updateSubsection(sectionId, subsectionId, (subsection) => ({
      ...subsection,
      questions:
        subsection.questions.length > 1
          ? subsection.questions.filter((question) => question.id !== questionId)
          : subsection.questions,
    }));
  };

  const addOption = (sectionId: string, subsectionId: string, questionId: string) => {
    updateMCQQuestion(sectionId, subsectionId, questionId, (question) => ({
      ...question,
      options: [...question.options, createOption(question.options.length)],
    }));
  };

  const removeOption = (sectionId: string, subsectionId: string, questionId: string, optionId: string) => {
    updateMCQQuestion(sectionId, subsectionId, questionId, (question) => {
      if (question.options.length <= 2) {
        return question;
      }

      const nextOptions = relabelOptions(question.options.filter((option) => option.id !== optionId));
      const hasCorrectAnswer = nextOptions.some((option) => option.label === question.correctAnswer);

      return {
        ...question,
        options: nextOptions,
        correctAnswer: hasCorrectAnswer ? question.correctAnswer : nextOptions[0]?.label || "A",
      };
    });
  };

  const updateOption = (
    sectionId: string,
    subsectionId: string,
    questionId: string,
    optionId: string,
    updater: (option: ManualMCQOption) => ManualMCQOption,
  ) => {
    updateMCQQuestion(sectionId, subsectionId, questionId, (question) => ({
      ...question,
      options: question.options.map((option) => (
        option.id === optionId ? updater(option) : option
      )),
    }));
  };

  const addWordBankItem = (sectionId: string, subsectionId: string) => {
    updateSubsection(sectionId, subsectionId, (subsection) => {
      if (!isWordBankSubsectionType(subsection.questionType)) {
        return subsection;
      }

      const nextWordBank = relabelWordBank([
        ...(subsection.wordBank ?? []),
        createWordBankItem((subsection.wordBank ?? []).length),
      ]);

      return {
        ...subsection,
        wordBank: nextWordBank,
        questions: subsection.questions.map((question) => {
          if (!isAnyFillBlankQuestion(question) || question.correctAnswerWordBankId) {
            return question;
          }

          return {
            ...question,
            correctAnswerWordBankId: nextWordBank[0]?.id || "",
          };
        }),
      };
    });
  };

  const removeWordBankItem = (sectionId: string, subsectionId: string, wordBankId: string) => {
    updateSubsection(sectionId, subsectionId, (subsection) => {
      if (!isWordBankSubsectionType(subsection.questionType)) {
        return subsection;
      }

      const currentWordBank = subsection.wordBank ?? [];
      if (currentWordBank.length <= 1) {
        return subsection;
      }

      const nextWordBank = relabelWordBank(currentWordBank.filter((item) => item.id !== wordBankId));
      const fallbackWordBankId = nextWordBank[0]?.id || "";

      return {
        ...subsection,
        wordBank: nextWordBank,
        questions: subsection.questions.map((question) => {
          if (!isAnyFillBlankQuestion(question)) {
            return question;
          }

          return {
            ...question,
            correctAnswerWordBankId:
              question.correctAnswerWordBankId === wordBankId
                ? fallbackWordBankId
                : question.correctAnswerWordBankId,
          };
        }),
      };
    });
  };

  const updateWordBankItem = (
    sectionId: string,
    subsectionId: string,
    wordBankId: string,
    updater: (item: ManualWordBankItem) => ManualWordBankItem,
  ) => {
    updateSubsection(sectionId, subsectionId, (subsection) => {
      if (!isWordBankSubsectionType(subsection.questionType)) {
        return subsection;
      }

      return {
        ...subsection,
        wordBank: (subsection.wordBank ?? []).map((item) => (item.id === wordBankId ? updater(item) : item)),
      };
    });
  };

  /**
   * For passage-fill-blank: auto-sync the questions array to match the number of ___ in the passage.
   */
  const syncPassageBlanksToQuestions = (sectionId: string, subsectionId: string, newPassageText: string) => {
    updateSubsection(sectionId, subsectionId, (subsection) => {
      const blankCount = countPassageBlanks(newPassageText);
      const existingQuestions = subsection.questions.filter(isManualPassageFillBlankQuestion);
      const fallbackWordBankId = subsection.wordBank?.[0]?.id || "";

      let nextQuestions: ManualPassageFillBlankQuestion[];
      if (existingQuestions.length < blankCount) {
        // Add more questions
        nextQuestions = [
          ...existingQuestions,
          ...Array.from({ length: blankCount - existingQuestions.length }, () =>
            createPassageFillBlankQuestion(fallbackWordBankId),
          ),
        ];
      } else {
        // Trim excess questions
        nextQuestions = existingQuestions.slice(0, blankCount);
      }

      return {
        ...subsection,
        passageText: newPassageText,
        questions: nextQuestions,
      };
    });
  };

  /**
   * For passage-mcq: auto-sync the questions array to match the number of ___ in the passage.
   * Each blank gets its own set of MCQ options (A/B/C/D).
   */
  const syncPassageMCQBlanksToQuestions = (sectionId: string, subsectionId: string, newPassageText: string) => {
    updateSubsection(sectionId, subsectionId, (subsection) => {
      const blankCount = countPassageBlanks(newPassageText);
      const existingQuestions = subsection.questions.filter(isManualPassageMCQQuestion);

      let nextQuestions: ManualPassageMCQQuestion[];
      if (existingQuestions.length < blankCount) {
        nextQuestions = [
          ...existingQuestions,
          ...Array.from({ length: blankCount - existingQuestions.length }, (_, i) =>
            createPassageMCQQuestion(existingQuestions.length + i + 1),
          ),
        ];
      } else {
        nextQuestions = existingQuestions.slice(0, blankCount);
      }

      return {
        ...subsection,
        passageText: newPassageText,
        questions: nextQuestions,
      };
    });
  };

  const addPassageMCQOption = (sectionId: string, subsectionId: string, questionId: string) => {
    updatePassageMCQQuestion(sectionId, subsectionId, questionId, (question) => ({
      ...question,
      options: [...question.options, createPassageMCQOption(question.options.length)],
    }));
  };

  const removePassageMCQOption = (sectionId: string, subsectionId: string, questionId: string, optionId: string) => {
    updatePassageMCQQuestion(sectionId, subsectionId, questionId, (question) => {
      if (question.options.length <= 2) return question;
      const nextOptions = question.options.filter((o) => o.id !== optionId).map((o, i) => ({ ...o, label: getOptionLabel(i) }));
      const hasCorrect = nextOptions.some((o) => o.label === question.correctAnswer);
      return {
        ...question,
        options: nextOptions,
        correctAnswer: hasCorrect ? question.correctAnswer : nextOptions[0]?.label || "A",
      };
    });
  };

  const handleOptionImageUpload = async (
    sectionId: string,
    subsectionId: string,
    questionId: string,
    optionId: string,
    file: File | undefined,
  ) => {
    if (!file) return;

    const validationError = validateImageFile(file);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    try {
      const normalizedImage = await createSquareImageDataUrl(file, 320);
      let previewUrl = normalizedImage.previewUrl;

      try {
        const uploaded = await uploadFileMutation.mutateAsync({
          fileName: `option-${file.name.replace(/\s+/g, "-").toLowerCase()}`,
          contentType: normalizedImage.mimeType,
          fileBase64: normalizedImage.dataUrl.split(",")[1] ?? "",
        });
        previewUrl = uploaded.url;
      } catch {
        // Fall back to the in-browser preview URL when upload is unavailable.
      }

      updateOption(sectionId, subsectionId, questionId, optionId, (option) => ({
        ...option,
        image: {
          dataUrl: normalizedImage.dataUrl,
          previewUrl,
          fileName: file.name,
          mimeType: normalizedImage.mimeType,
          size: normalizedImage.size,
        },
      }));
      toast.success("Square option image updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to process image");
    }
  };

  const handleSubsectionImageUpload = async (
    sectionId: string,
    subsectionId: string,
    file: File | undefined,
  ) => {
    if (!file) return;

    const validationError = validateImageFile(file);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    try {
      const compressedFile = await compressImage(file, "scene");
      const fileBase64 = await fileToBase64(compressedFile);
      const dataUrl = `data:${compressedFile.type};base64,${fileBase64}`;
      let previewUrl = URL.createObjectURL(compressedFile);

      try {
        const uploaded = await uploadFileMutation.mutateAsync({
          fileName: `scene-${compressedFile.name.replace(/\s+/g, "-").toLowerCase()}`,
          contentType: compressedFile.type,
          fileBase64,
        });
        previewUrl = uploaded.url;
      } catch {
        // Fall back to the in-browser preview URL when upload is unavailable.
      }

      updateSubsection(sectionId, subsectionId, (subsection) => ({
        ...subsection,
        sceneImage: {
          dataUrl,
          previewUrl,
          fileName: compressedFile.name,
          mimeType: compressedFile.type,
          size: compressedFile.size,
        },
      }));

      toast.success("Question block image updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to process image");
    }
  };

  const handleSubsectionAudioUpload = async (
    sectionId: string,
    subsectionId: string,
    file: File | undefined,
  ) => {
    if (!file) return;

    const validationError = validateAudioFile(file);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    try {
      const fileBase64 = await fileToBase64(file);
      const dataUrl = `data:${file.type};base64,${fileBase64}`;
      let previewUrl = URL.createObjectURL(file);

      try {
        const uploaded = await uploadFileMutation.mutateAsync({
          fileName: `audio-${file.name.replace(/\s+/g, "-").toLowerCase()}`,
          contentType: file.type,
          fileBase64,
        });
        previewUrl = uploaded.url;
      } catch {
        // Fall back to the in-browser preview URL when upload is unavailable.
      }

      updateSubsection(sectionId, subsectionId, (subsection) => ({
        ...subsection,
        audio: {
          dataUrl,
          previewUrl,
          fileName: file.name,
          mimeType: file.type,
          size: file.size,
        },
      }));

      toast.success("Audio file uploaded.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to process audio file");
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F8FB]">
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm text-slate-500 transition-colors hover:text-slate-700"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Assessments
            </Link>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#1E3A5F]">Manual Paper Builder</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-500">
              Build a paper manually by section, big question, and question type. Multiple-choice, word-bank
              fill-blank, and passage word-bank blocks all preview in a student-facing layout on the right.
            </p>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.95fr)]">
          <div className="space-y-6">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle>Paper Info</CardTitle>
                <CardDescription>Start by naming the paper and writing a short description.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="paper-title">Paper Name</Label>
                  <Input
                    id="paper-title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="e.g. PET English Assessment"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="paper-description">Description</Label>
                  <Textarea
                    id="paper-description"
                    rows={4}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Describe what this paper is for."
                  />
                </div>
              </CardContent>
            </Card>

            {sections.map((section, sectionIndex) => (
              <Card key={section.id} className="border-slate-200 shadow-sm">
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle>{`Part ${sectionIndex + 1}`}</CardTitle>
                      <CardDescription>
                        Choose the section type, then add one or more big questions below.
                      </CardDescription>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeSection(section.id)}
                      className="text-slate-500 hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="space-y-2">
                    <Label>{`Part ${sectionIndex + 1} Type`}</Label>
                    <select
                      value={section.sectionType}
                      onChange={(event) =>
                        updateSection(section.id, (currentSection) => ({
                          ...currentSection,
                          sectionType: event.target.value as ManualSectionType,
                        }))
                      }
                      className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                    >
                      {Object.entries(MANUAL_SECTION_TYPE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-4">
                    {section.subsections.map((subsection, subsectionIndex) => (
                      <div key={subsection.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{`Main Question ${subsectionIndex + 1}`}</p>
                            <p className="text-xs text-slate-500">
                              Add the title, instructions, and the questions in this block.
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeSubsection(section.id, subsection.id)}
                            className="text-slate-500 hover:text-red-500"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="space-y-4">
                          <div className="grid gap-4 lg:grid-cols-2">
                            <div className="space-y-2">
                              <Label>Main Question Title</Label>
                              <Input
                                value={subsection.title}
                                onChange={(event) =>
                                  updateSubsection(section.id, subsection.id, (currentSubsection) => ({
                                    ...currentSubsection,
                                    title: event.target.value,
                                  }))
                                }
                                placeholder="e.g. Choose the correct word to fill each blank"
                              />
                            </div>

                            <div className="space-y-2">
                              <Label>Question Type</Label>
                              <select
                                value={subsection.questionType}
                                onChange={(event) =>
                                  changeSubsectionQuestionType(
                                    section.id,
                                    subsection.id,
                                    event.target.value as ManualQuestionType,
                                  )
                                }
                                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                              >
                                {MANUAL_QUESTION_TYPE_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                              <p className="text-xs text-slate-500">
                                {MANUAL_QUESTION_TYPE_OPTIONS.find((o) => o.value === subsection.questionType)?.description}
                              </p>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label>Instructions</Label>
                            <Textarea
                              rows={3}
                              value={subsection.instructions}
                              onChange={(event) =>
                                updateSubsection(section.id, subsection.id, (currentSubsection) => ({
                                  ...currentSubsection,
                                  instructions: event.target.value,
                                }))
                              }
                              placeholder="Write the instructions for this big question."
                            />
                          </div>

                          <div className="rounded-2xl border border-slate-200 bg-white p-4">
                            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                              <div className="space-y-2">
                                <Label>Question Block Image</Label>
                                <p className="text-xs text-slate-500">
                                  Optional. This image will appear above all questions in this big question block.
                                </p>
                                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-[#1E3A5F]/30 bg-white px-3 py-2 text-sm font-medium text-[#1E3A5F] transition-colors hover:border-[#D4A84B] hover:text-[#A97C21]">
                                  <ImagePlus className="h-4 w-4" />
                                  {subsection.sceneImage ? "Replace Image" : "Add Image"}
                                  <input
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp,image/gif"
                                    className="hidden"
                                    onChange={(event) =>
                                      handleSubsectionImageUpload(
                                        section.id,
                                        subsection.id,
                                        event.target.files?.[0],
                                      )
                                    }
                                  />
                                </label>
                                {subsection.sceneImage && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    className="h-auto px-0 text-sm text-slate-500 hover:text-red-500"
                                    onClick={() =>
                                      updateSubsection(section.id, subsection.id, (currentSubsection) => ({
                                        ...currentSubsection,
                                        sceneImage: undefined,
                                      }))
                                    }
                                  >
                                    Remove Image
                                  </Button>
                                )}
                              </div>

                              <div className="space-y-2">
                                <Label>Preview</Label>
                                <div className="flex min-h-[132px] items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100 p-2">
                                  {subsection.sceneImage ? (
                                    <img
                                      src={subsection.sceneImage.previewUrl || subsection.sceneImage.dataUrl}
                                      alt="Question block preview"
                                      className="max-h-32 w-full object-contain"
                                    />
                                  ) : (
                                    <span className="px-4 text-center text-xs text-slate-400">
                                      No image uploaded
                                    </span>
                                  )}
                                </div>
                                {subsection.sceneImage && (
                                  <p className="text-xs text-slate-500">
                                    {subsection.sceneImage.fileName} · {formatFileSize(subsection.sceneImage.size)}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Audio upload — shown only when section type is listening */}
                          {section.sectionType === "listening" && (
                            <div className="rounded-2xl border border-sky-200 bg-sky-50/60 p-4">
                              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <Volume2 className="h-4 w-4 text-sky-700" />
                                    <Label className="text-sm font-semibold text-sky-800">Listening Audio</Label>
                                  </div>
                                  <p className="text-xs text-sky-700/80">
                                    Upload an audio clip for this big question. Students will listen to it before answering.
                                  </p>
                                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-sky-400/50 bg-white px-3 py-2 text-sm font-medium text-sky-700 transition-colors hover:border-sky-500 hover:text-sky-800">
                                    <Music className="h-4 w-4" />
                                    {subsection.audio ? "Replace Audio" : "Upload Audio"}
                                    <input
                                      type="file"
                                      accept="audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/webm,audio/mp4,audio/m4a,audio/x-m4a,audio/aac"
                                      className="hidden"
                                      onChange={(event) =>
                                        handleSubsectionAudioUpload(
                                          section.id,
                                          subsection.id,
                                          event.target.files?.[0],
                                        )
                                      }
                                    />
                                  </label>
                                  {subsection.audio && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      className="h-auto px-0 text-sm text-slate-500 hover:text-red-500"
                                      onClick={() =>
                                        updateSubsection(section.id, subsection.id, (currentSubsection) => ({
                                          ...currentSubsection,
                                          audio: undefined,
                                        }))
                                      }
                                    >
                                      Remove Audio
                                    </Button>
                                  )}
                                </div>

                                <div className="space-y-2">
                                  <Label>Preview</Label>
                                  {subsection.audio ? (
                                    <div className="space-y-2">
                                      <audio
                                        controls
                                        className="w-full"
                                        src={subsection.audio.previewUrl || subsection.audio.dataUrl}
                                      />
                                      <p className="text-xs text-slate-500">
                                        {subsection.audio.fileName} · {formatFileSize(subsection.audio.size)}
                                      </p>
                                    </div>
                                  ) : (
                                    <div className="flex min-h-[60px] items-center justify-center rounded-xl border border-dashed border-sky-300 bg-white p-3">
                                      <span className="text-xs text-slate-400">No audio uploaded</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Word Bank editor — shared by fill-blank and passage-fill-blank */}
                          {isWordBankSubsectionType(subsection.questionType) && (
                            <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
                              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-amber-800">Word Bank</p>
                                  <p className="text-xs text-amber-700/80">
                                    Letters are assigned automatically and shown in preview just like the live paper.
                                  </p>
                                </div>
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => addWordBankItem(section.id, subsection.id)}
                                  className="border-amber-300 bg-white text-amber-800 hover:bg-amber-100"
                                >
                                  <Plus className="mr-2 h-4 w-4" />
                                  Add Word
                                </Button>
                              </div>

                              <div className="grid gap-3 md:grid-cols-2">
                                {(subsection.wordBank ?? []).map((item) => (
                                  <div key={item.id} className="rounded-xl border border-amber-200 bg-white p-4">
                                    <div className="mb-3 flex items-center justify-between gap-3">
                                      <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-amber-100 px-2 text-sm font-semibold text-amber-800">
                                        {item.letter}
                                      </span>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeWordBankItem(section.id, subsection.id, item.id)}
                                        className="text-slate-500 hover:text-red-500"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                    <div className="space-y-2">
                                      <Label>{`Word ${item.letter}`}</Label>
                                      <Input
                                        value={item.word}
                                        onChange={(event) =>
                                          updateWordBankItem(section.id, subsection.id, item.id, (currentItem) => ({
                                            ...currentItem,
                                            word: event.target.value,
                                          }))
                                        }
                                        placeholder="Type the word or phrase in the bank"
                                      />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Matching descriptions editor — for passage-matching */}
                          {subsection.questionType === "passage-matching" && (
                            <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
                              <div className="mb-3">
                                <p className="text-sm font-semibold text-amber-800">Descriptions</p>
                                <p className="text-xs text-amber-700/80">
                                  Add labeled descriptions (A, B, C...) that students will match to the questions below. Each description has a name/title and a detailed text.
                                </p>
                              </div>

                              <div className="space-y-3">
                                {(subsection.matchingDescriptions ?? []).map((desc) => (
                                  <div key={desc.id} className="rounded-xl border border-amber-100 bg-white p-3 shadow-sm">
                                    <div className="flex items-start gap-3">
                                      <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-amber-800">
                                        {desc.label}
                                      </span>
                                      <div className="flex-1 space-y-2">
                                        <Input
                                          value={desc.name}
                                          onChange={(event) =>
                                            updateMatchingDescription(section.id, subsection.id, desc.id, (d) => ({
                                              ...d,
                                              name: event.target.value,
                                            }))
                                          }
                                          placeholder={`Name / Title (e.g. "Marina")`}
                                          className="h-8 text-sm font-medium"
                                        />
                                        <Textarea
                                          rows={2}
                                          value={desc.text}
                                          onChange={(event) =>
                                            updateMatchingDescription(section.id, subsection.id, desc.id, (d) => ({
                                              ...d,
                                              text: event.target.value,
                                            }))
                                          }
                                          placeholder="Description text — what makes this option unique..."
                                          className="text-sm"
                                        />
                                      </div>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeMatchingDescription(section.id, subsection.id, desc.id)}
                                        className="mt-1 h-7 w-7 shrink-0 text-slate-400 hover:text-red-500"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>

                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => addMatchingDescription(section.id, subsection.id)}
                                className="mt-3 text-xs"
                              >
                                <Plus className="mr-1 h-3 w-3" />
                                Add Description
                              </Button>
                            </div>
                          )}

                          {/* Passage text editor — for passage-open-ended */}
                          {subsection.questionType === "passage-open-ended" && (
                            <div className="rounded-2xl border border-teal-200 bg-teal-50/60 p-4">
                              <div className="mb-3">
                                <p className="text-sm font-semibold text-teal-800">Passage Text</p>
                                <p className="text-xs text-teal-700/80">
                                  Type or paste the full passage/article that students will read before answering the questions below.
                                </p>
                              </div>
                              <Textarea
                                rows={10}
                                value={subsection.passageText ?? ""}
                                onChange={(event) =>
                                  updateSubsection(section.id, subsection.id, (sub) => ({
                                    ...sub,
                                    passageText: event.target.value,
                                  }))
                                }
                                placeholder={`Example:\n\nOnce upon a time, there was a little girl who loved to read. Every day after school, she would go to the library and spend hours reading books about faraway lands and magical creatures...`}
                                className="font-mono text-sm"
                              />
                            </div>
                          )}

                          {/* Passage text editor — for passage-fill-blank and passage-mcq */}
                          {subsection.questionType === "passage-mcq" && (
                            <div className="rounded-2xl border border-violet-200 bg-violet-50/60 p-4">
                              <div className="mb-3">
                                <p className="text-sm font-semibold text-violet-800">Passage Text</p>
                                <p className="text-xs text-violet-700/80">
                                  Type or paste the full passage. Use <code className="rounded bg-violet-100 px-1 py-0.5 text-violet-900">___</code> (three underscores) to mark each blank. Each blank will have its own MCQ options.
                                </p>
                              </div>
                              <Textarea
                                rows={8}
                                value={subsection.passageText ?? ""}
                                onChange={(event) =>
                                  syncPassageMCQBlanksToQuestions(section.id, subsection.id, event.target.value)
                                }
                                placeholder={`Example:\n\nLast summer, I ___ to the beach with my family. We ___ a wonderful time. The weather was ___ and sunny.`}
                                className="font-mono text-sm"
                              />
                              <p className="mt-2 text-xs text-violet-700">
                                {countPassageBlanks(subsection.passageText ?? "")} blank(s) detected
                              </p>
                            </div>
                          )}

                          {subsection.questionType === "passage-fill-blank" && (
                            <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4">
                              <div className="mb-3">
                                <p className="text-sm font-semibold text-blue-800">Passage Text</p>
                                <p className="text-xs text-blue-700/80">
                                  Type or paste the full passage. Use <code className="rounded bg-blue-100 px-1 py-0.5 text-blue-900">___</code> (three underscores) to mark each blank. Blanks are numbered automatically.
                                </p>
                              </div>
                              <Textarea
                                rows={8}
                                value={subsection.passageText ?? ""}
                                onChange={(event) =>
                                  syncPassageBlanksToQuestions(section.id, subsection.id, event.target.value)
                                }
                                placeholder={`Example:\n\nThe boy ___ to school every day. He ___ his lunch in a bag. His mother always ___ him goodbye at the door.`}
                                className="font-mono text-sm"
                              />
                              <p className="mt-2 text-xs text-blue-700">
                                {countPassageBlanks(subsection.passageText ?? "")} blank(s) detected
                              </p>
                            </div>
                          )}

                          {/* Questions editor */}
                          <div className="space-y-4">
                            {/* MCQ questions */}
                            {subsection.questionType === "mcq" &&
                              subsection.questions.filter(isManualMCQQuestion).map((question, questionIndex) => (
                                <div key={question.id} className="rounded-2xl border border-white bg-white p-4 shadow-sm">
                                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                      <p className="text-sm font-semibold text-slate-800">{`Question ${questionIndex + 1}`}</p>
                                      <p className="text-xs text-slate-500">Question type: Multiple Choice</p>
                                    </div>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => removeQuestion(section.id, subsection.id, question.id)}
                                      className="text-slate-500 hover:text-red-500"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>

                                  <div className="space-y-4">
                                    <div className="space-y-2">
                                      <Label>Question Prompt</Label>
                                      <Textarea
                                        rows={3}
                                        value={question.prompt}
                                        onChange={(event) =>
                                          updateMCQQuestion(section.id, subsection.id, question.id, (currentQuestion) => ({
                                            ...currentQuestion,
                                            prompt: event.target.value,
                                          }))
                                        }
                                        placeholder="Type the stem of the multiple-choice question."
                                      />
                                    </div>

                                    <div className="grid gap-3 md:grid-cols-3">
                                      {question.options.map((option) => (
                                        <div key={option.id} className="rounded-xl border border-slate-200 p-4">
                                          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                                            <p className="text-sm font-semibold text-slate-700">{`Option ${option.label}`}</p>
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="icon"
                                              onClick={() =>
                                                removeOption(section.id, subsection.id, question.id, option.id)
                                              }
                                              className="text-slate-500 hover:text-red-500"
                                            >
                                              <Trash2 className="h-4 w-4" />
                                            </Button>
                                          </div>

                                          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_156px]">
                                            <div className="space-y-2">
                                              <Label>{`Option ${option.label} Text`}</Label>
                                              <Input
                                                value={option.text}
                                                onChange={(event) =>
                                                  updateOption(
                                                    section.id,
                                                    subsection.id,
                                                    question.id,
                                                    option.id,
                                                    (currentOption) => ({
                                                      ...currentOption,
                                                      text: event.target.value,
                                                    }),
                                                  )
                                                }
                                                placeholder="Optional text for this option"
                                              />
                                              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-[#1E3A5F]/30 bg-white px-3 py-2 text-sm font-medium text-[#1E3A5F] transition-colors hover:border-[#D4A84B] hover:text-[#A97C21]">
                                                <ImagePlus className="h-4 w-4" />
                                                {option.image ? "Replace Image" : "Add Image"}
                                                <input
                                                  type="file"
                                                  accept="image/png,image/jpeg,image/webp,image/gif"
                                                  className="hidden"
                                                  onChange={(event) =>
                                                    handleOptionImageUpload(
                                                      section.id,
                                                      subsection.id,
                                                      question.id,
                                                      option.id,
                                                      event.target.files?.[0],
                                                    )
                                                  }
                                                />
                                              </label>
                                            </div>

                                            <div className="space-y-2">
                                              <Label>{`Option ${option.label} Preview`}</Label>
                                              <div className="mx-auto flex h-24 w-24 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100 sm:h-28 sm:w-28">
                                                {option.image ? (
                                                  <img
                                                    src={option.image.previewUrl || option.image.dataUrl}
                                                    alt={`Option ${option.label}`}
                                                    className="h-full w-full object-contain"
                                                  />
                                                ) : (
                                                  <span className="px-4 text-center text-xs text-slate-400">
                                                    No image uploaded
                                                  </span>
                                                )}
                                              </div>
                                              {option.image && (
                                                <p className="text-xs text-slate-500">
                                                  {option.image.fileName} · {formatFileSize(option.image.size)}
                                                </p>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>

                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => addOption(section.id, subsection.id, question.id)}
                                      >
                                        <Plus className="mr-2 h-4 w-4" />
                                        Add Option
                                      </Button>

                                      <div className="min-w-[180px] space-y-2">
                                        <Label>Correct Answer</Label>
                                        <select
                                          value={question.correctAnswer}
                                          onChange={(event) =>
                                            updateMCQQuestion(
                                              section.id,
                                              subsection.id,
                                              question.id,
                                              (currentQuestion) => ({
                                                ...currentQuestion,
                                                correctAnswer: event.target.value,
                                              }),
                                            )
                                          }
                                          className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                                        >
                                          {question.options.map((option, optionIndex) => (
                                            <option key={option.id} value={getOptionLabel(optionIndex)}>
                                              {getOptionLabel(optionIndex)}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}

                            {/* Fill-blank questions (sentence mode) */}
                            {subsection.questionType === "fill-blank" &&
                              subsection.questions.filter(isManualFillBlankQuestion).map((question, questionIndex) => (
                                <div key={question.id} className="rounded-2xl border border-white bg-white p-4 shadow-sm">
                                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                      <p className="text-sm font-semibold text-slate-800">{`Blank ${questionIndex + 1}`}</p>
                                      <p className="text-xs text-slate-500">Question type: Word Bank Fill Blank</p>
                                    </div>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => removeQuestion(section.id, subsection.id, question.id)}
                                      className="text-slate-500 hover:text-red-500"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>

                                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                                    <div className="space-y-2">
                                      <Label>Sentence / Prompt</Label>
                                      <Textarea
                                        rows={3}
                                        value={question.prompt}
                                        onChange={(event) =>
                                          updateFillBlankQuestion(
                                            section.id,
                                            subsection.id,
                                            question.id,
                                            (currentQuestion) => ({
                                              ...currentQuestion,
                                              prompt: event.target.value,
                                            }),
                                          )
                                        }
                                        placeholder="Type the sentence and use ___ where the blank should appear."
                                      />
                                      <p className="text-xs text-slate-500">
                                        Example: I usually go to school ___ bus.
                                      </p>
                                    </div>

                                    <div className="space-y-2">
                                      <Label>Correct Answer</Label>
                                      <select
                                        value={question.correctAnswerWordBankId}
                                        onChange={(event) =>
                                          updateFillBlankQuestion(
                                            section.id,
                                            subsection.id,
                                            question.id,
                                            (currentQuestion) => ({
                                              ...currentQuestion,
                                              correctAnswerWordBankId: event.target.value,
                                            }),
                                          )
                                        }
                                        className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                                      >
                                        {(subsection.wordBank ?? []).map((item) => (
                                          <option key={item.id} value={item.id}>
                                            {item.letter}. {item.word || "Untitled word"}
                                          </option>
                                        ))}
                                      </select>
                                      <p className="text-xs text-slate-500">
                                        Pick the word bank item students should drag into this blank.
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              ))}

                            {/* Typed fill-blank questions (direct input) */}
                            {subsection.questionType === "typed-fill-blank" &&
                              subsection.questions.filter(isManualTypedFillBlankQuestion).map((question, questionIndex) => (
                                <div key={question.id} className="rounded-2xl border border-white bg-white p-4 shadow-sm">
                                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                      <p className="text-sm font-semibold text-slate-800">{`Question ${questionIndex + 1}`}</p>
                                      <p className="text-xs text-slate-500">Question type: Fill in Blank</p>
                                    </div>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => removeQuestion(section.id, subsection.id, question.id)}
                                      className="text-slate-500 hover:text-red-500"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>

                                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                                    <div className="space-y-2">
                                      <Label>Sentence / Prompt</Label>
                                      <Textarea
                                        rows={3}
                                        value={question.prompt}
                                        onChange={(event) =>
                                          updateTypedFillBlankQuestion(
                                            section.id,
                                            subsection.id,
                                            question.id,
                                            (currentQuestion) => ({
                                              ...currentQuestion,
                                              prompt: event.target.value,
                                            }),
                                          )
                                        }
                                        placeholder="Type the sentence and use ___ where the blank should appear."
                                      />
                                      <p className="text-xs text-slate-500">
                                        Example: The capital of France is ___.
                                      </p>
                                    </div>

                                    <div className="space-y-2">
                                      <Label>Correct Answer</Label>
                                      <Input
                                        value={question.correctAnswer}
                                        onChange={(event) =>
                                          updateTypedFillBlankQuestion(
                                            section.id,
                                            subsection.id,
                                            question.id,
                                            (currentQuestion) => ({
                                              ...currentQuestion,
                                              correctAnswer: event.target.value,
                                            }),
                                          )
                                        }
                                        placeholder="Type the correct answer"
                                      />
                                      <p className="text-xs text-slate-500">
                                        The answer students should type in the blank.
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              ))}

                            {/* Passage open-ended questions editor */}
                            {subsection.questionType === "passage-open-ended" &&
                              subsection.questions.filter(isManualPassageOpenEndedQuestion).map((question, questionIndex) => (
                                <div key={question.id} className="rounded-2xl border border-teal-100 bg-white p-4 shadow-sm">
                                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                      <p className="text-sm font-semibold text-teal-800">{`Question ${questionIndex + 1}`}</p>
                                      <p className="text-xs text-slate-500">Open-ended question — students type a free-form answer.</p>
                                    </div>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => removeQuestion(section.id, subsection.id, question.id)}
                                      className="text-slate-500 hover:text-red-500"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>

                                  <div className="space-y-4">
                                    <div className="space-y-2">
                                      <Label>Question</Label>
                                      <Textarea
                                        rows={2}
                                        value={question.prompt}
                                        onChange={(event) =>
                                          updatePassageOpenEndedQuestion(
                                            section.id,
                                            subsection.id,
                                            question.id,
                                            (currentQuestion) => ({
                                              ...currentQuestion,
                                              prompt: event.target.value,
                                            }),
                                          )
                                        }
                                        placeholder="e.g. What is the main idea of the passage?"
                                      />
                                    </div>

                                    <div className="space-y-2">
                                      <Label>Reference Answer <span className="text-xs font-normal text-slate-400">(optional, for grading reference)</span></Label>
                                      <Textarea
                                        rows={3}
                                        value={question.referenceAnswer}
                                        onChange={(event) =>
                                          updatePassageOpenEndedQuestion(
                                            section.id,
                                            subsection.id,
                                            question.id,
                                            (currentQuestion) => ({
                                              ...currentQuestion,
                                              referenceAnswer: event.target.value,
                                            }),
                                          )
                                        }
                                        placeholder="Type a model/reference answer for grading purposes."
                                      />
                                    </div>
                                  </div>
                                </div>
                              ))}

                            {/* Passage matching questions editor */}
                            {subsection.questionType === "passage-matching" &&
                              subsection.questions.filter(isManualPassageMatchingQuestion).map((question, questionIndex) => (
                                <div key={question.id} className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm">
                                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                      <p className="text-sm font-semibold text-amber-800">{`Person ${questionIndex + 1}`}</p>
                                      <p className="text-xs text-slate-500">Describe the person and their criteria — students match to the best description above.</p>
                                    </div>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => removeQuestion(section.id, subsection.id, question.id)}
                                      className="text-slate-500 hover:text-red-500"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>

                                  <div className="space-y-4">
                                    <div className="space-y-2">
                                      <Label>Person Description</Label>
                                      <Textarea
                                        rows={2}
                                        value={question.prompt}
                                        onChange={(event) =>
                                          updatePassageMatchingQuestion(
                                            section.id,
                                            subsection.id,
                                            question.id,
                                            (currentQuestion) => ({
                                              ...currentQuestion,
                                              prompt: event.target.value,
                                            }),
                                          )
                                        }
                                        placeholder="e.g. Thomas and his sister enjoy eating French food. They want a restaurant that also has live music."
                                      />
                                    </div>

                                    <div className="min-w-[180px] space-y-1">
                                      <Label className="text-xs">Correct Match</Label>
                                      <select
                                        value={question.correctAnswer}
                                        onChange={(event) =>
                                          updatePassageMatchingQuestion(section.id, subsection.id, question.id, (q) => ({
                                            ...q,
                                            correctAnswer: event.target.value,
                                          }))
                                        }
                                        className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm"
                                      >
                                        {(subsection.matchingDescriptions ?? []).map((desc) => (
                                          <option key={desc.id} value={desc.label}>
                                            {desc.label}. {desc.name || "Untitled"}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  </div>
                                </div>
                              ))}

                            {/* Writing questions editor */}
                            {subsection.questionType === "writing" &&
                              subsection.questions.filter(isManualWritingQuestion).map((question, questionIndex) => (
                                <div key={question.id} className="rounded-2xl border border-rose-100 bg-white p-4 shadow-sm">
                                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                      <p className="text-sm font-semibold text-rose-800">{`Writing Task ${questionIndex + 1}`}</p>
                                      <p className="text-xs text-slate-500">Define the writing prompt, optional image, and word count guidelines.</p>
                                    </div>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => removeQuestion(section.id, subsection.id, question.id)}
                                      className="text-slate-500 hover:text-red-500"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>

                                  <div className="space-y-4">
                                    <div className="space-y-2">
                                      <Label>Writing Prompt / Requirements</Label>
                                      <Textarea
                                        rows={4}
                                        value={question.prompt}
                                        onChange={(event) =>
                                          updateWritingQuestion(
                                            section.id,
                                            subsection.id,
                                            question.id,
                                            (currentQuestion) => ({
                                              ...currentQuestion,
                                              prompt: event.target.value,
                                            }),
                                          )
                                        }
                                        placeholder="e.g. Write a letter to your friend about your recent holiday. Include details about where you went, what you did, and how you felt."
                                      />
                                    </div>

                                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                                      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px]">
                                        <div className="space-y-2">
                                          <Label>Prompt Image <span className="text-xs font-normal text-slate-400">(optional)</span></Label>
                                          <p className="text-xs text-slate-500">
                                            Upload an image related to the writing task (e.g. a picture prompt).
                                          </p>
                                          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-rose-300/60 bg-white px-3 py-2 text-sm font-medium text-rose-700 transition-colors hover:border-rose-400 hover:text-rose-800">
                                            <ImagePlus className="h-4 w-4" />
                                            {question.image ? "Replace Image" : "Add Image"}
                                            <input
                                              type="file"
                                              accept="image/png,image/jpeg,image/webp,image/gif"
                                              className="hidden"
                                              onChange={(event) =>
                                                handleWritingImageUpload(
                                                  section.id,
                                                  subsection.id,
                                                  question.id,
                                                  event.target.files?.[0],
                                                )
                                              }
                                            />
                                          </label>
                                          {question.image && (
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              className="h-auto px-0 text-sm text-slate-500 hover:text-red-500"
                                              onClick={() =>
                                                updateWritingQuestion(section.id, subsection.id, question.id, (q) => ({
                                                  ...q,
                                                  image: undefined,
                                                }))
                                              }
                                            >
                                              Remove Image
                                            </Button>
                                          )}
                                        </div>

                                        <div className="space-y-2">
                                          <Label>Preview</Label>
                                          <div className="flex min-h-[100px] items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white p-2">
                                            {question.image ? (
                                              <img
                                                src={question.image.previewUrl || question.image.dataUrl}
                                                alt="Writing prompt"
                                                className="max-h-28 w-full object-contain"
                                              />
                                            ) : (
                                              <span className="px-4 text-center text-xs text-slate-400">
                                                No image
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="grid gap-4 sm:grid-cols-2">
                                      <div className="space-y-2">
                                        <Label>Min Words <span className="text-xs font-normal text-slate-400">(optional)</span></Label>
                                        <Input
                                          type="number"
                                          min={0}
                                          value={question.minWords ?? ""}
                                          onChange={(event) =>
                                            updateWritingQuestion(
                                              section.id,
                                              subsection.id,
                                              question.id,
                                              (currentQuestion) => ({
                                                ...currentQuestion,
                                                minWords: event.target.value ? Number(event.target.value) : undefined,
                                              }),
                                            )
                                          }
                                          placeholder="e.g. 80"
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <Label>Max Words <span className="text-xs font-normal text-slate-400">(optional)</span></Label>
                                        <Input
                                          type="number"
                                          min={0}
                                          value={question.maxWords ?? ""}
                                          onChange={(event) =>
                                            updateWritingQuestion(
                                              section.id,
                                              subsection.id,
                                              question.id,
                                              (currentQuestion) => ({
                                                ...currentQuestion,
                                                maxWords: event.target.value ? Number(event.target.value) : undefined,
                                              }),
                                            )
                                          }
                                          placeholder="e.g. 150"
                                        />
                                      </div>
                                    </div>

                                    <div className="space-y-2">
                                      <Label>Reference Answer <span className="text-xs font-normal text-slate-400">(optional, for grading reference)</span></Label>
                                      <Textarea
                                        rows={4}
                                        value={question.referenceAnswer ?? ""}
                                        onChange={(event) =>
                                          updateWritingQuestion(
                                            section.id,
                                            subsection.id,
                                            question.id,
                                            (currentQuestion) => ({
                                              ...currentQuestion,
                                              referenceAnswer: event.target.value || undefined,
                                            }),
                                          )
                                        }
                                        placeholder="Type a model/reference answer for grading purposes."
                                      />
                                    </div>
                                  </div>
                                </div>
                              ))}

                            {/* Passage MCQ — per-blank options editor */}
                            {subsection.questionType === "passage-mcq" && (() => {
                              const passageMCQQuestions = subsection.questions.filter(isManualPassageMCQQuestion);
                              if (passageMCQQuestions.length === 0) {
                                return (
                                  <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-500">
                                    Add ___ blanks in the passage above to create MCQ slots.
                                  </div>
                                );
                              }
                              return passageMCQQuestions.map((question, questionIndex) => (
                                <div key={question.id} className="rounded-2xl border border-violet-100 bg-white p-4 shadow-sm">
                                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                      <p className="text-sm font-semibold text-violet-800">{`Blank ${questionIndex + 1}`}</p>
                                      <p className="text-xs text-slate-500">Define the MCQ options for this blank.</p>
                                    </div>
                                  </div>

                                  <div className="space-y-3">
                                    <div className="grid gap-2 sm:grid-cols-2">
                                      {question.options.map((option) => (
                                        <div key={option.id} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-800">
                                            {option.label}
                                          </span>
                                          <Input
                                            value={option.text}
                                            onChange={(event) =>
                                              updatePassageMCQQuestion(section.id, subsection.id, question.id, (q) => ({
                                                ...q,
                                                options: q.options.map((o) =>
                                                  o.id === option.id ? { ...o, text: event.target.value } : o,
                                                ),
                                              }))
                                            }
                                            placeholder={`Option ${option.label} text`}
                                            className="h-8 text-sm"
                                          />
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => removePassageMCQOption(section.id, subsection.id, question.id, option.id)}
                                            className="h-7 w-7 shrink-0 text-slate-400 hover:text-red-500"
                                          >
                                            <Trash2 className="h-3.5 w-3.5" />
                                          </Button>
                                        </div>
                                      ))}
                                    </div>

                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => addPassageMCQOption(section.id, subsection.id, question.id)}
                                        className="text-xs"
                                      >
                                        <Plus className="mr-1 h-3 w-3" />
                                        Add Option
                                      </Button>

                                      <div className="min-w-[140px] space-y-1">
                                        <Label className="text-xs">Correct Answer</Label>
                                        <select
                                          value={question.correctAnswer}
                                          onChange={(event) =>
                                            updatePassageMCQQuestion(section.id, subsection.id, question.id, (q) => ({
                                              ...q,
                                              correctAnswer: event.target.value,
                                            }))
                                          }
                                          className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-sm"
                                        >
                                          {question.options.map((option, optionIndex) => (
                                            <option key={option.id} value={getOptionLabel(optionIndex)}>
                                              {getOptionLabel(optionIndex)}. {option.text || "—"}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ));
                            })()}

                            {/* Passage fill-blank answer mapping */}
                            {subsection.questionType === "passage-fill-blank" && (() => {
                              const passageQuestions = subsection.questions.filter(isManualPassageFillBlankQuestion);
                              if (passageQuestions.length === 0) {
                                return (
                                  <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-500">
                                    Add ___ blanks in the passage above to create answer slots.
                                  </div>
                                );
                              }
                              return (
                                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                  <div className="mb-3">
                                    <p className="text-sm font-semibold text-slate-800">Answer Mapping</p>
                                    <p className="text-xs text-slate-500">
                                      Assign the correct word bank item for each blank in the passage.
                                    </p>
                                  </div>
                                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                    {passageQuestions.map((question, questionIndex) => (
                                      <div key={question.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                        <p className="mb-2 text-sm font-semibold text-slate-700">Blank {questionIndex + 1}</p>
                                        <select
                                          value={question.correctAnswerWordBankId}
                                          onChange={(event) =>
                                            updatePassageFillBlankQuestion(
                                              section.id,
                                              subsection.id,
                                              question.id,
                                              (currentQuestion) => ({
                                                ...currentQuestion,
                                                correctAnswerWordBankId: event.target.value,
                                              }),
                                            )
                                          }
                                          className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm"
                                        >
                                          {(subsection.wordBank ?? []).map((item) => (
                                            <option key={item.id} value={item.id}>
                                              {item.letter}. {item.word || "Untitled word"}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })()}
                          </div>

                          {/* Add question/blank button — not shown for passage-fill-blank and passage-mcq (blanks auto-sync from passage) */}
                          {(subsection.questionType !== "passage-fill-blank" && subsection.questionType !== "passage-mcq") && (
                            <Button type="button" variant="outline" onClick={() => addQuestion(section.id, subsection.id)}>
                              <FilePlus2 className="mr-2 h-4 w-4" />
                              {subsection.questionType === "fill-blank" ? "Add Blank" : subsection.questionType === "writing" ? "Add Writing Task" : subsection.questionType === "passage-matching" ? "Add Person" : "Add Question"}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <Button type="button" variant="outline" onClick={() => addSubsection(section.id)}>
                    <SquarePen className="mr-2 h-4 w-4" />
                    Add Main Question
                  </Button>
                </CardContent>
              </Card>
            ))}

            <Button type="button" variant="outline" onClick={addSection} className="w-full">
              <Plus className="mr-2 h-4 w-4" />
              Add Section
            </Button>
          </div>

          <div className="space-y-6">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle>Preview</CardTitle>
                <CardDescription>Quick student-facing preview of the paper structure you are building.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!title.trim() && !description.trim() && sections.length === 0 && (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-sm text-slate-500">
                    Start building the paper on the left.
                  </div>
                )}

                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-lg font-semibold text-slate-800">{title || "Untitled Paper"}</p>
                  <p className="mt-2 text-sm text-slate-500">{description || "No description yet."}</p>
                </div>

                {blueprint.sections.map((section) => (
                  <div key={section.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-sm font-semibold text-slate-800">
                      {section.partLabel} · {MANUAL_SECTION_TYPE_LABELS[section.sectionType]}
                    </p>

                    <div className="mt-4 space-y-4">
                      {section.subsections.map((subsection, subsectionIndex) => (
                        <div key={subsection.id} className="rounded-xl bg-slate-50 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-slate-800">
                              {subsection.title || `Main Question ${subsectionIndex + 1}`}
                            </p>
                            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                              {MANUAL_QUESTION_TYPE_LABELS[subsection.questionType]}
                            </span>
                          </div>
                          <p className="mt-2 whitespace-pre-wrap text-xs text-slate-500">
                            {subsection.instructions || "No instructions yet."}
                          </p>

                          {subsection.sceneImage && (
                            <div className="mt-4 flex justify-center rounded-2xl border border-slate-200 bg-white p-3">
                              <img
                                src={subsection.sceneImage.previewUrl || subsection.sceneImage.dataUrl}
                                alt={subsection.title || `Main Question ${subsectionIndex + 1}`}
                                className="max-h-60 w-full object-contain"
                              />
                            </div>
                          )}

                          {subsection.audio && (
                            <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50/60 p-3">
                              <div className="flex items-center gap-2 mb-2">
                                <Volume2 className="h-3.5 w-3.5 text-sky-700" />
                                <p className="text-xs font-semibold text-sky-800">Listening Audio</p>
                              </div>
                              <audio
                                controls
                                className="w-full"
                                src={subsection.audio.previewUrl || subsection.audio.dataUrl}
                              />
                            </div>
                          )}

                          <div className="mt-4 space-y-4">
                            {subsection.questionType === "mcq" &&
                              subsection.questions.filter(isManualMCQQuestion).map((question, questionIndex) => (
                                <div key={question.id} className="rounded-xl border border-white bg-white p-4">
                                  <p className="text-sm font-medium text-slate-800">
                                    {`${questionIndex + 1}. ${question.prompt || "Question prompt goes here."}`}
                                  </p>
                                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                                    {question.options.map((option) => (
                                      <div key={option.id} className="rounded-xl border border-slate-200 p-3">
                                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                          {option.label}
                                        </p>
                                        <div className="mx-auto flex h-24 w-24 items-center justify-center overflow-hidden rounded-xl bg-slate-100 sm:h-28 sm:w-28">
                                          {option.image ? (
                                            <img
                                              src={option.image.previewUrl || option.image.dataUrl}
                                              alt={`Preview ${option.label}`}
                                              className="h-full w-full object-contain"
                                            />
                                          ) : (
                                            <span className="px-3 text-center text-xs text-slate-400">No image</span>
                                          )}
                                        </div>
                                        {option.text && <p className="mt-2 text-xs text-slate-600">{option.text}</p>}
                                      </div>
                                    ))}
                                  </div>
                                  <p className="mt-3 text-xs font-medium text-emerald-700">
                                    Correct answer: {question.correctAnswer}
                                  </p>
                                </div>
                              ))}

                            {subsection.questionType === "fill-blank" && (
                              <FillBlankSubsectionPreview subsection={subsection} />
                            )}

                            {subsection.questionType === "passage-fill-blank" && (
                              <PassageFillBlankSubsectionPreview subsection={subsection} />
                            )}

                            {subsection.questionType === "passage-mcq" && (
                              <PassageMCQPreview
                                passageText={subsection.passageText ?? ""}
                                questions={subsection.questions.filter(isManualPassageMCQQuestion)}
                                sceneImageUrl={subsection.sceneImage?.previewUrl || subsection.sceneImage?.dataUrl}
                              />
                            )}

                            {subsection.questionType === "typed-fill-blank" &&
                              subsection.questions.filter(isManualTypedFillBlankQuestion).map((question, questionIndex) => (
                                <div key={question.id} className="rounded-xl border border-white bg-white p-4">
                                  <p className="text-sm font-medium text-slate-800">
                                    {`${questionIndex + 1}. `}
                                    {(() => {
                                      const prompt = question.prompt.trim() || "Question prompt goes here.";
                                      if (!prompt.includes("___")) {
                                        return <>{prompt} <span className="inline-block min-w-[80px] border-b-2 border-slate-400 align-bottom">&nbsp;</span></>;
                                      }
                                      const parts = prompt.split("___");
                                      return parts.map((part, partIndex) => (
                                        <span key={partIndex}>
                                          {part}
                                          {partIndex < parts.length - 1 && (
                                            <span className="inline-block min-w-[80px] border-b-2 border-slate-400 align-bottom">&nbsp;</span>
                                          )}
                                        </span>
                                      ));
                                    })()}
                                  </p>
                                  <p className="mt-2 text-xs font-medium text-emerald-700">
                                    Correct answer: {question.correctAnswer || "(not set)"}
                                  </p>
                                </div>
                              ))}

                            {subsection.questionType === "passage-open-ended" && (
                              <div className="space-y-4">
                                {(subsection.passageText ?? "").trim() ? (
                                  <div className="rounded-xl border border-teal-100 bg-teal-50/40 p-4">
                                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-teal-700">Passage</p>
                                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                                      {subsection.passageText}
                                    </p>
                                  </div>
                                ) : (
                                  <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-500">
                                    Add a passage above to preview.
                                  </div>
                                )}

                                {subsection.questions.filter(isManualPassageOpenEndedQuestion).map((question, questionIndex) => (
                                  <div key={question.id} className="rounded-xl border border-white bg-white p-4">
                                    <p className="text-sm font-medium text-slate-800">
                                      {`${questionIndex + 1}. ${question.prompt || "Question goes here."}`}
                                    </p>
                                    <div className="mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-xs text-slate-400">
                                      Student answer area
                                    </div>
                                    {question.referenceAnswer && (
                                      <p className="mt-2 text-xs font-medium text-emerald-700">
                                        Reference answer: {question.referenceAnswer}
                                      </p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            {subsection.questionType === "passage-matching" && (() => {
                              const descriptions = subsection.matchingDescriptions ?? [];
                              const matchingQuestions = subsection.questions.filter(isManualPassageMatchingQuestion);
                              return (
                                <div className="space-y-4">
                                  {descriptions.length > 0 ? (
                                    <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-4">
                                      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-amber-700">Descriptions</p>
                                      <div className="space-y-3">
                                        {descriptions.map((desc) => (
                                          <div key={desc.id} className="flex gap-3">
                                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-200 text-xs font-bold text-amber-900">
                                              {desc.label}
                                            </span>
                                            <div>
                                              <p className="text-sm font-semibold text-slate-800">{desc.name || "Untitled"}</p>
                                              <p className="text-sm leading-relaxed text-slate-600">{desc.text || "No description yet."}</p>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-500">
                                      Add descriptions above to preview.
                                    </div>
                                  )}

                                  {matchingQuestions.map((question, questionIndex) => (
                                    <div key={question.id} className="rounded-xl border border-white bg-white p-4">
                                      <div className="flex items-center gap-2 mb-2">
                                        <Link2 className="h-4 w-4 text-amber-600" />
                                        <p className="text-sm font-semibold text-slate-800">{`Person ${questionIndex + 1}`}</p>
                                      </div>
                                      <p className="text-sm leading-relaxed text-slate-700">
                                        {question.prompt || "Person description goes here."}
                                      </p>
                                      <div className="mt-3 flex flex-wrap gap-2">
                                        {descriptions.map((desc) => (
                                          <span
                                            key={desc.id}
                                            className={`rounded-full border px-3 py-1 text-xs font-medium ${
                                              desc.label === question.correctAnswer
                                                ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                                                : "border-slate-200 bg-white text-slate-500"
                                            }`}
                                          >
                                            {desc.label}. {desc.name || "Untitled"}
                                          </span>
                                        ))}
                                      </div>
                                      <p className="mt-2 text-xs font-medium text-emerald-700">
                                        Correct match: {question.correctAnswer}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              );
                            })()}

                            {subsection.questionType === "writing" &&
                              subsection.questions.filter(isManualWritingQuestion).map((question, questionIndex) => (
                                <div key={question.id} className="rounded-xl border border-white bg-white p-4">
                                  <div className="flex items-center gap-2 mb-3">
                                    <PenLine className="h-4 w-4 text-rose-600" />
                                    <p className="text-sm font-semibold text-slate-800">{`Writing Task ${questionIndex + 1}`}</p>
                                  </div>

                                  {question.image && (
                                    <div className="mb-4 flex justify-center rounded-xl border border-slate-200 bg-slate-50 p-3">
                                      <img
                                        src={question.image.previewUrl || question.image.dataUrl}
                                        alt="Writing prompt"
                                        className="max-h-48 w-full object-contain"
                                      />
                                    </div>
                                  )}

                                  <div className="rounded-xl border border-rose-100 bg-rose-50/40 p-4 mb-4">
                                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-rose-700">Writing Prompt</p>
                                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                                      {question.prompt || "Writing prompt goes here."}
                                    </p>
                                    {(question.minWords || question.maxWords) && (
                                      <p className="mt-2 text-xs text-slate-500">
                                        Word count: {question.minWords ? `min ${question.minWords}` : ""}
                                        {question.minWords && question.maxWords ? " – " : ""}
                                        {question.maxWords ? `max ${question.maxWords}` : ""}
                                      </p>
                                    )}
                                  </div>

                                  <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-xs text-slate-400">
                                    Student writing area
                                  </div>

                                  {question.referenceAnswer && (
                                    <p className="mt-3 text-xs font-medium text-emerald-700">
                                      Reference answer: {question.referenceAnswer.length > 100 ? question.referenceAnswer.slice(0, 100) + "…" : question.referenceAnswer}
                                    </p>
                                  )}
                                </div>
                              ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ── Confirm / Save Button ── */}
        <div className="mt-8 flex items-center justify-end gap-4">
          {isSaved ? (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-6 py-3 text-emerald-700">
              <Check className="h-5 w-5" />
              <span className="text-sm font-semibold">Paper saved successfully!</span>
            </div>
          ) : (
            <Button
              size="lg"
              disabled={!title.trim() || sections.every(s => s.subsections.every(sub => sub.questions.length === 0)) || saveManualPaperMutation.isPending}
              onClick={async () => {
                try {
                  const paperId = `manual-${paperSeed}`;
                  await saveManualPaperMutation.mutateAsync({
                    paperId,
                    title: title.trim(),
                    description: description.trim() || undefined,
                    blueprintJson: JSON.stringify(prepareBlueprintForSave(blueprint)),
                  });
                  await utils.papers.listManualPapers.invalidate();
                  setIsSaved(true);
                  toast.success("Paper saved! It will now appear on the home page.");
                  setTimeout(() => navigate("/"), 1500);
                } catch (err: any) {
                  toast.error(err?.message || "Failed to save paper. Please try again.");
                }
              }}
              className="gap-2 bg-[#1E3A5F] px-8 text-white shadow-lg transition-all hover:bg-[#2a4f7a] hover:shadow-xl"
            >
              {saveManualPaperMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Confirm & Save Paper
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
