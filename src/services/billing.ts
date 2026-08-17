import { api } from './api.js'
import { OrderDetail } from './orders.js'

export interface BillingRequestItem {
  id: number
  tableId: number
  table: {
    id: number
    tableNumber: string
  }
  status: 'PENDING' | 'PROCESSING' | 'RESOLVED' | 'CANCELLED'
  orderIds: number[]
  orders: OrderDetail[]
  subtotal: number
  tax: number
  discount: number
  totalAmount: number
  cashierId?: number
  cashierName?: string
  paymentId?: number
  createdAt: string
  updatedAt: string
  resolvedAt?: string | null
}

export const billingService = {
  // Customer requests bill
  requestBill: (tableId?: number | string) =>
    api.post<BillingRequestItem>('/billing-requests', { tableId }),

  // Cashier/Manager lists billing requests
  getRequests: (params?: {
    page?: number
    limit?: number
    status?: string
    tableId?: number | string
    dateFrom?: string
    dateTo?: string
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
      query = `?${q.toString()}`
    }
    return api.get<BillingRequestItem[]>(`/billing-requests${query}`)
  },

  getRequest: (id: number | string) =>
    api.get<BillingRequestItem>(`/billing-requests/${id}`),

  processRequest: (id: number | string) =>
    api.patch<BillingRequestItem>(`/billing-requests/${id}/process`),

  resolveRequest: (id: number | string) =>
    api.patch<BillingRequestItem>(`/billing-requests/${id}/resolve`),

  cancelRequest: (id: number | string) =>
    api.patch<BillingRequestItem>(`/billing-requests/${id}/cancel`)
}
