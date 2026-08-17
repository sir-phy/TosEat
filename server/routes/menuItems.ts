import { Router, Request, Response } from 'express'
import { db, MenuItem, MenuItemIngredient } from '../db.js'
import { authenticate, requireRole } from '../auth.js'

export const menuItemsRouter = Router()

// GET /api/menu-items — public
menuItemsRouter.get('/', (req: Request, res: Response) => {
  const categoryId = req.query.category_id ? Number(req.query.category_id) : null
  const status = req.query.status as string

  let items = db.menuItems

  if (categoryId) {
    items = items.filter(item => item.category_id === categoryId)
  }

  if (status) {
    items = items.filter(item => item.status === status)
  }

  // Populate ingredient names
  const populated = items.map(item => ({
    ...item,
    ingredients: (item.ingredients || []).map(ing => {
      const dbIng = db.ingredients.find(i => i.id === ing.ingredientId)
      return {
        ...ing,
        name: ing.name || dbIng?.name || `Ingredient #${ing.ingredientId}`,
        unit: ing.unit || dbIng?.unit || 'pcs'
      }
    })
  }))

  return res.status(200).json({
    message: 'Menu items retrieved successfully',
    data: populated
  })
})

// GET /api/menu-items/:id — public
menuItemsRouter.get('/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const item = db.menuItems.find(m => m.id === id)
  if (!item) {
    return res.status(404).json({
      message: 'Menu item not found',
      errors: ['MENU_ITEM_NOT_FOUND']
    })
  }

  const populated = {
    ...item,
    ingredients: (item.ingredients || []).map(ing => {
      const dbIng = db.ingredients.find(i => i.id === ing.ingredientId)
      return {
        ...ing,
        name: ing.name || dbIng?.name || `Ingredient #${ing.ingredientId}`,
        unit: ing.unit || dbIng?.unit || 'pcs'
      }
    })
  }

  return res.status(200).json({
    message: 'Menu item retrieved successfully',
    data: populated
  })
})

// POST /api/menu-items — MANAGER
menuItemsRouter.post('/', authenticate, requireRole(['MANAGER']), (req: Request, res: Response) => {
  const { category_id, name, description, price, calories, image, status, ingredients } = req.body

  if (!name || price === undefined) {
    return res.status(400).json({
      message: 'Name and price are required',
      errors: ['NAME_PRICE_REQUIRED']
    })
  }

  const nextId = db.menuItems.length ? Math.max(...db.menuItems.map(m => m.id)) + 1 : 1
  
  const formattedIngredients: MenuItemIngredient[] = (ingredients || []).map((ing: any) => {
    let ingId = ing.ingredientId
    let ingName = ing.name
    if (!ingId && ingName) {
      const found = db.ingredients.find(i => i.name.toLowerCase() === ingName.toLowerCase())
      if (found) {
        ingId = found.id
      } else {
        const newIngId = db.ingredients.length ? Math.max(...db.ingredients.map(i => i.id)) + 1 : 1
        db.ingredients.push({ id: newIngId, name: ingName, unit: ing.unit || 'pcs', status: 'ACTIVE' })
        ingId = newIngId
      }
    }
    return {
      ingredientId: ingId || 1,
      name: ingName,
      amount: Number(ing.amount) || 1,
      unit: ing.unit || 'pcs'
    }
  })

  const newItem: MenuItem = {
    id: nextId,
    category_id: Number(category_id) || 1,
    name: name.trim(),
    description: description || '',
    price: Number(price) || 0,
    calories: calories ? Number(calories) : 350,
    image: image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=400',
    status: status || 'AVAILABLE',
    ingredients: formattedIngredients
  }

  db.menuItems.unshift(newItem)
  return res.status(201).json({
    message: 'Menu item created successfully',
    data: newItem
  })
})

// PUT /api/menu-items/:id — MANAGER
menuItemsRouter.put('/:id', authenticate, requireRole(['MANAGER']), (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const item = db.menuItems.find(m => m.id === id)
  if (!item) {
    return res.status(404).json({
      message: 'Menu item not found',
      errors: ['MENU_ITEM_NOT_FOUND']
    })
  }

  const { category_id, name, description, price, calories, image, status, ingredients } = req.body

  if (category_id !== undefined) item.category_id = Number(category_id)
  if (name !== undefined) item.name = name.trim()
  if (description !== undefined) item.description = description
  if (price !== undefined) item.price = Number(price)
  if (calories !== undefined) item.calories = Number(calories)
  if (image !== undefined) item.image = image
  if (status !== undefined) item.status = status
  if (ingredients !== undefined) {
    item.ingredients = ingredients.map((ing: any) => ({
      ingredientId: ing.ingredientId || 1,
      name: ing.name,
      amount: Number(ing.amount) || 1,
      unit: ing.unit || 'pcs'
    }))
  }

  return res.status(200).json({
    message: 'Menu item updated successfully',
    data: item
  })
})

// DELETE /api/menu-items/:id — MANAGER
menuItemsRouter.delete('/:id', authenticate, requireRole(['MANAGER']), (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const index = db.menuItems.findIndex(m => m.id === id)
  if (index === -1) {
    return res.status(404).json({
      message: 'Menu item not found',
      errors: ['MENU_ITEM_NOT_FOUND']
    })
  }

  const deleted = db.menuItems.splice(index, 1)[0]
  return res.status(200).json({
    message: 'Menu item deleted successfully',
    data: deleted
  })
})

// PATCH /api/menu-items/:id/status — MANAGER
menuItemsRouter.patch('/:id/status', authenticate, requireRole(['MANAGER']), (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const item = db.menuItems.find(m => m.id === id)
  if (!item) {
    return res.status(404).json({
      message: 'Menu item not found',
      errors: ['MENU_ITEM_NOT_FOUND']
    })
  }

  const { status } = req.body
  if (!['AVAILABLE', 'SOLD_OUT', 'INACTIVE'].includes(status)) {
    return res.status(400).json({
      message: 'Invalid status. Must be AVAILABLE, SOLD_OUT, or INACTIVE',
      errors: ['INVALID_STATUS']
    })
  }

  item.status = status
  return res.status(200).json({
    message: 'Menu item status updated successfully',
    data: item
  })
})

// GET /api/menu-items/:id/ingredients — public
menuItemsRouter.get('/:id/ingredients', (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const item = db.menuItems.find(m => m.id === id)
  if (!item) {
    return res.status(404).json({
      message: 'Menu item not found',
      errors: ['MENU_ITEM_NOT_FOUND']
    })
  }

  const populated = (item.ingredients || []).map(ing => {
    const dbIng = db.ingredients.find(i => i.id === ing.ingredientId)
    return {
      ...ing,
      name: ing.name || dbIng?.name || `Ingredient #${ing.ingredientId}`,
      unit: ing.unit || dbIng?.unit || 'pcs'
    }
  })

  return res.status(200).json({
    message: 'Ingredients for menu item retrieved successfully',
    data: populated
  })
})

// POST /api/menu-items/:id/ingredients — MANAGER
menuItemsRouter.post('/:id/ingredients', authenticate, requireRole(['MANAGER']), (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const item = db.menuItems.find(m => m.id === id)
  if (!item) {
    return res.status(404).json({
      message: 'Menu item not found',
      errors: ['MENU_ITEM_NOT_FOUND']
    })
  }

  const { ingredientId, amount, unit } = req.body
  if (!ingredientId || amount === undefined) {
    return res.status(400).json({
      message: 'ingredientId and amount are required',
      errors: ['INVALID_INGREDIENT_PARAMS']
    })
  }

  const dbIng = db.ingredients.find(i => i.id === Number(ingredientId))
  const newIng: MenuItemIngredient = {
    ingredientId: Number(ingredientId),
    name: dbIng?.name,
    amount: Number(amount),
    unit: unit || dbIng?.unit || 'pcs'
  }

  if (!item.ingredients) item.ingredients = []
  item.ingredients.push(newIng)

  return res.status(201).json({
    message: 'Ingredient added to menu item successfully',
    data: newIng
  })
})

// PUT /api/menu-items/:id/ingredients/:ingredientId — MANAGER
menuItemsRouter.put('/:id/ingredients/:ingredientId', authenticate, requireRole(['MANAGER']), (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const ingredientId = Number(req.params.ingredientId)
  const item = db.menuItems.find(m => m.id === id)
  if (!item) {
    return res.status(404).json({
      message: 'Menu item not found',
      errors: ['MENU_ITEM_NOT_FOUND']
    })
  }

  const ing = (item.ingredients || []).find(i => i.ingredientId === ingredientId)
  if (!ing) {
    return res.status(404).json({
      message: 'Ingredient not found on this menu item',
      errors: ['INGREDIENT_NOT_FOUND']
    })
  }

  const { amount, unit } = req.body
  if (amount !== undefined) ing.amount = Number(amount)
  if (unit !== undefined) ing.unit = unit

  return res.status(200).json({
    message: 'Menu item ingredient updated successfully',
    data: ing
  })
})

// DELETE /api/menu-items/:id/ingredients/:ingredientId — MANAGER
menuItemsRouter.delete('/:id/ingredients/:ingredientId', authenticate, requireRole(['MANAGER']), (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const ingredientId = Number(req.params.ingredientId)
  const item = db.menuItems.find(m => m.id === id)
  if (!item) {
    return res.status(404).json({
      message: 'Menu item not found',
      errors: ['MENU_ITEM_NOT_FOUND']
    })
  }

  const index = (item.ingredients || []).findIndex(i => i.ingredientId === ingredientId)
  if (index === -1) {
    return res.status(404).json({
      message: 'Ingredient not found on this menu item',
      errors: ['INGREDIENT_NOT_FOUND']
    })
  }

  const deleted = item.ingredients.splice(index, 1)[0]
  return res.status(200).json({
    message: 'Ingredient removed from menu item successfully',
    data: deleted
  })
})
