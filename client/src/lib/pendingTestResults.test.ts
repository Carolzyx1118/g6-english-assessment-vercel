import { afterEach, describe, expect, it, vi } from "vitest";
import {
  queuePendingTestResult,
  readPendingTestResults,
  removeMatchingPendingTestResults,
} from "./pendingTestResults";

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
  const localStorage = createStorage();

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage,
    },
  });

  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value: {
      randomUUID: () => "fixed-id",
    },
  });
}

afterEach(() => {
  vi.resetModules();
  Reflect.deleteProperty(globalThis, "window");
  Reflect.deleteProperty(globalThis, "crypto");
});

describe("pendingTestResults", () => {
  it("deduplicates identical payloads and can remove them by payload match", () => {
    installWindow();

    const payload = {
      studentName: "Alice",
      studentGrade: "G6",
      paperId: "tag-system-english-ket-unit-1",
      paperTitle: "KET Unit1 Practice",
      totalCorrect: 8,
      totalQuestions: 10,
      totalTimeSeconds: 120,
      answersJson: "{\"q1\":\"A\"}",
      scoreBySectionJson: "{\"reading\":{\"correct\":8,\"total\":10}}",
      sectionTimingsJson: "{\"reading\":120}",
    };

    const firstId = queuePendingTestResult(payload);
    const secondId = queuePendingTestResult(payload);

    expect(firstId).toBe("fixed-id");
    expect(secondId).toBe("fixed-id");
    expect(readPendingTestResults()).toHaveLength(1);

    removeMatchingPendingTestResults(payload);
    expect(readPendingTestResults()).toHaveLength(0);
  });
});
