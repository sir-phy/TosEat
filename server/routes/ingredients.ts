import { Router, Request, Response } from 'express'
import { db, Ingredient } from '../db.js'
import { authenticate, requireRole } from '../auth.js'

export const ingredientsRouter = Router()

// GET /api/ingredients — public
ingredientsRouter.get('/', (_req: Request, res: Response) => {
  return res.status(200).json({
    message: 'Ingredients retrieved successfully',
    data: db.ingredients
  })
})

// GET /api/ingredients/:id — public
ingredientsRouter.get('/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const ingredient = db.ingredients.find(i => i.id === id)
  if (!ingredient) {
    return res.status(404).json({
      message: 'Ingredient not found',
      errors: ['INGREDIENT_NOT_FOUND']
    })
  }
  return res.status(200).json({
    message: 'Ingredient retrieved successfully',
    data: ingredient
  })
})

// POST /api/ingredients — MANAGER
ingredientsRouter.post('/', authenticate, requireRole(['MANAGER']), (req: Request, res: Response) => {
  const { name, unit, status } = req.body
  if (!name || !unit) {
    return res.status(400).json({
      message: 'Ingredient name and unit are required',
      errors: ['NAME_UNIT_REQUIRED']
    })
  }

  const nextId = db.ingredients.length ? Math.max(...db.ingredients.map(i => i.id)) + 1 : 1
  const newIng: Ingredient = {
    id: nextId,
    name: name.trim(),
    unit: unit.trim(),
    status: status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE'
  }

  db.ingredients.push(newIng)
  return res.status(201).json({
    message: 'Ingredient created successfully',
    data: newIng
  })
})

// PUT /api/ingredients/:id — MANAGER
ingredientsRouter.put('/:id', authenticate, requireRole(['MANAGER']), (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const ing = db.ingredients.find(i => i.id === id)
  if (!ing) {
    return res.status(404).json({
      message: 'Ingredient not found',
      errors: ['INGREDIENT_NOT_FOUND']
    })
  }

  const { name, unit, status } = req.body
  if (name !== undefined) ing.name = name.trim()
  if (unit !== undefined) ing.unit = unit.trim()
  if (status !== undefined) ing.status = status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE'

  return res.status(200).json({
    message: 'Ingredient updated successfully',
    data: ing
  })
})

// DELETE /api/ingredients/:id — MANAGER
ingredientsRouter.delete('/:id', authenticate, requireRole(['MANAGER']), (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const index = db.ingredients.findIndex(i => i.id === id)
  if (index === -1) {
    return res.status(404).json({
      message: 'Ingredient not found',
      errors: ['INGREDIENT_NOT_FOUND']
    })
  }

  const deleted = db.ingredients.splice(index, 1)[0]
  return res.status(200).json({
    message: 'Ingredient deleted successfully',
    data: deleted
  })
})
