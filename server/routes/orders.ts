import { Router, Response } from 'express'
import { db, Order, OrderItem, OrderItemCustomization } from '../db.js'
import { authenticate, AuthenticatedRequest } from '../auth.js'
import { emitOrderCreated, emitOrderStatusUpdated } from '../socket.js'

export const ordersRouter = Router()

// POST /api/orders — any auth
ordersRouter.post('/', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const { tableId, items, customerName } = req.body
  const user = req.user!

  if (!tableId || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      message: 'tableId and a non-empty items array are required',
      errors: ['INVALID_ORDER_BODY']
    })
  }

  // Verify Table
  const table = db.tables.find(t => t.id === Number(tableId) || t.table_number === String(tableId))
  if (!table) {
    return res.status(404).json({
      message: 'Table not found',
      errors: ['TABLE_NOT_FOUND']
    })
  }

  if (table.status === 'INACTIVE') {
    return res.status(400).json({
      message: 'Table is inactive',
      errors: ['TABLE_INACTIVE']
    })
  }

  // Validate items and compute subtotal
  let subtotal = 0
  const processedItems: OrderItem[] = []

  for (let idx = 0; idx < items.length; idx++) {
    const raw = items[idx]
    const menuItem = db.menuItems.find(m => m.id === Number(raw.menuItemId))
    if (!menuItem) {
      return res.status(400).json({
        message: `Menu item with id ${raw.menuItemId} does not exist`,
        errors: ['MENU_ITEM_NOT_FOUND']
      })
    }

    if (menuItem.status !== 'AVAILABLE') {
      return res.status(400).json({
        message: `Menu item "${menuItem.name}" is ${menuItem.status === 'SOLD_OUT' ? 'Sold Out' : 'Inactive'}`,
        errors: ['ITEM_NOT_AVAILABLE']
      })
    }

    const qty = Math.max(1, Number(raw.quantity) || 1)
    const itemSubtotal = +(menuItem.price * qty).toFixed(2)
    subtotal += itemSubtotal

    // Process customizations
    const processedCustomizations: OrderItemCustomization[] = []
    const noteParts: string[] = []

    if (Array.isArray(raw.customizations)) {
      for (const cust of raw.customizations) {
        const ingDef = menuItem.ingredients.find(i => i.ingredientId === Number(cust.ingredientId))
        const origAmount = ingDef ? ingDef.amount : 1
        const customAmount = Number(cust.amount)
        const unit = cust.unit || ingDef?.unit || 'pcs'
        const diff = +(customAmount - origAmount).toFixed(2)
        const isIncrease = diff > 0
        const ingName = ingDef?.name || db.ingredients.find(i => i.id === Number(cust.ingredientId))?.name || `Ingredient #${cust.ingredientId}`

        if (diff !== 0) {
          processedCustomizations.push({
            ingredientId: Number(cust.ingredientId),
            name: ingName,
            originalAmount: origAmount,
            amount: customAmount,
            unit,
            difference: Math.abs(diff),
            isIncrease
          })
          noteParts.push(`${ingName}: ${origAmount} -> ${customAmount} ${unit}`)
        }
      }
    }

    processedItems.push({
      id: idx + 1,
      menuItemId: menuItem.id,
      name: menuItem.name,
      unitPrice: menuItem.price,
      quantity: qty,
      subtotal: itemSubtotal,
      image: menuItem.image,
      customizations: processedCustomizations,
      customizationNote: noteParts.length > 0 ? noteParts.join(', ') : 'Standard Portions'
    })
  }

  const discount = 0
  const tax = +(subtotal * 0.10).toFixed(2)
  const total = +(subtotal - discount + tax).toFixed(2)

  const newId = db.nextOrderId()
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const orderNumber = `ORD-${dateStr}-${newId}`
  const now = new Date().toISOString()

  const newOrder: Order = {
    id: newId,
    orderNumber,
    customerId: user.id,
    customerName: customerName || user.name || `Table ${table.table_number} Guest`,
    tableId: table.id,
    table: {
      id: table.id,
      tableNumber: table.table_number
    },
    status: 'SENT_TO_KITCHEN',
    subtotal: +subtotal.toFixed(2),
    discount,
    tax,
    total,
    paymentStatus: 'UNPAID',
    items: processedItems,
    history: [
      { status: 'PENDING', timestamp: now, note: 'Order placed by customer' },
      { status: 'SENT_TO_KITCHEN', timestamp: now, note: 'Ticket automatically forwarded to Kitchen queue' }
    ],
    createdAt: now,
    updatedAt: now,
    servedAt: null,
    paidAt: null,
    cancelledAt: null
  }

  // Update table to occupied
  table.status = 'OCCUPIED'

  db.orders.unshift(newOrder)

  // Real-time broadcast
  emitOrderCreated(newOrder)

  return res.status(201).json({
    message: 'Order placed successfully',
    data: newOrder
  })
})

// GET /api/orders — any auth
ordersRouter.get('/', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!
  const { page = '1', limit = '20', status, tableId, dateFrom, dateTo, search } = req.query

  let filtered = db.orders

  // If customer, show only their own table orders or user orders
  if (user.role === 'CUSTOMER') {
    filtered = filtered.filter(o => o.customerId === user.id || (user.tableId && o.tableId === user.tableId))
  }

  if (status) {
    filtered = filtered.filter(o => o.status === status)
  }

  if (tableId) {
    filtered = filtered.filter(o => o.tableId === Number(tableId) || o.table.tableNumber === String(tableId))
  }

  if (dateFrom) {
    filtered = filtered.filter(o => o.createdAt >= String(dateFrom))
  }

  if (dateTo) {
    filtered = filtered.filter(o => o.createdAt <= String(dateTo))
  }

  if (search) {
    const q = String(search).toLowerCase()
    filtered = filtered.filter(o => 
      o.orderNumber.toLowerCase().includes(q) ||
      o.table.tableNumber.toLowerCase().includes(q) ||
      (o.customerName && o.customerName.toLowerCase().includes(q))
    )
  }

  const pageNum = Math.max(1, parseInt(String(page), 10) || 1)
  const limitNum = Math.max(1, parseInt(String(limit), 10) || 20)
  const total = filtered.length
  const totalPages = Math.ceil(total / limitNum) || 1
  const start = (pageNum - 1) * limitNum
  const paginated = filtered.slice(start, start + limitNum)

  return res.status(200).json({
    message: 'Orders retrieved successfully',
    data: paginated,
    meta: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages
    }
  })
})

// GET /api/orders/:id — any auth
ordersRouter.get('/:id', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!
  const idParam = req.params.id
  const order = db.orders.find(o => o.id === Number(idParam) || o.orderNumber === idParam)

  if (!order) {
    return res.status(404).json({
      message: 'Order not found',
      errors: ['ORDER_NOT_FOUND']
    })
  }

  if (user.role === 'CUSTOMER' && order.customerId !== user.id && (!user.tableId || user.tableId !== order.tableId)) {
    return res.status(403).json({
      message: 'Forbidden. You do not have permission to view this order.',
      errors: ['FORBIDDEN']
    })
  }

  return res.status(200).json({
    message: 'Order details retrieved successfully',
    data: order
  })
})

// PATCH /api/orders/:id/cancel — owner or MANAGER
ordersRouter.patch('/:id/cancel', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!
  const idParam = req.params.id
  const order = db.orders.find(o => o.id === Number(idParam) || o.orderNumber === idParam)

  if (!order) {
    return res.status(404).json({
      message: 'Order not found',
      errors: ['ORDER_NOT_FOUND']
    })
  }

  const isManager = user.role === 'MANAGER'
  const isOwner = user.role === 'CUSTOMER' && (order.customerId === user.id || (user.tableId && user.tableId === order.tableId))

  if (!isManager && !isOwner) {
    return res.status(403).json({
      message: 'Forbidden. You are not allowed to cancel this order.',
      errors: ['FORBIDDEN']
    })
  }

  if (order.status === 'SERVED' || order.status === 'PAID') {
    return res.status(400).json({
      message: `Cannot cancel order with status "${order.status}"`,
      errors: ['CANNOT_CANCEL_ORDER']
    })
  }

  const now = new Date().toISOString()
  order.status = 'CANCELLED'
  order.cancelledAt = now
  order.updatedAt = now
  order.history.push({
    status: 'CANCELLED',
    timestamp: now,
    note: `Order cancelled by ${user.role}`
  })

  // Frees table if last active order
  const remainingActive = db.orders.some(o => o.tableId === order.tableId && o.id !== order.id && o.paymentStatus === 'UNPAID' && o.status !== 'CANCELLED')
  if (!remainingActive) {
    const table = db.tables.find(t => t.id === order.tableId)
    if (table && table.status === 'OCCUPIED') {
      table.status = 'AVAILABLE'
    }
  }

  emitOrderStatusUpdated(order)

  return res.status(200).json({
    message: 'Order cancelled successfully',
    data: order
  })
})

// GET /api/orders/:id/history — any auth
ordersRouter.get('/:id/history', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!
  const idParam = req.params.id
  const order = db.orders.find(o => o.id === Number(idParam) || o.orderNumber === idParam)

  if (!order) {
    return res.status(404).json({
      message: 'Order not found',
      errors: ['ORDER_NOT_FOUND']
    })
  }

  if (user.role === 'CUSTOMER' && order.customerId !== user.id && (!user.tableId || user.tableId !== order.tableId)) {
    return res.status(403).json({
      message: 'Forbidden.',
      errors: ['FORBIDDEN']
    })
  }

  return res.status(200).json({
    message: 'Order history retrieved successfully',
    data: order.history
  })
})

// POST /api/orders/:id/pay — CASHIER, MANAGER or CUSTOMER
ordersRouter.post('/:id/pay', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const idParam = req.params.id
  const { paymentMethod = 'Cash' } = req.body
  const order = db.orders.find(o => o.id === Number(idParam) || o.orderNumber === idParam)

  if (!order) {
    return res.status(404).json({
      message: 'Order not found',
      errors: ['ORDER_NOT_FOUND']
    })
  }

  const now = new Date().toISOString()
  order.status = 'PAID'
  order.paymentStatus = 'PAID'
  order.paymentMethod = paymentMethod
  order.paidAt = now
  order.updatedAt = now
  order.history.push({
    status: 'PAID',
    timestamp: now,
    note: `Order paid via ${paymentMethod}`
  })

  // Check if all active orders for this table are paid; if so, free the table
  const remainingUnpaid = db.orders.some(o => o.tableId === order.tableId && o.paymentStatus === 'UNPAID' && o.status !== 'CANCELLED')
  if (!remainingUnpaid) {
    const table = db.tables.find(t => t.id === order.tableId)
    if (table) {
      table.status = 'AVAILABLE'
    }
  }

  emitOrderStatusUpdated(order)

  return res.status(200).json({
    message: 'Order payment settled successfully',
    data: order
  })
})

// POST /api/orders/pay-table/:tableId — CASHIER, MANAGER, CUSTOMER
ordersRouter.post('/pay-table/:tableId', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const tableIdParam = req.params.tableId
  const { paymentMethod = 'Cash' } = req.body

  const targetTable = db.tables.find(t => t.id === Number(tableIdParam) || t.table_number === String(tableIdParam))
  if (!targetTable) {
    return res.status(404).json({
      message: 'Table not found',
      errors: ['TABLE_NOT_FOUND']
    })
  }

  const now = new Date().toISOString()
  const tableOrders = db.orders.filter(o => o.tableId === targetTable.id && o.paymentStatus === 'UNPAID' && o.status !== 'CANCELLED')

  tableOrders.forEach(order => {
    order.status = 'PAID'
    order.paymentStatus = 'PAID'
    order.paymentMethod = paymentMethod
    order.paidAt = now
    order.updatedAt = now
    order.history.push({
      status: 'PAID',
      timestamp: now,
      note: `Table settled via ${paymentMethod}`
    })
    emitOrderStatusUpdated(order)
  })

  targetTable.status = 'AVAILABLE'

  return res.status(200).json({
    message: `Table ${targetTable.table_number} payment settled successfully`,
    data: {
      tableNumber: targetTable.table_number,
      settledOrdersCount: tableOrders.length,
      orders: tableOrders
    }
  })
})

