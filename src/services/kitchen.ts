import { api } from './api.js'
import { OrderDetail } from './orders.js'

export interface KitchenQueueItem {
  id: number
  orderNumber: string
  table: {
    id: number
    tableNumber: string
  }
  tableId: number
  status: 'PENDING' | 'SENT_TO_KITCHEN' | 'PREPARING' | 'READY' | 'SERVED'
  createdAt: string
  customerName?: string
  items: Array<{
    id: number
    name: string
    quantity: number
    image?: string
    customizations: any[]
    customizationNote: string
  }>
}

export interface KitchenActionResponse {
  order: OrderDetail
  notification: {
    id: number
    tableId: number
    orderId: number
    type: string
    message: string
    status: string
    createdAt: string
  }
}

export const kitchenService = {
  getQueue: (params?: {
    page?: number
    limit?: number
    status?: string
    tableId?: number | string
    date?: string
  }) => {
    let query = ''
    if (params) {
      const q = new URLSearchParams()
      if (params.page) q.append('page', String(params.page))
      if (params.limit) q.append('limit', String(params.limit))
      if (params.status) q.append('status', params.status)
      if (params.tableId) q.append('tableId', String(params.tableId))
      if (params.date) q.append('date', params.date)
      query = `?${q.toString()}`
    }
    return api.get<KitchenQueueItem[]>(`/kitchen/orders${query}`)
  },

  getOrderDetails: (id: number | string) => api.get<OrderDetail>(`/kitchen/orders/${id}`),

  startCooking: (id: number | string) => api.patch<KitchenActionResponse>(`/kitchen/orders/${id}/start`),

  markReady: (id: number | string) => api.patch<KitchenActionResponse>(`/kitchen/orders/${id}/ready`),

  markServed: (id: number | string) => api.patch<KitchenActionResponse>(`/kitchen/orders/${id}/served`)
}
