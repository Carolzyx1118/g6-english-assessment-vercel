import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { useLocalAuth } from "@/hooks/useLocalAuth";

interface TeacherGuardProps {
  children: React.ReactNode;
}

export default function TeacherGuard({ children }: TeacherGuardProps) {
  const { loading, isAuthenticated, isTeacher } = useLocalAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && isAuthenticated && !isTeacher) {
      navigate("/");
    }
  }, [isAuthenticated, isTeacher, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !isTeacher) {
    return null;
  }

  return <>{children}</>;
}
