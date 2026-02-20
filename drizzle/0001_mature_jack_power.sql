CREATE TABLE `testResults` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studentName` varchar(255) NOT NULL,
	`studentGrade` varchar(64),
	`paperId` varchar(128) NOT NULL,
	`paperTitle` varchar(255) NOT NULL,
	`totalCorrect` int NOT NULL,
	`totalQuestions` int NOT NULL,
	`totalTimeSeconds` int,
	`answersJson` text NOT NULL,
	`scoreBySectionJson` text,
	`sectionTimingsJson` text,
	`readingResultsJson` text,
	`writingResultJson` text,
	`explanationsJson` text,
	`reportJson` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `testResults_id` PRIMARY KEY(`id`)
);
