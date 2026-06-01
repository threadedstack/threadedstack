export const getAlias = (sandbox: any, projectId: string): string =>
  sandbox.projectConfigs?.find((pc: any) => pc.projectId === projectId)?.alias || ``
