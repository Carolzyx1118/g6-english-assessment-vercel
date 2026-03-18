import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, KeyRound, Loader2, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import TeacherToolsLayout from "@/components/TeacherToolsLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return date.toLocaleString("en-SG", {
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
  const [savingUserIds, setSavingUserIds] = useState<Record<number, boolean>>({});
  const [savedUserIds, setSavedUserIds] = useState<Record<number, boolean>>({});
  const [resettingUserId, setResettingUserId] = useState<number | null>(null);
  const [temporaryPasswords, setTemporaryPasswords] = useState<Record<number, string>>({});
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null);

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

  const resetPasswordMutation = trpc.localAuth.resetUserPassword.useMutation();

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

  const persistDraft = async (managedUser: ManagedUser, nextDraft: UserDraft) => {
    setSavingUserIds((current) => ({ ...current, [managedUser.id]: true }));
    setSavedUserIds((current) => ({ ...current, [managedUser.id]: false }));

    try {
      await updateMutation.mutateAsync({
        id: managedUser.id,
        allowedSubjects: nextDraft.allowedSubjects,
        isActive: nextDraft.isActive,
      });
      setSavedUserIds((current) => ({ ...current, [managedUser.id]: true }));
    } catch (error) {
      setDrafts((current) => ({
        ...current,
        [managedUser.id]: {
          allowedSubjects: normalizeSubjects(managedUser.allowedSubjects),
          isActive: managedUser.isActive,
        },
      }));
      toast.error(error instanceof Error ? error.message : "Auto-save failed. Please try again.");
    } finally {
      setSavingUserIds((current) => ({ ...current, [managedUser.id]: false }));
    }
  };

  const handleToggleSubject = async (managedUser: ManagedUser, subject: PaperSubject, checked: boolean) => {
    const currentDraft = drafts[managedUser.id] ?? {
      allowedSubjects: normalizeSubjects(managedUser.allowedSubjects),
      isActive: managedUser.isActive,
    };
    const nextSubjects = checked
      ? Array.from(new Set([...currentDraft.allowedSubjects, subject]))
      : currentDraft.allowedSubjects.filter((item) => item !== subject);
    const normalizedSubjects = PAPER_SUBJECT_ORDER.filter((item) => nextSubjects.includes(item));

    if (normalizedSubjects.length === 0) {
      toast.error("Keep at least one subject enabled.");
      return;
    }

    const nextDraft = {
      ...currentDraft,
      allowedSubjects: normalizedSubjects,
    };

    setDrafts((current) => ({ ...current, [managedUser.id]: nextDraft }));
    await persistDraft(managedUser, nextDraft);
  };

  const handleToggleActive = async (managedUser: ManagedUser, checked: boolean) => {
    const currentDraft = drafts[managedUser.id] ?? {
      allowedSubjects: normalizeSubjects(managedUser.allowedSubjects),
      isActive: managedUser.isActive,
    };
    const nextDraft = {
      ...currentDraft,
      isActive: checked,
    };

    setDrafts((current) => ({ ...current, [managedUser.id]: nextDraft }));
    await persistDraft(managedUser, nextDraft);
  };

  const handleResetPassword = async (managedUser: ManagedUser) => {
    try {
      setResettingUserId(managedUser.id);
      const result = await resetPasswordMutation.mutateAsync({ id: managedUser.id });
      setTemporaryPasswords((current) => ({
        ...current,
        [managedUser.id]: result.temporaryPassword,
      }));
      toast.success(`Temporary password generated for ${managedUser.username}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Password reset failed. Please try again.");
    } finally {
      setResettingUserId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      setDeletingUserId(deleteTarget.id);
      await deleteMutation.mutateAsync({ id: deleteTarget.id });
      toast.success(`Deleted ${deleteTarget.username}.`);
      setDeleteTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed. Please try again.");
    } finally {
      setDeletingUserId(null);
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
                Back to teacher home
              </Link>
              <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#1E3A5F]">User Manager</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-500">
                Manage student and teacher accounts here. Changes to status and subject access are saved automatically.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription>Total Users</CardDescription>
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
                <CardDescription>Full Workspace Access</CardDescription>
                <CardTitle className="text-2xl text-[#1E3A5F]">{summary.teachers}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          {!isTeacher ? (
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle>No Access</CardTitle>
                <CardDescription>This account does not have teacher access.</CardDescription>
              </CardHeader>
            </Card>
          ) : listQuery.isLoading ? (
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="flex items-center justify-center gap-3 py-16 text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading users...
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
                const isSaving = savingUserIds[managedUser.id] === true;
                const isResetting = resettingUserId === managedUser.id;
                const isDeleting = deletingUserId === managedUser.id;
                const temporaryPassword = temporaryPasswords[managedUser.id];

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
                                  {hasFullAccess ? "Full Workspace Access" : "Limited Access"}
                                </Badge>
                                {isSelf ? (
                                  <Badge className="rounded-full bg-sky-100 px-2.5 py-1 text-xs text-sky-700 hover:bg-sky-100">
                                    Current User
                                  </Badge>
                                ) : null}
                              </div>
                              <p className="mt-1 text-sm text-slate-500">@{managedUser.username}</p>
                            </div>
                          </div>
                          <div className="grid gap-2 text-sm text-slate-500 sm:grid-cols-2">
                            <p>Created: {formatDate(managedUser.createdAt)}</p>
                            <p>Last login: {formatDate(managedUser.lastLoginAt)}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <div>
                            <p className="text-sm font-medium text-slate-700">Account Status</p>
                            <p className="text-xs text-slate-500">Turn off to block sign-in</p>
                          </div>
                          <Switch
                            checked={draft.isActive}
                            onCheckedChange={(checked) => void handleToggleActive(managedUser, checked)}
                            disabled={isSelf || isSaving}
                          />
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="text-sm font-medium text-slate-700">Visible Subjects</p>
                          <p className="text-xs text-slate-500">
                            {isSaving ? "Saving..." : savedUserIds[managedUser.id] ? "Saved" : "Auto-save enabled"}
                          </p>
                        </div>
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
                                    void handleToggleSubject(managedUser, subject, value === true)
                                  }
                                  disabled={isSelf || isSaving}
                                />
                                <span>{PAPER_SUBJECT_LABELS[subject]}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-end justify-between gap-4">
                        <div className="min-w-[260px] flex-1 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-slate-700">Temporary Password</p>
                              <p className="text-xs text-slate-500">
                                Existing passwords cannot be shown. Reset to generate a new visible password.
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => void handleResetPassword(managedUser)}
                              disabled={isSelf || isResetting || isDeleting}
                            >
                              {isResetting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                              Reset Password
                            </Button>
                          </div>

                          <Input
                            className="mt-3"
                            readOnly
                            value={temporaryPassword || ""}
                            placeholder="No temporary password generated yet"
                          />
                        </div>

                        <div className="flex flex-wrap gap-3">
                          <Button
                            type="button"
                            variant="outline"
                            className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                            onClick={() => setDeleteTarget(managedUser)}
                            disabled={isSelf || isSaving || isDeleting || isResetting}
                          >
                            {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                            Delete User
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
            <AlertDialogTitle>Delete this user?</AlertDialogTitle>
            <AlertDialogDescription>
              This account will no longer be able to sign in. Existing records will not be restored automatically. User: {deleteTarget?.username}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TeacherToolsLayout>
  );
}
