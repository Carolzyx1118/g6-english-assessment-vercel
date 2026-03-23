import { PAPER_SUBJECT_ORDER, type PaperSubject } from "@/data/papers";

export function getGeneratedPaperSubjectFromPaperId(paperId: string): PaperSubject | null {
  const match = /^tag-system-(english|math|vocabulary)-/i.exec(paperId.trim());
  if (!match) return null;

  const subject = match[1]?.toLowerCase();
  return PAPER_SUBJECT_ORDER.includes(subject as PaperSubject)
    ? (subject as PaperSubject)
    : null;
}
