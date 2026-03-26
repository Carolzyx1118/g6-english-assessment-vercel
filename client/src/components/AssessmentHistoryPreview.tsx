import { useMemo, useState } from "react";
import { Clock3, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { generateReportPDF } from "@/lib/generatePDF";
import {
  buildAssessmentReviewModel,
  formatDuration,
  getSectionDisplayName,
  type AssessmentReviewRecord,
  type ReviewLocale,
} from "@/lib/assessmentReview";

interface AssessmentHistoryPreviewProps {
  record: AssessmentReviewRecord;
}

export default function AssessmentHistoryPreview({
  record,
}: AssessmentHistoryPreviewProps) {
  const [locale, setLocale] = useState<ReviewLocale>("cn");
  const [downloading, setDownloading] = useState(false);
  const model = useMemo(() => buildAssessmentReviewModel(record), [record]);
  const isCn = locale === "cn";

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
    <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
      <div className="bg-[radial-gradient(circle_at_top_left,_rgba(29,78,216,0.22),_transparent_42%),linear-gradient(135deg,#0f172a_0%,#1d4ed8_100%)] px-5 py-5 text-white sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-100">
              {isCn ? "测评概览" : "Assessment Overview"}
            </p>
            <p className="mt-2 text-sm text-blue-100">
              {isCn
                ? "页面只保留核心概览，完整逐题分析和建议请下载 PDF。"
                : "Only the key overview is shown here. Download the PDF for full analysis."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-full border border-white/20 bg-white/10 p-1">
              <button
                type="button"
                onClick={() => setLocale("cn")}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                  isCn ? "bg-white text-slate-900 shadow-sm" : "text-white/80"
                }`}
              >
                中文
              </button>
              <button
                type="button"
                onClick={() => setLocale("en")}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                  !isCn ? "bg-white text-slate-900 shadow-sm" : "text-white/80"
                }`}
              >
                English
              </button>
            </div>

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
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-3xl border border-white/15 bg-white/10 px-5 py-4">
            <p className="text-xs uppercase tracking-[0.18em] text-blue-100">
              {isCn ? "总评等级" : "Overall Grade"}
            </p>
            <p className="mt-2 text-3xl font-bold">{model.grade}</p>
          </div>
          <div className="rounded-3xl border border-white/15 bg-white/10 px-5 py-4">
            <p className="text-xs uppercase tracking-[0.18em] text-blue-100">
              {isCn ? "综合得分" : "Total Score"}
            </p>
            <p className="mt-2 text-3xl font-bold">
              {model.totalScore}/{model.totalPossible}
            </p>
            <p className="mt-1 text-sm text-blue-100">{model.percentage}%</p>
          </div>
          <div className="rounded-3xl border border-white/15 bg-white/10 px-5 py-4">
            <p className="text-xs uppercase tracking-[0.18em] text-blue-100">
              {isCn ? "总用时" : "Total Time"}
            </p>
            <p className="mt-2 flex items-center gap-2 text-2xl font-bold">
              <Clock3 className="h-5 w-5" />
              {formatDuration(model.totalTimeSeconds, locale)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 bg-[#F6F8FB] p-4 md:grid-cols-2 xl:grid-cols-4">
        {model.sections.map((section, index) => (
          <div
            key={section.sectionId}
            className="rounded-[28px] border border-slate-200 bg-white px-5 py-4 shadow-sm"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              {`Part ${index + 1} · ${getSectionDisplayName(section.sectionTitle, section.sectionId, locale)}`}
            </p>
            <p className="mt-4 text-3xl font-bold text-slate-900">
              {section.manualReview
                ? (isCn ? "老师评分" : "Manual Review")
                : `${section.correct}/${section.total}`}
            </p>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-slate-500">
                {section.manualReview ? (isCn ? "人工评分部分" : "Manually reviewed") : `${section.percentage}%`}
              </p>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                {section.timeSeconds > 0 ? formatDuration(section.timeSeconds, locale) : (isCn ? "未记录" : "N/A")}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
