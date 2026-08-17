import { Server as SocketIOServer, Socket } from 'socket.io'
import { Server as HttpServer } from 'http'
import { verifyToken, AuthPayload } from './auth.js'
import { CustomerNotification } from './db.js'

export interface CustomSocket extends Socket {
  user?: AuthPayload
}

let ioInstance: SocketIOServer | null = null

export const initSocketIO = (httpServer: HttpServer): SocketIOServer => {
  if (ioInstance) return ioInstance

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      credentials: true
    }
  })

  // Authentication middleware
  io.use((socket: CustomSocket, next) => {
    const token = socket.handshake.auth?.token || (socket.handshake.headers?.authorization?.startsWith('Bearer ') ? socket.handshake.headers.authorization.split(' ')[1] : null)

    if (!token) {
      return next(new Error('unauthorized'))
    }

    const payload = verifyToken(token)
    if (!payload) {
      return next(new Error('unauthorized'))
    }

    socket.user = payload
    next()
  })

  io.on('connection', (socket: CustomSocket) => {
    const user = socket.user
    // Auto join kitchen room if CHEF or MANAGER
    if (user && (user.role === 'CHEF' || user.role === 'MANAGER')) {
      socket.join('kitchen')
    }

    // Auto join cashier room if CASHIER or MANAGER
    if (user && (user.role === 'CASHIER' || user.role === 'MANAGER')) {
      socket.join('cashier')
    }

    // If customer has tableId, auto-join table room
    if (user?.tableId) {
      socket.join(`table:${user.tableId}`)
    }

    // Client join order room
    socket.on('join:order', (orderId: number | string, callback?: (res: { ok: boolean }) => void) => {
      if (orderId) {
        socket.join(`order:${orderId}`)
        if (typeof callback === 'function') callback({ ok: true })
      } else {
        if (typeof callback === 'function') callback({ ok: false })
      }
    })

    // Client join table room
    socket.on('join:table', (tableId: number | string, callback?: (res: { ok: boolean }) => void) => {
      if (tableId) {
        socket.join(`table:${tableId}`)
        if (typeof callback === 'function') callback({ ok: true })
      } else {
        if (typeof callback === 'function') callback({ ok: false })
      }
    })

    // Join cashier room
    socket.on('join:cashier', (_data?: any, callback?: (res: { ok: boolean }) => void) => {
      socket.join('cashier')
      if (typeof callback === 'function') callback({ ok: true })
    })

    // Join kitchen room
    socket.on('join:kitchen', (_data?: any, callback?: (res: { ok: boolean }) => void) => {
      socket.join('kitchen')
      if (typeof callback === 'function') callback({ ok: true })
    })
  })

  ioInstance = io
  return io
}

export const getIO = (): SocketIOServer | null => {
  return ioInstance
}

export const emitOrderCreated = (order: { id: number; orderNumber: string; tableId: number; status: string }) => {
  const io = getIO()
  if (!io) return
  const payload = {
    id: order.id,
    orderNumber: order.orderNumber,
    tableId: order.tableId,
    status: order.status
  }
  io.to('kitchen').emit('order.created', payload)
}

export const emitOrderStatusUpdated = (order: { id: number; orderNumber: string; tableId: number; status: string }) => {
  const io = getIO()
  if (!io) return
  const payload = {
    id: order.id,
    orderNumber: order.orderNumber,
    tableId: order.tableId,
    status: order.status
  }
  io.to(`order:${order.id}`).to(`table:${order.tableId}`).to('kitchen').emit('order.status.updated', payload)
}

export const emitOrderReady = (order: { id: number; orderNumber: string; tableId: number; status: string }) => {
  const io = getIO()
  if (!io) return
  const payload = {
    id: order.id,
    orderNumber: order.orderNumber,
    tableId: order.tableId,
    status: order.status
  }
  io.to(`order:${order.id}`).to(`table:${order.tableId}`).emit('order.ready', payload)
}

export const emitOrderServed = (order: { id: number; orderNumber: string; tableId: number; status: string }) => {
  const io = getIO()
  if (!io) return
  const payload = {
    id: order.id,
    orderNumber: order.orderNumber,
    tableId: order.tableId,
    status: order.status
  }
  io.to(`order:${order.id}`).to(`table:${order.tableId}`).emit('order.served', payload)
}

export const emitNotificationCreated = (notification: CustomerNotification) => {
  const io = getIO()
  if (!io) return
  io.to(`order:${notification.orderId}`).to(`table:${notification.tableId}`).emit('notification.created', notification)
}

// Billing Request Events
export const emitBillingRequestCreated = (request: any) => {
  const io = getIO()
  if (!io) return
  io.to('cashier').to(`table:${request.tableId}`).emit('billing.request.created', request)
}

export const emitBillingRequestProcessing = (request: any) => {
  const io = getIO()
  if (!io) return
  io.to('cashier').to(`table:${request.tableId}`).emit('billing.request.processing', request)
}

export const emitBillingRequestResolved = (request: any) => {
  const io = getIO()
  if (!io) return
  io.to('cashier').to(`table:${request.tableId}`).emit('billing.request.resolved', request)
}

export const emitBillingRequestCancelled = (request: any) => {
  const io = getIO()
  if (!io) return
  io.to('cashier').to(`table:${request.tableId}`).emit('billing.request.cancelled', request)
}

// Payment Events
export const emitPaymentCreated = (payment: any) => {
  const io = getIO()
  if (!io) return
  io.to('cashier').to(`table:${payment.tableId}`).emit('payment.created', payment)
}

export const emitPaymentProcessing = (payment: any) => {
  const io = getIO()
  if (!io) return
  io.to('cashier').to(`table:${payment.tableId}`).emit('payment.processing', payment)
}

export const emitPaymentPaid = (payment: any) => {
  const io = getIO()
  if (!io) return
  io.to('cashier').to(`table:${payment.tableId}`).emit('payment.paid', payment)
}

export const emitPaymentFailed = (payment: any) => {
  const io = getIO()
  if (!io) return
  io.to('cashier').to(`table:${payment.tableId}`).emit('payment.failed', payment)
}

export const emitPaymentCancelled = (payment: any) => {
  const io = getIO()
  if (!io) return
  io.to('cashier').to(`table:${payment.tableId}`).emit('payment.cancelled', payment)
}

export const emitPaymentExpired = (payment: any) => {
  const io = getIO()
  if (!io) return
  io.to('cashier').to(`table:${payment.tableId}`).emit('payment.expired', payment)
}

export const emitPaymentRefunded = (payment: any) => {
  const io = getIO()
  if (!io) return
  io.to('cashier').to(`table:${payment.tableId}`).emit('payment.refunded', payment)
}
