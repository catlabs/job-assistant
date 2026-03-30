export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim()
const API_KEY = import.meta.env.VITE_API_KEY?.trim()

const missingBaseUrlMessage = 'Missing VITE_API_BASE_URL. Add it to frontend/.env.'

export const getApiBaseUrl = (): string => {
  if (!API_BASE_URL) {
    throw new Error(missingBaseUrlMessage)
  }

  return API_BASE_URL
}

export const getJsonHeaders = (headers?: HeadersInit): Headers => {
  const nextHeaders = new Headers(headers)

  if (API_KEY) {
    nextHeaders.set('X-API-Key', API_KEY)
  }

  return nextHeaders
}

export const apiFetch = (path: string, init: RequestInit = {}) =>
  fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: getJsonHeaders(init.headers),
  })
