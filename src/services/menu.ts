import { api } from './api.js'

export interface CategoryItem {
  id: number
  name: string
  description?: string
  icon?: string
  status: 'ACTIVE' | 'INACTIVE'
}

export interface IngredientItem {
  id: number
  name: string
  unit: string
  status: 'ACTIVE' | 'INACTIVE'
}

export interface MenuItemIngredientDef {
  ingredientId: number
  name?: string
  amount: number
  unit: string
}

export interface MenuItemData {
  id: number
  category_id: number
  name: string
  description?: string
  price: number
  calories?: number
  image?: string
  status: 'AVAILABLE' | 'SOLD_OUT' | 'INACTIVE'
  ingredients: MenuItemIngredientDef[]
}

export const menuService = {
  // Categories
  getCategories: () => api.get<CategoryItem[]>('/categories'),
  getCategory: (id: number) => api.get<CategoryItem>(`/categories/${id}`),
  createCategory: (data: { name: string; description?: string; status?: 'ACTIVE' | 'INACTIVE'; icon?: string }) =>
    api.post<CategoryItem>('/categories', data),
  updateCategory: (id: number, data: Partial<CategoryItem>) =>
    api.put<CategoryItem>(`/categories/${id}`, data),
  deleteCategory: (id: number) => api.delete<CategoryItem>(`/categories/${id}`),
  updateCategoryStatus: (id: number, status: 'ACTIVE' | 'INACTIVE') =>
    api.patch<CategoryItem>(`/categories/${id}/status`, { status }),

  // Ingredients
  getIngredients: () => api.get<IngredientItem[]>('/ingredients'),
  getIngredient: (id: number) => api.get<IngredientItem>(`/ingredients/${id}`),
  createIngredient: (data: { name: string; unit: string; status?: 'ACTIVE' | 'INACTIVE' }) =>
    api.post<IngredientItem>('/ingredients', data),
  updateIngredient: (id: number, data: Partial<IngredientItem>) =>
    api.put<IngredientItem>(`/ingredients/${id}`, data),
  deleteIngredient: (id: number) => api.delete<IngredientItem>(`/ingredients/${id}`),

  // Menu Items
  getMenuItems: (params?: { category_id?: number; status?: string }) => {
    let query = ''
    if (params) {
      const q = new URLSearchParams()
      if (params.category_id) q.append('category_id', String(params.category_id))
      if (params.status) q.append('status', params.status)
      query = `?${q.toString()}`
    }
    return api.get<MenuItemData[]>(`/menu-items${query}`)
  },
  getMenuItem: (id: number) => api.get<MenuItemData>(`/menu-items/${id}`),
  createMenuItem: (data: {
    category_id: number
    name: string
    description?: string
    price: number
    calories?: number
    image?: string
    status?: 'AVAILABLE' | 'SOLD_OUT' | 'INACTIVE'
    ingredients?: Array<{ ingredientId: number; name?: string; amount: number; unit: string }>
  }) => api.post<MenuItemData>('/menu-items', data),
  updateMenuItem: (id: number, data: Partial<MenuItemData>) =>
    api.put<MenuItemData>(`/menu-items/${id}`, data),
  deleteMenuItem: (id: number) => api.delete<MenuItemData>(`/menu-items/${id}`),
  updateMenuItemStatus: (id: number, status: 'AVAILABLE' | 'SOLD_OUT' | 'INACTIVE') =>
    api.patch<MenuItemData>(`/menu-items/${id}/status`, { status }),

  // Menu Item Ingredients
  getMenuItemIngredients: (menuItemId: number) =>
    api.get<MenuItemIngredientDef[]>(`/menu-items/${menuItemId}/ingredients`),
  addMenuItemIngredient: (menuItemId: number, data: { ingredientId: number; amount: number; unit: string }) =>
    api.post<MenuItemIngredientDef>(`/menu-items/${menuItemId}/ingredients`, data),
  updateMenuItemIngredient: (menuItemId: number, ingredientId: number, data: { amount?: number; unit?: string }) =>
    api.put<MenuItemIngredientDef>(`/menu-items/${menuItemId}/ingredients/${ingredientId}`, data),
  removeMenuItemIngredient: (menuItemId: number, ingredientId: number) =>
    api.delete<MenuItemIngredientDef>(`/menu-items/${menuItemId}/ingredients/${ingredientId}`)
}
