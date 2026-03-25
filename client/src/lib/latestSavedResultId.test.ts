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

describe("latestSavedResultId", () => {
  it("writes to both storages and can read from the local fallback", async () => {
    const { sessionStorage, localStorage } = installWindow();
    const idModule = await import("./latestSavedResultId");

    idModule.writeLatestSavedResultId(42);
    expect(sessionStorage.getItem("pureon_latest_assessment_result_id_v1")).toBe("42");
    expect(localStorage.getItem("pureon_latest_assessment_result_id_v1")).toBe("42");

    sessionStorage.removeItem("pureon_latest_assessment_result_id_v1");
    expect(idModule.readLatestSavedResultId()).toBe(42);
  });
});
