import type { TRequest } from '@tdsk/domain'

import { describe, it, expect } from 'vitest'
import { shouldIgnore } from './shouldIgnore'

type TBuildOpts = {
  baseUrl?: string
  path?: string
  adminPath?: string
  withLocals?: boolean
  locals?: Record<string, any>
}

const buildReq = ({
  baseUrl = `/_`,
  path = `/health`,
  adminPath,
  withLocals = true,
  locals,
}: TBuildOpts = {}) =>
  ({
    baseUrl,
    path,
    app: {
      locals: withLocals ? (locals ?? { config: { server: { adminPath } } }) : undefined,
    },
  }) as unknown as TRequest

describe(`shouldIgnore`, () => {
  it(`returns true when the request is on the admin path and the path is in AuthIgnore`, () => {
    expect(shouldIgnore(buildReq({ baseUrl: `/_`, path: `/health` }))).toBe(true)
  })

  it(`returns false when the path is not in AuthIgnore, even on the admin path`, () => {
    expect(shouldIgnore(buildReq({ baseUrl: `/_`, path: `/orgs` }))).toBe(false)
  })

  it(`returns false when the path is in AuthIgnore but baseUrl is not the admin path`, () => {
    expect(shouldIgnore(buildReq({ baseUrl: `/faas`, path: `/health` }))).toBe(false)
  })

  it(`respects a custom configured adminPath`, () => {
    expect(
      shouldIgnore(buildReq({ baseUrl: `/admin`, path: `/health`, adminPath: `admin` }))
    ).toBe(true)
  })

  it(`returns false instead of throwing when req.app.locals is undefined`, () => {
    expect(shouldIgnore(buildReq({ withLocals: false }))).toBe(false)
  })

  it(`returns false instead of throwing when req.app.locals.config is undefined`, () => {
    expect(shouldIgnore(buildReq({ locals: {} }))).toBe(false)
  })

  it(`returns false instead of throwing when req.app is undefined`, () => {
    const req = { baseUrl: `/_`, path: `/health`, app: undefined } as unknown as TRequest
    expect(shouldIgnore(req)).toBe(false)
  })
})
