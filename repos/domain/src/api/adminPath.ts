export type TCfgObj = {
  adminPath?: string
}

export const adminPath = <T extends TCfgObj = TCfgObj>(config: T) => {
  return `/${config?.adminPath || `_`}`
}
