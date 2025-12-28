import { uuid, hashString } from '@keg-hub/jsutils'

export const shortId = () => hashString(uuid())
