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
  LogOut,
  Tags,
  Users,
} from "lucide-react";
import { PureonBrand, PureonBrandMark } from "@/components/PureonBrand";
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

type TeacherTopNavKey = "overview" | "bank" | "generator" | "papers" | "students" | "users";

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
  badgeCount = 0,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  active?: boolean;
  collapsed: boolean;
  badgeCount?: number;
}) {
  const showBadge = badgeCount > 0;
  const badgeLabel = badgeCount > 99 ? "99+" : String(badgeCount);

  return (
    <Link href={href}>
      <button
        type="button"
        title={collapsed ? label : undefined}
        className={`flex min-h-[48px] w-full items-center gap-3 border-l-2 px-4 py-3 text-left text-[13px] leading-none transition-colors ${
          active
            ? "border-[var(--pureon-gold)] bg-white/6 text-[var(--pureon-gold)]"
            : "border-transparent text-[rgba(245,239,224,0.72)] hover:bg-white/6 hover:text-[var(--pureon-paper)]"
        } ${collapsed ? "justify-center px-3" : ""}`}
      >
        <span className="relative flex h-6 w-6 items-center justify-center">
          {icon}
          {collapsed && showBadge ? (
            <span className="absolute -right-2 -top-2 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full border border-[var(--pureon-gold)] bg-[var(--pureon-gold)] px-1 text-[10px] font-semibold leading-none text-[var(--pureon-ink)] shadow-sm">
              {badgeLabel}
            </span>
          ) : null}
        </span>
        {!collapsed ? <span className="min-w-0 flex-1 font-[family-name:var(--font-body)]">{label}</span> : null}
        {!collapsed && showBadge ? (
          <span
            className={`ml-auto inline-flex min-w-[28px] items-center justify-center border px-2 py-1 text-[10px] font-semibold leading-none tracking-[0.16em] ${
              active
                ? "border-[rgba(201,164,97,0.45)] bg-[rgba(201,164,97,0.18)] text-[var(--pureon-paper)]"
                : "border-[rgba(201,164,97,0.28)] text-[var(--pureon-gold)]"
            }`}
          >
            {badgeLabel}
          </span>
        ) : null}
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
        className={`min-h-[40px] w-full border-l border-[rgba(201,164,97,0.12)] px-4 py-2 text-left text-[12px] transition-colors ${
          active
            ? "bg-[rgba(201,164,97,0.08)] text-[var(--pureon-paper)]"
            : "text-[rgba(245,239,224,0.58)] hover:bg-white/5 hover:text-[var(--pureon-paper)]"
        }`}
      >
        <span className="font-[family-name:var(--font-body)]">{label}</span>
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
      className="inline-flex h-10 w-10 items-center justify-center border border-[rgba(201,164,97,0.18)] bg-white/5 text-[rgba(245,239,224,0.58)] transition hover:bg-white/10 hover:text-[var(--pureon-gold)]"
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
        <span aria-hidden="true" className="block h-10 w-10" />
      )}
    </div>
  );
}

function TopNavLink({
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
        className="pureon-nav-link"
        data-active={active ? "true" : "false"}
      >
        {label}
      </button>
    </Link>
  );
}

function getTopNavKey(activeTool: TeacherToolKey): TeacherTopNavKey {
  if (activeTool === "home") return "overview";
  if (activeTool === "paper-intake" || activeTool === "question-bank") return "bank";
  if (activeTool === "tag-manager" || activeTool === "paper-composer") return "generator";
  if (activeTool === "paper-manager") return "papers";
  if (activeTool === "test-history") return "students";
  return "users";
}

export default function TeacherToolsLayout({
  activeTool,
  currentSubject = null,
  showAccountPanel = false,
  children,
}: TeacherToolsLayoutProps) {
  const { user, isTeacher, logout, loading: authLoading } = useLocalAuth();
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1";
  });
  const [tagManagerExpanded, setTagManagerExpanded] = useState(activeTool === "tag-manager");
  const pendingTeacherReviewQuery = trpc.results.list.useQuery(undefined, {
    enabled: isTeacher,
    staleTime: 30_000,
    select: (items) => items.filter((item) => item.reportStatus === "pending-review").length,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  useEffect(() => {
    if (activeTool === "tag-manager") {
      setTagManagerExpanded(true);
    }
  }, [activeTool]);

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
  const activeTopNav = getTopNavKey(activeTool);
  const topNavItems: Array<{ key: TeacherTopNavKey; label: string; href: string }> = [
    { key: "overview", label: "总览", href: "/" },
    { key: "bank", label: "题库", href: "/question-bank" },
    { key: "generator", label: "组卷", href: `/tag-manager?subject=${currentSubject ?? defaultSubject}` },
    { key: "papers", label: "试卷", href: "/paper-manager" },
    { key: "students", label: "学生", href: "/test-history" },
    { key: "users", label: "设置", href: "/user-manager" },
  ];

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <aside
        className={`hidden border-r border-[rgba(201,164,97,0.16)] bg-[var(--pureon-teal)] shadow-[18px_0_40px_-24px_rgba(26,26,26,0.65)] transition-[width] duration-200 md:fixed md:inset-y-0 md:left-0 md:z-30 md:flex md:flex-col ${
          collapsed ? "md:w-20" : "md:w-72"
        }`}
      >
        <div className="flex h-full flex-col">
          <div
            className={`flex min-h-[88px] items-center border-b border-[rgba(201,164,97,0.16)] px-4 py-4 ${
              collapsed ? "justify-center" : "justify-between gap-3"
            }`}
          >
            {!collapsed ? (
              <PureonBrand inverse compact />
            ) : (
              <PureonBrandMark inverse className="h-10 w-10" />
            )}
            <button
              type="button"
              onClick={() => setCollapsed((current) => !current)}
              className="inline-flex h-10 w-10 items-center justify-center border border-[rgba(201,164,97,0.18)] bg-white/5 text-[var(--pureon-gold)] transition hover:bg-white/10"
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          </div>

          <nav className="flex-1 space-y-7 overflow-y-auto px-3 py-5">
            <div className="space-y-1">
              {!collapsed ? (
                <p className="px-3 font-[family-name:var(--font-display)] text-[10px] uppercase tracking-[0.28em] text-[var(--pureon-gold)]">
                  工作台
                </p>
              ) : null}
              <PrimaryLink
                href="/"
                icon={<Home className="h-4 w-4" />}
                label="教师总览"
                active={activeTool === "home"}
                collapsed={collapsed}
              />
            </div>

            <div className="space-y-1">
              {!collapsed ? (
                <p className="px-3 font-[family-name:var(--font-display)] text-[10px] uppercase tracking-[0.28em] text-[var(--pureon-gold)]">
                  题库管理
                </p>
              ) : null}
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
                        label="组卷体系"
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
                  label="组卷体系"
                  active={activeTool === "tag-manager"}
                  collapsed={collapsed}
                />
              )}

              {collapsed ? (
                <PrimaryLink
                  href={`/paper-intake?subject=${defaultSubject}`}
                  icon={<FilePlus2 className="h-4 w-4" />}
                  label="题目录入"
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
                      label="题目录入"
                      active={activeTool === "paper-intake"}
                      collapsed={false}
                    />
                  }
                />
              )}

              <PrimaryLink
                href="/question-bank"
                icon={<Database className="h-4 w-4" />}
                label="题库"
                active={activeTool === "question-bank"}
                collapsed={collapsed}
              />

              <PrimaryLink
                href="/paper-manager"
                icon={<BookCopy className="h-4 w-4" />}
                label="试卷管理"
                active={activeTool === "paper-manager"}
                collapsed={collapsed}
              />

              {collapsed ? (
                <PrimaryLink
                  href="/test-history"
                  icon={<History className="h-4 w-4" />}
                  label="测试记录"
                  active={activeTool === "test-history"}
                  collapsed={collapsed}
                  badgeCount={pendingTeacherReviewCount}
                />
              ) : (
                <NavItemRow
                  collapsed={false}
                  link={
                    <PrimaryLink
                      href="/test-history"
                      icon={<History className="h-4 w-4" />}
                      label="测试记录"
                      active={activeTool === "test-history"}
                      collapsed={false}
                      badgeCount={pendingTeacherReviewCount}
                    />
                  }
                />
              )}
            </div>

            <div className="space-y-1">
              {!collapsed ? (
                <p className="px-3 font-[family-name:var(--font-display)] text-[10px] uppercase tracking-[0.28em] text-[var(--pureon-gold)]">
                  系统
                </p>
              ) : null}
              <PrimaryLink
                href="/user-manager"
                icon={<Users className="h-4 w-4" />}
                label="用户管理"
                active={activeTool === "user-manager"}
                collapsed={collapsed}
              />
            </div>
          </nav>

          {showAccountPanel && user ? (
            <div className="border-t border-[rgba(201,164,97,0.16)] px-3 py-4">
              {!collapsed ? (
                <div className="mb-3 flex items-center gap-3 border border-[rgba(201,164,97,0.18)] bg-white/5 px-3 py-3 text-[rgba(245,239,224,0.78)]">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--pureon-gold),var(--pureon-blue))] font-[family-name:var(--font-display)] text-[12px] font-semibold text-[var(--pureon-paper)]">
                    {avatarLabel || "TE"}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-[family-name:var(--font-body)] text-[13px] text-[var(--pureon-paper)]">
                      {displayName}
                    </div>
                    <div className="mt-1 font-[family-name:var(--font-display)] text-[10px] uppercase tracking-[0.18em] text-[rgba(245,239,224,0.5)]">
                      {roleLabel}
                    </div>
                  </div>
                </div>
              ) : null}

              <button
                type="button"
                onClick={logout}
                disabled={authLoading}
                title="退出登录"
                aria-label="退出登录"
                className={`inline-flex min-h-[44px] items-center border border-[rgba(201,164,97,0.18)] bg-white/5 text-[rgba(245,239,224,0.76)] transition hover:bg-white/10 hover:text-[var(--pureon-gold)] disabled:cursor-not-allowed disabled:opacity-60 ${
                  collapsed ? "w-full justify-center px-3" : "w-full justify-center gap-2 px-4"
                }`}
              >
                <LogOut className="h-4 w-4" />
                {!collapsed ? <span className="font-[family-name:var(--font-body)] text-[13px]">退出登录</span> : null}
              </button>
            </div>
          ) : null}
        </div>
      </aside>

      <div
        className={`min-w-0 flex-1 bg-[var(--background)] transition-[padding-left] duration-200 ${
          collapsed ? "md:pl-20" : "md:pl-72"
        }`}
      >
        <div className="pureon-topbar sticky top-0 z-20">
          <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center justify-between gap-4 px-4 py-4 lg:px-8">
            <div className="flex min-w-0 items-center gap-8">
              <div className="min-w-0">
                <PureonBrand />
              </div>
              <div className="hidden items-center gap-1 lg:flex">
                {topNavItems.map((item) => (
                  <TopNavLink key={item.key} href={item.href} label={item.label} active={activeTopNav === item.key} />
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
        </div>
        {children}
      </div>
    </div>
  );
}
