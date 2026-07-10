import { collectionsApi } from '@TAF/services'
import { setCollections } from '@TAF/actions/collections/local/setCollections'

type TFetchCollectionsOpts = {
  orgId: string
  projectId: string
}

export const fetchCollections = async (opts: TFetchCollectionsOpts) => {
  const { orgId, projectId } = opts
  const resp = await collectionsApi.list(orgId, projectId)
  if (resp.error) return { error: resp.error }
  resp.data && setCollections(projectId, resp.data)
  return resp
}
