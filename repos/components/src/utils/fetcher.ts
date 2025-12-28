export const fetcher = async (url: string): Promise<any> => {
  const response = await fetch(url)

  if (!response.ok) throw new Error(`Network response was not ok`)

  const contentType = response.headers.get(`content-type`)
  return contentType && contentType.includes(`application/json`)
    ? response.json()
    : response.text()
}
