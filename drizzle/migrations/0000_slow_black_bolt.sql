CREATE TYPE "public"."local_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TABLE "localUsers" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" varchar(128) NOT NULL,
	"passwordHash" varchar(255) NOT NULL,
	"inviteCode" varchar(128) NOT NULL,
	"displayName" varchar(255),
	"role" "local_role" DEFAULT 'user' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"lastLoginAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "localUsers_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "manualPapers" (
	"id" serial PRIMARY KEY NOT NULL,
	"paperId" varchar(255) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"subject" varchar(64) DEFAULT 'english' NOT NULL,
	"category" varchar(64) DEFAULT 'assessment' NOT NULL,
	"blueprintJson" text NOT NULL,
	"published" integer DEFAULT 1 NOT NULL,
	"totalQuestions" integer DEFAULT 0 NOT NULL,
	"hasListening" integer DEFAULT 0 NOT NULL,
	"hasWriting" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "manualPapers_paperId_unique" UNIQUE("paperId")
);
--> statement-breakpoint
CREATE TABLE "testResults" (
	"id" serial PRIMARY KEY NOT NULL,
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
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"loginMethod" varchar(64),
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId")
);
