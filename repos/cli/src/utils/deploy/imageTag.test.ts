import { describe, it, expect } from 'vitest'
import { tagEnvs, TAG_ENVS } from './imageTag'

describe(`tagEnvs`, () => {
  it(`sets every image-tag env to the given tag`, () => {
    const envs = tagEnvs(`sha-abc1234`)
    expect(Object.keys(envs).sort()).toEqual([...TAG_ENVS].sort())
    for (const key of TAG_ENVS) expect(envs[key]).toBe(`sha-abc1234`)
  })

  it(`covers caddy, proxy, backend, sandbox and init tag envs`, () => {
    expect(TAG_ENVS).toContain(`TDSK_PX_IMAGE_TAG`)
    expect(TAG_ENVS).toContain(`TDSK_BE_IMAGE_TAG`)
    expect(TAG_ENVS).toContain(`TDSK_CADDY_IMAGE_TAG`)
    expect(TAG_ENVS).toContain(`TDSK_SB_IMAGE_TAG`)
    expect(TAG_ENVS).toContain(`TDSK_SB_INIT_IMAGE_TAG`)
  })
})
