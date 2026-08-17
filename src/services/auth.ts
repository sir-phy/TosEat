import { ref } from 'vue'
import { api, setAccessToken, removeAccessToken, getAccessToken } from './api.js'

export interface UserProfile {
  id: number
  name: string
  email: string
  role: 'MANAGER' | 'CASHIER' | 'CHEF' | 'CUSTOMER'
  role_id: number
  status: 'ACTIVE' | 'INACTIVE'
  tableId?: number | null
}

export const currentUser = ref<UserProfile | null>(null)
export const isAuthenticated = ref<boolean>(!!getAccessToken())

export const login = async (credentials: { email?: string; password?: string; role?: string; tableId?: number | string; name?: string }) => {
  const res = await api.post<{ user: UserProfile; accessToken: string }>('/auth/login', credentials)
  if (res.data) {
    setAccessToken(res.data.accessToken)
    currentUser.value = res.data.user
    isAuthenticated.value = true
    localStorage.setItem('gomeal_auth_user', JSON.stringify(res.data.user))
    return res.data
  }
  throw new Error('Login failed')
}

export const register = async (data: { email: string; password: string; role?: string }) => {
  const res = await api.post<{ user: UserProfile; accessToken: string }>('/auth/register', data)
  if (res.data) {
    setAccessToken(res.data.accessToken)
    currentUser.value = res.data.user
    isAuthenticated.value = true
    localStorage.setItem('gomeal_auth_user', JSON.stringify(res.data.user))
    return res.data
  }
  throw new Error('Registration failed')
}

export const fetchMe = async (): Promise<UserProfile | null> => {
  const token = getAccessToken()
  if (!token) {
    currentUser.value = null
    isAuthenticated.value = false
    return null
  }

  try {
    const res = await api.get<UserProfile>('/auth/me')
    if (res.data) {
      currentUser.value = res.data
      isAuthenticated.value = true
      localStorage.setItem('gomeal_auth_user', JSON.stringify(res.data))
      return res.data
    }
  } catch (e) {
    console.warn('Failed to verify user profile with server:', e)
    removeAccessToken()
    currentUser.value = null
    isAuthenticated.value = false
  }
  return null
}

export const logout = async () => {
  try {
    await api.post('/auth/logout')
  } catch (e) {
    // Ignore error
  } finally {
    removeAccessToken()
    currentUser.value = null
    isAuthenticated.value = false
    localStorage.removeItem('gomeal_auth_user')
  }
}

// Check stored cached user on load
try {
  const storedUser = localStorage.getItem('gomeal_auth_user')
  if (storedUser) {
    currentUser.value = JSON.parse(storedUser)
  }
} catch (e) {}
