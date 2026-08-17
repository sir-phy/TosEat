import { api } from './api.js'
import { OrderDetail } from './orders.js'

export interface InvoiceItem {
  id: number
  invoiceNumber: string
  paymentId: number
  paymentMethod: string
  tableId: number
  tableNumber: string
  orderIds: number[]
  orders: OrderDetail[]
  subtotal: number
  tax: number
  discount: number
  total: number
  currency: 'USD' | 'KHR'
  status: 'ISSUED' | 'CANCELLED'
  cancelReason?: string
  cancelledAt?: string | null
  reprintCount: number
  createdAt: string
}

export const invoiceService = {
  // Create manual fallback invoice
  createInvoice: (paymentId: number) =>
    api.post<InvoiceItem>('/invoices', { paymentId }),

  // List invoices
  getInvoices: (params?: {
    page?: number
    limit?: number
    paymentMethod?: string
    dateFrom?: string
    dateTo?: string
    search?: string
    tableNo?: string
  }) => {
    let query = ''
    if (params) {
      const q = new URLSearchParams()
      if (params.page) q.append('page', String(params.page))
      if (params.limit) q.append('limit', String(params.limit))
      if (params.paymentMethod) q.append('paymentMethod', params.paymentMethod)
      if (params.dateFrom) q.append('dateFrom', params.dateFrom)
      if (params.dateTo) q.append('dateTo', params.dateTo)
      if (params.search) q.append('search', params.search)
      if (params.tableNo) q.append('tableNo', params.tableNo)
      query = `?${q.toString()}`
    }
    return api.get<InvoiceItem[]>(`/invoices${query}`)
  },

  getInvoice: (id: number | string) =>
    api.get<InvoiceItem>(`/invoices/${id}`),

  getInvoiceByNumber: (invoiceNumber: string) =>
    api.get<InvoiceItem>(`/invoices/number/${invoiceNumber}`),

  // Thermal receipt text format
  getReceiptText: async (id: number | string): Promise<string> => {
    const res = await fetch(`/api/invoices/${id}/receipt`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('gomeal_access_token') || ''}`
      }
    })
    return res.text()
  },

  // Reprint increment
  reprintInvoice: (id: number | string) =>
    api.get<InvoiceItem>(`/invoices/${id}/reprint`),

  // Cancel invoice (Manager only)
  cancelInvoice: (id: number | string, reason: string) =>
    api.patch<InvoiceItem>(`/invoices/${id}/cancel`, { reason }),

  // Get PDF download/view URL
  getPdfUrl: (id: number | string) => `/api/invoices/${id}/pdf`
}
