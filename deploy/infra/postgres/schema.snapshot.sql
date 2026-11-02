-- Schema-only snapshot of the production Neon database (PostgreSQL 17.11, db neondb), captured 2026-11-02.
-- pg_dump --schema-only --no-owner --no-privileges, all schemas (public + neon_auth). Reference only:
-- the public schema is authoritative in repos/database/src/schemas (applied by pushSafe / drizzle-kit push).
-- caddy_certmagic_objects / caddy_locks are auto-created by the caddy-storage-postgresql plugin.
--
-- PostgreSQL database dump
--


-- Dumped from database version 17.11 (0bfbbeb)
-- Dumped by pg_dump version 17.11 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: neon_auth; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA neon_auth;


--
-- Name: vector; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;


--
-- Name: EXTENSION vector; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION vector IS 'vector data type and ivfflat and hnsw access methods';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: account; Type: TABLE; Schema: neon_auth; Owner: -
--

CREATE TABLE neon_auth.account (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "accountId" text NOT NULL,
    "providerId" text NOT NULL,
    "userId" uuid NOT NULL,
    "accessToken" text,
    "refreshToken" text,
    "idToken" text,
    "accessTokenExpiresAt" timestamp with time zone,
    "refreshTokenExpiresAt" timestamp with time zone,
    scope text,
    password text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


--
-- Name: invitation; Type: TABLE; Schema: neon_auth; Owner: -
--

CREATE TABLE neon_auth.invitation (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "organizationId" uuid NOT NULL,
    email text NOT NULL,
    role text,
    status text NOT NULL,
    "expiresAt" timestamp with time zone NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "inviterId" uuid NOT NULL
);


--
-- Name: jwks; Type: TABLE; Schema: neon_auth; Owner: -
--

CREATE TABLE neon_auth.jwks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "publicKey" text NOT NULL,
    "privateKey" text NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "expiresAt" timestamp with time zone,
    alg text,
    crv text
);


--
-- Name: member; Type: TABLE; Schema: neon_auth; Owner: -
--

CREATE TABLE neon_auth.member (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "organizationId" uuid NOT NULL,
    "userId" uuid NOT NULL,
    role text NOT NULL,
    "createdAt" timestamp with time zone NOT NULL
);


--
-- Name: organization; Type: TABLE; Schema: neon_auth; Owner: -
--

CREATE TABLE neon_auth.organization (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    logo text,
    "createdAt" timestamp with time zone NOT NULL,
    metadata text
);


--
-- Name: project_config; Type: TABLE; Schema: neon_auth; Owner: -
--

CREATE TABLE neon_auth.project_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    endpoint_id text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    trusted_origins jsonb NOT NULL,
    social_providers jsonb NOT NULL,
    email_provider jsonb,
    email_and_password jsonb,
    allow_localhost boolean NOT NULL,
    plugin_configs jsonb,
    webhook_config jsonb
);


--
-- Name: session; Type: TABLE; Schema: neon_auth; Owner: -
--

CREATE TABLE neon_auth.session (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "expiresAt" timestamp with time zone NOT NULL,
    token text NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "ipAddress" text,
    "userAgent" text,
    "userId" uuid NOT NULL,
    "impersonatedBy" text,
    "activeOrganizationId" text
);


--
-- Name: user; Type: TABLE; Schema: neon_auth; Owner: -
--

CREATE TABLE neon_auth."user" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    "emailVerified" boolean NOT NULL,
    image text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    role text,
    banned boolean,
    "banReason" text,
    "banExpires" timestamp with time zone
);


--
-- Name: verification; Type: TABLE; Schema: neon_auth; Owner: -
--

CREATE TABLE neon_auth.verification (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    identifier text NOT NULL,
    value text NOT NULL,
    "expiresAt" timestamp with time zone NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: agent_projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_projects (
    id character varying(10) NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    agent_id character varying(10) NOT NULL,
    project_id character varying(10) NOT NULL,
    alias text,
    model text,
    max_tokens integer,
    system_prompt text,
    tools jsonb,
    function_ids jsonb,
    env_vars jsonb,
    environment jsonb,
    enabled boolean DEFAULT true
);


--
-- Name: agent_providers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_providers (
    id character varying(10) NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    agent_id character varying(10) NOT NULL,
    provider_id character varying(10) NOT NULL,
    priority integer DEFAULT 0,
    model text
);


--
-- Name: agent_skills; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_skills (
    id character varying(10) NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    agent_id character varying(10) NOT NULL,
    skill_id character varying(10) NOT NULL
);


--
-- Name: agents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agents (
    id character varying(10) NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    name text NOT NULL,
    description text,
    org_id character varying(10) NOT NULL,
    system_prompt text,
    model text,
    max_tokens integer DEFAULT 100000,
    tools jsonb DEFAULT '[]'::jsonb,
    env_vars jsonb DEFAULT '{}'::jsonb,
    environment jsonb DEFAULT '{}'::jsonb,
    active boolean DEFAULT true,
    soul text,
    autonomous boolean DEFAULT false,
    brain character varying(20) DEFAULT 'api'::character varying NOT NULL
);


--
-- Name: api_keys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.api_keys (
    id character varying(10) NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    name text NOT NULL,
    expires_at timestamp without time zone,
    last_used_at timestamp without time zone,
    active boolean DEFAULT true,
    rate_limit integer DEFAULT 100,
    key_hash text NOT NULL,
    key_prefix character varying(12) NOT NULL,
    org_id character varying(10),
    project_id character varying(10),
    user_id uuid,
    permissions text[],
    resident_agent_id character varying(10),
    CONSTRAINT api_key_scope_check CHECK ((((org_id IS NOT NULL) AND (project_id IS NULL)) OR ((org_id IS NULL) AND (project_id IS NOT NULL)) OR ((org_id IS NULL) AND (project_id IS NULL))))
);


--
-- Name: assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assets (
    id character varying(10) NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    url text,
    meta jsonb,
    content jsonb,
    name text NOT NULL,
    type text NOT NULL,
    provider_id character varying(10),
    org_id character varying(10),
    user_id uuid,
    thread_id character varying(10),
    project_id character varying(10),
    message_id character varying(10),
    CONSTRAINT asset_owner_check CHECK ((((((((org_id IS NOT NULL))::integer + ((project_id IS NOT NULL))::integer) + ((user_id IS NOT NULL))::integer) + ((thread_id IS NOT NULL))::integer) + ((message_id IS NOT NULL))::integer) = 1))
);


--
-- Name: caddy_certmagic_objects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.caddy_certmagic_objects (
    parent text NOT NULL,
    name text NOT NULL,
    is_file boolean NOT NULL,
    value bytea,
    modified timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT caddy_certmagic_objects_chk CHECK ((((is_file = true) AND (value IS NOT NULL)) OR ((is_file = false) AND (value IS NULL))))
);


--
-- Name: caddy_locks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.caddy_locks (
    name character varying(255) NOT NULL,
    record_version_number bigint,
    data bytea,
    owner character varying(255)
);


--
-- Name: caddy_locks_rvn; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.caddy_locks_rvn
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
    CYCLE;


--
-- Name: caddy_locks_rvn; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.caddy_locks_rvn OWNED BY public.caddy_locks.record_version_number;


--
-- Name: collections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.collections (
    id character varying(10) NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    name text NOT NULL,
    description text,
    schema jsonb,
    project_id character varying(10) NOT NULL
);


--
-- Name: company_strategies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.company_strategies (
    id character varying(10) NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    north_star text,
    segments jsonb DEFAULT '[]'::jsonb,
    positioning text,
    backlog jsonb DEFAULT '[]'::jsonb,
    active_initiative jsonb,
    org_id character varying(10) NOT NULL,
    updated_by_agent_id character varying(10)
);


--
-- Name: decision_positions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.decision_positions (
    id character varying(10) NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    stance character varying(12) NOT NULL,
    reasoning text NOT NULL,
    round integer NOT NULL,
    org_id character varying(10) NOT NULL,
    proposal_id character varying(10) NOT NULL,
    agent_id character varying(10) NOT NULL
);


--
-- Name: decision_proposals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.decision_proposals (
    id character varying(10) NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    title text NOT NULL,
    axis character varying(20) NOT NULL,
    description text NOT NULL,
    evidence jsonb DEFAULT '[]'::jsonb,
    status character varying(20) DEFAULT 'open'::character varying NOT NULL,
    round integer DEFAULT 1 NOT NULL,
    resolution text,
    resolved_ref text,
    org_id character varying(10) NOT NULL,
    opened_by_agent_id character varying(10) NOT NULL
);


--
-- Name: domains; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domains (
    id character varying(10) NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    domain text NOT NULL,
    verified_at timestamp without time zone,
    ssl_private_key text,
    ssl_certificate text,
    ssl_expires_at timestamp without time zone,
    verified boolean DEFAULT false NOT NULL,
    ssl_enabled boolean DEFAULT false NOT NULL,
    org_id character varying(10),
    project_id character varying(10),
    CONSTRAINT domain_owner_check CHECK (((((org_id IS NOT NULL))::integer + ((project_id IS NOT NULL))::integer) = 1))
);


--
-- Name: endpoints; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.endpoints (
    id character varying(10) NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    name text,
    headers jsonb,
    options jsonb,
    path text NOT NULL,
    public boolean DEFAULT false,
    method character varying(10) DEFAULT 'GET'::character varying,
    type character varying(10) DEFAULT 'proxy'::character varying NOT NULL,
    project_id character varying(10) NOT NULL,
    meta jsonb
);


--
-- Name: escalations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.escalations (
    id character varying(10) NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    title text NOT NULL,
    problem text NOT NULL,
    evidence jsonb DEFAULT '[]'::jsonb,
    proposed_patch text,
    target character varying(12) NOT NULL,
    status character varying(12) DEFAULT 'open'::character varying NOT NULL,
    dedupe_key character varying(200) NOT NULL,
    issue_ref text,
    resolved_ref text,
    reason text,
    meta jsonb,
    org_id character varying(10) NOT NULL,
    agent_id character varying(10) NOT NULL
);


--
-- Name: functions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.functions (
    id character varying(10) NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    name text NOT NULL,
    description text,
    content text NOT NULL,
    branch text DEFAULT 'main'::text,
    default_args jsonb DEFAULT '{}'::jsonb,
    dependencies jsonb DEFAULT '{}'::jsonb,
    input_schema jsonb DEFAULT '[]'::jsonb,
    language character varying(50) DEFAULT 'typescript'::character varying,
    endpoint_id character varying(10),
    project_id character varying(10) NOT NULL,
    meta jsonb
);


--
-- Name: invitations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invitations (
    id character varying(10) NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    email text NOT NULL,
    user_id uuid,
    role_type text NOT NULL,
    org_id character varying(10) NOT NULL,
    invited_by uuid,
    token text NOT NULL,
    revoked_at timestamp without time zone,
    accepted_at timestamp without time zone,
    expires_at timestamp without time zone NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    revoked_by uuid,
    project_roles jsonb,
    permission_overrides jsonb
);


--
-- Name: invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoices (
    id character varying(10) NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    user_id uuid NOT NULL,
    stripe_invoice_id text NOT NULL,
    amount integer DEFAULT 0 NOT NULL,
    currency text DEFAULT 'usd'::text NOT NULL,
    status text NOT NULL,
    invoice_url text,
    period text NOT NULL
);


--
-- Name: memories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.memories (
    id character varying(10) NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    kind character varying(20) DEFAULT 'fact'::character varying NOT NULL,
    text text NOT NULL,
    importance integer DEFAULT 5 NOT NULL,
    last_accessed_at timestamp without time zone DEFAULT now() NOT NULL,
    embedding public.vector(1024),
    meta jsonb,
    org_id character varying(10) NOT NULL,
    agent_id character varying(10) NOT NULL
);


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id character varying(10) NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    meta jsonb,
    type text NOT NULL,
    content jsonb NOT NULL,
    org_id character varying(10),
    project_id character varying(10),
    thread_id character varying(10) NOT NULL
);


--
-- Name: ops_actions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ops_actions (
    id character varying(10) NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    action character varying(40) NOT NULL,
    params jsonb NOT NULL,
    dry_run boolean DEFAULT true NOT NULL,
    dry_run_result jsonb,
    result jsonb,
    status character varying(20) DEFAULT 'proposed'::character varying NOT NULL,
    scan_result jsonb,
    review_verdict jsonb,
    rollback jsonb,
    reason text,
    meta jsonb,
    org_id character varying(10) NOT NULL,
    agent_id character varying(10) NOT NULL
);


--
-- Name: organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizations (
    id character varying(10) NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    name text NOT NULL,
    description text,
    config jsonb,
    owner_id uuid NOT NULL
);


--
-- Name: permission_overrides; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permission_overrides (
    id character varying(10) NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    permission text NOT NULL,
    effect text NOT NULL,
    user_id uuid NOT NULL,
    org_id character varying(10),
    project_id character varying(10),
    granted_by uuid NOT NULL,
    reason text,
    expires_at timestamp without time zone,
    CONSTRAINT permission_override_effect_check CHECK ((effect = ANY (ARRAY['grant'::text, 'deny'::text]))),
    CONSTRAINT permission_override_scope_check CHECK ((((org_id IS NOT NULL) AND (project_id IS NULL)) OR ((org_id IS NULL) AND (project_id IS NOT NULL))))
);


--
-- Name: project_providers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_providers (
    id character varying(10) NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    project_id character varying(10) NOT NULL,
    provider_id character varying(10) NOT NULL,
    priority integer DEFAULT 0
);


--
-- Name: projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projects (
    id character varying(10) NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    meta jsonb,
    name text NOT NULL,
    description text,
    org_id character varying(10) NOT NULL
);


--
-- Name: providers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.providers (
    id character varying(10) NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    name text,
    brand text,
    type text NOT NULL,
    options jsonb,
    headers jsonb,
    body_params jsonb,
    secret_id character varying(10),
    org_id character varying(10) NOT NULL
);


--
-- Name: quotas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quotas (
    id character varying(10) NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    org_id character varying(10) NOT NULL,
    period text NOT NULL,
    projects integer DEFAULT 0 NOT NULL,
    compute integer DEFAULT 0 NOT NULL,
    threads integer DEFAULT 0 NOT NULL,
    messages integer DEFAULT 0 NOT NULL,
    endpoints integer DEFAULT 0 NOT NULL,
    secrets integer DEFAULT 0 NOT NULL
);


--
-- Name: records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.records (
    id character varying(10) NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    data jsonb NOT NULL,
    collection_id character varying(10) NOT NULL,
    project_id character varying(10) NOT NULL
);


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id character varying(10) NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    name text,
    type text NOT NULL,
    org_id character varying(10),
    project_id character varying(10),
    user_id uuid NOT NULL,
    CONSTRAINT role_scope_check CHECK ((((org_id IS NOT NULL) AND (project_id IS NULL)) OR ((org_id IS NULL) AND (project_id IS NOT NULL))))
);


--
-- Name: sandbox_project_providers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sandbox_project_providers (
    id character varying(10) NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    sandbox_id character varying(10) NOT NULL,
    project_id character varying(10) NOT NULL,
    provider_id character varying(10) NOT NULL,
    priority integer DEFAULT 0,
    branch text
);


--
-- Name: sandbox_projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sandbox_projects (
    id character varying(10) NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    sandbox_id character varying(10) NOT NULL,
    project_id character varying(10) NOT NULL,
    alias text NOT NULL,
    enabled boolean DEFAULT true,
    config jsonb
);


--
-- Name: sandbox_providers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sandbox_providers (
    id character varying(10) NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    sandbox_id character varying(10) NOT NULL,
    provider_id character varying(10) NOT NULL,
    model text,
    priority integer DEFAULT 0
);


--
-- Name: sandbox_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sandbox_sessions (
    id character varying(10) NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    duration_ms integer,
    stdout_key character varying(255),
    stderr_key character varying(255),
    status character varying(20) NOT NULL,
    session_id character varying(20) NOT NULL,
    instance_id character varying(100) NOT NULL,
    completed_at timestamp with time zone,
    started_at timestamp with time zone NOT NULL,
    sandbox_id character varying(10) NOT NULL,
    org_id character varying(10) NOT NULL,
    user_id uuid NOT NULL,
    project_id character varying(10)
);


--
-- Name: sandbox_skills; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sandbox_skills (
    id character varying(10) NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    sandbox_id character varying(10) NOT NULL,
    skill_id character varying(10) NOT NULL,
    project_id character varying(10),
    priority integer DEFAULT 0
);


--
-- Name: sandbox_starting_claims; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sandbox_starting_claims (
    id character varying(10) NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    released_at timestamp with time zone,
    claimed_at timestamp with time zone NOT NULL,
    sandbox_id character varying(10) NOT NULL
);


--
-- Name: sandboxes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sandboxes (
    id character varying(10) NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    name text NOT NULL,
    org_id character varying(10) NOT NULL,
    user_id uuid,
    config jsonb NOT NULL,
    built_in boolean DEFAULT false NOT NULL
);


--
-- Name: schedule_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schedule_runs (
    id character varying(10) NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    error text,
    duration_ms integer,
    stdout_key character varying(255),
    stderr_key character varying(255),
    status character varying(20) NOT NULL,
    instance_id character varying(100),
    completed_at timestamp with time zone,
    started_at timestamp with time zone NOT NULL,
    schedule_id character varying(10) NOT NULL,
    org_id character varying(10) NOT NULL,
    project_id character varying(10) NOT NULL
);


--
-- Name: schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schedules (
    id character varying(10) NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    org_id character varying(10) NOT NULL,
    cron_expression character varying(255) NOT NULL,
    prompt text,
    enabled boolean DEFAULT true NOT NULL,
    last_run_at timestamp without time zone,
    next_run_at timestamp without time zone,
    max_consecutive_errors integer DEFAULT 5 NOT NULL,
    consecutive_errors integer DEFAULT 0 NOT NULL,
    command text,
    type character varying(20) DEFAULT 'prompt'::character varying NOT NULL,
    user_id uuid,
    sandbox_id character varying(10) NOT NULL,
    project_id character varying(10) NOT NULL,
    agent_id character varying(10),
    thread_id character varying(10),
    timeout_ms integer,
    context_sources jsonb,
    actions jsonb
);


--
-- Name: secrets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.secrets (
    id character varying(10) NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    name text NOT NULL,
    description text,
    hash_key text NOT NULL,
    encrypted_value text NOT NULL,
    org_id character varying(10),
    project_id character varying(10),
    provider_id character varying(10),
    agent_id character varying(10),
    CONSTRAINT secret_scope_check CHECK ((((org_id IS NOT NULL) AND (project_id IS NULL) AND (provider_id IS NULL) AND (agent_id IS NULL)) OR ((org_id IS NULL) AND (project_id IS NOT NULL) AND (provider_id IS NULL) AND (agent_id IS NULL)) OR ((org_id IS NULL) AND (project_id IS NULL) AND (provider_id IS NOT NULL) AND (agent_id IS NULL)) OR ((org_id IS NULL) AND (project_id IS NULL) AND (provider_id IS NULL) AND (agent_id IS NOT NULL)) OR ((org_id IS NOT NULL) AND (provider_id IS NOT NULL) AND (project_id IS NULL) AND (agent_id IS NULL))))
);


--
-- Name: skill_proposals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.skill_proposals (
    id character varying(10) NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    instructions text NOT NULL,
    trigger_keywords jsonb DEFAULT '[]'::jsonb,
    tools jsonb DEFAULT '[]'::jsonb,
    always_active boolean DEFAULT false NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    scan_result jsonb,
    audit_verdict jsonb,
    promoted_skill_id character varying(10),
    reason text,
    meta jsonb,
    org_id character varying(10) NOT NULL,
    agent_id character varying(10) NOT NULL
);


--
-- Name: skills; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.skills (
    id character varying(10) NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    instructions text NOT NULL,
    trigger_keywords jsonb DEFAULT '[]'::jsonb,
    tools jsonb DEFAULT '[]'::jsonb,
    always_active boolean DEFAULT false NOT NULL,
    org_id character varying(10) NOT NULL
);


--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscriptions (
    id character varying(10) NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    user_id uuid NOT NULL,
    tier text DEFAULT 'free'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    stripe_customer_id text,
    stripe_subscription_id text,
    stripe_price_id text,
    current_period_start timestamp without time zone,
    current_period_end timestamp without time zone,
    cancel_at_period_end boolean DEFAULT false,
    seats integer DEFAULT 1
);


--
-- Name: task_proposals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_proposals (
    id character varying(10) NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    priority character varying(4),
    evidence text NOT NULL,
    source_signal character varying(20),
    dedupe_key character varying(200) NOT NULL,
    repos jsonb DEFAULT '[]'::jsonb,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    scan_result jsonb,
    audit_verdict jsonb,
    meta jsonb,
    pr_url text,
    reason text,
    initiative text,
    parent_id character varying(10),
    org_id character varying(10) NOT NULL,
    agent_id character varying(10) NOT NULL
);


--
-- Name: threads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.threads (
    id character varying(10) NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    name text,
    meta jsonb,
    public boolean DEFAULT false,
    parent_thread_id character varying(10),
    branch_message_id character varying(10),
    provider_id character varying(10),
    agent_id character varying(10),
    org_id character varying(10),
    project_id character varying(10),
    user_id uuid NOT NULL
);


--
-- Name: verifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.verifications (
    id character varying(10) NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    pr_number integer NOT NULL,
    pr_url text,
    merge_sha character varying(40),
    probe jsonb NOT NULL,
    status character varying(12) DEFAULT 'pending'::character varying NOT NULL,
    detail text,
    revert_pr_url text,
    escalation_id character varying(10),
    meta jsonb,
    org_id character varying(10) NOT NULL,
    agent_id character varying(10) NOT NULL
);


--
-- Name: account account_pkey; Type: CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.account
    ADD CONSTRAINT account_pkey PRIMARY KEY (id);


--
-- Name: invitation invitation_pkey; Type: CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.invitation
    ADD CONSTRAINT invitation_pkey PRIMARY KEY (id);


--
-- Name: jwks jwks_pkey; Type: CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.jwks
    ADD CONSTRAINT jwks_pkey PRIMARY KEY (id);


--
-- Name: member member_pkey; Type: CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.member
    ADD CONSTRAINT member_pkey PRIMARY KEY (id);


--
-- Name: organization organization_pkey; Type: CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.organization
    ADD CONSTRAINT organization_pkey PRIMARY KEY (id);


--
-- Name: organization organization_slug_key; Type: CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.organization
    ADD CONSTRAINT organization_slug_key UNIQUE (slug);


--
-- Name: project_config project_config_endpoint_id_key; Type: CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.project_config
    ADD CONSTRAINT project_config_endpoint_id_key UNIQUE (endpoint_id);


--
-- Name: project_config project_config_pkey; Type: CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.project_config
    ADD CONSTRAINT project_config_pkey PRIMARY KEY (id);


--
-- Name: session session_pkey; Type: CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.session
    ADD CONSTRAINT session_pkey PRIMARY KEY (id);


--
-- Name: session session_token_key; Type: CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.session
    ADD CONSTRAINT session_token_key UNIQUE (token);


--
-- Name: user user_email_key; Type: CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth."user"
    ADD CONSTRAINT user_email_key UNIQUE (email);


--
-- Name: user user_pkey; Type: CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth."user"
    ADD CONSTRAINT user_pkey PRIMARY KEY (id);


--
-- Name: verification verification_pkey; Type: CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.verification
    ADD CONSTRAINT verification_pkey PRIMARY KEY (id);


--
-- Name: agent_projects agent_projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_projects
    ADD CONSTRAINT agent_projects_pkey PRIMARY KEY (id);


--
-- Name: agent_providers agent_providers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_providers
    ADD CONSTRAINT agent_providers_pkey PRIMARY KEY (id);


--
-- Name: agent_skills agent_skills_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_skills
    ADD CONSTRAINT agent_skills_pkey PRIMARY KEY (id);


--
-- Name: agents agents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agents
    ADD CONSTRAINT agents_pkey PRIMARY KEY (id);


--
-- Name: api_keys api_keys_key_hash_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_key_hash_unique UNIQUE (key_hash);


--
-- Name: api_keys api_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_pkey PRIMARY KEY (id);


--
-- Name: assets assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_pkey PRIMARY KEY (id);


--
-- Name: caddy_certmagic_objects caddy_certmagic_objects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caddy_certmagic_objects
    ADD CONSTRAINT caddy_certmagic_objects_pkey PRIMARY KEY (parent, name);


--
-- Name: caddy_locks caddy_locks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caddy_locks
    ADD CONSTRAINT caddy_locks_pkey PRIMARY KEY (name);


--
-- Name: collections collections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collections
    ADD CONSTRAINT collections_pkey PRIMARY KEY (id);


--
-- Name: company_strategies company_strategies_org_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_strategies
    ADD CONSTRAINT company_strategies_org_id_unique UNIQUE (org_id);


--
-- Name: company_strategies company_strategies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_strategies
    ADD CONSTRAINT company_strategies_pkey PRIMARY KEY (id);


--
-- Name: decision_positions decision_positions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.decision_positions
    ADD CONSTRAINT decision_positions_pkey PRIMARY KEY (id);


--
-- Name: decision_proposals decision_proposals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.decision_proposals
    ADD CONSTRAINT decision_proposals_pkey PRIMARY KEY (id);


--
-- Name: domains domains_domain_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domains
    ADD CONSTRAINT domains_domain_unique UNIQUE (domain);


--
-- Name: domains domains_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domains
    ADD CONSTRAINT domains_pkey PRIMARY KEY (id);


--
-- Name: endpoints endpoints_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.endpoints
    ADD CONSTRAINT endpoints_pkey PRIMARY KEY (id);


--
-- Name: escalations escalations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.escalations
    ADD CONSTRAINT escalations_pkey PRIMARY KEY (id);


--
-- Name: functions functions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.functions
    ADD CONSTRAINT functions_pkey PRIMARY KEY (id);


--
-- Name: invitations invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_pkey PRIMARY KEY (id);


--
-- Name: invitations invitations_token_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_token_unique UNIQUE (token);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_stripe_invoice_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_stripe_invoice_id_unique UNIQUE (stripe_invoice_id);


--
-- Name: memories memories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memories
    ADD CONSTRAINT memories_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: ops_actions ops_actions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ops_actions
    ADD CONSTRAINT ops_actions_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: permission_overrides permission_overrides_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permission_overrides
    ADD CONSTRAINT permission_overrides_pkey PRIMARY KEY (id);


--
-- Name: project_providers project_providers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_providers
    ADD CONSTRAINT project_providers_pkey PRIMARY KEY (id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: providers providers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.providers
    ADD CONSTRAINT providers_pkey PRIMARY KEY (id);


--
-- Name: quotas quotas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotas
    ADD CONSTRAINT quotas_pkey PRIMARY KEY (id);


--
-- Name: records records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.records
    ADD CONSTRAINT records_pkey PRIMARY KEY (id);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: sandbox_project_providers sandbox_project_providers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sandbox_project_providers
    ADD CONSTRAINT sandbox_project_providers_pkey PRIMARY KEY (id);


--
-- Name: sandbox_projects sandbox_projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sandbox_projects
    ADD CONSTRAINT sandbox_projects_pkey PRIMARY KEY (id);


--
-- Name: sandbox_providers sandbox_providers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sandbox_providers
    ADD CONSTRAINT sandbox_providers_pkey PRIMARY KEY (id);


--
-- Name: sandbox_sessions sandbox_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sandbox_sessions
    ADD CONSTRAINT sandbox_sessions_pkey PRIMARY KEY (id);


--
-- Name: sandbox_skills sandbox_skills_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sandbox_skills
    ADD CONSTRAINT sandbox_skills_pkey PRIMARY KEY (id);


--
-- Name: sandbox_starting_claims sandbox_starting_claims_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sandbox_starting_claims
    ADD CONSTRAINT sandbox_starting_claims_pkey PRIMARY KEY (id);


--
-- Name: sandboxes sandboxes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sandboxes
    ADD CONSTRAINT sandboxes_pkey PRIMARY KEY (id);


--
-- Name: schedule_runs schedule_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_runs
    ADD CONSTRAINT schedule_runs_pkey PRIMARY KEY (id);


--
-- Name: schedules schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedules
    ADD CONSTRAINT schedules_pkey PRIMARY KEY (id);


--
-- Name: secrets secrets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.secrets
    ADD CONSTRAINT secrets_pkey PRIMARY KEY (id);


--
-- Name: skill_proposals skill_proposals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skill_proposals
    ADD CONSTRAINT skill_proposals_pkey PRIMARY KEY (id);


--
-- Name: skills skills_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skills
    ADD CONSTRAINT skills_pkey PRIMARY KEY (id);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);


--
-- Name: subscriptions subscriptions_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_user_id_unique UNIQUE (user_id);


--
-- Name: task_proposals task_proposals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_proposals
    ADD CONSTRAINT task_proposals_pkey PRIMARY KEY (id);


--
-- Name: threads threads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.threads
    ADD CONSTRAINT threads_pkey PRIMARY KEY (id);


--
-- Name: agent_projects unique_agent_project; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_projects
    ADD CONSTRAINT unique_agent_project UNIQUE (agent_id, project_id);


--
-- Name: agent_providers unique_agent_provider; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_providers
    ADD CONSTRAINT unique_agent_provider UNIQUE (agent_id, provider_id);


--
-- Name: agent_skills unique_agent_skill; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_skills
    ADD CONSTRAINT unique_agent_skill UNIQUE (agent_id, skill_id);


--
-- Name: decision_positions unique_decision_position_round; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.decision_positions
    ADD CONSTRAINT unique_decision_position_round UNIQUE (proposal_id, agent_id, round);


--
-- Name: sandbox_projects unique_project_alias; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sandbox_projects
    ADD CONSTRAINT unique_project_alias UNIQUE (project_id, alias);


--
-- Name: project_providers unique_project_provider; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_providers
    ADD CONSTRAINT unique_project_provider UNIQUE (project_id, provider_id);


--
-- Name: sandbox_projects unique_sandbox_project; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sandbox_projects
    ADD CONSTRAINT unique_sandbox_project UNIQUE (sandbox_id, project_id);


--
-- Name: verifications verifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verifications
    ADD CONSTRAINT verifications_pkey PRIMARY KEY (id);


--
-- Name: account_userId_idx; Type: INDEX; Schema: neon_auth; Owner: -
--

CREATE INDEX "account_userId_idx" ON neon_auth.account USING btree ("userId");


--
-- Name: invitation_email_idx; Type: INDEX; Schema: neon_auth; Owner: -
--

CREATE INDEX invitation_email_idx ON neon_auth.invitation USING btree (email);


--
-- Name: invitation_organizationId_idx; Type: INDEX; Schema: neon_auth; Owner: -
--

CREATE INDEX "invitation_organizationId_idx" ON neon_auth.invitation USING btree ("organizationId");


--
-- Name: member_organizationId_idx; Type: INDEX; Schema: neon_auth; Owner: -
--

CREATE INDEX "member_organizationId_idx" ON neon_auth.member USING btree ("organizationId");


--
-- Name: member_userId_idx; Type: INDEX; Schema: neon_auth; Owner: -
--

CREATE INDEX "member_userId_idx" ON neon_auth.member USING btree ("userId");


--
-- Name: organization_slug_uidx; Type: INDEX; Schema: neon_auth; Owner: -
--

CREATE UNIQUE INDEX organization_slug_uidx ON neon_auth.organization USING btree (slug);


--
-- Name: session_userId_idx; Type: INDEX; Schema: neon_auth; Owner: -
--

CREATE INDEX "session_userId_idx" ON neon_auth.session USING btree ("userId");


--
-- Name: verification_identifier_idx; Type: INDEX; Schema: neon_auth; Owner: -
--

CREATE INDEX verification_identifier_idx ON neon_auth.verification USING btree (identifier);


--
-- Name: api_keys_key_hash_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX api_keys_key_hash_idx ON public.api_keys USING btree (key_hash);


--
-- Name: api_keys_org_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX api_keys_org_id_idx ON public.api_keys USING btree (org_id);


--
-- Name: api_keys_project_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX api_keys_project_id_idx ON public.api_keys USING btree (project_id);


--
-- Name: api_keys_resident_agent_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX api_keys_resident_agent_id_idx ON public.api_keys USING btree (resident_agent_id);


--
-- Name: api_keys_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX api_keys_user_id_idx ON public.api_keys USING btree (user_id);


--
-- Name: assets_message_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX assets_message_id_idx ON public.assets USING btree (message_id);


--
-- Name: assets_org_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX assets_org_id_idx ON public.assets USING btree (org_id);


--
-- Name: assets_project_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX assets_project_id_idx ON public.assets USING btree (project_id);


--
-- Name: assets_thread_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX assets_thread_id_idx ON public.assets USING btree (thread_id);


--
-- Name: caddy_certmagic_objects_parent_like_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX caddy_certmagic_objects_parent_like_idx ON public.caddy_certmagic_objects USING btree (parent text_pattern_ops);


--
-- Name: collections_project_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX collections_project_id_idx ON public.collections USING btree (project_id);


--
-- Name: collections_project_id_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX collections_project_id_name_idx ON public.collections USING btree (project_id, name);


--
-- Name: decision_positions_proposal_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX decision_positions_proposal_id_idx ON public.decision_positions USING btree (proposal_id);


--
-- Name: decision_proposals_org_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX decision_proposals_org_id_idx ON public.decision_proposals USING btree (org_id);


--
-- Name: decision_proposals_org_id_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX decision_proposals_org_id_status_idx ON public.decision_proposals USING btree (org_id, status);


--
-- Name: domains_org_id_domain_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domains_org_id_domain_idx ON public.domains USING btree (org_id, domain);


--
-- Name: endpoints_project_path_method_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX endpoints_project_path_method_idx ON public.endpoints USING btree (project_id, path, method);


--
-- Name: escalations_org_id_agent_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX escalations_org_id_agent_id_idx ON public.escalations USING btree (org_id, agent_id);


--
-- Name: escalations_org_id_dedupe_key_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX escalations_org_id_dedupe_key_idx ON public.escalations USING btree (org_id, dedupe_key);


--
-- Name: escalations_org_id_dedupe_key_open_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX escalations_org_id_dedupe_key_open_idx ON public.escalations USING btree (org_id, dedupe_key) WHERE ((status)::text = ANY ((ARRAY['open'::character varying, 'routed'::character varying])::text[]));


--
-- Name: escalations_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX escalations_status_idx ON public.escalations USING btree (status);


--
-- Name: functions_endpoint_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX functions_endpoint_id_idx ON public.functions USING btree (endpoint_id);


--
-- Name: functions_project_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX functions_project_id_idx ON public.functions USING btree (project_id);


--
-- Name: idx_agent_provider_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_provider_priority ON public.agent_providers USING btree (agent_id, priority);


--
-- Name: idx_project_provider_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_provider_project ON public.project_providers USING btree (project_id);


--
-- Name: idx_sandbox_project_provider_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sandbox_project_provider_lookup ON public.sandbox_project_providers USING btree (sandbox_id, project_id);


--
-- Name: idx_sandbox_project_provider_provider; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sandbox_project_provider_provider ON public.sandbox_project_providers USING btree (provider_id);


--
-- Name: idx_sandbox_provider_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sandbox_provider_priority ON public.sandbox_providers USING btree (sandbox_id, priority);


--
-- Name: idx_sandbox_provider_sandbox; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sandbox_provider_sandbox ON public.sandbox_providers USING btree (sandbox_id);


--
-- Name: idx_sandbox_skill_sandbox; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sandbox_skill_sandbox ON public.sandbox_skills USING btree (sandbox_id);


--
-- Name: idx_sandbox_skill_sandbox_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sandbox_skill_sandbox_project ON public.sandbox_skills USING btree (sandbox_id, project_id);


--
-- Name: invitations_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invitations_email_idx ON public.invitations USING btree (email);


--
-- Name: invitations_org_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invitations_org_id_idx ON public.invitations USING btree (org_id);


--
-- Name: invitations_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invitations_status_idx ON public.invitations USING btree (status);


--
-- Name: invoices_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invoices_user_id_idx ON public.invoices USING btree (user_id);


--
-- Name: memories_embedding_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX memories_embedding_idx ON public.memories USING hnsw (embedding public.vector_cosine_ops);


--
-- Name: memories_org_id_agent_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX memories_org_id_agent_id_idx ON public.memories USING btree (org_id, agent_id);


--
-- Name: memories_text_search_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX memories_text_search_idx ON public.memories USING gin (to_tsvector('english'::regconfig, text));


--
-- Name: messages_org_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX messages_org_id_idx ON public.messages USING btree (org_id);


--
-- Name: messages_project_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX messages_project_id_idx ON public.messages USING btree (project_id);


--
-- Name: messages_thread_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX messages_thread_id_idx ON public.messages USING btree (thread_id);


--
-- Name: ops_actions_org_id_agent_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ops_actions_org_id_agent_id_idx ON public.ops_actions USING btree (org_id, agent_id);


--
-- Name: ops_actions_org_id_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ops_actions_org_id_status_idx ON public.ops_actions USING btree (org_id, status);


--
-- Name: ops_actions_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ops_actions_status_idx ON public.ops_actions USING btree (status);


--
-- Name: orgs_owner_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX orgs_owner_id_idx ON public.organizations USING btree (owner_id);


--
-- Name: permission_overrides_org_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX permission_overrides_org_id_idx ON public.permission_overrides USING btree (org_id);


--
-- Name: permission_overrides_project_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX permission_overrides_project_id_idx ON public.permission_overrides USING btree (project_id);


--
-- Name: permission_overrides_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX permission_overrides_user_id_idx ON public.permission_overrides USING btree (user_id);


--
-- Name: permission_overrides_user_org_perm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX permission_overrides_user_org_perm_idx ON public.permission_overrides USING btree (user_id, org_id, permission) WHERE (org_id IS NOT NULL);


--
-- Name: permission_overrides_user_project_perm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX permission_overrides_user_project_perm_idx ON public.permission_overrides USING btree (user_id, project_id, permission) WHERE (project_id IS NOT NULL);


--
-- Name: projects_org_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX projects_org_id_idx ON public.projects USING btree (org_id);


--
-- Name: projects_org_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX projects_org_name_idx ON public.projects USING btree (org_id, name);


--
-- Name: providers_org_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX providers_org_id_idx ON public.providers USING btree (org_id);


--
-- Name: quotas_org_period_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX quotas_org_period_idx ON public.quotas USING btree (org_id, period);


--
-- Name: records_collection_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX records_collection_id_idx ON public.records USING btree (collection_id);


--
-- Name: records_data_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX records_data_idx ON public.records USING gin (data);


--
-- Name: records_project_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX records_project_id_idx ON public.records USING btree (project_id);


--
-- Name: roles_user_org_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX roles_user_org_idx ON public.roles USING btree (user_id, org_id);


--
-- Name: roles_user_project_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX roles_user_project_idx ON public.roles USING btree (user_id, project_id);


--
-- Name: sandbox_sessions_org_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sandbox_sessions_org_id_idx ON public.sandbox_sessions USING btree (org_id);


--
-- Name: sandbox_sessions_sandbox_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sandbox_sessions_sandbox_id_idx ON public.sandbox_sessions USING btree (sandbox_id);


--
-- Name: sandbox_sessions_sandbox_started_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sandbox_sessions_sandbox_started_idx ON public.sandbox_sessions USING btree (sandbox_id, started_at);


--
-- Name: sandbox_starting_claims_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX sandbox_starting_claims_active_idx ON public.sandbox_starting_claims USING btree (sandbox_id) WHERE (released_at IS NULL);


--
-- Name: sandbox_starting_claims_sandbox_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sandbox_starting_claims_sandbox_id_idx ON public.sandbox_starting_claims USING btree (sandbox_id);


--
-- Name: sandboxes_org_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sandboxes_org_idx ON public.sandboxes USING btree (org_id);


--
-- Name: sandboxes_org_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sandboxes_org_user_idx ON public.sandboxes USING btree (org_id, user_id);


--
-- Name: schedule_runs_org_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX schedule_runs_org_id_idx ON public.schedule_runs USING btree (org_id);


--
-- Name: schedule_runs_project_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX schedule_runs_project_id_idx ON public.schedule_runs USING btree (project_id);


--
-- Name: schedule_runs_running_schedule_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX schedule_runs_running_schedule_idx ON public.schedule_runs USING btree (schedule_id) WHERE ((status)::text = 'running'::text);


--
-- Name: schedule_runs_schedule_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX schedule_runs_schedule_id_idx ON public.schedule_runs USING btree (schedule_id);


--
-- Name: schedule_runs_schedule_started_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX schedule_runs_schedule_started_idx ON public.schedule_runs USING btree (schedule_id, started_at);


--
-- Name: schedules_agent_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX schedules_agent_id_idx ON public.schedules USING btree (agent_id);


--
-- Name: schedules_enabled_next_run_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX schedules_enabled_next_run_idx ON public.schedules USING btree (enabled, next_run_at);


--
-- Name: schedules_org_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX schedules_org_id_idx ON public.schedules USING btree (org_id);


--
-- Name: schedules_project_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX schedules_project_id_idx ON public.schedules USING btree (project_id);


--
-- Name: schedules_sandbox_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX schedules_sandbox_id_idx ON public.schedules USING btree (sandbox_id);


--
-- Name: secrets_agent_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX secrets_agent_id_idx ON public.secrets USING btree (agent_id);


--
-- Name: secrets_org_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX secrets_org_id_idx ON public.secrets USING btree (org_id);


--
-- Name: secrets_project_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX secrets_project_id_idx ON public.secrets USING btree (project_id);


--
-- Name: secrets_provider_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX secrets_provider_id_idx ON public.secrets USING btree (provider_id);


--
-- Name: skill_proposals_org_id_agent_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX skill_proposals_org_id_agent_id_idx ON public.skill_proposals USING btree (org_id, agent_id);


--
-- Name: skill_proposals_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX skill_proposals_status_idx ON public.skill_proposals USING btree (status);


--
-- Name: skills_org_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX skills_org_id_idx ON public.skills USING btree (org_id);


--
-- Name: task_proposals_org_id_agent_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX task_proposals_org_id_agent_id_idx ON public.task_proposals USING btree (org_id, agent_id);


--
-- Name: task_proposals_org_id_dedupe_key_open_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX task_proposals_org_id_dedupe_key_open_idx ON public.task_proposals USING btree (org_id, dedupe_key) WHERE ((status)::text = ANY ((ARRAY['pending'::character varying, 'scanned'::character varying])::text[]));


--
-- Name: task_proposals_org_id_dedupe_key_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX task_proposals_org_id_dedupe_key_status_idx ON public.task_proposals USING btree (org_id, dedupe_key, status);


--
-- Name: task_proposals_parent_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX task_proposals_parent_id_idx ON public.task_proposals USING btree (parent_id);


--
-- Name: task_proposals_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX task_proposals_status_idx ON public.task_proposals USING btree (status);


--
-- Name: threads_agent_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX threads_agent_id_idx ON public.threads USING btree (agent_id);


--
-- Name: threads_org_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX threads_org_id_idx ON public.threads USING btree (org_id);


--
-- Name: threads_parent_thread_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX threads_parent_thread_id_idx ON public.threads USING btree (parent_thread_id);


--
-- Name: threads_project_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX threads_project_id_idx ON public.threads USING btree (project_id);


--
-- Name: threads_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX threads_user_id_idx ON public.threads USING btree (user_id);


--
-- Name: unique_sandbox_project_provider; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX unique_sandbox_project_provider ON public.sandbox_project_providers USING btree (sandbox_id, project_id, provider_id);


--
-- Name: unique_sandbox_provider; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX unique_sandbox_provider ON public.sandbox_providers USING btree (sandbox_id, provider_id);


--
-- Name: unique_sandbox_skill_org; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX unique_sandbox_skill_org ON public.sandbox_skills USING btree (sandbox_id, skill_id) WHERE (project_id IS NULL);


--
-- Name: unique_sandbox_skill_project; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX unique_sandbox_skill_project ON public.sandbox_skills USING btree (sandbox_id, skill_id, project_id) WHERE (project_id IS NOT NULL);


--
-- Name: verifications_org_id_agent_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX verifications_org_id_agent_id_idx ON public.verifications USING btree (org_id, agent_id);


--
-- Name: verifications_org_id_pr_number_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX verifications_org_id_pr_number_uidx ON public.verifications USING btree (org_id, pr_number);


--
-- Name: verifications_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX verifications_status_idx ON public.verifications USING btree (status);


--
-- Name: account account_userId_fkey; Type: FK CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.account
    ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES neon_auth."user"(id) ON DELETE CASCADE;


--
-- Name: invitation invitation_inviterId_fkey; Type: FK CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.invitation
    ADD CONSTRAINT "invitation_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES neon_auth."user"(id) ON DELETE CASCADE;


--
-- Name: invitation invitation_organizationId_fkey; Type: FK CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.invitation
    ADD CONSTRAINT "invitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES neon_auth.organization(id) ON DELETE CASCADE;


--
-- Name: member member_organizationId_fkey; Type: FK CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.member
    ADD CONSTRAINT "member_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES neon_auth.organization(id) ON DELETE CASCADE;


--
-- Name: member member_userId_fkey; Type: FK CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.member
    ADD CONSTRAINT "member_userId_fkey" FOREIGN KEY ("userId") REFERENCES neon_auth."user"(id) ON DELETE CASCADE;


--
-- Name: session session_userId_fkey; Type: FK CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.session
    ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES neon_auth."user"(id) ON DELETE CASCADE;


--
-- Name: agent_projects agent_projects_agent_id_agents_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_projects
    ADD CONSTRAINT agent_projects_agent_id_agents_id_fk FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- Name: agent_projects agent_projects_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_projects
    ADD CONSTRAINT agent_projects_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: agent_providers agent_providers_agent_id_agents_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_providers
    ADD CONSTRAINT agent_providers_agent_id_agents_id_fk FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- Name: agent_providers agent_providers_provider_id_providers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_providers
    ADD CONSTRAINT agent_providers_provider_id_providers_id_fk FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE CASCADE;


--
-- Name: agent_skills agent_skills_agent_id_agents_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_skills
    ADD CONSTRAINT agent_skills_agent_id_agents_id_fk FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- Name: agent_skills agent_skills_skill_id_skills_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_skills
    ADD CONSTRAINT agent_skills_skill_id_skills_id_fk FOREIGN KEY (skill_id) REFERENCES public.skills(id) ON DELETE CASCADE;


--
-- Name: agents agents_org_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agents
    ADD CONSTRAINT agents_org_id_organizations_id_fk FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: api_keys api_keys_org_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_org_id_organizations_id_fk FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: api_keys api_keys_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: api_keys api_keys_resident_agent_id_agents_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_resident_agent_id_agents_id_fk FOREIGN KEY (resident_agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- Name: api_keys api_keys_user_id_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_user_id_user_id_fk FOREIGN KEY (user_id) REFERENCES neon_auth."user"(id) ON DELETE CASCADE;


--
-- Name: assets assets_message_id_messages_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_message_id_messages_id_fk FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;


--
-- Name: assets assets_org_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_org_id_organizations_id_fk FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: assets assets_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: assets assets_provider_id_providers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_provider_id_providers_id_fk FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE SET NULL;


--
-- Name: assets assets_thread_id_threads_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_thread_id_threads_id_fk FOREIGN KEY (thread_id) REFERENCES public.threads(id) ON DELETE CASCADE;


--
-- Name: assets assets_user_id_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_user_id_user_id_fk FOREIGN KEY (user_id) REFERENCES neon_auth."user"(id) ON DELETE CASCADE;


--
-- Name: collections collections_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collections
    ADD CONSTRAINT collections_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: company_strategies company_strategies_org_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_strategies
    ADD CONSTRAINT company_strategies_org_id_organizations_id_fk FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: company_strategies company_strategies_updated_by_agent_id_agents_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_strategies
    ADD CONSTRAINT company_strategies_updated_by_agent_id_agents_id_fk FOREIGN KEY (updated_by_agent_id) REFERENCES public.agents(id) ON DELETE SET NULL;


--
-- Name: decision_positions decision_positions_agent_id_agents_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.decision_positions
    ADD CONSTRAINT decision_positions_agent_id_agents_id_fk FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- Name: decision_positions decision_positions_org_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.decision_positions
    ADD CONSTRAINT decision_positions_org_id_organizations_id_fk FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: decision_positions decision_positions_proposal_id_decision_proposals_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.decision_positions
    ADD CONSTRAINT decision_positions_proposal_id_decision_proposals_id_fk FOREIGN KEY (proposal_id) REFERENCES public.decision_proposals(id) ON DELETE CASCADE;


--
-- Name: decision_proposals decision_proposals_opened_by_agent_id_agents_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.decision_proposals
    ADD CONSTRAINT decision_proposals_opened_by_agent_id_agents_id_fk FOREIGN KEY (opened_by_agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- Name: decision_proposals decision_proposals_org_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.decision_proposals
    ADD CONSTRAINT decision_proposals_org_id_organizations_id_fk FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: domains domains_org_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domains
    ADD CONSTRAINT domains_org_id_organizations_id_fk FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: domains domains_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domains
    ADD CONSTRAINT domains_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: endpoints endpoints_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.endpoints
    ADD CONSTRAINT endpoints_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: escalations escalations_agent_id_agents_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.escalations
    ADD CONSTRAINT escalations_agent_id_agents_id_fk FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- Name: escalations escalations_org_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.escalations
    ADD CONSTRAINT escalations_org_id_organizations_id_fk FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: functions functions_endpoint_id_endpoints_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.functions
    ADD CONSTRAINT functions_endpoint_id_endpoints_id_fk FOREIGN KEY (endpoint_id) REFERENCES public.endpoints(id) ON DELETE CASCADE;


--
-- Name: functions functions_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.functions
    ADD CONSTRAINT functions_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: invitations invitations_invited_by_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_invited_by_user_id_fk FOREIGN KEY (invited_by) REFERENCES neon_auth."user"(id) ON DELETE SET NULL;


--
-- Name: invitations invitations_org_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_org_id_organizations_id_fk FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: invitations invitations_revoked_by_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_revoked_by_user_id_fk FOREIGN KEY (revoked_by) REFERENCES neon_auth."user"(id) ON DELETE SET NULL;


--
-- Name: invitations invitations_user_id_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_user_id_user_id_fk FOREIGN KEY (user_id) REFERENCES neon_auth."user"(id) ON DELETE CASCADE;


--
-- Name: invoices invoices_user_id_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_user_id_user_id_fk FOREIGN KEY (user_id) REFERENCES neon_auth."user"(id) ON DELETE CASCADE;


--
-- Name: memories memories_agent_id_agents_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memories
    ADD CONSTRAINT memories_agent_id_agents_id_fk FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- Name: memories memories_org_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memories
    ADD CONSTRAINT memories_org_id_organizations_id_fk FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: messages messages_org_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_org_id_organizations_id_fk FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: messages messages_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: messages messages_thread_id_threads_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_thread_id_threads_id_fk FOREIGN KEY (thread_id) REFERENCES public.threads(id) ON DELETE CASCADE;


--
-- Name: ops_actions ops_actions_agent_id_agents_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ops_actions
    ADD CONSTRAINT ops_actions_agent_id_agents_id_fk FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- Name: ops_actions ops_actions_org_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ops_actions
    ADD CONSTRAINT ops_actions_org_id_organizations_id_fk FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: organizations organizations_owner_id_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_owner_id_user_id_fk FOREIGN KEY (owner_id) REFERENCES neon_auth."user"(id);


--
-- Name: permission_overrides permission_overrides_granted_by_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permission_overrides
    ADD CONSTRAINT permission_overrides_granted_by_user_id_fk FOREIGN KEY (granted_by) REFERENCES neon_auth."user"(id) ON DELETE CASCADE;


--
-- Name: permission_overrides permission_overrides_org_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permission_overrides
    ADD CONSTRAINT permission_overrides_org_id_organizations_id_fk FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: permission_overrides permission_overrides_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permission_overrides
    ADD CONSTRAINT permission_overrides_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: permission_overrides permission_overrides_user_id_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permission_overrides
    ADD CONSTRAINT permission_overrides_user_id_user_id_fk FOREIGN KEY (user_id) REFERENCES neon_auth."user"(id) ON DELETE CASCADE;


--
-- Name: project_providers project_providers_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_providers
    ADD CONSTRAINT project_providers_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_providers project_providers_provider_id_providers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_providers
    ADD CONSTRAINT project_providers_provider_id_providers_id_fk FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE RESTRICT;


--
-- Name: projects projects_org_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_org_id_organizations_id_fk FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: providers providers_org_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.providers
    ADD CONSTRAINT providers_org_id_organizations_id_fk FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: providers providers_secret_id_secrets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.providers
    ADD CONSTRAINT providers_secret_id_secrets_id_fk FOREIGN KEY (secret_id) REFERENCES public.secrets(id) ON DELETE RESTRICT;


--
-- Name: quotas quotas_org_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotas
    ADD CONSTRAINT quotas_org_id_organizations_id_fk FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: records records_collection_id_collections_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.records
    ADD CONSTRAINT records_collection_id_collections_id_fk FOREIGN KEY (collection_id) REFERENCES public.collections(id) ON DELETE CASCADE;


--
-- Name: records records_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.records
    ADD CONSTRAINT records_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: roles roles_org_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_org_id_organizations_id_fk FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: roles roles_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: roles roles_user_id_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_user_id_user_id_fk FOREIGN KEY (user_id) REFERENCES neon_auth."user"(id) ON DELETE CASCADE;


--
-- Name: sandbox_project_providers sandbox_project_providers_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sandbox_project_providers
    ADD CONSTRAINT sandbox_project_providers_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: sandbox_project_providers sandbox_project_providers_provider_id_providers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sandbox_project_providers
    ADD CONSTRAINT sandbox_project_providers_provider_id_providers_id_fk FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE RESTRICT;


--
-- Name: sandbox_project_providers sandbox_project_providers_sandbox_id_sandboxes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sandbox_project_providers
    ADD CONSTRAINT sandbox_project_providers_sandbox_id_sandboxes_id_fk FOREIGN KEY (sandbox_id) REFERENCES public.sandboxes(id) ON DELETE CASCADE;


--
-- Name: sandbox_projects sandbox_projects_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sandbox_projects
    ADD CONSTRAINT sandbox_projects_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: sandbox_projects sandbox_projects_sandbox_id_sandboxes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sandbox_projects
    ADD CONSTRAINT sandbox_projects_sandbox_id_sandboxes_id_fk FOREIGN KEY (sandbox_id) REFERENCES public.sandboxes(id) ON DELETE CASCADE;


--
-- Name: sandbox_providers sandbox_providers_provider_id_providers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sandbox_providers
    ADD CONSTRAINT sandbox_providers_provider_id_providers_id_fk FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE RESTRICT;


--
-- Name: sandbox_providers sandbox_providers_sandbox_id_sandboxes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sandbox_providers
    ADD CONSTRAINT sandbox_providers_sandbox_id_sandboxes_id_fk FOREIGN KEY (sandbox_id) REFERENCES public.sandboxes(id) ON DELETE CASCADE;


--
-- Name: sandbox_sessions sandbox_sessions_org_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sandbox_sessions
    ADD CONSTRAINT sandbox_sessions_org_id_organizations_id_fk FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: sandbox_sessions sandbox_sessions_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sandbox_sessions
    ADD CONSTRAINT sandbox_sessions_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;


--
-- Name: sandbox_sessions sandbox_sessions_sandbox_id_sandboxes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sandbox_sessions
    ADD CONSTRAINT sandbox_sessions_sandbox_id_sandboxes_id_fk FOREIGN KEY (sandbox_id) REFERENCES public.sandboxes(id) ON DELETE CASCADE;


--
-- Name: sandbox_sessions sandbox_sessions_user_id_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sandbox_sessions
    ADD CONSTRAINT sandbox_sessions_user_id_user_id_fk FOREIGN KEY (user_id) REFERENCES neon_auth."user"(id) ON DELETE CASCADE;


--
-- Name: sandbox_skills sandbox_skills_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sandbox_skills
    ADD CONSTRAINT sandbox_skills_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: sandbox_skills sandbox_skills_sandbox_id_sandboxes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sandbox_skills
    ADD CONSTRAINT sandbox_skills_sandbox_id_sandboxes_id_fk FOREIGN KEY (sandbox_id) REFERENCES public.sandboxes(id) ON DELETE CASCADE;


--
-- Name: sandbox_skills sandbox_skills_skill_id_skills_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sandbox_skills
    ADD CONSTRAINT sandbox_skills_skill_id_skills_id_fk FOREIGN KEY (skill_id) REFERENCES public.skills(id) ON DELETE CASCADE;


--
-- Name: sandbox_starting_claims sandbox_starting_claims_sandbox_id_sandboxes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sandbox_starting_claims
    ADD CONSTRAINT sandbox_starting_claims_sandbox_id_sandboxes_id_fk FOREIGN KEY (sandbox_id) REFERENCES public.sandboxes(id) ON DELETE CASCADE;


--
-- Name: sandboxes sandboxes_org_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sandboxes
    ADD CONSTRAINT sandboxes_org_id_organizations_id_fk FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: sandboxes sandboxes_user_id_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sandboxes
    ADD CONSTRAINT sandboxes_user_id_user_id_fk FOREIGN KEY (user_id) REFERENCES neon_auth."user"(id) ON DELETE SET NULL;


--
-- Name: schedule_runs schedule_runs_org_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_runs
    ADD CONSTRAINT schedule_runs_org_id_organizations_id_fk FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: schedule_runs schedule_runs_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_runs
    ADD CONSTRAINT schedule_runs_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: schedule_runs schedule_runs_schedule_id_schedules_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_runs
    ADD CONSTRAINT schedule_runs_schedule_id_schedules_id_fk FOREIGN KEY (schedule_id) REFERENCES public.schedules(id) ON DELETE CASCADE;


--
-- Name: schedules schedules_agent_id_agents_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedules
    ADD CONSTRAINT schedules_agent_id_agents_id_fk FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE SET NULL;


--
-- Name: schedules schedules_org_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedules
    ADD CONSTRAINT schedules_org_id_organizations_id_fk FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: schedules schedules_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedules
    ADD CONSTRAINT schedules_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: schedules schedules_sandbox_id_sandboxes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedules
    ADD CONSTRAINT schedules_sandbox_id_sandboxes_id_fk FOREIGN KEY (sandbox_id) REFERENCES public.sandboxes(id) ON DELETE CASCADE;


--
-- Name: schedules schedules_thread_id_threads_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedules
    ADD CONSTRAINT schedules_thread_id_threads_id_fk FOREIGN KEY (thread_id) REFERENCES public.threads(id) ON DELETE SET NULL;


--
-- Name: schedules schedules_user_id_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedules
    ADD CONSTRAINT schedules_user_id_user_id_fk FOREIGN KEY (user_id) REFERENCES neon_auth."user"(id) ON DELETE SET NULL;


--
-- Name: secrets secrets_agent_id_agents_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.secrets
    ADD CONSTRAINT secrets_agent_id_agents_id_fk FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- Name: secrets secrets_org_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.secrets
    ADD CONSTRAINT secrets_org_id_organizations_id_fk FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: secrets secrets_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.secrets
    ADD CONSTRAINT secrets_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: secrets secrets_provider_id_providers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.secrets
    ADD CONSTRAINT secrets_provider_id_providers_id_fk FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE CASCADE;


--
-- Name: skill_proposals skill_proposals_agent_id_agents_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skill_proposals
    ADD CONSTRAINT skill_proposals_agent_id_agents_id_fk FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- Name: skill_proposals skill_proposals_org_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skill_proposals
    ADD CONSTRAINT skill_proposals_org_id_organizations_id_fk FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: skill_proposals skill_proposals_promoted_skill_id_skills_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skill_proposals
    ADD CONSTRAINT skill_proposals_promoted_skill_id_skills_id_fk FOREIGN KEY (promoted_skill_id) REFERENCES public.skills(id) ON DELETE SET NULL;


--
-- Name: skills skills_org_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skills
    ADD CONSTRAINT skills_org_id_organizations_id_fk FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: subscriptions subscriptions_user_id_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_user_id_user_id_fk FOREIGN KEY (user_id) REFERENCES neon_auth."user"(id) ON DELETE CASCADE;


--
-- Name: task_proposals task_proposals_agent_id_agents_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_proposals
    ADD CONSTRAINT task_proposals_agent_id_agents_id_fk FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- Name: task_proposals task_proposals_org_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_proposals
    ADD CONSTRAINT task_proposals_org_id_organizations_id_fk FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: task_proposals task_proposals_parent_id_task_proposals_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_proposals
    ADD CONSTRAINT task_proposals_parent_id_task_proposals_id_fk FOREIGN KEY (parent_id) REFERENCES public.task_proposals(id) ON DELETE SET NULL;


--
-- Name: threads threads_agent_id_agents_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.threads
    ADD CONSTRAINT threads_agent_id_agents_id_fk FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE SET NULL;


--
-- Name: threads threads_org_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.threads
    ADD CONSTRAINT threads_org_id_organizations_id_fk FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: threads threads_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.threads
    ADD CONSTRAINT threads_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: threads threads_provider_id_providers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.threads
    ADD CONSTRAINT threads_provider_id_providers_id_fk FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE SET NULL;


--
-- Name: threads threads_user_id_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.threads
    ADD CONSTRAINT threads_user_id_user_id_fk FOREIGN KEY (user_id) REFERENCES neon_auth."user"(id) ON DELETE CASCADE;


--
-- Name: verifications verifications_agent_id_agents_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verifications
    ADD CONSTRAINT verifications_agent_id_agents_id_fk FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- Name: verifications verifications_escalation_id_escalations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verifications
    ADD CONSTRAINT verifications_escalation_id_escalations_id_fk FOREIGN KEY (escalation_id) REFERENCES public.escalations(id) ON DELETE SET NULL;


--
-- Name: verifications verifications_org_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verifications
    ADD CONSTRAINT verifications_org_id_organizations_id_fk FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--


