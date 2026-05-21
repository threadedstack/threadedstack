import type { TSandboxRuntimeId, TSandboxSkillLink } from '@tdsk/domain'

import { logger } from '@TBE/utils/logger'
import { slugify, RuntimeSkillPathMap, SandboxHomePath } from '@tdsk/domain'

export type TSkillFileResolution = {
  configMapData: Record<string, string>
  mountPath: string
  files: Array<{ key: string; path: string }>
}

const resolvePath = (basePath: string): string =>
  basePath.startsWith(`~`) ? basePath.replace(`~`, SandboxHomePath) : basePath

export const resolveSkillFiles = (
  runtime: TSandboxRuntimeId,
  skillLinks: TSandboxSkillLink[],
  customSkillPath?: string
): TSkillFileResolution | null => {
  const runtimeConfig = RuntimeSkillPathMap[runtime]
  const rawPath = customSkillPath || runtimeConfig?.basePath
  if (!rawPath) return null

  const mountPath = resolvePath(rawPath)
  const layout = runtimeConfig?.fileLayout || `flat`
  const fileName = runtimeConfig?.fileName || `.md`
  const sorted = [...skillLinks].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))

  const configMapData: Record<string, string> = {}
  const files: Array<{ key: string; path: string }> = []

  for (const link of sorted) {
    if (!link.skill?.instructions) {
      logger.warn(
        `[Sandbox] Skill "${link.skill?.name}" (${link.skillId}) has empty instructions, skipping`
      )
      continue
    }

    const slug = slugify(link.skill.name)
    if (!slug) {
      logger.warn(
        `[Sandbox] Skill "${link.skill.name}" (${link.skillId}) produces empty slug, skipping`
      )
      continue
    }

    const cmKey = `skill-${slug}`

    if (configMapData[cmKey]) {
      logger.warn(
        `[Sandbox] Duplicate skill slug "${slug}" — skill "${link.skill.name}" conflicts with an existing entry, skipping`
      )
      continue
    }

    configMapData[cmKey] = link.skill.instructions
    layout === `nested`
      ? files.push({ key: cmKey, path: `${slug}/${fileName}` })
      : files.push({ key: cmKey, path: `${slug}${fileName}` })
  }

  if (!files.length) return null

  return { configMapData, mountPath, files }
}
