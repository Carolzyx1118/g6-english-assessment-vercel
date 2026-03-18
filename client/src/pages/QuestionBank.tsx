import { useMemo, useState } from "react";
import { Link, useSearch } from "wouter";
import { ArrowLeft, ChevronDown, ChevronUp, FilePenLine, Loader2 } from "lucide-react";
import TeacherToolsLayout from "@/components/TeacherToolsLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PAPER_SUBJECT_LABELS, PAPER_SUBJECT_ORDER, type PaperSubject } from "@/data/papers";
import { formatQuestionBankItemId } from "@/lib/questionBankItem";
import { trpc } from "@/lib/trpc";
import {
  normalizeEnglishQuestionTagProfile,
  type EnglishQuestionTagProfile,
  type SubjectQuestionTagProfile,
} from "@shared/englishQuestionTags";
import {
  type ManualAudioFile,
  type ManualCheckboxOption,
  type ManualInlineWordChoiceItem,
  type ManualMatchingDescription,
  type ManualMCQOption,
  type ManualOptionImage,
  type ManualPaperBlueprint,
  type ManualPassageInlineWordChoiceItem,
  type ManualPassageMCQOption,
  type ManualQuestion,
  type ManualSubsection,
} from "@shared/manualPaperBlueprint";

function isPaperSubjectValue(value: unknown): value is PaperSubject {
  return typeof value === "string" && PAPER_SUBJECT_ORDER.includes(value as PaperSubject);
}

function formatDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString("en-SG", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function parseBlueprint(raw: string): ManualPaperBlueprint | null {
  try {
    return JSON.parse(raw) as ManualPaperBlueprint;
  } catch {
    return null;
  }
}

function isVisibleTagValue(value: string | undefined | null) {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return trimmed.toUpperCase() !== "N/A" && trimmed !== "未设置";
}

function getSubsectionTagValues(subject: PaperSubject, subsection: ManualSubsection) {
  const sharedTags = subsection.sharedQuestionTags?.[subject];
  const firstQuestionTags = subsection.questions.find((question) => question.tags?.[subject])?.tags?.[subject];
  const tags = sharedTags ?? firstQuestionTags;
  if (!tags) return [];

  if (subject === "english") {
    const normalized = normalizeEnglishQuestionTagProfile(tags as EnglishQuestionTagProfile);
    return Array.from(
      new Set(
        [normalized.track, normalized.ability, normalized.unit, normalized.examPart].filter(isVisibleTagValue),
      ),
    );
  }

  const normalized = tags as SubjectQuestionTagProfile;
  return Array.from(new Set([normalized.track, normalized.unit, normalized.examPart].filter(isVisibleTagValue)));
}

function PreviewImage({ image, className = "h-36 w-full max-w-xs" }: { image?: ManualOptionImage; className?: string }) {
  if (!image?.previewUrl && !image?.dataUrl) return null;
  const source = image.previewUrl || image.dataUrl;

  return (
    <img
      src={source}
      alt={image.fileName || "Question image"}
      className={`rounded-xl border border-slate-200 object-cover ${className}`}
    />
  );
}

function AudioPreview({ audio }: { audio?: ManualAudioFile }) {
  if (!audio?.previewUrl && !audio?.dataUrl) return null;
  const source = audio.previewUrl || audio.dataUrl;

  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Audio</p>
      <audio controls className="w-full">
        <source src={source} type={audio.mimeType} />
      </audio>
    </div>
  );
}

function OptionPill({ label, text }: { label?: string; text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
      {label ? (
        <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-slate-100 px-2 text-xs font-semibold text-slate-600">
          {label}
        </span>
      ) : null}
      <span className="text-sm leading-6 text-slate-700">{text || "No content yet."}</span>
    </div>
  );
}

function OptionList({
  options,
}: {
  options: Array<ManualMCQOption | ManualPassageMCQOption | ManualCheckboxOption>;
}) {
  if (options.length === 0) return null;

  return (
    <div className="space-y-2">
      {options.map((option) => (
        <OptionPill key={option.id} label={option.label} text={option.text} />
      ))}
    </div>
  );
}

function PassageTextPreview({ passageText }: { passageText?: string }) {
  if (!passageText?.trim()) return null;
  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Passage</p>
      <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{passageText}</p>
    </div>
  );
}

function WordBankPreview({ subsection }: { subsection: ManualSubsection }) {
  if (!subsection.wordBank?.length) return null;
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Word Bank</p>
      <div className="flex flex-wrap gap-2">
        {subsection.wordBank.map((item) => (
          <Badge key={item.id} variant="outline" className="rounded-full border-slate-200 bg-white px-3 py-1 text-slate-700">
            {item.letter}. {item.word}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function MatchingDescriptionsPreview({ descriptions }: { descriptions?: ManualMatchingDescription[] }) {
  if (!descriptions?.length) return null;
  return (
    <div className="space-y-3">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Matching Options</p>
      <div className="grid gap-3 md:grid-cols-2">
        {descriptions.map((description) => (
          <div key={description.id} className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-sm font-semibold text-slate-900">
              {description.label}. {description.name}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{description.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function InlineChoiceLine({ item }: { item: ManualInlineWordChoiceItem }) {
  const optionsText = item.options.map((option) => option.text).filter(Boolean).join(" / ");
  const sentenceText = item.sentenceText?.trim();

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-start gap-2 text-sm leading-7 text-slate-700">
        <span className="font-semibold text-slate-900">{item.label}.</span>
        {sentenceText ? (
          <span>{sentenceText}</span>
        ) : (
          <>
            <span>{item.beforeText}</span>
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-600">{optionsText || "Option group"}</span>
            <span>{item.afterText}</span>
          </>
        )}
      </div>
      {!sentenceText && optionsText ? (
        <p className="mt-2 text-xs text-slate-500">Choices: {optionsText}</p>
      ) : null}
    </div>
  );
}

function PassageInlineChoiceLine({ item }: { item: ManualPassageInlineWordChoiceItem }) {
  const optionsText = item.options.map((option) => `${option.label}. ${option.text}`).join(" / ");
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-700">
      <span className="font-semibold text-slate-900">{item.label}.</span> {optionsText || "No choices yet."}
    </div>
  );
}

function QuestionPreview({ question }: { question: ManualQuestion }) {
  switch (question.type) {
    case "mcq":
      return (
        <div className="space-y-3">
          {question.prompt?.trim() ? <p className="text-sm font-medium leading-7 text-slate-900">{question.prompt}</p> : null}
          <OptionList options={question.options} />
        </div>
      );
    case "checkbox":
      return (
        <div className="space-y-3">
          {question.prompt?.trim() ? <p className="text-sm font-medium leading-7 text-slate-900">{question.prompt}</p> : null}
          <OptionList options={question.options} />
        </div>
      );
    case "fill-blank":
    case "passage-fill-blank":
    case "typed-fill-blank":
    case "passage-open-ended":
    case "heading-match":
      return question.prompt?.trim() ? (
        <p className="text-sm font-medium leading-7 text-slate-900">{question.prompt}</p>
      ) : null;
    case "passage-mcq":
      return (
        <div className="space-y-3">
          {question.prompt?.trim() ? <p className="text-sm font-medium leading-7 text-slate-900">{question.prompt}</p> : null}
          <OptionList options={question.options} />
        </div>
      );
    case "picture-spelling":
      return (
        <div className="space-y-3">
          {question.prompt?.trim() ? <p className="text-sm font-medium leading-7 text-slate-900">{question.prompt}</p> : null}
          <PreviewImage image={question.image} className="h-32 w-32 max-w-none object-contain" />
        </div>
      );
    case "word-completion":
      return (
        <div className="space-y-3">
          {question.prompt?.trim() ? <p className="text-sm font-medium leading-7 text-slate-900">{question.prompt}</p> : null}
          {question.wordPattern?.trim() ? (
            <p className="rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-sm text-slate-700">
              {question.wordPattern}
            </p>
          ) : null}
          <PreviewImage image={question.image} className="h-32 w-32 max-w-none object-contain" />
        </div>
      );
    case "writing":
    case "speaking":
      return (
        <div className="space-y-3">
          {question.prompt?.trim() ? <p className="text-sm font-medium leading-7 text-slate-900">{question.prompt}</p> : null}
          <PreviewImage image={question.image} className="h-40 w-full max-w-sm object-contain" />
        </div>
      );
    case "true-false":
      return (
        <div className="space-y-3">
          {question.prompt?.trim() ? <p className="text-sm font-medium leading-7 text-slate-900">{question.prompt}</p> : null}
          <div className="space-y-2">
            {question.statements.map((statement) => (
              <div key={statement.id} className="rounded-xl border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-700">
                <span className="font-semibold text-slate-900">{statement.label}.</span> {statement.statement}
              </div>
            ))}
          </div>
        </div>
      );
    case "ordering":
      return (
        <div className="space-y-3">
          {question.prompt?.trim() ? <p className="text-sm font-medium leading-7 text-slate-900">{question.prompt}</p> : null}
          <div className="space-y-2">
            {question.items.map((item, index) => (
              <OptionPill key={item.id} label={`${index + 1}`} text={item.text} />
            ))}
          </div>
        </div>
      );
    case "sentence-reorder":
      return (
        <div className="space-y-3">
          {question.prompt?.trim() ? <p className="text-sm font-medium leading-7 text-slate-900">{question.prompt}</p> : null}
          <div className="space-y-2">
            {question.items.map((item) => (
              <OptionPill key={item.id} label={item.label} text={item.scrambledWords} />
            ))}
          </div>
        </div>
      );
    case "inline-word-choice":
      return (
        <div className="space-y-3">
          {question.prompt?.trim() ? <p className="text-sm font-medium leading-7 text-slate-900">{question.prompt}</p> : null}
          <div className="space-y-2">
            {question.items.map((item) => (
              <InlineChoiceLine key={item.id} item={item} />
            ))}
          </div>
        </div>
      );
    case "passage-inline-word-choice":
      return (
        <div className="space-y-2">
          {question.prompt?.trim() ? <p className="text-sm font-medium leading-7 text-slate-900">{question.prompt}</p> : null}
          {question.items.map((item) => (
            <PassageInlineChoiceLine key={item.id} item={item} />
          ))}
        </div>
      );
    case "passage-matching":
      return question.prompt?.trim() ? (
        <p className="text-sm font-medium leading-7 text-slate-900">{question.prompt}</p>
      ) : null;
    default:
      return null;
  }
}

function SubsectionPreview({ subsection }: { subsection: ManualSubsection }) {
  const hasQuestionCards = subsection.questions.some((question) => {
    if ("prompt" in question && typeof question.prompt === "string" && question.prompt.trim()) return true;
    if (question.type === "mcq" || question.type === "checkbox" || question.type === "passage-mcq") return question.options.length > 0;
    if (question.type === "true-false") return question.statements.length > 0;
    if (question.type === "ordering" || question.type === "sentence-reorder") return question.items.length > 0;
    if (question.type === "inline-word-choice" || question.type === "passage-inline-word-choice") return question.items.length > 0;
    if (question.type === "picture-spelling" || question.type === "word-completion" || question.type === "writing" || question.type === "speaking") {
      return Boolean(question.image || ("wordPattern" in question && question.wordPattern));
    }
    return false;
  });

  return (
    <div className="space-y-4">
      <AudioPreview audio={subsection.audio} />
      <PreviewImage image={subsection.sceneImage} className="h-44 w-full max-w-sm" />
      <PassageTextPreview passageText={subsection.passageText} />
      <WordBankPreview subsection={subsection} />
      <MatchingDescriptionsPreview descriptions={subsection.matchingDescriptions} />
      {hasQuestionCards ? (
        <div className="space-y-3">
          {subsection.questions.map((question) => {
            const preview = <QuestionPreview question={question} />;
            if (!preview) return null;
            return (
              <div key={question.id} className="rounded-xl border border-slate-200 bg-white p-4">
                {preview}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export default function QuestionBank() {
  const search = useSearch();
  const [expandedPaperIds, setExpandedPaperIds] = useState<number[]>([]);
  const subjectFilter = useMemo(() => {
    const value = new URLSearchParams(search).get("subject");
    return isPaperSubjectValue(value) ? value : "english";
  }, [search]);

  const listQuery = trpc.papers.listQuestionBankPapers.useQuery(undefined, {
    staleTime: 5_000,
  });

  const filteredPapers = useMemo(() => {
    const papers = listQuery.data ?? [];
    return papers.filter((paper) => paper.subject === subjectFilter);
  }, [listQuery.data, subjectFilter]);

  const summary = useMemo(() => ({
    totalBanks: filteredPapers.length,
    totalItems: filteredPapers.reduce((sum, paper) => sum + paper.itemCount, 0),
  }), [filteredPapers]);

  const toggleExpanded = (paperId: number) => {
    setExpandedPaperIds((current) =>
      current.includes(paperId)
        ? current.filter((id) => id !== paperId)
        : [...current, paperId],
    );
  };

  return (
    <TeacherToolsLayout activeTool="question-bank" currentSubject={subjectFilter}>
      <div className="min-h-screen bg-[#F6F8FB] px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="space-y-2">
            <div>
              <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700">
                <ArrowLeft className="h-4 w-4" />
                Back to Teacher Home
              </Link>
              <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#1E3A5F]">
                {`${PAPER_SUBJECT_LABELS[subjectFilter]} Question Bank`}
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-500">
                Review the question-bank items used for random paper building. Each entry shows the saved tags and a live preview of the question content.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription>Question Bank Papers</CardDescription>
                <CardTitle className="text-2xl">{summary.totalBanks}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription>Question Bank Items</CardDescription>
                <CardTitle className="text-2xl text-sky-700">{summary.totalItems}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          {listQuery.isLoading ? (
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="flex items-center justify-center gap-3 py-16 text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading question bank...
              </CardContent>
            </Card>
          ) : filteredPapers.length === 0 ? (
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="py-16 text-center text-sm text-slate-500">
                No question-bank papers have been recorded for this subject yet. Add some from Question Intake first.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredPapers.map((paper) => {
                const blueprint = parseBlueprint(paper.blueprintJson);
                const items = blueprint?.sections ?? [];
                const expanded = expandedPaperIds.includes(paper.id);

                return (
                  <Card key={paper.id} className="border-slate-200 shadow-sm">
                    <CardHeader className="space-y-4">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <CardTitle className="text-xl text-[#1E3A5F]">{paper.title}</CardTitle>
                            <Badge variant="secondary">{PAPER_SUBJECT_LABELS[paper.subject as PaperSubject] || paper.subject}</Badge>
                            <Badge className="rounded-full bg-slate-100 px-3 py-1 text-slate-600 hover:bg-slate-100">
                              {paper.itemCount} items
                            </Badge>
                          </div>
                          <CardDescription>
                            Bank ID: {paper.paperId} · Updated {formatDate(paper.updatedAt)}
                          </CardDescription>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Link href={`/paper-intake?subject=${paper.subject}&edit=${paper.paperId}`}>
                            <Button variant="outline" className="border-slate-200">
                              <FilePenLine className="mr-2 h-4 w-4" />
                              Edit
                            </Button>
                          </Link>
                          <Button
                            type="button"
                            variant="outline"
                            className="border-slate-200"
                            onClick={() => toggleExpanded(paper.id)}
                          >
                            {expanded ? (
                              <ChevronUp className="mr-2 h-4 w-4" />
                            ) : (
                              <ChevronDown className="mr-2 h-4 w-4" />
                            )}
                            {expanded ? "Hide Items" : "View Items"}
                          </Button>
                        </div>
                      </div>
                    </CardHeader>

                    {expanded ? (
                      <CardContent className="space-y-3">
                        {items.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                            There are no visible items in this question bank paper yet.
                          </div>
                        ) : (
                          items.map((section) => {
                            const subsection = section.subsections[0];
                            if (!subsection) return null;
                            const tagValues = getSubsectionTagValues(paper.subject as PaperSubject, subsection);

                            return (
                              <div
                                key={`${paper.paperId}-${section.id}`}
                                className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
                              >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div className="space-y-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <Badge className="rounded-full bg-[#1E3A5F] px-3 py-1 text-white hover:bg-[#1E3A5F]">
                                        {formatQuestionBankItemId(paper.subject as PaperSubject, subsection.id)}
                                      </Badge>
                                      {tagValues.map((tag) => (
                                        <Badge key={`${subsection.id}-${tag}`} variant="outline">
                                          {tag}
                                        </Badge>
                                      ))}
                                    </div>
                                    <SubsectionPreview subsection={subsection} />
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </CardContent>
                    ) : null}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </TeacherToolsLayout>
  );
}
