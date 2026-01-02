CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"updated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"first" varchar(255) NOT NULL,
	"last" varchar(255) NOT NULL,
	"photoUrl" varchar(255),
	"provider" varchar(255) NOT NULL,
	"displayName" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "email_idx" ON "users" USING btree ("email");
