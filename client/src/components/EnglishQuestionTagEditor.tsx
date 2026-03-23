import { useEffect } from "react";
import {
  MANUAL_QUESTION_TYPE_LABELS,
  type ManualQuestionTags,
  type ManualQuestionType,
  type ManualSectionType,
} from "@shared/manualPaperBlueprint";
import {
  ENGLISH_TAG_ABILITY_OPTIONS,
  ENGLISH_TAG_DIFFICULTY_OPTIONS,
  getEnglishAbilityFromExamPart,
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
  const { data: systems, schemas, schemaEntries, defaultTrack } = useEnglishTagSchemas();

  const rawProfile = normalizeEnglishQuestionTagProfile(
    value?.english ?? createDefaultProfile(sectionType, questionType, defaultTrack),
  );
  const safeTrack = schemaEntries.some(([track]) => track === rawProfile.track) ? rawProfile.track : defaultTrack;
  const schema = getEnglishExamTagSchema(safeTrack, schemas);
  const systemMode = schema.systemMode === "textbook-practice" ? "textbook-practice" : "assessment";
  const selectedSystem = systems?.find((system) => system.id === safeTrack);
  const profileBase = safeTrack === rawProfile.track ? rawProfile : { ...rawProfile, track: safeTrack };
  const profile = (
    systemMode === "assessment"
      ? {
          ...profileBase,
          ability: getEnglishAbilityFromExamPart(profileBase.examPart) ?? profileBase.ability,
        }
      : profileBase
  ) satisfies EnglishQuestionTagProfile;
  const grammarUnit = profile.grammarUnit || profile.unit;
  const grammarOptions = grammarUnit ? (schema.grammarByUnit[grammarUnit] ?? []) : [];
  const availableExamParts = systemMode === "assessment" ? schema.examParts : [];
  const selectedExamPartQuestionType = profile.examPart
    ? selectedSystem?.generatedPaper?.parts.find((item) => item.examPart === profile.examPart)?.questionType
    : undefined;

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

  useEffect(() => {
    if (systemMode !== "assessment" || !profile.examPart) return;
    if (availableExamParts.includes(profile.examPart)) return;

    onChange(updateProfileValue(value, {
      ...profile,
      examPart: undefined,
    }));
  }, [availableExamParts, onChange, profile, systemMode, value]);

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
              const nextSystemMode = nextSchema.systemMode === "textbook-practice" ? "textbook-practice" : "assessment";
              handleProfileChange((current) => ({
                ...current,
                track: nextTrack,
                unit:
                  nextSystemMode === "textbook-practice" && nextSchema.units.includes(current.unit || "")
                    ? current.unit
                    : undefined,
                examPart:
                  nextSystemMode === "assessment" && nextSchema.examParts.includes(current.examPart || "")
                    ? current.examPart
                    : undefined,
                ability:
                  nextSystemMode === "assessment"
                    ? getEnglishAbilityFromExamPart(
                        nextSchema.examParts.includes(current.examPart || "") ? current.examPart : undefined,
                      ) ?? current.ability
                    : current.ability,
                grammarUnit:
                  nextSystemMode === "textbook-practice" && nextSchema.units.includes(current.grammarUnit || "")
                    ? current.grammarUnit
                    : undefined,
                grammarPoints:
                  nextSystemMode === "textbook-practice"
                    ? (current.grammarPoints ?? []).filter((point) =>
                        Object.values(nextSchema.grammarByUnit).some((points) => points.includes(point)),
                      )
                    : [],
                difficulty: nextSystemMode === "textbook-practice" ? current.difficulty : undefined,
              }));
            }}
          >
            {schemaEntries.map(([track, entrySchema]) => (
              <option key={track} value={track}>{entrySchema.label}</option>
            ))}
          </select>
        </div>

        {systemMode === "assessment" ? (
          <div className="space-y-2">
            <Label>Exam Part</Label>
            <select
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
              value={availableExamParts.includes(profile.examPart || "") ? (profile.examPart || "") : ""}
              onChange={(event) => {
                const nextPart = event.target.value || undefined;
                handleProfileChange((current) => ({
                  ...current,
                  examPart: nextPart,
                  unit: undefined,
                  ability: getEnglishAbilityFromExamPart(nextPart) ?? current.ability,
                  grammarUnit: undefined,
                  grammarPoints: [],
                  difficulty: undefined,
                }));
              }}
            >
              <option value="" disabled>
                Select Exam Part
              </option>
              {availableExamParts.map((part) => (
                <option key={part} value={part}>{part}</option>
              ))}
            </select>
            {availableExamParts.length === 0 ? (
              <p className="text-xs text-amber-600">
                No exam parts are configured for this system yet. Update Paper Generator first.
              </p>
            ) : profile.examPart && selectedExamPartQuestionType ? (
              <p className="text-xs text-amber-600">
                {profile.examPart} uses{" "}
                {MANUAL_QUESTION_TYPE_LABELS[selectedExamPartQuestionType as ManualQuestionType] ?? selectedExamPartQuestionType}
                . The Question Type below will update automatically.
              </p>
            ) : (
              <p className="text-xs text-slate-500">
                Choose the exam part first. The Question Type options below will update to match it.
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label>Skill</Label>
              <select
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                value={profile.ability}
                onChange={(event) => {
                  const nextAbility = event.target.value as EnglishExamTagAbility;
                  handleProfileChange((current) => ({
                    ...current,
                    examPart: undefined,
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
                    examPart: undefined,
                    grammarUnit: current.ability === "Grammar" ? (nextUnit || current.grammarUnit) : current.grammarUnit,
                    grammarPoints:
                      current.ability === "Grammar" && nextUnit && current.grammarUnit !== nextUnit
                        ? []
                        : current.grammarPoints ?? [],
                  }));
                }}
              >
                <option value="" disabled>
                  Select Unit
                </option>
                {schema.units.map((unit) => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
              </select>
            </div>
          </>
        )}
      </div>

      {systemMode === "textbook-practice" && profile.ability === "Grammar" ? (
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

      {systemMode === "textbook-practice" && (profile.ability === "Writing" || profile.ability === "Speaking") ? (
        <p className="text-xs text-amber-600">
          Selecting the {profile.ability} skill locks the Question Type below to{" "}
          {MANUAL_QUESTION_TYPE_LABELS[(profile.ability === "Writing" ? "writing" : "speaking") as ManualQuestionType]}.
        </p>
      ) : null}
    </div>
  );
}
