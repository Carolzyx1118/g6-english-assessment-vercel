import { useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Download, FilePlus2, ImagePlus, Plus, SquarePen, Trash2 } from "lucide-react";
import type {
  ManualMCQOption,
  ManualMCQQuestion,
  ManualPaperBlueprint,
  ManualSection,
  ManualSectionType,
  ManualSubsection,
} from "@shared/manualPaperBlueprint";
import { MANUAL_SECTION_TYPE_LABELS } from "@shared/manualPaperBlueprint";
import { createSquareImageDataUrl, formatFileSize, validateImageFile } from "@/lib/imageUtils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const DEFAULT_SECTION_TYPE: ManualSectionType = "reading";

function createLocalId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `manual_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getOptionLabel(index: number) {
  return String.fromCharCode(65 + index);
}

function createOption(index: number): ManualMCQOption {
  return {
    id: createLocalId(),
    label: getOptionLabel(index),
    text: "",
  };
}

function createQuestion(): ManualMCQQuestion {
  return {
    id: createLocalId(),
    type: "mcq",
    prompt: "",
    options: [createOption(0), createOption(1), createOption(2)],
    correctAnswer: "A",
  };
}

function createSubsection(): ManualSubsection {
  return {
    id: createLocalId(),
    title: "",
    instructions: "",
    questions: [createQuestion()],
  };
}

function createSection(sectionType: ManualSectionType = DEFAULT_SECTION_TYPE): ManualSection {
  return {
    id: createLocalId(),
    sectionType,
    subsections: [createSubsection()],
  };
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
      subsections: section.subsections.map((subsection) => ({
        ...subsection,
        questions: subsection.questions.map((question) => ({
          ...question,
          options: question.options.map((option, optionIndex) => ({
            ...option,
            label: getOptionLabel(optionIndex),
          })),
        })),
      })),
    })),
    createdAt,
  };
}

export default function PaperIntake() {
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
    setSections((prev) => prev.map((section) => (
      section.id === sectionId ? updater(section) : section
    )));
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

  const addQuestion = (sectionId: string, subsectionId: string) => {
    updateSubsection(sectionId, subsectionId, (subsection) => ({
      ...subsection,
      questions: [...subsection.questions, createQuestion()],
    }));
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

  const updateQuestion = (
    sectionId: string,
    subsectionId: string,
    questionId: string,
    updater: (question: ManualMCQQuestion) => ManualMCQQuestion,
  ) => {
    updateSubsection(sectionId, subsectionId, (subsection) => ({
      ...subsection,
      questions: subsection.questions.map((question) => (
        question.id === questionId ? updater(question) : question
      )),
    }));
  };

  const addOption = (sectionId: string, subsectionId: string, questionId: string) => {
    updateQuestion(sectionId, subsectionId, questionId, (question) => ({
      ...question,
      options: [...question.options, createOption(question.options.length)],
    }));
  };

  const removeOption = (sectionId: string, subsectionId: string, questionId: string, optionId: string) => {
    updateQuestion(sectionId, subsectionId, questionId, (question) => {
      if (question.options.length <= 2) {
        return question;
      }

      const nextOptions = question.options
        .filter((option) => option.id !== optionId)
        .map((option, optionIndex) => ({
          ...option,
          label: getOptionLabel(optionIndex),
        }));
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
    updateQuestion(sectionId, subsectionId, questionId, (question) => ({
      ...question,
      options: question.options.map((option) => (
        option.id === optionId ? updater(option) : option
      )),
    }));
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
      updateOption(sectionId, subsectionId, questionId, optionId, (option) => ({
        ...option,
        image: {
          dataUrl: normalizedImage.dataUrl,
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

  const handleDownloadBlueprint = () => {
    if (!title.trim()) {
      toast.error("Please enter the paper name before exporting.");
      return;
    }

    const blob = new Blob([JSON.stringify(blueprint, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${blueprint.id || "manual-paper"}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#F6F8FB]">
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link href="/">
              <a className="inline-flex items-center gap-2 text-sm text-slate-500 transition-colors hover:text-slate-700">
                <ArrowLeft className="h-4 w-4" />
                Back to Assessments
              </a>
            </Link>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#1E3A5F]">Manual Paper Builder</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-500">
              Build a paper manually by section, subsection, and question type. This version focuses on multiple-choice
              entry with optional square option images and explicit correct answers for checking.
            </p>
          </div>
          <Button type="button" onClick={handleDownloadBlueprint} className="bg-[#1E3A5F] hover:bg-[#16304F]">
            <Download className="mr-2 h-4 w-4" />
            Export JSON
          </Button>
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
                      <CardDescription>Choose the section type, then add one or more big questions below.</CardDescription>
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
                              placeholder="e.g. Matching people to notices"
                            />
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

                          <div className="space-y-4">
                            {subsection.questions.map((question, questionIndex) => (
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
                                        updateQuestion(section.id, subsection.id, question.id, (currentQuestion) => ({
                                          ...currentQuestion,
                                          prompt: event.target.value,
                                        }))
                                      }
                                      placeholder="Type the stem of the multiple-choice question."
                                    />
                                  </div>

                                  <div className="space-y-3">
                                    {question.options.map((option) => (
                                      <div key={option.id} className="rounded-xl border border-slate-200 p-4">
                                        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                                          <p className="text-sm font-semibold text-slate-700">{`Option ${option.label}`}</p>
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => removeOption(section.id, subsection.id, question.id, option.id)}
                                            className="text-slate-500 hover:text-red-500"
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </div>

                                        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_200px]">
                                          <div className="space-y-2">
                                            <Label>{`Option ${option.label} Text`}</Label>
                                            <Input
                                              value={option.text}
                                              onChange={(event) =>
                                                updateOption(section.id, subsection.id, question.id, option.id, (currentOption) => ({
                                                  ...currentOption,
                                                  text: event.target.value,
                                                }))
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
                                            <div className="flex aspect-square items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                                              {option.image ? (
                                                <img
                                                  src={option.image.dataUrl}
                                                  alt={`Option ${option.label}`}
                                                  className="h-full w-full object-cover"
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
                                          updateQuestion(section.id, subsection.id, question.id, (currentQuestion) => ({
                                            ...currentQuestion,
                                            correctAnswer: event.target.value,
                                          }))
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
                          </div>

                          <Button type="button" variant="outline" onClick={() => addQuestion(section.id, subsection.id)}>
                            <FilePlus2 className="mr-2 h-4 w-4" />
                            Add Question
                          </Button>
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
                          <p className="text-sm font-semibold text-slate-800">
                            {subsection.title || `Big Question ${subsectionIndex + 1}`}
                          </p>
                          <p className="mt-2 whitespace-pre-wrap text-xs text-slate-500">
                            {subsection.instructions || "No instructions yet."}
                          </p>

                          <div className="mt-4 space-y-4">
                            {subsection.questions.map((question, questionIndex) => (
                              <div key={question.id} className="rounded-xl border border-white bg-white p-4">
                                <p className="text-sm font-medium text-slate-800">
                                  {`${questionIndex + 1}. ${question.prompt || "Question prompt goes here."}`}
                                </p>
                                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                  {question.options.map((option) => (
                                    <div key={option.id} className="rounded-xl border border-slate-200 p-3">
                                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        {option.label}
                                      </p>
                                      <div className="flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-slate-100">
                                        {option.image ? (
                                          <img
                                            src={option.image.dataUrl}
                                            alt={`Preview ${option.label}`}
                                            className="h-full w-full object-cover"
                                          />
                                        ) : (
                                          <span className="px-3 text-center text-xs text-slate-400">No image</span>
                                        )}
                                      </div>
                                      {option.text && (
                                        <p className="mt-2 text-xs text-slate-600">{option.text}</p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                                <p className="mt-3 text-xs font-medium text-emerald-700">
                                  Correct answer: {question.correctAnswer}
                                </p>
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

            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle>Blueprint JSON</CardTitle>
                <CardDescription>Exported structure for this manual paper.</CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="max-h-[34rem] overflow-auto rounded-xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">
                  {JSON.stringify(blueprint, null, 2)}
                </pre>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
