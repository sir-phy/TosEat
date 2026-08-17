<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import * as d3 from 'd3'
import { t, currentLang, translateDishName, translateDishDesc, translateIngredient } from '../i18n'

const translateCategoryName = (name: string): string => {
  if (currentLang.value === 'km') {
    const key = name.toLowerCase().replace(/\s+/g, '')
    if (key === 'allmenu') return t('allMenu')
    if (key === 'bakery') return t('bakery')
    if (key === 'burger') return t('burger')
    if (key === 'beverage') return t('beverage')
    if (key === 'chicken') return t('chicken')
    if (key === 'pizza') return t('pizza')
    if (key === 'seafood') return t('seafood')
  }
  return name
}

const translateUnitName = (unit: string): string => {
  if (currentLang.value === 'km') {
    if (unit === 'pcs') return 'គ្រាប់'
    if (unit === 'portions') return 'ចំណែក'
    if (unit === 'kg') return 'គីឡូក្រាម'
    if (unit === 'g') return 'ក្រាម'
  }
  return unit
}

const stats = [
  { label: 'Total Revenue', value: '$45,231.89', change: '+20.1%', icon: 'trending_up', color: 'primary' },
  { label: 'Total Orders', value: '1,245', change: '+12.5%', icon: 'shopping_bag', color: 'secondary' },
  { label: 'Avg. Order Value', value: '$36.23', change: '-2.4%', icon: 'bar_chart', color: 'tertiary' },
  { label: 'Active Staff', value: '12', change: '0%', icon: 'badge', color: 'primary' }
]

const recentOrders = [
  { id: '#1234', customer: 'Alice Johnson', items: 3, total: '$45.50', status: 'Completed', time: '10 mins ago' },
  { id: '#1235', customer: 'Bob Smith', items: 1, total: '$12.00', status: 'In Progress', time: '15 mins ago' },
  { id: '#1236', customer: 'Charlie Brown', items: 2, total: '$28.40', status: 'Pending', time: '20 mins ago' },
  { id: '#1237', customer: 'David Wilson', items: 4, total: '$62.10', status: 'Completed', time: '25 mins ago' },
  { id: '#1238', customer: 'Eva Davis', items: 1, total: '$9.99', status: 'Completed', time: '30 mins ago' }
]

const chartContainer = ref<HTMLElement | null>(null)

// Live Customer Order Tracking & Synchronization
const liveCustomerOrders = ref<any[]>([])

const loadLiveCustomerOrders = () => {
  const stored = localStorage.getItem('gomeal_customer_orders')
  if (stored) {
    try {
      liveCustomerOrders.value = JSON.parse(stored)
    } catch (e) {
      console.error(e)
    }
  } else {
    liveCustomerOrders.value = []
  }
}

const updateOrderStatus = (id: number, newStatus: string) => {
  const orderIndex = liveCustomerOrders.value.findIndex((o: any) => o.id === id)
  if (orderIndex > -1) {
    liveCustomerOrders.value[orderIndex].status = newStatus
    localStorage.setItem('gomeal_customer_orders', JSON.stringify(liveCustomerOrders.value))
    loadLiveCustomerOrders()
  }
}

const deleteCustomerOrder = (id: number) => {
  liveCustomerOrders.value = liveCustomerOrders.value.filter((o: any) => o.id !== id)
  localStorage.setItem('gomeal_customer_orders', JSON.stringify(liveCustomerOrders.value))
  loadLiveCustomerOrders()
}

// Live payout history for stats
const payoutHistory = ref<any[]>([])

const loadPayoutHistory = () => {
  const stored = localStorage.getItem('gomeal_payout_history')
  if (stored) {
    try {
      payoutHistory.value = JSON.parse(stored)
    } catch (e) {
      console.error(e)
    }
  } else {
    payoutHistory.value = []
  }
}

// Stats computed live additions
const liveRevenueSum = computed(() => {
  return payoutHistory.value.reduce((acc, tx) => acc + (tx.total || 0), 0)
})

const liveOrdersLen = computed(() => {
  return payoutHistory.value.length
})

const dynamicStats = computed(() => {
  const rev = liveRevenueSum.value
  const ords = liveOrdersLen.value
  const avg = ords > 0 ? +(rev / ords).toFixed(2) : 0

  return [
    { label: currentLang.value === 'km' ? 'ចំណូលសរុប' : 'Total Revenue', value: `$${rev.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, change: ords > 0 ? '+100%' : '0%', icon: 'trending_up', color: 'primary' },
    { label: currentLang.value === 'km' ? 'ការកុម្ម៉ង់សរុប' : 'Total Orders', value: ords.toString(), change: ords > 0 ? `+${ords}` : '0%', icon: 'shopping_bag', color: 'secondary' },
    { label: currentLang.value === 'km' ? 'តម្លៃកុម្ម៉ង់ជាមធ្យម' : 'Avg. Order Value', value: `$${avg.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, change: ords > 0 ? (currentLang.value === 'km' ? 'ធម្មតា' : 'Normal') : '0%', icon: 'bar_chart', color: 'tertiary' },
    { label: currentLang.value === 'km' ? 'បុគ្គលិកសកម្ម' : 'Active Staff', value: '12', change: '0%', icon: 'badge', color: 'primary' }
  ]
})

// === MENU MANAGEMENT STATE & LOGIC ===
const defaultCategories = [
  { name: 'All Menu', icon: 'grid_view', active: true },
  { name: 'Bakery', icon: 'bakery_dining', active: false },
  { name: 'Burger', icon: 'lunch_dining', active: false },
  { name: 'Beverage', icon: 'local_cafe', active: false },
  { name: 'Chicken', icon: 'restaurant', active: false },
  { name: 'Pizza', icon: 'local_pizza', active: false },
  { name: 'Seafood', icon: 'set_meal', active: false }
]

const loadCategories = () => {
  const stored = localStorage.getItem('gomeal_categories')
  if (stored) {
    try {
      const parsed = JSON.parse(stored)
      let cats = parsed.map((c: any) => ({ ...c, active: false }))
      const hasAllMenu = cats.some((c: any) => c.name.toLowerCase() === 'all menu')
      if (!hasAllMenu) {
        cats.unshift({ name: 'All Menu', icon: 'grid_view', active: true })
      } else {
        const allMenu = cats.find((c: any) => c.name.toLowerCase() === 'all menu')
        if (allMenu) allMenu.active = true
      }
      return cats
    } catch (e) {
      console.error('Error loading custom categories:', e)
    }
  }
  return defaultCategories
}

const categories = ref(loadCategories())
const activeCategory = ref('All Menu')

const selectCategory = (catName: string) => {
  activeCategory.value = catName
  categories.value.forEach((cat: any) => {
    cat.active = cat.name.toLowerCase() === catName.toLowerCase()
  })
}

const defaultMenuItems = [
  {
    id: 1,
    name: 'Cheese Burger',
    price: 12.50,
    category: 'Burger',
    description: 'Classic beef patty with double cheddar cheese and secret sauce.',
    ingredients: [
      { name: 'Beef Patty', amount: 1, unit: 'pcs' },
      { name: 'Double Cheddar', amount: 2, unit: 'pcs' },
      { name: 'Lettuce', amount: 0.1, unit: 'kg' },
      { name: 'Tomato', amount: 0.05, unit: 'kg' },
      { name: 'Pickles', amount: 3, unit: 'pcs' }
    ],
    status: 'Available',
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80&w=400'
  },
  {
    id: 2,
    name: 'Pepperoni Pizza',
    price: 18.99,
    category: 'Pizza',
    description: 'Thin crust loaded with spicy pepperoni and fresh basil leaves.',
    ingredients: [
      { name: 'Pepperoni', amount: 0.15, unit: 'kg' },
      { name: 'Mozzarella', amount: 0.25, unit: 'kg' },
      { name: 'Tomato Sauce', amount: 0.1, unit: 'kg' },
      { name: 'Basil', amount: 5, unit: 'pcs' }
    ],
    status: 'Available',
    image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&q=80&w=400'
  },
  {
    id: 3,
    name: 'Japanese Ramen',
    price: 15.00,
    category: 'Seafood',
    description: 'Creamy pork broth with handmade noodles and chashu pork.',
    ingredients: [
      { name: 'Pork Chashu', amount: 2, unit: 'pcs' },
      { name: 'Ramen Noodles', amount: 0.2, unit: 'kg' },
      { name: 'Soft Boiled Egg', amount: 1, unit: 'pcs' },
      { name: 'Nori', amount: 2, unit: 'pcs' }
    ],
    status: 'Sold Out',
    lowStock: true,
    image: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&q=80&w=405'
  },
  {
    id: 4,
    name: 'Fried Rice',
    price: 10.45,
    category: 'Chicken',
    description: 'Wok-fried rice with assorted vegetables and authentic spices.',
    ingredients: [
      { name: 'Rice', amount: 0.3, unit: 'kg' },
      { name: 'Shrimp', amount: 8, unit: 'pcs' },
      { name: 'Eggs', amount: 2, unit: 'pcs' },
      { name: 'Green Beans', amount: 0.05, unit: 'kg' },
      { name: 'Carrots', amount: 0.05, unit: 'kg' }
    ],
    status: 'Available',
    image: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&q=80&w=400'
  },
  {
    id: 5,
    name: 'Vegan Salad',
    price: 13.20,
    category: 'Bakery',
    description: 'Fresh organic garden greens with avocado and citrus dressing.',
    ingredients: [
      { name: 'Avocado', amount: 1, unit: 'pcs' },
      { name: 'Quinoa', amount: 0.1, unit: 'kg' },
      { name: 'Baby Spinach', amount: 0.15, unit: 'kg' },
      { name: 'Citrus Dressing', amount: 2, unit: 'portions' }
    ],
    status: 'Available',
    image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&q=80&w=400'
  },
  {
    id: 6,
    name: 'Berry Smoothie',
    price: 7.50,
    category: 'Beverage',
    description: 'Antioxidant rich blend of blueberries, strawberries and almond milk.',
    ingredients: [
      { name: 'Blueberries', amount: 0.08, unit: 'kg' },
      { name: 'Strawberries', amount: 0.12, unit: 'kg' },
      { name: 'Almond Milk', amount: 0.25, unit: 'kg' },
      { name: 'Chia Seeds', amount: 1, unit: 'portions' }
    ],
    status: 'Available',
    image: 'https://images.unsplash.com/photo-1553530593-90056680cd94?auto=format&fit=crop&q=80&w=400'
  }
]

const loadMenuItems = () => {
  const stored = localStorage.getItem('gomeal_menu_items')
  if (stored) {
    try {
      const items = JSON.parse(stored)
      return items.map((item: any) => ({
        ...item,
        ingredients: (item.ingredients || []).map((ing: any) => {
          if (typeof ing === 'string') {
            return { name: ing, amount: 1, unit: 'pcs' }
          }
          return ing
        })
      }))
    } catch (e) {
      console.error('Error loading menu items:', e)
    }
  }
  return defaultMenuItems
}

const menuItems = ref(loadMenuItems())

watch(menuItems, () => {
  localStorage.setItem('gomeal_menu_items', JSON.stringify(menuItems.value))
}, { deep: true })

const selectedItems = ref<number[]>([])
const isEditModalOpen = ref(false)
const editingItem = ref<any>(null)
const newIngredient = ref('')

// Advanced Ingredient Inputs
const newIngName = ref('')
const newIngAmount = ref<number>(1)
const newIngUnit = ref<'kg' | 'pcs' | 'g' | 'portions'>('pcs')

// Search & Filtering
const searchQuery = ref('')

const filteredMenuItems = computed(() => {
  let items = menuItems.value
  
  if (activeCategory.value !== 'All Menu') {
    items = items.filter((item: any) => {
      if (item.category && item.category.toLowerCase() === activeCategory.value.toLowerCase()) {
        return true
      }
      
      const name = item.name.toLowerCase()
      const desc = item.description.toLowerCase()
      const cat = activeCategory.value.toLowerCase()
      
      if (cat === 'burger') return name.includes('burger') || desc.includes('burger') || name.includes('patty')
      if (cat === 'pizza') return name.includes('pizza') || desc.includes('pizza')
      if (cat === 'beverage' || cat === 'bar') return name.includes('smoothie') || name.includes('juice') || name.includes('tea') || name.includes('drink') || name.includes('shake') || name.includes('milk') || name.includes('beverage') || name.includes('cafe')
      if (cat === 'seafood') return name.includes('fish') || name.includes('shrimp') || name.includes('seafood') || name.includes('crab') || name.includes('lobster')
      if (cat === 'chicken') return name.includes('chicken') || name.includes('poultry') || name.includes('wings')
      if (cat === 'bakery') return name.includes('bread') || name.includes('bakery') || name.includes('donut') || name.includes('croissant') || name.includes('cake')
      
      return name.includes(cat) || desc.includes(cat)
    })
  }

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase().trim()
    items = items.filter((item: any) => {
      return item.name.toLowerCase().includes(q) || item.description.toLowerCase().includes(q)
    })
  }

  return items
})

// Category Management
const isCategoryModalOpen = ref(false)
const editingCategoryIndex = ref<number | null>(null)
const categoryForm = ref({
  name: '',
  icon: 'restaurant'
})

const predefinedIcons = [
  'bakery_dining', 'lunch_dining', 'local_bar', 'local_cafe', 'dinner_dining', 
  'local_pizza', 'set_meal', 'icecream', 'cake', 'ramen_dining', 
  'soup_kitchen', 'cookie', 'egg', 'restaurant', 'fastfood', 
  'emoji_food_beverage', 'eco', 'nutrition', 'local_fire_department', 'menu_book'
]

const openCategoryManager = () => {
  editingCategoryIndex.value = null
  categoryForm.value = { name: '', icon: 'restaurant' }
  isCategoryModalOpen.value = true
}

const startEditCategory = (index: number) => {
  editingCategoryIndex.value = index
  const cat = categories.value[index]
  categoryForm.value = {
    name: cat.name,
    icon: cat.icon
  }
}

const cancelEditCategory = () => {
  editingCategoryIndex.value = null
  categoryForm.value = { name: '', icon: 'restaurant' }
}

const saveCategory = () => {
  const name = categoryForm.value.name.trim()
  if (!name) return

  const isDuplicate = categories.value.some((c: any, idx: number) => 
    c.name.toLowerCase() === name.toLowerCase() && idx !== editingCategoryIndex.value
  )
  if (isDuplicate) {
    alert(currentLang.value === 'km' ? 'ប្រភេទដែលមានឈ្មោះនេះមានរួចហើយ!' : 'Category with this name already exists!')
    return
  }

  if (editingCategoryIndex.value !== null) {
    const oldName = categories.value[editingCategoryIndex.value].name
    categories.value[editingCategoryIndex.value].name = name
    categories.value[editingCategoryIndex.value].icon = categoryForm.value.icon
    
    menuItems.value.forEach((item: any) => {
      if (item.category === oldName) {
        item.category = name
      }
    })
  } else {
    categories.value.push({
      name,
      icon: categoryForm.value.icon,
      active: false
    })
  }

  localStorage.setItem('gomeal_categories', JSON.stringify(categories.value))
  cancelEditCategory()
}

const deleteCategory = (index: number) => {
  const cat = categories.value[index]
  if (cat.name.toLowerCase() === 'all menu') return

  const confirmMsg = currentLang.value === 'km' 
    ? `តើអ្នកពិតជាចង់លុបប្រភេទ "${translateCategoryName(cat.name)}" មែនទេ?` 
    : `Are you sure you want to delete category "${cat.name}"?`
  if (confirm(confirmMsg)) {
    menuItems.value.forEach((item: any) => {
      if (item.category === cat.name) {
        item.category = ''
      }
    })
    
    if (activeCategory.value === cat.name) {
      selectCategory('All Menu')
    }

    categories.value.splice(index, 1)
    localStorage.setItem('gomeal_categories', JSON.stringify(categories.value))
  }
}

// Selection
const toggleSelect = (id: number) => {
  const index = selectedItems.value.indexOf(id)
  if (index > -1) {
    selectedItems.value.splice(index, 1)
  } else {
    selectedItems.value.push(id)
  }
}

const clearSelection = () => {
  selectedItems.value = []
}

// Bulk Actions
const bulkOutOfStock = () => {
  menuItems.value.forEach((item: any) => {
    if (selectedItems.value.includes(item.id)) {
      item.status = 'Sold Out'
    }
  })
  clearSelection()
}

const bulkDelete = () => {
  menuItems.value = menuItems.value.filter((item: any) => !selectedItems.value.includes(item.id))
  clearSelection()
}

const deleteItem = (id: number) => {
  menuItems.value = menuItems.value.filter((item: any) => item.id !== id)
}

// Modal logic
const isAddingItem = ref(false)

const openEditModal = (item: any) => {
  editingItem.value = JSON.parse(JSON.stringify(item))
  editingItem.value.ingredients = (editingItem.value.ingredients || []).map((ing: any) => {
    if (typeof ing === 'string') {
      return { name: ing, amount: 1, unit: 'pcs' }
    }
    return ing
  })
  editingItem.value.category = editingItem.value.category || ''
  isAddingItem.value = false
  isEditModalOpen.value = true
}

const openAddModal = () => {
  editingItem.value = {
    id: Date.now(),
    name: '',
    price: 0,
    category: activeCategory.value !== 'All Menu' ? activeCategory.value : '',
    description: '',
    ingredients: [],
    status: 'Available',
    image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=400'
  }
  isAddingItem.value = true
  isEditModalOpen.value = true
}

const addIngredient = () => {
  const name = newIngName.value.trim() || newIngredient.value.trim()
  if (!name) return
  
  if (!editingItem.value.ingredients) {
    editingItem.value.ingredients = []
  }
  
  const targetArray = editingItem.value.ingredients
  const exists = targetArray.some(
    (i: any) => (typeof i === 'string' ? i.toLowerCase() : i.name.toLowerCase()) === name.toLowerCase()
  )
  
  if (!exists) {
    targetArray.push({
      name: name,
      amount: newIngAmount.value || 1,
      unit: newIngUnit.value || 'pcs'
    })
    
    newIngName.value = ''
    newIngredient.value = ''
    newIngAmount.value = 1
    newIngUnit.value = 'pcs'
  }
}

const removeIngredient = (index: number) => {
  editingItem.value.ingredients.splice(index, 1)
}

const saveItem = () => {
  if (isAddingItem.value) {
    menuItems.value.unshift({ ...editingItem.value })
  } else {
    const index = menuItems.value.findIndex((i: any) => i.id === editingItem.value.id)
    if (index > -1) {
      menuItems.value[index] = { ...editingItem.value }
    }
  }
  isEditModalOpen.value = false
}

const renderChart = () => {
  if (!chartContainer.value) return

  // Clear previous chart
  d3.select(chartContainer.value).selectAll('*').remove()

  const data = [
    { day: 'Mon', sales: 4000 },
    { day: 'Tue', sales: 3000 },
    { day: 'Wed', sales: 5000 },
    { day: 'Thu', sales: 2780 },
    { day: 'Fri', sales: 1890 },
    { day: 'Sat', sales: 2390 },
    { day: 'Sun', sales: 3490 }
  ].map(d => ({
    day: currentLang.value === 'km' ? (
      d.day === 'Mon' ? 'ចន្ទ' :
      d.day === 'Tue' ? 'អង្គារ' :
      d.day === 'Wed' ? 'ពុធ' :
      d.day === 'Thu' ? 'ព្រហ' :
      d.day === 'Fri' ? 'សុក្រ' :
      d.day === 'Sat' ? 'សៅរ៍' : 'អាទិត្យ'
    ) : d.day,
    sales: d.sales
  }))

  const margin = { top: 20, right: 30, bottom: 40, left: 50 }
  const width = chartContainer.value.clientWidth - margin.left - margin.right
  const height = 300 - margin.top - margin.bottom

  const svg = d3.select(chartContainer.value)
    .append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`)

  const x = d3.scalePoint()
    .domain(data.map(d => d.day))
    .range([0, width])
    .padding(0.5)

  const y = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.sales) || 0])
    .nice()
    .range([height, 0])

  svg.append('g')
    .attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(x))
    .call(g => g.select('.domain').remove())
    .attr('class', 'text-on-surface-variant')

  svg.append('g')
    .call(d3.axisLeft(y).ticks(5, 'f'))
    .call(g => g.select('.domain').remove())
    .attr('class', 'text-on-surface-variant')

  // Add grid lines
  svg.append('g')
    .attr('class', 'grid')
    .attr('stroke', 'currentColor')
    .attr('stroke-opacity', 0.1)
    .call(d3.axisLeft(y)
      .tickSize(-width)
      .tickFormat(() => '')
    )

  // Gradient for the area
  const gradient = svg.append('defs')
    .append('linearGradient')
    .attr('id', 'area-gradient')
    .attr('x1', '0%')
    .attr('y1', '0%')
    .attr('x2', '0%')
    .attr('y2', '100%')

  gradient.append('stop')
    .attr('offset', '0%')
    .attr('stop-color', '#FFB800')
    .attr('stop-opacity', 0.3)

  gradient.append('stop')
    .attr('offset', '100%')
    .attr('stop-color', '#FFB800')
    .attr('stop-opacity', 0)

  // Area under the line
  const area = d3.area<any>()
    .x(d => x(d.day)!)
    .y0(height)
    .y1(d => y(d.sales))
    .curve(d3.curveMonotoneX)

  svg.append('path')
    .datum(data)
    .attr('fill', 'url(#area-gradient)')
    .attr('d', area)

  // The line
  const line = d3.line<any>()
    .x(d => x(d.day)!)
    .y(d => y(d.sales))
    .curve(d3.curveMonotoneX)

  svg.append('path')
    .datum(data)
    .attr('fill', 'none')
    .attr('stroke', '#7c5800')
    .attr('stroke-width', 3)
    .attr('d', line)

  // Data points
  svg.selectAll('.dot')
    .data(data)
    .enter()
    .append('circle')
    .attr('class', 'dot')
    .attr('cx', d => x(d.day)!)
    .attr('cy', d => y(d.sales))
    .attr('r', 5)
    .attr('fill', '#7c5800')
}

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  loadLiveCustomerOrders()
  loadPayoutHistory()
  categories.value = loadCategories()
  menuItems.value = loadMenuItems()
  
  // Real-time listener for across-tab updates
  window.addEventListener('storage', (e) => {
    if (e.key === 'gomeal_customer_orders') {
      loadLiveCustomerOrders()
    }
    if (e.key === 'gomeal_payout_history') {
      loadPayoutHistory()
    }
    if (e.key === 'gomeal_menu_items') {
      menuItems.value = loadMenuItems()
    }
    if (e.key === 'gomeal_categories') {
      categories.value = loadCategories()
    }
  })
  
  const syncInterval = setInterval(() => {
    loadLiveCustomerOrders()
    loadPayoutHistory()
  }, 1500)

  renderChart()
  resizeObserver = new ResizeObserver(() => {
    renderChart()
  })
  if (chartContainer.value) {
    resizeObserver.observe(chartContainer.value)
  }

  onUnmounted(() => {
    clearInterval(syncInterval)
    if (resizeObserver) {
      resizeObserver.disconnect()
    }
  })
})

watch(currentLang, () => {
  renderChart()
})
</script>

<template>
  <div class="min-h-screen">
    <!-- Header -->
    <header class="fixed top-0 left-0 right-0 lg:left-64 h-20 bg-white/80 backdrop-blur-md border-b border-surface-variant flex items-center justify-between px-8 z-40">
      <h2 class="text-xl font-black text-on-surface">{{ currentLang === 'km' ? 'ផ្ទាំងគ្រប់គ្រងម្ចាស់ហាង' : 'Owner Dashboard' }}</h2>
      
      <div class="flex items-center gap-6">
        <div class="flex items-center px-4 py-2 bg-tertiary/10 rounded-full gap-2">
          <span class="w-2 h-2 bg-tertiary rounded-full animate-pulse"></span>
          <span class="text-xs font-bold text-tertiary">{{ currentLang === 'km' ? 'ផ្ទះបាយកំពុងដំណើរការ' : 'KITCHEN LIVE' }}</span>
        </div>

        <div class="flex items-center gap-4 text-on-surface-variant border-l border-surface-variant pl-6">
          <button class="p-2 hover:bg-surface-container rounded-full transition-colors relative">
            <span class="material-symbols-outlined">notifications</span>
            <span class="absolute top-2 right-2 w-2 h-2 bg-secondary rounded-full"></span>
          </button>
        </div>

        <div class="h-10 w-10 rounded-full overflow-hidden border-2 border-primary-container shrink-0">
          <img src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200" alt="Avatar" />
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="mt-20 p-8 w-full max-w-7xl mx-auto space-y-8">
      <!-- Stats Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div 
          v-for="stat in dynamicStats" 
          :key="stat.label"
          class="bg-white p-6 rounded-3xl shadow-sm border border-surface-variant group hover:border-primary-container transition-all"
        >
          <div class="flex justify-between items-start mb-4">
            <div 
              class="p-3 rounded-2xl flex items-center justify-center transition-colors"
              :class="`bg-${stat.color === 'primary' ? 'primary-container/20' : stat.color === 'secondary' ? 'secondary-container/20' : 'tertiary-container/20'}`"
            >
              <span 
                class="material-symbols-outlined"
                :class="`text-${stat.color}`"
              >
                {{ stat.icon }}
              </span>
            </div>
            <span 
              class="text-xs font-bold px-2 py-1 rounded-full"
              :class="stat.change.startsWith('+') ? 'bg-tertiary/10 text-tertiary' : 'bg-secondary/10 text-secondary'"
            >
              {{ stat.change }}
            </span>
          </div>
          <p class="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-1">{{ stat.label }}</p>
          <h3 class="text-2xl font-black text-on-surface">{{ stat.value }}</h3>
        </div>
      </div>

      <!-- MENU MANAGEMENT INLINE CONTAINER -->
      <section class="bg-white rounded-[32px] shadow-sm border border-surface-variant overflow-hidden">
        <div class="p-8 border-b border-surface-variant flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-container-low">
          <div>
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-primary text-2xl">restaurant_menu</span>
              <h3 class="text-xl font-black text-on-surface text-primary">{{ currentLang === 'km' ? 'ការគ្រប់គ្រងមុខម្ហូប' : 'Menu Management' }}</h3>
            </div>
            <p class="text-xs text-on-surface-variant font-medium mt-1">{{ currentLang === 'km' ? 'កំណត់តម្លៃ ពាក្យពិពណ៌នា ស្ថានភាពលក់ គ្រឿងផ្សំស្តុក និងគ្រប់គ្រងប្រភេទមុខម្ហូបចម្រុះ។' : 'Configure price, descriptions, availability, ingredient portion systems, and custom categories.' }}</p>
          </div>
          
          <div class="flex flex-wrap items-center gap-2">
            <!-- Search Menu Items -->
            <div class="relative max-w-xs w-full">
              <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline text-xs">search</span>
              <input 
                v-model="searchQuery"
                type="text" 
                :placeholder="currentLang === 'km' ? 'ស្វែងរកមុខម្ហូប...' : 'Search menu items...'"
                class="w-full bg-white border border-surface-variant rounded-full py-1.5 pl-10 pr-4 text-xs focus:ring-2 focus:ring-primary-container outline-none transition-all font-bold text-on-surface"
              />
            </div>
            
            <button 
              @click="openCategoryManager"
              class="flex items-center gap-1.5 px-4 py-2 bg-white border border-outline-variant hover:bg-surface-container rounded-full font-black text-xs transition-colors shadow-sm"
            >
              <span class="material-symbols-outlined text-sm">category</span>
              {{ currentLang === 'km' ? 'គ្រប់គ្រងប្រភេទ' : 'Categories' }}
            </button>

            <button 
              @click="openAddModal"
              class="bg-primary text-white px-4 py-2 rounded-full font-black text-xs hover:opacity-90 transition-opacity flex items-center gap-1 shadow-md shadow-primary/10"
            >
              <span class="material-symbols-outlined text-xs">add</span>
              {{ currentLang === 'km' ? 'បន្ថែមម្ហូប' : 'Add Item' }}
            </button>
          </div>
        </div>

        <!-- Categories Scroller -->
        <div class="px-8 pt-6 pb-2 border-b border-surface-variant/40">
          <div class="overflow-x-auto pb-2 no-scrollbar">
            <div class="flex gap-3 min-w-max">
              <div 
                v-for="cat in categories" 
                :key="cat.name"
                @click="selectCategory(cat.name)"
                class="px-4 py-2 bg-white rounded-xl flex items-center gap-2.5 border-2 transition-all cursor-pointer group"
                :class="cat.active ? 'bg-primary-container border-primary-container shadow-md text-on-primary-container' : 'border-slate-100 hover:border-primary-container shadow-sm'"
              >
                <span 
                  class="material-symbols-outlined text-xl"
                  :class="cat.active ? 'text-on-primary-container' : 'text-primary'"
                >
                  {{ cat.icon }}
                </span>
                <span class="font-black text-[10px] uppercase tracking-wider" :class="cat.active ? 'text-on-primary-container' : 'text-on-surface-variant'">{{ translateCategoryName(cat.name) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Menu Grid -->
        <div class="p-8 bg-slate-50/[0.15]">
          <div v-if="filteredMenuItems.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <div 
              v-for="item in filteredMenuItems" 
              :key="item.id"
              @click="toggleSelect(item.id)"
              class="bg-white rounded-3xl shadow-sm overflow-hidden group border-2 transition-all flex flex-col h-full cursor-pointer relative"
              :class="[
                item.status === 'Sold Out' ? 'opacity-80 grayscale-[0.2]' : '',
                selectedItems.includes(item.id) ? 'border-primary shadow-xl scale-[1.01]' : 'border-surface-variant/50 hover:border-primary-container'
              ]"
            >
              <!-- Selection Checkbox overlay -->
              <div 
                v-if="selectedItems.includes(item.id)"
                class="absolute top-4 left-4 z-20 bg-primary text-white w-6 h-6 rounded-full flex items-center justify-center shadow-lg"
              >
                <span class="material-symbols-outlined text-sm font-bold">check</span>
              </div>

              <div class="relative h-44 w-full overflow-hidden p-4">
                <img :src="item.image" :alt="item.name" class="w-full h-full object-contain transform group-hover:scale-105 transition-transform duration-500" />
                <div class="absolute top-4 right-4 flex flex-col gap-1 items-end">
                  <span 
                    class="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter shadow-sm"
                    :class="item.status === 'Available' ? 'bg-tertiary-container text-on-tertiary-container' : 'bg-secondary-container text-on-secondary-container'"
                  >
                    {{ item.status === 'Available' ? (currentLang === 'km' ? 'មានលក់' : 'Available') : (currentLang === 'km' ? 'អស់ហើយ' : 'Sold Out') }}
                  </span>
                  <span v-if="item.lowStock" class="bg-secondary text-white px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter shadow-sm">
                    {{ currentLang === 'km' ? 'ស្តុកតិចតួច' : 'Low Stock' }}
                  </span>
                </div>
              </div>
              
              <div class="p-5 flex flex-col flex-1 border-t border-slate-50">
                <div class="flex justify-between items-start mb-1.5">
                  <div>
                    <span class="px-2 py-0.5 bg-primary/10 text-primary text-[8px] font-black uppercase tracking-wider rounded-md mb-1 inline-block">
                      {{ item.category ? translateCategoryName(item.category) : (currentLang === 'km' ? 'មិនបានបែងចែក' : 'Uncategorized') }}
                    </span>
                    <h3 class="text-base font-black text-on-surface leading-tight">{{ translateDishName(item.name) }}</h3>
                  </div>
                </div>
                <p class="text-on-surface-variant text-xs line-clamp-2 mb-3 font-medium leading-relaxed">{{ translateDishDesc(item.name, item.description) }}</p>
                
                <!-- Ingredients Preview -->
                <div class="flex flex-wrap gap-1 mb-4">
                  <span v-for="ing in item.ingredients?.slice(0, 3)" :key="typeof ing === 'string' ? ing : ing.name" class="px-2 py-0.5 bg-surface-container rounded text-[9px] font-bold text-on-surface-variant">
                    {{ typeof ing === 'string' ? translateIngredient(ing) : `${translateIngredient(ing.name)} (${ing.amount}${translateUnitName(ing.unit)})` }}
                  </span>
                  <span v-if="item.ingredients?.length > 3" class="text-[9px] font-bold text-outline py-0.5">
                    +{{ item.ingredients.length - 3 }} {{ currentLang === 'km' ? 'មុខទៀត' : 'more' }}
                  </span>
                </div>

                <div class="flex items-center justify-between mt-auto">
                  <div>
                    <p class="text-[9px] font-bold text-on-surface-variant uppercase tracking-widest leading-none mb-1">
                      {{ currentLang === 'km' ? 'តម្លៃ' : 'Price' }}
                    </p>
                    <p class="text-lg font-black text-primary">${{ item.price.toFixed(2) }}</p>
                  </div>
                  <div class="flex gap-1.5">
                    <button 
                      @click.stop="openEditModal(item)"
                      class="p-2 rounded-full bg-surface-container border hover:bg-primary-container hover:text-on-primary-container transition-all"
                    >
                      <span class="material-symbols-outlined text-[18px]">edit</span>
                    </button>
                    <button 
                      @click.stop="deleteItem(item.id)"
                      class="p-2 rounded-full bg-error-container/10 hover:bg-error hover:text-on-error transition-all"
                    >
                      <span class="material-symbols-outlined text-[18px] text-error hover:text-inherit">delete</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="text-center py-12 bg-white rounded-2xl border border-dashed border-outline-variant/80">
            <span class="material-symbols-outlined text-outline text-5xl mb-3">restaurant</span>
            <p class="text-sm font-black text-on-surface-variant">{{ currentLang === 'km' ? 'រកមិនឃើញមុខម្ហូបទេ' : 'No menu items found' }}</p>
            <p class="text-xs text-outline font-bold mt-1">{{ currentLang === 'km' ? 'សូមសាកល្បងប្តូរទៅកាន់ប្រភេទផ្សេង ឬស្វែងរកឈ្មោះមុខម្ហូបថ្មី។' : 'Try to switch categories or search for a different item name.' }}</p>
          </div>
        </div>
      </section>

      <!-- Chart and Top Items -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <!-- Revenue Chart -->
        <div class="lg:col-span-2 bg-white p-8 rounded-3xl shadow-sm border border-surface-variant">
          <div class="flex items-center justify-between mb-8">
            <div>
              <h3 class="text-xl font-black text-on-surface">{{ currentLang === 'km' ? 'លទ្ធផលចំណូលសរុប' : 'Revenue Performance' }}</h3>
              <p class="text-xs text-on-surface-variant font-bold mt-1">{{ currentLang === 'km' ? 'ប្រវត្តិនៃការលក់ប្រចាំសប្តាហ៍' : 'Weekly sales overview' }}</p>
            </div>
            <div class="flex items-center gap-1.5 bg-surface-container-low px-3 py-2 rounded-xl">
              <span class="material-symbols-outlined text-sm text-on-surface-variant">calendar_today</span>
              <select class="bg-transparent text-xs font-bold outline-none border-none cursor-pointer">
                <option>{{ currentLang === 'km' ? '៧ ថ្ងៃចុងក្រោយ' : 'Last 7 Days' }}</option>
                <option>{{ currentLang === 'km' ? '៣០ ថ្ងៃចុងក្រោយ' : 'Last 30 Days' }}</option>
              </select>
            </div>
          </div>
          <div ref="chartContainer" class="w-full h-[300px]"></div>
        </div>

        <!-- Top Selling -->
        <div class="bg-white p-8 rounded-3xl shadow-sm border border-surface-variant">
          <h3 class="text-xl font-black text-on-surface mb-6">{{ currentLang === 'km' ? 'មុខម្ហូបលក់ដាច់បំផុត' : 'Top Selling Items' }}</h3>
          <div class="space-y-6">
            <div v-for="i in 3" :key="i" class="flex items-center gap-4">
              <div class="w-16 h-16 rounded-2xl overflow-hidden shrink-0 border border-surface-variant">
                <img src="https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80&w=150" class="w-full h-full object-cover">
              </div>
              <div class="flex-1">
                <h4 class="text-sm font-black text-on-surface">{{ translateDishName('Double Burger') }}</h4>
                <p class="text-[10px] font-bold text-on-surface-variant uppercase">{{ currentLang === 'km' ? '៣៤០ ការកុម្ម៉ង់' : '340 Orders' }}</p>
              </div>
              <div class="text-right">
                <p class="text-lg font-black text-primary">$1,894</p>
              </div>
            </div>
          </div>
          <button class="w-full mt-10 py-3 border-2 border-surface-variant rounded-xl text-xs font-black text-on-surface-variant hover:bg-surface-container transition-all">
            {{ currentLang === 'km' ? 'មើលរបាយការណ៍ស្តុកទំនិញ' : 'View Inventory Report' }}
          </button>
        </div>
      </div>

      <!-- Recent Orders Section -->
      <section class="bg-white rounded-3xl shadow-sm border border-surface-variant overflow-hidden">
        <div class="p-8 border-b border-surface-variant flex items-center justify-between">
          <h3 class="text-xl font-black text-on-surface">{{ currentLang === 'km' ? 'ការកុម្ម៉ង់ថ្មីៗ' : 'Recent Orders' }}</h3>
          <button class="text-primary text-xs font-black hover:underline uppercase tracking-widest">{{ currentLang === 'km' ? 'មើលការកុម្ម៉ង់ទាំងអស់' : 'View All Orders' }}</button>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left">
            <thead>
              <tr class="bg-surface-container-low">
                <th class="px-8 py-4 text-xs font-black text-on-surface-variant uppercase tracking-widest">{{ currentLang === 'km' ? 'លេខកុម្ម៉ង់' : 'Order ID' }}</th>
                <th class="px-8 py-4 text-xs font-black text-on-surface-variant uppercase tracking-widest">{{ currentLang === 'km' ? 'អតិថិជន' : 'Customer' }}</th>
                <th class="px-8 py-4 text-xs font-black text-on-surface-variant uppercase tracking-widest">{{ currentLang === 'km' ? 'ចំនួនម្ហូប' : 'Items' }}</th>
                <th class="px-8 py-4 text-xs font-black text-on-surface-variant uppercase tracking-widest">{{ currentLang === 'km' ? 'សរុប' : 'Total' }}</th>
                <th class="px-8 py-4 text-xs font-black text-on-surface-variant uppercase tracking-widest">{{ currentLang === 'km' ? 'ស្ថានភាព' : 'Status' }}</th>
                <th class="px-8 py-4 text-xs font-black text-on-surface-variant uppercase tracking-widest text-right">{{ currentLang === 'km' ? 'ម៉ោងកុម្ម៉ង់' : 'Time' }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-surface-variant">
              <tr v-for="order in recentOrders" :key="order.id" class="hover:bg-surface-container transition-colors">
                <td class="px-8 py-4 text-sm font-bold text-on-surface">{{ order.id }}</td>
                <td class="px-8 py-4">
                  <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-primary-container/20 flex items-center justify-center text-[10px] font-black text-primary">
                      {{ order.customer.split(' ').map(n => n[0]).join('') }}
                    </div>
                    <span class="text-sm font-bold text-on-surface">{{ order.customer }}</span>
                  </div>
                </td>
                <td class="px-8 py-4 text-sm font-bold text-on-surface-variant">{{ currentLang === 'km' ? order.items + ' មុខ' : order.items + (order.items === 1 ? ' item' : ' items') }}</td>
                <td class="px-8 py-4 text-sm font-black text-on-surface">{{ order.total }}</td>
                <td class="px-8 py-4">
                  <span 
                    class="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter"
                    :class="{
                      'bg-tertiary/10 text-tertiary': order.status === 'Completed',
                      'bg-primary-container/20 text-on-primary-container': order.status === 'In Progress',
                      'bg-secondary/10 text-secondary': order.status === 'Pending'
                    }"
                  >
                    {{ order.status === 'Completed' ? (currentLang === 'km' ? 'បានបញ្ចប់' : 'Completed') :
                       order.status === 'In Progress' ? (currentLang === 'km' ? 'កំពុងចម្អិន' : 'In Progress') : 
                       (currentLang === 'km' ? 'រង់ចាំ' : 'Pending') }}
                  </span>
                </td>
                <td class="px-8 py-4 text-right text-xs font-bold text-on-surface-variant">
                  {{ currentLang === 'km' ? (
                    order.time === '10 mins ago' ? '១០ នាទីមុន' :
                    order.time === '15 mins ago' ? '១១ នាទីមុន' :
                    order.time === '20 mins ago' ? '២០ នាទីមុន' :
                    order.time === '25 mins ago' ? '២៥ នាទីមុន' :
                    order.time === '30 mins ago' ? '៣០ នាទីមុន' : order.time
                  ) : order.time }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </main>

    <!-- ==== MENU MANAGEMENT MODALS & BULK BAR ==== -->
    <!-- Edit/Add Modal -->
    <div v-if="isEditModalOpen" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-on-surface/40 backdrop-blur-sm" @click="isEditModalOpen = false"></div>
      <div class="bg-white w-full max-w-2xl rounded-[40px] shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
        <div class="p-8 border-b border-surface-variant flex justify-between items-center bg-surface-container-low">
          <div>
            <h3 class="text-2xl font-black text-on-surface">{{ isAddingItem ? 'Add New Menu Item' : 'Edit Menu Item' }}</h3>
            <p class="text-sm font-bold text-on-surface-variant mt-1">{{ isAddingItem ? 'Create a new culinary masterpiece' : 'Refine your product details' }}</p>
          </div>
          <button @click="isEditModalOpen = false" class="p-2 hover:bg-surface-container rounded-full transition-colors">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>

        <div class="p-8 overflow-y-auto space-y-8 flex-1 custom-scrollbar">
          <!-- Basic Info -->
          <div class="grid grid-cols-2 gap-6 font-bold text-on-surface">
            <div class="col-span-2">
              <label class="block text-xs font-black uppercase tracking-widest text-on-surface-variant mb-2">Item Name</label>
              <input 
                v-model="editingItem.name"
                class="w-full bg-surface-container rounded-2xl p-4 font-bold border-2 border-transparent focus:border-primary outline-none transition-all text-sm"
                placeholder="Ex: Double Cheese Burger"
              />
            </div>
            <div>
              <label class="block text-xs font-black uppercase tracking-widest text-on-surface-variant mb-2">Price ($)</label>
              <input 
                v-model.number="editingItem.price"
                type="number"
                step="0.01"
                class="w-full bg-surface-container rounded-2xl p-4 font-bold border-2 border-transparent focus:border-primary outline-none transition-all text-sm"
                placeholder="0.00"
              />
            </div>
            <div>
              <label class="block text-xs font-black uppercase tracking-widest text-on-surface-variant mb-2">Status</label>
              <select 
                v-model="editingItem.status"
                class="w-full bg-surface-container rounded-2xl p-4 font-bold border-2 border-transparent focus:border-primary outline-none transition-all text-sm appearance-none cursor-pointer"
              >
                <option value="Available">Available</option>
                <option value="Sold Out">Sold Out</option>
              </select>
            </div>
            <div class="col-span-2">
              <label class="block text-xs font-black uppercase tracking-widest text-on-surface-variant mb-2">Category</label>
              <select 
                v-model="editingItem.category"
                class="w-full bg-surface-container rounded-2xl p-4 font-bold border-2 border-transparent focus:border-primary outline-none transition-all text-sm appearance-none cursor-pointer"
              >
                <option value="">Uncategorized</option>
                <option 
                  v-for="cat in categories.filter((c: any) => c.name.toLowerCase() !== 'all menu')" 
                  :key="cat.name" 
                  :value="cat.name"
                >
                  {{ cat.name }}
                </option>
              </select>
            </div>
            <div class="col-span-2">
              <label class="block text-xs font-black uppercase tracking-widest text-on-surface-variant mb-2">Image URL</label>
              <div class="flex gap-4 items-center">
                <input 
                  v-model="editingItem.image"
                  class="flex-1 bg-surface-container rounded-2xl p-4 font-bold border-2 border-transparent focus:border-primary outline-none transition-all text-xs"
                  placeholder="Paste food image URL here..."
                />
                <div class="w-16 h-16 rounded-2xl bg-surface-container-high overflow-hidden shrink-0 border-2 border-surface-variant flex items-center justify-center">
                  <img v-if="editingItem.image" :src="editingItem.image" class="w-full h-full object-cover" @error="(e) => (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=400'" />
                  <span v-else class="material-symbols-outlined text-outline">image</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Description -->
          <div>
            <label class="block text-xs font-black uppercase tracking-widest text-on-surface-variant mb-2">Description</label>
            <textarea 
              v-model="editingItem.description"
              rows="3"
              class="w-full bg-surface-container rounded-2xl p-4 font-bold border-2 border-transparent focus:border-primary outline-none transition-all resize-none text-sm text-on-surface"
              placeholder="Describe your delicious meal..."
            ></textarea>
          </div>

          <!-- Ingredients Adjustments -->
          <div>
            <label class="block text-xs font-black uppercase tracking-widest text-on-surface-variant mb-3">Ingredients (Adjustable by Customer)</label>
            
            <div class="bg-surface-container p-5 rounded-3xl border border-surface-variant/40 space-y-4 mb-4 shadow-inner">
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div class="flex flex-col gap-1">
                  <span class="text-[10px] font-black uppercase tracking-wider text-outline">Name</span>
                  <input 
                    v-model="newIngName"
                    @keyup.enter="addIngredient"
                    class="bg-white rounded-xl px-3 py-2 text-xs font-bold border-2 border-transparent focus:border-primary outline-none transition-all shadow-sm text-on-surface"
                    placeholder="Chili, Pepper..."
                  />
                </div>
                <div class="flex flex-col gap-1">
                  <span class="text-[10px] font-black uppercase tracking-wider text-outline">Default portion</span>
                  <input 
                    v-model.number="newIngAmount"
                    type="number"
                    step="0.01"
                    min="0"
                    @keyup.enter="addIngredient"
                    class="bg-white rounded-xl px-3 py-2 text-xs font-bold border-2 border-transparent focus:border-primary outline-none transition-all shadow-sm text-on-surface"
                    placeholder="E.g. 0.25, 3"
                  />
                </div>
                <div class="flex flex-col gap-1">
                  <span class="text-[10px] font-black uppercase tracking-wider text-outline">Unit type</span>
                  <select 
                    v-model="newIngUnit"
                    class="bg-white rounded-xl px-3 py-2 text-xs font-bold border-2 border-transparent focus:border-primary outline-none transition-all shadow-sm cursor-pointer text-on-surface"
                  >
                    <option value="kg">kg (Kilogram)</option>
                    <option value="pcs">pcs (Pieces)</option>
                    <option value="g">g (Gram)</option>
                    <option value="portions">portions</option>
                  </select>
                </div>
              </div>
              <button 
                type="button" 
                @click="addIngredient"
                class="w-full bg-primary text-white py-2.5 rounded-xl font-black text-xs hover:opacity-90 active:scale-[0.99] transition-all flex items-center justify-center gap-1.5 shadow-md shadow-primary/10"
              >
                <span class="material-symbols-outlined text-base">add</span>
                Add Configured Ingredient
              </button>
            </div>

            <!-- Current ingredients list -->
            <div v-if="editingItem.ingredients && editingItem.ingredients.length > 0" class="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-1">
              <div 
                v-for="(ing, idx) in editingItem.ingredients" 
                :key="idx"
                class="bg-surface-container px-3.5 py-2.5 rounded-xl flex items-center justify-between gap-3 border border-outline-variant/40"
              >
                <div class="truncate">
                  <p class="text-xs font-black text-on-surface truncate">{{ typeof ing === 'string' ? ing : ing.name }}</p>
                  <p class="text-[10px] font-black uppercase tracking-widest text-primary mt-0.5">
                    Portion: {{ typeof ing === 'string' ? "1" : ing.amount }} {{ typeof ing === 'string' ? "pcs" : ing.unit }}
                  </p>
                </div>
                <div class="flex items-center gap-1 shrink-0">
                  <template v-if="typeof ing !== 'string'">
                    <button 
                      type="button" 
                      @click="ing.amount = Math.max(0, +(ing.amount - (ing.unit === 'kg' ? 0.05 : 1)).toFixed(2))"
                      class="w-6 h-6 flex items-center justify-center bg-white border border-outline-variant rounded hover:bg-surface-container text-on-surface transition-colors"
                    >
                      <span class="material-symbols-outlined text-xs text-on-surface">remove</span>
                    </button>
                    <button 
                      type="button" 
                      @click="ing.amount = +(ing.amount + (ing.unit === 'kg' ? 0.05 : 1)).toFixed(2)"
                      class="w-6 h-6 flex items-center justify-center bg-white border border-outline-variant rounded hover:bg-surface-container text-on-surface transition-colors"
                    >
                      <span class="material-symbols-outlined text-xs text-on-surface">add</span>
                    </button>
                  </template>
                  <button 
                    type="button" 
                    @click="removeIngredient(idx)"
                    class="w-6 h-6 flex items-center justify-center hover:bg-error-container text-outline hover:text-error rounded-md transition-colors"
                  >
                    <span class="material-symbols-outlined text-base">close</span>
                  </button>
                </div>
              </div>
            </div>
            <div v-else class="text-center py-6 border border-dashed border-outline-variant rounded-2xl">
              <p class="text-xs text-on-surface-variant font-bold">No ingredients defined yet.</p>
            </div>
          </div>
        </div>

        <div class="p-8 border-t border-surface-variant bg-surface-container-low flex gap-4">
          <button @click="isEditModalOpen = false" class="flex-1 py-4 rounded-2xl font-black text-sm border-2 border-outline-variant hover:bg-surface-variant transition-colors text-on-surface">
            Cancel
          </button>
          <button @click="saveItem" class="flex-1 py-4 bg-primary text-white rounded-2xl font-black text-sm shadow-lg shadow-primary/20 hover:opacity-90 active:scale-[0.98] transition-all">
            Save Changes
          </button>
        </div>
      </div>
    </div>

    <!-- Category Manager Modal -->
    <div v-if="isCategoryModalOpen" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-on-surface/40 backdrop-blur-sm" @click="isCategoryModalOpen = false"></div>
      <div class="bg-white w-full max-w-xl rounded-[40px] shadow-2xl relative overflow-hidden flex flex-col max-h-[85vh]">
        <div class="p-8 border-b border-surface-variant flex justify-between items-center bg-surface-container-low">
          <div>
            <h3 class="text-2xl font-black text-on-surface">Manage Categories</h3>
            <p class="text-sm font-bold text-on-surface-variant mt-1">Create, edit, and reorganize custom categories</p>
          </div>
          <button @click="isCategoryModalOpen = false" class="p-2 hover:bg-surface-container rounded-full transition-colors">
            <span class="material-symbols-outlined text-on-surface">close</span>
          </button>
        </div>

        <div class="p-8 overflow-y-auto space-y-8 flex-1 custom-scrollbar">
          <!-- Create / Edit Form -->
          <div class="bg-surface-container-low p-6 rounded-3xl border border-surface-variant/40 space-y-4">
            <h4 class="text-sm font-black text-on-surface">
              {{ editingCategoryIndex !== null ? 'Edit Category' : 'Create New Category' }}
            </h4>
            
            <div class="space-y-4">
              <div>
                <label class="block text-[10px] font-black uppercase tracking-wider text-on-surface-variant mb-1.5">Category Name</label>
                <input 
                  v-model="categoryForm.name"
                  class="w-full bg-white rounded-xl px-4 py-3 text-sm font-bold border-2 border-transparent focus:border-primary outline-none transition-all shadow-sm text-on-surface"
                  placeholder="E.g. Desserts, Soup, Ramen"
                />
              </div>

              <div>
                <label class="block text-[10px] font-black uppercase tracking-wider text-on-surface-variant mb-2">Choose Icon</label>
                <div class="grid grid-cols-5 gap-2 max-h-40 overflow-y-auto p-1 bg-white rounded-xl border border-outline-variant/30">
                  <button 
                    v-for="icon in predefinedIcons"
                    :key="icon"
                    type="button"
                    @click="categoryForm.icon = icon"
                    class="p-2 rounded-lg flex items-center justify-center hover:bg-primary-container/20 border-2 transition-all"
                    :class="categoryForm.icon === icon ? 'border-primary bg-primary-container/10 text-primary scale-[1.05]' : 'border-transparent text-outline'"
                  >
                    <span class="material-symbols-outlined text-2xl">{{ icon }}</span>
                  </button>
                </div>
              </div>
            </div>

            <div class="flex gap-2 pt-2">
              <button 
                v-if="editingCategoryIndex !== null"
                type="button"
                @click="cancelEditCategory"
                class="flex-1 py-2.5 bg-surface-variant hover:bg-opacity-90 rounded-xl font-black text-xs transition-colors text-on-surface"
              >
                Cancel
              </button>
              <button 
                type="button" 
                @click="saveCategory"
                class="flex-1 py-2.5 bg-primary text-white hover:opacity-95 rounded-xl font-black text-xs shadow-md shadow-primary/10 transition-all active:scale-[0.99] flex items-center justify-center gap-1"
                :disabled="!categoryForm.name.trim()"
              >
                <span class="material-symbols-outlined text-base">save</span>
                {{ editingCategoryIndex !== null ? 'Update Category' : 'Add Category' }}
              </button>
            </div>
          </div>

          <!-- Existing Categories List -->
          <div class="space-y-3">
            <h4 class="text-xs font-black uppercase tracking-wider text-on-surface-variant">Active Categories</h4>
            <div class="space-y-2">
              <div 
                v-for="(cat, idx) in categories" 
                :key="cat.name"
                class="p-4 bg-surface-container rounded-2xl flex items-center justify-between border border-outline-variant/30 text-on-surface"
              >
                <div class="flex items-center gap-3">
                  <span class="material-symbols-outlined bg-white p-2.5 rounded-xl text-primary shadow-sm">{{ cat.icon }}</span>
                  <div>
                    <p class="text-sm font-black text-on-surface">{{ cat.name }}</p>
                    <p class="text-[10px] text-outline font-bold uppercase tracking-wider">
                      {{ cat.name.toLowerCase() === 'all menu' ? 'System Category' : 'Custom Category' }}
                    </p>
                  </div>
                </div>

                <div 
                  v-if="cat.name.toLowerCase() !== 'all menu'" 
                  class="flex items-center gap-1"
                >
                  <button 
                    @click="startEditCategory(idx)"
                    class="p-2 rounded-lg bg-white border border-outline-variant text-[16px] text-outline hover:text-primary hover:bg-primary-container/10 transition-colors"
                  >
                    <span class="material-symbols-outlined text-base">edit</span>
                  </button>
                  <button 
                    @click="deleteCategory(idx)"
                    class="p-2 rounded-lg bg-white border border-outline-variant text-[16px] text-outline hover:text-error hover:bg-error-container/10 transition-colors"
                  >
                    <span class="material-symbols-outlined text-base">delete</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="p-8 border-t border-surface-variant bg-surface-container-low flex justify-end">
          <button @click="isCategoryModalOpen = false" class="px-6 py-3 bg-primary text-white rounded-2xl font-black text-sm hover:opacity-90 transition-all">
            Done
          </button>
        </div>
      </div>
    </div>

    <!-- Bulk Action Bar -->
    <transition name="slide-up">
      <div v-if="selectedItems.length > 0" class="fixed bottom-8 left-1/2 -translate-x-1/2 z-[60] bg-inverse-surface text-inverse-on-surface px-8 py-4 rounded-3xl shadow-2xl flex items-center gap-8 border border-white/10 backdrop-blur-xl">
        <div class="flex items-center gap-3 border-r border-white/10 pr-8">
          <span class="bg-primary text-white min-w-[28px] h-7 px-1 rounded-full flex items-center justify-center text-xs font-black">{{ selectedItems.length }}</span>
          <span class="text-sm font-black whitespace-nowrap">Items Selected</span>
        </div>
        <div class="flex items-center gap-4">
          <button @click="bulkOutOfStock" class="flex items-center gap-2 hover:text-primary transition-colors text-xs font-black uppercase tracking-widest group">
            <span class="material-symbols-outlined text-lg group-active:scale-90 transition-transform">block</span>
            Set Out of Stock
          </button>
          <button @click="bulkDelete" class="flex items-center gap-2 text-error hover:opacity-80 transition-opacity text-xs font-black uppercase tracking-widest group">
            <span class="material-symbols-outlined text-lg group-active:scale-90 transition-transform">delete</span>
            Delete Items
          </button>
        </div>
        <button @click="clearSelection" class="ml-4 text-white/40 hover:text-white transition-colors">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.grid :deep(line) {
  stroke-dasharray: 4;
}

.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: var(--color-surface-variant);
  border-radius: 10px;
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translate(-50%, 100px);
  opacity: 0;
}
</style>
