import { join } from 'path'
import { homedir } from 'os'
import { DefaultWorkdir } from '@tdsk/domain'

export const DefSyncTarget = DefaultWorkdir
export const DefSyncMode = `two-way-resolved` as const

export const DefSyncIgnores = [
  `*~`,
  `.env`,
  `*.swp`,
  `*.swo`,
  `.git/`,
  `.DS_Store`,
  `.env.local`,
  `node_modules/`,
]

export const MutagenNpmVersion = `0.19.0-dev.1`
// Bounds the mutagen tarball download from npm -- without it, a stalled
// registry/CDN never settles this fetch, leaving the user staring at a
// frozen "Installing mutagen..." message with no way to know it's stuck.
export const MutagenDownloadTimeoutMs = 30 * 1000

export const SshDir = join(homedir(), `.ssh`)
export const SshConfig = join(SshDir, `config`)
export const TdskConfigDir = join(homedir(), `.config`, `tdsk`)
export const TdskBinDir = join(TdskConfigDir, `bin`)
export const MutagenBinPath = join(TdskBinDir, `mutagen`)
export const ProxyWrapperPath = join(TdskBinDir, `tsa-proxy`)
export const PrivateKeyPath = join(TdskConfigDir, `sandbox_key`)
export const PublicKeyPath = join(TdskConfigDir, `sandbox_key.pub`)
export const MutagenAgentsPath = join(TdskBinDir, `mutagen-agents.tar.gz`)
