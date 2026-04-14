import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { ArrowLeft, ChevronDown, ChevronUp, FilePenLine, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import TeacherToolsLayout from "@/components/TeacherToolsLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PAPER_SUBJECT_LABELS, PAPER_SUBJECT_ORDER, type PaperSubject } from "@/data/papers";
import { formatQuestionBankItemId, getQuestionBankItemSummary } from "@/lib/questionBankItem";
import { trpc } from "@/lib/trpc";
import {
  normalizeEnglishQuestionTagProfile,
  type EnglishQuestionTagProfile,
  type SubjectQuestionTagProfile,
} from "@shared/englishQuestionTags";
import {
  MANUAL_QUESTION_TYPE_LABELS,
  type ManualAudioFile,
  type ManualCheckboxOption,
  type ManualInlineWordChoiceItem,
  type ManualMatchingDescription,
  type ManualMCQOption,
  type ManualOptionImage,
  type ManualPaperBlueprint,
  type ManualPassageInlineWordChoiceItem,
  type ManualPassageMCQOption,
  type ManualQuestionType,
  type ManualQuestion,
  type ManualSection,
  type ManualSubsection,
} from "@shared/manualPaperBlueprint";

type QuestionBankPaperRecord = {
  id: number;
  paperId: string;
  title: string;
  description: string | null;
  subject: string;
  category: string;
  published: boolean;
  totalQuestions: number;
  itemCount: number;
  blueprintJson: string;
  createdAt: string | Date;
  updatedAt: string | Date;
};

type QuestionBankItemRecord = {
  section: ManualSection;
  previewSubsections: ManualSubsection[];
  itemId: string;
  displayTags: string[];
  systemIds: string[];
  questionTypes: ManualQuestionType[];
  searchText: string;
};

type QuestionBankPaperView = {
  paper: QuestionBankPaperRecord;
  subject: PaperSubject;
  blueprint: ManualPaperBlueprint | null;
  items: QuestionBankItemRecord[];
};

type DeleteTarget =
  | {
    kind: "paper";
    key: string;
    paper: QuestionBankPaperRecord;
  }
  | {
    kind: "item";
    key: string;
    paper: QuestionBankPaperRecord;
    blueprint: ManualPaperBlueprint;
    sectionId: string;
    itemId: string;
    remainingItemCount: number;
  };

function isPaperSubjectValue(value: unknown): value is PaperSubject {
  return typeof value === "string" && PAPER_SUBJECT_ORDER.includes(value as PaperSubject);
}

function normalizePaperSubject(value: unknown): PaperSubject {
  return value === "math" || value === "vocabulary" ? value : "english";
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

function toVisibleTagStrings(values: Array<string | undefined | null>) {
  return values.filter((value): value is string => isVisibleTagValue(value)).map((value) => value.trim());
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
        toVisibleTagStrings([normalized.track, normalized.ability, normalized.unit, normalized.examPart]),
      ),
    );
  }

  const normalized = tags as SubjectQuestionTagProfile;
  return Array.from(new Set(toVisibleTagStrings([normalized.track, normalized.unit, normalized.examPart])));
}

function getSubsectionFilterMetadata(subject: PaperSubject, subsection: ManualSubsection) {
  const sharedTags = subsection.sharedQuestionTags?.[subject];
  const firstQuestionTags = subsection.questions.find((question) => question.tags?.[subject])?.tags?.[subject];
  const tags = sharedTags ?? firstQuestionTags;
  if (!tags) {
    return {
      examPart: "",
      systemId: "",
    };
  }

  if (subject === "english") {
    const normalized = normalizeEnglishQuestionTagProfile(tags as EnglishQuestionTagProfile);
    return {
      examPart: typeof normalized.examPart === "string" && isVisibleTagValue(normalized.examPart) ? normalized.examPart.trim() : "",
      systemId: typeof normalized.track === "string" && isVisibleTagValue(normalized.track) ? normalized.track.trim() : "",
    };
  }

  const normalized = tags as SubjectQuestionTagProfile;
  return {
    examPart: typeof normalized.examPart === "string" && isVisibleTagValue(normalized.examPart) ? normalized.examPart.trim() : "",
    systemId: typeof normalized.track === "string" && isVisibleTagValue(normalized.track) ? normalized.track.trim() : "",
  };
}

function getQuestionSearchChunks(question: ManualQuestion): string[] {
  const chunks: Array<string | undefined> = (() => {
    switch (question.type) {
    case "mcq":
    case "passage-mcq":
      return [
        question.prompt,
        ...question.options.map((option) => option.text),
      ];
    case "checkbox":
      return [
        question.prompt,
        ...question.options.map((option) => option.text),
      ];
    case "fill-blank":
    case "passage-fill-blank":
    case "typed-fill-blank":
    case "passage-open-ended":
    case "writing":
    case "speaking":
    case "passage-matching":
    case "heading-match":
    case "picture-spelling":
      return [question.prompt];
    case "word-completion":
      return [question.prompt, question.wordPattern];
    case "true-false":
      return [question.prompt, ...question.statements.map((statement) => statement.statement)];
    case "ordering":
      return [question.prompt, ...question.items.map((item) => item.text)];
    case "sentence-reorder":
      return [question.prompt, ...question.items.map((item) => `${item.scrambledWords} ${item.correctAnswer}`)];
    case "inline-word-choice":
      return [
        question.prompt,
        ...question.items.flatMap((item) => [
          item.sentenceText,
          item.beforeText,
          item.afterText,
          ...item.options.map((option) => option.text),
        ]),
      ];
    case "passage-inline-word-choice":
      return [
        question.prompt,
        ...question.items.flatMap((item) => item.options.map((option) => option.text)),
      ];
    default:
      return [];
    }
  })();

  return toVisibleTagStrings(chunks);
}

function normalizeSearchText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function getQuestionBankItemIdSummary(items: QuestionBankItemRecord[]) {
  if (items.length === 0) return "No items yet";
  if (items.length === 1) return `Item ID: ${items[0].itemId}`;
  if (items.length === 2) return `Item IDs: ${items[0].itemId}, ${items[1].itemId}`;
  return `Item IDs: ${items[0].itemId}, ${items[1].itemId} +${items.length - 2} more`;
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

function hasVisibleText(value?: string | null) {
  return Boolean(value?.trim());
}

function hasOptionContent(
  option: ManualMCQOption | ManualPassageMCQOption | ManualCheckboxOption,
) {
  const image = "image" in option ? option.image : undefined;
  return hasVisibleText(option.text) || Boolean(image);
}

function getOptionImage(
  option: ManualMCQOption | ManualPassageMCQOption | ManualCheckboxOption,
) {
  return "image" in option ? option.image : undefined;
}

function OptionPill({
  label,
  text,
  image,
}: {
  label?: string;
  text?: string;
  image?: ManualOptionImage;
}) {
  const showText = hasVisibleText(text);
  const showImage = Boolean(image);
  if (!showText && !showImage) return null;

  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
      {label ? (
        <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-slate-100 px-2 text-xs font-semibold text-slate-600">
          {label}
        </span>
      ) : null}
      <div className="min-w-0 flex-1 space-y-2">
        {showText ? <p className="text-sm leading-6 text-slate-700">{text}</p> : null}
        {showImage ? <PreviewImage image={image} className="h-28 w-28 max-w-none object-contain" /> : null}
      </div>
    </div>
  );
}

function OptionList({
  options,
}: {
  options: Array<ManualMCQOption | ManualPassageMCQOption | ManualCheckboxOption>;
}) {
  const visibleOptions = options.filter(hasOptionContent);
  if (visibleOptions.length === 0) return null;

  return (
    <div className="space-y-2">
      {visibleOptions.map((option) => (
        <OptionPill key={option.id} label={option.label} text={option.text} image={getOptionImage(option)} />
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
  if (!sentenceText && !item.beforeText?.trim() && !item.afterText?.trim() && !optionsText) return null;

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
  if (!optionsText) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-700">
      <span className="font-semibold text-slate-900">{item.label}.</span> {optionsText}
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
    if (question.type === "mcq" || question.type === "checkbox" || question.type === "passage-mcq") {
      return question.options.some(hasOptionContent);
    }
    if (question.type === "true-false") {
      return question.statements.some((statement) => hasVisibleText(statement.statement));
    }
    if (question.type === "ordering") {
      return question.items.some((item) => hasVisibleText(item.text));
    }
    if (question.type === "sentence-reorder") {
      return question.items.some((item) => hasVisibleText(item.scrambledWords) || hasVisibleText(item.correctAnswer));
    }
    if (question.type === "inline-word-choice") {
      return question.items.some((item) =>
        hasVisibleText(item.sentenceText) ||
        hasVisibleText(item.beforeText) ||
        hasVisibleText(item.afterText) ||
        item.options.some((option) => hasVisibleText(option.text)),
      );
    }
    if (question.type === "passage-inline-word-choice") {
      return question.items.some((item) => item.options.some((option) => hasVisibleText(option.text)));
    }
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
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const [expandedPaperIds, setExpandedPaperIds] = useState<number[]>([]);
  const [searchText, setSearchText] = useState("");
  const [selectedExamSystem, setSelectedExamSystem] = useState("all");
  const [selectedQuestionType, setSelectedQuestionType] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [pendingDeleteKey, setPendingDeleteKey] = useState<string | null>(null);
  const subjectFilter = useMemo(() => {
    const value = new URLSearchParams(search).get("subject");
    return isPaperSubjectValue(value) ? value : null;
  }, [search]);

  useEffect(() => {
    setSelectedExamSystem("all");
    setSelectedQuestionType("all");
  }, [subjectFilter]);

  const listQuery = trpc.papers.listQuestionBankPapers.useQuery(undefined, {
    staleTime: 5_000,
  });
  const englishSystemsQuery = trpc.papers.getEnglishTagSystems.useQuery(undefined, {
    staleTime: 30_000,
  });
  const mathSystemsQuery = trpc.papers.getMathTagSystems.useQuery(undefined, {
    staleTime: 30_000,
  });
  const vocabularySystemsQuery = trpc.papers.getVocabularyTagSystems.useQuery(undefined, {
    staleTime: 30_000,
  });
  const updateMutation = trpc.papers.updateManualPaper.useMutation();
  const deleteMutation = trpc.papers.deleteManualPaper.useMutation();

  const systemLabelBySubject = useMemo(() => ({
    english: Object.fromEntries((englishSystemsQuery.data ?? []).map((system) => [system.id, system.label])),
    math: Object.fromEntries((mathSystemsQuery.data ?? []).map((system) => [system.id, system.label])),
    vocabulary: Object.fromEntries((vocabularySystemsQuery.data ?? []).map((system) => [system.id, system.label])),
  }), [englishSystemsQuery.data, mathSystemsQuery.data, vocabularySystemsQuery.data]);

  const getSystemLabel = (systemId: string, subject?: PaperSubject) => {
    if (subject) {
      return systemLabelBySubject[subject][systemId] ?? systemId;
    }

    return systemLabelBySubject.english[systemId]
      ?? systemLabelBySubject.math[systemId]
      ?? systemLabelBySubject.vocabulary[systemId]
      ?? systemId;
  };

  const paperViews = useMemo<QuestionBankPaperView[]>(() => {
    return ((listQuery.data ?? []) as QuestionBankPaperRecord[]).map((paper) => {
      const paperSubject = normalizePaperSubject(paper.subject);
      const blueprint = parseBlueprint(paper.blueprintJson);
      const items = (blueprint?.sections ?? []).flatMap((section) => {
        const previewSubsections = section.subsections.filter(Boolean);
        if (previewSubsections.length === 0) return [];

        const displayTags = Array.from(new Set(previewSubsections.flatMap((subsection) => getSubsectionTagValues(paperSubject, subsection))));
        const systemIds = Array.from(new Set(previewSubsections.map((subsection) => getSubsectionFilterMetadata(paperSubject, subsection).systemId).filter(Boolean)));
        const questionTypes = Array.from(new Set(previewSubsections.map((subsection) => subsection.questionType)));
        const itemId = formatQuestionBankItemId(paperSubject, section.id);
        const searchChunks = [
          paper.title,
          paper.paperId,
          itemId,
          ...displayTags,
          ...systemIds.map((systemId) => systemLabelBySubject[paperSubject][systemId] ?? systemId),
          ...questionTypes.map((questionType) => MANUAL_QUESTION_TYPE_LABELS[questionType] ?? questionType),
          ...previewSubsections.flatMap((subsection) => [
            subsection.title,
            subsection.instructions,
            subsection.taskDescription,
            subsection.passageText,
            getQuestionBankItemSummary(subsection),
            ...subsection.questions.flatMap(getQuestionSearchChunks),
          ]),
        ];

        return [{
          section,
          previewSubsections,
          itemId,
          displayTags,
          systemIds,
          questionTypes,
          searchText: normalizeSearchText(searchChunks.filter(Boolean).join(" ")),
        }];
      });

      return {
        paper,
        subject: paperSubject,
        blueprint,
        items,
      };
    });
  }, [listQuery.data, systemLabelBySubject]);

  const filteredBySubjectPaperViews = useMemo(
    () => (subjectFilter ? paperViews.filter((paper) => paper.subject === subjectFilter) : paperViews),
    [paperViews, subjectFilter],
  );

  const filterOptions = useMemo(() => {
    const systemIdSet = new Set<string>();
    const questionTypeSet = new Set<ManualQuestionType>();

    filteredBySubjectPaperViews.forEach((paper) => {
      paper.items.forEach((item) => {
        item.systemIds.forEach((systemId) => systemIdSet.add(systemId));
        item.questionTypes.forEach((questionType) => questionTypeSet.add(questionType));
      });
    });

    return {
      systems: Array.from(systemIdSet)
        .map((systemId) => ({
          id: systemId,
          label: getSystemLabel(systemId, subjectFilter ?? undefined),
        }))
        .sort((left, right) => left.label.localeCompare(right.label)),
      questionTypes: Array.from(questionTypeSet).sort((left, right) =>
        (MANUAL_QUESTION_TYPE_LABELS[left] ?? left).localeCompare(MANUAL_QUESTION_TYPE_LABELS[right] ?? right),
      ),
    };
  }, [filteredBySubjectPaperViews, getSystemLabel, subjectFilter]);

  const hasActiveFilters = Boolean(searchText.trim()) || selectedExamSystem !== "all" || selectedQuestionType !== "all";

  const filteredPapers = useMemo(() => {
    const keyword = normalizeSearchText(searchText);
    return filteredBySubjectPaperViews
      .map((paper) => {
        const filteredItems = paper.items.filter((item) => {
          if (keyword && !item.searchText.includes(keyword)) return false;
          if (selectedExamSystem !== "all" && !item.systemIds.includes(selectedExamSystem)) return false;
          if (selectedQuestionType !== "all" && !item.questionTypes.includes(selectedQuestionType as ManualQuestionType)) return false;
          return true;
        });

        return {
          ...paper,
          filteredItems,
        };
      })
      .filter((paper) => (hasActiveFilters ? paper.filteredItems.length > 0 : true));
  }, [filteredBySubjectPaperViews, hasActiveFilters, searchText, selectedExamSystem, selectedQuestionType]);

  const paperCounts = useMemo(() => ({
    all: paperViews.length,
    english: paperViews.filter((paper) => paper.subject === "english").length,
    math: paperViews.filter((paper) => paper.subject === "math").length,
    vocabulary: paperViews.filter((paper) => paper.subject === "vocabulary").length,
  }), [paperViews]);

  const summary = useMemo(() => ({
    totalItems: filteredPapers.reduce(
      (sum, paper) => sum + (hasActiveFilters ? paper.filteredItems.length : paper.items.length),
      0,
    ),
  }), [filteredPapers, hasActiveFilters]);

  const refreshQuestionBankQueries = async () => {
    await Promise.all([
      utils.papers.listQuestionBankPapers.invalidate(),
      utils.papers.listAllManualPapers.invalidate(),
    ]);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setPendingDeleteKey(deleteTarget.key);

    try {
      if (deleteTarget.kind === "paper") {
        await deleteMutation.mutateAsync({ id: deleteTarget.paper.id });
        setExpandedPaperIds((current) => current.filter((id) => id !== deleteTarget.paper.id));
        toast.success("Question bank deleted.");
      } else if (deleteTarget.remainingItemCount <= 1) {
        await deleteMutation.mutateAsync({ id: deleteTarget.paper.id });
        setExpandedPaperIds((current) => current.filter((id) => id !== deleteTarget.paper.id));
        toast.success("Question item deleted.");
      } else {
        const nextBlueprint: ManualPaperBlueprint = {
          ...deleteTarget.blueprint,
          sections: deleteTarget.blueprint.sections.filter((section) => section.id !== deleteTarget.sectionId),
        };

        await updateMutation.mutateAsync({
          id: deleteTarget.paper.id,
          title: deleteTarget.paper.title,
          description: deleteTarget.paper.description ?? "",
          subject: deleteTarget.paper.subject,
          category: deleteTarget.paper.category,
          published: deleteTarget.paper.published,
          blueprintJson: JSON.stringify(nextBlueprint),
        });
        toast.success("Question item deleted.");
      }

      await refreshQuestionBankQueries();
      setDeleteTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete the question bank entry.");
    } finally {
      setPendingDeleteKey(null);
    }
  };

  const clearFilters = () => {
    setSearchText("");
    setSelectedExamSystem("all");
    setSelectedQuestionType("all");
  };

  const toggleExpanded = (paperId: number) => {
    setExpandedPaperIds((current) =>
      current.includes(paperId)
        ? current.filter((id) => id !== paperId)
        : [...current, paperId],
    );
  };

  return (
    <TeacherToolsLayout activeTool="question-bank" currentSubject={subjectFilter}>
      <div className="pureon-container">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="pureon-page-head">
            <div>
              <div className="pureon-section-eyebrow">Teacher Tools · Question Bank</div>
              <h1 className="pureon-page-title mt-2">题库</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--pureon-muted)]">
                查看随机组卷使用的题库内容，每条记录都保留标签信息和实时题目预览。
              </p>
            </div>
            <div className="pureon-page-head-actions">
              <Link
                href="/"
                className="inline-flex items-center gap-2 border border-[var(--pureon-teal)] px-4 py-2 text-sm text-[var(--pureon-teal)] transition-colors hover:bg-[var(--pureon-teal)] hover:text-[var(--pureon-paper)]"
              >
                <ArrowLeft className="h-4 w-4" />
                返回老师首页
              </Link>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription>Total Question Banks</CardDescription>
                <CardTitle className="text-2xl">{paperCounts.all}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription>{PAPER_SUBJECT_LABELS.english} Papers</CardDescription>
                <CardTitle className="text-2xl text-[#1E3A5F]">{paperCounts.english}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription>{PAPER_SUBJECT_LABELS.math} Papers</CardDescription>
                <CardTitle className="text-2xl text-emerald-700">{paperCounts.math}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription>{PAPER_SUBJECT_LABELS.vocabulary} Papers</CardDescription>
                <CardTitle className="text-2xl text-amber-700">{paperCounts.vocabulary}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          <Card className="gap-4 border-slate-200 py-5 shadow-sm">
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-700">Keyword</p>
                  <Input
                    value={searchText}
                    onChange={(event) => setSearchText(event.target.value)}
                    placeholder="Search ID, prompt, title..."
                    className="rounded-2xl border-slate-200 shadow-sm"
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-700">Exam System</p>
                  <select
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                    value={selectedExamSystem}
                    onChange={(event) => setSelectedExamSystem(event.target.value)}
                  >
                    <option value="all">All Exam Systems</option>
                    {filterOptions.systems.map((system) => (
                      <option key={system.id} value={system.id}>{system.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-700">Question Type</p>
                  <select
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                    value={selectedQuestionType}
                    onChange={(event) => setSelectedQuestionType(event.target.value)}
                  >
                    <option value="all">All Question Types</option>
                    {filterOptions.questionTypes.map((questionType) => (
                      <option key={questionType} value={questionType}>
                        {MANUAL_QUESTION_TYPE_LABELS[questionType] ?? questionType}
                      </option>
                    ))}
                  </select>
                </div>
                {hasActiveFilters ? (
                  <div className="flex justify-end md:col-span-2 xl:col-span-3">
                    <Button type="button" variant="outline" className="border-slate-200" onClick={clearFilters}>
                      Clear Filters
                    </Button>
                  </div>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {([
                  { key: "all", label: "All Subjects", count: paperCounts.all },
                  ...PAPER_SUBJECT_ORDER.map((subject) => ({
                    key: subject,
                    label: PAPER_SUBJECT_LABELS[subject],
                    count: paperCounts[subject],
                  })),
                ] as Array<{ key: "all" | PaperSubject; label: string; count: number }>).map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => navigate(option.key === "all" ? "/question-bank" : `/question-bank?subject=${option.key}`)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                      (subjectFilter ?? "all") === option.key
                        ? "bg-[#1E3A5F] text-white shadow-sm"
                        : "border border-slate-200 bg-white text-slate-600 hover:border-[#1E3A5F]/20 hover:text-[#1E3A5F]"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                {summary.totalItems} matching item{summary.totalItems === 1 ? "" : "s"}
              </p>
            </CardContent>
          </Card>

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
                {hasActiveFilters
                  ? "No question-bank items match the current filters."
                  : (subjectFilter
                    ? `No ${PAPER_SUBJECT_LABELS[subjectFilter]} question-bank papers have been recorded yet. Add some from Question Intake first.`
                    : "No question-bank papers have been recorded yet. Add some from Question Intake first.")}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredPapers.map((paperView) => {
                const { paper, blueprint } = paperView;
                const items = hasActiveFilters ? paperView.filteredItems : paperView.items;
                const expanded = expandedPaperIds.includes(paper.id);
                const itemCountLabel = hasActiveFilters && items.length !== paperView.items.length
                  ? `${items.length} of ${paperView.items.length} items`
                  : `${paperView.items.length} items`;
                const itemIdSummary = getQuestionBankItemIdSummary(items);

                return (
                  <Card key={paper.id} className="border-slate-200 shadow-sm">
                    <CardHeader className="space-y-4">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <CardTitle className="font-[family-name:var(--font-body)] text-lg font-extrabold tracking-normal text-[#1E3A5F]">{paper.title}</CardTitle>
                            <Badge variant="secondary">{PAPER_SUBJECT_LABELS[paper.subject as PaperSubject] || paper.subject}</Badge>
                            <Badge className="rounded-full bg-slate-100 px-3 py-1 text-slate-600 hover:bg-slate-100">
                              {itemCountLabel}
                            </Badge>
                          </div>
                          <CardDescription className="text-xs sm:text-sm">
                            {itemIdSummary} · Updated {formatDate(paper.updatedAt)}
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
                            {expanded ? "Hide" : "View"}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                            disabled={Boolean(pendingDeleteKey)}
                            onClick={() =>
                              setDeleteTarget({
                                kind: "paper",
                                key: `paper-${paper.id}`,
                                paper,
                              })
                            }
                          >
                            {pendingDeleteKey === `paper-${paper.id}` && deleteMutation.isPending ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="mr-2 h-4 w-4" />
                            )}
                            Delete
                          </Button>
                        </div>
                      </div>
                    </CardHeader>

                    {expanded ? (
                      <CardContent className="space-y-3">
                        {items.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                            {hasActiveFilters
                              ? "This bank has no items that match the current filters."
                              : "There are no visible items in this question bank paper yet."}
                          </div>
                        ) : (
                          items.map((item) => {
                            const primarySubsection = item.previewSubsections[0];
                            if (!primarySubsection) return null;

                            return (
                              <div
                                key={`${paper.paperId}-${item.section.id}`}
                                className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
                              >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div className="space-y-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                      {item.questionTypes.map((questionType) => (
                                        <Badge key={`${item.section.id}-${questionType}`} className="rounded-full bg-sky-100 px-3 py-1 text-sky-700 hover:bg-sky-100">
                                          {MANUAL_QUESTION_TYPE_LABELS[questionType] ?? questionType}
                                        </Badge>
                                      ))}
                                      {item.displayTags.map((tag) => (
                                        <Badge key={`${item.section.id}-${tag}`} variant="outline">
                                          {tag}
                                        </Badge>
                                      ))}
                                    </div>
                                    <p className="text-sm text-slate-500">
                                      {getQuestionBankItemSummary(primarySubsection)}
                                    </p>
                                    <div className="space-y-4">
                                      {item.previewSubsections.map((subsection, subsectionIndex) => (
                                        <div key={subsection.id} className="space-y-3">
                                          {item.previewSubsections.length > 1 ? (
                                            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                                              Block {subsectionIndex + 1}
                                            </p>
                                          ) : null}
                                          <SubsectionPreview subsection={subsection} />
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                                    disabled={Boolean(pendingDeleteKey) || !blueprint}
                                    onClick={() => {
                                      if (!blueprint) return;
                                      setDeleteTarget({
                                        kind: "item",
                                        key: `item-${paper.id}-${item.section.id}`,
                                        paper,
                                        blueprint,
                                        sectionId: item.section.id,
                                        itemId: item.itemId,
                                        remainingItemCount: paperView.items.length,
                                      });
                                    }}
                                  >
                                    {pendingDeleteKey === `item-${paper.id}-${item.section.id}` && (deleteMutation.isPending || updateMutation.isPending) ? (
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="mr-2 h-4 w-4" />
                                    )}
                                    Delete Item
                                  </Button>
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
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && !pendingDeleteKey && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteTarget?.kind === "item" ? "Delete this question item?" : "Delete this question bank?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.kind === "item"
                ? `This will permanently remove ${deleteTarget.itemId} from "${deleteTarget.paper.title}". This action cannot be undone.`
                : deleteTarget
                  ? `This will permanently delete "${deleteTarget.paper.title}" and all saved question-bank items inside it. This action cannot be undone.`
                  : "This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(pendingDeleteKey)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={Boolean(pendingDeleteKey)}
              className="bg-red-600 hover:bg-red-700"
            >
              {pendingDeleteKey ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TeacherToolsLayout>
  );
}
