import { useState, useCallback } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  Upload, FileText, Image, Music, Loader2, Sparkles, Eye, Save,
  Trash2, ChevronDown, ChevronUp, ArrowLeft, CheckCircle2, AlertCircle,
  Send, Pencil, Plus, GripVertical, ImagePlus, X, Images
} from 'lucide-react';
import { Link } from 'wouter';
import { compressImage, fileToBase64, validateImageFile, formatFileSize, type ImageSize } from '@/lib/imageUtils';

// Password gate (reuse the same password as History page)
const ADMIN_PASSWORD = import.meta.env.VITE_HISTORY_PASSWORD || '';

type UploadedFile = {
  name: string;
  type: string;
  url: string;
  size: number;
};

type ParsedPaper = {
  title: string;
  subtitle: string;
  description: string;
  sections: any[];
  totalQuestions: number;
  hasListening: boolean;
  hasWriting: boolean;
};

// Step indicator
function StepIndicator({ currentStep }: { currentStep: number }) {
  const steps = [
    { num: 1, label: 'Upload Materials' },
    { num: 2, label: 'AI Parse' },
    { num: 3, label: 'Review & Edit' },
    { num: 4, label: 'Save & Publish' },
  ];
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {steps.map((s, i) => (
        <div key={s.num} className="flex items-center gap-2">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
            currentStep === s.num
              ? 'bg-blue-600 text-white shadow-md'
              : currentStep > s.num
              ? 'bg-green-100 text-green-700'
              : 'bg-gray-100 text-gray-400'
          }`}>
            {currentStep > s.num ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <span className="w-5 h-5 flex items-center justify-center rounded-full text-xs border border-current">
                {s.num}
              </span>
            )}
            <span className="hidden sm:inline">{s.label}</span>
          </div>
          {i < steps.length - 1 && (
            <div className={`w-8 h-0.5 ${currentStep > s.num ? 'bg-green-300' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// File upload area
function FileUploadArea({
  files,
  onFilesAdded,
  onRemoveFile,
  isUploading,
}: {
  files: UploadedFile[];
  onFilesAdded: (files: File[]) => void;
  onRemoveFile: (index: number) => void;
  isUploading: boolean;
}) {
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files);
    onFilesAdded(droppedFiles);
  }, [onFilesAdded]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      onFilesAdded(Array.from(e.target.files));
    }
  }, [onFilesAdded]);

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <Image className="w-5 h-5 text-green-500" />;
    if (type.startsWith('audio/')) return <Music className="w-5 h-5 text-purple-500" />;
    return <FileText className="w-5 h-5 text-blue-500" />;
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4">
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className="border-2 border-dashed border-blue-300 rounded-xl p-8 text-center hover:border-blue-500 hover:bg-blue-50/50 transition-all cursor-pointer relative"
      >
        <input
          type="file"
          multiple
          accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.mp3,.wav,.m4a,.ogg,.doc,.docx,.txt"
          onChange={handleChange}
          className="absolute inset-0 opacity-0 cursor-pointer"
          disabled={isUploading}
        />
        <Upload className="w-12 h-12 mx-auto text-blue-400 mb-3" />
        <p className="text-lg font-medium text-gray-700">
          Drop files here or click to upload
        </p>
        <p className="text-sm text-gray-500 mt-1">
          Supports: PDF, Images (PNG/JPG), Audio (MP3/WAV), Word documents
        </p>
        {isUploading && (
          <div className="mt-3 flex items-center justify-center gap-2 text-blue-600">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Uploading...</span>
          </div>
        )}
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-600">Uploaded Files ({files.length})</h4>
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              {getFileIcon(f.type)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{f.name}</p>
                <p className="text-xs text-gray-500">{formatSize(f.size)}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemoveFile(i)}
                className="text-red-400 hover:text-red-600"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Shared upload helper: compress + upload a single image file to S3.
 * Returns the uploaded URL.
 */
async function uploadSingleImage(
  file: File,
  uploadMutation: ReturnType<typeof trpc.papers.uploadFile.useMutation>,
  imageSize: ImageSize = 'full'
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

// Inline image upload button component with drag-and-drop support
function ImageUploadButton({
  label,
  currentUrl,
  onUploaded,
  onRemove,
  previewSize = 'md',
  imageSize = 'full',
}: {
  label: string;
  currentUrl?: string;
  onUploaded: (url: string) => void;
  onRemove: () => void;
  previewSize?: 'sm' | 'md' | 'lg';
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
    } catch (err) {
      console.error('Image upload error:', err);
      toast.error('Failed to upload image');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) await processFile(file);
  };

  const previewClass = previewSize === 'sm' ? 'max-h-12' : previewSize === 'lg' ? 'max-h-32' : 'max-h-20';

  return (
    <div
      className="space-y-1"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {currentUrl ? (
        <div className="flex items-start gap-2">
          <img
            src={currentUrl}
            alt={label}
            className={`${previewClass} object-contain rounded border bg-gray-50`}
          />
          <div className="flex flex-col gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={onRemove}
              className="h-6 px-2 text-red-400 hover:text-red-600 text-xs"
            >
              <X className="w-3 h-3 mr-1" /> Remove
            </Button>
            <label className="cursor-pointer">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
                disabled={isUploading}
              />
              <span className="inline-flex items-center h-6 px-2 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded">
                <ImagePlus className="w-3 h-3 mr-1" /> Replace
              </span>
            </label>
          </div>
        </div>
      ) : (
        <label
          className={`cursor-pointer inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border border-dashed transition-colors ${
            isDragOver
              ? 'text-blue-700 bg-blue-100 border-blue-400 ring-2 ring-blue-300'
              : 'text-blue-600 bg-blue-50 hover:bg-blue-100 border-blue-200'
          }`}
        >
          <input
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            disabled={isUploading}
          />
          {isUploading ? (
            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading...</>
          ) : isDragOver ? (
            <><ImagePlus className="w-3.5 h-3.5" /> Drop here</>
          ) : (
            <><ImagePlus className="w-3.5 h-3.5" /> {label}</>
          )}
        </label>
      )}
    </div>
  );
}

// Batch image upload component for a section
function BatchImageUpload({
  section,
  onUpdate,
}: {
  section: any;
  onUpdate: (updated: any) => void;
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const uploadFile = trpc.papers.uploadFile.useMutation();

  const handleBatchUpload = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList).filter((f) => {
      const error = validateImageFile(f);
      if (error) {
        toast.error(`${f.name}: ${error}`);
        return false;
      }
      return true;
    });

    if (files.length === 0) return;

    const questions = section.questions || [];
    // Find questions without images
    const emptySlots = questions
      .map((q: any, i: number) => ({ q, i }))
      .filter(({ q }: any) => !q.imageUrl);

    if (emptySlots.length === 0) {
      toast.error('All questions already have images. Remove some first to batch upload.');
      return;
    }

    const assignCount = Math.min(files.length, emptySlots.length);
    if (files.length > emptySlots.length) {
      toast.info(`Only ${emptySlots.length} questions need images. ${files.length - emptySlots.length} extra image(s) will be skipped.`);
    }

    setIsUploading(true);
    setProgress({ current: 0, total: assignCount });

    try {
      const updated = { ...section, questions: [...section.questions] };

      for (let i = 0; i < assignCount; i++) {
        setProgress({ current: i + 1, total: assignCount });
        const url = await uploadSingleImage(files[i], uploadFile, 'full');
        const qIndex = emptySlots[i].i;
        updated.questions[qIndex] = { ...updated.questions[qIndex], imageUrl: url };
      }

      onUpdate(updated);
      toast.success(`${assignCount} image(s) uploaded and assigned to questions`);
    } catch (err) {
      console.error('Batch upload error:', err);
      toast.error('Batch upload failed partway through. Some images may have been assigned.');
    } finally {
      setIsUploading(false);
      setProgress({ current: 0, total: 0 });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleBatchUpload(e.target.files);
      e.target.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files.length > 0) {
      handleBatchUpload(e.dataTransfer.files);
    }
  };

  const questionsWithoutImages = (section.questions || []).filter((q: any) => !q.imageUrl).length;

  return (
    <div
      className="p-3 bg-amber-50 rounded-lg text-sm space-y-2 border border-dashed border-amber-300"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <label className="text-xs text-amber-700 font-medium flex items-center gap-1">
        <Images className="w-3.5 h-3.5" /> Batch Upload Images
      </label>
      <p className="text-xs text-amber-600">
        Select multiple images at once. They will be assigned in order to questions without images.
        {questionsWithoutImages > 0 && (
          <span className="font-medium"> ({questionsWithoutImages} questions need images)</span>
        )}
      </p>
      {isUploading ? (
        <div className="flex items-center gap-2 py-2">
          <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
          <span className="text-xs text-amber-700 font-medium">
            Uploading {progress.current}/{progress.total}...
          </span>
          <div className="flex-1 h-1.5 bg-amber-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full transition-all duration-300"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
        </div>
      ) : (
        <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 rounded-md border border-amber-300 transition-colors">
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          <Images className="w-4 h-4" />
          Select Multiple Images (or drag & drop here)
        </label>
      )}
    </div>
  );
}

// Section preview/editor
function SectionEditor({
  section,
  sectionIndex,
  onUpdate,
}: {
  section: any;
  sectionIndex: number;
  onUpdate: (updated: any) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const updateQuestion = (qIndex: number, field: string, value: any) => {
    const updated = { ...section };
    updated.questions = [...updated.questions];
    updated.questions[qIndex] = { ...updated.questions[qIndex], [field]: value };
    onUpdate(updated);
  };

  const removeQuestion = (qIndex: number) => {
    const updated = { ...section };
    updated.questions = updated.questions.filter((_: any, i: number) => i !== qIndex);
    // Re-number question IDs
    updated.questions = updated.questions.map((q: any, i: number) => ({ ...q, id: i + 1 }));
    onUpdate(updated);
  };

  const getQuestionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'picture-mcq': '🖼️ Picture MCQ',
      'mcq': '📝 Multiple Choice',
      'fill-blank': '✏️ Fill in Blank',
      'listening-mcq': '🎧 Listening MCQ',
      'wordbank-fill': '📚 Word Bank Fill',
      'story-fill': '📖 Story Fill',
      'open-ended': '💬 Open Ended',
      'true-false': '✅ True/False',
      'checkbox': '☑️ Checkbox',
      'writing': '✍️ Writing',
      'table': '📊 Table',
      'reference': '🔗 Reference',
      'order': '🔢 Order',
      'phrase': '💡 Phrase',
    };
    return labels[type] || type;
  };

  const getCorrectAnswerDisplay = (q: any) => {
    if (q.type === 'mcq' || q.type === 'picture-mcq' || q.type === 'listening-mcq') {
      const opts = q.options || [];
      const idx = q.correctAnswer;
      if (idx >= 0 && idx < opts.length) {
        const opt = opts[idx];
        return `${String.fromCharCode(97 + idx)}) ${opt.text || opt.label || opt}`;
      }
      return `Index: ${idx}`;
    }
    if (q.type === 'fill-blank' || q.type === 'wordbank-fill' || q.type === 'story-fill') {
      return q.correctAnswer;
    }
    if (q.type === 'true-false') {
      return `${q.statements?.length || 0} statements`;
    }
    if (q.type === 'checkbox') {
      return q.correctAnswers?.map((i: number) => String.fromCharCode(97 + i)).join(', ');
    }
    if (q.type === 'writing') {
      return `Topic: ${q.topic}`;
    }
    if (q.type === 'open-ended') {
      return q.answer || `${q.subQuestions?.length || 0} sub-questions`;
    }
    return '—';
  };

  return (
    <Card className="border border-gray-200">
      <CardHeader
        className="cursor-pointer hover:bg-gray-50 transition-colors py-3"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{section.icon}</span>
            <div>
              <CardTitle className="text-base">{section.title}</CardTitle>
              <p className="text-xs text-gray-500">{section.questions?.length || 0} questions</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-1 bg-gray-100 rounded-full">
              {section.id}
            </span>
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 space-y-3">
          {/* Section metadata */}
          <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50 rounded-lg text-sm">
            <div>
              <label className="text-xs text-gray-500">Section ID</label>
              <Input
                value={section.id}
                onChange={(e) => onUpdate({ ...section, id: e.target.value })}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">Title</label>
              <Input
                value={section.title}
                onChange={(e) => onUpdate({ ...section, title: e.target.value })}
                className="h-8 text-sm"
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-500">Description</label>
              <Input
                value={section.description}
                onChange={(e) => onUpdate({ ...section, description: e.target.value })}
                className="h-8 text-sm"
              />
            </div>
            {section.passage && (
              <div className="col-span-2">
                <label className="text-xs text-gray-500">Passage</label>
                <Textarea
                  value={section.passage}
                  onChange={(e) => onUpdate({ ...section, passage: e.target.value })}
                  className="text-sm"
                  rows={4}
                />
              </div>
            )}
            {section.grammarPassage && (
              <div className="col-span-2">
                <label className="text-xs text-gray-500">Grammar Passage (with blanks)</label>
                <Textarea
                  value={section.grammarPassage}
                  onChange={(e) => onUpdate({ ...section, grammarPassage: e.target.value })}
                  className="text-sm"
                  rows={4}
                />
              </div>
            )}
            {section.audioUrl && (
              <div className="col-span-2">
                <label className="text-xs text-gray-500">Audio URL</label>
                <Input
                  value={section.audioUrl}
                  onChange={(e) => onUpdate({ ...section, audioUrl: e.target.value })}
                  className="h-8 text-sm"
                />
              </div>
            )}
          </div>

          {/* Section-level scene image */}
          <div className="p-3 bg-blue-50 rounded-lg text-sm space-y-2">
            <label className="text-xs text-gray-600 font-medium flex items-center gap-1">
              <Image className="w-3.5 h-3.5" /> Scene Image
            </label>
            <div className="flex items-start gap-3">
              <ImageUploadButton
                label="Upload Scene Image"
                currentUrl={section.sceneImageUrl}
                onUploaded={(url) => onUpdate({ ...section, sceneImageUrl: url })}
                onRemove={() => onUpdate({ ...section, sceneImageUrl: '' })}
                previewSize="lg"
              />
              <div className="flex-1">
                <Input
                  value={section.sceneImageUrl || ''}
                  onChange={(e) => onUpdate({ ...section, sceneImageUrl: e.target.value })}
                  placeholder="Or paste image URL here..."
                  className="h-7 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Batch image upload */}
          <BatchImageUpload section={section} onUpdate={onUpdate} />

          {/* Questions */}
          <div className="space-y-2">
            {section.questions?.map((q: any, qi: number) => (
              <div key={qi} className="flex items-start gap-2 p-3 bg-white border rounded-lg">
                <GripVertical className="w-4 h-4 text-gray-300 mt-1 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded">Q{q.id}</span>
                    <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full">
                      {getQuestionTypeLabel(q.type)}
                    </span>
                    {q.imageUrl && (
                      <span className="text-xs px-2 py-0.5 bg-green-50 text-green-600 rounded-full">Has Image</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-800 mb-1">
                    {q.question || q.topic || q.statements?.[0]?.statement || '(no question text)'}
                  </p>

                  {/* Question image: upload + URL editor + preview */}
                  <div className="my-2 p-2 bg-gray-50 rounded-md border border-dashed border-gray-200 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <ImageUploadButton
                        label="Upload Question Image"
                        currentUrl={q.imageUrl}
                        onUploaded={(url) => updateQuestion(qi, 'imageUrl', url)}
                        onRemove={() => updateQuestion(qi, 'imageUrl', '')}
                        previewSize="md"
                      />
                    </div>
                    {!q.imageUrl && (
                      <Input
                        value={q.imageUrl || ''}
                        onChange={(e) => updateQuestion(qi, 'imageUrl', e.target.value)}
                        placeholder="Or paste image URL here..."
                        className="h-7 text-xs"
                      />
                    )}
                  </div>

                  {/* Options for MCQ types */}
                  {(q.type === 'mcq' || q.type === 'picture-mcq' || q.type === 'listening-mcq') && q.options && (
                    <div className="space-y-1.5 mt-1">
                      {q.options.map((opt: any, oi: number) => (
                        <div key={oi} className="flex items-start gap-2 p-1.5 rounded hover:bg-gray-50">
                          <span
                            className={`text-xs px-2 py-0.5 rounded flex-shrink-0 mt-0.5 ${
                              oi === q.correctAnswer
                                ? 'bg-green-100 text-green-700 font-medium'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {String.fromCharCode(97 + oi)}) {typeof opt === 'string' ? opt : opt.text || opt.label}
                          </span>
                          {/* Option image upload for picture-mcq */}
                          {(q.type === 'picture-mcq' || q.type === 'listening-mcq') && (
                            <div className="flex-1 min-w-0">
                              <ImageUploadButton
                                label={`Upload Option ${String.fromCharCode(65 + oi)} Image`}
                                currentUrl={typeof opt === 'object' ? opt.imageUrl : undefined}
                                onUploaded={(url) => {
                                  const newOptions = [...q.options];
                                  if (typeof newOptions[oi] === 'string') {
                                    newOptions[oi] = { text: newOptions[oi], label: String.fromCharCode(65 + oi), imageUrl: url };
                                  } else {
                                    newOptions[oi] = { ...newOptions[oi], imageUrl: url };
                                  }
                                  updateQuestion(qi, 'options', newOptions);
                                }}
                                onRemove={() => {
                                  const newOptions = [...q.options];
                                  if (typeof newOptions[oi] === 'object') {
                                    newOptions[oi] = { ...newOptions[oi], imageUrl: '' };
                                  }
                                  updateQuestion(qi, 'options', newOptions);
                                }}
                                previewSize="sm"
                                imageSize="option"
                              />
                              {!((typeof opt === 'object' && opt.imageUrl)) && (
                                <Input
                                  value={typeof opt === 'object' ? (opt.imageUrl || '') : ''}
                                  onChange={(e) => {
                                    const newOptions = [...q.options];
                                    if (typeof newOptions[oi] === 'string') {
                                      newOptions[oi] = { text: newOptions[oi], label: String.fromCharCode(65 + oi), imageUrl: e.target.value };
                                    } else {
                                      newOptions[oi] = { ...newOptions[oi], imageUrl: e.target.value };
                                    }
                                    updateQuestion(qi, 'options', newOptions);
                                  }}
                                  placeholder="Or paste option image URL"
                                  className="h-6 text-xs mt-1"
                                />
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    Answer: <span className="font-medium text-green-600">{getCorrectAnswerDisplay(q)}</span>
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeQuestion(qi)}
                  className="text-red-400 hover:text-red-600 flex-shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// Main component
export default function PaperCreator() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [step, setStep] = useState(1);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [instructions, setInstructions] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parsedPaper, setParsedPaper] = useState<ParsedPaper | null>(null);
  const [paperTitle, setPaperTitle] = useState('');
  const [paperSubtitle, setPaperSubtitle] = useState('');
  const [paperDescription, setPaperDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const uploadFile = trpc.papers.uploadFile.useMutation();
  const parseMaterials = trpc.papers.parseMaterials.useMutation();
  const createPaper = trpc.papers.create.useMutation();

  // Password check
  const handleUnlock = () => {
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
    } else {
      toast.error('Incorrect password');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
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
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
            />
            <Button onClick={handleUnlock} className="w-full">Unlock</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Handle file upload to S3
  const handleFilesAdded = async (newFiles: File[]) => {
    setIsUploading(true);
    try {
      for (const file of newFiles) {
        // Read file as base64
        const buffer = await file.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
        );

        const result = await uploadFile.mutateAsync({
          fileName: file.name,
          fileBase64: base64,
          contentType: file.type,
        });

        setFiles((prev) => [
          ...prev,
          { name: file.name, type: file.type, url: result.url, size: file.size },
        ]);
      }
      toast.success(`${newFiles.length} file(s) uploaded successfully`);
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Failed to upload file(s)');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // AI parse materials
  const handleParse = async () => {
    if (files.length === 0) {
      toast.error('Please upload at least one file');
      return;
    }

    setIsParsing(true);
    try {
      const imageUrls = files
        .filter((f) => f.type.startsWith('image/'))
        .map((f) => f.url);
      const pdfUrls = files
        .filter((f) => f.type === 'application/pdf')
        .map((f) => f.url);
      const audioUrls = files
        .filter((f) => f.type.startsWith('audio/'))
        .map((f) => f.url);

      const result = await parseMaterials.mutateAsync({
        imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
        pdfUrls: pdfUrls.length > 0 ? pdfUrls : undefined,
        audioUrls: audioUrls.length > 0 ? audioUrls : undefined,
        instructions: instructions || undefined,
      });

      setParsedPaper(result as ParsedPaper);
      setPaperTitle(result.title);
      setPaperSubtitle(result.subtitle);
      setPaperDescription(result.description);
      setStep(3);
      toast.success('Materials parsed successfully!');
    } catch (err) {
      console.error('Parse error:', err);
      toast.error('Failed to parse materials. Please try again.');
    } finally {
      setIsParsing(false);
    }
  };

  // Update a section in the parsed paper
  const handleUpdateSection = (sectionIndex: number, updated: any) => {
    if (!parsedPaper) return;
    const newSections = [...parsedPaper.sections];
    newSections[sectionIndex] = updated;
    setParsedPaper({ ...parsedPaper, sections: newSections });
  };

  // Remove a section
  const handleRemoveSection = (sectionIndex: number) => {
    if (!parsedPaper) return;
    const newSections = parsedPaper.sections.filter((_, i) => i !== sectionIndex);
    const totalQ = newSections.reduce((sum: number, s: any) => sum + (s.questions?.length || 0), 0);
    setParsedPaper({ ...parsedPaper, sections: newSections, totalQuestions: totalQ });
  };

  // Save paper
  const handleSave = async (status: 'draft' | 'published') => {
    if (!parsedPaper) return;

    // Inject audio URLs into listening sections
    const audioFiles = files.filter((f) => f.type.startsWith('audio/'));
    const sections = parsedPaper.sections.map((s: any) => {
      if (s.id.includes('listening') && audioFiles.length > 0 && !s.audioUrl) {
        return { ...s, audioUrl: audioFiles[0].url };
      }
      return s;
    });

    const totalQ = sections.reduce((sum: number, s: any) => sum + (s.questions?.length || 0), 0);

    setIsSaving(true);
    try {
      const result = await createPaper.mutateAsync({
        title: paperTitle,
        subtitle: paperSubtitle || undefined,
        description: paperDescription || undefined,
        totalQuestions: totalQ,
        hasListening: sections.some((s: any) => s.id.includes('listening') || s.audioUrl),
        hasWriting: sections.some((s: any) => s.questions?.some((q: any) => q.type === 'writing')),
        sectionsJson: JSON.stringify(sections),
        sourceFilesJson: JSON.stringify(files),
        status,
      });

      toast.success(
        status === 'published'
          ? 'Paper published! Students can now see it.'
          : 'Paper saved as draft.'
      );
      setStep(4);
    } catch (err) {
      console.error('Save error:', err);
      toast.error('Failed to save paper');
    } finally {
      setIsSaving(false);
    }
  };

  // Reset to create another
  const handleReset = () => {
    setStep(1);
    setFiles([]);
    setInstructions('');
    setParsedPaper(null);
    setPaperTitle('');
    setPaperSubtitle('');
    setPaperDescription('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900">📝 Paper Creator</h1>
              <p className="text-xs text-gray-500">Upload materials, AI parses into assessment format</p>
            </div>
          </div>
          <Link href="/paper-manager">
            <Button variant="outline" size="sm">
              Manage Papers
            </Button>
          </Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        <StepIndicator currentStep={step} />

        {/* Step 1: Upload Materials */}
        {step === 1 && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5 text-blue-500" />
                  Upload Test Materials
                </CardTitle>
                <p className="text-sm text-gray-500">
                  Upload PDF files, images of test papers, or audio files for listening sections.
                  The AI will analyze these materials and create a structured assessment paper.
                </p>
              </CardHeader>
              <CardContent>
                <FileUploadArea
                  files={files}
                  onFilesAdded={handleFilesAdded}
                  onRemoveFile={handleRemoveFile}
                  isUploading={isUploading}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Pencil className="w-4 h-4 text-gray-500" />
                  Additional Instructions (Optional)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="E.g., 'This is a Grade 4 vocabulary test. The listening audio has 8 questions. Please make sure all answer options are included...'"
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  rows={3}
                />
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button
                onClick={() => {
                  if (files.length === 0) {
                    toast.error('Please upload at least one file');
                    return;
                  }
                  setStep(2);
                }}
                size="lg"
                className="bg-blue-600 hover:bg-blue-700"
              >
                Next: AI Parse <Sparkles className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: AI Parse */}
        {step === 2 && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-500" />
                  AI Analysis
                </CardTitle>
                <p className="text-sm text-gray-500">
                  The AI will analyze your uploaded materials and convert them into a structured assessment paper.
                  This may take 30-60 seconds depending on the complexity.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="text-sm font-medium mb-2">Files to analyze:</h4>
                  <ul className="space-y-1">
                    {files.map((f, i) => (
                      <li key={i} className="text-sm text-gray-600 flex items-center gap-2">
                        {f.type.startsWith('image/') ? <Image className="w-4 h-4 text-green-500" /> :
                         f.type.startsWith('audio/') ? <Music className="w-4 h-4 text-purple-500" /> :
                         <FileText className="w-4 h-4 text-blue-500" />}
                        {f.name}
                      </li>
                    ))}
                  </ul>
                  {instructions && (
                    <div className="mt-3 pt-3 border-t">
                      <h4 className="text-sm font-medium mb-1">Instructions:</h4>
                      <p className="text-sm text-gray-600">{instructions}</p>
                    </div>
                  )}
                </div>

                {isParsing ? (
                  <div className="flex flex-col items-center py-8 gap-3">
                    <Loader2 className="w-10 h-10 animate-spin text-purple-500" />
                    <p className="text-gray-600 font-medium">AI is analyzing your materials...</p>
                    <p className="text-sm text-gray-400">This may take 30-60 seconds</p>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={() => setStep(1)}>
                      <ArrowLeft className="w-4 h-4 mr-1" /> Back
                    </Button>
                    <Button
                      onClick={handleParse}
                      className="bg-purple-600 hover:bg-purple-700 flex-1"
                      size="lg"
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      Start AI Analysis
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 3: Review & Edit */}
        {step === 3 && parsedPaper && (
          <div className="space-y-6">
            {/* Paper metadata */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="w-5 h-5 text-green-500" />
                  Review & Edit Paper
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Paper Title</label>
                    <Input
                      value={paperTitle}
                      onChange={(e) => setPaperTitle(e.target.value)}
                      placeholder="e.g., G4 English Proficiency Assessment"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Subtitle</label>
                    <Input
                      value={paperSubtitle}
                      onChange={(e) => setPaperSubtitle(e.target.value)}
                      placeholder="e.g., Grade 4-5 Level"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-gray-700">Description</label>
                    <Textarea
                      value={paperDescription}
                      onChange={(e) => setPaperDescription(e.target.value)}
                      placeholder="Brief description of the paper"
                      rows={2}
                    />
                  </div>
                </div>

                {/* Stats */}
                <div className="flex gap-4 p-3 bg-blue-50 rounded-lg">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-600">
                      {parsedPaper.sections.reduce((sum: number, s: any) => sum + (s.questions?.length || 0), 0)}
                    </p>
                    <p className="text-xs text-gray-500">Questions</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-600">{parsedPaper.sections.length}</p>
                    <p className="text-xs text-gray-500">Sections</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-600">
                      {parsedPaper.hasListening ? '✓' : '✗'}
                    </p>
                    <p className="text-xs text-gray-500">Listening</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-600">
                      {parsedPaper.hasWriting ? '✓' : '✗'}
                    </p>
                    <p className="text-xs text-gray-500">Writing</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Sections */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Sections</h3>
                <p className="text-sm text-gray-500">Click a section to expand and edit</p>
              </div>
              {parsedPaper.sections.map((section: any, i: number) => (
                <div key={i} className="relative">
                  <SectionEditor
                    section={section}
                    sectionIndex={i}
                    onUpdate={(updated) => handleUpdateSection(i, updated)}
                  />
                  {parsedPaper.sections.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-3 right-12 text-red-400 hover:text-red-600"
                      onClick={() => handleRemoveSection(i)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Re-parse
              </Button>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => handleSave('draft')}
                  disabled={isSaving}
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                  Save Draft
                </Button>
                <Button
                  onClick={() => handleSave('published')}
                  disabled={isSaving}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
                  Publish Paper
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Success */}
        {step === 4 && (
          <div className="flex flex-col items-center py-12 gap-6">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Paper Saved Successfully!</h2>
              <p className="text-gray-600">
                Your assessment paper has been created. Students can now see it on the homepage.
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={handleReset}>
                <Plus className="w-4 h-4 mr-1" /> Create Another
              </Button>
              <Link href="/paper-manager">
                <Button>
                  Manage Papers
                </Button>
              </Link>
              <Link href="/">
                <Button variant="outline">
                  Go to Homepage
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
