CREATE TABLE "sandbox_starting_claims" (
	"id" varchar(10) PRIMARY KEY NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"released_at" timestamp with time zone,
	"claimed_at" timestamp with time zone NOT NULL,
	"sandbox_id" varchar(10) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sandbox_starting_claims" ADD CONSTRAINT "sandbox_starting_claims_sandbox_id_sandboxes_id_fk" FOREIGN KEY ("sandbox_id") REFERENCES "public"."sandboxes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sandbox_starting_claims_sandbox_id_idx" ON "sandbox_starting_claims" USING btree ("sandbox_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sandbox_starting_claims_active_idx" ON "sandbox_starting_claims" USING btree ("sandbox_id") WHERE "sandbox_starting_claims"."released_at" IS NULL;