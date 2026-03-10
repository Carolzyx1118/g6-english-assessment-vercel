import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";
import { ENV } from "./_core/env";
import { publicProcedure, router } from "./_core/trpc";
import {
  getLocalUserByUsername,
  getLocalUserById,
  createLocalUser,
  updateLocalUserLastLogin,
} from "./db";

const SALT_ROUNDS = 10;
const PAPER_SUBJECTS = ["english", "math", "vocabulary"] as const;
type PaperSubject = (typeof PAPER_SUBJECTS)[number];
type InviteAccess = {
  code: string;
  allowedSubjects: PaperSubject[];
};

// The invite code is read from env. Fallback to a default for development.
function normalizeInviteCode(code: string): string {
  return code.trim().toUpperCase();
}

function isPaperSubject(value: string): value is PaperSubject {
  return PAPER_SUBJECTS.includes(value as PaperSubject);
}

function parseSubjectList(raw: string): PaperSubject[] {
  const subjects = raw
    .split(/[|+]/)
    .map((subject) => subject.trim().toLowerCase())
    .filter(Boolean)
    .filter(isPaperSubject);

  return Array.from(new Set(subjects));
}

function serializeInviteAccess(access: InviteAccess): string {
  return `${access.code}::${access.allowedSubjects.join("|")}`;
}

function parseStoredInviteAccess(inviteCode: string): InviteAccess | null {
  const [rawCode, rawSubjects] = inviteCode.split("::");
  const code = normalizeInviteCode(rawCode || "");
  if (!code) return null;

  if (!rawSubjects) {
    return null;
  }

  const allowedSubjects = parseSubjectList(rawSubjects);
  if (allowedSubjects.length === 0) {
    return null;
  }

  return { code, allowedSubjects };
}

function getInviteAccessList(): InviteAccess[] {
  const raw = process.env.INVITE_CODE || "PUREONE2025";
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .flatMap((entry) => {
      const [rawCode, rawSubjects] = entry.split("=");
      const code = normalizeInviteCode(rawCode || "");
      if (!code) return [];

      if (!rawSubjects) {
        return [{ code, allowedSubjects: [...PAPER_SUBJECTS] }];
      }

      const allowedSubjects = parseSubjectList(rawSubjects);
      if (allowedSubjects.length === 0) {
        console.warn(`[localAuth] Ignoring invite code "${code}" because no valid subjects were configured.`);
        return [];
      }

      return [{ code, allowedSubjects }];
    });
}

function resolveInviteAccess(inviteCode: string): InviteAccess | null {
  const storedAccess = parseStoredInviteAccess(inviteCode);
  if (storedAccess) {
    return storedAccess;
  }

  const normalizedCode = normalizeInviteCode(inviteCode);
  return getInviteAccessList().find((access) => access.code === normalizedCode) ?? null;
}

function getUserAllowedSubjects(inviteCode: string): PaperSubject[] {
  return resolveInviteAccess(inviteCode)?.allowedSubjects ?? [...PAPER_SUBJECTS];
}

function getJwtSecret() {
  const secret = ENV.cookieSecret || "local-auth-dev-secret";
  return new TextEncoder().encode(secret);
}

async function createLocalSessionToken(userId: number, username: string): Promise<string> {
  const secret = getJwtSecret();
  const expiresInMs = 1000 * 60 * 60 * 24 * 30; // 30 days
  const expirationSeconds = Math.floor((Date.now() + expiresInMs) / 1000);

  return new SignJWT({
    sub: String(userId),
    username,
    type: "local",
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(expirationSeconds)
    .sign(secret);
}

async function verifyLocalSession(
  token: string | undefined | null
): Promise<{ userId: number; username: string } | null> {
  if (!token) return null;

  try {
    const secret = getJwtSecret();
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
    });

    const sub = payload.sub;
    const username = payload.username as string;
    const type = payload.type as string;

    if (!sub || !username || type !== "local") return null;

    return { userId: parseInt(sub, 10), username };
  } catch {
    return null;
  }
}

/**
 * Extract the local auth token from the request.
 * Checks Authorization header first (Bearer token), then falls back to cookie.
 */
function getLocalToken(req: any): string | undefined {
  // Check Authorization header first: "Bearer <token>"
  const authHeader = req.headers?.authorization;
  if (authHeader && typeof authHeader === "string") {
    const parts = authHeader.split(" ");
    if (parts.length === 2 && parts[0].toLowerCase() === "bearer") {
      return parts[1];
    }
  }

  // Fallback: check for cookie (for backwards compatibility)
  const cookieHeader = req.headers?.cookie;
  if (cookieHeader) {
    const cookies = cookieHeader.split(";").reduce((acc: Record<string, string>, c: string) => {
      const [key, ...rest] = c.split("=");
      acc[key.trim()] = rest.join("=").trim();
      return acc;
    }, {} as Record<string, string>);
    return cookies["local_session"];
  }

  return undefined;
}

export const localAuthRouter = router({
  /** Register a new local user with invite code */
  register: publicProcedure
    .input(
      z.object({
        username: z
          .string()
          .min(3, "用户名至少3个字符")
          .max(50, "用户名最多50个字符")
          .regex(/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/, "用户名只能包含字母、数字、下划线和中文"),
        password: z
          .string()
          .min(6, "密码至少6个字符")
          .max(100, "密码最多100个字符"),
        inviteCode: z.string().min(1, "请输入邀请码"),
      })
    )
    .mutation(async ({ input }) => {
      // Validate invite code
      const inviteAccess = resolveInviteAccess(input.inviteCode);
      if (!inviteAccess) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "邀请码无效，请联系管理员获取正确的邀请码",
        });
      }

      // Check if username already exists
      const existing = await getLocalUserByUsername(input.username);
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "该用户名已被注册，请选择其他用户名",
        });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

      // Create user
      const userId = await createLocalUser({
        username: input.username,
        passwordHash,
        inviteCode: serializeInviteAccess(inviteAccess),
        displayName: input.username,
      });

      if (!userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "注册失败，请稍后重试",
        });
      }

      // Create session token and return it in the response body
      const token = await createLocalSessionToken(userId, input.username);

      return {
        success: true,
        token,
        user: {
          id: userId,
          username: input.username,
          displayName: input.username,
          role: "user",
          allowedSubjects: inviteAccess.allowedSubjects,
        },
      };
    }),

  /** Login with username and password */
  login: publicProcedure
    .input(
      z.object({
        username: z.string().min(1, "请输入用户名"),
        password: z.string().min(1, "请输入密码"),
      })
    )
    .mutation(async ({ input }) => {
      const user = await getLocalUserByUsername(input.username);
      if (!user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "用户名或密码错误",
        });
      }

      const isValid = await bcrypt.compare(input.password, user.passwordHash);
      if (!isValid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "用户名或密码错误",
        });
      }

      // Update last login time
      await updateLocalUserLastLogin(user.id);

      // Create session token and return it in the response body
      const token = await createLocalSessionToken(user.id, user.username);

      return {
        success: true,
        token,
        user: {
          id: user.id,
          username: user.username,
          displayName: user.displayName || user.username,
          role: user.role,
          allowedSubjects: getUserAllowedSubjects(user.inviteCode),
        },
      };
    }),

  /** Get current local user session - reads token from Authorization header */
  me: publicProcedure.query(async ({ ctx }) => {
    const token = getLocalToken(ctx.req);
    const session = await verifyLocalSession(token);

    if (!session) {
      return null;
    }

    const user = await getLocalUserById(session.userId);
    if (!user) {
      return null;
    }

    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName || user.username,
      role: user.role,
      allowedSubjects: getUserAllowedSubjects(user.inviteCode),
    };
  }),

  /** Logout local user - client should clear localStorage token */
  logout: publicProcedure.mutation(() => {
    // Token-based auth: client clears localStorage, nothing to do server-side
    return { success: true };
  }),
});
