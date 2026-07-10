import { describe, it, expect } from 'vitest'
import {
  everything,
  isNoop,
  mapChangedFiles,
  ALL_DOCKER,
  ALL_FIREBASE,
} from './changedContexts'

describe(`mapChangedFiles`, () => {
  it(`returns no targets for an empty changeset`, () => {
    expect(mapChangedFiles([])).toEqual({
      docker: [],
      firebase: [],
      db: false,
      deployConfig: false,
      egress: false,
    })
  })

  it(`maps proxy repo changes to the proxy image only`, () => {
    const res = mapChangedFiles([`repos/proxy/src/index.ts`])
    expect(res.docker).toEqual([`proxy`])
    expect(res.firebase).toEqual([])
    expect(res.db).toBe(false)
  })

  it(`maps backend + bundled agent/sandbox repos to the backend image`, () => {
    expect(mapChangedFiles([`repos/backend/src/app.ts`]).docker).toEqual([`backend`])
    expect(mapChangedFiles([`repos/agent/src/agent.ts`]).docker).toEqual([`backend`])
    expect(mapChangedFiles([`repos/sandbox/src/pod.ts`]).docker).toEqual([`backend`])
  })

  it(`maps shared backend deps (domain/database/logger) to proxy + backend`, () => {
    const res = mapChangedFiles([`repos/logger/src/logger.ts`])
    expect(res.docker).toEqual([`proxy`, `backend`])
  })

  it(`flags a db schema change`, () => {
    const res = mapChangedFiles([`repos/database/src/schemas/agents.ts`])
    expect(res.db).toBe(true)
    // schema lives under database repo → also rebuilds proxy + backend
    expect(res.docker).toEqual([`proxy`, `backend`])
  })

  it(`maps Caddyfile and per-image Dockerfiles`, () => {
    expect(mapChangedFiles([`deploy/Caddyfile`]).docker).toEqual([`caddy`])
    expect(mapChangedFiles([`deploy/Dockerfile.caddy`]).docker).toEqual([`caddy`])
    // sandbox base image changes cascade to the jobs prewarm image which extends it
    expect(mapChangedFiles([`deploy/Dockerfile.sandbox`]).docker).toEqual([
      `sandbox`,
      `jobs`,
    ])
    expect(mapChangedFiles([`deploy/sandbox-entrypoint.sh`]).docker).toEqual([
      `sandbox`,
      `jobs`,
    ])
    expect(mapChangedFiles([`deploy/Dockerfile.init`]).docker).toEqual([`init`])
    expect(mapChangedFiles([`deploy/Dockerfile.jobs`]).docker).toEqual([`jobs`])
    // workspace package.json changes rebuild the jobs prewarm image (deps baked in)
    // AND any image whose bundled repo owns that package.json
    expect(mapChangedFiles([`repos/backend/package.json`]).docker).toEqual([
      `backend`,
      `jobs`,
    ])
    expect(mapChangedFiles([`repos/cli/package.json`]).docker).toEqual([`jobs`])
  })

  it(`maps frontend repos to their Firebase apps`, () => {
    expect(mapChangedFiles([`repos/admin/src/main.tsx`]).firebase).toEqual([`admin`])
    expect(mapChangedFiles([`repos/threads/src/main.tsx`]).firebase).toEqual([`threads`])
    expect(mapChangedFiles([`repos/website/src/main.tsx`]).firebase).toEqual([`website`])
  })

  it(`rebuilds every frontend when shared frontend deps change`, () => {
    expect(mapChangedFiles([`repos/components/src/Button.tsx`]).firebase).toEqual(
      ALL_FIREBASE
    )
  })

  it(`domain changes rebuild backend images AND all frontends`, () => {
    const res = mapChangedFiles([`repos/domain/src/models/user.ts`])
    expect(res.docker).toEqual([`proxy`, `backend`])
    expect(res.firebase).toEqual(ALL_FIREBASE)
  })

  it(`root shared files rebuild everything`, () => {
    const res = mapChangedFiles([`pnpm-lock.yaml`])
    expect(res.docker).toEqual(ALL_DOCKER)
    expect(res.firebase).toEqual(ALL_FIREBASE)
  })

  it(`preserves canonical ordering regardless of input order`, () => {
    const res = mapChangedFiles([
      `repos/website/src/x.ts`,
      `deploy/Dockerfile.init`,
      `repos/admin/src/y.ts`,
      `deploy/Caddyfile`,
    ])
    expect(res.docker).toEqual([`caddy`, `init`])
    expect(res.firebase).toEqual([`admin`, `website`])
  })

  it(`ignores unrelated files (docs, tests config)`, () => {
    const res = mapChangedFiles([`docs/internal/meta/prod-deploy.md`, `README.md`])
    expect(res).toEqual({
      docker: [],
      firebase: [],
      db: false,
      deployConfig: false,
      egress: false,
    })
  })

  it(`flags the egress roll ONLY for the egress code cone`, () => {
    // In the cone: the entrypoint, MITM proxy + guards, secret resolution,
    // kube route client, DB secret read path.
    expect(mapChangedFiles([`repos/backend/src/egress.ts`]).egress).toBe(true)
    expect(mapChangedFiles([`repos/backend/src/services/proxy/egress.ts`]).egress).toBe(
      true
    )
    expect(mapChangedFiles([`repos/backend/src/utils/proxy/egressGuard.ts`]).egress).toBe(
      true
    )
    expect(
      mapChangedFiles([`repos/backend/src/services/secrets/secretResolver.ts`]).egress
    ).toBe(true)
    expect(mapChangedFiles([`repos/sandbox/src/kube/kubeClient.ts`]).egress).toBe(true)
    expect(mapChangedFiles([`repos/database/src/services/secret.ts`]).egress).toBe(true)
    expect(mapChangedFiles([`repos/database/src/database.ts`]).egress).toBe(true)
    // Root shared files rebuild the image the egress service runs on
    expect(mapChangedFiles([`pnpm-lock.yaml`]).egress).toBe(true)

    // NOT in the cone: routine backend/scheduler/api work must NOT roll egress
    expect(
      mapChangedFiles([`repos/backend/src/services/scheduler/executor.ts`]).egress
    ).toBe(false)
    expect(mapChangedFiles([`repos/backend/src/endpoints/orgs/orgs.ts`]).egress).toBe(
      false
    )
    expect(mapChangedFiles([`repos/database/src/services/record.ts`]).egress).toBe(false)
    expect(mapChangedFiles([`repos/sandbox/src/local/localSandbox.ts`]).egress).toBe(
      false
    )
    expect(mapChangedFiles([`repos/domain/src/models/user.ts`]).egress).toBe(false)
  })

  it(`flags deploy config changes without rebuilding images`, () => {
    expect(mapChangedFiles([`deploy/values.production.yaml`]).deployConfig).toBe(true)
    expect(mapChangedFiles([`deploy/templates/deployment.yaml`]).deployConfig).toBe(true)
    expect(mapChangedFiles([`deploy/devspace.yaml`]).deployConfig).toBe(true)
    const res = mapChangedFiles([`deploy/values.production.yaml`])
    expect(res.docker).toEqual([])
  })
})

describe(`isNoop`, () => {
  it(`is true only when nothing is selected`, () => {
    expect(
      isNoop({
        docker: [],
        firebase: [],
        db: false,
        deployConfig: false,
        egress: false,
        reason: ``,
      })
    ).toBe(true)
    expect(
      isNoop({
        docker: [`proxy`],
        firebase: [],
        db: false,
        deployConfig: false,
        egress: false,
        reason: ``,
      })
    ).toBe(false)
    expect(
      isNoop({
        docker: [],
        firebase: [],
        db: false,
        deployConfig: true,
        egress: false,
        reason: ``,
      })
    ).toBe(false)
    expect(
      isNoop({
        docker: [],
        firebase: [],
        db: false,
        deployConfig: false,
        egress: true,
        reason: ``,
      })
    ).toBe(false)
  })
})

describe(`everything`, () => {
  it(`selects all targets with the given reason`, () => {
    const res = everything(`fallback`)
    expect(res.docker).toEqual(ALL_DOCKER)
    expect(res.firebase).toEqual(ALL_FIREBASE)
    expect(res.db).toBe(true)
    expect(res.egress).toBe(true)
    expect(res.reason).toBe(`fallback`)
  })
})
