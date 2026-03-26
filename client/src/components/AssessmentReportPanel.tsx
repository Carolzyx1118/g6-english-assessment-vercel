import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  GraduationCap,
  Languages,
  Sparkle,
  Mic,
  PenSquare,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { generateReportPDF } from "@/lib/generatePDF";
import {
  buildAssessmentReviewModel,
  formatDuration,
  getSectionDisplayName,
  type AssessmentReviewModel,
  type AssessmentReviewRecord,
  type QuestionReviewDetail,
  type ReviewLocale,
} from "@/lib/assessmentReview";

interface AssessmentReportPanelProps {
  record: AssessmentReviewRecord;
  extraHeaderActions?: ReactNode;
  showDownload?: boolean;
  initialLocale?: ReviewLocale;
  hideLocaleToggle?: boolean;
  printMode?: boolean;
}

type SpeakingEvaluationItem =
  NonNullable<NonNullable<AssessmentReviewModel["speaking"]["evaluation"]>["evaluations"]>[number];

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
    "Teacher review required": { cn: "需要老师人工判断", en: "Teacher review required" },
    "AI reference answer unavailable": { cn: "AI 参考答案暂不可用", en: "AI reference answer unavailable" },
    "Manual Review": { cn: "老师评分", en: "Manual Review" },
  };

  const matched = localizedMap[value];
  return matched ? (locale === "cn" ? matched.cn : matched.en) : value;
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
    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
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
            className="grid grid-cols-[38px_minmax(0,1fr)] items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4 text-sm leading-6 text-slate-700"
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
    <div className={`rounded-2xl px-4 py-4 ${toneClasses}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
        {props.locale === "cn" ? props.titleCn : props.titleEn}
      </p>
      <div className="mt-2 text-sm leading-7">{props.children}</div>
    </div>
  );
}

function ReviewImageCard(props: { src: string; alt: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm">
      <img src={props.src} alt={props.alt} className="h-full max-h-72 w-full object-contain bg-white" loading="lazy" />
    </div>
  );
}

function QuestionMaterialBlock({ detail, locale }: { detail: QuestionReviewDetail; locale: ReviewLocale }) {
  const question = detail.sourceQuestion;
  const isCn = locale === "cn";
  const imageUrls = Array.from(
    new Set(
      [detail.questionImageUrl, detail.sceneImageUrl, detail.sectionImageUrl]
        .filter((value): value is string => Boolean(value && value.trim())),
    ),
  );

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
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-center gap-3 text-slate-900">
        <div className={`rounded-2xl p-3 ${props.iconClassName}`}>
          {props.icon}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{props.step}</p>
          <h2 className="text-xl font-bold">{props.title}</h2>
        </div>
      </div>
      {props.description.trim() ? (
        <p className="max-w-2xl text-sm leading-6 text-slate-500">
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

function getStudentMonogram(name: string | null | undefined, locale: ReviewLocale) {
  const displayName = getDisplayStudentName(name, locale);
  if (locale === "cn") {
    return displayName.slice(0, 2);
  }
  return displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "ST";
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
}: AssessmentReportPanelProps) {
  const [locale, setLocale] = useState<ReviewLocale>(initialLocale);
  const [downloading, setDownloading] = useState(false);
  const model = useMemo(() => buildAssessmentReviewModel(record), [record]);
  const report = model.report;
  const sectionInsights = new Map((report?.sectionInsights || []).map((item) => [item.sectionId, item]));
  const strengthItems = locale === "cn" ? report?.strengths_cn : report?.strengths_en;
  const weaknessItems = locale === "cn" ? report?.weaknesses_cn : report?.weaknesses_en;
  const recommendationItems = locale === "cn" ? report?.recommendations_cn : report?.recommendations_en;
  const abilityItems = locale === "cn" ? report?.abilitySnapshot_cn : report?.abilitySnapshot_en;
  const isCn = locale === "cn";
  const displayStudentName = getDisplayStudentName(record.studentName, locale);
  const studentMonogram = getStudentMonogram(record.studentName, locale);
  const gradeDescriptor = getGradeDescriptor(model.grade, locale);

  const orderedSections = model.sections;
  const speakingEvaluationsBySection = useMemo(() => {
    const grouped = new Map<string, SpeakingEvaluationItem[]>();
    (model.speaking.evaluation?.evaluations || []).forEach((item) => {
      const current = grouped.get(item.sectionId) || [];
      current.push(item);
      grouped.set(item.sectionId, current);
    });
    return grouped;
  }, [model.speaking.evaluation]);

  const hasOrderedReviewSections = orderedSections.some((section) => {
    const hasWriting = section.kind === "writing" && model.writing?.sectionId === section.sectionId;
    const hasSpeaking = section.kind === "speaking" && (speakingEvaluationsBySection.get(section.sectionId) || []).length > 0;
    return hasWriting || hasSpeaking || section.details.length > 0;
  });
  const hasHeaderControls = !hideLocaleToggle || showDownload || Boolean(extraHeaderActions);

  useEffect(() => {
    setLocale(initialLocale);
  }, [initialLocale]);

  const handleDownload = async () => {
    try {
      setDownloading(true);
      await generateReportPDF(record, locale);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "PDF download failed.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className={`space-y-6 ${printMode ? "print-assessment-report" : ""}`}>
      <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
        <div className="relative overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(125,211,252,0.18),_transparent_28%),radial-gradient(circle_at_82%_18%,_rgba(191,219,254,0.14),_transparent_22%),linear-gradient(130deg,#0f172a_0%,#1e3a8a_46%,#2563eb_100%)] px-6 py-7 text-white sm:px-8 sm:py-8">
          <div className="pointer-events-none absolute inset-0 opacity-50">
            <div className="absolute -left-16 top-10 h-48 w-48 rounded-full bg-cyan-300/10 blur-3xl" />
            <div className="absolute right-0 top-0 h-56 w-56 rounded-full bg-blue-200/10 blur-3xl" />
            <div className="absolute bottom-0 right-1/4 h-36 w-36 rounded-full bg-indigo-200/10 blur-3xl" />
            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white/10 to-transparent" />
          </div>

          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1 space-y-5">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-blue-100">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-3 py-1.5">
                  <Sparkle className="h-3.5 w-3.5" />
                  {isCn ? "测评反馈报告" : "Assessment Report"}
                </span>
                <span className="rounded-full border border-white/20 bg-white/6 px-3 py-1.5 text-[11px] tracking-[0.16em] text-white/90">
                  {record.paperTitle}
                </span>
              </div>

              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_260px] xl:items-start">
                <div className="min-w-0">
                  <div className="flex items-start gap-4">
                    <div className="hidden h-16 w-16 shrink-0 items-center justify-center rounded-[22px] border border-white/15 bg-white/10 text-lg font-semibold text-white/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.16)] sm:flex">
                      {studentMonogram}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-100/80">
                        {isCn ? "学生档案" : "Student Profile"}
                      </p>
                      <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-white sm:text-[40px]">
                        {displayStudentName}
                      </h1>
                      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-blue-50/90">
                        <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/10 px-3 py-1.5">
                          <GraduationCap className="h-4 w-4" />
                          {record.studentGrade
                            ? (isCn ? `年级 ${record.studentGrade}` : `Grade ${record.studentGrade}`)
                            : (isCn ? "未填写年级" : "Grade not provided")}
                        </span>
                        <span className="rounded-full border border-white/12 bg-white/10 px-3 py-1.5">
                          {formatDate(record.createdAt, locale)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-[28px] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.05))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-100/80">
                    {isCn ? "当前结论" : "Current Signal"}
                  </p>
                  <div className="mt-4 flex items-end gap-3">
                    <span className="text-5xl font-semibold leading-none text-white">{model.grade}</span>
                    <span className="mb-1 rounded-full border border-white/12 bg-white/10 px-3 py-1 text-xs font-medium text-blue-50/90">
                      {model.percentage}%
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-blue-50/90">
                    {gradeDescriptor}
                  </p>
                </div>
              </div>
            </div>

            {hasHeaderControls ? (
              <div className="flex w-full flex-wrap items-center justify-end gap-2 xl:w-auto">
                {!hideLocaleToggle ? (
                  <div className="inline-flex rounded-full border border-white/20 bg-white/10 p-1">
                    <button
                      type="button"
                      onClick={() => setLocale("cn")}
                      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                        isCn ? "bg-white text-slate-900 shadow-sm" : "text-white/80"
                      }`}
                    >
                      中文
                    </button>
                    <button
                      type="button"
                      onClick={() => setLocale("en")}
                      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                        !isCn ? "bg-white text-slate-900 shadow-sm" : "text-white/80"
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
                    className="gap-2 rounded-full border-white/20 bg-white/10 text-white hover:bg-white/15"
                  >
                    <Download className="h-4 w-4" />
                    {downloading ? (isCn ? "生成中..." : "Generating...") : (isCn ? "下载 PDF" : "Download PDF")}
                  </Button>
                ) : null}
                {extraHeaderActions}
              </div>
            ) : null}
          </div>

          <div className="relative mt-8 grid gap-4 xl:grid-cols-[0.88fr_1.12fr_0.88fr]">
            <div className="rounded-[28px] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.11),rgba(255,255,255,0.05))] px-5 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-100/80">
                {isCn ? "总评等级" : "Overall Grade"}
              </p>
              <p className="mt-4 text-5xl font-semibold leading-none">{model.grade}</p>
              <p className="mt-3 text-sm text-blue-50/85">{gradeDescriptor}</p>
            </div>

            <div className="rounded-[28px] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.14),rgba(255,255,255,0.06))] px-5 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-100/80">
                  {isCn ? "综合得分" : "Total Score"}
                </p>
                <span className="rounded-full border border-white/12 bg-white/10 px-3 py-1 text-xs font-medium text-blue-50/90">
                  {model.percentage}%
                </span>
              </div>
              <p className="mt-4 text-[52px] font-semibold leading-none tracking-[-0.04em]">
                {model.totalScore}
                <span className="text-2xl font-medium text-blue-100/75">/{model.totalPossible}</span>
              </p>
              <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,rgba(125,211,252,0.95),rgba(255,255,255,0.95))]"
                  style={{ width: `${Math.max(6, Math.min(model.percentage, 100))}%` }}
                />
              </div>
              <p className="mt-3 text-sm text-blue-50/85">
                {isCn ? "自动评分部分的当前完成情况" : "Current completion across auto-scored parts"}
              </p>
            </div>

            <div className="rounded-[28px] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.11),rgba(255,255,255,0.05))] px-5 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-100/80">
                {isCn ? "总用时" : "Total Time"}
              </p>
              <p className="mt-4 flex items-center gap-3 text-[40px] font-semibold leading-none tracking-[-0.03em]">
                <Clock3 className="h-8 w-8 text-blue-100/90" />
                {formatDuration(model.totalTimeSeconds, locale)}
              </p>
              <p className="mt-3 text-sm text-blue-50/85">
                {isCn ? "整张测评的累计答题时长" : "Total recorded time across the full assessment"}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
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
            const insight = sectionInsights.get(section.sectionId);
            return (
              <div
                key={`breakdown-${section.sectionId}`}
                className="rounded-[28px] border border-slate-200 bg-slate-50/80 p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      {(index + 1).toString().padStart(2, "0")}
                    </p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">
                      {getSectionDisplayName(section.sectionTitle, section.sectionId, locale)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-slate-700">
                      {section.manualReview
                        ? (isCn ? "老师评分" : "Manual Review")
                        : `${section.correct}/${section.total}`}
                    </span>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-500">
                      {section.timeSeconds > 0 ? formatDuration(section.timeSeconds, locale) : (isCn ? "未记录" : "N/A")}
                    </span>
                  </div>
                </div>

                <p className="mt-3 text-sm font-medium text-slate-500">
                  {section.manualReview ? (isCn ? "人工评分部分" : "Manually reviewed part") : `${section.percentage}%`}
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-700">
                  {insight
                    ? (isCn ? insight.summary_cn : insight.summary_en)
                    : (report
                        ? (isCn ? "该部分已纳入整体分析，目前没有单独摘要。" : "This part is already covered in the overall analysis.")
                        : (isCn ? "这份测评暂时还没有生成 AI 摘要。" : "AI summary is not available for this part yet."))}
                </p>
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
            ? "下面按照试卷原始顺序依次回顾每个 Part。阅读、语法、写作、口语都会按出现顺序展开。"
            : "Review each part in the same order as the original paper, including writing and speaking."}
          icon={<FileText className="h-5 w-5" />}
          iconClassName="bg-slate-100 text-slate-600"
        />

        {!report ? (
          <div className="rounded-[32px] border border-amber-200 bg-amber-50 px-6 py-5 text-sm text-amber-900 shadow-sm">
            {isCn
              ? "这份测评还没有生成 AI 报告，当前先展示原始得分与逐题记录。"
              : "This assessment does not have an AI report yet. Raw scores and question review are shown below."}
          </div>
        ) : null}

        {!hasOrderedReviewSections ? (
          <div className="rounded-[32px] border border-dashed border-slate-300 bg-white px-6 py-8 text-center text-sm text-slate-500 shadow-sm">
            {isCn ? "当前没有可展开的逐题回顾内容。" : "No detailed part review is available for this record yet."}
          </div>
        ) : null}

        {orderedSections.map((section, index) => {
          const insight = sectionInsights.get(section.sectionId);
          const speakingItems = speakingEvaluationsBySection.get(section.sectionId) || [];
          const isWritingSection = section.kind === "writing" && model.writing?.sectionId === section.sectionId;
          const isSpeakingSection = section.kind === "speaking" && speakingItems.length > 0;
          const shouldRenderSection = isWritingSection || isSpeakingSection || section.details.length > 0;

          if (!shouldRenderSection) return null;

          return (
            <details
              key={`ordered-review-${section.sectionId}`}
              className="group overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm"
              open
            >
              <summary className="cursor-pointer list-none px-6 py-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        {(index + 1).toString().padStart(2, "0")}
                      </span>
                      <p className="text-lg font-semibold text-slate-900">
                        {getSectionDisplayName(section.sectionTitle, section.sectionId, locale)}
                      </p>
                    </div>
                    <p className="mt-2 text-sm text-slate-500">
                      {section.manualReview
                        ? (isCn ? "当前按老师评分项处理" : "Currently handled as manual review")
                        : `${section.correct}/${section.total} · ${section.percentage}%`}
                      {" · "}
                      {section.timeSeconds > 0 ? formatDuration(section.timeSeconds, locale) : (isCn ? "未记录用时" : "No timing recorded")}
                    </p>
                  </div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    {isCn ? "点击收起 / 展开" : "Toggle"}
                  </div>
                </div>
              </summary>

              <div className="space-y-4 border-t border-slate-100 bg-slate-50 px-4 py-4 sm:px-6">
                {insight ? (
                  <div className="rounded-[24px] bg-indigo-50 px-5 py-4 text-sm leading-7 text-indigo-950">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-500">
                      {isCn ? "Part 摘要" : "Part Summary"}
                    </p>
                    <p className="mt-2">{isCn ? insight.summary_cn : insight.summary_en}</p>
                  </div>
                ) : null}

                {isWritingSection && model.writing ? (
                  <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                    <div className="space-y-4">
                      <div className="rounded-[24px] border border-slate-200 bg-white p-5">
                        <div className="flex items-center gap-2 text-slate-900">
                          <PenSquare className="h-5 w-5 text-rose-600" />
                          <p className="text-base font-semibold">{isCn ? "写作任务" : "Writing Task"}</p>
                        </div>
                        <div className="mt-4 space-y-4">
                          <div className="rounded-2xl bg-slate-50 px-4 py-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                              {isCn ? "题目要求" : "Prompt"}
                            </p>
                            <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                              {model.writing.question.topic || model.writing.question.instructions}
                            </p>
                          </div>
                          <div className="rounded-2xl bg-slate-50 px-4 py-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                              {isCn ? "学生原文" : "Student Response"}
                            </p>
                            <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                              {model.writing.essay || (isCn ? "未提交写作内容。" : "No writing submission.")}
                            </p>
                          </div>
                          {model.writing.evaluation?.correctedEssay ? (
                            <div className="rounded-2xl bg-emerald-50 px-4 py-4">
                              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600">
                                {isCn ? "AI 修改示例" : "AI Corrected Version"}
                              </p>
                              <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-emerald-950">
                                {model.writing.evaluation.correctedEssay}
                              </p>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-[24px] border border-rose-100 bg-rose-50 p-5">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">
                          {isCn ? "评分结果" : "Score"}
                        </p>
                        <p className="mt-2 text-2xl font-bold text-rose-900">
                          {model.writing.manualReview
                            ? (isCn ? "老师评分" : "Manual Review")
                            : model.writing.evaluation
                              ? `${model.writing.evaluation.score}/${model.writing.evaluation.maxScore}`
                              : "-"}
                        </p>
                        {model.writing.evaluation ? (
                          <p className="mt-2 text-sm leading-7 text-rose-900">
                            {isCn ? model.writing.evaluation.overallFeedback_cn : model.writing.evaluation.overallFeedback_en}
                          </p>
                        ) : null}
                      </div>

                      {model.writing.evaluation?.grammarErrors?.length ? (
                        <div className="rounded-[24px] border border-slate-200 bg-white p-5">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                            {isCn ? "重点语法修改" : "Grammar Corrections"}
                          </p>
                          <div className="mt-3 space-y-3">
                            {model.writing.evaluation.grammarErrors.map((item, grammarIndex) => (
                              <div key={`grammar-error-${grammarIndex}`} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm">
                                <p className="font-semibold text-slate-800">{item.original}</p>
                                <p className="mt-1 text-emerald-700">{item.correction}</p>
                                <p className="mt-2 text-slate-600">
                                  {isCn ? item.explanation_cn : item.explanation_en}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {((isCn ? model.writing.evaluation?.suggestions_cn : model.writing.evaluation?.suggestions_en) || []).length > 0 ? (
                        <div className="rounded-[24px] border border-slate-200 bg-white p-5">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                            {isCn ? "本 Part 提示" : "Part Suggestions"}
                          </p>
                          <div className="mt-3 space-y-2">
                            {((isCn ? model.writing.evaluation?.suggestions_cn : model.writing.evaluation?.suggestions_en) || []).map((item, suggestionIndex) => (
                              <div key={`writing-suggestion-${suggestionIndex}`} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
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
                    {(model.speaking.evaluation?.overallFeedback_cn || model.speaking.evaluation?.overallFeedback_en) ? (
                      <div className="rounded-[24px] bg-orange-50 px-5 py-4 text-sm leading-7 text-orange-950">
                        <div className="flex items-center gap-2">
                          <Mic className="h-5 w-5 text-orange-600" />
                          <p className="text-base font-semibold">{isCn ? "口语总体反馈" : "Speaking Overview"}</p>
                        </div>
                        <p className="mt-3">
                          {isCn ? model.speaking.evaluation?.overallFeedback_cn : model.speaking.evaluation?.overallFeedback_en}
                        </p>
                      </div>
                    ) : null}

                    {speakingItems.map((item) => (
                      <div key={`${item.sectionId}-${item.questionId}`} className="rounded-[24px] border border-slate-200 bg-white p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">Q{item.questionId}</p>
                            <p className="mt-1 text-sm leading-6 text-slate-600">{item.prompt}</p>
                          </div>
                          <div className="rounded-2xl bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700">
                            {model.speaking.manualReview
                              ? (isCn ? "老师评分" : "Manual Review")
                              : `${item.score}/${item.maxScore}`}
                          </div>
                        </div>

                        {item.audioUrl ? (
                          <audio controls className="mt-4 w-full" src={item.audioUrl} preload="none" />
                        ) : null}

                        <div className="mt-4 grid gap-4 xl:grid-cols-2">
                          <div className="rounded-3xl bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-700">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                              {isCn ? "转写内容" : "Transcript"}
                            </p>
                            <p className="mt-2 whitespace-pre-wrap">
                              {item.transcript || (isCn ? "暂无转写内容。" : "No transcript available.")}
                            </p>
                          </div>
                          <div className="rounded-3xl bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-700">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                              {isCn ? "总体反馈" : "Overall Feedback"}
                            </p>
                            <p className="mt-2">{isCn ? item.feedback_cn : item.feedback_en}</p>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                          {[
                            { labelCn: "任务完成", labelEn: "Task Completion", value: isCn ? item.taskCompletion_cn : item.taskCompletion_en },
                            { labelCn: "流利度", labelEn: "Fluency", value: isCn ? item.fluency_cn : item.fluency_en },
                            { labelCn: "词汇", labelEn: "Vocabulary", value: isCn ? item.vocabulary_cn : item.vocabulary_en },
                            { labelCn: "语法", labelEn: "Grammar", value: isCn ? item.grammar_cn : item.grammar_en },
                            { labelCn: "发音", labelEn: "Pronunciation", value: isCn ? item.pronunciation_cn : item.pronunciation_en },
                          ].map((criterion) => (
                            <div key={criterion.labelEn} className="rounded-3xl bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-700">
                              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                                {isCn ? criterion.labelCn : criterion.labelEn}
                              </p>
                              <p className="mt-2">{criterion.value}</p>
                            </div>
                          ))}
                        </div>

                        {((isCn ? item.suggestions_cn : item.suggestions_en) || []).length > 0 ? (
                          <div className="mt-4 rounded-3xl bg-slate-50 px-4 py-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                              {isCn ? "本 Part 提示" : "Part Suggestions"}
                            </p>
                            <div className="mt-3 space-y-2">
                              {(isCn ? item.suggestions_cn : item.suggestions_en).map((suggestion, suggestionIndex) => (
                                <div key={`speaking-suggestion-${item.questionId}-${suggestionIndex}`} className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-700">
                                  {suggestion}
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}

                {section.details.length > 0 ? (
                  <div className="space-y-4">
                    {section.details.map((detail) => {
                      const status = getStatusStyle(detail);
                      return (
                        <div key={detail.id} className="rounded-[24px] border border-slate-200 bg-white p-5">
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
        <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
          <StepHeading
            step="03"
            title={isCn ? "总结与提升建议" : "Summary & Next Steps"}
            description=""
            icon={<Sparkles className="h-5 w-5" />}
            iconClassName="bg-blue-50 text-blue-600"
          />

          <div className="mt-6 space-y-5">
            <div className="rounded-[30px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-6 shadow-sm">
              <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="h-2.5 w-2.5 rounded-full bg-violet-500" />
                    <h3 className="text-base font-semibold text-slate-900">
                      {isCn ? "整体结论" : "Overall Analysis"}
                    </h3>
                  </div>
                  <p className="mt-4 text-sm leading-8 text-slate-700">
                    {isCn ? (report.overallSummary_cn || report.summary_cn) : (report.overallSummary_en || report.summary_en)}
                  </p>
                </div>

                <div className="rounded-[24px] border border-blue-100 bg-white px-5 py-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-500">
                    {isCn ? "时间表现" : "Time Management"}
                  </p>
                  <p className="mt-3 text-sm leading-7 text-slate-700">
                    {isCn ? report.timeAnalysis_cn : report.timeAnalysis_en}
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
                      className="rounded-[26px] border border-slate-200 bg-slate-50/80 p-5"
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
                        {isCn ? stage.stage_cn : stage.stage_en}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {isCn ? stage.focus_cn : stage.focus_en}
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
                            <p>{action}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {(isCn ? report.parentFeedback_cn : report.parentFeedback_en) ? (
              <div className="rounded-[30px] border border-rose-100 bg-[linear-gradient(180deg,#fff6f7_0%,#fff1f3_100%)] px-6 py-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                  <h3 className="text-base font-semibold text-rose-900">
                    {isCn ? "给家长的话" : "Parent Feedback"}
                  </h3>
                </div>
                <p className="mt-4 text-sm leading-8 text-rose-900">
                  {isCn ? report.parentFeedback_cn : report.parentFeedback_en}
                </p>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
