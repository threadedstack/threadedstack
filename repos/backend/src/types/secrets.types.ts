export type TSecretResolverDb = {
  services: {
    secret: {
      get: (id: string, opts?: any) => Promise<{ data?: any; error?: any }>
      list: (opts: any) => Promise<{ data?: any[] }>
    }
  }
}
