import { useEffect, useMemo, useRef, useState } from "react";
import { Globe, Printer, X } from "lucide-react";
import { useSearch } from "wouter";
import AssessmentReportPanel from "@/components/AssessmentReportPanel";
import { Button } from "@/components/ui/button";
import type { AssessmentReviewRecord, ReviewLocale } from "@/lib/assessmentReview";
import {
  readPrintableAssessmentReport,
  removePrintableAssessmentReport,
} from "@/lib/generatePDF";

const PRINT_PAGE_STYLES = `
  @page {
    size: A4;
    margin: 10mm;
  }

  @media print {
    html, body {
      background: #ffffff !important;
      margin: 0;
      padding: 0;
      font-size: 13px !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .report-print-toolbar {
      display: none !important;
    }

    .report-print-shell {
      max-width: none !important;
      padding: 0 !important;
    }

    .print-assessment-report {
      gap: 14px !important;
    }

    .print-assessment-report .report-shell-card,
    .print-assessment-report .report-summary-card,
    .print-assessment-report .report-breakdown-card,
    .print-assessment-report .report-detail-card,
    .print-assessment-report .report-question-card,
    .print-assessment-report .report-list-card,
    .print-assessment-report .report-list-item,
    .print-assessment-report .report-study-stage,
    .print-assessment-report .report-parent-card,
    .print-assessment-report .report-overview-card,
    .print-assessment-report .report-material-card,
    .print-assessment-report .report-image-card {
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .print-assessment-report .report-shell-card,
    .print-assessment-report .report-list-card,
    .print-assessment-report .report-parent-card,
    .print-assessment-report .report-overview-card {
      border-radius: 22px !important;
      box-shadow: none !important;
    }

    .print-assessment-report .report-hero {
      padding: 18px 20px !important;
    }

    .print-assessment-report .report-hero-name {
      font-size: 1.9rem !important;
      line-height: 1.1 !important;
    }

    .print-assessment-report .report-profile-name {
      font-size: 1rem !important;
      line-height: 1.3 !important;
    }

    .print-assessment-report .report-summary-card {
      padding: 14px !important;
      border-radius: 18px !important;
      box-shadow: none !important;
    }

    .print-assessment-report .report-summary-grade {
      font-size: 3rem !important;
    }

    .print-assessment-report .report-summary-score {
      font-size: 2.25rem !important;
    }

    .print-assessment-report .report-summary-score > span {
      font-size: 1.15rem !important;
    }

    .print-assessment-report .report-summary-time {
      font-size: 2rem !important;
      gap: 10px !important;
    }

    .print-assessment-report .report-summary-time svg {
      width: 22px !important;
      height: 22px !important;
    }

    .print-assessment-report .report-section-heading h2 {
      font-size: 1.2rem !important;
    }

    .print-assessment-report .report-section-heading p {
      font-size: 0.8rem !important;
      line-height: 1.45 !important;
    }

    .print-assessment-report .report-breakdown-card,
    .print-assessment-report .report-detail-card,
    .print-assessment-report .report-question-card,
    .print-assessment-report .report-study-stage,
    .print-assessment-report .report-material-card {
      border-radius: 18px !important;
      box-shadow: none !important;
    }

    .print-assessment-report .report-breakdown-card {
      padding: 14px !important;
    }

    .print-assessment-report .report-breakdown-score {
      font-size: 1.9rem !important;
    }

    .print-assessment-report .report-detail-summary {
      padding: 16px 18px !important;
    }

    .print-assessment-report .report-detail-body {
      padding: 14px 16px !important;
      gap: 12px !important;
    }

    .print-assessment-report .report-question-card,
    .print-assessment-report .report-list-card,
    .print-assessment-report .report-overview-card,
    .print-assessment-report .report-parent-card {
      padding: 16px !important;
    }

    .print-assessment-report .report-list-item {
      padding: 12px !important;
      border-radius: 14px !important;
    }

    .print-assessment-report p {
      line-height: 1.65 !important;
    }
  }
`;

export default function AssessmentReportPrint() {
  const search = useSearch();
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const printKey = params.get("key")?.trim() || "";
  const [record, setRecord] = useState<AssessmentReviewRecord | null>(null);
  const [locale, setLocale] = useState<ReviewLocale>("cn");
  const [error, setError] = useState<string | null>(null);
  const hasTriggeredPrintRef = useRef(false);

  useEffect(() => {
    if (!printKey) {
      setError("Missing print key.");
      return;
    }

    const payload = readPrintableAssessmentReport(printKey);
    removePrintableAssessmentReport(printKey);

    if (!payload) {
      setError("The printable report data could not be restored. Re-open the report and try again.");
      return;
    }

    setRecord(payload.record as AssessmentReviewRecord);
    setLocale(payload.locale);
    setError(null);
  }, [printKey]);

  useEffect(() => {
    if (!record) return;

    document.title = `${record.paperTitle} - ${record.studentName}`;

    if (hasTriggeredPrintRef.current) return;
    hasTriggeredPrintRef.current = true;

    const timer = window.setTimeout(() => {
      window.print();
    }, 500);

    return () => {
      window.clearTimeout(timer);
    };
  }, [record]);

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 text-slate-900 sm:px-6">
      <style>{PRINT_PAGE_STYLES}</style>

      <div className="report-print-toolbar mx-auto mb-5 flex max-w-[1180px] flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Printable Assessment Report</h1>
          <p className="text-sm text-slate-500">
            This page uses the same long-report component as the teacher view. Use your browser&apos;s PDF print dialog to save it.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-full border border-slate-200 bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setLocale("cn")}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                locale === "cn" ? "bg-slate-900 text-white" : "text-slate-600"
              }`}
            >
              中文
            </button>
            <button
              type="button"
              onClick={() => setLocale("en")}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                locale === "en" ? "bg-slate-900 text-white" : "text-slate-600"
              }`}
            >
              English
            </button>
          </div>

          <Button type="button" variant="outline" className="gap-2 rounded-full" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Print / Save PDF
          </Button>
          <Button type="button" variant="outline" className="gap-2 rounded-full" onClick={() => window.close()}>
            <X className="h-4 w-4" />
            Close
          </Button>
        </div>
      </div>

      {error ? (
        <div className="report-print-shell mx-auto max-w-[1180px] rounded-[32px] border border-rose-200 bg-white px-6 py-8 shadow-sm">
          <div className="flex items-center gap-3 text-rose-700">
            <Globe className="h-5 w-5" />
            <h2 className="text-lg font-semibold">Unable to load report</h2>
          </div>
          <p className="mt-3 text-sm leading-7 text-slate-600">{error}</p>
        </div>
      ) : record ? (
        <div className="report-print-shell mx-auto max-w-[1180px]">
          <AssessmentReportPanel
            record={record}
            initialLocale={locale}
            hideLocaleToggle
            printMode
            showDownload={false}
          />
        </div>
      ) : (
        <div className="report-print-shell mx-auto max-w-[1180px] rounded-[32px] border border-slate-200 bg-white px-6 py-8 shadow-sm">
          <p className="text-sm text-slate-500">Loading report...</p>
        </div>
      )}
    </div>
  );
}
