import { api } from './api.js'

export type UserRole = 'MANAGER' | 'CASHIER' | 'CHEF' | 'CUSTOMER'
export type UserStatus = 'ACTIVE' | 'INACTIVE'

export interface ManagedUser {
  id: number
  name: string
  email: string
  role: UserRole
  role_id: number
  status: UserStatus
  phone?: string
  avatar?: string
  tableId?: number | null
  createdAt?: string
  lastLogin?: string
}

export interface UserStats {
  total: number
  active: number
  inactive: number
  managers: number
  cashiers: number
  chefs: number
  customers: number
}

export interface UserListResponse {
  users: ManagedUser[]
  stats: UserStats
}

export interface UserFilters {
  search?: string
  role?: string
  status?: string
}

export interface CreateUserPayload {
  name: string
  email: string
  password: string
  role: UserRole
  status?: UserStatus
  phone?: string
}

export interface UpdateUserPayload {
  name?: string
  email?: string
  role?: UserRole
  status?: UserStatus
  phone?: string
  password?: string
}

export const userService = {
  async getUsers(filters: UserFilters = {}): Promise<UserListResponse> {
    const params = new URLSearchParams()
    if (filters.search) params.append('search', filters.search)
    if (filters.role && filters.role !== 'ALL') params.append('role', filters.role)
    if (filters.status && filters.status !== 'ALL') params.append('status', filters.status)

    const query = params.toString() ? `?${params.toString()}` : ''
    const res = await api.get<UserListResponse>(`/users${query}`)
    return res.data || { users: [], stats: { total: 0, active: 0, inactive: 0, managers: 0, cashiers: 0, chefs: 0, customers: 0 } }
  },

  async getUser(id: number): Promise<ManagedUser> {
    const res = await api.get<ManagedUser>(`/users/${id}`)
    if (res.data) return res.data
    throw new Error('User not found')
  },

  async createUser(payload: CreateUserPayload): Promise<ManagedUser> {
    const res = await api.post<ManagedUser>('/users', payload)
    if (res.data) return res.data
    throw new Error(res.message || 'Failed to create user')
  },

  async updateUser(id: number, payload: UpdateUserPayload): Promise<ManagedUser> {
    const res = await api.put<ManagedUser>(`/users/${id}`, payload)
    if (res.data) return res.data
    throw new Error(res.message || 'Failed to update user')
  },

  async toggleStatus(id: number, status?: UserStatus): Promise<ManagedUser> {
    const res = await api.patch<ManagedUser>(`/users/${id}/status`, { status })
    if (res.data) return res.data
    throw new Error(res.message || 'Failed to update user status')
  },

  async resetPassword(id: number, newPassword: string): Promise<{ id: number; email: string }> {
    const res = await api.post<{ id: number; email: string }>(`/users/${id}/reset-password`, { newPassword })
    if (res.data) return res.data
    throw new Error(res.message || 'Failed to reset password')
  },

  async deleteUser(id: number): Promise<{ id: number }> {
    const res = await api.delete<{ id: number }>(`/users/${id}`)
    if (res.data) return res.data
    throw new Error(res.message || 'Failed to delete user')
  }
}
