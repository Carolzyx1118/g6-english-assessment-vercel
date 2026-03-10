import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, testResults, localUsers, type InsertTestResult, type TestResult, type LocalUser, type InsertLocalUser } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

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
  if (!db) return undefined;
  const rows = await db.select().from(localUsers).where(eq(localUsers.username, username)).limit(1);
  return rows[0];
}

export async function getLocalUserById(id: number): Promise<LocalUser | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(localUsers).where(eq(localUsers.id, id)).limit(1);
  return rows[0];
}

export async function createLocalUser(data: InsertLocalUser): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(localUsers).values(data).$returningId();
  return result?.id ?? null;
}

export async function updateLocalUserLastLogin(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(localUsers).set({ lastLoginAt: new Date() }).where(eq(localUsers.id, id));
}
