import fs from "fs/promises";
import path from "path";
import { eq, desc, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { InsertUser, users, testResults, localUsers, manualPapers, type InsertTestResult, type TestResult, type LocalUser, type InsertLocalUser, type ManualPaper, type InsertManualPaper } from "../drizzle/schema";
import {
  createDefaultSubjectTagSchemaStore,
  createDefaultEnglishTagSchemaStore,
  normalizeSubjectTagSystems,
  normalizeEnglishTagSystems,
  type ConfigurableTagSubject,
  type EnglishExamTagSystem,
  type EnglishExamTagSystemInput,
  type EnglishTagSchemaStore,
  type SubjectTagSchemaStore,
  type SubjectTagSystem,
} from "../shared/englishQuestionTags";
import { ENV } from './_core/env';
import { getWritableDataPath, isVercelRuntime } from "./_core/runtime";

type DbClient = ReturnType<typeof drizzle>;

let _db: DbClient | null = null;
let _dbSchemaReadyPromise: Promise<void> | null = null;
let hasLoggedLocalAuthFileFallback = false;
let hasLoggedManualPaperFileFallback = false;
let hasLoggedTestResultsFileFallback = false;
let hasLoggedEphemeralPersistenceWarning = false;
let hasForcedLocalAuthFileFallback = false;
let hasForcedManualPaperFileFallback = false;
let hasForcedTestResultsFileFallback = false;
const RESERVED_MANUAL_PAPER_PREFIX = "__system:";
const ENGLISH_TAG_SCHEMA_STORE_PAPER_ID = `${RESERVED_MANUAL_PAPER_PREFIX}english-tag-schemas`;
const ENGLISH_TAG_SCHEMA_STORE_TITLE = "__English Tag Schemas__";
const MATH_TAG_SCHEMA_STORE_PAPER_ID = `${RESERVED_MANUAL_PAPER_PREFIX}math-tag-schemas`;
const MATH_TAG_SCHEMA_STORE_TITLE = "__Math Tag Schemas__";
const VOCABULARY_TAG_SCHEMA_STORE_PAPER_ID = `${RESERVED_MANUAL_PAPER_PREFIX}vocabulary-tag-schemas`;
const VOCABULARY_TAG_SCHEMA_STORE_TITLE = "__Vocabulary Tag Schemas__";
const LOCAL_AUTH_DEFAULT_INVITE_CODE = "TEACHER2026::english|math|vocabulary::active";

function getLocalAuthUsersFilePath() {
  return process.env.LOCAL_AUTH_USERS_FILE || getWritableDataPath("local-users.json");
}

function getLocalManualPapersFilePath() {
  return process.env.LOCAL_MANUAL_PAPERS_FILE || getWritableDataPath("manual-papers.json");
}

function getLocalTestResultsFilePath() {
  return process.env.LOCAL_TEST_RESULTS_FILE || getWritableDataPath("test-results.json");
}

export function getPersistenceStatus() {
  const databaseConfigured = Boolean(ENV.databaseUrl);

  return {
    databaseConfigured,
    localAuthUsingFileFallback: !databaseConfigured || hasForcedLocalAuthFileFallback,
    manualPapersUsingFileFallback: !databaseConfigured || hasForcedManualPaperFileFallback,
    testResultsUsingFileFallback: !databaseConfigured || hasForcedTestResultsFileFallback,
    localAuthFilePath: getLocalAuthUsersFilePath(),
    localManualPapersFilePath: getLocalManualPapersFilePath(),
    localTestResultsFilePath: getLocalTestResultsFilePath(),
  };
}

function logEphemeralPersistenceWarning() {
  if (hasLoggedEphemeralPersistenceWarning || !isVercelRuntime()) return;
  hasLoggedEphemeralPersistenceWarning = true;
  console.warn(
    "[Database] DATABASE_URL is not configured on Vercel. File-backed data uses /tmp and is not durable across deployments or cold starts."
  );
}

function logLocalAuthFileFallback(reason?: unknown) {
  if (hasLoggedLocalAuthFileFallback) return;
  hasLoggedLocalAuthFileFallback = true;
  logEphemeralPersistenceWarning();
  if (reason) {
    console.warn(
      `[LocalAuth] Falling back to file storage at ${getLocalAuthUsersFilePath()} because database local user queries failed:`,
      reason,
    );
    return;
  }
  console.warn(`[LocalAuth] DATABASE_URL not configured. Falling back to file storage at ${getLocalAuthUsersFilePath()}`);
}

function logManualPaperFileFallback(reason?: unknown) {
  if (hasLoggedManualPaperFileFallback) return;
  hasLoggedManualPaperFileFallback = true;
  logEphemeralPersistenceWarning();
  if (reason) {
    console.warn(
      `[ManualPapers] Falling back to file storage at ${getLocalManualPapersFilePath()} because database paper queries failed:`,
      reason,
    );
    return;
  }
  console.warn(`[ManualPapers] DATABASE_URL not configured. Falling back to file storage at ${getLocalManualPapersFilePath()}`);
}

function logTestResultsFileFallback(reason?: unknown) {
  if (hasLoggedTestResultsFileFallback) return;
  hasLoggedTestResultsFileFallback = true;
  logEphemeralPersistenceWarning();
  if (reason) {
    console.warn(
      `[TestResults] Falling back to file storage at ${getLocalTestResultsFilePath()} because database test result queries failed:`,
      reason,
    );
    return;
  }
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

function isReservedManualPaperRecord(paper: Pick<ManualPaper, "paperId">) {
  return paper.paperId.startsWith(RESERVED_MANUAL_PAPER_PREFIX);
}

function filterVisibleManualPapers(papers: ManualPaper[]) {
  return papers.filter((paper) => !isReservedManualPaperRecord(paper));
}

function parseEnglishTagSchemaStore(raw: string | null | undefined): EnglishTagSchemaStore {
  if (!raw) {
    return createDefaultEnglishTagSchemaStore();
  }

  try {
    const parsed = JSON.parse(raw) as Partial<EnglishTagSchemaStore>;
    return {
      version: 1,
      subject: "english",
      systems: normalizeEnglishTagSystems(parsed.systems as EnglishExamTagSystem[] | undefined, {
        fallbackToDefaults: false,
      }),
    };
  } catch {
    return createDefaultEnglishTagSchemaStore();
  }
}

function parseSubjectTagSchemaStore(
  subject: Exclude<ConfigurableTagSubject, "english">,
  raw: string | null | undefined,
): SubjectTagSchemaStore {
  if (!raw) {
    return createDefaultSubjectTagSchemaStore(subject);
  }

  try {
    const parsed = JSON.parse(raw) as Partial<SubjectTagSchemaStore>;
    return {
      version: 1,
      subject,
      systems: normalizeSubjectTagSystems(subject, parsed.systems as SubjectTagSystem[] | undefined, {
        fallbackToDefaults: false,
      }),
    };
  } catch {
    return createDefaultSubjectTagSchemaStore(subject);
  }
}

function getTagSchemaStoreMeta(subject: ConfigurableTagSubject) {
  if (subject === "english") {
    return {
      paperId: ENGLISH_TAG_SCHEMA_STORE_PAPER_ID,
      title: ENGLISH_TAG_SCHEMA_STORE_TITLE,
      description: "Reserved system record for English tag schemas.",
    };
  }

  if (subject === "math") {
    return {
      paperId: MATH_TAG_SCHEMA_STORE_PAPER_ID,
      title: MATH_TAG_SCHEMA_STORE_TITLE,
      description: "Reserved system record for Math tag schemas.",
    };
  }

  return {
    paperId: VOCABULARY_TAG_SCHEMA_STORE_PAPER_ID,
    title: VOCABULARY_TAG_SCHEMA_STORE_TITLE,
    description: "Reserved system record for Vocabulary tag schemas.",
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

const RUNTIME_SCHEMA_REPAIR_STATEMENTS = [
  `DO $$ BEGIN
    CREATE TYPE "public"."local_role" AS ENUM('user', 'admin');
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END $$;`,
  `DO $$ BEGIN
    CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END $$;`,
  `CREATE TABLE IF NOT EXISTS "localUsers" (
    "id" serial PRIMARY KEY,
    "username" varchar(128) NOT NULL UNIQUE,
    "passwordHash" varchar(255) NOT NULL,
    "inviteCode" varchar(128) NOT NULL,
    "displayName" varchar(255),
    "role" "local_role" NOT NULL DEFAULT 'user',
    "createdAt" timestamp NOT NULL DEFAULT now(),
    "lastLoginAt" timestamp NOT NULL DEFAULT now()
  );`,
  `ALTER TABLE "localUsers" ADD COLUMN IF NOT EXISTS "inviteCode" varchar(128) NOT NULL DEFAULT '${LOCAL_AUTH_DEFAULT_INVITE_CODE}';`,
  `ALTER TABLE "localUsers" ADD COLUMN IF NOT EXISTS "displayName" varchar(255);`,
  `ALTER TABLE "localUsers" ADD COLUMN IF NOT EXISTS "role" "local_role" NOT NULL DEFAULT 'user';`,
  `ALTER TABLE "localUsers" ADD COLUMN IF NOT EXISTS "createdAt" timestamp NOT NULL DEFAULT now();`,
  `ALTER TABLE "localUsers" ADD COLUMN IF NOT EXISTS "lastLoginAt" timestamp NOT NULL DEFAULT now();`,
  `CREATE TABLE IF NOT EXISTS "manualPapers" (
    "id" serial PRIMARY KEY,
    "paperId" varchar(255) NOT NULL UNIQUE,
    "title" varchar(255) NOT NULL,
    "description" text,
    "subject" varchar(64) NOT NULL DEFAULT 'english',
    "category" varchar(64) NOT NULL DEFAULT 'assessment',
    "blueprintJson" text NOT NULL,
    "published" integer NOT NULL DEFAULT 1,
    "totalQuestions" integer NOT NULL DEFAULT 0,
    "hasListening" integer NOT NULL DEFAULT 0,
    "hasWriting" integer NOT NULL DEFAULT 0,
    "createdAt" timestamp NOT NULL DEFAULT now(),
    "updatedAt" timestamp NOT NULL DEFAULT now()
  );`,
  `ALTER TABLE "manualPapers" ADD COLUMN IF NOT EXISTS "subject" varchar(64) NOT NULL DEFAULT 'english';`,
  `ALTER TABLE "manualPapers" ADD COLUMN IF NOT EXISTS "category" varchar(64) NOT NULL DEFAULT 'assessment';`,
  `ALTER TABLE "manualPapers" ADD COLUMN IF NOT EXISTS "published" integer NOT NULL DEFAULT 1;`,
  `ALTER TABLE "manualPapers" ADD COLUMN IF NOT EXISTS "totalQuestions" integer NOT NULL DEFAULT 0;`,
  `ALTER TABLE "manualPapers" ADD COLUMN IF NOT EXISTS "hasListening" integer NOT NULL DEFAULT 0;`,
  `ALTER TABLE "manualPapers" ADD COLUMN IF NOT EXISTS "hasWriting" integer NOT NULL DEFAULT 0;`,
  `ALTER TABLE "manualPapers" ADD COLUMN IF NOT EXISTS "updatedAt" timestamp NOT NULL DEFAULT now();`,
  `CREATE TABLE IF NOT EXISTS "testResults" (
    "id" serial PRIMARY KEY,
    "studentName" varchar(255) NOT NULL,
    "studentGrade" varchar(64),
    "paperId" varchar(128) NOT NULL,
    "paperTitle" varchar(255) NOT NULL,
    "totalCorrect" integer NOT NULL,
    "totalQuestions" integer NOT NULL,
    "totalTimeSeconds" integer,
    "answersJson" text NOT NULL,
    "scoreBySectionJson" text,
    "sectionTimingsJson" text,
    "readingResultsJson" text,
    "writingResultJson" text,
    "explanationsJson" text,
    "reportJson" text,
    "createdAt" timestamp NOT NULL DEFAULT now()
  );`,
  `ALTER TABLE "testResults" ADD COLUMN IF NOT EXISTS "studentGrade" varchar(64);`,
  `ALTER TABLE "testResults" ADD COLUMN IF NOT EXISTS "totalTimeSeconds" integer;`,
  `ALTER TABLE "testResults" ADD COLUMN IF NOT EXISTS "scoreBySectionJson" text;`,
  `ALTER TABLE "testResults" ADD COLUMN IF NOT EXISTS "sectionTimingsJson" text;`,
  `ALTER TABLE "testResults" ADD COLUMN IF NOT EXISTS "readingResultsJson" text;`,
  `ALTER TABLE "testResults" ADD COLUMN IF NOT EXISTS "writingResultJson" text;`,
  `ALTER TABLE "testResults" ADD COLUMN IF NOT EXISTS "explanationsJson" text;`,
  `ALTER TABLE "testResults" ADD COLUMN IF NOT EXISTS "reportJson" text;`,
  `CREATE TABLE IF NOT EXISTS "users" (
    "id" serial PRIMARY KEY,
    "openId" varchar(64) NOT NULL UNIQUE,
    "name" text,
    "email" varchar(320),
    "loginMethod" varchar(64),
    "role" "user_role" NOT NULL DEFAULT 'user',
    "createdAt" timestamp NOT NULL DEFAULT now(),
    "updatedAt" timestamp NOT NULL DEFAULT now(),
    "lastSignedIn" timestamp NOT NULL DEFAULT now()
  );`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" "user_role" NOT NULL DEFAULT 'user';`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "updatedAt" timestamp NOT NULL DEFAULT now();`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lastSignedIn" timestamp NOT NULL DEFAULT now();`,
] as const;

async function ensureRuntimeDatabaseSchema(db: DbClient) {
  for (const statement of RUNTIME_SCHEMA_REPAIR_STATEMENTS) {
    await db.execute(sql.raw(statement));
  }
}

function activateLocalAuthFileFallback(reason: unknown) {
  hasForcedLocalAuthFileFallback = true;
  logLocalAuthFileFallback(reason);
}

function activateManualPaperFileFallback(reason: unknown) {
  hasForcedManualPaperFileFallback = true;
  logManualPaperFileFallback(reason);
}

function activateTestResultsFileFallback(reason: unknown) {
  hasForcedTestResultsFileFallback = true;
  logTestResultsFileFallback(reason);
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

  if (_db && !_dbSchemaReadyPromise) {
    _dbSchemaReadyPromise = ensureRuntimeDatabaseSchema(_db).catch((error) => {
      console.warn("[Database] Runtime schema repair failed:", error);
    });
  }

  if (_dbSchemaReadyPromise) {
    await _dbSchemaReadyPromise;
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
  if (!db || hasForcedTestResultsFileFallback) {
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
  if (!db || hasForcedTestResultsFileFallback) {
    logTestResultsFileFallback();
    const current = await readTestResultsFile();
    return [...current.results].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    );
  }
  try {
    return await db.select().from(testResults).orderBy(testResults.createdAt);
  } catch (error) {
    activateTestResultsFileFallback(error);
    return getAllTestResults();
  }
}

export async function getTestResultById(id: number): Promise<TestResult | undefined> {
  const db = await getDb();
  if (!db || hasForcedTestResultsFileFallback) {
    logTestResultsFileFallback();
    const current = await readTestResultsFile();
    return current.results.find((result) => result.id === id);
  }
  try {
    const rows = await db.select().from(testResults).where(eq(testResults.id, id)).limit(1);
    return rows[0];
  } catch (error) {
    activateTestResultsFileFallback(error);
    return getTestResultById(id);
  }
}

export async function updateTestResultAI(id: number, updates: {
  readingResultsJson?: string;
  writingResultJson?: string;
  explanationsJson?: string;
  reportJson?: string;
}): Promise<void> {
  const db = await getDb();
  if (!db || hasForcedTestResultsFileFallback) {
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
  try {
    await db.update(testResults).set(updates).where(eq(testResults.id, id));
  } catch (error) {
    activateTestResultsFileFallback(error);
    await updateTestResultAI(id, updates);
  }
}

export async function deleteTestResult(id: number): Promise<void> {
  const db = await getDb();
  if (!db || hasForcedTestResultsFileFallback) {
    logTestResultsFileFallback();
    const current = await readTestResultsFile();
    current.results = current.results.filter((result) => result.id !== id);
    await writeTestResultsFile(current);
    return;
  }
  try {
    await db.delete(testResults).where(eq(testResults.id, id));
  } catch (error) {
    activateTestResultsFileFallback(error);
    await deleteTestResult(id);
  }
}

// ── Manual Papers ──

export async function saveManualPaper(data: InsertManualPaper): Promise<number | null> {
  const db = await getDb();
  if (!db || hasForcedManualPaperFileFallback) {
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
  try {
    const [result] = await db
      .insert(manualPapers)
      .values(data)
      .returning({ id: manualPapers.id });
    return result?.id ?? null;
  } catch (error) {
    activateManualPaperFileFallback(error);
    return saveManualPaper(data);
  }
}

export async function getAllManualPapers(): Promise<ManualPaper[]> {
  const db = await getDb();
  if (!db || hasForcedManualPaperFileFallback) {
    logManualPaperFileFallback();
    const data = await readManualPapersFile();
    return filterVisibleManualPapers([...data.papers]).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  try {
    const papers = await db.select().from(manualPapers).orderBy(desc(manualPapers.createdAt));
    return filterVisibleManualPapers(papers);
  } catch (error) {
    activateManualPaperFileFallback(error);
    return getAllManualPapers();
  }
}

export async function getPublishedManualPapers(): Promise<ManualPaper[]> {
  const db = await getDb();
  if (!db || hasForcedManualPaperFileFallback) {
    logManualPaperFileFallback();
    const data = await readManualPapersFile();
    return filterVisibleManualPapers(data.papers)
      .filter((paper) => paper.published === 1)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  try {
    const papers = await db.select().from(manualPapers).where(eq(manualPapers.published, 1)).orderBy(desc(manualPapers.createdAt));
    return filterVisibleManualPapers(papers);
  } catch (error) {
    activateManualPaperFileFallback(error);
    return getPublishedManualPapers();
  }
}

export async function getManualPaperByPaperId(paperId: string): Promise<ManualPaper | undefined> {
  const db = await getDb();
  if (!db || hasForcedManualPaperFileFallback) {
    logManualPaperFileFallback();
    const data = await readManualPapersFile();
    return data.papers.find((paper) => paper.paperId === paperId);
  }
  try {
    const rows = await db.select().from(manualPapers).where(eq(manualPapers.paperId, paperId)).limit(1);
    return rows[0];
  } catch (error) {
    activateManualPaperFileFallback(error);
    return getManualPaperByPaperId(paperId);
  }
}

export async function getManualPaperById(id: number): Promise<ManualPaper | undefined> {
  const db = await getDb();
  if (!db || hasForcedManualPaperFileFallback) {
    logManualPaperFileFallback();
    const data = await readManualPapersFile();
    return data.papers.find((paper) => paper.id === id);
  }
  try {
    const rows = await db.select().from(manualPapers).where(eq(manualPapers.id, id)).limit(1);
    return rows[0];
  } catch (error) {
    activateManualPaperFileFallback(error);
    return getManualPaperById(id);
  }
}

export async function deleteManualPaper(id: number): Promise<void> {
  const db = await getDb();
  if (!db || hasForcedManualPaperFileFallback) {
    logManualPaperFileFallback();
    const data = await readManualPapersFile();
    data.papers = data.papers.filter((paper) => paper.id !== id);
    await writeManualPapersFile(data);
    return;
  }
  try {
    await db.delete(manualPapers).where(eq(manualPapers.id, id));
  } catch (error) {
    activateManualPaperFileFallback(error);
    await deleteManualPaper(id);
  }
}

export async function updateManualPaper(id: number, data: Partial<InsertManualPaper>): Promise<void> {
  const db = await getDb();
  if (!db || hasForcedManualPaperFileFallback) {
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
  try {
    await db
      .update(manualPapers)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(manualPapers.id, id));
  } catch (error) {
    activateManualPaperFileFallback(error);
    await updateManualPaper(id, data);
  }
}

export async function getEnglishTagSystems(): Promise<EnglishExamTagSystem[]> {
  const store = await getManualPaperByPaperId(ENGLISH_TAG_SCHEMA_STORE_PAPER_ID);
  return parseEnglishTagSchemaStore(store?.blueprintJson).systems;
}

export async function saveEnglishTagSystems(systems: EnglishExamTagSystemInput[]): Promise<void> {
  const normalizedSystems = normalizeEnglishTagSystems(systems, { fallbackToDefaults: false });
  const store = await getManualPaperByPaperId(ENGLISH_TAG_SCHEMA_STORE_PAPER_ID);
  const payload = {
    paperId: ENGLISH_TAG_SCHEMA_STORE_PAPER_ID,
    title: ENGLISH_TAG_SCHEMA_STORE_TITLE,
    description: "Reserved system record for English tag schemas.",
    subject: "english",
    category: "assessment",
    published: 0,
    blueprintJson: JSON.stringify({
      version: 1,
      subject: "english",
      systems: normalizedSystems,
    } satisfies EnglishTagSchemaStore),
    totalQuestions: 0,
    hasListening: 0,
    hasWriting: 0,
  } satisfies InsertManualPaper;

  if (!store) {
    await saveManualPaper(payload);
    return;
  }

  await updateManualPaper(store.id, payload);
}

export async function getMathTagSystems(): Promise<SubjectTagSystem[]> {
  const store = await getManualPaperByPaperId(MATH_TAG_SCHEMA_STORE_PAPER_ID);
  return parseSubjectTagSchemaStore("math", store?.blueprintJson).systems;
}

export async function saveMathTagSystems(systems: SubjectTagSystem[]): Promise<void> {
  const normalizedSystems = normalizeSubjectTagSystems("math", systems, { fallbackToDefaults: false });
  const meta = getTagSchemaStoreMeta("math");
  const store = await getManualPaperByPaperId(meta.paperId);
  const payload = {
    paperId: meta.paperId,
    title: meta.title,
    description: meta.description,
    subject: "math",
    category: "assessment",
    published: 0,
    blueprintJson: JSON.stringify({
      version: 1,
      subject: "math",
      systems: normalizedSystems,
    } satisfies SubjectTagSchemaStore),
    totalQuestions: 0,
    hasListening: 0,
    hasWriting: 0,
  } satisfies InsertManualPaper;

  if (!store) {
    await saveManualPaper(payload);
    return;
  }

  await updateManualPaper(store.id, payload);
}

export async function getVocabularyTagSystems(): Promise<SubjectTagSystem[]> {
  const store = await getManualPaperByPaperId(VOCABULARY_TAG_SCHEMA_STORE_PAPER_ID);
  return parseSubjectTagSchemaStore("vocabulary", store?.blueprintJson).systems;
}

export async function saveVocabularyTagSystems(systems: SubjectTagSystem[]): Promise<void> {
  const normalizedSystems = normalizeSubjectTagSystems("vocabulary", systems, { fallbackToDefaults: false });
  const meta = getTagSchemaStoreMeta("vocabulary");
  const store = await getManualPaperByPaperId(meta.paperId);
  const payload = {
    paperId: meta.paperId,
    title: meta.title,
    description: meta.description,
    subject: "vocabulary",
    category: "assessment",
    published: 0,
    blueprintJson: JSON.stringify({
      version: 1,
      subject: "vocabulary",
      systems: normalizedSystems,
    } satisfies SubjectTagSchemaStore),
    totalQuestions: 0,
    hasListening: 0,
    hasWriting: 0,
  } satisfies InsertManualPaper;

  if (!store) {
    await saveManualPaper(payload);
    return;
  }

  await updateManualPaper(store.id, payload);
}

// ── Local Auth Users ──

export async function getLocalUserByUsername(username: string): Promise<LocalUser | undefined> {
  const db = await getDb();
  if (!db || hasForcedLocalAuthFileFallback) {
    logLocalAuthFileFallback();
    const data = await readLocalAuthUsersFile();
    return data.users.find((user) => user.username === username);
  }
  try {
    const rows = await db.select().from(localUsers).where(eq(localUsers.username, username)).limit(1);
    return rows[0];
  } catch (error) {
    activateLocalAuthFileFallback(error);
    return getLocalUserByUsername(username);
  }
}

export async function getLocalUserById(id: number): Promise<LocalUser | undefined> {
  const db = await getDb();
  if (!db || hasForcedLocalAuthFileFallback) {
    logLocalAuthFileFallback();
    const data = await readLocalAuthUsersFile();
    return data.users.find((user) => user.id === id);
  }
  try {
    const rows = await db.select().from(localUsers).where(eq(localUsers.id, id)).limit(1);
    return rows[0];
  } catch (error) {
    activateLocalAuthFileFallback(error);
    return getLocalUserById(id);
  }
}

export async function listLocalUsers(): Promise<LocalUser[]> {
  const db = await getDb();
  if (!db || hasForcedLocalAuthFileFallback) {
    logLocalAuthFileFallback();
    const data = await readLocalAuthUsersFile();
    return [...data.users].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  }
  try {
    return await db.select().from(localUsers).orderBy(desc(localUsers.createdAt));
  } catch (error) {
    activateLocalAuthFileFallback(error);
    return listLocalUsers();
  }
}

export async function createLocalUser(data: InsertLocalUser): Promise<number | null> {
  const db = await getDb();
  if (!db || hasForcedLocalAuthFileFallback) {
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
  try {
    const [result] = await db
      .insert(localUsers)
      .values(data)
      .returning({ id: localUsers.id });
    return result?.id ?? null;
  } catch (error) {
    activateLocalAuthFileFallback(error);
    return createLocalUser(data);
  }
}

export async function updateLocalUser(
  id: number,
  data: Partial<Pick<LocalUser, "displayName" | "inviteCode" | "role" | "passwordHash">>,
): Promise<void> {
  const db = await getDb();
  if (!db || hasForcedLocalAuthFileFallback) {
    logLocalAuthFileFallback();
    const current = await readLocalAuthUsersFile();
    const user = current.users.find((item) => item.id === id);
    if (!user) return;
    Object.assign(user, data);
    await writeLocalAuthUsersFile(current);
    return;
  }
  try {
    await db.update(localUsers).set(data).where(eq(localUsers.id, id));
  } catch (error) {
    activateLocalAuthFileFallback(error);
    await updateLocalUser(id, data);
  }
}

export async function updateLocalUserLastLogin(id: number): Promise<void> {
  const db = await getDb();
  if (!db || hasForcedLocalAuthFileFallback) {
    logLocalAuthFileFallback();
    const current = await readLocalAuthUsersFile();
    const user = current.users.find((item) => item.id === id);
    if (!user) return;
    user.lastLoginAt = new Date();
    await writeLocalAuthUsersFile(current);
    return;
  }
  try {
    await db.update(localUsers).set({ lastLoginAt: new Date() }).where(eq(localUsers.id, id));
  } catch (error) {
    activateLocalAuthFileFallback(error);
    await updateLocalUserLastLogin(id);
  }
}

export async function deleteLocalUser(id: number): Promise<void> {
  const db = await getDb();
  if (!db || hasForcedLocalAuthFileFallback) {
    logLocalAuthFileFallback();
    const current = await readLocalAuthUsersFile();
    current.users = current.users.filter((user) => user.id !== id);
    await writeLocalAuthUsersFile(current);
    return;
  }
  try {
    await db.delete(localUsers).where(eq(localUsers.id, id));
  } catch (error) {
    activateLocalAuthFileFallback(error);
    await deleteLocalUser(id);
  }
}
