import fs from "fs/promises";
import path from "path";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, testResults, localUsers, type InsertTestResult, type TestResult, type LocalUser, type InsertLocalUser } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;
let hasLoggedLocalAuthFileFallback = false;

function getLocalAuthUsersFilePath() {
  return process.env.LOCAL_AUTH_USERS_FILE || path.resolve(import.meta.dirname, "..", "tmp", "local-users.json");
}

function logLocalAuthFileFallback() {
  if (hasLoggedLocalAuthFileFallback) return;
  hasLoggedLocalAuthFileFallback = true;
  console.warn(`[LocalAuth] DATABASE_URL not configured. Falling back to file storage at ${getLocalAuthUsersFilePath()}`);
}

function normalizeLocalUserRecord(raw: any): LocalUser {
  return {
    id: Number(raw.id),
    username: String(raw.username),
    passwordHash: String(raw.passwordHash),
    inviteCode: String(raw.inviteCode),
    displayName: typeof raw.displayName === "string" ? raw.displayName : null,
    role: raw.role === "admin" ? "admin" : "user",
    createdAt: raw.createdAt ? new Date(raw.createdAt) : new Date(),
    lastLoginAt: raw.lastLoginAt ? new Date(raw.lastLoginAt) : new Date(),
  };
}

async function readLocalAuthUsersFile(): Promise<{ lastId: number; users: LocalUser[] }> {
  const filePath = getLocalAuthUsersFilePath();

  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as { lastId?: number; users?: unknown[] };
    const users = Array.isArray(parsed.users) ? parsed.users.map(normalizeLocalUserRecord) : [];
    const maxId = users.reduce((currentMax, user) => Math.max(currentMax, user.id), 0);
    return {
      lastId: Math.max(Number(parsed.lastId) || 0, maxId),
      users,
    };
  } catch (error: any) {
    if (error?.code === "ENOENT") {
      return { lastId: 0, users: [] };
    }
    throw error;
  }
}

async function writeLocalAuthUsersFile(data: { lastId: number; users: LocalUser[] }): Promise<void> {
  const filePath = getLocalAuthUsersFilePath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(
    filePath,
    JSON.stringify({
      lastId: data.lastId,
      users: data.users.map((user) => ({
        ...user,
        createdAt: user.createdAt.toISOString(),
        lastLoginAt: user.lastLoginAt.toISOString(),
      })),
    }, null, 2),
    "utf8",
  );
}

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ── Test Results ──

export async function saveTestResult(data: InsertTestResult): Promise<number | null> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot save test result: database not available");
    return null;
  }
  const [result] = await db.insert(testResults).values(data).$returningId();
  return result?.id ?? null;
}

export async function getAllTestResults(): Promise<TestResult[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(testResults).orderBy(testResults.createdAt);
}

export async function getTestResultById(id: number): Promise<TestResult | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(testResults).where(eq(testResults.id, id)).limit(1);
  return rows[0];
}

export async function updateTestResultAI(id: number, updates: {
  readingResultsJson?: string;
  writingResultJson?: string;
  explanationsJson?: string;
  reportJson?: string;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(testResults).set(updates).where(eq(testResults.id, id));
}

export async function deleteTestResult(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(testResults).where(eq(testResults.id, id));
}

// ── Local Auth Users ──

export async function getLocalUserByUsername(username: string): Promise<LocalUser | undefined> {
  const db = await getDb();
  if (!db) {
    logLocalAuthFileFallback();
    const data = await readLocalAuthUsersFile();
    return data.users.find((user) => user.username === username);
  }
  const rows = await db.select().from(localUsers).where(eq(localUsers.username, username)).limit(1);
  return rows[0];
}

export async function getLocalUserById(id: number): Promise<LocalUser | undefined> {
  const db = await getDb();
  if (!db) {
    logLocalAuthFileFallback();
    const data = await readLocalAuthUsersFile();
    return data.users.find((user) => user.id === id);
  }
  const rows = await db.select().from(localUsers).where(eq(localUsers.id, id)).limit(1);
  return rows[0];
}

export async function createLocalUser(data: InsertLocalUser): Promise<number | null> {
  const db = await getDb();
  if (!db) {
    logLocalAuthFileFallback();
    const current = await readLocalAuthUsersFile();
    const nextId = current.lastId + 1;
    const now = new Date();
    current.lastId = nextId;
    current.users.push({
      id: nextId,
      username: data.username,
      passwordHash: data.passwordHash,
      inviteCode: data.inviteCode,
      displayName: data.displayName ?? data.username,
      role: data.role ?? "user",
      createdAt: now,
      lastLoginAt: now,
    });
    await writeLocalAuthUsersFile(current);
    return nextId;
  }
  const [result] = await db.insert(localUsers).values(data).$returningId();
  return result?.id ?? null;
}

export async function updateLocalUserLastLogin(id: number): Promise<void> {
  const db = await getDb();
  if (!db) {
    logLocalAuthFileFallback();
    const current = await readLocalAuthUsersFile();
    const user = current.users.find((item) => item.id === id);
    if (!user) return;
    user.lastLoginAt = new Date();
    await writeLocalAuthUsersFile(current);
    return;
  }
  await db.update(localUsers).set({ lastLoginAt: new Date() }).where(eq(localUsers.id, id));
}
