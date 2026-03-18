import type { ManualQuestionTags, ManualQuestionType, ManualSectionType } from "@shared/manualPaperBlueprint";
import {
  ENGLISH_TAG_ABILITY_OPTIONS,
  ENGLISH_TAG_DIFFICULTY_OPTIONS,
  getEnglishExamTagSchema,
  normalizeEnglishQuestionTagProfile,
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
    if (sectionType === "grammar") return "Grammar";
    if (sectionType === "vocabulary") return "Vocabulary";
    if (sectionType === "listening") return "Listening";
    if (sectionType === "speaking" || questionType === "speaking") return "Speaking";
    if (sectionType === "writing" || questionType === "writing") return "Writing";
    return "Reading";
  })() as EnglishExamTagAbility;

  return {
    track: defaultTrack,
    entries: ["Exam Bank"],
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

  const rawProfile = normalizeEnglishQuestionTagProfile(
    value?.english ?? createDefaultProfile(sectionType, questionType, defaultTrack),
  );
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
          <p className="text-sm font-semibold text-slate-900">Question Tags</p>
          <p className="text-xs text-slate-500">Random paper generation only pulls English questions tagged here.</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          className="h-auto px-2 py-1 text-xs text-slate-500"
          onClick={() => onChange(undefined)}
        >
          Clear Tags
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Exam System</Label>
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
          <Label>Skill</Label>
          <select
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
            value={profile.ability}
            onChange={(event) => {
              const nextAbility = event.target.value as EnglishExamTagAbility;
              handleProfileChange((current) => ({
                ...current,
                ability: nextAbility,
                grammarPoints: nextAbility === "Grammar" ? current.grammarPoints ?? [] : [],
                difficulty: nextAbility === "Grammar" ? current.difficulty : undefined,
              }));
            }}
          >
            {ENGLISH_TAG_ABILITY_OPTIONS.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label>Unit</Label>
          <select
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
            value={profile.unit || ""}
            onChange={(event) => {
              const nextUnit = event.target.value || undefined;
              handleProfileChange((current) => ({
                ...current,
                unit: nextUnit,
                grammarUnit: current.ability === "Grammar" ? (nextUnit || current.grammarUnit) : current.grammarUnit,
                grammarPoints: current.ability === "Grammar" && nextUnit && current.grammarUnit !== nextUnit
                  ? []
                  : current.grammarPoints ?? [],
              }));
            }}
          >
            <option value="">N/A</option>
            {schema.units.map((unit) => (
              <option key={unit} value={unit}>{unit}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label>Exam Part</Label>
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
            <option value="">N/A</option>
            {schema.examParts.map((part) => (
              <option key={part} value={part}>{part}</option>
            ))}
          </select>
        </div>
      </div>

      {profile.ability === "Grammar" ? (
        <div className="space-y-4 rounded-xl border border-amber-100 bg-white/90 p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Grammar Unit</Label>
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
                <option value="">Select a unit</option>
                {schema.units.map((unit) => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Difficulty</Label>
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
                <option value="">Unassigned</option>
                {ENGLISH_TAG_DIFFICULTY_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Grammar Points</Label>
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
              <p className="text-xs text-slate-500">Choose a grammar unit first, then select grammar points.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
