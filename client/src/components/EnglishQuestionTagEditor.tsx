import type { ManualQuestionTags, ManualQuestionType, ManualSectionType } from "@shared/manualPaperBlueprint";
import {
  ENGLISH_TAG_ABILITY_OPTIONS,
  ENGLISH_TAG_DIFFICULTY_OPTIONS,
  ENGLISH_TAG_ENTRY_OPTIONS,
  getEnglishExamTagSchema,
  type EnglishExamTagAbility,
  type EnglishExamTagTrack,
  type EnglishQuestionTagProfile,
} from "@shared/englishQuestionTags";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useEnglishTagSchemas } from "@/hooks/useEnglishTagSchemas";

function createDefaultProfile(
  sectionType: ManualSectionType,
  questionType: ManualQuestionType,
  defaultTrack: EnglishExamTagTrack,
): EnglishQuestionTagProfile {
  const ability = (() => {
    if (sectionType === "grammar") return "语法";
    if (sectionType === "vocabulary") return "词汇";
    if (sectionType === "listening") return "听力理解";
    if (sectionType === "speaking" || questionType === "speaking") return "口语";
    if (sectionType === "writing" || questionType === "writing") return "写作";
    return "阅读理解";
  })() as EnglishExamTagAbility;

  return {
    track: defaultTrack,
    entries: ["考试题库"],
    ability,
    grammarPoints: [],
  };
}

function updateProfileValue(
  current: ManualQuestionTags | undefined,
  nextProfile: EnglishQuestionTagProfile,
) {
  return {
    ...(current ?? {}),
    english: nextProfile,
  };
}

interface EnglishQuestionTagEditorProps {
  value?: ManualQuestionTags;
  sectionType: ManualSectionType;
  questionType: ManualQuestionType;
  onChange: (next: ManualQuestionTags | undefined) => void;
}

export default function EnglishQuestionTagEditor({
  value,
  sectionType,
  questionType,
  onChange,
}: EnglishQuestionTagEditorProps) {
  const { schemas, schemaEntries, defaultTrack } = useEnglishTagSchemas();

  const rawProfile = value?.english ?? createDefaultProfile(sectionType, questionType, defaultTrack);
  const safeTrack = schemaEntries.some(([track]) => track === rawProfile.track) ? rawProfile.track : defaultTrack;
  const profile = safeTrack === rawProfile.track ? rawProfile : { ...rawProfile, track: safeTrack };
  const schema = getEnglishExamTagSchema(profile.track, schemas);
  const grammarUnit = profile.grammarUnit || profile.unit;
  const grammarOptions = grammarUnit ? (schema.grammarByUnit[grammarUnit] ?? []) : [];

  const handleProfileChange = (updater: (profile: EnglishQuestionTagProfile) => EnglishQuestionTagProfile) => {
    onChange(updateProfileValue(value, updater(profile)));
  };

  const toggleArrayValue = (
    currentValues: string[] | undefined,
    targetValue: string,
    updater: (values: string[]) => void,
  ) => {
    const values = currentValues ?? [];
    const nextValues = values.includes(targetValue)
      ? values.filter((value) => value !== targetValue)
      : [...values, targetValue];
    updater(nextValues);
  };

  return (
    <div className="space-y-4 rounded-2xl border border-sky-100 bg-sky-50/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">题目标签</p>
          <p className="text-xs text-slate-500">随机组卷只会抽取这里已经打好标签的英语题。</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          className="h-auto px-2 py-1 text-xs text-slate-500"
          onClick={() => onChange(undefined)}
        >
          清空标签
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>考试体系</Label>
          <select
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
            value={profile.track}
            onChange={(event) => {
              const nextTrack = event.target.value as EnglishExamTagTrack;
              const nextSchema = getEnglishExamTagSchema(nextTrack, schemas);
              handleProfileChange((current) => ({
                ...current,
                track: nextTrack,
                unit: nextSchema.units.includes(current.unit || "") ? current.unit : undefined,
                examPart: nextSchema.examParts.includes(current.examPart || "") ? current.examPart : undefined,
                grammarUnit: nextSchema.units.includes(current.grammarUnit || "") ? current.grammarUnit : undefined,
                grammarPoints: (current.grammarPoints ?? []).filter((point) =>
                  Object.values(nextSchema.grammarByUnit).some((points) => points.includes(point)),
                ),
              }));
            }}
          >
            {schemaEntries.map(([track, entrySchema]) => (
              <option key={track} value={track}>{entrySchema.label}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label>类型</Label>
          <select
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
            value={profile.ability}
            onChange={(event) => {
              const nextAbility = event.target.value as EnglishExamTagAbility;
              handleProfileChange((current) => ({
                ...current,
                ability: nextAbility,
                grammarPoints: nextAbility === "语法" ? current.grammarPoints ?? [] : [],
                difficulty: nextAbility === "语法" ? current.difficulty : undefined,
              }));
            }}
          >
            {ENGLISH_TAG_ABILITY_OPTIONS.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>入口</Label>
        <div className="flex flex-wrap gap-3">
          {ENGLISH_TAG_ENTRY_OPTIONS.map((entry) => {
            const checked = profile.entries.includes(entry);
            return (
              <label key={entry} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    toggleArrayValue(profile.entries, entry, (entries) => {
                      handleProfileChange((current) => ({ ...current, entries: entries as typeof profile.entries }));
                    });
                  }}
                />
                <span>{entry}</span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>教材单元</Label>
          <select
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
            value={profile.unit || ""}
            onChange={(event) => {
              const nextUnit = event.target.value || undefined;
              handleProfileChange((current) => ({
                ...current,
                unit: nextUnit,
                grammarUnit: current.ability === "语法" ? (nextUnit || current.grammarUnit) : current.grammarUnit,
                grammarPoints: current.ability === "语法" && nextUnit && current.grammarUnit !== nextUnit
                  ? []
                  : current.grammarPoints ?? [],
              }));
            }}
          >
            <option value="">未设置</option>
            {schema.units.map((unit) => (
              <option key={unit} value={unit}>{unit}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label>考试 Part</Label>
          <select
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
            value={profile.examPart || ""}
            onChange={(event) => {
              const nextPart = event.target.value || undefined;
              handleProfileChange((current) => ({
                ...current,
                examPart: nextPart,
              }));
            }}
          >
            <option value="">未设置</option>
            {schema.examParts.map((part) => (
              <option key={part} value={part}>{part}</option>
            ))}
          </select>
        </div>
      </div>

      {profile.ability === "语法" ? (
        <div className="space-y-4 rounded-xl border border-amber-100 bg-white/90 p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>语法所属单元</Label>
              <select
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                value={grammarUnit || ""}
                onChange={(event) => {
                  const nextGrammarUnit = event.target.value || undefined;
                  handleProfileChange((current) => ({
                    ...current,
                    grammarUnit: nextGrammarUnit,
                    grammarPoints: [],
                  }));
                }}
              >
                <option value="">请选择</option>
                {schema.units.map((unit) => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>难度</Label>
              <select
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                value={profile.difficulty || ""}
                onChange={(event) => {
                  const nextDifficulty = event.target.value || undefined;
                  handleProfileChange((current) => ({
                    ...current,
                    difficulty: nextDifficulty as EnglishQuestionTagProfile["difficulty"],
                  }));
                }}
              >
                <option value="">未设置</option>
                {ENGLISH_TAG_DIFFICULTY_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>语法知识点</Label>
            {grammarOptions.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {grammarOptions.map((point) => {
                  const checked = profile.grammarPoints?.includes(point) ?? false;
                  return (
                    <label key={point} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          toggleArrayValue(profile.grammarPoints, point, (grammarPoints) => {
                            handleProfileChange((current) => ({ ...current, grammarPoints }));
                          });
                        }}
                      />
                      <span>{point}</span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-500">先选择语法所属单元，再勾选知识点。</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
