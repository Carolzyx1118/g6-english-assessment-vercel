import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "wouter";
import {
  BookCopy,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Database,
  FilePlus2,
  History,
  Home,
  Tags,
  Users,
} from "lucide-react";
import { PAPER_SUBJECT_LABELS, PAPER_SUBJECT_ORDER, type PaperSubject } from "@/data/papers";
import { useLocalAuth } from "@/hooks/useLocalAuth";

type TeacherToolKey =
  | "home"
  | "paper-intake"
  | "question-bank"
  | "tag-manager"
  | "paper-manager"
  | "paper-composer"
  | "test-history"
  | "user-manager";

interface TeacherToolsLayoutProps {
  activeTool: TeacherToolKey;
  currentSubject?: PaperSubject | null;
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
        className={`flex min-h-[56px] w-full items-center gap-3.5 rounded-[24px] px-4 py-3 text-left text-[15px] font-semibold leading-none tracking-[-0.01em] transition-colors ${
          active
            ? "bg-[#1E3A5F] text-white shadow-sm"
            : "text-slate-600 hover:bg-slate-100 hover:text-[#1E3A5F]"
        } ${collapsed ? "justify-center px-2" : ""}`}
      >
        <span className="flex h-6 w-6 items-center justify-center">{icon}</span>
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
        className={`min-h-[44px] w-full rounded-2xl px-4 py-2.5 text-left text-[14px] font-medium tracking-[-0.01em] transition-colors ${
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
      className="inline-flex h-12 w-12 items-center justify-center rounded-[20px] text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
      title={expanded ? `Collapse ${label}` : `Expand ${label}`}
      aria-label={expanded ? `Collapse ${label}` : `Expand ${label}`}
      aria-expanded={expanded}
    >
      {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
    </button>
  );
}

function NavItemRow({
  link,
  collapsed,
  expandable = false,
  expanded = false,
  onToggle,
  toggleLabel,
}: {
  link: ReactNode;
  collapsed: boolean;
  expandable?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  toggleLabel?: string;
}) {
  if (collapsed) {
    return <>{link}</>;
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_48px] items-center gap-2">
      <div className="min-w-0">{link}</div>
      {expandable && onToggle && toggleLabel ? (
        <ExpandToggle expanded={expanded} onToggle={onToggle} label={toggleLabel} />
      ) : (
        <span aria-hidden="true" className="block h-12 w-12" />
      )}
    </div>
  );
}

export default function TeacherToolsLayout({
  activeTool,
  currentSubject = null,
  children,
}: TeacherToolsLayoutProps) {
  const { user } = useLocalAuth();
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1";
  });
  const [tagManagerExpanded, setTagManagerExpanded] = useState(activeTool === "tag-manager");
  const [questionBankExpanded, setQuestionBankExpanded] = useState(activeTool === "question-bank");
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
    <div className="min-h-screen bg-[#F6F8FB]">
      <aside
        className={`hidden border-r border-slate-200 bg-white/95 shadow-[0_18px_45px_rgba(15,23,42,0.08)] backdrop-blur transition-[width] duration-200 md:fixed md:inset-y-0 md:left-0 md:z-30 md:flex md:flex-col ${
          collapsed ? "md:w-20" : "md:w-72"
        }`}
      >
        <div className="flex h-full flex-col">
          <div className={`flex items-center border-b border-slate-200 px-4 py-4 ${collapsed ? "justify-center" : "justify-between"}`}>
            {!collapsed ? (
              <div>
                <p className="text-lg font-bold tracking-tight text-[#1E3A5F]">Workspace Navigation</p>
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
                <NavItemRow
                  collapsed={false}
                  expandable
                  expanded={tagManagerExpanded}
                  onToggle={() => setTagManagerExpanded((current) => !current)}
                  toggleLabel="Paper Generator subjects"
                  link={
                    <PrimaryLink
                      href={`/tag-manager?subject=${currentSubject ?? defaultSubject}`}
                      icon={<Tags className="h-4 w-4" />}
                      label="Paper Generator"
                      active={activeTool === "tag-manager"}
                      collapsed={false}
                    />
                  }
                />
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
                label="Paper Generator"
                active={activeTool === "tag-manager"}
                collapsed={collapsed}
              />
            )}

            {collapsed ? (
              <PrimaryLink
                href={`/paper-intake?subject=${defaultSubject}`}
                icon={<FilePlus2 className="h-4 w-4" />}
                label="Question Intake"
                active={activeTool === "paper-intake"}
                collapsed={collapsed}
              />
            ) : (
              <NavItemRow
                collapsed={false}
                link={
                  <PrimaryLink
                    href={`/paper-intake?subject=${defaultSubject}`}
                    icon={<FilePlus2 className="h-4 w-4" />}
                    label="Question Intake"
                    active={activeTool === "paper-intake"}
                    collapsed={false}
                  />
                }
              />
            )}

            {!collapsed ? (
              <div className="space-y-1">
                <NavItemRow
                  collapsed={false}
                  expandable
                  expanded={questionBankExpanded}
                  onToggle={() => setQuestionBankExpanded((current) => !current)}
                  toggleLabel="Question Bank subjects"
                  link={
                    <PrimaryLink
                      href={`/question-bank?subject=${currentSubject ?? defaultSubject}`}
                      icon={<Database className="h-4 w-4" />}
                      label="Question Bank"
                      active={activeTool === "question-bank"}
                      collapsed={false}
                    />
                  }
                />
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
                <NavItemRow
                  collapsed={false}
                  expandable
                  expanded={paperManagerExpanded}
                  onToggle={() => setPaperManagerExpanded((current) => !current)}
                  toggleLabel="Paper Manager subjects"
                  link={
                    <PrimaryLink
                      href="/paper-manager"
                      icon={<BookCopy className="h-4 w-4" />}
                      label="Paper Manager"
                      active={activeTool === "paper-manager"}
                      collapsed={false}
                    />
                  }
                />
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

            {collapsed ? (
              <PrimaryLink
                href="/test-history"
                icon={<History className="h-4 w-4" />}
                label="Test History"
                active={activeTool === "test-history"}
                collapsed={collapsed}
              />
            ) : (
              <NavItemRow
                collapsed={false}
                link={
                  <PrimaryLink
                    href="/test-history"
                    icon={<History className="h-4 w-4" />}
                    label="Test History"
                    active={activeTool === "test-history"}
                    collapsed={false}
                  />
                }
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

      <div
        className={`min-w-0 flex-1 transition-[padding-left] duration-200 ${
          collapsed ? "md:pl-20" : "md:pl-72"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
