export const authHeader = (token?: string) => {
  return token ? { headers: { Authorization: `Bearer ${token}` } } : { headers: {} }
}
