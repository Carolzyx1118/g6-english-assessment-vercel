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

type CookieCall = {
  name: string;
  value?: string;
  options: Record<string, unknown>;
};

function createPublicContext(): {
  ctx: TrpcContext;
  setCookies: CookieCall[];
  clearedCookies: CookieCall[];
} {
  const setCookies: CookieCall[] = [];
  const clearedCookies: CookieCall[] = [];

  const ctx: TrpcContext = {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      cookie: (name: string, value: string, options: Record<string, unknown>) => {
        setCookies.push({ name, value, options });
      },
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as unknown as TrpcContext["res"],
  };

  return { ctx, setCookies, clearedCookies };
}

describe("localAuth.register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set the INVITE_CODE env var for tests
    process.env.INVITE_CODE = "TESTCODE123";
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
      inviteCode: "TESTCODE123",
      displayName: "testuser",
      role: "user",
      createdAt: new Date(),
      lastLoginAt: new Date(),
    });

    await expect(
      caller.localAuth.register({
        username: "testuser",
        password: "password123",
        inviteCode: "TESTCODE123",
      })
    ).rejects.toThrow("该用户名已被注册");
  });

  it("successfully registers a new user with valid invite code", async () => {
    const { ctx, setCookies } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    // Mock: username does not exist
    vi.mocked(db.getLocalUserByUsername).mockResolvedValueOnce(undefined);
    // Mock: user creation succeeds
    vi.mocked(db.createLocalUser).mockResolvedValueOnce(42);

    const result = await caller.localAuth.register({
      username: "newuser",
      password: "password123",
      inviteCode: "TESTCODE123",
    });

    expect(result.success).toBe(true);
    expect(result.user.id).toBe(42);
    expect(result.user.username).toBe("newuser");

    // Should set a session cookie
    expect(setCookies).toHaveLength(1);
    expect(setCookies[0]?.name).toBe("local_session");
    expect(setCookies[0]?.value).toBeTruthy();

    // Should have called createLocalUser with hashed password
    expect(db.createLocalUser).toHaveBeenCalledOnce();
    const createCall = vi.mocked(db.createLocalUser).mock.calls[0][0];
    expect(createCall.username).toBe("newuser");
    expect(createCall.passwordHash).toBeTruthy();
    expect(createCall.passwordHash).not.toBe("password123"); // should be hashed
    expect(createCall.inviteCode).toBe("TESTCODE123");
  });

  it("invite code is case-insensitive", async () => {
    const { ctx, setCookies } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    vi.mocked(db.getLocalUserByUsername).mockResolvedValueOnce(undefined);
    vi.mocked(db.createLocalUser).mockResolvedValueOnce(43);

    const result = await caller.localAuth.register({
      username: "newuser2",
      password: "password123",
      inviteCode: "testcode123", // lowercase
    });

    expect(result.success).toBe(true);
  });

  it("rejects username shorter than 3 characters", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.localAuth.register({
        username: "ab",
        password: "password123",
        inviteCode: "TESTCODE123",
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
        inviteCode: "TESTCODE123",
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
      inviteCode: "TESTCODE123",
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

  it("successfully logs in with correct credentials", async () => {
    const { ctx, setCookies } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const bcrypt = await import("bcryptjs");
    const hash = await bcrypt.hash("mypassword", 10);

    vi.mocked(db.getLocalUserByUsername).mockResolvedValueOnce({
      id: 5,
      username: "testuser",
      passwordHash: hash,
      inviteCode: "TESTCODE123",
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

    // Should set a session cookie
    expect(setCookies).toHaveLength(1);
    expect(setCookies[0]?.name).toBe("local_session");

    // Should update last login
    expect(db.updateLocalUserLastLogin).toHaveBeenCalledWith(5);
  });
});

describe("localAuth.me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when no session cookie", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.localAuth.me();
    expect(result).toBeNull();
  });
});

describe("localAuth.logout", () => {
  it("clears the local session cookie", async () => {
    const { ctx, clearedCookies } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.localAuth.logout();

    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe("local_session");
    expect(clearedCookies[0]?.options).toMatchObject({
      maxAge: -1,
      secure: true,
      sameSite: "none",
      httpOnly: true,
      path: "/",
    });
  });
});
