import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { buildProxyCommand } from './spawnSsh'

describe(`buildProxyCommand`, () => {
  const originalArgv = process.argv

  beforeEach(() => {
    process.argv = [...originalArgv]
  })

  afterEach(() => {
    process.argv = originalArgv
  })

  it(`includes tsaScript and instanceId when both are provided`, () => {
    process.argv = [`/usr/bin/node`, `/usr/local/bin/tsa`]

    const result = buildProxyCommand(`sandbox-1`, `instance-1`)

    expect(result).toBe(`/usr/bin/node /usr/local/bin/tsa proxy sandbox-1 instance-1`)
  })

  it(`omits the trailing instanceId when it is not provided`, () => {
    process.argv = [`/usr/bin/node`, `/usr/local/bin/tsa`]

    const result = buildProxyCommand(`sandbox-1`)

    expect(result).toBe(`/usr/bin/node /usr/local/bin/tsa proxy sandbox-1`)
  })

  it(`drops the tsaScript segment entirely when argv[1] is falsy`, () => {
    process.argv = [`/usr/bin/node`, ``]

    const result = buildProxyCommand(`sandbox-1`, `instance-1`)

    expect(result).toBe(`/usr/bin/node proxy sandbox-1 instance-1`)
  })

  it(`falls back to the literal "tsa" when argv[0] is falsy`, () => {
    process.argv = [``, `/usr/local/bin/tsa`]

    const result = buildProxyCommand(`sandbox-1`)

    expect(result).toBe(`tsa /usr/local/bin/tsa proxy sandbox-1`)
  })
})
