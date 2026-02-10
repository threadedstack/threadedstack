export const checkAuthHeader = (authHeader?: string) => {
  const access_token = authHeader && authHeader.split(/bearer /i)[1]
  return access_token ? { access_token } : { access_token: undefined }
}
