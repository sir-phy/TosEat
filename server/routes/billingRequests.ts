import { Router, Response } from 'express'
import { db, BillingRequest } from '../db.js'
import { authenticate, requireRole, AuthenticatedRequest } from '../auth.js'
import {
  emitBillingRequestCreated,
  emitBillingRequestProcessing,
  emitBillingRequestResolved,
  emitBillingRequestCancelled
} from '../socket.js'

export const billingRequestsRouter = Router()

// POST /api/billing-requests — Customer requests bill ({ tableId })
billingRequestsRouter.post('/', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!
  const tableId = Number(req.body.tableId || user.tableId)

  if (!tableId) {
    return res.status(400).json({
      message: 'tableId is required to request bill',
      errors: ['TABLE_ID_REQUIRED']
    })
  }

  const table = db.tables.find(t => t.id === tableId || t.table_number === String(tableId))
  if (!table) {
    return res.status(404).json({
      message: 'Table not found',
      errors: ['TABLE_NOT_FOUND']
    })
  }

  // 409 if duplicate pending/processing billing request exists
  const existingRequest = db.billingRequests.find(
    b => b.tableId === table.id && (b.status === 'PENDING' || b.status === 'PROCESSING')
  )
  if (existingRequest) {
    return res.status(409).json({
      message: `A billing request is already pending or being processed for Table ${table.table_number}.`,
      errors: ['DUPLICATE_BILLING_REQUEST'],
      data: existingRequest
    })
  }

  // Find all unpaid orders for this table
  const unpaidOrders = db.orders.filter(
    o => o.tableId === table.id && o.paymentStatus === 'UNPAID' && o.status !== 'CANCELLED'
  )

  if (unpaidOrders.length === 0) {
    return res.status(409).json({
      message: `No billable or unpaid orders found for Table ${table.table_number}.`,
      errors: ['NO_BILLABLE_ORDERS']
    })
  }

  const subtotal = +unpaidOrders.reduce((sum, o) => sum + o.subtotal, 0).toFixed(2)
  const discount = +unpaidOrders.reduce((sum, o) => sum + (o.discount || 0), 0).toFixed(2)
  const tax = +unpaidOrders.reduce((sum, o) => sum + (o.tax || 0), 0).toFixed(2)
  const totalAmount = +unpaidOrders.reduce((sum, o) => sum + o.total, 0).toFixed(2)
  const now = new Date().toISOString()

  const newRequest: BillingRequest = {
    id: db.nextBillingId(),
    tableId: table.id,
    table: {
      id: table.id,
      tableNumber: table.table_number
    },
    status: 'PENDING',
    orderIds: unpaidOrders.map(o => o.id),
    orders: unpaidOrders,
    subtotal,
    discount,
    tax,
    totalAmount,
    createdAt: now,
    updatedAt: now,
    resolvedAt: null
  }

  db.billingRequests.unshift(newRequest)
  emitBillingRequestCreated(newRequest)

  return res.status(201).json({
    message: 'Billing request submitted successfully. A cashier will attend shortly.',
    data: newRequest
  })
})

// GET /api/billing-requests — CASHIER/MGR (?page&limit&status&tableId&dateFrom&dateTo)
billingRequestsRouter.get('/', authenticate, requireRole(['CASHIER', 'MANAGER']), (req: AuthenticatedRequest, res: Response) => {
  const { page = '1', limit = '20', status, tableId, dateFrom, dateTo } = req.query

  let list = db.billingRequests

  if (status) {
    list = list.filter(b => b.status === status)
  }
  if (tableId) {
    list = list.filter(b => b.tableId === Number(tableId) || b.table.tableNumber === String(tableId))
  }
  if (dateFrom) {
    list = list.filter(b => b.createdAt >= String(dateFrom))
  }
  if (dateTo) {
    list = list.filter(b => b.createdAt <= String(dateTo))
  }

  const pageNum = Math.max(1, parseInt(String(page), 10) || 1)
  const limitNum = Math.max(1, parseInt(String(limit), 10) || 20)
  const total = list.length
  const totalPages = Math.ceil(total / limitNum) || 1
  const start = (pageNum - 1) * limitNum
  const paginated = list.slice(start, start + limitNum)

  return res.status(200).json({
    message: 'Billing requests retrieved successfully',
    data: paginated,
    meta: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages
    }
  })
})

// GET /api/billing-requests/:id — owner or CASHIER/MGR
billingRequestsRouter.get('/:id', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!
  const id = Number(req.params.id)
  const request = db.billingRequests.find(b => b.id === id)

  if (!request) {
    return res.status(404).json({
      message: 'Billing request not found',
      errors: ['BILLING_REQUEST_NOT_FOUND']
    })
  }

  if (user.role === 'CUSTOMER' && user.tableId && request.tableId !== user.tableId) {
    return res.status(403).json({
      message: 'Forbidden. You do not have permission to view this billing request.',
      errors: ['FORBIDDEN']
    })
  }

  // Refresh latest order statuses
  const freshOrders = db.orders.filter(o => request.orderIds.includes(o.id))
  request.orders = freshOrders

  return res.status(200).json({
    message: 'Billing request details retrieved successfully',
    data: request
  })
})

// PATCH /api/billing-requests/:id/process — CASHIER/MGR
billingRequestsRouter.patch('/:id/process', authenticate, requireRole(['CASHIER', 'MANAGER']), (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!
  const id = Number(req.params.id)
  const request = db.billingRequests.find(b => b.id === id)

  if (!request) {
    return res.status(404).json({
      message: 'Billing request not found',
      errors: ['BILLING_REQUEST_NOT_FOUND']
    })
  }

  const now = new Date().toISOString()
  request.status = 'PROCESSING'
  request.cashierId = user.id
  request.cashierName = user.name
  request.updatedAt = now

  emitBillingRequestProcessing(request)

  return res.status(200).json({
    message: 'Billing request is now being processed',
    data: request
  })
})

// PATCH /api/billing-requests/:id/resolve — CASHIER/MGR (only after payment PAID)
billingRequestsRouter.patch('/:id/resolve', authenticate, requireRole(['CASHIER', 'MANAGER']), (req: AuthenticatedRequest, res: Response) => {
  const id = Number(req.params.id)
  const request = db.billingRequests.find(b => b.id === id)

  if (!request) {
    return res.status(404).json({
      message: 'Billing request not found',
      errors: ['BILLING_REQUEST_NOT_FOUND']
    })
  }

  // Verify all orders are settled
  const unpaid = db.orders.some(o => request.orderIds.includes(o.id) && o.paymentStatus === 'UNPAID' && o.status !== 'CANCELLED')
  if (unpaid) {
    return res.status(400).json({
      message: 'Cannot resolve billing request while orders remain unpaid.',
      errors: ['ORDERS_NOT_PAID']
    })
  }

  const now = new Date().toISOString()
  request.status = 'RESOLVED'
  request.resolvedAt = now
  request.updatedAt = now

  // Free table if no other active orders exist
  const remainingTableOrders = db.orders.some(o => o.tableId === request.tableId && o.paymentStatus === 'UNPAID' && o.status !== 'CANCELLED')
  if (!remainingTableOrders) {
    const table = db.tables.find(t => t.id === request.tableId)
    if (table) table.status = 'AVAILABLE'
  }

  emitBillingRequestResolved(request)

  return res.status(200).json({
    message: 'Billing request resolved successfully',
    data: request
  })
})

// PATCH /api/billing-requests/:id/cancel — owner of PENDING, or CASHIER/MGR
billingRequestsRouter.patch('/:id/cancel', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!
  const id = Number(req.params.id)
  const request = db.billingRequests.find(b => b.id === id)

  if (!request) {
    return res.status(404).json({
      message: 'Billing request not found',
      errors: ['BILLING_REQUEST_NOT_FOUND']
    })
  }

  const isStaff = ['CASHIER', 'MANAGER'].includes(user.role)
  const isOwner = user.role === 'CUSTOMER' && user.tableId === request.tableId && request.status === 'PENDING'

  if (!isStaff && !isOwner) {
    return res.status(403).json({
      message: 'Forbidden. You cannot cancel this billing request.',
      errors: ['FORBIDDEN']
    })
  }

  if (request.status === 'RESOLVED') {
    return res.status(400).json({
      message: 'Cannot cancel a resolved billing request',
      errors: ['CANNOT_CANCEL_RESOLVED_REQUEST']
    })
  }

  const now = new Date().toISOString()
  request.status = 'CANCELLED'
  request.updatedAt = now

  emitBillingRequestCancelled(request)

  return res.status(200).json({
    message: 'Billing request cancelled',
    data: request
  })
})
