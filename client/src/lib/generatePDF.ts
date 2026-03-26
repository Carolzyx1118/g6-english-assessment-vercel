import { APP_BRAND_TITLE } from "@/lib/branding";

export interface PDFData {
  studentName: string;
  studentGrade: string | null;
  paperId: string;
  paperTitle: string;
  totalCorrect: number;
  totalQuestions: number;
  totalTimeSeconds: number | null;
  answersJson: string;
  scoreBySectionJson: string | null;
  sectionTimingsJson: string | null;
  readingResultsJson: string | null;
  writingResultJson: string | null;
  explanationsJson: string | null;
  reportJson: string | null;
  createdAt: Date | string;
}

export type PDFLocale = "en" | "cn";

interface StoredPrintableAssessmentReport {
  createdAt: number;
  locale: PDFLocale;
  record: PDFData;
}

const STORAGE_PREFIX = "pureon_printable_assessment_report_v1:";
const STORAGE_TTL_MS = 30 * 60 * 1000;

function getStorageKey(key: string) {
  return `${STORAGE_PREFIX}${key}`;
}

function createPrintKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `print-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function cleanupExpiredPrintableAssessmentReports() {
  if (typeof window === "undefined") return;

  const now = Date.now();
  const expiredKeys: string[] = [];

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key || !key.startsWith(STORAGE_PREFIX)) continue;

    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) {
        expiredKeys.push(key);
        continue;
      }

      const parsed = JSON.parse(raw) as Partial<StoredPrintableAssessmentReport>;
      if (typeof parsed.createdAt !== "number" || now - parsed.createdAt > STORAGE_TTL_MS) {
        expiredKeys.push(key);
      }
    } catch {
      expiredKeys.push(key);
    }
  }

  expiredKeys.forEach((key) => window.localStorage.removeItem(key));
}

export function readPrintableAssessmentReport(key: string): StoredPrintableAssessmentReport | null {
  if (typeof window === "undefined" || !key.trim()) return null;

  cleanupExpiredPrintableAssessmentReports();

  try {
    const raw = window.localStorage.getItem(getStorageKey(key));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<StoredPrintableAssessmentReport>;
    if (
      typeof parsed.createdAt !== "number"
      || !parsed.record
      || typeof parsed.record !== "object"
    ) {
      return null;
    }

    return {
      createdAt: parsed.createdAt,
      locale: parsed.locale === "en" ? "en" : "cn",
      record: parsed.record as PDFData,
    };
  } catch {
    return null;
  }
}

export function removePrintableAssessmentReport(key: string) {
  if (typeof window === "undefined" || !key.trim()) return;
  window.localStorage.removeItem(getStorageKey(key));
}

export async function generateReportPDF(data: PDFData, locale: PDFLocale = "cn"): Promise<void> {
  if (typeof window === "undefined") return;

  cleanupExpiredPrintableAssessmentReports();

  const key = createPrintKey();
  const payload: StoredPrintableAssessmentReport = {
    createdAt: Date.now(),
    locale,
    record: data,
  };

  try {
    window.localStorage.setItem(getStorageKey(key), JSON.stringify(payload));
  } catch {
    throw new Error(
      locale === "cn"
        ? "打印版报告暂时无法缓存到浏览器，请先清理一些站点存储后重试。"
        : "The printable report could not be cached in this browser. Please clear some site storage and try again.",
    );
  }

  const printUrl = new URL("/assessment-report/print", window.location.origin);
  printUrl.searchParams.set("key", key);

  const printWindow = window.open(printUrl.toString(), "_blank");
  if (!printWindow) {
    removePrintableAssessmentReport(key);
    throw new Error(
      locale === "cn"
        ? "浏览器拦截了打印窗口，请允许弹窗后重试。"
        : "The print window was blocked by the browser. Please allow pop-ups and try again.",
    );
  }

  printWindow.document.title = `${data.paperTitle} | ${APP_BRAND_TITLE}`;
  printWindow.focus();
}
