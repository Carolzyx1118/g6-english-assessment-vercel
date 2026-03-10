import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { QuizProvider } from "./contexts/QuizContext";
import AuthGuard from "./components/AuthGuard";
import Home from "./pages/Home";
import History from "./pages/History";
import Login from "./pages/Login";
import Register from "./pages/Register";

const PaperIntake = lazy(() => import("./pages/PaperIntake"));

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
              <div className="flex min-h-screen items-center justify-center bg-background p-8 text-sm text-muted-foreground">
                Loading paper builder...
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
