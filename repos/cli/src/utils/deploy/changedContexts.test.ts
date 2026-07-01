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
    expect(mapChangedFiles([`deploy/Dockerfile.sandbox`]).docker).toEqual([`sandbox`])
    expect(mapChangedFiles([`deploy/Dockerfile.init`]).docker).toEqual([`init`])
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
    })
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
      isNoop({ docker: [], firebase: [], db: false, deployConfig: false, reason: `` })
    ).toBe(true)
    expect(
      isNoop({
        docker: [`proxy`],
        firebase: [],
        db: false,
        deployConfig: false,
        reason: ``,
      })
    ).toBe(false)
    expect(
      isNoop({ docker: [], firebase: [], db: false, deployConfig: true, reason: `` })
    ).toBe(false)
  })
})

describe(`everything`, () => {
  it(`selects all targets with the given reason`, () => {
    const res = everything(`fallback`)
    expect(res.docker).toEqual(ALL_DOCKER)
    expect(res.firebase).toEqual(ALL_FIREBASE)
    expect(res.db).toBe(true)
    expect(res.reason).toBe(`fallback`)
  })
})
