import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { saveAuthToken } from "@/hooks/useLocalAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Eye, EyeOff, UserPlus, KeyRound } from "lucide-react";

const PUREON_LOGO = 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663325188422/bJDnAegOAPWmMppj.png';

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
        role: data.user.role as 'user' | 'admin',
        allowedSubjects: data.user.allowedSubjects,
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
    <div className="min-h-screen flex flex-col">
      {/* Navy top bar */}
      <div className="bg-[#1E3A5F] py-4">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-center gap-3">
          <img src={PUREON_LOGO} alt="璞源教育" className="w-10 h-10 object-contain" />
          <div className="leading-tight text-center">
            <div className="text-sm font-bold text-white tracking-wide">璞源教育</div>
            <div className="text-[10px] text-white/50 tracking-widest">PUREON EDUCATION</div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-[#F5F7FA] via-white to-[#FBF8F3] px-4 py-8">
        <div className="w-full max-w-md">
          {/* Brand heading */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-[#1E3A5F]">
              English Proficiency Assessment
            </h1>
            <p className="text-slate-500 mt-1 text-sm">英语能力测评系统</p>
            <div className="mt-3 flex items-center justify-center gap-2">
              <div className="h-px w-12 bg-[#D4A84B]/30" />
              <span className="text-[10px] text-[#D4A84B] font-medium tracking-widest">AEIS · KET · PET</span>
              <div className="h-px w-12 bg-[#D4A84B]/30" />
            </div>
          </div>

          <Card className="shadow-xl border border-slate-200/60 bg-white">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-xl text-center text-[#1E3A5F]">注册账号</CardTitle>
            <CardDescription className="text-center">
                填写以下信息创建账号。邀请码会决定这个账号可以进入哪些科目页面。
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">用户名</Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="请输入用户名（至少3个字符）"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground">
                    支持字母、数字、下划线和中文
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">密码</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="请输入密码（至少6个字符）"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">确认密码</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="请再次输入密码"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  {confirmPassword && password !== confirmPassword && (
                    <p className="text-xs text-destructive">两次输入的密码不一致</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="inviteCode" className="flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-[#D4A84B]" />
                    邀请码
                  </Label>
                  <Input
                    id="inviteCode"
                    type="text"
                    placeholder="请输入邀请码"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    className="tracking-wider"
                  />
                  <p className="text-xs text-muted-foreground">
                    请联系管理员获取邀请码。不同邀请码可限制 English、Math 或 Vocabulary 页面访问权限。
                  </p>
                </div>
              </CardContent>

              <CardFooter className="flex flex-col gap-3 pt-2">
                <Button
                  type="submit"
                  className="w-full bg-[#1E3A5F] hover:bg-[#2A4A6F] text-white"
                  disabled={registerMutation.isPending}
                >
                  {registerMutation.isPending ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      注册中...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <UserPlus className="w-4 h-4" />
                      注册
                    </span>
                  )}
                </Button>

                <p className="text-sm text-muted-foreground text-center">
                  已有账号？{" "}
                  <button
                    type="button"
                    onClick={() => navigate("/login")}
                    className="text-[#D4A84B] hover:text-[#C49A3F] hover:underline font-medium"
                  >
                    立即登录
                  </button>
                </p>
              </CardFooter>
            </form>
          </Card>

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-xs text-slate-400">© 2026 璞源教育 Pureon Education</p>
          </div>
        </div>
      </div>
    </div>
  );
}
