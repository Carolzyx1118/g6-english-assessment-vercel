process.env.JWT_SECRET = "test-local-auth-secret";

import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the db module
vi.mock("./db", async (importOriginal) => {
  const original = await importOriginal<typeof import("./db")>();
  return {
    ...original,
    getLocalUserByUsername: vi.fn(),
    getLocalUserById: vi.fn(),
    createLocalUser: vi.fn(),
    updateLocalUserLastLogin: vi.fn(),
    // Keep original implementations for other functions
    getUserByOpenId: vi.fn().mockResolvedValue(undefined),
    upsertUser: vi.fn(),
  };
});

import * as db from "./db";

function createPublicContext(authHeader?: string): {
  ctx: TrpcContext;
} {
  const ctx: TrpcContext = {
    user: null,
    req: {
      protocol: "https",
      headers: authHeader ? { authorization: authHeader } : {},
    } as TrpcContext["req"],
    res: {
      cookie: vi.fn(),
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };

  return { ctx };
}

describe("localAuth.register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.INVITE_CODE =
      "ENGVOC2026=english+vocabulary,MATH2026=math,TEACHER2026=english+math+vocabulary";
  });

  it("rejects registration with invalid invite code", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.localAuth.register({
        username: "testuser",
        password: "password123",
        inviteCode: "WRONGCODE",
      })
    ).rejects.toThrow("邀请码无效");
  });

  it("rejects registration with duplicate username", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    // Mock: username already exists
    vi.mocked(db.getLocalUserByUsername).mockResolvedValueOnce({
      id: 1,
      username: "testuser",
      passwordHash: "hash",
      inviteCode: "ENGVOC2026::english|vocabulary",
      displayName: "testuser",
      role: "user",
      createdAt: new Date(),
      lastLoginAt: new Date(),
    });

    await expect(
      caller.localAuth.register({
        username: "testuser",
        password: "password123",
        inviteCode: "ENGVOC2026",
      })
    ).rejects.toThrow("该用户名已被注册");
  });

  it("successfully registers a new user with valid invite code and returns token", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    // Mock: username does not exist
    vi.mocked(db.getLocalUserByUsername).mockResolvedValueOnce(undefined);
    // Mock: user creation succeeds
    vi.mocked(db.createLocalUser).mockResolvedValueOnce(42);

    const result = await caller.localAuth.register({
      username: "newuser",
      password: "password123",
      inviteCode: "ENGVOC2026",
    });

    expect(result.success).toBe(true);
    expect(result.user.id).toBe(42);
    expect(result.user.username).toBe("newuser");
    expect(result.user.allowedSubjects).toEqual(["english", "vocabulary"]);
    // Token should be returned in the response body
    expect(result.token).toBeTruthy();
    expect(typeof result.token).toBe("string");
    expect(result.token.split(".")).toHaveLength(3); // JWT has 3 parts

    // Should have called createLocalUser with hashed password
    expect(db.createLocalUser).toHaveBeenCalledOnce();
    const createCall = vi.mocked(db.createLocalUser).mock.calls[0][0];
    expect(createCall.username).toBe("newuser");
    expect(createCall.passwordHash).toBeTruthy();
    expect(createCall.passwordHash).not.toBe("password123"); // should be hashed
    expect(createCall.inviteCode).toBe("ENGVOC2026::english|vocabulary");
  });

  it("invite code is case-insensitive", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    vi.mocked(db.getLocalUserByUsername).mockResolvedValueOnce(undefined);
    vi.mocked(db.createLocalUser).mockResolvedValueOnce(43);

    const result = await caller.localAuth.register({
      username: "newuser2",
      password: "password123",
      inviteCode: "engvoc2026",
    });

    expect(result.success).toBe(true);
    expect(result.token).toBeTruthy();
    expect(result.user.allowedSubjects).toEqual(["english", "vocabulary"]);
  });

  it("supports a math-only invite code", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    vi.mocked(db.getLocalUserByUsername).mockResolvedValueOnce(undefined);
    vi.mocked(db.createLocalUser).mockResolvedValueOnce(44);

    const result = await caller.localAuth.register({
      username: "mathuser",
      password: "password123",
      inviteCode: "MATH2026",
    });

    expect(result.success).toBe(true);
    expect(result.user.allowedSubjects).toEqual(["math"]);
  });

  it("supports a teacher invite code with full subject access", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    vi.mocked(db.getLocalUserByUsername).mockResolvedValueOnce(undefined);
    vi.mocked(db.createLocalUser).mockResolvedValueOnce(45);

    const result = await caller.localAuth.register({
      username: "teacheruser",
      password: "password123",
      inviteCode: "TEACHER2026",
    });

    expect(result.success).toBe(true);
    expect(result.user.allowedSubjects).toEqual(["english", "math", "vocabulary"]);
  });

  it("rejects username shorter than 3 characters", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.localAuth.register({
        username: "ab",
        password: "password123",
        inviteCode: "ENGVOC2026",
      })
    ).rejects.toThrow();
  });

  it("rejects password shorter than 6 characters", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.localAuth.register({
        username: "testuser",
        password: "12345",
        inviteCode: "ENGVOC2026",
      })
    ).rejects.toThrow();
  });
});

describe("localAuth.login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects login with non-existent username", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    vi.mocked(db.getLocalUserByUsername).mockResolvedValueOnce(undefined);

    await expect(
      caller.localAuth.login({
        username: "nonexistent",
        password: "password123",
      })
    ).rejects.toThrow("用户名或密码错误");
  });

  it("rejects login with wrong password", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    // bcrypt hash of "correctpassword"
    const bcrypt = await import("bcryptjs");
    const hash = await bcrypt.hash("correctpassword", 10);

    vi.mocked(db.getLocalUserByUsername).mockResolvedValueOnce({
      id: 1,
      username: "testuser",
      passwordHash: hash,
      inviteCode: "ENGVOC2026::english|vocabulary",
      displayName: "testuser",
      role: "user",
      createdAt: new Date(),
      lastLoginAt: new Date(),
    });

    await expect(
      caller.localAuth.login({
        username: "testuser",
        password: "wrongpassword",
      })
    ).rejects.toThrow("用户名或密码错误");
  });

  it("successfully logs in with correct credentials and returns token", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const bcrypt = await import("bcryptjs");
    const hash = await bcrypt.hash("mypassword", 10);

    vi.mocked(db.getLocalUserByUsername).mockResolvedValueOnce({
      id: 5,
      username: "testuser",
      passwordHash: hash,
      inviteCode: "ENGVOC2026::english|vocabulary",
      displayName: "Test User",
      role: "user",
      createdAt: new Date(),
      lastLoginAt: new Date(),
    });

    const result = await caller.localAuth.login({
      username: "testuser",
      password: "mypassword",
    });

    expect(result.success).toBe(true);
    expect(result.user.id).toBe(5);
    expect(result.user.username).toBe("testuser");
    expect(result.user.displayName).toBe("Test User");
    expect(result.user.allowedSubjects).toEqual(["english", "vocabulary"]);
    // Token should be returned in the response body
    expect(result.token).toBeTruthy();
    expect(typeof result.token).toBe("string");
    expect(result.token.split(".")).toHaveLength(3); // JWT has 3 parts

    // Should update last login
    expect(db.updateLocalUserLastLogin).toHaveBeenCalledWith(5);
  });
});

describe("localAuth.me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when no authorization header", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.localAuth.me();
    expect(result).toBeNull();
  });

  it("returns null with invalid token", async () => {
    const { ctx } = createPublicContext("Bearer invalid-token");
    const caller = appRouter.createCaller(ctx);

    const result = await caller.localAuth.me();
    expect(result).toBeNull();
  });

  it("returns user data with valid token from login", async () => {
    // First, login to get a valid token
    const { ctx: loginCtx } = createPublicContext();
    const loginCaller = appRouter.createCaller(loginCtx);

    const bcrypt = await import("bcryptjs");
    const hash = await bcrypt.hash("mypassword", 10);

    vi.mocked(db.getLocalUserByUsername).mockResolvedValueOnce({
      id: 10,
      username: "tokenuser",
      passwordHash: hash,
      inviteCode: "ENGVOC2026::english|vocabulary",
      displayName: "Token User",
      role: "user",
      createdAt: new Date(),
      lastLoginAt: new Date(),
    });

    const loginResult = await loginCaller.localAuth.login({
      username: "tokenuser",
      password: "mypassword",
    });

    // Now use the token to call me
    const { ctx: meCtx } = createPublicContext(`Bearer ${loginResult.token}`);
    const meCaller = appRouter.createCaller(meCtx);

    vi.mocked(db.getLocalUserById).mockResolvedValueOnce({
      id: 10,
      username: "tokenuser",
      passwordHash: hash,
      inviteCode: "ENGVOC2026::english|vocabulary",
      displayName: "Token User",
      role: "user",
      createdAt: new Date(),
      lastLoginAt: new Date(),
    });

    const meResult = await meCaller.localAuth.me();
    expect(meResult).not.toBeNull();
    expect(meResult?.id).toBe(10);
    expect(meResult?.username).toBe("tokenuser");
    expect(meResult?.displayName).toBe("Token User");
    expect(meResult?.allowedSubjects).toEqual(["english", "vocabulary"]);
  });
});

describe("localAuth.logout", () => {
  it("returns success (client clears localStorage)", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.localAuth.logout();
    expect(result).toEqual({ success: true });
  });
});
