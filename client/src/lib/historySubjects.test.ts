import { describe, expect, it } from "vitest";

import { getGeneratedPaperSubjectFromPaperId } from "@/lib/historySubjects";

describe("getGeneratedPaperSubjectFromPaperId", () => {
  it("detects english generated paper ids", () => {
    expect(getGeneratedPaperSubjectFromPaperId("tag-system-english-ket")).toBe("english");
  });

  it("detects math generated paper ids", () => {
    expect(getGeneratedPaperSubjectFromPaperId("tag-system-math-school-math")).toBe("math");
  });

  it("returns null for non-generated paper ids", () => {
    expect(getGeneratedPaperSubjectFromPaperId("manual-abc123")).toBeNull();
  });
});
