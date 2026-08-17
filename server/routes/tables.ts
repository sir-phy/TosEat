import { Router, Request, Response } from 'express'
import { db, RestaurantTable, Order, OrderItem, OrderItemCustomization } from '../db.js'
import { authenticate, requireRole, verifyToken, AuthenticatedRequest } from '../auth.js'
import { emitOrderCreated, emitOrderStatusUpdated } from '../socket.js'

export const tablesRouter = Router()

// GET /api/tables/summary — public
tablesRouter.get('/summary', (_req: Request, res: Response) => {
  const total = db.tables.length
  const available = db.tables.filter(t => t.status === 'AVAILABLE').length
  const occupied = db.tables.filter(t => t.status === 'OCCUPIED').length
  const reserved = db.tables.filter(t => t.status === 'RESERVED').length
  const inactive = db.tables.filter(t => t.status === 'INACTIVE').length

  return res.status(200).json({
    message: 'Tables summary retrieved successfully',
    data: {
      total,
      available,
      occupied,
      reserved,
      inactive
    }
  })
})

// GET /api/tables — public (?status&search&page&limit)
tablesRouter.get('/', (req: Request, res: Response) => {
  const { status, search, page, limit } = req.query

  let list = [...db.tables]

  // Validate status if provided
  if (status) {
    const validStatuses = ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'INACTIVE']
    const statusUpper = String(status).toUpperCase()
    if (!validStatuses.includes(statusUpper)) {
      return res.status(400).json({
        message: `Invalid status "${status}". Allowed values: ${validStatuses.join(', ')}`,
        errors: ['INVALID_TABLE_STATUS']
      })
    }
    list = list.filter(t => t.status === statusUpper)
  }

  // Filter search
  if (search) {
    const q = String(search).toLowerCase()
    list = list.filter(t => 
      t.table_number.toLowerCase().includes(q) ||
      (t.name && t.name.toLowerCase().includes(q)) ||
      (t.location && t.location.toLowerCase().includes(q))
    )
  }

  const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10) || (page ? 20 : list.length || 20)))
  const pageNum = Math.max(1, parseInt(String(page), 10) || 1)
  const total = list.length
  const totalPages = Math.ceil(total / limitNum) || 1
  const start = (pageNum - 1) * limitNum
  const paginated = page ? list.slice(start, start + limitNum) : list

  return res.status(200).json({
    message: 'Tables retrieved successfully',
    data: paginated,
    meta: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages
    }
  })
})

// GET /api/tables/:id/qr — public
tablesRouter.get('/:id/qr', (req: Request, res: Response) => {
  const idParam = req.params.id
  const table = db.tables.find(t => t.id === Number(idParam) || t.table_number === idParam)

  if (!table) {
    return res.status(404).json({
      message: 'Table not found',
      errors: ['TABLE_NOT_FOUND']
    })
  }

  const host = req.get('host') || 'localhost:3000'
  const protocol = req.protocol || 'http'
  const url = `${protocol}://${host}/table/${table.table_number}`

  return res.status(200).json({
    message: 'Table QR code info retrieved successfully',
    data: {
      tableId: table.id,
      tableNo: table.table_number,
      url
    }
  })
})

// GET /api/tables/:id/current-order — MGR/CASHIER/CHEF
tablesRouter.get('/:id/current-order', authenticate, requireRole(['MANAGER', 'CASHIER', 'CHEF']), (req: AuthenticatedRequest, res: Response) => {
  const idParam = req.params.id
  const table = db.tables.find(t => t.id === Number(idParam) || t.table_number === idParam)

  if (!table) {
    return res.status(404).json({
      message: 'Table not found',
      errors: ['TABLE_NOT_FOUND']
    })
  }

  const currentOrder = db.orders.find(o => o.tableId === table.id && o.paymentStatus === 'UNPAID' && o.status !== 'CANCELLED')

  return res.status(200).json({
    message: currentOrder ? 'Current active order retrieved' : 'No active unpaid order found for table',
    data: currentOrder || null
  })
})

// GET /api/tables/:id/orders — MGR/CASHIER/CHEF (?page&limit&status&dateFrom&dateTo)
tablesRouter.get('/:id/orders', authenticate, requireRole(['MANAGER', 'CASHIER', 'CHEF']), (req: AuthenticatedRequest, res: Response) => {
  const idParam = req.params.id
  const table = db.tables.find(t => t.id === Number(idParam) || t.table_number === idParam)

  if (!table) {
    return res.status(404).json({
      message: 'Table not found',
      errors: ['TABLE_NOT_FOUND']
    })
  }

  const { page = '1', limit = '20', status, dateFrom, dateTo } = req.query
  let list = db.orders.filter(o => o.tableId === table.id)

  if (status) {
    list = list.filter(o => o.status === status)
  }
  if (dateFrom) {
    list = list.filter(o => o.createdAt >= String(dateFrom))
  }
  if (dateTo) {
    list = list.filter(o => o.createdAt <= String(dateTo))
  }

  const pageNum = Math.max(1, parseInt(String(page), 10) || 1)
  const limitNum = Math.max(1, parseInt(String(limit), 10) || 20)
  const total = list.length
  const totalPages = Math.ceil(total / limitNum) || 1
  const start = (pageNum - 1) * limitNum
  const paginated = list.slice(start, start + limitNum)

  return res.status(200).json({
    message: `Orders for table ${table.table_number} retrieved successfully`,
    data: paginated,
    meta: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages
    }
  })
})

// POST /api/tables/:id/orders — Authenticated
tablesRouter.post('/:id/orders', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const idParam = req.params.id
  const table = db.tables.find(t => t.id === Number(idParam) || t.table_number === idParam)

  if (!table) {
    return res.status(404).json({
      message: 'Table not found',
      errors: ['TABLE_NOT_FOUND']
    })
  }

  if (table.status === 'INACTIVE') {
    return res.status(409).json({
      message: 'Cannot place order on an inactive table',
      errors: ['TABLE_NOT_ACTIVE']
    })
  }

  // Check if occupied by another active order if customer
  const hasUnpaid = db.orders.some(o => o.tableId === table.id && o.paymentStatus === 'UNPAID' && o.status !== 'CANCELLED')
  if (table.status === 'OCCUPIED' && hasUnpaid && req.user?.role === 'CUSTOMER' && req.user.tableId !== table.id) {
    return res.status(409).json({
      message: 'Table is currently occupied',
      errors: ['TABLE_NOT_AVAILABLE']
    })
  }

  const { items, customerName } = req.body
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      message: 'Non-empty items array is required',
      errors: ['INVALID_ORDER_ITEMS']
    })
  }

  let subtotal = 0
  const processedItems: OrderItem[] = []

  for (let idx = 0; idx < items.length; idx++) {
    const raw = items[idx]
    const menuItem = db.menuItems.find(m => m.id === Number(raw.menuItemId))
    if (!menuItem) {
      return res.status(400).json({
        message: `Menu item with ID ${raw.menuItemId} not found`,
        errors: ['MENU_ITEM_NOT_FOUND']
      })
    }

    const qty = Math.max(1, Number(raw.quantity) || 1)
    const itemSubtotal = +(menuItem.price * qty).toFixed(2)
    subtotal += itemSubtotal

    const processedCustomizations: OrderItemCustomization[] = []
    const noteParts: string[] = []

    if (Array.isArray(raw.customizations)) {
      for (const cust of raw.customizations) {
        const ingDef = menuItem.ingredients.find(i => i.ingredientId === Number(cust.ingredientId))
        const origAmount = ingDef ? ingDef.amount : 1
        const customAmount = Number(cust.amount)
        const unit = cust.unit || ingDef?.unit || 'pcs'
        const diff = +(customAmount - origAmount).toFixed(2)
        const ingName = ingDef?.name || db.ingredients.find(i => i.id === Number(cust.ingredientId))?.name || `Ingredient #${cust.ingredientId}`

        if (diff !== 0) {
          processedCustomizations.push({
            ingredientId: Number(cust.ingredientId),
            name: ingName,
            originalAmount: origAmount,
            amount: customAmount,
            unit,
            difference: Math.abs(diff),
            isIncrease: diff > 0
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

  const tax = +(subtotal * 0.10).toFixed(2)
  const total = +(subtotal + tax).toFixed(2)
  const newId = db.nextOrderId()
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const orderNumber = `ORD-${dateStr}-${newId}`
  const now = new Date().toISOString()

  const newOrder: Order = {
    id: newId,
    orderNumber,
    customerId: req.user?.id,
    customerName: customerName || req.user?.name || `Table ${table.table_number} Guest`,
    tableId: table.id,
    table: {
      id: table.id,
      tableNumber: table.table_number
    },
    status: 'SENT_TO_KITCHEN',
    subtotal,
    discount: 0,
    tax,
    total,
    paymentStatus: 'UNPAID',
    items: processedItems,
    history: [
      { status: 'PENDING', timestamp: now, note: 'Order initiated at table' },
      { status: 'SENT_TO_KITCHEN', timestamp: now, note: 'Sent directly to kitchen display system' }
    ],
    createdAt: now,
    updatedAt: now,
    servedAt: null,
    paidAt: null,
    cancelledAt: null
  }

  table.status = 'OCCUPIED'
  db.orders.unshift(newOrder)
  emitOrderCreated(newOrder)

  return res.status(201).json({
    message: 'Order created for table successfully',
    data: newOrder
  })
})

// POST /api/tables/:id/release — CASHIER/MANAGER
tablesRouter.post('/:id/release', authenticate, requireRole(['CASHIER', 'MANAGER']), (req: AuthenticatedRequest, res: Response) => {
  const idParam = req.params.id
  const table = db.tables.find(t => t.id === Number(idParam) || t.table_number === idParam)

  if (!table) {
    return res.status(404).json({
      message: 'Table not found',
      errors: ['TABLE_NOT_FOUND']
    })
  }

  // 409 TABLE_HAS_ACTIVE_ORDER while unpaid order exists
  const hasUnpaidOrder = db.orders.some(o => o.tableId === table.id && o.paymentStatus === 'UNPAID' && o.status !== 'CANCELLED')
  if (hasUnpaidOrder) {
    return res.status(409).json({
      message: `Table ${table.table_number} has active unpaid orders and cannot be released until settled.`,
      errors: ['TABLE_HAS_ACTIVE_ORDER']
    })
  }

  table.status = 'AVAILABLE'
  return res.status(200).json({
    message: `Table ${table.table_number} released and marked AVAILABLE`,
    data: table
  })
})

// GET /api/tables/:id — public (+ staff currentOrder)
tablesRouter.get('/:id', (req: Request, res: Response) => {
  const idParam = req.params.id
  const table = db.tables.find(t => t.id === Number(idParam) || t.table_number === idParam)
  if (!table) {
    return res.status(404).json({
      message: 'Table not found',
      errors: ['TABLE_NOT_FOUND']
    })
  }

  // Check if staff token
  const authHeader = req.headers.authorization
  let currentOrder = null
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1]
    const payload = verifyToken(token)
    if (payload && ['MANAGER', 'CASHIER', 'CHEF'].includes(payload.role)) {
      currentOrder = db.orders.find(o => o.tableId === table.id && o.paymentStatus === 'UNPAID' && o.status !== 'CANCELLED') || null
    }
  }

  return res.status(200).json({
    message: 'Table retrieved successfully',
    data: {
      ...table,
      currentOrder
    }
  })
})

// POST /api/tables — MANAGER ({ tableNo|table_number, name, capacity, location }, status forced AVAILABLE)
tablesRouter.post('/', authenticate, requireRole(['MANAGER']), (req: Request, res: Response) => {
  const { tableNo, table_number, name, capacity, location } = req.body
  const tableNum = String(tableNo || table_number || '').trim()

  if (!tableNum) {
    return res.status(400).json({
      message: 'tableNo or table_number is required',
      errors: ['TABLE_NUMBER_REQUIRED']
    })
  }

  const existing = db.tables.find(t => t.table_number.toLowerCase() === tableNum.toLowerCase())
  if (existing) {
    return res.status(409).json({
      message: `Table with number ${tableNum} already exists`,
      errors: ['TABLE_NUMBER_EXISTS']
    })
  }

  const nextId = db.tables.length ? Math.max(...db.tables.map(t => t.id)) + 1 : 1
  const newTable: RestaurantTable = {
    id: nextId,
    table_number: tableNum,
    name: name ? String(name).trim() : `Table ${tableNum}`,
    capacity: Number(capacity) || 4,
    location: location ? String(location).trim() : 'Main Dining',
    status: 'AVAILABLE' // Forced AVAILABLE as per spec
  }

  db.tables.push(newTable)
  return res.status(201).json({
    message: 'Table created successfully',
    data: newTable
  })
})

// PATCH & PUT /api/tables/:id — MANAGER (name/capacity/location only, status not settable)
const updateTableHandler = (req: Request, res: Response) => {
  const idParam = req.params.id
  const table = db.tables.find(t => t.id === Number(idParam) || t.table_number === idParam)
  if (!table) {
    return res.status(404).json({
      message: 'Table not found',
      errors: ['TABLE_NOT_FOUND']
    })
  }

  const { name, capacity, location, tableNo, table_number } = req.body
  if (name !== undefined) table.name = String(name).trim()
  if (capacity !== undefined) table.capacity = Number(capacity) || table.capacity
  if (location !== undefined) table.location = String(location).trim()
  if (tableNo || table_number) {
    const newNum = String(tableNo || table_number).trim()
    const duplicate = db.tables.find(t => t.id !== table.id && t.table_number.toLowerCase() === newNum.toLowerCase())
    if (duplicate) {
      return res.status(409).json({
        message: `Table number ${newNum} already exists`,
        errors: ['TABLE_NUMBER_EXISTS']
      })
    }
    table.table_number = newNum
  }

  return res.status(200).json({
    message: 'Table details updated successfully',
    data: table
  })
}

tablesRouter.put('/:id', authenticate, requireRole(['MANAGER']), updateTableHandler)
tablesRouter.patch('/:id', authenticate, requireRole(['MANAGER']), updateTableHandler)

// PATCH /api/tables/:id/activate — MANAGER
tablesRouter.patch('/:id/activate', authenticate, requireRole(['MANAGER']), (req: Request, res: Response) => {
  const idParam = req.params.id
  const table = db.tables.find(t => t.id === Number(idParam) || t.table_number === idParam)
  if (!table) {
    return res.status(404).json({
      message: 'Table not found',
      errors: ['TABLE_NOT_FOUND']
    })
  }

  table.status = 'AVAILABLE'
  return res.status(200).json({
    message: `Table ${table.table_number} activated`,
    data: table
  })
})

// PATCH /api/tables/:id/deactivate — MANAGER
tablesRouter.patch('/:id/deactivate', authenticate, requireRole(['MANAGER']), (req: Request, res: Response) => {
  const idParam = req.params.id
  const table = db.tables.find(t => t.id === Number(idParam) || t.table_number === idParam)
  if (!table) {
    return res.status(404).json({
      message: 'Table not found',
      errors: ['TABLE_NOT_FOUND']
    })
  }

  const hasUnpaid = db.orders.some(o => o.tableId === table.id && o.paymentStatus === 'UNPAID' && o.status !== 'CANCELLED')
  if (hasUnpaid) {
    return res.status(409).json({
      message: `Cannot deactivate table ${table.table_number} with active unpaid orders`,
      errors: ['TABLE_HAS_ACTIVE_ORDER']
    })
  }

  table.status = 'INACTIVE'
  return res.status(200).json({
    message: `Table ${table.table_number} deactivated`,
    data: table
  })
})

// DELETE /api/tables/:id — MANAGER (409 if table has orders)
tablesRouter.delete('/:id', authenticate, requireRole(['MANAGER']), (req: Request, res: Response) => {
  const idParam = req.params.id
  const index = db.tables.findIndex(t => t.id === Number(idParam) || t.table_number === idParam)
  if (index === -1) {
    return res.status(404).json({
      message: 'Table not found',
      errors: ['TABLE_NOT_FOUND']
    })
  }

  const table = db.tables[index]
  const hasOrders = db.orders.some(o => o.tableId === table.id)
  if (hasOrders) {
    return res.status(409).json({
      message: `Cannot delete table ${table.table_number} because it has associated order history. Deactivate it instead.`,
      errors: ['TABLE_HAS_ACTIVE_ORDER']
    })
  }

  const deleted = db.tables.splice(index, 1)[0]
  return res.status(200).json({
    message: 'Table deleted successfully',
    data: deleted
  })
})
