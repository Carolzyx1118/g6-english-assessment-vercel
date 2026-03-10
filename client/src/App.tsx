import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { lazy, Suspense } from "react";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { QuizProvider } from "./contexts/QuizContext";
import AuthGuard from "./components/AuthGuard";
import Home from "./pages/Home";
import History from "./pages/History";
import Login from "./pages/Login";
import Register from "./pages/Register";

function PaperIntakeLoadError() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="max-w-lg space-y-4 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Paper builder failed to load</h1>
        <p className="text-sm text-slate-500">
          Refresh the page after your latest sync finishes. If the problem continues, redeploy the app so the new
          route bundle is rebuilt.
        </p>
        <a
          href="/"
          className="inline-flex items-center justify-center rounded-lg bg-[#1E3A5F] px-4 py-2 text-sm font-medium text-white"
        >
          Back to home
        </a>
      </div>
    </div>
  );
}

const PaperIntake = lazy(() =>
  import("./pages/PaperIntake").catch((error) => {
    console.error("[paper-intake] failed to load", error);
    return { default: PaperIntakeLoadError };
  }),
);

function Router() {
  return (
    <Switch>
      {/* Public auth routes */}
      <Route path={"/login"} component={Login} />
      <Route path={"/register"} component={Register} />

      {/* Protected routes - require local auth */}
      <Route path={"/"}>
        <AuthGuard>
          <Home />
        </AuthGuard>
      </Route>
      <Route path={"/history"}>
        <AuthGuard>
          <History />
        </AuthGuard>
      </Route>
      <Route path={"/paper-intake"}>
        <AuthGuard>
          <Suspense
            fallback={
              <div className="flex min-h-screen items-center justify-center bg-background">
                <p className="text-sm text-slate-500">Loading paper builder...</p>
              </div>
            }
          >
            <PaperIntake />
          </Suspense>
        </AuthGuard>
      </Route>

      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <QuizProvider>
            <Toaster />
            <Router />
          </QuizProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
