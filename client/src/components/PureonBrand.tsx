import { cn } from "@/lib/utils";

export function PureonBrandMark({
  className,
  inverse = false,
}: {
  className?: string;
  inverse?: boolean;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border shadow-[0_12px_28px_-16px_rgba(45,74,62,0.6)]",
        inverse
          ? "border-[rgba(201,164,97,0.3)] bg-[rgba(245,239,224,0.08)]"
          : "border-[var(--pureon-rule)] bg-[var(--pureon-teal)]",
        className,
      )}
    >
      <span className="absolute top-[9px] h-[15px] w-[18px] rounded-[50%_50%_45%_45%] bg-[var(--pureon-gold)]" />
      <span className="absolute bottom-[7px] h-[12px] w-[24px] rounded-[50%_50%_40%_40%/80%_80%_20%_20%] bg-[var(--pureon-blue)]" />
    </div>
  );
}

export function PureonBrand({
  className,
  inverse = false,
  compact = false,
}: {
  className?: string;
  inverse?: boolean;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <PureonBrandMark inverse={inverse} className={compact ? "h-9 w-9" : undefined} />
      <div className="flex min-w-0 flex-col leading-none">
        <span
          className={cn(
            "truncate font-[family-name:var(--font-body)] text-[16px] font-semibold tracking-[0.24em]",
            inverse ? "text-[var(--pureon-paper)]" : "text-[var(--pureon-teal)]",
            compact ? "text-[14px]" : "text-[16px]",
          )}
        >
          璞源教育
        </span>
        <span
          className={cn(
            "mt-1 truncate font-[family-name:var(--font-display)] text-[10px] uppercase tracking-[0.34em]",
            inverse ? "text-[rgba(245,239,224,0.62)]" : "text-[var(--pureon-muted)]",
          )}
        >
          Pureon Education
        </span>
      </div>
    </div>
  );
}
