import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Loader2, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import TeacherToolsLayout from "@/components/TeacherToolsLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PAPER_SUBJECT_LABELS, PAPER_SUBJECT_ORDER, type PaperSubject } from "@/data/papers";
import { useLocalAuth } from "@/hooks/useLocalAuth";
import { trpc } from "@/lib/trpc";

type ManagedUser = {
  id: number;
  username: string;
  displayName: string;
  role: "user" | "admin";
  allowedSubjects: string[];
  isActive: boolean;
  createdAt: string | Date;
  lastLoginAt: string | Date;
};

type UserDraft = {
  allowedSubjects: PaperSubject[];
  isActive: boolean;
};

function formatDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "未记录";
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeSubjects(subjects: string[]) {
  return PAPER_SUBJECT_ORDER.filter((subject) => subjects.includes(subject));
}

export default function UserManager() {
  const utils = trpc.useUtils();
  const { user, isTeacher } = useLocalAuth();
  const [drafts, setDrafts] = useState<Record<number, UserDraft>>({});
  const [deleteTarget, setDeleteTarget] = useState<ManagedUser | null>(null);
  const [pendingUserId, setPendingUserId] = useState<number | null>(null);

  const listQuery = trpc.localAuth.listUsers.useQuery(undefined, {
    enabled: isTeacher,
    staleTime: 5_000,
  });

  const updateMutation = trpc.localAuth.updateUser.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.localAuth.listUsers.invalidate(),
        utils.localAuth.me.invalidate(),
      ]);
    },
  });

  const deleteMutation = trpc.localAuth.deleteUser.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.localAuth.listUsers.invalidate(),
        utils.localAuth.me.invalidate(),
      ]);
    },
  });

  useEffect(() => {
    if (!listQuery.data) return;
    const nextDrafts = Object.fromEntries(
      listQuery.data.map((item) => [
        item.id,
        {
          allowedSubjects: normalizeSubjects(item.allowedSubjects),
          isActive: item.isActive,
        },
      ]),
    ) as Record<number, UserDraft>;
    setDrafts(nextDrafts);
  }, [listQuery.data]);

  const users = useMemo(() => listQuery.data ?? [], [listQuery.data]);

  const summary = useMemo(() => {
    const activeCount = users.filter((item) => item.isActive).length;
    const teacherCount = users.filter(
      (item) => normalizeSubjects(item.allowedSubjects).length === PAPER_SUBJECT_ORDER.length,
    ).length;
    return {
      total: users.length,
      active: activeCount,
      inactive: users.length - activeCount,
      teachers: teacherCount,
    };
  }, [users]);

  const updateDraft = (id: number, updater: (current: UserDraft) => UserDraft) => {
    setDrafts((current) => {
      const existing = current[id] ?? { allowedSubjects: [...PAPER_SUBJECT_ORDER], isActive: true };
      return {
        ...current,
        [id]: updater(existing),
      };
    });
  };

  const handleToggleSubject = (id: number, subject: PaperSubject, checked: boolean) => {
    updateDraft(id, (current) => {
      const nextSubjects = checked
        ? Array.from(new Set([...current.allowedSubjects, subject]))
        : current.allowedSubjects.filter((item) => item !== subject);
      return {
        ...current,
        allowedSubjects: PAPER_SUBJECT_ORDER.filter((item) => nextSubjects.includes(item)),
      };
    });
  };

  const handleSave = async (managedUser: ManagedUser) => {
    const draft = drafts[managedUser.id];
    if (!draft) return;
    if (draft.allowedSubjects.length === 0) {
      toast.error("至少保留一个科目权限。");
      return;
    }

    try {
      setPendingUserId(managedUser.id);
      await updateMutation.mutateAsync({
        id: managedUser.id,
        allowedSubjects: draft.allowedSubjects,
        isActive: draft.isActive,
      });
      toast.success(`已更新 ${managedUser.displayName || managedUser.username} 的账号权限。`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败，请稍后重试。");
    } finally {
      setPendingUserId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      setPendingUserId(deleteTarget.id);
      await deleteMutation.mutateAsync({ id: deleteTarget.id });
      toast.success(`已删除账号 ${deleteTarget.username}。`);
      setDeleteTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除失败，请稍后重试。");
    } finally {
      setPendingUserId(null);
    }
  };

  return (
    <TeacherToolsLayout activeTool="user-manager">
      <div className="min-h-screen bg-[#F6F8FB] px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700">
                <ArrowLeft className="h-4 w-4" />
                返回老师首页
              </Link>
              <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#1E3A5F]">用户管理</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-500">
                在这里管理学生和老师账号。你可以停用账号、删除账号，或者调整能看到的科目权限。
              </p>
            </div>
            <Badge className="rounded-full bg-sky-100 px-3 py-1 text-sky-700 hover:bg-sky-100">
              满科目权限 = 老师工作台可见
            </Badge>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription>总账号数</CardDescription>
                <CardTitle className="text-2xl">{summary.total}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription>Active</CardDescription>
                <CardTitle className="text-2xl text-emerald-700">{summary.active}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription>Inactive</CardDescription>
                <CardTitle className="text-2xl text-amber-700">{summary.inactive}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription>老师账号</CardDescription>
                <CardTitle className="text-2xl text-[#1E3A5F]">{summary.teachers}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          {!isTeacher ? (
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle>没有权限</CardTitle>
                <CardDescription>当前账号不是老师账号，无法进入用户管理。</CardDescription>
              </CardHeader>
            </Card>
          ) : listQuery.isLoading ? (
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="flex items-center justify-center gap-3 py-16 text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin" />
                正在加载用户列表...
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {users.map((managedUser) => {
                const draft = drafts[managedUser.id] ?? {
                  allowedSubjects: normalizeSubjects(managedUser.allowedSubjects),
                  isActive: managedUser.isActive,
                };
                const isSelf = managedUser.id === user?.id;
                const hasFullAccess = draft.allowedSubjects.length === PAPER_SUBJECT_ORDER.length;
                const isSaving = pendingUserId === managedUser.id;

                return (
                  <Card key={managedUser.id} className="border-slate-200 shadow-sm">
                    <CardContent className="space-y-5 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
                              {hasFullAccess ? <ShieldCheck className="h-5 w-5" /> : <UserRound className="h-5 w-5" />}
                            </div>
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h2 className="text-lg font-semibold text-[#1E3A5F]">
                                  {managedUser.displayName || managedUser.username}
                                </h2>
                                <Badge
                                  className={`rounded-full px-2.5 py-1 text-xs ${
                                    draft.isActive
                                      ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                                      : "bg-amber-100 text-amber-700 hover:bg-amber-100"
                                  }`}
                                >
                                  {draft.isActive ? "Active" : "Inactive"}
                                </Badge>
                                <Badge className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100">
                                  {hasFullAccess ? "Teacher Access" : "Restricted Access"}
                                </Badge>
                                {isSelf ? (
                                  <Badge className="rounded-full bg-sky-100 px-2.5 py-1 text-xs text-sky-700 hover:bg-sky-100">
                                    当前登录账号
                                  </Badge>
                                ) : null}
                              </div>
                              <p className="mt-1 text-sm text-slate-500">@{managedUser.username}</p>
                            </div>
                          </div>
                          <div className="grid gap-2 text-sm text-slate-500 sm:grid-cols-2">
                            <p>创建时间：{formatDate(managedUser.createdAt)}</p>
                            <p>最近登录：{formatDate(managedUser.lastLoginAt)}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <div>
                            <p className="text-sm font-medium text-slate-700">账号状态</p>
                            <p className="text-xs text-slate-500">关闭后该账号将无法登录</p>
                          </div>
                          <Switch
                            checked={draft.isActive}
                            onCheckedChange={(checked) =>
                              updateDraft(managedUser.id, (current) => ({ ...current, isActive: checked }))
                            }
                            disabled={isSelf || isSaving}
                          />
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-sm font-medium text-slate-700">可见科目</p>
                        <div className="mt-3 flex flex-wrap gap-4">
                          {PAPER_SUBJECT_ORDER.map((subject) => {
                            const checked = draft.allowedSubjects.includes(subject);
                            return (
                              <label
                                key={`${managedUser.id}-${subject}`}
                                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                              >
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(value) =>
                                    handleToggleSubject(managedUser.id, subject, value === true)
                                  }
                                  disabled={isSelf || isSaving}
                                />
                                <span>{PAPER_SUBJECT_LABELS[subject]}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm text-slate-500">
                          {hasFullAccess
                            ? "当前权限会显示完整老师工作台。"
                            : "该账号只能看到勾选的科目入口。"}
                        </p>
                        <div className="flex flex-wrap gap-3">
                          <Button
                            type="button"
                            variant="outline"
                            className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                            onClick={() => setDeleteTarget(managedUser)}
                            disabled={isSelf || isSaving}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            删除账号
                          </Button>
                          <Button
                            type="button"
                            className="bg-[#1E3A5F] text-white hover:bg-[#17324F]"
                            onClick={() => handleSave(managedUser)}
                            disabled={isSelf || isSaving || draft.allowedSubjects.length === 0}
                          >
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            保存权限
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => (!open ? setDeleteTarget(null) : undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除这个账号？</AlertDialogTitle>
            <AlertDialogDescription>
              删除后，这个账号将无法再登录，已有记录不会自动恢复。账号：{deleteTarget?.username}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TeacherToolsLayout>
  );
}
