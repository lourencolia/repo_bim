import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  headers: { 'Content-Type': 'application/json' },
})

// Inject Bearer token in every request when available
api.interceptors.request.use(config => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Redirect to login when a protected request returns 401 (session expired)
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401 && localStorage.getItem('access_token')) {
      localStorage.removeItem('access_token')
      localStorage.removeItem('temp_token')
      window.location.href = '/login?expired=1'
    }
    return Promise.reject(error)
  }
)

// ── Auth endpoints ─────────────────────────────────────────────────────────

export const register = (data) =>
  api.post('/auth/register', data)

export const login = (data) =>
  api.post('/auth/login', data)

export const setup2FA = (tempToken) =>
  api.post('/auth/2fa/setup', { temp_token: tempToken })

export const verify2FA = (tempToken, totpCode) =>
  api.post('/auth/2fa/verify', { temp_token: tempToken, totp_code: totpCode })

export const getMe = () =>
  api.get('/auth/me')

// ── File endpoints ─────────────────────────────────────────────────────────

export const uploadFile = (file, description, onProgress) => {
  const form = new FormData()
  form.append('file', file)
  if (description) form.append('description', description)
  return api.post('/files/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: onProgress,
  })
}

export const getMyFiles = () =>
  api.get('/files/mine')

export const deleteFile = (fileId) =>
  api.delete(`/files/${fileId}`)

export const shareFile = (fileId, recipientMatricula, lgpdConsent) =>
  api.post(`/files/${fileId}/share`, {
    recipient_matricula: recipientMatricula,
    lgpd_consent: lgpdConsent,
  })

export const getFileShares = (fileId) =>
  api.get(`/files/${fileId}/shares`)

export const revokeShare = (fileId, shareId) =>
  api.delete(`/files/${fileId}/share/${shareId}`)

export const downloadFile = (fileId) =>
  api.get(`/files/${fileId}/download`, { responseType: 'blob' })

export const getSharedWithMe = () =>
  api.get('/files/shared-with-me')

export const getMyActivity = () =>
  api.get('/auth/me/activity')

export const forgotPassword = (email) =>
  api.post('/auth/forgot-password', { email })

export const resetPassword = (token, new_password) =>
  api.post('/auth/reset-password', { token, new_password })

export default api
