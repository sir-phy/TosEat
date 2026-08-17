import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { db, User, JWT_SECRET } from './db.js'

export interface AuthPayload {
  id: number
  email: string
  name: string
  role: 'MANAGER' | 'CASHIER' | 'CHEF' | 'CUSTOMER'
  role_id: number
  tableId?: number | null
}

export interface AuthenticatedRequest extends Request {
  user?: AuthPayload
}

export const generateToken = (user: User | AuthPayload): string => {
  const payload: AuthPayload = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    role_id: user.role_id,
    tableId: user.tableId || null
  }
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}

export const verifyToken = (token: string): AuthPayload | null => {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthPayload
  } catch (err) {
    return null
  }
}

export const authenticate = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      message: 'Authentication required. Missing or invalid Bearer token.',
      errors: ['UNAUTHORIZED']
    })
  }

  const token = authHeader.split(' ')[1]
  const payload = verifyToken(token)

  if (!payload) {
    return res.status(401).json({
      message: 'Invalid or expired access token.',
      errors: ['INVALID_TOKEN']
    })
  }

  req.user = payload
  next()
}

export const optionalAuthenticate = (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1]
    const payload = verifyToken(token)
    if (payload) {
      req.user = payload
    }
  }
  next()
}

export const requireRole = (allowedRoles: Array<'MANAGER' | 'CASHIER' | 'CHEF' | 'CUSTOMER'>) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        message: 'Authentication required.',
        errors: ['UNAUTHORIZED']
      })
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Forbidden. Requires one of roles: [${allowedRoles.join(', ')}]. Current role: ${req.user.role}.`,
        errors: ['FORBIDDEN']
      })
    }

    next()
  }
}
