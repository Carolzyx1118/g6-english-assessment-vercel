import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MANUAL_QUESTION_TYPE_LABELS, MANUAL_SECTION_TYPE_LABELS } from "@shared/manualPaperBlueprint";
import { getEnglishExamTagSchema, type EnglishExamTagTrack } from "@shared/englishQuestionTags";
import type { EnglishQuickGeneratedPartSelection } from "@/lib/englishQuickPaperPreset";
import { getQuestionTypesForEnglishExamPart } from "@/lib/englishQuickPaperPreset";
import { useEnglishTagSchemas } from "@/hooks/useEnglishTagSchemas";

interface EnglishQuickGeneratedBuilderProps {
  track: EnglishExamTagTrack;
  parts: EnglishQuickGeneratedPartSelection[];
  onTrackChange: (track: EnglishExamTagTrack) => void;
  onPartChange: (
    partId: string,
    updater: (part: EnglishQuickGeneratedPartSelection) => EnglishQuickGeneratedPartSelection,
  ) => void;
}

export default function EnglishQuickGeneratedBuilder({
  track,
  parts,
  onTrackChange,
  onPartChange,
}: EnglishQuickGeneratedBuilderProps) {
  const { schemaEntries, schemas } = useEnglishTagSchemas();
  const configuredParts = parts.filter((part) => (Number.isFinite(part.totalQuestions) ? part.totalQuestions : 0) > 0);
  const totalQuestions = configuredParts.reduce((sum, part) => sum + Math.max(0, part.totalQuestions || 0), 0);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">随机组卷创建页</h3>
            <p className="mt-1 text-sm text-slate-500">
              先选考试体系，再按 Part 设题型和题数。题数填 0 就表示这次不抽这个 Part。
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-600">
              已选 {configuredParts.length} 个 Part
            </span>
            <span className="rounded-full bg-[#D4A84B]/10 px-3 py-1 font-medium text-[#A97C21]">
              共 {totalQuestions} 题
            </span>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          {schemaEntries.map(([option, schema]) => (
            <button
              key={option}
              type="button"
              onClick={() => onTrackChange(option)}
              className={`inline-flex items-center rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                track === option
                  ? "border-[#1E3A5F] bg-[#1E3A5F] text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-[#1E3A5F]"
              }`}
            >
              {schema.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="hidden grid-cols-[1.2fr,140px,1fr,96px] gap-3 border-b border-slate-200 bg-slate-50/80 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 md:grid">
          <span>Part</span>
          <span>分区</span>
          <span>题型</span>
          <span>道数</span>
        </div>

        <div className="divide-y divide-slate-100">
          {parts.map((part) => {
            const availableQuestionTypes = getQuestionTypesForEnglishExamPart(part.examPart);
            const isEnabled = part.totalQuestions > 0;
            const currentSchema = getEnglishExamTagSchema(track, schemas);

            return (
              <div
                key={part.id}
                className={`grid gap-3 px-5 py-4 transition-colors md:grid-cols-[1.2fr,140px,1fr,96px] md:items-center ${
                  isEnabled ? "bg-sky-50/30" : "bg-white"
                }`}
              >
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{part.examPart}</p>
                  <p className="mt-1 text-xs text-slate-400 md:hidden">
                    对应分区：{MANUAL_SECTION_TYPE_LABELS[part.sectionType]} · {currentSchema.label}
                  </p>
                </div>

                <div className="hidden md:block">
                  <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                    {MANUAL_SECTION_TYPE_LABELS[part.sectionType]}
                  </span>
                </div>

                <div className="space-y-1.5 md:space-y-0">
                  <Label className="text-[11px] font-medium text-slate-400 md:hidden">题型</Label>
                  <select
                    value={part.questionType}
                    onChange={(event) => onPartChange(part.id, (current) => ({
                      ...current,
                      questionType: event.target.value as EnglishQuickGeneratedPartSelection["questionType"],
                    }))}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm shadow-sm"
                  >
                    {availableQuestionTypes.map((questionType) => (
                      <option key={questionType} value={questionType}>
                        {MANUAL_QUESTION_TYPE_LABELS[questionType]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5 md:space-y-0">
                  <Label className="text-[11px] font-medium text-slate-400 md:hidden">道数</Label>
                  <Input
                    type="number"
                    min={0}
                    value={part.totalQuestions}
                    onChange={(event) => onPartChange(part.id, (current) => ({
                      ...current,
                      totalQuestions: Math.max(0, Number(event.target.value) || 0),
                    }))}
                    className="h-10 rounded-xl border-slate-200 text-center shadow-sm"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
