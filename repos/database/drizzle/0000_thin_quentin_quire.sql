CREATE TABLE "agent_projects" (
	"id" varchar(10) PRIMARY KEY NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"agent_id" varchar(10) NOT NULL,
	"project_id" varchar(10) NOT NULL,
	"alias" text,
	"model" text,
	"max_tokens" integer,
	"system_prompt" text,
	"tools" jsonb,
	"function_ids" jsonb,
	"env_vars" jsonb,
	"environment" jsonb,
	"enabled" boolean DEFAULT true,
	CONSTRAINT "unique_agent_project" UNIQUE("agent_id","project_id")
);
--> statement-breakpoint
CREATE TABLE "agent_providers" (
	"id" varchar(10) PRIMARY KEY NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"agent_id" varchar(10) NOT NULL,
	"provider_id" varchar(10) NOT NULL,
	"priority" integer DEFAULT 0,
	"model" text,
	CONSTRAINT "unique_agent_provider" UNIQUE("agent_id","provider_id")
);
--> statement-breakpoint
CREATE TABLE "agent_skills" (
	"id" varchar(10) PRIMARY KEY NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"agent_id" varchar(10) NOT NULL,
	"skill_id" varchar(10) NOT NULL,
	CONSTRAINT "unique_agent_skill" UNIQUE("agent_id","skill_id")
);
--> statement-breakpoint
CREATE TABLE "agents" (
	"id" varchar(10) PRIMARY KEY NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"org_id" varchar(10) NOT NULL,
	"system_prompt" text,
	"soul" text,
	"model" text,
	"max_tokens" integer DEFAULT 100000,
	"tools" jsonb DEFAULT '[]',
	"env_vars" jsonb DEFAULT '{}'::jsonb,
	"environment" jsonb DEFAULT '{}'::jsonb,
	"active" boolean DEFAULT true,
	"autonomous" boolean DEFAULT false,
	"brain" varchar(20) DEFAULT 'api' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" varchar(10) PRIMARY KEY NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"expires_at" timestamp,
	"last_used_at" timestamp,
	"active" boolean DEFAULT true,
	"rate_limit" integer DEFAULT 100,
	"key_hash" text NOT NULL,
	"key_prefix" varchar(12) NOT NULL,
	"permissions" text[],
	"org_id" varchar(10),
	"project_id" varchar(10),
	"user_id" uuid,
	"resident_agent_id" varchar(10),
	CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash"),
	CONSTRAINT "api_key_scope_check" CHECK (
    ("api_keys"."org_id" IS NOT NULL AND "api_keys"."project_id" IS NULL)
    OR ("api_keys"."org_id" IS NULL AND "api_keys"."project_id" IS NOT NULL)
    OR ("api_keys"."org_id" IS NULL AND "api_keys"."project_id" IS NULL)
  )
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" varchar(10) PRIMARY KEY NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"url" text,
	"meta" jsonb,
	"content" jsonb,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"provider_id" varchar(10),
	"org_id" varchar(10),
	"user_id" uuid,
	"thread_id" varchar(10),
	"project_id" varchar(10),
	"message_id" varchar(10),
	CONSTRAINT "asset_owner_check" CHECK (
    (
      ("assets"."org_id" IS NOT NULL)::int +
      ("assets"."project_id" IS NOT NULL)::int +
      ("assets"."user_id" IS NOT NULL)::int +
      ("assets"."thread_id" IS NOT NULL)::int +
      ("assets"."message_id" IS NOT NULL)::int
    ) = 1
  )
);
--> statement-breakpoint
CREATE TABLE "collections" (
	"id" varchar(10) PRIMARY KEY NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"schema" jsonb,
	"project_id" varchar(10) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_strategies" (
	"id" varchar(10) PRIMARY KEY NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"north_star" text,
	"segments" jsonb DEFAULT '[]'::jsonb,
	"positioning" text,
	"backlog" jsonb DEFAULT '[]'::jsonb,
	"active_initiative" jsonb,
	"org_id" varchar(10) NOT NULL,
	"updated_by_agent_id" varchar(10),
	CONSTRAINT "company_strategies_org_id_unique" UNIQUE("org_id")
);
--> statement-breakpoint
CREATE TABLE "decision_positions" (
	"id" varchar(10) PRIMARY KEY NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"stance" varchar(12) NOT NULL,
	"reasoning" text NOT NULL,
	"round" integer NOT NULL,
	"org_id" varchar(10) NOT NULL,
	"proposal_id" varchar(10) NOT NULL,
	"agent_id" varchar(10) NOT NULL,
	CONSTRAINT "unique_decision_position_round" UNIQUE("proposal_id","agent_id","round")
);
--> statement-breakpoint
CREATE TABLE "decision_proposals" (
	"id" varchar(10) PRIMARY KEY NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"title" text NOT NULL,
	"axis" varchar(20) NOT NULL,
	"description" text NOT NULL,
	"evidence" jsonb DEFAULT '[]'::jsonb,
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"round" integer DEFAULT 1 NOT NULL,
	"resolution" text,
	"resolved_ref" text,
	"org_id" varchar(10) NOT NULL,
	"opened_by_agent_id" varchar(10) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "domains" (
	"id" varchar(10) PRIMARY KEY NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"domain" text NOT NULL,
	"verified_at" timestamp,
	"ssl_private_key" text,
	"ssl_certificate" text,
	"ssl_expires_at" timestamp,
	"verified" boolean DEFAULT false NOT NULL,
	"ssl_enabled" boolean DEFAULT false NOT NULL,
	"org_id" varchar(10),
	"project_id" varchar(10),
	CONSTRAINT "domains_domain_unique" UNIQUE("domain"),
	CONSTRAINT "domain_owner_check" CHECK (
    (
      ("domains"."org_id" IS NOT NULL)::int +
      ("domains"."project_id" IS NOT NULL)::int
    ) = 1
  )
);
--> statement-breakpoint
CREATE TABLE "endpoints" (
	"id" varchar(10) PRIMARY KEY NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"name" text,
	"headers" jsonb,
	"options" jsonb,
	"meta" jsonb,
	"path" text NOT NULL,
	"public" boolean DEFAULT false,
	"method" varchar(10) DEFAULT 'GET',
	"type" varchar(10) DEFAULT 'proxy' NOT NULL,
	"project_id" varchar(10) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "escalations" (
	"id" varchar(10) PRIMARY KEY NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"title" text NOT NULL,
	"problem" text NOT NULL,
	"evidence" jsonb DEFAULT '[]'::jsonb,
	"proposed_patch" text,
	"target" varchar(12) NOT NULL,
	"status" varchar(12) DEFAULT 'open' NOT NULL,
	"dedupe_key" varchar(200) NOT NULL,
	"issue_ref" text,
	"resolved_ref" text,
	"reason" text,
	"meta" jsonb,
	"org_id" varchar(10) NOT NULL,
	"agent_id" varchar(10) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "functions" (
	"id" varchar(10) PRIMARY KEY NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"content" text NOT NULL,
	"branch" text DEFAULT 'main',
	"default_args" jsonb DEFAULT '{}'::jsonb,
	"dependencies" jsonb DEFAULT '{}'::jsonb,
	"input_schema" jsonb DEFAULT '[]'::jsonb,
	"meta" jsonb,
	"language" varchar(50) DEFAULT 'typescript',
	"endpoint_id" varchar(10),
	"project_id" varchar(10) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" varchar(10) PRIMARY KEY NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"email" text NOT NULL,
	"user_id" uuid,
	"role_type" text NOT NULL,
	"org_id" varchar(10) NOT NULL,
	"invited_by" uuid,
	"token" text NOT NULL,
	"revoked_at" timestamp,
	"accepted_at" timestamp,
	"expires_at" timestamp NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"revoked_by" uuid,
	"project_roles" jsonb,
	"permission_overrides" jsonb,
	CONSTRAINT "invitations_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" varchar(10) PRIMARY KEY NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"stripe_invoice_id" text NOT NULL,
	"amount" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"status" text NOT NULL,
	"invoice_url" text,
	"period" text NOT NULL,
	CONSTRAINT "invoices_stripe_invoice_id_unique" UNIQUE("stripe_invoice_id")
);
--> statement-breakpoint
CREATE TABLE "memories" (
	"id" varchar(10) PRIMARY KEY NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"kind" varchar(20) DEFAULT 'fact' NOT NULL,
	"text" text NOT NULL,
	"importance" integer DEFAULT 5 NOT NULL,
	"last_accessed_at" timestamp DEFAULT now() NOT NULL,
	"embedding" vector(1024),
	"meta" jsonb,
	"org_id" varchar(10) NOT NULL,
	"agent_id" varchar(10) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" varchar(10) PRIMARY KEY NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"meta" jsonb,
	"type" text NOT NULL,
	"content" jsonb NOT NULL,
	"org_id" varchar(10),
	"project_id" varchar(10),
	"thread_id" varchar(10) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ops_actions" (
	"id" varchar(10) PRIMARY KEY NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"action" varchar(40) NOT NULL,
	"params" jsonb NOT NULL,
	"dry_run" boolean DEFAULT true NOT NULL,
	"dry_run_result" jsonb,
	"result" jsonb,
	"status" varchar(20) DEFAULT 'proposed' NOT NULL,
	"scan_result" jsonb,
	"review_verdict" jsonb,
	"rollback" jsonb,
	"reason" text,
	"meta" jsonb,
	"org_id" varchar(10) NOT NULL,
	"agent_id" varchar(10) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" varchar(10) PRIMARY KEY NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"config" jsonb,
	"owner_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permission_overrides" (
	"id" varchar(10) PRIMARY KEY NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"permission" text NOT NULL,
	"effect" text NOT NULL,
	"user_id" uuid NOT NULL,
	"org_id" varchar(10),
	"project_id" varchar(10),
	"granted_by" uuid NOT NULL,
	"reason" text,
	"expires_at" timestamp,
	CONSTRAINT "permission_override_scope_check" CHECK (
    ("permission_overrides"."org_id" IS NOT NULL AND "permission_overrides"."project_id" IS NULL) OR
    ("permission_overrides"."org_id" IS NULL AND "permission_overrides"."project_id" IS NOT NULL)
  ),
	CONSTRAINT "permission_override_effect_check" CHECK ("permission_overrides"."effect" IN ('grant', 'deny'))
);
--> statement-breakpoint
CREATE TABLE "project_providers" (
	"id" varchar(10) PRIMARY KEY NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"project_id" varchar(10) NOT NULL,
	"provider_id" varchar(10) NOT NULL,
	"priority" integer DEFAULT 0,
	CONSTRAINT "unique_project_provider" UNIQUE("project_id","provider_id")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" varchar(10) PRIMARY KEY NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"meta" jsonb,
	"name" text NOT NULL,
	"description" text,
	"org_id" varchar(10) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "providers" (
	"id" varchar(10) PRIMARY KEY NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"name" text,
	"brand" text,
	"type" text NOT NULL,
	"options" jsonb,
	"headers" jsonb,
	"body_params" jsonb,
	"secret_id" varchar(10),
	"org_id" varchar(10) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotas" (
	"id" varchar(10) PRIMARY KEY NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"org_id" varchar(10) NOT NULL,
	"period" text NOT NULL,
	"projects" integer DEFAULT 0 NOT NULL,
	"compute" integer DEFAULT 0 NOT NULL,
	"threads" integer DEFAULT 0 NOT NULL,
	"messages" integer DEFAULT 0 NOT NULL,
	"endpoints" integer DEFAULT 0 NOT NULL,
	"secrets" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "records" (
	"id" varchar(10) PRIMARY KEY NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"data" jsonb NOT NULL,
	"collection_id" varchar(10) NOT NULL,
	"project_id" varchar(10) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" varchar(10) PRIMARY KEY NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"name" text,
	"type" text NOT NULL,
	"org_id" varchar(10),
	"project_id" varchar(10),
	"user_id" uuid NOT NULL,
	CONSTRAINT "role_scope_check" CHECK (
    ("roles"."org_id" IS NOT NULL AND "roles"."project_id" IS NULL) OR
    ("roles"."org_id" IS NULL AND "roles"."project_id" IS NOT NULL)
  )
);
--> statement-breakpoint
CREATE TABLE "sandbox_project_providers" (
	"id" varchar(10) PRIMARY KEY NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"sandbox_id" varchar(10) NOT NULL,
	"project_id" varchar(10) NOT NULL,
	"provider_id" varchar(10) NOT NULL,
	"priority" integer DEFAULT 0,
	"branch" text
);
--> statement-breakpoint
CREATE TABLE "sandbox_projects" (
	"id" varchar(10) PRIMARY KEY NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"sandbox_id" varchar(10) NOT NULL,
	"project_id" varchar(10) NOT NULL,
	"alias" text NOT NULL,
	"enabled" boolean DEFAULT true,
	"config" jsonb,
	CONSTRAINT "unique_sandbox_project" UNIQUE("sandbox_id","project_id"),
	CONSTRAINT "unique_project_alias" UNIQUE("project_id","alias")
);
--> statement-breakpoint
CREATE TABLE "sandbox_providers" (
	"id" varchar(10) PRIMARY KEY NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"sandbox_id" varchar(10) NOT NULL,
	"provider_id" varchar(10) NOT NULL,
	"model" text,
	"priority" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "sandbox_sessions" (
	"id" varchar(10) PRIMARY KEY NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"duration_ms" integer,
	"stdout_key" varchar(255),
	"stderr_key" varchar(255),
	"status" varchar(20) NOT NULL,
	"session_id" varchar(20) NOT NULL,
	"instance_id" varchar(100) NOT NULL,
	"completed_at" timestamp with time zone,
	"started_at" timestamp with time zone NOT NULL,
	"sandbox_id" varchar(10) NOT NULL,
	"org_id" varchar(10) NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" varchar(10)
);
--> statement-breakpoint
CREATE TABLE "sandbox_skills" (
	"id" varchar(10) PRIMARY KEY NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"sandbox_id" varchar(10) NOT NULL,
	"skill_id" varchar(10) NOT NULL,
	"project_id" varchar(10),
	"priority" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "sandboxes" (
	"id" varchar(10) PRIMARY KEY NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"org_id" varchar(10) NOT NULL,
	"user_id" uuid,
	"config" jsonb NOT NULL,
	"built_in" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedule_runs" (
	"id" varchar(10) PRIMARY KEY NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"error" text,
	"duration_ms" integer,
	"stdout_key" varchar(255),
	"stderr_key" varchar(255),
	"status" varchar(20) NOT NULL,
	"instance_id" varchar(100),
	"completed_at" timestamp with time zone,
	"started_at" timestamp with time zone NOT NULL,
	"schedule_id" varchar(10) NOT NULL,
	"org_id" varchar(10) NOT NULL,
	"project_id" varchar(10) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedules" (
	"id" varchar(10) PRIMARY KEY NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"prompt" text,
	"command" text,
	"last_run_at" timestamp,
	"next_run_at" timestamp,
	"enabled" boolean DEFAULT true NOT NULL,
	"type" varchar(20) DEFAULT 'prompt' NOT NULL,
	"consecutive_errors" integer DEFAULT 0 NOT NULL,
	"cron_expression" varchar(255) NOT NULL,
	"user_id" uuid,
	"agent_id" varchar(10),
	"thread_id" varchar(10),
	"max_consecutive_errors" integer DEFAULT 5 NOT NULL,
	"timeout_ms" integer,
	"context_sources" jsonb,
	"actions" jsonb,
	"sandbox_id" varchar(10) NOT NULL,
	"org_id" varchar(10) NOT NULL,
	"project_id" varchar(10) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "secrets" (
	"id" varchar(10) PRIMARY KEY NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"hash_key" text NOT NULL,
	"encrypted_value" text NOT NULL,
	"org_id" varchar(10),
	"project_id" varchar(10),
	"provider_id" varchar(10),
	"agent_id" varchar(10),
	CONSTRAINT "secret_scope_check" CHECK (
    ("secrets"."org_id" IS NOT NULL AND "secrets"."project_id" IS NULL AND "secrets"."provider_id" IS NULL AND "secrets"."agent_id" IS NULL) OR
    ("secrets"."org_id" IS NULL AND "secrets"."project_id" IS NOT NULL AND "secrets"."provider_id" IS NULL AND "secrets"."agent_id" IS NULL) OR
    ("secrets"."org_id" IS NULL AND "secrets"."project_id" IS NULL AND "secrets"."provider_id" IS NOT NULL AND "secrets"."agent_id" IS NULL) OR
    ("secrets"."org_id" IS NULL AND "secrets"."project_id" IS NULL AND "secrets"."provider_id" IS NULL AND "secrets"."agent_id" IS NOT NULL) OR
    ("secrets"."org_id" IS NOT NULL AND "secrets"."provider_id" IS NOT NULL AND "secrets"."project_id" IS NULL AND "secrets"."agent_id" IS NULL)
  )
);
--> statement-breakpoint
CREATE TABLE "skill_proposals" (
	"id" varchar(10) PRIMARY KEY NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"instructions" text NOT NULL,
	"trigger_keywords" jsonb DEFAULT '[]'::jsonb,
	"tools" jsonb DEFAULT '[]'::jsonb,
	"always_active" boolean DEFAULT false NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"scan_result" jsonb,
	"audit_verdict" jsonb,
	"promoted_skill_id" varchar(10),
	"reason" text,
	"meta" jsonb,
	"org_id" varchar(10) NOT NULL,
	"agent_id" varchar(10) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skills" (
	"id" varchar(10) PRIMARY KEY NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"instructions" text NOT NULL,
	"trigger_keywords" jsonb DEFAULT '[]'::jsonb,
	"tools" jsonb DEFAULT '[]'::jsonb,
	"always_active" boolean DEFAULT false NOT NULL,
	"org_id" varchar(10) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" varchar(10) PRIMARY KEY NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"tier" text DEFAULT 'free' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"stripe_price_id" text,
	"current_period_start" timestamp,
	"current_period_end" timestamp,
	"cancel_at_period_end" boolean DEFAULT false,
	"seats" integer DEFAULT 1,
	CONSTRAINT "subscriptions_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "task_proposals" (
	"id" varchar(10) PRIMARY KEY NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"priority" varchar(4),
	"evidence" text NOT NULL,
	"source_signal" varchar(20),
	"dedupe_key" varchar(200) NOT NULL,
	"repos" jsonb DEFAULT '[]'::jsonb,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"scan_result" jsonb,
	"audit_verdict" jsonb,
	"meta" jsonb,
	"pr_url" text,
	"reason" text,
	"initiative" text,
	"parent_id" varchar(10),
	"org_id" varchar(10) NOT NULL,
	"agent_id" varchar(10) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "threads" (
	"id" varchar(10) PRIMARY KEY NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"name" text,
	"meta" jsonb,
	"public" boolean DEFAULT false,
	"parent_thread_id" varchar(10),
	"branch_message_id" varchar(10),
	"provider_id" varchar(10),
	"agent_id" varchar(10),
	"org_id" varchar(10),
	"project_id" varchar(10),
	"user_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" varchar(10) PRIMARY KEY NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"pr_number" integer NOT NULL,
	"pr_url" text,
	"merge_sha" varchar(40),
	"probe" jsonb NOT NULL,
	"status" varchar(12) DEFAULT 'pending' NOT NULL,
	"detail" text,
	"revert_pr_url" text,
	"escalation_id" varchar(10),
	"meta" jsonb,
	"org_id" varchar(10) NOT NULL,
	"agent_id" varchar(10) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_projects" ADD CONSTRAINT "agent_projects_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_projects" ADD CONSTRAINT "agent_projects_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_providers" ADD CONSTRAINT "agent_providers_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_providers" ADD CONSTRAINT "agent_providers_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_skills" ADD CONSTRAINT "agent_skills_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_skills" ADD CONSTRAINT "agent_skills_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "neon_auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_resident_agent_id_agents_id_fk" FOREIGN KEY ("resident_agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "neon_auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_thread_id_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_strategies" ADD CONSTRAINT "company_strategies_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_strategies" ADD CONSTRAINT "company_strategies_updated_by_agent_id_agents_id_fk" FOREIGN KEY ("updated_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_positions" ADD CONSTRAINT "decision_positions_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_positions" ADD CONSTRAINT "decision_positions_proposal_id_decision_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."decision_proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_positions" ADD CONSTRAINT "decision_positions_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_proposals" ADD CONSTRAINT "decision_proposals_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_proposals" ADD CONSTRAINT "decision_proposals_opened_by_agent_id_agents_id_fk" FOREIGN KEY ("opened_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domains" ADD CONSTRAINT "domains_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domains" ADD CONSTRAINT "domains_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "endpoints" ADD CONSTRAINT "endpoints_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalations" ADD CONSTRAINT "escalations_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalations" ADD CONSTRAINT "escalations_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "functions" ADD CONSTRAINT "functions_endpoint_id_endpoints_id_fk" FOREIGN KEY ("endpoint_id") REFERENCES "public"."endpoints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "functions" ADD CONSTRAINT "functions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "neon_auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_user_id_fk" FOREIGN KEY ("invited_by") REFERENCES "neon_auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_revoked_by_user_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "neon_auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "neon_auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memories" ADD CONSTRAINT "memories_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memories" ADD CONSTRAINT "memories_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_thread_id_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_actions" ADD CONSTRAINT "ops_actions_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_actions" ADD CONSTRAINT "ops_actions_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "neon_auth"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permission_overrides" ADD CONSTRAINT "permission_overrides_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "neon_auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permission_overrides" ADD CONSTRAINT "permission_overrides_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permission_overrides" ADD CONSTRAINT "permission_overrides_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permission_overrides" ADD CONSTRAINT "permission_overrides_granted_by_user_id_fk" FOREIGN KEY ("granted_by") REFERENCES "neon_auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_providers" ADD CONSTRAINT "project_providers_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_providers" ADD CONSTRAINT "project_providers_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "providers" ADD CONSTRAINT "providers_secret_id_secrets_id_fk" FOREIGN KEY ("secret_id") REFERENCES "public"."secrets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "providers" ADD CONSTRAINT "providers_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotas" ADD CONSTRAINT "quotas_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "records" ADD CONSTRAINT "records_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "records" ADD CONSTRAINT "records_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "neon_auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sandbox_project_providers" ADD CONSTRAINT "sandbox_project_providers_sandbox_id_sandboxes_id_fk" FOREIGN KEY ("sandbox_id") REFERENCES "public"."sandboxes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sandbox_project_providers" ADD CONSTRAINT "sandbox_project_providers_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sandbox_project_providers" ADD CONSTRAINT "sandbox_project_providers_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sandbox_projects" ADD CONSTRAINT "sandbox_projects_sandbox_id_sandboxes_id_fk" FOREIGN KEY ("sandbox_id") REFERENCES "public"."sandboxes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sandbox_projects" ADD CONSTRAINT "sandbox_projects_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sandbox_providers" ADD CONSTRAINT "sandbox_providers_sandbox_id_sandboxes_id_fk" FOREIGN KEY ("sandbox_id") REFERENCES "public"."sandboxes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sandbox_providers" ADD CONSTRAINT "sandbox_providers_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sandbox_sessions" ADD CONSTRAINT "sandbox_sessions_sandbox_id_sandboxes_id_fk" FOREIGN KEY ("sandbox_id") REFERENCES "public"."sandboxes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sandbox_sessions" ADD CONSTRAINT "sandbox_sessions_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sandbox_sessions" ADD CONSTRAINT "sandbox_sessions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "neon_auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sandbox_sessions" ADD CONSTRAINT "sandbox_sessions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sandbox_skills" ADD CONSTRAINT "sandbox_skills_sandbox_id_sandboxes_id_fk" FOREIGN KEY ("sandbox_id") REFERENCES "public"."sandboxes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sandbox_skills" ADD CONSTRAINT "sandbox_skills_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sandbox_skills" ADD CONSTRAINT "sandbox_skills_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sandboxes" ADD CONSTRAINT "sandboxes_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sandboxes" ADD CONSTRAINT "sandboxes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "neon_auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_runs" ADD CONSTRAINT "schedule_runs_schedule_id_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."schedules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_runs" ADD CONSTRAINT "schedule_runs_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_runs" ADD CONSTRAINT "schedule_runs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "neon_auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_thread_id_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_sandbox_id_sandboxes_id_fk" FOREIGN KEY ("sandbox_id") REFERENCES "public"."sandboxes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "secrets" ADD CONSTRAINT "secrets_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "secrets" ADD CONSTRAINT "secrets_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "secrets" ADD CONSTRAINT "secrets_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "secrets" ADD CONSTRAINT "secrets_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_proposals" ADD CONSTRAINT "skill_proposals_promoted_skill_id_skills_id_fk" FOREIGN KEY ("promoted_skill_id") REFERENCES "public"."skills"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_proposals" ADD CONSTRAINT "skill_proposals_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_proposals" ADD CONSTRAINT "skill_proposals_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skills" ADD CONSTRAINT "skills_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "neon_auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_proposals" ADD CONSTRAINT "task_proposals_parent_id_task_proposals_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."task_proposals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_proposals" ADD CONSTRAINT "task_proposals_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_proposals" ADD CONSTRAINT "task_proposals_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "threads" ADD CONSTRAINT "threads_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "threads" ADD CONSTRAINT "threads_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "threads" ADD CONSTRAINT "threads_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "threads" ADD CONSTRAINT "threads_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "threads" ADD CONSTRAINT "threads_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "neon_auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verifications" ADD CONSTRAINT "verifications_escalation_id_escalations_id_fk" FOREIGN KEY ("escalation_id") REFERENCES "public"."escalations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verifications" ADD CONSTRAINT "verifications_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verifications" ADD CONSTRAINT "verifications_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_agent_provider_priority" ON "agent_providers" USING btree ("agent_id","priority");--> statement-breakpoint
CREATE INDEX "api_keys_org_id_idx" ON "api_keys" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "api_keys_key_hash_idx" ON "api_keys" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX "api_keys_project_id_idx" ON "api_keys" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "api_keys_user_id_idx" ON "api_keys" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "api_keys_resident_agent_id_idx" ON "api_keys" USING btree ("resident_agent_id");--> statement-breakpoint
CREATE INDEX "assets_org_id_idx" ON "assets" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "assets_thread_id_idx" ON "assets" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "assets_project_id_idx" ON "assets" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "assets_message_id_idx" ON "assets" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "collections_project_id_idx" ON "collections" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "collections_project_id_name_idx" ON "collections" USING btree ("project_id","name");--> statement-breakpoint
CREATE INDEX "decision_positions_proposal_id_idx" ON "decision_positions" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX "decision_proposals_org_id_idx" ON "decision_proposals" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "decision_proposals_org_id_status_idx" ON "decision_proposals" USING btree ("org_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "domains_org_id_domain_idx" ON "domains" USING btree ("org_id","domain");--> statement-breakpoint
CREATE UNIQUE INDEX "endpoints_project_path_method_idx" ON "endpoints" USING btree ("project_id","path","method");--> statement-breakpoint
CREATE INDEX "escalations_org_id_agent_id_idx" ON "escalations" USING btree ("org_id","agent_id");--> statement-breakpoint
CREATE INDEX "escalations_status_idx" ON "escalations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "escalations_org_id_dedupe_key_idx" ON "escalations" USING btree ("org_id","dedupe_key");--> statement-breakpoint
CREATE INDEX "functions_project_id_idx" ON "functions" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "functions_endpoint_id_idx" ON "functions" USING btree ("endpoint_id");--> statement-breakpoint
CREATE INDEX "invitations_org_id_idx" ON "invitations" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "invitations_email_idx" ON "invitations" USING btree ("email");--> statement-breakpoint
CREATE INDEX "invitations_status_idx" ON "invitations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "memories_org_id_agent_id_idx" ON "memories" USING btree ("org_id","agent_id");--> statement-breakpoint
CREATE INDEX "memories_embedding_idx" ON "memories" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "memories_text_search_idx" ON "memories" USING gin (to_tsvector('english', "text"));--> statement-breakpoint
CREATE INDEX "messages_thread_id_idx" ON "messages" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "messages_org_id_idx" ON "messages" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "messages_project_id_idx" ON "messages" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "ops_actions_org_id_agent_id_idx" ON "ops_actions" USING btree ("org_id","agent_id");--> statement-breakpoint
CREATE INDEX "ops_actions_status_idx" ON "ops_actions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ops_actions_org_id_status_idx" ON "ops_actions" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "orgs_owner_id_idx" ON "organizations" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "permission_overrides_user_org_perm_idx" ON "permission_overrides" USING btree ("user_id","org_id","permission") WHERE "permission_overrides"."org_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "permission_overrides_user_project_perm_idx" ON "permission_overrides" USING btree ("user_id","project_id","permission") WHERE "permission_overrides"."project_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "permission_overrides_user_id_idx" ON "permission_overrides" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "permission_overrides_org_id_idx" ON "permission_overrides" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "permission_overrides_project_id_idx" ON "permission_overrides" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_project_provider_project" ON "project_providers" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_org_name_idx" ON "projects" USING btree ("org_id","name");--> statement-breakpoint
CREATE INDEX "projects_org_id_idx" ON "projects" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "providers_org_id_idx" ON "providers" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quotas_org_period_idx" ON "quotas" USING btree ("org_id","period");--> statement-breakpoint
CREATE INDEX "records_collection_id_idx" ON "records" USING btree ("collection_id");--> statement-breakpoint
CREATE INDEX "records_project_id_idx" ON "records" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "records_data_idx" ON "records" USING gin ("data");--> statement-breakpoint
CREATE UNIQUE INDEX "roles_user_org_idx" ON "roles" USING btree ("user_id","org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "roles_user_project_idx" ON "roles" USING btree ("user_id","project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_sandbox_project_provider" ON "sandbox_project_providers" USING btree ("sandbox_id","project_id","provider_id");--> statement-breakpoint
CREATE INDEX "idx_sandbox_project_provider_lookup" ON "sandbox_project_providers" USING btree ("sandbox_id","project_id");--> statement-breakpoint
CREATE INDEX "idx_sandbox_project_provider_provider" ON "sandbox_project_providers" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "idx_sandbox_provider_sandbox" ON "sandbox_providers" USING btree ("sandbox_id");--> statement-breakpoint
CREATE INDEX "idx_sandbox_provider_priority" ON "sandbox_providers" USING btree ("sandbox_id","priority");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_sandbox_provider" ON "sandbox_providers" USING btree ("sandbox_id","provider_id");--> statement-breakpoint
CREATE INDEX "sandbox_sessions_sandbox_id_idx" ON "sandbox_sessions" USING btree ("sandbox_id");--> statement-breakpoint
CREATE INDEX "sandbox_sessions_org_id_idx" ON "sandbox_sessions" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "sandbox_sessions_sandbox_started_idx" ON "sandbox_sessions" USING btree ("sandbox_id","started_at");--> statement-breakpoint
CREATE INDEX "idx_sandbox_skill_sandbox" ON "sandbox_skills" USING btree ("sandbox_id");--> statement-breakpoint
CREATE INDEX "idx_sandbox_skill_sandbox_project" ON "sandbox_skills" USING btree ("sandbox_id","project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_sandbox_skill_org" ON "sandbox_skills" USING btree ("sandbox_id","skill_id") WHERE project_id IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_sandbox_skill_project" ON "sandbox_skills" USING btree ("sandbox_id","skill_id","project_id") WHERE project_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "sandboxes_org_idx" ON "sandboxes" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "sandboxes_org_user_idx" ON "sandboxes" USING btree ("org_id","user_id");--> statement-breakpoint
CREATE INDEX "schedule_runs_org_id_idx" ON "schedule_runs" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "schedule_runs_project_id_idx" ON "schedule_runs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "schedule_runs_schedule_id_idx" ON "schedule_runs" USING btree ("schedule_id");--> statement-breakpoint
CREATE INDEX "schedule_runs_schedule_started_idx" ON "schedule_runs" USING btree ("schedule_id","started_at");--> statement-breakpoint
CREATE INDEX "schedules_org_id_idx" ON "schedules" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "schedules_sandbox_id_idx" ON "schedules" USING btree ("sandbox_id");--> statement-breakpoint
CREATE INDEX "schedules_project_id_idx" ON "schedules" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "schedules_enabled_next_run_idx" ON "schedules" USING btree ("enabled","next_run_at");--> statement-breakpoint
CREATE INDEX "schedules_agent_id_idx" ON "schedules" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "secrets_org_id_idx" ON "secrets" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "secrets_project_id_idx" ON "secrets" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "secrets_provider_id_idx" ON "secrets" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "secrets_agent_id_idx" ON "secrets" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "skill_proposals_org_id_agent_id_idx" ON "skill_proposals" USING btree ("org_id","agent_id");--> statement-breakpoint
CREATE INDEX "skill_proposals_status_idx" ON "skill_proposals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "skills_org_id_idx" ON "skills" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "task_proposals_org_id_agent_id_idx" ON "task_proposals" USING btree ("org_id","agent_id");--> statement-breakpoint
CREATE INDEX "task_proposals_status_idx" ON "task_proposals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "task_proposals_org_id_dedupe_key_status_idx" ON "task_proposals" USING btree ("org_id","dedupe_key","status");--> statement-breakpoint
CREATE INDEX "task_proposals_parent_id_idx" ON "task_proposals" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "threads_user_id_idx" ON "threads" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "threads_agent_id_idx" ON "threads" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "threads_parent_thread_id_idx" ON "threads" USING btree ("parent_thread_id");--> statement-breakpoint
CREATE INDEX "threads_org_id_idx" ON "threads" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "threads_project_id_idx" ON "threads" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "verifications_org_id_agent_id_idx" ON "verifications" USING btree ("org_id","agent_id");--> statement-breakpoint
CREATE INDEX "verifications_status_idx" ON "verifications" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "verifications_org_id_pr_number_uidx" ON "verifications" USING btree ("org_id","pr_number");