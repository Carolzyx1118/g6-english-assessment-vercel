import fs from "fs/promises";
import path from "path";
import { eq, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { InsertUser, users, testResults, localUsers, manualPapers, type InsertTestResult, type TestResult, type LocalUser, type InsertLocalUser, type ManualPaper, type InsertManualPaper } from "../drizzle/schema";
import { ENV } from './_core/env';
import { getWritableDataPath, isVercelRuntime } from "./_core/runtime";

let _db: ReturnType<typeof drizzle> | null = null;
let hasLoggedLocalAuthFileFallback = false;
let hasLoggedManualPaperFileFallback = false;
let hasLoggedTestResultsFileFallback = false;
let hasLoggedEphemeralPersistenceWarning = false;

function getLocalAuthUsersFilePath() {
  return process.env.LOCAL_AUTH_USERS_FILE || getWritableDataPath("local-users.json");
}

function getLocalManualPapersFilePath() {
  return process.env.LOCAL_MANUAL_PAPERS_FILE || getWritableDataPath("manual-papers.json");
}

function getLocalTestResultsFilePath() {
  return process.env.LOCAL_TEST_RESULTS_FILE || getWritableDataPath("test-results.json");
}

function logEphemeralPersistenceWarning() {
  if (hasLoggedEphemeralPersistenceWarning || !isVercelRuntime()) return;
  hasLoggedEphemeralPersistenceWarning = true;
  console.warn(
    "[Database] DATABASE_URL is not configured on Vercel. File-backed data uses /tmp and is not durable across deployments or cold starts."
  );
}

function logLocalAuthFileFallback() {
  if (hasLoggedLocalAuthFileFallback) return;
  hasLoggedLocalAuthFileFallback = true;
  logEphemeralPersistenceWarning();
  console.warn(`[LocalAuth] DATABASE_URL not configured. Falling back to file storage at ${getLocalAuthUsersFilePath()}`);
}

function logManualPaperFileFallback() {
  if (hasLoggedManualPaperFileFallback) return;
  hasLoggedManualPaperFileFallback = true;
  logEphemeralPersistenceWarning();
  console.warn(`[ManualPapers] DATABASE_URL not configured. Falling back to file storage at ${getLocalManualPapersFilePath()}`);
}

function logTestResultsFileFallback() {
  if (hasLoggedTestResultsFileFallback) return;
  hasLoggedTestResultsFileFallback = true;
  logEphemeralPersistenceWarning();
  console.warn(`[TestResults] DATABASE_URL not configured. Falling back to file storage at ${getLocalTestResultsFilePath()}`);
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

function normalizeManualPaperRecord(raw: any): ManualPaper {
  return {
    id: Number(raw.id),
    paperId: String(raw.paperId),
    title: String(raw.title),
    description: typeof raw.description === "string" ? raw.description : null,
    subject: typeof raw.subject === "string" ? raw.subject : "english",
    category: typeof raw.category === "string" ? raw.category : "assessment",
    blueprintJson: String(raw.blueprintJson),
    published: Number(raw.published ?? 1),
    totalQuestions: Number(raw.totalQuestions ?? 0),
    hasListening: Number(raw.hasListening ?? 0),
    hasWriting: Number(raw.hasWriting ?? 0),
    createdAt: raw.createdAt ? new Date(raw.createdAt) : new Date(),
    updatedAt: raw.updatedAt ? new Date(raw.updatedAt) : new Date(),
  };
}

function normalizeTestResultRecord(raw: any): TestResult {
  return {
    id: Number(raw.id),
    studentName: String(raw.studentName),
    studentGrade: typeof raw.studentGrade === "string" ? raw.studentGrade : null,
    paperId: String(raw.paperId),
    paperTitle: String(raw.paperTitle),
    totalCorrect: Number(raw.totalCorrect ?? 0),
    totalQuestions: Number(raw.totalQuestions ?? 0),
    totalTimeSeconds:
      raw.totalTimeSeconds === null || raw.totalTimeSeconds === undefined
        ? null
        : Number(raw.totalTimeSeconds),
    answersJson: String(raw.answersJson ?? "{}"),
    scoreBySectionJson:
      typeof raw.scoreBySectionJson === "string" ? raw.scoreBySectionJson : null,
    sectionTimingsJson:
      typeof raw.sectionTimingsJson === "string" ? raw.sectionTimingsJson : null,
    readingResultsJson:
      typeof raw.readingResultsJson === "string" ? raw.readingResultsJson : null,
    writingResultJson:
      typeof raw.writingResultJson === "string" ? raw.writingResultJson : null,
    explanationsJson:
      typeof raw.explanationsJson === "string" ? raw.explanationsJson : null,
    reportJson: typeof raw.reportJson === "string" ? raw.reportJson : null,
    createdAt: raw.createdAt ? new Date(raw.createdAt) : new Date(),
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

async function readManualPapersFile(): Promise<{ lastId: number; papers: ManualPaper[] }> {
  const filePath = getLocalManualPapersFilePath();

  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as { lastId?: number; papers?: unknown[] };
    const papers = Array.isArray(parsed.papers) ? parsed.papers.map(normalizeManualPaperRecord) : [];
    const maxId = papers.reduce((currentMax, paper) => Math.max(currentMax, paper.id), 0);
    return {
      lastId: Math.max(Number(parsed.lastId) || 0, maxId),
      papers,
    };
  } catch (error: any) {
    if (error?.code === "ENOENT") {
      return { lastId: 0, papers: [] };
    }
    throw error;
  }
}

async function writeManualPapersFile(data: { lastId: number; papers: ManualPaper[] }): Promise<void> {
  const filePath = getLocalManualPapersFilePath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(
    filePath,
    JSON.stringify(
      {
        lastId: data.lastId,
        papers: data.papers.map((paper) => ({
          ...paper,
          createdAt: paper.createdAt.toISOString(),
          updatedAt: paper.updatedAt.toISOString(),
        })),
      },
      null,
      2,
    ),
    "utf8",
  );
}

async function readTestResultsFile(): Promise<{ lastId: number; results: TestResult[] }> {
  const filePath = getLocalTestResultsFilePath();

  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as { lastId?: number; results?: unknown[] };
    const results = Array.isArray(parsed.results)
      ? parsed.results.map(normalizeTestResultRecord)
      : [];
    const maxId = results.reduce(
      (currentMax, result) => Math.max(currentMax, result.id),
      0
    );
    return {
      lastId: Math.max(Number(parsed.lastId) || 0, maxId),
      results,
    };
  } catch (error: any) {
    if (error?.code === "ENOENT") {
      return { lastId: 0, results: [] };
    }
    throw error;
  }
}

async function writeTestResultsFile(data: {
  lastId: number;
  results: TestResult[];
}): Promise<void> {
  const filePath = getLocalTestResultsFilePath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(
    filePath,
    JSON.stringify(
      {
        lastId: data.lastId,
        results: data.results.map((result) => ({
          ...result,
          createdAt: result.createdAt.toISOString(),
        })),
      },
      null,
      2
    ),
    "utf8"
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

    updateSet.updatedAt = new Date();

    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.openId,
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
    logTestResultsFileFallback();
    const current = await readTestResultsFile();
    const nextId = current.lastId + 1;
    current.lastId = nextId;
    current.results.push({
      id: nextId,
      studentName: data.studentName,
      studentGrade: data.studentGrade ?? null,
      paperId: data.paperId,
      paperTitle: data.paperTitle,
      totalCorrect: data.totalCorrect,
      totalQuestions: data.totalQuestions,
      totalTimeSeconds: data.totalTimeSeconds ?? null,
      answersJson: data.answersJson,
      scoreBySectionJson: data.scoreBySectionJson ?? null,
      sectionTimingsJson: data.sectionTimingsJson ?? null,
      readingResultsJson: data.readingResultsJson ?? null,
      writingResultJson: data.writingResultJson ?? null,
      explanationsJson: data.explanationsJson ?? null,
      reportJson: data.reportJson ?? null,
      createdAt: data.createdAt ?? new Date(),
    });
    await writeTestResultsFile(current);
    return nextId;
  }
  const [result] = await db
    .insert(testResults)
    .values(data)
    .returning({ id: testResults.id });
  return result?.id ?? null;
}

export async function getAllTestResults(): Promise<TestResult[]> {
  const db = await getDb();
  if (!db) {
    logTestResultsFileFallback();
    const current = await readTestResultsFile();
    return [...current.results].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    );
  }
  return db.select().from(testResults).orderBy(testResults.createdAt);
}

export async function getTestResultById(id: number): Promise<TestResult | undefined> {
  const db = await getDb();
  if (!db) {
    logTestResultsFileFallback();
    const current = await readTestResultsFile();
    return current.results.find((result) => result.id === id);
  }
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
  if (!db) {
    logTestResultsFileFallback();
    const current = await readTestResultsFile();
    current.results = current.results.map((result) =>
      result.id === id
        ? {
            ...result,
            ...updates,
          }
        : result
    );
    await writeTestResultsFile(current);
    return;
  }
  await db.update(testResults).set(updates).where(eq(testResults.id, id));
}

export async function deleteTestResult(id: number): Promise<void> {
  const db = await getDb();
  if (!db) {
    logTestResultsFileFallback();
    const current = await readTestResultsFile();
    current.results = current.results.filter((result) => result.id !== id);
    await writeTestResultsFile(current);
    return;
  }
  await db.delete(testResults).where(eq(testResults.id, id));
}

// ── Manual Papers ──

export async function saveManualPaper(data: InsertManualPaper): Promise<number | null> {
  const db = await getDb();
  if (!db) {
    logManualPaperFileFallback();
    const current = await readManualPapersFile();
    const nextId = current.lastId + 1;
    const now = new Date();
    const record: ManualPaper = {
      id: nextId,
      paperId: data.paperId,
      title: data.title,
      description: data.description ?? null,
      subject: data.subject ?? "english",
      category: data.category ?? "assessment",
      blueprintJson: data.blueprintJson,
      published: data.published ?? 1,
      totalQuestions: data.totalQuestions ?? 0,
      hasListening: data.hasListening ?? 0,
      hasWriting: data.hasWriting ?? 0,
      createdAt: now,
      updatedAt: now,
    };
    current.lastId = nextId;
    current.papers.push(record);
    await writeManualPapersFile(current);
    return nextId;
  }
  const [result] = await db
    .insert(manualPapers)
    .values(data)
    .returning({ id: manualPapers.id });
  return result?.id ?? null;
}

export async function getAllManualPapers(): Promise<ManualPaper[]> {
  const db = await getDb();
  if (!db) {
    logManualPaperFileFallback();
    const data = await readManualPapersFile();
    return [...data.papers].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  return db.select().from(manualPapers).orderBy(desc(manualPapers.createdAt));
}

export async function getPublishedManualPapers(): Promise<ManualPaper[]> {
  const db = await getDb();
  if (!db) {
    logManualPaperFileFallback();
    const data = await readManualPapersFile();
    return data.papers
      .filter((paper) => paper.published === 1)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  return db.select().from(manualPapers).where(eq(manualPapers.published, 1)).orderBy(desc(manualPapers.createdAt));
}

export async function getManualPaperByPaperId(paperId: string): Promise<ManualPaper | undefined> {
  const db = await getDb();
  if (!db) {
    logManualPaperFileFallback();
    const data = await readManualPapersFile();
    return data.papers.find((paper) => paper.paperId === paperId);
  }
  const rows = await db.select().from(manualPapers).where(eq(manualPapers.paperId, paperId)).limit(1);
  return rows[0];
}

export async function getManualPaperById(id: number): Promise<ManualPaper | undefined> {
  const db = await getDb();
  if (!db) {
    logManualPaperFileFallback();
    const data = await readManualPapersFile();
    return data.papers.find((paper) => paper.id === id);
  }
  const rows = await db.select().from(manualPapers).where(eq(manualPapers.id, id)).limit(1);
  return rows[0];
}

export async function deleteManualPaper(id: number): Promise<void> {
  const db = await getDb();
  if (!db) {
    logManualPaperFileFallback();
    const data = await readManualPapersFile();
    data.papers = data.papers.filter((paper) => paper.id !== id);
    await writeManualPapersFile(data);
    return;
  }
  await db.delete(manualPapers).where(eq(manualPapers.id, id));
}

export async function updateManualPaper(id: number, data: Partial<InsertManualPaper>): Promise<void> {
  const db = await getDb();
  if (!db) {
    logManualPaperFileFallback();
    const current = await readManualPapersFile();
    current.papers = current.papers.map((paper) =>
      paper.id === id
        ? {
            ...paper,
            ...data,
            description: data.description ?? paper.description,
            subject: data.subject ?? paper.subject,
            category: data.category ?? paper.category,
            blueprintJson: data.blueprintJson ?? paper.blueprintJson,
            published: data.published ?? paper.published,
            totalQuestions: data.totalQuestions ?? paper.totalQuestions,
            hasListening: data.hasListening ?? paper.hasListening,
            hasWriting: data.hasWriting ?? paper.hasWriting,
            updatedAt: new Date(),
          }
        : paper,
    );
    await writeManualPapersFile(current);
    return;
  }
  await db
    .update(manualPapers)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(manualPapers.id, id));
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
  const [result] = await db
    .insert(localUsers)
    .values(data)
    .returning({ id: localUsers.id });
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
