import { describe, it, expect } from 'vitest'
import { KubeSBPrefix } from '@TSB/constants/kube'
import { parseSandboxHost } from './parseSandboxHost'

describe(`parseSandboxHost`, () => {
  it(`should parse a valid flat-format sandbox hostname`, () => {
    const result = parseSandboxHost(
      `3000--${KubeSBPrefix}-a1b2c3d4.local.threadedstack.app`
    )
    expect(result).toEqual({
      port: `3000`,
      subdomain: `${KubeSBPrefix}-a1b2c3d4`,
    })
  })

  it(`should parse hostname with different port`, () => {
    const result = parseSandboxHost(
      `8080--${KubeSBPrefix}-deadbeef.sandbox.threadedstack.app`
    )
    expect(result).toEqual({
      port: `8080`,
      subdomain: `${KubeSBPrefix}-deadbeef`,
    })
  })

  it(`should parse hostname with nanoid-style suffix`, () => {
    const result = parseSandboxHost(
      `3000--${KubeSBPrefix}-test1234-ab9z.threadedstack.com`
    )
    expect(result).toEqual({
      port: `3000`,
      subdomain: `${KubeSBPrefix}-test1234-ab9z`,
    })
  })

  it(`should return null for hostname without -- separator`, () => {
    expect(parseSandboxHost(`3000.${KubeSBPrefix}-a1b2c3d4.threadedstack.com`)).toBeNull()
  })

  it(`should return null for hostname with too few parts`, () => {
    expect(parseSandboxHost(`short`)).toBeNull()
    expect(parseSandboxHost(``)).toBeNull()
  })

  it(`should return null for non-sandbox hostname (no sb- prefix)`, () => {
    const result = parseSandboxHost(`3000--nosb-prefix.sandbox.threadedstack.com`)
    expect(result).toBeNull()
  })

  it(`should return null for hostname without sb- prefix on subdomain`, () => {
    const result = parseSandboxHost(`3000--other-a1b2c3d4.sandbox.threadedstack.com`)
    expect(result).toBeNull()
  })

  it(`should return null for non-numeric port`, () => {
    const result = parseSandboxHost(`abc--${KubeSBPrefix}-a1b2c3d4.app.threadedstack.com`)
    expect(result).toBeNull()
  })

  it(`should return null for empty port before separator`, () => {
    const result = parseSandboxHost(`--${KubeSBPrefix}-a1b2c3d4.test.threadedstack.com`)
    expect(result).toBeNull()
  })

  it(`should return null for regular domain without sandbox label`, () => {
    expect(parseSandboxHost(`local.threadedstack.app`)).toBeNull()
    expect(parseSandboxHost(`api.threadedstack.app`)).toBeNull()
    expect(parseSandboxHost(`px.local.threadedstack.app`)).toBeNull()
  })
})
