CREATE TABLE `community_replies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`post_id` integer NOT NULL,
	`content` text NOT NULL,
	`language` text DEFAULT 'zh' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`reviewed_at` text
);
--> statement-breakpoint
ALTER TABLE `community_posts` ADD `language` text DEFAULT 'zh' NOT NULL;--> statement-breakpoint
ALTER TABLE `community_posts` ADD `country_code` text;--> statement-breakpoint
ALTER TABLE `community_posts` ADD `country_name` text;--> statement-breakpoint
ALTER TABLE `community_posts` ADD `region` text;--> statement-breakpoint
ALTER TABLE `community_posts` ADD `city` text;--> statement-breakpoint
ALTER TABLE `community_posts` ADD `latitude` real;--> statement-breakpoint
ALTER TABLE `community_posts` ADD `longitude` real;--> statement-breakpoint
ALTER TABLE `community_posts` ADD `hearts` integer DEFAULT 0 NOT NULL;