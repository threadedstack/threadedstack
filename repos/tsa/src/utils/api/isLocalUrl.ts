import { LocalUrlPath } from '@TSA/constants/api'

export const isLocalUrl = (url?: string) => url?.includes?.(LocalUrlPath)
