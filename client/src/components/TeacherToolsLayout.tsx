import { type ReactNode, useMemo } from "react";
import { Link } from "wouter";
import { LogOut } from "lucide-react";
import { PureonBrand } from "@/components/PureonBrand";
import { PAPER_SUBJECT_LABELS, PAPER_SUBJECT_ORDER, type PaperSubject } from "@/data/papers";
import { useLocalAuth } from "@/hooks/useLocalAuth";
import { trpc } from "@/lib/trpc";

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
  showAccountPanel?: boolean;
  children: ReactNode;
}

function isPaperSubjectValue(value: unknown): value is PaperSubject {
  return typeof value === "string" && PAPER_SUBJECT_ORDER.includes(value as PaperSubject);
}

function TopNavLink({
  href,
  label,
  active,
  badgeCount = 0,
}: {
  href: string;
  label: string;
  active?: boolean;
  badgeCount?: number;
}) {
  const showBadge = badgeCount > 0;
  const badgeLabel = badgeCount > 99 ? "99+" : String(badgeCount);

  return (
    <Link href={href}>
      <button
        type="button"
        className="pureon-nav-link gap-2"
        data-active={active ? "true" : "false"}
      >
        <span>{label}</span>
        {showBadge ? (
          <span className="inline-flex min-w-[20px] items-center justify-center rounded-full border border-[rgba(201,164,97,0.65)] px-1.5 py-0.5 font-[family-name:var(--font-display)] text-[10px] leading-none text-[var(--pureon-gold)]">
            {badgeLabel}
          </span>
        ) : null}
      </button>
    </Link>
  );
}

export default function TeacherToolsLayout({
  activeTool,
  currentSubject = null,
  showAccountPanel = false,
  children,
}: TeacherToolsLayoutProps) {
  const { user, isTeacher, logout, loading: authLoading } = useLocalAuth();
  const pendingTeacherReviewQuery = trpc.results.list.useQuery(undefined, {
    enabled: isTeacher,
    staleTime: 30_000,
    select: (items) => items.filter((item) => item.reportStatus === "pending-review").length,
  });

  const allowedSubjects = useMemo(() => {
    const subjects = (user?.allowedSubjects ?? []).filter((subject): subject is PaperSubject =>
      isPaperSubjectValue(subject),
    );

    return subjects.length > 0 ? subjects : PAPER_SUBJECT_ORDER;
  }, [user?.allowedSubjects]);

  const defaultSubject = allowedSubjects[0] ?? "english";
  const pendingTeacherReviewCount = pendingTeacherReviewQuery.data ?? 0;
  const displayName = user?.displayName || user?.username || "Teacher";
  const avatarLabel = displayName.slice(0, 2).toUpperCase();
  const roleLabel = user?.role === "admin" ? "Admin" : "Teacher";
  const activeSubject = currentSubject ?? defaultSubject;
  const subjectSwitchBasePath = (
    activeTool === "tag-manager" || activeTool === "paper-composer"
      ? "/tag-manager"
      : activeTool === "paper-intake"
        ? "/paper-intake"
        : null
  );

  const navItems: Array<{
    active: boolean;
    badgeCount?: number;
    href: string;
    key: string;
    label: string;
  }> = [
    {
      key: "home",
      label: "教师总览",
      href: "/",
      active: activeTool === "home",
    },
    {
      key: "tag-manager",
      label: "组卷体系",
      href: `/tag-manager?subject=${currentSubject ?? defaultSubject}`,
      active: activeTool === "tag-manager" || activeTool === "paper-composer",
    },
    {
      key: "paper-intake",
      label: "题目录入",
      href: `/paper-intake?subject=${currentSubject ?? defaultSubject}`,
      active: activeTool === "paper-intake",
    },
    {
      key: "question-bank",
      label: "题库",
      href: "/question-bank",
      active: activeTool === "question-bank",
    },
    {
      key: "paper-manager",
      label: "试卷管理",
      href: "/paper-manager",
      active: activeTool === "paper-manager",
    },
    {
      key: "test-history",
      label: "测试记录",
      href: "/test-history",
      active: activeTool === "test-history",
      badgeCount: pendingTeacherReviewCount,
    },
    {
      key: "user-manager",
      label: "用户管理",
      href: "/user-manager",
      active: activeTool === "user-manager",
    },
  ];

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="pureon-topbar sticky top-0 z-20">
        <div className="mx-auto flex w-full max-w-[1680px] flex-wrap items-center justify-between gap-4 px-4 py-4 lg:px-8">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-6 xl:flex-nowrap xl:gap-10">
            <div className="min-w-0 shrink-0">
              <PureonBrand />
            </div>
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1 gap-y-1">
              {navItems.map((item) => (
                <TopNavLink
                  key={item.key}
                  href={item.href}
                  label={item.label}
                  active={item.active}
                  badgeCount={item.badgeCount}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {user ? (
              <div className="inline-flex items-center gap-3 border border-[var(--pureon-rule)] bg-[rgba(245,239,224,0.7)] px-3 py-2 text-[13px] text-[var(--pureon-muted)]">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--pureon-gold),var(--pureon-blue))] font-[family-name:var(--font-display)] text-[14px] font-semibold text-[var(--pureon-paper)]">
                  {avatarLabel || "TE"}
                </div>
                <div className="hidden min-w-0 sm:block">
                  <div className="truncate font-[family-name:var(--font-body)] text-[14px] text-[var(--pureon-teal)]">
                    {displayName}
                  </div>
                  <div className="mt-0.5 font-[family-name:var(--font-display)] text-[10px] uppercase tracking-[0.18em] text-[var(--pureon-muted)]">
                    {roleLabel}
                  </div>
                </div>
              </div>
            ) : null}

            <button
              type="button"
              onClick={logout}
              disabled={authLoading}
              className="inline-flex min-h-11 items-center gap-2 border border-[var(--pureon-rule)] bg-transparent px-4 py-2 text-[13px] text-[var(--pureon-muted)] transition-colors hover:border-[var(--pureon-teal)] hover:text-[var(--pureon-teal)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign out</span>
            </button>
          </div>
        </div>

        {subjectSwitchBasePath && allowedSubjects.length > 1 ? (
          <div className="border-t border-[var(--pureon-rule)]">
            <div className="mx-auto flex w-full max-w-[1680px] flex-wrap items-center gap-3 px-4 py-3 lg:px-8">
              <div className="font-[family-name:var(--font-display)] text-[11px] uppercase tracking-[0.22em] text-[var(--pureon-muted)]">
                {activeTool === "tag-manager" || activeTool === "paper-composer" ? "组卷学科" : "录题学科"}
              </div>
              <div className="flex flex-wrap gap-2">
                {allowedSubjects.map((subject) => (
                  <Link key={`teacher-subject-${subject}`} href={`${subjectSwitchBasePath}?subject=${subject}`}>
                    <button
                      type="button"
                      className={`inline-flex items-center border px-3 py-1.5 text-sm transition-colors ${
                        activeSubject === subject
                          ? "border-[var(--pureon-teal)] bg-[var(--pureon-teal)] text-[var(--pureon-paper)]"
                          : "border-[var(--pureon-rule)] bg-transparent text-[var(--pureon-muted)] hover:border-[var(--pureon-teal)] hover:text-[var(--pureon-teal)]"
                      }`}
                    >
                      {PAPER_SUBJECT_LABELS[subject]}
                    </button>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className={showAccountPanel ? "min-w-0" : "min-w-0"}>
        {children}
      </div>
    </div>
  );
}
