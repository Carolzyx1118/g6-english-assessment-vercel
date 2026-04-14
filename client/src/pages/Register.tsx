import { PureonBrand } from "@/components/PureonBrand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveAuthToken } from "@/hooks/useLocalAuth";
import { trpc } from "@/lib/trpc";
import { Eye, EyeOff, KeyRound, UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function Register() {
  const [, navigate] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const utils = trpc.useUtils();

  const registerMutation = trpc.localAuth.register.useMutation({
    onSuccess: async (data) => {
      saveAuthToken(data.token);
      utils.localAuth.me.setData(undefined, {
        id: data.user.id,
        username: data.user.username,
        displayName: data.user.displayName,
        role: data.user.role as "user" | "admin",
        allowedSubjects: data.user.allowedSubjects,
        isActive: data.user.isActive,
      });
      toast.success("注册成功！正在进入系统...");
      navigate("/");
    },
    onError: (err) => {
      toast.error(err.message || "注册失败");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!username.trim()) {
      toast.error("请输入用户名");
      return;
    }
    if (username.trim().length < 3) {
      toast.error("用户名至少3个字符");
      return;
    }
    if (!password) {
      toast.error("请输入密码");
      return;
    }
    if (password.length < 6) {
      toast.error("密码至少6个字符");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("两次输入的密码不一致");
      return;
    }
    if (!inviteCode.trim()) {
      toast.error("请输入邀请码");
      return;
    }

    registerMutation.mutate({
      username: username.trim(),
      password,
      inviteCode: inviteCode.trim(),
    });
  };

  return (
    <div className="pureon-page-shell flex min-h-[100dvh] items-center justify-center px-4 py-6 sm:px-6 md:py-8 xl:py-0">
      <div className="pureon-panel grid w-full max-w-6xl overflow-hidden md:min-h-[760px] md:grid-cols-[1.02fr_0.98fr]">
        <div className="relative flex overflow-hidden bg-[var(--pureon-teal)] px-8 py-10 text-[var(--pureon-paper)] sm:px-10 md:px-12 md:py-14">
          <div className="absolute right-[-4rem] top-[-4rem] h-64 w-64 rounded-full bg-[rgba(201,164,97,0.12)] blur-3xl" />
          <div className="absolute bottom-[-5rem] left-[-4rem] h-72 w-72 rounded-full bg-[rgba(43,88,118,0.22)] blur-3xl" />
          <div className="relative z-10 flex w-full flex-col justify-center md:-translate-y-12 lg:-translate-y-14">
            <PureonBrand inverse className="mb-10" />
            <div className="max-w-md">
            <h1 className="font-[family-name:var(--font-body)] text-[2.2rem] font-semibold tracking-[0.24em] sm:text-[2.6rem]">
              创建学习账户
            </h1>
            <p className="mt-3 font-[family-name:var(--font-display)] text-sm italic tracking-[0.22em] text-[var(--pureon-gold-soft)]">
              Invitation-based access for students and teachers
            </p>
            <div className="mt-10 border-l-2 border-[var(--pureon-gold)] pl-5 text-sm leading-8 text-[rgba(245,239,224,0.74)]">
              为学而教，为练而精。
              <br />
              Create a focused account for practice, testing, and long-term progress tracking.
            </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-center bg-[rgba(245,239,224,0.88)] px-8 py-10 sm:px-10 md:px-12 md:py-14">
          <div>
            <div className="pureon-section-eyebrow">Create Account</div>
            <h2 className="mt-3 text-[2rem] font-semibold tracking-[0.1em] text-[var(--pureon-teal)]">
              注册你的账户
            </h2>
            <p className="mt-2 text-sm text-[var(--pureon-muted)]">
              Register with your invite code and start learning
            </p>
          </div>

          <div className="mt-8 grid grid-cols-2 border border-[var(--pureon-rule)] text-center font-[family-name:var(--font-body)] text-sm">
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="px-4 py-3 text-[var(--pureon-muted)] transition-colors hover:bg-[rgba(201,164,97,0.08)] hover:text-[var(--pureon-teal)]"
            >
              登录 / Log in
            </button>
            <div className="border-l border-[var(--pureon-rule)] bg-[var(--pureon-teal)] px-4 py-3 text-[var(--pureon-paper)]">
              注册 / Register
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username">用户名 / Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="请输入用户名（至少 3 个字符）"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
                className="h-12 rounded-none border-x-0 border-t-0 px-0 text-[15px] shadow-none"
              />
              <p className="text-xs text-[var(--pureon-muted)]">支持字母、数字、下划线和中文。</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">密码 / Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="请输入密码（至少 6 个字符）"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  className="h-12 rounded-none border-x-0 border-t-0 px-0 pr-10 text-[15px] shadow-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-0 top-1/2 -translate-y-1/2 text-[var(--pureon-muted)] transition-colors hover:text-[var(--pureon-teal)]"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">确认密码 / Confirm</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="请再次输入密码"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  className="h-12 rounded-none border-x-0 border-t-0 px-0 pr-10 text-[15px] shadow-none"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-0 top-1/2 -translate-y-1/2 text-[var(--pureon-muted)] transition-colors hover:text-[var(--pureon-teal)]"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {confirmPassword && password !== confirmPassword ? (
                <p className="text-xs text-[var(--pureon-red)]">两次输入的密码不一致</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="inviteCode" className="flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5 text-[var(--pureon-gold)]" />
                邀请码 / Invite Code
              </Label>
              <Input
                id="inviteCode"
                type="text"
                placeholder="请输入邀请码"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                className="h-12 rounded-none border-x-0 border-t-0 px-0 text-[15px] tracking-[0.18em] shadow-none"
              />
              <p className="text-xs text-[var(--pureon-muted)]">请联系管理员获取邀请码。</p>
            </div>

            <Button
              type="submit"
              className="h-12 w-full bg-[var(--pureon-teal)] text-[var(--pureon-paper)] hover:bg-[var(--pureon-ink)]"
              disabled={registerMutation.isPending}
            >
              {registerMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  注册中...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <UserPlus className="h-4 w-4" />
                  注册 Register
                </span>
              )}
            </Button>
          </form>

        </div>
      </div>
    </div>
  );
}
