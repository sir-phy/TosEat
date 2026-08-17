import { api } from './api.js'

export interface PaymentItem {
  id: number
  billingRequestId?: number
  orderId?: number
  tableId: number
  amount: number
  currency: 'USD' | 'KHR'
  method: 'CASH' | 'KHQR' | 'CARD'
  status: 'PENDING' | 'PROCESSING' | 'PAID' | 'FAILED' | 'CANCELLED' | 'EXPIRED' | 'REFUNDED'
  amountReceived?: number
  changeAmount?: number
  qrData?: string
  md5?: string
  hash?: string
  shortHash?: string
  transactionReference?: string
  paidAt?: string | null
  createdAt: string
  updatedAt: string
  expiresAt?: string
}

export const paymentService = {
  // Cash payment
  payCash: (data: { billingRequestId?: number; orderId?: number; tableId?: number; amountReceived: number }) =>
    api.post<{ payment: PaymentItem; changeAmount: number; amountReceived: number; totalPaid: number }>('/payments/cash', data),

  // KHQR payment for single order (customer or cashier)
  generateKHQR: (orderId: number | string) =>
    api.post<{
      paymentId: number
      orderId: number
      amount: number
      currency: string
      amountKHR: number
      qrString: string
      md5: string
      shortHash: string
      expiresAt: string
    }>('/payments/khqr', { orderId }),

  // KHQR payment for table billing request (cashier POS)
  generateBillingKHQR: (billingRequestId: number | string) =>
    api.post<{
      paymentId: number
      billingRequestId: number
      tableNumber: string
      amount: number
      currency: string
      amountKHR: number
      qrString: string
      md5: string
      shortHash: string
      expiresAt: string
    }>('/payments/khqr/create', { billingRequestId }),

  // Check KHQR payment with Bakong
  checkKHQR: (paymentId: number) =>
    api.post<{
      paymentId: number
      status: string
      amount: number
      currency: string
      md5: string
      isPaid: boolean
    }>('/payments/khqr/check', { paymentId }),

  // Get payment status (polling payload)
  getPaymentStatus: (paymentId: number | string) =>
    api.get<{
      paymentId: number
      status: string
      method: string
      amount: number
      currency: string
      paidAt?: string
      isExpired: boolean
      isPaid: boolean
    }>(`/payments/${paymentId}/status`),

  // Verify payment settlement
  verifyPayment: (paymentId: number | string) =>
    api.post<{ payment: PaymentItem; invoice: any }>(`/payments/${paymentId}/verify`),

  // Card payment
  payCard: (data: { billingRequestId?: number; orderId?: number; tableId?: number; transactionReference?: string }) =>
    api.post<{ payment: PaymentItem; totalPaid: number }>('/payments/card', data),

  // List payments history
  getPayments: (params?: {
    page?: number
    limit?: number
    status?: string
    method?: string
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
      if (params.method) q.append('method', params.method)
      if (params.dateFrom) q.append('dateFrom', params.dateFrom)
      if (params.dateTo) q.append('dateTo', params.dateTo)
      if (params.search) q.append('search', params.search)
      query = `?${q.toString()}`
    }
    return api.get<PaymentItem[]>(`/payments${query}`)
  },

  getPayment: (id: number | string) =>
    api.get<PaymentItem>(`/payments/${id}`),

  cancelPayment: (id: number | string) =>
    api.patch<PaymentItem>(`/payments/${id}/cancel`)
}
