import { PureonBrand } from "@/components/PureonBrand";
import { useLocalAuth } from "@/hooks/useLocalAuth";
import { cn } from "@/lib/utils";

type StudentWorkspaceTab = "home" | "filter" | "practice" | "wrong" | "writing" | "history";

interface StudentWorkspaceTopBarProps {
  active: StudentWorkspaceTab;
  onHomeClick?: () => void;
  onQuestionBankClick?: () => void;
  onPracticeClick?: () => void;
  onWrongBookClick?: () => void;
}

function NavButton({
  active,
  disabled = false,
  label,
  onClick,
}: {
  active?: boolean;
  disabled?: boolean;
  label: string;
  onClick?: () => void;
}) {
  const Comp = onClick && !disabled ? "button" : "span";

  return (
    <Comp
      {...(Comp === "button" ? { type: "button", onClick } : {})}
      className={cn("pureon-nav-link", onClick && !disabled ? "cursor-pointer" : "")}
      data-active={active ? "true" : "false"}
      data-disabled={disabled ? "true" : "false"}
    >
      {label}
    </Comp>
  );
}

export default function StudentWorkspaceTopBar({
  active,
  onHomeClick,
  onQuestionBankClick,
  onPracticeClick,
  onWrongBookClick,
}: StudentWorkspaceTopBarProps) {
  const { user } = useLocalAuth();
  const displayName = user?.displayName || user?.username || "Student";
  const avatarLabel = displayName.slice(0, 2).toUpperCase();

  return (
    <div className="pureon-topbar sticky top-0 z-20">
      <div className="mx-auto flex w-full max-w-[1280px] flex-wrap items-center justify-between gap-4 px-4 py-4 lg:px-8">
        <PureonBrand />
        <div className="pureon-nav">
          <NavButton active={active === "home"} label="主页" onClick={onHomeClick} />
          <NavButton active={active === "filter"} label="题库" onClick={onQuestionBankClick} />
          <NavButton active={active === "practice"} label="练习" onClick={onPracticeClick} />
          <NavButton active={active === "wrong"} label="错题本" onClick={onWrongBookClick} />
          <NavButton active={active === "writing"} label="作文" disabled />
          <NavButton active={active === "history"} label="学习记录" disabled />
        </div>
        <div className="pureon-user-chip">
          <span>{displayName}</span>
          <div className="pureon-avatar">{avatarLabel || "ST"}</div>
        </div>
      </div>
    </div>
  );
}
