import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ensureSshConfig, getPublicKey } from '@TSA/services/sync/sshConfig'

const mockExistsSync = vi.fn()
const mockReadFileSync = vi.fn()
const mockWriteFileSync = vi.fn()
const mockMkdirSync = vi.fn()
const mockRealpathSync = vi.fn((p: string) => p)
const mockUnlinkSync = vi.fn()

vi.mock(`fs`, () => ({
  existsSync: (...args: any[]) => mockExistsSync(...args),
  readFileSync: (...args: any[]) => mockReadFileSync(...args),
  writeFileSync: (...args: any[]) => mockWriteFileSync(...args),
  mkdirSync: (...args: any[]) => mockMkdirSync(...args),
  realpathSync: (p: string) => mockRealpathSync(p),
  unlinkSync: (...args: any[]) => mockUnlinkSync(...args),
}))

const mockExecFileSync = vi.fn()
vi.mock(`child_process`, () => ({
  execFileSync: (...args: any[]) => mockExecFileSync(...args),
}))

vi.mock(`url`, () => ({
  fileURLToPath: () => `/mock/repos/tsa/src/services/sync/sshConfig.ts`,
}))

describe(`ensureSshConfig`, () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockExistsSync.mockImplementation((path: string) => {
      if (path.endsWith(`.ssh`)) return true
      return false
    })
    mockReadFileSync.mockReturnValue(``)
  })

  it(`creates ~/.ssh directory if it does not exist`, () => {
    mockExistsSync.mockReturnValue(false)

    ensureSshConfig()

    const mkdirCalls = mockMkdirSync.mock.calls
    const sshDirCall = mkdirCalls.find((c: any[]) => c[0].endsWith(`.ssh`))
    expect(sshDirCall).toBeDefined()
    expect(sshDirCall[1]).toEqual({ mode: 0o700 })
  })

  it(`generates Ed25519 key pair via ssh-keygen when keys do not exist`, () => {
    ensureSshConfig()

    expect(mockExecFileSync).toHaveBeenCalledWith(
      `ssh-keygen`,
      expect.arrayContaining([`-t`, `ed25519`, `-N`, ``, `-C`, `tdsk-sandbox`, `-q`]),
      expect.objectContaining({ stdio: `ignore` })
    )

    // Should also try to unlink stale keys
    expect(mockUnlinkSync).toHaveBeenCalled()
  })

  it(`skips key generation when both keys already exist`, () => {
    mockExistsSync.mockImplementation((path: string) => {
      if (path.endsWith(`.ssh`)) return true
      if (path.endsWith(`sandbox_key`) || path.endsWith(`sandbox_key.pub`)) return true
      return false
    })

    ensureSshConfig()

    expect(mockExecFileSync).not.toHaveBeenCalled()
  })

  it(`creates proxy wrapper script at ~/.config/tdsk/bin/tsa-proxy`, () => {
    ensureSshConfig()

    const wrapperWrites = mockWriteFileSync.mock.calls.filter((c: any[]) =>
      c[0].endsWith(`tsa-proxy`)
    )
    expect(wrapperWrites.length).toBe(1)
    const wrapper = wrapperWrites[0][1] as string
    expect(wrapper).toContain(`#!/bin/sh`)
    expect(wrapper).toContain(`exec `)
    expect(wrapper).toContain(`"$@"`)
    expect(wrapperWrites[0][2]).toEqual({ mode: 0o700 })
  })

  it(`appends sandbox block with IdentityFile and proxy wrapper`, () => {
    mockExistsSync.mockImplementation((path: string) => {
      if (path.endsWith(`.ssh`)) return true
      if (path.endsWith(`.ssh/config`)) return true
      if (path.endsWith(`sandbox_key`) || path.endsWith(`sandbox_key.pub`)) return true
      return false
    })
    mockReadFileSync.mockImplementation((path: string) => {
      if (path.endsWith(`.ssh/config`)) return `Host example.com\n  User admin\n`
      return ``
    })

    ensureSshConfig()

    const configWrites = mockWriteFileSync.mock.calls.filter((c: any[]) =>
      c[0].endsWith(`.ssh/config`)
    )
    expect(configWrites.length).toBe(1)
    const written = configWrites[0][1] as string
    expect(written).toContain(`Host example.com`)
    expect(written).toContain(`Host sb_*`)
    expect(written).toContain(`ProxyCommand`)
    expect(written).toContain(`tsa-proxy %h`)
    expect(written).toContain(`IdentityFile`)
    expect(written).toContain(`sandbox_key`)
  })

  it(`replaces outdated sandbox block with new one`, () => {
    mockExistsSync.mockImplementation((path: string) => {
      if (path.endsWith(`sandbox_key`) || path.endsWith(`sandbox_key.pub`)) return true
      return true
    })
    mockReadFileSync.mockImplementation((path: string) => {
      if (path.endsWith(`.ssh/config`))
        return `Host example.com\n  User admin\n\nHost sb_*\n  ProxyCommand tsa proxy %h\n  User sandbox\n  StrictHostKeyChecking no\n  UserKnownHostsFile /dev/null\n  LogLevel ERROR\n`
      return ``
    })

    ensureSshConfig()

    const configWrites = mockWriteFileSync.mock.calls.filter((c: any[]) =>
      c[0].endsWith(`.ssh/config`)
    )
    expect(configWrites.length).toBe(1)
    const written = configWrites[0][1] as string
    expect(written).toContain(`Host example.com`)
    expect(written).toContain(`Host sb_*`)
    expect(written).toContain(`tsa-proxy %h`)
    expect(written).toContain(`IdentityFile`)
    expect(written).not.toContain(`ProxyCommand tsa proxy`)
  })
})

describe(`getPublicKey`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockExistsSync.mockImplementation((path: string) => {
      if (path.endsWith(`sandbox_key`) || path.endsWith(`sandbox_key.pub`)) return true
      return false
    })
    mockReadFileSync.mockImplementation((path: string) => {
      if (path.endsWith(`sandbox_key.pub`))
        return `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIBiT+MYH tdsk-sandbox\n`
      return ``
    })
  })

  it(`reads and trims the public key file`, () => {
    const key = getPublicKey()
    expect(key).toBe(`ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIBiT+MYH tdsk-sandbox`)
  })
})
