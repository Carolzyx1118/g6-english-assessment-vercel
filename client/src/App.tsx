import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { QuizProvider } from "./contexts/QuizContext";
import Home from "./pages/Home";
import History from "./pages/History";
import PaperCreator from "./pages/PaperCreator";
import PaperManager from "./pages/PaperManager";
function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/history"} component={History} />
      <Route path={"/paper-creator"} component={PaperCreator} />
      <Route path={"/paper-manager"} component={PaperManager} />
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
