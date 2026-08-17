import { Router, Request, Response } from 'express'
import { db, User } from '../db.js'
import { generateToken, authenticate, AuthenticatedRequest } from '../auth.js'

export const authRouter = Router()

// POST /api/auth/register — public
authRouter.post('/register', (req: Request, res: Response) => {
  const { email, password, role } = req.body

  if (!email || !email.trim() || !password || !password.trim()) {
    return res.status(400).json({
      message: 'Email address and password are required credentials.',
      errors: ['EMAIL_PASSWORD_REQUIRED']
    })
  }

  const cleanEmail = email.trim().toLowerCase()
  const existingUser = db.users.find(u => u.email.toLowerCase() === cleanEmail)
  if (existingUser) {
    // If user exists and password matches, log them in smoothly
    if (existingUser.passwordHash === password) {
      const token = generateToken(existingUser)
      return res.status(200).json({
        message: 'Account already exists. Logged in successfully.',
        data: {
          user: {
            id: existingUser.id,
            name: existingUser.name,
            email: existingUser.email,
            role: existingUser.role,
            role_id: existingUser.role_id,
            status: existingUser.status
          },
          accessToken: token
        }
      })
    }
    // Wrong password for existing account
    return res.status(401).json({
      message: 'Invalid credentials. Password is incorrect for this account.',
      errors: ['INVALID_CREDENTIALS']
    })
  }

  if (password.length < 4) {
    return res.status(400).json({
      message: 'Password must be at least 4 characters.',
      errors: ['PASSWORD_TOO_SHORT']
    })
  }

  const roleRaw = (role || 'CUSTOMER').toString().toUpperCase()
  const normalizedRole: 'MANAGER' | 'CASHIER' | 'CHEF' | 'CUSTOMER' = 
    roleRaw === 'OWNER' || roleRaw === 'MANAGER' ? 'MANAGER' :
    roleRaw === 'CASHIER' ? 'CASHIER' :
    roleRaw === 'CHEF' ? 'CHEF' : 'CUSTOMER'

  const roleIdMap: Record<string, number> = {
    MANAGER: 1,
    CASHIER: 2,
    CHEF: 3,
    CUSTOMER: 4
  }

  const newUser: User = {
    id: Date.now(),
    name: cleanEmail.split('@')[0],
    email: cleanEmail,
    passwordHash: password,
    role: normalizedRole,
    role_id: roleIdMap[normalizedRole] || 4,
    status: 'ACTIVE'
  }

  db.users.push(newUser)
  const token = generateToken(newUser)

  return res.status(201).json({
    message: 'Account registered successfully',
    data: {
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        role_id: newUser.role_id,
        status: newUser.status
      },
      accessToken: token
    }
  })
})

// POST /api/auth/login — public
authRouter.post('/login', (req: Request, res: Response) => {
  const { email, password, role, tableId, name } = req.body

  // If customer anonymous / table guest login
  if (role === 'CUSTOMER' || (!email && tableId)) {
    const tableNum = tableId ? String(tableId) : '12B'
    const tableObj = db.tables.find(t => t.id === Number(tableId) || t.table_number === tableNum)
    const assignedTableId = tableObj ? tableObj.id : (typeof tableId === 'number' ? tableId : 5)
    
    const customerUser: User = {
      id: Date.now(),
      name: name || `Guest Table ${tableObj?.table_number || tableNum}`,
      email: `customer_${assignedTableId}@gomeal.local`,
      passwordHash: '',
      role: 'CUSTOMER',
      role_id: 4,
      status: 'ACTIVE',
      tableId: assignedTableId
    }

    const token = generateToken(customerUser)
    return res.status(200).json({
      message: 'Login successful',
      data: {
        user: {
          id: customerUser.id,
          name: customerUser.name,
          email: customerUser.email,
          role: customerUser.role,
          role_id: customerUser.role_id,
          status: customerUser.status,
          tableId: customerUser.tableId
        },
        accessToken: token
      }
    })
  }

  if (!email || !password) {
    return res.status(400).json({
      message: 'Email and password are required',
      errors: ['EMAIL_PASSWORD_REQUIRED']
    })
  }

  // Lookup in seeded users
  const user = db.users.find(u => u.email.toLowerCase() === email.trim().toLowerCase())
  if (!user || user.passwordHash !== password) {
    return res.status(401).json({
      message: 'Invalid credentials. Please check your email and password.',
      errors: ['INVALID_CREDENTIALS']
    })
  }

  if (user.status !== 'ACTIVE') {
    return res.status(403).json({
      message: 'Account is inactive. Please contact administrator.',
      errors: ['ACCOUNT_INACTIVE']
    })
  }

  const token = generateToken(user)
  return res.status(200).json({
    message: 'Login successful',
    data: {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        role_id: user.role_id,
        status: user.status
      },
      accessToken: token
    }
  })
})

// GET /api/auth/me — private
authRouter.get('/me', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const userPayload = req.user!
  const user = db.users.find(u => u.id === userPayload.id)

  if (user) {
    return res.status(200).json({
      message: 'User profile retrieved successfully',
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        role_id: user.role_id,
        status: user.status
      }
    })
  }

  // Customer or dynamically generated user
  return res.status(200).json({
    message: 'User profile retrieved successfully',
    data: {
      id: userPayload.id,
      name: userPayload.name,
      email: userPayload.email,
      role: userPayload.role,
      role_id: userPayload.role_id,
      status: 'ACTIVE',
      tableId: userPayload.tableId
    }
  })
})

// POST /api/auth/logout — public (stateless)
authRouter.post('/logout', (_req: Request, res: Response) => {
  return res.status(200).json({
    message: 'Logged out successfully',
    data: null
  })
})
