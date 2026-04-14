import { PureonBrand } from "@/components/PureonBrand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveAuthToken } from "@/hooks/useLocalAuth";
import { trpc } from "@/lib/trpc";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function Login() {
  const [, navigate] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const utils = trpc.useUtils();

  const loginMutation = trpc.localAuth.login.useMutation({
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
      toast.success("登录成功！");
      navigate("/");
    },
    onError: (err) => {
      toast.error(err.message || "登录失败");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      toast.error("请填写用户名和密码");
      return;
    }
    loginMutation.mutate({ username: username.trim(), password });
  };

  return (
    <div className="pureon-page-shell flex min-h-[100dvh] items-center justify-center px-4 py-6 sm:px-6 md:py-8 xl:py-0">
      <div className="pureon-panel grid w-full max-w-6xl overflow-hidden md:min-h-[760px] md:grid-cols-[1.02fr_0.98fr]">
        <div className="relative flex overflow-hidden bg-[var(--pureon-teal)] px-8 py-10 text-[var(--pureon-paper)] sm:px-10 md:px-12 md:py-14">
          <div className="absolute right-[-4rem] top-[-4rem] h-64 w-64 rounded-full bg-[rgba(201,164,97,0.12)] blur-3xl" />
          <div className="absolute bottom-[-5rem] left-[-4rem] h-72 w-72 rounded-full bg-[rgba(43,88,118,0.22)] blur-3xl" />
          <div className="relative z-10 flex w-full flex-col justify-center md:-translate-y-8 lg:-translate-y-10">
            <PureonBrand inverse className="mb-10" />
            <div className="max-w-md">
            <h1 className="font-[family-name:var(--font-body)] text-[2.2rem] font-semibold tracking-[0.24em] sm:text-[2.6rem]">
              璞源教育
            </h1>
            <p className="mt-3 font-[family-name:var(--font-display)] text-sm italic tracking-[0.22em] text-[var(--pureon-gold-soft)]">
              Pureon Education · est. 2018
            </p>
            <div className="mt-10 border-l-2 border-[var(--pureon-gold)] pl-5 text-sm leading-8 text-[rgba(245,239,224,0.74)]">
              玉不琢，不成器；人不学，不知道。
              <br />
              Without polishing, jade does not become a vessel; without learning, one does not know the way.
              <div className="mt-4 font-[family-name:var(--font-display)] text-[11px] uppercase tracking-[0.24em] text-[var(--pureon-gold-soft)]">
                Li Ji · Xue Ji
              </div>
            </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-center bg-[rgba(245,239,224,0.88)] px-8 py-10 sm:px-10 md:px-12 md:py-14">
          <div>
            <div className="pureon-section-eyebrow">Welcome Back</div>
            <h2 className="mt-3 text-[2rem] font-semibold tracking-[0.1em] text-[var(--pureon-teal)]">
              登录你的账户
            </h2>
            <p className="mt-2 text-sm text-[var(--pureon-muted)]">
              Sign in to continue your learning journey
            </p>
          </div>

          <div className="mt-8 grid grid-cols-2 border border-[var(--pureon-rule)] text-center font-[family-name:var(--font-body)] text-sm">
            <div className="bg-[var(--pureon-teal)] px-4 py-3 text-[var(--pureon-paper)]">登录 / Log in</div>
            <button
              type="button"
              onClick={() => navigate("/register")}
              className="border-l border-[var(--pureon-rule)] px-4 py-3 text-[var(--pureon-muted)] transition-colors hover:bg-[rgba(201,164,97,0.08)] hover:text-[var(--pureon-teal)]"
            >
              注册 / Register
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username">账号 / Account</Label>
              <Input
                id="username"
                type="text"
                placeholder="请输入用户名"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
                className="h-12 rounded-none border-x-0 border-t-0 px-0 text-[15px] shadow-none"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">密码 / Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="请输入密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
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

            <div className="flex items-center justify-end text-xs text-[var(--pureon-muted)]">
              <button
                type="button"
                onClick={() => navigate("/register")}
                className="border-b border-dotted border-[var(--pureon-teal)] text-[var(--pureon-teal)] transition-colors hover:text-[var(--pureon-ink)]"
              >
                还没有账号？
              </button>
            </div>

            <Button
              type="submit"
              className="h-12 w-full bg-[var(--pureon-teal)] text-[var(--pureon-paper)] hover:bg-[var(--pureon-ink)]"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  登录中...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <LogIn className="h-4 w-4" />
                  登录 Sign In
                </span>
              )}
            </Button>
          </form>

          <div className="mt-8">
            <div className="pureon-brand-divider" />
            <p className="mt-4 text-center text-[11px] tracking-[0.24em] text-[var(--pureon-muted)]">
              AEIS · KET · PET · ENGLISH PRACTICE
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
