import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { inKube } from './inKube'

describe(`inKube`, () => {
  const originalEnv = {
    TDSK_IN_KUBE: process.env.TDSK_IN_KUBE,
    KUBERNETES_SERVICE_HOST: process.env.KUBERNETES_SERVICE_HOST,
    KUBERNETES_SERVICE_PORT: process.env.KUBERNETES_SERVICE_PORT,
  }

  beforeEach(() => {
    delete process.env.TDSK_IN_KUBE
    delete process.env.KUBERNETES_SERVICE_HOST
    delete process.env.KUBERNETES_SERVICE_PORT
  })

  afterEach(() => {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })

  it(`should return true when TDSK_IN_KUBE is set truthy`, () => {
    process.env.TDSK_IN_KUBE = `1`

    expect(inKube()).toBe(true)
  })

  it(`should return true when both KUBERNETES_SERVICE_HOST and KUBERNETES_SERVICE_PORT are set`, () => {
    process.env.KUBERNETES_SERVICE_HOST = `10.0.0.1`
    process.env.KUBERNETES_SERVICE_PORT = `443`

    expect(inKube()).toBe(true)
  })

  it(`should return false when only KUBERNETES_SERVICE_HOST is set`, () => {
    process.env.KUBERNETES_SERVICE_HOST = `10.0.0.1`

    expect(inKube()).toBe(false)
  })

  it(`should return false when only KUBERNETES_SERVICE_PORT is set`, () => {
    process.env.KUBERNETES_SERVICE_PORT = `443`

    expect(inKube()).toBe(false)
  })

  it(`should return false when all env vars are unset`, () => {
    expect(inKube()).toBe(false)
  })
})
