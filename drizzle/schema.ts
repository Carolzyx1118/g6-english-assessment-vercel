import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Test results table - stores all student assessment submissions.
 * Answers, scores, AI grading results, and reports are stored as JSON.
 */
export const testResults = mysqlTable("testResults", {
  id: int("id").autoincrement().primaryKey(),
  /** Student name entered before the test */
  studentName: varchar("studentName", { length: 255 }).notNull(),
  /** Student grade (optional) */
  studentGrade: varchar("studentGrade", { length: 64 }),
  /** Paper ID (e.g., 'wida-g2-3', 'huazhong-g6') */
  paperId: varchar("paperId", { length: 128 }).notNull(),
  /** Paper title for display */
  paperTitle: varchar("paperTitle", { length: 255 }).notNull(),
  /** Total correct answers */
  totalCorrect: int("totalCorrect").notNull(),
  /** Total questions */
  totalQuestions: int("totalQuestions").notNull(),
  /** Total time in seconds */
  totalTimeSeconds: int("totalTimeSeconds"),
  /** All answers as JSON: Record<string, string | number> */
  answersJson: text("answersJson").notNull(),
  /** Score breakdown by section as JSON */
  scoreBySectionJson: text("scoreBySectionJson"),
  /** Section timings as JSON */
  sectionTimingsJson: text("sectionTimingsJson"),
  /** AI reading grading results as JSON */
  readingResultsJson: text("readingResultsJson"),
  /** AI writing evaluation results as JSON */
  writingResultJson: text("writingResultJson"),
  /** AI explanations as JSON */
  explanationsJson: text("explanationsJson"),
  /** AI proficiency report as JSON */
  reportJson: text("reportJson"),
  /** Submission timestamp */
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TestResult = typeof testResults.$inferSelect;
export type InsertTestResult = typeof testResults.$inferInsert;

/**
 * Manual papers table - stores papers created via the Manual Paper Builder.
 * The full blueprint is stored as JSON; metadata columns enable listing/filtering.
 */
export const manualPapers = mysqlTable("manualPapers", {
  id: int("id").autoincrement().primaryKey(),
  /** Slug-style paper ID derived from title, used as the Paper.id in the quiz system */
  paperId: varchar("paperId", { length: 255 }).notNull().unique(),
  /** Human-readable title */
  title: varchar("title", { length: 255 }).notNull(),
  /** Short description */
  description: text("description"),
  /** Subject classification */
  subject: varchar("subject", { length: 64 }).notNull().default("english"),
  /** Category classification */
  category: varchar("category", { length: 64 }).notNull().default("assessment"),
  /** Full ManualPaperBlueprint as JSON */
  blueprintJson: text("blueprintJson").notNull(),
  /** Whether the paper is published and visible to students */
  published: int("published").notNull().default(1),
  /** Total question count (cached for display) */
  totalQuestions: int("totalQuestions").notNull().default(0),
  /** Whether the paper has listening sections */
  hasListening: int("hasListening").notNull().default(0),
  /** Whether the paper has writing sections */
  hasWriting: int("hasWriting").notNull().default(0),
  /** Creation timestamp */
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  /** Last update timestamp */
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ManualPaper = typeof manualPapers.$inferSelect;
export type InsertManualPaper = typeof manualPapers.$inferInsert;

/**
 * Local authentication users table.
 * Stores users who register with username/password + invite code.
 * Separate from the Manus OAuth users table.
 */
export const localUsers = mysqlTable("localUsers", {
  id: int("id").autoincrement().primaryKey(),
  /** Unique username chosen during registration */
  username: varchar("username", { length: 128 }).notNull().unique(),
  /** bcrypt-hashed password */
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  /** Invite code used during registration */
  inviteCode: varchar("inviteCode", { length: 128 }).notNull(),
  /** Display name (defaults to username) */
  displayName: varchar("displayName", { length: 255 }),
  /** User role */
  role: mysqlEnum("localRole", ["user", "admin"]).default("user").notNull(),
  /** Creation timestamp */
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  /** Last login timestamp */
  lastLoginAt: timestamp("lastLoginAt").defaultNow().notNull(),
});

export type LocalUser = typeof localUsers.$inferSelect;
export type InsertLocalUser = typeof localUsers.$inferInsert;
