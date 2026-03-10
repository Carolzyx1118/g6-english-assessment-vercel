import { useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, FileJson, FileUp, Loader2, Sparkles, Trash2 } from "lucide-react";
import type { PaperDraft, PaperDraftFileRole } from "@shared/paperDraft";
import { trpc } from "@/lib/trpc";
import { PAPER_CATEGORY_LABELS, PAPER_SUBJECT_LABELS, type PaperCategory, type PaperSubject } from "@/data/papers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState<PaperSubject>("english");
  const [category, setCategory] = useState<PaperCategory>("assessment");
  const [tagsInput, setTagsInput] = useState("");
  const [files, setFiles] = useState<IntakeFile[]>([]);
  const [draft, setDraft] = useState<PaperDraft | null>(null);

  const generateDraftMutation = trpc.papers.generateDraft.useMutation({
    onSuccess: (result) => {
      setDraft(result);
      toast.success("Paper draft generated.");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to generate paper draft");
    },
  });

  const parsedTags = useMemo(
    () => tagsInput.split(",").map((tag) => tag.trim()).filter(Boolean),
    [tagsInput],
  );

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

  const handleGenerateDraft = async () => {
    if (!title.trim()) {
      toast.error("Please enter a paper title.");
      return;
    }

    if (files.length === 0) {
      toast.error("Upload at least one source file.");
      return;
    }

    const payloadFiles = await Promise.all(
      files.map(async (item) => ({
        id: item.id,
        role: item.role,
        fileName: item.file.name,
        contentType: item.file.type || "application/octet-stream",
        fileBase64: await fileToBase64(item.file),
      })),
    );

    generateDraftMutation.mutate({
      title: title.trim(),
      subtitle: subtitle.trim(),
      description: description.trim(),
      subject,
      category,
      tags: parsedTags,
      files: payloadFiles,
    });
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
              Upload source files and generate a structured draft that matches the current assessment data model.
              This first version builds a reviewable scaffold and keeps all uploaded assets attached for later cleanup.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#D4A84B]/30 bg-[#D4A84B]/10 px-4 py-2 text-sm font-medium text-[#8A6318]">
            <Sparkles className="w-4 h-4" />
            Ready for future GPT-4o parser swap-in
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
                      Supported now: PDFs, TXT, audio, and images. PDFs are uploaded and text-extracted into the draft.
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

              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={handleGenerateDraft}
                  disabled={generateDraftMutation.isPending}
                  className="min-w-[220px] bg-[#1E3A5F] hover:bg-[#16304F]"
                >
                  {generateDraftMutation.isPending ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating Draft...
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      <FileJson className="w-4 h-4" />
                      Generate Paper Draft
                    </span>
                  )}
                </Button>
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
                      <p className="text-sm font-semibold text-slate-800">{draft.title}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {PAPER_SUBJECT_LABELS[draft.subject]} · {PAPER_CATEGORY_LABELS[draft.category]} · {draft.sections.length} sections
                      </p>
                      <p className="mt-3 text-xs text-slate-500">Suggested paper id: {draft.suggestedPaperId}</p>
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
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-800">{section.title}</p>
                              <p className="text-xs text-slate-500">
                                {section.sectionKey} · ~{section.questionCountHint} questions
                              </p>
                            </div>
                          </div>
                          {section.instructions && (
                            <p className="mt-3 text-xs text-slate-600">
                              <span className="font-semibold text-slate-700">Instructions:</span> {section.instructions}
                            </p>
                          )}
                          <p className="mt-3 line-clamp-4 whitespace-pre-wrap text-xs text-slate-500">{section.sourceExcerpt}</p>
                          {section.notes.length > 0 && (
                            <ul className="mt-3 space-y-1 text-xs text-slate-500">
                              {section.notes.map((note) => (
                                <li key={note}>- {note}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
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
