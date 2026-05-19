import axios from 'axios'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: { 'Content-Type': 'application/json' }
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('annapurna_token') || localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('annapurna_token')
      localStorage.removeItem('annapurna_user')
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
