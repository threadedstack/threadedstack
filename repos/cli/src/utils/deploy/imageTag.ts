import { Logger } from '@tdsk/logger'
import { capture } from '@TSCL/utils/proc/capture'

/** All image-tag ENVs consumed by devspace's production profile + docker build */
export const TAG_ENVS = [
  `TDSK_IMAGE_TAG`,
  `TDSK_PX_IMAGE_TAG`,
  `TDSK_BE_IMAGE_TAG`,
  `TDSK_CADDY_IMAGE_TAG`,
  `TDSK_SB_IMAGE_TAG`,
  `TDSK_SB_INIT_IMAGE_TAG`,
]

export type TImageTag = {
  /** Short git SHA (7 chars) */
  sha: string
  /** Image tag derived from the SHA, e.g. "sha-abc1234" */
  tag: string
  /** Map of every TDSK_*_IMAGE_TAG env set to `tag` */
  envs: Record<string, string>
}

/** Builds the TDSK_*_IMAGE_TAG env map for the given tag */
export const tagEnvs = (tag: string): Record<string, string> =>
  TAG_ENVS.reduce(
    (acc, key) => {
      acc[key] = tag
      return acc
    },
    {} as Record<string, string>
  )

/** Resolves the short SHA of the current git HEAD */
export const gitShortSha = async (): Promise<string> => {
  const { code, output } = await capture(`git`, [`rev-parse`, `--short=7`, `HEAD`])
  if (code !== 0 || !output)
    throw new Error(`Failed to resolve the current git HEAD short SHA`)

  return output.trim()
}

/** True when the working tree has uncommitted changes */
export const isDirty = async (): Promise<boolean> => {
  const { output } = await capture(`git`, [`status`, `--porcelain`])
  return Boolean(output.trim())
}

/**
 * Computes the deploy image tag (`sha-<short>`) from git HEAD and the
 * matching TDSK_*_IMAGE_TAG env map. Warns when the working tree is dirty,
 * since images build from the working tree rather than the tagged commit.
 */
export const imageTag = async (): Promise<TImageTag> => {
  const sha = await gitShortSha()
  const tag = `sha-${sha}`

  if (await isDirty())
    Logger.warn(
      `  Working tree is dirty — images build from the working tree, not commit ${sha}`
    )

  return { sha, tag, envs: tagEnvs(tag) }
}
