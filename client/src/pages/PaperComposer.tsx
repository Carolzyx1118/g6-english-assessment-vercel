import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { ArrowLeft, Check, Loader2, SquarePen } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import TeacherToolsLayout from "@/components/TeacherToolsLayout";
import type { PaperSubject } from "@/data/papers";
import { PAPER_SUBJECT_LABELS, PAPER_SUBJECT_ORDER } from "@/data/papers";
import type { ManualPaperBlueprint, ManualPaperGenerationConfig } from "@shared/manualPaperBlueprint";
import type { EnglishExamTagTrack } from "@shared/englishQuestionTags";
import {
  generatePaperFromTaggedSources,
  getBlueprintBuildMode,
} from "@shared/taggedPaperGenerator";
import EnglishQuickGeneratedBuilder from "@/components/EnglishQuickGeneratedBuilder";
import {
  buildEnglishQuickGeneratedConfig,
  createEnglishQuickGeneratedPartSelections,
  getEnglishQuickGeneratedDescription,
  getEnglishQuickGeneratedTitle,
  inferTrackFromEnglishQuickGeneratedConfig,
  restoreEnglishQuickGeneratedPartSelections,
  type EnglishQuickGeneratedPartSelection,
} from "@/lib/englishQuickPaperPreset";

function isPaperSubjectValue(value: unknown): value is PaperSubject {
  return typeof value === "string" && PAPER_SUBJECT_ORDER.includes(value as PaperSubject);
}

function createLocalId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `generated_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function createBlueprintId(title: string, paperSeed: string) {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || `paper-${paperSeed}`;
}

function buildGeneratedBlueprint(
  title: string,
  description: string,
  generationConfig: ManualPaperGenerationConfig,
  paperSeed: string,
  createdAt: string,
): ManualPaperBlueprint {
  return {
    id: createBlueprintId(title, paperSeed),
    title: title.trim(),
    description: description.trim(),
    buildMode: "generated",
    visibilityMode: "student",
    generationConfig,
    sections: [],
    createdAt,
  };
}

function validateGeneratedPaper(title: string, generationConfig: ManualPaperGenerationConfig) {
  if (!title.trim()) {
    return "Enter a paper name before saving.";
  }

  if (!generationConfig.sections.length) {
    return "Select at least one Part with a question count greater than 0.";
  }

  for (let index = 0; index < generationConfig.sections.length; index += 1) {
    const section = generationConfig.sections[index];
    if (section.totalQuestions <= 0) {
      return `${section.title || `Part ${index + 1}`} needs a valid question count.`;
    }
  }

  return null;
}

export default function PaperComposer() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const utils = trpc.useUtils();
  const saveManualPaperMutation = trpc.papers.saveManualPaper.useMutation();
  const updateManualPaperMutation = trpc.papers.updateManualPaper.useMutation();
  const requestedSubject = useMemo(() => {
    const value = new URLSearchParams(search).get("subject");
    return isPaperSubjectValue(value) ? value : "english";
  }, [search]);
  const editPaperId = useMemo(
    () => new URLSearchParams(search).get("edit")?.trim() || "",
    [search],
  );
  const isEditing = editPaperId.length > 0;
  const managerHref = `/paper-manager?subject=${requestedSubject}`;
  const [paperSeed] = useState(() => createLocalId());
  const [createdAt] = useState(() => new Date().toISOString());
  const [title, setTitle] = useState(getEnglishQuickGeneratedTitle("ket"));
  const [description, setDescription] = useState(getEnglishQuickGeneratedDescription("ket"));
  const [track, setTrack] = useState<EnglishExamTagTrack>("ket");
  const [parts, setParts] = useState<EnglishQuickGeneratedPartSelection[]>(() =>
    createEnglishQuickGeneratedPartSelections("ket"),
  );
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const [currentPublished, setCurrentPublished] = useState(false);
  const [editingPaperMeta, setEditingPaperMeta] = useState<{ id: number; paperId: string; published: boolean } | null>(null);
  const [hasHydratedEditState, setHasHydratedEditState] = useState(false);
  const generationConfig = useMemo(
    () => buildEnglishQuickGeneratedConfig(track, parts),
    [parts, track],
  );
  const blueprint = useMemo(
    () => buildGeneratedBlueprint(title, description, generationConfig, paperSeed, createdAt),
    [createdAt, description, generationConfig, paperSeed, title],
  );

  const publishedManualPapersQuery = trpc.papers.listManualPapers.useQuery(undefined, {
    staleTime: 5_000,
  });
  const editPaperQuery = trpc.papers.getManualPaperDetail.useQuery(
    { paperId: editPaperId },
    {
      enabled: isEditing,
      staleTime: 0,
      retry: false,
    },
  );

  const generatedPreview = useMemo(() => {
    const sourcePapers = (publishedManualPapersQuery.data ?? []).flatMap((paper) => {
      if (paper.subject !== "english") return [];
      try {
        const parsedBlueprint = JSON.parse(paper.blueprintJson) as ManualPaperBlueprint;
        if (getBlueprintBuildMode(parsedBlueprint) !== "fixed") return [];
        return [{
          paperId: paper.paperId,
          title: paper.title,
          blueprint: parsedBlueprint,
        }];
      } catch {
        return [];
      }
    });

    return generatePaperFromTaggedSources(blueprint, sourcePapers);
  }, [blueprint, publishedManualPapersQuery.data]);

  useEffect(() => {
    setSaveFeedback(null);
  }, [description, parts, title, track]);

  useEffect(() => {
    if (requestedSubject !== "english") {
      navigate(`/paper-intake?subject=${requestedSubject}`);
    }
  }, [navigate, requestedSubject]);

  useEffect(() => {
    if (!isEditing || !editPaperQuery.data || hasHydratedEditState) return;

    try {
      const parsedBlueprint = JSON.parse(editPaperQuery.data.blueprintJson) as ManualPaperBlueprint;
      if (getBlueprintBuildMode(parsedBlueprint) !== "generated") {
        navigate(`/paper-intake?edit=${encodeURIComponent(editPaperId)}&subject=${requestedSubject}`);
        return;
      }

      const nextTrack = inferTrackFromEnglishQuickGeneratedConfig(parsedBlueprint.generationConfig);
      const nextParts = restoreEnglishQuickGeneratedPartSelections(nextTrack, parsedBlueprint.generationConfig);
      setTitle(editPaperQuery.data.title || getEnglishQuickGeneratedTitle(nextTrack));
      setDescription(editPaperQuery.data.description || getEnglishQuickGeneratedDescription(nextTrack));
      setTrack(nextTrack);
      setParts(nextParts);
      setEditingPaperMeta({
        id: editPaperQuery.data.id,
        paperId: editPaperQuery.data.paperId,
        published: editPaperQuery.data.published,
      });
      setCurrentPublished(editPaperQuery.data.published);
      setHasHydratedEditState(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load the generated paper.");
      navigate(managerHref);
    }
  }, [editPaperId, editPaperQuery.data, hasHydratedEditState, isEditing, managerHref, navigate, requestedSubject]);

  useEffect(() => {
    if (!editPaperQuery.error) return;
    toast.error(editPaperQuery.error.message || "Failed to load the generated paper.");
    navigate(managerHref);
  }, [editPaperQuery.error, managerHref, navigate]);

  const isPersisting = saveManualPaperMutation.isPending || updateManualPaperMutation.isPending;
  const saveDisabled = Boolean(
    validateGeneratedPaper(title, generationConfig)
    || isPersisting
    || (isEditing && !editingPaperMeta),
  );

  const persistPaper = async (published: boolean) => {
    const validationError = validateGeneratedPaper(title, generationConfig);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    const preparedBlueprintJson = JSON.stringify(blueprint);
    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim() || undefined;

    try {
      if (isEditing) {
        if (!editingPaperMeta) {
          throw new Error("The paper is still loading. Please wait a moment and try again.");
        }

        await updateManualPaperMutation.mutateAsync({
          id: editingPaperMeta.id,
          title: trimmedTitle,
          description: trimmedDescription,
          subject: "english",
          published,
          blueprintJson: preparedBlueprintJson,
        });
        await Promise.all([
          utils.papers.listManualPapers.invalidate(),
          utils.papers.listAllManualPapers.invalidate(),
          utils.papers.getManualPaperDetail.invalidate({ paperId: editingPaperMeta.paperId }),
        ]);
      } else {
        await saveManualPaperMutation.mutateAsync({
          paperId: `manual-${paperSeed}`,
          title: trimmedTitle,
          description: trimmedDescription,
          subject: "english",
          published,
          blueprintJson: preparedBlueprintJson,
        });
        await Promise.all([
          utils.papers.listManualPapers.invalidate(),
          utils.papers.listAllManualPapers.invalidate(),
        ]);
      }

      setCurrentPublished(published);
      setSaveFeedback(published ? "Generated paper saved." : "Draft saved.");
      toast.success(published ? "Generated paper published successfully." : "Draft saved successfully.");
      setTimeout(() => navigate(managerHref), 1200);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save the generated paper.");
    }
  };

  if (isEditing && editPaperQuery.isLoading && !hasHydratedEditState) {
    return (
      <TeacherToolsLayout activeTool="paper-composer" currentSubject="english">
        <div className="min-h-screen bg-[#F6F8FB] px-4 py-10 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl">
            <div className="flex items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-sm text-slate-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading generated paper...
            </div>
          </div>
        </div>
      </TeacherToolsLayout>
    );
  }

  return (
    <TeacherToolsLayout activeTool="paper-composer" currentSubject="english">
      <div className="min-h-screen bg-[#F6F8FB] px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700">
              <ArrowLeft className="h-4 w-4" />
              Back to Assessments
            </Link>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#1E3A5F]">
              {isEditing ? "Edit Generated Paper" : "Add Generated Paper"}
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-500">
              This page is only for assembling random English papers from tagged question banks. Recording questions stays in Paper Intake.
            </p>
          </div>

          <Link href={managerHref}>
            <Button variant="outline" className="border-slate-200">
              Back to Paper Manager
            </Button>
          </Link>
        </div>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>Paper Info</CardTitle>
            <CardDescription>Name this generated paper before saving or publishing it.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Subject</Label>
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
                {PAPER_SUBJECT_LABELS.english}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="generated-paper-title">Paper Name</Label>
              <Input
                id="generated-paper-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. KET Mock Paper 1"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="generated-paper-description">Description</Label>
              <Textarea
                id="generated-paper-description"
                rows={3}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Describe what this generated paper is for."
              />
            </div>
          </CardContent>
        </Card>

        <EnglishQuickGeneratedBuilder
          track={track}
          parts={parts}
          onTrackChange={(nextTrack) => {
            setTrack(nextTrack);
            setParts(createEnglishQuickGeneratedPartSelections(nextTrack));
          }}
          onPartChange={(partId, updater) => {
            setParts((current) => current.map((part) => (part.id === partId ? updater(part) : part)));
          }}
        />

          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <div className={`rounded-full px-3 py-1 font-semibold ${currentPublished ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                {currentPublished ? "Status: Published" : "Status: Draft"}
              </div>
              {saveFeedback ? (
                <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-2 text-emerald-700">
                  <Check className="h-4 w-4" />
                  <span className="font-medium">{saveFeedback}</span>
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={saveDisabled}
                onClick={() => persistPaper(false)}
                className="gap-2 border-slate-200 px-4"
              >
                {isPersisting ? <Loader2 className="h-4 w-4 animate-spin" /> : <SquarePen className="h-4 w-4" />}
                {isEditing ? "Save Draft Changes" : "Save Draft"}
              </Button>

              <Button
                type="button"
                disabled={saveDisabled}
                onClick={() => persistPaper(true)}
                className="gap-2 bg-[#1E3A5F] px-5 text-white shadow-lg transition-all hover:bg-[#2a4f7a] hover:shadow-xl"
              >
                {isPersisting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                {isEditing && currentPublished ? "Update Published Paper" : "Publish Paper"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </TeacherToolsLayout>
  );
}
