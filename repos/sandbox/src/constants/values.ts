import type { TSandboxRuntime } from '@tdsk/domain'

export const DefaultTempdir = `/tmp`
export const EnvProfilePath = `/etc/profile.d/tdsk-env.sh`

export const SkillsVolumeName = `tdsk-skills`
export const VolumeMountName = `proxy-ca-cert`
export const CACertMountPath = `/usr/local/share/ca-certificates/tdsk-proxy.crt`
export const DefaultRuntime: TSandboxRuntime = {
  name: `node`,
  command: `node`,
  extension: `.js`,
}
