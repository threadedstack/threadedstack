import { useState, useCallback, useMemo } from 'react'
import { apiUrl } from '@TAF/utils/api/apiUrl'
import { testEndpoint } from '@TAF/actions/endpoints/api/testEndpoint'

export type THeader = { key: string; value: string }
export type TQueryParam = { key: string; value: string }
export type TBodyType = 'json' | 'form' | 'raw'

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

const bodyTypeContentTypes: Record<TBodyType, string> = {
  json: 'application/json',
  form: 'application/x-www-form-urlencoded',
  raw: 'text/plain',
}

const bodyTypeLanguages: Record<TBodyType, string> = {
  json: 'json',
  form: 'plaintext',
  raw: 'plaintext',
}

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
  const [queryParams, setQueryParams] = useState<TQueryParam[]>([])
  const [bodyType, setBodyType] = useState<TBodyType>('json')
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [response, setResponse] = useState<TEndpointTestResponse | null>(null)

  const requestUrl = useMemo(() => {
    const baseUrl = apiUrl({}).replace(/\/$/, '')
    let url = `${baseUrl}/proxy/${projectId}/${endpointId}`

    const validParams = queryParams.filter((p) => p.key.trim())
    if (validParams.length) {
      const params = new URLSearchParams()
      for (const p of validParams) params.append(p.key.trim(), p.value)
      url = `${url}?${params.toString()}`
    }

    return url
  }, [projectId, endpointId, queryParams])

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

  const addQueryParam = useCallback(() => {
    setQueryParams((prev) => [...prev, { key: '', value: '' }])
  }, [])

  const removeQueryParam = useCallback((index: number) => {
    setQueryParams((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const updateQueryParam = useCallback(
    (index: number, field: 'key' | 'value', value: string) => {
      setQueryParams((prev) =>
        prev.map((p, i) => (i === index ? { ...p, [field]: value } : p))
      )
    },
    []
  )

  const changeBodyType = useCallback((newType: TBodyType) => {
    setBodyType(newType)
    setHeaders((prev) => {
      const idx = prev.findIndex((h) => h.key.toLowerCase() === 'content-type')
      const newCt = bodyTypeContentTypes[newType]
      if (idx >= 0) {
        return prev.map((h, i) => (i === idx ? { ...h, value: newCt } : h))
      }
      return [{ key: 'Content-Type', value: newCt }, ...prev]
    })
  }, [])

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

    const queryParamsObj: Record<string, string> = {}
    for (const p of queryParams) {
      if (p.key.trim()) queryParamsObj[p.key.trim()] = p.value
    }

    const isBodyless = bodylessMethods.includes(method.toUpperCase())

    try {
      const result = await testEndpoint({
        projectId,
        endpointId,
        method: method.toUpperCase(),
        headers: headersObj,
        body: isBodyless ? undefined : body || undefined,
        queryParams: Object.keys(queryParamsObj).length ? queryParamsObj : undefined,
      })

      if (result.error) {
        setError(result.error.message || 'Request failed')
      } else if (result.data) {
        setResponse(result.data)
      } else {
        setError('No response received from endpoint')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }, [projectId, endpointId, method, headers, body, queryParams])

  const monacoLanguage = useMemo(
    () => (response ? contentTypeToLanguage(response.contentType) : 'json'),
    [response]
  )

  const bodyLanguage = useMemo(() => bodyTypeLanguages[bodyType], [bodyType])

  return {
    request: { method, headers, body },
    requestUrl,
    queryParams,
    bodyType,
    bodyLanguage,
    response,
    loading,
    error,
    monacoLanguage,
    setBody,
    addHeader,
    removeHeader,
    updateHeader,
    addQueryParam,
    removeQueryParam,
    updateQueryParam,
    changeBodyType,
    sendRequest,
    clearResponse,
  }
}
