import { type ReactNode, useMemo } from "react";
import { Link } from "wouter";
import { LogOut } from "lucide-react";
import { PureonBrand } from "@/components/PureonBrand";
import { PAPER_SUBJECT_ORDER, type PaperSubject } from "@/data/papers";
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
  const topbarAccountClass = "inline-flex w-full min-w-0 items-center gap-3 rounded-[28px] border border-[var(--pureon-rule)] bg-[linear-gradient(135deg,rgba(245,239,224,0.94),rgba(227,217,190,0.78))] px-3 py-2.5 text-[13px] text-[var(--pureon-muted)] shadow-[0_18px_40px_-32px_rgba(45,74,62,0.35),inset_0_1px_0_rgba(255,250,239,0.48)] sm:w-auto sm:min-w-[206px]";
  const topbarActionClass = "inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border border-[var(--pureon-rule)] bg-[rgba(245,239,224,0.48)] px-4 text-[13px] text-[var(--pureon-muted)] shadow-[0_14px_30px_-28px_rgba(45,74,62,0.3)] transition-colors hover:border-[var(--pureon-teal)] hover:bg-[rgba(201,164,97,0.08)] hover:text-[var(--pureon-teal)] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto";

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

          <div className="flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
            {user ? (
              <div className={topbarAccountClass}>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--pureon-gold),var(--pureon-blue))] font-[family-name:var(--font-display)] text-[14px] font-semibold text-[var(--pureon-paper)] shadow-[0_14px_30px_-20px_rgba(45,74,62,0.55)]">
                  {avatarLabel || "TE"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-[family-name:var(--font-body)] text-[15px] font-semibold tracking-[0.04em] text-[var(--pureon-teal)]">
                    {displayName}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="pureon-tag" data-tone={user?.role === "admin" ? "gold" : "green"}>
                      {roleLabel}
                    </span>
                  </div>
                </div>
              </div>
            ) : null}

            <button
              type="button"
              onClick={logout}
              disabled={authLoading}
              className={topbarActionClass}
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(201,164,97,0.14)] text-[var(--pureon-gold)]">
                <LogOut className="h-4 w-4" />
              </span>
              <span className="font-[family-name:var(--font-body)] text-[15px] font-semibold tracking-[0.04em]">Sign out</span>
            </button>
          </div>
        </div>
      </div>

      <div className={showAccountPanel ? "min-w-0" : "min-w-0"}>
        {children}
      </div>
    </div>
  );
}
