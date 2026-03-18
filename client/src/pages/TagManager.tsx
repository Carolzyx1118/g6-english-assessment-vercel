import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { ArrowLeft, Layers3, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import TeacherToolsLayout from "@/components/TeacherToolsLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  normalizeEnglishTagSystems,
  type EnglishExamTagSystem,
} from "@shared/englishQuestionTags";
import {
  PAPER_SUBJECT_LABELS,
  PAPER_SUBJECT_ORDER,
  type PaperSubject,
} from "@/data/papers";

function isPaperSubjectValue(value: unknown): value is PaperSubject {
  return typeof value === "string" && PAPER_SUBJECT_ORDER.includes(value as PaperSubject);
}

function listToText(values: string[]) {
  return values.join("\n");
}

function textToList(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function createEmptySystem(index: number): EnglishExamTagSystem {
  const suffix = `${Date.now().toString(36)}-${index + 1}`;
  return {
    id: `custom-${suffix}`,
    label: "",
    units: [],
    examParts: [],
    abilities: ["词汇", "语法", "阅读理解", "听力理解", "写作"],
    difficulties: ["基础", "中等", "提高"],
    grammarByUnit: {},
  };
}

export default function TagManager() {
  const search = useSearch();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const subjectFilter = useMemo(() => {
    const value = new URLSearchParams(search).get("subject");
    return isPaperSubjectValue(value) ? value : "english";
  }, [search]);
  const [systems, setSystems] = useState<EnglishExamTagSystem[]>([]);

  const query = trpc.papers.getEnglishTagSystems.useQuery(undefined, {
    enabled: subjectFilter === "english",
    staleTime: 30_000,
  });

  const saveMutation = trpc.papers.saveEnglishTagSystems.useMutation({
    onSuccess: async () => {
      await utils.papers.getEnglishTagSystems.invalidate();
    },
  });

  useEffect(() => {
    if (subjectFilter !== "english") return;
    if (!query.data) return;
    setSystems(query.data);
  }, [query.data, subjectFilter]);

  const canSave = useMemo(() => {
    if (subjectFilter !== "english") return false;
    if (systems.length === 0) return false;
    return systems.every((system) => {
      if (!system.label.trim()) return false;
      if (textToList(listToText(system.units)).length === 0) return false;
      if (textToList(listToText(system.examParts)).length === 0) return false;
      return true;
    });
  }, [subjectFilter, systems]);

  const updateSystem = (id: string, updater: (current: EnglishExamTagSystem) => EnglishExamTagSystem) => {
    setSystems((current) => current.map((system) => (system.id === id ? updater(system) : system)));
  };

  const handleSave = async () => {
    try {
      const normalized = normalizeEnglishTagSystems(
        systems.map((system) => ({
          ...system,
          label: system.label.trim(),
          units: [...system.units],
          examParts: [...system.examParts],
        })),
      );

      await saveMutation.mutateAsync({ systems: normalized });
      toast.success("标签体系已保存。录题页和随机组卷页会使用新的考试体系。");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败，请稍后重试。");
    }
  };

  return (
    <TeacherToolsLayout activeTool="tag-manager" currentSubject={subjectFilter}>
      <div className="min-h-screen bg-[#F6F8FB] px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700">
                <ArrowLeft className="h-4 w-4" />
                返回老师首页
              </Link>
              <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#1E3A5F]">标签管理</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-500">
                在这里维护不同考试体系下的 Part 和教材单元。保存后，录题页和随机组卷页会直接读取这里的配置。
              </p>
            </div>

            <div className="w-full max-w-xs rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <Label className="text-sm font-medium text-slate-700">Subject</Label>
              <select
                className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                value={subjectFilter}
                onChange={(event) => navigate(`/tag-manager?subject=${event.target.value}`)}
              >
                {PAPER_SUBJECT_ORDER.map((subject) => (
                  <option key={subject} value={subject}>
                    {PAPER_SUBJECT_LABELS[subject]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {subjectFilter !== "english" ? (
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle>{PAPER_SUBJECT_LABELS[subjectFilter]} 标签管理</CardTitle>
                <CardDescription>这个科目的自定义标签体系还没接入。当前先支持 English。</CardDescription>
              </CardHeader>
            </Card>
          ) : query.isLoading ? (
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="flex items-center justify-center gap-3 py-16 text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin" />
                正在加载考试体系...
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  <Badge className="rounded-full bg-slate-100 px-3 py-1 text-slate-600 hover:bg-slate-100">
                    {systems.length} 个考试体系
                  </Badge>
                  <Badge className="rounded-full bg-sky-100 px-3 py-1 text-sky-700 hover:bg-sky-100">
                    English Question Tags
                  </Badge>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="border-slate-200"
                    onClick={() => setSystems((current) => [...current, createEmptySystem(current.length)])}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    新增考试体系
                  </Button>
                  <Button
                    type="button"
                    className="bg-[#1E3A5F] text-white hover:bg-[#17324F]"
                    onClick={handleSave}
                    disabled={!canSave || saveMutation.isPending}
                  >
                    {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    保存标签配置
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                {systems.map((system, index) => (
                  <Card key={system.id} className="border-slate-200 shadow-sm">
                    <CardHeader className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                            <Layers3 className="h-5 w-5" />
                          </div>
                          <div>
                            <CardTitle className="text-xl text-[#1E3A5F]">{system.label.trim() || `考试体系 ${index + 1}`}</CardTitle>
                            <CardDescription>系统 ID：{system.id}</CardDescription>
                          </div>
                        </div>

                        <Button
                          type="button"
                          variant="outline"
                          className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                          onClick={() => setSystems((current) => current.filter((item) => item.id !== system.id))}
                          disabled={systems.length <= 1}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          删除
                        </Button>
                      </div>
                    </CardHeader>

                    <CardContent className="grid gap-5 lg:grid-cols-2">
                      <div className="space-y-2">
                        <Label>考试体系名称</Label>
                        <Input
                          value={system.label}
                          onChange={(event) => {
                            const nextLabel = event.target.value;
                            updateSystem(system.id, (current) => ({
                              ...current,
                              label: nextLabel,
                            }));
                          }}
                          placeholder="例如：FCE / B2 First"
                        />
                        <p className="text-xs text-slate-500">这里的名称会直接显示在录题页和随机组卷页。</p>
                      </div>

                      <div className="space-y-2">
                        <Label>教材单元</Label>
                        <Textarea
                          rows={10}
                          value={listToText(system.units)}
                          onChange={(event) =>
                            updateSystem(system.id, (current) => ({
                              ...current,
                              units: textToList(event.target.value),
                              grammarByUnit: Object.fromEntries(
                                Object.entries(current.grammarByUnit).filter(([unit]) =>
                                  textToList(event.target.value).includes(unit),
                                ),
                              ),
                            }))
                          }
                          placeholder={"Unit 1\nUnit 2\nUnit 3"}
                        />
                        <p className="text-xs text-slate-500">每行一个教材单元。</p>
                      </div>

                      <div className="space-y-2 lg:col-span-2">
                        <Label>考试 Part</Label>
                        <Textarea
                          rows={10}
                          value={listToText(system.examParts)}
                          onChange={(event) =>
                            updateSystem(system.id, (current) => ({
                              ...current,
                              examParts: textToList(event.target.value),
                            }))
                          }
                          placeholder={"阅读 Part 1\n阅读 Part 2\n听力 Part 1\n写作 Part 1"}
                        />
                        <p className="text-xs text-slate-500">每行一个 Part，随机组卷和题目标签都会读取这里。</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </TeacherToolsLayout>
  );
}
