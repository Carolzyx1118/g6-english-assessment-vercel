CREATE TABLE `localUsers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`username` varchar(128) NOT NULL,
	`passwordHash` varchar(255) NOT NULL,
	`inviteCode` varchar(128) NOT NULL,
	`displayName` varchar(255),
	`localRole` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`lastLoginAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `localUsers_id` PRIMARY KEY(`id`),
	CONSTRAINT `localUsers_username_unique` UNIQUE(`username`)
);
