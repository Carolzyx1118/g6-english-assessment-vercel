import type { ReactNode } from "react";

const FRACTION_TOKEN_REGEX = /(\d+\s+\d+\s*\/\s*\d+|\d+\s*\/\s*\d+)/g;

function parseFractionToken(token: string) {
  const normalized = token.replace(/\s+/g, " ").replace(/\s*\/\s*/g, "/").trim();
  const mixedMatch = normalized.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixedMatch) {
    return {
      whole: mixedMatch[1],
      numerator: mixedMatch[2],
      denominator: mixedMatch[3],
    };
  }

  const simpleMatch = normalized.match(/^(\d+)\/(\d+)$/);
  if (simpleMatch) {
    return {
      whole: undefined,
      numerator: simpleMatch[1],
      denominator: simpleMatch[2],
    };
  }

  return null;
}

export function renderTextWithFractions(text: string, keyPrefix = "fraction"): ReactNode[] {
  return text
    .split(FRACTION_TOKEN_REGEX)
    .filter((part) => part.length > 0)
    .map((part, index) => {
      const parsed = parseFractionToken(part);
      if (!parsed) {
        return part;
      }

      return (
        <span key={`${keyPrefix}-${index}`} className="inline-flex items-center gap-1 align-middle">
          {parsed.whole ? <span>{parsed.whole}</span> : null}
          <span className="inline-flex flex-col items-center justify-center align-middle text-[0.9em] leading-none">
            <span className="border-b border-current px-1 pb-[1px]">{parsed.numerator}</span>
            <span className="px-1 pt-[1px]">{parsed.denominator}</span>
          </span>
        </span>
      );
    });
}
