/** Injectable resolver so tests need no real DNS. Returns resolved addresses. */
export type TEgressResolver = (host: string) => Promise<string[]>
