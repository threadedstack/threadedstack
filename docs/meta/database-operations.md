# Database Operations

All database commands are available via the `tdsk` CLI. The `--env` flag controls which environment's credentials are loaded.

## Environment Configuration

Database credentials are loaded from config files in merge order (later overrides earlier):

1. `deploy/values.yaml` — Base config (DB name, dialect, protocol)
2. `deploy/values.{NODE_ENV}.yaml` — Environment-specific overrides
3. `~/.config/tdsk/values.{NODE_ENV}.yaml` — User secrets (DB URL, credentials)

The `--env` flag maps directly to `NODE_ENV`:

| Flag | NODE_ENV | Credential Source |
|------|----------|-------------------|
| `--env local` (default) | `local` | `~/.config/tdsk/values.local.yaml` |
| `--env production` | `production` | `~/.config/tdsk/values.production.yaml` |

Before running any database commands, ensure `~/.config/tdsk/values.{env}.yaml` contains:

```yaml
env:
  TDSK_DB_URL: postgresql://user:pass@host/dbname
  # Or individual components:
  TDSK_DB_USER: user
  TDSK_DB_PASS: password
  TDSK_DB_NAME: dbname
  TDSK_DB_PROTO: postgresql
```

`TDSK_DB_URL` takes precedence if set. Otherwise the URL is built from the individual components.

---

## Production Database Setup (From Scratch)

Assumes a Neon database has been created and credentials are in `~/.config/tdsk/values.production.yaml`.

### 1. Create K8s Database Secret

This creates the Kubernetes secret that backend/proxy pods use to connect to the database. Required before deploying services.

```sh
tdsk kube secret database --env prod
```

### 2. Push Schema

Creates all 25 Drizzle-managed tables from the schema definitions. This is interactive — drizzle-kit will show planned changes and ask for confirmation.

```sh
tdsk db push --env production
```

### 3. Add Deferred Constraints

Adds FK constraints that can't be created during the initial push due to circular dependencies (e.g., `providers.secret_id → secrets.id`). Safe to re-run.

```sh
tdsk db constraints --env production
```

### 4. Restore Caddy Certificates (If Applicable)

If migrating from an existing environment, restore the Caddy root CA cert/key from `~/.config/tdsk/domain/root.crt` and `root.key`.

```sh
tdsk db certs --env production
```

### 5. Seed Data (Optional)

Seeds a complete test organization with all entity types. Typically only for development and staging — skip for a clean production database.

```sh
tdsk db seed --env production
```

### Complete From-Scratch Sequence

```sh
# 1. K8s secret (so pods can connect after deploy)
tdsk kube secret database --env prod

# 2. Schema
tdsk db push --env production

# 3. Deferred constraints
tdsk db constraints --env production

# 4. Certs (only if migrating)
tdsk db certs --env production

# 5. Seed (only if dev/staging)
tdsk db seed --env production
```

---

## Schema Management

### Generate Migrations

Create migration files from schema changes (does not apply them):

```sh
tdsk db generate
tdsk db generate --env production
```

### Apply Migrations

Apply pending migration files to the database:

```sh
tdsk db migrate --env production
```

### Push Schema (No Migration Files)

Push schema changes directly to the database without generating migration files. Interactive — shows planned changes and asks for confirmation:

```sh
tdsk db push --env production
```

### Check Migration Consistency

Verify migration files are consistent with the current schema:

```sh
tdsk db check
```

### Introspect Database

Generate Drizzle schema from an existing database:

```sh
tdsk db introspect --env production
```

### Export Schema as SQL

```sh
tdsk db export
```

### Update Migration Format

```sh
tdsk db dup
```

### Drop a Migration (Interactive)

```sh
tdsk db drop
```

### Drizzle Kit Passthrough

Run any drizzle-kit command directly:

```sh
tdsk db dk <command> [args]
```

---

## Data Management

### Seed

Seed the database with a complete test organization (users, projects, agents, providers, secrets, etc.):

```sh
tdsk db seed --env local
tdsk db seed --env production
```

### Purge Seed Data

Remove only the seeded records (by their predefined IDs), in reverse FK order:

```sh
tdsk db purge --env local
```

### Cleanup

Remove all non-seed data while preserving seed fixtures:

```sh
tdsk db cleanup --env local
```

---

## Destructive Operations

These commands require `--confirm` when targeting non-local environments.

### Drop All Tables

Drops all 25 Drizzle-managed tables with CASCADE. Does not touch `neon_auth.user` or `caddy_certmagic_objects`.

```sh
# Local (no confirmation needed)
tdsk db rmf

# Production (requires --confirm)
tdsk db rmf --env production --confirm
```

After dropping, recreate with `tdsk db push` and optionally `tdsk db seed`.

### Full Reset

Composite command: drop all tables → push schema → seed data.

```sh
# Local
tdsk db reset

# Production (requires --confirm)
tdsk db reset --env production --confirm
```

---

## Interactive Tools

### Drizzle Studio

Launch the visual database browser:

```sh
tdsk db studio
tdsk db studio --env production
```

---

## Command Reference

| Command | Alias | Description | Interactive | Destructive |
|---------|-------|-------------|:-----------:|:-----------:|
| `tdsk db generate` | `gen` | Generate migration files | | |
| `tdsk db migrate` | `mig` | Apply pending migrations | | |
| `tdsk db push` | `ph` | Push schema to DB | Yes | |
| `tdsk db introspect` | `intro` | Introspect DB schema | | |
| `tdsk db check` | `chk` | Check migration consistency | | |
| `tdsk db export` | `exp` | Export schema as SQL | | |
| `tdsk db dup` | `up` | Update migration format | | |
| `tdsk db drop` | `drp` | Drop a migration | Yes | |
| `tdsk db dk` | `drizzle` | Drizzle-kit passthrough | Yes | |
| `tdsk db studio` | `ui` | Launch Drizzle Studio | Yes | |
| `tdsk db seed` | `sd` | Seed fullorg test data | | |
| `tdsk db purge` | `prg` | Purge seeded data | | |
| `tdsk db cleanup` | `clean` | Remove non-seed data | | |
| `tdsk db certs` | `cert` | Restore Caddy certs | | |
| `tdsk db constraints` | `fk` | Add deferred FK constraints | | |
| `tdsk db rmf` | `remove` | Drop ALL tables | | Yes |
| `tdsk db reset` | `rst` | Drop + push + seed | Yes | Yes |

All commands accept `--env <environment>` (default: `local`) and `--log` (log sub-commands).
Destructive commands require `--confirm` for non-local environments.
