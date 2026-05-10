import type { TGitProviderInput } from '@tdsk/domain'
import type { TDatabase } from '@tdsk/database'

import { Exception, EProvider } from '@tdsk/domain'

type TGitProviderInputEntry = {
  projectId: string
  providers: TGitProviderInput[]
}

export const validateGitProviderInputs = async (
  db: TDatabase,
  orgId: string,
  inputs?: TGitProviderInputEntry[]
): Promise<TGitProviderInputEntry[] | undefined> => {
  if (!Array.isArray(inputs)) return undefined
  if (!inputs.length) return []

  for (const entry of inputs) {
    if (!entry.projectId)
      throw new Exception(400, `gitProviderInputs: projectId is required`)
    if (!Array.isArray(entry.providers))
      throw new Exception(
        400,
        `gitProviderInputs: providers must be an array for project ${entry.projectId}`
      )

    const providerIds = entry.providers.filter((p) => p?.id).map((p) => p.id)
    if (!providerIds.length) continue

    const { data: providers, error } = await db.services.provider.list({
      where: { id: providerIds },
    })

    if (error) throw new Exception(500, error.message)

    for (const pid of providerIds) {
      const provider = (providers || []).find((p: any) => p.id === pid)

      if (!provider) throw new Exception(404, `Git provider ${pid} not found`)

      if (provider.orgId !== orgId)
        throw new Exception(
          403,
          `Provider ${pid} does not belong to organization ${orgId}`
        )

      if (provider.type !== EProvider.git)
        throw new Exception(400, `Provider ${pid} is not a git provider`)
    }
  }

  return inputs
}
