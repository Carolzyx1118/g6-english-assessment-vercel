import { useEffect } from "react";
import type { PaperSubject } from "@/data/papers";
import type { ManualQuestionTags } from "@shared/manualPaperBlueprint";
import type { SubjectQuestionTagProfile } from "@shared/englishQuestionTags";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useSubjectTagSystems } from "@/hooks/useSubjectTagSystems";

interface SubjectQuestionTagEditorProps {
  subject: Extract<PaperSubject, "math" | "vocabulary">;
  value?: ManualQuestionTags;
  onChange: (next: ManualQuestionTags | undefined) => void;
}

function getExistingProfile(
  subject: Extract<PaperSubject, "math" | "vocabulary">,
  value: ManualQuestionTags | undefined,
): SubjectQuestionTagProfile | undefined {
  return subject === "math" ? value?.math : value?.vocabulary;
}

export default function SubjectQuestionTagEditor({
  subject,
  value,
  onChange,
}: SubjectQuestionTagEditorProps) {
  const { systems, isLoading } = useSubjectTagSystems(subject);
  const defaultTrack = systems[0]?.id ?? "";
  const existingProfile = getExistingProfile(subject, value);
  const rawProfile = existingProfile ?? {
    track: defaultTrack,
    unit: undefined,
    examPart: undefined,
  };
  const safeTrack = systems.some((system) => system.id === rawProfile.track) ? rawProfile.track : defaultTrack;
  const activeSystem = systems.find((system) => system.id === safeTrack) ?? systems[0];
  const systemMode = activeSystem?.systemMode === "textbook-practice" ? "textbook-practice" : "assessment";
  const profile: SubjectQuestionTagProfile = {
    track: safeTrack,
    unit:
      systemMode === "textbook-practice" && activeSystem?.units.includes(rawProfile.unit || "")
        ? rawProfile.unit
        : undefined,
    examPart:
      systemMode === "assessment" && activeSystem?.examParts.includes(rawProfile.examPart || "")
        ? rawProfile.examPart
        : undefined,
  };

  const updateProfile = (nextProfile: SubjectQuestionTagProfile) => {
    onChange({
      ...(value ?? {}),
      [subject]: nextProfile,
    });
  };

  useEffect(() => {
    if (!existingProfile || !activeSystem) return;
    if (
      existingProfile.track === profile.track
      && existingProfile.unit === profile.unit
      && existingProfile.examPart === profile.examPart
    ) {
      return;
    }

    updateProfile(profile);
  }, [activeSystem, existingProfile, profile, value]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        正在加载标签体系...
      </div>
    );
  }

  if (!activeSystem) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-500">
        还没有可用的标签体系。请先到 Paper Generator 里配置{subject === "math" ? "数学" : "词汇"}考试体系、Part 和教材单元。
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border border-sky-100 bg-sky-50/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">题目标签</p>
          <p className="text-xs text-slate-500">
            {systemMode === "assessment"
              ? "这道题会绑定到对应考试体系和考试 Part。"
              : "这道题会绑定到对应考试体系和教材单元。"}
          </p>
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
            value={safeTrack}
            onChange={(event) => {
              const nextTrack = event.target.value;
              const nextSystem = systems.find((system) => system.id === nextTrack) ?? systems[0];
              const nextSystemMode = nextSystem?.systemMode === "textbook-practice" ? "textbook-practice" : "assessment";
              updateProfile({
                track: nextTrack,
                unit:
                  nextSystemMode === "textbook-practice" && nextSystem?.units.includes(profile.unit || "")
                    ? profile.unit
                    : undefined,
                examPart:
                  nextSystemMode === "assessment" && nextSystem?.examParts.includes(profile.examPart || "")
                    ? profile.examPart
                    : undefined,
              });
            }}
          >
            {systems.map((system) => (
              <option key={system.id} value={system.id}>{system.label}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label>{systemMode === "assessment" ? "考试 Part" : "教材单元"}</Label>
          <select
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
            value={systemMode === "assessment" ? (profile.examPart || "") : (profile.unit || "")}
            onChange={(event) => {
              updateProfile({
                track: safeTrack,
                unit: systemMode === "textbook-practice" ? (event.target.value || undefined) : undefined,
                examPart: systemMode === "assessment" ? (event.target.value || undefined) : undefined,
              });
            }}
          >
            <option value="">未设置</option>
            {systemMode === "assessment"
              ? activeSystem.examParts.map((part) => (
                  <option key={part} value={part}>{part}</option>
                ))
              : activeSystem.units.map((unit) => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
          </select>
          {systemMode === "assessment" && activeSystem.examParts.length === 0 ? (
            <p className="text-xs text-amber-600">这个考试体系还没有配置考试 Part，请先到 Paper Generator 设置。</p>
          ) : null}
          {systemMode === "textbook-practice" && activeSystem.units.length === 0 ? (
            <p className="text-xs text-amber-600">这个教材体系还没有配置教材单元，请先到 Paper Generator 设置。</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
