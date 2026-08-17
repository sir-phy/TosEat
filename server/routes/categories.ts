import { Router, Request, Response } from 'express'
import { db, Category } from '../db.js'
import { authenticate, requireRole } from '../auth.js'

export const categoriesRouter = Router()

// GET /api/categories — public
categoriesRouter.get('/', (_req: Request, res: Response) => {
  return res.status(200).json({
    message: 'Categories retrieved successfully',
    data: db.categories
  })
})

// GET /api/categories/:id — public
categoriesRouter.get('/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const category = db.categories.find(c => c.id === id)
  if (!category) {
    return res.status(404).json({
      message: 'Category not found',
      errors: ['CATEGORY_NOT_FOUND']
    })
  }
  return res.status(200).json({
    message: 'Category retrieved successfully',
    data: category
  })
})

// POST /api/categories — MANAGER
categoriesRouter.post('/', authenticate, requireRole(['MANAGER']), (req: Request, res: Response) => {
  const { name, description, icon, status } = req.body
  if (!name || !name.trim()) {
    return res.status(400).json({
      message: 'Category name is required',
      errors: ['NAME_REQUIRED']
    })
  }

  const nextId = db.categories.length ? Math.max(...db.categories.map(c => c.id)) + 1 : 1
  const newCat: Category = {
    id: nextId,
    name: name.trim(),
    description: description ? description.trim() : '',
    icon: icon || 'restaurant_menu',
    status: status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE'
  }

  db.categories.push(newCat)
  return res.status(201).json({
    message: 'Category created successfully',
    data: newCat
  })
})

// PUT /api/categories/:id — MANAGER
categoriesRouter.put('/:id', authenticate, requireRole(['MANAGER']), (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const cat = db.categories.find(c => c.id === id)
  if (!cat) {
    return res.status(404).json({
      message: 'Category not found',
      errors: ['CATEGORY_NOT_FOUND']
    })
  }

  const { name, description, icon, status } = req.body
  if (name !== undefined) cat.name = name.trim()
  if (description !== undefined) cat.description = description.trim()
  if (icon !== undefined) cat.icon = icon
  if (status !== undefined) cat.status = status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE'

  return res.status(200).json({
    message: 'Category updated successfully',
    data: cat
  })
})

// DELETE /api/categories/:id — MANAGER
categoriesRouter.delete('/:id', authenticate, requireRole(['MANAGER']), (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const index = db.categories.findIndex(c => c.id === id)
  if (index === -1) {
    return res.status(404).json({
      message: 'Category not found',
      errors: ['CATEGORY_NOT_FOUND']
    })
  }

  const deleted = db.categories.splice(index, 1)[0]
  return res.status(200).json({
    message: 'Category deleted successfully',
    data: deleted
  })
})

// PATCH /api/categories/:id/status — MANAGER
categoriesRouter.patch('/:id/status', authenticate, requireRole(['MANAGER']), (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const cat = db.categories.find(c => c.id === id)
  if (!cat) {
    return res.status(404).json({
      message: 'Category not found',
      errors: ['CATEGORY_NOT_FOUND']
    })
  }

  const { status } = req.body
  if (!['ACTIVE', 'INACTIVE'].includes(status)) {
    return res.status(400).json({
      message: 'Invalid status. Must be ACTIVE or INACTIVE',
      errors: ['INVALID_STATUS']
    })
  }

  cat.status = status
  return res.status(200).json({
    message: 'Category status updated successfully',
    data: cat
  })
})
