import { SandboxIdPrefix } from '@TDM/constants/prefixes'

export const SandboxAliasMaxLength = 63

const SandboxAliasPattern = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/

export const slugify = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[_\s]+/g, `-`)
    .replace(/[^a-z0-9-]/g, ``)
    .replace(/-{2,}/g, `-`)
    .replace(/^-+|-+$/g, ``)
    .slice(0, SandboxAliasMaxLength)
    .replace(/-+$/g, ``)
}

export const isValidSandboxAlias = (value: string): boolean => {
  if (!value || value.length > SandboxAliasMaxLength) return false
  if (value.startsWith(SandboxIdPrefix)) return false
  return SandboxAliasPattern.test(value)
}
