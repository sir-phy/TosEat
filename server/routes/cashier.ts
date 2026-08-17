import { Router, Response } from 'express'
import { db } from '../db.js'
import { authenticate, requireRole, AuthenticatedRequest } from '../auth.js'

export const cashierRouter = Router()

// All routes require CASHIER or MANAGER role (CHEF -> 403)
cashierRouter.use(authenticate, requireRole(['CASHIER', 'MANAGER']))

// GET /api/cashier/orders ?status&paymentStatus&page&limit — Queue
cashierRouter.get('/orders', (req: AuthenticatedRequest, res: Response) => {
  const { status, paymentStatus, page = '1', limit = '20' } = req.query

  let list = db.orders

  if (paymentStatus) {
    list = list.filter(o => o.paymentStatus === paymentStatus)
  } else if (!status) {
    // Defaults to SERVED + UNPAID
    list = list.filter(o => o.status === 'SERVED' && o.paymentStatus === 'UNPAID')
  }

  if (status) {
    list = list.filter(o => o.status === status)
  }

  const pageNum = Math.max(1, parseInt(String(page), 10) || 1)
  const limitNum = Math.max(1, parseInt(String(limit), 10) || 20)
  const total = list.length
  const totalPages = Math.ceil(total / limitNum) || 1
  const start = (pageNum - 1) * limitNum
  const paginated = list.slice(start, start + limitNum)

  return res.status(200).json({
    message: 'Cashier orders queue retrieved successfully',
    data: paginated,
    meta: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages
    }
  })
})

// GET /api/cashier/unpaid-orders — flat POS list
cashierRouter.get('/unpaid-orders', (_req: AuthenticatedRequest, res: Response) => {
  const unpaid = db.orders.filter(o => o.paymentStatus === 'UNPAID' && o.status !== 'CANCELLED')

  return res.status(200).json({
    message: 'Unpaid orders POS list retrieved successfully',
    data: unpaid
  })
})

// GET /api/cashier/orders/:orderId/bill — backend-computed bill for single order
cashierRouter.get('/orders/:orderId/bill', (req: AuthenticatedRequest, res: Response) => {
  const idParam = req.params.orderId
  const order = db.orders.find(o => o.id === Number(idParam) || o.orderNumber === idParam)

  if (!order) {
    return res.status(404).json({
      message: 'Order not found',
      errors: ['ORDER_NOT_FOUND']
    })
  }

  const subtotal = order.subtotal
  const discount = order.discount || 0
  const tax = order.tax || +(subtotal * 0.10).toFixed(2)
  const total = +(subtotal - discount + tax).toFixed(2)

  return res.status(200).json({
    message: 'Computed bill for order retrieved',
    data: {
      orderId: order.id,
      orderNumber: order.orderNumber,
      tableId: order.tableId,
      tableNumber: order.table.tableNumber,
      items: order.items,
      subtotal,
      discount,
      tax,
      total,
      currency: 'USD',
      totalKHR: Math.round(total * 4100),
      paymentStatus: order.paymentStatus,
      status: order.status,
      createdAt: order.createdAt
    }
  })
})

// GET /api/cashier/tables/:tableId/bill — all unpaid orders for a table, aggregated totals
cashierRouter.get('/tables/:tableId/bill', (req: AuthenticatedRequest, res: Response) => {
  const idParam = req.params.tableId
  const table = db.tables.find(t => t.id === Number(idParam) || t.table_number === idParam)

  if (!table) {
    return res.status(404).json({
      message: 'Table not found',
      errors: ['TABLE_NOT_FOUND']
    })
  }

  const unpaidOrders = db.orders.filter(o => o.tableId === table.id && o.paymentStatus === 'UNPAID' && o.status !== 'CANCELLED')

  const subtotal = +unpaidOrders.reduce((sum, o) => sum + o.subtotal, 0).toFixed(2)
  const discount = +unpaidOrders.reduce((sum, o) => sum + (o.discount || 0), 0).toFixed(2)
  const tax = +unpaidOrders.reduce((sum, o) => sum + (o.tax || 0), 0).toFixed(2)
  const total = +unpaidOrders.reduce((sum, o) => sum + o.total, 0).toFixed(2)

  return res.status(200).json({
    message: `Aggregated bill for Table ${table.table_number} retrieved`,
    data: {
      tableId: table.id,
      tableNumber: table.table_number,
      tableName: table.name,
      location: table.location,
      ordersCount: unpaidOrders.length,
      orders: unpaidOrders,
      subtotal,
      discount,
      tax,
      total,
      currency: 'USD',
      totalKHR: Math.round(total * 4100),
      isSettled: unpaidOrders.length === 0
    }
  })
})
