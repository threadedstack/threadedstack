export const checkAuthHeader = (authHeader?: string) => {
  const access_token = authHeader?.split(/bearer /i)[1] || undefined
  return { access_token }
}
