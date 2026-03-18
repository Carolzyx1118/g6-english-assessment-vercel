import type { PaperSubject } from "@/data/papers";
import type { ManualQuestion, ManualSubsection } from "@shared/manualPaperBlueprint";

const SUBJECT_CODE: Record<PaperSubject, string> = {
  english: "ENG",
  math: "MATH",
  vocabulary: "VOC",
};

function normalizeQuestionBankToken(value: string) {
  const compact = value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (compact.length >= 8) {
    return `${compact.slice(0, 4)}${compact.slice(-4)}`;
  }
  return compact || "ITEM0001";
}

function getQuestionPrompt(question: ManualQuestion | undefined) {
  if (!question) return "";
  if ("prompt" in question && typeof question.prompt === "string") {
    return question.prompt;
  }
  return "";
}

function trimPreviewText(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  return normalized.length > 140 ? `${normalized.slice(0, 137)}...` : normalized;
}

export function formatQuestionBankItemId(subject: PaperSubject, subsectionId: string) {
  return `${SUBJECT_CODE[subject]}-QB-${normalizeQuestionBankToken(subsectionId)}`;
}

export function getQuestionBankItemSummary(subsection: ManualSubsection) {
  const primaryText = [
    subsection.title,
    subsection.instructions,
    subsection.taskDescription,
    subsection.passageText,
    getQuestionPrompt(subsection.questions[0]),
  ].find((value) => typeof value === "string" && value.trim().length > 0);

  return trimPreviewText(primaryText || "") || "No content preview yet.";
}
