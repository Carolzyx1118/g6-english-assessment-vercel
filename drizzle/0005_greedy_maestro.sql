CREATE TABLE `manualPapers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`paperId` varchar(255) NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`subject` varchar(64) NOT NULL DEFAULT 'english',
	`category` varchar(64) NOT NULL DEFAULT 'assessment',
	`blueprintJson` text NOT NULL,
	`published` int NOT NULL DEFAULT 1,
	`totalQuestions` int NOT NULL DEFAULT 0,
	`hasListening` int NOT NULL DEFAULT 0,
	`hasWriting` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `manualPapers_id` PRIMARY KEY(`id`),
	CONSTRAINT `manualPapers_paperId_unique` UNIQUE(`paperId`)
);
