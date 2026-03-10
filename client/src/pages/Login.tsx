import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { saveAuthToken } from "@/hooks/useLocalAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_BRAND_SUBTITLE, APP_BRAND_TITLE } from "@/lib/branding";
import { toast } from "sonner";
import { Eye, EyeOff, LogIn } from "lucide-react";

const PUREON_LOGO = 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663325188422/bJDnAegOAPWmMppj.png';

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
        role: data.user.role as 'user' | 'admin',
        allowedSubjects: data.user.allowedSubjects,
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
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-[#F5F7FA] via-white to-[#FBF8F3] px-4 py-12">
        <div className="w-full max-w-md">
          {/* Brand heading */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-[#1E3A5F]">
              {APP_BRAND_TITLE}
            </h1>
            <p className="text-slate-500 mt-1 text-sm">{APP_BRAND_SUBTITLE}</p>
            <div className="mt-3 flex items-center justify-center gap-2">
              <div className="h-px w-12 bg-[#D4A84B]/30" />
              <span className="text-[10px] text-[#D4A84B] font-medium tracking-widest">AEIS · KET · PET</span>
              <div className="h-px w-12 bg-[#D4A84B]/30" />
            </div>
          </div>

          <Card className="shadow-xl border border-slate-200/60 bg-white">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-xl text-center text-[#1E3A5F]">登录</CardTitle>
            <CardDescription className="text-center">
                输入用户名和密码登录系统。账号可访问的科目由注册时的邀请码决定。
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">用户名</Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="请输入用户名"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">密码</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="请输入密码"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
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
              </CardContent>

              <CardFooter className="flex flex-col gap-3 pt-2">
                <Button
                  type="submit"
                  className="w-full bg-[#1E3A5F] hover:bg-[#2A4A6F] text-white"
                  disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      登录中...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <LogIn className="w-4 h-4" />
                      登录
                    </span>
                  )}
                </Button>

                <p className="text-sm text-muted-foreground text-center">
                  还没有账号？{" "}
                  <button
                    type="button"
                    onClick={() => navigate("/register")}
                    className="text-[#D4A84B] hover:text-[#C49A3F] hover:underline font-medium"
                  >
                    立即注册
                  </button>
                </p>
              </CardFooter>
            </form>
          </Card>

          {/* Footer */}
          <div className="mt-8 text-center">
            <p className="text-xs text-slate-400">© 2026 璞源教育 Pureon Education</p>
          </div>
        </div>
      </div>
    </div>
  );
}
