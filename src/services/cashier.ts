import { api } from './api.js'
import { OrderDetail } from './orders.js'

export interface SingleOrderBill {
  orderId: number
  orderNumber: string
  tableId: number
  tableNumber: string
  items: any[]
  subtotal: number
  discount: number
  tax: number
  total: number
  currency: string
  totalKHR: number
  paymentStatus: string
  status: string
  createdAt: string
}

export interface TableAggregatedBill {
  tableId: number
  tableNumber: string
  tableName?: string
  location?: string
  ordersCount: number
  orders: OrderDetail[]
  subtotal: number
  discount: number
  tax: number
  total: number
  currency: string
  totalKHR: number
  isSettled: boolean
}

export const cashierService = {
  // Cashier queue
  getOrdersQueue: (params?: {
    page?: number
    limit?: number
    status?: string
    paymentStatus?: string
  }) => {
    let query = ''
    if (params) {
      const q = new URLSearchParams()
      if (params.page) q.append('page', String(params.page))
      if (params.limit) q.append('limit', String(params.limit))
      if (params.status) q.append('status', params.status)
      if (params.paymentStatus) q.append('paymentStatus', params.paymentStatus)
      query = `?${q.toString()}`
    }
    return api.get<OrderDetail[]>(`/cashier/orders${query}`)
  },

  // Flat unpaid orders list for POS
  getUnpaidOrders: () =>
    api.get<OrderDetail[]>('/cashier/unpaid-orders'),

  // Backend computed bill for order
  getOrderBill: (orderId: number | string) =>
    api.get<SingleOrderBill>(`/cashier/orders/${orderId}/bill`),

  // Aggregated bill for table
  getTableBill: (tableId: number | string) =>
    api.get<TableAggregatedBill>(`/cashier/tables/${tableId}/bill`)
}
