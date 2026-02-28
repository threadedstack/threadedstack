import { useState, useCallback, useMemo } from 'react'
import { testEndpoint } from '@TAF/actions/endpoints/api/testEndpoint'

export type THeader = { key: string; value: string }

export type TEndpointTestResponse = {
  status: number
  statusText: string
  body: string
  contentType: string
  timing: number
}

export type TUseEndpointTestOpts = {
  method: string
  projectId: string
  endpointId: string
}

const defaultHeaders: THeader[] = [{ key: 'Content-Type', value: 'application/json' }]
const bodylessMethods = ['GET', 'HEAD']

export const contentTypeToLanguage = (contentType: string): string => {
  const ct = contentType.toLowerCase().split(';')[0].trim()
  if (ct.includes('json')) return 'json'
  if (ct.includes('html')) return 'html'
  if (ct.includes('xml')) return 'xml'
  if (ct.includes('css')) return 'css'
  if (ct.includes('javascript')) return 'javascript'
  if (ct.includes('markdown')) return 'markdown'
  if (ct.includes('yaml')) return 'yaml'
  return 'plaintext'
}

export const useEndpointTest = (opts: TUseEndpointTestOpts) => {
  const { method, projectId, endpointId } = opts

  const [headers, setHeaders] = useState<THeader[]>([...defaultHeaders])
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [response, setResponse] = useState<TEndpointTestResponse | null>(null)

  const addHeader = useCallback(() => {
    setHeaders((prev) => [...prev, { key: '', value: '' }])
  }, [])

  const removeHeader = useCallback((index: number) => {
    setHeaders((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const updateHeader = useCallback(
    (index: number, field: 'key' | 'value', value: string) => {
      setHeaders((prev) =>
        prev.map((h, i) => (i === index ? { ...h, [field]: value } : h))
      )
    },
    []
  )

  const clearResponse = useCallback(() => {
    setResponse(null)
    setError(null)
  }, [])

  const sendRequest = useCallback(async () => {
    setLoading(true)
    setError(null)
    setResponse(null)

    const headersObj: Record<string, string> = {}
    for (const h of headers) {
      if (h.key.trim()) headersObj[h.key.trim()] = h.value
    }

    const isBodyless = bodylessMethods.includes(method.toUpperCase())

    try {
      const result = await testEndpoint({
        projectId,
        endpointId,
        method: method.toUpperCase(),
        headers: headersObj,
        body: isBodyless ? undefined : body || undefined,
      })

      if (result.error) {
        setError(result.error.message || 'Request failed')
      } else if (result.data) {
        setResponse(result.data)
      }
    } finally {
      setLoading(false)
    }
  }, [projectId, endpointId, method, headers, body])

  const monacoLanguage = useMemo(
    () => (response ? contentTypeToLanguage(response.contentType) : 'json'),
    [response]
  )

  return {
    request: { method, headers, body },
    response,
    loading,
    error,
    monacoLanguage,
    setBody,
    addHeader,
    removeHeader,
    updateHeader,
    sendRequest,
    clearResponse,
  }
}
