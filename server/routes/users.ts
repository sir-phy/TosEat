import { Router, Response } from 'express'
import { db, User } from '../db.js'
import { authenticate, requireRole, AuthenticatedRequest } from '../auth.js'

export const usersRouter = Router()

// All user management routes require authentication and MANAGER role
usersRouter.use(authenticate)
usersRouter.use(requireRole(['MANAGER']))

// Helper to sanitize user output (remove passwordHash)
const sanitizeUser = (user: User) => {
  const { passwordHash, ...safe } = user
  return safe
}

// GET /api/users - List users with search, role/status filtering, and summary statistics
usersRouter.get('/', (req: AuthenticatedRequest, res: Response) => {
  const { search, role, status } = req.query

  let filtered = [...db.users]

  // Role filter
  if (role && role !== 'ALL') {
    const roleStr = String(role).toUpperCase()
    filtered = filtered.filter(u => u.role === roleStr)
  }

  // Status filter
  if (status && status !== 'ALL') {
    const statusStr = String(status).toUpperCase()
    filtered = filtered.filter(u => u.status === statusStr)
  }

  // Search filter (name, email, phone)
  if (search && String(search).trim()) {
    const q = String(search).trim().toLowerCase()
    filtered = filtered.filter(u => 
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.phone && u.phone.toLowerCase().includes(q)) ||
      u.role.toLowerCase().includes(q)
    )
  }

  // Calculate statistics across all users in system
  const stats = {
    total: db.users.length,
    active: db.users.filter(u => u.status === 'ACTIVE').length,
    inactive: db.users.filter(u => u.status === 'INACTIVE').length,
    managers: db.users.filter(u => u.role === 'MANAGER').length,
    cashiers: db.users.filter(u => u.role === 'CASHIER').length,
    chefs: db.users.filter(u => u.role === 'CHEF').length,
    customers: db.users.filter(u => u.role === 'CUSTOMER').length
  }

  return res.status(200).json({
    message: 'Users retrieved successfully',
    data: {
      users: filtered.map(sanitizeUser),
      stats
    }
  })
})

// GET /api/users/:id - Get single user details
usersRouter.get('/:id', (req: AuthenticatedRequest, res: Response) => {
  const id = parseInt(req.params.id, 10)
  if (isNaN(id)) {
    return res.status(400).json({ message: 'Invalid user ID format', errors: ['INVALID_ID'] })
  }

  const user = db.users.find(u => u.id === id)
  if (!user) {
    return res.status(404).json({ message: 'User not found', errors: ['USER_NOT_FOUND'] })
  }

  return res.status(200).json({
    message: 'User details retrieved',
    data: sanitizeUser(user)
  })
})

// POST /api/users - Create a new user (Manager only)
usersRouter.post('/', (req: AuthenticatedRequest, res: Response) => {
  const { name, email, password, role, status, phone } = req.body

  if (!name || !name.trim()) {
    return res.status(400).json({ message: 'Full name is required', errors: ['NAME_REQUIRED'] })
  }

  if (!email || !email.trim()) {
    return res.status(400).json({ message: 'Email address is required', errors: ['EMAIL_REQUIRED'] })
  }

  const cleanEmail = email.trim().toLowerCase()
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(cleanEmail)) {
    return res.status(400).json({ message: 'Invalid email address format', errors: ['INVALID_EMAIL'] })
  }

  const existing = db.users.find(u => u.email.toLowerCase() === cleanEmail)
  if (existing) {
    return res.status(409).json({ message: 'A user with this email already exists', errors: ['EMAIL_EXISTS'] })
  }

  if (!password || password.trim().length < 4) {
    return res.status(400).json({ message: 'Password must be at least 4 characters long', errors: ['PASSWORD_TOO_SHORT'] })
  }

  const roleRaw = (role || 'CUSTOMER').toString().toUpperCase()
  const validRole: 'MANAGER' | 'CASHIER' | 'CHEF' | 'CUSTOMER' = 
    roleRaw === 'MANAGER' ? 'MANAGER' :
    roleRaw === 'CASHIER' ? 'CASHIER' :
    roleRaw === 'CHEF' ? 'CHEF' : 'CUSTOMER'

  const roleIdMap: Record<string, number> = {
    MANAGER: 1,
    CASHIER: 2,
    CHEF: 3,
    CUSTOMER: 4
  }

  const newUser: User = {
    id: db.nextUserId(),
    name: name.trim(),
    email: cleanEmail,
    passwordHash: password.trim(),
    role: validRole,
    role_id: roleIdMap[validRole] || 4,
    status: status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
    phone: phone ? String(phone).trim() : undefined,
    createdAt: new Date().toISOString(),
    lastLogin: undefined
  }

  db.users.push(newUser)

  return res.status(201).json({
    message: 'User created successfully',
    data: sanitizeUser(newUser)
  })
})

// PUT /api/users/:id - Update user details
usersRouter.put('/:id', (req: AuthenticatedRequest, res: Response) => {
  const id = parseInt(req.params.id, 10)
  if (isNaN(id)) {
    return res.status(400).json({ message: 'Invalid user ID format', errors: ['INVALID_ID'] })
  }

  const user = db.users.find(u => u.id === id)
  if (!user) {
    return res.status(404).json({ message: 'User not found', errors: ['USER_NOT_FOUND'] })
  }

  const currentUserId = req.user?.id
  const { name, email, role, status, phone, password } = req.body

  // Guard against changing email to an existing one
  if (email && email.trim()) {
    const cleanEmail = email.trim().toLowerCase()
    const duplicate = db.users.find(u => u.id !== id && u.email.toLowerCase() === cleanEmail)
    if (duplicate) {
      return res.status(409).json({ message: 'Another user is already registered with this email', errors: ['EMAIL_EXISTS'] })
    }
    user.email = cleanEmail
  }

  if (name && name.trim()) {
    user.name = name.trim()
  }

  if (phone !== undefined) {
    user.phone = phone ? String(phone).trim() : undefined
  }

  // Role update with safety check
  if (role) {
    const roleRaw = role.toString().toUpperCase()
    const validRole: 'MANAGER' | 'CASHIER' | 'CHEF' | 'CUSTOMER' = 
      roleRaw === 'MANAGER' ? 'MANAGER' :
      roleRaw === 'CASHIER' ? 'CASHIER' :
      roleRaw === 'CHEF' ? 'CHEF' : 'CUSTOMER'

    // Prevent manager from demoting their own current active session
    if (user.id === currentUserId && validRole !== 'MANAGER') {
      return res.status(400).json({
        message: 'You cannot change your own Manager role while logged in.',
        errors: ['SELF_DEMOTION_NOT_ALLOWED']
      })
    }

    user.role = validRole
    const roleIdMap: Record<string, number> = { MANAGER: 1, CASHIER: 2, CHEF: 3, CUSTOMER: 4 }
    user.role_id = roleIdMap[validRole] || 4
  }

  // Status update with safety check
  if (status) {
    const validStatus = status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE'
    // Prevent manager from deactivating themselves
    if (user.id === currentUserId && validStatus === 'INACTIVE') {
      return res.status(400).json({
        message: 'You cannot deactivate your own account.',
        errors: ['SELF_DEACTIVATION_NOT_ALLOWED']
      })
    }
    user.status = validStatus
  }

  // Optional password update
  if (password && password.trim()) {
    if (password.trim().length < 4) {
      return res.status(400).json({ message: 'Password must be at least 4 characters long', errors: ['PASSWORD_TOO_SHORT'] })
    }
    user.passwordHash = password.trim()
  }

  return res.status(200).json({
    message: 'User updated successfully',
    data: sanitizeUser(user)
  })
})

// PATCH /api/users/:id/status - Toggle or change user status
usersRouter.patch('/:id/status', (req: AuthenticatedRequest, res: Response) => {
  const id = parseInt(req.params.id, 10)
  if (isNaN(id)) {
    return res.status(400).json({ message: 'Invalid user ID format', errors: ['INVALID_ID'] })
  }

  const user = db.users.find(u => u.id === id)
  if (!user) {
    return res.status(404).json({ message: 'User not found', errors: ['USER_NOT_FOUND'] })
  }

  const currentUserId = req.user?.id
  const targetStatus = req.body.status 
    ? (req.body.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE')
    : (user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE')

  if (user.id === currentUserId && targetStatus === 'INACTIVE') {
    return res.status(400).json({
      message: 'You cannot deactivate your own account.',
      errors: ['SELF_DEACTIVATION_NOT_ALLOWED']
    })
  }

  user.status = targetStatus

  return res.status(200).json({
    message: `User status changed to ${targetStatus}`,
    data: sanitizeUser(user)
  })
})

// POST /api/users/:id/reset-password - Quick password reset
usersRouter.post('/:id/reset-password', (req: AuthenticatedRequest, res: Response) => {
  const id = parseInt(req.params.id, 10)
  if (isNaN(id)) {
    return res.status(400).json({ message: 'Invalid user ID format', errors: ['INVALID_ID'] })
  }

  const user = db.users.find(u => u.id === id)
  if (!user) {
    return res.status(404).json({ message: 'User not found', errors: ['USER_NOT_FOUND'] })
  }

  const { newPassword } = req.body
  if (!newPassword || newPassword.trim().length < 4) {
    return res.status(400).json({ message: 'New password must be at least 4 characters long', errors: ['PASSWORD_TOO_SHORT'] })
  }

  user.passwordHash = newPassword.trim()

  return res.status(200).json({
    message: 'User password reset successfully',
    data: { id: user.id, email: user.email }
  })
})

// DELETE /api/users/:id - Delete a user
usersRouter.delete('/:id', (req: AuthenticatedRequest, res: Response) => {
  const id = parseInt(req.params.id, 10)
  if (isNaN(id)) {
    return res.status(400).json({ message: 'Invalid user ID format', errors: ['INVALID_ID'] })
  }

  const userIndex = db.users.findIndex(u => u.id === id)
  if (userIndex === -1) {
    return res.status(404).json({ message: 'User not found', errors: ['USER_NOT_FOUND'] })
  }

  const user = db.users[userIndex]
  const currentUserId = req.user?.id

  // Safety checks
  if (user.id === currentUserId) {
    return res.status(400).json({
      message: 'You cannot delete your own account.',
      errors: ['CANNOT_DELETE_SELF']
    })
  }

  if (user.id === 1) {
    return res.status(400).json({
      message: 'The default primary system administrator account cannot be deleted.',
      errors: ['CANNOT_DELETE_PRIMARY_ADMIN']
    })
  }

  db.users.splice(userIndex, 1)

  return res.status(200).json({
    message: 'User deleted successfully',
    data: { id }
  })
})
