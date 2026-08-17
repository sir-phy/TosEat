import { api } from './api.js'

export interface CreateOrderPayload {
  tableId: number | string
  customerName?: string
  items: Array<{
    menuItemId: number
    quantity: number
    customizationNote?: string
    customizations?: Array<{
      ingredientId: number
      name?: string
      originalAmount?: number
      amount: number
      unit?: string
      difference?: number
      isIncrease?: boolean
    }>
  }>
}

export interface OrderCustomization {
  ingredientId: number
  name?: string
  originalAmount?: number
  amount: number
  unit?: string
  difference?: number
  isIncrease?: boolean
}

export interface OrderItemDetail {
  id: number
  menuItemId: number
  name: string
  unitPrice: number
  quantity: number
  subtotal: number
  image?: string
  customizations: OrderCustomization[]
  customizationNote?: string
}

export interface OrderDetail {
  id: number
  orderNumber: string
  customerId?: number
  customerName?: string
  tableId: number
  table: {
    id: number
    tableNumber: string
  }
  status: 'PENDING' | 'SENT_TO_KITCHEN' | 'PREPARING' | 'READY' | 'SERVED' | 'PAID' | 'CANCELLED'
  subtotal: number
  discount: number
  tax: number
  total: number
  paymentMethod?: string
  paymentStatus?: 'UNPAID' | 'PAID'
  items: OrderItemDetail[]
  history: Array<{ status: string; timestamp: string; note?: string }>
  createdAt: string
  updatedAt: string
  servedAt?: string | null
  paidAt?: string | null
  cancelledAt?: string | null
}

export const orderService = {
  createOrder: (payload: CreateOrderPayload) => api.post<OrderDetail>('/orders', payload),

  getOrders: (params?: {
    page?: number
    limit?: number
    status?: string
    tableId?: number | string
    dateFrom?: string
    dateTo?: string
    search?: string
  }) => {
    let query = ''
    if (params) {
      const q = new URLSearchParams()
      if (params.page) q.append('page', String(params.page))
      if (params.limit) q.append('limit', String(params.limit))
      if (params.status) q.append('status', params.status)
      if (params.tableId) q.append('tableId', String(params.tableId))
      if (params.dateFrom) q.append('dateFrom', params.dateFrom)
      if (params.dateTo) q.append('dateTo', params.dateTo)
      if (params.search) q.append('search', params.search)
      query = `?${q.toString()}`
    }
    return api.get<OrderDetail[]>(`/orders${query}`)
  },

  getOrder: (id: number | string) => api.get<OrderDetail>(`/orders/${id}`),

  cancelOrder: (id: number | string) => api.patch<OrderDetail>(`/orders/${id}/cancel`),

  getOrderHistory: (id: number | string) => api.get<Array<{ status: string; timestamp: string }>>(`/orders/${id}/history`),

  payOrder: (id: number | string, paymentMethod: string = 'Cash') =>
    api.post<OrderDetail>(`/orders/${id}/pay`, { paymentMethod }),

  payTable: (tableId: number | string, paymentMethod: string = 'Cash') =>
    api.post<{ tableNumber: string; settledOrdersCount: number; orders: OrderDetail[] }>(`/orders/pay-table/${tableId}`, { paymentMethod })
}
