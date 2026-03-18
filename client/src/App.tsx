import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import TeacherGuard from "./components/TeacherGuard";
import { ThemeProvider } from "./contexts/ThemeContext";
import { QuizProvider } from "./contexts/QuizContext";
import AuthGuard from "./components/AuthGuard";
import Home from "./pages/Home";
import History from "./pages/History";
import Login from "./pages/Login";
import PaperIntake from "./pages/PaperIntake";
import PaperManager from "./pages/PaperManager";
import QuestionBank from "./pages/QuestionBank";
import Register from "./pages/Register";
import TagManager from "./pages/TagManager";
import UserManager from "./pages/UserManager";

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
          <TeacherGuard>
            <History />
          </TeacherGuard>
        </AuthGuard>
      </Route>
      <Route path={"/paper-intake"}>
        <AuthGuard>
          <TeacherGuard>
            <PaperIntake />
          </TeacherGuard>
        </AuthGuard>
      </Route>
      <Route path={"/question-bank"}>
        <AuthGuard>
          <TeacherGuard>
            <QuestionBank />
          </TeacherGuard>
        </AuthGuard>
      </Route>
      <Route path={"/tag-manager"}>
        <AuthGuard>
          <TeacherGuard>
            <TagManager />
          </TeacherGuard>
        </AuthGuard>
      </Route>
      <Route path={"/paper-manager"}>
        <AuthGuard>
          <TeacherGuard>
            <PaperManager />
          </TeacherGuard>
        </AuthGuard>
      </Route>
      <Route path={"/user-manager"}>
        <AuthGuard>
          <TeacherGuard>
            <UserManager />
          </TeacherGuard>
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
