import { api } from './api.js'
import { OrderDetail } from './orders.js'

export interface TableItem {
  id: number
  table_number: string
  name?: string
  capacity: number
  location?: string
  status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'INACTIVE'
  currentOrder?: OrderDetail | null
}

export interface TableSummary {
  total: number
  available: number
  occupied: number
  reserved: number
  inactive: number
}

export const tableService = {
  // Summary count
  getSummary: () => api.get<TableSummary>('/tables/summary'),

  // List tables with search/filter/pagination
  getTables: (params?: { status?: string; search?: string; page?: number; limit?: number }) => {
    let query = ''
    if (params) {
      const q = new URLSearchParams()
      if (params.status) q.append('status', params.status)
      if (params.search) q.append('search', params.search)
      if (params.page) q.append('page', String(params.page))
      if (params.limit) q.append('limit', String(params.limit))
      query = `?${q.toString()}`
    }
    return api.get<TableItem[]>(`/tables${query}`)
  },

  getTable: (id: number | string) => api.get<TableItem>(`/tables/${id}`),

  getTableQr: (id: number | string) =>
    api.get<{ tableId: number; tableNo: string; url: string }>(`/tables/${id}/qr`),

  getCurrentOrder: (id: number | string) =>
    api.get<OrderDetail | null>(`/tables/${id}/current-order`),

  getTableOrders: (id: number | string, params?: { page?: number; limit?: number; status?: string; dateFrom?: string; dateTo?: string }) => {
    let query = ''
    if (params) {
      const q = new URLSearchParams()
      if (params.page) q.append('page', String(params.page))
      if (params.limit) q.append('limit', String(params.limit))
      if (params.status) q.append('status', params.status)
      if (params.dateFrom) q.append('dateFrom', params.dateFrom)
      if (params.dateTo) q.append('dateTo', params.dateTo)
      query = `?${q.toString()}`
    }
    return api.get<OrderDetail[]>(`/tables/${id}/orders${query}`)
  },

  createOrderForTable: (tableId: number | string, payload: { items: Array<{ menuItemId: number; quantity: number; customizations?: any[] }>; customerName?: string }) =>
    api.post<OrderDetail>(`/tables/${tableId}/orders`, payload),

  releaseTable: (id: number | string) =>
    api.post<TableItem>(`/tables/${id}/release`),

  createTable: (data: { table_number?: string; tableNo?: string; name?: string; capacity: number; location?: string }) =>
    api.post<TableItem>('/tables', data),

  updateTable: (id: number | string, data: { name?: string; capacity?: number; location?: string; table_number?: string; tableNo?: string }) =>
    api.patch<TableItem>(`/tables/${id}`, data),

  activateTable: (id: number | string) =>
    api.patch<TableItem>(`/tables/${id}/activate`),

  deactivateTable: (id: number | string) =>
    api.patch<TableItem>(`/tables/${id}/deactivate`),

  deleteTable: (id: number | string) =>
    api.delete<TableItem>(`/tables/${id}`)
}
