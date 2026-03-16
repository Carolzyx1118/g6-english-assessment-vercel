process.env.JWT_SECRET = "test-local-auth-secret";

import fs from "fs/promises";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { TrpcContext } from "./_core/context";
import { localAuthRouter } from "./localAuthRouter";

const TEST_STORE_PATH = path.resolve(import.meta.dirname, "..", "tmp", "local-auth-users.test.json");

function createPublicContext(authHeader?: string): { ctx: TrpcContext } {
  const ctx: TrpcContext = {
    user: null,
    req: {
      protocol: "https",
      headers: authHeader ? { authorization: authHeader } : {},
    } as TrpcContext["req"],
    res: {
      cookie: () => undefined,
      clearCookie: () => undefined,
    } as unknown as TrpcContext["res"],
  };

  return { ctx };
}

describe("localAuth file fallback", () => {
  beforeEach(async () => {
    process.env.DATABASE_URL = "";
    process.env.LOCAL_AUTH_USERS_FILE = TEST_STORE_PATH;
    process.env.INVITE_CODE =
      "ENGVOC2026=english+vocabulary,MATH2026=math,TEACHER2026=english+math+vocabulary";
    await fs.rm(TEST_STORE_PATH, { force: true });
  });

  afterEach(async () => {
    await fs.rm(TEST_STORE_PATH, { force: true });
    delete process.env.LOCAL_AUTH_USERS_FILE;
  });

  it("registers and logs in without a database", async () => {
    const { ctx } = createPublicContext();
    const caller = localAuthRouter.createCaller(ctx);

    const registerResult = await caller.register({
      username: "fileuser",
      password: "password123",
      inviteCode: "ENGVOC2026",
    });

    expect(registerResult.success).toBe(true);
    expect(registerResult.user.allowedSubjects).toEqual(["english", "vocabulary"]);

    const fileContents = JSON.parse(await fs.readFile(TEST_STORE_PATH, "utf8"));
    expect(fileContents.users).toHaveLength(1);
    expect(fileContents.users[0].username).toBe("fileuser");

    const loginResult = await caller.login({
      username: "fileuser",
      password: "password123",
    });

    expect(loginResult.success).toBe(true);
    expect(loginResult.user.username).toBe("fileuser");
    expect(loginResult.user.allowedSubjects).toEqual(["english", "vocabulary"]);
  });

  it("resolves the current user from the file-backed session token", async () => {
    const { ctx } = createPublicContext();
    const caller = localAuthRouter.createCaller(ctx);

    const registerResult = await caller.register({
      username: "sessionuser",
      password: "password123",
      inviteCode: "TEACHER2026",
    });

    const { ctx: meCtx } = createPublicContext(`Bearer ${registerResult.token}`);
    const meCaller = localAuthRouter.createCaller(meCtx);
    const meResult = await meCaller.me();

    expect(meResult).not.toBeNull();
    expect(meResult?.username).toBe("sessionuser");
    expect(meResult?.allowedSubjects).toEqual(["english", "math", "vocabulary"]);
  });
});
