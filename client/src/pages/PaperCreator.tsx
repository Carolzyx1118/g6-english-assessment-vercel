import { useCallback, useMemo, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  Image as ImageIcon,
  ImagePlus,
  Layers3,
  Loader2,
  Music,
  Plus,
  Save,
  Send,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  compressImage,
  fileToBase64,
  formatFileSize,
  validateImageFile,
  type ImageSize,
} from "@/lib/imageUtils";
import {
  ALL_QUESTION_TYPES,
  createEditablePaperFromBlueprint,
  createEditablePaperFromParsed,
  createEmptyQuestionByType,
  paperBlueprints,
  QUESTION_TYPE_META,
  stripEditablePaper,
  suggestBlueprint,
  type EditablePaper,
  type EditableSection,
  type QuestionType,
} from "@/lib/paperBlueprints";
import { extractPdfAssets } from "@/lib/pdfUtils";
import type { Question } from "@/data/papers";

const ADMIN_PASSWORD = import.meta.env.VITE_HISTORY_PASSWORD || "";

type UploadedFile = {
  name: string;
  type: string;
  url: string;
  size: number;
};

type PdfAsset = {
  sourceUrl: string;
  sourceName: string;
  pageCount: number;
  extractedText: string;
  pageImageUrls: string[];
};

type ExtractedImageAsset = {
  url: string;
  description: string;
  target: string;
  sourceUrl: string;
};

type ReferenceAsset = {
  url: string;
  label: string;
  meta?: string;
};

type RuntimeStatus = {
  aiConfigured: boolean;
  storageConfigured: boolean;
  aiProvider: "forge" | "local";
  storageProvider: "forge" | "local";
  usingLocalFallback: boolean;
  missingVariables: string[];
};

function isPdfFile(file: Pick<UploadedFile, "name" | "type"> | File): boolean {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }

  return fallback;
}

function pushReferenceAsset(
  items: ReferenceAsset[],
  seenUrls: Set<string>,
  asset: ReferenceAsset
) {
  if (!asset.url || seenUrls.has(asset.url)) {
    return;
  }

  seenUrls.add(asset.url);
  items.push(asset);
}

function buildReferenceAssets({
  files,
  pdfAssets,
  extractedImageAssets,
}: {
  files: UploadedFile[];
  pdfAssets: PdfAsset[];
  extractedImageAssets: ExtractedImageAsset[];
}): ReferenceAsset[] {
  const items: ReferenceAsset[] = [];
  const seenUrls = new Set<string>();

  extractedImageAssets.forEach((asset, index) => {
    pushReferenceAsset(items, seenUrls, {
      url: asset.url,
      label: asset.target || `AI crop ${index + 1}`,
      meta: asset.description || "AI-cropped image",
    });
  });

  files
    .filter((file) => file.type.startsWith("image/"))
    .forEach((file) => {
      pushReferenceAsset(items, seenUrls, {
        url: file.url,
        label: file.name,
        meta: "Uploaded image",
      });
    });

  pdfAssets.forEach((asset) => {
    asset.pageImageUrls.forEach((url, index) => {
      pushReferenceAsset(items, seenUrls, {
        url,
        label: `${asset.sourceName} - Page ${index + 1}`,
        meta: "PDF page image",
      });
    });
  });

  return items;
}

function formatReferenceAssetOption(asset: ReferenceAsset): string {
  const text = asset.meta ? `${asset.label} - ${asset.meta}` : asset.label;
  return text.length > 120 ? `${text.slice(0, 117)}...` : text;
}

function StepIndicator({ currentStep }: { currentStep: number }) {
  const steps = [
    { num: 1, label: "Upload Materials" },
    { num: 2, label: "AI Parse" },
    { num: 3, label: "Review & Edit" },
    { num: 4, label: "Save & Publish" },
  ];

  return (
    <div className="mb-8 flex flex-wrap items-center justify-center gap-2">
      {steps.map((step, index) => (
        <div key={step.num} className="flex items-center gap-2">
          <div
            className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-all ${
              currentStep === step.num
                ? "bg-blue-600 text-white shadow-md"
                : currentStep > step.num
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-100 text-gray-400"
            }`}
          >
            {currentStep > step.num ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <span className="flex h-5 w-5 items-center justify-center rounded-full border border-current text-xs">
                {step.num}
              </span>
            )}
            <span className="hidden sm:inline">{step.label}</span>
          </div>
          {index < steps.length - 1 && (
            <div
              className={`h-0.5 w-8 ${
                currentStep > step.num ? "bg-green-300" : "bg-gray-200"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function FieldLabel({
  children,
  hint,
}: {
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="mb-1 block text-xs font-medium text-gray-600">
      <span>{children}</span>
      {hint ? <span className="ml-1 font-normal text-gray-400">{hint}</span> : null}
    </label>
  );
}

function questionPreview(question: Question): string {
  switch (question.type) {
    case "writing":
      return question.topic || "Writing topic";
    case "true-false":
      return question.statements[0]?.statement || "True / False";
    case "table":
      return question.question || "Table completion";
    case "reference":
      return question.question || "Reference question";
    case "order":
      return question.question || "Order question";
    case "phrase":
      return question.question || "Phrase question";
    case "checkbox":
      return question.question || "Checkbox question";
    case "open-ended":
      return question.question || "Open-ended question";
    default:
      return (question as any).question || "Question";
  }
}

function getQuestionBaseId(section: EditableSection): number {
  if (!section.questions.length) {
    return 1;
  }
  return Math.min(...section.questions.map((question) => question.id));
}

function formatQuestionIdList(ids: number[] | undefined): string {
  return (ids || []).join(", ");
}

function parseQuestionIdList(value: string): number[] {
  return value
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item));
}

function linesToText(lines: string[] | undefined): string {
  return (lines || []).join("\n");
}

function textToLines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function getOptionLabel(type: QuestionType, index: number): string {
  if (type === "listening-mcq") {
    return String.fromCharCode(65 + index);
  }
  return String.fromCharCode(97 + index);
}

function renumberSection(section: EditableSection): EditableSection {
  const baseId = getQuestionBaseId(section);
  const idMap = new Map<number, number>();
  const nextQuestions = section.questions.map((question, index) => {
    const nextId = baseId + index;
    idMap.set(question.id, nextId);
    return { ...question, id: nextId };
  }) as Question[];

  return {
    ...section,
    questions: nextQuestions,
    storyParagraphs: section.storyParagraphs?.map((paragraph) => ({
      ...paragraph,
      questionIds: paragraph.questionIds
        .map((questionId) => idMap.get(questionId))
        .filter((questionId): questionId is number => typeof questionId === "number"),
    })),
  };
}

function refreshPaper(paper: EditablePaper): EditablePaper {
  return {
    ...paper,
    totalQuestions: paper.sections.reduce(
      (sum, section) => sum + section.questions.length,
      0
    ),
    hasListening: paper.sections.some(
      (section) =>
        !!section.audioUrl ||
        section.questions.some((question) => question.type === "listening-mcq")
    ),
    hasWriting: paper.sections.some((section) =>
      section.questions.some((question) => question.type === "writing")
    ),
  };
}

function FileUploadArea({
  files,
  onFilesAdded,
  onRemoveFile,
  isUploading,
  disabled = false,
}: {
  files: UploadedFile[];
  onFilesAdded: (files: File[]) => void;
  onRemoveFile: (index: number) => void;
  isUploading: boolean;
  disabled?: boolean;
}) {
  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      if (disabled) return;
      onFilesAdded(Array.from(event.dataTransfer.files));
    },
    [disabled, onFilesAdded]
  );

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (disabled) return;
      if (event.target.files) {
        onFilesAdded(Array.from(event.target.files));
      }
    },
    [disabled, onFilesAdded]
  );

  const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) return <ImageIcon className="h-5 w-5 text-green-500" />;
    if (type.startsWith("audio/")) return <Music className="h-5 w-5 text-purple-500" />;
    return <FileText className="h-5 w-5 text-blue-500" />;
  };

  return (
    <div className="space-y-4">
      <div
        onDrop={handleDrop}
        onDragOver={(event) => event.preventDefault()}
        className={`relative rounded-xl border-2 border-dashed p-8 text-center transition-all ${
          disabled
            ? "cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400"
            : "border-blue-300 hover:border-blue-500 hover:bg-blue-50/50"
        }`}
      >
        <input
          type="file"
          multiple
          accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.mp3,.wav,.m4a,.ogg,.doc,.docx,.txt"
          onChange={handleChange}
          className={`absolute inset-0 opacity-0 ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
          disabled={isUploading || disabled}
        />
        <Upload className={`mx-auto mb-3 h-12 w-12 ${disabled ? "text-gray-300" : "text-blue-400"}`} />
        <p className={`text-lg font-medium ${disabled ? "text-gray-500" : "text-gray-700"}`}>
          Drop source files here or click to upload
        </p>
        <p className={`mt-1 text-sm ${disabled ? "text-gray-400" : "text-gray-500"}`}>
          PDF / 图片 / 音频都可以，作为录题参考素材使用
        </p>
        {isUploading ? (
          <div className="mt-3 flex items-center justify-center gap-2 text-blue-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Uploading...</span>
          </div>
        ) : disabled ? (
          <div className="mt-3 text-sm text-gray-500">Upload is disabled until server storage is configured.</div>
        ) : null}
      </div>

      {files.length > 0 ? (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-600">
            Uploaded Files ({files.length})
          </h4>
          {files.map((file, index) => (
            <div
              key={`${file.url}-${index}`}
              className="flex items-center gap-3 rounded-lg bg-gray-50 p-3"
            >
              {getFileIcon(file.type)}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{file.name}</p>
                <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemoveFile(index)}
                className="text-red-400 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

async function uploadSingleImage(
  file: File,
  uploadMutation: ReturnType<typeof trpc.papers.uploadFile.useMutation>,
  imageSize: ImageSize = "full"
): Promise<string> {
  const compressed = await compressImage(file, imageSize);
  const base64 = await fileToBase64(compressed);
  const result = await uploadMutation.mutateAsync({
    fileName: compressed.name,
    fileBase64: base64,
    contentType: compressed.type,
  });
  return result.url;
}

function ImageUploadButton({
  label,
  currentUrl,
  onUploaded,
  onRemove,
  previewSize = "md",
  imageSize = "full",
}: {
  label: string;
  currentUrl?: string;
  onUploaded: (url: string) => void;
  onRemove: () => void;
  previewSize?: "sm" | "md" | "lg";
  imageSize?: ImageSize;
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const uploadFile = trpc.papers.uploadFile.useMutation();

  const processFile = async (file: File) => {
    const error = validateImageFile(file);
    if (error) {
      toast.error(error);
      return;
    }

    setIsUploading(true);
    try {
      const url = await uploadSingleImage(file, uploadFile, imageSize);
      onUploaded(url);
      toast.success(`Image uploaded: ${file.name}`);
    } catch (error) {
      console.error("Image upload error:", error);
      toast.error(getErrorMessage(error, "Failed to upload image"));
    } finally {
      setIsUploading(false);
    }
  };

  const handleSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await processFile(file);
    event.target.value = "";
  };

  const handleDrop = async (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);
    const file = event.dataTransfer.files[0];
    if (file) {
      await processFile(file);
    }
  };

  const previewClass =
    previewSize === "sm" ? "max-h-12" : previewSize === "lg" ? "max-h-32" : "max-h-20";

  return (
    <div
      className="space-y-1"
      onDragOver={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragOver(true);
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragOver(false);
      }}
      onDrop={handleDrop}
    >
      {currentUrl ? (
        <div className="flex items-start gap-2">
          <img
            src={currentUrl}
            alt={label}
            className={`${previewClass} rounded border bg-gray-50 object-contain`}
          />
          <div className="flex flex-col gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={onRemove}
              className="h-6 px-2 text-xs text-red-500 hover:text-red-700"
            >
              <X className="mr-1 h-3 w-3" />
              Remove
            </Button>
            <label className="cursor-pointer">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleSelect}
              />
              <span className="inline-flex h-6 items-center rounded px-2 text-xs text-blue-600 hover:bg-blue-50 hover:text-blue-800">
                <ImagePlus className="mr-1 h-3 w-3" />
                Replace
              </span>
            </label>
          </div>
        </div>
      ) : (
        <label
          className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-dashed px-2.5 py-1.5 text-xs font-medium transition-colors ${
            isDragOver
              ? "border-blue-400 bg-blue-100 text-blue-700 ring-2 ring-blue-300"
              : "border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100"
          }`}
        >
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleSelect}
            disabled={isUploading}
          />
          {isUploading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Uploading...
            </>
          ) : isDragOver ? (
            <>
              <ImagePlus className="h-3.5 w-3.5" />
              Drop here
            </>
          ) : (
            <>
              <ImagePlus className="h-3.5 w-3.5" />
              {label}
            </>
          )}
        </label>
      )}
    </div>
  );
}

function ImageField({
  label,
  url,
  onChange,
  imageSize = "full",
  previewSize = "md",
  referenceAssets = [],
}: {
  label: string;
  url?: string;
  onChange: (value: string) => void;
  imageSize?: ImageSize;
  previewSize?: "sm" | "md" | "lg";
  referenceAssets?: ReferenceAsset[];
}) {
  const matchingReference = referenceAssets.find((asset) => asset.url === url);

  return (
    <div className="space-y-2 rounded-lg border border-dashed border-blue-200 bg-blue-50 p-3">
      <FieldLabel>{label}</FieldLabel>
      <div className="flex flex-wrap items-start gap-3">
        <ImageUploadButton
          label={`Upload ${label}`}
          currentUrl={url}
          onUploaded={onChange}
          onRemove={() => onChange("")}
          imageSize={imageSize}
          previewSize={previewSize}
        />
        <div className="min-w-[240px] flex-1 space-y-2">
          <Input
            value={url || ""}
            onChange={(event) => onChange(event.target.value)}
            placeholder="Or paste image URL here..."
            className="h-8 text-xs"
          />
          {referenceAssets.length ? (
            <div className="rounded-md border border-white bg-white/80 p-2">
              <FieldLabel hint="选择后会直接填入当前图片字段">
                Reference Assets
              </FieldLabel>
              <select
                value=""
                onChange={(event) => {
                  if (event.target.value) {
                    onChange(event.target.value);
                  }
                }}
                className="h-8 w-full rounded-md border px-2 text-xs"
              >
                <option value="">Use an uploaded image, PDF page, or AI crop...</option>
                {referenceAssets.map((asset, index) => (
                  <option key={`${asset.url}-${index}`} value={asset.url}>
                    {formatReferenceAssetOption(asset)}
                  </option>
                ))}
              </select>
              {matchingReference ? (
                <div className="mt-2 rounded-md bg-gray-50 px-2 py-1.5 text-xs text-gray-500">
                  <p className="font-medium text-gray-700">{matchingReference.label}</p>
                  {matchingReference.meta ? <p>{matchingReference.meta}</p> : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ImageListEditor({
  label,
  items,
  onChange,
  referenceAssets = [],
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  referenceAssets?: ReferenceAsset[];
}) {
  const updateItem = (index: number, value: string) => {
    const next = [...items];
    next[index] = value;
    onChange(next);
  };

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <FieldLabel>{label}</FieldLabel>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onChange([...(items || []), ""])}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add Image
        </Button>
      </div>

      {(items || []).length ? (
        <div className="space-y-3">
          {items.map((url, index) => (
            <div key={`${label}-${index}`} className="rounded-lg border p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">
                  {label} {index + 1}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <ImageField
                label={`${label} ${index + 1}`}
                url={url}
                onChange={(value) => updateItem(index, value)}
                previewSize="md"
                referenceAssets={referenceAssets}
              />
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-500">No images assigned yet.</p>
      )}
    </div>
  );
}

function ReferenceAssetGallery({
  title,
  description,
  items,
}: {
  title: string;
  description?: string;
  items: ReferenceAsset[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description ? <p className="text-sm text-gray-500">{description}</p> : null}
      </CardHeader>
      <CardContent>
        {items.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item, index) => (
              <div key={`${item.url}-${index}`} className="rounded-lg border bg-gray-50 p-3">
                <img
                  src={item.url}
                  alt={item.label}
                  className="mb-3 h-40 w-full rounded border bg-white object-contain"
                />
                <p className="text-sm font-medium text-gray-800">{item.label}</p>
                {item.meta ? <p className="mt-1 text-xs text-gray-500">{item.meta}</p> : null}
                <p className="mt-2 break-all text-[11px] text-gray-400">{item.url}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No images are available in this gallery yet.</p>
        )}
      </CardContent>
    </Card>
  );
}

function ReadingWordBankEditor({
  items,
  onChange,
  referenceAssets = [],
}: {
  items: { word: string; imageUrl: string }[];
  onChange: (items: { word: string; imageUrl: string }[]) => void;
  referenceAssets?: ReferenceAsset[];
}) {
  const updateItem = (index: number, patch: Partial<{ word: string; imageUrl: string }>) => {
    const next = [...items];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Reading Word Bank</CardTitle>
        <p className="text-sm text-gray-500">
          G2-3 阅读 Part 1 用这个图片区词库，词和图都可以手动录。
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item, index) => (
          <div key={index} className="rounded-lg border p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Item {index + 1}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}
                className="text-red-500 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid gap-3 md:grid-cols-[1fr_1.4fr]">
              <div>
                <FieldLabel>Word</FieldLabel>
                <Input
                  value={item.word}
                  onChange={(event) => updateItem(index, { word: event.target.value })}
                  placeholder="e.g. a dentist"
                />
              </div>
              <ImageField
                label="Word Bank Image"
                url={item.imageUrl}
                onChange={(value) => updateItem(index, { imageUrl: value })}
                previewSize="sm"
                imageSize="option"
                referenceAssets={referenceAssets}
              />
            </div>
          </div>
        ))}
        <Button
          variant="outline"
          onClick={() => onChange([...items, { word: "", imageUrl: "" }])}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Word Bank Item
        </Button>
      </CardContent>
    </Card>
  );
}

function QuestionEditor({
  question,
  allowedTypes,
  sectionHasGrammarPassage,
  referenceAssets = [],
  onChange,
  onRemove,
}: {
  question: Question;
  allowedTypes: QuestionType[];
  sectionHasGrammarPassage: boolean;
  referenceAssets?: ReferenceAsset[];
  onChange: (question: Question) => void;
  onRemove: () => void;
}) {
  const updateField = (field: string, value: unknown) => {
    onChange({ ...(question as any), [field]: value } as Question);
  };
  const replaceQuestion = (patch: Record<string, unknown>) => {
    onChange({ ...(question as any), ...patch } as Question);
  };

  const renderQuestionImage = () => {
    if (question.type !== "mcq" && question.type !== "open-ended") {
      return null;
    }

    return (
      <ImageField
        label="Question Image"
        url={question.imageUrl}
        onChange={(value) => updateField("imageUrl", value)}
        previewSize="sm"
        referenceAssets={referenceAssets}
      />
    );
  };

  const renderMCQOptions = (
    currentQuestion: Extract<
      Question,
      { type: "mcq" | "picture-mcq" | "listening-mcq" }
    >,
    type: "mcq" | "picture-mcq" | "listening-mcq"
  ) => {
    const options = [...currentQuestion.options];
    const isImageOptionType = type === "picture-mcq" || type === "listening-mcq";

    const updateOption = (index: number, value: any) => {
      const next = [...options];
      next[index] = value;
      updateField("options", next);
    };

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <FieldLabel>Options</FieldLabel>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const nextIndex = options.length;
              if (isImageOptionType) {
                updateField("options", [
                  ...options,
                  {
                    label: getOptionLabel(type, nextIndex),
                    imageUrl: "",
                    text: "",
                  },
                ]);
              } else {
                updateField("options", [...options, ""]);
              }
            }}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add Option
          </Button>
        </div>

        {options.map((option, index) => (
          <div key={index} className="rounded-lg border p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">
                Option {getOptionLabel(type, index).toUpperCase()}
              </span>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1 text-xs text-green-700">
                  <input
                    type="radio"
                    checked={currentQuestion.correctAnswer === index}
                    onChange={() => updateField("correctAnswer", index)}
                  />
                  Correct
                </label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const nextOptions = options.filter((_, optionIndex) => optionIndex !== index);
                    if (typeof currentQuestion.correctAnswer === "number") {
                      if (currentQuestion.correctAnswer === index) {
                        replaceQuestion({
                          options: nextOptions,
                          correctAnswer: 0,
                        });
                      } else if (currentQuestion.correctAnswer > index) {
                        replaceQuestion({
                          options: nextOptions,
                          correctAnswer: currentQuestion.correctAnswer - 1,
                        });
                      } else {
                        replaceQuestion({ options: nextOptions });
                      }
                    } else {
                      replaceQuestion({ options: nextOptions });
                    }
                  }}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {typeof option === "string" ? (
              <Input
                value={option}
                onChange={(event) => updateOption(index, event.target.value)}
                placeholder="Option text"
              />
            ) : (
              <div className="space-y-3">
                <Input
                  value={option.text || ""}
                  onChange={(event) =>
                    updateOption(index, { ...option, text: event.target.value })
                  }
                  placeholder="Option text (optional)"
                />
                {isImageOptionType ? (
                  <ImageField
                    label="Option Image"
                    url={option.imageUrl}
                    onChange={(value) =>
                      updateOption(index, { ...option, imageUrl: value })
                    }
                    previewSize="sm"
                    imageSize="option"
                    referenceAssets={referenceAssets}
                  />
                ) : null}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderBody = () => {
    switch (question.type) {
      case "mcq":
        return (
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <FieldLabel>Question</FieldLabel>
                <Textarea
                  value={question.question}
                  onChange={(event) => updateField("question", event.target.value)}
                  rows={2}
                />
              </div>
              <div>
                <FieldLabel>Highlight Word</FieldLabel>
                <Input
                  value={question.highlightWord || ""}
                  onChange={(event) => updateField("highlightWord", event.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div>
                <FieldLabel>Correct Option</FieldLabel>
                <select
                  value={String(question.correctAnswer)}
                  onChange={(event) =>
                    updateField("correctAnswer", Number(event.target.value))
                  }
                  className="h-10 w-full rounded-md border px-3 text-sm"
                >
                  {question.options.map((_, index) => (
                    <option key={index} value={index}>
                      {getOptionLabel(question.type, index).toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {renderQuestionImage()}
            {renderMCQOptions(question, "mcq")}
          </div>
        );

      case "picture-mcq":
      case "listening-mcq":
        return (
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <FieldLabel>Question</FieldLabel>
                <Textarea
                  value={question.question}
                  onChange={(event) => updateField("question", event.target.value)}
                  rows={2}
                />
              </div>
              <div>
                <FieldLabel>Correct Option</FieldLabel>
                <select
                  value={String(question.correctAnswer)}
                  onChange={(event) =>
                    updateField("correctAnswer", Number(event.target.value))
                  }
                  className="h-10 w-full rounded-md border px-3 text-sm"
                >
                  {question.options.map((option, index) => (
                    <option key={index} value={index}>
                      {option.label || getOptionLabel(question.type, index)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {renderMCQOptions(question, question.type)}
          </div>
        );

      case "fill-blank":
        return (
          <div className="grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <FieldLabel
                hint={
                  sectionHasGrammarPassage
                    ? "这类题通常只填答案字母；如是句子填空，也可填写题干"
                    : undefined
                }
              >
                Question
              </FieldLabel>
              <Textarea
                value={question.question || ""}
                onChange={(event) => updateField("question", event.target.value)}
                rows={2}
                placeholder={
                  sectionHasGrammarPassage
                    ? "Optional for passage-based blanks"
                    : "Sentence with ___"
                }
              />
            </div>
            <div>
              <FieldLabel>Correct Answer</FieldLabel>
              <Input
                value={question.correctAnswer}
                onChange={(event) => updateField("correctAnswer", event.target.value)}
                placeholder={sectionHasGrammarPassage ? "e.g. A / B / C" : "Correct word"}
              />
            </div>
          </div>
        );

      case "wordbank-fill":
        return (
          <div className="grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <FieldLabel>Question</FieldLabel>
              <Textarea
                value={question.question}
                onChange={(event) => updateField("question", event.target.value)}
                rows={2}
              />
            </div>
            <div>
              <FieldLabel>Correct Answer</FieldLabel>
              <Input
                value={question.correctAnswer}
                onChange={(event) => updateField("correctAnswer", event.target.value)}
              />
            </div>
          </div>
        );

      case "story-fill":
        return (
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <FieldLabel>Question</FieldLabel>
                <Textarea
                  value={question.question}
                  onChange={(event) => updateField("question", event.target.value)}
                  rows={2}
                />
              </div>
              <div>
                <FieldLabel>Correct Answer</FieldLabel>
                <Input
                  value={question.correctAnswer}
                  onChange={(event) => updateField("correctAnswer", event.target.value)}
                />
              </div>
            </div>
            <div>
              <FieldLabel hint="一行一个，可留空">Acceptable Answers</FieldLabel>
              <Textarea
                value={linesToText(question.acceptableAnswers)}
                onChange={(event) =>
                  updateField("acceptableAnswers", textToLines(event.target.value))
                }
                rows={3}
                placeholder="Alternative answers"
              />
            </div>
          </div>
        );

      case "open-ended":
        return (
          <div className="space-y-3">
            <div className="md:col-span-2">
              <FieldLabel>Question</FieldLabel>
              <Textarea
                value={question.question}
                onChange={(event) => updateField("question", event.target.value)}
                rows={2}
              />
            </div>
            {renderQuestionImage()}

            {question.subQuestions?.length ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <FieldLabel>Sub Questions</FieldLabel>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        updateField("subQuestions", [
                          ...question.subQuestions!,
                          {
                            label: String.fromCharCode(97 + question.subQuestions!.length),
                            question: "",
                            answer: "",
                          },
                        ])
                      }
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      Add Sub-question
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        replaceQuestion({
                          subQuestions: undefined,
                          answer: "",
                        });
                      }}
                    >
                      Convert to Single Answer
                    </Button>
                  </div>
                </div>
                {question.subQuestions.map((subQuestion, index) => (
                  <div key={index} className="rounded-lg border p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">
                        {subQuestion.label})
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          updateField(
                            "subQuestions",
                            question.subQuestions!
                              .filter((_, subIndex) => subIndex !== index)
                              .map((item, subIndex) => ({
                                ...item,
                                label: String.fromCharCode(97 + subIndex),
                              }))
                          )
                        }
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <FieldLabel>Prompt</FieldLabel>
                        <Textarea
                          value={subQuestion.question}
                          onChange={(event) =>
                            updateField(
                              "subQuestions",
                              question.subQuestions!.map((item, subIndex) =>
                                subIndex === index
                                  ? { ...item, question: event.target.value }
                                  : item
                              )
                            )
                          }
                          rows={2}
                        />
                      </div>
                      <div>
                        <FieldLabel>Answer</FieldLabel>
                        <Textarea
                          value={subQuestion.answer}
                          onChange={(event) =>
                            updateField(
                              "subQuestions",
                              question.subQuestions!.map((item, subIndex) =>
                                subIndex === index
                                  ? { ...item, answer: event.target.value }
                                  : item
                              )
                            )
                          }
                          rows={2}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <FieldLabel>Model Answer</FieldLabel>
                  <Textarea
                    value={question.answer || ""}
                    onChange={(event) => updateField("answer", event.target.value)}
                    rows={3}
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    updateField("subQuestions", [
                      { label: "a", question: "", answer: "" },
                    ])
                  }
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Use Sub-questions
                </Button>
              </div>
            )}
          </div>
        );

      case "true-false":
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <FieldLabel>Statements</FieldLabel>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  updateField("statements", [
                    ...question.statements,
                    {
                      label: String.fromCharCode(97 + question.statements.length),
                      statement: "",
                      isTrue: true,
                      reason: "",
                    },
                  ])
                }
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add Statement
              </Button>
            </div>
            {question.statements.map((statement, index) => (
              <div key={index} className="rounded-lg border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">
                    {statement.label})
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      updateField(
                        "statements",
                        question.statements
                          .filter((_, statementIndex) => statementIndex !== index)
                          .map((item, statementIndex) => ({
                            ...item,
                            label: String.fromCharCode(97 + statementIndex),
                          }))
                      )
                    }
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="md:col-span-2">
                    <FieldLabel>Statement</FieldLabel>
                    <Textarea
                      value={statement.statement}
                      onChange={(event) =>
                        updateField(
                          "statements",
                          question.statements.map((item, statementIndex) =>
                            statementIndex === index
                              ? { ...item, statement: event.target.value }
                              : item
                          )
                        )
                      }
                      rows={2}
                    />
                  </div>
                  <div>
                    <FieldLabel>Correct</FieldLabel>
                    <select
                      value={statement.isTrue ? "true" : "false"}
                      onChange={(event) =>
                        updateField(
                          "statements",
                          question.statements.map((item, statementIndex) =>
                            statementIndex === index
                              ? { ...item, isTrue: event.target.value === "true" }
                              : item
                          )
                        )
                      }
                      className="h-10 w-full rounded-md border px-3 text-sm"
                    >
                      <option value="true">True</option>
                      <option value="false">False</option>
                    </select>
                  </div>
                  <div className="md:col-span-3">
                    <FieldLabel>Reason</FieldLabel>
                    <Textarea
                      value={statement.reason}
                      onChange={(event) =>
                        updateField(
                          "statements",
                          question.statements.map((item, statementIndex) =>
                            statementIndex === index
                              ? { ...item, reason: event.target.value }
                              : item
                          )
                        )
                      }
                      rows={2}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        );

      case "table":
        return (
          <div className="space-y-3">
            <div>
              <FieldLabel>Question</FieldLabel>
              <Textarea
                value={question.question}
                onChange={(event) => updateField("question", event.target.value)}
                rows={2}
              />
            </div>
            <div className="flex items-center justify-between">
              <FieldLabel>Rows</FieldLabel>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  updateField("rows", [
                    ...question.rows,
                    {
                      situation: "",
                      thought: "",
                      action: "",
                      blankField: "thought",
                      answer: "",
                    },
                  ])
                }
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add Row
              </Button>
            </div>
            {question.rows.map((row, index) => (
              <div key={index} className="rounded-lg border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Row {index + 1}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      updateField(
                        "rows",
                        question.rows.filter((_, rowIndex) => rowIndex !== index)
                      )
                    }
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <FieldLabel>Situation</FieldLabel>
                    <Textarea
                      value={row.situation}
                      onChange={(event) =>
                        updateField(
                          "rows",
                          question.rows.map((item, rowIndex) =>
                            rowIndex === index
                              ? { ...item, situation: event.target.value }
                              : item
                          )
                        )
                      }
                      rows={2}
                    />
                  </div>
                  <div>
                    <FieldLabel>Blank Field</FieldLabel>
                    <select
                      value={row.blankField}
                      onChange={(event) =>
                        updateField(
                          "rows",
                          question.rows.map((item, rowIndex) =>
                            rowIndex === index
                              ? {
                                  ...item,
                                  blankField: event.target.value as "thought" | "action",
                                }
                              : item
                          )
                        )
                      }
                      className="h-10 w-full rounded-md border px-3 text-sm"
                    >
                      <option value="thought">thought</option>
                      <option value="action">action</option>
                    </select>
                  </div>
                  <div>
                    <FieldLabel>Thought</FieldLabel>
                    <Textarea
                      value={row.thought}
                      onChange={(event) =>
                        updateField(
                          "rows",
                          question.rows.map((item, rowIndex) =>
                            rowIndex === index
                              ? { ...item, thought: event.target.value }
                              : item
                          )
                        )
                      }
                      rows={2}
                    />
                  </div>
                  <div>
                    <FieldLabel>Action</FieldLabel>
                    <Textarea
                      value={row.action}
                      onChange={(event) =>
                        updateField(
                          "rows",
                          question.rows.map((item, rowIndex) =>
                            rowIndex === index
                              ? { ...item, action: event.target.value }
                              : item
                          )
                        )
                      }
                      rows={2}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <FieldLabel>Correct Answer</FieldLabel>
                    <Textarea
                      value={row.answer}
                      onChange={(event) =>
                        updateField(
                          "rows",
                          question.rows.map((item, rowIndex) =>
                            rowIndex === index
                              ? { ...item, answer: event.target.value }
                              : item
                          )
                        )
                      }
                      rows={2}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        );

      case "reference":
        return (
          <div className="space-y-3">
            <div>
              <FieldLabel>Question</FieldLabel>
              <Textarea
                value={question.question}
                onChange={(event) => updateField("question", event.target.value)}
                rows={2}
              />
            </div>
            <div className="flex items-center justify-between">
              <FieldLabel>Reference Items</FieldLabel>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  updateField("items", [
                    ...question.items,
                    { word: "", lineRef: "", answer: "" },
                  ])
                }
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add Item
              </Button>
            </div>
            {question.items.map((item, index) => (
              <div key={index} className="rounded-lg border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Item {index + 1}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      updateField(
                        "items",
                        question.items.filter((_, itemIndex) => itemIndex !== index)
                      )
                    }
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div>
                    <FieldLabel>Word</FieldLabel>
                    <Input
                      value={item.word}
                      onChange={(event) =>
                        updateField(
                          "items",
                          question.items.map((row, itemIndex) =>
                            itemIndex === index
                              ? { ...row, word: event.target.value }
                              : row
                          )
                        )
                      }
                    />
                  </div>
                  <div>
                    <FieldLabel>Line Ref</FieldLabel>
                    <Input
                      value={item.lineRef}
                      onChange={(event) =>
                        updateField(
                          "items",
                          question.items.map((row, itemIndex) =>
                            itemIndex === index
                              ? { ...row, lineRef: event.target.value }
                              : row
                          )
                        )
                      }
                    />
                  </div>
                  <div>
                    <FieldLabel>Answer</FieldLabel>
                    <Input
                      value={item.answer}
                      onChange={(event) =>
                        updateField(
                          "items",
                          question.items.map((row, itemIndex) =>
                            itemIndex === index
                              ? { ...row, answer: event.target.value }
                              : row
                          )
                        )
                      }
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        );

      case "order":
        return (
          <div className="space-y-3">
            <div>
              <FieldLabel>Question</FieldLabel>
              <Textarea
                value={question.question}
                onChange={(event) => updateField("question", event.target.value)}
                rows={2}
              />
            </div>
            <div className="flex items-center justify-between">
              <FieldLabel>Events</FieldLabel>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  replaceQuestion({
                    events: [...question.events, ""],
                    correctOrder: [
                      ...question.correctOrder,
                      question.correctOrder.length + 1,
                    ],
                  });
                }}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add Event
              </Button>
            </div>
            {question.events.map((eventText, index) => (
              <div key={index} className="rounded-lg border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Event {index + 1}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      replaceQuestion({
                        events: question.events.filter(
                          (_, eventIndex) => eventIndex !== index
                        ),
                        correctOrder: question.correctOrder
                          .filter((_, orderIndex) => orderIndex !== index)
                          .map((value, orderIndex) => value || orderIndex + 1),
                      });
                    }}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid gap-3 md:grid-cols-[1fr_140px]">
                  <div>
                    <FieldLabel>Event</FieldLabel>
                    <Textarea
                      value={eventText}
                      onChange={(event) =>
                        updateField(
                          "events",
                          question.events.map((item, eventIndex) =>
                            eventIndex === index ? event.target.value : item
                          )
                        )
                      }
                      rows={2}
                    />
                  </div>
                  <div>
                    <FieldLabel>Correct Order</FieldLabel>
                    <Input
                      type="number"
                      min={1}
                      max={question.events.length}
                      value={String(question.correctOrder[index] || index + 1)}
                      onChange={(event) =>
                        updateField(
                          "correctOrder",
                          question.correctOrder.map((item, eventIndex) =>
                            eventIndex === index ? Number(event.target.value) : item
                          )
                        )
                      }
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        );

      case "phrase":
        return (
          <div className="space-y-3">
            <div>
              <FieldLabel>Question</FieldLabel>
              <Textarea
                value={question.question}
                onChange={(event) => updateField("question", event.target.value)}
                rows={2}
              />
            </div>
            <div className="flex items-center justify-between">
              <FieldLabel>Items</FieldLabel>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  updateField("items", [...question.items, { clue: "", answer: "" }])
                }
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add Item
              </Button>
            </div>
            {question.items.map((item, index) => (
              <div key={index} className="rounded-lg border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Item {index + 1}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      updateField(
                        "items",
                        question.items.filter((_, itemIndex) => itemIndex !== index)
                      )
                    }
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <FieldLabel>Clue</FieldLabel>
                    <Textarea
                      value={item.clue}
                      onChange={(event) =>
                        updateField(
                          "items",
                          question.items.map((row, itemIndex) =>
                            itemIndex === index
                              ? { ...row, clue: event.target.value }
                              : row
                          )
                        )
                      }
                      rows={2}
                    />
                  </div>
                  <div>
                    <FieldLabel>Answer</FieldLabel>
                    <Textarea
                      value={item.answer}
                      onChange={(event) =>
                        updateField(
                          "items",
                          question.items.map((row, itemIndex) =>
                            itemIndex === index
                              ? { ...row, answer: event.target.value }
                              : row
                          )
                        )
                      }
                      rows={2}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        );

      case "checkbox":
        return (
          <div className="space-y-3">
            <div>
              <FieldLabel>Question</FieldLabel>
              <Textarea
                value={question.question}
                onChange={(event) => updateField("question", event.target.value)}
                rows={2}
              />
            </div>
            <div className="flex items-center justify-between">
              <FieldLabel>Options</FieldLabel>
              <Button
                variant="outline"
                size="sm"
                onClick={() => updateField("options", [...question.options, ""])}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add Option
              </Button>
            </div>
            {question.options.map((option, index) => (
              <div key={index} className="flex items-center gap-3 rounded-lg border p-3">
                <input
                  type="checkbox"
                  checked={question.correctAnswers.includes(index)}
                  onChange={(event) => {
                    const next = event.target.checked
                      ? [...question.correctAnswers, index]
                      : question.correctAnswers.filter((value) => value !== index);
                    updateField(
                      "correctAnswers",
                      next.sort((left, right) => left - right)
                    );
                  }}
                />
                <div className="flex-1">
                  <FieldLabel>Option</FieldLabel>
                  <Input
                    value={option}
                    onChange={(event) =>
                      updateField(
                        "options",
                        question.options.map((item, optionIndex) =>
                          optionIndex === index ? event.target.value : item
                        )
                      )
                    }
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    replaceQuestion({
                      options: question.options.filter(
                        (_, optionIndex) => optionIndex !== index
                      ),
                      correctAnswers: question.correctAnswers
                        .filter((value) => value !== index)
                        .map((value) => (value > index ? value - 1 : value)),
                    });
                  }}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        );

      case "writing":
        return (
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <FieldLabel>Topic</FieldLabel>
                <Input
                  value={question.topic}
                  onChange={(event) => updateField("topic", event.target.value)}
                />
              </div>
              <div>
                <FieldLabel>Word Count</FieldLabel>
                <Input
                  value={question.wordCount}
                  onChange={(event) => updateField("wordCount", event.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <FieldLabel>Instructions</FieldLabel>
                <Textarea
                  value={question.instructions}
                  onChange={(event) => updateField("instructions", event.target.value)}
                  rows={3}
                />
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <FieldLabel>Prompts</FieldLabel>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateField("prompts", [...question.prompts, ""])}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Add Prompt
                </Button>
              </div>
              {question.prompts.map((prompt, index) => (
                <div key={index} className="flex items-center gap-3 rounded-lg border p-3">
                  <div className="flex-1">
                    <FieldLabel>Prompt {index + 1}</FieldLabel>
                    <Input
                      value={prompt}
                      onChange={(event) =>
                        updateField(
                          "prompts",
                          question.prompts.map((item, promptIndex) =>
                            promptIndex === index ? event.target.value : item
                          )
                        )
                      }
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      updateField(
                        "prompts",
                        question.prompts.filter((_, promptIndex) => promptIndex !== index)
                      )
                    }
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        );
    }
  };

  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-mono">
              Q{question.id}
            </span>
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
              {QUESTION_TYPE_META[question.type].description}
            </span>
          </div>
          <p className="mt-2 text-sm text-gray-700">{questionPreview(question)}</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={question.type}
            onChange={(event) =>
              onChange(createEmptyQuestionByType(event.target.value as QuestionType, question.id))
            }
            className="h-9 rounded-md border px-3 text-sm"
          >
            {ALL_QUESTION_TYPES.map((type) => (
              <option key={type} value={type}>
                {QUESTION_TYPE_META[type].label}
              </option>
            ))}
          </select>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="text-red-500 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {renderBody()}
    </div>
  );
}

function SectionEditor({
  section,
  uploadedFiles,
  referenceAssets = [],
  onChange,
  onRemove,
}: {
  section: EditableSection;
  uploadedFiles: UploadedFile[];
  referenceAssets?: ReferenceAsset[];
  onChange: (section: EditableSection) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [newQuestionType, setNewQuestionType] = useState<QuestionType>(
    section.supportedQuestionTypes[0] || "mcq"
  );

  const audioFiles = uploadedFiles.filter((file) => file.type.startsWith("audio/"));

  const updateQuestionAt = (index: number, nextQuestion: Question) => {
    const nextQuestions = [...section.questions];
    nextQuestions[index] = nextQuestion;
    onChange({ ...section, questions: nextQuestions });
  };

  const removeQuestion = (index: number) => {
    onChange(
      renumberSection({
        ...section,
        questions: section.questions.filter((_, questionIndex) => questionIndex !== index),
      })
    );
  };

  const addQuestion = () => {
    const nextId = getQuestionBaseId(section) + section.questions.length;
    onChange({
      ...section,
      questions: [...section.questions, createEmptyQuestionByType(newQuestionType, nextId)],
    });
  };

  const updateWordBank = (index: number, word: string) => {
    const next = [...(section.wordBank || [])];
    next[index] = { ...next[index], word };
    onChange({ ...section, wordBank: next });
  };

  return (
    <Card className="border border-gray-200">
      <CardHeader
        className="cursor-pointer py-3 transition-colors hover:bg-gray-50"
        onClick={() => setExpanded((value) => !value)}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-2xl">{section.icon}</span>
              <div>
                <CardTitle className="text-base">{section.title}</CardTitle>
                <p className="text-xs text-gray-500">{section.blueprintSummary}</p>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {section.supportedQuestionTypes.map((type) => (
                <span
                  key={type}
                  className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700"
                >
                  {QUESTION_TYPE_META[type].shortLabel}
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={(event) => {
                event.stopPropagation();
                onRemove();
              }}
              className="text-red-500 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </div>
      </CardHeader>

      {expanded ? (
        <CardContent className="space-y-4 pt-0">
          <div className="grid gap-3 rounded-lg bg-gray-50 p-3 md:grid-cols-2">
            <div>
              <FieldLabel>Section ID</FieldLabel>
              <Input
                value={section.id}
                onChange={(event) => onChange({ ...section, id: event.target.value })}
              />
            </div>
            <div>
              <FieldLabel>Title</FieldLabel>
              <Input
                value={section.title}
                onChange={(event) => onChange({ ...section, title: event.target.value })}
              />
            </div>
            <div>
              <FieldLabel>Subtitle</FieldLabel>
              <Input
                value={section.subtitle}
                onChange={(event) => onChange({ ...section, subtitle: event.target.value })}
              />
            </div>
            <div>
              <FieldLabel>Icon</FieldLabel>
              <Input
                value={section.icon}
                onChange={(event) => onChange({ ...section, icon: event.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <FieldLabel>Description</FieldLabel>
              <Textarea
                value={section.description}
                onChange={(event) =>
                  onChange({ ...section, description: event.target.value })
                }
                rows={2}
              />
            </div>
          </div>

          {section.passage !== undefined ? (
            <div>
              <FieldLabel>Reading Passage</FieldLabel>
              <Textarea
                value={section.passage}
                onChange={(event) => onChange({ ...section, passage: event.target.value })}
                rows={8}
              />
            </div>
          ) : null}

          {section.grammarPassage !== undefined ? (
            <div>
              <FieldLabel hint="使用 <b>(N) ___</b> 这种 blank 标记">
                Grammar Passage
              </FieldLabel>
              <Textarea
                value={section.grammarPassage}
                onChange={(event) =>
                  onChange({ ...section, grammarPassage: event.target.value })
                }
                rows={8}
              />
            </div>
          ) : null}

          {section.wordBank ? (
            <div className="space-y-3 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <FieldLabel>Word Bank</FieldLabel>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    onChange({
                      ...section,
                      wordBank: [
                        ...section.wordBank!,
                        {
                          letter: String.fromCharCode(65 + section.wordBank!.length),
                          word: "",
                        },
                      ],
                    })
                  }
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Add Word
                </Button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {section.wordBank.map((item, index) => (
                  <div key={index} className="flex items-center gap-2 rounded border p-2">
                    <span className="w-8 text-sm font-semibold text-gray-600">
                      {item.letter}
                    </span>
                    <Input
                      value={item.word}
                      onChange={(event) => updateWordBank(index, event.target.value)}
                      placeholder="Word bank item"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        onChange({
                          ...section,
                          wordBank: section.wordBank!
                            .filter((_, itemIndex) => itemIndex !== index)
                            .map((word, itemIndex) => ({
                              ...word,
                              letter: String.fromCharCode(65 + itemIndex),
                            })),
                        })
                      }
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {section.audioUrl !== undefined ? (
            <div className="space-y-3 rounded-lg border p-3">
              <div>
                <FieldLabel>Audio URL</FieldLabel>
                <Input
                  value={section.audioUrl || ""}
                  onChange={(event) => onChange({ ...section, audioUrl: event.target.value })}
                  placeholder="Paste uploaded audio URL here..."
                />
              </div>
              {audioFiles.length ? (
                <div className="flex flex-wrap gap-2">
                  {audioFiles.map((file) => (
                    <Button
                      key={file.url}
                      variant="outline"
                      size="sm"
                      onClick={() => onChange({ ...section, audioUrl: file.url })}
                    >
                      <Music className="mr-1 h-3.5 w-3.5" />
                      Use {file.name}
                    </Button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-500">
                  还没有上传音频的话，可以回到第一步上传。
                </p>
              )}
            </div>
          ) : null}

          {section.sceneImageUrl !== undefined ? (
            <ImageField
              label="Scene Image"
              url={section.sceneImageUrl}
              onChange={(value) => onChange({ ...section, sceneImageUrl: value })}
              previewSize="lg"
              referenceAssets={referenceAssets}
            />
          ) : null}

          {section.wordBankImageUrl !== undefined ? (
            <ImageField
              label="Word Bank Image"
              url={section.wordBankImageUrl}
              onChange={(value) => onChange({ ...section, wordBankImageUrl: value })}
              previewSize="md"
              referenceAssets={referenceAssets}
            />
          ) : null}

          {section.storyImages !== undefined ? (
            <ImageListEditor
              label="Story Image"
              items={section.storyImages || []}
              onChange={(value) => onChange({ ...section, storyImages: value })}
              referenceAssets={referenceAssets}
            />
          ) : null}

          {section.storyParagraphs?.length ? (
            <div className="space-y-3 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <FieldLabel>Story Paragraphs</FieldLabel>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    onChange({
                      ...section,
                      storyParagraphs: [
                        ...section.storyParagraphs!,
                        { text: "", questionIds: [] },
                      ],
                    })
                  }
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Add Paragraph
                </Button>
              </div>
              {section.storyParagraphs.map((paragraph, index) => (
                <div key={index} className="rounded-lg border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">
                      Paragraph {index + 1}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        onChange({
                          ...section,
                          storyParagraphs: section.storyParagraphs!.filter(
                            (_, paragraphIndex) => paragraphIndex !== index
                          ),
                        })
                      }
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-[1fr_220px]">
                    <div>
                      <FieldLabel>Paragraph Text</FieldLabel>
                      <Textarea
                        value={paragraph.text}
                        onChange={(event) =>
                          onChange({
                            ...section,
                            storyParagraphs: section.storyParagraphs!.map(
                              (item, paragraphIndex) =>
                                paragraphIndex === index
                                  ? { ...item, text: event.target.value }
                                  : item
                            ),
                          })
                        }
                        rows={4}
                      />
                    </div>
                    <div>
                      <FieldLabel hint="Comma separated">Question IDs</FieldLabel>
                      <Input
                        value={formatQuestionIdList(paragraph.questionIds)}
                        onChange={(event) =>
                          onChange({
                            ...section,
                            storyParagraphs: section.storyParagraphs!.map(
                              (item, paragraphIndex) =>
                                paragraphIndex === index
                                  ? {
                                      ...item,
                                      questionIds: parseQuestionIdList(event.target.value),
                                    }
                                  : item
                            ),
                          })
                        }
                        placeholder="6, 7, 8"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold text-gray-800">Questions</h4>
                <p className="text-xs text-gray-500">
                  这里可以改题型、题干、答案、子题和图片。
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={newQuestionType}
                  onChange={(event) =>
                    setNewQuestionType(event.target.value as QuestionType)
                  }
                  className="h-9 rounded-md border px-3 text-sm"
                >
                  {ALL_QUESTION_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {QUESTION_TYPE_META[type].label}
                    </option>
                  ))}
                </select>
                <Button variant="outline" onClick={addQuestion}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Question
                </Button>
              </div>
            </div>

            {section.questions.map((question, index) => (
              <QuestionEditor
                key={`${question.id}-${index}`}
                question={question}
                allowedTypes={ALL_QUESTION_TYPES}
                sectionHasGrammarPassage={!!section.grammarPassage}
                referenceAssets={referenceAssets}
                onChange={(nextQuestion) => updateQuestionAt(index, nextQuestion)}
                onRemove={() => removeQuestion(index)}
              />
            ))}
          </div>
        </CardContent>
      ) : null}
    </Card>
  );
}

export default function PaperCreator() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [step, setStep] = useState(1);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [pdfAssets, setPdfAssets] = useState<PdfAsset[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [instructions, setInstructions] = useState("");
  const [draftPaper, setDraftPaper] = useState<EditablePaper | null>(null);
  const [extractedImageAssets, setExtractedImageAssets] = useState<ExtractedImageAsset[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [savedPaperId, setSavedPaperId] = useState<string | null>(null);

  const uploadFile = trpc.papers.uploadFile.useMutation();
  const parseMaterials = trpc.papers.parseMaterials.useMutation();
  const createPaper = trpc.papers.create.useMutation();
  const runtimeStatus = trpc.system.runtimeStatus.useQuery(undefined, {
    staleTime: 60_000,
  });

  const suggestion = useMemo(
    () => suggestBlueprint(files, instructions),
    [files, instructions]
  );
  const referenceAssets = useMemo(
    () => buildReferenceAssets({ files, pdfAssets, extractedImageAssets }),
    [files, pdfAssets, extractedImageAssets]
  );
  const runtime = runtimeStatus.data as RuntimeStatus | undefined;
  const missingVariablesText = runtime?.missingVariables.join(", ");

  const handleUnlock = () => {
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
    } else {
      toast.error("Incorrect password");
    }
  };

  const handleFilesAdded = async (newFiles: File[]) => {
    setIsUploading(true);
    try {
      for (const file of newFiles) {
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = "";
        bytes.forEach((byte) => {
          binary += String.fromCharCode(byte);
        });

        const result = await uploadFile.mutateAsync({
          fileName: file.name,
          fileBase64: btoa(binary),
          contentType: file.type || "application/octet-stream",
        });

        setFiles((previous) => [
          ...previous,
          { name: file.name, type: file.type, url: result.url, size: file.size },
        ]);

        if (isPdfFile(file)) {
          toast.message(`Extracting pages from ${file.name}...`);
          const extractedPdf = await extractPdfAssets(file);
          const pageImageUrls: string[] = [];

          for (const page of extractedPdf.pages) {
            const pageUrl = await uploadSingleImage(page.imageFile, uploadFile, "full");
            pageImageUrls.push(pageUrl);
          }

          setPdfAssets((previous) => [
            ...previous,
            {
              sourceUrl: result.url,
              sourceName: file.name,
              pageCount: extractedPdf.pageCount,
              extractedText: extractedPdf.combinedText,
              pageImageUrls,
            },
          ]);
        }
      }
      toast.success(`${newFiles.length} file(s) uploaded`);
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(getErrorMessage(error, "Failed to upload one or more files"));
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveFile = (index: number) => {
    setFiles((previous) => {
      const removed = previous[index];
      if (removed && isPdfFile(removed)) {
        setPdfAssets((current) =>
          current.filter((asset) => asset.sourceUrl !== removed.url)
        );
      }
      return previous.filter((_, fileIndex) => fileIndex !== index);
    });
  };

  const handleParse = async () => {
    if (files.length === 0) {
      toast.error("Please upload at least one file");
      return;
    }

    setIsParsing(true);
    try {
      const pageImageUrls = pdfAssets.flatMap((asset) => asset.pageImageUrls);
      const imageUrls = [
        ...files.filter((file) => file.type.startsWith("image/")).map((file) => file.url),
        ...pageImageUrls,
      ];
      const pdfUrls = files.filter((file) => isPdfFile(file)).map((file) => file.url);
      const audioUrls = files
        .filter((file) => file.type.startsWith("audio/"))
        .map((file) => file.url);
      const textContent = pdfAssets.map((asset) => asset.extractedText).join("\n\n");

      const result = await parseMaterials.mutateAsync({
        textContent: textContent || undefined,
        imageUrls: imageUrls.length ? imageUrls : undefined,
        pageImageUrls: pageImageUrls.length ? pageImageUrls : undefined,
        pdfUrls: pdfUrls.length ? pdfUrls : undefined,
        audioUrls: audioUrls.length ? audioUrls : undefined,
        instructions: instructions || undefined,
      });
      setExtractedImageAssets(
        Array.isArray((result as any).extractedImageAssets)
          ? ((result as any).extractedImageAssets as ExtractedImageAsset[])
          : []
      );

      const firstAudio = audioUrls[0];
      const nextPaper = createEditablePaperFromParsed(result as any);
      if (firstAudio) {
        nextPaper.sections = nextPaper.sections.map((section) =>
          section.audioUrl !== undefined && !section.audioUrl
            ? { ...section, audioUrl: firstAudio }
            : section
        );
      }
      setDraftPaper(refreshPaper(nextPaper));
      setStep(3);
      toast.success("AI parsed the paper. Review and edit it below.");
    } catch (error) {
      console.error("Parse error:", error);
      toast.error(
        getErrorMessage(
          error,
          "Failed to parse materials. You can retry or use a manual blueprint."
        )
      );
    } finally {
      setIsParsing(false);
    }
  };

  const handleChooseBlueprint = (blueprintId: string) => {
    const nextPaper = createEditablePaperFromBlueprint(blueprintId);
    const firstAudio = files.find((file) => file.type.startsWith("audio/"));
    if (firstAudio) {
      nextPaper.sections = nextPaper.sections.map((section) =>
        section.audioUrl !== undefined && !section.audioUrl
          ? { ...section, audioUrl: firstAudio.url }
          : section
      );
    }
    setDraftPaper(refreshPaper(nextPaper));
    setStep(3);
  };

  const updateDraftPaper = (updater: (paper: EditablePaper) => EditablePaper) => {
    setDraftPaper((current) => (current ? refreshPaper(updater(current)) : current));
  };

  const handleSave = async (status: "draft" | "published") => {
    if (!draftPaper) return;

    const cleanPaper = stripEditablePaper(draftPaper);

    setIsSaving(true);
    try {
      const result = await createPaper.mutateAsync({
        title: cleanPaper.title,
        subtitle: cleanPaper.subtitle || undefined,
        description: cleanPaper.description || undefined,
        icon: cleanPaper.icon,
        color: cleanPaper.color,
        totalQuestions: cleanPaper.totalQuestions,
        hasListening: cleanPaper.hasListening,
        hasWriting: cleanPaper.hasWriting,
        sectionsJson: JSON.stringify(cleanPaper.sections),
        readingWordBankJson: cleanPaper.readingWordBank
          ? JSON.stringify(cleanPaper.readingWordBank)
          : undefined,
        sourceFilesJson:
          files.length || pdfAssets.length
            ? JSON.stringify({
                uploadedFiles: files,
                pdfAssets: pdfAssets.map((asset) => ({
                  sourceName: asset.sourceName,
                  pageCount: asset.pageCount,
                  pageImageUrls: asset.pageImageUrls,
                })),
              })
            : undefined,
        status,
      });

      setSavedPaperId(result.paperId);
      setStep(4);
      toast.success(
        status === "published" ? "Paper published successfully" : "Draft saved successfully"
      );
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Failed to save paper");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setFiles([]);
    setPdfAssets([]);
    setExtractedImageAssets([]);
    setInstructions("");
    setDraftPaper(null);
    setSavedPaperId(null);
  };

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">🔐 Paper Creator</CardTitle>
            <p className="text-sm text-gray-500">Enter admin password to access</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && handleUnlock()}
            />
            <Button onClick={handleUnlock} className="w-full">
              Unlock
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <div className="border-b bg-white shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="mr-1 h-4 w-4" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900">📝 Paper Creator</h1>
              <p className="text-xs text-gray-500">
                上传 PDF 后先交给 AI 拆题，再进入人工校对和修改
              </p>
            </div>
          </div>
          <Link href="/paper-manager">
            <Button variant="outline" size="sm">
              Manage Papers
            </Button>
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6">
        <StepIndicator currentStep={step} />

        {step === 1 ? (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5 text-blue-500" />
                  Upload Source Materials
                </CardTitle>
                <p className="text-sm text-gray-500">
                  上传 PDF 后，系统会自动拆页截图、提取文字，再把整份卷子交给 AI 初步结构化。
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {runtime?.usingLocalFallback ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <div>
                        <p className="font-medium">Running in local fallback mode</p>
                        <p>
                          Cloud storage is not configured, so uploaded files will be stored locally
                          and parsing will use the local draft builder. Missing variables:
                          {" "}
                          {missingVariablesText}.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}

                <FileUploadArea
                  files={files}
                  onFilesAdded={handleFilesAdded}
                  onRemoveFile={handleRemoveFile}
                  isUploading={isUploading}
                />

                {pdfAssets.length ? (
                  <div className="rounded-lg border bg-gray-50 p-4">
                    <h4 className="mb-2 text-sm font-medium text-gray-700">
                      Auto-extracted from PDFs
                    </h4>
                    <div className="space-y-2">
                      {pdfAssets.map((asset) => (
                        <div
                          key={asset.sourceName}
                          className="rounded-md border bg-white p-3 text-sm text-gray-600"
                        >
                          <p className="font-medium text-gray-800">{asset.sourceName}</p>
                          <p>
                            {asset.pageCount} pages split, {asset.pageImageUrls.length} page images
                            uploaded, {asset.extractedText.length} chars extracted
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">AI Parse Hint (Optional)</CardTitle>
                <p className="text-sm text-gray-500">
                  可以写卷名、年级、是否有作文/听力，帮助 AI 更快对齐结构。
                </p>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={instructions}
                  onChange={(event) => setInstructions(event.target.value)}
                  rows={3}
                  placeholder="例如：G6 期末卷 / 阅读题型很多 / 最后一题是作文"
                />
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={() => setStep(2)} size="lg">
                Next: AI Parse
                <Layers3 className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Layers3 className="h-5 w-5 text-blue-500" />
                  AI Parse and Image Decomposition
                </CardTitle>
                <p className="text-sm text-gray-500">
                  这一步会把原 PDF、拆出来的页图、提取出的文字一起交给 AI；页图还会先自动裁切题图，最后生成一份可人工校对的草稿。
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {runtime?.usingLocalFallback ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <div>
                        <p className="font-medium">Using local parser instead of cloud AI</p>
                        <p>
                          The server is missing {missingVariablesText}. This run will still split the
                          PDF and generate a draft, but the result is text-only and needs more manual
                          checking than the cloud AI path.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="rounded-lg bg-blue-50 p-4 text-sm text-blue-900">
                  <p className="font-medium">当前推荐蓝图：</p>
                  <p>
                    {suggestion.blueprintId
                      ? `${suggestion.blueprintId.toUpperCase()}，${suggestion.reason}`
                      : suggestion.reason}
                  </p>
                </div>

                <div className="rounded-lg border bg-gray-50 p-4">
                  <h4 className="mb-2 text-sm font-medium text-gray-700">Materials Summary</h4>
                  <ul className="space-y-1 text-sm text-gray-600">
                    <li>Original files: {files.length}</li>
                    <li>PDF page images: {pdfAssets.reduce((sum, asset) => sum + asset.pageImageUrls.length, 0)}</li>
                    <li>Extracted text length: {pdfAssets.reduce((sum, asset) => sum + asset.extractedText.length, 0)}</li>
                    <li>Audio files: {files.filter((file) => file.type.startsWith("audio/")).length}</li>
                  </ul>
                </div>

                {isParsing ? (
                  <div className="flex flex-col items-center gap-3 py-8">
                    <Loader2 className="h-10 w-10 animate-spin text-purple-500" />
                    <p className="font-medium text-gray-700">
                      AI is parsing the paper and auto-cropping question images...
                    </p>
                    <p className="text-sm text-gray-400">This may take 30-90 seconds</p>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={() => setStep(1)}>
                      <ArrowLeft className="mr-1 h-4 w-4" />
                      Back
                    </Button>
                    <Button
                      onClick={handleParse}
                      className="flex-1"
                    >
                      {runtime?.usingLocalFallback ? "Start Local Parse" : "Start AI Parse"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Manual Fallback</CardTitle>
                <p className="text-sm text-gray-500">
                  如果 AI 这次拆得不好，下面仍然可以直接选 G2-3 / G6 蓝图手动录。
                </p>
              </CardHeader>
              <CardContent className="grid gap-4 lg:grid-cols-2">
                {paperBlueprints.map((blueprint) => {
                  const isRecommended = suggestion.blueprintId === blueprint.id;
                  return (
                    <Card
                      key={blueprint.id}
                      className={`border ${isRecommended ? "border-blue-500" : "border-gray-200"}`}
                    >
                      <CardHeader>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <CardTitle className="text-base">{blueprint.label}</CardTitle>
                            <p className="mt-1 text-sm text-gray-500">
                              {blueprint.referenceTitle}
                            </p>
                          </div>
                          {isRecommended ? (
                            <span className="rounded-full bg-blue-600 px-2 py-1 text-xs font-medium text-white">
                              Recommended
                            </span>
                          ) : null}
                        </div>
                        <p className="text-sm text-gray-700">{blueprint.interpretation}</p>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {blueprint.sections.map((section) => (
                          <div key={section.id} className="rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
                            <p className="font-medium text-gray-800">{section.title}</p>
                            <p>{section.summary}</p>
                          </div>
                        ))}
                        <Button
                          variant="outline"
                          onClick={() => handleChooseBlueprint(blueprint.id)}
                          className="w-full"
                        >
                          Use Manual Blueprint
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        ) : null}

        {step === 3 && draftPaper ? (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Paper Meta</CardTitle>
                <p className="text-sm text-gray-500">
                  当前草稿来源：{draftPaper.blueprintLabel}。现在可以逐 part 校对 AI 结果，并修改题型、题干、子题、答案和图片。
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <FieldLabel>Paper Title</FieldLabel>
                    <Input
                      value={draftPaper.title}
                      onChange={(event) =>
                        updateDraftPaper((paper) => ({ ...paper, title: event.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <FieldLabel>Subtitle</FieldLabel>
                    <Input
                      value={draftPaper.subtitle}
                      onChange={(event) =>
                        updateDraftPaper((paper) => ({
                          ...paper,
                          subtitle: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="md:col-span-2">
                    <FieldLabel>Description</FieldLabel>
                    <Textarea
                      value={draftPaper.description}
                      onChange={(event) =>
                        updateDraftPaper((paper) => ({
                          ...paper,
                          description: event.target.value,
                        }))
                      }
                      rows={3}
                    />
                  </div>
                </div>

                <div className="grid gap-3 rounded-lg bg-blue-50 p-4 text-center md:grid-cols-4">
                  <div>
                    <p className="text-2xl font-bold text-blue-700">{draftPaper.totalQuestions}</p>
                    <p className="text-xs text-gray-500">Questions</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-blue-700">{draftPaper.sections.length}</p>
                    <p className="text-xs text-gray-500">Sections</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-blue-700">
                      {draftPaper.hasListening ? "Yes" : "No"}
                    </p>
                    <p className="text-xs text-gray-500">Listening</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-blue-700">
                      {draftPaper.hasWriting ? "Yes" : "No"}
                    </p>
                    <p className="text-xs text-gray-500">Writing</p>
                  </div>
                </div>

                <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                  {draftPaper.interpretation}
                </div>
              </CardContent>
            </Card>

            {files.length ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Uploaded Reference Assets</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {files.map((file) => (
                    <span
                      key={file.url}
                      className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700"
                    >
                      {file.type.startsWith("image/") ? (
                        <ImageIcon className="h-3.5 w-3.5 text-green-600" />
                      ) : file.type.startsWith("audio/") ? (
                        <Music className="h-3.5 w-3.5 text-purple-600" />
                      ) : (
                        <FileText className="h-3.5 w-3.5 text-blue-600" />
                      )}
                      {file.name}
                    </span>
                  ))}
                </CardContent>
              </Card>
            ) : null}

            <ReferenceAssetGallery
              title="PDF Page Images"
              description="These are the full-page screenshots extracted from uploaded PDFs."
              items={pdfAssets.flatMap((asset) =>
                asset.pageImageUrls.map((url, index) => ({
                  url,
                  label: `${asset.sourceName} - Page ${index + 1}`,
                  meta: "Full page image",
                }))
              )}
            />

            <ReferenceAssetGallery
              title="Auto-extracted Image Assets"
              description={
                extractedImageAssets.length
                  ? "These are the cropped images returned by the AI cropper."
                  : runtime?.usingLocalFallback
                    ? "Local fallback mode does not auto-crop question images yet, so only the full-page PDF images are available above."
                    : "No cropped image assets were returned for this parse."
              }
              items={extractedImageAssets.map((asset, index) => ({
                url: asset.url,
                label: asset.target || `Extracted asset ${index + 1}`,
                meta: asset.description || asset.sourceUrl,
              }))}
            />

            {draftPaper.readingWordBank?.length ? (
              <ReadingWordBankEditor
                items={draftPaper.readingWordBank}
                onChange={(items) =>
                  updateDraftPaper((paper) => ({ ...paper, readingWordBank: items }))
                }
                referenceAssets={referenceAssets}
              />
            ) : null}

            <div className="space-y-4">
              {draftPaper.sections.map((section, index) => (
                <SectionEditor
                  key={`${section.id}-${index}`}
                  section={section}
                  uploadedFiles={files}
                  referenceAssets={referenceAssets}
                  onChange={(nextSection) =>
                    updateDraftPaper((paper) => {
                      const nextSections = [...paper.sections];
                      nextSections[index] = nextSection;
                      return { ...paper, sections: nextSections };
                    })
                  }
                  onRemove={() =>
                    updateDraftPaper((paper) => ({
                      ...paper,
                      sections: paper.sections.filter((_, sectionIndex) => sectionIndex !== index),
                    }))
                  }
                />
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(2)}>
                  <ArrowLeft className="mr-1 h-4 w-4" />
                  Back to Blueprint
                </Button>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => handleSave("draft")} disabled={isSaving}>
                  {isSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Save Draft
                </Button>
                <Button onClick={() => handleSave("published")} disabled={isSaving}>
                  {isSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  Publish Paper
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-700">
                <CheckCircle2 className="h-5 w-5" />
                Paper Saved
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-700">
                录题已经完成并写入数据库。你现在可以去 Paper Manager 管理状态，或者继续创建下一份试卷。
              </p>
              {savedPaperId ? (
                <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
                  Paper ID: <span className="font-mono">{savedPaperId}</span>
                </div>
              ) : null}
              <div className="flex gap-3">
                <Link href="/paper-manager">
                  <Button>Open Paper Manager</Button>
                </Link>
                <Button variant="outline" onClick={handleReset}>
                  Create Another Paper
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
