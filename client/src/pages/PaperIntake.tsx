import { useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, FilePlus2, ImagePlus, Plus, SquarePen, Trash2 } from "lucide-react";
import type { FillBlankQuestion } from "@/data/papers";
import DragDropFillBlank from "@/components/DragDropFillBlank";
import {
  compressImage,
  createSquareImageDataUrl,
  fileToBase64,
  formatFileSize,
  validateImageFile,
} from "@/lib/imageUtils";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type {
  ManualFillBlankQuestion,
  ManualMCQOption,
  ManualMCQQuestion,
  ManualPaperBlueprint,
  ManualQuestion,
  ManualQuestionType,
  ManualSection,
  ManualSectionType,
  ManualSubsection,
  ManualWordBankItem,
} from "@shared/manualPaperBlueprint";
import {
  MANUAL_QUESTION_TYPE_LABELS,
  MANUAL_QUESTION_TYPE_OPTIONS,
  MANUAL_SECTION_TYPE_LABELS,
} from "@shared/manualPaperBlueprint";
import { toast } from "sonner";

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

function createSubsection(questionType: ManualQuestionType = DEFAULT_QUESTION_TYPE): ManualSubsection {
  if (questionType === "fill-blank" || questionType === "passage-fill-blank") {
    const wordBank = relabelWordBank(
      Array.from({ length: DEFAULT_WORD_BANK_SIZE }, (_, index) => createWordBankItem(index)),
    );

    return {
      id: createLocalId(),
      title: "",
      instructions: "",
      questionType,
      wordBank,
      passageText: questionType === "passage-fill-blank" ? "" : undefined,
      questions:
        questionType === "passage-fill-blank"
          ? []
          : [createFillBlankQuestion(wordBank[0]?.id || "")],
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

function isWordBankSubsectionType(questionType: ManualQuestionType) {
  return questionType === "fill-blank" || questionType === "passage-fill-blank";
}

function countPassageBlanks(text: string) {
  return (text.match(/___/g) ?? []).length;
}

function syncPassageFillBlankQuestions(
  questions: ManualQuestion[],
  blankCount: number,
  fallbackWordBankId: string,
): ManualFillBlankQuestion[] {
  const currentQuestions = questions.filter(isManualFillBlankQuestion);

  return Array.from({ length: blankCount }, (_, index) => ({
    id: currentQuestions[index]?.id || createLocalId(),
    type: "fill-blank",
    prompt: "",
    correctAnswerWordBankId: currentQuestions[index]?.correctAnswerWordBankId || fallbackWordBankId,
  }));
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
            questions: subsection.questions.filter(isManualFillBlankQuestion),
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

function buildPassageFillBlankPreviewPassage(passageText: string) {
  let blankIndex = 0;

  return escapeHtml(passageText).replace(/___/g, () => {
    blankIndex += 1;
    return `<b>(${blankIndex}) ___</b>`;
  });
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
  const questions = useMemo(
    () => subsection.questions.filter(isManualFillBlankQuestion),
    [subsection.questions],
  );

  if (!subsection.passageText?.trim()) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-500">
        Paste a passage and use `___` wherever you want a draggable blank.
      </div>
    );
  }

  if (!questions.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-500">
        Add at least one `___` blank in the passage to preview this question block.
      </div>
    );
  }

  const previewQuestions = useMemo<FillBlankQuestion[]>(
    () =>
      questions.map((question, questionIndex) => ({
        id: questionIndex + 1,
        type: "fill-blank",
        correctAnswer:
          wordBank.find((item) => item.id === question.correctAnswerWordBankId)?.letter || wordBank[0]?.letter || "A",
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

  return (
    <div className="space-y-4">
      <DragDropFillBlank
        questions={previewQuestions}
        wordBank={wordBank.map((item) => ({ letter: item.letter, word: item.word || "Untitled word" }))}
        grammarPassage={buildPassageFillBlankPreviewPassage(subsection.passageText)}
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
  const uploadFileMutation = trpc.papers.uploadFile.useMutation();
  const [paperSeed] = useState(() => createLocalId());
  const [createdAt] = useState(() => new Date().toISOString());
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sections, setSections] = useState<ManualSection[]>([createSection()]);

  const blueprint = useMemo(
    () => buildBlueprint(paperSeed, createdAt, title, description, sections),
    [createdAt, description, paperSeed, sections, title],
  );

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
        passageText: nextSubsection.passageText,
        wordBank: nextSubsection.wordBank,
        questions: nextSubsection.questions,
      };
    });
  };

  const addQuestion = (sectionId: string, subsectionId: string) => {
    updateSubsection(sectionId, subsectionId, (subsection) => {
      if (subsection.questionType === "passage-fill-blank") {
        return subsection;
      }

      if (subsection.questionType === "fill-blank") {
        return {
          ...subsection,
          questions: [
            ...subsection.questions.filter(isManualFillBlankQuestion),
            createFillBlankQuestion(subsection.wordBank?.[0]?.id || ""),
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

  const updatePassageText = (sectionId: string, subsectionId: string, passageText: string) => {
    updateSubsection(sectionId, subsectionId, (subsection) => {
      if (subsection.questionType !== "passage-fill-blank") {
        return subsection;
      }

      const blankCount = countPassageBlanks(passageText);
      const fallbackWordBankId = subsection.wordBank?.[0]?.id || "";

      return {
        ...subsection,
        passageText,
        questions: syncPassageFillBlankQuestions(subsection.questions, blankCount, fallbackWordBankId),
      };
    });
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
          if (!isManualFillBlankQuestion(question) || question.correctAnswerWordBankId) {
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
          if (!isManualFillBlankQuestion(question)) {
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
              Build a paper manually by section, big question, and question type. Multiple-choice and word-bank
              fill-blank blocks both preview in a student-facing layout on the right.
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
                            <p className="text-sm font-semibold text-slate-800">{`Big Question ${subsectionIndex + 1}`}</p>
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
                              <Label>Big Question Title</Label>
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

                          {subsection.questionType === "passage-fill-blank" && (
                            <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4">
                              <div className="space-y-2">
                                <Label>Passage Text</Label>
                                <Textarea
                                  rows={10}
                                  value={subsection.passageText || ""}
                                  onChange={(event) =>
                                    updatePassageText(section.id, subsection.id, event.target.value)
                                  }
                                  placeholder={
                                    "Paste the whole passage here and use ___ wherever students should drag a word into a blank."
                                  }
                                />
                                <p className="text-xs text-slate-500">
                                  Current blanks detected: {countPassageBlanks(subsection.passageText || "")}
                                </p>
                              </div>
                            </div>
                          )}

                          <div className="space-y-4">
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

                            {subsection.questionType === "passage-fill-blank" &&
                              subsection.questions.filter(isManualFillBlankQuestion).map((question, questionIndex) => (
                                <div key={question.id} className="rounded-2xl border border-white bg-white p-4 shadow-sm">
                                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                      <p className="text-sm font-semibold text-slate-800">{`Passage Blank ${questionIndex + 1}`}</p>
                                      <p className="text-xs text-slate-500">Answer slot generated from the passage.</p>
                                    </div>
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
                                      Choose the word bank item that belongs in blank {questionIndex + 1}.
                                    </p>
                                  </div>
                                </div>
                              ))}
                          </div>

                          {subsection.questionType !== "passage-fill-blank" && (
                            <Button type="button" variant="outline" onClick={() => addQuestion(section.id, subsection.id)}>
                              <FilePlus2 className="mr-2 h-4 w-4" />
                              {subsection.questionType === "fill-blank" ? "Add Blank" : "Add Question"}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <Button type="button" variant="outline" onClick={() => addSubsection(section.id)}>
                    <SquarePen className="mr-2 h-4 w-4" />
                    Add Big Question
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
                              {subsection.title || `Big Question ${subsectionIndex + 1}`}
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
                                alt={subsection.title || `Big Question ${subsectionIndex + 1}`}
                                className="max-h-60 w-full object-contain"
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
      </div>
    </div>
  );
}
