# S3 Object Store -- Developer Internals

## Overview

The `S3Service` provides S3-compatible object storage for persisting sandbox session output (stdout/stderr) and schedule run output. It uses the AWS SDK v3 with `forcePathStyle: true`, making it compatible with both AWS S3 and S3-compatible providers (MinIO, Cloudflare R2, etc.).

S3 is an internal platform service. Users never interact with it directly.

## Service Architecture

The `S3Service` (`repos/backend/src/services/s3/s3.ts`) is always instantiated at startup via `new S3Service(config.s3)`. When S3 credentials are not configured, the service initializes in an inactive state and logs a warning. This follows the same pattern as `PaymentsService`, which falls back to `ConsoleService` when Stripe is not configured.

### Active vs Inactive

The `active` field in `config.s3` is computed from the presence of all four required env vars:

```
active = Boolean(TDSK_S3_BUCKET && TDSK_S3_ENDPOINT && TDSK_S3_ACCESS_KEY_ID && TDSK_S3_SECRET_ACCESS_KEY)
```

When inactive:
- `s3.active` returns `false`
- `createUploadStream()` returns `undefined` (callers treat this as "no upload")
- `getObject()` and `deleteObject()` throw `[S3Service] S3 is not configured`
- Endpoints that require S3 check `s3.active` and return a **503** early

### API

```text
s3.active                        -> boolean
s3.createUploadStream(key)       -> TUploadStream | undefined
s3.getObject(key)                -> Promise<Readable>
s3.deleteObject(key)             -> Promise<void>
```

`TUploadStream` is a `{ stream: PassThrough, done: () => Promise<void> }` pair. Callers pipe data into `stream`, then call `done()` to finalize the multi-part upload.

Source files:
- `repos/backend/src/services/s3/s3.ts`
- `repos/backend/src/types/s3.types.ts`

---

## Configuration

The `TS3Config` shape (`repos/backend/src/types/s3.types.ts`):

| Field | Type | Description |
|---|---|---|
| `bucket` | `string` | S3 bucket name |
| `endpoint` | `string` | S3 endpoint URL (e.g. `https://s3.us-east-1.amazonaws.com` or `http://localhost:9000` for MinIO) |
| `accessKeyId` | `string` | S3 access key ID |
| `secretAccessKey` | `string` | S3 secret access key |
| `region` | `string` (optional) | S3 region. Defaults to `auto` when unset. |
| `active` | `boolean` (optional) | Computed from env vars. When falsy, the service skips initialization. |

### Config Flow

```
deploy/values.yaml              TDSK_S3_* env var declarations
        |
        v
loadEnvs()                      Loads values.yaml into process.env (local only)
        |
        v
backend.config.ts               Destructures env vars, builds config.s3 object
        |
        v
main.ts                         new S3Service(config.s3)
        |
        v
app.locals.s3                   Available to all endpoints via req.app.locals
```

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `TDSK_S3_BUCKET` | Yes | S3 bucket name |
| `TDSK_S3_ENDPOINT` | Yes | S3 endpoint URL |
| `TDSK_S3_ACCESS_KEY_ID` | Yes | S3 access key ID |
| `TDSK_S3_SECRET_ACCESS_KEY` | Yes | S3 secret access key |
| `TDSK_S3_REGION` | No | S3 region (defaults to `auto`) |

In deployed environments, these are injected from the `tdsk-s3-secret` Kubernetes secret via `devspace.yaml` secretKeyRef mappings.

For local development, set them in `~/.config/tdsk/values.yaml`:

```yaml
TDSK_S3_BUCKET: my-bucket
TDSK_S3_ENDPOINT: http://localhost:9000
TDSK_S3_ACCESS_KEY_ID: minioadmin
TDSK_S3_SECRET_ACCESS_KEY: minioadmin
TDSK_S3_REGION: us-east-1
```

Source: `repos/backend/configs/backend.config.ts`

---

## S3 Key Structure

All S3 objects are scoped by org ID and use the following key patterns:

| Use Case | Key Pattern | Writer |
|---|---|---|
| Sandbox session stdout | `{orgId}/sessions/{sessionId}/stdout` | `onShellConnect.ts` |
| Sandbox session stderr | `{orgId}/sessions/{sessionId}/stderr` | `onShellConnect.ts` |
| Schedule run stdout | `{orgId}/runs/{runId}/stdout` | `executor.ts` |
| Schedule run stderr | `{orgId}/runs/{runId}/stderr` | `executor.ts` |

### How Output Is Captured

1. When a sandbox shell session starts or a scheduled run executes, `createUploadStream()` creates a `PassThrough` stream backed by an S3 multi-part upload.
2. The exec stdout/stderr pipes are attached to the upload streams.
3. When the session or run ends, the upload stream is finalized via `done()`, which completes the multi-part upload.
4. The S3 key is stored in the database record (`stdoutKey`/`stderrKey` on `sandbox_sessions` and `schedule_runs`).

### How Output Is Retrieved

- `GET /_/sandboxes/:id/history/:sessionRecordId/output?stream=stdout|stderr` (`getSandboxSessionOutput.ts`)
- `GET /_/schedules/:scheduleId/runs/:runId/output?stream=stdout|stderr` (`getScheduleRunOutput.ts`)

Both endpoints look up the S3 key from the database record and stream the object back to the client via `s3.getObject(key)`.

Source files:
- `repos/backend/src/endpoints/sandboxes/onShellConnect.ts`
- `repos/backend/src/endpoints/sandboxes/getSandboxSessionOutput.ts`
- `repos/backend/src/services/scheduler/executor.ts`
- `repos/backend/src/endpoints/schedules/getScheduleRunOutput.ts`

---

## Kubernetes Secret

The S3 credentials are stored in a K8s secret named `tdsk-s3-secret` (configurable via `TDSK_KUBE_SCRT_S3_CFG`).

### Creating the Secret

```bash
tdsk kube secret s3 \
  --bucket my-bucket \
  --endpoint https://s3.us-east-1.amazonaws.com \
  --accessKeyId AKIA... \
  --secretAccessKey wJal... \
  --region us-east-1
```

All options fall back to the corresponding `TDSK_S3_*` env vars from config. The `--region` flag is optional.

Aliases: `tdsk kube secret objectstore`, `tdsk kube secret os`.

For production deployments:
```bash
tdsk kube secret s3 --env prod
```

### Secret Key Mapping

| K8s Secret Key | Env Var | devspace.yaml |
|---|---|---|
| `bucket` | `TDSK_S3_BUCKET` | `secretKeyRef.key: bucket` |
| `endpoint` | `TDSK_S3_ENDPOINT` | `secretKeyRef.key: endpoint` |
| `accessKeyId` | `TDSK_S3_ACCESS_KEY_ID` | `secretKeyRef.key: accessKeyId` |
| `secretAccessKey` | `TDSK_S3_SECRET_ACCESS_KEY` | `secretKeyRef.key: secretAccessKey` |
| `region` | `TDSK_S3_REGION` | `secretKeyRef.key: region` |

Source files:
- `repos/cli/src/tasks/kube/secret/s3.ts`
- `deploy/devspace.yaml`

---

## Local Development

### Without S3

S3 is optional for local development. Without S3 credentials configured, the backend starts normally with `s3.active = false`. Session and schedule output will not be persisted, and the output retrieval endpoints return **503**.

### With MinIO

To test S3 locally, run a MinIO container:

```bash
docker run -d \
  --name minio \
  -p 9000:9000 \
  -p 9001:9001 \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin \
  minio/minio server /data --console-address ":9001"
```

Create a bucket via the MinIO console at `http://localhost:9001` or via the `mc` CLI:

```bash
mc alias set local http://localhost:9000 minioadmin minioadmin
mc mb local/tdsk-dev
```

Then set the env vars in `~/.config/tdsk/values.yaml`:

```yaml
TDSK_S3_BUCKET: tdsk-dev
TDSK_S3_ENDPOINT: http://localhost:9000
TDSK_S3_ACCESS_KEY_ID: minioadmin
TDSK_S3_SECRET_ACCESS_KEY: minioadmin
```

Restart the backend. The logs should show:
```
[S3Service] Initialized with bucket "tdsk-dev" at http://localhost:9000
```
