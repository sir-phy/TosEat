import { Router, Response } from 'express'
import { db, CustomerNotification } from '../db.js'
import { authenticate, requireRole, AuthenticatedRequest } from '../auth.js'
import { emitOrderStatusUpdated, emitOrderReady, emitOrderServed, emitNotificationCreated } from '../socket.js'

export const kitchenRouter = Router()

// GET /api/kitchen/orders — CHEF or MANAGER
kitchenRouter.get('/orders', authenticate, requireRole(['CHEF', 'MANAGER']), (req: AuthenticatedRequest, res: Response) => {
  const { page = '1', limit = '20', status, tableId, date } = req.query

  let list = db.orders

  if (status) {
    list = list.filter(o => o.status === status)
  } else {
    // Defaults to active kitchen statuses
    list = list.filter(o => ['SENT_TO_KITCHEN', 'PREPARING', 'READY'].includes(o.status))
  }

  if (tableId) {
    list = list.filter(o => o.tableId === Number(tableId) || o.table.tableNumber === String(tableId))
  }

  if (date) {
    list = list.filter(o => o.createdAt.startsWith(String(date)))
  }

  const pageNum = Math.max(1, parseInt(String(page), 10) || 1)
  const limitNum = Math.max(1, parseInt(String(limit), 10) || 20)
  const total = list.length
  const totalPages = Math.ceil(total / limitNum) || 1
  const start = (pageNum - 1) * limitNum
  const paginated = list.slice(start, start + limitNum)

  // Map to queue item format
  const formatted = paginated.map(o => ({
    id: o.id,
    orderNumber: o.orderNumber,
    table: o.table,
    tableId: o.tableId,
    status: o.status,
    createdAt: o.createdAt,
    customerName: o.customerName,
    items: o.items.map(i => ({
      id: i.id,
      name: i.name,
      quantity: i.quantity,
      image: i.image,
      customizations: i.customizations,
      customizationNote: i.customizationNote || 'Standard Portions'
    }))
  }))

  return res.status(200).json({
    message: 'Kitchen queue retrieved successfully',
    data: formatted,
    meta: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages
    }
  })
})

// GET /api/kitchen/orders/:id — CHEF or MANAGER
kitchenRouter.get('/orders/:id', authenticate, requireRole(['CHEF', 'MANAGER']), (req: AuthenticatedRequest, res: Response) => {
  const idParam = req.params.id
  const order = db.orders.find(o => o.id === Number(idParam) || o.orderNumber === idParam)

  if (!order) {
    return res.status(404).json({
      message: 'Order not found in kitchen queue',
      errors: ['ORDER_NOT_FOUND']
    })
  }

  return res.status(200).json({
    message: 'Kitchen order details retrieved successfully',
    data: order
  })
})

// PATCH /api/kitchen/orders/:id/start — CHEF (SENT_TO_KITCHEN -> PREPARING)
kitchenRouter.patch('/orders/:id/start', authenticate, requireRole(['CHEF', 'MANAGER']), (req: AuthenticatedRequest, res: Response) => {
  const idParam = req.params.id
  const order = db.orders.find(o => o.id === Number(idParam) || o.orderNumber === idParam)

  if (!order) {
    return res.status(404).json({
      message: 'Order not found',
      errors: ['ORDER_NOT_FOUND']
    })
  }

  const now = new Date().toISOString()
  order.status = 'PREPARING'
  order.updatedAt = now
  order.history.push({
    status: 'PREPARING',
    timestamp: now,
    note: 'Chef started cooking items'
  })

  // Create Customer Notification
  const notif: CustomerNotification = {
    id: db.nextNotifId(),
    tableId: order.tableId,
    orderId: order.id,
    type: 'COOKING_STARTED',
    message: 'We start cooking now, Please wait a moment☺️.',
    status: 'UNREAD',
    createdAt: now,
    readAt: null
  }
  db.notifications.unshift(notif)

  // Real-time broadcasts
  emitOrderStatusUpdated(order)
  emitNotificationCreated(notif)

  return res.status(200).json({
    message: 'Order preparation started',
    data: {
      order,
      notification: notif
    }
  })
})

// PATCH /api/kitchen/orders/:id/ready — CHEF (PREPARING -> READY)
kitchenRouter.patch('/orders/:id/ready', authenticate, requireRole(['CHEF', 'MANAGER']), (req: AuthenticatedRequest, res: Response) => {
  const idParam = req.params.id
  const order = db.orders.find(o => o.id === Number(idParam) || o.orderNumber === idParam)

  if (!order) {
    return res.status(404).json({
      message: 'Order not found',
      errors: ['ORDER_NOT_FOUND']
    })
  }

  const now = new Date().toISOString()
  order.status = 'READY'
  order.updatedAt = now
  order.history.push({
    status: 'READY',
    timestamp: now,
    note: 'Chef finished cooking. Order ready for delivery'
  })

  // Create Customer Notification
  const notif: CustomerNotification = {
    id: db.nextNotifId(),
    tableId: order.tableId,
    orderId: order.id,
    type: 'FOOD_READY',
    message: 'The food is already done 😋',
    status: 'UNREAD',
    createdAt: now,
    readAt: null
  }
  db.notifications.unshift(notif)

  // Real-time broadcasts
  emitOrderStatusUpdated(order)
  emitOrderReady(order)
  emitNotificationCreated(notif)

  return res.status(200).json({
    message: 'Order marked as ready',
    data: {
      order,
      notification: notif
    }
  })
})

// PATCH /api/kitchen/orders/:id/served — CHEF (READY -> SERVED)
kitchenRouter.patch('/orders/:id/served', authenticate, requireRole(['CHEF', 'MANAGER']), (req: AuthenticatedRequest, res: Response) => {
  const idParam = req.params.id
  const order = db.orders.find(o => o.id === Number(idParam) || o.orderNumber === idParam)

  if (!order) {
    return res.status(404).json({
      message: 'Order not found',
      errors: ['ORDER_NOT_FOUND']
    })
  }

  const now = new Date().toISOString()
  order.status = 'SERVED'
  order.servedAt = now
  order.updatedAt = now
  order.history.push({
    status: 'SERVED',
    timestamp: now,
    note: 'Order served to customer table'
  })

  // Ensure table status is OCCUPIED
  const table = db.tables.find(t => t.id === order.tableId)
  if (table) {
    table.status = 'OCCUPIED'
  }

  // Create Customer Notification
  const notif: CustomerNotification = {
    id: db.nextNotifId(),
    tableId: order.tableId,
    orderId: order.id,
    type: 'ORDER_SERVED',
    message: 'Your order has been served. Enjoy your meal!',
    status: 'UNREAD',
    createdAt: now,
    readAt: null
  }
  db.notifications.unshift(notif)

  // Real-time broadcasts
  emitOrderStatusUpdated(order)
  emitOrderServed(order)
  emitNotificationCreated(notif)

  return res.status(200).json({
    message: 'Order marked as served',
    data: {
      order,
      notification: notif
    }
  })
})
