import { nanoid } from "nanoid";
import type {
  GeneratePaperDraftInput,
  PaperDraft,
} from "@shared/paperDraft";
import { createPaperDraft } from "@shared/paperDraftBuilder";
import { preparePaperSources } from "./paperSourceIngest";

export async function buildPaperDraft(input: GeneratePaperDraftInput): Promise<PaperDraft> {
  const draftId = `draft_${nanoid(10)}`;
  const { sourceFiles, warnings, rawQuestionText, rawAnswerText } = await preparePaperSources(draftId, input.files);

  return createPaperDraft({
    draftId,
    title: input.title,
    subtitle: input.subtitle,
    description: input.description,
    subject: input.subject,
    category: input.category,
    tags: input.tags,
    sourceFiles,
    rawQuestionText,
    rawAnswerText,
    warnings,
  });
}
