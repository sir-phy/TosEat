import { api } from './api.js'

export interface CustomerNotificationItem {
  id: number
  tableId: number
  orderId: number
  type: 'COOKING_STARTED' | 'FOOD_READY' | 'ORDER_SERVED' | 'DELAY_NOTICE' | 'GENERAL'
  message: string
  status: 'UNREAD' | 'READ'
  createdAt: string
  readAt?: string | null
}

export const notificationService = {
  getNotifications: (params?: { tableId?: number | string; status?: 'UNREAD' | 'READ' }) => {
    let query = ''
    if (params) {
      const q = new URLSearchParams()
      if (params.tableId) q.append('tableId', String(params.tableId))
      if (params.status) q.append('status', params.status)
      query = `?${q.toString()}`
    }
    return api.get<CustomerNotificationItem[]>(`/notifications${query}`)
  },

  getNotification: (id: number) => api.get<CustomerNotificationItem>(`/notifications/${id}`),

  markAsRead: (id: number) => api.patch<CustomerNotificationItem>(`/notifications/${id}/read`),

  markAllAsRead: (tableId?: number | string) =>
    api.patch<{ updated: number }>('/notifications/read-all', { tableId })
}
