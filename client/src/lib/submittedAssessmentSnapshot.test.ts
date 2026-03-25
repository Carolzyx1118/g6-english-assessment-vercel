import { afterEach, describe, expect, it, vi } from "vitest";

type StorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

function createStorage(): StorageLike {
  const store = new Map<string, string>();

  return {
    getItem(key) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key, value) {
      store.set(key, value);
    },
    removeItem(key) {
      store.delete(key);
    },
  };
}

function installWindow() {
  const sessionStorage = createStorage();
  const localStorage = createStorage();

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      sessionStorage,
      localStorage,
    },
  });

  return { sessionStorage, localStorage };
}

afterEach(() => {
  vi.resetModules();
  Reflect.deleteProperty(globalThis, "window");
});

describe("submittedAssessmentSnapshot", () => {
  it("falls back to localStorage when the session copy is unavailable", async () => {
    const { sessionStorage, localStorage } = installWindow();
    const snapshotModule = await import("./submittedAssessmentSnapshot");

    snapshotModule.writeSubmittedAssessmentSnapshot({
      paper: {
        id: "ket-unit-1",
        title: "KET Unit 1 Practice",
        sections: [],
        totalQuestions: 0,
        hasListening: false,
        hasWriting: false,
        subject: "english",
        category: "practice",
      },
      studentInfo: {
        name: "Alice",
        grade: "Grade 6",
      },
      answers: { "reading:1": "A" },
      sectionTimings: { reading: 120 },
      startTime: 100,
      endTime: 220,
      submittedAt: 220,
    });

    const serialized = sessionStorage.getItem("pureon_submitted_assessment_snapshot_v1");
    expect(serialized).toBeTypeOf("string");
    expect(localStorage.getItem("pureon_submitted_assessment_snapshot_persisted_v1")).toBe(serialized);

    sessionStorage.removeItem("pureon_submitted_assessment_snapshot_v1");
    vi.resetModules();

    const reloadedModule = await import("./submittedAssessmentSnapshot");
    expect(reloadedModule.readSubmittedAssessmentSnapshot()).toMatchObject({
      studentInfo: {
        name: "Alice",
        grade: "Grade 6",
      },
      answers: { "reading:1": "A" },
    });
    expect(sessionStorage.getItem("pureon_submitted_assessment_snapshot_v1")).toBeTypeOf("string");

    reloadedModule.clearSubmittedAssessmentSnapshot();
    expect(sessionStorage.getItem("pureon_submitted_assessment_snapshot_v1")).toBeNull();
    expect(localStorage.getItem("pureon_submitted_assessment_snapshot_persisted_v1")).toBeNull();
  });
});
