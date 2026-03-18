import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "wouter";
import {
  BookCopy,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ClipboardList,
  Database,
  FilePlus2,
  Home,
  Tags,
  Users,
} from "lucide-react";
import { PAPER_SUBJECT_LABELS, PAPER_SUBJECT_ORDER, type PaperSubject } from "@/data/papers";
import { useLocalAuth } from "@/hooks/useLocalAuth";

type TeacherToolKey =
  | "home"
  | "history"
  | "paper-intake"
  | "question-bank"
  | "tag-manager"
  | "paper-manager"
  | "paper-composer"
  | "user-manager";

interface TeacherToolsLayoutProps {
  activeTool: TeacherToolKey;
  currentSubject?: PaperSubject | null;
  headerOffset?: boolean;
  children: ReactNode;
}

const SIDEBAR_STORAGE_KEY = "pureon_teacher_tools_sidebar_collapsed";

function isPaperSubjectValue(value: unknown): value is PaperSubject {
  return typeof value === "string" && PAPER_SUBJECT_ORDER.includes(value as PaperSubject);
}

function PrimaryLink({
  href,
  icon,
  label,
  active,
  collapsed,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  active?: boolean;
  collapsed: boolean;
}) {
  return (
    <Link href={href}>
      <button
        type="button"
        title={collapsed ? label : undefined}
        className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-medium transition-colors ${
          active
            ? "bg-[#1E3A5F] text-white shadow-sm"
            : "text-slate-600 hover:bg-slate-100 hover:text-[#1E3A5F]"
        } ${collapsed ? "justify-center px-2" : ""}`}
      >
        <span className="flex h-5 w-5 items-center justify-center">{icon}</span>
        {!collapsed ? <span>{label}</span> : null}
      </button>
    </Link>
  );
}

function SubjectLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active?: boolean;
}) {
  return (
    <Link href={href}>
      <button
        type="button"
        className={`w-full rounded-xl px-3 py-2 text-left text-sm transition-colors ${
          active
            ? "bg-sky-50 text-sky-700"
            : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        }`}
      >
        {label}
      </button>
    </Link>
  );
}

function ExpandToggle({
  expanded,
  onToggle,
  label,
}: {
  expanded: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
      title={expanded ? `Collapse ${label}` : `Expand ${label}`}
      aria-label={expanded ? `Collapse ${label}` : `Expand ${label}`}
      aria-expanded={expanded}
    >
      {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
    </button>
  );
}

export default function TeacherToolsLayout({
  activeTool,
  currentSubject = null,
  headerOffset = false,
  children,
}: TeacherToolsLayoutProps) {
  const { user } = useLocalAuth();
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1";
  });
  const [tagManagerExpanded, setTagManagerExpanded] = useState(activeTool === "tag-manager");
  const [questionBankExpanded, setQuestionBankExpanded] = useState(activeTool === "question-bank");
  const [historyExpanded, setHistoryExpanded] = useState(activeTool === "history");
  const [paperManagerExpanded, setPaperManagerExpanded] = useState(activeTool === "paper-manager");

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  useEffect(() => {
    if (activeTool === "tag-manager") {
      setTagManagerExpanded(true);
    }
    if (activeTool === "question-bank") {
      setQuestionBankExpanded(true);
    }
    if (activeTool === "history") {
      setHistoryExpanded(true);
    }
    if (activeTool === "paper-manager") {
      setPaperManagerExpanded(true);
    }
  }, [activeTool]);

  const allowedSubjects = useMemo(() => {
    const subjects = (user?.allowedSubjects ?? []).filter((subject): subject is PaperSubject =>
      isPaperSubjectValue(subject),
    );

    return subjects.length > 0 ? subjects : PAPER_SUBJECT_ORDER;
  }, [user?.allowedSubjects]);

  const defaultSubject = allowedSubjects[0] ?? "english";

  return (
    <div className="min-h-screen bg-[#F6F8FB] md:flex">
      <aside
        className={`hidden shrink-0 md:sticky md:flex md:flex-col ${
          headerOffset ? "md:top-16 md:h-[calc(100vh-4rem)]" : "md:top-0 md:h-screen"
        } ${
          collapsed ? "md:w-20" : "md:w-72"
        } ${
          headerOffset ? "bg-transparent" : "border-r border-slate-200 bg-white/95 backdrop-blur"
        }`}
      >
        <div
          className={`flex h-full flex-col ${
            headerOffset
              ? "rounded-br-[28px] border-r border-b border-slate-200/80 bg-white/94 shadow-[0_18px_45px_rgba(15,23,42,0.08)] backdrop-blur"
              : "h-full"
          }`}
        >
          <div className={`flex items-center border-b border-slate-200 px-4 py-4 ${collapsed ? "justify-center" : "justify-between"}`}>
            {!collapsed ? (
              <div>
                <p className="text-sm font-semibold text-[#1E3A5F]">Teacher Tools</p>
                <p className="text-xs text-slate-400">Workspace navigation</p>
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => setCollapsed((current) => !current)}
              className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition hover:text-slate-800"
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          </div>

          <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
          <div className="space-y-1">
            {!collapsed ? <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Overview</p> : null}
            <PrimaryLink
              href="/"
              icon={<Home className="h-4 w-4" />}
              label="Assessments Home"
              active={activeTool === "home"}
              collapsed={collapsed}
            />
          </div>

          <div className="space-y-1">
            {!collapsed ? <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Teacher Tools</p> : null}
            {!collapsed ? (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <PrimaryLink
                      href={`/tag-manager?subject=${currentSubject ?? defaultSubject}`}
                      icon={<Tags className="h-4 w-4" />}
                      label="Tag Manager"
                      active={activeTool === "tag-manager"}
                      collapsed={false}
                    />
                  </div>
                  <ExpandToggle
                    expanded={tagManagerExpanded}
                    onToggle={() => setTagManagerExpanded((current) => !current)}
                    label="Tag Manager subjects"
                  />
                </div>
                {tagManagerExpanded ? (
                  <div className="space-y-1 pl-10">
                    {allowedSubjects.map((subject) => (
                      <SubjectLink
                        key={`tag-manager-${subject}`}
                        href={`/tag-manager?subject=${subject}`}
                        label={PAPER_SUBJECT_LABELS[subject]}
                        active={activeTool === "tag-manager" && currentSubject === subject}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <PrimaryLink
                href={`/tag-manager?subject=${currentSubject ?? defaultSubject}`}
                icon={<Tags className="h-4 w-4" />}
                label="Tag Manager"
                active={activeTool === "tag-manager"}
                collapsed={collapsed}
              />
            )}

            <PrimaryLink
              href={`/paper-intake?subject=${defaultSubject}`}
              icon={<FilePlus2 className="h-4 w-4" />}
              label="Paper Intake"
              active={activeTool === "paper-intake"}
              collapsed={collapsed}
            />

            {!collapsed ? (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <PrimaryLink
                      href={`/question-bank?subject=${currentSubject ?? defaultSubject}`}
                      icon={<Database className="h-4 w-4" />}
                      label="Question Bank"
                      active={activeTool === "question-bank"}
                      collapsed={false}
                    />
                  </div>
                  <ExpandToggle
                    expanded={questionBankExpanded}
                    onToggle={() => setQuestionBankExpanded((current) => !current)}
                    label="Question Bank subjects"
                  />
                </div>
                {questionBankExpanded ? (
                  <div className="space-y-1 pl-10">
                    {allowedSubjects.map((subject) => (
                      <SubjectLink
                        key={`question-bank-${subject}`}
                        href={`/question-bank?subject=${subject}`}
                        label={PAPER_SUBJECT_LABELS[subject]}
                        active={activeTool === "question-bank" && currentSubject === subject}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <PrimaryLink
                href={`/question-bank?subject=${currentSubject ?? defaultSubject}`}
                icon={<Database className="h-4 w-4" />}
                label="Question Bank"
                active={activeTool === "question-bank"}
                collapsed={collapsed}
              />
            )}

            {!collapsed ? (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <PrimaryLink
                      href="/paper-manager"
                      icon={<BookCopy className="h-4 w-4" />}
                      label="Paper Manager"
                      active={activeTool === "paper-manager"}
                      collapsed={false}
                    />
                  </div>
                  <ExpandToggle
                    expanded={paperManagerExpanded}
                    onToggle={() => setPaperManagerExpanded((current) => !current)}
                    label="Paper Manager subjects"
                  />
                </div>
                {paperManagerExpanded ? (
                  <div className="space-y-1 pl-10">
                    {allowedSubjects.map((subject) => (
                      <SubjectLink
                        key={`manager-${subject}`}
                        href={`/paper-manager?subject=${subject}`}
                        label={PAPER_SUBJECT_LABELS[subject]}
                        active={activeTool === "paper-manager" && currentSubject === subject}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <PrimaryLink
                href="/paper-manager"
                icon={<BookCopy className="h-4 w-4" />}
                label="Paper Manager"
                active={activeTool === "paper-manager"}
                collapsed={collapsed}
              />
            )}

            {!collapsed ? (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <PrimaryLink
                      href="/history"
                      icon={<ClipboardList className="h-4 w-4" />}
                      label="Test History"
                      active={activeTool === "history"}
                      collapsed={false}
                    />
                  </div>
                  <ExpandToggle
                    expanded={historyExpanded}
                    onToggle={() => setHistoryExpanded((current) => !current)}
                    label="Test History subjects"
                  />
                </div>
                {historyExpanded ? (
                  <div className="space-y-1 pl-10">
                    {allowedSubjects.map((subject) => (
                      <SubjectLink
                        key={`history-${subject}`}
                        href={`/history?subject=${subject}`}
                        label={PAPER_SUBJECT_LABELS[subject]}
                        active={activeTool === "history" && currentSubject === subject}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <PrimaryLink
                href="/history"
                icon={<ClipboardList className="h-4 w-4" />}
                label="Test History"
                active={activeTool === "history"}
                collapsed={collapsed}
              />
            )}
          </div>

          <div className="space-y-1">
            {!collapsed ? <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Administration</p> : null}
            <PrimaryLink
              href="/user-manager"
              icon={<Users className="h-4 w-4" />}
              label="User Manager"
              active={activeTool === "user-manager"}
              collapsed={collapsed}
            />
          </div>
          </nav>
        </div>
      </aside>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
