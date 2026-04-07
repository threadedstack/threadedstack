export const RetryStatusCodes = new Set([429, 500, 502, 503])
export const RetryNetworkCodes = new Set([`ECONNREFUSED`, `ETIMEDOUT`, `ENOTFOUND`])
