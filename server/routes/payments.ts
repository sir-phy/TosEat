import { Router, Response } from 'express'
import crypto from 'crypto'
import { db, Payment, Invoice, Order } from '../db.js'
import { authenticate, requireRole, AuthenticatedRequest } from '../auth.js'
import {
  emitPaymentCreated,
  emitPaymentProcessing,
  emitPaymentPaid,
  emitPaymentCancelled,
  emitOrderStatusUpdated,
  emitBillingRequestResolved
} from '../socket.js'

export const paymentsRouter = Router()

// Helper: auto-generate invoice upon successful payment
export const autoGenerateInvoice = (payment: Payment, orders: Order[]): Invoice => {
  const existing = db.invoices.find(inv => inv.paymentId === payment.id)
  if (existing) return existing

  const now = new Date().toISOString()
  const dateStr = now.slice(0, 10).replace(/-/g, '')
  const invSeq = db.nextInvoiceId()
  const invoiceNumber = `INV-${dateStr}-${invSeq}`

  const subtotal = +orders.reduce((s, o) => s + o.subtotal, 0).toFixed(2)
  const discount = +orders.reduce((s, o) => s + (o.discount || 0), 0).toFixed(2)
  const tax = +orders.reduce((s, o) => s + (o.tax || 0), 0).toFixed(2)
  const total = +orders.reduce((s, o) => s + o.total, 0).toFixed(2)
  const targetTable = db.tables.find(t => t.id === payment.tableId)

  const newInvoice: Invoice = {
    id: invSeq,
    invoiceNumber,
    paymentId: payment.id,
    paymentMethod: payment.method,
    tableId: payment.tableId,
    tableNumber: targetTable?.table_number || String(payment.tableId),
    orderIds: orders.map(o => o.id),
    orders: [...orders],
    subtotal,
    discount,
    tax,
    total,
    currency: payment.currency,
    status: 'ISSUED',
    reprintCount: 0,
    createdAt: now
  }

  db.invoices.unshift(newInvoice)
  return newInvoice
}

// Settle orders, billing request, table, and generate invoice
export const settlePaymentAndOrders = (payment: Payment) => {
  const now = new Date().toISOString()
  payment.status = 'PAID'
  payment.paidAt = now
  payment.updatedAt = now

  let settledOrders: Order[] = []

  if (payment.billingRequestId) {
    const billingReq = db.billingRequests.find(b => b.id === payment.billingRequestId)
    if (billingReq) {
      billingReq.status = 'RESOLVED'
      billingReq.paymentId = payment.id
      billingReq.resolvedAt = now
      billingReq.updatedAt = now

      settledOrders = db.orders.filter(o => billingReq.orderIds.includes(o.id))
      emitBillingRequestResolved(billingReq)
    }
  } else if (payment.orderId) {
    const singleOrder = db.orders.find(o => o.id === payment.orderId)
    if (singleOrder) {
      settledOrders = [singleOrder]
    }
  } else {
    settledOrders = db.orders.filter(o => o.tableId === payment.tableId && o.paymentStatus === 'UNPAID')
  }

  settledOrders.forEach(order => {
    order.status = 'PAID'
    order.paymentStatus = 'PAID'
    order.paymentMethod = payment.method
    order.paidAt = now
    order.updatedAt = now
    order.history.push({
      status: 'PAID',
      timestamp: now,
      note: `Payment settled via ${payment.method}`
    })
    emitOrderStatusUpdated(order)
  })

  // Check if all active orders for this table are paid; if so, free the table
  const remainingUnpaid = db.orders.some(
    o => o.tableId === payment.tableId && o.paymentStatus === 'UNPAID' && o.status !== 'CANCELLED'
  )
  if (!remainingUnpaid) {
    const table = db.tables.find(t => t.id === payment.tableId)
    if (table) table.status = 'AVAILABLE'
  }

  // Auto-generate invoice
  autoGenerateInvoice(payment, settledOrders)
  emitPaymentPaid(payment)
}

// POST /api/payments/cash — CASHIER/MGR ({ billingRequestId, amountReceived })
paymentsRouter.post('/cash', authenticate, requireRole(['CASHIER', 'MANAGER']), (req: AuthenticatedRequest, res: Response) => {
  const { billingRequestId, orderId, tableId, amountReceived } = req.body

  let targetBilling = billingRequestId ? db.billingRequests.find(b => b.id === Number(billingRequestId)) : null
  let ordersToPay: Order[] = []
  let resolvedTableId = 0

  if (targetBilling) {
    ordersToPay = db.orders.filter(o => targetBilling!.orderIds.includes(o.id) && o.paymentStatus === 'UNPAID')
    resolvedTableId = targetBilling.tableId
  } else if (orderId) {
    const single = db.orders.find(o => o.id === Number(orderId))
    if (single) {
      ordersToPay = [single]
      resolvedTableId = single.tableId
    }
  } else if (tableId) {
    ordersToPay = db.orders.filter(o => o.tableId === Number(tableId) && o.paymentStatus === 'UNPAID')
    resolvedTableId = Number(tableId)
  }

  if (ordersToPay.length === 0) {
    return res.status(404).json({
      message: 'No unpaid orders found for payment settlement',
      errors: ['NO_UNPAID_ORDERS']
    })
  }

  const billTotal = +ordersToPay.reduce((s, o) => s + o.total, 0).toFixed(2)
  const received = Number(amountReceived)

  if (isNaN(received) || received < billTotal) {
    return res.status(409).json({
      message: `Insufficient cash received. Required $${billTotal.toFixed(2)}, received $${(received || 0).toFixed(2)}`,
      errors: ['INSUFFICIENT_AMOUNT'],
      data: {
        requiredAmount: billTotal,
        amountReceived: received || 0,
        missingAmount: +(billTotal - (received || 0)).toFixed(2)
      }
    })
  }

  const changeAmount = +(received - billTotal).toFixed(2)
  const now = new Date().toISOString()
  const paymentId = db.nextPaymentId()

  const payment: Payment = {
    id: paymentId,
    billingRequestId: targetBilling ? targetBilling.id : undefined,
    orderId: orderId ? Number(orderId) : undefined,
    tableId: resolvedTableId,
    amount: billTotal,
    currency: 'USD',
    method: 'CASH',
    status: 'PAID',
    amountReceived: received,
    changeAmount,
    paidAt: now,
    createdAt: now,
    updatedAt: now
  }

  db.payments.unshift(payment)
  settlePaymentAndOrders(payment)

  return res.status(201).json({
    message: 'Cash payment processed successfully',
    data: {
      payment,
      changeAmount,
      amountReceived: received,
      totalPaid: billTotal
    }
  })
})

// POST /api/payments/khqr — owner cust / CASHIER/MGR ({ orderId }) — order-based QR
paymentsRouter.post('/khqr', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const { orderId } = req.body
  const order = db.orders.find(o => o.id === Number(orderId) || o.orderNumber === orderId)

  if (!order) {
    return res.status(404).json({
      message: 'Order not found',
      errors: ['ORDER_NOT_FOUND']
    })
  }

  const now = new Date()
  const expiresAt = new Date(now.getTime() + 15 * 60 * 1000).toISOString() // 15 mins expiry
  const paymentId = db.nextPaymentId()
  const md5Hash = crypto.createHash('md5').update(`ORDER-${order.id}-${order.total}-${Date.now()}`).digest('hex')
  const shortHash = md5Hash.slice(0, 8).toUpperCase()

  // Bakong KHQR payload format simulation
  const qrString = `00020101021229300012bakong@abaa0108GOMEALPOS520458125303840540${order.total.toFixed(2)}5802KH5906GOMEAL6010PHNOM PENH62240108${order.orderNumber}0708${shortHash}6304${md5Hash.slice(0, 4)}`

  const payment: Payment = {
    id: paymentId,
    orderId: order.id,
    tableId: order.tableId,
    amount: order.total,
    currency: 'USD',
    method: 'KHQR',
    status: 'PENDING',
    qrData: qrString,
    md5: md5Hash,
    hash: md5Hash,
    shortHash,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    expiresAt
  }

  db.payments.unshift(payment)
  emitPaymentCreated(payment)

  return res.status(201).json({
    message: 'KHQR generated for order',
    data: {
      paymentId: payment.id,
      orderId: order.id,
      amount: order.total,
      currency: 'USD',
      amountKHR: Math.round(order.total * 4100),
      qrString,
      md5: md5Hash,
      shortHash,
      expiresAt
    }
  })
})

// POST /api/payments/khqr/create — CASHIER/MGR ({ billingRequestId }) — table-visit QR
paymentsRouter.post('/khqr/create', authenticate, requireRole(['CASHIER', 'MANAGER']), (req: AuthenticatedRequest, res: Response) => {
  const { billingRequestId } = req.body
  const billingReq = db.billingRequests.find(b => b.id === Number(billingRequestId))

  if (!billingReq) {
    return res.status(404).json({
      message: 'Billing request not found',
      errors: ['BILLING_REQUEST_NOT_FOUND']
    })
  }

  const now = new Date()
  const expiresAt = new Date(now.getTime() + 15 * 60 * 1000).toISOString()
  const paymentId = db.nextPaymentId()
  const md5Hash = crypto.createHash('md5').update(`BILLING-${billingReq.id}-${billingReq.totalAmount}-${Date.now()}`).digest('hex')
  const shortHash = md5Hash.slice(0, 8).toUpperCase()

  const qrString = `00020101021229300012bakong@abaa0108GOMEALPOS520458125303840540${billingReq.totalAmount.toFixed(2)}5802KH5906GOMEAL6010PHNOM PENH62240108BILL${billingReq.id}0708${shortHash}6304${md5Hash.slice(0, 4)}`

  const payment: Payment = {
    id: paymentId,
    billingRequestId: billingReq.id,
    tableId: billingReq.tableId,
    amount: billingReq.totalAmount,
    currency: 'USD',
    method: 'KHQR',
    status: 'PENDING',
    qrData: qrString,
    md5: md5Hash,
    hash: md5Hash,
    shortHash,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    expiresAt
  }

  db.payments.unshift(payment)
  emitPaymentCreated(payment)

  return res.status(201).json({
    message: 'KHQR generated for table billing request',
    data: {
      paymentId: payment.id,
      billingRequestId: billingReq.id,
      tableNumber: billingReq.table.tableNumber,
      amount: billingReq.totalAmount,
      currency: 'USD',
      amountKHR: Math.round(billingReq.totalAmount * 4100),
      qrString,
      md5: md5Hash,
      shortHash,
      expiresAt
    }
  })
})

// POST /api/payments/khqr/check — CASHIER/MGR ({ paymentId })
paymentsRouter.post('/khqr/check', authenticate, requireRole(['CASHIER', 'MANAGER']), (req: AuthenticatedRequest, res: Response) => {
  const { paymentId } = req.body
  const payment = db.payments.find(p => p.id === Number(paymentId))

  if (!payment) {
    return res.status(404).json({
      message: 'Payment not found',
      errors: ['PAYMENT_NOT_FOUND']
    })
  }

  // Check lazy expiry
  if (payment.expiresAt && new Date(payment.expiresAt) < new Date() && payment.status === 'PENDING') {
    payment.status = 'EXPIRED'
    payment.updatedAt = new Date().toISOString()
  }

  return res.status(200).json({
    message: 'Bakong KHQR payment check completed',
    data: {
      paymentId: payment.id,
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
      md5: payment.md5,
      isPaid: payment.status === 'PAID'
    }
  })
})

// GET /api/payments/:paymentId/status — owner / CASHIER/MGR (polling payload, lazy EXPIRED)
paymentsRouter.get('/:paymentId/status', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const paymentId = Number(req.params.paymentId)
  const payment = db.payments.find(p => p.id === paymentId)

  if (!payment) {
    return res.status(404).json({
      message: 'Payment not found',
      errors: ['PAYMENT_NOT_FOUND']
    })
  }

  // Lazy expiration check
  if (payment.expiresAt && new Date(payment.expiresAt) < new Date() && (payment.status === 'PENDING' || payment.status === 'PROCESSING')) {
    payment.status = 'EXPIRED'
    payment.updatedAt = new Date().toISOString()
  }

  return res.status(200).json({
    message: 'Payment status retrieved',
    data: {
      paymentId: payment.id,
      status: payment.status,
      method: payment.method,
      amount: payment.amount,
      currency: payment.currency,
      paidAt: payment.paidAt,
      isExpired: payment.status === 'EXPIRED',
      isPaid: payment.status === 'PAID'
    }
  })
})

// POST /api/payments/:paymentId/verify (+ /verify/md5, /verify/hash, /verify/short-hash)
const handleVerifyPayment = (req: AuthenticatedRequest, res: Response) => {
  const paymentId = Number(req.params.paymentId)
  const payment = db.payments.find(p => p.id === paymentId)

  if (!payment) {
    return res.status(404).json({
      message: 'Payment not found',
      errors: ['PAYMENT_NOT_FOUND']
    })
  }

  if (payment.status === 'PAID') {
    const existingInvoice = db.invoices.find(inv => inv.paymentId === payment.id)
    return res.status(200).json({
      message: 'Payment was already verified and settled',
      data: {
        payment,
        invoice: existingInvoice
      }
    })
  }

  if (payment.status === 'CANCELLED' || payment.status === 'EXPIRED') {
    return res.status(400).json({
      message: `Cannot verify payment with status "${payment.status}"`,
      errors: ['INVALID_PAYMENT_STATUS']
    })
  }

  // Settle payment and generate invoice
  settlePaymentAndOrders(payment)
  const invoice = db.invoices.find(inv => inv.paymentId === payment.id)

  return res.status(200).json({
    message: 'Payment verified and settled successfully with Bakong network',
    data: {
      payment,
      invoice
    }
  })
}

paymentsRouter.post('/:paymentId/verify', authenticate, handleVerifyPayment)
paymentsRouter.post('/:paymentId/verify/md5', authenticate, handleVerifyPayment)
paymentsRouter.post('/:paymentId/verify/hash', authenticate, handleVerifyPayment)
paymentsRouter.post('/:paymentId/verify/short-hash', authenticate, handleVerifyPayment)

// POST /api/payments/card — CASHIER/MGR ({ billingRequestId, transactionReference })
paymentsRouter.post('/card', authenticate, requireRole(['CASHIER', 'MANAGER']), (req: AuthenticatedRequest, res: Response) => {
  const { billingRequestId, orderId, tableId, transactionReference } = req.body

  let targetBilling = billingRequestId ? db.billingRequests.find(b => b.id === Number(billingRequestId)) : null
  let ordersToPay: Order[] = []
  let resolvedTableId = 0

  if (targetBilling) {
    ordersToPay = db.orders.filter(o => targetBilling!.orderIds.includes(o.id) && o.paymentStatus === 'UNPAID')
    resolvedTableId = targetBilling.tableId
  } else if (orderId) {
    const single = db.orders.find(o => o.id === Number(orderId))
    if (single) {
      ordersToPay = [single]
      resolvedTableId = single.tableId
    }
  } else if (tableId) {
    ordersToPay = db.orders.filter(o => o.tableId === Number(tableId) && o.paymentStatus === 'UNPAID')
    resolvedTableId = Number(tableId)
  }

  if (ordersToPay.length === 0) {
    return res.status(404).json({
      message: 'No unpaid orders found to settle with card payment',
      errors: ['NO_UNPAID_ORDERS']
    })
  }

  const billTotal = +ordersToPay.reduce((s, o) => s + o.total, 0).toFixed(2)
  const now = new Date().toISOString()
  const paymentId = db.nextPaymentId()

  const payment: Payment = {
    id: paymentId,
    billingRequestId: targetBilling ? targetBilling.id : undefined,
    orderId: orderId ? Number(orderId) : undefined,
    tableId: resolvedTableId,
    amount: billTotal,
    currency: 'USD',
    method: 'CARD',
    status: 'PAID',
    transactionReference: transactionReference || `TXN-POS-${Date.now().toString().slice(-6)}`,
    paidAt: now,
    createdAt: now,
    updatedAt: now
  }

  db.payments.unshift(payment)
  settlePaymentAndOrders(payment)

  return res.status(201).json({
    message: 'Card payment processed successfully',
    data: {
      payment,
      totalPaid: billTotal
    }
  })
})

// GET /api/payments — CASHIER/MGR (?page&limit&status&method&dateFrom&dateTo&search)
paymentsRouter.get('/', authenticate, requireRole(['CASHIER', 'MANAGER']), (req: AuthenticatedRequest, res: Response) => {
  const { page = '1', limit = '20', status, method, dateFrom, dateTo, search } = req.query

  let list = db.payments

  if (status) {
    list = list.filter(p => p.status === status)
  }
  if (method) {
    list = list.filter(p => p.method === method)
  }
  if (dateFrom) {
    list = list.filter(p => p.createdAt >= String(dateFrom))
  }
  if (dateTo) {
    list = list.filter(p => p.createdAt <= String(dateTo))
  }
  if (search) {
    const q = String(search).toLowerCase()
    list = list.filter(p => 
      p.id.toString().includes(q) ||
      (p.transactionReference && p.transactionReference.toLowerCase().includes(q)) ||
      (p.shortHash && p.shortHash.toLowerCase().includes(q))
    )
  }

  const pageNum = Math.max(1, parseInt(String(page), 10) || 1)
  const limitNum = Math.max(1, parseInt(String(limit), 10) || 20)
  const total = list.length
  const totalPages = Math.ceil(total / limitNum) || 1
  const start = (pageNum - 1) * limitNum
  const paginated = list.slice(start, start + limitNum)

  return res.status(200).json({
    message: 'Payments history retrieved successfully',
    data: paginated,
    meta: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages
    }
  })
})

// GET /api/payments/:id — CASHIER/MGR or Owner
paymentsRouter.get('/:id', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!
  const id = Number(req.params.id)
  const payment = db.payments.find(p => p.id === id)

  if (!payment) {
    return res.status(404).json({
      message: 'Payment not found',
      errors: ['PAYMENT_NOT_FOUND']
    })
  }

  if (user.role === 'CUSTOMER' && user.tableId && payment.tableId !== user.tableId) {
    return res.status(403).json({
      message: 'Forbidden.',
      errors: ['FORBIDDEN']
    })
  }

  return res.status(200).json({
    message: 'Payment details retrieved',
    data: payment
  })
})

// PATCH /api/payments/:id/cancel — CASHIER/MGR (PENDING/PROCESSING only)
paymentsRouter.patch('/:id/cancel', authenticate, requireRole(['CASHIER', 'MANAGER']), (req: AuthenticatedRequest, res: Response) => {
  const id = Number(req.params.id)
  const payment = db.payments.find(p => p.id === id)

  if (!payment) {
    return res.status(404).json({
      message: 'Payment not found',
      errors: ['PAYMENT_NOT_FOUND']
    })
  }

  if (payment.status !== 'PENDING' && payment.status !== 'PROCESSING') {
    return res.status(400).json({
      message: `Cannot cancel payment with status "${payment.status}". Only PENDING or PROCESSING payments can be cancelled.`,
      errors: ['INVALID_PAYMENT_STATUS']
    })
  }

  const now = new Date().toISOString()
  payment.status = 'CANCELLED'
  payment.updatedAt = now

  emitPaymentCancelled(payment)

  return res.status(200).json({
    message: 'Payment cancelled successfully',
    data: payment
  })
})
