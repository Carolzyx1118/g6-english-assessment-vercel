import { describe, expect, it } from "vitest";

describe("history password secret", () => {
  it("VITE_HISTORY_PASSWORD is set and non-empty", () => {
    const password = process.env.VITE_HISTORY_PASSWORD;
    expect(password).toBeDefined();
    expect(password!.length).toBeGreaterThan(0);
  });
});
