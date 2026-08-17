import express, { Request, Response, NextFunction } from 'express'
import { authRouter } from './routes/auth.js'
import { categoriesRouter } from './routes/categories.js'
import { ingredientsRouter } from './routes/ingredients.js'
import { menuItemsRouter } from './routes/menuItems.js'
import { tablesRouter } from './routes/tables.js'
import { ordersRouter } from './routes/orders.js'
import { kitchenRouter } from './routes/kitchen.js'
import { notificationsRouter } from './routes/notifications.js'
import { usersRouter } from './routes/users.js'
import { billingRequestsRouter } from './routes/billingRequests.js'
import { cashierRouter } from './routes/cashier.js'
import { paymentsRouter } from './routes/payments.js'
import { invoicesRouter } from './routes/invoices.js'

export const createExpressApp = () => {
  const app = express()

  app.use(express.json({ limit: '10mb' }))
  app.use(express.urlencoded({ extended: true }))

  // CORS middleware for cross-origin or same-origin flexibility
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.header('Access-Control-Allow-Origin', '*')
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization')
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200)
    }
    next()
  })

  // Mount API Routers
  app.use('/api/auth', authRouter)
  app.use('/api/users', usersRouter)
  app.use('/api/categories', categoriesRouter)
  app.use('/api/ingredients', ingredientsRouter)
  app.use('/api/menu-items', menuItemsRouter)
  app.use('/api/tables', tablesRouter)
  app.use('/api/orders', ordersRouter)
  app.use('/api/kitchen', kitchenRouter)
  app.use('/api/notifications', notificationsRouter)
  app.use('/api/billing-requests', billingRequestsRouter)
  app.use('/api/cashier', cashierRouter)
  app.use('/api/payments', paymentsRouter)
  app.use('/api/invoices', invoicesRouter)

  // Root API status endpoint
  app.get('/api', (_req: Request, res: Response) => {
    res.status(200).json({
      message: 'GoMeal Restaurant Backend API is live',
      data: {
        version: '1.0.0',
        status: 'ONLINE',
        documentation: {
          auth: '/api/auth',
          users: '/api/users',
          categories: '/api/categories',
          ingredients: '/api/ingredients',
          menuItems: '/api/menu-items',
          tables: '/api/tables',
          orders: '/api/orders',
          kitchen: '/api/kitchen',
          notifications: '/api/notifications',
          billingRequests: '/api/billing-requests',
          cashier: '/api/cashier',
          payments: '/api/payments',
          invoices: '/api/invoices'
        }
      }
    })
  })

  // 404 Handler for undefined /api routes
  app.use('/api/*', (req: Request, res: Response) => {
    res.status(404).json({
      message: `Endpoint ${req.method} ${req.originalUrl} not found`,
      errors: ['ROUTE_NOT_FOUND']
    })
  })

  // Global Error Handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled server error:', err)
    res.status(err.status || 500).json({
      message: err.message || 'Internal Server Error',
      errors: [err.code || 'INTERNAL_SERVER_ERROR']
    })
  })

  return app
}
