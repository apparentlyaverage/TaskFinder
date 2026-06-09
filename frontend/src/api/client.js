// src/api/client.js
// HTTP client — wires to the real backend when VITE_API_URL is set

const BASE = import.meta.env.VITE_API_URL || ''

async function request(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`)
  return data
}

export const api = {
  get:    (path, token)       => request('GET',    path, null, token),
  post:   (path, body, token) => request('POST',   path, body, token),
  patch:  (path, body, token) => request('PATCH',  path, body, token),
  put:    (path, body, token) => request('PUT',    path, body, token),
  delete: (path, token)       => request('DELETE', path, null, token),
}

export default api
