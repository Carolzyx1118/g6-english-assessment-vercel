import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  GraduationCap,
  Languages,
  Loader2,
  PencilLine,
  Save,
  Sparkle,
  Mic,
  PenSquare,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { generateReportPDF } from "@/lib/generatePDF";
import {
  buildAssessmentReviewModel,
  buildSubmissionArtifacts,
  createPendingSpeakingEvaluation,
  DEFAULT_MANUAL_SPEAKING_MAX_SCORE,
  finalizeManualSpeakingEvaluation,
  formatDuration,
  getSectionDisplayName,
  getLetterGrade,
  type AssessmentReviewModel,
  type AssessmentReviewRecord,
  type QuestionReviewDetail,
  type ReviewLocale,
} from "@/lib/assessmentReview";
import { sanitizeReportForStorage } from "@/lib/resultStorage";
import { trpc } from "@/lib/trpc";
import type { SpeakingEvaluationResult } from "@shared/assessmentReport";

interface AssessmentReportPanelProps {
  record: AssessmentReviewRecord;
  extraHeaderActions?: ReactNode;
  showDownload?: boolean;
  initialLocale?: ReviewLocale;
  hideLocaleToggle?: boolean;
  printMode?: boolean;
  allowSpeakingManualScoring?: boolean;
}

type SpeakingEvaluationItem =
  NonNullable<NonNullable<AssessmentReviewModel["speaking"]["evaluation"]>["evaluations"]>[number];

type ManualSpeakingCriterionField =
  | "taskCompletionScore"
  | "fluencyScore"
  | "vocabularyScore"
  | "grammarScore"
  | "pronunciationScore";

const MANUAL_SPEAKING_CRITERIA: Array<{
  field: ManualSpeakingCriterionField;
  labelCn: string;
  labelEn: string;
}> = [
  { field: "taskCompletionScore", labelCn: "任务完成", labelEn: "Task Completion" },
  { field: "fluencyScore", labelCn: "流利度", labelEn: "Fluency" },
  { field: "vocabularyScore", labelCn: "词汇", labelEn: "Vocabulary" },
  { field: "grammarScore", labelCn: "语法", labelEn: "Grammar" },
  { field: "pronunciationScore", labelCn: "发音", labelEn: "Pronunciation" },
];

const REPORT_SECTION_LABELS = {
  vocabulary: { cn: "词汇", en: "Vocabulary" },
  grammar: { cn: "语法", en: "Grammar" },
  reading: { cn: "阅读", en: "Reading" },
  listening: { cn: "听力", en: "Listening" },
  writing: { cn: "写作", en: "Writing" },
  speaking: { cn: "口语", en: "Speaking" },
  other: { cn: "综合能力", en: "Overall Skills" },
} as const;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function formatDate(value: string | Date, locale: ReviewLocale) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return locale === "cn" ? "未知时间" : "Unknown";
  return date.toLocaleString(locale === "cn" ? "zh-CN" : "en-SG", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatusStyle(detail: QuestionReviewDetail) {
  if (!detail.isAnswered) {
    return {
      label: "NOT ANSWERED",
      labelCn: "未作答",
      className: "border-slate-200 bg-slate-100 text-slate-500",
    };
  }
  if (detail.isCorrect) {
    return {
      label: "CORRECT",
      labelCn: "正确",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }
  return {
    label: "WRONG",
    labelCn: "错误",
    className: "border-rose-200 bg-rose-50 text-rose-700",
  };
}

function localizeStoredText(value: string, locale: ReviewLocale) {
  const localizedMap: Record<string, { cn: string; en: string }> = {
    "Not Answered": { cn: "未作答", en: "Not Answered" },
    "Audio response submitted": { cn: "已提交录音作答", en: "Audio response submitted" },
    "Teacher review required": { cn: "等待老师评分", en: "Awaiting teacher review" },
    "AI reference answer unavailable": { cn: "AI 参考答案暂不可用", en: "AI reference answer unavailable" },
    "Manual Review": { cn: "老师评分", en: "Teacher Review" },
  };

  const matched = localizedMap[value];
  return matched ? (locale === "cn" ? matched.cn : matched.en) : value;
}

function cleanReportNarrativeText(value: string, locale: ReviewLocale) {
  let normalized = value.replace(/\s{2,}/g, " ").trim();

  if (locale === "cn") {
    normalized = normalized
      .replace(/\s*([，。！？；：])/g, "$1")
      .replace(/([（【“‘])\s+/g, "$1")
      .replace(/\s+([）】”’])/g, "$1")
      .replace(/[。！？]+(?=[；：，])/g, "")
      .replace(/([；：，])[；：，]+/g, "$1")
      .replace(/([。])[。]+/g, "$1")
      .replace(/([！])[！]+/g, "$1")
      .replace(/([？])[？]+/g, "$1")
      .replace(/([；：，])([。！？])/g, "$2");
  }

  return normalized;
}

function summarizeManualSpeakingFeedback(
  locale: ReviewLocale,
  evaluations: SpeakingEvaluationItem[],
) {
  if (evaluations.length === 0) {
    return locale === "cn"
      ? "暂时还没有口语评分内容。"
      : "No speaking review is available yet.";
  }

  return locale === "cn"
    ? "老师已根据任务完成、流利度、词汇、语法和发音完成口语评分。"
    : "Teacher speaking review has been completed using task completion, fluency, vocabulary, grammar, and pronunciation.";
}

function formatScoreDisplay(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "--";
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
}

function normalizeManualSpeakingCriterionValue(rawValue: string | number) {
  const parsed = typeof rawValue === "number" ? rawValue : Number(rawValue);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(DEFAULT_MANUAL_SPEAKING_MAX_SCORE, Math.round(parsed * 10) / 10));
}

function normalizeSectionInsightSummary(
  summary: string | undefined,
  section: AssessmentReviewModel["sections"][number],
  locale: ReviewLocale,
) {
  if (!summary || section.manualReview) return summary;

  const label = REPORT_SECTION_LABELS[section.kind]?.[locale] || REPORT_SECTION_LABELS.other[locale];
  const scorePrefix = locale === "cn"
    ? `${label}部分本次得分为 ${section.correct}/${section.total}。`
    : `${label} scored ${section.correct}/${section.total}. `;

  if (locale === "cn") {
    const pattern = /^[^。]*部分本次得分为\s*\d+\/\d+(?:\s*\(\d+%\))?。\s*/;
    const nextSummary = pattern.test(summary) ? `${scorePrefix}${summary.replace(pattern, "")}` : summary;
    return cleanReportNarrativeText(nextSummary, locale);
  }

  const pattern = /^[^.]* scored \d+\/\d+(?: \(\d+%\))?\.\s*/i;
  const nextSummary = pattern.test(summary) ? `${scorePrefix}${summary.replace(pattern, "")}` : summary;
  return cleanReportNarrativeText(nextSummary, locale);
}

function getReviewProblemDetails(details: QuestionReviewDetail[]) {
  return details.filter((detail) => !detail.isAnswered || !detail.isCorrect);
}

function getSummarySkillLabel(
  section: Pick<AssessmentReviewModel["sections"][number], "kind">,
  locale: ReviewLocale,
) {
  return REPORT_SECTION_LABELS[section.kind]?.[locale] || REPORT_SECTION_LABELS.other[locale];
}

function normalizeSummaryReportText(
  value: string | undefined,
  sections: AssessmentReviewModel["sections"],
  locale: ReviewLocale,
) {
  if (!value) return value;

  let normalized = value;
  const replacements = Array.from(
    new Map(
      sections.flatMap((section) => {
        const label = getSummarySkillLabel(section, locale);
        return [
          [section.sectionTitle.trim(), label],
          [getSectionDisplayName(section.sectionTitle, section.sectionId, locale).trim(), label],
        ];
      }),
    ).entries(),
  )
    .filter(([from]) => from)
    .sort((a, b) => b[0].length - a[0].length);

  replacements.forEach(([from, to]) => {
    normalized = normalized.replace(new RegExp(escapeRegExp(from), "g"), to);
  });

  const skillPatterns = (Object.entries(REPORT_SECTION_LABELS) as Array<
    [keyof typeof REPORT_SECTION_LABELS, (typeof REPORT_SECTION_LABELS)[keyof typeof REPORT_SECTION_LABELS]]
  >)
    .filter(([key]) => key !== "other")
    .flatMap(([, labels]) => [
      {
        regex: new RegExp(`Part\\s*\\d+\\s*(?:[·.:：-]\\s*|\\s+)${escapeRegExp(labels.en)}`, "gi"),
        replacement: locale === "cn" ? labels.cn : labels.en,
      },
      {
        regex: new RegExp(`Part\\s*\\d+\\s*(?:[·.:：-]\\s*|\\s+)${escapeRegExp(labels.cn)}`, "g"),
        replacement: locale === "cn" ? labels.cn : labels.en,
      },
    ]);

  skillPatterns.forEach(({ regex, replacement }) => {
    normalized = normalized.replace(regex, replacement);
  });

  return cleanReportNarrativeText(normalized, locale);
}

function alignSectionInsightByOccurrence(
  sections: AssessmentReviewModel["sections"],
  insights: NonNullable<AssessmentReviewModel["report"]>["sectionInsights"] | undefined,
) {
  const grouped = new Map<string, NonNullable<AssessmentReviewModel["report"]>["sectionInsights"]>();
  (insights || []).forEach((item) => {
    const current = grouped.get(item.sectionId) || [];
    current.push(item);
    grouped.set(item.sectionId, current);
  });

  const occurrences = new Map<string, number>();
  return sections.map((section) => {
    const sectionId = section.sectionId;
    const currentOccurrence = occurrences.get(sectionId) ?? 0;
    occurrences.set(sectionId, currentOccurrence + 1);
    const matches = grouped.get(sectionId) || [];
    return matches[currentOccurrence] || matches[0] || null;
  });
}

function renderDetailList(
  titleCn: string,
  titleEn: string,
  items: string[] | undefined,
  locale: ReviewLocale,
  variant: "blue" | "emerald" | "amber" | "indigo" | "rose",
) {
  if (!items || items.length === 0) return null;

  const palette = {
    blue: {
      title: "text-blue-700",
      dot: "bg-blue-500",
      badge: "bg-blue-100 text-blue-700",
    },
    emerald: {
      title: "text-emerald-700",
      dot: "bg-emerald-500",
      badge: "bg-emerald-100 text-emerald-700",
    },
    amber: {
      title: "text-amber-700",
      dot: "bg-amber-500",
      badge: "bg-amber-100 text-amber-700",
    },
    indigo: {
      title: "text-indigo-700",
      dot: "bg-indigo-500",
      badge: "bg-indigo-100 text-indigo-700",
    },
    rose: {
      title: "text-rose-700",
      dot: "bg-rose-500",
      badge: "bg-rose-100 text-rose-700",
    },
  }[variant];

  return (
    <div className="report-list-card rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <span className={`h-2.5 w-2.5 rounded-full ${palette.dot}`} />
        <h3 className={`text-base font-semibold ${palette.title}`}>
          {locale === "cn" ? titleCn : titleEn}
        </h3>
      </div>
      <div className="mt-4 space-y-3">
        {items.map((item, index) => (
          <div
            key={`${titleEn}-${index}`}
            className="report-list-item grid grid-cols-[38px_minmax(0,1fr)] items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4 text-sm leading-6 text-slate-700"
          >
            <span className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold ${palette.badge}`}>
              {String(index + 1).padStart(2, "0")}
            </span>
            <p>{item}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailMaterialSection(props: {
  titleCn: string;
  titleEn: string;
  locale: ReviewLocale;
  tone?: "slate" | "blue" | "violet";
  children: ReactNode;
}) {
  const toneClasses = {
    slate: "bg-slate-50 text-slate-700",
    blue: "bg-blue-50 text-blue-950",
    violet: "bg-violet-50 text-violet-950",
  }[props.tone || "slate"];

  return (
    <div className={`report-material-card rounded-2xl px-4 py-4 ${toneClasses}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
        {props.locale === "cn" ? props.titleCn : props.titleEn}
      </p>
      <div className="mt-2 text-sm leading-7">{props.children}</div>
    </div>
  );
}

function ReviewImageCard(props: { src: string; alt: string }) {
  return (
    <div className="report-image-card overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm">
      <img src={props.src} alt={props.alt} className="h-full max-h-72 w-full object-contain bg-white" loading="lazy" />
    </div>
  );
}

function QuestionMaterialBlock({ detail, locale }: { detail: QuestionReviewDetail; locale: ReviewLocale }) {
  const question = detail.sourceQuestion;
  const isCn = locale === "cn";
  const fallbackQuestionImageUrl = "imageUrl" in question && typeof question.imageUrl === "string"
    ? question.imageUrl
    : undefined;
  const imageUrls = Array.from(
    new Set(
      [detail.questionImageUrl, fallbackQuestionImageUrl, detail.sceneImageUrl, detail.sectionImageUrl]
        .filter((value): value is string => Boolean(value && value.trim())),
    ),
  );
  const choiceImageOptions = (() => {
    const detailOptions = (detail.options || [])
      .filter((option) => Boolean(option.imageUrl && option.imageUrl.trim()))
      .map((option) => ({
        label: option.label,
        text: option.text,
        imageUrl: option.imageUrl as string,
      }));

    if (detailOptions.length > 0) {
      return detailOptions;
    }

    if (question.type === "picture-mcq" || question.type === "listening-mcq") {
      return question.options
        .filter((option) => Boolean(option.imageUrl && option.imageUrl.trim()))
        .map((option, index) => ({
          label: option.label || String.fromCharCode(65 + index),
          text: option.text || "",
          imageUrl: option.imageUrl,
        }));
    }

    return [];
  })();

  const prompt = (() => {
    switch (question.type) {
      case "picture-mcq":
      case "listening-mcq":
      case "mcq":
      case "fill-blank":
      case "wordbank-fill":
      case "story-fill":
      case "picture-spelling":
      case "word-completion":
      case "checkbox":
        return detail.questionText;
      case "open-ended":
        return detail.questionType === "open-ended-sub" ? question.question : detail.questionText;
      case "true-false":
      case "table":
      case "reference":
      case "order":
      case "phrase":
      case "sentence-reorder":
      case "inline-word-choice":
      case "passage-inline-word-choice":
        return question.question || detail.questionText;
      default:
        return detail.questionText;
    }
  })();

  return (
    <div className="mt-4 space-y-4">
      {detail.taskDescription ? (
        <DetailMaterialSection titleCn="任务要求" titleEn="Task" locale={locale} tone="violet">
          <p className="whitespace-pre-wrap">{detail.taskDescription}</p>
        </DetailMaterialSection>
      ) : null}

      {detail.sectionPassage || detail.sectionGrammarPassage ? (
        <DetailMaterialSection titleCn="篇章材料" titleEn="Shared Material" locale={locale} tone="blue">
          <div className="space-y-3">
            {detail.sectionPassage ? <p className="whitespace-pre-wrap">{detail.sectionPassage}</p> : null}
            {detail.sectionGrammarPassage && detail.sectionGrammarPassage !== detail.sectionPassage ? (
              <p className="whitespace-pre-wrap">{detail.sectionGrammarPassage}</p>
            ) : null}
          </div>
        </DetailMaterialSection>
      ) : null}

      {detail.matchingDescriptions?.length ? (
        <DetailMaterialSection titleCn="配对材料" titleEn="Matching Descriptions" locale={locale}>
          <div className="grid gap-3 md:grid-cols-2">
            {detail.matchingDescriptions.map((item) => (
              <div
                key={`${detail.id}-matching-${item.label}`}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3"
              >
                <p className="text-sm font-semibold text-slate-900">
                  {item.label}. {item.name}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{item.text}</p>
              </div>
            ))}
          </div>
        </DetailMaterialSection>
      ) : null}

      {imageUrls.length ? (
        <DetailMaterialSection titleCn="题目图片" titleEn="Question Images" locale={locale}>
          <div className="grid gap-3 md:grid-cols-2">
            {imageUrls.map((src, index) => (
              <ReviewImageCard key={`${detail.id}-image-${index}`} src={src} alt={`${detail.questionNum} image ${index + 1}`} />
            ))}
          </div>
        </DetailMaterialSection>
      ) : null}

      {choiceImageOptions.length ? (
        <DetailMaterialSection titleCn="选项图片" titleEn="Choice Images" locale={locale}>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {choiceImageOptions.map((option) => (
              <div key={`${detail.id}-choice-image-${option.label}`} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                  <p className="text-sm font-semibold text-slate-900">
                    {option.label}. {option.text || (isCn ? "图片选项" : "Image option")}
                  </p>
                </div>
                <div className="bg-slate-50 p-3">
                  <img
                    src={option.imageUrl}
                    alt={`${detail.questionNum} option ${option.label}`}
                    className="h-44 w-full rounded-xl bg-white object-contain"
                    loading="lazy"
                  />
                </div>
              </div>
            ))}
          </div>
        </DetailMaterialSection>
      ) : null}

      <DetailMaterialSection titleCn="完整题面" titleEn="Full Question" locale={locale}>
        <div className="space-y-3">
          <p className="whitespace-pre-wrap text-slate-800">{prompt || detail.questionText}</p>

          {detail.sectionDescription && detail.sectionDescription !== detail.taskDescription ? (
            <p className="whitespace-pre-wrap text-slate-500">{detail.sectionDescription}</p>
          ) : null}

          {question.type === "true-false" ? (
            <div className="space-y-2">
              {question.statements.map((statement) => {
                const isFocused = detail.focusItemKey === statement.label;
                return (
                  <div
                    key={`${detail.id}-statement-${statement.label}`}
                    className={`rounded-2xl border px-4 py-3 ${
                      isFocused ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-white"
                    }`}
                  >
                    <p className="text-sm font-semibold text-slate-900">
                      {statement.label}. {statement.statement}
                    </p>
                    <p className="mt-2 text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                      {isCn ? "标准判断" : "Expected"}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">{statement.correctChoice || (statement.isTrue ? "True" : "False")}</p>
                  </div>
                );
              })}
            </div>
          ) : null}

          {question.type === "table" ? (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="grid grid-cols-[1.1fr_1fr_1fr] gap-px bg-slate-200 text-sm">
                <div className="bg-slate-50 px-3 py-2 font-semibold text-slate-700">{isCn ? "情境" : "Situation"}</div>
                <div className="bg-slate-50 px-3 py-2 font-semibold text-slate-700">{isCn ? "想法" : "Thought"}</div>
                <div className="bg-slate-50 px-3 py-2 font-semibold text-slate-700">{isCn ? "行动" : "Action"}</div>
                {question.rows.map((row, index) => {
                  const isFocused = detail.focusItemKey === String(index);
                  return (
                    <Fragment key={`${detail.id}-table-row-${index}`}>
                      <div key={`${detail.id}-table-s-${index}`} className={`px-3 py-3 ${isFocused ? "bg-blue-50" : "bg-white"}`}>{row.situation}</div>
                      <div key={`${detail.id}-table-t-${index}`} className={`px-3 py-3 ${isFocused ? "bg-blue-50" : "bg-white"}`}>{row.thought}</div>
                      <div key={`${detail.id}-table-a-${index}`} className={`px-3 py-3 ${isFocused ? "bg-blue-50" : "bg-white"}`}>{row.action}</div>
                    </Fragment>
                  );
                })}
              </div>
            </div>
          ) : null}

          {question.type === "reference" ? (
            <div className="space-y-2">
              {question.items.map((item, index) => {
                const isFocused = detail.focusItemKey === String(index);
                return (
                  <div
                    key={`${detail.id}-reference-${index}`}
                    className={`rounded-2xl border px-4 py-3 ${
                      isFocused ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-white"
                    }`}
                  >
                    <p className="text-sm font-semibold text-slate-900">{item.word}</p>
                    <p className="mt-1 text-sm text-slate-500">{item.lineRef}</p>
                  </div>
                );
              })}
            </div>
          ) : null}

          {question.type === "order" ? (
            <div className="space-y-2">
              {question.events.map((event, index) => {
                const isFocused = detail.focusItemKey === String(index);
                return (
                  <div
                    key={`${detail.id}-event-${index}`}
                    className={`rounded-2xl border px-4 py-3 ${
                      isFocused ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-white"
                    }`}
                  >
                    <p className="text-sm font-semibold text-slate-900">{event}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {isCn ? "正确顺序" : "Correct position"}: {question.correctOrder[index]}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : null}

          {question.type === "phrase" ? (
            <div className="space-y-2">
              {question.items.map((item, index) => {
                const isFocused = detail.focusItemKey === String(index);
                return (
                  <div
                    key={`${detail.id}-phrase-${index}`}
                    className={`rounded-2xl border px-4 py-3 ${
                      isFocused ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-white"
                    }`}
                  >
                    <p className="text-sm font-semibold text-slate-900">{item.clue}</p>
                  </div>
                );
              })}
            </div>
          ) : null}

          {question.type === "sentence-reorder" ? (
            <div className="space-y-2">
              {question.items.map((item) => {
                const isFocused = detail.focusItemKey === item.label;
                return (
                  <div
                    key={`${detail.id}-reorder-${item.label}`}
                    className={`rounded-2xl border px-4 py-3 ${
                      isFocused ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-white"
                    }`}
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{item.label}</p>
                    <p className="mt-2 text-sm text-slate-700">{item.scrambledWords}</p>
                  </div>
                );
              })}
            </div>
          ) : null}

          {question.type === "inline-word-choice" ? (
            <div className="space-y-2">
              {question.items.map((item) => {
                const isFocused = detail.focusItemKey === item.label;
                return (
                  <div
                    key={`${detail.id}-inline-${item.label}`}
                    className={`rounded-2xl border px-4 py-3 ${
                      isFocused ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-white"
                    }`}
                  >
                    <p className="text-sm text-slate-700">{item.sentenceText || `${item.beforeText} ___ ${item.afterText}`.trim()}</p>
                    <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                      {isCn ? "选项" : "Options"}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">{item.options.join(" / ")}</p>
                  </div>
                );
              })}
            </div>
          ) : null}

          {question.type === "passage-inline-word-choice" ? (
            <div className="space-y-2">
              {question.items.map((item) => {
                const isFocused = detail.focusItemKey === item.label;
                return (
                  <div
                    key={`${detail.id}-passage-inline-${item.label}`}
                    className={`rounded-2xl border px-4 py-3 ${
                      isFocused ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-white"
                    }`}
                  >
                    <p className="text-sm font-semibold text-slate-900">{isCn ? "空格" : "Blank"} {item.label}</p>
                    <p className="mt-2 text-sm text-slate-500">{item.options.join(" / ")}</p>
                  </div>
                );
              })}
            </div>
          ) : null}

          {question.type === "open-ended" && question.subQuestions?.length ? (
            <div className="space-y-2">
              {question.subQuestions.map((subQuestion) => {
                const isFocused = detail.focusItemKey === subQuestion.label;
                return (
                  <div
                    key={`${detail.id}-subquestion-${subQuestion.label}`}
                    className={`rounded-2xl border px-4 py-3 ${
                      isFocused ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-white"
                    }`}
                  >
                    <p className="text-sm font-semibold text-slate-900">
                      {subQuestion.label}. {subQuestion.question}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : null}

          {detail.wordBank?.length ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                {isCn ? "词库" : "Word Bank"}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {detail.wordBank.map((entry) => (
                  <span key={`${detail.id}-wordbank-${entry.letter}`} className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">
                    {entry.letter}. {entry.word}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </DetailMaterialSection>
    </div>
  );
}

function StepHeading(props: {
  step: string;
  title: string;
  description: string;
  icon: ReactNode;
  iconClassName: string;
}) {
  return (
    <div className="report-section-heading flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-center gap-3 text-slate-900">
        <div className={`rounded-2xl p-3 ${props.iconClassName}`}>
          {props.icon}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{props.step}</p>
          <h2 className="report-step-title text-xl font-bold">{props.title}</h2>
        </div>
      </div>
      {props.description.trim() ? (
        <p className="report-step-description max-w-2xl text-sm leading-6 text-slate-500">
          {props.description}
        </p>
      ) : null}
    </div>
  );
}

function getDisplayStudentName(name: string | null | undefined, locale: ReviewLocale) {
  const trimmed = name?.trim();
  if (trimmed) return trimmed;
  return locale === "cn" ? "未命名学生" : "Unnamed Student";
}

function getGradeDescriptor(grade: string, locale: ReviewLocale) {
  if (locale === "cn") {
    if (grade === "A") return "表现非常稳定";
    if (grade === "B") return "整体基础不错";
    if (grade === "C") return "已有基础，需继续巩固";
    return "当前需要重点重建";
  }

  if (grade === "A") return "Very strong and stable";
  if (grade === "B") return "Solid overall foundation";
  if (grade === "C") return "Promising, needs consolidation";
  return "Needs focused rebuilding";
}

export default function AssessmentReportPanel({
  record,
  extraHeaderActions,
  showDownload = true,
  initialLocale = "cn",
  hideLocaleToggle = false,
  printMode = false,
  allowSpeakingManualScoring = false,
}: AssessmentReportPanelProps) {
  const [locale, setLocale] = useState<ReviewLocale>(initialLocale);
  const [downloading, setDownloading] = useState(false);
  const [localRecord, setLocalRecord] = useState<AssessmentReviewRecord | null>(null);
  const [isEditingSpeaking, setIsEditingSpeaking] = useState(false);
  const [savingSpeaking, setSavingSpeaking] = useState(false);
  const activeRecord = localRecord ?? record;
  const utils = trpc.useUtils();
  const updateResultMutation = trpc.results.updateAI.useMutation();
  const generateReportMutation = trpc.grading.generateReport.useMutation();
  const model = useMemo(() => buildAssessmentReviewModel(activeRecord), [activeRecord]);
  const orderedSections = model.sections;
  const report = model.report;
  const alignedSectionInsights = useMemo(
    () => alignSectionInsightByOccurrence(orderedSections, report?.sectionInsights),
    [orderedSections, report?.sectionInsights],
  );
  const isCn = locale === "cn";
  const normalizeSummaryText = (value: string | undefined) =>
    normalizeSummaryReportText(value, orderedSections, locale);
  const strengthItems = (locale === "cn" ? report?.strengths_cn : report?.strengths_en)
    ?.map((item) => normalizeSummaryText(item) || item);
  const weaknessItems = (locale === "cn" ? report?.weaknesses_cn : report?.weaknesses_en)
    ?.map((item) => normalizeSummaryText(item) || item);
  const recommendationItems = (locale === "cn" ? report?.recommendations_cn : report?.recommendations_en)
    ?.map((item) => normalizeSummaryText(item) || item);
  const abilityItems = (locale === "cn" ? report?.abilitySnapshot_cn : report?.abilitySnapshot_en)
    ?.map((item) => normalizeSummaryText(item) || item);
  const displayStudentName = getDisplayStudentName(activeRecord.studentName, locale);
  const gradeDescriptor = getGradeDescriptor(model.grade, locale);
  const headerCardClassName = "report-summary-card rounded-[24px] border border-[#1E3A5F]/12 bg-white/78 p-4 shadow-[0_18px_40px_rgba(30,58,95,0.08),inset_0_1px_0_rgba(255,255,255,0.72)] backdrop-blur-sm";
  const headerLabelClassName = "text-[10px] font-semibold uppercase tracking-[0.2em] text-[#1E3A5F]/72";
  const hasWritingSubmission = Boolean(model.writing?.essay.trim());
  const visibleWritingEvaluation = hasWritingSubmission ? model.writing?.evaluation || null : null;

  const speakingSeed = useMemo(() => {
    if (model.speaking.evaluation) {
      return JSON.parse(JSON.stringify(model.speaking.evaluation)) as SpeakingEvaluationResult;
    }

    if (!model.paper) return null;
    const artifacts = buildSubmissionArtifacts(model.paper, model.answers);
    if (artifacts.speakingResponses.length === 0) return null;
    return createPendingSpeakingEvaluation(artifacts.speakingResponses);
  }, [model.answers, model.paper, model.speaking.evaluation]);
  const speakingEvaluationsBySection = useMemo(() => {
    const grouped = new Map<string, SpeakingEvaluationItem[]>();
    (model.speaking.evaluation?.evaluations || speakingSeed?.evaluations || []).forEach((item) => {
      const current = grouped.get(item.sectionId) || [];
      current.push(item as SpeakingEvaluationItem);
      grouped.set(item.sectionId, current);
    });
    return grouped;
  }, [model.speaking.evaluation, speakingSeed]);

  const hasOrderedReviewSections = orderedSections.some((section) => {
    const hasWriting = section.kind === "writing" && model.writing?.sectionId === section.sectionId;
    const hasSpeaking = section.kind === "speaking" && (speakingEvaluationsBySection.get(section.sectionId) || []).length > 0;
    return hasWriting || hasSpeaking || getReviewProblemDetails(section.details).length > 0;
  });
  const hasHeaderControls = !hideLocaleToggle || showDownload || Boolean(extraHeaderActions);
  const [speakingDraft, setSpeakingDraft] = useState<SpeakingEvaluationResult | null>(speakingSeed);
  const canManuallyScoreSpeaking =
    allowSpeakingManualScoring
    && !printMode
    && Boolean(activeRecord.id)
    && Boolean(speakingDraft?.evaluations.length);

  useEffect(() => {
    setLocale(initialLocale);
  }, [initialLocale]);

  useEffect(() => {
    setLocalRecord(null);
    setIsEditingSpeaking(false);
  }, [record]);

  useEffect(() => {
    setSpeakingDraft(speakingSeed);
  }, [speakingSeed]);

  const handleDownload = async () => {
    try {
      setDownloading(true);
      await generateReportPDF(activeRecord, locale);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "PDF download failed.");
    } finally {
      setDownloading(false);
    }
  };

  const updateSpeakingOverallFeedback = (value: string) => {
    setSpeakingDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        overallFeedback_cn: value,
      };
    });
  };

  const updateSpeakingItemField = (
    sectionId: string,
    questionId: number,
    field: ManualSpeakingCriterionField,
    value: string,
  ) => {
    setSpeakingDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        evaluations: current.evaluations.map((item) => {
          if (item.sectionId !== sectionId || item.questionId !== questionId) return item;

          return {
            ...item,
            [field]: normalizeManualSpeakingCriterionValue(value),
          };
        }),
      };
    });
  };

  const handleCancelSpeakingEdit = () => {
    setSpeakingDraft(
      speakingSeed ? JSON.parse(JSON.stringify(speakingSeed)) as SpeakingEvaluationResult : null,
    );
    setIsEditingSpeaking(false);
  };

  const handleSaveSpeakingReview = async () => {
    if (!activeRecord.id || !speakingDraft) return;

    const normalizedEvaluations = speakingDraft.evaluations.map((item) => {
      const normalizedCriteria = Object.fromEntries(
        MANUAL_SPEAKING_CRITERIA.map((criterion) => [
          criterion.field,
          normalizeManualSpeakingCriterionValue(item[criterion.field] ?? 0),
        ]),
      ) as Record<ManualSpeakingCriterionField, number>;

      return {
        ...item,
        ...normalizedCriteria,
        score: Number.isFinite(item.score) ? item.score : 0,
        transcript: "",
        feedback_cn: "",
        feedback_en: "",
        taskCompletion_cn: "",
        taskCompletion_en: "",
        fluency_cn: "",
        fluency_en: "",
        vocabulary_cn: "",
        vocabulary_en: "",
        grammar_cn: "",
        grammar_en: "",
        pronunciation_cn: "",
        pronunciation_en: "",
        suggestions_cn: [],
        suggestions_en: [],
      };
    });

    const nextSpeaking = finalizeManualSpeakingEvaluation({
      evaluations: normalizedEvaluations,
      overallFeedback_cn: speakingDraft.overallFeedback_cn,
      overallFeedback_en:
        speakingDraft.overallFeedback_en
        || speakingDraft.overallFeedback_cn
        || "Teacher speaking review has been saved.",
    });

    const sectionResults = orderedSections.map((section) => {
      if (section.kind === "speaking") {
        const matches = nextSpeaking.evaluations.filter((item) => item.sectionId === section.sectionId);
        return {
          sectionId: section.sectionId,
          sectionTitle: section.sectionTitle,
          correct: matches.reduce((sum, item) => sum + item.score, 0),
          total: matches.reduce((sum, item) => sum + item.maxScore, 0),
          timeSeconds: section.timeSeconds,
        };
      }

      return {
        sectionId: section.sectionId,
        sectionTitle: section.sectionTitle,
        correct: section.correct,
        total: section.total,
        timeSeconds: section.timeSeconds,
      };
    });

    const totalScore = sectionResults.reduce((sum, section) => sum + section.correct, 0);
    const totalPossible = sectionResults.reduce((sum, section) => sum + section.total, 0);
    const percentage = totalPossible > 0 ? Math.round((totalScore / totalPossible) * 100) : 0;

    try {
      setSavingSpeaking(true);

      const nextReport = await generateReportMutation.mutateAsync({
        paperTitle: activeRecord.paperTitle,
        studentName: activeRecord.studentName,
        studentGrade: activeRecord.studentGrade || undefined,
        totalScore,
        totalPossible,
        percentage,
        grade: getLetterGrade(totalScore, totalPossible),
        totalTimeSeconds: model.totalTimeSeconds,
        sectionResults,
        writingSummary: visibleWritingEvaluation
          ? {
              score: visibleWritingEvaluation.score,
              maxScore: visibleWritingEvaluation.maxScore,
              grade: visibleWritingEvaluation.grade,
              overallFeedback_en: visibleWritingEvaluation.overallFeedback_en,
              overallFeedback_cn: visibleWritingEvaluation.overallFeedback_cn,
              suggestions_en: visibleWritingEvaluation.suggestions_en,
              suggestions_cn: visibleWritingEvaluation.suggestions_cn,
              manualReviewRequired: visibleWritingEvaluation.manualReviewRequired,
            }
          : undefined,
        speakingSummary: nextSpeaking,
      });

      const sanitizedReport = sanitizeReportForStorage(nextReport);
      const nextRecord: AssessmentReviewRecord = {
        ...activeRecord,
        reportJson: JSON.stringify(sanitizedReport),
      };

      await updateResultMutation.mutateAsync({
        id: activeRecord.id,
        reportJson: nextRecord.reportJson || undefined,
      });

      setLocalRecord(nextRecord);
      setSpeakingDraft(JSON.parse(JSON.stringify(nextSpeaking)) as SpeakingEvaluationResult);
      setIsEditingSpeaking(false);
      toast.success(isCn ? "口语评分已保存。" : "Speaking review saved.");

      await Promise.all([
        utils.results.list.invalidate(),
        utils.results.getById.invalidate({ id: activeRecord.id }),
      ]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save speaking review.");
    } finally {
      setSavingSpeaking(false);
    }
  };

  return (
    <div className={`space-y-6 ${printMode ? "print-assessment-report" : ""}`}>
      <section className="report-shell-card overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
        <div className="report-hero relative overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(30,58,95,0.16),_transparent_28%),radial-gradient(circle_at_88%_16%,_rgba(59,130,246,0.12),_transparent_24%),linear-gradient(135deg,#f8fbff_0%,#edf4fb_48%,#dbe8f6_100%)] px-5 py-6 text-slate-900 sm:px-7 sm:py-7">
          <div className="pointer-events-none absolute inset-0 opacity-50">
            <div className="absolute -left-10 top-6 h-44 w-44 rounded-full bg-[#1E3A5F]/18 blur-3xl" />
            <div className="absolute right-6 top-0 h-52 w-52 rounded-full bg-blue-300/22 blur-3xl" />
            <div className="absolute bottom-0 left-1/3 h-40 w-40 rounded-full bg-sky-200/28 blur-3xl" />
            <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-white/35 to-transparent" />
            <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent" />
          </div>

          <div className="relative flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#1E3A5F]">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#1E3A5F]/18 bg-white/72 px-3 py-1 shadow-sm">
                  <Sparkle className="h-3 w-3 text-[#1E3A5F]" />
                  {isCn ? "测评反馈报告" : "Assessment Report"}
                </span>
                <span className="rounded-full border border-[#1E3A5F]/16 bg-white/65 px-3 py-1 font-[family-name:var(--font-sans)] text-[10px] font-bold tracking-tight text-slate-700">
                  {activeRecord.paperTitle}
                </span>
              </div>

              <div className="min-w-0 max-w-3xl">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#1E3A5F]/72">
                  {isCn ? "学生档案" : "Student Profile"}
                </p>
                <h1 className="report-hero-name mt-2 text-[24px] font-semibold tracking-[-0.04em] text-slate-900 sm:text-[30px]">
                  {displayStudentName}
                </h1>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px] text-slate-600">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[#1E3A5F]/14 bg-white/70 px-3 py-1.5 shadow-sm">
                    <GraduationCap className="h-3.5 w-3.5 text-[#1E3A5F]" />
                    {activeRecord.studentGrade
                      ? (isCn ? `年级 ${activeRecord.studentGrade}` : `Grade ${activeRecord.studentGrade}`)
                      : (isCn ? "未填写年级" : "Grade not provided")}
                  </span>
                  <span className="rounded-full border border-[#1E3A5F]/14 bg-white/70 px-3 py-1.5 shadow-sm">
                    {formatDate(activeRecord.createdAt, locale)}
                  </span>
                </div>
              </div>
            </div>

            {hasHeaderControls ? (
              <div className="flex w-full flex-wrap items-center justify-end gap-1.5 xl:w-auto">
                {!hideLocaleToggle ? (
                  <div className="inline-flex rounded-full border border-[#1E3A5F]/14 bg-white/75 p-1 shadow-sm">
                    <button
                      type="button"
                      onClick={() => setLocale("cn")}
                      className={`rounded-full px-3 py-1.5 text-[13px] font-medium transition ${
                        isCn ? "bg-[#1E3A5F] text-white shadow-sm" : "text-slate-600 hover:text-[#1E3A5F]"
                      }`}
                    >
                      中文
                    </button>
                    <button
                      type="button"
                      onClick={() => setLocale("en")}
                      className={`rounded-full px-3 py-1.5 text-[13px] font-medium transition ${
                        !isCn ? "bg-[#1E3A5F] text-white shadow-sm" : "text-slate-600 hover:text-[#1E3A5F]"
                      }`}
                    >
                      English
                    </button>
                  </div>
                ) : null}
                {showDownload ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleDownload}
                    disabled={downloading}
                    className="h-10 gap-1.5 rounded-full border-[#1E3A5F]/14 bg-white/75 px-4 text-[13px] text-[#1E3A5F] hover:bg-white"
                  >
                    <Download className="h-3.5 w-3.5" />
                    {downloading ? (isCn ? "生成中..." : "Generating...") : (isCn ? "下载 PDF" : "Download PDF")}
                  </Button>
                ) : null}
                {extraHeaderActions}
              </div>
            ) : null}
          </div>

          <div className="relative mt-6 grid gap-3 xl:grid-cols-4">
            <div className={headerCardClassName}>
              <p className={headerLabelClassName}>
                {isCn ? "学生档案" : "Student Profile"}
              </p>
              <div className="mt-3 min-w-0">
                <p className="report-profile-name truncate text-base font-semibold text-slate-900">{displayStudentName}</p>
                <p className="mt-1 text-[13px] text-slate-600">
                  {activeRecord.studentGrade
                    ? (isCn ? `年级 ${activeRecord.studentGrade}` : `Grade ${activeRecord.studentGrade}`)
                    : (isCn ? "未填写年级" : "Grade not provided")}
                </p>
              </div>
              <p className="mt-3 text-[13px] text-slate-600">{formatDate(activeRecord.createdAt, locale)}</p>
            </div>

            <div className={headerCardClassName}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className={headerLabelClassName}>
                  {isCn ? "当前结论" : "Current Signal"}
                </p>
              </div>
              <div className="mt-3 flex items-end gap-2.5">
                <span className="report-summary-grade text-[44px] font-semibold leading-none tracking-[-0.03em] text-slate-900">{model.grade}</span>
                <span className="mb-1 text-[13px] font-medium text-slate-500">
                  {isCn ? "综合表现" : "Overall"}
                </span>
              </div>
              <p className="mt-3 text-[13px] leading-6 text-slate-700">
                {gradeDescriptor}
              </p>
            </div>

            <div className={headerCardClassName}>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <p className={headerLabelClassName}>
                  {isCn ? "综合得分" : "Total Score"}
                </p>
                <span className="rounded-full border border-[#1E3A5F]/14 bg-[#1E3A5F]/6 px-2.5 py-0.5 text-[11px] font-semibold text-[#1E3A5F]">
                  {model.percentage}%
                </span>
              </div>
              <p className="report-summary-score mt-3 text-[34px] font-semibold leading-none tracking-[-0.04em] text-slate-900">
                {model.totalScore}
                <span className="text-lg font-medium text-slate-500">/{model.totalPossible}</span>
              </p>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#1E3A5F]/8">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#1E3A5F_0%,#2A4A6F_55%,#6E93BB_100%)]"
                  style={{ width: `${Math.max(6, Math.min(model.percentage, 100))}%` }}
                />
              </div>
              <p className="mt-2 text-[13px] text-slate-600">
                {isCn ? "自动评分部分的当前完成情况" : "Current completion across auto-scored parts"}
              </p>
            </div>

            <div className={headerCardClassName}>
              <p className={headerLabelClassName}>
                {isCn ? "总用时" : "Total Time"}
              </p>
              <p className="report-summary-time mt-3 flex items-center gap-2.5 text-[26px] font-semibold leading-none tracking-[-0.03em] text-slate-900">
                <Clock3 className="h-6 w-6 text-[#1E3A5F]" />
                {formatDuration(model.totalTimeSeconds, locale)}
              </p>
              <p className="mt-3 text-[13px] leading-6 text-slate-600">
                {isCn ? "整张测评的累计答题时长" : "Total recorded time across the full assessment"}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="report-shell-card rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
        <StepHeading
          step="01"
          title={isCn ? "Part Breakdown" : "Part Breakdown"}
          description={isCn
            ? "先按试卷顺序快速看完每个 Part 的得分、用时和核心判断，再进入逐题回顾。"
            : "Scan each part in paper order first, then move into the detailed review section."}
          icon={<Languages className="h-5 w-5" />}
          iconClassName="bg-violet-50 text-violet-600"
        />

        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          {orderedSections.map((section, index) => {
            const insight = alignedSectionInsights[index];
            const insightSummary = insight
              ? normalizeSectionInsightSummary(isCn ? insight.summary_cn : insight.summary_en, section, locale)
              : null;
            const isWritingWithoutSubmission =
              section.kind === "writing"
              && model.writing?.sectionId === section.sectionId
              && !hasWritingSubmission;
            const breakdownSummary = isWritingWithoutSubmission
              ? (isCn
                  ? "本次未提交作文作答，因此这部分不显示写作评分、修改建议或写作提示。"
                  : "No writing response was submitted, so this section does not show a writing score, corrections, or suggestions.")
              : insightSummary
                ? insightSummary
                : (report
                    ? (isCn ? "该部分已纳入整体分析，目前没有单独摘要。" : "This part is already covered in the overall analysis.")
                    : (isCn ? "这份测评暂时还没有生成摘要。" : "A summary is not available for this part yet."));
            return (
              <div
                key={`breakdown-${section.sectionId}-${index}`}
                className="report-breakdown-card rounded-[28px] border border-slate-200 bg-slate-50/80 p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      {(index + 1).toString().padStart(2, "0")}
                    </p>
                    <p className="report-breakdown-title mt-2 text-lg font-semibold text-slate-900">
                      {getSectionDisplayName(section.sectionTitle, section.sectionId, locale)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      {isWritingWithoutSubmission
                        ? (isCn ? "作答状态" : "Submission")
                        : section.manualReview
                          ? (isCn ? "评估方式" : "Review Mode")
                          : (isCn ? "得分" : "Score")}
                    </p>
                    <p className="report-breakdown-score mt-1 font-[family-name:var(--font-sans)] text-[24px] font-bold leading-none tracking-tight text-slate-900">
                      {isWritingWithoutSubmission
                        ? (isCn ? "未作答" : "No Submission")
                        : section.manualReview
                          ? (isCn ? "老师评分" : "Teacher Review")
                          : `${section.correct}/${section.total}`}
                    </p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-500 shadow-sm">
                    {section.timeSeconds > 0 ? formatDuration(section.timeSeconds, locale) : (isCn ? "未记录用时" : "No timing")}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-7 text-slate-700">{breakdownSummary}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <StepHeading
          step="02"
          title={isCn ? "按 Part 顺序回顾" : "Part-by-Part Review"}
          description={isCn
            ? "下面按照试卷原始顺序，只展开错题、未作答题，以及写作和口语评估内容。"
            : "Review only wrong items, unanswered items, and writing or speaking evaluation in the original paper order."}
          icon={<FileText className="h-5 w-5" />}
          iconClassName="bg-slate-100 text-slate-600"
        />

        {!report ? (
          <div className="rounded-[32px] border border-amber-200 bg-amber-50 px-6 py-5 text-sm text-amber-900 shadow-sm">
            {isCn
              ? "这份测评还没有生成完整报告，当前先展示原始得分与逐题记录。"
              : "This assessment does not have a full report yet. Raw scores and question review are shown below."}
          </div>
        ) : null}

        {!hasOrderedReviewSections ? (
          <div className="rounded-[32px] border border-dashed border-slate-300 bg-white px-6 py-8 text-center text-sm text-slate-500 shadow-sm">
            {isCn ? "当前没有可展开的逐题回顾内容。" : "No detailed part review is available for this record yet."}
          </div>
        ) : null}

        {orderedSections.map((section, index) => {
          const insight = alignedSectionInsights[index];
          const insightSummary = insight
            ? normalizeSectionInsightSummary(isCn ? insight.summary_cn : insight.summary_en, section, locale)
            : null;
          const speakingItems = speakingEvaluationsBySection.get(section.sectionId) || [];
          const editableSpeakingItems = isEditingSpeaking
            ? (speakingDraft?.evaluations.filter((item) => item.sectionId === section.sectionId) || speakingItems)
            : speakingItems;
          const reviewDetails = getReviewProblemDetails(section.details);
          const isWritingSection = section.kind === "writing" && model.writing?.sectionId === section.sectionId;
          const isWritingWithoutSubmission = isWritingSection && !hasWritingSubmission;
          const isSpeakingSection = section.kind === "speaking" && editableSpeakingItems.length > 0;
          const shouldRenderSection = isWritingSection || isSpeakingSection || reviewDetails.length > 0;

          if (!shouldRenderSection) return null;

          return (
            <details
              key={`ordered-review-${section.sectionId}-${index}`}
              className="report-detail-card group overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm"
              open
            >
              <summary className="report-detail-summary cursor-pointer list-none px-6 py-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        {(index + 1).toString().padStart(2, "0")}
                      </span>
                      <p className="report-detail-title text-lg font-semibold text-slate-900">
                        {getSectionDisplayName(section.sectionTitle, section.sectionId, locale)}
                      </p>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-base font-semibold text-amber-900">
                        {isWritingWithoutSubmission
                          ? (isCn ? "未作答" : "No Submission")
                          : section.manualReview
                            ? (isCn ? "老师评分" : "Teacher Review")
                            : `${isCn ? "得分 " : "Score "}${section.correct}/${section.total}`}
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500">
                        {section.timeSeconds > 0 ? formatDuration(section.timeSeconds, locale) : (isCn ? "未记录用时" : "No timing recorded")}
                      </span>
                    </div>
                  </div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    {isCn ? "点击收起 / 展开" : "Toggle"}
                  </div>
                </div>
              </summary>

              <div className="report-detail-body space-y-4 border-t border-slate-100 bg-slate-50 px-4 py-4 sm:px-6">
                {insight || isWritingWithoutSubmission ? (
                  <div className="rounded-[24px] bg-indigo-50 px-5 py-4 text-sm leading-7 text-indigo-950">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-500">
                      {isCn ? "Part 摘要" : "Part Summary"}
                    </p>
                    <p className="mt-2">
                      {isWritingWithoutSubmission
                        ? (isCn
                            ? "本次未提交作文作答，因此这部分不显示写作评分、修改建议或写作提示。"
                            : "No writing response was submitted, so this section does not show a writing score, corrections, or suggestions.")
                        : insightSummary}
                    </p>
                  </div>
                ) : null}

                {isWritingSection && model.writing ? (
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1.18fr)_minmax(320px,0.82fr)] xl:items-start">
                    <div className="space-y-4">
                      <div className="report-question-card rounded-[24px] border border-slate-200 bg-white p-5">
                        <div className="flex items-center gap-2 text-slate-900">
                          <PenSquare className="h-5 w-5 text-rose-600" />
                          <p className="text-base font-semibold">{isCn ? "写作任务" : "Writing Task"}</p>
                        </div>
                        <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                            {isCn ? "题目要求" : "Prompt"}
                          </p>
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                            {model.writing.question.topic || model.writing.question.instructions}
                          </p>
                        </div>
                      </div>

                      <div className="report-question-card rounded-[24px] border border-slate-200 bg-white p-5">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-base font-semibold text-slate-900">
                            {isCn ? "学生原文" : "Student Response"}
                          </p>
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                            {model.writing.essay.trim()
                              ? (isCn ? `${model.writing.essay.trim().split(/\s+/).length} 词` : `${model.writing.essay.trim().split(/\s+/).length} words`)
                              : (isCn ? "未作答" : "No response")}
                          </span>
                        </div>
                        <div className="mt-4 rounded-[24px] border border-emerald-100 bg-emerald-50/80 px-5 py-4">
                          <p className="whitespace-pre-wrap text-[15px] leading-8 text-emerald-950">
                            {model.writing.essay || (isCn ? "未提交写作内容。" : "No writing submission.")}
                          </p>
                        </div>
                      </div>

                      {visibleWritingEvaluation?.correctedEssay ? (
                        <div className="report-question-card rounded-[24px] border border-emerald-100 bg-white p-5">
                          <div className="flex items-center gap-2 text-emerald-900">
                            <Sparkles className="h-5 w-5 text-emerald-600" />
                            <p className="text-base font-semibold">
                              {isCn ? "AI 修改示例" : "AI Corrected Version"}
                            </p>
                          </div>
                          <div className="mt-4 rounded-[24px] bg-emerald-50 px-5 py-4">
                            <p className="whitespace-pre-wrap text-[15px] leading-8 text-emerald-950">
                              {visibleWritingEvaluation.correctedEssay}
                            </p>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="space-y-4 xl:sticky xl:top-6">
                      <div className="rounded-[24px] border border-rose-100 bg-rose-50 p-5">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">
                          {hasWritingSubmission ? (isCn ? "评分结果" : "Score") : (isCn ? "作答状态" : "Submission")}
                        </p>
                        <p className="mt-2 text-2xl font-bold text-rose-900">
                          {!hasWritingSubmission
                            ? (isCn ? "未作答" : "No Submission")
                            : model.writing.manualReview
                              ? (isCn ? "老师评分" : "Teacher Review")
                              : visibleWritingEvaluation
                                ? `${visibleWritingEvaluation.score}/${visibleWritingEvaluation.maxScore}`
                                : "-"}
                        </p>
                        {!hasWritingSubmission ? (
                          <p className="mt-2 text-sm leading-7 text-rose-900">
                            {isCn
                              ? "本次没有提交作文内容，因此这里不会显示写作评分、语法修改或写作提示。"
                              : "No writing response was submitted, so this area does not show a writing score, corrections, or suggestions."}
                          </p>
                        ) : visibleWritingEvaluation ? (
                          <p className="mt-2 text-sm leading-7 text-rose-900">
                            {isCn ? visibleWritingEvaluation.overallFeedback_cn : visibleWritingEvaluation.overallFeedback_en}
                          </p>
                        ) : null}
                      </div>

                      {visibleWritingEvaluation?.grammarErrors?.length ? (
                        <div className="report-question-card rounded-[24px] border border-slate-200 bg-white p-5">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                            {isCn ? "重点语法修改" : "Grammar Corrections"}
                          </p>
                          <div className="mt-3 space-y-3">
                            {visibleWritingEvaluation.grammarErrors.map((item, grammarIndex) => (
                              <div key={`grammar-error-${grammarIndex}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="font-semibold text-slate-800">{item.original}</p>
                                  <span className="text-slate-300">→</span>
                                  <p className="font-semibold text-emerald-700">{item.correction}</p>
                                </div>
                                <p className="mt-2 text-slate-600">
                                  {isCn ? item.explanation_cn : item.explanation_en}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {((isCn ? visibleWritingEvaluation?.suggestions_cn : visibleWritingEvaluation?.suggestions_en) || []).length > 0 ? (
                        <div className="rounded-[24px] border border-slate-200 bg-white p-5">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                            {isCn ? "本 Part 提示" : "Part Suggestions"}
                          </p>
                          <div className="mt-3 space-y-2">
                            {((isCn ? visibleWritingEvaluation?.suggestions_cn : visibleWritingEvaluation?.suggestions_en) || []).map((item, suggestionIndex) => (
                              <div key={`writing-suggestion-${suggestionIndex}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
                                {item}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {isSpeakingSection ? (
                  <div className="space-y-4">
                    {canManuallyScoreSpeaking ? (
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {isEditingSpeaking ? (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={handleCancelSpeakingEdit}
                              disabled={savingSpeaking}
                              className="rounded-full bg-white"
                            >
                              {isCn ? "取消" : "Cancel"}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              onClick={handleSaveSpeakingReview}
                              disabled={savingSpeaking}
                              className="rounded-full"
                            >
                              {savingSpeaking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                              {isCn ? "保存口语评分" : "Save Speaking Review"}
                            </Button>
                          </>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setIsEditingSpeaking(true)}
                            className="rounded-full bg-white"
                          >
                            <PencilLine className="mr-2 h-4 w-4" />
                            {isCn ? "老师评分" : "Edit Speaking Score"}
                          </Button>
                        )}
                      </div>
                    ) : null}

                    {editableSpeakingItems.map((item) => (
                      <div key={`${item.sectionId}-${item.questionId}`} className="report-question-card rounded-[24px] border border-slate-200 bg-white p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">Q{item.questionId}</p>
                            <p className="mt-1 text-sm leading-6 text-slate-600">{item.prompt}</p>
                          </div>
                          <div className="min-w-[142px] rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                            <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
                              {isCn ? "本题得分" : "Response Score"}
                            </p>
                            <p className="mt-1 text-lg font-semibold text-slate-900">
                              {Boolean(item.manualReviewRequired) && !isEditingSpeaking
                                ? (isCn ? "待评分" : "Pending")
                                : `${formatScoreDisplay(item.score)}/${item.maxScore}`}
                            </p>
                          </div>
                        </div>

                        {item.audioUrl ? (
                          <audio controls className="mt-4 w-full" src={item.audioUrl} preload="none" />
                        ) : null}

                        <div className="mt-4 rounded-[28px] border border-slate-200 bg-slate-50/80 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                                {isCn ? "评分维度" : "Scoring Criteria"}
                              </p>
                              <p className="mt-1 text-sm font-medium text-slate-600">
                                {isCn
                                  ? "按 5 个维度分别评分，系统会自动换算本题总分。"
                                  : "Score the five criteria below and the response score is calculated automatically."}
                              </p>
                            </div>
                            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-500">
                              {isCn ? "共 5 项" : "5 criteria"}
                            </span>
                          </div>

                          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                          {MANUAL_SPEAKING_CRITERIA.map((criterion) => (
                              <div
                                key={`${item.sectionId}-${item.questionId}-${criterion.field}`}
                                className="rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-sm"
                              >
                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                                  {isCn ? criterion.labelCn : criterion.labelEn}
                                </p>
                                {isEditingSpeaking && canManuallyScoreSpeaking ? (
                                  <div className="mt-3 space-y-2">
                                    <Input
                                      type="number"
                                      min={0}
                                      max={DEFAULT_MANUAL_SPEAKING_MAX_SCORE}
                                      step={1}
                                      value={String(item[criterion.field] ?? 0)}
                                      onChange={(event) => updateSpeakingItemField(item.sectionId, item.questionId, criterion.field, event.target.value)}
                                      className="h-12 bg-slate-50 text-center text-xl font-semibold"
                                    />
                                    <p className="text-center text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                                      {isCn ? `满分 ${DEFAULT_MANUAL_SPEAKING_MAX_SCORE}` : `Max ${DEFAULT_MANUAL_SPEAKING_MAX_SCORE}`}
                                    </p>
                                  </div>
                                ) : (
                                  <p className="mt-4 text-center text-3xl font-semibold tracking-[-0.03em] text-slate-900">
                                    {Boolean(item.manualReviewRequired)
                                      ? (isCn ? "待评" : "Pending")
                                      : formatScoreDisplay(typeof item[criterion.field] === "number" ? item[criterion.field] : null)}
                                    {!item.manualReviewRequired ? (
                                      <span className="ml-1 text-sm font-medium text-slate-500">/ {DEFAULT_MANUAL_SPEAKING_MAX_SCORE}</span>
                                    ) : null}
                                  </p>
                                )}
                              </div>
                          ))}
                          </div>
                        </div>
                      </div>
                    ))}

                    {((isEditingSpeaking ? speakingDraft?.overallFeedback_cn : model.speaking.evaluation?.overallFeedback_cn)
                      || (isEditingSpeaking ? speakingDraft?.overallFeedback_en : model.speaking.evaluation?.overallFeedback_en)
                      || canManuallyScoreSpeaking) ? (
                      <div className="rounded-[24px] bg-orange-50 px-5 py-4 text-sm leading-7 text-orange-950">
                        <div className="flex items-center gap-2">
                          <Mic className="h-5 w-5 text-orange-600" />
                          <p className="text-base font-semibold">{isCn ? "口语总反馈" : "Speaking Overview"}</p>
                        </div>
                        {isEditingSpeaking && canManuallyScoreSpeaking ? (
                          <Textarea
                            value={speakingDraft?.overallFeedback_cn || ""}
                            onChange={(event) => updateSpeakingOverallFeedback(event.target.value)}
                            placeholder={isCn ? "输入老师对本次口语整体表现的评语" : "Add an overall teacher comment for this speaking section"}
                            className="mt-3 min-h-[110px] bg-white"
                          />
                        ) : (
                          <p className="mt-3">
                            {isCn
                              ? (model.speaking.evaluation?.overallFeedback_cn || summarizeManualSpeakingFeedback("cn", editableSpeakingItems))
                              : (model.speaking.evaluation?.overallFeedback_en || summarizeManualSpeakingFeedback("en", editableSpeakingItems))}
                          </p>
                        )}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {reviewDetails.length > 0 ? (
                  <div className="space-y-4">
                    {reviewDetails.map((detail) => {
                      const status = getStatusStyle(detail);
                      return (
                        <div key={`${section.sectionId}-${index}-${detail.id}`} className="report-question-card rounded-[24px] border border-slate-200 bg-white p-5">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="flex min-w-0 items-start gap-3">
                              {detail.isAnswered && detail.isCorrect ? (
                                <CheckCircle2 className="mt-1 h-5 w-5 text-emerald-600" />
                              ) : (
                                <AlertCircle className="mt-1 h-5 w-5 text-slate-400" />
                              )}
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-900">{detail.questionNum}</p>
                              </div>
                            </div>
                            <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${status.className}`}>
                              {isCn ? status.labelCn : status.label}
                            </span>
                          </div>

                          <QuestionMaterialBlock detail={detail} locale={locale} />

                          {detail.options?.length ? (
                            <div className="mt-4 grid gap-3">
                              {detail.options.map((option) => (
                                <div
                                  key={`${detail.id}-${option.label}`}
                                  className={`rounded-2xl border px-4 py-3 text-sm ${
                                    option.isCorrect
                                      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                                      : option.isSelected
                                        ? "border-blue-200 bg-blue-50 text-blue-900"
                                        : "border-slate-200 bg-slate-50 text-slate-600"
                                  }`}
                                >
                                  <div className="flex items-start gap-4">
                                    {option.imageUrl ? (
                                      <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-white/70 bg-white">
                                        <img
                                          src={option.imageUrl}
                                          alt={`${detail.questionNum} option ${option.label}`}
                                          className="h-full w-full object-contain"
                                          loading="lazy"
                                        />
                                      </div>
                                    ) : null}
                                    <div className="min-w-0">
                                      <span className="font-semibold">{option.label}.</span>{" "}
                                      {option.text || (isCn ? "图片选项" : "Image option")}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : null}

                          <div className="mt-4 grid gap-3 xl:grid-cols-2">
                            <div className="rounded-2xl bg-slate-50 px-4 py-3">
                              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                                {isCn ? "学生答案" : "Student Answer"}
                              </p>
                              <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                                {localizeStoredText(detail.userAnswer, locale)}
                              </p>
                            </div>
                            <div className="rounded-2xl bg-emerald-50 px-4 py-3">
                              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600">
                                {isCn ? "参考答案" : "Correct Answer"}
                              </p>
                              <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-emerald-900">
                                {localizeStoredText(detail.correctAnswer, locale)}
                              </p>
                            </div>
                          </div>

                          {detail.explanationEn || detail.explanationCn ? (
                            <div className="mt-4 rounded-2xl bg-blue-50 px-4 py-4">
                              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">
                                {isCn ? "题目解析" : "Explanation"}
                              </p>
                              <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-blue-950">
                                {isCn ? detail.explanationCn : detail.explanationEn}
                              </p>
                              {(detail.tipEn || detail.tipCn) ? (
                                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-blue-800">
                                  {isCn ? detail.tipCn : detail.tipEn}
                                </p>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </details>
          );
        })}
      </section>

      {report ? (
        <section className="report-shell-card rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
          <StepHeading
            step="03"
            title={isCn ? "总结与提升建议" : "Summary & Next Steps"}
            description=""
            icon={<Sparkles className="h-5 w-5" />}
            iconClassName="bg-blue-50 text-blue-600"
          />

          <div className="mt-6 space-y-5">
            <div className="report-overview-card rounded-[30px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-6 shadow-sm">
              <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="h-2.5 w-2.5 rounded-full bg-violet-500" />
                    <h3 className="text-base font-semibold text-slate-900">
                      {isCn ? "整体结论" : "Overall Analysis"}
                    </h3>
                  </div>
                  <p className="mt-4 text-sm leading-8 text-slate-700">
                    {normalizeSummaryText(isCn ? (report.overallSummary_cn || report.summary_cn) : (report.overallSummary_en || report.summary_en))}
                  </p>
                </div>

                <div className="rounded-[24px] border border-blue-100 bg-white px-5 py-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-500">
                    {isCn ? "时间表现" : "Time Management"}
                  </p>
                  <p className="mt-3 text-sm leading-7 text-slate-700">
                    {normalizeSummaryText(isCn ? report.timeAnalysis_cn : report.timeAnalysis_en)}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
              {renderDetailList("能力画像", "Ability Snapshot", abilityItems, locale, "blue")}
              {renderDetailList("当前强项", "Strengths", strengthItems, locale, "emerald")}
              {renderDetailList("当前弱项", "Weaknesses", weaknessItems, locale, "amber")}
            </div>

            {renderDetailList("学习建议", "Recommendations", recommendationItems, locale, "indigo")}

            {(report.studyPlan || []).length > 0 ? (
              <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                  <h3 className="text-base font-semibold text-slate-900">
                    {isCn ? "三阶段学习规划" : "Three-Stage Study Plan"}
                  </h3>
                </div>

                <div className="mt-5 grid gap-4 xl:grid-cols-3">
                  {report.studyPlan.map((stage, stageIndex) => (
                    <div
                      key={`study-stage-${stageIndex}`}
                      className="report-study-stage rounded-[26px] border border-slate-200 bg-slate-50/80 p-5"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">
                          {String(stageIndex + 1).padStart(2, "0")}
                        </span>
                        <span className="text-xs font-medium text-slate-400">
                          {isCn ? "阶段安排" : "Stage Plan"}
                        </span>
                      </div>
                      <p className="mt-4 text-lg font-semibold text-slate-900">
                        {normalizeSummaryText(isCn ? stage.stage_cn : stage.stage_en)}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {normalizeSummaryText(isCn ? stage.focus_cn : stage.focus_en)}
                      </p>
                      <div className="mt-4 space-y-3">
                        {(isCn ? stage.actions_cn : stage.actions_en).map((action, actionIndex) => (
                          <div
                            key={`study-action-${stageIndex}-${actionIndex}`}
                            className="grid grid-cols-[30px_minmax(0,1fr)] items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700"
                          >
                            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-500">
                              {actionIndex + 1}
                            </span>
                            <p>{normalizeSummaryText(action)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {(isCn ? report.parentFeedback_cn : report.parentFeedback_en) ? (
              <div className="report-parent-card rounded-[30px] border border-rose-100 bg-[linear-gradient(180deg,#fff6f7_0%,#fff1f3_100%)] px-6 py-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                  <h3 className="text-base font-semibold text-rose-900">
                    {isCn ? "给家长的话" : "Parent Feedback"}
                  </h3>
                </div>
                <p className="mt-4 text-sm leading-8 text-rose-900">
                  {normalizeSummaryText(isCn ? report.parentFeedback_cn : report.parentFeedback_en)}
                </p>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
