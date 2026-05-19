import axios from 'axios'

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://annapurna-chitfund.vercel.app/api'

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' }
})

function clearAuthStorage() {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
  localStorage.removeItem('annapurna_token')
  localStorage.removeItem('annapurna_user')
}

function isSessionEndpoint(url?: string) {
  return Boolean(url && (
    url.includes('/auth/login') ||
    url.includes('/auth/register') ||
    url.includes('/auth/profile')
  ))
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && isSessionEndpoint(error.config?.url)) {
      clearAuthStorage()
      window.dispatchEvent(new Event('annapurna:unauthorized'))
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export async function getData<T>(url: string) {
  const response = await api.get<{ data: T }>(url)
  return response.data.data
}

export async function postData<T, P>(url: string, payload: P) {
  const response = await api.post<{ data: T }>(url, payload)
  return response.data.data
}

export default api
