import { Router, Response } from 'express'
import { db } from '../db.js'
import { authenticate, AuthenticatedRequest } from '../auth.js'

export const notificationsRouter = Router()

// GET /api/notifications — private
notificationsRouter.get('/', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!
  const { tableId, status } = req.query

  let list = db.notifications

  // Customers see only their own table notifications
  if (user.role === 'CUSTOMER') {
    if (user.tableId) {
      list = list.filter(n => n.tableId === user.tableId)
    } else if (tableId) {
      list = list.filter(n => n.tableId === Number(tableId))
    }
  } else if (tableId) {
    list = list.filter(n => n.tableId === Number(tableId))
  }

  if (status) {
    list = list.filter(n => n.status === status)
  }

  return res.status(200).json({
    message: 'Notifications retrieved successfully',
    data: list
  })
})

// PATCH /api/notifications/read-all — marks all of yours READ
notificationsRouter.patch('/read-all', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!
  const tableId = user.tableId || (req.body.tableId ? Number(req.body.tableId) : null)
  const now = new Date().toISOString()

  let count = 0
  db.notifications.forEach(n => {
    if (user.role === 'CUSTOMER' && tableId && n.tableId !== tableId) return
    if (n.status === 'UNREAD') {
      n.status = 'READ'
      n.readAt = now
      count++
    }
  })

  return res.status(200).json({
    message: 'All notifications marked as read',
    data: { updated: count }
  })
})

// GET /api/notifications/:id — private
notificationsRouter.get('/:id', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!
  const id = Number(req.params.id)
  const notif = db.notifications.find(n => n.id === id)

  if (!notif) {
    return res.status(404).json({
      message: 'Notification not found',
      errors: ['NOTIFICATION_NOT_FOUND']
    })
  }

  if (user.role === 'CUSTOMER' && user.tableId && notif.tableId !== user.tableId) {
    return res.status(403).json({
      message: 'Forbidden. You do not have permission to view this notification.',
      errors: ['FORBIDDEN']
    })
  }

  return res.status(200).json({
    message: 'Notification retrieved successfully',
    data: notif
  })
})

// PATCH /api/notifications/:id/read — marks one READ
notificationsRouter.patch('/:id/read', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!
  const id = Number(req.params.id)
  const notif = db.notifications.find(n => n.id === id)

  if (!notif) {
    return res.status(404).json({
      message: 'Notification not found',
      errors: ['NOTIFICATION_NOT_FOUND']
    })
  }

  if (user.role === 'CUSTOMER' && user.tableId && notif.tableId !== user.tableId) {
    return res.status(403).json({
      message: 'Forbidden.',
      errors: ['FORBIDDEN']
    })
  }

  notif.status = 'READ'
  notif.readAt = new Date().toISOString()

  return res.status(200).json({
    message: 'Notification marked as read',
    data: notif
  })
})
