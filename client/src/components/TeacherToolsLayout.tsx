import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "wouter";
import {
  BookCopy,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FilePlus2,
  Home,
  Layers3,
  Tags,
  Users,
} from "lucide-react";
import { PAPER_SUBJECT_LABELS, PAPER_SUBJECT_ORDER, type PaperSubject } from "@/data/papers";
import { useLocalAuth } from "@/hooks/useLocalAuth";

type TeacherToolKey =
  | "home"
  | "history"
  | "paper-intake"
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

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
        className={`hidden shrink-0 border-r border-slate-200 bg-white/95 backdrop-blur md:sticky md:flex md:flex-col ${
          headerOffset ? "md:top-16 md:h-[calc(100vh-4rem)]" : "md:top-0 md:h-screen"
        } ${
          collapsed ? "md:w-20" : "md:w-72"
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
            <PrimaryLink
              href="/history"
              icon={<ClipboardList className="h-4 w-4" />}
              label="Test History"
              active={activeTool === "history"}
              collapsed={collapsed}
            />
            {!collapsed ? (
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

            <PrimaryLink
              href={`/paper-intake?subject=${defaultSubject}`}
              icon={<FilePlus2 className="h-4 w-4" />}
              label="Paper Intake"
              active={activeTool === "paper-intake"}
              collapsed={collapsed}
            />

            <PrimaryLink
              href="/tag-manager?subject=english"
              icon={<Tags className="h-4 w-4" />}
              label="Tag Manager"
              active={activeTool === "tag-manager"}
              collapsed={collapsed}
            />

            <PrimaryLink
              href="/user-manager"
              icon={<Users className="h-4 w-4" />}
              label="User Manager"
              active={activeTool === "user-manager"}
              collapsed={collapsed}
            />

            <PrimaryLink
              href="/paper-manager"
              icon={<BookCopy className="h-4 w-4" />}
              label="Paper Manager"
              active={activeTool === "paper-manager"}
              collapsed={collapsed}
            />
            {!collapsed ? (
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

            {allowedSubjects.includes("english") ? (
              <PrimaryLink
                href="/paper-composer?subject=english"
                icon={<Layers3 className="h-4 w-4" />}
                label="Generated Papers"
                active={activeTool === "paper-composer"}
                collapsed={collapsed}
              />
            ) : null}
          </div>
        </nav>
      </aside>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
