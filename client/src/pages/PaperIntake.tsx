import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Bot, Download, FileJson, FileUp, Loader2, MonitorSmartphone, Sparkles, Trash2 } from "lucide-react";
import type { PaperDraft, PaperDraftFileRole, PaperDraftSection, PaperDraftSectionKey } from "@shared/paperDraft";
import { PAPER_CATEGORY_LABELS, PAPER_SUBJECT_LABELS, type PaperCategory, type PaperSubject } from "@/data/papers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { buildPaperDraftFromBrowser, revokePaperDraftObjectUrls } from "@/lib/paperDraftClient";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

type IntakeFile = {
  id: string;
  file: File;
  role: PaperDraftFileRole;
};

const FILE_ROLE_LABELS: Record<PaperDraftFileRole, string> = {
  question_pdf: "Question PDF",
  answer_pdf: "Answer PDF",
  audio: "Audio",
  image: "Image",
  reference: "Reference",
};

const SECTION_KEY_LABELS: Record<PaperDraftSectionKey, string> = {
  vocabulary: "Vocabulary",
  grammar: "Grammar",
  reading: "Reading",
  writing: "Writing",
  listening: "Listening",
  speaking: "Speaking",
  math: "Math",
  mixed: "Mixed",
};

function createLocalId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `file_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error(`Failed to read ${file.name}`));
        return;
      }
      const [, base64 = ""] = result.split(",");
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error || new Error(`Failed to read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

function guessFileRole(file: File, existingFiles: IntakeFile[]): PaperDraftFileRole {
  const name = file.name.toLowerCase();

  if (file.type.startsWith("audio/")) return "audio";
  if (file.type.startsWith("image/")) return "image";

  if (file.type === "application/pdf" || name.endsWith(".pdf") || name.endsWith(".txt")) {
    if (/answer|answers|key|solution|答案/.test(name)) {
      return "answer_pdf";
    }

    const hasQuestionPdf = existingFiles.some((item) => item.role === "question_pdf");
    return hasQuestionPdf ? "answer_pdf" : "question_pdf";
  }

  return "reference";
}

export default function PaperIntake() {
  const aiDraftMutation = trpc.papers.generateAiDraft.useMutation();
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState<PaperSubject>("english");
  const [category, setCategory] = useState<PaperCategory>("assessment");
  const [tagsInput, setTagsInput] = useState("");
  const [files, setFiles] = useState<IntakeFile[]>([]);
  const [draft, setDraft] = useState<PaperDraft | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState("");
  const runtimeStatusQuery = trpc.system.runtimeStatus.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const parsedTags = useMemo(
    () => tagsInput.split(",").map((tag) => tag.trim()).filter(Boolean),
    [tagsInput],
  );
  const aiReady = Boolean(runtimeStatusQuery.data?.aiConfigured);
  const aiModeLabel = runtimeStatusQuery.isLoading
    ? "Checking AI runtime"
    : aiReady
      ? "Gemini 2.5 Pro ready"
      : "AI runtime unavailable";

  useEffect(() => () => revokePaperDraftObjectUrls(draft), [draft]);

  const handleFileSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    if (selectedFiles.length === 0) return;

    setFiles((prev) => [
      ...prev,
      ...selectedFiles.map((file) => ({
        id: createLocalId(),
        file,
        role: guessFileRole(file, prev),
      })),
    ]);

    event.target.value = "";
  };

  const updateFileRole = (fileId: string, role: PaperDraftFileRole) => {
    setFiles((prev) => prev.map((item) => (item.id === fileId ? { ...item, role } : item)));
  };

  const removeFile = (fileId: string) => {
    setFiles((prev) => prev.filter((item) => item.id !== fileId));
  };

  const applyGeneratedDraft = (nextDraft: PaperDraft, successMessage: string) => {
    revokePaperDraftObjectUrls(draft);
    setDraft(nextDraft);
    toast.success(successMessage);
  };

  const updateDraftMeta = (
    key: "title" | "subtitle" | "description" | "suggestedPaperId",
    value: string,
  ) => {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const updateDraftSection = (
    sectionId: string,
    updater: (section: PaperDraftSection) => PaperDraftSection,
  ) => {
    setDraft((prev) => {
      if (!prev) return prev;

      return {
        ...prev,
        sections: prev.sections.map((section) => (
          section.id === sectionId ? updater(section) : section
        )),
      };
    });
  };

  const buildServerPayloadFiles = async () => {
    const payloadFiles = [];

    for (let index = 0; index < files.length; index += 1) {
      const item = files[index];
      setGenerationStatus(`Uploading ${index + 1}/${files.length}: ${item.file.name}`);
      payloadFiles.push({
        id: item.id,
        role: item.role,
        fileName: item.file.name,
        contentType: item.file.type || "application/octet-stream",
        fileBase64: await fileToBase64(item.file),
      });
    }

    return payloadFiles;
  };

  const handleGenerateDraft = async () => {
    if (!title.trim()) {
      toast.error("Please enter a paper title.");
      return;
    }

    if (files.length === 0) {
      toast.error("Upload at least one source file.");
      return;
    }

    setIsGenerating(true);
    setGenerationStatus("Preparing local parser...");

    try {
      const result = await buildPaperDraftFromBrowser({
        title: title.trim(),
        subtitle: subtitle.trim(),
        description: description.trim(),
        subject,
        category,
        tags: parsedTags,
        files: files.map((item) => ({
          id: item.id,
          role: item.role,
          fileName: item.file.name,
          contentType: item.file.type || "application/octet-stream",
          file: item.file,
        })),
        onProgress: setGenerationStatus,
      });

      applyGeneratedDraft(result, "Local paper draft generated.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to generate paper draft";
      toast.error(message);
    } finally {
      setIsGenerating(false);
      setGenerationStatus("");
    }
  };

  const handleGenerateAIDraft = async () => {
    if (!title.trim()) {
      toast.error("Please enter a paper title.");
      return;
    }

    if (files.length === 0) {
      toast.error("Upload at least one source file.");
      return;
    }

    if (!aiReady) {
      toast.error("AI extraction is unavailable on this server. Configure Forge AI first.");
      return;
    }

    setIsGenerating(true);
    setGenerationStatus("Preparing Gemini 2.5 Pro extraction...");

    try {
      const payloadFiles = await buildServerPayloadFiles();
      setGenerationStatus("Running Gemini 2.5 Pro multi-round extraction...");

      const result = await aiDraftMutation.mutateAsync({
        title: title.trim(),
        subtitle: subtitle.trim(),
        description: description.trim(),
        subject,
        category,
        tags: parsedTags,
        files: payloadFiles,
      });

      applyGeneratedDraft(result, "AI paper draft generated.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to generate AI paper draft";
      toast.error(message);
    } finally {
      setIsGenerating(false);
      setGenerationStatus("");
    }
  };

  const handleDownloadDraft = () => {
    if (!draft) return;
    const blob = new Blob([JSON.stringify(draft, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${draft.suggestedPaperId || "paper-draft"}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#F6F8FB]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link href="/">
              <a className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors">
                <ArrowLeft className="w-4 h-4" />
                Back to Assessments
              </a>
            </Link>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#1E3A5F]">Paper Intake</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              Upload source files, run Gemini 2.5 Pro multi-round extraction on the server when available, and review the
              resulting JSON draft before publishing. Local browser parsing remains available as a fallback.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#D4A84B]/30 bg-[#D4A84B]/10 px-4 py-2 text-sm font-medium text-[#8A6318]">
              <Bot className="w-4 h-4" />
              {aiModeLabel}
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#1E3A5F]/15 bg-[#1E3A5F]/5 px-4 py-2 text-sm font-medium text-[#1E3A5F]">
              <MonitorSmartphone className="w-4 h-4" />
              Local browser parse fallback
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle>Draft Setup</CardTitle>
              <CardDescription>
                Define the paper metadata, upload your PDFs and media, then generate a draft.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="paper-title">Paper Title</Label>
                  <Input
                    id="paper-title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="e.g. PET Practice Paper 3"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="paper-subtitle">Subtitle</Label>
                  <Input
                    id="paper-subtitle"
                    value={subtitle}
                    onChange={(event) => setSubtitle(event.target.value)}
                    placeholder="Optional subtitle"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="paper-tags">Tags</Label>
                  <Input
                    id="paper-tags"
                    value={tagsInput}
                    onChange={(event) => setTagsInput(event.target.value)}
                    placeholder="PET, Cambridge, Practice"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="paper-subject">Subject</Label>
                  <select
                    id="paper-subject"
                    value={subject}
                    onChange={(event) => setSubject(event.target.value as PaperSubject)}
                    className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                  >
                    {Object.entries(PAPER_SUBJECT_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="paper-category">Category</Label>
                  <select
                    id="paper-category"
                    value={category}
                    onChange={(event) => setCategory(event.target.value as PaperCategory)}
                    className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                  >
                    {Object.entries(PAPER_CATEGORY_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="paper-description">Description</Label>
                  <Textarea
                    id="paper-description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Describe this assessment briefly"
                    rows={4}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label htmlFor="paper-files">Source Files</Label>
                    <p className="text-xs text-slate-500 mt-1">
                      Supported now: PDFs, TXT, audio, and images. AI extraction uses server-side Gemini 2.5 Pro when the
                      runtime is configured; otherwise you can still build a local scaffold draft in the browser.
                    </p>
                  </div>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-[#1E3A5F]/30 bg-white px-4 py-2 text-sm font-medium text-[#1E3A5F] hover:border-[#D4A84B] hover:text-[#A97C21] transition-colors">
                    <FileUp className="w-4 h-4" />
                    Add Files
                    <input
                      id="paper-files"
                      type="file"
                      multiple
                      accept=".pdf,.txt,audio/*,image/*"
                      onChange={handleFileSelection}
                      className="hidden"
                    />
                  </label>
                </div>

                <div className="space-y-3">
                  {files.length === 0 && (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                      No files selected yet.
                    </div>
                  )}

                  {files.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 md:flex-row md:items-center md:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800">{item.file.name}</p>
                        <p className="text-xs text-slate-500">
                          {item.file.type || "application/octet-stream"} · {formatFileSize(item.file.size)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <select
                          value={item.role}
                          onChange={(event) => updateFileRole(item.id, event.target.value as PaperDraftFileRole)}
                          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
                        >
                          {Object.entries(FILE_ROLE_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeFile(item.id)}
                          className="text-slate-500 hover:text-red-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                {!aiReady && !runtimeStatusQuery.isLoading && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                    AI extraction is disabled because the server is missing Forge AI configuration. You can still use local
                    parsing from this page.
                  </div>
                )}

                <div className="flex flex-wrap justify-end gap-3">
                  <Button
                    type="button"
                    onClick={handleGenerateDraft}
                    disabled={isGenerating}
                    variant="outline"
                    className="min-w-[220px]"
                  >
                    {isGenerating ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {generationStatus || "Generating Draft..."}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        <FileJson className="w-4 h-4" />
                        Generate Local Draft
                      </span>
                    )}
                  </Button>

                  <Button
                    type="button"
                    onClick={handleGenerateAIDraft}
                    disabled={isGenerating || !aiReady}
                    className="min-w-[240px] bg-[#1E3A5F] hover:bg-[#16304F]"
                  >
                    {isGenerating ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {generationStatus || "Running AI Extraction..."}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        <Sparkles className="w-4 h-4" />
                        AI Extract With Gemini 2.5 Pro
                      </span>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle>Draft Preview</CardTitle>
                <CardDescription>
                  Review the scaffolded sections before turning this into a final paper definition.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!draft && (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-sm text-slate-500">
                    No draft yet. Generate one to preview the parsed structure.
                  </div>
                )}

                {draft && (
                  <>
                    <div className="rounded-xl bg-slate-50 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{draft.title}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {PAPER_SUBJECT_LABELS[draft.subject]} · {PAPER_CATEGORY_LABELS[draft.category]} · {draft.sections.length} sections · {draft.parserMode}
                          </p>
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={handleDownloadDraft}>
                          <Download className="w-4 h-4" />
                          Download JSON
                        </Button>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <div className="space-y-2 md:col-span-2">
                          <Label>Draft Title</Label>
                          <Input value={draft.title} onChange={(event) => updateDraftMeta("title", event.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label>Suggested Paper Id</Label>
                          <Input
                            value={draft.suggestedPaperId}
                            onChange={(event) => updateDraftMeta("suggestedPaperId", event.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Subtitle</Label>
                          <Input
                            value={draft.subtitle}
                            onChange={(event) => updateDraftMeta("subtitle", event.target.value)}
                          />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <Label>Description</Label>
                          <Textarea
                            rows={3}
                            value={draft.description}
                            onChange={(event) => updateDraftMeta("description", event.target.value)}
                          />
                        </div>
                      </div>
                    </div>

                    {draft.warnings.length > 0 && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                        <p className="text-sm font-semibold text-amber-800">Warnings</p>
                        <ul className="mt-2 space-y-1 text-xs text-amber-700">
                          {draft.warnings.map((warning) => (
                            <li key={warning}>- {warning}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="space-y-3">
                      {draft.sections.map((section) => (
                        <div key={section.id} className="rounded-xl border border-slate-200 p-4">
                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-2 md:col-span-2">
                              <Label>Section Title</Label>
                              <Input
                                value={section.title}
                                onChange={(event) =>
                                  updateDraftSection(section.id, (current) => ({ ...current, title: event.target.value }))
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Section Type</Label>
                              <select
                                value={section.sectionKey}
                                onChange={(event) =>
                                  updateDraftSection(section.id, (current) => ({
                                    ...current,
                                    sectionKey: event.target.value as PaperDraftSectionKey,
                                  }))
                                }
                                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                              >
                                {Object.entries(SECTION_KEY_LABELS).map(([value, label]) => (
                                  <option key={value} value={value}>
                                    {label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="space-y-2">
                              <Label>Question Count Hint</Label>
                              <Input
                                type="number"
                                min={0}
                                value={section.questionCountHint}
                                onChange={(event) =>
                                  updateDraftSection(section.id, (current) => ({
                                    ...current,
                                    questionCountHint: Number(event.target.value || 0),
                                  }))
                                }
                              />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                              <Label>Instructions</Label>
                              <Textarea
                                rows={3}
                                value={section.instructions}
                                onChange={(event) =>
                                  updateDraftSection(section.id, (current) => ({
                                    ...current,
                                    instructions: event.target.value,
                                  }))
                                }
                              />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                              <Label>Source Excerpt</Label>
                              <Textarea
                                rows={6}
                                value={section.sourceExcerpt}
                                onChange={(event) =>
                                  updateDraftSection(section.id, (current) => ({
                                    ...current,
                                    sourceExcerpt: event.target.value,
                                  }))
                                }
                              />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                              <Label>Answer Excerpt</Label>
                              <Textarea
                                rows={5}
                                value={section.answerExcerpt}
                                onChange={(event) =>
                                  updateDraftSection(section.id, (current) => ({
                                    ...current,
                                    answerExcerpt: event.target.value,
                                  }))
                                }
                              />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                              <Label>Review Notes</Label>
                              <Textarea
                                rows={4}
                                value={section.notes.join("\n")}
                                onChange={(event) =>
                                  updateDraftSection(section.id, (current) => ({
                                    ...current,
                                    notes: event.target.value
                                      .split("\n")
                                      .map((note) => note.trim())
                                      .filter(Boolean),
                                  }))
                                }
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {draft.nextSteps.length > 0 && (
                      <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <p className="text-sm font-semibold text-slate-800">Next Steps</p>
                        <ul className="mt-3 space-y-1 text-xs text-slate-500">
                          {draft.nextSteps.map((step) => (
                            <li key={step}>- {step}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle>Draft JSON</CardTitle>
                <CardDescription>
                  This is the stable shape you can later feed into an LLM post-processor or editor UI.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="max-h-[34rem] overflow-auto rounded-xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">
                  {draft ? JSON.stringify(draft, null, 2) : "{\n  // Generate a draft to preview the schema\n}"}
                </pre>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
