import { useMemo, useState } from "react";
import { Link, useSearch } from "wouter";
import { ArrowLeft, ChevronDown, ChevronUp, FilePenLine, Loader2 } from "lucide-react";
import TeacherToolsLayout from "@/components/TeacherToolsLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PAPER_SUBJECT_LABELS, PAPER_SUBJECT_ORDER, type PaperSubject } from "@/data/papers";
import { formatQuestionBankItemId, getQuestionBankItemSummary } from "@/lib/questionBankItem";
import { trpc } from "@/lib/trpc";
import { MANUAL_QUESTION_TYPE_LABELS, MANUAL_SECTION_TYPE_LABELS, type ManualPaperBlueprint } from "@shared/manualPaperBlueprint";

function isPaperSubjectValue(value: unknown): value is PaperSubject {
  return typeof value === "string" && PAPER_SUBJECT_ORDER.includes(value as PaperSubject);
}

function formatDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString("en-SG", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function parseBlueprint(raw: string): ManualPaperBlueprint | null {
  try {
    return JSON.parse(raw) as ManualPaperBlueprint;
  } catch {
    return null;
  }
}

export default function QuestionBank() {
  const search = useSearch();
  const [expandedPaperIds, setExpandedPaperIds] = useState<number[]>([]);
  const subjectFilter = useMemo(() => {
    const value = new URLSearchParams(search).get("subject");
    return isPaperSubjectValue(value) ? value : "english";
  }, [search]);

  const listQuery = trpc.papers.listQuestionBankPapers.useQuery(undefined, {
    staleTime: 5_000,
  });

  const filteredPapers = useMemo(() => {
    const papers = listQuery.data ?? [];
    return papers.filter((paper) => paper.subject === subjectFilter);
  }, [listQuery.data, subjectFilter]);

  const summary = useMemo(() => ({
    totalBanks: filteredPapers.length,
    totalItems: filteredPapers.reduce((sum, paper) => sum + paper.itemCount, 0),
  }), [filteredPapers]);

  const toggleExpanded = (paperId: number) => {
    setExpandedPaperIds((current) =>
      current.includes(paperId)
        ? current.filter((id) => id !== paperId)
        : [...current, paperId],
    );
  };

  return (
    <TeacherToolsLayout activeTool="question-bank" currentSubject={subjectFilter}>
      <div className="min-h-screen bg-[#F6F8FB] px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700">
                <ArrowLeft className="h-4 w-4" />
                Back to Teacher Home
              </Link>
              <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#1E3A5F]">
                {`${PAPER_SUBJECT_LABELS[subjectFilter]} Question Bank`}
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-500">
                Review the question-bank items used for random paper building. Each entry shows the item ID, question type, section, and content summary.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href={`/paper-intake?subject=${subjectFilter}`}>
                <Button className="bg-[#1E3A5F] text-white hover:bg-[#17324F]">
                  <FilePenLine className="mr-2 h-4 w-4" />
                  Add Question Bank Items
                </Button>
              </Link>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription>Question Bank Papers</CardDescription>
                <CardTitle className="text-2xl">{summary.totalBanks}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription>Question Bank Items</CardDescription>
                <CardTitle className="text-2xl text-sky-700">{summary.totalItems}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          {listQuery.isLoading ? (
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="flex items-center justify-center gap-3 py-16 text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading question bank...
              </CardContent>
            </Card>
          ) : filteredPapers.length === 0 ? (
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="py-16 text-center text-sm text-slate-500">
                No question-bank papers have been recorded for this subject yet. Add some from Paper Intake first.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredPapers.map((paper) => {
                const blueprint = parseBlueprint(paper.blueprintJson);
                const items = blueprint?.sections ?? [];
                const expanded = expandedPaperIds.includes(paper.id);

                return (
                  <Card key={paper.id} className="border-slate-200 shadow-sm">
                    <CardHeader className="space-y-4">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <CardTitle className="text-xl text-[#1E3A5F]">{paper.title}</CardTitle>
                            <Badge variant="secondary">{PAPER_SUBJECT_LABELS[paper.subject as PaperSubject] || paper.subject}</Badge>
                            <Badge className="rounded-full bg-slate-100 px-3 py-1 text-slate-600 hover:bg-slate-100">
                              {paper.itemCount} items
                            </Badge>
                          </div>
                          <CardDescription>
                            Bank ID: {paper.paperId} · Updated {formatDate(paper.updatedAt)}
                          </CardDescription>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Link href={`/paper-intake?subject=${paper.subject}&edit=${paper.paperId}`}>
                            <Button variant="outline" className="border-slate-200">
                              <FilePenLine className="mr-2 h-4 w-4" />
                              Edit
                            </Button>
                          </Link>
                          <Button
                            type="button"
                            variant="outline"
                            className="border-slate-200"
                            onClick={() => toggleExpanded(paper.id)}
                          >
                            {expanded ? (
                              <ChevronUp className="mr-2 h-4 w-4" />
                            ) : (
                              <ChevronDown className="mr-2 h-4 w-4" />
                            )}
                            {expanded ? "Hide Items" : "View Items"}
                          </Button>
                        </div>
                      </div>
                    </CardHeader>

                    {expanded ? (
                      <CardContent className="space-y-3">
                        {items.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                            There are no visible items in this question bank paper yet.
                          </div>
                        ) : (
                          items.map((section, index) => {
                            const subsection = section.subsections[0];
                            if (!subsection) return null;

                            return (
                              <div
                                key={`${paper.paperId}-${section.id}`}
                                className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
                              >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div className="space-y-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <Badge className="rounded-full bg-[#1E3A5F] px-3 py-1 text-white hover:bg-[#1E3A5F]">
                                        {formatQuestionBankItemId(paper.subject as PaperSubject, subsection.id)}
                                      </Badge>
                                      <Badge variant="outline">
                                        {MANUAL_SECTION_TYPE_LABELS[section.sectionType]}
                                      </Badge>
                                      <Badge variant="outline">
                                        {MANUAL_QUESTION_TYPE_LABELS[subsection.questionType]}
                                      </Badge>
                                    </div>
                                    <p className="text-sm font-semibold text-slate-800">
                                      Item {index + 1}
                                    </p>
                                    <p className="text-sm leading-relaxed text-slate-600">
                                      {getQuestionBankItemSummary(subsection)}
                                    </p>
                                  </div>

                                  <div className="text-right text-xs text-slate-500">
                                    <p>{subsection.questions.length} internal item(s)</p>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </CardContent>
                    ) : null}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </TeacherToolsLayout>
  );
}
