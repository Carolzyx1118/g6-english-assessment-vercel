const PASSAGE_CHOICE_LABELS = ["A", "B", "C"] as const;

type PassageChoiceLabel = (typeof PASSAGE_CHOICE_LABELS)[number];

type LabeledTextOption = {
  label?: string | null;
  text?: string | null;
};

function normalizePassageChoiceLabel(value: string | null | undefined): PassageChoiceLabel | null {
  const normalized = typeof value === "string" ? value.trim().toUpperCase() : "";
  return PASSAGE_CHOICE_LABELS.includes(normalized as PassageChoiceLabel)
    ? (normalized as PassageChoiceLabel)
    : null;
}

export function getPassageChoiceLabels() {
  return [...PASSAGE_CHOICE_LABELS];
}

export function normalizePassageChoiceCorrectAnswer(
  value: string | null | undefined,
  labels: readonly string[],
) {
  const normalized = normalizePassageChoiceLabel(value);
  return normalized && labels.includes(normalized)
    ? normalized
    : labels[0] || "A";
}

export function normalizePassageChoiceTextOptions<T extends LabeledTextOption>(
  options: readonly T[] | undefined,
  createFallback: (index: number, label: PassageChoiceLabel) => T,
): T[] {
  const source = Array.isArray(options) ? [...options] : [];
  const byLabel = new Map<PassageChoiceLabel, T>();
  const remaining: T[] = [];

  for (const option of source) {
    const normalizedLabel = normalizePassageChoiceLabel(option.label);
    if (normalizedLabel && !byLabel.has(normalizedLabel)) {
      byLabel.set(normalizedLabel, option);
      continue;
    }

    remaining.push(option);
  }

  return PASSAGE_CHOICE_LABELS.map((label, index) => {
    const base = byLabel.get(label) ?? remaining.shift() ?? createFallback(index, label);
    return {
      ...base,
      label,
      text: typeof base.text === "string" ? base.text : "",
    };
  });
}

export function normalizePassageChoiceStrings(
  options: readonly string[] | undefined,
  labeledOptions?: readonly LabeledTextOption[],
) {
  if (Array.isArray(labeledOptions) && labeledOptions.length > 0) {
    return normalizePassageChoiceTextOptions(labeledOptions, (_index, label) => ({
      label,
      text: "",
    })).map((option) => option.text ?? "");
  }

  const source = Array.isArray(options) ? [...options] : [];
  return PASSAGE_CHOICE_LABELS.map((_label, index) => {
    const value = source[index];
    return typeof value === "string" ? value : "";
  });
}
